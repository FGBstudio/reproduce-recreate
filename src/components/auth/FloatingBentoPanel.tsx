import { motion } from "framer-motion";
import {
  Zap, Droplets, Wind, Sun, Moon, Leaf, ChevronRight, ChevronLeft
} from "lucide-react";
import { useRef } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea
} from "recharts";

/* ═══════════════════════════════════════════════
   MOCK DATA (Mantenuti per consistenza)
   ═══════════════════════════════════════════════ */
const carbonBarData = [{ bucket: "Jan", "2025": 420, "2024": 480 }, { bucket: "Feb", "2025": 390, "2024": 460 }, { bucket: "Mar", "2025": 450, "2024": 500 }, { bucket: "Apr", "2025": 380, "2024": 440 }, { bucket: "May", "2025": 350, "2024": 410 }, { bucket: "Jun", "2025": 400, "2024": 470 }];
const dayNightData = [{ name: "Day", value: 62, fill: "#38bdf8" }, { name: "Night", value: 38, fill: "#334155" }];
const co2LineData = [{ time: "06:00", co2: 410 }, { time: "08:00", co2: 520 }, { time: "10:00", co2: 680 }, { time: "12:00", co2: 750 }, { time: "14:00", co2: 620 }, { time: "16:00", co2: 580 }];

const axisStyle = { fontSize: 12, fontFamily: "'Futura', sans-serif", fill: "#94a3b8", fontWeight: 500 };
const tooltipStyle = { backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", borderRadius: "16px", boxShadow: "0 10px 40px rgba(0,0,0,0.1)", padding: "12px 16px", border: "none" };

/* ═══════════════════════════════════════════════
   APPLE HIGHLIGHTS CARD COMPONENT
   ═══════════════════════════════════════════════ */
// La vera magia Apple: Grandi dimensioni, typography massiccia, e il contenuto (grafico) che respira.
const GalleryCard = ({ title, subtitle, icon: Icon, colorClass, children }: any) => (
  <div className="relative snap-center shrink-0 w-[85vw] max-w-[900px] h-[65vh] min-h-[500px] max-h-[700px] rounded-[40px] bg-white/70 backdrop-blur-3xl border border-white/60 shadow-[0_40px_80px_rgba(0,0,0,0.07),inset_0_1px_0_rgba(255,255,255,0.8)] overflow-hidden flex flex-col transition-transform duration-500 hover:scale-[1.01]">
    
    {/* Contenuto Testuale (Alto) */}
    <div className="p-10 md:p-14 z-10 flex flex-col gap-4">
      <div className={`w-14 h-14 rounded-2xl ${colorClass} flex items-center justify-center shadow-inner`}>
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-3xl md:text-5xl font-extrabold text-gray-900 leading-tight tracking-tight max-w-2xl">
        {title}
      </h3>
      <p className="text-lg md:text-xl text-gray-500 font-medium tracking-wide max-w-xl">
        {subtitle}
      </p>
    </div>

    {/* Area Grafico (Basso/Centro) */}
    <div className="flex-1 w-full relative px-10 pb-10 flex items-end">
      {children}
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   MAIN COMPONENT: THE HORIZONTAL GALLERY
   ═══════════════════════════════════════════════ */
const FloatingBentoPanel = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => scrollContainerRef.current?.scrollBy({ left: -800, behavior: 'smooth' });
  const scrollRight = () => scrollContainerRef.current?.scrollBy({ left: 800, behavior: 'smooth' });

  return (
    <div className="flex-1 relative overflow-hidden bg-[#f5f5f7] flex flex-col justify-center">
      
      {/* Intestazione Globale fissa */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}
        className="absolute top-[6%] left-[8%] z-30"
      >
        <h2 className="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight">
          Scopri le tue <br/>
          <span className="bg-gradient-to-r from-teal-500 to-emerald-600 bg-clip-text text-transparent">
            prestazioni ambientali.
          </span>
        </h2>
      </motion.div>

      {/* Pulsanti di Navigazione Custom (Stile Apple) */}
      <div className="absolute bottom-[8%] right-[8%] z-30 flex gap-4">
        <button onClick={scrollLeft} className="w-14 h-14 rounded-full bg-white/80 backdrop-blur-md shadow-lg flex items-center justify-center text-gray-800 hover:bg-white transition-all">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button onClick={scrollRight} className="w-14 h-14 rounded-full bg-gray-900 shadow-lg flex items-center justify-center text-white hover:bg-black transition-all">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Il Container a Scorrimento (Scroll Snapping CSS) */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, delay: 0.2 }}
        ref={scrollContainerRef}
        // Il trucco è qui: overflow-x-auto, snap-x e snap-mandatory. Nascondiamo la scrollbar nativa.
        className="flex overflow-x-auto snap-x snap-mandatory gap-8 px-[8vw] pb-10 pt-32 w-full items-center"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }} // Nasconde scrollbar Firefox/IE
      >
        <style>{`::-webkit-scrollbar { display: none; }`}</style> {/* Nasconde scrollbar Chrome/Safari */}

        {/* SLIDE 1: HEATMAP (Ricreata CSS) */}
        <GalleryCard 
          title="La tua firma energetica settimanale, visibile a colpo d'occhio."
          subtitle="Energy Heatmap rileva pattern anomali di consumo isolando gli sprechi notturni."
          icon={Zap} colorClass="bg-teal-100 text-teal-700"
        >
           <div className="w-full h-full flex items-end gap-1 opacity-90">
             {Array.from({length: 40}).map((_, i) => (
               <div key={i} className="flex-1 rounded-t-lg bg-teal-500" style={{ height: `${Math.random() * 80 + 20}%`, opacity: Math.random() * 0.5 + 0.5 }} />
             ))}
           </div>
        </GalleryCard>

        {/* SLIDE 2: CARBON FOOTPRINT */}
        <GalleryCard 
          title="Le emissioni calano anno su anno. L'impatto cresce."
          subtitle="Confronta l'impronta carbonica (kgCO₂e) di quest'anno rispetto al benchmark precedente."
          icon={Leaf} colorClass="bg-emerald-100 text-emerald-700"
        >
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={carbonBarData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={6}>
                <CartesianGrid strokeDasharray="3 6" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="2025" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                <Bar dataKey="2024" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GalleryCard>

        {/* SLIDE 3: INDOOR AIR QUALITY (CO2) */}
        <GalleryCard 
          title="La qualità dell'aria che respiri, monitorata istante per istante."
          subtitle="Trend della CO2 indoor con soglie di sicurezza per garantire il massimo comfort."
          icon={Wind} colorClass="bg-sky-100 text-sky-700"
        >
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={co2LineData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="#e2e8f0" vertical={false} />
                <ReferenceArea y1={0} y2={600} fill="url(#gradSky)" />
                <XAxis dataKey="time" tick={axisStyle} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[300, 800]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="co2" stroke="#0ea5e9" strokeWidth={4} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GalleryCard>

        {/* SLIDE 4: DAY/NIGHT CYCLE */}
        <GalleryCard 
          title="Il ciclo vitale dell'edificio."
          subtitle="Analisi distributiva del carico energetico 24h. Ottimizza lo switch-off."
          icon={Sun} colorClass="bg-amber-100 text-amber-700"
        >
          <div className="w-full flex items-center justify-center h-[280px]">
            <div className="relative w-64 h-64 drop-shadow-xl">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dayNightData} cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" stroke="none" dataKey="value" startAngle={90} endAngle={-270}>
                    {dayNightData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-black text-gray-900">1,240</span>
                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">kWh</span>
              </div>
            </div>
          </div>
        </GalleryCard>

      </motion.div>
    </div>
  );
};

export default FloatingBentoPanel;
