/**
 * Dettaglio bolletta (parità PC, mockup B2/B3): le cinque card del modulo
 * desktop — Periodo, Consumo (con fasce e reattiva), Potenza & Performance,
 * Costi & Oneri, Dati aggiuntivi — ricomposte nel linguaggio della dashboard
 * mobile: verdetto → barra dei costi → fasce → griglia → righe. In più il
 * confronto col MISURATO nel periodo esatto della bolletta.
 * Stati pending/analyzing/error onesti: niente grafici inventati.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackDismiss } from "@/hooks/useBackDismiss";
import { AMBER, INK, RED, RULE, SUB, TEAL, VerdictLine } from "./bits";
import type { BillItem } from "./useEnergyInsights";

const pad = (n: number) => String(n).padStart(2, "0");

const BillDetail = ({ bill, siteName, isDemo, contractKw, fmtAmt, onClose, onRetry, onDelete }: {
  bill: BillItem | null;
  siteName: string;
  isDemo: boolean;
  /** potenza impegnata del sito (per l'ambra sul picco) */
  contractKw?: number;
  /** importo nella valuta del sito (maxFrac: 0 per i totali, 4 per €/kWh) */
  fmtAmt: (v: number | null | undefined, maxFrac?: number) => string;
  onClose: () => void;
  /** rilancia analyze-bill (solo stato error) — assente in demo */
  onRetry?: (b: BillItem) => Promise<void>;
  /** elimina bolletta + file (doppia conferma qui) — assente in demo */
  onDelete?: (b: BillItem) => Promise<void>;
}) => {
  const { t, language } = useLanguage();
  useBackDismiss(!!bill, onClose);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);
  // cambiando bolletta la conferma di cancellazione riparte da zero
  useEffect(() => { setConfirmDel(false); setBusy(false); }, [bill?.id]);
  const nf0 = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 0 }), [language]);
  const nf1 = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 1 }), [language]);
  const nf3 = useMemo(() => new Intl.NumberFormat(language, { minimumFractionDigits: 3, maximumFractionDigits: 3 }), [language]);
  const dfLong = useMemo(() => new Intl.DateTimeFormat(language, { day: "numeric", month: "long" }), [language]);
  const dfShort = useMemo(() => new Intl.DateTimeFormat(language, { day: "numeric", month: "short", year: "numeric" }), [language]);
  const monthYear = useMemo(() => new Intl.DateTimeFormat(language, { month: "long", year: "numeric" }), [language]);

  if (!bill) return null;
  const b = bill;
  const dt = (k?: string) => (k ? new Date(`${k.slice(0, 10)}T12:00:00`) : null);
  const ps = dt(b.periodStart), pe = dt(b.periodEnd), up = dt(b.uploadedAt);
  const title = ps ? monthYear.format(ps).replace(/^./, c => c.toUpperCase()) : b.fileName;
  const range = ps && pe ? `${dfLong.format(ps)} – ${dfLong.format(pe)}` : null;
  const sub = [b.company, range, b.currency].filter(Boolean).join(" · ");
  const completed = b.status === "completed";
  const failed = b.status === "error";

  // Costi & Oneri (card PC) → barra impilata. Le parti si mostrano solo se
  // note; se la somma supera il totale dichiarato, si rinuncia alla barra
  // (dati incoerenti: meglio i soli numeri che una proporzione falsa).
  const parts = [
    { k: t("md.energy_lbl"), v: b.energyCost, c: TEAL },
    { k: t("md.fixed_lbl"), v: b.fixedCharges, c: "#9fd3d6" },
    { k: t("md.taxes_lbl"), v: b.taxes, c: "#d9e6e6" },
  ].filter((p): p is { k: string; v: number; c: string } => p.v != null && p.v > 0);
  const partsSum = parts.reduce((a, p) => a + p.v, 0);
  const showStack = parts.length >= 2 && (b.totalAmount == null || partsSum <= b.totalAmount * 1.02);

  const bands = b.peakKwh != null && b.offPeakKwh != null && b.peakKwh + b.offPeakKwh > 0
    ? { peak: b.peakKwh, off: b.offPeakKwh, max: Math.max(b.peakKwh, b.offPeakKwh) }
    : null;

  const peakOver = b.peakKw != null && contractKw != null && b.peakKw > contractKw;
  const addl = Object.entries(b.additional ?? {})
    .filter(([, v]) => v != null && v !== "" && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"));

  const grid: Array<{ l: string; v: string; warn?: boolean }> = [
    ...(b.peakKw != null ? [{ l: t("md.peak_power_lbl"), v: `${nf1.format(b.peakKw)} kW`, warn: peakOver }] : []),
    ...(b.powerFactor != null ? [{ l: t("md.pf_lbl"), v: nf3.format(b.powerFactor) }] : []),
    ...(b.reactiveKvarh != null ? [{ l: t("md.reactive_lbl"), v: `${nf0.format(b.reactiveKvarh)} kVArh` }] : []),
    ...(b.measuredKwh != null ? [{ l: t("md.measured_period"), v: `${nf0.format(b.measuredKwh)} kWh` }] : []),
    ...(up ? [{ l: t("md.uploaded_lbl"), v: `${dfShort.format(up)} · ${b.fileName}` }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto no-scrollbar"
      style={{ background: "linear-gradient(180deg, #f6fafa 0%, #ffffff 30%)", color: INK, paddingTop: "var(--sat, 0px)", paddingBottom: "calc(var(--sab, 0px) + 28px)", WebkitOverflowScrolling: "touch" }}>
      <div className="relative flex items-center justify-between px-2 pt-1">
        <button type="button" onClick={onClose} aria-label="←" className="grid place-items-center" style={{ width: 44, height: 44, color: INK }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0 flex-1">
          <span className="inline-block whitespace-nowrap" style={{ fontSize: 15, fontWeight: 600 }}>{t("md.bill_t")}</span>
          <span className="truncate" style={{ fontSize: 13, color: SUB, marginLeft: 6 }}>{siteName}</span>
          {isDemo && <span className="align-middle" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#b45309", background: "rgba(217,154,43,.15)", borderRadius: 999, padding: "2px 7px", marginLeft: 6 }}>DEMO</span>}
        </div>
        <span style={{ width: 44 }} />
      </div>

      <div className="text-center px-6 mt-2">
        <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.15 }}>{title}</div>
        <div style={{ fontSize: 12, color: SUB, marginTop: 3 }}>{sub || t("md.uploaded_on").replace("{d}", up ? dfShort.format(up) : "—")}</div>
      </div>

      {/* ── stato non analizzato: verdetto onesto, nessun dato inventato ── */}
      {!completed && (
        <>
          <VerdictLine
            color={failed ? RED : "#3b5fa0"}
            verdict={t(failed ? "md.analysis_failed" : "md.analyzing_t")}
            summary={t(failed ? "md.analysis_failed_sub" : "md.analyzing_sub")}
          />
          {!failed && (
            <div className="mx-6 mt-5 grid place-items-center text-center rounded-xl"
              style={{ minHeight: 120, border: "1.5px dashed #d4e0e0", color: "#9fb2b3", fontSize: 12, padding: "0 20px" }}>
              {t("md.analyzing_ph")}
            </div>
          )}
        </>
      )}

      {completed && (
        <>
          <VerdictLine
            color={b.devPct != null && Math.abs(b.devPct) > 5 ? AMBER : TEAL}
            verdict={fmtAmt(b.totalAmount, 0)}
            summary={[
              b.kwh != null ? `${nf0.format(b.kwh)} kWh` : null,
              b.devPct != null ? `${b.devPct > 0 ? "+" : ""}${nf1.format(b.devPct)}% ${t("md.vs_measured")}` : null,
            ].filter(Boolean).join(" · ") || undefined}
          />

          {/* Costi & Oneri → «Dove vanno i soldi» */}
          {showStack && (
            <>
              <div className="flex items-baseline justify-between px-6" style={{ marginTop: 22 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t("md.where_money")}</span>
              </div>
              <div className="flex mx-6 mt-3 rounded-lg overflow-hidden" style={{ height: 26 }} aria-hidden>
                {parts.map(p => <span key={p.k} style={{ width: `${(p.v / partsSum) * 100}%`, background: p.c }} />)}
              </div>
              <p className="text-center" style={{ fontSize: 11, color: SUB, marginTop: 8, padding: "0 16px" }}>
                {parts.map((p, i) => (
                  <span key={p.k} style={{ marginLeft: i > 0 ? 12 : 0, whiteSpace: "nowrap" }}>
                    <span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: p.c, marginRight: 4 }} />
                    {p.k} {fmtAmt(p.v, 0)}
                    {p.v === b.energyCost && b.costPerKwh != null && (
                      <span style={{ color: "#9fb2b3" }}> ({fmtAmt(b.costPerKwh, 4)}/kWh)</span>
                    )}
                  </span>
                ))}
              </p>
            </>
          )}
          {/* parti incoerenti o mancanti: restano i numeri noti, senza barra */}
          {!showStack && b.costPerKwh != null && (
            <p className="text-center" style={{ fontSize: 12, color: SUB, marginTop: 14 }}>
              {fmtAmt(b.costPerKwh, 4)}/kWh
            </p>
          )}

          {/* Consumo → fasce punta / fuori punta */}
          {bands && (
            <>
              <div className="flex items-baseline justify-between px-6" style={{ marginTop: 22 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t("md.bands_t")}</span>
                <span style={{ fontSize: 11, color: SUB }}>kWh</span>
              </div>
              {[{ l: t("md.band_peak"), v: bands.peak, c: "#9fd3d6" }, { l: t("md.band_offpeak"), v: bands.off, c: "#cfe6e7" }].map(r => (
                <div key={r.l} className="flex items-center gap-2.5 mx-6" style={{ marginTop: 9, fontSize: 12 }}>
                  <span style={{ width: 86, flex: "none" }}>{r.l}</span>
                  <span className="flex-1 rounded-full" style={{ height: 12, background: "#eef4f4", position: "relative" }} aria-hidden>
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.v / bands.max) * 100}%`, background: r.c }} />
                  </span>
                  <span className="tabular-nums" style={{ width: 86, textAlign: "right", color: SUB }}>{nf0.format(r.v)}</span>
                </div>
              ))}
            </>
          )}

          {/* Potenza & Performance + periodo/file → griglia */}
          {grid.length > 0 && (
            <div className="grid grid-cols-2 mx-6" style={{ gap: "14px 18px", marginTop: 24 }}>
              {grid.map(g => (
                <div key={g.l} className="min-w-0">
                  <div style={{ fontSize: 11.5, color: SUB }}>{g.l}</div>
                  <div className="truncate tabular-nums" style={{ fontSize: g.v.length > 18 ? 12.5 : 15, fontWeight: g.v.length > 18 ? 500 : 600, marginTop: 1, color: g.warn ? "#b97a14" : INK }}>{g.v}</div>
                </div>
              ))}
            </div>
          )}

          {/* Dati aggiuntivi */}
          {addl.length > 0 && (
            <div className="mx-6" style={{ marginTop: 20, borderTop: `1px solid ${RULE}`, paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: SUB, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{t("md.addl_lbl")}</div>
              {addl.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4" style={{ fontSize: 12, padding: "5px 0" }}>
                  <span className="capitalize" style={{ color: SUB }}>{k.replace(/_/g, " ")}</span>
                  <span className="text-right break-all" style={{ fontWeight: 500 }}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Azioni del PC: Rianalizza (solo su errore) ed Elimina con doppia
          conferma — Elimina cancella anche il file dallo storage. In demo
          i handler non vengono passati e la riga non esiste. */}
      {(onDelete || (failed && onRetry)) && (
        <div className="flex gap-3 mx-6" style={{ marginTop: 28 }}>
          {failed && onRetry && (
            <button type="button" disabled={busy}
              onClick={async () => { setBusy(true); try { await onRetry(b); onClose(); } finally { setBusy(false); } }}
              className="flex-1 rounded-full font-bold uppercase"
              style={{ minHeight: 44, fontSize: 11.5, letterSpacing: "0.08em", color: TEAL, border: "1.4px solid #bfe0e1", background: "none" }}>
              {t("md.retry_lbl")}
            </button>
          )}
          {onDelete && (
            <button type="button" disabled={busy}
              onClick={async () => {
                if (!confirmDel) { setConfirmDel(true); return; }
                setBusy(true);
                try { await onDelete(b); onClose(); } finally { setBusy(false); }
              }}
              className="flex-1 rounded-full font-bold uppercase"
              style={{ minHeight: 44, fontSize: 11.5, letterSpacing: "0.08em", color: "#fff0f3", background: confirmDel ? RED : "transparent", border: confirmDel ? "none" : "1.4px solid #f3d2db", ...(confirmDel ? {} : { color: RED }) }}>
              {busy ? "…" : confirmDel ? t("md.confirm_delete") : t("md.delete_lbl")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BillDetail;
