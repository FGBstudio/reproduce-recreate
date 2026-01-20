import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { regions, Project, MonitoringType } from "@/lib/data";
import { useAllProjects, useAllBrands } from "@/hooks/useRealTimeData";
import { MapLoadingSkeleton } from "./DashboardSkeleton";

interface MapViewProps {
  currentRegion: string;
  onProjectSelect: (project: Project) => void;
  activeFilters: MonitoringType[];
  selectedHolding: string | null;
  selectedBrand: string | null;
}

const MapView = ({ currentRegion, onProjectSelect, activeFilters, selectedHolding, selectedBrand }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Use combined real + mock projects and brands with loading state
  const { projects, isLoading, error, refetch } = useAllProjects();
  const { brands } = useAllBrands();

  // Filter projects by region, monitoring type, holding and brand
  const visibleProjects = useMemo(() => {
    return projects.filter(p => {
      const regionMatch = currentRegion === "GLOBAL" || p.region === currentRegion;
      const monitoringMatch = activeFilters.length === 0 || 
        activeFilters.some(filter => p.monitoring.includes(filter));
      
      // Holding filter - use real brands from hook
      let holdingMatch = true;
      if (selectedHolding) {
        const holdingBrands = brands.filter(b => b.holdingId === selectedHolding);
        holdingMatch = holdingBrands.some(b => b.id === p.brandId);
      }
      
      // Brand filter
      const brandMatch = !selectedBrand || p.brandId === selectedBrand;
      
      return regionMatch && monitoringMatch && holdingMatch && brandMatch;
    });
  }, [projects, brands, currentRegion, activeFilters, selectedHolding, selectedBrand]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = L.map(mapContainer.current, {
      center: [20, 30],
      zoom: 3, // Ti consiglio di partire da 3 per evitare che sia troppo piccola all'inizio
      zoomControl: false,
      attributionControl: false,
      // --- MODIFICHE QUI SOTTO ---
      minZoom: 2, // 1. Impedisce di fare zoom out oltre questo livello (evita che la mappa diventi minuscola)
      maxBounds: [ // 2. Definisce i confini del mondo (Sud-Ovest, Nord-Est)
        [-90, -180], 
        [90, 180]
      ],
      maxBoundsViscosity: 1.0, // 3. Rende i confini "solidi" (senza effetto elastico)
      worldCopyJump: true, // Opzionale: se scorri orizzontalmente, il mondo si ripete all'infinito invece di finire
    });

    // Dark themed OpenStreetMap tiles (CartoDB Dark Matter - free)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map.current);

    // Add zoom control to top-right
    L.control.zoom({ position: "topright" }).addTo(map.current);

    // Add attribution
    L.control.attribution({ position: "bottomleft" })
      .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>')
      .addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Fly to region when changed
  useEffect(() => {
    if (!map.current) return;

    if (currentRegion === "GLOBAL") {
      map.current.flyTo([20, 30], 2, { duration: 1.5 });
    } else {
      const region = regions[currentRegion];
      map.current.flyTo([region.center.lat, region.center.lng], region.zoom, { duration: 1.5 });
    }
  }, [currentRegion]);

  // Update markers
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Custom icon
    const createCustomIcon = () => {
      return L.divIcon({
        className: "custom-marker",
        html: `
          <div class="marker-container">
            <div class="marker-pulse"></div>
            <div class="marker-dot">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });
    };

    // Add markers for visible projects
    visibleProjects.forEach((project) => {
      const marker = L.marker([project.lat, project.lng], {
        icon: createCustomIcon(),
      }).addTo(map.current!);

      // Create popup content
      const popupContent = `
        <div class="leaflet-custom-popup">
          <div class="popup-title">${project.name}</div>
          <div class="popup-address">${project.address}</div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        className: "custom-popup",
        closeButton: false,
      });

      marker.on("click", () => {
        onProjectSelect(project);
      });

      marker.on("mouseover", () => {
        marker.openPopup();
      });

      marker.on("mouseout", () => {
        marker.closePopup();
      });

      markersRef.current.push(marker);
    });
  }, [visibleProjects, onProjectSelect, activeFilters, selectedHolding, selectedBrand]);

  return (
    <div className="absolute inset-0 z-0">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Overlay gradient for better UI integration - stronger on mobile for nav visibility */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background/60 md:from-background/40 via-transparent to-background/40 md:to-background/30" />
      
      {/* Loading indicator */}
      {isLoading && <MapLoadingSkeleton />}
      
      {/* Error state with retry */}
      {error && !isLoading && (
        <div className="absolute bottom-24 md:bottom-32 left-1/2 -translate-x-1/2 text-center pointer-events-auto z-[1000]">
          <div className="glass-panel rounded-xl px-4 py-2 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-red-400 text-xs">Errore caricamento</span>
            <button onClick={() => refetch()} className="text-fgb-accent text-xs hover:underline ml-2">
              Riprova
            </button>
          </div>
        </div>
      )}
      
      {/* Region label - repositioned on mobile */}
      {currentRegion !== "GLOBAL" && !isLoading && (
        <div className="absolute bottom-24 md:bottom-32 left-1/2 -translate-x-1/2 text-center animate-fade-in pointer-events-none z-[1000]">
          <div className="text-fgb-accent text-xs md:text-sm font-bold tracking-[0.2em] md:tracking-[0.3em] uppercase">
            {regions[currentRegion].name}
          </div>
        </div>
      )}

      {/* Custom marker styles */}
      <style>{`
        .custom-marker {
          background: transparent;
          border: none;
        }
        .marker-container {
          position: relative;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        @media (min-width: 768px) {
          .marker-container {
            width: 48px;
            height: 48px;
          }
        }
        .marker-pulse {
          position: absolute;
          width: 36px;
          height: 36px;
          background: hsl(188, 100%, 19%, 0.3);
          border-radius: 50%;
          animation: pulse-ring 2s ease-out infinite;
        }
        @media (min-width: 768px) {
          .marker-pulse {
            width: 48px;
            height: 48px;
          }
        }
        .marker-dot {
          position: relative;
          width: 28px;
          height: 28px;
          background: hsl(188, 100%, 19%);
          border: 2px solid hsl(50, 100%, 94%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: hsl(50, 100%, 94%);
          box-shadow: 0 0 20px rgba(0, 77, 97, 0.6);
          transition: all 0.3s ease;
          cursor: pointer;
        }
        @media (min-width: 768px) {
          .marker-dot {
            width: 36px;
            height: 36px;
          }
        }
        .marker-dot svg {
          width: 12px;
          height: 12px;
        }
        @media (min-width: 768px) {
          .marker-dot svg {
            width: 16px;
            height: 16px;
          }
        }
        .marker-container:hover .marker-dot {
          background: hsl(43, 49%, 57%);
          transform: scale(1.25);
          box-shadow: 0 0 40px rgba(192, 160, 98, 0.7);
        }
        
        /* Custom popup styles */
        .custom-popup .leaflet-popup-content-wrapper {
          background: rgba(0, 20, 30, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }
        .custom-popup .leaflet-popup-tip {
          background: rgba(0, 20, 30, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .leaflet-custom-popup {
          padding: 4px 8px;
        }
        .popup-title {
          color: hsl(50, 100%, 94%);
          font-weight: 600;
          font-size: 13px;
        }
        .popup-address {
          color: hsl(188, 30%, 60%);
          font-size: 11px;
          margin-top: 2px;
        }
        
        /* Leaflet control styles */
        .leaflet-control-zoom {
          background: rgba(0, 20, 30, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          backdrop-filter: blur(10px);
          border-radius: 8px !important;
          overflow: hidden;
        }
        .leaflet-control-zoom a {
          background: transparent !important;
          color: hsl(50, 100%, 94%) !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .leaflet-control-zoom a:last-child {
          border-bottom: none !important;
        }
        .leaflet-control-attribution {
          background: rgba(0, 20, 30, 0.7) !important;
          color: rgba(255, 255, 255, 0.5) !important;
          font-size: 10px !important;
          backdrop-filter: blur(5px);
        }
        .leaflet-control-attribution a {
          color: rgba(255, 255, 255, 0.6) !important;
        }
      `}</style>
    </div>
  );
};

export default MapView;
