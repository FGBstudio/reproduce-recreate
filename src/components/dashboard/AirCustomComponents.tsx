import React from 'react';
import { Wind, Activity, Thermometer, Droplets, Cloud, Gauge, Sparkles, ChevronUp, ChevronDown, Info } from 'lucide-react';

/**
 * AIR QUALITY CUSTOM COMPONENTS
 * 
 * This file contains the "Building Overview" (Monitors Grid) and "Heatmap" sections
 * extracted from the ProjectDetail dashboard.
 */

// --- HELPERS (Copy these to your main file or keep here) ---

const getAqColor = (aq: string | number) => {
  if (typeof aq === 'string') {
    const upper = aq.toUpperCase();
    if (upper === "EXCELLENT" || upper === "GOOD") return "text-emerald-500 dark:text-emerald-400";
    if (upper === "MODERATE" || upper === "MEDIUM") return "text-yellow-500 dark:text-yellow-400";
    if (upper === "POOR" || upper === "CRITICAL") return "text-red-500 dark:text-red-400";
  }
  const val = typeof aq === 'string' ? parseInt(aq) : (aq || 0);
  if (isNaN(val)) return "text-gray-400";
  if (val <= 50) return "text-emerald-500 dark:text-emerald-400";
  if (val <= 100) return "text-yellow-500 dark:text-yellow-400";
  return "text-red-500 dark:text-red-400";
};

const getAqBgColor = (aq: string | number) => {
  if (typeof aq === 'string') {
    const upper = aq.toUpperCase();
    if (upper === "EXCELLENT" || upper === "GOOD") return "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20";
    if (upper === "MODERATE" || upper === "MEDIUM") return "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-100 dark:border-yellow-500/20";
    if (upper === "POOR" || upper === "CRITICAL") return "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20";
  }
  const val = typeof aq === 'string' ? parseInt(aq) : (aq || 0);
  if (isNaN(val)) return "bg-gray-50 dark:bg-gray-500/10 border-gray-100 dark:border-gray-500/20";
  if (val <= 50) return "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20";
  if (val <= 100) return "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-100 dark:border-yellow-500/20";
  return "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20";
};

const getHeatmapColor = (value: number, scale: { min: number, max: number }) => {
  if (value === 0) return 'rgba(243, 244, 246, 0.5)'; // bg-gray-100
  const ratio = (value - scale.min) / (scale.max - scale.min || 1);
  // FGB Style Heatmap: Emerald -> Yellow -> Red
  if (ratio < 0.33) return `rgba(16, 185, 129, ${0.2 + ratio * 2})`; // Emerald
  if (ratio < 0.66) return `rgba(245, 158, 11, ${0.4 + (ratio - 0.33) * 1.5})`; // Amber
  return `rgba(239, 68, 68, ${0.5 + (ratio - 0.66) * 1.5})`; // Red
};

// --- COMPONENTS ---

/**
 * BUILDING OVERVIEW (Monitors Grid)
 * This is the table view of all individual air monitors.
 */
const METRICS_CONFIG: Record<string, any> = {
  'iaq.co2': { 
    unit: 'ppm',
    min: 400,
    max: 1200, 
    getColor: (v: number) => v <= 800 ? 'bg-emerald-500' : v <= 1000 ? 'bg-yellow-400' : 'bg-red-500',
    legend: { green: '≤ 800', yellow: '801 - 1000', red: '> 1000' }
  },
  'iaq.voc': { 
    unit: 'ppb',
    min: 0,
    max: 1000, 
    getColor: (v: number) => v <= 300 ? 'bg-emerald-500' : v <= 500 ? 'bg-yellow-400' : 'bg-red-500',
    legend: { green: '≤ 300', yellow: '301 - 500', red: '> 500' }
  },
  'iaq.pm25': { 
    unit: 'µg/m³',
    min: 0,
    max: 50, 
    getColor: (v: number) => v <= 15 ? 'bg-emerald-500' : v <= 35 ? 'bg-yellow-400' : 'bg-red-500',
    legend: { green: '≤ 15', yellow: '16 - 35', red: '> 35' }
  },
  'iaq.pm10': { 
    unit: 'µg/m³',
    min: 0,
    max: 100, 
    getColor: (v: number) => v <= 25 ? 'bg-emerald-500' : v <= 50 ? 'bg-yellow-400' : 'bg-red-500',
    legend: { green: '≤ 25', yellow: '26 - 50', red: '> 50' }
  },
  'iaq.co': { 
    unit: 'ppm',
    min: 0,
    max: 15, 
    getColor: (v: number) => v <= 4 ? 'bg-emerald-500' : v <= 9 ? 'bg-yellow-400' : 'bg-red-500',
    legend: { green: '≤ 4', yellow: '5 - 9', red: '> 9' }
  },
  'iaq.o3': { 
    unit: 'ppb',
    min: 0,
    max: 200, 
    getColor: (v: number) => v <= 50 ? 'bg-emerald-500' : v <= 100 ? 'bg-yellow-400' : 'bg-red-500',
    legend: { green: '≤ 50', yellow: '51 - 100', red: '> 100' }
  },
  'env.temperature': { 
    unit: '°C',
    min: 15,
    max: 30, 
    getColor: (v: number) => (v >= 20 && v <= 25) ? 'bg-emerald-500' : ((v >= 18 && v < 20) || (v > 25 && v <= 27)) ? 'bg-yellow-400' : 'bg-red-500',
    legend: { green: '20 - 25', yellow: '18-19, 26-27', red: '< 18 or > 27' }
  },
  'env.humidity': { 
    unit: '%',
    min: 20,
    max: 80, 
    getColor: (v: number) => (v >= 40 && v <= 60) ? 'bg-emerald-500' : ((v >= 35 && v < 40) || (v > 60 && v <= 65)) ? 'bg-yellow-400' : 'bg-red-500',
    legend: { green: '40 - 60', yellow: '35-39, 61-65', red: '< 35 or > 65' }
  },
};

export const BuildingOverview = ({ 
  selectedAirDevices, 
  deviceAverages,
  airDeviceLabelById,
  airCardClass,
  t
}: any) => {

  return (
    <div className={`${airCardClass} h-full flex flex-col`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base md:text-lg font-bold text-gray-800 tracking-tight">Building overview</h3>
        </div>
        
        {/* Aesthetic Legend Block */}
        <div className="flex gap-4 items-center bg-gray-50/80 px-4 py-2 rounded-xl border border-gray-100 text-[10px] uppercase font-bold text-gray-500 shadow-sm border-b-2">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div> Optimal</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-400 shadow-sm"></div> Moderate</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></div> Poor</div>
          
          <div className="relative group flex items-center ml-2 pl-4 border-l border-gray-200">
             <Info className="w-4 h-4 text-teal-600 hover:text-teal-700 cursor-help transition-colors" />
             {/* Tooltip */}
             <div className="absolute right-0 top-full mt-2 w-[340px] p-4 bg-gray-900 rounded-xl text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl">
               <div className="font-bold text-sm mb-3 border-b border-gray-700 pb-2 text-gray-100">Threshold Reference Logic</div>
               <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">
                 <div className="col-span-1">Metric</div>
                 <div className="text-emerald-400">Optimal</div>
                 <div className="text-yellow-400">Moderate</div>
                 <div className="text-red-400">Poor</div>
               </div>
               <div className="flex flex-col gap-2">
                 {Object.entries(METRICS_CONFIG).map(([key, info]) => (
                   <div key={key} className="grid grid-cols-4 gap-2 items-center border-t border-gray-800 pt-2">
                     <div className="col-span-1 font-semibold text-gray-200">{key.replace('iaq.', '').replace('env.', '')}</div>
                     <div className="text-gray-300">{info.legend.green}</div>
                     <div className="text-gray-300">{info.legend.yellow}</div>
                     <div className="text-gray-300">{info.legend.red}</div>
                   </div>
                 ))}
               </div>
             </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto custom-scrollbar bg-white rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-left border-collapse min-w-[900px] table-fixed">
          <thead>
            <tr className="border-b-2 border-gray-100/60 bg-gray-50/50">
              <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap w-[220px]">Device Name</th>
              <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">°C Temp</th>
              <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">% Hum</th>
              <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">CO₂</th>
              <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">TVOC</th>
              <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">PM2.5</th>
              <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">PM10</th>
              <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">CO PPM</th>
              <th className="py-4 px-5 text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">O₃ PPB</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {selectedAirDevices.map((device: any) => {
              const avg = deviceAverages[device.device_id] || deviceAverages[device.id] || {};

              const renderCell = (metric: string) => {
                const val = avg[metric];
                const config = METRICS_CONFIG[metric];
                
                // Aesthetic Placeholder for null/missing values
                if (val === undefined || val === null) {
                  return (
                    <div className="flex flex-col gap-1.5 w-full pr-5 opacity-40">
                      <div className="flex justify-between items-end">
                        <span className="text-[13px] font-medium text-gray-400">—</span>
                        <span className="text-[9px] font-semibold text-gray-300 tracking-widest">{config.unit}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden"></div>
                    </div>
                  );
                }
                
                const colorClass = config.getColor(val);
                const min = config.min;
                const range = config.max - min;
                const percent = Math.max(0, Math.min(100, ((val - min) / range) * 100));

                return (
                  <div className="flex flex-col gap-1.5 w-full pr-5">
                    <div className="flex justify-between items-end">
                      <span className="text-[13px] font-bold text-gray-700">{val.toFixed(1)}</span>
                      <span className="text-[9px] font-semibold text-gray-400 tracking-widest">{config.unit}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${colorClass}`} style={{ width: `${percent}%`, minWidth: percent > 0 ? '4px' : '0' }}></div>
                    </div>
                  </div>
                );
              };

              return (
                <tr key={device.id} className="hover:bg-teal-50/30 transition-colors group">
                  <td className="py-4 px-5 font-semibold text-teal-800 border-r border-gray-50/50 overflow-hidden">
                    <div className="text-sm truncate w-full">{airDeviceLabelById.get(device.id)}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium mt-0.5 truncate w-full">{device.device_id}</div>
                  </td>
                  <td className="py-4 pl-5">{renderCell('env.temperature')}</td>
                  <td className="py-4 pl-5">{renderCell('env.humidity')}</td>
                  <td className="py-4 pl-5">{renderCell('iaq.co2')}</td>
                  <td className="py-4 pl-5">{renderCell('iaq.voc')}</td>
                  <td className="py-4 pl-5">{renderCell('iaq.pm25')}</td>
                  <td className="py-4 pl-5">{renderCell('iaq.pm10')}</td>
                  <td className="py-4 pl-5">{renderCell('iaq.co')}</td>
                  <td className="py-4 pl-5">{renderCell('iaq.o3')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/**
 * AIR QUALITY HEATMAP
 * This is the grid showing CO2 or TVOC trends across hours/days.
 */
export const AirHeatmap = ({ 
  heatmapGrid, 
  heatmapLegendColors,
  heatmapRef,
  airCardClass
}: any) => {
  // Use the helper for colors
  const getColor = (val: number, scale: any) => getHeatmapColor(val, scale);

  return (
    <div ref={heatmapRef} className={`${airCardClass} flex flex-col`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base md:text-lg font-bold text-gray-800">
          Air Quality Heatmap
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <span>Low</span>
            <div className="flex gap-0.5">
              {heatmapLegendColors.map((c: string) => (
                <div key={c} className="w-2 h-2 rounded-sm" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span>High</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-2 custom-scrollbar">
        <div className="min-w-max">
          <div className="flex">
            <div className="w-12 flex-shrink-0 flex items-end justify-center pb-2 text-[10px] font-bold text-gray-400">
                {heatmapGrid.isYearView ? 'GG' : 'HH'}
            </div>
            {heatmapGrid.cols.map((col: any) => (
                <div key={col.key} className="flex-1 min-w-[24px] text-center text-[10px] font-semibold text-gray-500 pb-1">
                    {col.label}
                </div>
            ))}
          </div>

          {heatmapGrid.rows.map((row: any) => (
              <div key={row} className="flex items-center h-6 mb-0.5">
                  <div className="w-12 flex-shrink-0 text-[10px] text-gray-400 text-right pr-2">
                      {heatmapGrid.isYearView 
                        ? row 
                        : `${String(row).padStart(2, '0')}:00` 
                      }
                  </div>
                  
                  {heatmapGrid.cols.map((col: any) => {
                      const val = heatmapGrid.valueMap.get(`${row}_${col.key}`) || 0;
                      return (
                          <div 
                            key={`${row}-${col.key}`} 
                            className="flex-1 min-w-[24px] h-full mx-[1px] rounded-sm transition-all hover:opacity-80 hover:scale-110 cursor-pointer relative group"
                            style={{ backgroundColor: getColor(val, heatmapGrid.scale) }}
                          >
                            {val > 0 && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none shadow-lg">
                                    <div className="font-bold">
                                        {heatmapGrid.isYearView ? `${row} ${col.label}` : `${col.label} ${row}:00`}
                                    </div>
                                    <div>{val.toFixed(1)}</div>
                                </div>
                            )}
                          </div>
                      );
                  })}
              </div>
          ))}
        </div>
      </div>
    </div>
  );
};
