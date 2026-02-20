import { useMemo, useState } from "react";
import { regions, projects as allProjects } from "@/lib/data";
import { useAggregatedSiteData } from "@/hooks/useAggregatedSiteData";
import { useAllProjects } from "@/hooks/useRealTimeData";
import { useRegionEnergyIntensity } from "@/hooks/useRegionEnergyIntensity";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronDown, ChevronUp } from "lucide-react";

interface RegionOverlayProps {
  currentRegion: string;
  visible?: boolean;
}

const RegionOverlay = ({ currentRegion, visible = true }: RegionOverlayProps) => {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const region = regions[currentRegion];
  
  // Get all projects (real + mock merged)
  const { projects: mergedProjects } = useAllProjects();

  // Filter projects belonging to this region
  const regionProjects = useMemo(() => {
    const source = mergedProjects.length > 0 ? mergedProjects : allProjects;
    return source.filter(p => p.region === currentRegion);
  }, [mergedProjects, currentRegion]);

  // Get real aggregated data for region's sites
  const aggregated = useAggregatedSiteData(regionProjects);

  // Get REAL energy intensity from dedicated hook (category=general, 30 days, kWh/m²)
  const { intensityByRegion, siteCountByRegion, avgCo2ByRegion, co2SiteCountByRegion } = useRegionEnergyIntensity();

  // Use REAL CO2 from dedicated hook
  const realAvgCo2 = avgCo2ByRegion[currentRegion];
  const hasRealCo2 = realAvgCo2 !== undefined;
  const displayCo2 = realAvgCo2 ?? aggregated.totals.avgCo2 ?? 0;

  // Air quality score based on avg CO2
  const aqScore = useMemo(() => {
    if (!displayCo2 || displayCo2 === 0) return null;
    if (displayCo2 < 400) return "EXCELLENT";
    if (displayCo2 < 600) return "GOOD";
    if (displayCo2 < 1000) return "MODERATE";
    return "POOR";
  }, [displayCo2]);

  if (currentRegion === "GLOBAL" || !region) return null;

  // Use REAL intensity from dedicated hook, fallback to static only if no real data
  const realIntensity = intensityByRegion[currentRegion];
  const realSiteCount = siteCountByRegion[currentRegion] ?? 0;
  const sitesCount = regionProjects.length;
  const displayIntensity = realIntensity ?? region.kpi?.intensity ?? 0;
  const hasRealIntensity = realIntensity !== undefined;
  const displayAq = aqScore ?? region.kpi?.aq ?? "GOOD";
  const displayOnline = aggregated.hasRealData ? aggregated.totals.sitesWithData : (region.kpi?.online ?? 0);
  const displayCritical = aggregated.hasRealData ? aggregated.totals.alertsCritical : (region.kpi?.critical ?? 0);

  const aqColorClass = {
    EXCELLENT: "text-emerald-400",
    GOOD: "text-emerald-400",
    MODERATE: "text-yellow-400",
    POOR: "text-rose-400",
  }[displayAq] || "text-muted-foreground";

  return (
    <div 
      className={`fixed top-24 left-4 md:left-8 z-30 w-72 md:w-80 pointer-events-none transition-all duration-500 hidden md:block ${
        visible 
          ? "opacity-100 translate-x-0" 
          : "opacity-0 -translate-x-10"
      }`}
    >
      <div className="glass-panel p-6 rounded-2xl pointer-events-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-serif text-foreground mb-1">{region.name}</h2>
            <div className="text-xs text-fgb-accent uppercase tracking-widest">
              Regional Performance
            </div>
          </div>
          {isMobile && (
            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              aria-label={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronDown className="w-5 h-5 text-foreground" /> : <ChevronUp className="w-5 h-5 text-foreground" />}
            </button>
          )}
        </div>

        {/* Collapsible content */}
        {(!isMobile || !collapsed) && (
          <div className="mt-6 space-y-4">
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="flex justify-between items-end mb-1">
                <span className="text-sm text-muted-foreground">Avg. Energy Intensity</span>
                <span className="text-xl font-bold text-foreground">
                  {displayIntensity} <span className="text-xs font-normal opacity-70">kWh/m²</span>
                </span>
              </div>
              <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-emerald-400 h-full transition-all duration-700"
                  style={{ width: `${Math.min(displayIntensity, 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="flex justify-between items-end mb-1">
                <span className="text-sm text-muted-foreground">Air Quality Score</span>
                <span className={`text-xl font-bold ${aqColorClass}`}>{displayAq}</span>
              </div>
              {displayCo2 > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Avg CO₂: {displayCo2} ppm{hasRealCo2 ? ` · ${co2SiteCountByRegion[currentRegion] ?? 0} sites` : ''}
                </div>
              )}
              <div className="flex gap-1 mt-2">
                <span className={`h-2 flex-1 rounded-sm ${displayAq === "EXCELLENT" || displayAq === "GOOD" ? "bg-emerald-500" : "bg-emerald-500/30"}`} />
                <span className={`h-2 flex-1 rounded-sm ${displayAq === "EXCELLENT" ? "bg-emerald-500" : "bg-emerald-500/30"}`} />
                <span className="h-2 flex-1 rounded-sm bg-emerald-500/30" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="text-center p-3 rounded-lg bg-white/5">
                <div className="text-2xl font-bold text-foreground">{displayOnline}</div>
                <div className="text-[10px] uppercase text-muted-foreground">Active Sites</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-white/5">
                <div className={`text-2xl font-bold ${displayCritical > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {displayCritical}
                </div>
                <div className="text-[10px] uppercase text-muted-foreground">Critical Alerts</div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 text-center">
              <p className="text-xs text-muted-foreground italic">
                {(hasRealIntensity || hasRealCo2)
                  ? `${Math.max(realSiteCount, co2SiteCountByRegion[currentRegion] ?? 0)} sites with real data · 30-day avg · Live` 
                  : aggregated.hasRealData 
                    ? `${sitesCount} sites in region · Live data` 
                    : "Select a pin on the map to view project details."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegionOverlay;
