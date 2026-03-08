import { motion } from "framer-motion";
import {
  Zap, Droplets, Sun, Moon, Wind,
  ThermometerSun, Activity, Leaf
} from "lucide-react";

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
    ease: "easeInOut",
  },
});

/* ── Heatmap Card ── */
const HeatmapCard = () => {
  const rows = 5;
  const cols = 7;
  const colors = [
    "bg-emerald-500", "bg-emerald-400", "bg-lime-400",
    "bg-yellow-400", "bg-amber-500", "bg-orange-500", "bg-red-500",
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-semibold tracking-wide text-white/90 uppercase">
          Energy Heatmap
        </span>
      </div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: rows * cols }).map((_, i) => {
          const c = colors[Math.floor(Math.random() * colors.length)];
          return (
            <div
              key={i}
              className={`aspect-square rounded-[3px] ${c} opacity-80`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-white/50">
        <span>Mon</span><span>Wed</span><span>Fri</span><span>Sun</span>
      </div>
    </div>
  );
};

/* ── Air Quality Card ── */
const AirQualityCard = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Wind className="w-4 h-4 text-sky-400" />
      <span className="text-xs font-semibold tracking-wide text-white/90 uppercase">
        Air Quality
      </span>
      <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
        Good
      </span>
    </div>
    {/* CO2 */}
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-white/70">
        <span>CO₂</span><span className="text-emerald-400">412 ppm</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full w-[35%] rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
      </div>
    </div>
    {/* TVOC */}
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-white/70">
        <span>TVOC</span><span className="text-sky-400">0.12 mg/m³</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full w-[18%] rounded-full bg-gradient-to-r from-sky-500 to-sky-400" />
      </div>
    </div>
    {/* Temp & Humidity row */}
    <div className="flex gap-3 pt-1">
      <div className="flex items-center gap-1.5 text-[11px] text-white/60">
        <ThermometerSun className="w-3 h-3 text-orange-400" />
        <span>23.4°C</span>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-white/60">
        <Droplets className="w-3 h-3 text-blue-400" />
        <span>48%</span>
      </div>
    </div>
  </div>
);

/* ── Water Card ── */
const WaterCard = () => {
  const bars = [65, 42, 78, 55, 88, 34, 72, 60, 45, 82];
  const maxH = 48;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Droplets className="w-4 h-4 text-blue-400" />
        <span className="text-xs font-semibold tracking-wide text-white/90 uppercase">
          Water Usage
        </span>
      </div>
      <div className="flex items-end gap-[3px]" style={{ height: maxH }}>
        {bars.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-blue-600 to-cyan-400 opacity-80"
            style={{ height: `${(v / 100) * maxH}px` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-white/50">
        <span>Jan</span><span>Jun</span><span>Dec</span>
      </div>
    </div>
  );
};

/* ── Day/Night Card ── */
const DayNightCard = () => {
  const dayPct = 62;
  const circumference = 2 * Math.PI * 32;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-violet-400" />
        <span className="text-xs font-semibold tracking-wide text-white/90 uppercase">
          Day vs Night
        </span>
      </div>
      <div className="flex items-center gap-4">
        <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0">
          <circle cx="38" cy="38" r="32" fill="none" stroke="hsl(var(--muted))" strokeWidth="7" opacity={0.3} />
          <circle
            cx="38" cy="38" r="32" fill="none"
            stroke="url(#dayGrad)" strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - dayPct / 100)}
            strokeLinecap="round"
            transform="rotate(-90 38 38)"
          />
          <circle
            cx="38" cy="38" r="32" fill="none"
            stroke="url(#nightGrad)" strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (dayPct / 100)}
            strokeLinecap="round"
            transform={`rotate(${360 * (dayPct / 100) - 90} 38 38)`}
          />
          <defs>
            <linearGradient id="dayGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
            <linearGradient id="nightGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
        </svg>
        <div className="space-y-2 text-[11px]">
          <div className="flex items-center gap-2 text-white/80">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Day <b className="text-white">{dayPct}%</b></span>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            <span>Night <b className="text-white">{100 - dayPct}%</b></span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Sustainability mini card ── */
const SustainabilityCard = () => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <Leaf className="w-4 h-4 text-emerald-400" />
      <span className="text-xs font-semibold tracking-wide text-white/90 uppercase">
        Green Score
      </span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-3xl font-bold text-emerald-400">87</span>
      <span className="text-xs text-white/50">/100</span>
    </div>
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className="h-full w-[87%] rounded-full bg-gradient-to-r from-emerald-500 to-lime-400" />
    </div>
  </div>
);

/* ── Cards config ── */
const cards: {
  id: string;
  component: React.FC;
  className: string;
  delay: number;
  float: { duration: number; distance: number };
}[] = [
  {
    id: "heatmap",
    component: HeatmapCard,
    className: "top-[6%] left-[8%] w-52",
    delay: 0.1,
    float: { duration: 4.5, distance: 6 },
  },
  {
    id: "air",
    component: AirQualityCard,
    className: "top-[4%] right-[6%] w-56",
    delay: 0.25,
    float: { duration: 5, distance: 8 },
  },
  {
    id: "water",
    component: WaterCard,
    className: "bottom-[28%] left-[5%] w-48",
    delay: 0.4,
    float: { duration: 5.5, distance: 5 },
  },
  {
    id: "daynight",
    component: DayNightCard,
    className: "bottom-[22%] right-[4%] w-56",
    delay: 0.55,
    float: { duration: 4.8, distance: 7 },
  },
  {
    id: "green",
    component: SustainabilityCard,
    className: "top-[44%] left-[32%] w-44",
    delay: 0.7,
    float: { duration: 6, distance: 4 },
  },
];

/* ── Main Component ── */
const FloatingBentoPanel = () => (
  <div className="hidden lg:flex flex-1 relative overflow-hidden"
    style={{ background: "radial-gradient(ellipse at 30% 20%, hsl(200 100% 14%), hsl(220 60% 6%) 70%)" }}
  >
    {/* Subtle grid pattern */}
    <div
      className="absolute inset-0 opacity-[0.04]"
      style={{
        backgroundImage:
          "linear-gradient(hsl(0 0% 100% / 0.15) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100% / 0.15) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }}
    />

    {/* Ambient glow */}
    <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-[hsl(var(--primary))] opacity-[0.06] blur-[120px]" />
    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-[hsl(var(--secondary))] opacity-[0.08] blur-[140px]" />

    {/* Floating cards */}
    {cards.map(({ id, component: Component, className, delay, float }) => (
      <motion.div
        key={id}
        className={`absolute ${className}`}
        initial={{ y: -120, opacity: 0, scale: 0.85 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={springTransition(delay)}
      >
        <motion.div
          animate={floatAnimation(float.duration, float.distance)}
          className="p-4 rounded-2xl bg-white/[0.07] backdrop-blur-md border border-white/[0.12] shadow-2xl"
        >
          <Component />
        </motion.div>
      </motion.div>
    ))}

    {/* Payoff text */}
    <motion.div
      className="absolute bottom-[6%] inset-x-0 text-center px-8 z-10"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.8, ease: "easeOut" }}
    >
      <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight tracking-tight">
        The future of
        <br />
        <span className="bg-gradient-to-r from-[hsl(var(--primary))] to-amber-400 bg-clip-text text-transparent">
          energy management
        </span>
      </h2>
      <p className="mt-3 text-sm text-white/50 max-w-md mx-auto">
        Real-time IoT monitoring · AI-powered analytics · Sustainability tracking
      </p>
    </motion.div>
  </div>
);

export default FloatingBentoPanel;
