import { useMemo, useState } from "react";
import { useAllProjects, useAllBrands, useAllHoldings } from "@/hooks/useRealTimeData";
import { useAggregatedSiteData } from "@/hooks/useAggregatedSiteData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from "recharts";
import { BarChart3, ChevronUp, ChevronDown, Wifi, WifiOff } from "lucide-react";
import { BrandOverlaySkeleton } from "./DashboardSkeleton";
import { useLanguage } from "@/contexts/LanguageContext";

interface BrandOverlayProps {
  selectedBrand: string | null;
  selectedHolding: string | null;
  visible?: boolean;
}

const BrandOverlay = ({ selectedBrand, selectedHolding, visible = true }: BrandOverlayProps) => {
  const { t } = useLanguage();
  const [chartsExpanded, setChartsExpanded] = useState(false);
  const [isDesktopVisible, setIsDesktopVisible] = useState(true);

  const { brands } = useAllBrands();
  const { holdings } = useAllHoldings();
  const { projects, isLoading: projectsLoading } = useAllProjects();

  // Find selected entity
  const brand = useMemo(() => 
    selectedBrand ? brands.find(b => b.id === selectedBrand) : null
  , [selectedBrand, brands]);

  const holding = useMemo(() => 
    selectedHolding ? holdings.find(h => h.id === selectedHolding) : null
  , [selectedHolding, holdings]);
  
  // Get filtered projects for this brand/holding
  const filteredProjects = useMemo(() => {
    if (selectedBrand) {
      return projects.filter(p => p.brandId === selectedBrand);
    } else if (selectedHolding) {
      const holdingBrandIds = brands
        .filter(b => b.holdingId === selectedHolding)
        .map(b => b.id);
      return projects.filter(p => holdingBrandIds.includes(p.brandId));
    }
    return [];
  }, [selectedBrand, selectedHolding, projects, brands]);

  // Fetch REAL aggregated data for sites with active modules
  const {
    sitesWithEnergy,
    sitesWithAir,
    totals,
    isLoading: telemetryLoading,
    hasRealData,
  } = useAggregatedSiteData(filteredProjects);

  // Build chart data from REAL data only
  // Energy in kWh (7 days) — show total per site, with HVAC/Lighting breakdown if available
  const energyComparisonData = useMemo(() => {
    return sitesWithEnergy.map(site => {
      const hvac = site.energy.hvacKwh ?? 0;
      const light = site.energy.lightingKwh ?? 0;
      const total = site.energy.weeklyKwh ?? 0;
      // "Other" = total minus known sub-categories
      const other = Math.max(0, total - hvac - light);
      return {
        name: site.siteName.split(' ').slice(-1)[0],
        fullName: site.siteName,
        hvac,
        light,
        other,
        total,
      };
    });
  }, [sitesWithEnergy]);

  const airQualityComparisonData = useMemo(() => {
    return sitesWithAir.map(site => ({
      name: site.siteName.split(' ').slice(-1)[0],
      fullName: site.siteName,
      co2: site.air.co2 ?? 0,
      temp: site.air.temperature ?? 0,
    }));
  }, [sitesWithAir]);

  // Radar chart: use all sites with energy data, enriched with air data if available
  const sitesWithBothData = useMemo(() => {
    return sitesWithEnergy.map(site => {
      const airData = sitesWithAir.find(s => s.siteId === site.siteId);
      return {
        ...site,
        air: airData?.air ?? { co2: null, temperature: null, humidity: null, voc: null },
      };
    });
  }, [sitesWithEnergy, sitesWithAir]);

  const radarData = useMemo(() => {
    if (sitesWithBothData.length === 0) return [];
    
    const maxEnergy = Math.max(...sitesWithBothData.map(s => s.energy.weeklyKwh || 1)) || 100;
    const maxCo2 = Math.max(...sitesWithBothData.map(s => s.air.co2 || 1)) || 1000;
    
    return [
      { 
        metric: 'Energy', 
        ...Object.fromEntries(
          sitesWithBothData.map(s => [
            s.siteName.split(' ').slice(-1)[0], 
            ((s.energy.weeklyKwh || 0) / maxEnergy) * 100
          ])
        ) 
      },
      { 
        metric: 'HVAC', 
        ...Object.fromEntries(
          sitesWithBothData.map(s => [
            s.siteName.split(' ').slice(-1)[0], 
            ((s.energy.hvacKwh || 0) / (maxEnergy * 0.6)) * 100
          ])
        ) 
      },
      { 
        metric: 'Lighting', 
        ...Object.fromEntries(
          sitesWithBothData.map(s => [
            s.siteName.split(' ').slice(-1)[0], 
            ((s.energy.lightingKwh || 0) / (maxEnergy * 0.5)) * 100
          ])
        ) 
      },
      { 
        metric: 'CO₂', 
        ...Object.fromEntries(
          sitesWithBothData.map(s => [
            s.siteName.split(' ').slice(-1)[0], 
            ((s.air.co2 || 0) / maxCo2) * 100
          ])
        ) 
      },
      { 
        metric: 'Temp', 
        ...Object.fromEntries(
          sitesWithBothData.map(s => [
            s.siteName.split(' ').slice(-1)[0], 
            ((s.air.temperature || 0) / 30) * 100
          ])
        ) 
      },
    ];
  }, [sitesWithBothData]);

  const storeNames = sitesWithBothData.map(s => s.siteName.split(' ').slice(-1)[0]);
  const chartColors = ['hsl(188, 100%, 35%)', 'hsl(338, 50%, 50%)', 'hsl(43, 70%, 50%)', 'hsl(160, 60%, 40%)', 'hsl(280, 50%, 50%)'];
  
  const displayEntity = brand || holding;
  
  if (!displayEntity || !visible) return null;

  if (projectsLoading || telemetryLoading) {
    return (
      <div className="hidden md:flex fixed inset-0 items-center justify-center pointer-events-none z-20 p-3 md:p-4 pt-16 md:pt-4 pb-20 md:pb-4">
        <BrandOverlaySkeleton />
      </div>
    );
  }

  // Show charts only if we have real data from multiple sites
  const showEnergyChart = energyComparisonData.length >= 1;
  const showAirChart = airQualityComparisonData.length >= 1;
  const showRadarChart = sitesWithBothData.length >= 2;
  const showAnyChart = showEnergyChart || showAirChart || showRadarChart;

  return (
    <div className="hidden md:flex fixed inset-0 items-center justify-center pointer-events-none z-20 p-3 md:p-4 pt-16 md:pt-4 pb-20 md:pb-4">
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-3 md:gap-6 animate-fade-in max-w-6xl w-full max-h-full overflow-y-auto">
        
        {/* Left: Logo & Stats */}
        <div className="flex flex-col items-center gap-3 md:gap-6">
          {/* Brand/Holding Logo Container */}
          <div className="relative pointer-events-auto">
            <div className="absolute inset-0 bg-white/5 blur-3xl rounded-full scale-110" />
            
          <div className="glass-panel relative rounded-2xl md:rounded-3xl p-4 md:p-6 min-w-[220px] md:min-w-[280px] max-w-[220px] md:max-w-[280px]">
              {displayEntity.logo ? (
                <img 
                  src={displayEntity.logo} 
                  alt={displayEntity.name}
                  className="w-full max-h-20 object-contain opacity-90"
                />
              ) : (
                <div className="h-12 md:h-20 w-full flex items-center justify-center text-slate-800 font-bold text-xl">
                  {displayEntity.name.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          
          {/* Stats Cards Container */}
          <div className="glass-panel rounded-xl md:rounded-2xl p-3 md:p-5 min-w-[220px] md:min-w-[280px] pointer-events-auto">
            <div className="text-center mb-2 md:mb-3">
              <h3 className="text-base md:text-lg font-semibold text-foreground">{displayEntity.name}</h3>
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">
                {brand ? t('brand.brand_overview') : t('brand.holding_overview')}
              </p>
            </div>

            {/* Real Data Indicator */}
            <div className="flex items-center justify-center gap-1 mb-2">
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
            
            <div className="grid grid-cols-4 md:grid-cols-2 gap-1.5 md:gap-2">
              <div className="text-center p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-white/5 border border-white/10">
                <div className="text-base md:text-xl font-bold text-foreground">
                  {hasRealData ? totals.sitesOnline : '—'}
                </div>
                <div className="text-[8px] md:text-[9px] uppercase text-muted-foreground">{t('brand.sites_online')}</div>
              </div>
              <div className="text-center p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-white/5 border border-white/10">
                <div className="text-base md:text-xl font-bold text-foreground">
                  {hasRealData && totals.weeklyEnergyKwh > 0 ? totals.weeklyEnergyKwh.toLocaleString() : '—'}
                </div>
                <div className="text-[8px] md:text-[9px] uppercase text-muted-foreground">{t('brand.kwh_7d')}</div>
              </div>
              <div className="text-center p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-white/5 border border-white/10">
                <div className="text-base md:text-xl font-bold text-foreground">
                  {hasRealData && totals.avgCo2 > 0 ? totals.avgCo2 : '—'}
                </div>
                <div className="text-[8px] md:text-[9px] uppercase text-muted-foreground">Avg CO₂</div>
              </div>
              <div className="text-center p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-white/5 border border-white/10">
                <div className="text-base md:text-xl font-bold text-foreground">
                  {hasRealData && (totals.alertsCritical > 0 || totals.alertsWarning > 0) 
                    ? <span className={totals.alertsCritical > 0 ? 'text-destructive' : 'text-yellow-500'}>{totals.alertsCritical + totals.alertsWarning}</span>
                    : '0'}
                </div>
                <div className="text-[8px] md:text-[9px] uppercase text-muted-foreground">{t('brand.active_alerts')}</div>
              </div>
            </div>
            
            {showAnyChart && (
              <>
                {/* Mobile Toggle Button */}
                <button
                  onClick={() => setChartsExpanded(!chartsExpanded)}
                  className="md:hidden flex items-center justify-center gap-2 w-full py-2 px-3 bg-white/50 hover:bg-white/70 backdrop-blur-md rounded-lg border border-white/30 text-xs font-medium transition-all pointer-events-auto mt-2 text-slate-700"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>{chartsExpanded ? t('brand.hide_charts') : t('brand.show_charts')}</span>
                  {chartsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {/* Desktop Toggle Button */}
                <button
                  onClick={() => setIsDesktopVisible(!isDesktopVisible)}
                  className="hidden md:flex items-center justify-center gap-2 w-full py-2 px-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 text-xs font-medium transition-all pointer-events-auto mt-3 text-muted-foreground hover:text-foreground"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>{isDesktopVisible ? t('brand.hide_charts') : t('brand.show_charts')}</span>
                  {isDesktopVisible ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </>
            )}

            {/* No real data message */}
            {!hasRealData && (
              <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-muted">
                <p className="text-[10px] text-muted-foreground text-center">
                  {t('brand.no_active_modules')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Comparison Charts - Only show with REAL data */}
        {showAnyChart && (
          <div className={`
            flex-1 grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 max-w-3xl pointer-events-auto w-full 
            ${chartsExpanded ? 'grid' : 'hidden'} 
            ${isDesktopVisible ? 'md:grid' : 'md:hidden'} 
          `}>
            {/* Energy Comparison - Only if real energy data */}
            {showEnergyChart && (
              <div className="glass-panel rounded-xl md:rounded-2xl p-2.5 md:p-4">
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  <h4 className="text-xs md:text-sm font-semibold text-foreground">{t('brand.energy_consumption')}</h4>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600">LIVE</span>
                </div>
                <ResponsiveContainer width="100%" height={120} className="md:hidden">
                  <BarChart data={energyComparisonData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 8 }} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 8 }} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '8px', fontSize: 10, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      labelStyle={{ color: '#1e293b' }}
                      itemStyle={{ color: '#64748b' }}
                    />
                    <Bar dataKey="hvac" stackId="a" fill="hsl(188, 100%, 35%)" name="HVAC" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="light" stackId="a" fill="hsl(338, 50%, 50%)" name="Lighting" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="other" stackId="a" fill="hsl(43, 70%, 50%)" name="Other" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={180} className="hidden md:block">
                  <BarChart data={energyComparisonData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      labelStyle={{ color: '#1e293b' }}
                      itemStyle={{ color: '#64748b' }}
                    />
                    <Bar dataKey="hvac" stackId="a" fill="hsl(188, 100%, 35%)" name="HVAC" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="light" stackId="a" fill="hsl(338, 50%, 50%)" name="Lighting" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="other" stackId="a" fill="hsl(43, 70%, 50%)" name="Other" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* CO2 Comparison - Only if real air data */}
            {showAirChart && (
              <div className="glass-panel rounded-xl md:rounded-2xl p-2.5 md:p-4">
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  <h4 className="text-xs md:text-sm font-semibold text-foreground">{t('brand.air_quality')}</h4>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600">LIVE</span>
                </div>
                <ResponsiveContainer width="100%" height={120} className="md:hidden">
                  <BarChart data={airQualityComparisonData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 8 }} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 8 }} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '8px', fontSize: 10, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      labelStyle={{ color: '#1e293b' }}
                      itemStyle={{ color: '#64748b' }}
                    />
                    <Bar dataKey="co2" fill="hsl(160, 60%, 40%)" name="CO₂" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={180} className="hidden md:block">
                  <BarChart data={airQualityComparisonData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: 'rgba(0,0,0,0.1)' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      labelStyle={{ color: '#1e293b' }}
                      itemStyle={{ color: '#64748b' }}
                    />
                    <Bar dataKey="co2" fill="hsl(160, 60%, 40%)" name="CO₂" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Radar Chart - Only if sites have both energy AND air data */}
            {showRadarChart && (
              <div className={`glass-panel rounded-xl md:rounded-2xl p-2.5 md:p-4 ${showEnergyChart && showAirChart ? 'md:col-span-2' : ''}`}>
                <div className="flex items-center gap-2 mb-2 md:mb-3">
                  <h4 className="text-xs md:text-sm font-semibold text-foreground">{t('brand.performance_comparison')}</h4>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600">LIVE</span>
                </div>
                <ResponsiveContainer width="100%" height={160} className="md:hidden">
                  <RadarChart data={radarData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <PolarGrid stroke="rgba(0,0,0,0.1)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 8 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 7 }} />
                    {storeNames.map((name, idx) => (
                      <Radar 
                        key={name} 
                        name={name} 
                        dataKey={name} 
                        stroke={chartColors[idx % chartColors.length]} 
                        fill={chartColors[idx % chartColors.length]} 
                        fillOpacity={0.2}
                        strokeWidth={1.5}
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 9, color: '#94a3b8' }} iconType="circle" iconSize={6} />
                  </RadarChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={220} className="hidden md:block">
                  <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                    <PolarGrid stroke="rgba(0,0,0,0.15)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} />
                    {storeNames.map((name, idx) => (
                      <Radar 
                        key={name} 
                        name={name} 
                        dataKey={name} 
                        stroke={chartColors[idx % chartColors.length]} 
                        fill={chartColors[idx % chartColors.length]} 
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} iconType="circle" />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BrandOverlay;
