import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight, ChevronLeft, ChevronDown, Zap, Wind, Droplet, Cloud, X,
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer,
} from "recharts";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ───────────────────────── tokens ───────────────────────── */
const INK = "#1d1d1f";
const SUB = "#86868b";
const BG = "#fbfbfd";
const SURFACE = "#ffffff";
const ACCENT = "#0a7d7a";
const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const axisStyle = { fontSize: 10, fill: SUB, fontWeight: 400 };

const OFFICES = [
  "Aix-en-Provence", "Amsterdam", "Dubai", "Ho Chi Minh", "London",
  "Los Angeles", "Miami", "Milan", "New York", "Rome",
  "Shanghai", "Singapore", "Taichung", "Tokyo",
];

/* ───────────────────────── mock data ───────────────────────── */
const carbonBarData = [
  { bucket: "Jan", a: 420, b: 480 }, { bucket: "Feb", a: 390, b: 460 },
  { bucket: "Mar", a: 450, b: 500 }, { bucket: "Apr", a: 380, b: 440 },
  { bucket: "May", a: 350, b: 410 }, { bucket: "Jun", a: 400, b: 470 },
];
const dayNightData = [
  { name: "Day", value: 62, fill: ACCENT },
  { name: "Night", value: 38, fill: "#e5e7eb" },
];
const co2LineData = [
  { time: "06", co2: 410 }, { time: "08", co2: 520 }, { time: "10", co2: 680 },
  { time: "12", co2: 750 }, { time: "14", co2: 620 }, { time: "16", co2: 580 },
];

/* ───────────────────────── parts ───────────────────────── */
const MiniCard: React.FC<React.PropsWithChildren<{ title: string; sub: string; icon: React.ReactNode }>> = ({
  title, sub, icon, children,
}) => (
  <div className="w-full h-full bg-white border border-black/[0.06] rounded-3xl p-5 flex flex-col shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${ACCENT}14` }}>
        {icon}
      </div>
      <div>
        <h4 className="text-[12px] font-semibold tracking-tight" style={{ color: INK }}>{title}</h4>
        <p className="text-[10px]" style={{ color: SUB }}>{sub}</p>
      </div>
    </div>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);

const HeatmapCard = () => (
  <MiniCard title="Energy Heatmap" sub="Weekly analysis" icon={<Zap className="w-4 h-4" style={{ color: ACCENT }} strokeWidth={1.5} />}>
    <div className="w-full h-full flex flex-col gap-[3px]">
      {Array.from({ length: 10 }).map((_, h) => (
        <div key={h} className="flex-1 flex gap-[3px]">
          {Array.from({ length: 7 }).map((_, d) => {
            const v = Math.random();
            const bg = v > 0.8 ? "#0a7d7a" : v > 0.55 ? "#5eb8b6" : v > 0.3 ? "#cfe9e8" : "#f1f5f5";
            return <div key={d} className="flex-1 rounded-[3px]" style={{ background: bg }} />;
          })}
        </div>
      ))}
    </div>
  </MiniCard>
);

const CarbonCard = () => (
  <MiniCard title="Carbon Target" sub="YoY reduction" icon={<Cloud className="w-4 h-4" style={{ color: ACCENT }} strokeWidth={1.5} />}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={carbonBarData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barGap={3}>
        <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Bar dataKey="a" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={10} />
        <Bar dataKey="b" fill="#e5e7eb" radius={[4, 4, 0, 0]} maxBarSize={10} />
      </BarChart>
    </ResponsiveContainer>
  </MiniCard>
);

const CO2Card = () => (
  <MiniCard title="Air Quality" sub="Indoor CO₂ (ppm)" icon={<Wind className="w-4 h-4" style={{ color: ACCENT }} strokeWidth={1.5} />}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={co2LineData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 6" stroke="#f1f5f5" vertical={false} />
        <XAxis dataKey="time" tick={axisStyle} axisLine={false} tickLine={false} dy={6} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[300, 800]} />
        <Line type="monotone" dataKey="co2" stroke={ACCENT} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </MiniCard>
);

/* Ring chart used in the hero — light, Apple feel */
const RingTile: React.FC<{
  value: number; label: string; icon: React.ReactNode; delay?: number;
}> = ({ value, label, icon, delay = 0 }) => {
  const r = 60;
  const c = 2 * Math.PI * r;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className="relative w-[150px] h-[150px] flex items-center justify-center rounded-full bg-white border border-black/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
    >
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 150 150">
        <circle cx="75" cy="75" r={r} stroke="#eef0f2" strokeWidth="6" fill="none" />
        <motion.circle
          cx="75" cy="75" r={r} stroke={ACCENT} strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1.4, ease: EASE, delay: delay + 0.2 }}
        />
      </svg>
      <div className="flex flex-col items-center gap-1">
        {icon}
        <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: SUB }}>{label}</span>
      </div>
    </motion.div>
  );
};

/* ───────────────────────── Hero ───────────────────────── */
const Hero: React.FC<{ onScroll: () => void }> = ({ onScroll }) => (
  <section id="top" className="relative w-full h-[100dvh] snap-start overflow-hidden flex flex-col" style={{ background: BG }}>
    {/* soft halo */}
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        background:
          "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(10,125,122,0.08), transparent 60%)",
      }}
    />

    <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 pt-24">
      <motion.h1
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="text-center text-[clamp(2rem,4vw,3.25rem)] font-semibold tracking-tight leading-[1.05]"
        style={{ color: INK }}
      >
        Air. Water. Energy. <span style={{ color: ACCENT }}>Awards.</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="mt-3 text-[15px] font-medium" style={{ color: SUB }}
      >
        The sustainability fusion of your data.
      </motion.p>

      <div className="mt-12 grid grid-cols-2 xl:grid-cols-4 gap-6 lg:gap-8">
        <RingTile value={60} label="Water"  icon={<Droplet className="w-6 h-6" style={{ color: ACCENT }} strokeWidth={1.5} />} delay={0.0} />
        <RingTile value={75} label="Air"    icon={<Cloud   className="w-6 h-6" style={{ color: ACCENT }} strokeWidth={1.5} />} delay={0.1} />
        <RingTile value={90} label="Energy" icon={<Zap     className="w-6 h-6" style={{ color: ACCENT }} strokeWidth={1.5} />} delay={0.2} />
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
          className="w-[150px] h-[150px] flex items-center justify-center rounded-full bg-white border border-black/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
        >
          <img src="/leed_logo.png" alt="LEED" className="w-[78px] h-[78px] object-contain" />
        </motion.div>
      </div>
    </div>

    {/* Marquee — clean, seamless */}
    <div id="clients" className="relative z-10 border-y border-black/[0.06] bg-foreground/70 backdrop-blur-md py-3 overflow-hidden">
      <div className="flex w-max animate-marquee">
        {[0, 1].map((k) => (
          <ul key={k} className="flex shrink-0 items-center">
            {OFFICES.map((c) => (
              <li key={`${k}-${c}`} className="px-6 text-[11px] tracking-[0.18em] uppercase font-medium" style={{ color: SUB }}>
                {c}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>

    <button
      onClick={onScroll}
      className="relative z-10 mx-auto mb-8 mt-4 flex flex-col items-center gap-1 transition-colors"
      style={{ color: SUB }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Scroll</span>
      <ChevronDown className="w-4 h-4 animate-bounce" />
    </button>
  </section>
);

/* ───────────────────────── Slide ───────────────────────── */
interface SlideProps {
  index: number;
  isExpanded: boolean;
  isFlipped: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onFlip: (state: boolean) => void;
  title: string;
  sub: string;
  cta: string;
  visual: React.ReactNode;
  backTitle: string;
  backDesc: string;
  backBullets: string[];
  backVideo?: string;
}

const InteractiveSlide: React.FC<SlideProps> = ({
  isExpanded, isFlipped, onExpand, onCollapse, onFlip,
  title, sub, cta, visual, backTitle, backDesc, backBullets, backVideo,
}) => {
  return (
    <li
      className={`snap-center shrink-0 relative transition-[width,height] duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isExpanded
          ? "w-0 h-0 invisible"
          : "w-[min(880px,86%)] h-[min(580px,72vh)] cursor-pointer"
      }`}
      onClick={() => { if (!isExpanded) onExpand(); }}
      style={{ perspective: "1500px" }}
    >
      {!isExpanded && (
        <div
          className="absolute inset-0 rounded-[28px] overflow-hidden bg-white border border-black/[0.06] shadow-[0_20px_50px_rgba(0,0,0,0.06)] p-8 flex flex-col transition-transform duration-500 hover:-translate-y-1"
        >
          <h3 className="text-[22px] font-semibold tracking-tight leading-snug" style={{ color: INK }}>{title}</h3>
          <p className="mt-2 text-[13px]" style={{ color: SUB }}>{sub}</p>
          <div className="flex-1 min-h-0 mt-4 flex items-center justify-center">{visual}</div>
          <div className="mt-4 flex items-center gap-1 text-[12px] font-semibold" style={{ color: ACCENT }}>
            {cta} <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      )}
    </li>
  );
};

/* Expanded overlay rendered at section level so it fills the panel cleanly */
interface SlideData {
  title: string;
  sub: string;
  cta: string;
  visual: React.ReactNode;
  backTitle: string;
  backDesc: string;
  backBullets: string[];
  backVideo?: string;
}
interface ExpandedProps {
  slide: SlideData;
  isFlipped: boolean;
  onClose: () => void;
  onFlip: (s: boolean) => void;
}
const ExpandedSlide: React.FC<ExpandedProps> = ({ slide, isFlipped, onClose, onFlip }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.97 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.97 }}
    transition={{ duration: 0.45, ease: EASE }}
    className="fixed inset-0 z-[60] lg:left-[clamp(360px,35vw,520px)]"
    style={{ perspective: "1800px" }}
  >
    <div
      className="relative w-full h-full transition-transform duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]"
      style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0)" }}
    >
      {/* Front */}
      <div
        className="absolute inset-0 overflow-hidden bg-white grid grid-cols-1 lg:grid-cols-2"
        style={{ backfaceVisibility: "hidden" }}
      >
        <div className="p-10 lg:p-12 flex flex-col justify-center">
          <h2 className="text-[clamp(1.75rem,2.5vw,2.5rem)] font-semibold tracking-tight leading-tight" style={{ color: INK }}>
            {slide.title}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed max-w-[40ch]" style={{ color: SUB }}>{slide.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => onFlip(true)}
              className="px-6 py-3 rounded-full text-[13px] font-semibold text-foreground transition-transform hover:scale-[1.02]"
              style={{ background: ACCENT }}
            >
              {slide.cta}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-full text-[13px] font-medium border border-black/10 hover:bg-black/[0.04] transition-colors"
              style={{ color: INK }}
            >
              Close
            </button>
          </div>
        </div>
        <div className="relative flex items-center justify-center p-8 lg:p-12 bg-[#fafafa] overflow-hidden">
          {slide.visual}
        </div>

        {/* Top-right close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white border border-black/10 flex items-center justify-center hover:bg-black/[0.04] transition-colors z-10"
        >
          <X className="w-4 h-4" style={{ color: INK }} />
        </button>
      </div>

      {/* Back */}
      <div
        className="absolute inset-0 overflow-hidden bg-white grid grid-cols-1 lg:grid-cols-2"
        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
      >
        <div className="p-10 lg:p-12 flex flex-col justify-center">
          <h3 className="text-[clamp(1.5rem,2.2vw,2rem)] font-semibold tracking-tight" style={{ color: INK }}>
            {slide.backTitle}
          </h3>
          <p className="mt-4 text-[14px] leading-relaxed max-w-[44ch]" style={{ color: SUB }}>{slide.backDesc}</p>
          <ul className="mt-6 space-y-3">
            {slide.backBullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px]" style={{ color: INK }}>
                <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ACCENT }} />
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => onFlip(false)}
              className="px-6 py-3 rounded-full text-[13px] font-medium border border-black/10 hover:bg-black/[0.04] transition-colors"
              style={{ color: INK }}
            >
              ← Back
            </button>
          </div>
        </div>
        <div className="relative bg-[#0b0b0c] overflow-hidden">
          {slide.backVideo ? (
            <video src={slide.backVideo} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-90" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-foreground/40 text-sm">Preview video</div>
          )}
        </div>

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-foreground/90 backdrop-blur border border-black/10 flex items-center justify-center hover:bg-white transition-colors z-10"
        >
          <X className="w-4 h-4" style={{ color: INK }} />
        </button>
      </div>
    </div>
  </motion.div>
);

/* ───────────────────────── Carousel ───────────────────────── */
const SLIDES: SlideData[] = [
  {
    title: "Device-level visibility across structures.",
    sub: "Your portfolio in one place.",
    cta: "Discover more",
    backTitle: "Your entire energy ecosystem. Instantly synchronized.",
    backDesc:
      "Take your KPIs anywhere. Prevent anomalies in real time and reduce operational costs by up to 25% thanks to predictive intelligence.",
    backBullets: [
      "Multi-device real-time monitoring",
      "Load anomaly notifications",
      "Automatic monthly consumption forecasts",
    ],
    backVideo: "/videos/app-nav.mp4",
    visual: (
      <div className="relative w-full h-full flex items-end justify-center">
        <img src="/FGB_Mac.png" className="relative z-10 w-[70%] drop-shadow-[0_30px_50px_rgba(0,0,0,0.18)] translate-y-1" />
        <img src="/FGB_Pad.png" className="absolute z-20 w-[22%] left-[6%] bottom-[6%] drop-shadow-[0_20px_40px_rgba(0,0,0,0.18)]" />
        <img src="/FGB_Phone.png" className="absolute z-30 w-[12%] right-[8%] bottom-[10%] drop-shadow-[0_20px_40px_rgba(0,0,0,0.22)]" />
      </div>
    ),
  },
  {
    title: "A single platform. All your KPIs in one place.",
    sub: "Complex data transformed into actionable visualizations.",
    cta: "Flip the card",
    backTitle: "Intelligence that anticipates.",
    backDesc:
      "Stop reacting to failures and start preventing them. Algorithms analyze consumption patterns to identify structural inefficiencies.",
    backBullets: [
      "Automatic out-reange detection",
      "Air quality predictive analysis",
      "Net-zero target tracking",
    ],
    backVideo: "/videos/dashboard.mp4",
    visual: (
      <div className="grid grid-cols-3 gap-4 w-full h-full max-h-[320px]">
        <CarbonCard />
        <HeatmapCard />
        <CO2Card />
      </div>
    ),
  },
  {
    title: "Your path to Sustainability excellence. Precisely measured.",
    sub: "Real-time updated scores for global certifications.",
    cta: "Monitor your certifications",
    backTitle: "Turn compliance into competitive advantage.",
    backDesc:
      "We automate data collection for LEED, BREEAM, and WELL. Get audit-ready reports with a single click.",
    backBullets: [
      "Automatic mapping to ESG frameworks",
      "Audit-ready export to PDF",
      "Public sharing of milestones",
    ],
    backVideo: "/videos/report.mp4",
    visual: (
      <div className="grid grid-cols-2 md:grid-cols-4 items-center justify-items-center gap-x-8 md:gap-x-10 gap-y-10 md:gap-y-12 w-full max-w-[600px] mx-auto">
        {[
          { src: "/leed_logo.png", alt: "LEED" },
          { src: "/breeam_logo.png", alt: "BREEAM" },
          { src: "/well_logo.png", alt: "WELL" },
          { src: "/life_logo.png", alt: "LIFE" },
          { src: "/fitwel_logo.png", alt: "fitwel" },
          { src: "/logo_gresb.png", alt: "GRESB" },
          { src: "/Logo_ESG.png", alt: "ESG" },
          { src: "/envision.png", alt: "envision" },
        ].map((logo) => (
          <div key={logo.alt} className="flex items-center justify-center h-14 w-28">
            <img src={logo.src} alt={logo.alt} className="max-h-full max-w-full object-contain opacity-80" />
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "Optimize waste. Your building's lifecycle.",
    sub: "24/7 distributive analysis of energy loads.",
    cta: "Analyze waste",
    backTitle: "Cut the invisible waste.",
    backDesc:
      "We identify anomalous baseloads and nighttime energy leaks, allowing you to reschedule your systems.",
    backBullets: [
      "Vampire load identification",
      "Day vs. night comparison",
      "Optimization suggestions",
    ],
    backVideo: "/videos/analysis.mp4",
    visual: (
      <div className="relative w-[220px] h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={dayNightData} cx="50%" cy="50%" innerRadius="76%" outerRadius="100%" dataKey="value" startAngle={90} endAngle={-270} stroke="none">
              {dayNightData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold" style={{ color: INK }}>1,240</span>
          <span className="text-[10px] font-medium uppercase tracking-widest mt-1" style={{ color: SUB }}>kWh total</span>
        </div>
      </div>
    ),
  },
  {
    title: "From paper chaos to absolute clarity.",
    sub: "Upload your historical bills. The FGB AI extracts data instantly.",
    cta: "Discover our OCR",
    backTitle: "Historical data, immediately actionable.",
    backDesc:
      "Upload PDFs of your old bills: our AI is trained to extract costs, consumption, and penalties in just a few seconds.",
    backBullets: [
      "Data extraction powered by FGB AI",
      "Automatic baseline creation",
      "Validation of anomalous bills",
    ],
    backVideo: "/videos/ocr-scan.mp4",
    visual: (
      <div className="relative w-full max-w-[280px] aspect-[3/4] bg-white border border-black/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] overflow-hidden">
        <div className="absolute inset-0 p-4">
          <div className="h-3 w-1/2 bg-gray-200 rounded mb-3" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-2 bg-gray-100 rounded mb-2" style={{ width: `${60 + Math.random() * 40}%` }} />
          ))}
        </div>
        <motion.div
          animate={{ top: ["-5%", "105%", "-5%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute left-0 right-0 h-[2px]"
          style={{ background: ACCENT, boxShadow: `0 0 12px ${ACCENT}` }}
        />
      </div>
    ),
  },
];

/* ───────────────────────── Main ───────────────────────── */
const FloatingBentoPanel: React.FC = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLUListElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);
  const [hovering, setHovering] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const total = SLIDES.length;
  const isInteracting = expandedIndex !== null || hovering;

  // autoplay
  useEffect(() => {
    if (isInteracting) return;
    const id = setInterval(() => {
      setCurrentSlide((i) => {
        const next = (i + 1) % total;
        const ul = carouselRef.current;
        if (ul) {
          const first = ul.firstElementChild as HTMLElement | null;
          if (first) ul.scrollTo({ left: next * (first.offsetWidth + 24), behavior: "smooth" });
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [isInteracting, total]);

  const handleScroll = useCallback(() => {
    const ul = carouselRef.current;
    if (!ul) return;
    const first = ul.firstElementChild as HTMLElement | null;
    if (!first) return;
    const idx = Math.round(ul.scrollLeft / (first.offsetWidth + 24));
    setCurrentSlide(Math.min(Math.max(idx, 0), total - 1));
  }, [total]);

  const handleClose = useCallback(() => {
    setExpandedIndex(null);
    setFlippedIndex(null);
  }, []);

  const scrollToSolution = () =>
    scrollerRef.current?.scrollBy({ top: window.innerHeight, behavior: "smooth" });

  const scrollToSection = (id: string) => {
    const el = scrollerRef.current?.querySelector(`#${id}`) as HTMLElement | null;
    if (el && scrollerRef.current) {
      scrollerRef.current.scrollTo({ top: el.offsetTop, behavior: "smooth" });
    }
  };

  return (
    <div
      ref={scrollerRef}
      className="flex-1 w-full h-[100dvh] overflow-y-auto overflow-x-hidden snap-y snap-mandatory scroll-smooth"
      style={{ background: BG, scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`.fb-scroll::-webkit-scrollbar{display:none}`}</style>

      {/* Top nav */}
       <nav className={`fixed top-0 right-0 w-full lg:w-[calc(100%-clamp(360px,35vw,520px))] z-50 flex items-center justify-between px-8 py-5 pointer-events-none transition-opacity duration-300 ${expandedIndex !== null ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-8 text-[13px] font-medium pointer-events-auto" style={{ color: INK }}>
          <button onClick={() => scrollToSection('solution')} className="hover:text-emerald-400 transition-colors">Our Solution</button>
          <button onClick={() => scrollToSection('values')} className="hover:text-emerald-400 transition-colors">Our Values</button>
          <button onClick={() => scrollToSection('pricing')} className="hover:text-emerald-400 transition-colors">Our Pricing</button>
          <button onClick={() => scrollToSection('cta')} className="hover:text-emerald-400 transition-colors">Our Goal</button>
        </div>

        {/* TASTO REQUEST ACCESS (Mantenuto fisso a destra) */}
        <a href="mailto:fgb@fgb-studio.com" className="pointer-events-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-foreground text-xs font-bold uppercase tracking-wider rounded-full transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] ml-auto">
          Request access →
        </a>
      </nav>

      <Hero onScroll={scrollToSolution} />

      {/* Our Solution — carousel */}
      <section
        id="solution"
        className="relative w-full h-[100dvh] snap-start flex flex-col items-center justify-center"
        style={{ background: BG }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="w-full max-w-[1280px] mx-auto px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: ACCENT }}>Our Solution</p>
          <h2 className="text-[clamp(1.75rem,2.5vw,2.25rem)] font-semibold tracking-tight" style={{ color: INK }}>
            One platform. Every metric that matters.
          </h2>
        </div>

        <ul
          ref={carouselRef}
          onScroll={handleScroll}
          className="fb-scroll flex overflow-x-auto snap-x snap-mandatory gap-6 px-[6vw] w-full items-center pt-8 pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {SLIDES.map((s, i) => (
            <InteractiveSlide
              key={i}
              index={i}
              isExpanded={expandedIndex === i}
              isFlipped={flippedIndex === i}
              onExpand={() => setExpandedIndex(i)}
              onCollapse={handleClose}
              onFlip={(state) => setFlippedIndex(state ? i : null)}
              {...s}
            />
          ))}
        </ul>

        {expandedIndex !== null && (
          <ExpandedSlide
            slide={SLIDES[expandedIndex]}
            isFlipped={flippedIndex === expandedIndex}
            onClose={handleClose}
            onFlip={(state) => setFlippedIndex(state ? expandedIndex : null)}
          />
        )}

        {/* nav pill */}
        {expandedIndex === null && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-3 z-30 flex items-center gap-5 px-5 py-2.5 rounded-full bg-white border border-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <button
              onClick={() => carouselRef.current?.scrollBy({ left: -window.innerWidth * 0.6, behavior: "smooth" })}
              className="hover:opacity-100 opacity-60 transition-opacity"
              aria-label="Precedente"
            >
              <ChevronLeft className="w-4 h-4" style={{ color: INK }} />
            </button>
            <div className="flex gap-2">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className="transition-all duration-300"
                  style={{
                    width: currentSlide === i ? 18 : 6, height: 6, borderRadius: 999,
                    background: currentSlide === i ? ACCENT : "#d4d4d8",
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => carouselRef.current?.scrollBy({ left: window.innerWidth * 0.6, behavior: "smooth" })}
              className="hover:opacity-100 opacity-60 transition-opacity"
              aria-label="Successivo"
            >
              <ChevronRight className="w-4 h-4" style={{ color: INK }} />
            </button>
          </div>
        )}

        {/* Bottom fade: morbida sfumatura verso la sezione dashboard sottostante */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 z-20"
          style={{ background: `linear-gradient(to top, ${BG} 0%, ${BG} 30%, rgba(251,251,253,0) 100%)` }}
        />
      </section>

      {/* Pricing & lead gen */}
      <section id="pricing" className="relative w-full min-h-[100dvh] snap-start flex items-center justify-center px-8 py-20" style={{ background: SURFACE }}>
        <div className="w-full max-w-[1200px] grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Zero */}
          <div className="rounded-3xl border border-black/[0.06] bg-white p-8 flex flex-col shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <h3 className="text-[20px] font-semibold tracking-tight" style={{ color: INK }}>Zero</h3>
            <p className="mt-1 text-[13px]" style={{ color: SUB }}>Entry-level building monitoring.</p>
            <div className="mt-6 text-4xl font-semibold" style={{ color: INK }}>€0</div>
            <ul className="mt-6 space-y-2.5 flex-1">
              {["1 Site view", "Standard Dashboard", "Email notification"].map((b) => (
                <li key={b} className="flex items-center gap-2 text-[13px]" style={{ color: SUB }}>
                  <span className="w-1 h-1 rounded-full" style={{ background: SUB }} /> {b}
                </li>
              ))}
            </ul>
            <button className="mt-8 py-3 rounded-xl border border-black/10 text-[13px] font-semibold hover:bg-black/[0.04] transition-colors" style={{ color: INK }}>
              Get started
            </button>
          </div>

          {/* Custom */}
          <div className="rounded-3xl border p-8 flex flex-col relative shadow-[0_20px_40px_rgba(10,125,122,0.08)]" style={{ borderColor: `${ACCENT}33`, background: `linear-gradient(180deg, #ffffff, ${ACCENT}08)` }}>
            <span className="absolute top-0 right-0 text-[10px] font-semibold uppercase tracking-widest text-foreground px-3 py-1 rounded-bl-xl rounded-tr-3xl" style={{ background: ACCENT }}>
              Enterprise
            </span>
            <h3 className="text-[20px] font-semibold tracking-tight" style={{ color: INK }}>Custom</h3>
            <p className="mt-1 text-[13px]" style={{ color: SUB }}>Full ecosystem fusion & predictive AI.</p>
            <div className="mt-6 text-4xl font-semibold" style={{ color: ACCENT }}>Custom</div>
            <ul className="mt-6 space-y-2.5 flex-1">
              {["Multi-site portfolio", "OCR module & ESG gamification", "Dedicated API & FGB-AI based predictive"].map((b) => (
                <li key={b} className="flex items-center gap-2 text-[13px]" style={{ color: INK }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} /> {b}
                </li>
              ))}
            </ul>
            <button className="mt-8 py-3 rounded-xl text-[13px] font-semibold text-foreground transition-transform hover:scale-[1.01]" style={{ background: ACCENT }}>
              Build your plan
            </button>
          </div>

          {/* Form */}
          <div className="rounded-3xl border border-black/[0.06] bg-white p-8 flex flex-col shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            <h3 className="text-[20px] font-semibold tracking-tight" style={{ color: INK }}>Accelerate your transition</h3>
            <p className="mt-1 text-[13px]" style={{ color: SUB }}>Talk directly to our implementation engineers.</p>
            <form className="mt-6 space-y-3 flex-1 flex flex-col">
              <input type="text" placeholder="Full Name" className="h-11 rounded-xl border border-black/10 px-4 text-[13px] outline-none focus:border-[#0a7d7a] transition-colors" />
              <input type="email" placeholder="Company Email" className="h-11 rounded-xl border border-black/10 px-4 text-[13px] outline-none focus:border-[#0a7d7a] transition-colors" />
              <input type="text" placeholder="Company Name" className="h-11 rounded-xl border border-black/10 px-4 text-[13px] outline-none focus:border-[#0a7d7a] transition-colors" />
              <textarea placeholder="Introduce your portfolio.." rows={3} className="rounded-xl border border-black/10 px-4 py-3 text-[13px] outline-none focus:border-[#0a7d7a] transition-colors resize-none" />
              <button type="button" className="mt-2 py-3 rounded-xl text-[13px] font-semibold text-foreground transition-transform hover:scale-[1.01] flex items-center justify-center gap-2" style={{ background: INK }}>
                Contact sales <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Final CTA + Footer (grouped into one snap viewport) */}
      <div
        className="relative w-full min-h-[100dvh] snap-start flex flex-col"
        style={{ background: SURFACE }}
      >
      <section
        id="cta"
        className="relative w-full flex-1 flex items-center justify-center px-8 py-16"
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="w-full max-w-[720px] text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="w-6 h-px" style={{ background: ACCENT }} />
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: ACCENT }}
            >
              Ready to start?
            </span>
          </div>
          <h2
            className="text-[clamp(2.25rem,4.5vw,3.75rem)] font-semibold leading-[1.05] tracking-tight"
            style={{ color: INK }}
          >
            Your buildings are talking.
            <br />
            <span style={{ color: ACCENT }}>Are you listening?</span>
          </h2>
          <p
            className="mt-6 text-[15px] leading-relaxed mx-auto max-w-[560px]"
            style={{ color: SUB }}
          >
            Join 47 buildings already monitored by FGB. Setup takes under a week.
            Your data starts speaking the same day sensors go live.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              className="h-12 px-7 rounded-full text-[14px] font-semibold text-foreground transition-transform hover:scale-[1.02] shadow-[0_10px_30px_rgba(10,125,122,0.25)]"
              style={{ background: ACCENT }}
            >
              Request access →
            </button>
            <button
              type="button"
              className="h-12 px-7 rounded-full text-[14px] font-semibold border border-black/15 hover:bg-black/[0.04] transition-colors"
              style={{ color: INK }}
              onClick={() => setDemoOpen(true)}
            >
              See a live demo
            </button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer
        className="w-full border-t border-black/[0.06] px-8 py-6"
        style={{ background: SURFACE }}
      >
        <div className="w-full max-w-[1200px] mx-auto flex flex-col xl:flex-row items-center justify-between gap-6">
          <div className="text-xl font-semibold tracking-tight" style={{ color: INK }}>
            <span>FG</span>
            <span style={{ color: ACCENT }}>B</span>
          </div>
          <nav className="flex items-center gap-6">
            {["Solution", "Certifications", "Pricing", "Contact", "Privacy"].map((l) => (
              <a
                key={l}
                href="#"
                className="text-[13px] transition-colors hover:text-[color:var(--ink)]"
                style={{ color: SUB }}
                onMouseEnter={(e) => (e.currentTarget.style.color = INK)}
                onMouseLeave={(e) => (e.currentTarget.style.color = SUB)}
              >
                {l}
              </a>
            ))}
          </nav>
          <div className="text-[12px]" style={{ color: SUB }}>
            © 2026 FGB Studio · Future Green Building · All rights reserved
          </div>
        </div>
      </footer>
      </div>
      <DemoRequestModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
};

export default FloatingBentoPanel;
