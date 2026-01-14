import { ReactNode, useMemo, useRef, useState, useCallback, TouchEvent } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { Lightbulb, Droplet, Wind, ChevronLeft, ChevronRight, Thermometer } from 'lucide-react';
import { ModuleType } from '@/lib/types/admin';
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

// Carousel wrapper component
interface DemoCarouselProps {
  children: ReactNode[];
}

const DemoCarousel = ({ children }: DemoCarouselProps) => {
  const slides = Array.isArray(children) ? children : [children];
  const totalSlides = slides.length;

  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchStartX.current == null || touchEndX.current == null) return;

    const distance = touchStartX.current - touchEndX.current;
    if (Math.abs(distance) > minSwipeDistance) {
      if (distance > 0 && currentSlide < totalSlides - 1) {
        setCurrentSlide((prev) => prev + 1);
      } else if (distance < 0 && currentSlide > 0) {
        setCurrentSlide((prev) => prev - 1);
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  }, [currentSlide, totalSlides]);

  // NOTE: translateX(%) is relative to the *track width*, so we size the track explicitly
  // and translate by 100/totalSlides per step.
  const trackTranslatePct = totalSlides > 0 ? (currentSlide * 100) / totalSlides : 0;

  return (
    <div className="relative w-full h-full">
      {/* Carousel Content */}
      <div
        className="relative overflow-x-hidden overflow-y-visible h-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-500 ease-in-out"
          style={{
            width: `${totalSlides * 100}%`,
            transform: `translateX(-${trackTranslatePct}%)`,
          }}
        >
          {slides.map((child, idx) => (
            <div
              key={idx}
              className="h-full flex-shrink-0 overflow-y-auto pb-4"
              style={{ width: `${100 / totalSlides}%` }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-center items-center gap-4 mt-4">
        <button
          onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
          disabled={currentSlide === 0}
          className="p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>

        <div className="flex gap-2">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                idx === currentSlide
                  ? 'bg-fgb-secondary scale-125'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() =>
            setCurrentSlide((prev) => Math.min(totalSlides - 1, prev + 1))
          }
          disabled={currentSlide === totalSlides - 1}
          className="p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight className="w-5 h-5 text-gray-700" />
        </button>
      </div>
    </div>
  );
};

// Additional demo data
const demoDeviceData = [
  { month: 'Gen', hvac: 4200, lighting: 2100, plugs: 1050 },
  { month: 'Feb', hvac: 3900, lighting: 1950, plugs: 1000 },
  { month: 'Mar', hvac: 3250, lighting: 1800, plugs: 950 },
  { month: 'Apr', hvac: 2600, lighting: 1700, plugs: 900 },
  { month: 'Mag', hvac: 2400, lighting: 1600, plugs: 875 },
  { month: 'Giu', hvac: 3100, lighting: 1500, plugs: 850 },
];

const demoHeatmapData = Array.from({ length: 24 }, () => 
  Array.from({ length: 7 }, () => Math.floor(Math.random() * 4) + 1)
);

const heatmapColors: Record<number, string> = {
  1: 'hsl(188, 60%, 85%)',
  2: 'hsl(188, 70%, 65%)',
  3: 'hsl(188, 80%, 45%)',
  4: 'hsl(188, 100%, 25%)',
};

const demoPM25Data = [
  { day: 'Lun', indoor: 12, outdoor: 28, limit: 25 },
  { day: 'Mar', indoor: 15, outdoor: 35, limit: 25 },
  { day: 'Mer', indoor: 10, outdoor: 22, limit: 25 },
  { day: 'Gio', indoor: 18, outdoor: 42, limit: 25 },
  { day: 'Ven', indoor: 14, outdoor: 30, limit: 25 },
];

const demoWaterLeaksData = [
  { zone: 'Bagni Piano 1', leakRate: 2.3, status: 'warning' },
  { zone: 'Cucina', leakRate: 0.8, status: 'ok' },
  { zone: 'Irrigazione', leakRate: 5.2, status: 'critical' },
  { zone: 'Bagni Piano 2', leakRate: 1.1, status: 'ok' },
];

const demoWaterQualityData = [
  { time: '00:00', ph: 7.2, turbidity: 0.8, chlorine: 0.5 },
  { time: '04:00', ph: 7.1, turbidity: 0.7, chlorine: 0.48 },
  { time: '08:00', ph: 7.3, turbidity: 1.2, chlorine: 0.52 },
  { time: '12:00', ph: 7.4, turbidity: 1.5, chlorine: 0.55 },
  { time: '16:00', ph: 7.2, turbidity: 1.1, chlorine: 0.51 },
  { time: '20:00', ph: 7.1, turbidity: 0.9, chlorine: 0.49 },
];

// Energy Demo Dashboard with Carousel
export const EnergyDemoContent = () => (
  <DemoCarousel>
    {/* Slide 1: Overview */}
    <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
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

    {/* Slide 2: Device Consumption & Heatmap */}
    <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
        <div className="mb-3">
          <h3 className="text-base md:text-lg font-bold text-gray-800">Consumo Dispositivi</h3>
          <p className="text-[10px] md:text-xs text-gray-500">Dati demo</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={demoDeviceData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="month" tick={{ ...axisStyle, fontSize: 9 }} />
            <YAxis tick={{ ...axisStyle, fontSize: 9 }} width={35} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
            <Bar dataKey="hvac" fill="hsl(188, 100%, 25%)" name="HVAC" radius={[4, 4, 0, 0]} />
            <Bar dataKey="lighting" fill="hsl(188, 80%, 45%)" name="Illuminazione" radius={[4, 4, 0, 0]} />
            <Bar dataKey="plugs" fill="hsl(188, 60%, 65%)" name="Prese" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
        <div className="mb-3">
          <h3 className="text-base md:text-lg font-bold text-gray-800">Heatmap Consumo</h3>
          <p className="text-[10px] md:text-xs text-gray-500">Ultimo 7 giorni per ora</p>
        </div>
        <div className="flex gap-2">
          <div className="text-[8px] text-gray-500 space-y-[3px] pt-0.5">
            {[0, 6, 12, 18, 23].map(h => (
              <div key={h} className="h-3">{String(h).padStart(2, '0')}:00</div>
            ))}
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-7 gap-[1px]">
              {demoHeatmapData.slice(0, 12).flat().map((val, idx) => (
                <div key={idx} className="h-3 rounded-sm" style={{ backgroundColor: heatmapColors[val] }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-3 text-[9px] justify-center">
          {[{ c: 1, l: 'Basso' }, { c: 2, l: 'Medio' }, { c: 3, l: 'Alto' }, { c: 4, l: 'Picco' }].map(({ c, l }) => (
            <span key={c} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: heatmapColors[c] }} /> {l}
            </span>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 grid grid-cols-4 gap-2">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
          <p className="text-xl font-bold text-fgb-secondary">4,250</p>
          <p className="text-[10px] text-gray-500">kWh HVAC</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
          <p className="text-xl font-bold text-fgb-secondary">2,100</p>
          <p className="text-[10px] text-gray-500">kWh Luci</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
          <p className="text-xl font-bold text-fgb-secondary">1,050</p>
          <p className="text-[10px] text-gray-500">kWh Prese</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
          <p className="text-xl font-bold text-amber-500">2</p>
          <p className="text-[10px] text-gray-500">Alert Attivi</p>
        </div>
      </div>
    </div>
  </DemoCarousel>
);

// Air Quality Demo Dashboard with Carousel
export const AirDemoContent = () => (
  <DemoCarousel>
    {/* Slide 1: CO2 & Temperature Overview */}
    <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
        <div className="mb-3">
          <h3 className="text-base md:text-lg font-bold text-gray-800">CO₂ Trend</h3>
          <p className="text-[10px] md:text-xs text-gray-500">Dati demo - Ultime 24 ore</p>
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

    {/* Slide 2: TVOC & Particolato */}
    <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
        <div className="mb-3">
          <h3 className="text-base md:text-lg font-bold text-gray-800">TVOC Trend</h3>
          <p className="text-[10px] md:text-xs text-gray-500">Composti Organici Volatili</p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={demoTVOCHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="demoTvocGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(270, 60%, 50%)" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="hsl(270, 60%, 50%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={{ ...axisStyle, fontSize: 9 }} />
            <YAxis tick={{ ...axisStyle, fontSize: 9 }} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="tvoc" stroke="hsl(270, 60%, 50%)" fill="url(#demoTvocGradient)" name="TVOC (ppb)" />
            <Line type="monotone" dataKey="limit" stroke="#ef4444" strokeDasharray="5 5" dot={false} name="Limite" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
        <div className="mb-3">
          <h3 className="text-base md:text-lg font-bold text-gray-800">PM2.5 Indoor vs Outdoor</h3>
          <p className="text-[10px] md:text-xs text-gray-500">Particolato fine</p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={demoPM25Data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="day" tick={{ ...axisStyle, fontSize: 9 }} />
            <YAxis tick={{ ...axisStyle, fontSize: 9 }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
            <Bar dataKey="indoor" fill="hsl(188, 100%, 35%)" name="Indoor" radius={[4, 4, 0, 0]} />
            <Bar dataKey="outdoor" fill="hsl(188, 60%, 65%)" name="Outdoor" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="lg:col-span-2 grid grid-cols-4 gap-2">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
          <p className="text-xl font-bold text-fgb-secondary">120</p>
          <p className="text-[10px] text-gray-500">TVOC ppb</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
          <p className="text-xl font-bold text-emerald-500">12</p>
          <p className="text-[10px] text-gray-500">PM2.5 µg/m³</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
          <p className="text-xl font-bold text-emerald-500">22</p>
          <p className="text-[10px] text-gray-500">PM10 µg/m³</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
          <p className="text-xl font-bold text-emerald-500">0</p>
          <p className="text-[10px] text-gray-500">Alert</p>
        </div>
      </div>
    </div>
  </DemoCarousel>
);

// Water Demo Dashboard with Carousel
export const WaterDemoContent = () => (
  <DemoCarousel>
    {/* Slide 1: Consumption Overview */}
    <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
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

    {/* Slide 2: Leaks & Quality */}
    <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
        <div className="mb-3">
          <h3 className="text-base md:text-lg font-bold text-gray-800">Rilevamento Perdite</h3>
          <p className="text-[10px] md:text-xs text-gray-500">Stato per zona</p>
        </div>
        <div className="space-y-2">
          {demoWaterLeaksData.map((leak, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
              <span className="text-xs font-medium text-gray-700">{leak.zone}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">{leak.leakRate} L/h</span>
                <span className={`w-2 h-2 rounded-full ${
                  leak.status === 'ok' ? 'bg-emerald-500' : 
                  leak.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
        <div className="mb-3">
          <h3 className="text-base md:text-lg font-bold text-gray-800">Qualità Acqua</h3>
          <p className="text-[10px] md:text-xs text-gray-500">pH, Torbidità, Cloro</p>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={demoWaterQualityData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={{ ...axisStyle, fontSize: 9 }} />
            <YAxis tick={{ ...axisStyle, fontSize: 9 }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
            <Line type="monotone" dataKey="ph" stroke="hsl(200, 80%, 50%)" name="pH" />
            <Line type="monotone" dataKey="turbidity" stroke="hsl(30, 80%, 50%)" name="Torbidità" />
            <Line type="monotone" dataKey="chlorine" stroke="hsl(150, 60%, 45%)" name="Cloro" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="lg:col-span-2 grid grid-cols-4 gap-2">
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
          <p className="text-xl font-bold text-emerald-500">7.2</p>
          <p className="text-[10px] text-gray-500">pH</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
          <p className="text-xl font-bold text-emerald-500">0.8</p>
          <p className="text-[10px] text-gray-500">Torbidità NTU</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
          <p className="text-xl font-bold text-amber-500">1</p>
          <p className="text-[10px] text-gray-500">Perdite Attive</p>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
          <p className="text-xl font-bold text-emerald-500">OK</p>
          <p className="text-[10px] text-gray-500">Qualità</p>
        </div>
      </div>
    </div>
  </DemoCarousel>
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
