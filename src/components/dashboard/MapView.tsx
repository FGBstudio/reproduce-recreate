import { projects, regions, Project } from "@/lib/data";

interface MapViewProps {
  currentRegion: string;
  onProjectSelect: (project: Project) => void;
}

const MapView = ({ currentRegion, onProjectSelect }: MapViewProps) => {
  // Filter projects by region
  const visibleProjects = currentRegion === "GLOBAL" 
    ? projects 
    : projects.filter(p => p.region === currentRegion);

  // Calculate marker position using Mercator-like projection
  const getMarkerPosition = (lat: number, lng: number) => {
    if (currentRegion === "GLOBAL") {
      // Global view - spread across the whole screen
      const x = ((lng + 180) / 360) * 100;
      const y = ((90 - lat) / 180) * 100;
      return { left: `${x}%`, top: `${y}%` };
    }
    
    // Regional view - center on the region
    const region = regions[currentRegion];
    const centerLat = region.center.lat;
    const centerLng = region.center.lng;
    const zoom = region.zoom;
    
    // Scale based on zoom level
    const scale = Math.pow(1.5, zoom - 3);
    
    const offsetX = (lng - centerLng) * scale * 3;
    const offsetY = (centerLat - lat) * scale * 3;
    
    return {
      left: `${50 + offsetX}%`,
      top: `${50 + offsetY}%`,
    };
  };

  return (
    <div className="absolute inset-0 z-0 bg-background overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#001520] via-background to-[#003040] opacity-90" />
        
        {/* Animated grid overlay */}
        <div 
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,200,200,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,200,200,0.5) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />
        
        {/* World map SVG silhouette */}
        <svg 
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1000 500"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Simplified continents with glow effect */}
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* North America */}
          <path
            fill="hsl(188, 100%, 19%)"
            fillOpacity="0.4"
            filter="url(#glow)"
            d="M120,100 Q160,80 200,90 Q250,70 300,85 Q330,100 340,130 Q350,160 330,190 Q300,220 260,230 Q220,240 180,220 Q140,200 130,160 Q120,130 120,100 Z"
          />
          
          {/* South America */}
          <path
            fill="hsl(188, 100%, 19%)"
            fillOpacity="0.4"
            filter="url(#glow)"
            d="M220,260 Q250,240 280,260 Q310,290 320,340 Q330,400 300,440 Q270,470 240,450 Q210,430 200,380 Q190,330 200,290 Q210,260 220,260 Z"
          />
          
          {/* Europe */}
          <path
            fill="hsl(188, 100%, 19%)"
            fillOpacity="0.5"
            filter="url(#glow)"
            d="M440,90 Q480,70 520,80 Q560,90 580,120 Q600,150 580,180 Q560,200 520,195 Q480,190 450,170 Q420,150 430,120 Q440,90 440,90 Z"
          />
          
          {/* Africa */}
          <path
            fill="hsl(188, 100%, 19%)"
            fillOpacity="0.4"
            filter="url(#glow)"
            d="M460,200 Q500,180 540,200 Q580,230 590,290 Q600,350 570,400 Q540,440 490,430 Q440,420 430,360 Q420,300 440,250 Q460,200 460,200 Z"
          />
          
          {/* Asia */}
          <path
            fill="hsl(188, 100%, 19%)"
            fillOpacity="0.45"
            filter="url(#glow)"
            d="M580,80 Q650,60 720,70 Q800,80 860,120 Q900,160 880,220 Q860,280 800,290 Q740,300 680,270 Q620,240 600,180 Q580,120 580,80 Z"
          />
          
          {/* Australia */}
          <path
            fill="hsl(188, 100%, 19%)"
            fillOpacity="0.4"
            filter="url(#glow)"
            d="M780,340 Q830,320 880,340 Q920,370 910,420 Q900,460 850,470 Q800,480 770,440 Q740,400 760,360 Q780,340 780,340 Z"
          />
        </svg>

        {/* Glowing orbs for atmosphere */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/3 w-64 h-64 bg-fgb-accent/5 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 right-1/4 w-48 h-48 bg-emerald-500/5 rounded-full blur-[60px]" />
      </div>

      {/* Project markers */}
      {visibleProjects.map((project, index) => {
        const pos = getMarkerPosition(project.lat, project.lng);
        return (
          <button
            key={project.id}
            onClick={() => onProjectSelect(project)}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-20 transition-all duration-500"
            style={{ 
              ...pos, 
              animationDelay: `${index * 100}ms` 
            }}
          >
            <div className="relative animate-scale-in">
              {/* Outer pulse ring */}
              <div className="absolute inset-0 w-14 h-14 -m-2.5 bg-fgb-accent/30 rounded-full animate-pulse-ring" />
              
              {/* Inner glow */}
              <div className="absolute inset-0 w-9 h-9 bg-fgb-accent/20 rounded-full blur-sm group-hover:bg-fgb-accent/50 transition-all duration-300" />
              
              {/* Pin marker */}
              <div className="relative w-9 h-9 bg-secondary border-2 border-foreground rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(0,77,97,0.6)] transition-all duration-300 group-hover:bg-fgb-accent group-hover:scale-125 group-hover:shadow-[0_0_40px_rgba(192,160,98,0.7)]">
                <svg className="w-4 h-4 text-foreground" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </div>
            </div>
            
            {/* Label tooltip */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 px-3 py-2 bg-background/95 backdrop-blur-sm border border-white/10 rounded-xl text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-2xl pointer-events-none">
              <div className="text-foreground">{project.name}</div>
              <div className="text-muted-foreground text-[10px] mt-0.5">{project.address}</div>
              {/* Arrow */}
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-background/95 border-l border-t border-white/10 rotate-45" />
            </div>
          </button>
        );
      })}

      {/* Region label */}
      {currentRegion !== "GLOBAL" && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-center animate-fade-in">
          <div className="text-fgb-accent text-sm font-bold tracking-[0.3em] uppercase">
            {regions[currentRegion].name}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
