/**
 * Certifications MOBILE (atlante §10.4): dalla facciata, «Certifications →»
 * apre una fotografia dello stato, senza periodo. Prima la SINTESI (una riga
 * per protocollo: logo, livello, stato e rinnovo; la barra è il PUNTEGGIO,
 * non la posizione delle milestone), poi la SCORECARD LEED (punti su 110
 * sulla scala a tacche + una barra per categoria di crediti), poi MILESTONE
 * E AUDIT (i widget del PC come un'unica linea del tempo per protocollo).
 *
 * Corregge tre problemi del PC: la card BREEAM statica compare solo se il
 * sito ha BREEAM; nessun progress inventato (senza punteggio la barra non
 * c'è); «0 pratiche in corso» resta neutro, non rosso.
 */
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticLight } from "@/lib/native";
import { useBackDismiss } from "@/hooks/useBackDismiss";
import { useCertifications, useCertificationMilestones, type Certification } from "@/hooks/useCertifications";
import { isValidUUID } from "@/lib/utils";
import { AMBER, INK, RULE, SUB, TEAL, MetricTabs, ExportMenu } from "./bits";

interface Props {
  siteId?: string;
  siteName: string;
  /** nomi certificazioni da admin/demo (fallback se il DB non ha righe) */
  certNames?: string[];
  isDemoSite: boolean;
  onBack: () => void;
}

const LOGO: Record<string, string> = { LEED: "/leed_logo.webp", WELL: "/well_logo.webp", BREEAM: "/breeam_logo.webp" };

/* Costanti dello standard LEED (le stesse del widget desktop). */
const LEED_CATS = [
  { key: "EA", max: 33 }, { key: "WE", max: 12 }, { key: "MR", max: 13 },
  { key: "EQ", max: 16 }, { key: "SS", max: 26 }, { key: "IN", max: 6 }, { key: "RP", max: 4 },
];
const LEED_LEVELS = [
  { name: "Certified", pts: 40 }, { name: "Silver", pts: 50 }, { name: "Gold", pts: 60 }, { name: "Platinum", pts: 80 },
];

interface ProtoRow {
  proto: "LEED" | "WELL" | "BREEAM" | string;
  title: string;
  level?: string | null;
  status?: string | null;
  score?: number | null;
  target?: number | null;      // 110 per LEED, 100% per BREEAM…
  expiry?: string | null;
  cert?: Certification;
}

/** Demo (sito vetrina): i valori del mockup §10.4. */
const DEMO_ROWS: ProtoRow[] = [
  { proto: "LEED", title: "LEED v4 O+M", level: "Gold", status: "active", score: 72, target: 110, expiry: "2027-03-18" },
  { proto: "WELL", title: "WELL v2", level: "Platinum", status: "active", score: 85, target: 110, expiry: "2027-11-10" },
  { proto: "BREEAM", title: "BREEAM In-Use", level: "Excellent", status: "active", score: 74, target: 100, expiry: "2028-06-30" },
];
const DEMO_SCORECARD = [
  { key: "EA", score: 24 }, { key: "WE", score: 7 }, { key: "MR", score: 7 },
  { key: "EQ", score: 11 }, { key: "SS", score: 18 }, { key: "IN", score: 4 }, { key: "RP", score: 1 },
];
const DEMO_TIMELINE = [
  { label: "Pre-assessment", date: "2024-02-01", done: true },
  { label: "Documentazione energia", date: "2024-06-01", done: true },
  { label: "Audit in campo", date: "2024-10-01", done: true },
  { label: "Certificazione Gold", date: "2025-01-01", done: true },
  { label: "Raccolta dati annuale", date: "2026-12-01", done: false },
];

const protoOf = (certType: string): string => {
  const up = certType.toUpperCase();
  if (up.includes("LEED")) return "LEED";
  if (up.includes("WELL")) return "WELL";
  if (up.includes("BREEAM")) return "BREEAM";
  return certType;
};

const CertificationsMobile = ({ siteId, siteName, certNames, isDemoSite, onBack }: Props) => {
  const { t, language } = useLanguage();
  const [view, setView] = useState<"summary" | "scorecard" | "milestones">("summary");
  const [msProto, setMsProto] = useState<string>("LEED");
  useBackDismiss(true, onBack);

  const safeSiteId = siteId && isValidUUID(siteId) && !isDemoSite ? siteId : undefined;
  const { data: certRows } = useCertifications(safeSiteId);
  const leedCert = useMemo(
    () => (certRows || []).find(c => protoOf(c.cert_type) === "LEED") ?? null,
    [certRows],
  );
  const { data: leedMs } = useCertificationMilestones(leedCert?.id);

  const nfMonth = useMemo(() => new Intl.DateTimeFormat(language, { month: "short", year: "numeric" }), [language]);
  const nfLong = useMemo(() => new Intl.DateTimeFormat(language, { day: "numeric", month: "long", year: "numeric" }), [language]);

  /* righe di sintesi: dal DB; demo o soli-nomi come fallback onesto */
  const rows: ProtoRow[] = useMemo(() => {
    if (isDemoSite) return DEMO_ROWS;
    const NOT_BUILDING = new Set(["Energy", "Air", "Water"]);
    const db = (certRows || [])
      .filter(c => c.cert_type && !NOT_BUILDING.has(c.cert_type))
      .map(c => ({
        proto: protoOf(c.cert_type),
        title: c.cert_type,
        level: c.cert_level,
        status: c.status,
        score: c.score,
        target: c.target_score ?? (protoOf(c.cert_type) === "LEED" ? 110 : null),
        expiry: c.expiry_date,
        cert: c,
      }));
    if (db.length > 0) return db;
    // solo i nomi da admin: righe senza punteggio (niente barre inventate)
    return (certNames || [])
      .filter(n => !NOT_BUILDING.has(n))
      .map(n => ({ proto: protoOf(n), title: n, level: null, status: "active", score: null, target: null, expiry: null }));
  }, [isDemoSite, certRows, certNames]);

  const activeCount = rows.filter(r => r.status === "active" || r.status === "achieved").length || rows.length;
  const nextAudit = useMemo(() => {
    const future = rows
      .map(r => (r.expiry ? { proto: r.proto, d: new Date(r.expiry) } : null))
      .filter((x): x is { proto: string; d: Date } => !!x && !Number.isNaN(x.d.getTime()) && x.d.getTime() > Date.now())
      .sort((a, b) => a.d.getTime() - b.d.getTime())[0];
    if (!future) return null;
    const months = Math.max(0, Math.round((future.d.getTime() - Date.now()) / (30.44 * 86400e3)));
    return { ...future, months };
  }, [rows]);

  /* scorecard LEED: punteggi per categoria dalle milestone «scorecard» */
  const scorecard = useMemo(() => {
    if (isDemoSite) return DEMO_SCORECARD;
    const ms = (leedMs || []).filter(m => (m as { milestone_type?: string }).milestone_type !== "timeline");
    return LEED_CATS.map(cat => {
      const row = ms.find(m => (m.category || "").toUpperCase().includes(cat.key));
      return row?.score != null ? { key: cat.key, score: Number(row.score) } : null;
    }).filter((x): x is { key: string; score: number } => x != null);
  }, [isDemoSite, leedMs]);
  const leedRow = rows.find(r => r.proto === "LEED");
  const leedScore = isDemoSite ? 72 : (leedRow?.score ?? null);
  const hasScorecard = leedRow != null && leedScore != null;

  /* milestone: dal DB (timeline) per il protocollo scelto; demo fissa */
  const timeline = useMemo(() => {
    if (isDemoSite) return DEMO_TIMELINE;
    if (msProto !== "LEED") return []; // solo LEED ha milestone nel DB oggi
    return (leedMs || [])
      .filter(m => (m as { milestone_type?: string }).milestone_type === "timeline")
      .map(m => ({
        label: m.requirement || m.category,
        date: (m as { due_date?: string | null }).due_date ?? null,
        done: ["achieved", "completed"].includes(String(m.status)),
      }));
  }, [isDemoSite, msProto, leedMs]);

  const CAT_NAME: Record<string, string> = {
    EA: t("cm.cat_ea"), WE: t("cm.cat_we"), MR: t("cm.cat_mr"), EQ: t("cm.cat_eq"),
    SS: t("cm.cat_ss"), IN: t("cm.cat_in"), RP: t("cm.cat_rp"),
  };

  const levelNow = (score: number) => [...LEED_LEVELS].reverse().find(l => score >= l.pts);
  const levelNext = (score: number) => LEED_LEVELS.find(l => score < l.pts);

  const views = [
    { id: "summary", label: t("cm.tab_summary") },
    ...(hasScorecard ? [{ id: "scorecard", label: "Scorecard" }] : []),
    ...(timeline.length > 0 || isDemoSite ? [{ id: "milestones", label: t("cm.tab_milestones") }] : []),
  ];

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto no-scrollbar"
      style={{ background: "linear-gradient(180deg, #f6fafa 0%, #ffffff 30%)", color: INK, paddingTop: "var(--sat, 0px)", paddingBottom: "calc(var(--sab, 0px) + 20px)", WebkitOverflowScrolling: "touch" }}>
      {/* barra superiore */}
      <div className="relative shrink-0 flex items-center justify-between px-2 pt-1">
        <button type="button" onClick={onBack} aria-label="←" className="grid place-items-center" style={{ width: 44, height: 44, color: INK }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0 flex-1">
          <span className="inline-block whitespace-nowrap" style={{ fontSize: 15, fontWeight: 600 }}>{t("ovm.cta_cert").replace(" →", "")}</span>
          <span className="truncate" style={{ fontSize: 13, color: SUB, marginLeft: 6 }}>{siteName}</span>
          {isDemoSite && <span className="align-middle" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#b45309", background: "rgba(217,154,43,.15)", borderRadius: 999, padding: "2px 7px", marginLeft: 6 }}>DEMO</span>}
        </div>
        <ExportMenu items={[]} />
      </div>
      {/* fotografia dello stato, nessun periodo (§10.4) */}
      <p className="text-center" style={{ fontSize: 11.5, color: SUB, margin: "2px 0 0" }}>{t("cm.snapshot")}</p>

      <MetricTabs tabs={views} value={view} onChange={id => { hapticLight(); setView(id as typeof view); }} />

      {/* ── SINTESI ── */}
      {view === "summary" && (
        <>
          <div className="px-6 mt-2">
            {rows.map(r => (
              <div key={r.title} className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${RULE}` }}>
                <span className="grid place-items-center shrink-0 bg-white" style={{ width: 52, height: 52, borderRadius: 13, boxShadow: "0 4px 12px rgba(5,20,22,.10)" }}>
                  {LOGO[r.proto]
                    ? <img src={LOGO[r.proto]} alt={r.proto} style={{ maxWidth: 40, maxHeight: 40, objectFit: "contain" }} />
                    : <span style={{ fontSize: 11, fontWeight: 700, color: SUB }}>{r.proto.slice(0, 5)}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ fontSize: 14.5, fontWeight: 600 }}>{r.title}</span>
                  <span className="block" style={{ fontSize: 11.5, color: SUB }}>
                    {(r.status === "active" || r.status === "achieved") ? t("cm.certified") : (r.status ?? "—")}
                    {r.expiry ? ` · ${t("cm.renewal")} ${nfMonth.format(new Date(r.expiry))}` : ""}
                  </span>
                  {/* la barra è il PUNTEGGIO; senza punteggio non c'è barra */}
                  {r.score != null && r.target ? (
                    <span className="block mt-1.5 overflow-hidden rounded-full" style={{ height: 4, background: "#e6eeee", maxWidth: 170 }}>
                      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (r.score / r.target) * 100)}%`, background: TEAL }} />
                    </span>
                  ) : null}
                </span>
                <span className="text-right shrink-0">
                  <span className="block" style={{ fontSize: 15, fontWeight: 700, color: TEAL }}>{r.level ?? "—"}</span>
                  {r.score != null && (
                    <span className="block tabular-nums" style={{ fontSize: 11.5, color: SUB }}>
                      {r.target === 100 ? `${r.score}%` : `${r.score}/${r.target ?? "—"} pt`}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <div className="px-6 mt-5 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="tabular-nums" style={{ fontSize: 20 }}>{activeCount}</div>
              <div style={{ fontSize: 11, color: SUB }}>{t("cm.active")}</div>
            </div>
            <div>
              <div className="tabular-nums" style={{ fontSize: 20 }}>{isDemoSite ? "12/15" : String(timeline.filter(x => x.done).length) + (timeline.length ? `/${timeline.length}` : "")}</div>
              <div style={{ fontSize: 11, color: SUB }}>milestone</div>
            </div>
            <div>
              {/* «0 pratiche in corso» resta NEUTRO (§10.4) */}
              <div className="tabular-nums" style={{ fontSize: 20 }}>{isDemoSite ? 0 : timeline.filter(x => !x.done).length}</div>
              <div style={{ fontSize: 11, color: SUB }}>{t("cm.in_progress")}</div>
            </div>
          </div>
          {nextAudit && (
            <div className="mx-6 mt-5 rounded-xl px-4 py-3" style={{ background: "#eef4f4" }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, margin: 0 }}>{t("cm.next_audit")}</p>
              <p style={{ fontSize: 12.5, color: SUB, margin: "2px 0 0" }}>
                {nextAudit.proto} · {nfLong.format(nextAudit.d)} · {t("cm.in_months").replace("{n}", String(nextAudit.months))}
              </p>
            </div>
          )}
        </>
      )}

      {/* ── SCORECARD LEED ── */}
      {view === "scorecard" && hasScorecard && leedScore != null && (
        <>
          {/* scala a tacche 0–110 con i livelli, come l'hero */}
          <div className="px-6 mt-4">
            <div className="flex items-baseline justify-between">
              <span className="tabular-nums" style={{ fontSize: 26, fontWeight: 700 }}>{leedScore}<em className="not-italic" style={{ fontSize: 14, color: SUB, fontWeight: 400 }}>/110 {t("cm.points")}</em></span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: TEAL }}>{levelNow(leedScore)?.name ?? "—"}</span>
            </div>
            <div className="relative mt-2" style={{ height: 22 }}>
              <div className="absolute inset-x-0 top-2 overflow-hidden rounded-full" style={{ height: 6, background: "#e6eeee" }}>
                <div className="h-full rounded-full" style={{ width: `${(leedScore / 110) * 100}%`, background: TEAL }} />
              </div>
              {LEED_LEVELS.map(l => (
                <span key={l.name} className="absolute top-0" style={{ left: `${(l.pts / 110) * 100}%` }}>
                  <span className="block" style={{ width: 1.5, height: 10, background: "#b9c9ca" }} />
                  {/* come nel mockup: etichette solo su Certified, Gold e Platinum */}
                  {l.name !== "Silver" && (
                    <span className="block -translate-x-1/2 whitespace-nowrap" style={{ fontSize: 8.5, color: SUB, marginTop: 1 }}>
                      {l.name === "Gold" ? l.name : `${l.name} ${l.pts}`}
                    </span>
                  )}
                </span>
              ))}
            </div>
            {/* dove conviene lavorare per salire di livello */}
            {(() => {
              const next = levelNext(leedScore);
              if (!next) return null;
              const best = scorecard
                .map(c => ({ ...c, gap: (LEED_CATS.find(k => k.key === c.key)?.max ?? 0) - c.score }))
                .sort((a, b) => b.gap - a.gap)[0];
              return (
                <p style={{ fontSize: 12.5, color: SUB, marginTop: 14, lineHeight: 1.5 }}>
                  {t("cm.gap_hint")
                    .replace("{n}", String(next.pts - leedScore))
                    .replace("{lvl}", next.name)
                    .replace("{cat}", best ? `${CAT_NAME[best.key] ?? best.key} (${best.gap})` : "—")}
                </p>
              );
            })()}
          </div>
          <div className="px-6 mt-4">
            {LEED_CATS.map(cat => {
              const sc = scorecard.find(c => c.key === cat.key);
              return (
                <div key={cat.key} className="py-2.5" style={{ borderBottom: `1px solid ${RULE}` }}>
                  <div className="flex justify-between" style={{ fontSize: 13 }}>
                    <span>{CAT_NAME[cat.key] ?? cat.key} <em className="not-italic" style={{ color: "#9fb2b3", fontSize: 11 }}>{cat.key}</em></span>
                    <span className="tabular-nums" style={{ color: SUB }}>{sc ? `${sc.score}/${cat.max}` : "—"}</span>
                  </div>
                  <div className="mt-1.5 overflow-hidden rounded-full" style={{ height: 4, background: "#eef4f4" }}>
                    {sc && <div className="h-full rounded-full" style={{ width: `${Math.min(100, (sc.score / cat.max) * 100)}%`, background: TEAL }} />}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="px-6" style={{ fontSize: 10.5, color: "#9fb2b3", marginTop: 10 }}>{t("cm.leed_note")}</p>
        </>
      )}

      {/* ── MILESTONE E AUDIT ── */}
      {view === "milestones" && (
        <>
          <MetricTabs
            tabs={rows.map(r => ({ id: r.proto, label: r.proto }))}
            value={msProto}
            onChange={id => setMsProto(id)}
          />
          <div className="px-6 mt-2">
            {(msProto === "LEED" || isDemoSite ? timeline : []).map((m, i, arr) => (
              <div key={i} className="flex gap-3">
                <span className="flex flex-col items-center" aria-hidden>
                  <span className="shrink-0 rounded-full" style={{
                    width: 10, height: 10, marginTop: 5,
                    background: m.done ? TEAL : "transparent",
                    border: m.done ? "none" : `1.6px solid ${m.date && new Date(m.date).getTime() < Date.now() + 90 * 86400e3 ? AMBER : "#b9c9ca"}`,
                  }} />
                  {i < arr.length - 1 && <span className="flex-1" style={{ width: 1.5, background: RULE, minHeight: 26 }} />}
                </span>
                <span className="pb-4 min-w-0">
                  <span className="block" style={{ fontSize: 13.5, color: m.done ? INK : SUB, fontWeight: m.done ? 500 : 400 }}>{m.label}</span>
                  {m.date && <span className="block" style={{ fontSize: 11.5, color: "#9fb2b3" }}>{nfMonth.format(new Date(m.date))}</span>}
                </span>
              </div>
            ))}
            {/* audit di rinnovo evidenziato in coda alla timeline */}
            {nextAudit && (msProto === nextAudit.proto || isDemoSite) && (
              <div className="flex gap-3">
                <span className="flex flex-col items-center" aria-hidden>
                  <span className="shrink-0 rounded-full" style={{ width: 10, height: 10, marginTop: 5, background: AMBER }} />
                </span>
                <span className="min-w-0">
                  <span className="block" style={{ fontSize: 13.5, fontWeight: 600 }}>{t("cm.renewal_audit").replace("{p}", nextAudit.proto)}</span>
                  <span className="block" style={{ fontSize: 11.5, color: "#9fb2b3" }}>{nfLong.format(nextAudit.d)}</span>
                </span>
              </div>
            )}
            {msProto !== "LEED" && !isDemoSite && (
              <p style={{ fontSize: 12.5, color: SUB, marginTop: 8 }}>{t("cm.no_milestones")}</p>
            )}
          </div>
          <div className="mx-6 mt-4 rounded-xl px-4 py-3" style={{ background: "#eef4f4" }}>
            <p style={{ fontSize: 12, color: SUB, margin: 0 }}>
              <b style={{ color: INK, fontWeight: 600 }}>{t("cm.reminder")}</b> · {t("cm.reminder_body")}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default CertificationsMobile;
