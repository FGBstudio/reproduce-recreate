import { useState } from "react";
import Header from "@/components/dashboard/Header";
import RegionNav from "@/components/dashboard/RegionNav";
import RegionOverlay from "@/components/dashboard/RegionOverlay";
import MapView from "@/components/dashboard/MapView";
import ProjectDetail from "@/components/dashboard/ProjectDetail";
import { Project, MonitoringType } from "@/lib/data";

const Index = () => {
  const [currentRegion, setCurrentRegion] = useState("GLOBAL");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeFilters, setActiveFilters] = useState<MonitoringType[]>(["energy", "air", "water"]);

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

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {/* Map Layer */}
      <MapView 
        currentRegion={currentRegion} 
        onProjectSelect={handleProjectSelect}
        activeFilters={activeFilters}
      />

      {/* UI Overlay */}
      <Header />
      
      <RegionOverlay 
        currentRegion={currentRegion} 
        visible={!selectedProject && currentRegion !== "GLOBAL"} 
      />
      
      <RegionNav 
        currentRegion={currentRegion} 
        onRegionChange={handleRegionChange}
        visible={!selectedProject}
        activeFilters={activeFilters}
        onFilterToggle={handleFilterToggle}
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
