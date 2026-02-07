import { useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { regions, Project, MonitoringType } from "@/lib/data";
import { useAllProjects, useAllBrands } from "@/hooks/useRealTimeData";
import { MapLoadingSkeleton } from "./DashboardSkeleton";
import markerPinIcon from '@/assets/marker.png';

interface MapViewProps {
  currentRegion: string;
  onProjectSelect: (project: Project) => void;
  activeFilters: MonitoringType[];
  selectedHolding: string | null;
  selectedBrand: string | null;
  searchQuery?: string;
}

const MapView = ({ currentRegion, onProjectSelect, activeFilters, selectedHolding, selectedBrand, searchQuery = "" }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Usa hook combinati per dati reali + mock con stati di caricamento
  const { projects, isLoading, error, refetch } = useAllProjects();
  const { brands } = useAllBrands();

  // Logica di filtraggio progetti
  const visibleProjects = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    return projects.filter(p => {
      // 1. Filtro Regione
      const regionMatch = currentRegion === "GLOBAL" || p.region === currentRegion;
      
      // 2. Filtro Monitoraggio (CORRETTO PER IL TUO DB)
      // Logica:
      // - Se activeFilters è vuoto (0), mostra TUTTI i progetti.
      // - Altrimenti: Controlla se ALMENO UNO (some) dei filtri attivi ("energy", "air")
      //   è contenuto dentro una delle stringhe del DB ("energy_monitor", "air_quality").
      const monitoringMatch = activeFilters.length === 0 || 
        activeFilters.some(filterBtn => 
          p.monitoring && p.monitoring.some(dbValue => 
            // Esempio: dbValue è "air_quality", filterBtn è "air" -> TRUE
            dbValue.toLowerCase().includes(filterBtn.toLowerCase())
          )
        );
      
      // 3. Filtro Holding (usa i brand reali)
      let holdingMatch = true;
      if (selectedHolding) {
        const holdingBrands = brands.filter(b => b.holdingId === selectedHolding);
        holdingMatch = holdingBrands.some(b => b.id === p.brandId);
      }
      
      // 4. Filtro Brand
      const brandMatch = !selectedBrand || p.brandId === selectedBrand;
      
      // 5. Filtro Ricerca (Nome o Indirizzo)
      const searchMatch = !query || 
        p.name.toLowerCase().includes(query) || 
        p.address.toLowerCase().includes(query);
      
      return regionMatch && monitoringMatch && holdingMatch && brandMatch && searchMatch;
    });
  }, [projects, brands, currentRegion, activeFilters, selectedHolding, selectedBrand, searchQuery]);

  // Inizializzazione Mappa
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = L.map(mapContainer.current, {
      center: [20, 30],
      zoom: 3,
      zoomControl: false,
      attributionControl: false,
      minZoom: 2, // Impedisce zoom out eccessivo
      maxBounds: [
        [-90, -180], 
        [90, 180]
      ],
      maxBoundsViscosity: 1.0,
      worldCopyJump: true,
    });

    // Tile Layer Dark
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map.current);

    // Controlli Mappa
    L.control.zoom({ position: "topright" }).addTo(map.current);

    L.control.attribution({ position: "bottomleft" })
      .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>')
      .addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Gestione movimento mappa al cambio regione
  useEffect(() => {
    if (!map.current) return;

    if (currentRegion === "GLOBAL") {
      map.current.flyTo([20, 30], 2, { duration: 1.5 });
    } else {
      const region = regions[currentRegion];
      map.current.flyTo([region.center.lat, region.center.lng], region.zoom, { duration: 1.5 });
    }
  }, [currentRegion]);

  // Gestione Marker
  useEffect(() => {
    if (!map.current) return;

    // Rimuovi marker esistenti
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Definizione Icona Personalizzata
    const createCustomIcon = () => {
      return L.divIcon({
        className: "custom-marker",
        html: `
          <div class="marker-container">
            <div class="marker-dot" style="background: transparent; border: none; box-shadow: none; border-radius: 0;">
              <img 
                src="${markerPinIcon}"  alt="marker" 
                style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));"
              />
            </div>
          </div>
        `,
        iconSize: [58, 58],
        iconAnchor: [32, 32],
      });
    };

    // Aggiungi marker per i progetti visibili
    visibleProjects.forEach((project) => {
      const marker = L.marker([project.lat, project.lng], {
        icon: createCustomIcon(),
      }).addTo(map.current!);

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
      
      {/* Overlay sfumato */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background/60 md:from-background/40 via-transparent to-background/40 md:to-background/30" />
      
      {/* Loading Skeleton */}
      {isLoading && <MapLoadingSkeleton />}
      
      {/* Gestione Errori */}
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
      
      {/* Etichetta Regione */}
      {currentRegion !== "GLOBAL" && !isLoading && (
        <div className="absolute bottom-24 md:bottom-32 left-1/2 -translate-x-1/2 text-center animate-fade-in pointer-events-none z-[1000]">
          <div className="text-fgb-accent text-xs md:text-sm font-bold tracking-[0.2em] md:tracking-[0.3em] uppercase">
            {regions[currentRegion].name}
          </div>
        </div>
      )}

      {/* Stili CSS Personalizzati per Marker e Popup */}
      <style>{`
        .custom-marker {
          background: transparent;
          border: none;
          display: flex !important;
          align-items: flex-end !important;
          justify-content: center !important;
        }
        .marker-container {
          position: relative;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        @media (min-width: 768px) {
          .marker-container {
            width: 58px;
            height: 58px;
          }
        }
        .marker-dot {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s ease;
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
          transform: scale(1.1);
        }
        
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
