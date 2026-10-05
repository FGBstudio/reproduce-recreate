/**
 * UX 2.0 preview — tab Insights (v1).
 * Feed di cio' che merita attenzione, derivato dai dati gia' caricati:
 * alert critici/warning, siti offline, siti muti (stale). Ogni card e'
 * tappabile e porta DENTRO il sito. La v2 aggiungera' il feed del modello
 * XGBoost (energy_insights: leak, baseload, opportunita') quando le metriche
 * di backtest saranno validate col proprietario.
 */
import { useMemo } from "react";
import { AlertTriangle, WifiOff, MoonStar, ChevronRight, Sparkles } from "lucide-react";
import type { Project } from "@/lib/data";
import type { SiteRealData } from "@/hooks/useAggregatedSiteData";

interface Props {
  projects: Project[];
  sites: SiteRealData[];
  onOpenSite: (p: Project) => void;
}

const InsightsFeed = ({ projects, sites, onOpenSite }: Props) => {
  const cards = useMemo(() => {
    const byId = new Map(projects.map(p => [p.siteId || "", p]));
    const out: { key: string; icon: JSX.Element; title: string; line: string; tone: "crit" | "warn" | "info"; p?: Project }[] = [];
    for (const s of sites) {
      const p = byId.get(s.siteId);
      if (!p) continue;
      if (s.alerts.critical > 0) out.push({
        key: `c-${s.siteId}`, tone: "crit", p,
        icon: <AlertTriangle className="w-4 h-4" />, title: s.siteName,
        line: `${s.alerts.critical} critical alert${s.alerts.critical > 1 ? "s" : ""} active`,
      });
      else if (s.state === "offline") out.push({
        key: `o-${s.siteId}`, tone: "crit", p,
        icon: <WifiOff className="w-4 h-4" />, title: s.siteName,
        line: "Devices installed but not reporting",
      });
      else if (s.isNoData) out.push({
        key: `s-${s.siteId}`, tone: "warn", p,
        icon: <MoonStar className="w-4 h-4" />, title: s.siteName,
        line: "Silent for more than 2 days",
      });
      else if (s.alerts.warning > 0) out.push({
        key: `w-${s.siteId}`, tone: "warn", p,
        icon: <AlertTriangle className="w-4 h-4" />, title: s.siteName,
        line: `${s.alerts.warning} warning${s.alerts.warning > 1 ? "s" : ""} active`,
      });
    }
    const rank = { crit: 0, warn: 1, info: 2 } as const;
    return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
  }, [projects, sites]);

  const TONE: Record<string, { bg: string; bd: string; fg: string }> = {
    crit: { bg: "rgba(147,24,65,.16)", bd: "rgba(147,24,65,.35)", fg: "#f9cace" },
    warn: { bg: "rgba(245,158,11,.12)", bd: "rgba(245,158,11,.30)", fg: "#fcd34d" },
    info: { bg: "rgba(255,255,255,.06)", bd: "rgba(255,255,255,.12)", fg: "#9fd5d9" },
  };

  return (
    <div className="md:hidden fixed inset-0 z-[45] flex flex-col" style={{ background: "#0a1a1e" }}>
      <div className="shrink-0 px-5" style={{ paddingTop: "calc(var(--sat, 0px) + 18px)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: "#9fd5d9" }}>FGB Monitoring</p>
        <h1 className="text-2xl font-semibold text-white mt-1">Insights</h1>
        <p className="text-[12px] text-white/50 mt-1">What needs your attention, newest first.</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 mt-4 space-y-2"
        style={{ WebkitOverflowScrolling: "touch", paddingBottom: "calc(var(--sab, 0px) + 86px)" }}>
        {cards.length === 0 && (
          <div className="rounded-2xl px-4 py-6 text-center" style={{ background: "rgba(16,185,129,.10)", border: "1px solid rgba(16,185,129,.25)" }}>
            <p className="text-sm font-medium text-emerald-300">All clear</p>
            <p className="text-[12px] text-white/50 mt-1">No active alerts, no silent sites.</p>
          </div>
        )}
        {cards.map(c => (
          <button key={c.key} onClick={() => c.p && onOpenSite(c.p)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left active:scale-[0.98] transition-transform"
            style={{ background: TONE[c.tone].bg, border: `1px solid ${TONE[c.tone].bd}`, minHeight: 56 }}>
            <span className="shrink-0" style={{ color: TONE[c.tone].fg }}>{c.icon}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold text-white truncate">{c.title}</span>
              <span className="block text-[11.5px] text-white/60 mt-0.5">{c.line}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-white/35 shrink-0" />
          </button>
        ))}

        {/* teaser del feed modello: dichiarato, mai spacciato per attivo */}
        <div className="rounded-2xl px-4 py-4 flex items-start gap-3" style={{ background: "rgba(159,213,217,.07)", border: "1px dashed rgba(159,213,217,.3)" }}>
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#9fd5d9" }} />
          <div>
            <p className="text-[13px] font-semibold text-white">Forecast &amp; anomaly feed</p>
            <p className="text-[11.5px] text-white/55 mt-0.5 leading-snug">
              Coming next: expected-vs-actual consumption, night baseload leaks and
              saving opportunities from the FGB forecasting model.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightsFeed;
