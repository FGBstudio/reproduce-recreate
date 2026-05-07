import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ZoomableChart,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  ReferenceLine
} from 'recharts';
import { Thermometer, Zap, Info, Droplets, Activity, BarChart2, TrendingUp, Grid } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { TimePeriod, DateRange } from '@/hooks/useTimeFilteredData';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';

interface CorrelationPoint {
  ts: string;
  energy_kwh: number;
  temp_c: number;
  humidity_pct: number;
}

interface CorrelationProps {
  siteId: string;
  timePeriod: TimePeriod;
  dateRange?: DateRange;
}

const EnergyWeatherCorrelation = ({ siteId, timePeriod, dateRange }: CorrelationProps) => {
  const [viewMode, setViewMode] = useState<'timeseries' | 'scatter'>('timeseries');

  // 1. Resolve Time Range
  const timeRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;
    switch (timePeriod) {
      case "today": start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
      case "week": start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000); break;
      case "month": start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000); break;
      case "year": start = new Date(now.getFullYear(), 0, 1); break;
      case "custom": start = dateRange?.from || new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000); end = dateRange?.to || now; break;
      default: start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    }
    return { start, end };
  }, [timePeriod, dateRange]);

  // 2. Fetch Timeseries Data
  const { data: rawData, isLoading: loadingData } = useQuery({
    queryKey: ['energy-weather-timeseries', siteId, timePeriod, dateRange?.from?.getTime()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_energy_weather_correlation_data' as any, {
        p_site_id: siteId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString()
      });
      if (error) throw error;
      return data as any as CorrelationPoint[];
    },
    enabled: !!siteId
  });

  // 3. Fetch KPI Summary (Correlation Score & Regression Stats)
  const { data: insightDataRaw, isLoading: loadingInsight } = useQuery({
    queryKey: ['energy-weather-insight', siteId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('site_kpis') as any)
        .select('*')
        .eq('site_id', siteId)
        .eq('metric', 'energy.temp_correlation')
        .eq('period', 'daily')
        .order('ts', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!siteId
  });

  const insightData = insightDataRaw as any;

  // 4. Data Processing
  // 4. Data Cleansing & Formatting (Combined Flow)
  const { chartData, validPoints, hasRealData } = useMemo(() => {
    if (!rawData || rawData.length === 0) {
       const mock = Array.from({ length: 48 }, (_, i) => {
         const t = 15 + Math.sin(i / 10) * 10 + Math.random() * 2;
         return {
           ts: new Date(Date.now() - i * 3600000).toISOString(),
           energy: 5 + (t * 0.4) + Math.random() * 3,
           temp: t,
           humidity: 50 + Math.cos(i / 10) * 20 + Math.random() * 5,
         };
       }).reverse();
       
       return { 
         chartData: mock, 
         validPoints: mock.map(d => ({ temp: d.temp, energy: d.energy, humidity: d.humidity })), 
         hasRealData: false 
       };
    }

    const cleaned = rawData.map(d => {
      const anyD = d as any;
      return {
        ...d,
        timestamp: anyD.timestamp || anyD.ts_bucket || d.ts || anyD.ts,
        energy: d.energy_kwh,
        temp: d.temp_c,
        humidity: d.humidity_pct || 50
      };
    });

    return { 
      chartData: cleaned,
      validPoints: cleaned.map(d => ({ temp: d.temp, energy: d.energy, humidity: d.humidity })),
      hasRealData: true 
    };
  }, [rawData]);

  const dbInsightMetadata = (insightData as any)?.metadata || {};
  // --- MULTIVARIATE ANALYTICS ENGINE (R²) ---
  const stats = useMemo(() => {
    if (!validPoints.length || validPoints.length < 5) return null;

    const n = validPoints.length;
    let sumT = 0, sumH = 0, sumE = 0;
    let sumT2 = 0, sumH2 = 0, sumTH = 0;
    let sumTE = 0, sumHE = 0;

    validPoints.forEach(p => {
      const t = p.temp;
      const h = p.humidity;
      const e = p.energy;
      sumT += t; sumH += h; sumE += e;
      sumT2 += t * t; sumH2 += h * h; sumTH += t * h;
      sumTE += t * e; sumHE += h * e;
    });

    const det = (
      n * (sumT2 * sumH2 - sumTH * sumTH) -
      sumT * (sumT * sumH2 - sumTH * sumH) +
      sumH * (sumT * sumTH - sumT2 * sumH)
    );

    if (Math.abs(det) < 1e-10) return null;

    const b0 = (sumE * (sumT2 * sumH2 - sumTH * sumTH) - sumT * (sumTE * sumH2 - sumTH * sumHE) + sumH * (sumTE * sumTH - sumT2 * sumHE)) / det;
    const b1 = (n * (sumTE * sumH2 - sumTH * sumHE) - sumE * (sumT * sumH2 - sumTH * sumH) + sumH * (sumT * sumHE - sumTE * sumH)) / det;
    const b2 = (n * (sumT2 * sumHE - sumTE * sumTH) - sumT * (sumT * sumHE - sumTE * sumH) + sumE * (sumT * sumTH - sumT2 * sumH)) / det;

    const meanE = sumE / n;
    let ssRes = 0, ssTot = 0;
    validPoints.forEach(p => {
      const predictedE = b0 + b1 * p.temp + b2 * p.humidity;
      ssRes += Math.pow(p.energy - predictedE, 2);
      ssTot += Math.pow(p.energy - meanE, 2);
    });

    const r2 = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 0;
    const correlation = Math.sqrt(r2);
    const avgH = sumH / n;
    const slope = b1;
    const intercept = b0 + (b2 * avgH);

    const minX = Math.min(...validPoints.map(p => p.temp));
    const maxX = Math.max(...validPoints.map(p => p.temp));

    return {
      correlation,
      r2,
      regressionLine: [
        { x: minX, y: intercept + slope * minX },
        { x: maxX, y: intercept + slope * maxX }
      ]
    };
  }, [validPoints]);

  const displayCorrelation = useMemo(() => {
    if (!stats) return "N/A";
    return `${Math.round(stats.correlation * 100)}%`;
  }, [stats]);

  const insightText = useMemo(() => {
    if (!stats) return "Not enough data for weather analysis.";
    const absR = stats.correlation;
    if (absR > 0.8) return "Critical Weather Coupling: Site consumption is extremely sensitive to heat and humidity.";
    if (absR > 0.6) return "High Weather Sensitivity: HVAC loads are a primary driver of energy peaks.";
    if (absR > 0.3) return "Moderate Weather Sensitivity: Environmental factors impact performance significantly.";
    return "Low Weather Sensitivity: Building loads appear resilient to external weather variations.";
  }, [stats]);

  if (loadingData || loadingInsight) {
    return (
      <div className="w-full h-full p-8 bg-white glass-card rounded-2xl border border-gray-100 flex flex-col justify-center gap-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  const getHumidityColor = (hum: number) => {
    if (hum > 80) return "#0f766e"; // Darkest Teal
    if (hum > 60) return "#0d9488"; // Deep Teal
    if (hum > 40) return "#14b8a6"; // Medium Teal
    if (hum > 20) return "#5eead4"; // Light Teal
    return "#ccfbf1"; // Faint Teal
  };

  return (
    <div className="flex flex-col h-full group">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
           <div className="p-2 bg-emerald-50 rounded-lg">
             <TrendingUp className="w-5 h-5 text-emerald-600" />
           </div>
           <div>
             <h3 className="text-lg font-bold text-gray-900 leading-tight">Energy Weather Analytics</h3>
             <p className="text-xs text-gray-500 font-medium">Power consumption vs. outdoor intensity</p>
           </div>
           <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50/50 border border-emerald-100 rounded-full ml-2 relative group/info">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] font-bold text-emerald-700">Combined Correlation (R): {displayCorrelation}</span>
              <div className="ml-1 cursor-help">
                <Info className="w-3 h-3 text-emerald-400 hover:text-emerald-600 transition-colors" />
              </div>
              <div className="absolute left-0 top-8 w-64 p-3 bg-slate-900 text-white text-[10px] rounded-xl shadow-2xl opacity-0 group-hover/info:opacity-100 transition-opacity z-50 pointer-events-none border border-slate-700">
                <p className="font-bold mb-1 border-b border-slate-700 pb-1 text-emerald-400 uppercase tracking-wider">WEATHER SENSITIVITY LOGIC</p>
                <p className="leading-relaxed opacity-90 text-[9px]">
                  Site performance is modeled using Multiple Linear Regression: 
                  <span className="block font-mono mt-1 text-emerald-400">Energy = β₀ + β₁·T + β₂·H</span>
                  The R-score represents the percentage of energy fluctuations **explained by** the combined impact of heat and humidity.
                </p>
              </div>
           </div>
        </div>
        
        <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-xl border border-gray-200">
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-7 px-2.5 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all ${viewMode === 'timeseries' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setViewMode('timeseries')}
          >
            <BarChart2 className="w-3.5 h-3.5 mr-1.5" />
            Timeline
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-7 px-2.5 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all ${viewMode === 'scatter' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setViewMode('scatter')}
          >
            <Grid className="w-3.5 h-3.5 mr-1.5" />
            Scatter
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-[300px] w-full bg-white/30 rounded-2xl border border-gray-100/50 p-2">
        <ZoomableChart width="100%" height="100%">
          {viewMode === 'timeseries' ? (
            <ComposedChart data={chartData} margin={{ top: 10, right: 60, bottom: 20, left: 10 }}>
              <defs>
                <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="ts" 
                tickFormatter={(str) => {
                  const date = parseISO(str);
                  return timePeriod === 'today' ? format(date, 'HH:mm') : format(date, 'dd/MM HH:mm');
                }}
                stroke="#94a3b8"
                fontSize={10}
                tick={{ fill: '#94a3b8' }}
              />
              <YAxis 
                yAxisId="left" 
                tick={{ fontSize: 10, fill: '#64748b' }}
                label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 10 } }}
                stroke="#e2e8f0"
              />
              <YAxis 
                yAxisId="temp" 
                orientation="right" 
                tick={{ fontSize: 10, fill: '#f59e0b' }}
                label={{ value: '°C', angle: 90, position: 'insideRight', style: { fill: '#f59e0b', fontSize: 10 } }}
                stroke="#e2e8f0"
              />
              <YAxis 
                yAxisId="percent" 
                orientation="right" 
                dx={35}
                tick={{ fontSize: 10, fill: '#0ea5e9' }}
                label={{ value: '%', angle: 90, position: 'insideRight', style: { fill: '#0ea5e9', fontSize: 10 } }}
                stroke="#e2e8f0"
              />
              
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', backgroundColor: 'rgba(255,255,255,0.95)' }}
                labelFormatter={(val) => format(parseISO(val), 'PPP p')}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
              
              <Area 
                yAxisId="left"
                type="monotone" 
                dataKey="energy" 
                name="Energy (kWh)" 
                stroke="#10b981" 
                strokeWidth={3}
                fill="url(#colorEnergy)"
                dot={false}
              />
              <Line yAxisId="temp" type="monotone" dataKey="temp" name="Temp (°C)" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
              <Line yAxisId="percent" type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="3 3" dot={false} />
            </ComposedChart>
          ) : (
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                type="number" 
                dataKey="x" 
                name="Temperature" 
                unit="°C" 
                stroke="#94a3b8" 
                fontSize={10} 
                domain={['auto', 'auto']}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name="Energy" 
                unit="kWh" 
                stroke="#94a3b8" 
                fontSize={10} 
              />
              <ZAxis type="number" dataKey="z" range={[25, 25]} />
              <Tooltip 
                cursor={{ strokeDasharray: '3 3' }} 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white/95 backdrop-blur-md p-3 border border-gray-100 shadow-xl rounded-xl">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider">Meteorological Data</p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between gap-8">
                            <span className="text-xs text-gray-500">Temperature</span>
                            <span className="text-xs font-bold text-gray-900">{data.x.toFixed(1)}°C</span>
                          </div>
                          <div className="flex justify-between gap-8">
                            <span className="text-xs text-gray-500">Energy Load</span>
                            <span className="text-xs font-bold text-gray-900">{data.y.toFixed(2)} kWh</span>
                          </div>
                          <div className="flex justify-between gap-8 border-t border-gray-50 pt-1.5 mt-1.5">
                            <span className="text-xs text-gray-500">Humidity</span>
                            <span className="text-xs font-bold text-emerald-600">{data.humidity.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter 
                name="Weather Observations" 
                data={validPoints.map(p => ({ 
                  x: p.temp, 
                  y: p.energy, 
                  z: 25,
                  humidity: p.humidity,
                  color: getHumidityColor(p.humidity)
                }))} 
                fill="#14b8a6"
              >
                {validPoints.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getHumidityColor(entry.humidity)} 
                    fillOpacity={0.6} 
                  />
                ))}
              </Scatter>
              {stats?.regressionLine && (
                <Scatter
                  name="Thermal Sensitivity Profile"
                  data={stats.regressionLine}
                  fill="#ef4444"
                  line={{ stroke: '#ef4444', strokeWidth: 4 }}
                  shape={() => null}
                  legendType="line"
                />
              )}
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </ScatterChart>
          )}
        </ZoomableChart>
      </div>

      <div className="mt-4 p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 flex items-center gap-4 transition-all hover:bg-emerald-50/50">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-emerald-100">
           <Zap className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600/60">Thermal Sensitivity Insight</p>
          <p className="text-sm font-semibold text-gray-700 italic">"{insightText}"</p>
        </div>
        {!hasRealData && (
          <span className="px-2 py-0.5 bg-gray-200 text-[9px] font-black text-gray-500 rounded-md uppercase">Demo</span>
        )}
      </div>
    </div>
  );
};

export default EnergyWeatherCorrelation;
