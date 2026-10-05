/**
 * UX 2.0 preview — Home «Portfolio» (mobile) · v3.
 * Feedback proprietario sulla v2: palette FGB (#9fd5d9/#009193/#016368,
 * vino SOLO per i problemi — niente oro), niente liste infinite
 * (gruppi per stato, chiusi di default), e ARIA: colonna singola,
 * righe respirate, una cosa alla volta.
 */
import { useEffect, useMemo, useState } from "react";
import { Search, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import type { Project } from "@/lib/data";
import type { SiteRealData } from "@/hooks/useAggregatedSiteData";
import { hapticLight } from "@/lib/native";

const AQUA = "#9fd5d9";
const WINE = "#931841";
const WINE_SOFT = "#f9cace";

function Ring({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const R = 56, C = 2 * Math.PI * R;
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setDrawn(pct); return; }
    const id = requestAnimationFrame(() => setDrawn(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <div className="relative grid place-items-center shrink-0 mx-auto" style={{ width: 168, height: 168 }}>
      <svg width="168" height="168" viewBox="0 0 150 150" className="-rotate-90">
        <circle cx="75" cy="75" r={R} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="7" />
        <circle cx="75" cy="75" r={R} fill="none" stroke={AQUA} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${C * Math.max(0.02, drawn)} ${C}`}
          style={{ transition: "stroke-dasharray 1.1s cubic-bezier(.2,.8,.2,1)", filter: `drop-shadow(0 0 12px rgba(0,145,147,.45))` }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-5xl font-bold text-white tabular-nums leading-none">{label}</div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/55 mt-2">{sub}</div>
      </div>
    </div>
  );
}

type GroupKey = "attention" | "online" | "idle";

interface Props {
  visible: boolean;
  projects: Project[];
  sites: SiteRealData[];
  isLoading: boolean;
  onOpenSite: (p: Project) => void;
  onExplore: () => void;
}

const PortfolioHome = ({ visible, projects, sites, isLoading, onOpenSite, onExplore }: Props) => {
  const [q, setQ] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<GroupKey>>(new Set(["attention"]));

  const bySiteId = useMemo(() => new Map(sites.map(s => [s.siteId, s])), [sites]);
  const all = useMemo(() => projects.map(p => ({ p, s: bySiteId.get(p.siteId || "") })), [projects, bySiteId]);

  const groups = useMemo(() => {
    const attention = all.filter(({ s }) => s && (s.alerts.critical > 0 || s.state === "offline" || s.state === "stale"));
    const online = all.filter(({ s }) => s?.state === "online" && !attention.includes(all.find(x => x.s === s)!));
    const inAttention = new Set(attention.map(x => x.p.id));
    const onlineClean = all.filter(({ p, s }) => s?.state === "online" && !inAttention.has(p.id));
    const idle = all.filter(({ p, s }) => !inAttention.has(p.id) && s?.state !== "online");
    void online;
    return { attention, online: onlineClean, idle };
  }, [all]);

  const searching = q.trim().length > 0;
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(({ p }) =>
      (p.displayName || p.name).toLowerCase().includes(needle) || (p.city || "").toLowerCase().includes(needle));
  }, [all, q]);

  const monitored = sites.filter(s => s.state !== "not_installed");
  const online = monitored.filter(s => s.state === "online");
  const pct = monitored.length ? online.length / monitored.length : 0;

  const open = (p: Project) => { hapticLight(); onOpenSite(p); };
  const toggle = (g: GroupKey) => {
    hapticLight();
    setOpenGroups(prev => { const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n; });
  };

  const fmtValue = (s?: SiteRealData) => {
    if (!s) return "—";
    if (s.energy.monthlyKwh && s.energy.monthlyKwh > 0) return `${(s.energy.monthlyKwh / 1000).toFixed(1)} MWh`;
    if (s.air.co2) return `${Math.round(s.air.co2)} ppm`;
    return s.state === "not_installed" ? "—" : "—";
  };
  const dotColor = (s?: SiteRealData) =>
    !s || s.state === "not_installed" ? "rgba(255,255,255,.22)"
      : s.alerts.critical > 0 || s.state === "offline" ? WINE
      : s.state === "stale" ? "#f59e0b" : "#10b981";

  /** Riga sito: colonna singola, respirata, separatore sottile. */
  const SiteRow = ({ p, s, last }: { p: Project; s?: SiteRealData; last: boolean }) => (
    <button onClick={() => open(p)}
      className="w-full flex items-center gap-4 text-left active:opacity-70 transition-opacity"
      style={{ minHeight: 64, borderBottom: last ? "none" : "1px solid rgba(255,255,255,.07)" }}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dotColor(s), boxShadow: `0 0 8px ${dotColor(s)}66` }} />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-medium text-white truncate">{p.displayName || p.name}</span>
        <span className="block text-[11px] uppercase tracking-[0.14em] text-white/40 mt-1">{p.city || p.region}</span>
      </span>
      <span className="text-[12px] text-white/55 tabular-nums shrink-0">{fmtValue(s)}</span>
      <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />
    </button>
  );

  /** Gruppo richiudibile: intestazione con conteggio, righe solo se aperto. */
  const Group = ({ k, title, items, accent }: { k: GroupKey; title: string; items: typeof all; accent?: boolean }) => {
    if (items.length === 0) return null;
    const openG = openGroups.has(k);
    return (
      <section className="mt-5">
        <button onClick={() => toggle(k)} className="w-full flex items-center gap-3 text-left" style={{ minHeight: 48 }}>
          {accent && <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: WINE_SOFT }} />}
          <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: accent ? WINE_SOFT : "rgba(255,255,255,.55)" }}>
            {title}
          </span>
          <span className="text-[12px] tabular-nums px-2.5 py-0.5 rounded-full"
            style={{ background: accent ? "rgba(147,24,65,.25)" : "rgba(255,255,255,.08)", color: accent ? WINE_SOFT : "rgba(255,255,255,.6)" }}>
            {items.length}
          </span>
          <ChevronDown className="w-4 h-4 text-white/35 transition-transform duration-300" style={{ transform: openG ? "rotate(180deg)" : "none" }} />
        </button>
        <div style={{ display: "grid", gridTemplateRows: openG ? "1fr" : "0fr", transition: "grid-template-rows .4s cubic-bezier(.2,.8,.2,1)" }}>
          <div style={{ overflow: "hidden" }}>
            <div className="px-1">
              {items.map(({ p, s }, i) => <SiteRow key={p.id} p={p} s={s} last={i === items.length - 1} />)}
            </div>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div
      className={`md:hidden fixed inset-0 z-[45] flex flex-col fgb-view ${visible ? "" : "fgb-view-hidden"}`}
      aria-hidden={!visible}
      style={{
        background: "linear-gradient(180deg, rgba(1,30,34,.90) 0%, rgba(2,22,26,.80) 45%, rgba(1,30,34,.92) 100%)",
        WebkitBackdropFilter: "blur(24px) saturate(130%)",
        backdropFilter: "blur(24px) saturate(130%)",
      }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-7"
        style={{ WebkitOverflowScrolling: "touch", paddingTop: "calc(var(--sat, 0px) + 28px)", paddingBottom: "calc(var(--sab, 0px) + 96px)" }}>

        {/* intestazione: una cosa alla volta, tanta aria */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] fgb-rise" style={{ color: AQUA }}>FGB Monitoring</p>
        <h1 className="text-[28px] font-semibold text-white mt-1.5 fgb-rise" style={{ animationDelay: "40ms" }}>Portfolio</h1>

        {/* verdetto: anello centrato, frase sotto, respiro sopra e sotto */}
        <div className="mt-8 mb-9 fgb-rise" style={{ animationDelay: "90ms" }}>
          <Ring pct={visible ? pct : 0} label={`${online.length}`} sub={`of ${monitored.length} online`} />
          <p className="text-center text-[15px] text-white/85 mt-6 leading-relaxed px-4">
            {groups.attention.length === 0
              ? "All systems normal across your portfolio."
              : <>{groups.attention.length} site{groups.attention.length > 1 ? "s" : ""} need{groups.attention.length > 1 ? "" : "s"} your attention.</>}
          </p>
        </div>

        {/* ricerca */}
        <div className="fgb-rise" style={{ animationDelay: "140ms" }}>
          <div className="flex items-center gap-3 px-4 rounded-2xl"
            style={{ minHeight: 52, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)" }}>
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search site or city…"
              inputMode="search" enterKeyHint="search" autoCapitalize="none"
              className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/30 outline-none" style={{ minHeight: 50 }} />
            <button onClick={onExplore} className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ minHeight: 44, color: AQUA }}>
              Map
            </button>
          </div>
        </div>

        {/* ricerca attiva: lista piatta dei risultati. Altrimenti: gruppi. */}
        {searching ? (
          <div className="mt-4 px-1">
            {results.map(({ p, s }, i) => <SiteRow key={p.id} p={p} s={s} last={i === results.length - 1} />)}
            {results.length === 0 && <p className="text-white/40 text-sm py-10 text-center">No site matches “{q}”.</p>}
          </div>
        ) : (
          <div className="fgb-rise" style={{ animationDelay: "190ms" }}>
            <Group k="attention" title="Needs attention" items={groups.attention} accent />
            <Group k="online" title="Online" items={groups.online} />
            <Group k="idle" title="Not monitored yet" items={groups.idle} />
            {isLoading && all.length === 0 && <p className="text-white/40 text-sm py-10 text-center">Loading portfolio…</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioHome;
