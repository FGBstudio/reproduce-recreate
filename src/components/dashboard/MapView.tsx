import { useEffect, useRef, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { regions, Project, MonitoringType } from "@/lib/data";
import { useAllProjects, useAllBrands } from "@/hooks/useRealTimeData";
import { MapLoadingSkeleton } from "./DashboardSkeleton";
import { useTheme } from "@/contexts/ThemeContext";
import { SiteMarker, ProjectSection } from "./SiteMarker";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { useUserScope } from "@/hooks/useUserScope";

interface MapViewProps {
  currentRegion: string;
  onProjectSelect: (project: Project) => void;
  onProjectSectionSelect?: (project: Project, section: ProjectSection) => void;
  activeFilters: MonitoringType[];
  selectedHolding: string | null;
  selectedBrand: string | null;
  searchQuery?: string;
  allowedRegions?: string[] | null;
}

const MapView = ({ currentRegion, onProjectSelect, onProjectSectionSelect, activeFilters, selectedHolding, selectedBrand, searchQuery = "", allowedRegions }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const { theme } = useTheme();
  const { clientRole } = useUserScope();
  // Tracks portal hosts per project id (Leaflet divIcon DOM nodes we mount React into)
  const [portalHosts, setPortalHosts] = useState<Record<string, HTMLElement>>({});

  // Use combined real + mock projects and brands with loading state
  const { projects, isLoading, error, refetch } = useAllProjects();
  const { brands } = useAllBrands();

  // Filter projects by region, monitoring type, holding, brand and search query
  const visibleProjects = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    
    return projects.filter(p => {
      const regionMatch = currentRegion === "GLOBAL" || p.region === currentRegion;
      const monitoringMatch = activeFilters.length === 0 || 
        activeFilters.some(filter => p.monitoring.includes(filter));
      
      // Allowed regions filter (from user membership)
      const allowedRegionMatch = !allowedRegions || allowedRegions.length === 0 || 
        allowedRegions.includes(p.region);
      
      // Holding filter - use real brands from hook
      let holdingMatch = true;
      if (selectedHolding) {
        const holdingBrands = brands.filter(b => b.holdingId === selectedHolding);
        holdingMatch = holdingBrands.some(b => b.id === p.brandId);
      }
      
      // Brand filter
      const brandMatch = !selectedBrand || p.brandId === selectedBrand;
      
      // Search filter - match project name or address
      const searchMatch = !query || 
        p.name.toLowerCase().includes(query) || 
        p.address.toLowerCase().includes(query);
      
      return regionMatch && monitoringMatch && holdingMatch && brandMatch && searchMatch && allowedRegionMatch;
    });
  }, [projects, brands, currentRegion, activeFilters, selectedHolding, selectedBrand, searchQuery, allowedRegions]);

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

    // Themed CARTO tiles (Dark Matter / Positron based on theme)
    const initialUrl = theme === 'light'
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    tileLayerRef.current = L.tileLayer(initialUrl, { maxZoom: 19 }).addTo(map.current);

    // Add zoom control — offset from right edge to avoid system gesture zone
    L.control.zoom({ position: "topright" }).addTo(map.current);

    // Inject CSS to push zoom control away from right safe-area edge on mobile
    const zoomStyle = document.createElement("style");
    zoomStyle.textContent = `
      @media (max-width: 767px) {
        .leaflet-right { right: max(12px, env(safe-area-inset-right)) !important; }
        .leaflet-top { top: max(80px, calc(80px + env(safe-area-inset-top))) !important; }
        .leaflet-control-zoom a { width: 38px !important; height: 38px !important; line-height: 38px !important; font-size: 18px !important; }
      }
    `;
    document.head.appendChild(zoomStyle);

    // Add attribution
    L.control.attribution({ position: "bottomleft" })
      .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>')
      .addTo(map.current);

    return () => {
      map.current?.remove();
      map.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Swap tile layer when theme changes
  useEffect(() => {
    if (!map.current || !tileLayerRef.current) return;
    const url = theme === 'light'
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    tileLayerRef.current.setUrl(url);
  }, [theme]);

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

    // Clear existing markers/cluster
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    if (clusterGroupRef.current) { clusterGroupRef.current.remove(); clusterGroupRef.current = null; }
    setPortalHosts({});

    // Cluster: raggruppa i siti vicini in un badge numerato brandizzato.
    // maxClusterRadius contenuto: i cluster si sciolgono presto zoomando.
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 46,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (cluster) => L.divIcon({
        className: "fgb-cluster",
        html: `
          <div style="position:relative;width:44px;height:44px;border-radius:9999px;background:rgba(255,255,255,0.40);border:0.5px solid rgba(255,255,255,0.9);box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;overflow:hidden;">
            <div style="position:absolute;inset:0;background-image:url('/white.png');background-size:480%;background-position:65% 65%;background-repeat:no-repeat;opacity:0.4;pointer-events:none;"></div>
            <span style="position:relative;color:#fff;font-weight:700;font-size:14px;line-height:1;">${cluster.getChildCount()}</span>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      }),
    });
    clusterGroupRef.current = clusterGroup;

    const nextHosts: Record<string, HTMLElement> = {};

    // Custom icon: divIcon wrapping a stable host div that React will portal into
    const createCustomIcon = (projectKey: string) => {
      return L.divIcon({
        className: "fgb-site-marker",
        html: `<div data-marker-portal="${projectKey}" style="width:58px;height:58px;overflow:visible;"></div>`,
        iconSize: [58, 58],
        iconAnchor: [32, 32],
      });
    };

    // Add markers for visible projects
    visibleProjects.forEach((project) => {
      const projectKey = String(project.id);
      const marker = L.marker([project.lat, project.lng], {
        icon: createCustomIcon(projectKey),
      });
      clusterGroup.addLayer(marker);
      markersRef.current.push(marker);
    });
    map.current!.addLayer(clusterGroup);

    // I marker dentro un cluster NON hanno un elemento DOM finché il cluster
    // non si espande: risolviamo gli host ogni volta che il layout cambia.
    const resolveHosts = () => {
      const hosts: Record<string, HTMLElement> = {};
      markersRef.current.forEach((marker, i) => {
        const project = visibleProjects[i];
        if (!project) return;
        const projectKey = String(project.id);
        const el = marker.getElement() as HTMLElement | null;
        const host = el?.querySelector(`[data-marker-portal="${projectKey}"]`) as HTMLElement | null;
        if (host) {
          hosts[projectKey] = host;
          host.addEventListener("mouseenter", () => { if (el) el.style.zIndex = "1000"; });
          host.addEventListener("mouseleave", () => { if (el) el.style.zIndex = ""; });
        }
      });
      setPortalHosts(hosts);
    };

    resolveHosts();
    clusterGroup.on("animationend spiderfied unspiderfied", resolveHosts);
    map.current!.on("zoomend", resolveHosts);
  }, [visibleProjects, activeFilters, selectedHolding, selectedBrand]);

  const handleSphereClick = (project: Project, section: ProjectSection) => {
    if (onProjectSectionSelect) onProjectSectionSelect(project, section);
    else onProjectSelect(project);
  };

  return (
    <div className="absolute inset-0 z-0">
      <div ref={mapContainer} className="absolute inset-0" data-tour="map" />

      {/* React portals into each Leaflet marker host */}
      {visibleProjects.map((p) => {
        const host = portalHosts[String(p.id)];
        if (!host) return null;
        const brand = brands.find((b) => b.id === p.brandId);
        return createPortal(
          <SiteMarker
            key={p.id}
            project={p}
            clientRole={clientRole}
            brandLogo={brand?.logo}
            onMarkerClick={onProjectSelect}
            onSphereClick={handleSphereClick}
          />,
          host
        );
      })}
      
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
        .fgb-site-marker { background: transparent; border: none; overflow: visible !important; }
        .fgb-site-marker > div { overflow: visible !important; }
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
        .marker-pulse {
          position: absolute;
          width: 48px;
          height: 48px;
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
          width: 100%;   /* Adatta al contenitore */
          height: 100%;  /* Adatta al contenitore */
          display: flex;
          align-items: center;
          justify-content: center;
          /* Rimosso background, border, box-shadow */
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
