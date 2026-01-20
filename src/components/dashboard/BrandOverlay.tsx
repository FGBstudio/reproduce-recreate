import { useMemo, useState } from "react";
// Import hooks per i dati reali
import { useAllProjects, useAllBrands, useAllHoldings } from "@/hooks/useRealTimeData";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from "recharts";
import { BarChart3, ChevronUp, ChevronDown } from "lucide-react";
import { BrandOverlaySkeleton } from "./DashboardSkeleton";

interface BrandOverlayProps {
  selectedBrand: string | null;
  selectedHolding: string | null;
  visible?: boolean;
}

const BrandOverlay = ({ selectedBrand, selectedHolding, visible = true }: BrandOverlayProps) => {
  const [chartsExpanded, setChartsExpanded] = useState(false);

  // 1. RECUPERIAMO LE LISTE COMPLETE (REALI + DEMO)
  const { brands } = useAllBrands();
  const { holdings } = useAllHoldings();
  const { projects, isLoading } = useAllProjects();

  // 2. TROVIAMO L'ENTITÀ SELEZIONATA NELLE LISTE REALI
  const brand = useMemo(() => 
    selectedBrand ? brands.find(b => b.id === selectedBrand) : null
  , [selectedBrand, brands]);

  const holding = useMemo(() => 
    selectedHolding ? holdings.find(h => h.id === selectedHolding) : null
  , [selectedHolding, holdings]);
  
  // Get filtered projects
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

  // Chart data setup
  const energyComparisonData = useMemo(() => {
    return filteredProjects.map(p => ({
      name: p.name.split(' ').slice(-1)[0],
      fullName: p.name,
      hvac: p.data.hvac,
      light: p.data.light,
      total: p.data.total
    }));
  }, [filteredProjects]);

  const airQualityComparisonData = useMemo(() => {
    return filteredProjects.map(p => ({
      name: p.name.split(' ').slice(-1)[0],
      fullName: p.name,
      co2: p.data.co2,
      temp: p.data.temp,
      alerts: p.data.alerts
    }));
  }, [filteredProjects]);

  const radarData = useMemo(() => {
    if (filteredProjects.length === 0) return [];
    const maxEnergy = Math.max(...filteredProjects.map(p => p.data.total)) || 100;
    const maxCo2 = Math.max(...filteredProjects.map(p => p.data.co2)) || 1000;
    
    return [
      { metric: 'Energy', ...Object.fromEntries(filteredProjects.map(p => [p.name.split(' ').slice(-1)[0], (p.data.total / maxEnergy) * 100])) },
      { metric: 'HVAC', ...Object.fromEntries(filteredProjects.map(p => [p.name.split(' ').slice(-1)[0], (p.data.hvac / (maxEnergy * 0.6)) * 100])) },
      { metric: 'Lighting', ...Object.fromEntries(filteredProjects.map(p => [p.name.split(' ').slice(-1)[0], (p.data.light / (maxEnergy * 0.5)) * 100])) },
      { metric: 'CO₂', ...Object.fromEntries(filteredProjects.map(p => [p.name.split(' ').slice(-1)[0], (p.data.co2 / maxCo2) * 100])) },
      { metric: 'Temp', ...Object.fromEntries(filteredProjects.map(p => [p.name.split(' ').slice(-1)[0], (p.data.temp / 30) * 100])) },
    ];
  }, [filteredProjects]);

  const stats = useMemo(() => {
    const totalEnergy = filteredProjects.reduce((sum, p) => sum + p.data.total, 0);
    const avgCo2 = filteredProjects.length 
      ? Math.round(filteredProjects.reduce((sum, p) => sum + p.data.co2, 0) / filteredProjects.length)
      : 0;
    const totalAlerts = filteredProjects.reduce((sum, p) => sum + p.data.alerts, 0);
    
    return { projectCount: filteredProjects.length, totalEnergy, avgCo2, totalAlerts };
  }, [filteredProjects]);
  
  const displayEntity = brand || holding;
  const storeNames = filteredProjects.map(p => p.name.split(' ').slice(-1)[0]);
  const chartColors = ['hsl(188, 100%, 35%)', 'hsl(338, 50%, 50%)', 'hsl(43, 70%, 50%)', 'hsl(160, 60%, 40%)', 'hsl(280, 50%, 50%)'];
  
  if (!displayEntity || !visible) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-20 p-3 md:p-4 pt-16 md:pt-4 pb-20 md:pb-4">
        <BrandOverlaySkeleton />
      </div>
    );
  }

  const showCharts = filteredProjects.length > 1;

  // STILE VETRO SATINATO CHIARO (Opaco e leggibile)
  // bg-white/80 = Bianco all'80% (molto coprente ma luminoso)
  // backdrop-blur-xl = Sfocatura forte dietro
  // border-white/40 = Bordo bianco semitrasparente per definizione
  // shadow-lg = Ombra morbida per stacco
  const glassPanelClass =
  "relative overflow-hidden border border-white/15 bg-black/60 backdrop-blur-2xl shadow-2xl";


  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-20 p-3 md:p-4 pt-16 md:pt-4 pb-20 md:pb-4">
      <div className="flex flex-col lg:flex-row items-center lg:items-start gap-3 md:gap-6 animate-fade-in max-w-6xl w-full max-h-full overflow-y-auto">
        
        {/* Left: Logo & Stats */}
        <div className="flex flex-col items-center gap-3 md:gap-6">
          {/* Brand/Holding Logo Container */}
          <div className="relative pointer-events-auto">
            {/* Glow effect bianco diffuso */}
            <div className="absolute inset-0 bg-white/40 blur-3xl rounded-full scale-110" />
            
            <div className={`relative ${glassPanelClass} rounded-2xl md:rounded-3xl p-4 md:p-6`}>
              {displayEntity.logo ? (
                <img 
                  src={displayEntity.logo} 
                  alt={displayEntity.name}
                  // Rimosso filtro 'invert' per visualizzare i loghi originali su sfondo chiaro
                  className="h-12 md:h-20 w-auto object-contain opacity-90"
                />
              ) : (
                <div className="h-12 md:h-20 w-32 flex items-center justify-center text-slate-800 font-bold text-xl">
                  {displayEntity.name.substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          
          {/* Stats Cards Container */}
          <div className={`${glassPanelClass} rounded-xl md:rounded-2xl p-3 md:p-5 min-w-[220px] md:min-w-[280px] pointer-events-auto`}>
            <div className="text-center mb-2 md:mb-3">
              <h3 className="text-base md:text-lg font-semibold text-foreground">{displayEntity.name}</h3>
              <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider">
                {brand ? 'Brand Overview' : 'Holding Overview'}
              </p>
            </div>
            
            <div className="grid grid-cols-4 md:grid-cols-2 gap-1.5 md:gap-2">
              <div className="text-center p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-white/5 border border-white/10">
                <div className="text-base md:text-xl font-bold text-foreground">{stats.projectCount}</div>
                <div className="text-[8px] md:text-[9px] uppercase text-muted-foreground">Stores</div>
              </div>
              <div className="text-center p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-white/5 border border-white/10">
                <div className="text-base md:text-xl font-bold text-foreground">{stats.totalEnergy}</div>
                <div className="text-[8px] md:text-[9px] uppercase text-muted-foreground">kWh</div>
              </div>
              <div className="text-center p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-white/5 border border-white/10">
                <div className="text-base md:text-xl font-bold text-foreground">{stats.avgCo2}</div>
                <div className="text-[8px] md:text-[9px] uppercase text-muted-foreground">Avg CO₂</div>
              </div>
              <div className="text-center p-1.5 md:p-2.5 rounded-lg md:rounded-xl bg-white/5 border border-white/10">
                <div className={`text-base md:text-xl font-bold ${stats.totalAlerts > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {stats.totalAlerts}
                </div>
                <div className="text-[8px] md:text-[9px] uppercase text-muted-foreground">Alerts</div>
              </div>
            </div>
            
            {showCharts && (
              <button
                onClick={() => setChartsExpanded(!chartsExpanded)}
                className="md:hidden flex items-center justify-center gap-2 w-full py-2 px-3 bg-white/50 hover:bg-white/70 backdrop-blur-md rounded-lg border border-white/30 text-xs font-medium transition-all pointer-events-auto mt-2 text-slate-700"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{chartsExpanded ? 'Nascondi Grafici' : 'Mostra Grafici'}</span>
                {chartsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Comparison Charts */}
        {showCharts && (
          <div className={`flex-1 grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 max-w-3xl pointer-events-auto w-full ${chartsExpanded ? 'grid' : 'hidden'} md:grid`}>
            {/* Energy Comparison */}
            <div className={`${glassPanelClass} rounded-xl md:rounded-2xl p-2.5 md:p-4`}>
              <h4 className="text-xs md:text-sm font-semibold text-foreground mb-2 md:mb-3">Energy Consumption (kWh)</h4>
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
                  <Bar dataKey="light" stackId="a" fill="hsl(338, 50%, 50%)" name="Lighting" radius={[4, 4, 0, 0]} />
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
                  <Bar dataKey="light" stackId="a" fill="hsl(338, 50%, 50%)" name="Lighting" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* CO2 Comparison */}
            <div className={`${glassPanelClass} rounded-xl md:rounded-2xl p-2.5 md:p-4`}>
              <h4 className="text-xs md:text-sm font-semibold text-foreground mb-2 md:mb-3">Air Quality (CO₂ ppm)</h4>
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

            {/* Radar Chart */}
            <div className={`${glassPanelClass} rounded-xl md:rounded-2xl p-2.5 md:p-4 md:col-span-2`}>
              <h4 className="text-xs md:text-sm font-semibold text-foreground mb-2 md:mb-3">Store Performance</h4>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default BrandOverlay;
