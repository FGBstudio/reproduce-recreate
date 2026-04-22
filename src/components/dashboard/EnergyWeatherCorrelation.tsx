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
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
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
  const { chartData, scatterData, hasRealData } = useMemo(() => {
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
       return { chartData: mock, scatterData: mock.map(d => ({ x: d.temp, y: d.energy })), hasRealData: false };
    }

    return { 
      chartData: rawData.map(d => ({
        ...d,
        energy: d.energy_kwh,
        temp: d.temp_c,
        humidity: d.humidity_pct,
      })),
      scatterData: rawData.map(d => ({ x: d.temp_c, y: d.energy_kwh })),
      hasRealData: true 
    };
  }, [rawData]);

  const stats = (insightData as any)?.metadata || {};
  const correlationValue = (insightData as any)?.value;
  const dbInsight = stats.insight || "Correlation analysis completed. Waiting for trend stabilization.";
  
  // Dynamic Correlation & Insights (Local calculation for real-time timeframe updates)
  const dynamicStats = useMemo(() => {
    if (scatterData.length < 5) {
       return { 
         r: correlationValue || 0, 
         insight: dbInsight 
       };
    }

    const n = scatterData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (const p of scatterData) {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumX2 += p.x * p.x;
      sumY2 += p.y * p.y;
    }

    const num = (n * sumXY - sumX * sumY);
    const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    const r = den === 0 ? 0 : num / den;
    const absR = Math.abs(r);

    const dynamicInsight = 
      absR > 0.7 ? "Critical Thermal Coupling: Consumption is locked to outdoor temperature." :
      absR > 0.4 ? "High Weather Sensitivity: Significant HVAC influence detected." :
      absR > 0.1 ? "Moderate Influence: Weather contributes to peak loads." :
      "Low Thermal Impact: Site loads are independent of weather.";

    return { r, insight: dynamicInsight };
  }, [scatterData, correlationValue, dbInsight, hasRealData]);

  // Regression line calculation points (Calculated LOCALLY for speed and reliability)
  const regressionLine = useMemo(() => {
    if (scatterData.length < 2) return [];

    const n = scatterData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (const p of scatterData) {
      sumX += p.x;
      sumY += p.y;
      sumXY += p.x * p.y;
      sumX2 += p.x * p.x;
    }

    const denominator = (n * sumX2 - sumX * sumX);
    if (denominator === 0) return []; // Vertical line or identical points

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    
    const minX = Math.min(...scatterData.map(d => d.x));
    const maxX = Math.max(...scatterData.map(d => d.x));
    
    return [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept }
    ];
  }, [scatterData]);

  const displayCorrelation = useMemo(() => {
    return `${Math.round(Math.abs(dynamicStats.r) * 100)}%`;
  }, [dynamicStats.r]);

  const insightText = dynamicStats.insight;

  if (loadingData || loadingInsight) {
    return (
      <div className="w-full h-full p-8 bg-white glass-card rounded-2xl border border-gray-100 flex flex-col justify-center gap-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

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
           <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50/50 border border-emerald-100 rounded-full ml-2">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] font-bold text-emerald-700">Correlation: {displayCorrelation}</span>
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
        <ResponsiveContainer width="100%" height="100%">
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
              <ZAxis type="number" dataKey="z" range={[10, 1000]} />
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
                data={rawData?.map(d => ({ 
                  x: d.temp_c, 
                  y: d.energy_kwh, 
                  z: Math.pow(d.humidity_pct || 50, 1.5),
                  humidity: d.humidity_pct || 50
                }))} 
                fill="#10b981" 
                fillOpacity={0.4} 
              />
              {regressionLine.length > 0 && (
                <Scatter
                  name="Thermal Sensitivity Profile"
                  data={regressionLine}
                  fill="#ef4444"
                  line={{ stroke: '#ef4444', strokeWidth: 4 }}
                  shape={() => null}
                  legendType="line"
                />
              )}
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </ScatterChart>
          )}
        </ResponsiveContainer>
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
