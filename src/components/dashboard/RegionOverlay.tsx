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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

interface RegionOverlayProps {
  currentRegion: string;
  visible?: boolean;
  activeFilters?: string[];
}

const RegionOverlay = ({ currentRegion, visible = true, activeFilters = ['energy', 'air', 'water'] }: RegionOverlayProps) => {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerContent, setMobileDrawerContent] = useState<string | null>(null);
  const { language, t } = useLanguage();
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
        const intensity = area > 0 ? (kwh / area) : null; // Nessuna divisione per 1000 qui
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
    const map: Record<string, string> = {
      online: t('region.status_online'),
      offline: t('region.status_offline'),
      not_installed: t('region.status_not_installed'),
    };
    return map[s] ?? s;
  };

  return (
    <>
    <div 
      className={`fixed top-24 left-4 md:left-8 z-30 w-80 md:w-[340px] pointer-events-none transition-all duration-500 hidden md:block ${
        visible 
          ? "opacity-100 translate-x-0" 
          : "opacity-0 -translate-x-10"
      }`}
    >
      <div className={`glass-panel p-6 rounded-2xl ${visible ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-serif text-foreground mb-1">{region.name}</h2>
            <div className="text-xs text-fgb-accent uppercase tracking-widest">
              {t('region.performance')}
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
                <div className={`bg-white/5 p-4 rounded-xl border border-white/10 transition-colors group ${activeFilters.includes('energy') ? 'cursor-pointer hover:bg-white/10' : 'opacity-30 grayscale pointer-events-none'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">{t('region.avg_energy_density')}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs">
                          {t('region.energy_intensity_tooltip')}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="text-xl font-bold text-foreground whitespace-nowrap ml-3">
                      {activeFilters.includes('energy') && displayIntensity > 0 ? (displayIntensity / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'} <span className="text-xs font-normal opacity-70">MWh/m²</span>
                    </span>
                  </div>
                  <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-400 h-full transition-all duration-700"
                      style={{ width: `${activeFilters.includes('energy') && displayIntensity > 0 ? Math.min((displayIntensity / 1000) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-80 p-0 border-border/50 shadow-xl">
                <div className="p-4 border-b border-border/30 bg-accent/5">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t('region.energy_intensity_title')}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {t('region.energy_intensity_subtitle')}
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
                          <span className="font-semibold text-foreground whitespace-nowrap shrink-0">
                            {s.intensity?.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-muted-foreground font-normal">kWh/m²</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-xs text-muted-foreground text-center">
                      {t('region.no_data')}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Air Quality Score */}
            <Popover>
              <PopoverTrigger asChild>
                <div className={`bg-white/5 p-4 rounded-xl border border-white/10 transition-colors group ${activeFilters.includes('air') ? 'cursor-pointer hover:bg-white/10' : 'opacity-30 grayscale pointer-events-none'}`}>
                  <div className="flex justify-between items-end mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-muted-foreground">{t('region.air_quality_score')}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs">
                          {t('region.air_quality_tooltip')}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <span className={`text-xl font-bold ${activeFilters.includes('air') ? aqColorClass : 'text-muted-foreground'}`}>{activeFilters.includes('air') ? displayAq : '—'}</span>
                  </div>
                  {/*displayCo2 > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Avg CO₂: {displayCo2} ppm{hasRealCo2 ? ` · ${co2SiteCountByRegion[currentRegion] ?? 0} sites` : ''}
                    </div>
                  )*/}
                  <div className="flex gap-1 mt-2">
                    {(() => {
                      const barsLit = displayAq === "EXCELLENT" ? 3 : displayAq === "GOOD" ? 2 : displayAq === "MODERATE" ? 1 : 0;
                      const barColor = displayAq === "POOR" ? "bg-rose-500" : displayAq === "MODERATE" ? "bg-yellow-500" : "bg-emerald-500";
                      const barDim = displayAq === "POOR" ? "bg-rose-500/20" : displayAq === "MODERATE" ? "bg-yellow-500/20" : "bg-emerald-500/20";
                      return [0, 1, 2].map(i => (
                        <span key={i} className={`h-2 flex-1 rounded-sm transition-all duration-500 ${i < barsLit ? barColor : barDim}`} />
                      ));
                    })()}
                  </div>
                </div>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-80 p-0 border-border/50 shadow-xl">
                <div className="p-4 border-b border-border/30 bg-accent/5">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t('region.air_quality_title')}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {t('region.air_quality_subtitle')}
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
                      {t('region.no_data')}
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
                      <span className="text-[10px] uppercase text-muted-foreground">{t('region.active_sites')}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                          {t('region.active_sites_tooltip')}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-80 p-0 border-border/50 shadow-xl">
                  <div className="p-4 border-b border-border/30 bg-accent/5">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t('region.sites_status')}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {t('region.sites_status_subtitle')}
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
                      {t('region.no_sites')}
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
                      <span className="text-[10px] uppercase text-muted-foreground">{t('region.critical_alerts')}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                          {t('region.critical_alerts_tooltip')}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-80 p-0 border-border/50 shadow-xl">
                  <div className="p-4 border-b border-border/30 bg-accent/5">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t('region.alerts_title')}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {t('region.alerts_subtitle')}
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
                        <span>{t('region.no_active_alerts')}</span>
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
                  ? `${Math.max(realSiteCount, co2SiteCountByRegion[currentRegion] ?? 0)} ${t('region.sites_live_data')}` 
                  : aggregated.hasRealData 
                    ? `${sitesCount} ${t('region.sites_in_region')}` 
                    : t('region.select_pin')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ============================================================ */}
    {/* Mobile: Fixed bottom bar with detail drawers */}
    {/* ============================================================ */}
    <div className="md:hidden fixed bottom-20 left-2 right-2 z-30 pointer-events-auto">
      <div className="glass-panel rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{region.name}</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('region.performance')}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {/* Energy Intensity */}
          <button 
            onClick={() => activeFilters.includes('energy') && setMobileDrawerContent('energy')}
            className={`text-center p-2 rounded-lg bg-white/5 border border-white/10 ${activeFilters.includes('energy') ? 'active:bg-white/10' : 'opacity-30 grayscale'}`}
          >
            <div className="text-sm font-bold text-foreground">{activeFilters.includes('energy') && displayIntensity > 0 ? (displayIntensity / 1000).toFixed(1) : '—'}</div>
            <div className="text-[8px] uppercase text-muted-foreground">MWh/m²</div>
          </button>
          {/* Air Quality */}
          <button 
            onClick={() => activeFilters.includes('air') && setMobileDrawerContent('air')}
            className={`text-center p-2 rounded-lg bg-white/5 border border-white/10 ${activeFilters.includes('air') ? 'active:bg-white/10' : 'opacity-30 grayscale'}`}
          >
            <div className={`text-sm font-bold ${aqColorClass}`}>{activeFilters.includes('air') ? displayAq : '—'}</div>
            <div className="text-[8px] uppercase text-muted-foreground">Air</div>
          </button>
          {/* Active Sites */}
          <button 
            onClick={() => setMobileDrawerContent('sites')}
            className="text-center p-2 rounded-lg bg-white/5 border border-white/10 active:bg-white/10"
          >
            <div className="text-sm font-bold text-foreground">{displayOnline}</div>
            <div className="text-[8px] uppercase text-muted-foreground">Online</div>
          </button>
          {/* Alerts */}
          <button 
            onClick={() => setMobileDrawerContent('alerts')}
            className="text-center p-2 rounded-lg bg-white/5 border border-white/10 active:bg-white/10"
          >
            <div className={`text-sm font-bold ${displayCritical > 0 ? "text-rose-400" : "text-emerald-400"}`}>{displayCritical}</div>
            <div className="text-[8px] uppercase text-muted-foreground">Alerts</div>
          </button>
        </div>
      </div>
    </div>

    {/* Mobile Drawer for KPI Details */}
    <Drawer open={!!mobileDrawerContent} onOpenChange={(open) => !open && setMobileDrawerContent(null)}>
      <DrawerContent className="max-h-[85vh] border-t border-white/10" style={{ background: 'rgba(10, 15, 25, 0.95)', backdropFilter: 'blur(24px)' }}>
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="text-foreground">
            {mobileDrawerContent === 'energy' && t('region.energy_intensity')}
            {mobileDrawerContent === 'air' && t('region.air_quality')}
            {mobileDrawerContent === 'sites' && t('region.sites_status')}
            {mobileDrawerContent === 'alerts' && t('region.alerts')}
          </DrawerTitle>
          <DrawerDescription className="text-muted-foreground">{region.name}</DrawerDescription>
        </DrawerHeader>
        <ScrollArea className="flex-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ maxHeight: 'calc(85vh - 100px)' }}>
          <div className="space-y-1 pb-6">
            {/* Energy List */}
            {mobileDrawerContent === 'energy' && siteIntensityList.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-2.5 text-xs rounded-lg hover:bg-white/5">
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                  <span className="text-muted-foreground/60 font-mono text-[10px] w-4">{i + 1}</span>
                  <span className="text-foreground truncate">{s.name}</span>
                </div>
                <span className="font-semibold text-foreground whitespace-nowrap">{s.intensity?.toFixed(1)} kWh/m²</span>
              </div>
            ))}
            {mobileDrawerContent === 'energy' && siteIntensityList.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">{t('region.no_data_short')}</p>
            )}

            {/* Air List */}
            {mobileDrawerContent === 'air' && siteAqList.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-2.5 text-xs rounded-lg hover:bg-white/5">
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                  <Circle className={`w-2 h-2 shrink-0 fill-current ${aqLabelColor(s.label)}`} />
                  <span className="text-foreground truncate">{s.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground">{s.co2 ?? '—'} ppm</span>
                  <span className={`font-semibold ${aqLabelColor(s.label)}`}>{s.label}</span>
                </div>
              </div>
            ))}
            {mobileDrawerContent === 'air' && siteAqList.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">{t('region.no_data_short')}</p>
            )}

            {/* Sites Status List */}
            {mobileDrawerContent === 'sites' && siteStatusList.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-2.5 text-xs rounded-lg hover:bg-white/5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                  <Circle className={`w-2.5 h-2.5 shrink-0 fill-current ${statusColor(s.status)}`} />
                  <span className="text-foreground truncate">{s.name}</span>
                </div>
                <span className={`text-[11px] font-medium ${statusColor(s.status)}`}>{statusLabel(s.status)}</span>
              </div>
            ))}

            {/* Alerts List */}
            {mobileDrawerContent === 'alerts' && siteAlertsList.length > 0 && siteAlertsList.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-2.5 text-xs rounded-lg hover:bg-white/5">
                <span className="text-foreground truncate min-w-0 flex-1 mr-3">{s.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.critical > 0 && <span className="px-1.5 py-0.5 rounded-full bg-rose-400/15 text-rose-400 text-[10px] font-semibold">{s.critical} crit</span>}
                  {s.warning > 0 && <span className="px-1.5 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 text-[10px] font-semibold">{s.warning} warn</span>}
                </div>
              </div>
            ))}
            {mobileDrawerContent === 'alerts' && siteAlertsList.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-emerald-400">
                <span className="text-lg mb-1">✓</span>
                <span className="text-xs">{t('region.no_active_alerts')}</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
    </>
  );
};

export default RegionOverlay;
