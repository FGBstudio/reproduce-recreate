import { motion } from "framer-motion";
import {
  Zap, Droplets, Wind, Sun, Moon, Leaf,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceArea
} from "recharts";

/* ═══════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════ */

const carbonBarData = [
  { bucket: "Jan", "2025": 420, "2024": 480 },
  { bucket: "Feb", "2025": 390, "2024": 460 },
  { bucket: "Mar", "2025": 450, "2024": 500 },
  { bucket: "Apr", "2025": 380, "2024": 440 },
  { bucket: "May", "2025": 350, "2024": 410 },
  { bucket: "Jun", "2025": 400, "2024": 470 },
];

const dayNightData = [
  { name: "Day", value: 62, fill: "#38bdf8" }, // Sky 400
  { name: "Night", value: 38, fill: "#334155" }, // Slate 700
];

const co2LineData = [
  { time: "06:00", co2: 410 }, { time: "08:00", co2: 520 },
  { time: "10:00", co2: 680 }, { time: "12:00", co2: 750 },
  { time: "14:00", co2: 620 }, { time: "16:00", co2: 580 },
  { time: "18:00", co2: 490 }, { time: "20:00", co2: 430 },
];

const waterBarData = [
  { label: "Jan", usage: 1200 }, { label: "Feb", usage: 980 },
  { label: "Mar", usage: 1350 }, { label: "Apr", usage: 1100 },
  { label: "May", usage: 900 },  { label: "Jun", usage: 1450 },
];

/* ═══════════════════════════════════════════════
   SHARED STYLES & APPLE GLASS ESTHETIC
   ═══════════════════════════════════════════════ */

const axisStyle = {
  fontSize: 10,
  fontFamily: "'Futura', sans-serif",
  fill: "#94a3b8",
  fontWeight: 400 as const,
};

const gridStyle = {
  strokeDasharray: "3 6",
  stroke: "#f1f5f9",
  strokeOpacity: 0.8,
};

const tooltipContentStyle = {
  backgroundColor: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: "16px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
  padding: "10px 14px",
  fontFamily: "'Futura', sans-serif",
  fontSize: 11,
};

// Apple visionOS inspired glass card
const cardBase =
  "bg-white/80 backdrop-blur-2xl border border-white/60 shadow-[0_30px_60px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] rounded-[32px] overflow-hidden w-full h-full flex flex-col";

/* ═══════════════════════════════════════════════
   APPLE-STYLE SMOOTH ANIMATIONS
   ═══════════════════════════════════════════════ */

// Caduta morbida con effetto blur (Simula un vetro che si posa)
const appleDrop = (delay: number) => ({
  y: ["-40vh", "0vh"],
  opacity: [0, 1],
  filter: ["blur(12px)", "blur(0px)"],
  scale: [0.95, 1],
  transition: {
    duration: 1.4,
    ease: [0.16, 1, 0.3, 1], // Curva "Expo Out" fluida di iOS
    delay: delay,
  }
});

const floatLoop = (dur: number, dist: number) => ({
  y: [0, -dist, 0],
  transition: {
    duration: dur,
    repeat: Infinity,
    repeatType: "reverse" as const,
    ease: "easeInOut" as const,
  },
});

/* ═══════════════════════════════════════════════
   CARD COMPONENTS
   ═══════════════════════════════════════════════ */

/* ── ACT I — TRUE CSS HEATMAP (Replicata da ProjectDetail) ── */
const TrueHeatmapCard = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heatmapColors = ['#f1f5f9', '#cffafe', '#5eead4', '#14b8a6', '#0f766e']; // Teal palette FGB-friendly

  return (
    <div className={`${cardBase} p-8`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
            <Zap className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-gray-800 tracking-tight">Energy Consumption Heatmap</h4>
            <p className="text-xs text-gray-500">Weekly historical pattern</p>
          </div>
        </div>
        {/* Heatmap Legend */}
        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium">
          <span>Low</span>
          <div className="flex gap-1">
            {heatmapColors.map((c) => (
              <div key={c} className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: c }} />
            ))}
          </div>
          <span>High</span>
        </div>
      </div>
      
      {/* CSS Matrix Grid */}
      <div className="flex-1 flex flex-col justify-between w-full h-full min-h-[220px]">
        <div className="flex flex-1 gap-2 h-full">
          {/* Y Axis (Hours) */}
          <div className="flex flex-col justify-between text-[10px] text-gray-400 font-medium py-1">
            {['00:00','04:00','08:00','12:00','16:00','20:00','23:00'].map(t => <div key={t}>{t}</div>)}
          </div>
          {/* Grid Area */}
          <div className="flex-1 flex flex-col gap-[3px]">
            {Array.from({length: 24}).map((_, hour) => (
              <div key={hour} className="flex-1 flex gap-[3px]">
                {days.map((day, dayIdx) => {
                  // Generatore mock di intensità (più alto di giorno e a metà settimana)
                  const baseIntensity = Math.sin(hour / 3.8) * Math.cos((dayIdx - 3) / 3);
                  const randomNoise = Math.random() * 0.5;
                  const intensity = Math.max(0, baseIntensity + randomNoise);
                  const colorIdx = intensity > 1.2 ? 4 : intensity > 0.8 ? 3 : intensity > 0.4 ? 2 : intensity > 0.1 ? 1 : 0;
                  
                  return (
                    <div 
                      key={`${day}-${hour}`} 
                      className="flex-1 rounded-[3px] transition-all duration-300 hover:scale-110 hover:shadow-sm" 
                      style={{ backgroundColor: heatmapColors[colorIdx] }} 
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {/* X Axis (Days) */}
        <div className="flex pl-10 pt-2">
          {days.map(d => (
            <div key={d} className="flex-1 text-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">{d}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Carbon ── */
const CarbonCard = () => (
  <div className={`${cardBase} p-6`}>
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
        <Leaf className="w-4 h-4 text-emerald-600" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-gray-800 tracking-tight">Carbon Footprint</h4>
        <p className="text-[10px] text-gray-400">kgCO₂e</p>
      </div>
    </div>
    <div className="flex-1 w-full min-h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={carbonBarData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }} barGap={2}>
          <CartesianGrid {...gridStyle} vertical={false} />
          <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipContentStyle} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
          <Bar dataKey="2025" fill="#009193" radius={[4, 4, 0, 0]} maxBarSize={14} />
          <Bar dataKey="2024" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ── Day / Night ── */
const DayNightCard = () => (
  <div className={`${cardBase} p-6`}>
    <div className="flex justify-between items-start mb-2">
      <div>
        <h4 className="text-sm font-bold text-gray-800 tracking-tight">24h Cycle</h4>
        <p className="text-[10px] text-gray-400">Day vs Night</p>
      </div>
    </div>
    <div className="flex-1 flex flex-col items-center justify-center relative mt-2">
      <div className="relative w-28 h-28 drop-shadow-md">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dayNightData} cx="50%" cy="50%" innerRadius="70%" outerRadius="100%"
              stroke="none" dataKey="value" startAngle={90} endAngle={-270}
            >
              {dayNightData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip contentStyle={tooltipContentStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-black text-gray-800">1,240</span>
          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">kWh</span>
        </div>
      </div>
      <div className="flex w-full justify-between px-2 mt-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-500">
          <Sun className="w-3.5 h-3.5" /> 62%
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
          <Moon className="w-3.5 h-3.5" /> 38%
        </div>
      </div>
    </div>
  </div>
);

/* ── CO₂ ── */
const CO2Card = () => (
  <div className={`${cardBase} p-6`}>
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
        <Wind className="w-4 h-4 text-red-500" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-gray-800 tracking-tight">Indoor CO₂</h4>
        <p className="text-[10px] text-gray-400">ppm</p>
      </div>
    </div>
    <div className="flex-1 w-full min-h-[120px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={co2LineData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradCO2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridStyle} />
          <ReferenceArea y1={0} y2={600} fill="url(#gradCO2)" fillOpacity={1} />
          <XAxis dataKey="time" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[300, 800]} />
          <Tooltip contentStyle={tooltipContentStyle} />
          <Line type="monotone" dataKey="co2" stroke="#10b981" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ── Water ── */
const WaterCard = () => (
  <div className={`${cardBase} p-6`}>
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
        <Droplets className="w-4 h-4 text-blue-600" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-gray-800 tracking-tight">Water Usage</h4>
        <p className="text-[10px] text-gray-400">Liters</p>
      </div>
    </div>
    <div className="flex-1 w-full min-h-[120px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={waterBarData} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
          <CartesianGrid {...gridStyle} vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipContentStyle} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
          <Bar dataKey="usage" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */

const FloatingBentoPanel = () => (
  <div
    className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center"
    style={{
      background: "#f8fafc", // Sfondo grigio chiarissimo purissimo
    }}
  >
    {/* Minimalist Ambient Lights (Molto soffuse per stile Apple) */}
    <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-teal-100 opacity-40 blur-[120px]" />
    <div className="absolute bottom-0 right-1/4 w-[700px] h-[700px] rounded-full bg-indigo-50 opacity-50 blur-[150px]" />

    {/* ── Title at the Top ── */}
    <motion.div
      className="absolute top-[8%] inset-x-0 text-center px-8 z-30"
      initial={{ opacity: 0, filter: "blur(10px)", y: -20 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <h2 className="text-4xl xl:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
        The future of
        <span className="ml-2 bg-gradient-to-r from-[#009193] to-[#0f766e] bg-clip-text text-transparent">
          energy management
        </span>
      </h2>
      <p className="mt-4 text-sm text-gray-500 font-medium tracking-wide">
        Real-time IoT monitoring · AI-powered analytics · Sustainability tracking
      </p>
    </motion.div>

    {/* ── Overlapping composition container ── */}
    <div className="relative w-full max-w-[1100px] aspect-[16/10] max-h-[80vh] mt-20">

      {/* ACT I — Central True Heatmap */}
      <motion.div
        className="absolute w-[54%] h-[60%] left-[23%] top-[20%]"
        style={{ zIndex: 10 }}
        initial={{ y: "-80vh", opacity: 0 }}
        animate={appleDrop(0.1)}
      >
        <motion.div animate={floatLoop(7, 6)} className="w-full h-full">
          <TrueHeatmapCard />
        </motion.div>
      </motion.div>

      {/* ACT II — Peripheral cards (Incastro organico e pulito) */}

      {/* Carbon — top-left */}
      <motion.div
        className="absolute w-[24%] h-[34%] left-[7%] top-[12%]"
        style={{ zIndex: 20 }}
        initial={{ y: "-80vh", opacity: 0 }}
        animate={appleDrop(0.4)}
      >
        <motion.div animate={floatLoop(5.5, 8)} className="w-full h-full">
          <CarbonCard />
        </motion.div>
      </motion.div>

      {/* CO₂ — top-right */}
      <motion.div
        className="absolute w-[24%] h-[34%] right-[7%] top-[16%]"
        style={{ zIndex: 21 }}
        initial={{ y: "-80vh", opacity: 0 }}
        animate={appleDrop(0.55)}
      >
        <motion.div animate={floatLoop(6.5, 7)} className="w-full h-full">
          <CO2Card />
        </motion.div>
      </motion.div>

      {/* Day/Night — bottom-left */}
      <motion.div
        className="absolute w-[22%] h-[32%] left-[10%] bottom-[12%]"
        style={{ zIndex: 22 }}
        initial={{ y: "-80vh", opacity: 0 }}
        animate={appleDrop(0.7)}
      >
        <motion.div animate={floatLoop(6, 5)} className="w-full h-full">
          <DayNightCard />
        </motion.div>
      </motion.div>

      {/* Water — bottom-right */}
      <motion.div
        className="absolute w-[25%] h-[30%] right-[11%] bottom-[16%]"
        style={{ zIndex: 23 }}
        initial={{ y: "-80vh", opacity: 0 }}
        animate={appleDrop(0.85)}
      >
        <motion.div animate={floatLoop(7.5, 6)} className="w-full h-full">
          <WaterCard />
        </motion.div>
      </motion.div>
    </div>
  </div>
);

export default FloatingBentoPanel;
