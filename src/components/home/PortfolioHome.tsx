/**
 * UX 2.0 preview — Home «Portfolio» (mobile).
 * v2 dopo il feedback del proprietario: niente pannello piatto — la Home e'
 * un LAYER DI VETRO sopra la mappa (che resta visibile sotto, come
 * nell'invasione del BrandOverlay), vocabolario visivo della dashboard
 * (glass-panel + accento oro --fgb-accent), ingressi scaglionati, anello
 * animato. Sempre montata: lo scambio con Mappa/Insights e' una dissolvenza
 * (.fgb-view), mai un rimontaggio.
 */
import { useEffect, useMemo, useState } from "react";
import { Search, AlertTriangle, ChevronRight, WifiOff } from "lucide-react";
import type { Project } from "@/lib/data";
import type { SiteRealData } from "@/hooks/useAggregatedSiteData";
import { hapticLight } from "@/lib/native";

const STATE_DOT: Record<string, { c: string; glow: string }> = {
  online: { c: "#10b981", glow: "0 0 10px rgba(16,185,129,.6)" },
  offline: { c: "#931841", glow: "0 0 10px rgba(147,24,65,.6)" },
  stale: { c: "#f59e0b", glow: "0 0 10px rgba(245,158,11,.55)" },
  not_installed: { c: "rgba(255,255,255,.25)", glow: "none" },
};

function Ring({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const R = 54, C = 2 * Math.PI * R;
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setDrawn(pct); return; }
    const id = requestAnimationFrame(() => setDrawn(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  return (
    <div className="relative grid place-items-center shrink-0" style={{ width: 142, height: 142 }}>
      <svg width="142" height="142" viewBox="0 0 150 150" className="-rotate-90">
        <circle cx="75" cy="75" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
        <circle cx="75" cy="75" r={R} fill="none" stroke="hsl(var(--fgb-accent))" strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${C * Math.max(0.02, drawn)} ${C}`}
          style={{ transition: "stroke-dasharray 1.1s cubic-bezier(.2,.8,.2,1)", filter: "drop-shadow(0 0 10px hsl(var(--fgb-accent) / .45))" }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-4xl font-bold text-white tabular-nums leading-none">{label}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/60 mt-1.5">{sub}</div>
      </div>
    </div>
  );
}

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

  const open = (p: Project) => { hapticLight(); onOpenSite(p); };

  return (
    <div
      className={`md:hidden fixed inset-0 z-[45] flex flex-col fgb-view ${visible ? "" : "fgb-view-hidden"}`}
      aria-hidden={!visible}
      style={{
        /* vetro sulla mappa: la scena sotto resta percepibile */
        background: "linear-gradient(180deg, rgba(5,13,16,.82) 0%, rgba(5,13,16,.68) 40%, rgba(5,13,16,.80) 100%)",
        WebkitBackdropFilter: "blur(22px) saturate(140%)",
        backdropFilter: "blur(22px) saturate(140%)",
      }}
    >
      {/* intestazione + verdetto */}
      <div className="shrink-0 px-5" style={{ paddingTop: "calc(var(--sat, 0px) + 16px)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-fgb-accent fgb-rise">FGB Monitoring</p>
        <h1 className="text-2xl font-semibold text-white mt-1 fgb-rise" style={{ animationDelay: "40ms" }}>Portfolio</h1>
        <div className="flex items-center gap-4 mt-2 fgb-rise" style={{ animationDelay: "80ms" }}>
          <Ring pct={visible ? pct : 0} label={`${online.length}`} sub={`of ${monitored.length} online`} />
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

      {/* alert azionabili */}
      {attention.length > 0 && (
        <div className="shrink-0 px-5 mt-2.5 space-y-1.5">
          {attention.slice(0, 3).map((s, i) => {
            const p = projects.find(x => (x.siteId || "") === s.siteId);
            if (!p) return null;
            const offline = s.state === "offline";
            return (
              <button key={s.siteId} onClick={() => open(p)}
                className="glass-panel w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left fgb-rise active:scale-[0.98] transition-transform"
                style={{ minHeight: 48, animationDelay: `${120 + i * 50}ms`, borderColor: "rgba(147,24,65,.45)", boxShadow: "0 8px 28px rgba(147,24,65,.22)" }}>
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

      {/* ricerca — la lente apre una lista, non solo pin */}
      <div className="shrink-0 px-5 mt-3 fgb-rise" style={{ animationDelay: "160ms" }}>
        <div className="glass-panel flex items-center gap-2.5 px-4 rounded-2xl" style={{ minHeight: 48 }}>
          <Search className="w-4 h-4 text-white/45 shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search site or city…"
            inputMode="search" enterKeyHint="search" autoCapitalize="none"
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/35 outline-none" style={{ minHeight: 46 }} />
          <button onClick={onExplore} className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-fgb-accent"
            style={{ minHeight: 44 }}>
            Map
          </button>
        </div>
      </div>

      {/* tile = la lista, per urgenza */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 mt-3"
        style={{ WebkitOverflowScrolling: "touch", paddingBottom: "calc(var(--sab, 0px) + 86px)" }}>
        {isLoading && rows.length === 0 && <p className="text-white/40 text-sm py-8 text-center">Loading portfolio…</p>}
        <div className="grid grid-cols-2 gap-2.5">
          {rows.map(({ p, s }, i) => (
            <button key={p.id} onClick={() => open(p)}
              className="glass-panel text-left rounded-2xl px-3.5 py-3.5 active:scale-[0.97] transition-transform fgb-rise"
              style={{ minHeight: 96, animationDelay: `${Math.min(200 + i * 35, 560)}ms` }}>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATE_DOT[s?.state || "not_installed"].c, boxShadow: STATE_DOT[s?.state || "not_installed"].glow }} />
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
