import { useState } from "react";
import Header from "@/components/dashboard/Header";
import RegionNav from "@/components/dashboard/RegionNav";
import RegionOverlay from "@/components/dashboard/RegionOverlay";
import BrandOverlay from "@/components/dashboard/BrandOverlay";
import MapView from "@/components/dashboard/MapView";
import ProjectDetail from "@/components/dashboard/ProjectDetail";
import { Project, MonitoringType } from "@/lib/data";

const Index = () => {
  const [currentRegion, setCurrentRegion] = useState("GLOBAL");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeFilters, setActiveFilters] = useState<MonitoringType[]>(["energy", "air", "water"]);
  const [selectedHolding, setSelectedHolding] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const handleRegionChange = (region: string) => {
    setCurrentRegion(region);
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
  };

  const handleCloseProject = () => {
    setSelectedProject(null);
  };

  const handleFilterToggle = (filter: MonitoringType) => {
    setActiveFilters(prev => 
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const showBrandOverlay = (selectedBrand || selectedHolding) && !selectedProject;

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {/* Map Layer */}
      <MapView 
        currentRegion={currentRegion} 
        onProjectSelect={handleProjectSelect}
        activeFilters={activeFilters}
        selectedHolding={selectedHolding}
        selectedBrand={selectedBrand}
      />

      {/* UI Overlay */}
      <Header />
      
      {/* Brand/Holding Overlay - shows when brand or holding is selected */}
      <BrandOverlay 
        selectedBrand={selectedBrand}
        selectedHolding={selectedHolding}
        visible={showBrandOverlay}
      />
      
      <RegionOverlay 
        currentRegion={currentRegion} 
        visible={!selectedProject && currentRegion !== "GLOBAL" && !showBrandOverlay} 
      />
      
      <RegionNav 
        currentRegion={currentRegion} 
        onRegionChange={handleRegionChange}
        visible={!selectedProject}
        activeFilters={activeFilters}
        onFilterToggle={handleFilterToggle}
        selectedHolding={selectedHolding}
        selectedBrand={selectedBrand}
        onHoldingChange={setSelectedHolding}
        onBrandChange={setSelectedBrand}
      />

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
