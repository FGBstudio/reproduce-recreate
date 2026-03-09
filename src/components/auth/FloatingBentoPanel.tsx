import { motion } from "framer-motion";
import {
  Zap, Droplets, Wind, Sun, Moon, Leaf,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

/* ═══════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════ */

const energyAreaData = [
  { label: "00:00", General: 12, HVAC: 5, Lighting: 3, Other: 1.5 },
  { label: "04:00", General: 9,  HVAC: 4, Lighting: 1, Other: 1 },
  { label: "08:00", General: 22, HVAC: 11, Lighting: 6, Other: 3 },
  { label: "10:00", General: 28, HVAC: 14, Lighting: 7, Other: 4 },
  { label: "12:00", General: 32, HVAC: 16, Lighting: 8, Other: 5 },
  { label: "14:00", General: 30, HVAC: 15, Lighting: 7, Other: 4.5 },
  { label: "16:00", General: 26, HVAC: 12, Lighting: 6, Other: 3.5 },
  { label: "18:00", General: 20, HVAC: 9,  Lighting: 5, Other: 2.5 },
  { label: "20:00", General: 16, HVAC: 7,  Lighting: 4, Other: 2 },
  { label: "23:00", General: 11, HVAC: 4,  Lighting: 2, Other: 1 },
];

const carbonBarData = [
  { bucket: "Jan", "2025": 420, "2024": 480 },
  { bucket: "Feb", "2025": 390, "2024": 460 },
  { bucket: "Mar", "2025": 450, "2024": 500 },
  { bucket: "Apr", "2025": 380, "2024": 440 },
  { bucket: "May", "2025": 350, "2024": 410 },
  { bucket: "Jun", "2025": 400, "2024": 470 },
];

const dayNightData = [
  { name: "Day", value: 62, fill: "#f59e0b" },
  { name: "Night", value: 38, fill: "#6366f1" },
];

const co2LineData = [
  { time: "06:00", co2: 410 },
  { time: "08:00", co2: 520 },
  { time: "10:00", co2: 680 },
  { time: "12:00", co2: 750 },
  { time: "14:00", co2: 620 },
  { time: "16:00", co2: 580 },
  { time: "18:00", co2: 490 },
  { time: "20:00", co2: 430 },
];

const waterBarData = [
  { label: "Jan", usage: 1200 },
  { label: "Feb", usage: 980 },
  { label: "Mar", usage: 1350 },
  { label: "Apr", usage: 1100 },
  { label: "May", usage: 900 },
  { label: "Jun", usage: 1450 },
  { label: "Jul", usage: 1600 },
  { label: "Aug", usage: 1520 },
];

/* ═══════════════════════════════════════════════
   SHARED CHART STYLES
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
  backgroundColor: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: "12px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
  padding: "10px 14px",
  fontFamily: "'Futura', sans-serif",
  fontSize: 11,
};

/* ═══════════════════════════════════════════════
   SPRING ANIMATION PRESETS
   ═══════════════════════════════════════════════ */

// Heavy spring — overshoots then settles (gravity feel)
const dropSpring = (delay: number) => ({
  type: "spring" as const,
  stiffness: 80,
  damping: 10,
  mass: 1.2,
  delay,
});

// Gentle perpetual float
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

const cardBase =
  "bg-white rounded-[22px] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-visible";

/* ── ACT I — Central Energy Heatmap (large) ── */
const EnergyHeatmap = () => (
  <div className={`${cardBase} p-6`} style={{ minHeight: 280 }}>
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
        <Zap className="w-4 h-4 text-teal-600" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-gray-800 tracking-tight">Energy Consumption</h4>
        <p className="text-[10px] text-gray-400">kW · Today</p>
      </div>
    </div>
    <div className="w-full" style={{ height: 210 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={energyAreaData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="bGeneral" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#009193" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#009193" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="bHVAC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#006367" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#006367" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="bLighting" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#e63f26" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#e63f26" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={tooltipContentStyle} />
          <Area type="monotone" dataKey="General" stroke="#009193" fill="url(#bGeneral)" strokeWidth={2} />
          <Area type="monotone" dataKey="HVAC" stroke="#006367" fill="url(#bHVAC)" strokeWidth={1.5} />
          <Area type="monotone" dataKey="Lighting" stroke="#e63f26" fill="url(#bLighting)" strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ── Carbon ── */
const CarbonCard = () => (
  <div className={`${cardBase} p-5`} style={{ minHeight: 200 }}>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
        <Leaf className="w-3.5 h-3.5 text-emerald-600" />
      </div>
      <div>
        <h4 className="text-xs font-bold text-gray-800 tracking-tight">Carbon Footprint</h4>
        <p className="text-[10px] text-gray-400">kgCO₂e · YoY</p>
      </div>
    </div>
    <div className="w-full" style={{ height: 140 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={carbonBarData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} barGap={2}>
          <CartesianGrid {...gridStyle} vertical={false} />
          <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={tooltipContentStyle} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconType="circle" />
          <Bar dataKey="2025" fill="#009193" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="2024" fill="#d1d5db" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ── Day / Night ── */
const DayNightCard = () => (
  <div className={`${cardBase} p-5`} style={{ minHeight: 180 }}>
    <div className="flex items-center gap-2 mb-2">
      <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
        <Sun className="w-3.5 h-3.5 text-amber-500" />
      </div>
      <div>
        <h4 className="text-xs font-bold text-gray-800 tracking-tight">Day vs Night</h4>
        <p className="text-[10px] text-gray-400">24h Cycle</p>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: 110, height: 110 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dayNightData}
              cx="50%" cy="50%"
              innerRadius="70%" outerRadius="100%"
              stroke="none" dataKey="value"
              startAngle={90} endAngle={-270}
            >
              {dayNightData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipContentStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-black text-gray-800">1,240</span>
          <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">kWh</span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <Sun className="w-3 h-3 text-amber-500" />
          <span>Day <b className="text-gray-900">62%</b></span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <Moon className="w-3 h-3 text-indigo-500" />
          <span>Night <b className="text-gray-900">38%</b></span>
        </div>
      </div>
    </div>
  </div>
);

/* ── CO₂ ── */
const CO2Card = () => (
  <div className={`${cardBase} p-5`} style={{ minHeight: 180 }}>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center">
        <Wind className="w-3.5 h-3.5 text-sky-600" />
      </div>
      <div>
        <h4 className="text-xs font-bold text-gray-800 tracking-tight">CO₂ Trend</h4>
        <p className="text-[10px] text-gray-400">ppm · Today</p>
      </div>
      <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 font-semibold">
        Good
      </span>
    </div>
    <div className="w-full" style={{ height: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={co2LineData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="time" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={30} domain={[300, 800]} />
          <Tooltip contentStyle={tooltipContentStyle} />
          <Line type="monotone" dataKey="co2" stroke="#009193" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ── Water ── */
const WaterCard = () => (
  <div className={`${cardBase} p-5`} style={{ minHeight: 170 }}>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
        <Droplets className="w-3.5 h-3.5 text-blue-600" />
      </div>
      <div>
        <h4 className="text-xs font-bold text-gray-800 tracking-tight">Water Usage</h4>
        <p className="text-[10px] text-gray-400">Liters · Monthly</p>
      </div>
    </div>
    <div className="w-full" style={{ height: 110 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={waterBarData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid {...gridStyle} vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={tooltipContentStyle} />
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
      background: "linear-gradient(145deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)",
    }}
  >
    {/* Dot grid */}
    <div
      className="absolute inset-0 opacity-[0.3]"
      style={{
        backgroundImage: "radial-gradient(circle, #cbd5e1 0.8px, transparent 0.8px)",
        backgroundSize: "32px 32px",
      }}
    />

    {/* Ambient glows */}
    <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-teal-200 opacity-[0.12] blur-[100px]" />
    <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-indigo-200 opacity-[0.10] blur-[120px]" />

    {/* ── Overlapping composition container ── */}
    <div className="relative w-[92%] max-w-[680px]" style={{ height: "88%" }}>

      {/* ACT I — Central Energy Heatmap (z-10, base layer) */}
      <motion.div
        className="absolute left-[5%] right-[5%] top-[12%]"
        style={{ zIndex: 10 }}
        initial={{ y: "-100vh", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={dropSpring(0)}
      >
        <motion.div animate={floatLoop(6, 3)}>
          <EnergyHeatmap />
        </motion.div>
      </motion.div>

      {/* ACT II — Peripheral cards (z-20+, overlap heatmap edges) */}

      {/* Carbon — top-left, overlaps heatmap top-left corner */}
      <motion.div
        className="absolute left-[-2%] top-[2%] w-[48%]"
        style={{ zIndex: 20 }}
        initial={{ y: "-100vh", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={dropSpring(0.3)}
      >
        <motion.div animate={floatLoop(5.2, 4)}>
          <CarbonCard />
        </motion.div>
      </motion.div>

      {/* CO₂ — top-right, overlaps heatmap top-right corner */}
      <motion.div
        className="absolute right-[-2%] top-[4%] w-[44%]"
        style={{ zIndex: 21 }}
        initial={{ y: "-100vh", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={dropSpring(0.45)}
      >
        <motion.div animate={floatLoop(5.6, 5)}>
          <CO2Card />
        </motion.div>
      </motion.div>

      {/* Day/Night — bottom-left, overlaps heatmap bottom-left */}
      <motion.div
        className="absolute left-[0%] bottom-[10%] w-[46%]"
        style={{ zIndex: 22 }}
        initial={{ y: "-100vh", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={dropSpring(0.6)}
      >
        <motion.div animate={floatLoop(5, 4.5)}>
          <DayNightCard />
        </motion.div>
      </motion.div>

      {/* Water — bottom-right, overlaps heatmap bottom-right */}
      <motion.div
        className="absolute right-[0%] bottom-[12%] w-[44%]"
        style={{ zIndex: 23 }}
        initial={{ y: "-100vh", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={dropSpring(0.75)}
      >
        <motion.div animate={floatLoop(5.8, 3.5)}>
          <WaterCard />
        </motion.div>
      </motion.div>
    </div>

    {/* Payoff text */}
    <motion.div
      className="absolute bottom-[2%] inset-x-0 text-center px-8"
      style={{ zIndex: 30 }}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.7, ease: "easeOut" }}
    >
      <h2 className="text-3xl xl:text-4xl font-bold text-gray-800 leading-tight tracking-tight">
        The future of
        <br />
        <span className="bg-gradient-to-r from-[#009193] to-[#006367] bg-clip-text text-transparent">
          energy management
        </span>
      </h2>
      <p className="mt-2 text-xs text-gray-400 max-w-sm mx-auto tracking-wide">
        Real-time IoT monitoring · AI-powered analytics · Sustainability tracking
      </p>
    </motion.div>
  </div>
);

export default FloatingBentoPanel;
