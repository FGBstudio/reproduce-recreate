import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, ChevronLeft, ChevronDown, Zap, Leaf, Wind, Droplet } from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea
} from "recharts";

/* ═══════════════════════════════════════════════
   MOCK DATA & CONFIG
   ═══════════════════════════════════════════════ */
const carbonBarData = [{ bucket: "Jan", "2025": 420, "2024": 480 }, { bucket: "Feb", "2025": 390, "2024": 460 }, { bucket: "Mar", "2025": 450, "2024": 500 }, { bucket: "Apr", "2025": 380, "2024": 440 }, { bucket: "May", "2025": 350, "2024": 410 }, { bucket: "Jun", "2025": 400, "2024": 470 }];
const dayNightData = [{ name: "Day", value: 62, fill: "#38bdf8" }, { name: "Night", value: 38, fill: "#334155" }];
const co2LineData = [{ time: "06:00", co2: 410 }, { time: "08:00", co2: 520 }, { time: "10:00", co2: 680 }, { time: "12:00", co2: 750 }, { time: "14:00", co2: 620 }, { time: "16:00", co2: 580 }];

// Data estratta da ProjectDetail per il Water Distribution
const waterDistributionData = [
  { name: 'Sanitari', value: 35, color: 'hsl(200, 80%, 50%)' },
  { name: 'HVAC', value: 28, color: 'hsl(200, 60%, 40%)' },
  { name: 'Irrigazione', value: 18, color: 'hsl(200, 70%, 60%)' },
  { name: 'Altro', value: 19, color: 'hsl(200, 50%, 70%)' },
];

const axisStyle = { fontSize: 10, fontFamily: "system-ui, -apple-system, sans-serif", fill: "#94a3b8", fontWeight: 400 };
const tooltipStyle = { backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(24px)", borderRadius: "12px", boxShadow: "0 8px 32px rgba(0,0,0,0.08)", padding: "8px 12px", border: "1px solid rgba(255,255,255,0.5)", fontSize: 11 };

// Curva di animazione Apple Ethereal globale
const appleEase = [0.25, 1, 0.5, 1]; 

/* ═══════════════════════════════════════════════
   COMPONENTS: GALLERY CARDS (ENGLISH)
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

const GalleryItem = ({ headline, subheadline, children, isDark = false }: any) => (
  <li className={`gallery-item snap-center shrink-0 w-[85vw] max-w-[1080px] h-[70vh] min-h-[500px] max-h-[750px] rounded-[48px] overflow-hidden relative shadow-[0_40px_80px_rgba(0,0,0,0.05)] ${isDark ? "bg-[#111111]" : "bg-white"}`}>
    <div className="w-full h-full flex flex-col relative">
      <div className="absolute top-16 left-16 right-16 z-30 pointer-events-none flex flex-col gap-3">
        <h2 className={`text-4xl md:text-[56px] font-semibold tracking-tighter leading-[1.1] max-w-3xl ${isDark ? "text-[#f5f5f7]" : "text-[#1d1d1f]"}`} dangerouslySetInnerHTML={{ __html: headline }} />
        {subheadline && <p className={`text-xl md:text-2xl font-medium tracking-tight ${isDark ? "text-[#a1a1a6]" : "text-[#86868b]"}`}>{subheadline}</p>}
      </div>
      <figure className="w-full h-full absolute inset-0 z-10 flex items-end justify-center overflow-visible">{children}</figure>
    </div>
  </li>
);

/* ═══════════════════════════════════════════════
   MAIN COMPONENT: THE MATRIX SCROLL
   ═══════════════════════════════════════════════ */
const FloatingBentoPanel = () => {
  const scrollRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 3;

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollPosition = scrollRef.current.scrollLeft;
    const slideWidth = scrollRef.current.clientWidth;
    setCurrentSlide(Math.round(scrollPosition / slideWidth));
  };

  const scrollToSlide = (index: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ left: scrollRef.current.clientWidth * index, behavior: 'smooth' });
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

      {/* ═════ SEZIONE 1: THE CONVERGENCE HERO (CON 4 MICRO-WIDGET REALI) ═════ */}
      <section className="w-full h-[100dvh] flex flex-col items-center justify-center relative snap-start overflow-hidden">
        
        {/* Glow Etereo di Fondo */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ duration: 2.5, delay: 0.8, ease: appleEase }}
          viewport={{ once: false, amount: 0.5 }}
          className="absolute m-auto w-[600px] h-[600px] bg-gradient-to-tr from-teal-200/40 via-sky-200/30 to-blue-300/30 rounded-full blur-[120px] z-0 pointer-events-none"
        />

        {/* Core Animation Area (Spostata molto in alto per non collidere col titolo) */}
        <div className="relative w-full max-w-3xl aspect-[16/9] flex items-center justify-center z-10 -mt-32">
          
          {/* 1. VERA HEATMAP CSS + LEED (Top Left) */}
          <motion.div
            initial={{ x: -350, y: -200, scale: 0.5, opacity: 0, filter: "blur(20px)", rotate: -6 }}
            whileInView={{ x: -120, y: -60, scale: 1, opacity: 1, filter: "blur(0px)", rotate: -3 }}
            transition={{ duration: 1.8, ease: appleEase }}
            viewport={{ once: false, amount: 0.5 }}
            className="absolute w-[180px] h-[160px] bg-white/70 backdrop-blur-2xl rounded-[24px] shadow-[0_30px_60px_rgba(20,184,166,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 flex flex-col p-4 z-20"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] font-bold text-gray-800 tracking-tight">ENERGY HEATMAP</span>
              <img src="/leed_logo.png" alt="LEED" className="h-4 object-contain" />
            </div>
            {/* Matrice 24x7 Reale in miniatura */}
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

          {/* 2. INDOOR AIR CO2 VALUE (Top Right) */}
          <motion.div
            initial={{ x: 350, y: -200, scale: 0.5, opacity: 0, filter: "blur(20px)", rotate: 6 }}
            whileInView={{ x: 100, y: -40, scale: 1, opacity: 1, filter: "blur(0px)", rotate: 4 }}
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

          {/* 3. WATER CONSUMPTION DISTRIBUTION (Bottom Left) */}
          <motion.div
            initial={{ x: -350, y: 200, scale: 0.5, opacity: 0, filter: "blur(20px)", rotate: -4 }}
            whileInView={{ x: -100, y: 70, scale: 1, opacity: 1, filter: "blur(0px)", rotate: -1 }}
            transition={{ duration: 1.8, delay: 0.15, ease: appleEase }}
            viewport={{ once: false, amount: 0.5 }}
            className="absolute w-[160px] h-[160px] bg-white/70 backdrop-blur-2xl rounded-[24px] shadow-[0_30px_60px_rgba(59,130,246,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 flex flex-col p-4 z-25"
          >
            <span className="text-[9px] font-bold text-gray-800 tracking-tight text-center">WATER DISTRIBUTION</span>
            <div className="flex-1 w-full relative mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={waterDistributionData} innerRadius="55%" outerRadius="85%" paddingAngle={2} dataKey="value" stroke="none">
                    {waterDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                <Droplet className="w-5 h-5 text-blue-500" strokeWidth={2.5} />
              </div>
            </div>
          </motion.div>

          {/* 4. CARBON FOOTPRINT CHART (Bottom Right) */}
          <motion.div
            initial={{ x: 350, y: 200, scale: 0.5, opacity: 0, filter: "blur(20px)", rotate: 4 }}
            whileInView={{ x: 110, y: 80, scale: 1, opacity: 1, filter: "blur(0px)", rotate: 2 }}
            transition={{ duration: 1.8, delay: 0.25, ease: appleEase }}
            viewport={{ once: false, amount: 0.5 }}
            className="absolute w-[190px] h-[130px] bg-white/70 backdrop-blur-2xl rounded-[24px] shadow-[0_30px_60px_rgba(16,185,129,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] border border-white/60 flex flex-col p-3 z-20"
          >
            <div className="flex items-center gap-2 mb-2 px-1">
              <Leaf className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[9px] font-bold text-gray-800 tracking-tight uppercase">Carbon Target</span>
            </div>
            <div className="flex-1 w-full -ml-3 mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={carbonBarData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barGap={2}>
                  <YAxis domain={[0, 'dataMax']} hide />
                  <Bar dataKey="2025" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={10} isAnimationActive={false} />
                  <Bar dataKey="2024" fill="#cbd5e1" radius={[3, 3, 0, 0]} maxBarSize={10} opacity={0.6} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

        </div>

        {/* Tipografia Monumentale (Ancorata in basso) */}
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(12px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1.6, delay: 1.2, ease: appleEase }}
          viewport={{ once: false, amount: 0.5 }}
          className="absolute bottom-[20%] text-center z-40 flex flex-col items-center px-4"
        >
          <h1 className="text-5xl md:text-7xl lg:text-[84px] font-semibold tracking-tighter text-[#1d1d1f] leading-[1.05]">
            Air. Water. Energy. <br />
            <span className="text-[#86868b]">The fusion of your data.</span>
          </h1>
        </motion.div>

        {/* Scroll Indicator */}
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
          className="item-container flex overflow-x-auto snap-x snap-mandatory gap-8 px-[7.5vw] w-full items-center pb-12" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* SLIDE 1 */}
          <GalleryItem isDark={true} headline="Your entire energy ecosystem.<br/>Instantly synchronized." subheadline="Everywhere you are.">
            <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-70 scale-105">
              <source src="https://www.apple.com/105/media/us/mac-pro/2019/14fa6eba-2882-4f36-81c9-63c6d4ba4c8a/anim/hero/large.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#111111] via-[#111111]/80 to-transparent" />
          </GalleryItem>

          {/* SLIDE 2: THE REVEAL */}
          <GalleryItem headline="A single platform.<br/>All your KPIs in one place." subheadline="Predictive real-time monitoring.">
            <div className="relative w-full h-full flex items-center justify-center pb-8 mt-32 perspective-1000">
              <motion.div className="absolute w-[28%] h-[300px] z-10 hidden md:block" initial={{ x: "0%", scale: 0.85, opacity: 0, filter: "blur(10px)" }} whileInView={{ x: "-110%", scale: 0.9, opacity: 0.85, filter: "blur(0px)" }} transition={{ duration: 1.6, ease: appleEase, delay: 0.1 }} viewport={{ once: false, amount: 0.6 }}><CarbonCard /></motion.div>
              <motion.div className="absolute w-[42%] h-[360px] z-30" initial={{ y: 40, scale: 0.95, opacity: 0 }} whileInView={{ y: 0, scale: 1, opacity: 1 }} transition={{ duration: 1.4, ease: appleEase }} viewport={{ once: false, amount: 0.6 }}><TrueHeatmapCard /></motion.div>
              <motion.div className="absolute w-[28%] h-[300px] z-10 hidden md:block" initial={{ x: "0%", scale: 0.85, opacity: 0, filter: "blur(10px)" }} whileInView={{ x: "110%", scale: 0.9, opacity: 0.85, filter: "blur(0px)" }} transition={{ duration: 1.6, ease: appleEase, delay: 0.2 }} viewport={{ once: false, amount: 0.6 }}><CO2Card /></motion.div>
            </div>
          </GalleryItem>

          {/* SLIDE 3 */}
          <GalleryItem headline="Optimize waste.<br/>Your building's lifecycle." subheadline="24h distributive analysis.">
            <div className="w-full flex items-center justify-center pb-24">
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
