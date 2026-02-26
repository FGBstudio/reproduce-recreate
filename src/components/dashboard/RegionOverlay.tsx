import { useMemo, useState } from "react";
import { regions, projects as allProjects } from "@/lib/data";
import { useAggregatedSiteData } from "@/hooks/useAggregatedSiteData";
import { useAllProjects } from "@/hooks/useRealTimeData";
import { useRegionEnergyIntensity } from "@/hooks/useRegionEnergyIntensity";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronDown, ChevronUp, Circle, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RegionOverlayProps {
  currentRegion: string;
  visible?: boolean;
}

const RegionOverlay = ({ currentRegion, visible = true }: RegionOverlayProps) => {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const { language } = useLanguage();
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

  // === Per-site intensity data (kWh/m²) ===
  const siteIntensityList = useMemo(() => {
    return aggregated.sites
      .map(site => {
        const project = regionProjects.find(p => p.siteId === site.siteId);
        const area = project?.area_m2 ?? 0;
        const kwh = site.energy.monthlyKwh ?? 0;
        const intensity = area > 0 ? Math.round((kwh / area) * 10) / 10 : null;
        return { name: site.siteName, intensity, kwh, area };
      })
      .filter(s => s.intensity !== null && s.intensity > 0)
      .sort((a, b) => (b.intensity ?? 0) - (a.intensity ?? 0));
  }, [aggregated.sites, regionProjects]);

  // === Per-site AQ data ===
  const getAqLabel = (co2: number | null): string => {
    if (!co2 || co2 === 0) return "N/A";
    if (co2 < 400) return "EXCELLENT";
    if (co2 < 600) return "GOOD";
    if (co2 < 1000) return "MODERATE";
    return "POOR";
  };
  const aqRank: Record<string, number> = { EXCELLENT: 0, GOOD: 1, MODERATE: 2, POOR: 3, "N/A": 4 };

  const siteAqList = useMemo(() => {
    return aggregated.sitesWithAir
      .map(site => ({
        name: site.siteName,
        co2: site.air.co2,
        label: getAqLabel(site.air.co2),
      }))
      .sort((a, b) => (aqRank[a.label] ?? 4) - (aqRank[b.label] ?? 4));
  }, [aggregated.sitesWithAir]);

  // === Per-site online/offline status ===
  const siteStatusList = useMemo(() => {
    const withData = new Set(aggregated.sites.map(s => s.siteId));
    const list = regionProjects.map(p => {
      const siteData = aggregated.sites.find(s => s.siteId === p.siteId);
      let status: 'online' | 'offline' | 'not_installed' = 'not_installed';
      if (siteData) {
        status = siteData.isOnline ? 'online' : 'offline';
      }
      return { name: p.name, status };
    });
    // Sort: online first, then offline, then not installed
    const order = { online: 0, offline: 1, not_installed: 2 };
    return list.sort((a, b) => order[a.status] - order[b.status]);
  }, [aggregated.sites, regionProjects]);

  // === Per-site alerts ===
  const siteAlertsList = useMemo(() => {
    return aggregated.sites
      .filter(s => s.alerts.critical > 0 || s.alerts.warning > 0)
      .map(s => ({
        name: s.siteName,
        critical: s.alerts.critical,
        warning: s.alerts.warning,
        total: s.alerts.critical + s.alerts.warning,
      }))
      .sort((a, b) => b.total - a.total);
  }, [aggregated.sites]);

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

  const aqLabelColor = (label: string) => ({
    EXCELLENT: "text-emerald-400",
    GOOD: "text-emerald-400",
    MODERATE: "text-yellow-400",
    POOR: "text-rose-400",
    "N/A": "text-muted-foreground",
  }[label] || "text-muted-foreground");

  const statusColor = (s: string) => ({
    online: "text-emerald-400",
    offline: "text-amber-400",
    not_installed: "text-rose-400",
  }[s] || "text-muted-foreground");

  const statusLabel = (s: string) => {
    if (language === 'it') {
      return { online: 'Online', offline: 'Offline', not_installed: 'Da installare' }[s] ?? s;
    }
    return { online: 'Online', offline: 'Offline', not_installed: 'Ready to install' }[s] ?? s;
  };

  return (
    <div 
      className={`fixed top-24 left-4 md:left-8 z-30 w-80 md:w-[340px] pointer-events-none transition-all duration-500 hidden md:block ${
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
          <TooltipProvider delayDuration={300}>
            {/* Avg. Energy Density */}
            <Popover>
              <PopoverTrigger asChild>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">Avg. Energy Density</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs">
                          {language === 'it'
                            ? "Media dei consumi energetici (kWh) divisi per la superficie (m²) di ogni sito, calcolata sugli ultimi 30 giorni con i contatori 'general'."
                            : "Average energy consumption (kWh) divided by each site's floor area (m²), calculated over the last 30 days using 'general' meters."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-xl font-bold text-foreground whitespace-nowrap ml-3">
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
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-80 p-0 border-border/50 shadow-xl">
                <div className="p-4 border-b border-border/30 bg-accent/5">
                  <h4 className="text-sm font-semibold text-foreground">
                    {language === 'it' ? 'Intensità Energetica per Sito' : 'Energy Intensity by Site'}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {language === 'it' ? 'kWh/m² · Ultimi 30 giorni · Contatori general · Dal più alto al più basso' : 'kWh/m² · Last 30 days · General meters · Highest to lowest'}
                  </p>
                </div>
                <ScrollArea className="h-[240px]">
                  {siteIntensityList.length > 0 ? (
                    <div className="p-2 space-y-1">
                      {siteIntensityList.map((s, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2.5 text-xs rounded-lg hover:bg-accent/10 transition-colors">
                          <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                            <span className="text-muted-foreground/60 font-mono text-[10px] w-4 shrink-0">{i + 1}</span>
                            <span className="text-foreground leading-snug break-words">{s.name}</span>
                          </div>
                          <span className="font-semibold text-foreground whitespace-nowrap shrink-0">{s.intensity} <span className="text-muted-foreground font-normal">kWh/m²</span></span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-xs text-muted-foreground text-center">
                      {language === 'it' ? 'Nessun dato disponibile' : 'No data available'}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Air Quality Score */}
            <Popover>
              <PopoverTrigger asChild>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors group">
                  <div className="flex justify-between items-end mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">Air Quality Score</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs">
                          {language === 'it'
                            ? "Giudizio basato sulla media CO₂ (ppm) a 30 giorni: Excellent <400, Good <600, Moderate <1000, Poor ≥1000."
                            : "Rating based on 30-day avg CO₂ (ppm): Excellent <400, Good <600, Moderate <1000, Poor ≥1000."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className={`text-xl font-bold ${aqColorClass}`}>{displayAq}</span>
                  </div>
                  {/*displayCo2 > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Avg CO₂: {displayCo2} ppm{hasRealCo2 ? ` · ${co2SiteCountByRegion[currentRegion] ?? 0} sites` : ''}
                    </div>
                  )*/}
                  <div className="flex gap-1 mt-2">
                    <span className={`h-2 flex-1 rounded-sm ${displayAq === "EXCELLENT" || displayAq === "GOOD" ? "bg-emerald-500" : "bg-emerald-500/30"}`} />
                    <span className={`h-2 flex-1 rounded-sm ${displayAq === "EXCELLENT" ? "bg-emerald-500" : "bg-emerald-500/30"}`} />
                    <span className="h-2 flex-1 rounded-sm bg-emerald-500/30" />
                  </div>
                </div>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-80 p-0 border-border/50 shadow-xl">
                <div className="p-4 border-b border-border/30 bg-accent/5">
                  <h4 className="text-sm font-semibold text-foreground">
                    {language === 'it' ? 'Qualità dell\'Aria per Sito' : 'Air Quality by Site'}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {language === 'it' ? 'CO₂ media 30 giorni · Dal migliore al peggiore' : 'Avg CO₂ 30 days · Best to worst'}
                  </p>
                </div>
                <ScrollArea className="h-[240px]">
                  {siteAqList.length > 0 ? (
                    <div className="p-2 space-y-1">
                      {siteAqList.map((s, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2.5 text-xs rounded-lg hover:bg-accent/10 transition-colors">
                          <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                            <Circle className={`w-2 h-2 shrink-0 fill-current ${aqLabelColor(s.label)}`} />
                            <span className="text-foreground leading-snug break-words">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-muted-foreground">{s.co2 ?? '—'} ppm</span>
                            <span className={`font-semibold min-w-[70px] text-right ${aqLabelColor(s.label)}`}>{s.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-xs text-muted-foreground text-center">
                      {language === 'it' ? 'Nessun dato disponibile' : 'No data available'}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Active Sites & Critical Alerts */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              {/* Active Sites */}
              <Popover>
                <PopoverTrigger asChild>
                  <div className="text-center p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <div className="text-2xl font-bold text-foreground">{displayOnline}</div>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[10px] uppercase text-muted-foreground">Active Sites</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                          {language === 'it'
                            ? "Siti con almeno un dato telemetrico ricevuto nell'ultima ora."
                            : "Sites with at least one telemetry reading in the last hour."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-80 p-0 border-border/50 shadow-xl">
                  <div className="p-4 border-b border-border/30 bg-accent/5">
                    <h4 className="text-sm font-semibold text-foreground">
                      {language === 'it' ? 'Stato Siti' : 'Sites Status'}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {language === 'it' ? 'Verde = online · Arancio = offline · Rosso = da installare' : 'Green = online · Orange = offline · Red = ready to install'}
                    </p>
                  </div>
                  <ScrollArea className="h-[240px]">
                    {siteStatusList.length > 0 ? (
                      <div className="p-2 space-y-1">
                        {siteStatusList.map((s, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2.5 text-xs rounded-lg hover:bg-accent/10 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                              <Circle className={`w-2.5 h-2.5 shrink-0 fill-current ${statusColor(s.status)}`} />
                              <span className="text-foreground leading-snug break-words">{s.name}</span>
                            </div>
                            <span className={`text-[11px] font-medium shrink-0 ${statusColor(s.status)}`}>
                              {statusLabel(s.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-xs text-muted-foreground text-center">
                        {language === 'it' ? 'Nessun sito' : 'No sites'}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              {/* Critical Alerts */}
              <Popover>
                <PopoverTrigger asChild>
                  <div className="text-center p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <div className={`text-2xl font-bold ${displayCritical > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      {displayCritical}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-[10px] uppercase text-muted-foreground">Critical Alerts</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                          {language === 'it'
                            ? "Somma degli eventi con severità 'critical' e 'warning' attivi per i siti della regione."
                            : "Sum of active 'critical' and 'warning' severity events across sites in this region."}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-80 p-0 border-border/50 shadow-xl">
                  <div className="p-4 border-b border-border/30 bg-accent/5">
                    <h4 className="text-sm font-semibold text-foreground">
                      {language === 'it' ? 'Allarmi per Sito' : 'Alerts by Site'}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {language === 'it' ? 'Siti con allarmi attivi · Ordinati per gravità' : 'Sites with active alerts · Sorted by severity'}
                    </p>
                  </div>
                  <ScrollArea className="h-[240px]">
                    {siteAlertsList.length > 0 ? (
                      <div className="p-2 space-y-1">
                        {siteAlertsList.map((s, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2.5 text-xs rounded-lg hover:bg-accent/10 transition-colors">
                            <span className="text-foreground leading-snug break-words min-w-0 flex-1 mr-3">{s.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {s.critical > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-400/15 text-rose-400 font-semibold text-[10px]">{s.critical} critical</span>
                              )}
                              {s.warning > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 font-semibold text-[10px]">{s.warning} warning</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-xs text-emerald-400 text-center flex flex-col items-center gap-1">
                        <span>✓</span>
                        <span>{language === 'it' ? 'Nessun allarme attivo' : 'No active alerts'}</span>
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </TooltipProvider>

            <div className="mt-6 pt-4 border-t border-white/10 text-center">
              <p className="text-xs text-muted-foreground italic">
                {(hasRealIntensity || hasRealCo2)
                  ? `${Math.max(realSiteCount, co2SiteCountByRegion[currentRegion] ?? 0)} sites with live data · 30-day avg` 
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
