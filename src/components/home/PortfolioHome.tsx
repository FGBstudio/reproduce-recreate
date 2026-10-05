/**
 * UX 2.0 preview — Home «Portfolio» (mobile).
 * Status-first: verdetto del parco, alert azionabili, siti come tile
 * cercabili (QUESTA è la "lista" del brand manager: risponde alla lente).
 * Obbligatoria per tutti i ruoli: nessun salto diretto al sito.
 * Vive come layer sopra la mappa dentro Index: zero nuove rotte, rollback
 * = togliere tre blocchi da Index.
 */
import { useMemo, useState } from "react";
import { Search, AlertTriangle, ChevronRight, WifiOff } from "lucide-react";
import type { Project } from "@/lib/data";
import type { SiteRealData } from "@/hooks/useAggregatedSiteData";

const STATE_DOT: Record<string, string> = {
  online: "#10b981",
  offline: "#931841",
  stale: "#f59e0b",
  not_installed: "rgba(255,255,255,.25)",
};

function Ring({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const R = 54, C = 2 * Math.PI * R;
  return (
    <div className="relative grid place-items-center" style={{ width: 150, height: 150 }}>
      <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
        <circle cx="75" cy="75" r={R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="9" />
        <circle cx="75" cy="75" r={R} fill="none" stroke="#9fd5d9" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${C * Math.max(0.02, pct)} ${C}`} />
      </svg>
      <div className="absolute text-center">
        <div className="text-4xl font-bold text-white tabular-nums leading-none">{label}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/60 mt-1.5">{sub}</div>
      </div>
    </div>
  );
}

interface Props {
  projects: Project[];
  sites: SiteRealData[];
  isLoading: boolean;
  onOpenSite: (p: Project) => void;
  onExplore: () => void;
}

const PortfolioHome = ({ projects, sites, isLoading, onOpenSite, onExplore }: Props) => {
  const [q, setQ] = useState("");

  const bySiteId = useMemo(() => new Map(sites.map(s => [s.siteId, s])), [sites]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects
      .map(p => ({ p, s: bySiteId.get(p.siteId || "") }))
      .filter(({ p }) => !needle
        || (p.displayName || p.name).toLowerCase().includes(needle)
        || (p.city || "").toLowerCase().includes(needle))
      .sort((a, b) => {
        const score = (x?: SiteRealData) =>
          !x ? 4 : x.alerts.critical > 0 ? 0 : x.state === "offline" ? 1 : x.state === "stale" ? 2 : x.state === "online" ? 3 : 4;
        return score(a.s) - score(b.s) || (a.p.name).localeCompare(b.p.name);
      });
  }, [projects, bySiteId, q]);

  const monitored = sites.filter(s => s.state !== "not_installed");
  const online = monitored.filter(s => s.state === "online");
  const attention = sites.filter(s => s.alerts.critical > 0 || s.state === "offline");
  const pct = monitored.length ? online.length / monitored.length : 0;

  const fmtValue = (s?: SiteRealData) => {
    if (!s) return "—";
    if (s.energy.monthlyKwh && s.energy.monthlyKwh > 0) return `${(s.energy.monthlyKwh / 1000).toFixed(1)} MWh · 30d`;
    if (s.air.co2) return `${Math.round(s.air.co2)} ppm CO₂`;
    return s.state === "not_installed" ? "Not monitored" : "—";
  };

  return (
    <div className="md:hidden fixed inset-0 z-[45] flex flex-col" style={{ background: "#0a1a1e" }}>
      {/* intestazione + verdetto */}
      <div className="shrink-0 px-5" style={{ paddingTop: "calc(var(--sat, 0px) + 18px)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: "#9fd5d9" }}>FGB Monitoring</p>
        <div className="flex items-center justify-between mt-1">
          <h1 className="text-2xl font-semibold text-white">Portfolio</h1>
          <button onClick={onExplore} className="text-[11px] font-semibold uppercase tracking-wider px-3 rounded-full border border-white/20 text-white/80"
            style={{ minHeight: 44 }}>
            Map view
          </button>
        </div>
        <div className="flex items-center gap-5 mt-3">
          <Ring pct={pct} label={`${online.length}`} sub={`of ${monitored.length} online`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/85 leading-snug">
              {attention.length === 0
                ? "All systems normal across your portfolio."
                : `${attention.length} site${attention.length > 1 ? "s" : ""} need${attention.length > 1 ? "" : "s"} attention.`}
            </p>
            <p className="text-[11px] text-white/45 mt-1.5">{projects.length} sites in your perimeter</p>
          </div>
        </div>
      </div>

      {/* alert azionabili: tap = dentro il sito */}
      {attention.length > 0 && (
        <div className="shrink-0 px-5 mt-3 space-y-1.5">
          {attention.slice(0, 3).map(s => {
            const p = projects.find(x => (x.siteId || "") === s.siteId);
            if (!p) return null;
            const offline = s.state === "offline";
            return (
              <button key={s.siteId} onClick={() => onOpenSite(p)}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left"
                style={{ background: "rgba(147,24,65,.16)", border: "1px solid rgba(147,24,65,.35)", minHeight: 48 }}>
                {offline ? <WifiOff className="w-4 h-4 shrink-0" style={{ color: "#f9cace" }} />
                  : <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#f9cace" }} />}
                <span className="flex-1 min-w-0 text-[13px] font-medium text-white truncate">{s.siteName}</span>
                <span className="text-[11px] shrink-0" style={{ color: "#f9cace" }}>
                  {offline ? "Offline" : `${s.alerts.critical} critical`}
                </span>
                <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {/* ricerca — la "lente" ora apre la lista, non solo la mappa */}
      <div className="shrink-0 px-5 mt-4">
        <div className="flex items-center gap-2.5 px-4 rounded-2xl" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", minHeight: 48 }}>
          <Search className="w-4 h-4 text-white/45 shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search site or city…"
            inputMode="search" enterKeyHint="search" autoCapitalize="none"
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/35 outline-none" style={{ minHeight: 46 }} />
        </div>
      </div>

      {/* tile dei siti = la lista, ordinata per urgenza */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 mt-3"
        style={{ WebkitOverflowScrolling: "touch", paddingBottom: "calc(var(--sab, 0px) + 86px)" }}>
        {isLoading && rows.length === 0 && <p className="text-white/40 text-sm py-8 text-center">Loading portfolio…</p>}
        <div className="grid grid-cols-2 gap-2.5">
          {rows.map(({ p, s }) => (
            <button key={p.id} onClick={() => onOpenSite(p)}
              className="text-left rounded-2xl px-3.5 py-3.5 active:scale-[0.98] transition-transform"
              style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)", minHeight: 96 }}>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATE_DOT[s?.state || "not_installed"] }} />
                <span className="text-[10px] uppercase tracking-wider text-white/45 truncate">{p.city || p.region}</span>
              </span>
              <span className="block text-[13px] font-semibold text-white leading-tight mt-1.5 line-clamp-2">
                {p.displayName || p.name}
              </span>
              <span className="block text-[11px] text-white/55 mt-1.5 tabular-nums">{fmtValue(s)}</span>
            </button>
          ))}
        </div>
        {rows.length === 0 && !isLoading && (
          <p className="text-white/40 text-sm py-8 text-center">No site matches “{q}”.</p>
        )}
      </div>
    </div>
  );
};

export default PortfolioHome;
