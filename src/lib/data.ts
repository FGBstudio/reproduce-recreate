// Region and Project Data for FGB IoT Dashboard

export interface Region {
  center: { lat: number; lng: number };
  zoom: number;
  name?: string;
  kpi?: {
    intensity: number;
    online: number;
    critical: number;
    aq: string;
  };
}

export interface ProjectData {
  hvac: number;
  light: number;
  total: number;
  co2: number;
  temp: number;
  alerts: number;
  aq: string;
}

export interface Project {
  id: number;
  name: string;
  region: string;
  lat: number;
  lng: number;
  address: string;
  img: string;
  data: ProjectData;
}

export const regions: Record<string, Region> = {
  GLOBAL: { center: { lat: 25, lng: 10 }, zoom: 3 },
  EU: { 
    center: { lat: 48, lng: 10 }, 
    zoom: 5, 
    name: "Europe", 
    kpi: { intensity: 72, online: 23, critical: 2, aq: "GOOD" } 
  },
  AMER: { 
    center: { lat: 38, lng: -95 }, 
    zoom: 4, 
    name: "Americas", 
    kpi: { intensity: 85, online: 18, critical: 1, aq: "MODERATE" } 
  },
  APAC: { 
    center: { lat: 30, lng: 110 }, 
    zoom: 4, 
    name: "Asia Pacific", 
    kpi: { intensity: 68, online: 30, critical: 0, aq: "EXCELLENT" } 
  },
  MEA: { 
    center: { lat: 25, lng: 45 }, 
    zoom: 5, 
    name: "Middle East", 
    kpi: { intensity: 110, online: 12, critical: 3, aq: "POOR" } 
  }
};

export const projects: Project[] = [
  // Europe
  { 
    id: 1, 
    name: "FGB Milan Flagship", 
    region: "EU", 
    lat: 45.4642, 
    lng: 9.1900, 
    address: "Milan, Italy", 
    img: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&h=1080&fit=crop",
    data: { hvac: 32, light: 46, total: 89, co2: 420, temp: 22, alerts: 0, aq: "GOOD" } 
  },
  { 
    id: 2, 
    name: "FGB Paris Boutique", 
    region: "EU", 
    lat: 48.8566, 
    lng: 2.3522, 
    address: "Paris, France", 
    img: "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1920&h=1080&fit=crop",
    data: { hvac: 40, light: 35, total: 95, co2: 500, temp: 21, alerts: 1, aq: "MODERATE" } 
  },
  // Americas
  { 
    id: 3, 
    name: "FGB NY Soho", 
    region: "AMER", 
    lat: 40.7128, 
    lng: -74.0060, 
    address: "New York, USA", 
    img: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1920&h=1080&fit=crop",
    data: { hvac: 55, light: 50, total: 120, co2: 600, temp: 20, alerts: 2, aq: "MODERATE" } 
  },
  // APAC
  { 
    id: 4, 
    name: "FGB Tokyo Ginza", 
    region: "APAC", 
    lat: 35.6762, 
    lng: 139.6503, 
    address: "Tokyo, Japan", 
    img: "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=1920&h=1080&fit=crop",
    data: { hvac: 25, light: 30, total: 65, co2: 380, temp: 23, alerts: 0, aq: "EXCELLENT" } 
  },
  // MEA
  { 
    id: 5, 
    name: "FGB Dubai Mall", 
    region: "MEA", 
    lat: 25.1972, 
    lng: 55.2744, 
    address: "Dubai, UAE", 
    img: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1920&h=1080&fit=crop",
    data: { hvac: 75, light: 42, total: 130, co2: 550, temp: 19, alerts: 3, aq: "POOR" } 
  }
];
