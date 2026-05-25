import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, ChevronDown, Zap, Leaf, Wind, Droplet, FileText, Sparkles, Cloud } from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from "recharts";

/* ═══════════════════════════════════════════════
   MOCK DATA & CONFIG
   ═══════════════════════════════════════════════ */
const carbonBarData = [{ bucket: "Jan", "2025": 420, "2024": 480 }, { bucket: "Feb", "2025": 390, "2024": 460 }, { bucket: "Mar", "2025": 450, "2024": 500 }, { bucket: "Apr", "2025": 380, "2024": 440 }, { bucket: "May", "2025": 350, "2024": 410 }, { bucket: "Jun", "2025": 400, "2024": 470 }];
const dayNightData = [{ name: "Day", value: 62, fill: "#38bdf8" }, { name: "Night", value: 38, fill: "#334155" }];
const co2LineData = [{ time: "06:00", co2: 410 }, { time: "08:00", co2: 520 }, { time: "10:00", co2: 680 }, { time: "12:00", co2: 750 }, { time: "14:00", co2: 620 }, { time: "16:00", co2: 580 }];
const ocrExtractedData = [{ month: 'Jan', cost: 1240 }, { month: 'Feb', cost: 1100 }, { month: 'Mar', cost: 1350 }, { month: 'Apr', cost: 1080 }];

const waterDistributionData = [
  { name: 'DHW', value: 35, color: '#2563eb' },   
  { name: 'HVAC', value: 28, color: '#3b82f6' },       
  { name: 'Watering', value: 18, color: '#60a5fa' },
  { name: 'Other', value: 19, color: '#93c5fd' },      
];

const axisStyle = { fontSize: 10, fontFamily: "system-ui, -apple-system, sans-serif", fill: "#94a3b8", fontWeight: 400 };
const tooltipStyle = { backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(24px)", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.08)", padding: "8px 12px", border: "1px solid rgba(255,255,255,0.5)", fontSize: 11 };

const appleEase: [number, number, number, number] = [0.25, 1, 0.5, 1]; 

/* ═══════════════════════════════════════════════
   SUB-COMPONENTS (Grafiche Analitiche)
   ═══════════════════════════════════════════════ */
const cardBase = "bg-white/60 backdrop-blur-[32px] border border-white/30 shadow-[0_30px_60px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.7)] rounded-[28px] overflow-hidden w-full h-full flex flex-col p-6 transition-all duration-500 hover:bg-white/70";

const TrueHeatmapCard = () => (
  <div className={cardBase}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-teal-100/50 flex items-center justify-center"><Zap className="w-4 h-4 text-teal-700" strokeWidth={1.5} /></div>
        <div><h4 className="text-xs font-semibold text-gray-800 tracking-tight">Energy Heatmap</h4><p className="text-[10px] text-gray-400 font-medium">Weekly Analysis</p></div>
      </div>
    </div>
    <div className="flex-1 w-full flex flex-col gap-[2px] opacity-80 mt-2">
      {Array.from({length: 12}).map((_, h) => (
        <div key={h} className="flex-1 flex gap-[2px]">
          {Array.from({length: 7}).map((_, d) => {
            const val = Math.random();
            const bg = val > 0.85 ? '#0f766e' : val > 0.6 ? '#14b8a6' : val > 0.35 ? '#5eead4' : val > 0.15 ? '#cffafe' : '#f1f5f9';
            return <div key={d} className="flex-1 rounded-[2px]" style={{ backgroundColor: bg }} />
          })}
        </div>
      ))}
    </div>
  </div>
);

const CarbonCard = () => (
  <div className={cardBase}>
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-emerald-100/50 flex items-center justify-center"><Leaf className="w-4 h-4 text-emerald-700" strokeWidth={1.5} /></div>
      <div><h4 className="text-xs font-semibold text-gray-800 tracking-tight">Carbon Target</h4><p className="text-[10px] text-gray-400 font-medium">YoY Reduction</p></div>
    </div>
    <div className="flex-1 w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={carbonBarData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }} barGap={3}>
          <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} dy={8} /><YAxis tick={axisStyle} axisLine={false} tickLine={false} />
          <Bar dataKey="2025" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={12} /><Bar dataKey="2024" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={12} opacity={0.5} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const CO2Card = () => (
  <div className={cardBase}>
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-sky-100/50 flex items-center justify-center"><Wind className="w-4 h-4 text-sky-700" strokeWidth={1.5} /></div>
      <div><h4 className="text-xs font-semibold text-gray-800 tracking-tight">Air Quality</h4><p className="text-[10px] text-gray-400 font-medium">Indoor CO2 (ppm)</p></div>
    </div>
    <div className="flex-1 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={co2LineData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="time" tick={axisStyle} axisLine={false} tickLine={false} dy={8} /><YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[300, 800]} />
          <Line type="monotone" dataKey="co2" stroke="#0ea5e9" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const ESGRingsCard = () => (
  <div className="w-full bg-[#111111]/80 backdrop-blur-3xl border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-[clamp(20px,3vw,40px)] flex flex-col md:flex-row items-center justify-between overflow-hidden relative" style={{ maxWidth: 'min(90%, 56rem)', padding: 'clamp(1.25rem, 3vw, 2rem)', gap: 'clamp(1rem, 3vw, 3rem)' }}>
    <div className="absolute top-1/2 left-1/4 -translate-y-1/2 bg-emerald-500/20 blur-[100px] rounded-full pointer-events-none" style={{ width: 'clamp(150px, 25vw, 300px)', height: 'clamp(150px, 25vw, 300px)' }} />
    <div className="relative flex items-center justify-center shrink-0 z-10" style={{ width: 'clamp(160px, 22vw, 280px)', height: 'clamp(160px, 22vw, 280px)' }}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 400 400">
        <circle cx="200" cy="200" r="160" stroke="rgba(20,184,166,0.15)" strokeWidth="26" fill="none" />
        <motion.circle cx="200" cy="200" r="160" stroke="#14b8a6" strokeWidth="26" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 15/18 }} transition={{ duration: 2, ease: appleEase }} viewport={{ once: false, amount: 0.5 }} />
        <circle cx="200" cy="200" r="120" stroke="rgba(59,130,246,0.15)" strokeWidth="26" fill="none" />
        <motion.circle cx="200" cy="200" r="120" stroke="#3b82f6" strokeWidth="26" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 8/11 }} transition={{ duration: 2, delay: 0.15, ease: appleEase }} viewport={{ once: false, amount: 0.5 }} />
        <circle cx="200" cy="200" r="80" stroke="rgba(16,185,129,0.15)" strokeWidth="26" fill="none" />
        <motion.circle cx="200" cy="200" r="80" stroke="#10b981" strokeWidth="26" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 14/15 }} transition={{ duration: 2, delay: 0.3, ease: appleEase }} viewport={{ once: false, amount: 0.5 }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center mt-2">
        <span className="text-white font-extrabold tracking-tighter" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)' }}>82<span className="text-gray-500 font-medium" style={{ fontSize: 'clamp(0.625rem, 1vw, 1rem)' }}>/110</span></span>
        <span className="text-[9px] text-gray-400 uppercase tracking-widest mt-1">Total Score</span>
      </div>
    </div>
    <div className="flex-1 flex flex-col justify-center gap-4 z-10 min-w-0" style={{ gap: 'clamp(0.75rem, 1.5vw, 1.5rem)' }}>
      <div className="flex items-center gap-3 md:gap-5 bg-white/5 p-3 md:p-4 rounded-2xl border border-white/10 backdrop-blur-md flex-wrap">
        <span className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold mr-2">Tracked:</span>
        <img src="/leed_logo.png" alt="LEED" className="h-6 md:h-8 object-contain opacity-80" />
        <div className="w-px h-6 bg-white/20" />
        <img src="/breeam_logo.png" alt="BREEAM" className="h-6 md:h-8 object-contain brightness-0 invert opacity-70" />
        <div className="w-px h-6 bg-white/20" />
        <img src="/well_logo.png" alt="WELL" className="h-6 md:h-8 object-contain brightness-0 invert opacity-70" />
      </div>
      <div className="flex flex-col gap-3 md:gap-4 mt-1 md:mt-2">
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-[#14b8a6]" /><span className="text-white text-xs md:text-sm">Energy & Atmosphere</span></div><span className="text-white font-bold text-xs">15/18</span></div>
        <div className="w-full h-px bg-white/10" />
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-[#3b82f6]" /><span className="text-white text-xs md:text-sm">Water Efficiency</span></div><span className="text-white font-bold text-xs">8/11</span></div>
        <div className="w-full h-px bg-white/10" />
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-[#10b981]" /><span className="text-white text-xs md:text-sm">Indoor Env. Quality</span></div><span className="text-white font-bold text-xs">14/15</span></div>
      </div>
    </div>
  </div>
);

const OCRScannerFeature = () => (
  <div className="w-full flex flex-col md:flex-row items-center justify-center gap-6 md:gap-16 z-10 px-4">
    <div className="relative bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden flex flex-col p-5" style={{ width: 'clamp(180px, 28%, 240px)', height: 'clamp(240px, 40vh, 340px)' }}>
      <div className="flex justify-between items-start mb-6 border-b border-gray-200 pb-3"><FileText className="text-gray-300 w-8 h-8" /></div>
      <motion.div animate={{ top: ["-10%", "110%", "-10%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute left-0 right-0 h-[2px] bg-sky-400 shadow-[0_0_12px_3px_rgba(56,189,248,0.6)] z-20" />
    </div>
    <Sparkles className="w-8 h-8 text-sky-500 drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
    <div className="bg-[#111111]/90 backdrop-blur-2xl rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.3)] border border-white/10 flex flex-col p-5" style={{ width: 'clamp(200px, 32%, 280px)', height: 'clamp(240px, 40vh, 340px)' }}>
      <div className="flex items-center gap-3 mb-5"><Zap className="w-4 h-4 text-sky-400" /><div><h4 className="text-xs font-bold text-white">Extracted Costs</h4></div></div>
      <ResponsiveContainer width="100%" height="100%"><BarChart data={ocrExtractedData}><Bar dataKey="cost" fill="#38bdf8" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
    </div>
  </div>
);

// Areogramma radiale esplosivo per la HERO
const RingChart = ({ color, icon: Icon, value, delay }: any) => {
  const colorMap: Record<string, string> = { blue: '#3b82f6', cyan: '#06b6d4', amber: '#f59e0b' };
  const strokeColor = colorMap[color];
  return (
    <div className="relative w-[180px] h-[180px] flex items-center justify-center bg-black/40 rounded-full backdrop-blur-md border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
      <svg className="absolute inset-0 w-full h-full transform -rotate-90">
        <circle cx="90" cy="90" r="76" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="transparent" />
        <motion.circle cx="90" cy="90" r="76" stroke={strokeColor} strokeWidth="8" fill="transparent"
          strokeDasharray="477.5" strokeDashoffset="477.5" strokeLinecap="round"
          initial={{ strokeDashoffset: 477.5 }}
          animate={{ strokeDashoffset: 477.5 * (1 - value / 100) }}
          transition={{ duration: 2, ease: appleEase, delay: delay + 0.5 }}
        />
      </svg>
      <Icon className="w-14 h-14 text-white" />
    </div>
  );
};

/* ═══════════════════════════════════════════════
   ENGINE: INTERACTIVE FLIP SLIDE
   ═══════════════════════════════════════════════ */
const InteractiveSlide = ({ 
  index, isExpanded, isFlipped, onExpand, onFlip, 
  frontTitle, frontSub, frontCta, frontVisual, isDark,
  backTitle, backDesc, backBullets, backVideo 
}: any) => {
  return (
    <li 
      className={`snap-center shrink-0 transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] relative ${isExpanded ? 'w-[92vw] lg:w-[85vw] h-[85vh] z-50' : 'w-[min(85vw,1080px)] h-[min(78vh,800px)] min-h-[420px] cursor-pointer hover:scale-[1.01] z-10'}`}
      onClick={() => { if (!isExpanded) onExpand(); }}
      style={{ perspective: "1500px" }}
    >
      <div 
        className="w-full h-full transition-transform duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] relative"
        style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        
        {/* === LATO A (FRONTE) === */}
        <div 
          className={`absolute inset-0 rounded-[clamp(24px,4vw,48px)] overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.1)] flex flex-col lg:flex-row items-center p-8 lg:p-12 ${isDark ? "bg-[#0a0a0a]" : "bg-white"}`}
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* Testo Espanso (Sinistra) */}
          <div className={`w-full lg:w-[45%] flex flex-col justify-center transition-all duration-700 delay-100 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 absolute pointer-events-none'}`}>
             <h2 className={`text-4xl lg:text-5xl font-bold mb-4 tracking-tighter leading-tight ${isDark ? "text-white" : "text-[#1d1d1f]"}`} dangerouslySetInnerHTML={{ __html: frontTitle }} />
             <p className={`text-lg mb-8 font-medium ${isDark ? "text-white/60" : "text-[#86868b]"}`}>{frontSub}</p>
             <button onClick={(e) => { e.stopPropagation(); onFlip(true); }} className="w-fit px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-full transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                {frontCta} <ChevronRight className="w-5 h-5" />
             </button>
          </div>

          {/* Visual Originale (Trasla a destra se espanso) */}
          <div className={`w-full h-full flex items-center justify-center transition-all duration-700 relative ${isExpanded ? 'lg:w-[55%] scale-100 lg:translate-x-4' : 'w-full scale-100'}`}>
             {/* Header standard se NON espanso */}
             <div className={`absolute top-0 left-0 w-full z-30 pointer-events-none transition-opacity duration-300 ${isExpanded ? 'opacity-0' : 'opacity-100'}`}>
                 <h2 className={`font-semibold tracking-tighter leading-[1.1] ${isDark ? "text-[#f5f5f7]" : "text-[#1d1d1f]"}`} style={{ fontSize: 'clamp(1.5rem, 3.5vw, 52px)' }} dangerouslySetInnerHTML={{ __html: frontTitle }} />
                 <p className={`font-medium tracking-tight mt-2 ${isDark ? "text-[#a1a1a6]" : "text-[#86868b]"}`} style={{ fontSize: 'clamp(0.875rem, 1.5vw, 1.25rem)' }}>{frontSub}</p>
             </div>
             {frontVisual}
          </div>

          {/* Chiudi Espansione */}
          {isExpanded && (
            <button onClick={(e) => { e.stopPropagation(); onExpand(); }} className={`absolute top-6 right-6 p-3 rounded-full backdrop-blur-md border z-50 ${isDark ? "bg-white/10 border-white/20 text-white" : "bg-black/5 border-black/10 text-black"} hover:scale-110 transition-transform`}>
               ✕
            </button>
          )}
        </div>

        {/* === LATO B (RETRO) === */}
        <div 
          className="absolute inset-0 rounded-[clamp(24px,4vw,48px)] overflow-hidden bg-[#0F1410] border border-emerald-500/30 p-8 lg:p-12 flex flex-col lg:flex-row shadow-[0_0_60px_rgba(16,185,129,0.15)]"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <button onClick={(e) => { e.stopPropagation(); onFlip(false); }} className="absolute top-6 right-6 px-5 py-2.5 bg-white/5 border border-white/10 rounded-full text-sm font-bold text-white hover:bg-white/10 backdrop-blur-md z-50 flex items-center gap-2 transition-all">
             ✕ Chiudi
          </button>

          <div className="w-full lg:w-1/2 flex flex-col justify-center pr-0 lg:pr-12 mt-8 lg:mt-0 z-20">
             <h3 className="text-3xl lg:text-5xl font-bold text-emerald-400 tracking-tight leading-tight mb-6">{backTitle}</h3>
             <p className="text-white/70 text-lg lg:text-xl leading-relaxed mb-8">{backDesc}</p>
             <ul className="space-y-4">
               {backBullets.map((bullet: string, i: number) => (
                 <li key={i} className="flex items-start gap-3 text-white/90 font-medium">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.8)]" /> 
                   {bullet}
                 </li>
               ))}
             </ul>
          </div>
          
          <div className="w-full lg:w-1/2 h-64 lg:h-full mt-8 lg:mt-0 rounded-3xl overflow-hidden border border-white/10 bg-black/40 relative shadow-2xl">
             {/* Inserisci qui i path corretti dei tuoi video .mp4 */}
             <video src={backVideo} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-80 mix-blend-screen" />
             <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/20 to-transparent mix-blend-overlay pointer-events-none" />
          </div>
        </div>

      </div>
    </li>
  );
}

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
const FloatingBentoPanel = () => {
  const scrollRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [currentSlide, setCurrentSlide] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);
  
  const totalSlides = 5;
  const isInteracting = expandedIndex !== null || flippedIndex !== null;

  // Autoplay Engine (5s)
  useEffect(() => {
    if (!isInteracting) {
      const interval = setInterval(() => {
        if (scrollRef.current) {
          const firstChild = scrollRef.current.firstElementChild as HTMLElement;
          if (firstChild) {
            const newIndex = (currentSlide + 1) % totalSlides;
            scrollRef.current.scrollTo({ left: newIndex * (firstChild.offsetWidth + 32), behavior: 'smooth' });
          }
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isInteracting, currentSlide]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollLeft = scrollRef.current.scrollLeft;
    const firstChild = scrollRef.current.firstElementChild as HTMLElement;
    if(!firstChild) return;
    const newIndex = Math.round(scrollLeft / (firstChild.offsetWidth + 32));
    setCurrentSlide(Math.min(Math.max(newIndex, 0), totalSlides - 1));
  };

  const handleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
    if (expandedIndex === index) setFlippedIndex(null);
  };

  return (
    <div ref={containerRef} className="flex-1 w-full h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#080C0A] font-sans snap-y snap-mandatory scroll-smooth" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <style>{`::-webkit-scrollbar { display: none; }`}</style>

      {/* === TOP BAR NAVBAR === */}
      <nav className="fixed top-0 right-0 w-full lg:w-[calc(100%-clamp(360px,35vw,520px))] z-50 flex items-center justify-between px-8 py-6 bg-gradient-to-b from-black/80 to-transparent pointer-events-none transition-all">
        <div className="hidden lg:flex space-x-8 text-sm font-medium text-white/70 pointer-events-auto">
          <a href="#solution" className="hover:text-emerald-400 transition-colors">Our Solution</a>
          <a href="#values" className="hover:text-emerald-400 transition-colors">Our Values</a>
          <a href="#clients" className="hover:text-emerald-400 transition-colors">Uffici</a>
          <a href="#pricing" className="hover:text-emerald-400 transition-colors">Our Pricing</a>
        </div>
        <a href="mailto:fgb@fgb-studio.com" className="pointer-events-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold rounded-full transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] ml-auto">
          Request access →
        </a>
      </nav>

      {/* === HERO SECTION === */}
      <section className="w-full h-[100dvh] flex flex-col items-center justify-center relative snap-start overflow-hidden border-b border-white/5">
        
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#080C0A] to-[#080C0A] z-0" />
        
        <div className="z-40 text-center relative mt-[-10vh]">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="text-5xl lg:text-7xl font-bold tracking-tighter text-white mb-4">
            Air. Water. Energy. <br/><span className="text-emerald-500">Awards.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-xl text-white/50 font-medium">
            The sustainability fusion of your data.
          </motion.p>
        </div>

        {/* RADIAL REVEAL CARDS (Da centro verso angoli) */}
        <div className="absolute top-1/2 left-1/2 w-0 h-0 z-20 pointer-events-none">
          <motion.div initial={{ scale: 0, x: "-50%", y: "-50%", opacity: 0 }} whileInView={{ scale: 1, x: "-180%", y: "-150%", opacity: 1 }} transition={{ type: "spring", bounce: 0.4, duration: 1.5 }} viewport={{ once: false }} className="absolute"><RingChart color="cyan" icon={Droplet} value={60} delay={0} /></motion.div>
          <motion.div initial={{ scale: 0, x: "-50%", y: "-50%", opacity: 0 }} whileInView={{ scale: 1, x: "80%", y: "-150%", opacity: 1 }} transition={{ type: "spring", bounce: 0.4, duration: 1.5, delay: 0.1 }} viewport={{ once: false }} className="absolute"><RingChart color="blue" icon={Cloud} value={75} delay={0.1} /></motion.div>
          <motion.div initial={{ scale: 0, x: "-50%", y: "-50%", opacity: 0 }} whileInView={{ scale: 1, x: "-180%", y: "50%", opacity: 1 }} transition={{ type: "spring", bounce: 0.4, duration: 1.5, delay: 0.2 }} viewport={{ once: false }} className="absolute"><RingChart color="amber" icon={Zap} value={90} delay={0.2} /></motion.div>
          <motion.div initial={{ scale: 0, x: "-50%", y: "-50%", opacity: 0 }} whileInView={{ scale: 1, x: "80%", y: "50%", opacity: 1 }} transition={{ type: "spring", bounce: 0.4, duration: 1.5, delay: 0.3 }} viewport={{ once: false }} className="absolute">
            <div className="w-[180px] h-[180px] flex items-center justify-center bg-black/40 rounded-full backdrop-blur-md border border-emerald-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <img src="/leed_logo.png" alt="LEED" className="w-[100px] h-[100px] object-contain opacity-90" />
            </div>
          </motion.div>
        </div>

        {/* MARQUEE UFFICI */}
        <div id="clients" className="absolute bottom-24 left-0 w-full overflow-hidden whitespace-nowrap border-y border-white/5 bg-black/40 backdrop-blur-md py-4 z-40">
          <div className="animate-marquee inline-block text-xs font-mono tracking-widest text-emerald-500/60 uppercase">
            &nbsp;AIX-EN-PROVENCE &nbsp;|&nbsp; AMSTERDAM &nbsp;|&nbsp; DUBAI &nbsp;|&nbsp; HO CHI MINH &nbsp;|&nbsp; LONDON &nbsp;|&nbsp; LOS ANGELES &nbsp;|&nbsp; MIAMI &nbsp;|&nbsp; MILAN &nbsp;|&nbsp; NEW YORK &nbsp;|&nbsp; ROME &nbsp;|&nbsp; SHANGHAI &nbsp;|&nbsp; SINGAPORE &nbsp;|&nbsp; TAICHUNG &nbsp;|&nbsp; TOKYO &nbsp;|&nbsp;
          </div>
        </div>

        <button onClick={() => containerRef.current?.scrollBy({ top: window.innerHeight, behavior: 'smooth' })} className="absolute bottom-6 flex flex-col items-center gap-2 text-white/30 hover:text-white transition-colors z-50 cursor-pointer">
          <span className="text-[10px] font-bold uppercase tracking-widest">Scroll</span>
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </button>
      </section>

      {/* === CAROSELLO INTERATTIVO (Our Solution) === */}
      <section id="solution" className="w-full h-[100dvh] relative snap-start flex flex-col justify-center bg-[#080C0A]">
        <ul ref={scrollRef} onScroll={handleScroll} className="item-container flex overflow-x-auto snap-x snap-mandatory gap-8 px-[7.5vw] w-full items-center h-full pb-16 pt-8" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          
          {/* SLIDE 1: Ecosystem */}
          <InteractiveSlide 
            index={0} isExpanded={expandedIndex === 0} isFlipped={flippedIndex === 0} onExpand={() => handleExpand(0)} onFlip={(s: boolean) => setFlippedIndex(s ? 0 : null)} isDark={true}
            frontTitle="Device level-visibility across different sections and structures." frontSub="Monitoraggio centralizzato per il tuo intero portfolio immobiliare." frontCta="Scopri il potenziale"
            backTitle="Your entire energy ecosystem. Instantly synchronized." backDesc="Non sei legato alla scrivania. Scarica l'app e porta i tuoi KPI ovunque. Previeni le anomalie in tempo reale e riduci fino al 25% i costi operativi grazie all'intelligenza predittiva." backBullets={["Monitoraggio Real-time multi-dispositivo", "Notifiche push per anomalie di carico", "Forecast automatici sui consumi mensili"]} backVideo="/videos/app-nav.mp4"
            frontVisual={
              <div className="w-full h-full flex items-end justify-center relative pb-[5%] mt-12 lg:mt-0">
                <div className="relative z-10 w-[65%] drop-shadow-[0_40px_80px_rgba(0,0,0,0.8)]"><img src="/FGB_Mac.png" className="w-full h-auto" /></div>
                <div className="absolute z-20 w-[25%] -translate-x-[150%] translate-y-[10%] drop-shadow-[0_30px_60px_rgba(0,0,0,0.7)]"><img src="/FGB_Pad.png" className="w-full h-auto" /></div>
                <div className="absolute z-30 w-[14%] translate-x-[200%] -translate-y-[20%] drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]"><img src="/FGB_Phone.png" className="w-full h-auto" /></div>
              </div>
            }
          />

          {/* SLIDE 2: KPIs */}
          <InteractiveSlide 
            index={1} isExpanded={expandedIndex === 1} isFlipped={flippedIndex === 1} onExpand={() => handleExpand(1)} onFlip={(s: boolean) => setFlippedIndex(s ? 1 : null)} isDark={false}
            frontTitle="A single platform. All your KPIs in one place." frontSub="Dati complessi trasformati in visualizzazioni azionabili." frontCta="Gira la card"
            backTitle="Intelligence that anticipates." backDesc="Smetti di reagire ai guasti e inizia a prevenirli. I nostri algoritmi analizzano i pattern di consumo per identificare inefficienze strutturali prima che impattino sul bilancio." backBullets={["Rilevamento automatico delle deviazioni", "Analisi predittiva della qualità dell'aria (CO2/VOC)", "Tracciamento obiettivi net-zero"]} backVideo="/videos/dashboard.mp4"
            frontVisual={
              <div className="relative w-full h-full flex items-center justify-center mt-12 lg:mt-0">
                <div className="absolute w-[35%] lg:w-[28%] h-[65%] -translate-x-[110%] z-10 hidden md:block"><CarbonCard /></div>
                <div className="absolute w-[80%] lg:w-[42%] h-[75%] z-30"><TrueHeatmapCard /></div>
                <div className="absolute w-[35%] lg:w-[28%] h-[65%] translate-x-[110%] z-10 hidden md:block"><CO2Card /></div>
              </div>
            }
          />

          {/* SLIDE 3: ESG */}
          <InteractiveSlide 
            index={2} isExpanded={expandedIndex === 2} isFlipped={flippedIndex === 2} onExpand={() => handleExpand(2)} onFlip={(s: boolean) => setFlippedIndex(s ? 2 : null)} isDark={true}
            frontTitle="Your path to ESG excellence. Precisely measured." frontSub="Punteggi aggiornati in tempo reale per le certificazioni globali." frontCta="Vedi le certificazioni"
            backTitle="Turn compliance into a competitive advantage." backDesc="Raccogliere dati per LEED, BREEAM o WELL richiede mesi di lavoro manuale. Noi lo automatizziamo. Ottieni report pronti per l'audit con un singolo click e condividi i traguardi di sostenibilità con i tuoi stakeholder." backBullets={["Mapping automatico sui framework ESG", "Esportazione audit-ready in PDF/Excel", "Condivisione pubblica dei traguardi ambientali"]} backVideo="/videos/report.mp4"
            frontVisual={<div className="w-full flex justify-center mt-12 lg:mt-0"><ESGRingsCard /></div>}
          />

          {/* SLIDE 4: Waste */}
          <InteractiveSlide 
            index={3} isExpanded={expandedIndex === 3} isFlipped={flippedIndex === 3} onExpand={() => handleExpand(3)} onFlip={(s: boolean) => setFlippedIndex(s ? 3 : null)} isDark={false}
            frontTitle="Optimize waste. Your building's lifecycle." frontSub="Analisi distributiva 24/7 dei carichi energetici." frontCta="Analizza gli sprechi"
            backTitle="Cut the invisible waste." backDesc="Sai davvero quanto consumano i tuoi uffici quando sono vuoti? Identifichiamo i carichi di base anomali e le dispersioni notturne, permettendoti di riprogrammare i sistemi HVAC e tagliare i costi fantasma." backBullets={["Identificazione 'Vampire Loads' (carichi passivi)", "Comparazione efficienza Giorno vs Notte", "Suggerimenti automatici di ottimizzazione"]} backVideo="/videos/analysis.mp4"
            frontVisual={
              <div className="relative w-[250px] lg:w-[350px] h-[250px] lg:h-[350px] mx-auto mt-12 lg:mt-0">
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dayNightData} cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" dataKey="value" startAngle={90} endAngle={-270} stroke="none">{dayNightData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Pie></PieChart></ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-5xl font-bold text-[#1d1d1f]">1,240</span><span className="text-sm font-semibold uppercase tracking-widest text-[#86868b] mt-1">kWh Total</span></div>
              </div>
            }
          />

          {/* SLIDE 5: OCR */}
          <InteractiveSlide 
            index={4} isExpanded={expandedIndex === 4} isFlipped={flippedIndex === 4} onExpand={() => handleExpand(4)} onFlip={(s: boolean) => setFlippedIndex(s ? 4 : null)} isDark={false}
            frontTitle="From paper chaos to absolute clarity." frontSub="Carica le tue bollette storiche. L'AI estrarrà i dati istantaneamente." frontCta="Scopri l'OCR"
            backTitle="Historical data, immediately actionable." backDesc="Nessun inserimento manuale. Carica i PDF delle vecchie bollette: la nostra AI estrae costi, consumi e penali in pochi secondi, creando istantaneamente la tua baseline storica per misurare i futuri risparmi." backBullets={["Estrazione dati guidata dall'AI (zero data-entry)", "Creazione automatica della baseline storica", "Validazione istantanea delle bollette anomale"]} backVideo="/videos/ocr-scan.mp4"
            frontVisual={<div className="mt-12 lg:mt-0 w-full"><OCRScannerFeature /></div>}
          />

        </ul>

        {/* GLASS PILL NAV */}
        {!isInteracting && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-8 z-50 flex items-center gap-6 px-6 py-3 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl transition-all">
            <button onClick={() => scrollRef.current?.scrollBy({ left: -window.innerWidth, behavior: 'smooth' })} className="text-white/50 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
            <div className="flex gap-2.5">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-all ${currentSlide === i ? 'bg-emerald-500 scale-125 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-white/30'}`} />
              ))}
            </div>
            <button onClick={() => scrollRef.current?.scrollBy({ left: window.innerWidth, behavior: 'smooth' })} className="text-white/50 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
          </div>
        )}
      </section>

      {/* === PRICING & LEAD GEN === */}
      <section id="pricing" className="relative min-h-[100dvh] snap-start p-8 lg:p-12 flex items-center justify-center bg-[#050806]">
        <div className="w-full max-w-7xl flex flex-col xl:flex-row gap-8">
          
          <div className="w-full xl:w-[60%] flex flex-col md:flex-row gap-6">
            {/* ZERO PLAN */}
            <div className="flex-1 bg-[#0F1410] border border-white/5 rounded-3xl p-8 flex flex-col justify-between hover:border-emerald-500/20 transition-colors">
               <div>
                 <h3 className="text-2xl font-bold text-white mb-2">Zero</h3>
                 <p className="text-white/40 mb-6 text-sm">Entry level building monitoring.</p>
                 <div className="text-5xl font-bold text-white mb-8">€0</div>
                 <ul className="space-y-3 mb-8">
                    <li className="text-white/60 text-sm flex items-center gap-2"><div className="w-1 h-1 bg-white/40 rounded-full" /> 1 Struttura base</li>
                    <li className="text-white/60 text-sm flex items-center gap-2"><div className="w-1 h-1 bg-white/40 rounded-full" /> Dashboard standard</li>
                 </ul>
               </div>
               <button className="w-full py-4 border border-white/10 text-white rounded-xl font-bold hover:bg-white/5 transition-colors">Get Started</button>
            </div>

            {/* CUSTOM PLAN */}
            <div className="flex-1 bg-gradient-to-b from-[#0F1410] to-emerald-950/20 border border-emerald-500/30 rounded-3xl p-8 relative flex flex-col justify-between shadow-[0_0_40px_rgba(16,185,129,0.1)]">
               <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[10px] font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-widest">Enterprise</div>
               <div>
                 <h3 className="text-2xl font-bold text-white mb-2">Custom</h3>
                 <p className="text-white/40 mb-6 text-sm">Full ecosystem fusion & Predictive AI.</p>
                 <div className="text-5xl font-bold text-emerald-400 mb-8">Custom</div>
                 <ul className="space-y-3 mb-8">
                    <li className="text-white/80 text-sm flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Multi-site portfolio</li>
                    <li className="text-white/80 text-sm flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> Modulo OCR & Gamification ESG</li>
                    <li className="text-white/80 text-sm flex items-center gap-2"><div className="w-1 h-1 bg-emerald-500 rounded-full" /> API dedicate & Predictive AI</li>
                 </ul>
               </div>
               <button className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]">Build your plan</button>
            </div>
          </div>

          {/* FAST CONVERSION FORM */}
          <div className="w-full xl:w-[40%] bg-[#0a0f0c] border border-white/5 rounded-3xl p-8 shadow-2xl flex flex-col justify-center">
            <h3 className="text-2xl font-bold mb-2 text-white">Accelerate your transition</h3>
            <p className="text-sm text-white/40 mb-8">Talk directly to our implementation engineers.</p>
            <form className="space-y-4">
              <input type="text" placeholder="Nome Completo" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-emerald-500 outline-none transition-colors" />
              <input type="email" placeholder="Email Aziendale" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-emerald-500 outline-none transition-colors" />
              <input type="text" placeholder="Nome Azienda" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-emerald-500 outline-none transition-colors" />
              <textarea placeholder="Parlaci delle tue strutture..." rows={3} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-white focus:border-emerald-500 outline-none resize-none transition-colors"></textarea>
              <button type="button" className="w-full bg-white text-black hover:bg-gray-200 font-bold py-4 rounded-xl mt-4 transition-colors flex items-center justify-center gap-2">
                Contact Sales <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      </section>
    </div>
  );
};

export default FloatingBentoPanel;
