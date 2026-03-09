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
   MOCK DATA — same structure as ProjectDetail
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
   SHARED STYLES — Apple aesthetic
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
   ANIMATION HELPERS
   ═══════════════════════════════════════════════ */

const springTransition = (delay: number) => ({
  type: "spring" as const,
  stiffness: 100,
  damping: 12,
  mass: 1,
  delay,
});

const floatAnimation = (duration: number, distance: number) => ({
  y: [0, -distance, 0],
  transition: {
    duration,
    repeat: Infinity,
    repeatType: "reverse" as const,
    ease: "easeInOut" as const,
  },
});

/* ═══════════════════════════════════════════════
   BENTO CARD WRAPPER
   ═══════════════════════════════════════════════ */

const bentoCard = "bg-white rounded-[20px] border border-gray-100 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)]";

/* ═══════════════════════════════════════════════
   CARD 1 — Energy AreaChart (same as ProjectDetail)
   ═══════════════════════════════════════════════ */

const EnergyAreaCard = () => (
  <div className={bentoCard} style={{ minHeight: 220 }}>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
        <Zap className="w-3.5 h-3.5 text-teal-600" />
      </div>
      <div>
        <h4 className="text-xs font-bold text-gray-800 tracking-tight">Energy Consumption</h4>
        <p className="text-[10px] text-gray-400">kW · Today</p>
      </div>
    </div>
    <div className="w-full" style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={energyAreaData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="bentoGeneral" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#009193" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#009193" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="bentoHVAC" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#006367" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#006367" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="bentoLighting" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#e63f26" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#e63f26" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={tooltipContentStyle} />
          <Area type="monotone" dataKey="General" stroke="#009193" fill="url(#bentoGeneral)" strokeWidth={2} />
          <Area type="monotone" dataKey="HVAC" stroke="#006367" fill="url(#bentoHVAC)" strokeWidth={1.5} />
          <Area type="monotone" dataKey="Lighting" stroke="#e63f26" fill="url(#bentoLighting)" strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   CARD 2 — Carbon Footprint BarChart (same as ProjectDetail)
   ═══════════════════════════════════════════════ */

const CarbonBarCard = () => (
  <div className={bentoCard} style={{ minHeight: 220 }}>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
        <Leaf className="w-3.5 h-3.5 text-emerald-600" />
      </div>
      <div>
        <h4 className="text-xs font-bold text-gray-800 tracking-tight">Carbon Footprint</h4>
        <p className="text-[10px] text-gray-400">kgCO₂e · YoY</p>
      </div>
    </div>
    <div className="w-full" style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={carbonBarData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} barGap={2}>
          <CartesianGrid {...gridStyle} vertical={false} />
          <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={tooltipContentStyle} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconType="circle" />
          <Bar dataKey="2025" fill="#009193" radius={[4, 4, 0, 0]} maxBarSize={20} />
          <Bar dataKey="2024" fill="#d1d5db" radius={[4, 4, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   CARD 3 — Day vs Night PieChart (same as ProjectDetail)
   ═══════════════════════════════════════════════ */

const DayNightPieCard = () => (
  <div className={bentoCard} style={{ minHeight: 200 }}>
    <div className="flex items-center gap-2 mb-2">
      <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
        <Sun className="w-3.5 h-3.5 text-amber-500" />
      </div>
      <div>
        <h4 className="text-xs font-bold text-gray-800 tracking-tight">Day vs Night</h4>
        <p className="text-[10px] text-gray-400">24h Energy Cycle</p>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: 120, height: 120 }}>
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
          <span className="text-lg font-black text-gray-800">1,240</span>
          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">kWh</span>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Day <b className="text-gray-900">62%</b></span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Moon className="w-3.5 h-3.5 text-indigo-500" />
          <span>Night <b className="text-gray-900">38%</b></span>
        </div>
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   CARD 4 — CO₂ LineChart (same as ProjectDetail)
   ═══════════════════════════════════════════════ */

const CO2LineCard = () => (
  <div className={bentoCard} style={{ minHeight: 200 }}>
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
    <div className="w-full" style={{ height: 140 }}>
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

/* ═══════════════════════════════════════════════
   CARD 5 — Water BarChart (same chart type as ProjectDetail)
   ═══════════════════════════════════════════════ */

const WaterBarCard = () => (
  <div className={bentoCard} style={{ minHeight: 190 }}>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
        <Droplets className="w-3.5 h-3.5 text-blue-600" />
      </div>
      <div>
        <h4 className="text-xs font-bold text-gray-800 tracking-tight">Water Usage</h4>
        <p className="text-[10px] text-gray-400">Liters · Monthly</p>
      </div>
    </div>
    <div className="w-full" style={{ height: 130 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={waterBarData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid {...gridStyle} vertical={false} />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={tooltipContentStyle} />
          <Bar dataKey="usage" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   CARDS CONFIG — asymmetric layout with overlap
   ═══════════════════════════════════════════════ */

const cards: {
  id: string;
  component: React.FC;
  className: string;
  delay: number;
  float: { duration: number; distance: number };
}[] = [
  {
    id: "energy",
    component: EnergyAreaCard,
    className: "top-[3%] left-[4%] w-[52%]",
    delay: 0.1,
    float: { duration: 5, distance: 5 },
  },
  {
    id: "co2",
    component: CO2LineCard,
    className: "top-[2%] right-[3%] w-[46%]",
    delay: 0.25,
    float: { duration: 5.5, distance: 6 },
  },
  {
    id: "carbon",
    component: CarbonBarCard,
    className: "top-[36%] left-[6%] w-[48%]",
    delay: 0.4,
    float: { duration: 4.8, distance: 4 },
  },
  {
    id: "daynight",
    component: DayNightPieCard,
    className: "top-[34%] right-[4%] w-[44%]",
    delay: 0.55,
    float: { duration: 5.2, distance: 5 },
  },
  {
    id: "water",
    component: WaterBarCard,
    className: "bottom-[6%] left-[16%] w-[48%]",
    delay: 0.7,
    float: { duration: 6, distance: 4 },
  },
];

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */

const FloatingBentoPanel = () => (
  <div
    className="hidden lg:flex flex-1 relative overflow-hidden"
    style={{
      background: "linear-gradient(145deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)",
    }}
  >
    {/* Subtle dot grid */}
    <div
      className="absolute inset-0 opacity-[0.35]"
      style={{
        backgroundImage: "radial-gradient(circle, #cbd5e1 0.8px, transparent 0.8px)",
        backgroundSize: "32px 32px",
      }}
    />

    {/* Soft ambient glow */}
    <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-teal-200 opacity-[0.15] blur-[100px]" />
    <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-indigo-200 opacity-[0.12] blur-[120px]" />

    {/* Floating cards */}
    {cards.map(({ id, component: Component, className, delay, float }) => (
      <motion.div
        key={id}
        className={`absolute ${className} z-10`}
        initial={{ y: -100, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={springTransition(delay)}
      >
        <motion.div animate={floatAnimation(float.duration, float.distance)}>
          <Component />
        </motion.div>
      </motion.div>
    ))}

    {/* Bottom payoff text */}
    <motion.div
      className="absolute bottom-[2%] inset-x-0 text-center px-8 z-20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.6, ease: "easeOut" }}
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
