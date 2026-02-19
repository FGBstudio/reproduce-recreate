import { useState, useEffect } from "react";
import Header from "@/components/dashboard/Header";
import RegionNav from "@/components/dashboard/RegionNav";
import RegionOverlay from "@/components/dashboard/RegionOverlay";
import BrandOverlay from "@/components/dashboard/BrandOverlay";
import MapView from "@/components/dashboard/MapView";
import ProjectDetail from "@/components/dashboard/ProjectDetail";
import MobileBurgerMenu from "@/components/dashboard/MobileBurgerMenu";
import MobileKpiPanel from "@/components/dashboard/MobileKpiPanel";
import { Project, MonitoringType } from "@/lib/data";
import { useUserScope } from "@/hooks/useUserScope";
import { useAdminData } from "@/contexts/AdminDataContext";
import { DashboardLoadingSkeleton } from "@/components/dashboard/DashboardSkeleton";

const Index = () => {
  const [currentRegion, setCurrentRegion] = useState("GLOBAL");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeFilters, setActiveFilters] = useState<MonitoringType[]>(["energy", "air", "water"]);
  const [selectedHolding, setSelectedHolding] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [autoOpenProject, setAutoOpenProject] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Mobile-only state
  const [isBurgerOpen, setIsBurgerOpen] = useState(false);
  const [isKpiPanelOpen, setIsKpiPanelOpen] = useState(false);

  // User scope detection for role-based routing
  const { clientRole, holdingId, brandId, siteId, isLoading: scopeLoading } = useUserScope();
  const { sites, brands, holdings } = useAdminData();

  // --- NUOVA FUNZIONE: GeoIP Detection ---
  useEffect(() => {
    // Eseguiamo solo se siamo ancora su GLOBAL e abbiamo finito di caricare i permessi
    if (currentRegion === "GLOBAL" && !scopeLoading) {
      const detectUserRegion = async () => {
        try {
          // Usiamo ipapi.co (free tier, no key required per bassi volumi)
          const response = await fetch('https://ipapi.co/json/');
          const data = await response.json();
          
          if (data && data.country_code) {
            const country = data.country_code.toUpperCase();
            let regionToSet = "GLOBAL";

            // Mappatura Nazione -> Regione Dashboard
            // EU
            if (['IT', 'FR', 'DE', 'ES', 'GB', 'CH', 'NL', 'BE', 'AT', 'SE', 'NO', 'DK'].includes(country)) {
              regionToSet = "EU";
            }
            // AMER
            else if (['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO'].includes(country)) {
              regionToSet = "AMER";
            }
            // APAC
            else if (['CN', 'JP', 'KR', 'AU', 'NZ', 'SG', 'IN', 'TH', 'VN'].includes(country)) {
              regionToSet = "APAC";
            }
            // MEA
            else if (['AE', 'SA', 'QA', 'ZA', 'EG', 'TR'].includes(country)) {
              regionToSet = "MEA";
            }

            // Aggiorna la regione solo se ne abbiamo trovata una specifica
            if (regionToSet !== "GLOBAL") {
              console.log(`GeoIP: User located in ${country}, switching to ${regionToSet}`);
              setCurrentRegion(regionToSet);
            }
          }
        } catch (error) {
          console.warn("GeoIP detection failed or blocked:", error);
          // Fallback silenzioso: rimane su GLOBAL
        }
      };

      detectUserRegion();
    }
  }, [scopeLoading]); // Dipendenza solo da scopeLoading per eseguire una volta sola all'avvio reale
  // ---------------------------------------

  // Auto-apply filters based on user role
  useEffect(() => {
    if (scopeLoading) return;

    switch (clientRole) {
      case 'ADMIN_HOLDING':
        // Set holding filter to user's assigned holding
        if (holdingId) {
          setSelectedHolding(holdingId);
          setSelectedBrand(null);
        }
        break;
      
      case 'ADMIN_BRAND':
        // Set brand filter to user's assigned brand
        if (brandId) {
          const brand = brands.find(b => b.id === brandId);
          if (brand) {
            setSelectedHolding(brand.holdingId);
            setSelectedBrand(brandId);
          }
        }
        break;
      
      case 'STORE_USER':
        // Auto-open the user's single project
        if (siteId) {
          const site = sites.find(s => s.id === siteId);
          if (site) {
            const brand = brands.find(b => b.id === site.brandId);
            const holding = holdings.find(h => h.id === brand?.holdingId);
            
            // Create a Project object from the site data
            // Use a hash of the UUID to create a numeric ID for compatibility
            const numericId = site.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            
            const project: Project = {
              id: numericId,
              name: site.name,
              region: site.region || 'EU',
              lat: parseFloat(String(site.lat)) || 0,
              lng: parseFloat(String(site.lng)) || 0,
              address: `${site.address || ''}, ${site.city || ''}, ${site.country || ''}`,
              img: site.imageUrl || '',
              data: { hvac: 0, light: 0, total: 0, co2: 0, temp: 0, humidity: 0, alerts: 0, aq: 'GOOD' },
              monitoring: ['energy', 'air', 'water'],
              brandId: brand?.id || '',
              siteId: site.id, // Keep UUID reference for real-time data
              area_m2: site.area_m2,
              energy_price_kwh: site.energy_price_kwh,
              timezone: site.timezone || 'UTC',
            };
            
            setSelectedProject(project);
            setAutoOpenProject(true);

            // --- MODIFICA: Forza la regione del progetto per lo Store User ---
            if (project.region) {
              setCurrentRegion(project.region);
            }
            // ---------------------------------------------------------------
          }
        }
        break;
      
      default:
        // ADMIN_FGB / USER_FGB - show everything, no pre-filtering
        break;
    }
  }, [clientRole, holdingId, brandId, siteId, scopeLoading, sites, brands, holdings]);

  const handleRegionChange = (region: string) => {
    setCurrentRegion(region);
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
  };

  const handleCloseProject = () => {
    // If STORE_USER, don't allow closing their only project
    if (clientRole === 'STORE_USER' && autoOpenProject) {
      return;
    }
    setSelectedProject(null);
  };

  const handleFilterToggle = (filter: MonitoringType) => {
    setActiveFilters(prev => 
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  // Show loading state while determining user scope
  if (scopeLoading) {
    return <DashboardLoadingSkeleton />;
  }

  const showBrandOverlay = (selectedBrand || selectedHolding) && !selectedProject;

  // Determine if user can change filters (FGB users can, clients have restricted access)
  const canChangeHolding = clientRole === 'ADMIN_FGB' || clientRole === 'USER_FGB';
  const canChangeBrand = clientRole === 'ADMIN_FGB' || clientRole === 'USER_FGB' || clientRole === 'ADMIN_HOLDING';
  const isStoreUserLocked = clientRole === 'STORE_USER';

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {/* Map Layer */}
      <MapView 
        currentRegion={currentRegion} 
        onProjectSelect={handleProjectSelect}
        activeFilters={activeFilters}
        selectedHolding={selectedHolding}
        selectedBrand={selectedBrand}
        searchQuery={searchQuery}
      />

      {/* UI Overlay */}
      <Header
        onSearch={setSearchQuery}
        onProjectSelect={handleProjectSelect}
        onBurgerOpen={() => setIsBurgerOpen(true)}
      />

      {/* Mobile Burger Menu */}
      <MobileBurgerMenu
        isOpen={isBurgerOpen}
        onClose={() => setIsBurgerOpen(false)}
        selectedHolding={selectedHolding}
        selectedBrand={selectedBrand}
        onHoldingChange={canChangeHolding ? setSelectedHolding : undefined}
        onBrandChange={canChangeBrand ? setSelectedBrand : undefined}
        canChangeHolding={canChangeHolding}
        canChangeBrand={canChangeBrand}
      />

      {/* Mobile KPI Panel (slides from bottom) */}
      {!selectedProject && (
        <MobileKpiPanel
          isOpen={isKpiPanelOpen}
          onClose={() => setIsKpiPanelOpen(false)}
          currentRegion={currentRegion}
          selectedBrand={selectedBrand}
          selectedHolding={selectedHolding}
          showBrandOverlay={!!(showBrandOverlay)}
        />
      )}

      {/* Desktop: Brand/Holding Overlay */}
      <BrandOverlay 
        selectedBrand={selectedBrand}
        selectedHolding={selectedHolding}
        visible={showBrandOverlay && true}
      />
      
      {/* Desktop: Region Overlay */}
      <RegionOverlay 
        currentRegion={currentRegion} 
        visible={!selectedProject && currentRegion !== "GLOBAL" && !showBrandOverlay} 
      />
      
      {/* Hide navigation for STORE_USER */}
      {!isStoreUserLocked && (
        <RegionNav 
          currentRegion={currentRegion} 
          onRegionChange={handleRegionChange}
          visible={!selectedProject}
          activeFilters={activeFilters}
          onFilterToggle={handleFilterToggle}
          selectedHolding={selectedHolding}
          selectedBrand={selectedBrand}
          onHoldingChange={canChangeHolding ? setSelectedHolding : undefined}
          onBrandChange={canChangeBrand ? setSelectedBrand : undefined}
          kpiPanelOpen={isKpiPanelOpen}
          onKpiPanelToggle={() => setIsKpiPanelOpen(p => !p)}
        />
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <ProjectDetail 
          project={selectedProject} 
          onClose={handleCloseProject}
        />
      )}
    </div>
  );
};

export default Index;
