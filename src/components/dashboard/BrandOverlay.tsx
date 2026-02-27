import { useMemo, useState } from "react";
import { useAllProjects, useAllBrands, useAllHoldings } from "@/hooks/useRealTimeData";
import { useAggregatedSiteData } from "@/hooks/useAggregatedSiteData";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, BarChart, Bar, Legend
} from "recharts";
import { ChevronUp, ChevronDown, Wifi, WifiOff, Circle, Info, BarChart3, Building2 } from "lucide-react";
import { BrandOverlaySkeleton } from "./DashboardSkeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BrandOverlayProps {
  selectedBrand: string | null;
  selectedHolding: string | null;
  visible?: boolean;
  currentRegion?: string;
  activeFilters?: string[];
}

const BrandOverlay = ({ selectedBrand, selectedHolding, visible = true, currentRegion = 'GLOBAL', activeFilters = ['energy', 'air', 'water'] }: BrandOverlayProps) => {
  const { t, language } = useLanguage();
  const [chartsExpanded, setChartsExpanded] = useState(false);
  const [isDesktopVisible, setIsDesktopVisible] = useState(true);

  const { brands } = useAllBrands();
  const { holdings } = useAllHoldings();
  const { projects, isLoading: projectsLoading } = useAllProjects();

  const brand = useMemo(() => 
    selectedBrand ? brands.find(b => b.id === selectedBrand) : null
  , [selectedBrand, brands]);

  const holding = useMemo(() => 
    selectedHolding ? holdings.find(h => h.id === selectedHolding) : null
  , [selectedHolding, holdings]);
  
  const filteredProjects = useMemo(() => {
    let result: typeof projects = [];
    if (selectedBrand) {
      result = projects.filter(p => p.brandId === selectedBrand);
    } else if (selectedHolding) {
      const holdingBrandIds = brands
        .filter(b => b.holdingId === selectedHolding)
        .map(b => b.id);
      result = projects.filter(p => holdingBrandIds.includes(p.brandId));
    }
    if (currentRegion && currentRegion !== 'GLOBAL') {
      result = result.filter(p => p.region === currentRegion);
    }
    return result;
  }, [selectedBrand, selectedHolding, projects, brands, currentRegion]);

  const {
    sites: allSitesData,
    sitesWithEnergy,
    sitesWithAir,
    totals,
    isLoading: telemetryLoading,
    hasRealData,
  } = useAggregatedSiteData(filteredProjects);

  // =====================================================================
  // Chart 1: Scatter Plot data (Energy kWh vs CO₂)
  // =====================================================================
  const scatterData = useMemo(() => {
    return sitesWithEnergy.map(site => {
      const airData = sitesWithAir.find(s => s.siteId === site.siteId);
      return {
        name: site.siteName,
        kwh: Math.round(site.energy.monthlyKwh ?? 0),
        co2: airData?.air.co2 ?? 0,
        isOnline: site.isOnline,
      };
    }).filter(s => s.kwh > 0 || s.co2 > 0);
  }, [sitesWithEnergy, sitesWithAir]);

  const scatterMedians = useMemo(() => {
    if (scatterData.length === 0) return { medianKwh: 0, medianCo2: 0 };
    const kwhValues = scatterData.map(s => s.kwh).sort((a, b) => a - b);
    const co2Values = scatterData.filter(s => s.co2 > 0).map(s => s.co2).sort((a, b) => a - b);
    const median = (arr: number[]) => arr.length === 0 ? 0 : arr[Math.floor(arr.length / 2)];
    return { medianKwh: median(kwhValues), medianCo2: median(co2Values) || 600 };
  }, [scatterData]);

  // =====================================================================
  // Chart 2: Leaderboard data (Top consumers & worst air)
  // =====================================================================
  const energyLeaderboard = useMemo(() => {
    return sitesWithEnergy
      .filter(s => (s.energy.monthlyKwh ?? 0) > 0)
      .map(s => ({ name: s.siteName, value: Math.round(s.energy.monthlyKwh ?? 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [sitesWithEnergy]);

  const airLeaderboard = useMemo(() => {
    return sitesWithAir
      .filter(s => (s.air.co2 ?? 0) > 0)
      .map(s => ({ name: s.siteName, value: Math.round(s.air.co2 ?? 0) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [sitesWithAir]);

  // =====================================================================
  // Chart 3: Health Matrix data
  // =====================================================================
  const healthMatrixData = useMemo(() => {
    const allSites = [...sitesWithEnergy];
    sitesWithAir.forEach(s => {
      if (!allSites.find(e => e.siteId === s.siteId)) allSites.push(s);
    });

    return allSites.map(site => {
      const airData = sitesWithAir.find(s => s.siteId === site.siteId);
      const kwh = site.energy.monthlyKwh ?? 0;
      const co2 = airData?.air.co2 ?? 0;
      const alerts = site.alerts.critical + site.alerts.warning;

      const getEnergyStatus = (v: number) => {
        if (v === 0) return 'none';
        if (v < 2000) return 'good';
        if (v < 5000) return 'moderate';
        return 'critical';
      };
      const getAirStatus = (v: number) => {
        if (v === 0) return 'none';
        if (v < 600) return 'good';
        if (v < 1000) return 'moderate';
        return 'critical';
      };
      const getAlertStatus = (v: number) => {
        if (v === 0) return 'good';
        if (v <= 3) return 'moderate';
        return 'critical';
      };

      return {
        name: site.siteName,
        isOnline: site.isOnline,
        energy: { value: kwh, status: getEnergyStatus(kwh) },
        air: { value: co2, status: getAirStatus(co2) },
        alerts: { value: alerts, status: getAlertStatus(alerts) },
      };
    }).sort((a, b) => {
      const score = (s: typeof a) => {
        const map: Record<string, number> = { critical: 3, moderate: 2, good: 1, none: 0 };
        return (map[s.energy.status] || 0) + (map[s.air.status] || 0) + (map[s.alerts.status] || 0);
      };
      return score(b) - score(a);
    });
  }, [sitesWithEnergy, sitesWithAir]);

  // =====================================================================
  // Chart 4: Store Directory
  // =====================================================================
  const storeDirectory = useMemo(() => {
    return filteredProjects.map(p => {
      const siteData = [...sitesWithEnergy, ...sitesWithAir].find(s => s.siteId === p.siteId);
      return {
        name: p.name,
        city: p.address?.split(',').pop()?.trim() || '—',
        region: p.region || '—',
        isOnline: siteData?.isOnline ?? false,
        hasData: !!siteData,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredProjects, sitesWithEnergy, sitesWithAir]);

  // === Popover drill-down lists ===
  const siteStatusList = useMemo(() => {
    const order: Record<string, number> = { online: 0, offline: 1, not_installed: 2 };
    return filteredProjects.map(p => {
      const hookSite = sitesWithEnergy.find(s => s.siteId === p.siteId) || sitesWithAir.find(s => s.siteId === p.siteId);
      let status: 'online' | 'offline' | 'not_installed' = 'not_installed';
      if (hookSite) status = hookSite.isOnline ? 'online' : 'offline';
      return { name: p.name, status };
    }).sort((a, b) => order[a.status] - order[b.status]);
  }, [filteredProjects, sitesWithEnergy, sitesWithAir]);

  const energyRankedList = useMemo(() => {
    return sitesWithEnergy
      .filter(s => (s.energy.monthlyKwh ?? 0) > 0)
      .map(s => ({ name: s.siteName, kwh: Math.round(s.energy.monthlyKwh ?? 0) }))
      .sort((a, b) => b.kwh - a.kwh);
  }, [sitesWithEnergy]);

  const getAqLabel = (co2: number | null): string => {
    if (!co2 || co2 === 0) return "N/A";
    if (co2 < 400) return "EXCELLENT";
    if (co2 < 600) return "GOOD";
    if (co2 < 1000) return "MODERATE";
    return "POOR";
  };
  const aqRank: Record<string, number> = { EXCELLENT: 0, GOOD: 1, MODERATE: 2, POOR: 3, "N/A": 4 };
  const co2RankedList = useMemo(() => {
    return sitesWithAir
      .map(s => ({ name: s.siteName, co2: s.air.co2 ?? 0, label: getAqLabel(s.air.co2) }))
      .sort((a, b) => aqRank[a.label] - aqRank[b.label]);
  }, [sitesWithAir]);

  const alertsList = useMemo(() => {
    return [...sitesWithEnergy, ...sitesWithAir]
      .filter((s, i, arr) => arr.findIndex(x => x.siteId === s.siteId) === i)
      .filter(s => s.alerts.critical > 0 || s.alerts.warning > 0)
      .map(s => ({ name: s.siteName, critical: s.alerts.critical, warning: s.alerts.warning }))
      .sort((a, b) => (b.critical + b.warning) - (a.critical + a.warning));
  }, [sitesWithEnergy, sitesWithAir]);

  const aqColorMap: Record<string, string> = {
    EXCELLENT: 'text-emerald-400', GOOD: 'text-emerald-500', MODERATE: 'text-yellow-500', POOR: 'text-red-400', 'N/A': 'text-muted-foreground'
  };
  const statusColor: Record<string, string> = { online: 'text-emerald-500', offline: 'text-yellow-500', not_installed: 'text-red-400' };
  const statusLabel: Record<string, Record<string, string>> = {
    online: { it: 'Online', en: 'Online' },
    offline: { it: 'Offline', en: 'Offline' },
    not_installed: { it: 'Da installare', en: 'Ready to install' },
  };

  const displayEntity = brand || holding;

  if (!displayEntity || !visible) return null;

  if (projectsLoading || telemetryLoading) {
    return (
      <div className="hidden md:block fixed top-24 right-4 md:right-8 z-30 pointer-events-none">
        <BrandOverlaySkeleton />
      </div>
    );
  }

  const filterEnergy = activeFilters.includes('energy');
  const filterAir = activeFilters.includes('air');
  const showScatter = scatterData.length >= 2 && filterEnergy && filterAir;
  const showLeaderboards = (energyLeaderboard.length >= 1 && filterEnergy) || (airLeaderboard.length >= 1 && filterAir);
  const showHealthMatrix = healthMatrixData.length >= 1;
  const showAnyChart = showScatter || showLeaderboards || showHealthMatrix;

  // Scatter quadrant coloring
  const getQuadrantColor = (kwh: number, co2: number) => {
    const highEnergy = kwh > scatterMedians.medianKwh;
    const highCo2 = co2 > scatterMedians.medianCo2;
    if (highEnergy && highCo2) return 'hsl(0, 70%, 55%)';       // Red: critical
    if (!highEnergy && highCo2) return 'hsl(45, 80%, 55%)';     // Yellow: health risk
    if (highEnergy && !highCo2) return 'hsl(30, 70%, 55%)';     // Orange: energy waste
    return 'hsl(160, 60%, 45%)';                                 // Green: best performer
  };

  const healthStatusColors: Record<string, string> = {
    good: 'bg-emerald-500/80',
    moderate: 'bg-yellow-500/80',
    critical: 'bg-red-500/80',
    none: 'bg-muted/40',
  };

  return (
    <>
      {/* ============================================================ */}
      {/* Summary Panel — top-right, like RegionOverlay */}
      {/* ============================================================ */}
      <div className={`fixed top-24 right-4 md:right-8 z-30 w-72 md:w-[300px] pointer-events-none transition-all duration-500 hidden md:block ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
      }`}>
        <div className="glass-panel p-5 rounded-2xl pointer-events-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-3">
            {displayEntity.logo ? (
              <img src={displayEntity.logo} alt={displayEntity.name} className="h-8 object-contain opacity-90" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-foreground font-bold text-sm">
                {displayEntity.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{displayEntity.name}</h3>
              <p className="text-[10px] text-fgb-accent uppercase tracking-widest">
                {brand ? t('brand.brand_overview') : t('brand.holding_overview')}
              </p>
            </div>
          </div>

          {/* Real Data Indicator */}
          <div className="flex items-center gap-1 mb-3">
            {hasRealData ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] text-emerald-500 uppercase tracking-wider">{t('brand.data_available')}</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('brand.no_data')}</span>
              </>
            )}
          </div>

          {/* Stats Grid */}
          <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-2 gap-1.5">

            {/* Sites Online */}
            <Popover>
              <PopoverTrigger asChild>
                <div className="text-center p-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors group">
                  <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <UITooltip>
                      <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        {language === 'it' ? "Siti con almeno un dato telemetrico ricevuto nell'ultima ora." : "Sites with at least one telemetry reading received in the last hour."}
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="text-lg font-bold text-foreground -mt-1">{hasRealData ? totals.sitesOnline : '—'}</div>
                  <div className="text-[8px] uppercase text-muted-foreground">{t('brand.sites_online')}</div>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 border-border/50 bg-popover/95 backdrop-blur-xl" side="left" align="start">
                <div className="px-3 py-2 border-b border-border/30">
                  <p className="text-xs font-semibold text-foreground">{language === 'it' ? 'Stato siti' : 'Sites Status'}</p>
                </div>
                <ScrollArea className="max-h-[220px]">
                  <div className="p-2 space-y-0.5">
                    {siteStatusList.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5">
                        <Circle className={`w-2.5 h-2.5 fill-current ${statusColor[s.status]}`} />
                        <span className="text-xs text-foreground break-words flex-1">{s.name}</span>
                        <span className={`text-[10px] ${statusColor[s.status]}`}>{statusLabel[s.status][language]}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* kWh (30d) */}
            <Popover>
              <PopoverTrigger asChild>
                <div className={`text-center p-2 rounded-xl bg-white/5 border border-white/10 transition-colors group ${filterEnergy ? 'cursor-pointer hover:bg-white/10' : 'opacity-30 grayscale pointer-events-none'}`}>
                  <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <UITooltip>
                      <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        {language === 'it' ? "Consumo totale ultimi 30 giorni, solo contatori 'general'." : "Total energy over 30 days, 'general' category meters only."}
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="text-lg font-bold text-foreground -mt-1">
                    {filterEnergy && hasRealData && totals.monthlyEnergyKwh > 0 ? totals.monthlyEnergyKwh.toLocaleString() : '—'}
                  </div>
                  <div className="text-[8px] uppercase text-muted-foreground">{t('brand.kwh_7d')}</div>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 border-border/50 bg-popover/95 backdrop-blur-xl" side="left" align="start">
                <div className="px-3 py-2 border-b border-border/30">
                  <p className="text-xs font-semibold text-foreground">{language === 'it' ? 'Consumo per sito (30g)' : 'Consumption per site (30d)'}</p>
                </div>
                <ScrollArea className="max-h-[220px]">
                  <div className="p-2 space-y-0.5">
                    {energyRankedList.length > 0 ? energyRankedList.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5">
                        <span className="text-[10px] text-muted-foreground w-4 text-right">{i + 1}.</span>
                        <span className="text-xs text-foreground break-words flex-1">{s.name}</span>
                        <span className="text-xs font-semibold text-foreground tabular-nums">{s.kwh.toLocaleString()} <span className="text-muted-foreground font-normal">kWh</span></span>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground text-center py-3">{language === 'it' ? 'Nessun dato' : 'No data'}</p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Avg CO₂ */}
            <Popover>
              <PopoverTrigger asChild>
                <div className={`text-center p-2 rounded-xl bg-white/5 border border-white/10 transition-colors group ${filterAir ? 'cursor-pointer hover:bg-white/10' : 'opacity-30 grayscale pointer-events-none'}`}>
                  <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <UITooltip>
                      <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        {language === 'it' ? "Media CO₂ (ppm) su 30 giorni per siti con sensori aria." : "30-day avg CO₂ (ppm) for sites with air sensors."}
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="text-lg font-bold text-foreground -mt-1">
                    {filterAir && hasRealData && totals.avgCo2 > 0 ? totals.avgCo2 : '—'}
                  </div>
                  <div className="text-[8px] uppercase text-muted-foreground">Avg CO₂</div>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 border-border/50 bg-popover/95 backdrop-blur-xl" side="left" align="start">
                <div className="px-3 py-2 border-b border-border/30">
                  <p className="text-xs font-semibold text-foreground">{language === 'it' ? 'Qualità aria per sito' : 'Air quality per site'}</p>
                </div>
                <ScrollArea className="max-h-[220px]">
                  <div className="p-2 space-y-0.5">
                    {co2RankedList.length > 0 ? co2RankedList.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5">
                        <Circle className={`w-2.5 h-2.5 fill-current ${aqColorMap[s.label]}`} />
                        <span className="text-xs text-foreground break-words flex-1">{s.name}</span>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-foreground tabular-nums">{s.co2} <span className="text-muted-foreground font-normal">ppm</span></span>
                          <div className={`text-[9px] font-medium ${aqColorMap[s.label]}`}>{s.label}</div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground text-center py-3">{language === 'it' ? 'Nessun dato' : 'No data'}</p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Active Alerts */}
            <Popover>
              <PopoverTrigger asChild>
                <div className="text-center p-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors group">
                  <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <UITooltip>
                      <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        {language === 'it' ? "Allarmi attivi: eventi critici/warning o siti senza dati da oltre 2 giorni." : "Active alerts: critical/warning events or sites with no data for 2+ days."}
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="text-lg font-bold text-foreground -mt-1">
                    {hasRealData && (totals.alertsCritical > 0 || totals.alertsWarning > 0) 
                      ? <span className={totals.alertsCritical > 0 ? 'text-destructive' : 'text-yellow-500'}>{totals.alertsCritical + totals.alertsWarning}</span>
                      : '0'}
                  </div>
                  <div className="text-[8px] uppercase text-muted-foreground">{t('brand.active_alerts')}</div>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 border-border/50 bg-popover/95 backdrop-blur-xl" side="left" align="start">
                <div className="px-3 py-2 border-b border-border/30">
                  <p className="text-xs font-semibold text-foreground">{language === 'it' ? 'Allarmi per sito' : 'Alerts per site'}</p>
                </div>
                <ScrollArea className="max-h-[220px]">
                  <div className="p-2 space-y-0.5">
                    {alertsList.length > 0 ? alertsList.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5">
                        <span className="text-xs text-foreground break-words flex-1">{s.name}</span>
                        <div className="flex items-center gap-1.5">
                          {s.critical > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">{s.critical} crit</span>}
                          {s.warning > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500">{s.warning} warn</span>}
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground text-center py-3">{language === 'it' ? 'Nessun allarme attivo' : 'No active alerts'}</p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

          </div>
          </TooltipProvider>

          {/* Chart toggle */}
          {showAnyChart && (
            <button
              onClick={() => setIsDesktopVisible(!isDesktopVisible)}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-xs font-medium transition-all pointer-events-auto mt-3 text-muted-foreground hover:text-foreground"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{isDesktopVisible ? t('brand.hide_charts') : t('brand.show_charts')}</span>
              {isDesktopVisible ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          {!hasRealData && (
            <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-muted">
              <p className="text-[10px] text-muted-foreground text-center">{t('brand.no_active_modules')}</p>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* Charts Panel — positioned below, centered */}
      {/* ============================================================ */}
      {showAnyChart && isDesktopVisible && (
        <div className="hidden md:block fixed top-24 left-4 md:left-8 z-20 pointer-events-none" style={{ width: 'calc(100% - 340px - 3rem)' }}>
          <div className="pointer-events-auto grid grid-cols-2 gap-3 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">

            {/* ========== Chart 1: Efficiency vs Comfort Scatter ========== */}
            {showScatter && (
              <div className="glass-panel rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    {language === 'it' ? 'Efficienza vs Comfort' : 'Efficiency vs Comfort'}
                  </h4>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600">LIVE</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-3">
                  {language === 'it' ? 'Energia (kWh) vs CO₂ (ppm) · Ultimi 30 giorni' : 'Energy (kWh) vs CO₂ (ppm) · Last 30 days'}
                </p>
                {/* Quadrant legend */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {[
                    { color: 'bg-emerald-500', label: language === 'it' ? 'Best Performer' : 'Best Performer' },
                    { color: 'bg-yellow-500', label: language === 'it' ? 'Rischio Salute' : 'Health Risk' },
                    { color: 'bg-orange-500', label: language === 'it' ? 'Spreco Energia' : 'Energy Waste' },
                    { color: 'bg-red-500', label: language === 'it' ? 'Critico' : 'Critical' },
                  ].map(q => (
                    <div key={q.label} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${q.color}`} />
                      <span className="text-[9px] text-muted-foreground">{q.label}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                    <XAxis 
                      type="number" dataKey="kwh" name="kWh" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      label={{ value: 'kWh (30d)', position: 'insideBottom', offset: -2, style: { fill: 'hsl(var(--muted-foreground))', fontSize: 10 } }}
                    />
                    <YAxis 
                      type="number" dataKey="co2" name="CO₂ (ppm)" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      label={{ value: 'CO₂ ppm', angle: -90, position: 'insideLeft', offset: 10, style: { fill: 'hsl(var(--muted-foreground))', fontSize: 10 } }}
                    />
                    <ReferenceLine x={scatterMedians.medianKwh} stroke="hsl(var(--muted-foreground) / 0.4)" strokeDasharray="4 4" />
                    <ReferenceLine y={scatterMedians.medianCo2} stroke="hsl(var(--muted-foreground) / 0.4)" strokeDasharray="4 4" />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="glass-panel rounded-lg p-2.5 text-xs border border-white/10">
                            <p className="font-semibold text-foreground mb-1">{d.name}</p>
                            <p className="text-muted-foreground">⚡ {d.kwh.toLocaleString()} kWh</p>
                            <p className="text-muted-foreground">💨 {d.co2} ppm CO₂</p>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={scatterData} shape="circle">
                      {scatterData.map((entry, idx) => (
                        <Cell key={idx} fill={getQuadrantColor(entry.kwh, entry.co2)} r={8} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ========== Chart 2: Horizontal Leaderboards ========== */}
            {showLeaderboards && (
              <div className="glass-panel rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    {language === 'it' ? 'Classifica Siti' : 'Site Leaderboard'}
                  </h4>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600">LIVE</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-3">
                  {language === 'it' ? 'Ordinati dal peggiore al migliore · 30 giorni' : 'Sorted worst to best · 30 days'}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {/* Energy leaderboard */}
                  {filterEnergy && energyLeaderboard.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                        ⚡ {language === 'it' ? 'Consumo Energia' : 'Energy Consumption'}
                      </p>
                      <div className="space-y-1">
                        {energyLeaderboard.map((s, i) => {
                          const maxVal = energyLeaderboard[0]?.value || 1;
                          const pct = (s.value / maxVal) * 100;
                          const barColor = pct > 80 ? 'bg-red-500/70' : pct > 50 ? 'bg-yellow-500/70' : 'bg-emerald-500/70';
                          return (
                            <div key={i} className="group">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[10px] text-foreground truncate max-w-[100px]" title={s.name}>{s.name}</span>
                                <span className="text-[10px] font-semibold text-foreground tabular-nums ml-1">{s.value.toLocaleString()}</span>
                              </div>
                              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Air leaderboard */}
                  {filterAir && airLeaderboard.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                        💨 {language === 'it' ? 'Peggiore Aria (CO₂)' : 'Worst Air Quality (CO₂)'}
                      </p>
                      <div className="space-y-1">
                        {airLeaderboard.map((s, i) => {
                          const maxVal = airLeaderboard[0]?.value || 1;
                          const pct = (s.value / maxVal) * 100;
                          const barColor = s.value > 1000 ? 'bg-red-500/70' : s.value > 600 ? 'bg-yellow-500/70' : 'bg-emerald-500/70';
                          return (
                            <div key={i} className="group">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[10px] text-foreground truncate max-w-[100px]" title={s.name}>{s.name}</span>
                                <span className="text-[10px] font-semibold text-foreground tabular-nums ml-1">{s.value.toLocaleString()}</span>
                              </div>
                              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========== Chart 3: System Health Matrix ========== */}
            {showHealthMatrix && (
              <div className="glass-panel rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    {language === 'it' ? 'Matrice Salute Sistema' : 'System Health Matrix'}
                  </h4>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600">LIVE</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-3">
                  {language === 'it' ? 'Stato operativo per modulo · Triage immediato' : 'Operational status by module · Immediate triage'}
                </p>
                {/* Legend */}
                <div className="flex items-center gap-3 mb-3">
                  {[
                    { color: 'bg-emerald-500/80', label: language === 'it' ? 'OK' : 'OK' },
                    { color: 'bg-yellow-500/80', label: language === 'it' ? 'Attenzione' : 'Warning' },
                    { color: 'bg-red-500/80', label: language === 'it' ? 'Critico' : 'Critical' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1">
                      <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
                      <span className="text-[9px] text-muted-foreground">{l.label}</span>
                    </div>
                  ))}
                </div>
                {/* Header */}
                <div className="grid grid-cols-[1fr_60px_60px_60px] gap-1 mb-1">
                  <span className="text-[9px] text-muted-foreground uppercase pl-1">{language === 'it' ? 'Sito' : 'Site'}</span>
                  {filterEnergy && <span className="text-[9px] text-muted-foreground uppercase text-center">⚡</span>}
                  {!filterEnergy && <span />}
                  {filterAir && <span className="text-[9px] text-muted-foreground uppercase text-center">💨</span>}
                  {!filterAir && <span />}
                  <span className="text-[9px] text-muted-foreground uppercase text-center">⚠️</span>
                </div>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-0.5">
                    {healthMatrixData.map((site, i) => (
                      <div key={i} className="grid grid-cols-[1fr_60px_60px_60px] gap-1 items-center py-1 px-1 rounded-lg hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Circle className={`w-2 h-2 fill-current shrink-0 ${site.isOnline ? 'text-emerald-500' : 'text-red-400'}`} />
                          <span className="text-[10px] text-foreground truncate" title={site.name}>{site.name}</span>
                        </div>
                        {filterEnergy ? (
                          <div className={`rounded-md py-1 text-center ${healthStatusColors[site.energy.status]}`}>
                            <span className="text-[9px] font-semibold text-white">
                              {site.energy.value > 0 ? (site.energy.value > 999 ? `${(site.energy.value / 1000).toFixed(1)}k` : site.energy.value) : '—'}
                            </span>
                          </div>
                        ) : <div className="rounded-md py-1 bg-muted/20" />}
                        {filterAir ? (
                          <div className={`rounded-md py-1 text-center ${healthStatusColors[site.air.status]}`}>
                            <span className="text-[9px] font-semibold text-white">
                              {site.air.value > 0 ? site.air.value : '—'}
                            </span>
                          </div>
                        ) : <div className="rounded-md py-1 bg-muted/20" />}
                        <div className={`rounded-md py-1 text-center ${healthStatusColors[site.alerts.status]}`}>
                          <span className="text-[9px] font-semibold text-white">
                            {site.alerts.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* ========== Chart 4: Store Directory ========== */}
            <div className="glass-panel rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-foreground">
                  {language === 'it' ? 'Elenco Siti' : 'Store Directory'}
                </h4>
              </div>
              <p className="text-[10px] text-muted-foreground mb-3">
                {language === 'it' ? `${storeDirectory.length} siti · Ordinamento alfabetico` : `${storeDirectory.length} sites · Alphabetical order`}
              </p>
              <ScrollArea className="max-h-[240px]">
                <div className="space-y-0.5">
                  {storeDirectory.map((site, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors">
                      <Circle className={`w-2.5 h-2.5 fill-current shrink-0 ${
                        site.isOnline ? 'text-emerald-500' : site.hasData ? 'text-yellow-500' : 'text-red-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate">{site.name}</p>
                        <p className="text-[9px] text-muted-foreground">{site.city} · {site.region}</p>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${
                        site.isOnline 
                          ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' 
                          : site.hasData 
                            ? 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10'
                            : 'border-red-400/30 text-red-400 bg-red-400/10'
                      }`}>
                        {site.isOnline 
                          ? 'Online' 
                          : site.hasData 
                            ? 'Offline' 
                            : (language === 'it' ? 'N/A' : 'N/A')}
                      </span>
                    </div>
                  ))}
                  {storeDirectory.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {language === 'it' ? 'Nessun sito disponibile' : 'No sites available'}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Mobile: Collapsible summary */}
      {/* ============================================================ */}
      <div className="md:hidden fixed bottom-20 left-2 right-2 z-30 pointer-events-auto">
        <div className="glass-panel rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {displayEntity.logo ? (
                <img src={displayEntity.logo} alt={displayEntity.name} className="h-5 object-contain" />
              ) : (
                <span className="text-xs font-bold text-foreground">{displayEntity.name.substring(0, 2).toUpperCase()}</span>
              )}
              <span className="text-xs font-semibold text-foreground">{displayEntity.name}</span>
            </div>
            <button onClick={() => setChartsExpanded(!chartsExpanded)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20">
              {chartsExpanded ? <ChevronDown className="w-4 h-4 text-foreground" /> : <ChevronUp className="w-4 h-4 text-foreground" />}
            </button>
          </div>
          {chartsExpanded && (
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <div className="text-center p-1.5 rounded-lg bg-white/5 border border-white/10">
                <div className="text-sm font-bold text-foreground">{hasRealData ? totals.sitesOnline : '—'}</div>
                <div className="text-[7px] uppercase text-muted-foreground">{t('brand.sites_online')}</div>
              </div>
              <div className={`text-center p-1.5 rounded-lg bg-white/5 border border-white/10 ${!filterEnergy ? 'opacity-30 grayscale' : ''}`}>
                <div className="text-sm font-bold text-foreground">{filterEnergy && hasRealData && totals.monthlyEnergyKwh > 0 ? totals.monthlyEnergyKwh.toLocaleString() : '—'}</div>
                <div className="text-[7px] uppercase text-muted-foreground">{t('brand.kwh_7d')}</div>
              </div>
              <div className={`text-center p-1.5 rounded-lg bg-white/5 border border-white/10 ${!filterAir ? 'opacity-30 grayscale' : ''}`}>
                <div className="text-sm font-bold text-foreground">{filterAir && hasRealData && totals.avgCo2 > 0 ? totals.avgCo2 : '—'}</div>
                <div className="text-[7px] uppercase text-muted-foreground">CO₂</div>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-white/5 border border-white/10">
                <div className="text-sm font-bold text-foreground">
                  {hasRealData && (totals.alertsCritical + totals.alertsWarning) > 0 
                    ? <span className={totals.alertsCritical > 0 ? 'text-destructive' : 'text-yellow-500'}>{totals.alertsCritical + totals.alertsWarning}</span> 
                    : '0'}
                </div>
                <div className="text-[7px] uppercase text-muted-foreground">{t('brand.active_alerts')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default BrandOverlay;
