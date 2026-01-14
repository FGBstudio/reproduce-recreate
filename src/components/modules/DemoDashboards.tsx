import { ReactNode, useMemo, useRef } from 'react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { Lightbulb, Droplet, Wind } from 'lucide-react';
import { ModuleConfig, ModuleType } from '@/lib/types/admin';
import { ModuleGate } from '@/components/modules/ModuleGate';
import { DemoBadge } from '@/components/modules/DemoBadge';
import {
  demoEnergyConsumption,
  demoEnergyDistribution,
  demoCO2History,
  demoTVOCHistory,
  demoTempHumidity,
  demoWaterConsumption,
  demoWaterDistribution,
} from '@/lib/data/demoData';

// Shared chart styles
const axisStyle = {
  fontSize: 11,
  fontFamily: "'Montserrat', sans-serif",
  fill: '#64748b',
  fontWeight: 500
};

const gridStyle = {
  strokeDasharray: "4 4",
  stroke: "#e2e8f0"
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    border: 'none',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    padding: '12px 16px',
    fontFamily: "'Montserrat', sans-serif"
  },
  itemStyle: { color: '#334155', fontWeight: 500 },
  labelStyle: { color: '#64748b', fontWeight: 600, marginBottom: 4 }
};

interface DemoDashboardProps {
  module: ModuleType;
}

// Energy Demo Dashboard
export const EnergyDemoContent = () => (
  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
    {/* Demo Energy Chart */}
    <div className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
      <div className="flex justify-between items-center mb-3 md:mb-4">
        <div>
          <h3 className="text-base md:text-lg font-bold text-gray-800">Consumo Energetico</h3>
          <p className="text-[10px] md:text-xs text-gray-500">Dati demo - Confronto con previsione e media</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={demoEnergyConsumption} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="demoEnergyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(188, 100%, 35%)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="hsl(188, 100%, 35%)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 9 }} />
          <YAxis tick={{ ...axisStyle, fontSize: 9 }} width={35} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 9, fontWeight: 500, paddingTop: 5 }} />
          <Area type="monotone" dataKey="actual" stroke="hsl(188, 100%, 35%)" strokeWidth={2} fill="url(#demoEnergyGradient)" name="Attuale" />
          <Line type="monotone" dataKey="expected" stroke="hsl(150, 60%, 45%)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Previsto" />
        </AreaChart>
      </ResponsiveContainer>
    </div>

    {/* Demo Distribution */}
    <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
      <h3 className="text-base md:text-lg font-bold text-gray-800 mb-3">Distribuzione Consumo</h3>
      <div className="flex items-center gap-4">
        <div className="space-y-2 flex-1">
          {demoEnergyDistribution.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-gray-600">{item.name}</span>
              <span className="text-xs font-semibold text-gray-800 ml-auto">{item.value}%</span>
            </div>
          ))}
        </div>
        <div className="relative w-28 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={demoEnergyDistribution} innerRadius="55%" outerRadius="80%" paddingAngle={2} dataKey="value">
                {demoEnergyDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Lightbulb className="w-5 h-5 text-fgb-secondary mb-1" />
            <span className="text-[10px] text-gray-500">Demo</span>
          </div>
        </div>
      </div>
    </div>

    {/* Demo KPIs */}
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
        <p className="text-[10px] text-gray-500 mb-0.5">Consumo Totale</p>
        <p className="text-xl font-bold text-fgb-secondary">85</p>
        <p className="text-[9px] text-gray-500">kWh/m² / anno</p>
      </div>
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
        <p className="text-[10px] text-gray-500 mb-0.5">Efficienza</p>
        <p className="text-xl font-bold text-emerald-500">82%</p>
        <p className="text-[9px] text-gray-500">rating</p>
      </div>
    </div>
  </div>
);

// Air Quality Demo Dashboard
export const AirDemoContent = () => (
  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
    {/* Demo CO2 Chart */}
    <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
      <div className="mb-3">
        <h3 className="text-base md:text-lg font-bold text-gray-800">CO₂ Trend</h3>
        <p className="text-[10px] md:text-xs text-gray-500">Dati demo</p>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={demoCO2History} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="demoCo2Gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(188, 100%, 35%)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="hsl(188, 100%, 35%)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="time" tick={{ ...axisStyle, fontSize: 9 }} />
          <YAxis tick={{ ...axisStyle, fontSize: 9 }} />
          <Tooltip {...tooltipStyle} />
          <Area type="monotone" dataKey="co2" stroke="hsl(188, 100%, 35%)" fill="url(#demoCo2Gradient)" name="CO₂ (ppm)" />
          <Line type="monotone" dataKey="limit" stroke="#ef4444" strokeDasharray="5 5" dot={false} name="Limite" />
        </AreaChart>
      </ResponsiveContainer>
    </div>

    {/* Demo Temp/Humidity */}
    <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
      <div className="mb-3">
        <h3 className="text-base md:text-lg font-bold text-gray-800">Temperatura & Umidità</h3>
        <p className="text-[10px] md:text-xs text-gray-500">Dati demo</p>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={demoTempHumidity} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="time" tick={{ ...axisStyle, fontSize: 9 }} />
          <YAxis tick={{ ...axisStyle, fontSize: 9 }} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 9 }} />
          <Line type="monotone" dataKey="temp" stroke="hsl(188, 100%, 35%)" name="Temp °C" />
          <Line type="monotone" dataKey="humidity" stroke="hsl(338, 50%, 45%)" name="Umidità %" />
        </LineChart>
      </ResponsiveContainer>
    </div>

    {/* Demo KPIs */}
    <div className="lg:col-span-2 grid grid-cols-4 gap-2">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
        <p className="text-xl font-bold text-emerald-500">GOOD</p>
        <p className="text-[10px] text-gray-500">Air Quality</p>
      </div>
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
        <p className="text-xl font-bold text-fgb-secondary">450</p>
        <p className="text-[10px] text-gray-500">CO₂ ppm</p>
      </div>
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
        <p className="text-xl font-bold text-gray-700">22°</p>
        <p className="text-[10px] text-gray-500">Temperatura</p>
      </div>
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
        <p className="text-xl font-bold text-gray-700">45%</p>
        <p className="text-[10px] text-gray-500">Umidità</p>
      </div>
    </div>
  </div>
);

// Water Demo Dashboard
export const WaterDemoContent = () => (
  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
    {/* Demo Water Consumption */}
    <div className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
      <div className="mb-3">
        <h3 className="text-base md:text-lg font-bold text-gray-800">Consumo Idrico</h3>
        <p className="text-[10px] md:text-xs text-gray-500">Dati demo - Confronto con target</p>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={demoWaterConsumption} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="demoWaterGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(200, 80%, 50%)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="hsl(200, 80%, 50%)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="month" tick={{ ...axisStyle, fontSize: 9 }} />
          <YAxis tick={{ ...axisStyle, fontSize: 9 }} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 9 }} />
          <Area type="monotone" dataKey="consumption" stroke="hsl(200, 80%, 50%)" fill="url(#demoWaterGradient)" name="Consumo" />
          <Line type="monotone" dataKey="target" stroke="hsl(150, 60%, 45%)" strokeDasharray="5 5" dot={false} name="Target" />
        </AreaChart>
      </ResponsiveContainer>
    </div>

    {/* Demo Distribution */}
    <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
      <h3 className="text-base md:text-lg font-bold text-gray-800 mb-3">Distribuzione</h3>
      <div className="flex items-center gap-4">
        <div className="space-y-2 flex-1">
          {demoWaterDistribution.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-gray-600">{item.name}</span>
              <span className="text-xs font-semibold text-gray-800 ml-auto">{item.value}%</span>
            </div>
          ))}
        </div>
        <div className="relative w-24 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={demoWaterDistribution} innerRadius="50%" outerRadius="80%" paddingAngle={2} dataKey="value">
                {demoWaterDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <Droplet className="w-5 h-5 text-blue-500" />
          </div>
        </div>
      </div>
    </div>

    {/* Demo KPIs */}
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
        <p className="text-xl font-bold text-blue-500">1,450</p>
        <p className="text-[10px] text-gray-500">m³ / mese</p>
      </div>
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
        <p className="text-xl font-bold text-emerald-500">78%</p>
        <p className="text-[10px] text-gray-500">Efficienza</p>
      </div>
    </div>
  </div>
);

// Map module to demo content
export const getDemoContent = (module: ModuleType): ReactNode => {
  switch (module) {
    case 'energy':
      return <EnergyDemoContent />;
    case 'air':
      return <AirDemoContent />;
    case 'water':
      return <WaterDemoContent />;
    default:
      return null;
  }
};
