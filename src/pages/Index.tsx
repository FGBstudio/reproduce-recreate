import { useState } from "react";
import Header from "@/components/dashboard/Header";
import RegionNav from "@/components/dashboard/RegionNav";
import RegionOverlay from "@/components/dashboard/RegionOverlay";
import MapView from "@/components/dashboard/MapView";
import ProjectDetail from "@/components/dashboard/ProjectDetail";
import { Project } from "@/lib/data";

const Index = () => {
  const [currentRegion, setCurrentRegion] = useState("GLOBAL");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const handleRegionChange = (region: string) => {
    setCurrentRegion(region);
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
  };

  const handleCloseProject = () => {
    setSelectedProject(null);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {/* Map Layer */}
      <MapView 
        currentRegion={currentRegion} 
        onProjectSelect={handleProjectSelect} 
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
