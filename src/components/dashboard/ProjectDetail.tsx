import { useState, useMemo } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Zap, Wind, Thermometer, AlertCircle } from "lucide-react";
import { Project } from "@/lib/data";

interface ProjectDetailProps {
  project: Project | null;
  onClose: () => void;
}

const ProjectDetail = ({ project, onClose }: ProjectDetailProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 3;

  // Generate heatmap data
  const heatmapData = useMemo(() => {
    return Array(72).fill(0).map(() => {
      const r = Math.random();
      return r > 0.9 ? "bg-rose-500" : r > 0.6 ? "bg-yellow-400" : r > 0.3 ? "bg-teal-500" : "bg-white/10";
    });
  }, [project?.id]);

  if (!project) return null;

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const aqColorClass = {
    EXCELLENT: "text-emerald-400",
    GOOD: "text-emerald-400",
    MODERATE: "text-yellow-400",
    POOR: "text-rose-400",
  }[project.data.aq] || "text-foreground";

  return (
    <div className="fixed inset-0 z-50 animate-slide-up">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img 
          src={project.img} 
          alt={project.name}
          className="w-full h-full object-cover brightness-[0.4]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      {/* Header */}
      <div className="absolute top-0 w-full px-8 py-6 flex justify-between items-center z-10">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-sm font-semibold transition-all group border border-white/10"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Region
        </button>
        <div className="text-right">
          <h1 className="text-3xl font-serif text-foreground tracking-wide">{project.name}</h1>
          <p className="text-sm text-muted-foreground font-light tracking-widest uppercase">{project.address}</p>
        </div>
      </div>

      {/* Carousel Content */}
      <div className="absolute bottom-0 w-full h-[85vh] flex flex-col justify-center px-4 md:px-16 pb-12">
        <div className="relative w-full max-w-7xl mx-auto h-[600px] overflow-hidden">
          <div 
            className="flex h-full transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {/* Slide 1: Energy Overview */}
            <div className="w-full flex-shrink-0 px-4 flex items-center justify-center">
              <div className="w-full h-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-end">
                {/* Main Donut Card */}
                <div className="glass-card p-10 relative overflow-hidden h-[400px] flex flex-col justify-between group">
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-fgb-accent" />
                      <h3 className="text-2xl font-bold">Energy Density</h3>
                    </div>
                    <div className="text-sm text-muted-foreground">Total consumption kWh/m²</div>
                  </div>
                  
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-64 h-64">
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                      <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.1)" strokeWidth="10" fill="none" />
                      <circle 
                        cx="50" cy="50" r="40" 
                        stroke="hsl(188, 100%, 19%)" 
                        strokeWidth="10" 
                        fill="none" 
                        strokeDasharray="251" 
                        strokeDashoffset="100" 
                      />
                      <circle 
                        cx="50" cy="50" r="40" 
                        stroke="hsl(43, 41%, 57%)" 
                        strokeWidth="10" 
                        fill="none" 
                        strokeDasharray="251" 
                        strokeDashoffset="200" 
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-bold text-foreground">{project.data.total}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-8 relative z-10">
                    <div>
                      <div className="text-xs text-fgb-accent uppercase mb-1">HVAC</div>
                      <div className="text-2xl font-bold">{project.data.hvac}</div>
                    </div>
                    <div>
                      <div className="text-xs text-fgb-accent uppercase mb-1">Lighting</div>
                      <div className="text-2xl font-bold">{project.data.light}</div>
                    </div>
                  </div>
                </div>

                {/* Context Card */}
                <div className="glass-card p-8 h-[300px] flex flex-col justify-center">
                  <h4 className="text-lg font-bold mb-6 border-b border-white/10 pb-4">Consumption Breakdown</h4>
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <span className="w-8 text-xs font-bold text-muted-foreground">HVAC</span>
                      <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-teal-500 to-teal-300 w-[45%]" />
                      </div>
                      <span className="text-sm font-bold">45%</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="w-8 text-xs font-bold text-muted-foreground">LGT</span>
                      <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 w-[35%]" />
                      </div>
                      <span className="text-sm font-bold">35%</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="w-8 text-xs font-bold text-muted-foreground">PLG</span>
                      <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-pink-500 to-pink-300 w-[20%]" />
                      </div>
                      <span className="text-sm font-bold">20%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 2: Air Quality */}
            <div className="w-full flex-shrink-0 px-4 flex items-center justify-center">
              <div className="w-full max-w-4xl glass-card p-12 flex flex-col md:flex-row items-center gap-16 relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl" />
                
                <div className="flex-1 text-center md:text-left z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-4">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE MONITORING
                  </div>
                  <h3 className={`text-6xl font-bold mb-2 tracking-tight ${aqColorClass}`}>
                    {project.data.aq}
                  </h3>
                  <p className="text-muted-foreground uppercase tracking-[0.2em] text-sm">Indoor Air Quality Index</p>
                </div>

                <div className="grid grid-cols-2 gap-6 z-10">
                  <div className="bg-black/20 p-6 rounded-2xl border border-white/5 text-center w-36">
                    <Wind className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <div className="text-3xl font-bold text-foreground">{project.data.co2}</div>
                    <div className="text-[10px] text-muted-foreground uppercase mt-1">ppm CO2</div>
                  </div>
                  <div className="bg-black/20 p-6 rounded-2xl border border-white/5 text-center w-36">
                    <Thermometer className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <div className="text-3xl font-bold text-foreground">{project.data.temp}°</div>
                    <div className="text-[10px] text-muted-foreground uppercase mt-1">Temperature</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 3: Alerts & Heatmap */}
            <div className="w-full flex-shrink-0 px-4 flex items-center justify-center">
              <div className="w-full h-full grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Alert Status */}
                <div className="glass-card p-8 flex flex-col items-center justify-center text-center">
                  <div className={`w-24 h-24 rounded-full border-4 ${project.data.alerts > 0 ? "border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]" : "border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]"} flex items-center justify-center mb-6`}>
                    <span className="text-4xl font-bold text-foreground">{project.data.alerts}</span>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-1">Active Alerts</h3>
                  <p className="text-xs text-muted-foreground mb-6">Last 24 Hours</p>
                  <button className={`w-full py-3 rounded-lg ${project.data.alerts > 0 ? "bg-rose-500/20 border border-rose-500/50 text-rose-300 hover:bg-rose-500 hover:text-foreground" : "bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500 hover:text-background"} text-sm font-bold transition`}>
                    VIEW LOGS
                  </button>
                </div>

                {/* Heatmap */}
                <div className="md:col-span-2 glass-card p-8 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold">Occupancy Heatmap</h3>
                    <div className="flex gap-2">
                      <span className="w-3 h-3 bg-background rounded-sm" />
                      <span className="w-3 h-3 bg-teal-500 rounded-sm" />
                      <span className="w-3 h-3 bg-yellow-400 rounded-sm" />
                      <span className="w-3 h-3 bg-rose-500 rounded-sm" />
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-12 grid-rows-6 gap-1">
                    {heatmapData.map((color, idx) => (
                      <div 
                        key={idx} 
                        className={`${color} rounded-sm opacity-80 hover:opacity-100 transition`} 
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2 font-mono">
                    <span>08:00</span>
                    <span>12:00</span>
                    <span>16:00</span>
                    <span>20:00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center gap-6 mt-8">
          <button 
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="w-10 h-10 rounded-full border border-white/20 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition text-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-3">
            {Array(totalSlides).fill(0).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentSlide 
                    ? "w-6 bg-fgb-accent" 
                    : "w-2 bg-white/30 hover:bg-foreground"
                }`}
              />
            ))}
          </div>
          <button 
            onClick={nextSlide}
            disabled={currentSlide === totalSlides - 1}
            className="w-10 h-10 rounded-full border border-white/20 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition text-foreground"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Time Scale (Aesthetic) */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
        <div className="vertical-text rotate-180 cursor-pointer hover:text-foreground transition">Year</div>
        <div className="vertical-text rotate-180 cursor-pointer hover:text-foreground transition">Month</div>
        <div className="vertical-text rotate-180 text-fgb-accent border-l-2 border-fgb-accent pl-2">Week</div>
        <div className="vertical-text rotate-180 cursor-pointer hover:text-foreground transition">Day</div>
      </div>
    </div>
  );
};

export default ProjectDetail;
