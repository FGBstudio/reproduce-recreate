/**
 * UX 2.0 preview — tab Insights · v3.
 * Feedback proprietario: NIENTE liste infinite — si raggruppa per severita'
 * (Critical / Warnings / Silent), gruppi chiusi tranne Critical; il
 * dettaglio si apre solo se lo chiedi. Palette FGB: vino per i problemi,
 * aqua per il brand, ambra per i warning.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, WifiOff, MoonStar, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import type { Project } from "@/lib/data";
import type { SiteRealData } from "@/hooks/useAggregatedSiteData";
import { hapticLight } from "@/lib/native";

const AQUA = "#9fd5d9";
const WINE_SOFT = "#f9cace";

type Sev = "critical" | "warning" | "silent";
interface Row { key: string; title: string; line: string; p: Project; icon: JSX.Element }

interface Props {
  visible: boolean;
  projects: Project[];
  sites: SiteRealData[];
  onOpenSite: (p: Project) => void;
}

const InsightsFeed = ({ visible, projects, sites, onOpenSite }: Props) => {
  const [openSev, setOpenSev] = useState<Set<Sev>>(new Set(["critical"]));

  const groups = useMemo(() => {
    const byId = new Map(projects.map(p => [p.siteId || "", p]));
    const g: Record<Sev, Row[]> = { critical: [], warning: [], silent: [] };
    for (const s of sites) {
      const p = byId.get(s.siteId);
      if (!p) continue;
      if (s.alerts.critical > 0) g.critical.push({
        key: `c-${s.siteId}`, p, title: s.siteName,
        line: `${s.alerts.critical} critical alert${s.alerts.critical > 1 ? "s" : ""}`,
        icon: <AlertTriangle className="w-4 h-4" />,
      });
      else if (s.state === "offline") g.critical.push({
        key: `o-${s.siteId}`, p, title: s.siteName,
        line: "Installed but not reporting",
        icon: <WifiOff className="w-4 h-4" />,
      });
      else if (s.isNoData) g.silent.push({
        key: `s-${s.siteId}`, p, title: s.siteName,
        line: "Silent for more than 2 days",
        icon: <MoonStar className="w-4 h-4" />,
      });
      else if (s.alerts.warning > 0) g.warning.push({
        key: `w-${s.siteId}`, p, title: s.siteName,
        line: `${s.alerts.warning} warning${s.alerts.warning > 1 ? "s" : ""}`,
        icon: <AlertTriangle className="w-4 h-4" />,
      });
    }
    return g;
  }, [projects, sites]);

  const total = groups.critical.length + groups.warning.length + groups.silent.length;
  const open = (p: Project) => { hapticLight(); onOpenSite(p); };
  const toggle = (s: Sev) => {
    hapticLight();
    setOpenSev(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  };

  const SEV_META: Record<Sev, { label: string; color: string; pill: string }> = {
    critical: { label: "Critical", color: WINE_SOFT, pill: "rgba(147,24,65,.25)" },
    warning: { label: "Warnings", color: "#fcd34d", pill: "rgba(245,158,11,.18)" },
    silent: { label: "Silent sites", color: "rgba(255,255,255,.6)", pill: "rgba(255,255,255,.08)" },
  };

  const Section = ({ sev }: { sev: Sev }) => {
    const rows = groups[sev];
    if (rows.length === 0) return null;
    const meta = SEV_META[sev];
    const openG = openSev.has(sev);
    return (
      <section className="mt-5">
        <button onClick={() => toggle(sev)} className="w-full flex items-center gap-3 text-left" style={{ minHeight: 48 }}>
          <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <span className="text-[12px] tabular-nums px-2.5 py-0.5 rounded-full" style={{ background: meta.pill, color: meta.color }}>
            {rows.length}
          </span>
          <ChevronDown className="w-4 h-4 text-white/35 transition-transform duration-300" style={{ transform: openG ? "rotate(180deg)" : "none" }} />
        </button>
        <div style={{ display: "grid", gridTemplateRows: openG ? "1fr" : "0fr", transition: "grid-template-rows .4s cubic-bezier(.2,.8,.2,1)" }}>
          <div style={{ overflow: "hidden" }}>
            <div className="px-1">
              {rows.map((r, i) => (
                <button key={r.key} onClick={() => open(r.p)}
                  className="w-full flex items-center gap-4 text-left active:opacity-70 transition-opacity"
                  style={{ minHeight: 62, borderBottom: i === rows.length - 1 ? "none" : "1px solid rgba(255,255,255,.07)" }}>
                  <span className="shrink-0" style={{ color: meta.color }}>{r.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-medium text-white truncate">{r.title}</span>
                    <span className="block text-[11.5px] text-white/45 mt-0.5">{r.line}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-white/25 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className={`md:hidden fixed inset-0 z-[45] flex flex-col fgb-view ${visible ? "" : "fgb-view-hidden"}`} aria-hidden={!visible}
      style={{
        background: "linear-gradient(180deg, rgba(1,30,34,.90) 0%, rgba(2,22,26,.80) 45%, rgba(1,30,34,.92) 100%)",
        WebkitBackdropFilter: "blur(24px) saturate(130%)", backdropFilter: "blur(24px) saturate(130%)",
      }}>
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-7"
        style={{ WebkitOverflowScrolling: "touch", paddingTop: "calc(var(--sat, 0px) + 28px)", paddingBottom: "calc(var(--sab, 0px) + 96px)" }}>

        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] fgb-rise" style={{ color: AQUA }}>FGB Monitoring</p>
        <h1 className="text-[28px] font-semibold text-white mt-1.5 fgb-rise" style={{ animationDelay: "40ms" }}>Insights</h1>

        {/* sintesi, non lista: il numero e poi scegli tu se entrare */}
        <p className="text-[15px] text-white/80 mt-7 leading-relaxed fgb-rise" style={{ animationDelay: "90ms" }}>
          {total === 0 ? "All clear — no active alerts, no silent sites." : `${total} item${total > 1 ? "s" : ""} worth your attention.`}
        </p>

        <div className="fgb-rise" style={{ animationDelay: "140ms" }}>
          <Section sev="critical" />
          <Section sev="warning" />
          <Section sev="silent" />
        </div>

        {/* teaser del feed modello: dichiarato, mai spacciato per attivo */}
        <div className="mt-10 rounded-2xl px-5 py-5 flex items-start gap-3.5 fgb-rise"
          style={{ animationDelay: "190ms", background: "rgba(0,145,147,.08)", border: `1px dashed rgba(159,213,217,.3)` }}>
          <Sparkles className="w-4 h-4 shrink-0 mt-0.5" style={{ color: AQUA }} />
          <div>
            <p className="text-[13px] font-semibold text-white">Forecast &amp; anomaly feed</p>
            <p className="text-[12px] text-white/50 mt-1 leading-relaxed">
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
