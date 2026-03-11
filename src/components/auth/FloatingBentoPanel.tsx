import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronRight, ChevronLeft, ChevronDown, Zap, Leaf, Wind, Droplet, FileText, Sparkles } from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from "recharts";

/* ═══════════════════════════════════════════════
   MOCK DATA & CONFIG
   ═══════════════════════════════════════════════ */
const carbonBarData = [{ bucket: "Jan", "2025": 420, "2024": 480 }, { bucket: "Feb", "2025": 390, "2024": 460 }, { bucket: "Mar", "2025": 450, "2024": 500 }, { bucket: "Apr", "2025": 380, "2024": 440 }, { bucket: "May", "2025": 350, "2024": 410 }, { bucket: "Jun", "2025": 400, "2024": 470 }];
const dayNightData = [{ name: "Day", value: 62, fill: "#38bdf8" }, { name: "Night", value: 38, fill: "#334155" }];
const co2LineData = [{ time: "06:00", co2: 410 }, { time: "08:00", co2: 520 }, { time: "10:00", co2: 680 }, { time: "12:00", co2: 750 }, { time: "14:00", co2: 620 }, { time: "16:00", co2: 580 }];
const miniAreaChartData = [{ value: 15 }, { value: 25 }, { value: 18 }, { value: 45 }, { value: 30 }, { value: 55 }, { value: 48 }];
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
   COMPONENTS
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

// FIX COLORE BASE E ALTEZZA
// Uniformato isDark bg a #0a0a0a
const GalleryItem = ({ headline, subheadline, children, isDark = false }: any) => (
  <li className={`gallery-item snap-center shrink-0 w-[85vw] max-w-[1080px] h-[80vh] min-h-[600px] rounded-[48px] overflow-hidden relative shadow-[0_40px_80px_rgba(0,0,0,0.05)] ${isDark ? "bg-[#0a0a0a]" : "bg-white"}`}>
    <div className="w-full h-full flex flex-col relative pt-40 pb-24">
      <div className="absolute top-12 left-12 right-12 z-30 pointer-events-none flex flex-col gap-2">
        <h2 className={`text-4xl md:text-[52px] font-semibold tracking-tighter leading-[1.1] max-w-3xl ${isDark ? "text-[#f5f5f7]" : "text-[#1d1d1f]"}`} dangerouslySetInnerHTML={{ __html: headline }} />
        {subheadline && <p className={`text-xl md:text-xl font-medium tracking-tight ${isDark ? "text-[#a1a1a6]" : "text-[#86868b]"}`}>{subheadline}</p>}
      </div>
      <figure className="flex-1 w-full relative z-10 flex items-center justify-center overflow-visible mt-8">{children}</figure>
    </div>
  </li>
);

const ESGRingsCard = () => {
  return (
    <div className="w-full max-w-4xl h-[400px] bg-[#111111]/80 backdrop-blur-3xl border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-[40px] p-8 flex items-center justify-between gap-12 overflow-hidden relative">
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-500/20 blur-[100px] rounded-full pointer-events-none" />
      <div className="relative flex items-center justify-center w-[280px] h-[280px] shrink-0 z-10 ml-4">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 400 400">
          <circle cx="200" cy="200" r="160" stroke="rgba(20,184,166,0.15)" strokeWidth="26" fill="none" />
          <motion.circle cx="200" cy="200" r="160" stroke="#14b8a6" strokeWidth="26" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 15/18 }} transition={{ duration: 2, ease: appleEase }} viewport={{ once: false, amount: 0.5 }} />
          <circle cx="200" cy="200" r="120" stroke="rgba(59,130,246,0.15)" strokeWidth="26" fill="none" />
          <motion.circle cx="200" cy="200" r="120" stroke="#3b82f6" strokeWidth="26" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 8/11 }} transition={{ duration: 2, delay: 0.15, ease: appleEase }} viewport={{ once: false, amount: 0.5 }} />
          <circle cx="200" cy="200" r="80" stroke="rgba(16,185,129,0.15)" strokeWidth="26" fill="none" />
          <motion.circle cx="200" cy="200" r="80" stroke="#10b981" strokeWidth="26" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 14/15 }} transition={{ duration: 2, delay: 0.3, ease: appleEase }} viewport={{ once: false, amount: 0.5 }} />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center mt-2">
          <span className="text-white font-extrabold text-4xl tracking-tighter">82<span className="text-base text-gray-500 font-medium">/110</span></span>
          <span className="text-[9px] text-gray-400 uppercase tracking-widest mt-1">Total Score</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-center gap-6 z-10 mr-4">
        <div className="flex items-center gap-5 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
          <span className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold mr-2">Tracked:</span>
          <img src="/leed_logo.png" alt="LEED" className="h-8 object-contain opacity-80 hover:opacity-100 transition-all drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]" />
          <div className="w-px h-6 bg-white/20" />
          <img src="/breeam_logo.png" alt="BREEAM" className="h-8 object-contain brightness-0 invert opacity-70 hover:opacity-100 transition-all drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]" />
          <div className="w-px h-6 bg-white/20" />
          <img src="/well_logo.png" alt="WELL" className="h-8 object-contain brightness-0 invert opacity-70 hover:opacity-100 transition-all drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]" />
        </div>
        <div className="flex flex-col gap-4 mt-2">
          <motion.div initial={{ x: 20, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} transition={{ duration: 1, delay: 0.4 }} className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-[#14b8a6] shadow-[0_0_10px_rgba(20,184,166,0.6)]" /><span className="text-white text-sm font-medium">Energy & Atmosphere</span></div><span className="text-white font-bold font-mono">15/18</span>
          </motion.div>
          <div className="w-full h-px bg-white/10" />
          <motion.div initial={{ x: 20, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} transition={{ duration: 1, delay: 0.5 }} className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.6)]" /><span className="text-white text-sm font-medium">Water Efficiency</span></div><span className="text-white font-bold font-mono">8/11</span>
          </motion.div>
          <div className="w-full h-px bg-white/10" />
          <motion.div initial={{ x: 20, opacity: 0 }} whileInView={{ x: 0, opacity: 1 }} transition={{ duration: 1, delay: 0.6 }} className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-[#10b981] shadow-[0_0_10px_rgba(16,185,129,0.6)]" /><span className="text-white text-sm font-medium">Indoor Env. Quality</span></div><span className="text-white font-bold font-mono">14/15</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const OCRScannerFeature = () => {
  return (
    <div className="w-full flex items-center justify-center gap-6 md:gap-16 z-10 px-4">
      <motion.div initial={{ x: -50, opacity: 0, rotate: -5 }} whileInView={{ x: 0, opacity: 1, rotate: -2 }} transition={{ duration: 1.2, ease: appleEase }} viewport={{ once: false, amount: 0.5 }} className="relative w-[240px] h-[340px] bg-white rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden flex flex-col p-5">
        <div className="flex justify-between items-start mb-6 border-b border-gray-200 pb-3">
          <FileText className="text-gray-300 w-8 h-8" />
          <div className="flex flex-col items-end gap-1"><div className="w-16 h-2 bg-gray-200 rounded" /><div className="w-10 h-2 bg-gray-100 rounded" /></div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between"><div className="w-20 h-2 bg-gray-100 rounded" /><div className="w-12 h-2 bg-gray-200 rounded" /></div>
          <div className="flex justify-between"><div className="w-24 h-2 bg-gray-100 rounded" /><div className="w-10 h-2 bg-gray-200 rounded" /></div>
          <div className="flex justify-between"><div className="w-16 h-2 bg-gray-100 rounded" /><div className="w-14 h-2 bg-gray-200 rounded" /></div>
        </div>
        <div className="mt-auto border-t border-gray-200 pt-3 flex justify-between items-center"><div className="w-12 h-3 bg-gray-300 rounded" /><div className="w-16 h-4 bg-gray-800 rounded" /></div>
        <motion.div animate={{ top: ["-10%", "110%", "-10%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute left-0 right-0 h-[2px] bg-sky-400 shadow-[0_0_12px_3px_rgba(56,189,248,0.6)] z-20" />
        <motion.div animate={{ top: ["-10%", "110%", "-10%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute left-0 right-0 h-16 bg-gradient-to-b from-sky-400/0 via-sky-400/10 to-sky-400/0 z-10 -translate-y-8" />
      </motion.div>

      <div className="flex flex-col items-center gap-3">
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
          <Sparkles className="w-8 h-8 text-sky-500 drop-shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
        </motion.div>
        <div className="flex items-center gap-1.5 h-4">
          {[0, 1, 2].map((i) => (
            <motion.div key={i} animate={{ x: [0, 20, 0], opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }} className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          ))}
        </div>
      </div>

      <motion.div initial={{ x: 50, opacity: 0, rotate: 5 }} whileInView={{ x: 0, opacity: 1, rotate: 2 }} transition={{ duration: 1.2, ease: appleEase }} viewport={{ once: false, amount: 0.5 }} className="w-[280px] h-[340px] bg-[#111111]/90 backdrop-blur-2xl rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.15)] border border-white/10 flex flex-col p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center"><Zap className="w-4 h-4 text-sky-400" /></div>
          <div><h4 className="text-xs font-bold text-white tracking-tight">Extracted Costs</h4><p className="text-[9px] text-gray-400 font-medium">Historical Data Sync</p></div>
        </div>
        <div className="flex-1 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ocrExtractedData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }} barGap={4}>
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} dy={8} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <Bar dataKey="cost" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={20}>
                {ocrExtractedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === ocrExtractedData.length - 1 ? "#38bdf8" : "#334155"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
};


/* ═══════════════════════════════════════════════
   MAIN COMPONENT: THE MATRIX SCROLL
   ═══════════════════════════════════════════════ */
const FloatingBentoPanel = () => {
  const scrollRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 5;

  const handleScroll = () => {
    if (!scrollRef.current) return;
    
    const scrollLeft = scrollRef.current.scrollLeft;
    const firstChild = scrollRef.current.firstElementChild as HTMLElement;
    if(!firstChild) return;
    
    const itemWidthWithGap = firstChild.offsetWidth + 32; 
    
    const newIndex = Math.round(scrollLeft / itemWidthWithGap);
    
    setCurrentSlide(Math.min(Math.max(newIndex, 0), totalSlides - 1));
  };

  const scrollToSlide = (index: number) => {
    if (!scrollRef.current) return;
    
    const firstChild = scrollRef.current.firstElementChild as HTMLElement;
    if(!firstChild) return;

    const itemWidthWithGap = firstChild.offsetWidth + 32; 
    
    scrollRef.current.scrollTo({ 
      left: index * itemWidthWithGap, 
      behavior: 'smooth' 
    });
  };

  const scrollLeft = () => scrollToSlide(Math.max(0, currentSlide - 1));
  const scrollRight = () => scrollToSlide(Math.min(totalSlides - 1, currentSlide + 1));

  const scrollToGallery = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 w-full h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#fbfbfd] font-sans snap-y snap-mandatory scroll-smooth" 
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <style>{`::-webkit-scrollbar { display: none; }`}</style>

      {/* ═════ SEZIONE 1: THE CONVERGENCE HERO ═════ */}
      <section className="w-full h-[100dvh] flex flex-col items-center justify-center relative snap-start overflow-hidden">
        
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2.5, delay: 1.0, ease: appleEase }}
          viewport={{ once: false, amount: 0.5 }}
          className="absolute m-auto w-[600px] h-[600px] bg-gradient-to-tr from-teal-200/40 via-sky-200/30 to-blue-300/30 rounded-full blur-[120px] z-0 pointer-events-none"
        />

        <div className="relative w-full max-w-4xl aspect-[21/9] flex items-center justify-center z-10 -mt-32">
          
          <motion.div
            initial={{ x: -300, y: -200, scale: 0.5, opacity: 0, filter: "blur(20px)" }}
            whileInView={{ x: -140, y: -70, scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.8, ease: appleEase }}
            viewport={{ once: false, amount: 0.5 }}
            className="absolute w-[200px] h-[160px] bg-white/70 backdrop-blur-2xl rounded-[24px] shadow-[0_30px_60px_rgba(20,184,166,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 flex flex-col p-4 z-20"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-gray-800 tracking-tight">ENERGY HEATMAP</span>
            </div>
            <div className="flex-1 w-full flex flex-col gap-[2px] opacity-90">
              {Array.from({length: 12}).map((_, h) => (
                <div key={h} className="flex-1 flex gap-[2px]">
                  {Array.from({length: 7}).map((_, d) => {
                    const val = Math.random();
                    const bg = val > 0.85 ? '#0f766e' : val > 0.6 ? '#14b8a6' : val > 0.35 ? '#5eead4' : val > 0.15 ? '#cffafe' : '#f1f5f9';
                    return <div key={d} className="flex-1 rounded-[1.5px]" style={{ backgroundColor: bg }} />
                  })}
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ x: 300, y: -200, scale: 0.5, opacity: 0, filter: "blur(20px)" }}
            whileInView={{ x: 140, y: -50, scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.8, delay: 0.1, ease: appleEase }}
            viewport={{ once: false, amount: 0.5 }}
            className="absolute w-[150px] h-[150px] bg-white/70 backdrop-blur-2xl rounded-[24px] shadow-[0_30px_60px_rgba(14,165,233,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 flex flex-col items-center justify-center p-4 z-30"
          >
            <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mb-1 text-center">Indoor Air<br/>Quality</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-5xl font-bold tracking-tighter text-gray-900">412</span>
            </div>
            <span className="text-[10px] text-gray-400 font-medium mb-3">ppm CO₂</span>
            <div className="text-[8px] px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 font-bold tracking-wide border border-emerald-200">
              EXCELLENT
            </div>
          </motion.div>

          <motion.div
            initial={{ x: -300, y: 200, scale: 0.5, opacity: 0, filter: "blur(20px)" }}
            whileInView={{ x: -120, y: 100, scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.8, delay: 0.15, ease: appleEase }}
            viewport={{ once: false, amount: 0.5 }}
            className="absolute w-[160px] h-[160px] bg-white/70 backdrop-blur-2xl rounded-[24px] shadow-[0_30px_60px_rgba(59,130,246,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 flex flex-col p-4 z-25"
          >
            <span className="text-[9px] font-bold text-gray-800 tracking-tight text-center">WATER DIST.</span>
            <div className="flex-1 w-full relative mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={waterDistributionData} 
                    innerRadius="55%" 
                    outerRadius="85%" 
                    paddingAngle={3} 
                    dataKey="value" 
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {waterDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <Droplet className="w-5 h-5 text-blue-500 fill-blue-500/20" strokeWidth={2} />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ x: 300, y: 200, scale: 0.5, opacity: 0, filter: "blur(20px)" }}
            whileInView={{ x: 110, y: 110, scale: 1, opacity: 1, filter: "blur(0px)" }}
            transition={{ duration: 1.8, delay: 0.25, ease: appleEase }}
            viewport={{ once: false, amount: 0.5 }}
            className="absolute w-[140px] h-[140px] bg-white/70 backdrop-blur-2xl rounded-[24px] shadow-[0_30px_60px_rgba(16,185,129,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 flex flex-col items-center justify-center p-4 z-20"
          >
            <img src="/leed_logo.png" alt="LEED Certified" className="w-14 h-14 object-contain mb-3 drop-shadow-sm" />
            <span className="text-[9px] font-extrabold text-gray-800 tracking-wider text-center uppercase">Certified<br/>Building</span>
          </motion.div>

        </div>

        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(12px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.6, delay: 1.2, ease: appleEase }}
          viewport={{ once: false, amount: 0.5 }}
          className="absolute bottom-[18%] text-center z-40 flex flex-col items-center px-4"
        >
          <h1 className="text-5xl md:text-7xl lg:text-[84px] font-semibold tracking-tighter text-[#1d1d1f] leading-[1.05]">
            Air. Water. Energy. Awards. <br />
            <span className="text-[#86868b]">The sustainability fusion of your data.</span>
          </h1>
        </motion.div>

        <motion.button 
          onClick={scrollToGallery}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 1 }}
          className="absolute bottom-8 flex flex-col items-center gap-3 text-[#86868b] hover:text-[#1d1d1f] transition-colors cursor-pointer z-50"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em]">Scroll to explore</span>
          <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
            <ChevronDown className="w-5 h-5" strokeWidth={2} />
          </motion.div>
        </motion.button>
      </section>

      {/* ═════ SEZIONE 2: HORIZONTAL GALLERY ═════ */}
      <section className="w-full h-[100dvh] relative snap-start flex flex-col justify-center">
        
        <ul 
          ref={scrollRef} 
          onScroll={handleScroll}
          className="item-container flex overflow-x-auto snap-x snap-mandatory gap-8 px-[7.5vw] w-full items-center h-full" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* SLIDE 1: FIXATO IL NERO DI SFONDO E SPOSTATO IL MAC IN BASSO */}
          <GalleryItem 
            isDark={true} 
            headline="Your entire energy ecosystem.<br/>Instantly synchronized." 
            subheadline="Everywhere you are."
          >
            {/* Sfondo nero uniforme e pulito senza sfumature sporche */}
            <div className="absolute inset-0 bg-[#0a0a0a]" />
            <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-teal-500/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-6xl h-full flex items-center justify-center relative mt-16">
              {/* Il Mac parte da y: 120 e arriva a y: 40 (non a 0), allontanandosi dal testo in alto */}
              <motion.div initial={{ y: 120, opacity: 0 }} whileInView={{ y: 35, opacity: 1 }} transition={{ duration: 1.4, ease: appleEase }} viewport={{ once: false, amount: 0.5 }} className="absolute z-10 w-[65%] drop-shadow-[0_40px_80px_rgba(0,0,0,0.8)]">
                <img src="/FGB_Mac.png" alt="Mac" className="w-full h-auto object-contain" />
              </motion.div>
              <motion.div initial={{ x: -60, y: 100, opacity: 0 }} whileInView={{ x: -280, y: 80, opacity: 1 }} transition={{ duration: 1.4, delay: 0.15, ease: appleEase }} viewport={{ once: false, amount: 0.5 }} className="absolute z-20 w-[25%] drop-shadow-[0_30px_60px_rgba(0,0,0,0.7)]">
                <img src="/FGB_Pad.png" alt="iPad" className="w-full h-auto object-contain" />
              </motion.div>
              <motion.div initial={{ x: 60, y: 120, opacity: 0 }} whileInView={{ x: 300, y: 100, opacity: 1 }} transition={{ duration: 1.4, delay: 0.25, ease: appleEase }} viewport={{ once: false, amount: 0.5 }} className="absolute z-30 w-[14%] drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
                <img src="/FGB_Phone.png" alt="iPhone" className="w-full h-auto object-contain" />
              </motion.div>
            </div>
          </GalleryItem>

          {/* SLIDE 2: THE REVEAL */}
          <GalleryItem headline="A single platform.<br/>All your KPIs in one place." subheadline="Predictive real-time monitoring.">
            <div className="relative w-full h-full flex items-center justify-center perspective-1000">
              <motion.div className="absolute w-[28%] h-[300px] z-10 hidden md:block" initial={{ x: "0%", scale: 0.85, opacity: 0, filter: "blur(10px)" }} whileInView={{ x: "-110%", scale: 0.9, opacity: 0.85, filter: "blur(0px)" }} transition={{ duration: 1.6, ease: appleEase, delay: 0.1 }} viewport={{ once: false, amount: 0.6 }}><CarbonCard /></motion.div>
              <motion.div className="absolute w-[42%] h-[360px] z-30" initial={{ y: 40, scale: 0.95, opacity: 0 }} whileInView={{ y: 0, scale: 1, opacity: 1 }} transition={{ duration: 1.4, ease: appleEase }} viewport={{ once: false, amount: 0.6 }}><TrueHeatmapCard /></motion.div>
              <motion.div className="absolute w-[28%] h-[300px] z-10 hidden md:block" initial={{ x: "0%", scale: 0.85, opacity: 0, filter: "blur(10px)" }} whileInView={{ x: "110%", scale: 0.9, opacity: 0.85, filter: "blur(0px)" }} transition={{ duration: 1.6, ease: appleEase, delay: 0.2 }} viewport={{ once: false, amount: 0.6 }}><CO2Card /></motion.div>
            </div>
          </GalleryItem>

          {/* SLIDE 3: ESG GAMIFICATION - FIXATO NERO DI SFONDO */}
          <GalleryItem 
            isDark={true} 
            headline="Your path to ESG excellence.<br/>Precisely measured." 
            subheadline="Automated tracking for top certifications."
          >
            <div className="absolute inset-0 bg-[#0a0a0a]" />
            <div className="relative w-full h-full flex items-center justify-center z-10">
              <motion.div initial={{ y: 60, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} transition={{ duration: 1.4, ease: appleEase }} viewport={{ once: false, amount: 0.5 }} className="w-full flex justify-center">
                <ESGRingsCard />
              </motion.div>
            </div>
          </GalleryItem>

          {/* SLIDE 4: OPTIMIZE WASTE */}
          <GalleryItem headline="Optimize waste.<br/>Your building's lifecycle." subheadline="24h distributive analysis.">
            <div className="w-full h-full flex items-center justify-center">
              <div className="relative w-80 h-80">
                <div className="absolute inset-0 bg-blue-400/20 blur-[80px] rounded-full pointer-events-none" />
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={dayNightData} cx="50%" cy="50%" innerRadius="80%" outerRadius="100%" stroke="none" dataKey="value" startAngle={90} endAngle={-270}>{dayNightData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-6xl font-semibold tracking-tighter text-[#1d1d1f]">1,240</span><span className="text-xs text-[#86868b] font-medium uppercase tracking-[0.2em] mt-2">kWh Total</span>
                </div>
              </div>
            </div>
          </GalleryItem>

          {/* ── SLIDE 5: OCR BILLING RECOVERY ── */}
          <GalleryItem 
            headline="From paper chaos to absolute clarity.<br/>Upload your historical bills." 
            subheadline="Instant AI-powered OCR data extraction."
          >
            <div className="relative w-full h-full flex items-center justify-center mt-12">
               <OCRScannerFeature />
            </div>
          </GalleryItem>

        </ul>

        {/* Dynamic Glass Pill */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-6 py-3 rounded-full bg-[#1d1d1f]/5 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.8)]">
          <button onClick={scrollLeft} disabled={currentSlide === 0} className="text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-5 h-5" strokeWidth={2.5} /></button>
          <div className="flex gap-2.5">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button key={i} onClick={() => scrollToSlide(i)} className={`w-2 h-2 rounded-full transition-all duration-300 ${currentSlide === i ? 'bg-[#1d1d1f] scale-110' : 'bg-[#1d1d1f]/20 hover:bg-[#1d1d1f]/40'}`} />
            ))}
          </div>
          <button onClick={scrollRight} disabled={currentSlide === totalSlides - 1} className="text-[#1d1d1f]/50 hover:text-[#1d1d1f] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-5 h-5" strokeWidth={2.5} /></button>
        </div>

      </section>
    </div>
  );
};

export default FloatingBentoPanel;
