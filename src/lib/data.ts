/**
 * Region and Project Data for FGB IoT Dashboard
 * * This module exports mock data for development and demo purposes.
 * * == REAL DATA INTEGRATION ==
 * For real data integration, use the hooks from '@/hooks/useRealTimeData':
 * - useAllProjects() - Combined real + mock projects with loading/error states
 * - useAllBrands() - Combined real + mock brands with loading/error states
 * - useAllHoldings() - Combined real + mock holdings with loading/error states
 * * For real-time telemetry, use hooks from '@/hooks/useRealTimeTelemetry':
 * - useRealTimeEnergyData(siteId, timePeriod, dateRange) - Energy timeseries
 * - useRealTimeLatestData(siteId) - Latest sensor readings
 * - useProjectTelemetry(siteId, timePeriod, dateRange) - Combined telemetry
 * * When Supabase is configured, real data from the database is merged with
 * mock data, with real data taking precedence for matching names.
 * * == LOADING STATES ==
 * All hooks return: { data, isLoading, isError, error, refetch, isRealData }
 * Use skeleton components from '@/components/dashboard/DashboardSkeleton'
 */

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
  area_m2?: number;
  energy_price_kwh?: number;
}

export type MonitoringType = "energy" | "air" | "water";

export interface Holding {
  id: string;
  name: string;
  logo: string;
}

export interface Brand {
  id: string;
  name: string;
  holdingId: string;
  logo: string;
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
  monitoring: MonitoringType[];
  brandId: string;
  siteId?: string; // UUID reference to sites table for real-time data
  area_m2?: number; // Area in square meters for energy density calculations
  energy_price_kwh?: number; // Price per kWh for cost calculations
}

export const holdings: Holding[] = [
  { id: "fgb-holding", name: "FGB Holding", logo: "/green.png" },
];

export const brands: Brand[] = [
  { id: "fgb", name: "FGB", holdingId: "fgb-holding", logo: "/green.png" },
];

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
    name: "FGB Milan Showroom", 
    region: "EU", 
    lat: 45.4642, 
    lng: 9.1900, 
    address: "Milan, Italy", 
    img: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&h=1080&fit=crop",
    data: { hvac: 32, light: 46, total: 89, co2: 420, temp: 22, alerts: 0, aq: "GOOD" },
    monitoring: ["energy", "air", "water"],
    brandId: "fgb",
    siteId: "s-gucci-florence" // Maps to Gucci Garden Firenze in seed data
  },
  { 
    id: 2, 
    name: "FGB Paris Office", 
    region: "EU", 
    lat: 48.8566, 
    lng: 2.3522, 
    address: "Paris, France", 
    img: "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1920&h=1080&fit=crop",
    data: { hvac: 40, light: 35, total: 95, co2: 500, temp: 21, alerts: 1, aq: "MODERATE" },
    monitoring: ["energy", "air"],
    brandId: "fgb",
    siteId: "s-dior-paris" // Maps to Dior Paris in seed data (closest match)
  },
  { 
    id: 6, 
    name: "FGB London Headquarter", 
    region: "EU", 
    lat: 51.5074, 
    lng: -0.1278, 
    address: "London, UK", 
    img: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1920&h=1080&fit=crop",
    data: { hvac: 38, light: 42, total: 92, co2: 480, temp: 21, alerts: 0, aq: "GOOD" },
    monitoring: ["energy", "air", "water"],
    brandId: "fgb",
    siteId: "s-dior-london" // Maps to Dior London in seed data
  },
  // Americas
  { 
    id: 3, 
    name: "FGB NY Soho Office", 
    region: "AMER", 
    lat: 40.7128, 
    lng: -74.0060, 
    address: "New York, USA", 
    img: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1920&h=1080&fit=crop",
    data: { hvac: 55, light: 50, total: 120, co2: 600, temp: 20, alerts: 2, aq: "MODERATE" },
    monitoring: ["energy", "water"],
    brandId: "fgb",
    siteId: "s-dior-nyc" // Maps to Dior New York in seed data
  },
  { 
    id: 7, 
    name: "FGB LA Office", 
    region: "AMER", 
    lat: 34.0522, 
    lng: -118.2437, 
    address: "Los Angeles, USA", 
    img: "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=1920&h=1080&fit=crop",
    data: { hvac: 48, light: 38, total: 98, co2: 520, temp: 23, alerts: 1, aq: "GOOD" },
    monitoring: ["energy", "air"],
    brandId: "fgb",
    // No siteId - will use mock data only
  },
  // APAC
  { 
    id: 4, 
    name: "FGB Tokyo Office", 
    region: "APAC", 
    lat: 35.6762, 
    lng: 139.6503, 
    address: "Tokyo, Japan", 
    img: "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=1920&h=1080&fit=crop",
    data: { hvac: 25, light: 30, total: 65, co2: 380, temp: 23, alerts: 0, aq: "EXCELLENT" },
    monitoring: ["energy", "air", "water"],
    brandId: "fgb",
    siteId: "s-fendi-tokyo" // Maps to Fendi Tokyo in seed data
  },
  { 
    id: 8, 
    name: "FGB Shanghai Office", 
    region: "APAC", 
    lat: 22.3193, 
    lng: 114.1694, 
    address: "Hong Kong", 
    img: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&h=1080&fit=crop",
    data: { hvac: 30, light: 28, total: 68, co2: 400, temp: 22, alerts: 0, aq: "GOOD" },
    monitoring: ["energy", "air"],
    brandId: "fgb",
    siteId: "s-gucci-shanghai" // Maps to Gucci Shanghai in seed data
  },
  // MEA
  { 
    id: 5, 
    name: "FGB Dubai Office", 
    region: "MEA", 
    lat: 25.1972, 
    lng: 55.2744, 
    address: "Dubai, UAE", 
    img: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1920&h=1080&fit=crop",
    data: { hvac: 75, light: 42, total: 130, co2: 550, temp: 19, alerts: 3, aq: "POOR" },
    monitoring: ["energy"],
    brandId: "fgb",
    siteId: "s-fendi-dubai" // Maps to Fendi Dubai in seed data
  }
];

// Helper functions
export const getBrandById = (brandId: string): Brand | undefined => 
  brands.find(b => b.id === brandId);

export const getHoldingById = (holdingId: string): Holding | undefined => 
  holdings.find(h => h.id === holdingId);

export const getBrandsByHolding = (holdingId: string): Brand[] => 
  brands.filter(b => b.holdingId === holdingId);

export const getProjectsByBrand = (brandId: string): Project[] => 
  projects.filter(p => p.brandId === brandId);

export const getProjectsByHolding = (holdingId: string): Project[] => {
  const holdingBrands = getBrandsByHolding(holdingId);
  return projects.filter(p => holdingBrands.some(b => b.id === p.brandId));
};
