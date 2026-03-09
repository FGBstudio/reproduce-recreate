import { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronRight, ChevronLeft, Zap, Leaf, Wind, Sun, Moon, Droplets } from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea
} from "recharts";

/* ═══════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════ */
const carbonBarData = [{ bucket: "Jan", "2025": 420, "2024": 480 }, { bucket: "Feb", "2025": 390, "2024": 460 }, { bucket: "Mar", "2025": 450, "2024": 500 }, { bucket: "Apr", "2025": 380, "2024": 440 }, { bucket: "May", "2025": 350, "2024": 410 }, { bucket: "Jun", "2025": 400, "2024": 470 }];
const dayNightData = [{ name: "Day", value: 62, fill: "#38bdf8" }, { name: "Night", value: 38, fill: "#334155" }];
const co2LineData = [{ time: "06:00", co2: 410 }, { time: "08:00", co2: 520 }, { time: "10:00", co2: 680 }, { time: "12:00", co2: 750 }, { time: "14:00", co2: 620 }, { time: "16:00", co2: 580 }];

const axisStyle = { fontSize: 10, fontFamily: "'Futura', sans-serif", fill: "#94a3b8", fontWeight: 500 };
const tooltipStyle = { backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", borderRadius: "12px", boxShadow: "0 10px 40px rgba(0,0,0,0.1)", padding: "10px 14px", border: "none", fontSize: 11 };

/* ═══════════════════════════════════════════════
   APPLE GLASS CARD BASE (Miniaturizzata per l'effetto)
   ═══════════════════════════════════════════════ */
const cardBase = "bg-white/80 backdrop-blur-2xl border border-white/60 shadow-[0_20px_40px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] rounded-[24px] overflow-hidden w-full h-full flex flex-col p-5";

const TrueHeatmapCard = () => (
  <div className={cardBase}>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
        <Zap className="w-4 h-4 text-teal-600" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-gray-800 tracking-tight">Heatmap</h4>
        <p className="text-[10px] text-gray-400">Analisi Sprechi</p>
      </div>
    </div>
    <div className="flex-1 w-full px-2 pb-2 flex items-end gap-[1px] opacity-90">
      {Array.from({length: 24}).map((_, i) => (
        <div key={i} className="flex-1 rounded-t-[2px] bg-[#009193] transition-all" style={{ height: `${Math.random() * 80 + 20}%`, opacity: Math.random() * 0.4 + 0.6 }} />
      ))}
    </div>
  </div>
);

const CarbonCard = () => (
  <div className={cardBase}>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center"><Leaf className="w-4 h-4 text-emerald-600" /></div>
      <div>
        <h4 className="text-sm font-bold text-gray-800 tracking-tight">Carbon</h4>
        <p className="text-[10px] text-gray-400">kgCO₂e</p>
      </div>
    </div>
    <div className="flex-1 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={carbonBarData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }} barGap={2}><XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} /><YAxis tick={axisStyle} axisLine={false} tickLine={false} /><Bar dataKey="2025" fill="#10b981" radius={[4, 4, 0, 0]} /><Bar dataKey="2024" fill="#cbd5e1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
  </div>
);

const CO2Card = () => (
  <div className={cardBase}>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center"><Wind className="w-4 h-4 text-sky-600" /></div>
      <div>
        <h4 className="text-sm font-bold text-gray-800 tracking-tight">Indoor Air</h4>
        <p className="text-[10px] text-gray-400">ppm</p>
      </div>
    </div>
    <div className="flex-1 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={co2LineData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}><CartesianGrid strokeDasharray="3 6" stroke="#f1f5f9" vertical={false} /><XAxis dataKey="time" tick={axisStyle} axisLine={false} tickLine={false} /><YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[300, 800]} /><Line type="monotone" dataKey="co2" stroke="#0ea5e9" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div>
  </div>
);

/* ═══════════════════════════════════════════════
   GALLERY ITEM WRAPPER
   ═══════════════════════════════════════════════ */
const GalleryItem = ({ headline, children, isDark = false }: any) => (
  <li className={`gallery-item snap-center shrink-0 w-[88vw] max-w-[1024px] h-[75vh] min-h-[550px] max-h-[800px] rounded-[40px] overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.08)] ${isDark ? "bg-black" : "bg-white"}`}>
    <div className="w-full h-full flex flex-col relative">
      <div className="absolute top-12 left-12 right-12 z-30 pointer-events-none">
        <p className={`text-3xl md:text-5xl font-semibold tracking-tight leading-[1.15] max-w-3xl ${isDark ? "text-white" : "text-gray-900"}`} dangerouslySetInnerHTML={{ __html: headline }} />
      </div>
      <figure className="w-full h-full absolute inset-0 z-10 flex items-end justify-center overflow-visible">
        {children}
      </figure>
    </div>
  </li>
);

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
const FloatingBentoPanel = () => {
  const scrollRef = useRef<HTMLUListElement>(null);
  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -900, behavior: 'smooth' });
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 900, behavior: 'smooth' });

  // Curva di animazione fluida stile Apple
  const appleEase = [0.16, 1, 0.3, 1];

  return (
    <div className="flex-1 relative overflow-hidden bg-[#f5f5f7] flex flex-col justify-center py-20">
      
      {/* Controlli */}
      <div className="absolute top-8 right-[6vw] z-40 flex gap-4">
        <button onClick={scrollLeft} className="w-12 h-12 rounded-full bg-gray-200/60 backdrop-blur-md flex items-center justify-center text-gray-600 hover:bg-gray-300 transition-colors"><ChevronLeft className="w-6 h-6" /></button>
        <button onClick={scrollRight} className="w-12 h-12 rounded-full bg-gray-200/60 backdrop-blur-md flex items-center justify-center text-gray-600 hover:bg-gray-300 transition-colors"><ChevronRight className="w-6 h-6" /></button>
      </div>

      <ul ref={scrollRef} className="item-container flex overflow-x-auto snap-x snap-mandatory gap-6 px-[6vw] w-full items-center" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`.item-container::-webkit-scrollbar { display: none; }`}</style>

        {/* ── SLIDE 1: VIDEO CONCEPT ── */}
        <GalleryItem isDark={true} headline="Il tuo intero ecosistema energetico.<br/>Sincronizzato istantaneamente.">
          <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-80">
            <source src="https://www.apple.com/105/media/us/mac-pro/2019/14fa6eba-2882-4f36-81c9-63c6d4ba4c8a/anim/hero/large.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />
        </GalleryItem>

        {/* ── SLIDE 2: L'EFFETTO "REVEAL" DELLO STUDIO DISPLAY ── */}
        <GalleryItem headline="Un'unica piattaforma.<br/>Tutti i tuoi KPI ambientali al loro posto.">
          <div className="relative w-full h-full flex items-center justify-center pb-12 mt-32 perspective-1000">
            
            {/* Grafico di Sinistra (Esce da dietro) */}
            <motion.div 
              className="absolute w-[30%] h-[280px] z-10 hidden md:block"
              initial={{ x: "0%", scale: 0.8, opacity: 0 }}
              whileInView={{ x: "-105%", scale: 0.85, opacity: 0.9 }} // Translate negativo: scivola a sinistra
              transition={{ duration: 1.4, ease: appleEase, delay: 0.15 }}
              viewport={{ once: false, amount: 0.5 }} // Si riavvia se fai scroll avanti e indietro
            >
              <CarbonCard />
            </motion.div>

            {/* Grafico Centrale (Heatmap) */}
            <motion.div 
              className="absolute w-[45%] h-[340px] z-30"
              initial={{ y: 50, scale: 0.95, opacity: 0 }}
              whileInView={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: appleEase }}
              viewport={{ once: false, amount: 0.5 }}
            >
              <div className="w-full h-full drop-shadow-2xl">
                <TrueHeatmapCard />
              </div>
            </motion.div>

            {/* Grafico di Destra (Esce da dietro) */}
            <motion.div 
              className="absolute w-[30%] h-[280px] z-10 hidden md:block"
              initial={{ x: "0%", scale: 0.8, opacity: 0 }}
              whileInView={{ x: "105%", scale: 0.85, opacity: 0.9 }} // Translate positivo: scivola a destra
              transition={{ duration: 1.4, ease: appleEase, delay: 0.2 }}
              viewport={{ once: false, amount: 0.5 }}
            >
              <CO2Card />
            </motion.div>

          </div>
        </GalleryItem>

        {/* ── SLIDE 3: DAY/NIGHT FOCUS ── */}
        <GalleryItem headline="Ottimizza gli sprechi notturni.<br/>Il ciclo di vita del tuo edificio.">
          <div className="w-full flex items-center justify-center pb-20">
            <div className="relative w-72 h-72 drop-shadow-xl">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dayNightData} cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" stroke="none" dataKey="value" startAngle={90} endAngle={-270}>
                    {dayNightData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-5xl font-black text-gray-900">1,240</span>
                <span className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-1">kWh</span>
              </div>
            </div>
          </div>
        </GalleryItem>

      </ul>
    </div>
  );
};

export default FloatingBentoPanel;
