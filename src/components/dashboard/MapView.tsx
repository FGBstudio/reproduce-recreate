import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { projects, regions, Project } from "@/lib/data";

interface MapViewProps {
  currentRegion: string;
  onProjectSelect: (project: Project) => void;
}

const MapView = ({ currentRegion, onProjectSelect }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapboxToken, setMapboxToken] = useState(() => 
    localStorage.getItem("mapbox_token") || ""
  );
  const [isMapReady, setIsMapReady] = useState(false);

  // Filter projects by region
  const visibleProjects = currentRegion === "GLOBAL" 
    ? projects 
    : projects.filter(p => p.region === currentRegion);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        projection: "globe",
        zoom: 1.5,
        center: [30, 20],
        pitch: 20,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        "top-right"
      );

      map.current.on("style.load", () => {
        map.current?.setFog({
          color: "rgb(0, 20, 30)",
          "high-color": "rgb(0, 40, 60)",
          "horizon-blend": 0.1,
        });
        setIsMapReady(true);
      });

      // Slow rotation
      const secondsPerRevolution = 360;
      let userInteracting = false;

      function spinGlobe() {
        if (!map.current) return;
        const zoom = map.current.getZoom();
        if (!userInteracting && zoom < 3) {
          const center = map.current.getCenter();
          center.lng -= 360 / secondsPerRevolution;
          map.current.easeTo({ center, duration: 1000, easing: (n) => n });
        }
      }

      map.current.on("mousedown", () => { userInteracting = true; });
      map.current.on("mouseup", () => { userInteracting = false; spinGlobe(); });
      map.current.on("touchend", () => { userInteracting = false; spinGlobe(); });
      map.current.on("moveend", spinGlobe);

      spinGlobe();
    } catch (error) {
      console.error("Mapbox initialization error:", error);
      setIsMapReady(false);
    }

    return () => {
      map.current?.remove();
      setIsMapReady(false);
    };
  }, [mapboxToken]);

  // Fly to region when changed
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    if (currentRegion === "GLOBAL") {
      map.current.flyTo({
        center: [30, 20],
        zoom: 1.5,
        pitch: 20,
        duration: 2000,
      });
    } else {
      const region = regions[currentRegion];
      map.current.flyTo({
        center: [region.center.lng, region.center.lat],
        zoom: region.zoom,
        pitch: 30,
        duration: 2000,
      });
    }
  }, [currentRegion, isMapReady]);

  // Update markers
  useEffect(() => {
    if (!map.current || !isMapReady) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add markers for visible projects
    visibleProjects.forEach((project) => {
      const el = document.createElement("div");
      el.className = "mapbox-marker";
      el.innerHTML = `
        <div class="marker-pulse"></div>
        <div class="marker-dot">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
        </div>
      `;

      el.addEventListener("click", () => onProjectSelect(project));

      const marker = new mapboxgl.Marker(el)
        .setLngLat([project.lng, project.lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [visibleProjects, isMapReady, onProjectSelect]);

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("mapbox_token", mapboxToken);
    window.location.reload();
  };

  // Token input screen
  if (!mapboxToken) {
    return (
      <div className="absolute inset-0 z-0 bg-background flex items-center justify-center">
        <div className="glass-panel p-8 max-w-md w-full mx-4">
          <h2 className="text-xl font-bold text-foreground mb-4">Mapbox Token Required</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Per visualizzare la mappa, inserisci il tuo Mapbox public token. 
            Puoi ottenerlo gratuitamente su{" "}
            <a 
              href="https://mapbox.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-fgb-accent hover:underline"
            >
              mapbox.com
            </a>
          </p>
          <form onSubmit={handleTokenSubmit} className="space-y-4">
            <input
              type="text"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              placeholder="pk.eyJ1Ijoi..."
              className="w-full px-4 py-3 bg-background/50 border border-white/10 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-fgb-accent/50"
            />
            <button
              type="submit"
              className="w-full py-3 bg-fgb-accent text-fgb-accent-foreground font-semibold rounded-xl hover:bg-fgb-accent/90 transition-colors"
            >
              Attiva Mappa
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-0">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Overlay gradient for better UI integration */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background/30 via-transparent to-background/20" />
      
      {/* Region label */}
      {currentRegion !== "GLOBAL" && isMapReady && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 text-center animate-fade-in pointer-events-none">
          <div className="text-fgb-accent text-sm font-bold tracking-[0.3em] uppercase">
            {regions[currentRegion].name}
          </div>
        </div>
      )}

      {/* Custom marker styles */}
      <style>{`
        .mapbox-marker {
          cursor: pointer;
          position: relative;
        }
        .marker-pulse {
          position: absolute;
          width: 48px;
          height: 48px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: hsl(188, 100%, 19%, 0.3);
          border-radius: 50%;
          animation: pulse-ring 2s ease-out infinite;
        }
        .marker-dot {
          position: relative;
          width: 36px;
          height: 36px;
          background: hsl(188, 100%, 19%);
          border: 2px solid hsl(50, 100%, 94%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: hsl(50, 100%, 94%);
          box-shadow: 0 0 20px rgba(0, 77, 97, 0.6);
          transition: all 0.3s ease;
        }
        .mapbox-marker:hover .marker-dot {
          background: hsl(43, 49%, 57%);
          transform: scale(1.25);
          box-shadow: 0 0 40px rgba(192, 160, 98, 0.7);
        }
        .mapboxgl-ctrl-group {
          background: rgba(0, 20, 30, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          backdrop-filter: blur(10px);
        }
        .mapboxgl-ctrl-group button {
          background: transparent !important;
        }
        .mapboxgl-ctrl-group button:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .mapboxgl-ctrl-icon {
          filter: invert(1);
        }
      `}</style>
    </div>
  );
};

export default MapView;
