import { useRef } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
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

const axisStyle = { fontSize: 12, fontFamily: "'Futura', sans-serif", fill: "#94a3b8", fontWeight: 500 };
const tooltipStyle = { backgroundColor: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", borderRadius: "16px", boxShadow: "0 10px 40px rgba(0,0,0,0.1)", padding: "12px 16px", border: "none" };

/* ═══════════════════════════════════════════════
   APPLE-STRUCTURED GALLERY ITEM
   Struttura DOM fedele al tag <li class="gallery-item"> di Apple
   ═══════════════════════════════════════════════ */
const GalleryItem = ({ headline, mediaType, children, isDark = false }: any) => {
  const textColor = isDark ? "text-white" : "text-gray-900";
  const bgColor = isDark ? "bg-black" : "bg-white";

  return (
    <li className={`gallery-item snap-center shrink-0 w-[88vw] max-w-[1024px] h-[75vh] min-h-[550px] max-h-[800px] rounded-[40px] overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.08)] ${bgColor}`}>
      <div className="gallery-item-crop w-full h-full flex flex-col relative">
        
        {/* Apple Caption Container */}
        <div className="caption-container absolute top-12 left-12 right-12 z-20 pointer-events-none">
          <p className={`caption text-3xl md:text-5xl font-semibold tracking-tight leading-[1.15] max-w-3xl ${textColor}`} dangerouslySetInnerHTML={{ __html: headline }} />
        </div>

        {/* Apple Media Container */}
        <figure className="media-container w-full h-full absolute inset-0 z-10 flex items-end justify-center" data-media-type={mediaType}>
          {children}
        </figure>
      </div>
    </li>
  );
};

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
const FloatingBentoPanel = () => {
  const scrollRef = useRef<HTMLUListElement>(null);

  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -900, behavior: 'smooth' });
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 900, behavior: 'smooth' });

  return (
    <div className="flex-1 relative overflow-hidden bg-[#f5f5f7] flex flex-col justify-center py-20">
      
      {/* Navigation Controls */}
      <div className="absolute top-8 right-[6vw] z-30 flex gap-4">
        <button onClick={scrollLeft} className="w-12 h-12 rounded-full bg-gray-200/60 backdrop-blur-md flex items-center justify-center text-gray-600 hover:bg-gray-300 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button onClick={scrollRight} className="w-12 h-12 rounded-full bg-gray-200/60 backdrop-blur-md flex items-center justify-center text-gray-600 hover:bg-gray-300 transition-colors">
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* FEDELE ALLA STRUTTURA APPLE: <ul class="item-container"> */}
      <ul 
        ref={scrollRef}
        className="item-container flex overflow-x-auto snap-x snap-mandatory gap-6 px-[6vw] w-full items-center"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`.item-container::-webkit-scrollbar { display: none; }`}</style>

        {/* ── SLIDE 1: IL VIDEO CONCEPT (L'Ecosistema Fluido) ── */}
        <GalleryItem 
          isDark={true}
          mediaType="video"
          headline="Il tuo intero ecosistema energetico.<br/>Sincronizzato istantaneamente su Mac, iPad e iPhone."
        >
          {/* Sostituisci il src con il video generato dall'IA quando lo avrai */}
          <video autoPlay loop muted playsInline className="w-full h-full object-cover opacity-80">
            <source src="https://www.apple.com/105/media/us/mac-pro/2019/14fa6eba-2882-4f36-81c9-63c6d4ba4c8a/anim/hero/large.mp4" type="video/mp4" />
          </video>
          {/* Gradiente nero sul fondo per non tagliare di netto */}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black to-transparent" />
        </GalleryItem>

        {/* ── SLIDE 2: TRUE HEATMAP ── */}
        <GalleryItem 
          mediaType="component"
          headline="La tua firma energetica settimanale.<br/>Scopri gli sprechi invisibili a colpo d'occhio."
        >
          <div className="w-full h-[60%] px-12 pb-12 flex items-end gap-[2px] opacity-90 max-w-5xl mx-auto">
             {Array.from({length: 48}).map((_, i) => (
               <div key={i} className="flex-1 rounded-t-[4px] bg-[#009193] transition-all hover:bg-teal-400" 
                    style={{ height: `${Math.random() * 80 + 20}%`, opacity: Math.random() * 0.4 + 0.6 }} />
             ))}
          </div>
        </GalleryItem>

        {/* ── SLIDE 3: CARBON FOOTPRINT ── */}
        <GalleryItem 
          mediaType="chart"
          headline="Emissioni sotto controllo.<br/>L'impatto reale rispetto all'anno precedente."
        >
          <div className="w-full h-[50%] px-12 pb-12 max-w-5xl mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={carbonBarData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={8}>
                <CartesianGrid strokeDasharray="3 6" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="bucket" tick={axisStyle} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="2025" fill="#10b981" radius={[8, 8, 0, 0]} maxBarSize={60} />
                <Bar dataKey="2024" fill="#cbd5e1" radius={[8, 8, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GalleryItem>

        {/* ── SLIDE 4: AIR QUALITY ── */}
        <GalleryItem 
          mediaType="chart"
          headline="Respira meglio. Lavora meglio.<br/>Monitoraggio continuo della CO2 indoor."
        >
          <div className="w-full h-[55%] px-12 pb-12 max-w-5xl mx-auto">
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
                <Line type="monotone" dataKey="co2" stroke="#0ea5e9" strokeWidth={5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GalleryItem>

      </ul>
    </div>
  );
};

export default FloatingBentoPanel;
