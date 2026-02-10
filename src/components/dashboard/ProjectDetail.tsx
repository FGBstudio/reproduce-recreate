
import { useState, useMemo, useRef, ReactNode, useCallback, TouchEvent, useEffect } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Wind, Thermometer, Droplet, Droplets, Award, Lightbulb, Cloud, Image, FileJson, FileSpreadsheet, Maximize2, X, Building2, Tag, FileText, Loader2, LayoutDashboard, Activity, Gauge, Sparkles, Settings } from "lucide-react";
// MODIFICA 1: Import aggiornati per supportare dati reali
import { Project, getHoldingById } from "@/lib/data"; // Rimossa getBrandById statica
import { useAllBrands } from "@/hooks/useRealTimeData"; // Aggiunto hook dati reali

import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart,
} from "recharts";
import html2canvas from "html2canvas";
import { createPortal } from "react-dom";
import { TimePeriodSelector, TimePeriod } from "./TimePeriodSelector";
import { 
  DateRange, 
  useEnergyData, 
  useDeviceData, 
  useCO2Data, 
  useWaterData,
  useEnergyWeatherAnalysis,
  getPeriodLabel 
} from "@/hooks/useTimeFilteredData";
import { useRealTimeEnergyData, useProjectTelemetry } from "@/hooks/useRealTimeTelemetry";
import { generatePdfReport } from "./PdfReportGenerator";
import { Button } from "@/components/ui/button";
import { ProjectSettingsDialog } from "./ProjectSettingsDialog";
import { ModuleGate } from "@/components/modules/ModuleGate";
import { useProjectModuleConfig } from "@/hooks/useProjectModuleConfig";
import { EnergyDemoContent, AirDemoContent, WaterDemoContent } from "@/components/modules/DemoDashboards";
import { OverviewSection } from "./OverviewSection";
import { DataSourceBadge } from "./DataSourceBadge";
import { AirDeviceSelector } from "@/components/dashboard/AirDeviceSelector";
import { useDevices, useLatestTelemetry, useTimeseries, useEnergyTimeseries, useEnergyLatest, parseTimestamp } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/supabase";


// Dashboard types
type DashboardType = "overview" | "energy" | "air" | "water" | "certification";

// Chart axis styling
const axisStyle = {
  fontSize: 11,
  fontFamily: "'Montserrat', sans-serif",
  fill: '#64748b',
  fontWeight: 500
};

const gridStyle = {
  strokeDasharray: "4 4",
  stroke: "#e2e8f0"
};

// Custom tooltip style
const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    border: 'none',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    padding: '12px 16px',
    fontFamily: "'Montserrat', sans-serif"
  },
  itemStyle: { color: '#334155', fontWeight: 500 },
  labelStyle: { color: '#64748b', fontWeight: 600, marginBottom: 4 }
};

/**
 * Domain helper: keeps Recharts autoscaling but adds padding, and avoids [0,0]
 * (which can make lines appear “invisible” on small charts).
 */
const autoDomainWithPadding: [(dataMin: number) => number, (dataMax: number) => number] = [
  (dataMin: number) => {
    if (!Number.isFinite(dataMin)) return 0;
    if (dataMin === 0) return 0;
    // Expand downward slightly
    return dataMin < 0 ? dataMin * 1.05 : dataMin * 0.95;
  },
  (dataMax: number) => {
    if (!Number.isFinite(dataMax)) return 1;
    if (dataMax === 0) return 1;
    // Expand upward slightly
    return dataMax < 0 ? dataMax * 0.95 : dataMax * 1.05;
  },
];

// Export utilities
const exportAsImage = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
  if (!ref.current) return;
  try {
    const canvas = await html2canvas(ref.current, { backgroundColor: '#ffffff', scale: 2 });
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    console.error('Export image failed:', error);
  }
};

const exportAsCSV = (data: Record<string, unknown>[], filename: string) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [headers.join(','), ...data.map(row => headers.map(h => row[h]).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
};

const exportAsJSON = (data: Record<string, unknown>[], filename: string) => {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.json`;
  link.click();
};

// Fullscreen modal component
const ChartFullscreenModal = ({ 
  isOpen, 
  onClose, 
  title, 
  children 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: ReactNode 
}) => {
  if (!isOpen) return null;
  
  return createPortal(
    <div 
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-auto shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white z-10 flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="p-6 md:p-8" style={{ minHeight: '500px' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

interface ExportButtonsProps {
  chartRef: React.RefObject<HTMLDivElement | null>;
  data: Record<string, unknown>[];
  filename: string;
  onExpand?: () => void;
}

const ExportButtons = ({ chartRef, data, filename, onExpand }: ExportButtonsProps) => (
  <div className="flex gap-1">
    {onExpand && (
      <button onClick={onExpand} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors" title="Fullscreen">
        <Maximize2 className="w-3.5 h-3.5 text-gray-600" />
      </button>
    )}
    <button onClick={() => exportAsImage(chartRef, filename)} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors" title="Export PNG">
      <Image className="w-3.5 h-3.5 text-gray-600" />
    </button>
    <button onClick={() => exportAsCSV(data, filename)} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors" title="Export CSV">
      <FileSpreadsheet className="w-3.5 h-3.5 text-gray-600" />
    </button>
    <button onClick={() => exportAsJSON(data, filename)} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors" title="Export JSON">
      <FileJson className="w-3.5 h-3.5 text-gray-600" />
    </button>
  </div>
);

interface ProjectDetailProps {
  project: Project | null;
  onClose: () => void;
}

const ProjectDetail = ({ project, onClose }: ProjectDetailProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeDashboard, setActiveDashboard] = useState<DashboardType>("overview");
  const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [energyViewMode, setEnergyViewMode] = useState<'category' | 'device'>('category');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // MODIFICA 2: Hook per recuperare i brand reali + mock
  const { brands } = useAllBrands();
  

  // Get module configuration for this project
  const moduleConfig = useProjectModuleConfig(project);

  // Device-type mapping (some DBs contain legacy/specific values like energy_single/energy_three_phase/water)
  const ENERGY_DEVICE_TYPES = useMemo(
    () => ["energy_monitor", "energy_single", "energy_three_phase", "hvac", "lighting"],
    []
  );
  const WATER_DEVICE_TYPES = useMemo(() => ["water_meter", "water"], []);
  
  // Touch/swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;
  
  // Dynamic data based on time period - use real-time data if available, otherwise mock
  // Fetch real-time telemetry for this project's site
  const realTimeEnergy = useRealTimeEnergyData(project?.siteId, timePeriod, dateRange);
  const projectTelemetry = useProjectTelemetry(project?.siteId, timePeriod, dateRange);

  // ---------------------------------------------------------------------------
  // Air module: multi-device selection (per ambiente/location)
  // ---------------------------------------------------------------------------
  const { data: airDevicesResp } = useDevices(
    project?.siteId ? { site_id: project.siteId, device_type: "air_quality" } : undefined,
    { enabled: !!project?.siteId }
  );
  const airDevices = airDevicesResp?.data ?? [];
  const airDeviceIds = useMemo(() => airDevices.map((d) => d.id), [airDevices]);

  const [selectedAirDeviceIds, setSelectedAirDeviceIds] = useState<string[]>([]);

  // Default: all air devices selected (and reset when project changes)
  useEffect(() => {
    setSelectedAirDeviceIds(airDeviceIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.siteId, airDeviceIds.join(",")]);

  const selectedAirDevices = useMemo(
    () => airDevices.filter((d) => selectedAirDeviceIds.includes(d.id)),
    [airDevices, selectedAirDeviceIds]
  );

  const airDeviceLabelById = useMemo(() => {
    const map = new Map<string, string>();
    airDevices.forEach((d) => {
      map.set(d.id, d.location || d.name || d.device_id || d.id);
    });
    return map;
  }, [airDevices]);

  // FGB brand palette for air quality charts
  const FGB_PALETTE = useMemo(() => [
    "#009193", // teal primary
    "#006367", // teal dark
    "#911140", // burgundy
    "#e63f26", // orange-red
    "#a0d5d6", // teal light
    "#f8cbcc", // pink light
  ], []);

  const airColorById = useMemo(() => {
    const map = new Map<string, string>();
    airDeviceIds.forEach((id, idx) => map.set(id, FGB_PALETTE[idx % FGB_PALETTE.length]));
    return map;
  }, [airDeviceIds, FGB_PALETTE]);

  /**
   * Get time range parameters with FORCED bucket selection
   * Bucket is determined ONLY by the time range duration:
   *   - ≤24 hours: 15m granularity
   *   - >24h AND ≤30 days: 1h granularity
   *   - >30 days: 1d granularity
   */
  const getTimeRangeParams = useCallback((tp: TimePeriod, dr?: DateRange) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    switch (tp) {
      case "today":
        // Today: from midnight to now (≤24h → 15m bucket)
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        // Last 7 days (>24h, ≤30d → 1h bucket)
        start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        // Last 30 days (>24h, ≤30d → 1h bucket)
        start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        // From Jan 1st of current year (>30d → 1d bucket)
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case "custom":
        if (!dr) {
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
          start = dr.from;
          end = dr.to;
        }
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Calculate FORCED bucket based on duration (matching backend logic)
    const durationMs = end.getTime() - start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    
    let bucket: '15m' | '1h' | '1d';
    if (durationHours <= 24) {
      bucket = '15m';
    } else if (durationHours <= 24 * 31) {
      bucket = '1h';
    } else {
      bucket = '1d';
    }

    return { start, end, bucket };
  }, []);

  // IMPORTANT: stabilizza start/end/bucket.
  // Prima airEnd era ricalcolato ad ogni render (end = new Date()) => queryKey sempre diversa => refetch infinito.
  const timeRange = useMemo(
    () => getTimeRangeParams(timePeriod, dateRange),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getTimeRangeParams, timePeriod, dateRange?.from?.getTime(), dateRange?.to?.getTime()]
  );

  const { start: airStart, end: airEnd, bucket: airBucket } = timeRange;

  // Devices (all) for Energy timeseries
  const { data: siteDevicesResp } = useDevices(
    project?.siteId ? { site_id: project.siteId } : undefined,
    { enabled: !!project?.siteId }
  );
  const siteDevices = siteDevicesResp?.data ?? [];
  const siteDeviceIds = useMemo(() => siteDevices.map((d) => d.id), [siteDevices]);

  // Creiamo una mappa per lookup istantaneo: ID -> { categoria, nome_circuito }
  const deviceMap = useMemo(() => {
    const map = new Map<string, { category: string; label: string }>();
    siteDevices.forEach((d) => {
      map.set(d.id, {
        // Normalizziamo la categoria (es. 'General' -> 'general')
        category: d.category ? d.category.toLowerCase() : 'other',
        // Se c'è un circuit_name usiamo quello, altrimenti il nome del device
        label: d.circuit_name || d.name || d.device_id,
      });
    });
    return map;
  }, [siteDevices]);

  // If modules are marked disabled in DB but devices exist, infer enablement from device types.
  // This fixes cases where DB auto-enable triggers didn't fire or legacy device_type values are used.
  const inferredHasEnergy = useMemo(
    () => siteDevices.some((d) => ENERGY_DEVICE_TYPES.includes(d.device_type)),
    [siteDevices, ENERGY_DEVICE_TYPES]
  );
  const inferredHasAir = useMemo(
    () => siteDevices.some((d) => d.device_type === "air_quality"),
    [siteDevices]
  );
  const inferredHasWater = useMemo(
    () => siteDevices.some((d) => WATER_DEVICE_TYPES.includes(d.device_type)),
    [siteDevices, WATER_DEVICE_TYPES]
  );

  const resolvedModuleConfig = useMemo(
    () => ({
      energy: { ...moduleConfig.energy, enabled: moduleConfig.energy.enabled || inferredHasEnergy },
      air: { ...moduleConfig.air, enabled: moduleConfig.air.enabled || inferredHasAir },
      water: { ...moduleConfig.water, enabled: moduleConfig.water.enabled || inferredHasWater },
    }),
    [moduleConfig, inferredHasEnergy, inferredHasAir, inferredHasWater]
  );
  const airMetrics = useMemo(
    () => [
      "iaq.co2",
      // DB stores VOC as 'iaq.voc' (canonical 'iaq.tvoc' maps to 'voc')
      "iaq.voc",
      "env.temperature",
      "env.humidity",
      "iaq.pm25",
      "iaq.pm10",
      "iaq.co",
      "iaq.o3",
    ],
    []
  );

  const airTimeseriesQuery = useTimeseries(
    {
      device_ids: selectedAirDeviceIds,
      metrics: airMetrics,
      start: airStart.toISOString(),
      end: airEnd.toISOString(),
      bucket: airBucket,
    },
    {
      enabled: isSupabaseConfigured && selectedAirDeviceIds.length > 0,
    }
  );
  const airTimeseriesResp = airTimeseriesQuery.data;

  // Energy timeseries (single query for all Energy charts)
  const energyMetrics = useMemo(
    () => [
      'energy.power_kw',
      'energy.hvac_kw',
      'energy.lighting_kw',
      'energy.plugs_kw',
      // optional
      'energy.co2_kg',
      'env.temperature',
    ],
    []
  );

  // Use dedicated energy tables for better performance
  const energyTimeseriesQuery = useEnergyTimeseries(
    {
      site_id: project?.siteId,
      device_ids: siteDeviceIds.length > 0 ? siteDeviceIds : undefined,
      metrics: energyMetrics,
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
      bucket: timeRange.bucket,
    },
    {
      enabled: isSupabaseConfigured && (!!project?.siteId || siteDeviceIds.length > 0),
    }
  );
  const energyTimeseriesResp = energyTimeseriesQuery.data;

  // Also fetch energy latest from dedicated table
  const { data: energyLatestResp } = useEnergyLatest(
    project?.siteId ? { site_id: project.siteId } : undefined,
    { enabled: isSupabaseConfigured && !!project?.siteId }
  );

  const { data: airLatestResp } = useLatestTelemetry(
    selectedAirDeviceIds.length
      ? {
          device_ids: selectedAirDeviceIds,
          metrics: airMetrics,
        }
      : undefined,
    {
      enabled: isSupabaseConfigured && selectedAirDeviceIds.length > 0,
    }
  );

  const airLatestByMetric = useMemo(() => {
    // average across selected devices
    const out: Record<string, number> = {};
    if (!airLatestResp?.data) return out;

    const sum: Record<string, { total: number; count: number }> = {};
    Object.values(airLatestResp.data).forEach((deviceMetrics) => {
      deviceMetrics.forEach((m) => {
        if (!sum[m.metric]) sum[m.metric] = { total: 0, count: 0 };
        sum[m.metric].total += m.value;
        sum[m.metric].count += 1;
      });
    });

    Object.entries(sum).forEach(([metric, { total, count }]) => {
      out[metric] = count ? total / count : 0;
    });

    return out;
  }, [airLatestResp]);

  const buildSeriesByMetric = useCallback(
    (metric: string, limitValue?: number, keySuffix?: string) => {
      // shape: { time: string, limit?: number, d_<id>[_suffix]: number }
      const keyOf = (id: string) => {
        const base = `d_${id.replace(/-/g, "")}`;
        return keySuffix ? `${base}_${keySuffix}` : base;
      };
      
      /**
       * Label formatting based on FORCED bucket (from timeRange.bucket):
       *   - 15m bucket: "HH:MM" (e.g., "14:30")
       *   - 1h bucket: "dd/MM HH:00" for week/month, "HH:00" for today
       *   - 1d bucket: "dd/MM"
       */
      const labelOf = (ts: Date) => {
        const pad = (n: number) => String(n).padStart(2, "0");
        const bucket = timeRange.bucket;
        
        if (bucket === '15m') {
          // 15-minute granularity: show HH:MM
          return `${pad(ts.getHours())}:${pad(ts.getMinutes())}`;
        }
        
        if (bucket === '1h') {
          // Hourly granularity
          if (timePeriod === "today") {
            return `${pad(ts.getHours())}:00`;
          }
          // Week/month: show date + hour
          const day = pad(ts.getDate());
          const month = pad(ts.getMonth() + 1);
          return `${day}/${month} ${pad(ts.getHours())}:00`;
        }
        
        // Daily granularity: show dd/MM
        const day = pad(ts.getDate());
        const month = pad(ts.getMonth() + 1);
        return `${day}/${month}`;
      };

      const points = airTimeseriesResp?.data ?? [];
      const filtered = points.filter((p) => p.metric === metric);
      if (filtered.length === 0) return [] as Array<Record<string, unknown>>;

      const map = new Map<string, Record<string, unknown>>();
      filtered.forEach((p) => {
        const t = labelOf(new Date(p.ts_bucket));
        if (!map.has(t)) map.set(t, { time: t });
        map.get(t)![keyOf(p.device_id)] = p.value_avg;
        if (typeof limitValue === "number") map.get(t)!.limit = limitValue;
      });

      return Array.from(map.values());
    },
    [airTimeseriesResp, timePeriod, timeRange.bucket]
  );
  
  // Always call hooks unconditionally to comply with React rules
  const mockEnergyData = useEnergyData(timePeriod, dateRange);
  const filteredDeviceData = useDeviceData(timePeriod, dateRange);
  const filteredCO2Data = useCO2Data(timePeriod, dateRange);
  const filteredWaterData = useWaterData(timePeriod, dateRange);
  const periodLabel = getPeriodLabel(timePeriod, dateRange);
  
  // Use real data if available, otherwise fall back to mock generators
  const filteredEnergyData = realTimeEnergy.isRealData ? realTimeEnergy.data : mockEnergyData;
  
  // Real-time indicator for charts
  const isRealTimeData = realTimeEnergy.isRealData || projectTelemetry.isRealData;
  
  // Different total slides based on dashboard
  const getTotalSlides = () => {
    switch (activeDashboard) {
      case "overview": return 1;
      case "energy": return 4;
      case "air": return 3;
      case "water": return 3;
      case "certification": return 2;
      default: return 4;
    }
  };
  
  const totalSlides = getTotalSlides();

  // Chart refs for export
  const energyDensityRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const actualVsAvgRef = useRef<HTMLDivElement>(null);
  const powerConsRef = useRef<HTMLDivElement>(null);
  const deviceConsRef = useRef<HTMLDivElement>(null);
  const carbonRef = useRef<HTMLDivElement>(null);
  const trendRef = useRef<HTMLDivElement>(null);
  const outdoorRef = useRef<HTMLDivElement>(null);
  const airQualityRef = useRef<HTMLDivElement>(null);
  
  // Air quality chart refs
  const co2TrendRef = useRef<HTMLDivElement>(null);
  const tvocTrendRef = useRef<HTMLDivElement>(null);
  const tempHumidityRef = useRef<HTMLDivElement>(null);
  const pm25Ref = useRef<HTMLDivElement>(null);
  const pm10Ref = useRef<HTMLDivElement>(null);
  const coO3Ref = useRef<HTMLDivElement>(null);

  // Water dashboard refs
  const waterConsumptionRef = useRef<HTMLDivElement>(null);
  const waterLeaksRef = useRef<HTMLDivElement>(null);
  const waterQualityRef = useRef<HTMLDivElement>(null);
  const waterTrendRef = useRef<HTMLDivElement>(null);
  const waterDistributionRef = useRef<HTMLDivElement>(null);
  const waterEfficiencyRef = useRef<HTMLDivElement>(null);

  // Generate heatmap data
  const heatmapData = useMemo(() => {
    const hours = [];
    for (let h = 0; h < 24; h++) {
      const row = [];
      for (let d = 0; d < 7; d++) {
        const r = Math.random();
        row.push(r > 0.85 ? 4 : r > 0.6 ? 3 : r > 0.35 ? 2 : 1);
      }
      hours.push(row);
    }
    return hours;
  }, [project?.id]);

  const heatmapExportData = useMemo(() => {
    const days = ['27-05', '28-05', '29-05', '30-05', '31-05', '01-06', '02-06'];
    return heatmapData.map((row, h) => {
      const obj: Record<string, unknown> = { hour: `${String(h).padStart(2, '0')}:00` };
      days.forEach((day, d) => obj[day] = row[d]);
      return obj;
    });
  }, [heatmapData]);

  // Monthly energy data
  const monthlyData = useMemo(() => [
    { month: 'Jan', actual: 850, expected: 900, average: 780, offHours: 120 },
    { month: 'Feb', actual: 720, expected: 850, average: 750, offHours: 100 },
    { month: 'Mar', actual: 680, expected: 800, average: 720, offHours: 90 },
    { month: 'Apr', actual: 590, expected: 750, average: 680, offHours: 80 },
    { month: 'May', actual: 480, expected: 600, average: 550, offHours: 70 },
    { month: 'Jun', actual: 420, expected: 500, average: 480, offHours: 60 },
    { month: 'Jul', actual: 380, expected: 450, average: 420, offHours: 55 },
    { month: 'Aug', actual: 410, expected: 480, average: 450, offHours: 65 },
    { month: 'Sep', actual: 520, expected: 600, average: 550, offHours: 75 },
    { month: 'Oct', actual: 650, expected: 750, average: 680, offHours: 90 },
    { month: 'Nov', actual: 780, expected: 850, average: 750, offHours: 110 },
    { month: 'Dec', actual: 890, expected: 950, average: 820, offHours: 130 },
  ], []);

  // Device consumption data
  const deviceData = useMemo(() => [
    { month: 'Jan', hvac: 8500, lighting: 4200, plugs: 2100 },
    { month: 'Feb', hvac: 7800, lighting: 3900, plugs: 2000 },
    { month: 'Mar', hvac: 6500, lighting: 3600, plugs: 1900 },
    { month: 'Apr', hvac: 5200, lighting: 3400, plugs: 1800 },
    { month: 'May', hvac: 4800, lighting: 3200, plugs: 1750 },
    { month: 'Jun', hvac: 6200, lighting: 3000, plugs: 1700 },
    { month: 'Jul', hvac: 7500, lighting: 2800, plugs: 1650 },
    { month: 'Aug', hvac: 7800, lighting: 2900, plugs: 1680 },
    { month: 'Sep', hvac: 6000, lighting: 3100, plugs: 1720 },
    { month: 'Oct', hvac: 4500, lighting: 3500, plugs: 1850 },
    { month: 'Nov', hvac: 6800, lighting: 3800, plugs: 1950 },
    { month: 'Dec', hvac: 8200, lighting: 4100, plugs: 2050 },
  ], []);

  // Carbon footprint data
  const carbonData = useMemo(() => [
    { week: 'W1', june: 450, july: 520, august: 480, september: 410 },
    { week: 'W2', june: 380, july: 490, august: 520, september: 390 },
    { week: 'W3', june: 420, july: 550, august: 490, september: 420 },
    { week: 'W4', june: 390, july: 480, august: 510, september: 380 },
  ], []);

  // Energy trend data
  const trendData = useMemo(() => [
    { day: 'Tue', general: 4.2, lights: 1.8, hvac: 2.1, plugs: 0.8 },
    { day: 'Wed', general: 8.5, lights: 2.2, hvac: 4.8, plugs: 1.2 },
    { day: 'Thu', general: 12.8, lights: 3.1, hvac: 7.2, plugs: 1.8 },
    { day: 'Fri', general: 18.5, lights: 4.2, hvac: 10.5, plugs: 2.4 },
  ], []);

  // Energy vs outdoor data
  const outdoorData = useMemo(() => [
    { day: 'Tue', hvacOffice: 3.2, temperature: 2.1 },
    { day: 'Wed', hvacOffice: 5.8, temperature: 4.2 },
    { day: 'Thu', hvacOffice: 8.5, temperature: 6.8 },
    { day: 'Fri', hvacOffice: 12.2, temperature: 9.5 },
  ], []);

  // Period table data
  const periodData = useMemo(() => [
    { period: 'Mar 2025', kWh: 4834.81, price: 'US$1,112.01', trend: 'down' },
    { period: 'Apr 2025', kWh: 5423.12, price: 'US$1,247.32', trend: 'down' },
    { period: 'May 2025', kWh: 5759.18, price: 'US$1,324.61', trend: 'down' },
    { period: 'Jun 2025', kWh: 757.51, price: 'US$174.23', trend: 'down' },
  ], []);

  // Donut chart data
  const donutData = useMemo(() => [
    { name: 'HVAC', value: 45, color: 'hsl(188, 100%, 19%)' },
    { name: 'Lighting', value: 35, color: 'hsl(338, 50%, 45%)' },
    { name: 'Plugs and Loads', value: 20, color: 'hsl(338, 50%, 75%)' },
  ], []);

  // Alert data for export
  const alertData = useMemo(() => [
    { type: 'Critical', count: 0 },
    { type: 'High', count: 0 },
    { type: 'Medium', count: 0 },
    { type: 'Low', count: 0 },
  ], []);

  // Air quality historical data
  const co2HistoryData = useMemo(() => [
    { time: '00:00', co2: 420, limit: 1000 },
    { time: '02:00', co2: 380, limit: 1000 },
    { time: '04:00', co2: 350, limit: 1000 },
    { time: '06:00', co2: 390, limit: 1000 },
    { time: '08:00', co2: 580, limit: 1000 },
    { time: '10:00', co2: 720, limit: 1000 },
    { time: '12:00', co2: 680, limit: 1000 },
    { time: '14:00', co2: 750, limit: 1000 },
    { time: '16:00', co2: 690, limit: 1000 },
    { time: '18:00', co2: 520, limit: 1000 },
    { time: '20:00', co2: 450, limit: 1000 },
    { time: '22:00', co2: 400, limit: 1000 },
  ], []);

  const tvocHistoryData = useMemo(() => [
    { time: '00:00', tvoc: 120, limit: 500 },
    { time: '02:00', tvoc: 95, limit: 500 },
    { time: '04:00', tvoc: 85, limit: 500 },
    { time: '06:00', tvoc: 110, limit: 500 },
    { time: '08:00', tvoc: 280, limit: 500 },
    { time: '10:00', tvoc: 350, limit: 500 },
    { time: '12:00', tvoc: 320, limit: 500 },
    { time: '14:00', tvoc: 380, limit: 500 },
    { time: '16:00', tvoc: 290, limit: 500 },
    { time: '18:00', tvoc: 180, limit: 500 },
    { time: '20:00', tvoc: 150, limit: 500 },
    { time: '22:00', tvoc: 130, limit: 500 },
  ], []);

  const tempHumidityData = useMemo(() => [
    { time: '00:00', temp: 21.5, humidity: 45 },
    { time: '02:00', temp: 21.0, humidity: 48 },
    { time: '04:00', temp: 20.5, humidity: 52 },
    { time: '06:00', temp: 20.8, humidity: 50 },
    { time: '08:00', temp: 22.0, humidity: 42 },
    { time: '10:00', temp: 23.5, humidity: 38 },
    { time: '12:00', temp: 24.0, humidity: 35 },
    { time: '14:00', temp: 24.5, humidity: 33 },
    { time: '16:00', temp: 24.0, humidity: 36 },
    { time: '18:00', temp: 23.0, humidity: 40 },
    { time: '20:00', temp: 22.0, humidity: 44 },
    { time: '22:00', temp: 21.5, humidity: 46 },
  ], []);

  const pm25Data = useMemo(() => [
    { day: 'Lun', indoor: 12, outdoor: 28, limit: 25 },
    { day: 'Mar', indoor: 15, outdoor: 35, limit: 25 },
    { day: 'Mer', indoor: 10, outdoor: 22, limit: 25 },
    { day: 'Gio', indoor: 18, outdoor: 42, limit: 25 },
    { day: 'Ven', indoor: 14, outdoor: 30, limit: 25 },
    { day: 'Sab', indoor: 8, outdoor: 18, limit: 25 },
    { day: 'Dom', indoor: 6, outdoor: 15, limit: 25 },
  ], []);

  const pm10Data = useMemo(() => [
    { day: 'Lun', indoor: 22, outdoor: 45, limit: 50 },
    { day: 'Mar', indoor: 28, outdoor: 58, limit: 50 },
    { day: 'Mer', indoor: 18, outdoor: 38, limit: 50 },
    { day: 'Gio', indoor: 32, outdoor: 65, limit: 50 },
    { day: 'Ven', indoor: 25, outdoor: 48, limit: 50 },
    { day: 'Sab', indoor: 15, outdoor: 32, limit: 50 },
    { day: 'Dom', indoor: 12, outdoor: 28, limit: 50 },
  ], []);

  const coO3Data = useMemo(() => [
    { time: '00:00', co: 0.8, o3: 15 },
    { time: '04:00', co: 0.5, o3: 12 },
    { time: '08:00', co: 1.2, o3: 25 },
    { time: '12:00', co: 0.9, o3: 45 },
    { time: '16:00', co: 1.1, o3: 38 },
    { time: '20:00', co: 0.7, o3: 20 },
  ], []);

  // ---------------------------------------------------------------------------
  // Air module: multi-device series (real data with fallback to mocks)
  // NOTE: Must be declared AFTER mock datasets to avoid TS "used before declaration".
  // ---------------------------------------------------------------------------
  const co2MultiSeries = useMemo(() => {
    if (!isSupabaseConfigured) return co2HistoryData;
    const data = buildSeriesByMetric("iaq.co2", 1000);
    return data.length ? data : co2HistoryData;
  }, [buildSeriesByMetric, co2HistoryData]);

  const tvocMultiSeries = useMemo(() => {
    if (!isSupabaseConfigured) return tvocHistoryData;
    const data = buildSeriesByMetric("iaq.voc", 500);
    return data.length ? data : tvocHistoryData;
  }, [buildSeriesByMetric, tvocHistoryData]);

  const tempHumidityMultiSeries = useMemo(() => {
    if (!isSupabaseConfigured) return tempHumidityData;

    // Use different keys so temp & humidity don't overwrite each other
    const temp = buildSeriesByMetric("env.temperature", undefined, "temp");
    const hum = buildSeriesByMetric("env.humidity", undefined, "hum");

    const byTime = new Map<string, Record<string, unknown>>();
    [...temp, ...hum].forEach((row) => {
      const t = String(row.time);
      if (!byTime.has(t)) byTime.set(t, { time: t });
      Object.entries(row).forEach(([k, v]) => {
        if (k !== "time") byTime.get(t)![k] = v;
      });
    });

    const merged = Array.from(byTime.values());
    return merged.length ? merged : tempHumidityData;
  }, [buildSeriesByMetric, tempHumidityData]);

  const coO3MultiSeries = useMemo(() => {
    if (!isSupabaseConfigured) return coO3Data;

    // Use different keys so CO & O3 don't overwrite each other
    const co = buildSeriesByMetric("iaq.co", undefined, "co");
    const o3 = buildSeriesByMetric("iaq.o3", undefined, "o3");

    const byTime = new Map<string, Record<string, unknown>>();
    [...co, ...o3].forEach((row) => {
      const t = String(row.time);
      if (!byTime.has(t)) byTime.set(t, { time: t });
      Object.entries(row).forEach(([k, v]) => {
        if (k !== "time") byTime.get(t)![k] = v;
      });
    });

    const merged = Array.from(byTime.values());
    return merged.length ? merged : coO3Data;
  }, [buildSeriesByMetric, coO3Data]);

  const pm25MultiSeries = useMemo(() => {
    if (!isSupabaseConfigured) return pm25Data as any;
    const data = buildSeriesByMetric('iaq.pm25', 25);
    return data.length ? data : (pm25Data as any);
  }, [buildSeriesByMetric, pm25Data]);

  const pm10MultiSeries = useMemo(() => {
    if (!isSupabaseConfigured) return pm10Data as any;
    const data = buildSeriesByMetric('iaq.pm10', 50);
    return data.length ? data : (pm10Data as any);
  }, [buildSeriesByMetric, pm10Data]);

  // ---------------------------------------------------------------------------
  // Energy module: build real series from a single timeseries query
  // ---------------------------------------------------------------------------
  // --- NUOVO CALCOLO: ENERGY CONSUMPTION OVER TIME ---
  // --- FIX: ENERGY CONSUMPTION OVER TIME (Data Parsing Corretto) ---
  // --- 2. DATI GRAFICO: ENERGY CONSUMPTION OVER TIME (Sempre Potenza kW) ---
  const energyConsumptionData = useMemo(() => {
    const rawData = energyTimeseriesResp?.data;
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) return [];

    const groupedMap = new Map<string, any>();

    rawData.forEach((d) => {
      // A. Parsing Data Sicuro
      const rawTs = d.ts_bucket || d.ts || d.ts_hour || d.ts_day;
      const dateObj = parseTimestamp(rawTs);

      if (!dateObj) return;

      // B. Info Device (Se non ho info sul device, lo ignoro per sicurezza)
      const deviceInfo = deviceMap.get(d.device_id);
      if (!deviceInfo) return; 

      // C. Chiave Raggruppamento Temporale
      const tsKey = dateObj.toISOString();
      
      // Inizializza l'oggetto per questo timestamp se non esiste
      if (!groupedMap.has(tsKey)) {
        let label = "";
        if (timePeriod === 'today') {
            label = dateObj.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        } else if (timePeriod === 'week' || timePeriod === 'month') {
            label = dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        } else {
            label = dateObj.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' });
        }

        groupedMap.set(tsKey, {
          ts: tsKey,
          label: label,
          General: 0, HVAC: 0, Lighting: 0, Other: 0
        });
      }

      const entry = groupedMap.get(tsKey);

      // D. Valore (Sempre Potenza kW)
      const val = Number(d.value_avg ?? d.value);
      if (isNaN(val)) return;

      // E. Assegnazione Valori
      if (energyViewMode === 'category') {
        const cat = deviceInfo.category;

        if (cat === 'general') {
            entry.General += val; 
        } else if (cat === 'hvac') {
            entry.HVAC += val;
        } else if (cat === 'lighting') {
            entry.Lighting += val;
        } else {
            entry.Other += val;
        }
      } else {
        // Vista Device Singolo
        const circuitKey = deviceInfo.label;
        entry[circuitKey] = (entry[circuitKey] || 0) + val;
      }
    });

    // F. Ordinamento Temporale
    return Array.from(groupedMap.values()).sort((a, b) => 
      new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );
  }, [energyTimeseriesResp, timePeriod, energyViewMode, deviceMap]);

  // Estrai le chiavi dei device per la legenda dinamica (solo mode Device)
  const deviceKeys = useMemo(() => {
    if (energyViewMode !== 'device' || !energyConsumptionData.length) return [];
    const keys = new Set<string>();
    energyConsumptionData.forEach(row => {
      Object.keys(row).forEach(k => {
        if (k !== 'ts' && k !== 'label' && k !== 'General' && k !== 'HVAC' && k !== 'Lighting' && k !== 'Plugs') keys.add(k);
      });
    });
    return Array.from(keys);
  }, [energyConsumptionData, energyViewMode]);
  
  // bucketHours: multiply by hours in bucket to convert avg kW to kWh
  const bucketHours = useMemo(() => {
    const bucket = timeRange.bucket;
    if (bucket === '15m') return 0.25; // 15 minutes = 0.25 hours
    if (bucket === '1h') return 1;
    if (bucket === '1d') return 24;
    return 1;
  }, [timeRange.bucket]);

  const buildEnergySeriesSum = useCallback(
    (metric: string) => {
      const points = energyTimeseriesResp?.data ?? [];
      const filtered = points.filter((p) => p.metric === metric);
      if (filtered.length === 0) return [] as Array<Record<string, unknown>>;

      /**
       * Label formatting based on FORCED bucket (from timeRange.bucket):
       *   - 15m bucket: "HH:MM"
       *   - 1h bucket: "dd/MM HH:00" for week/month, "HH:00" for today
       *   - 1d bucket: "dd/MM"
       */
      const labelOf = (ts: Date) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        const bucket = timeRange.bucket;
        
        if (bucket === '15m') {
          return `${pad(ts.getHours())}:${pad(ts.getMinutes())}`;
        }
        
        if (bucket === '1h') {
          if (timePeriod === 'today') {
            return `${pad(ts.getHours())}:00`;
          }
          const day = pad(ts.getDate());
          const month = pad(ts.getMonth() + 1);
          return `${day}/${month} ${pad(ts.getHours())}:00`;
        }
        
        // Daily: dd/MM
        const day = pad(ts.getDate());
        const month = pad(ts.getMonth() + 1);
        return `${day}/${month}`;
      };

      const byLabel = new Map<string, number>();
      filtered.forEach((p) => {
        const label = labelOf(new Date(p.ts_bucket));
        byLabel.set(label, (byLabel.get(label) ?? 0) + (p.value_avg ?? 0));
      });

      return Array.from(byLabel.entries()).map(([label, value]) => ({ label, value }));
    },
    [energyTimeseriesResp, timePeriod, timeRange.bucket]
  );

  const energyTrendLiveData = useMemo(() => {
    if (!isSupabaseConfigured) return trendData;

    const general = buildEnergySeriesSum('energy.power_kw');
    const hvac = buildEnergySeriesSum('energy.hvac_kw');
    const lights = buildEnergySeriesSum('energy.lighting_kw');
    const plugs = buildEnergySeriesSum('energy.plugs_kw');

    const map = new Map<string, Record<string, unknown>>();
    const merge = (rows: Array<Record<string, unknown>>, key: string) => {
      rows.forEach((r) => {
        const label = String(r.label);
        if (!map.has(label)) map.set(label, { day: label });
        map.get(label)![key] = r.value;
      });
    };

    merge(general as any, 'general');
    merge(hvac as any, 'hvac');
    merge(lights as any, 'lights');
    merge(plugs as any, 'plugs');

    const out = Array.from(map.values());
    return out.length ? out : trendData;
  }, [buildEnergySeriesSum, isSupabaseConfigured, trendData]);

  const energyDeviceConsumptionLiveData = useMemo(() => {
    if (!isSupabaseConfigured) return filteredDeviceData;

    // Convert avg kW to approximate kWh per bucket (keep chart units in kWh)
    const hvac = buildEnergySeriesSum('energy.hvac_kw');
    const lighting = buildEnergySeriesSum('energy.lighting_kw');
    const plugs = buildEnergySeriesSum('energy.plugs_kw');

    const map = new Map<string, Record<string, unknown>>();
    const merge = (rows: Array<Record<string, unknown>>, key: string) => {
      rows.forEach((r) => {
        const label = String(r.label);
        if (!map.has(label)) map.set(label, { label });
        map.get(label)![key] = (Number(r.value) || 0) * bucketHours;
      });
    };

    merge(hvac as any, 'hvac');
    merge(lighting as any, 'lighting');
    merge(plugs as any, 'plugs');

    const out = Array.from(map.values());
    return out.length ? out : filteredDeviceData;
  }, [bucketHours, buildEnergySeriesSum, filteredDeviceData, isSupabaseConfigured]);

  const energyCarbonLiveData = useMemo(() => {
    if (!isSupabaseConfigured) return carbonData;

    // Prefer energy.co2_kg if present; otherwise estimate from kWh
    const co2 = buildEnergySeriesSum('energy.co2_kg');
    const hvac = buildEnergySeriesSum('energy.hvac_kw');
    const lighting = buildEnergySeriesSum('energy.lighting_kw');
    const plugs = buildEnergySeriesSum('energy.plugs_kw');

    const map = new Map<string, Record<string, unknown>>();
    const ensure = (label: string) => {
      if (!map.has(label)) map.set(label, { week: label });
      return map.get(label)!;
    };

    co2.forEach((r: any) => {
      const obj = ensure(String(r.label));
      obj.co2 = r.value;
    });

    const defaultKgPerKwh = 0.233;
    const addKwh = (rows: any[], key: string) => {
      rows.forEach((r) => {
        const obj = ensure(String(r.label));
        obj[key] = (Number(r.value) || 0) * bucketHours;
      });
    };
    addKwh(hvac as any, 'hvac_kwh');
    addKwh(lighting as any, 'lighting_kwh');
    addKwh(plugs as any, 'plugs_kwh');

    Array.from(map.values()).forEach((row) => {
      if (row.co2 == null) {
        const totalKwh =
          (Number(row.hvac_kwh) || 0) + (Number(row.lighting_kwh) || 0) + (Number(row.plugs_kwh) || 0);
        row.co2 = totalKwh * defaultKgPerKwh;
      }
    });

    const out = Array.from(map.values()).map((r: any) => ({
      week: r.week,
      june: 0,
      july: Number(r.co2) || 0,
      august: 0,
      september: 0,
    }));

    return out.length ? out : carbonData;
  }, [bucketHours, buildEnergySeriesSum, carbonData, isSupabaseConfigured]);

  // 1. Chiamata all'hook che fa il join tra energia e meteo
  const { data: energyOutdoorData, isLoading: isEnergyOutdoorLoading } = useEnergyWeatherAnalysis(
    project?.siteId,
    timePeriod,
    dateRange
  );

  // 2. Preparazione dati per il grafico
  const energyOutdoorLiveData = useMemo(() => {
    // Se non ho dati reali o API, uso i dati mock (adattandoli alla nuova struttura)
    if (!isSupabaseConfigured || (!energyOutdoorData?.length && !isEnergyOutdoorLoading)) {
      return outdoorData.map(d => ({
        time: d.day,
        hvac: d.hvacOffice, // map mock key
        temperature: d.temperature,
        humidity: 50 // mock humidity fisso
      }));
    }
    
    // Mapping dati reali
    return energyOutdoorData.map(d => ({
        time: d.label, 
        hvac: d.hvac,         // kW
        lighting: d.lighting, // kW
        general: d.general,   // kW (Fallback)
        temperature: d.temp,  // °C
        humidity: d.humidity  // %
    }));
  }, [energyOutdoorData, outdoorData, isEnergyOutdoorLoading, isSupabaseConfigured]);

  // 3. Helper per decidere quali linee mostrare (Se ho sottocontatori mostro quelli, altrimenti Generale)
  const hasSubMeters = useMemo(() => {
    if (!energyOutdoorData) return false;
    return energyOutdoorData.some(d => (d.hvac !== null && d.hvac > 0) || (d.lighting !== null && d.lighting > 0));
  }, [energyOutdoorData]);

  // Water dashboard data
  const waterConsumptionData = useMemo(() => [
    { month: 'Gen', consumption: 1250, target: 1100, lastYear: 1400 },
    { month: 'Feb', consumption: 1180, target: 1050, lastYear: 1320 },
    { month: 'Mar', consumption: 1320, target: 1150, lastYear: 1450 },
    { month: 'Apr', consumption: 1420, target: 1200, lastYear: 1580 },
    { month: 'Mag', consumption: 1680, target: 1400, lastYear: 1820 },
    { month: 'Giu', consumption: 1950, target: 1600, lastYear: 2100 },
    { month: 'Lug', consumption: 2180, target: 1800, lastYear: 2350 },
    { month: 'Ago', consumption: 2250, target: 1850, lastYear: 2400 },
    { month: 'Set', consumption: 1780, target: 1500, lastYear: 1920 },
    { month: 'Ott', consumption: 1380, target: 1200, lastYear: 1520 },
    { month: 'Nov', consumption: 1200, target: 1080, lastYear: 1350 },
    { month: 'Dic', consumption: 1150, target: 1050, lastYear: 1280 },
  ], []);

  const waterLeaksData = useMemo(() => [
    { zone: 'Bagni Piano 1', leakRate: 2.3, status: 'warning', detected: '3 giorni fa' },
    { zone: 'Cucina', leakRate: 0.8, status: 'ok', detected: '-' },
    { zone: 'Irrigazione', leakRate: 5.2, status: 'critical', detected: '1 ora fa' },
    { zone: 'Bagni Piano 2', leakRate: 1.1, status: 'ok', detected: '-' },
    { zone: 'HVAC Cooling', leakRate: 0.5, status: 'ok', detected: '-' },
    { zone: 'Fontane', leakRate: 3.8, status: 'warning', detected: '12 ore fa' },
  ], []);

  const waterQualityData = useMemo(() => [
    { time: '00:00', ph: 7.2, turbidity: 0.8, chlorine: 0.5 },
    { time: '04:00', ph: 7.1, turbidity: 0.7, chlorine: 0.48 },
    { time: '08:00', ph: 7.3, turbidity: 1.2, chlorine: 0.52 },
    { time: '12:00', ph: 7.4, turbidity: 1.5, chlorine: 0.55 },
    { time: '16:00', ph: 7.2, turbidity: 1.1, chlorine: 0.51 },
    { time: '20:00', ph: 7.1, turbidity: 0.9, chlorine: 0.49 },
  ], []);

  const waterDistributionData = useMemo(() => [
    { name: 'Sanitari', value: 35, color: 'hsl(200, 80%, 50%)' },
    { name: 'HVAC', value: 28, color: 'hsl(200, 60%, 40%)' },
    { name: 'Irrigazione', value: 18, color: 'hsl(200, 70%, 60%)' },
    { name: 'Cucina', value: 12, color: 'hsl(200, 50%, 70%)' },
    { name: 'Altro', value: 7, color: 'hsl(200, 40%, 80%)' },
  ], []);

  // Energy distribution with cumulative kWh values based on time period
  // --- NUOVO CALCOLO: ENERGY BREAKDOWN (Donut Chart) ---
  // --- 4. DATI GRAFICO: ENERGY CONSUMPTION BREAKDOWN (Donut Chart) ---
  const energyDistributionData = useMemo(() => {
    // 1. Validazione Dati
    const data = energyTimeseriesResp?.data;
    if (!data || !Array.isArray(data) || data.length === 0) return [];

    // 2. Inizializzazione Totali
    let totalGeneral = 0;
    let totalHVAC = 0;
    let totalLighting = 0;
    let totalPlugs = 0;
    let totalOtherDefined = 0; // Device esplicitamente categorizzati come 'other'
    
    // Mappa per vista "Device"
    const deviceTotals = new Map<string, number>();

    // 3. Somma Valori (kWh)
    data.forEach(d => {
        // Usa value_sum (aggregato) o value (raw)
        const val = Number(d.value_sum ?? d.value ?? 0);
        if (val <= 0) return;

        const info = deviceMap.get(d.device_id);
        if (!info) return;

        // Accumula per Categoria
        if (info.category === 'general') totalGeneral += val;
        else if (info.category === 'hvac') totalHVAC += val;
        else if (info.category === 'lighting') totalLighting += val;
        else if (info.category === 'plugs') totalPlugs += val;
        else totalOtherDefined += val;

        // Accumula per Device (escludendo il generale per evitare duplicati nella vista device)
        if (info.category !== 'general') {
             deviceTotals.set(info.label, (deviceTotals.get(info.label) || 0) + val);
        }
    });

    // 4. Creazione Segmenti in base alla Modalità
    let segments = [];

    if (energyViewMode === 'category') {
        // Calcola il totale dei sotto-contatori noti
        const subTotal = totalHVAC + totalLighting + totalPlugs + totalOtherDefined;
        
        // CASO A: Ho solo il Generale (Nessun sotto-contatore)
        // "se c'è solo general allora la scritta è general"
        if (subTotal === 0 && totalGeneral > 0) {
            segments.push({ name: 'General', value: totalGeneral, color: '#009193' }); // FGB Teal
        } 
        // CASO B: Ho sotto-contatori
        else {
            if (totalHVAC > 0) segments.push({ name: 'HVAC', value: totalHVAC, color: '#006367' }); // Dark Teal
            if (totalLighting > 0) segments.push({ name: 'Lighting', value: totalLighting, color: '#e63f26' }); // Orange-Red
            if (totalPlugs > 0) segments.push({ name: 'Plugs & Loads', value: totalPlugs, color: '#f8cbcc' }); // Pink Light
            if (totalOtherDefined > 0) segments.push({ name: 'Other Devices', value: totalOtherDefined, color: '#911140' }); // Burgundy

            // Calcola il "Resto" del Generale (consumi non monitorati dai sotto-contatori)
            // Se il Generale è < della somma (errore dati), il resto è 0.
            const remainder = Math.max(0, totalGeneral - subTotal);
            
            // Mostriamo "Other" solo se c'è una differenza significativa (> 1 kWh)
            // Se il cliente ha "General" e "HVAC", la differenza è il resto dell'edificio.
            if (remainder > 1) {
                 segments.push({ name: 'Other', value: remainder, color: '#a0d5d6' }); // Teal Light
            }
        }
    } else {
        // VISTA DEVICE: Mostra i singoli carichi
        // Se non ci sono device specifici ma c'è il generale, mostra il generale
        if (deviceTotals.size === 0 && totalGeneral > 0) {
             segments.push({ name: 'General', value: totalGeneral, color: '#009193' });
        } else {
            // Ordina per consumo decrescente
            const sortedDevices = Array.from(deviceTotals.entries())
                .sort((a, b) => b[1] - a[1]);
            
            sortedDevices.forEach((entry, index) => {
                segments.push({
                    name: entry[0],
                    value: entry[1],
                    // Cicla sulla palette FGB
                    color: FGB_PALETTE[index % FGB_PALETTE.length]
                });
            });
        }
    }

    return segments;
  }, [energyTimeseriesResp, energyViewMode, deviceMap, FGB_PALETTE]);

  // Totale per il Centro del Donut
  const totalBreakdownKwh = useMemo(() => {
    // Il totale deve essere sempre quello del "General" se esiste, 
    // altrimenti la somma dei segmenti.
    const data = energyTimeseriesResp?.data || [];
    let generalSum = 0;
    
    // Prova a calcolare il Generale reale dai dati
    data.forEach(d => {
        const info = deviceMap.get(d.device_id);
        if (info && info.category === 'general') {
            generalSum += Number(d.value_sum ?? d.value ?? 0);
        }
    });

    // Se abbiamo un generale, usiamo quello (è la verità assoluta del contatore)
    if (generalSum > 0) return generalSum;

    // Fallback: Somma dei segmenti (se non c'è un contatore generale ma solo parziali)
    return energyDistributionData.reduce((sum, item) => sum + (item.value || 0), 0);
  }, [energyTimeseriesResp, deviceMap, energyDistributionData]);
  
  // --- NUOVO CALCOLO: DENSITÀ ENERGETICA MEDIA ---
  // --- FIX: DENSITÀ ENERGETICA MEDIA (Logica Somma Pura / Area) ---
  // --- FIX: DENSITÀ ENERGETICA (Variabile: ENERGIA, Operazione: SOMMA) ---
  const densityValue = useMemo(() => {
    const data = energyTimeseriesResp?.data;
    const area = Number(project?.area_m2 || 0);

    // Se manca l'area, non possiamo calcolare la densità (divisione per zero)
    if (!area || area <= 0) return "---";

    // Se i dati mancano (null/undefined), usiamo un array vuoto per non rompere il ciclo.
    // Non ritorniamo più "---" qui: se è vuoto, il consumo sarà 0.
    const safeData = Array.isArray(data) ? data : [];

    // 1. Filtro: Solo device 'General' usando la mappa (più preciso della metrica)
    const generalData = safeData.filter(d => {
        // Usa la deviceMap se disponibile
        if (deviceMap && deviceMap.size > 0) {
            const info = deviceMap.get(d.device_id);
            return info && info.category === 'general';
        }
        // Fallback temporaneo se la mappa non è ancora caricata: filtra per metrica
        // Nota: questo fallback serve solo nei primi millisecondi di caricamento
        return d.metric === 'energy.active_energy' || d.metric === 'energy.power_kw';
    });

    // 2. Somma Pura (kWh)
    // api.ts ora restituisce 'value_sum' (Energia Totale) per aggregati (hourly/daily)
    // e 'value' (Energia 15min) per raw. Entrambi sono già kWh.
    const totalKWh = generalData.reduce((acc, curr) => {
      // Se il valore è nullo (buco), usiamo 0
      const energy = Number(curr.value_sum ?? curr.value ?? 0);
      return acc + energy;
    }, 0);

    // 3. Calcolo finale
    return (totalKWh / area).toFixed(1);
  }, [energyTimeseriesResp, project, deviceMap]);

  const estimatedCostData = useMemo(() => {
    // 1. Recupera Prezzo (dal project o fallback a 0)
    const price = Number(project?.energy_price_kwh ?? 0);
    
    // Se non ho il prezzo o non ho dati, ritorno null per gestire la UI
    const data = energyTimeseriesResp?.data;
    if (!price || price <= 0 || !data || !Array.isArray(data)) {
      return null; 
    }

    // 2. Calcola Energia Totale (Solo Generale)
    // Usiamo la stessa logica robusta della Densità
    const totalKWh = data.reduce((acc, curr) => {
        // Filtra solo General
        const info = deviceMap.get(curr.device_id);
        const isGeneral = (info && info.category === 'general') || 
                          (!info && (curr.metric === 'energy.power_kw' || curr.metric === 'energy.active_energy'));
        
        if (!isGeneral) return acc;

        // Somma kWh (value_sum o value)
        return acc + Number(curr.value_sum ?? curr.value ?? 0);
    }, 0);

    // 3. Calcolo Costo
    const cost = totalKWh * price;

    return {
      totalCost: cost,
      pricePerKwh: price
    };
  }, [energyTimeseriesResp, project, deviceMap]);

  // --- 5. WIDGET: ENERGY PERIODS (Pivot Table Annuale) ---
  
  // A. Stato per il widget
  const [energyPeriodsYear, setEnergyPeriodsYear] = useState(new Date().getFullYear());
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]); // Array di chiavi "YYYY-MM"

  // B. Fetch Dati Annuali (Granularità Giornaliera per Drill-down)
  // Questa query è indipendente dai filtri globali (timePeriod)
  const { data: periodsResp } = useEnergyTimeseries(
    {
      site_id: project?.siteId,
      start: `${energyPeriodsYear}-01-01T00:00:00.000Z`,
      end: `${energyPeriodsYear}-12-31T23:59:59.999Z`,
      metrics: ['energy.active_energy'],
      bucket: '1d',
    },
    {
      // Fetch solo se siamo nella tab energy
      enabled: !!project?.siteId && activeDashboard === 'energy', 
    }
  );

  // C. Elaborazione Dati (Raggruppamento Mese -> Giorni)
  const energyPeriodsData = useMemo(() => {
    const rawData = periodsResp?.data;
    if (!rawData || !Array.isArray(rawData)) return [];

    const pricePerKwh = Number(project?.energy_price_kwh ?? 0);
    const monthsMap = new Map<string, {
      monthKey: string;     // YYYY-MM per ordinamento
      monthLabel: string;   // "Mar 2025"
      totalKwh: number;
      totalCost: number;
      days: Map<string, {   // Map per unire eventuali record doppi nello stesso giorno
        dayKey: string;     // YYYY-MM-DD
        dayLabel: string;   // "01 Mar 2025"
        kwh: number;
        cost: number;
      }>
    }>();

    const now = new Date();

    rawData.forEach(d => {
      // 1. Filtra solo dispositivi "general" (Main Meter / Totale sito)
      const info = deviceMap.get(d.device_id);
      const isGeneral = (info && info.category === 'general') || !info;
      if (!isGeneral) return;

      // 2. Recupera Valore kWh dal campo value_sum (somma giornaliera da energy_daily)
      const kwh = Number(d.value_sum ?? d.value ?? 0);
      if (kwh <= 0) return; // Ignora zero o negativi

      // 3. Parsing Data
      const ts = d.ts_bucket || d.ts;
      if (!ts) return;
      const date = new Date(ts);

      // 3b. Scarta date future (protezione anti-anomalie)
      if (date > now) return;
      
      const monthKey = date.toISOString().slice(0, 7); // "2025-03"
      const dayKey = date.toISOString().slice(0, 10);  // "2025-03-01"

      // 4. Inizializza Mese se non esiste
      if (!monthsMap.has(monthKey)) {
        monthsMap.set(monthKey, {
          monthKey,
          monthLabel: date.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }), // "Mar 2025"
          totalKwh: 0,
          totalCost: 0,
          days: new Map()
        });
      }
      
      const monthEntry = monthsMap.get(monthKey)!;
      const cost = kwh * pricePerKwh;

      // Aggiorna Totali Mese
      monthEntry.totalKwh += kwh;
      monthEntry.totalCost += cost;

      // 5. Gestione Giorno (Drill-down)
      if (!monthEntry.days.has(dayKey)) {
        monthEntry.days.set(dayKey, {
          dayKey,
          dayLabel: date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }), // "01 Mar 2025"
          kwh: 0,
          cost: 0
        });
      }
      const dayEntry = monthEntry.days.get(dayKey)!;
      dayEntry.kwh += kwh;
      dayEntry.cost += cost;
    });

    // 6. Trasformazione in Array e Ordinamento
    return Array.from(monthsMap.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey)) // Ascendente Gen -> Dic
      .map(m => ({
        ...m,
        // Converti map giorni in array ordinato
        days: Array.from(m.days.values()).sort((a, b) => a.dayKey.localeCompare(b.dayKey))
      }));

  }, [periodsResp, deviceMap, project?.energy_price_kwh]);

  // Helper per espandere/collassare
  const togglePeriodExpand = (monthKey: string) => {
    setExpandedMonths(prev => 
      prev.includes(monthKey) ? prev.filter(k => k !== monthKey) : [...prev, monthKey]
    );
  };

// --- 6. WIDGET: HEATMAP (Matrice Temporale Dinamica) ---

  // ✅ FIX 1: Selezione robusta del Main Meter (un SOLO device)
  // Motivo: se la categoria "general" non è popolata, la heatmap risultava vuota.
  const heatmapMainDeviceId = useMemo(() => {
    if (!siteDevices || siteDevices.length === 0) return null;

    // 1) Preferisci sempre un energy_monitor
    const monitor = siteDevices.find((d) => d.device_type === 'energy_monitor');
    if (monitor) return monitor.id;

    // 2) Fallback: un device marcato come "general"
    const general = siteDevices.find((d) => (d.category || '').toLowerCase() === 'general');
    if (general) return general.id;

    // 3) Ultimo fallback: qualunque device energia (meglio di niente)
    const anyEnergy = siteDevices.find((d) => ENERGY_DEVICE_TYPES.includes(d.device_type));
    return anyEnergy?.id ?? null;
  }, [siteDevices, ENERGY_DEVICE_TYPES]);

  // ✅ HEATMAP RANGE + BUCKET (solo per il widget heatmap)
  // Obiettivo:
  // - TODAY/WEEK/MONTH: bucket=1h
  // - YEAR: bucket=1d
  // + start/end allineati a confini di giorno/mese/anno per avere griglia stabile.
  const heatmapConfig = useMemo(() => {
    const now = new Date();

    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
    const endOfYear = (d: Date) => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

    let start: Date;
    let end: Date;

    if (timePeriod === 'custom' && dateRange) {
      // Manteniamo l'intervallo selezionato dall'utente.
      start = dateRange.from;
      end = dateRange.to;
    } else if (timePeriod === 'today') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (timePeriod === 'week') {
      const s = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
      start = s;
      end = endOfDay(now);
    } else if (timePeriod === 'month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else {
      // year
      start = startOfYear(now);
      end = endOfYear(now);
    }

    const bucket: '15m' | '1h' | '1d' = timePeriod === 'year' ? '1d' : '1h';
    return { start, end, bucket };
  }, [timePeriod, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  const { data: heatmapResp } = useEnergyTimeseries(
    {
      device_ids: heatmapMainDeviceId ? [heatmapMainDeviceId] : undefined,
      site_id: undefined, // 🔒 Strict: mai query per sito
      start: heatmapConfig.start.toISOString(),
      end: heatmapConfig.end.toISOString(),
      metrics: ['energy.active_energy'],
      bucket: heatmapConfig.bucket,
    },
    {
      enabled: !!heatmapMainDeviceId && activeDashboard === 'energy',
    }
  );

  // B. Elaborazione Dati a Matrice
  const heatmapGrid = useMemo(() => {
    const rawData = heatmapResp?.data || [];
    const isYearView = timePeriod === 'year';

    const toLocalDateKey = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const valueMap = new Map<string, number>();

    rawData.forEach((d) => {
      const val = Number(d.value_sum ?? d.value ?? 0);
      if (!Number.isFinite(val) || val <= 0) return;

      const parsed = parseTimestamp(d.ts_bucket || d.ts);
      if (!parsed) return;

      let rowKey: number;
      let colKey: string;

      if (isYearView) {
        rowKey = parsed.getDate(); // 1-31
        colKey = String(parsed.getMonth()); // 0-11
      } else {
        rowKey = parsed.getHours(); // 0-23 (LOCALE)
        // ✅ FIX: colKey in LOCALE, non UTC (evita shift giorno/ora)
        colKey = toLocalDateKey(parsed);
      }

      const cellKey = `${rowKey}_${colKey}`;
      valueMap.set(cellKey, (valueMap.get(cellKey) || 0) + val);
    });

    // --- Scale per-store (quantili) ---
    const values = Array.from(valueMap.values()).filter((v) => v > 0).sort((a, b) => a - b);
    const minVal = values.length ? values[0] : 0;
    const maxVal = values.length ? values[values.length - 1] : 0;

    const quantile = (p: number) => {
      if (!values.length) return 0;
      const idx = Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * p)));
      return values[idx];
    };

    const scale = {
      min: minVal,
      max: maxVal,
      t1: quantile(0.2),
      t2: quantile(0.4),
      t3: quantile(0.6),
      t4: quantile(0.8),
    };

    let rows: number[] = [];
    let cols: { key: string; label: string }[] = [];

    if (isYearView) {
      rows = Array.from({ length: 31 }, (_, i) => i + 1);
      cols = Array.from({ length: 12 }, (_, i) => ({
        key: String(i),
        label: new Date(2024, i, 1)
          .toLocaleDateString('it-IT', { month: 'short' })
          .toUpperCase(),
      }));
    } else {
      rows = Array.from({ length: 24 }, (_, i) => i);

      // ✅ FIX: itera sui giorni locali (evita duplicati/skip per timezone)
      const startDay = new Date(
        heatmapConfig.start.getFullYear(),
        heatmapConfig.start.getMonth(),
        heatmapConfig.start.getDate()
      );
      const endDay = new Date(
        heatmapConfig.end.getFullYear(),
        heatmapConfig.end.getMonth(),
        heatmapConfig.end.getDate()
      );

      const current = new Date(startDay);
      while (current <= endDay) {
        cols.push({
          key: toLocalDateKey(current),
          label: current.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        });
        current.setDate(current.getDate() + 1);
      }
    }

    return { rows, cols, valueMap, scale, isYearView };
  }, [heatmapResp, timePeriod, heatmapConfig]);

  const heatmapLegendColors = useMemo(
    () => [
      'hsl(var(--heatmap-1))',
      'hsl(var(--heatmap-2))',
      'hsl(var(--heatmap-3))',
      'hsl(var(--heatmap-4))',
      'hsl(var(--heatmap-5))',
    ],
    []
  );

  // C. Helper Colore (Scala per-store: quantili + fallback)
  const getHeatmapColor = useCallback(
    (val: number, scale: { min: number; max: number; t1: number; t2: number; t3: number; t4: number }) => {
      if (!val || val <= 0 || !Number.isFinite(val)) return 'hsl(var(--heatmap-empty))';

      // Caso “piatto”: tutti i valori identici -> usa un tono medio (non rosso)
      if (scale.max > 0 && scale.max === scale.min) return 'hsl(var(--heatmap-3))';

      if (val <= scale.t1) return 'hsl(var(--heatmap-1))';
      if (val <= scale.t2) return 'hsl(var(--heatmap-2))';
      if (val <= scale.t3) return 'hsl(var(--heatmap-3))';
      if (val <= scale.t4) return 'hsl(var(--heatmap-4))';
      return 'hsl(var(--heatmap-5))';
    },
    []
  );

  // --- 7. WIDGET: ACTUAL VS AVERAGE (Grafico Linee Comparativo) ---

  const actualVsAverageData = useMemo(() => {
    const rawData = energyTimeseriesResp?.data || [];
    const area = Number(project?.area_m2 || 0);
    
    if (!area || area <= 0 || rawData.length === 0) return { data: [], summary: null };

    // 1. Raggruppa i dati in base al bucket temporale corrente
    // (Anno -> Mesi, Mese -> Giorni, Giorno -> Ore)
    const groupedMap = new Map<string, {
      ts: string;
      tsLabel: string;
      kwhActual: number;
      count: number;
    }>();

    // Determina il formato della data per l'asse X
    const isYear = timePeriod === 'year';
    const isToday = timePeriod === 'today';
    // Se "today", i dati raw sono 15min, ma il grafico vuole granularità oraria
    
    rawData.forEach(d => {
        // Filtra solo General
        const info = deviceMap.get(d.device_id);
        const isGeneral = (info && info.category === 'general') || 
                          (!info && (d.metric === 'energy.power_kw' || d.metric === 'energy.active_energy'));
        if (!isGeneral) return;

        // Usa value_sum (energia)
        const val = Number(d.value_sum ?? d.value ?? 0);
        if (val <= 0) return;

        const date = new Date(d.ts_bucket || d.ts);
        let key: string;
        let label: string;

        if (isYear) {
            key = date.toISOString().slice(0, 7); // YYYY-MM
            label = date.toLocaleDateString('it-IT', { month: 'short' });
        } else if (isToday) {
            // Raggruppa per ora
            const h = String(date.getHours()).padStart(2, '0');
            key = `${date.toISOString().slice(0, 10)}T${h}`; 
            label = `${h}:00`;
        } else {
            // Mese/Settimana -> Giorni
            key = date.toISOString().slice(0, 10); // YYYY-MM-DD
            label = date.getDate().toString();
        }

        if (!groupedMap.has(key)) {
            groupedMap.set(key, { ts: key, tsLabel: label, kwhActual: 0, count: 0 });
        }
        const entry = groupedMap.get(key)!;
        entry.kwhActual += val;
        entry.count++;
    });

    // 2. Costruisci array e calcola metriche derivate (Avg, Benchmark)
    const chartData = Array.from(groupedMap.values())
        .sort((a, b) => a.ts.localeCompare(b.ts))
        .map(item => {
            const actualDensity = item.kwhActual / area;
            
            // --- SIMULAZIONE DATI PEER & BENCHMARK ---
            // In produzione, questi verrebbero da un'API separata o DB
            
            // Average: Simuliamo che sia un po' più basso dell'actual (es. 90%) con un po' di rumore
            const simAverage = actualDensity * (0.9 + (Math.random() * 0.2 - 0.1));
            
            // Range (Min/Max): Banda attorno all'average
            const simMin = simAverage * 0.8;
            const simMax = simAverage * 1.2;

            // Benchmark: Linea target fissa (es. 15% in meno dell'attuale medio)
            // Se anno/mese, varia leggermente. Se giorno, segue curva oraria tipica.
            const simBenchmark = actualDensity * 0.85; 

            return {
                ...item,
                actual: actualDensity,
                average: simAverage,
                min: simMin,
                max: simMax,
                // Per l'area range chart (Recharts usa range area [min, max])
                range: [simMin, simMax], 
                benchmark: simBenchmark
            };
        });

    // 3. Calcola Sommario per Banner
    const totalActual = chartData.reduce((acc, cur) => acc + cur.actual, 0);
    const totalAverage = chartData.reduce((acc, cur) => acc + cur.average, 0);
    
    let diffPct = 0;
    let status: 'above' | 'below' | 'line' = 'line';
    
    if (totalAverage > 0) {
        diffPct = ((totalActual / totalAverage) - 1) * 100;
        if (diffPct > 0.5) status = 'above';
        else if (diffPct < -0.5) status = 'below';
    }

    return { 
        data: chartData, 
        summary: { diffPct, status, totalActual, totalAverage } 
    };
  }, [energyTimeseriesResp, project, timePeriod, deviceMap]);

  // --- 8. WIDGET: POWER CONSUMPTION (Real-time Donut kW) ---

  // A. Fetch Dati Live (Tabella energy_latest)
  const { data: latestEnergyResp } = useEnergyLatest({
    site_id: project?.siteId,
    // Cerchiamo le metriche di potenza tipiche
    metrics: ['energy.power_kw', 'energy.active_power', 'power'] 
  }, {
    enabled: !!project?.siteId && activeDashboard === 'energy',
    refetchInterval: 30000, // Aggiorna ogni 30 secondi
  });

  // B. Elaborazione Dati (Simile a Energy Breakdown ma per Potenza)
  const powerDistributionData = useMemo(() => {
    const devicesData = latestEnergyResp?.data;
    if (!devicesData) return [];

    let totalGeneral = 0;
    let totalHVAC = 0;
    let totalLighting = 0;
    let totalPlugs = 0;
    let totalOtherDefined = 0;
    
    const deviceTotals = new Map<string, number>();

    // 1. Itera su tutti i device trovati nel latest
    Object.entries(devicesData).forEach(([deviceId, metrics]) => {
        const info = deviceMap.get(deviceId);
        if (!info) return; // Ignora device sconosciuti

        // Trova la metrica di potenza (kW)
        const powerMetric = metrics.find(m => 
            m.metric === 'energy.power_kw' || 
            m.metric === 'energy.active_power' ||
            m.metric === 'power'
        );
        
        const val = Number(powerMetric?.value || 0);
        if (val <= 0) return;

        // 2. Accumula per Categoria
        if (info.category === 'general') totalGeneral += val;
        else if (info.category === 'hvac') totalHVAC += val;
        else if (info.category === 'lighting') totalLighting += val;
        else if (info.category === 'plugs') totalPlugs += val;
        else totalOtherDefined += val;

        // 3. Accumula per Device (escluso general per evitare duplicati nella view device)
        if (info.category !== 'general') {
             deviceTotals.set(info.label, val);
        }
    });

    // 4. Costruzione Segmenti Grafico
    let segments = [];

    if (energyViewMode === 'category') {
        const subTotal = totalHVAC + totalLighting + totalPlugs + totalOtherDefined;
        
        // Se non ho sottocontatori ma ho il generale -> 100% General
        if (subTotal === 0 && totalGeneral > 0) {
            segments.push({ name: 'General', value: totalGeneral, color: '#009193' });
        } else {
            // Ho sottocontatori -> Mostro breakdown
            if (totalHVAC > 0) segments.push({ name: 'HVAC', value: totalHVAC, color: '#006367' });
            if (totalLighting > 0) segments.push({ name: 'Lighting', value: totalLighting, color: '#e63f26' });
            if (totalPlugs > 0) segments.push({ name: 'Plugs & Loads', value: totalPlugs, color: '#f8cbcc' });
            if (totalOtherDefined > 0) segments.push({ name: 'Other Devices', value: totalOtherDefined, color: '#911140' });

            // Il "Resto" è Other
            const remainder = Math.max(0, totalGeneral - subTotal);
            if (remainder > 0.1) { // Soglia minima 100W per mostrare "Other"
                 segments.push({ name: 'Other', value: remainder, color: '#a0d5d6' });
            }
        }
    } else {
        // Vista Device: Lista piatta dei carichi
        // Se ho solo il generale, mostro quello
        if (deviceTotals.size === 0 && totalGeneral > 0) {
             segments.push({ name: 'General', value: totalGeneral, color: '#009193' });
        } else {
            const sortedDevices = Array.from(deviceTotals.entries()).sort((a, b) => b[1] - a[1]);
            sortedDevices.forEach((entry, index) => {
                segments.push({
                    name: entry[0],
                    value: entry[1],
                    color: FGB_PALETTE[index % FGB_PALETTE.length]
                });
            });
        }
    }
    return segments;
  }, [latestEnergyResp, energyViewMode, deviceMap, FGB_PALETTE]);

  // C. Calcolo Totale KW (Centro del Donut)
  const totalPowerKw = useMemo(() => {
      const devicesData = latestEnergyResp?.data;
      if (!devicesData) return 0;

      // Cerca il valore del meter "General"
      let generalVal = 0;
      let sumSub = 0;

      Object.entries(devicesData).forEach(([deviceId, metrics]) => {
          const powerMetric = metrics.find(m => m.metric === 'energy.power_kw' || m.metric === 'energy.active_power');
          const val = Number(powerMetric?.value || 0);
          
          const info = deviceMap.get(deviceId);
          if (info?.category === 'general') generalVal = val;
          else sumSub += val;
      });

      // Se c'è il generale, è la verità. Altrimenti somma parziali.
      return generalVal > 0 ? generalVal : sumSub;
  }, [latestEnergyResp, deviceMap]);

  // --- 9. WIDGET: DEVICES CONSUMPTION (Stacked Bar Chart) ---
  const deviceConsumptionData = useMemo(() => {
    const rawData = energyTimeseriesResp?.data;
    if (!rawData || !Array.isArray(rawData)) return { data: [], keys: [] };

    // 1. Raggruppa per Bucket Temporale (X-Axis)
    const grouped = new Map<string, any>();
    const foundKeys = new Set<string>(); // Tracciamo le chiavi trovate (hvac, lighting, device_X...)

    rawData.forEach(d => {
        const val = Number(d.value_sum ?? d.value ?? 0);
        if (val <= 0) return;

        // Determina il Bucket (X-Axis)
        const date = new Date(d.ts_bucket || d.ts);
        let timeKey = '';
        let label = '';

        if (timePeriod === 'year') {
             timeKey = date.toISOString().slice(0, 7); // YYYY-MM
             label = date.toLocaleDateString('it-IT', { month: 'short' });
        } else if (timePeriod === 'today' || timeRange.bucket === '1h') {
             const h = String(date.getHours()).padStart(2, '0');
             timeKey = `${date.toISOString().slice(0, 10)}T${h}`;
             label = `${h}:00`;
        } else {
             timeKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
             label = date.getDate().toString();
        }

        if (!grouped.has(timeKey)) {
            grouped.set(timeKey, { label, timestamp: date.getTime(), _general: 0 });
        }
        const entry = grouped.get(timeKey);

        // Determina la Chiave dello Stack (Stack Key)
        const info = deviceMap.get(d.device_id);
        const isGeneral = info?.category === 'general';

        if (isGeneral) {
            entry._general += val;
        } else {
            let stackKey = 'Other';
            
            if (energyViewMode === 'category') {
                // Normalizza le categorie per lo stack
                if (info?.category === 'hvac') stackKey = 'HVAC';
                else if (info?.category === 'lighting') stackKey = 'Lighting';
                else if (info?.category === 'plugs') stackKey = 'Plugs';
            } else {
                // Vista Device: usa il nome del device
                stackKey = info?.label || d.device_id;
            }
            
            // Arrotonda e somma
            // (Nota: arrotondiamo alla fine per precisione, ma qui serve per pulizia chiavi)
            foundKeys.add(stackKey);
            entry[stackKey] = (entry[stackKey] || 0) + val;
        }
    });

    // 2. Post-processing: Fallback Generale vs Stack
    const finalData = Array.from(grouped.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .map(entry => {
            // Calcola somma stack (escluso _general)
            const stackSum = Object.keys(entry)
                .filter(k => k !== 'label' && k !== 'timestamp' && k !== '_general')
                .reduce((sum, k) => sum + (entry[k] || 0), 0);

            // LOGICA DI VISUALIZZAZIONE:
            // Se ho stack (stackSum > 0), mostro quello e ignoro il generale (per evitare duplicati visivi).
            // Se NON ho stack ma ho il generale, mostro il generale come colonna unica.
            
            if (stackSum > 0) {
                // Ho dettagli: ritorno solo i dettagli
                const { _general, timestamp, ...rest } = entry;
                return rest;
            } else if (entry._general > 0) {
                // Ho solo generale: ritorno generale
                foundKeys.add('General');
                return { label: entry.label, General: entry._general };
            }
            return null; // Skip empty buckets
        })
        .filter(Boolean); // Rimuovi null

    // Ordina le chiavi per avere un ordine di stack coerente (es. HVAC sempre sotto)
    const sortedKeys = Array.from(foundKeys).sort();

    return { data: finalData, keys: sortedKeys };
  }, [energyTimeseriesResp, energyViewMode, deviceMap, timePeriod, timeRange.bucket]);

  // Helper per colori barre (Category o Device palette)
  const getBarColor = (key: string, index: number) => {
      if (key === 'General') return '#009193'; // FGB Teal
      if (key === 'HVAC') return '#006367'; // Dark Teal
      if (key === 'Lighting') return '#e63f26'; // Orange-Red
      if (key === 'Plugs') return '#f8cbcc'; // Pink Light
      if (key === 'Other') return '#911140'; // Burgundy
      
      // Fallback per Devices View (cicla palette)
      return FGB_PALETTE[index % FGB_PALETTE.length];
  };

  // --- 10. WIDGET: CARBON FOOTPRINT (Multi-Horizon CO2 Analysis) ---
  
  // A. Configurazione Query Estesa (Serve più storico per i confronti)
  const carbonConfig = useMemo(() => {
    const now = new Date();
    // Default: fine oggi
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let start = new Date();
    let bucket = '1d';

    // Determina quanto storico scaricare in base alla vista
    if (timePeriod === 'year') {
        // Scarica ultimi 3 anni per confronto annuale
        start = new Date(now.getFullYear() - 2, 0, 1); 
        bucket = '1M'; // Granularità Mensile
    } else if (timePeriod === 'month') {
        // Scarica ultimi 6 mesi per confronto mensile
        start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        bucket = '1d'; // Granularità Giornaliera (aggregata poi a settimane)
    } else if (timePeriod === 'week') {
        // Scarica ultimo mese intero per confronto settimane
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        bucket = '1d'; 
    } else {
        // Giorno: scarica ultima settimana
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        bucket = '1h';
    }
    return { start, end, bucket };
  }, [timePeriod]);

  // B. Fetch Dati CO2
  const { data: carbonResp } = useEnergyTimeseries({
      site_id: project?.siteId,
      start: carbonConfig.start.toISOString(),
      end: carbonConfig.end.toISOString(),
      metrics: ['energy.active_energy'], // Useremo questo * EF
      bucket: carbonConfig.bucket,
  }, { enabled: !!project?.siteId && activeDashboard === 'energy' });

  // C. Elaborazione Pivot (Il cuore del widget)
  const carbonChartData = useMemo(() => {
      const rawData = carbonResp?.data || [];
      const EF = 0.233; // kgCO2e/kWh (Fattore emissione standard)
      
      const pivotMap = new Map<string, any>();
      const seriesSet = new Set<string>();

      // Helper: Definizione settimana del mese (W1..W5 standard)
      const getMonthWeek = (d: Date) => {
          const day = d.getDate();
          if (day <= 7) return 'W1';
          if (day <= 14) return 'W2';
          if (day <= 21) return 'W3';
          if (day <= 28) return 'W4';
          return 'W5';
      };

      rawData.forEach(d => {
          const valKwh = Number(d.value_sum ?? d.value ?? 0);
          if (valKwh <= 0) return;
          const co2 = valKwh * EF;
          const date = new Date(d.ts_bucket || d.ts);

          let bucketKey = ''; // Asse X
          let seriesKey = ''; // Legenda (Barre)

          if (timePeriod === 'year') {
              // X: Mese (Jan, Feb...), Series: Anno (2024, 2025)
              bucketKey = date.toLocaleDateString('en-US', { month: 'short' }); // "Jan"
              seriesKey = date.getFullYear().toString(); // "2025"
          } 
          else if (timePeriod === 'month') {
              // X: Settimana (W1..W5), Series: Mese (Jun, Jul...)
              bucketKey = getMonthWeek(date);
              seriesKey = date.toLocaleDateString('en-US', { month: 'short' }); // "Mar"
          } 
          else if (timePeriod === 'week') {
              // X: Giorno Week (Mon..Sun), Series: Settimana (W1..W5)
              bucketKey = date.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon"
              seriesKey = getMonthWeek(date); // "W1"
          } 
          else {
              // Day: X: Ora, Series: "Today"
              bucketKey = `${date.getHours()}:00`;
              seriesKey = 'Today';
          }

          if (!pivotMap.has(bucketKey)) {
              pivotMap.set(bucketKey, { bucket: bucketKey });
          }
          const entry = pivotMap.get(bucketKey);
          entry[seriesKey] = (entry[seriesKey] || 0) + co2;
          seriesSet.add(seriesKey);
      });

      // Ordinamento Buckets (Custom Sort per ogni vista)
      let sortedData = Array.from(pivotMap.values());
      const monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const weekOrder = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      const wOrder = ['W1','W2','W3','W4','W5'];

      if (timePeriod === 'year') {
          sortedData.sort((a,b) => monthOrder.indexOf(a.bucket) - monthOrder.indexOf(b.bucket));
      } else if (timePeriod === 'month') {
          sortedData.sort((a,b) => wOrder.indexOf(a.bucket) - wOrder.indexOf(b.bucket));
      } else if (timePeriod === 'week') {
          sortedData.sort((a,b) => weekOrder.indexOf(a.bucket) - weekOrder.indexOf(b.bucket));
      } else {
          sortedData.sort((a,b) => parseInt(a.bucket) - parseInt(b.bucket));
      }

      // Preparazione Serie per Recharts
      // Selezioniamo le ultime N serie per non affollare il grafico
      const sortedSeries = Array.from(seriesSet).sort(); 
      // Logica colori dinamica
      const seriesConfigs = sortedSeries.slice(-4).map((key, idx) => ({
          key,
          label: key,
          color: FGB_PALETTE[idx % FGB_PALETTE.length]
      }));

      return { data: sortedData, series: seriesConfigs };
  }, [carbonResp, timePeriod, FGB_PALETTE]);
                           

  const waterDailyTrendData = useMemo(() => [
    { hour: '06:00', consumption: 45, peak: false },
    { hour: '07:00', consumption: 120, peak: false },
    { hour: '08:00', consumption: 280, peak: true },
    { hour: '09:00', consumption: 350, peak: true },
    { hour: '10:00', consumption: 220, peak: false },
    { hour: '11:00', consumption: 180, peak: false },
    { hour: '12:00', consumption: 290, peak: true },
    { hour: '13:00', consumption: 310, peak: true },
    { hour: '14:00', consumption: 200, peak: false },
    { hour: '15:00', consumption: 170, peak: false },
    { hour: '16:00', consumption: 190, peak: false },
    { hour: '17:00', consumption: 240, peak: false },
    { hour: '18:00', consumption: 320, peak: true },
    { hour: '19:00', consumption: 280, peak: false },
    { hour: '20:00', consumption: 150, peak: false },
    { hour: '21:00', consumption: 90, peak: false },
    { hour: '22:00', consumption: 60, peak: false },
  ], []);

  const waterEfficiencyData = useMemo(() => [
    { week: 'Sett 1', efficiency: 78, waste: 22 },
    { week: 'Sett 2', efficiency: 82, waste: 18 },
    { week: 'Sett 3', efficiency: 75, waste: 25 },
    { week: 'Sett 4', efficiency: 88, waste: 12 },
  ], []);

  // MODIFICA 3: Calcolo dinamico del Brand e dello Sfondo
  // (Integra i brand reali da DB e i brand finti da data.ts)
  const brand = useMemo(() => {
    if (!project || !brands) return null;
    return brands.find(b => b.id === project.brandId) || null;
  }, [project, brands]);

  // Calcolo dello stile di sfondo: Immagine Custom > Pattern Brand > Default Grigio
  const backgroundStyle = useMemo(() => {
    if (!project) return {};

    // 1. Immagine Custom del progetto (Priorità massima - vince su tutto)
    if (project.img) {
      return {
        backgroundImage: `url(${project.img})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }

    // 2. Fallback Colore Solido (Il pattern loghi lo aggiungiamo dopo nell'HTML)
    // Usiamo un grigio chiarissimo FGB
    return { backgroundColor: '#f0f2f5' };
  }, [project]);

  if (!project) return null;

  const nextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  // Swipe handlers
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      nextSlide();
    } else if (isRightSwipe) {
      prevSlide();
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleDashboardChange = (dashboard: DashboardType) => {
    setActiveDashboard(dashboard);
    setCurrentSlide(0);
  };

  const getAqColor = (aq: string) => {
    switch (aq) {
      case "EXCELLENT": return "text-emerald-500";
      case "GOOD": return "text-emerald-600";
      case "MODERATE": return "text-yellow-500";
      case "POOR": return "text-red-500";
      default: return "text-gray-600";
    }
  };

  const getAqBgColor = (aq: string) => {
    switch (aq) {
      case "EXCELLENT": return "bg-emerald-500/20 border-emerald-500/30";
      case "GOOD": return "bg-emerald-500/20 border-emerald-500/30";
      case "MODERATE": return "bg-yellow-500/20 border-yellow-500/30";
      case "POOR": return "bg-red-500/20 border-red-500/30";
      default: return "bg-gray-500/20 border-gray-500/30";
    }
  };

  // Heatmap legend labels based on qualitative judgments
  const heatmapLegendLabels = ['Ottimo', 'Buono', 'Moderato', 'Elevato', 'Critico'];
  const heatmapColors = ['#e8f5e9', '#81c784', '#fdd835', '#f57c00', '#d32f2f'];

  // Air quality data for export
  const airQualityData = [
    { metric: 'Air Quality Index', value: project.data.aq },
    { metric: 'CO2 (ppm)', value: project.data.co2 },
    { metric: 'Temperature', value: project.data.temp },
  ];

  // PDF Export handler
  const handleExportPdf = useCallback(async () => {
    if (!project || isGeneratingPdf) return;
    
    setIsGeneratingPdf(true);
    try {
      await generatePdfReport({
        project,
        timePeriod,
        dateRange,
        // --- MODIFICA: Passiamo la configurazione dei moduli ---
        moduleConfig: resolvedModuleConfig,
        // -------------------------------------------------------
        data: {
          energy: {
            consumption: filteredEnergyData as unknown as Record<string, unknown>[],
            devices: filteredDeviceData as unknown as Record<string, unknown>[],
            co2: filteredCO2Data as unknown as Record<string, unknown>[],
          },
          water: {
            consumption: filteredWaterData as Record<string, unknown>[],
            quality: waterQualityData as Record<string, unknown>[],
            leaks: waterLeaksData as Record<string, unknown>[],
          },
          airQuality: {
            co2History: co2HistoryData as Record<string, unknown>[],
            tempHumidity: tempHumidityData as Record<string, unknown>[],
            particulates: pm25Data as Record<string, unknown>[],
          },
        },
        chartRefs: {
          energyChart: actualVsAvgRef,
          deviceChart: deviceConsRef,
          waterChart: waterConsumptionRef,
          airQualityChart: co2TrendRef,
        },
      });
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [
    project, 
    timePeriod, 
    dateRange, 
    resolvedModuleConfig, // <--- Importante: aggiunto alle dipendenze
    filteredEnergyData, 
    filteredDeviceData, 
    filteredCO2Data, 
    filteredWaterData, 
    waterQualityData, 
    waterLeaksData, 
    co2HistoryData, 
    tempHumidityData, 
    pm25Data, 
    isGeneratingPdf
  ]);

  return (
    <div className="fixed inset-0 z-50 animate-slide-up bg-background">
      
      {/* CONTAINER SFONDO GENERALE */}
      <div 
        className="absolute inset-0 transition-all duration-500 overflow-hidden"
        style={backgroundStyle} // Applica il colore di fondo o l'immagine Hero
      >
        
        {/* LIVELLO PATTERN LOGO (Visibile solo se NON c'è immagine progetto e C'È un logo brand) */}
        {!project?.img && brand?.logo && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url(${brand.logo})`,
              
              // 1. SPAZIATURA: 'space' distanzia i loghi invece di affiancarli stretti
              backgroundRepeat: 'space', 
              
              // 2. DIMENSIONE: 180px (1.5 volte più grande di prima)
              backgroundSize: '180px',   
              
              backgroundPosition: 'center',
              
              // 3. TRASPARENZA: 0.03 = 3% di opacità. 
              // Molto leggero ed elegante. Se lo vuoi più visibile metti 0.05 o 0.08
              opacity: 0.08 
            }}
          />
        )}

        {/* LIVELLO OVERLAY SFUMATO (Migliora sempre la leggibilità) */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/30 to-white/60 pointer-events-none" />
        
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 w-full px-4 md:px-8 py-3 md:py-6 flex justify-between items-center z-10">
        <button 
          onClick={onClose}
          className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-black/10 hover:bg-black/20 backdrop-blur-md rounded-full text-xs md:text-sm font-semibold transition-all group border border-black/10"
        >
          <ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="hidden sm:inline">Back to Region</span>
        </button>
        {/* Change Background Button */}
        <label className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 md:py-2 bg-black/10 hover:bg-black/20 backdrop-blur-md rounded-full text-xs font-medium transition-all cursor-pointer border border-black/10">
          <Image className="w-3.5 h-3.5 md:w-4 md:h-4" />
          <span className="hidden md:inline">Cambia Sfondo</span>
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && project) {
                // TODO: Implementare upload reale su Supabase se necessario qui
                // Per ora mantiene il comportamento locale di anteprima
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const imgEl = document.querySelector(`[data-project-bg="${project.id}"]`) as HTMLImageElement;
                  if (imgEl && ev.target?.result) {
                    imgEl.src = ev.target.result as string;
                  }
                };
                reader.readAsDataURL(file);
              }
            }}
          />
        </label>
      </div>

      {/* Main Content */}
      <div className="absolute inset-0 pt-14 md:pt-20 pb-14 md:pb-16 flex flex-col">
        {/* Title Area with Dashboard Tabs */}
        <div className="px-4 md:px-16 mb-2 md:mb-4 relative z-20">
          {/* Dashboard Tabs - Scrollable on mobile */}
          <div className="flex items-center gap-2 md:gap-3 mb-2 overflow-x-auto pb-1 scrollbar-hide">
            <button 
              onClick={() => handleDashboardChange("overview")}
              className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                activeDashboard === "overview" 
                  ? "bg-fgb-secondary text-white" 
                  : "bg-white/50 text-gray-600 hover:bg-white/80"
              }`}
              title="Overview"
            >
              <LayoutDashboard className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button 
              onClick={() => handleDashboardChange("energy")}
              className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                activeDashboard === "energy" 
                  ? "bg-fgb-secondary text-white" 
                  : "bg-white/50 text-gray-600 hover:bg-white/80"
              }`}
              title="Energy Dashboard"
            >
              <Lightbulb className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button 
              onClick={() => handleDashboardChange("air")}
              className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                activeDashboard === "air" 
                  ? "bg-fgb-secondary text-white" 
                  : "bg-white/50 text-gray-600 hover:bg-white/80"
              }`}
              title="Air Quality Dashboard"
            >
              <Cloud className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button 
              onClick={() => handleDashboardChange("water")}
              className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                activeDashboard === "water" 
                  ? "bg-fgb-secondary text-white" 
                  : "bg-white/50 text-gray-600 hover:bg-white/80"
              }`}
              title="Water Dashboard"
            >
              <Droplet className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button 
              onClick={() => handleDashboardChange("certification")}
              className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                activeDashboard === "certification" 
                  ? "bg-fgb-secondary text-white" 
                  : "bg-white/50 text-gray-600 hover:bg-white/80"
              }`}
              title="Certification Dashboard"
            >
              <Award className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            {/* Time Period Selector & Export */}
            <div className="ml-auto flex items-center gap-1.5 md:gap-3 flex-shrink-0">
              <span className="text-sm text-gray-600 font-medium hidden lg:inline">{periodLabel}</span>
              <TimePeriodSelector
                value={timePeriod}
                onChange={setTimePeriod}
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
              />
              <Button
                onClick={handleExportPdf}
                disabled={isGeneratingPdf}
                variant="outline"
                size="sm"
                className="h-7 md:h-9 px-2 md:px-3 bg-white/50 border-gray-200 rounded-full text-xs md:text-sm font-medium text-gray-700 hover:bg-fgb-secondary hover:text-white"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-2" />
                    <span className="hidden md:inline">Esporta PDF</span>
                  </>
                )}
              </Button>
              {/* Settings Button */}
              <Button
                onClick={() => setSettingsOpen(true)}
                variant="outline"
                size="sm"
                className="h-7 md:h-9 w-7 md:w-9 p-0 bg-white/50 border-gray-200 rounded-full text-gray-700 hover:bg-fgb-secondary hover:text-white"
                title="Impostazioni Progetto"
              >
                <Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </Button>
              <ProjectSettingsDialog 
                siteId={project?.siteId}
                projectName={project?.name}
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
              />
            </div>
          </div>
          
          <h1 className="text-xl md:text-3xl lg:text-4xl font-bold text-fgb-secondary tracking-wide truncate drop-shadow-sm">{project.name}</h1>
          <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm text-gray-700 font-medium flex-wrap">
            <span className="truncate max-w-[150px] md:max-w-none">{project.address}</span>
            <span className="text-gray-400 hidden sm:inline">|</span>
            <span className="flex items-center gap-1">
              {project.data.temp}° <Cloud className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </span>
            {/* Brand & Holding Info - Dinamico */}
            {brand && (
              <>
                <span className="text-gray-400 hidden md:inline">|</span>
                <span className="hidden md:flex items-center gap-2">
                  <Tag className="w-4 h-4 text-gray-500" />
                  <span className="font-medium">{brand.name}</span>
                </span>
                {/* Nota: Per le holding reali bisognerebbe fare un lookup simile, 
                    qui lasciamo semplificato o usiamo getHoldingById se disponibile nel contesto */}
              </>
            )}
          </div>
        </div>

        {/* Carousel Content - Scrollable with touch support */}
        <div 
          className="flex-1 relative overflow-hidden z-20"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div 
            className="flex h-full transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {/* OVERVIEW DASHBOARD */}
            {activeDashboard === "overview" && (
              <div className="w-full flex-shrink-0 overflow-y-auto pb-4">
                <OverviewSection 
                  project={project} 
                  moduleConfig={resolvedModuleConfig} 
                  onNavigate={(tab) => setActiveDashboard(tab as DashboardType)}
                />
              </div>
            )}
            
            {/* ENERGY DASHBOARD */}
            {activeDashboard === "energy" && (
              <ModuleGate module="energy" config={resolvedModuleConfig.energy} demoContent={<EnergyDemoContent />}>
                <>
                {/* Slide 1: Energy Overview */}
                <div className="w-full flex-shrink-0 px-3 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                    {/* Energy Consumption Over Time Chart - REPLACED */}
                    <div ref={actualVsAvgRef} className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <div className="flex items-center gap-2">
                          <div>
                            {/* TITOLO RINOMINATO */}
                            <h3 className="text-base md:text-lg font-bold text-gray-800">Energy consumption over time</h3>
                            <p className="text-[10px] md:text-xs text-gray-500">
                              {timeRange.bucket === '1d' ? 'Energia Giornaliera (kWh)' : 'Potenza Media (kW)'}
                            </p>
                          </div>
                          <DataSourceBadge isRealData={realTimeEnergy.isRealData} isLoading={realTimeEnergy.isLoading} />
                        </div>
                        
                        {/* TOGGLE: CATEGORIE vs DEVICES */}
                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                          <button
                            onClick={() => setEnergyViewMode('category')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                              energyViewMode === 'category' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            Categorie
                          </button>
                          <button
                            onClick={() => setEnergyViewMode('device')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                              energyViewMode === 'device' ? 'bg-white shadow text-slate-900' : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            Devices
                          </button>
                        </div>

                        <ExportButtons chartRef={actualVsAvgRef} data={energyConsumptionData} filename="energy-over-time" onExpand={() => setFullscreenChart('actualVsAvg')} />
                      </div>

                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart
                          data={energyConsumptionData}
                          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                        >
                          <defs>
                            {/* GRADIENTI BASATI SU PALETTE FGB */}
                            {/* General: Teal Primary */}
                            <linearGradient id="colorGeneral" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#009193" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#009193" stopOpacity={0}/>
                            </linearGradient>
                            {/* HVAC: Dark Teal */}
                            <linearGradient id="colorHVAC" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#006367" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#006367" stopOpacity={0}/>
                            </linearGradient>
                            {/* Lighting: Orange/Red */}
                            <linearGradient id="colorLighting" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#e63f26" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#e63f26" stopOpacity={0}/>
                            </linearGradient>
                            {/* Other: Burgundy */}
                            <linearGradient id="colorOther" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#911140" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#911140" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          
                          <CartesianGrid {...gridStyle} />
                          <XAxis 
                            dataKey="label" 
                            tick={{ ...axisStyle, fontSize: 10 }} 
                            axisLine={{ stroke: '#e2e8f0' }} 
                            tickLine={{ stroke: '#e2e8f0' }} 
                            minTickGap={30} 
                          />
                          <YAxis
                            tick={{ ...axisStyle, fontSize: 10 }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={{ stroke: '#e2e8f0' }}
                            width={35}
                            unit=" kW"
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: number) => [value.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' kW', '']}
                            labelStyle={{ color: '#111827', fontWeight: 'bold' }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10, fontWeight: 500, paddingTop: 10 }} iconType="circle" />

                          {energyViewMode === 'category' ? (
                            <>
                              {/* ORDINE DI RENDER: General (Sfondo/Totale) -> Specifici (Sopra) */}
                              
                              {/* General (Totale) - Teal FGB */}
                              <Area 
                                type="monotone" 
                                dataKey="General" 
                                stroke="#009193" 
                                fillOpacity={1} 
                                fill="url(#colorGeneral)" 
                                strokeWidth={2}
                                activeDot={{ r: 5 }}
                              />
                              
                              {/* HVAC - Dark Teal */}
                              <Area 
                                type="monotone" 
                                dataKey="HVAC" 
                                stroke="#006367" 
                                fillOpacity={1} 
                                fill="url(#colorHVAC)" 
                                strokeWidth={2}
                              />
                              
                              {/* Lighting - Orange Red */}
                              <Area 
                                type="monotone" 
                                dataKey="Lighting" 
                                stroke="#e63f26" 
                                fillOpacity={1} 
                                fill="url(#colorLighting)" 
                                strokeWidth={2}
                              />
                              
                              {/* Other - Burgundy */}
                              <Area 
                                type="monotone" 
                                dataKey="Other" 
                                stroke="#911140" 
                                fillOpacity={1} 
                                fill="url(#colorOther)" 
                                strokeWidth={2}
                              />
                            </>
                          ) : (
                            <>
                              {/* VISTA DEVICE: Usa la palette FGB ciclica */}
                              {deviceKeys.slice(0, 10).map((key, idx) => {
                                const color = FGB_PALETTE[idx % FGB_PALETTE.length];
                                return (
                                  <Area
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    stroke={color}
                                    fill={color}
                                    fillOpacity={0.1}
                                    strokeWidth={2}
                                    name={key}
                                  />
                                );
                              })}
                            </>
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Energy Consumption Breakdown Chart - REPLACED */}
                    {/* Energy Consumption Breakdown Chart */}
                    <div ref={energyDensityRef} className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-3 md:mb-4">
                        <h3 className="text-base md:text-lg font-bold text-gray-800">Energy consumption breakdown</h3>
                        <ExportButtons chartRef={energyDensityRef} data={energyDistributionData} filename="energy-breakdown" />
                      </div>
                      <div className="flex items-center gap-4 md:gap-6">
                        {/* Legenda a Sinistra */}
                        <div className="space-y-1.5 md:space-y-2 flex-1 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                          {energyDistributionData.length === 0 ? (
                            <div className="text-sm text-gray-400 italic">No data available</div>
                          ) : (
                            energyDistributionData.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                <span className="text-xs md:text-sm text-gray-600 truncate" title={item.name}>{item.name}</span>
                                <span className="text-xs md:text-sm font-semibold text-gray-800 ml-auto">
                                  {item.value.toLocaleString('it-IT', { maximumFractionDigits: 0 })} kWh
                                </span>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Donut Chart a Destra */}
                        <div className="relative w-28 h-28 md:w-40 md:h-40 flex-shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={energyDistributionData}
                                innerRadius="55%"
                                outerRadius="80%"
                                paddingAngle={2}
                                dataKey="value"
                                stroke="none"
                              >
                                {energyDistributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => [value.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + ' kWh', '']}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          {/* Valore Centrale: Totale kWh */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-lg md:text-xl font-bold text-slate-900">
                              {totalBreakdownKwh.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                            </span>
                            <span className="text-[10px] md:text-xs text-gray-500 font-medium">Total kWh</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-5 shadow-lg text-center">
                        <p className="text-[10px] md:text-sm text-gray-500 mb-0.5 md:mb-1">Energy Density</p>
                        <p className="text-xl md:text-3xl font-bold text-slate-900">{densityValue}</p>
                        <p className="text-[9px] md:text-xs text-gray-500 mt-0.5 md:mt-1">kWh/m²</p>
                        {/* Nota: Il trend "vs anno precedente" richiederebbe una query separata, per ora lo nascondiamo o lasciamo statico */}
                        <div className="mt-1 md:mt-2 text-[10px] md:text-xs text-gray-400 font-medium">in the selected period</div>
                      </div>
                      {/* Widget Costo Stimato */}
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-5 shadow-lg text-center">
                        <p className="text-[10px] md:text-sm text-gray-500 mb-0.5 md:mb-1">
                          Costo Stimato ({periodLabel})
                        </p>
                        
                        <p className="text-xl md:text-3xl font-bold text-gray-800">
                          {estimatedCostData 
                            ? `€${estimatedCostData.totalCost.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` 
                            : '---'}
                        </p>
                        
                        <p className="text-[9px] md:text-xs text-gray-500 mt-0.5 md:mt-1">
                          {estimatedCostData 
                            ? `Consumo × €${estimatedCostData.pricePerKwh.toFixed(3)}/kWh`
                            : 'Prezzo energia non configurato'}
                        </p>
                        
                        {/* Indicatore Trend (Statico o da calcolare in futuro) */}
                        {/* <div className="mt-1 md:mt-2 text-[10px] md:text-xs text-emerald-500 font-medium">↓ €4,200 vs anno prec.</div> */}
                      </div>
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-5 shadow-lg text-center">
                        <p className="text-[10px] md:text-sm text-gray-500 mb-0.5 md:mb-1">Efficienza</p>
                        <p className="text-xl md:text-3xl font-bold text-emerald-500">87%</p>
                        <p className="text-[9px] md:text-xs text-gray-500 mt-0.5 md:mt-1">rating</p>
                        <div className="mt-1 md:mt-2 text-[10px] md:text-xs text-blue-500 font-medium">↑ 3%</div>
                      </div>
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-5 shadow-lg text-center">
                        <p className="text-[10px] md:text-sm text-gray-500 mb-0.5 md:mb-1">Alert Attivi</p>
                        <p className="text-xl md:text-3xl font-bold text-amber-500">{project.data.alerts}</p>
                        <p className="text-[9px] md:text-xs text-gray-500 mt-0.5 md:mt-1">anomalie</p>
                        <div className="mt-1 md:mt-2 text-[10px] md:text-xs text-red-500 font-medium">⚠ Attenzione</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slide 2: Site Alerts & Heatmap */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div ref={alertsRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Site Alerts</h3>
                        <ExportButtons chartRef={alertsRef} data={alertData} filename="site-alerts" />
                      </div>
                      <div className="flex items-start gap-8">
                        <div className="text-center">
                          <p className="text-sm text-gray-500 mb-2">Open now</p>
                          <p className="text-6xl font-bold text-gray-800">{project.data.alerts}</p>
                          <div className="flex gap-2 mt-4">
                            <span className="px-3 py-1 bg-fgb-secondary text-white text-xs rounded-full">0 Critical</span>
                            <span className="px-3 py-1 bg-fgb-secondary text-white text-xs rounded-full">0 High</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-500 mb-4">Opened in last 7 days</p>
                          <div className="space-y-2">
                            {["Critical", "High", "Medium", "Low"].map(level => (
                              <div key={level} className="flex justify-between">
                                <span className="text-sm text-slate-900 font-semibold">{level}</span>
                                <span className="text-sm text-gray-600">0</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Energy Periods Pivot Table */}
                    <div ref={periodRef} className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg h-full flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base md:text-lg font-bold text-gray-800">Energy Periods</h3>
                        
                        <div className="flex items-center gap-2">
                          {/* Selettore Anno Indipendente */}
                          <select 
                            value={energyPeriodsYear}
                            onChange={(e) => setEnergyPeriodsYear(Number(e.target.value))}
                            className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg focus:ring-fgb-primary focus:border-fgb-primary block p-1.5 outline-none font-medium cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                              <option key={year} value={year}>{year}</option>
                            ))}
                          </select>
                          
                          <ExportButtons chartRef={periodRef} data={energyPeriodsData} filename={`energy-periods-${energyPeriodsYear}`} />
                        </div>
                      </div>

                      {/* Tabella Scrollabile */}
                      <div className="overflow-y-auto flex-1 custom-scrollbar pr-1" style={{ maxHeight: '300px' }}>
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-gray-500 uppercase bg-gray-50/90 sticky top-0 z-10">
                            <tr>
                              <th scope="col" className="px-3 py-3 rounded-l-lg">Period</th>
                              <th scope="col" className="px-3 py-3 text-center">kWh</th>
                              <th scope="col" className="px-3 py-3 text-right rounded-r-lg">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {energyPeriodsData.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="px-3 py-8 text-center text-gray-400 italic">
                                  Nessun dato disponibile per il {energyPeriodsYear}
                                </td>
                              </tr>
                            ) : (
                              energyPeriodsData.map((period) => (
                                <>
                                  {/* RIGA MESE (Parent) */}
                                  <tr 
                                    key={period.monthKey} 
                                    onClick={() => togglePeriodExpand(period.monthKey)}
                                    className="bg-white border-b hover:bg-gray-50 cursor-pointer transition-colors group"
                                  >
                                    <td className="px-3 py-3 font-medium text-gray-900 flex items-center gap-2">
                                      <span className={`p-1 rounded-md transition-colors ${expandedMonths.includes(period.monthKey) ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 group-hover:text-emerald-500'}`}>
                                        {expandedMonths.includes(period.monthKey) ? (
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                      </span>
                                      <span className="capitalize">{period.monthLabel}</span>
                                    </td>
                                    <td className="px-3 py-3 text-center font-medium text-gray-600 tabular-nums">
                                      {period.totalKwh.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-3 text-right font-bold text-gray-800 tabular-nums">
                                      {period.totalCost.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                    </td>
                                  </tr>

                                  {/* RIGHE GIORNI (Children) - Renderizzate solo se espanso */}
                                  {expandedMonths.includes(period.monthKey) && period.days.map((day) => (
                                    <tr key={day.dayKey} className="bg-gray-50/50 border-b border-gray-100 animate-slide-down">
                                      <td className="px-3 py-2 pl-10 text-xs text-gray-500 font-medium border-l-2 border-emerald-100">
                                        {day.dayLabel}
                                      </td>
                                      <td className="px-3 py-2 text-center text-xs text-gray-500 tabular-nums">
                                        {day.kwh.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </td>
                                      <td className="px-3 py-2 text-right text-xs text-gray-500 tabular-nums">
                                        {day.cost.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                                      </td>
                                    </tr>
                                  ))}
                                </>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {/* Heatmap Widget - FIX LOGICA ORARIA/GIORNALIERA */}
                    <div ref={heatmapRef} className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-base md:text-lg font-bold text-gray-800">
                          Energy Consumption Heatmap
                        </h3>
                        <div className="flex items-center gap-3">
                          {/* Legendina minimale (scala per-store) */}
                          <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            <span>Low</span>
                            <div className="flex gap-0.5">
                              {heatmapLegendColors.map((c) => (
                                <div key={c} className="w-2 h-2 rounded-sm" style={{ backgroundColor: c }} />
                              ))}
                            </div>
                            <span>High</span>
                          </div>
                          <ExportButtons chartRef={heatmapRef} data={[]} filename="energy-heatmap" />
                        </div>
                      </div>

                      {/* Container Scrollabile per la Griglia */}
                      <div className="flex-1 overflow-x-auto pb-2 custom-scrollbar">
                        <div className="min-w-max">
                          {/* Header Colonne (X-Axis) */}
                          <div className="flex">
                            {/* Spacer angolo in alto a sx */}
                            <div className="w-12 flex-shrink-0 flex items-end justify-center pb-2 text-[10px] font-bold text-gray-400">
                                {heatmapGrid.isYearView ? 'GG' : 'HH'}
                            </div>
                            {/* Labels Colonne */}
                            {heatmapGrid.cols.map(col => (
                                <div key={col.key} className="flex-1 min-w-[24px] text-center text-[10px] font-semibold text-gray-500 pb-1">
                                    {col.label}
                                </div>
                            ))}
                          </div>

                          {/* Body Griglia (Righe Y-Axis) */}
                          {heatmapGrid.rows.map(row => (
                              <div key={row} className="flex items-center h-6 mb-0.5">
                                  {/* Label Riga (00:00 o Day 1) */}
                                  <div className="w-12 flex-shrink-0 text-[10px] text-gray-400 text-right pr-2">
                                      {heatmapGrid.isYearView 
                                        ? row // Giorno mese (1, 2...)
                                        : `${String(row).padStart(2, '0')}:00` // Ora (00:00...)
                                      }
                                  </div>
                                  
                                  {/* Celle */}
                                  {heatmapGrid.cols.map(col => {
                                      const val = heatmapGrid.valueMap.get(`${row}_${col.key}`) || 0;
                                      return (
                                          <div 
                                            key={`${row}-${col.key}`} 
                                            className="flex-1 min-w-[24px] h-full mx-[1px] rounded-sm transition-all hover:opacity-80 hover:scale-110 cursor-pointer relative group"
                                            style={{ backgroundColor: getHeatmapColor(val, heatmapGrid.scale) }}
                                          >
                                            {/* Tooltip on Hover */}
                                            {val > 0 && (
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none shadow-lg">
                                                    <div className="font-bold">
                                                        {heatmapGrid.isYearView 
                                                            ? `${row} ${col.label}` // "15 GEN"
                                                            : `${col.label} ore ${row}:00` // "01/03 ore 14:00"
                                                        }
                                                    </div>
                                                    <div>{val.toFixed(2)} kWh</div>
                                                </div>
                                            )}
                                          </div>
                                      );
                                  })}
                              </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Slide 3: Actual vs Average & Device Consumption */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 h-full pb-20">
                    
                    {/* WIDGET 1: ACTUAL VS AVERAGE */}
                    <div className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-base md:text-lg font-bold text-gray-800">Actual vs Average</h3>
                          <p className="text-xs text-gray-500">Energy Density (kWh/m²)</p>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {/* BANNER DINAMICO */}
                          {actualVsAverageData.summary && (
                            <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
                              actualVsAverageData.summary.status === 'above' 
                                ? 'bg-red-50 text-red-700 border-red-100' 
                                : actualVsAverageData.summary.status === 'below'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-gray-50 text-gray-700 border-gray-100'
                            }`}>
                              {actualVsAverageData.summary.status === 'above' && '↑'}
                              {actualVsAverageData.summary.status === 'below' && '↓'}
                              {actualVsAverageData.summary.status === 'line' && '•'}
                              
                              <span>
                                You are {Math.abs(actualVsAverageData.summary.diffPct).toFixed(2)}% {actualVsAverageData.summary.status} average
                              </span>
                            </div>
                          )}
                          <ExportButtons chartRef={actualVsAvgRef} data={actualVsAverageData.data} filename="actual-vs-average" onExpand={() => setFullscreenChart('actualVsAvg')} />
                        </div>
                      </div>

                      <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={actualVsAverageData.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                              dataKey="tsLabel" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#9ca3af' }} 
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#9ca3af' }} 
                              // FIX: Usa Number(val) per sicurezza
                              tickFormatter={(val) => Number(val).toFixed(2)}
                            />
                            <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              // FIX: Usa Number(value) per sicurezza
                              formatter={(value: any) => [Number(value).toFixed(3) + ' kWh/m²', '']}
                              labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: '0.5rem' }}
                            />
                            <Legend verticalAlign="top" height={36} iconType="plainline" wrapperStyle={{ fontSize: '12px' }}/>

                            {/* BAND: Peer Range (Area) */}
                            <Area 
                              type="monotone" 
                              dataKey="range" 
                              fill="#A6A6A6" 
                              stroke="none" 
                              fillOpacity={0.2} 
                              name="Peer Range" 
                              legendType="rect"
                            />

                            {/* LINE: Peer Average */}
                            <Line 
                              type="monotone" 
                              dataKey="average" 
                              stroke="#3A3A3A" 
                              strokeWidth={1.5} 
                              dot={false} 
                              name="Peer Average"
                            />

                            {/* LINE: Benchmark (Dotted) */}
                            <Line 
                              type="monotone" 
                              dataKey="benchmark" 
                              stroke="#7E0A2F" 
                              strokeWidth={2} 
                              strokeDasharray="4 4" 
                              dot={false} 
                              name="Benchmark"
                            />

                            {/* LINE: Actual (Main) */}
                            <Line 
                              type="monotone" 
                              dataKey="actual" 
                              stroke="#129E97" 
                              strokeWidth={3} 
                              dot={{ r: 3, fill: '#129E97', strokeWidth: 0 }} 
                              activeDot={{ r: 6 }} 
                              name="Actual"
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* WIDGET: POWER CONSUMPTION (Real-time Breakdown) - 1/3 width */}
                    <div ref={powerConsRef} className="lg:col-span-1 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <h3 className="text-base md:text-lg font-bold text-gray-800">Power Consumption</h3>
                            <p className="text-xs text-gray-500">Real-time (kW)</p>
                          </div>
                          <ExportButtons chartRef={powerConsRef} data={powerDistributionData} filename="power-consumption" onExpand={() => setFullscreenChart('powerCons')} />
                        </div>

                        <div className="flex items-center gap-4 flex-1 min-h-[200px]">
                           {/* Legenda Scrollabile */}
                           <div className="space-y-1.5 flex-1 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                              {powerDistributionData.length === 0 ? (
                                <div className="text-sm text-gray-400 italic">No real-time data</div>
                              ) : (
                                powerDistributionData.map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                    <span className="text-xs text-gray-600 truncate max-w-[100px]" title={item.name}>{item.name}</span>
                                    <span className="text-xs font-semibold text-gray-800 ml-auto tabular-nums">
                                      {item.value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW
                                    </span>
                                  </div>
                                ))
                              )}
                           </div>

                           {/* Donut Chart */}
                           <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={powerDistributionData}
                                    innerRadius="60%"
                                    outerRadius="90%"
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="none"
                                  >
                                    {powerDistributionData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [Number(value).toFixed(2) + ' kW', '']}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                              {/* Valore Centrale */}
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-lg md:text-xl font-bold text-slate-900 tabular-nums">
                                  {totalPowerKw.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </span>
                                <span className="text-[10px] text-gray-500 font-medium">kW</span>
                              </div>
                           </div>
                        </div>
                    </div>
                    {/* DEVICES CONSUMPTION (Stacked Bar Chart) - 2/3 width */}
                    <div ref={deviceConsRef} className="lg:col-span-full bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg min-h-[350px] flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-base md:text-lg font-bold text-gray-800">Devices Consumption</h3>
                          <p className="text-xs text-gray-500">Breakdown by {energyViewMode === 'category' ? 'Category' : 'Device'} (kWh)</p>
                        </div>
                        <ExportButtons 
                          chartRef={deviceConsRef} 
                          data={deviceConsumptionData.data} 
                          filename={`devices-consumption-${timePeriod}`} 
                          onExpand={() => setFullscreenChart('deviceCons')}
                        />
                      </div>
                      
                      <div className="flex-1 w-full min-h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={deviceConsumptionData.data} 
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                              dataKey="label" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#9ca3af' }} 
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#9ca3af' }} 
                              tickFormatter={(val) => Number(val).toLocaleString('it-IT', { notation: "compact" })}
                            />
                            <Tooltip 
                              cursor={{ fill: '#f9fafb', opacity: 0.5 }}
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: any, name: string) => [Number(value).toFixed(2) + ' kWh', name]}
                              labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: '0.5rem' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                            
                            {/* Generazione Dinamica delle Barre (Stack) */}
                            {deviceConsumptionData.keys.map((key, index) => (
                                <Bar 
                                    key={key} 
                                    dataKey={key} 
                                    stackId="a" 
                                    fill={getBarColor(key, index)} 
                                    radius={[index === deviceConsumptionData.keys.length - 1 ? 4 : 0, index === deviceConsumptionData.keys.length - 1 ? 4 : 0, 0, 0]}
                                    maxBarSize={60}
                                />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slide 4: Carbon Footprint & Energy Trends */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* RIGA CARBON FOOTPRINT */}
                    <div ref={carbonRef} className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg min-h-[350px] flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-base md:text-lg font-bold text-gray-800">Carbon Footprint Analysis</h3>
                          <p className="text-xs text-gray-500">
                            {timePeriod === 'year' && 'Monthly Comparison (Year vs Year)'}
                            {timePeriod === 'month' && 'Weekly Breakdown (Month vs Month)'}
                            {timePeriod === 'week' && 'Daily Profile (Week vs Week)'}
                            {timePeriod === 'today' && 'Hourly Emissions'}
                            {' '}- kgCO₂e
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200">
                                EF: 0.233 kg/kWh
                            </span>
                            <ExportButtons 
                              chartRef={carbonRef} 
                              data={carbonChartData.data} 
                              filename={`carbon-footprint-${timePeriod}`} 
                              onExpand={() => setFullscreenChart('carbon')}
                            />
                        </div>
                      </div>
                      
                      <div className="flex-1 w-full min-h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart 
                            data={carbonChartData.data} 
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                            barGap={2}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                              dataKey="bucket" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 500 }} 
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#9ca3af' }} 
                              tickFormatter={(val) => Number(val).toLocaleString('it-IT', { notation: "compact" })}
                              label={{ value: 'kgCO₂e', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 10 } }}
                            />
                            <Tooltip 
                              cursor={{ fill: '#f9fafb', opacity: 0.5 }}
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: any, name: string) => [Number(value).toFixed(1) + ' kg', name]}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                            
                            {/* Generazione Barre Dinamiche (Confronto) */}
                            {carbonChartData.series.map((s, index) => (
                                <Bar 
                                    key={s.key} 
                                    dataKey={s.key} 
                                    name={s.label} 
                                    fill={s.color} 
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={50}
                                />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div ref={trendRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Energy Trend Over Time</h3>
                        <ExportButtons chartRef={trendRef} data={energyTrendLiveData as any} filename="energy-trend" onExpand={() => setFullscreenChart('trend')} />
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={energyTrendLiveData as any} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="day" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis
                            tick={axisStyle}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={{ stroke: '#e2e8f0' }}
                            domain={autoDomainWithPadding}
                            label={{ value: 'kW', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }}
                          />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Area type="monotone" dataKey="general" stackId="1" stroke="hsl(188, 100%, 19%)" fill="hsl(188, 100%, 19%)" fillOpacity={0.7} name="General" />
                          <Area type="monotone" dataKey="hvac" stackId="2" stroke="hsl(338, 50%, 45%)" fill="hsl(338, 50%, 45%)" fillOpacity={0.7} name="HVAC" />
                          <Area type="monotone" dataKey="lights" stackId="3" stroke="hsl(188, 100%, 35%)" fill="hsl(188, 100%, 35%)" fillOpacity={0.5} name="Lights" />
                          <Area type="monotone" dataKey="plugs" stackId="4" stroke="hsl(338, 50%, 75%)" fill="hsl(338, 50%, 75%)" fillOpacity={0.5} name="Plugs" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div ref={outdoorRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Energy vs outdoor condition</h3>
                        <ExportButtons chartRef={outdoorRef} data={energyOutdoorLiveData as any} filename="energy-vs-outdoor" onExpand={() => setFullscreenChart('outdoor')} />
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={energyOutdoorLiveData as any} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis 
                            dataKey="time" 
                            tick={axisStyle} 
                            axisLine={{ stroke: '#e2e8f0' }} 
                            tickLine={{ stroke: '#e2e8f0' }} 
                            minTickGap={30}
                          />
                          
                          {/* Asse Sinistro: Potenza (kW) - Pulito senza decimali */}
                          <YAxis
                            yAxisId="power"
                            tick={axisStyle}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={{ stroke: '#e2e8f0' }}
                            domain={autoDomainWithPadding}
                            tickFormatter={(val) => Math.round(val).toString()}
                            label={{ value: 'kW', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }}
                          />
                          
                          {/* Asse Destro: Meteo (°C / %) - Visibile e formattato */}
                          <YAxis
                            yAxisId="temp"
                            orientation="right"
                            tick={axisStyle}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={{ stroke: '#e2e8f0' }}
                            domain={['auto', 'auto']}
                            tickFormatter={(val) => Math.round(val).toString()}
                            label={{ value: '°C / %', angle: 90, position: 'insideRight', style: { ...axisStyle, textAnchor: 'middle' } }}
                          />
                          
                          {/* Tooltip: Pulito e senza decimali folli */}
                          <Tooltip 
                            {...tooltipStyle} 
                            formatter={(value: number) => [Math.round(value * 100) / 100, ""]}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          
                          {/* Linee Energetiche (Asse Sinistro) */}
                          <Line 
                            yAxisId="power" 
                            type="monotone" 
                            dataKey="hvac" 
                            stroke="#006367" 
                            strokeWidth={2.5} 
                            dot={false} 
                            name="HVAC (kW)" 
                            connectNulls
                          />
                          <Line 
                            yAxisId="power" 
                            type="monotone" 
                            dataKey="lighting" 
                            stroke="#e63f26" 
                            strokeWidth={2.5} 
                            dot={false} 
                            name="Lighting (kW)" 
                            connectNulls
                          />
                          {!hasSubMeters && (
                            <Line 
                              yAxisId="power" 
                              type="monotone" 
                              dataKey="general" 
                              stroke="#009193" 
                              strokeWidth={2.5} 
                              dot={false} 
                              name="General (kW)" 
                              connectNulls
                            />
                          )}
                        
                          {/* Linee Meteo (Asse Destro) */}
                          <Line 
                            yAxisId="temp" 
                            type="monotone" 
                            dataKey="temperature" 
                            stroke="#F59E0B" 
                            strokeWidth={2} 
                            dot={false} 
                            name="Temp (°C)" 
                            connectNulls
                          />
                          <Line 
                            yAxisId="temp" 
                            type="monotone" 
                            dataKey="humidity" 
                            stroke="#3b82f6" 
                            strokeWidth={2} 
                            dot={false} 
                            name="Humidity (%)" 
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </>
              </ModuleGate>
            )}
            
            {/* AIR QUALITY DASHBOARD */}
            {activeDashboard === "air" && (
              <ModuleGate module="air" config={resolvedModuleConfig.air} demoContent={<AirDemoContent />}>
                <>
                {/* Slide 1: Overview + CO2 + TVOC */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Air Quality Overview Card */}
                    <div ref={airQualityRef} className="lg:col-span-3 bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg relative">
                      <div className="absolute top-4 right-4">
                        <ExportButtons chartRef={airQualityRef} data={airQualityData} filename="air-quality" />
                      </div>
                     <div className="absolute top-6 left-1/4 -translate-x-1/4 z-10">
                        <AirDeviceSelector
                          devices={airDevices}
                          selectedIds={selectedAirDeviceIds}
                          onChange={setSelectedAirDeviceIds}
                        />
                      </div>
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getAqBgColor(project.data.aq)} ${getAqColor(project.data.aq)} text-xs font-bold`}>
                          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                          LIVE
                        </div>
                        <div>
                          <h3 className={`text-3xl font-bold tracking-tight ${getAqColor(project.data.aq)}`}>
                            {project.data.aq}
                          </h3>
                          <p className="text-gray-500 uppercase tracking-widest text-[10px]">Indoor Air Quality</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                          <Wind className="w-4 h-4 text-sky-500 mx-auto mb-1" />
                          <div className="text-lg font-bold text-gray-800">{Math.round(airLatestByMetric["iaq.co2"] ?? project.data.co2)}</div>
                          <div className="text-[9px] text-gray-500 uppercase">ppm CO₂</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                          <Activity className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                          <div className="text-lg font-bold text-gray-800">{airLatestByMetric["iaq.voc"] == null ? "—" : Math.round(airLatestByMetric["iaq.voc"])}</div>
                          <div className="text-[9px] text-gray-500 uppercase">ppb TVOC</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                          <Thermometer className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                          <div className="text-lg font-bold text-gray-800">{airLatestByMetric["env.temperature"] == null ? "—" : `${Math.round(airLatestByMetric["env.temperature"])}` }°</div>
                          <div className="text-[9px] text-gray-500 uppercase">°C Temp</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                          <Droplets className="w-4 h-4 text-cyan-500 mx-auto mb-1" />
                          <div className="text-lg font-bold text-gray-800">{airLatestByMetric["env.humidity"] == null ? "—" : Math.round(airLatestByMetric["env.humidity"])}</div>
                          <div className="text-[9px] text-gray-500 uppercase">% Umidità</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                          <Cloud className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                          <div className="text-lg font-bold text-gray-800">{airLatestByMetric["iaq.pm25"] == null ? "—" : Math.round(airLatestByMetric["iaq.pm25"])}</div>
                          <div className="text-[9px] text-gray-500 uppercase">µg/m³ PM2.5</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                          <Cloud className="w-4 h-4 text-amber-800 mx-auto mb-1" />
                          <div className="text-lg font-bold text-gray-800">{airLatestByMetric["iaq.pm10"] == null ? "—" : Math.round(airLatestByMetric["iaq.pm10"])}</div>
                          <div className="text-[9px] text-gray-500 uppercase">µg/m³ PM10</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                          <Gauge className="w-4 h-4 text-red-500 mx-auto mb-1" />
                          <div className="text-lg font-bold text-gray-800">{airLatestByMetric["iaq.co"] == null ? "—" : airLatestByMetric["iaq.co"].toFixed(2)}</div>
                          <div className="text-[9px] text-gray-500 uppercase">ppm CO</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                          <Sparkles className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                          <div className="text-lg font-bold text-gray-800">{airLatestByMetric["iaq.o3"] == null ? "—" : Math.round(airLatestByMetric["iaq.o3"])}</div>
                          <div className="text-[9px] text-gray-500 uppercase">ppb O₃</div>
                        </div>
                      </div>
                    </div>

                    {/* CO2 Trend Chart */}
                    <div ref={co2TrendRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">CO₂ Trend ({periodLabel})</h3>
                        <ExportButtons chartRef={co2TrendRef} data={co2MultiSeries as any} filename="co2-trend" onExpand={() => setFullscreenChart('co2Trend')} />
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={co2MultiSeries as any} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 1200]} label={{ value: 'ppm', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          {selectedAirDevices.map((d) => (
                            <Line
                              key={d.id}
                              type="monotone"
                              dataKey={`d_${d.id.replace(/-/g, "")}`}
                              stroke={airColorById.get(d.id)}
                              strokeWidth={2.5}
                              dot={false}
                              name={airDeviceLabelById.get(d.id) || d.id}
                            />
                          ))}
                          <Line type="monotone" dataKey="limit" stroke="#e63f26" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Limite" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* TVOC Trend Chart */}
                    <div ref={tvocTrendRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">TVOC Trend ({periodLabel})</h3>
                        <ExportButtons chartRef={tvocTrendRef} data={tvocMultiSeries as any} filename="tvoc-trend" onExpand={() => setFullscreenChart('tvocTrend')} />
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={tvocMultiSeries as any} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 600]} label={{ value: 'ppb', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          {selectedAirDevices.map((d) => (
                            <Line
                              key={d.id}
                              type="monotone"
                              dataKey={`d_${d.id.replace(/-/g, "")}`}
                              stroke={airColorById.get(d.id)}
                              strokeWidth={2.5}
                              dot={false}
                              name={airDeviceLabelById.get(d.id) || d.id}
                            />
                          ))}
                          <Line type="monotone" dataKey="limit" stroke="#e63f26" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Limite" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Temperature & Humidity Chart - Full Width */}
                    <div ref={tempHumidityRef} className="lg:col-span-3 bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Temperatura & Umidità Relativa ({periodLabel})</h3>
                        <ExportButtons chartRef={tempHumidityRef} data={tempHumidityMultiSeries as any} filename="temp-humidity" onExpand={() => setFullscreenChart('tempHumidity')} />
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={tempHumidityMultiSeries as any} margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis yAxisId="temp" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[18, 28]} label={{ value: '°C', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <YAxis yAxisId="humidity" orientation="right" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[20, 70]} label={{ value: '%HR', angle: 90, position: 'insideRight', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          {selectedAirDevices.map((d) => (
                            <Line
                              key={`${d.id}-temp`}
                              yAxisId="temp"
                              type="monotone"
                              dataKey={`d_${d.id.replace(/-/g, "")}_temp`}
                              stroke={airColorById.get(d.id)}
                              strokeWidth={2.25}
                              dot={false}
                              name={`${airDeviceLabelById.get(d.id) || d.id} · Temp`}
                            />
                          ))}
                          {selectedAirDevices.map((d) => (
                            <Line
                              key={`${d.id}-hum`}
                              yAxisId="humidity"
                              type="monotone"
                              dataKey={`d_${d.id.replace(/-/g, "")}_hum`}
                              stroke={airColorById.get(d.id)}
                              strokeWidth={2.25}
                              strokeDasharray="4 4"
                              dot={false}
                              name={`${airDeviceLabelById.get(d.id) || d.id} · Umidità`}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Slide 2: Particulate Matter PM2.5 & PM10 */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* PM2.5 Chart */}
                    <div ref={pm25Ref} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">PM2.5 - Particolato Fine</h3>
                          <p className="text-xs text-gray-500">Trend ({periodLabel})</p>
                        </div>
                        <ExportButtons chartRef={pm25Ref} data={pm25MultiSeries as any} filename="pm25" onExpand={() => setFullscreenChart('pm25')} />
                      </div>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={pm25MultiSeries as any} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 50]} label={{ value: 'μg/m³', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          {selectedAirDevices.map((d) => (
                            <Line
                              key={d.id}
                              type="monotone"
                              dataKey={`d_${d.id.replace(/-/g, "")}`}
                              stroke={airColorById.get(d.id)}
                              strokeWidth={2.25}
                              dot={false}
                              name={airDeviceLabelById.get(d.id) || d.id}
                            />
                          ))}
                          <Line type="monotone" dataKey="limit" stroke="#e63f26" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Limite OMS" />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-3 h-0.5 rounded" style={{ backgroundColor: '#e63f26' }} />
                        <span>Limite OMS: 25 μg/m³</span>
                      </div>
                    </div>

                    {/* PM10 Chart */}
                    <div ref={pm10Ref} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">PM10 - Particolato Grossolano</h3>
                          <p className="text-xs text-gray-500">Trend ({periodLabel})</p>
                        </div>
                        <ExportButtons chartRef={pm10Ref} data={pm10MultiSeries as any} filename="pm10" onExpand={() => setFullscreenChart('pm10')} />
                      </div>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={pm10MultiSeries as any} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 80]} label={{ value: 'μg/m³', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          {selectedAirDevices.map((d) => (
                            <Line
                              key={d.id}
                              type="monotone"
                              dataKey={`d_${d.id.replace(/-/g, "")}`}
                              stroke={airColorById.get(d.id)}
                              strokeWidth={2.25}
                              dot={false}
                              name={airDeviceLabelById.get(d.id) || d.id}
                            />
                          ))}
                          <Line type="monotone" dataKey="limit" stroke="#e63f26" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Limite OMS" />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-3 h-0.5 rounded" style={{ backgroundColor: '#e63f26' }} />
                        <span>Limite OMS: 50 μg/m³</span>
                      </div>
                    </div>

                    {/* Real-time PM indicators */}
                    <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-lg text-center">
                        <div className="text-3xl font-bold text-emerald-500">12</div>
                        <div className="text-xs text-gray-500 uppercase mt-1">PM2.5 Indoor</div>
                        <div className="text-[10px] text-emerald-500 mt-1">● Ottimo</div>
                      </div>
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-lg text-center">
                        <div className="text-3xl font-bold text-yellow-500">28</div>
                        <div className="text-xs text-gray-500 uppercase mt-1">PM2.5 Outdoor</div>
                        <div className="text-[10px] text-yellow-500 mt-1">● Moderato</div>
                      </div>
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-lg text-center">
                        <div className="text-3xl font-bold text-emerald-500">22</div>
                        <div className="text-xs text-gray-500 uppercase mt-1">PM10 Indoor</div>
                        <div className="text-[10px] text-emerald-500 mt-1">● Ottimo</div>
                      </div>
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-lg text-center">
                        <div className="text-3xl font-bold text-yellow-500">45</div>
                        <div className="text-xs text-gray-500 uppercase mt-1">PM10 Outdoor</div>
                        <div className="text-[10px] text-yellow-500 mt-1">● Moderato</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slide 3: CO & O3 */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* CO & O3 Combined Chart */}
                    <div ref={coO3Ref} className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">Monossido di Carbonio (CO) & Ozono (O₃)</h3>
                          <p className="text-xs text-gray-500">Trend giornaliero</p>
                        </div>
                        <ExportButtons chartRef={coO3Ref} data={coO3MultiSeries as any} filename="co-o3" onExpand={() => setFullscreenChart('coO3')} />
                      </div>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={coO3MultiSeries as any} margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis yAxisId="co" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 2]} label={{ value: 'ppm CO', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <YAxis yAxisId="o3" orientation="right" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 60]} label={{ value: 'ppb O₃', angle: 90, position: 'insideRight', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          {selectedAirDevices.map((d) => (
                            <Line
                              key={`${d.id}-co`}
                              yAxisId="co"
                              type="monotone"
                              dataKey={`d_${d.id.replace(/-/g, "")}_co`}
                              stroke={airColorById.get(d.id)}
                              strokeWidth={2.25}
                              dot={false}
                              name={`${airDeviceLabelById.get(d.id) || d.id} · CO`}
                            />
                          ))}
                          {selectedAirDevices.map((d) => (
                            <Line
                              key={`${d.id}-o3`}
                              yAxisId="o3"
                              type="monotone"
                              dataKey={`d_${d.id.replace(/-/g, "")}_o3`}
                              stroke={airColorById.get(d.id)}
                              strokeWidth={2.25}
                              strokeDasharray="4 4"
                              dot={false}
                              name={`${airDeviceLabelById.get(d.id) || d.id} · O₃`}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Real-time Gas indicators */}
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">CO - Monossido di Carbonio</h3>
                      <div className="flex items-center gap-6">
                        <div className="flex-1">
                          <div className="text-4xl font-bold text-emerald-500">0.8</div>
                          <div className="text-sm text-gray-500">ppm (attuale)</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">Limite sicurezza</div>
                          <div className="text-lg font-semibold text-gray-700">9 ppm</div>
                          <div className="text-xs text-emerald-500 mt-1">● Sicuro</div>
                        </div>
                      </div>
                      <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: '9%' }} />
                      </div>
                    </div>

                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">O₃ - Ozono</h3>
                      <div className="flex items-center gap-6">
                        <div className="flex-1">
                          <div className="text-4xl font-bold text-emerald-500">25</div>
                          <div className="text-sm text-gray-500">ppb (attuale)</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">Limite OMS</div>
                          <div className="text-lg font-semibold text-gray-700">100 ppb</div>
                          <div className="text-xs text-emerald-500 mt-1">● Ottimo</div>
                        </div>
                      </div>
                      <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: '25%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
              </ModuleGate>
            )}
            
            {/* WATER DASHBOARD */}
            {activeDashboard === "water" && (
              <ModuleGate module="water" config={resolvedModuleConfig.water} demoContent={<WaterDemoContent />}>
                <>
                {/* Slide 1: Consumo idrico & Distribuzione */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Consumo mensile */}
                    <div ref={waterConsumptionRef} className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">Consumo Idrico</h3>
                          <p className="text-xs text-gray-500">Confronto con target e anno precedente</p>
                        </div>
                        <ExportButtons chartRef={waterConsumptionRef} data={filteredWaterData} filename="water-consumption" onExpand={() => setFullscreenChart('waterConsumption')} />
                      </div>
                      <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={filteredWaterData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <defs>
                            <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(200, 80%, 50%)" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="hsl(200, 80%, 50%)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} label={{ value: 'm³', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Area type="monotone" dataKey="consumption" stroke="hsl(200, 80%, 50%)" strokeWidth={2.5} fill="url(#waterGradient)" name="Consumo Attuale" />
                          <Line type="monotone" dataKey="target" stroke="hsl(150, 60%, 45%)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Target" />
                          <Line type="monotone" dataKey="lastYear" stroke="hsl(0, 0%, 60%)" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Anno Precedente" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Distribuzione consumo */}
                    <div ref={waterDistributionRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Distribuzione Consumo</h3>
                        <ExportButtons chartRef={waterDistributionRef} data={waterDistributionData} filename="water-distribution" />
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="space-y-2">
                          {waterDistributionData.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-sm text-gray-600">{item.name}</span>
                              <span className="text-sm font-semibold text-gray-800 ml-auto">{item.value}%</span>
                            </div>
                          ))}
                        </div>
                        <div className="relative w-40 h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={waterDistributionData} innerRadius={45} outerRadius={65} paddingAngle={2} dataKey="value">
                                {waterDistributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <Droplet className="w-6 h-6 text-blue-500 mb-1" />
                            <span className="text-xs text-gray-500">m³/mese</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-lg text-center">
                        <p className="text-sm text-gray-500 mb-1">Consumo Totale</p>
                        <p className="text-3xl font-bold text-blue-500">18,740</p>
                        <p className="text-xs text-gray-500 mt-1">m³ / anno</p>
                        <div className="mt-2 text-xs text-emerald-500 font-medium">↓ 12% vs anno scorso</div>
                      </div>
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-lg text-center">
                        <p className="text-sm text-gray-500 mb-1">Costo Stimato</p>
                        <p className="text-3xl font-bold text-gray-800">€24,562</p>
                        <p className="text-xs text-gray-500 mt-1">/ anno</p>
                        <div className="mt-2 text-xs text-emerald-500 font-medium">↓ €3,200 risparmiati</div>
                      </div>
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-lg text-center">
                        <p className="text-sm text-gray-500 mb-1">Efficienza</p>
                        <p className="text-3xl font-bold text-emerald-500">82%</p>
                        <p className="text-xs text-gray-500 mt-1">utilizzo efficiente</p>
                        <div className="mt-2 text-xs text-blue-500 font-medium">↑ 5% vs mese scorso</div>
                      </div>
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-lg text-center">
                        <p className="text-sm text-gray-500 mb-1">Perdite Rilevate</p>
                        <p className="text-3xl font-bold text-amber-500">2</p>
                        <p className="text-xs text-gray-500 mt-1">zone con anomalie</p>
                        <div className="mt-2 text-xs text-red-500 font-medium">⚠ Richiede attenzione</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slide 2: Perdite & Trend Giornaliero */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Rilevamento Perdite */}
                    <div ref={waterLeaksRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">Rilevamento Perdite</h3>
                          <p className="text-xs text-gray-500">Monitoraggio zone critiche</p>
                        </div>
                        <ExportButtons chartRef={waterLeaksRef} data={waterLeaksData} filename="water-leaks" />
                      </div>
                      <div className="space-y-3">
                        {waterLeaksData.map((zone, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className={`w-3 h-3 rounded-full ${
                              zone.status === 'critical' ? 'bg-red-500 animate-pulse' : 
                              zone.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`} />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-700">{zone.zone}</div>
                              <div className="text-xs text-gray-500">
                                {zone.status === 'ok' ? 'Nessuna anomalia' : `Rilevato: ${zone.detected}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${
                                zone.status === 'critical' ? 'text-red-500' : 
                                zone.status === 'warning' ? 'text-amber-500' : 'text-emerald-500'
                              }`}>{zone.leakRate}%</div>
                              <div className="text-xs text-gray-500">tasso perdita</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Trend Giornaliero */}
                    <div ref={waterTrendRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">Trend Consumo Giornaliero</h3>
                          <p className="text-xs text-gray-500">Picchi e consumi orari</p>
                        </div>
                        <ExportButtons chartRef={waterTrendRef} data={waterDailyTrendData} filename="water-daily-trend" onExpand={() => setFullscreenChart('waterTrend')} />
                      </div>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={waterDailyTrendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="hour" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} label={{ value: 'litri', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Bar dataKey="consumption" name="Consumo">
                            {waterDailyTrendData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.peak ? 'hsl(200, 80%, 40%)' : 'hsl(200, 60%, 60%)'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Efficienza Settimanale */}
                    <div ref={waterEfficiencyRef} className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">Efficienza Settimanale</h3>
                          <p className="text-xs text-gray-500">Rapporto utilizzo/spreco</p>
                        </div>
                        <ExportButtons chartRef={waterEfficiencyRef} data={waterEfficiencyData} filename="water-efficiency" />
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={waterEfficiencyData} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis type="number" domain={[0, 100]} tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => `${v}%`} />
                          <YAxis type="category" dataKey="week" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Bar dataKey="efficiency" stackId="a" fill="hsl(150, 60%, 45%)" name="Efficienza" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="waste" stackId="a" fill="hsl(0, 60%, 60%)" name="Spreco" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Slide 3: Qualità Acqua */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Qualità Acqua Chart */}
                    <div ref={waterQualityRef} className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">Parametri Qualità Acqua</h3>
                          <p className="text-xs text-gray-500">pH, Torbidità, Cloro residuo</p>
                        </div>
                        <ExportButtons chartRef={waterQualityRef} data={waterQualityData} filename="water-quality" onExpand={() => setFullscreenChart('waterQuality')} />
                      </div>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={waterQualityData} margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis yAxisId="ph" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[6.5, 8]} label={{ value: 'pH', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <YAxis yAxisId="other" orientation="right" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 2]} label={{ value: 'NTU / mg/L', angle: 90, position: 'insideRight', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Line yAxisId="ph" type="monotone" dataKey="ph" stroke="hsl(200, 80%, 50%)" strokeWidth={2.5} dot={{ fill: 'hsl(200, 80%, 50%)', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} name="pH" />
                          <Line yAxisId="other" type="monotone" dataKey="turbidity" stroke="hsl(30, 80%, 50%)" strokeWidth={2.5} dot={{ fill: 'hsl(30, 80%, 50%)', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} name="Torbidità (NTU)" />
                          <Line yAxisId="other" type="monotone" dataKey="chlorine" stroke="hsl(150, 60%, 45%)" strokeWidth={2.5} dot={{ fill: 'hsl(150, 60%, 45%)', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} name="Cloro (mg/L)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Indicatori Qualità */}
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">pH - Acidità</h3>
                      <div className="flex items-center gap-6">
                        <div className="flex-1">
                          <div className="text-4xl font-bold text-blue-500">7.2</div>
                          <div className="text-sm text-gray-500">valore attuale</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">Range ottimale</div>
                          <div className="text-lg font-semibold text-gray-700">6.5 - 8.5</div>
                          <div className="text-xs text-emerald-500 mt-1">● Ottimale</div>
                        </div>
                      </div>
                      <div className="mt-4 h-3 bg-gradient-to-r from-red-400 via-emerald-400 to-blue-400 rounded-full overflow-hidden relative">
                        <div className="absolute h-full w-1 bg-white shadow-lg" style={{ left: '47%' }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Acido (6)</span>
                        <span>Neutro (7)</span>
                        <span>Basico (9)</span>
                      </div>
                    </div>

                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">Torbidità</h3>
                      <div className="flex items-center gap-6">
                        <div className="flex-1">
                          <div className="text-4xl font-bold text-amber-500">0.9</div>
                          <div className="text-sm text-gray-500">NTU (attuale)</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">Limite OMS</div>
                          <div className="text-lg font-semibold text-gray-700">&lt; 4 NTU</div>
                          <div className="text-xs text-emerald-500 mt-1">● Eccellente</div>
                        </div>
                      </div>
                      <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: '22%' }} />
                      </div>
                    </div>

                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">Cloro Residuo</h3>
                      <div className="flex items-center gap-6">
                        <div className="flex-1">
                          <div className="text-4xl font-bold text-emerald-500">0.5</div>
                          <div className="text-sm text-gray-500">mg/L (attuale)</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">Range ideale</div>
                          <div className="text-lg font-semibold text-gray-700">0.2 - 1.0</div>
                          <div className="text-xs text-emerald-500 mt-1">● Nel range</div>
                        </div>
                      </div>
                      <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full" style={{ width: '50%' }} />
                      </div>
                    </div>

                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">Temperatura Acqua</h3>
                      <div className="flex items-center gap-6">
                        <div className="flex-1">
                          <div className="text-4xl font-bold text-blue-500">18.5</div>
                          <div className="text-sm text-gray-500">°C (attuale)</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1">Range comfort</div>
                          <div className="text-lg font-semibold text-gray-700">15 - 25 °C</div>
                          <div className="text-xs text-emerald-500 mt-1">● Ideale</div>
                        </div>
                      </div>
                      <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-sky-400 to-blue-500 rounded-full" style={{ width: '35%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
              </ModuleGate>
            )}
            
            {/* CERTIFICATION DASHBOARD - Slide 1: Overview */}
            {activeDashboard === "certification" && currentSlide === 0 && (
              <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto max-h-[calc(100%-80px)]">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
                  {/* LEED Card */}
                  <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
                        <span className="text-white font-black text-lg">LEED</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">LEED v4.1</h3>
                        <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold">Gold</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Punti ottenuti</span>
                        <span className="font-bold text-gray-800">68 / 110</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: '62%' }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>Certified (40)</span>
                        <span>Silver (50)</span>
                        <span className="font-bold text-amber-600">Gold (60)</span>
                        <span>Platinum (80)</span>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-sm text-emerald-600">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Certificato dal 2023</span>
                      </div>
                    </div>
                  </div>

                  {/* BREEAM Card */}
                  <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shadow-lg">
                        <span className="text-white font-black text-xs">BREEAM</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">BREEAM In-Use</h3>
                        <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">Excellent</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Score</span>
                        <span className="font-bold text-gray-800">72.5%</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all" style={{ width: '72.5%' }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>Pass (30%)</span>
                        <span>Good (45%)</span>
                        <span>V.Good (55%)</span>
                        <span className="font-bold text-emerald-600">Exc (70%)</span>
                        <span>Outs (85%)</span>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-sm text-sky-600">
                        <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                        <span>Rinnovo: Dic 2025</span>
                      </div>
                    </div>
                  </div>

                  {/* WELL Card */}
                  <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center shadow-lg">
                        <span className="text-white font-black text-lg">WELL</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">WELL v2</h3>
                        <span className="inline-block px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-semibold">Silver</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Punti ottenuti</span>
                        <span className="font-bold text-gray-800">54 / 100</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full transition-all" style={{ width: '54%' }} />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2">
                        <span>Bronze (40)</span>
                        <span className="font-bold text-gray-600">Silver (50)</span>
                        <span>Gold (60)</span>
                        <span>Platinum (80)</span>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>In corso verso Gold</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-8">
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
                    <div className="text-3xl font-black text-emerald-500">3</div>
                    <div className="text-sm text-gray-600 mt-1">Certificazioni Attive</div>
                  </div>
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
                    <div className="text-3xl font-black text-amber-500">12</div>
                    <div className="text-sm text-gray-600 mt-1">Milestones Raggiunte</div>
                  </div>
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
                    <div className="text-3xl font-black text-sky-500">5</div>
                    <div className="text-sm text-gray-600 mt-1">In Corso</div>
                  </div>
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg text-center">
                    <div className="text-3xl font-black text-rose-500">2026</div>
                    <div className="text-sm text-gray-600 mt-1">Prossimo Audit</div>
                  </div>
                </div>
              </div>
            )}

            {/* CERTIFICATION DASHBOARD - Slide 2: Milestones */}
            {activeDashboard === "certification" && currentSlide === 1 && (
              <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto max-h-[calc(100%-80px)]">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
                  {/* LEED Milestones */}
                  <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                        <span className="text-white font-bold text-xs">LEED</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">LEED Milestones</h3>
                    </div>
                    <div className="space-y-4">
                      {[
                        { name: 'Energy & Atmosphere', completed: true, points: '18/33' },
                        { name: 'Water Efficiency', completed: true, points: '10/12' },
                        { name: 'Materials & Resources', completed: true, points: '8/13' },
                        { name: 'Indoor Environmental Quality', completed: false, points: '12/16' },
                        { name: 'Sustainable Sites', completed: false, points: '10/26' },
                        { name: 'Innovation', completed: true, points: '5/6' },
                        { name: 'Regional Priority', completed: true, points: '4/4' },
                      ].map((milestone, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${milestone.completed ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                            {milestone.completed ? '✓' : idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-700">{milestone.name}</div>
                            <div className="text-xs text-gray-500">{milestone.points} punti</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BREEAM Milestones */}
                  <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center">
                        <span className="text-white font-bold text-[8px]">BREEAM</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">BREEAM Milestones</h3>
                    </div>
                    <div className="space-y-4">
                      {[
                        { name: 'Management', completed: true, score: '85%' },
                        { name: 'Health & Wellbeing', completed: true, score: '78%' },
                        { name: 'Energy', completed: true, score: '82%' },
                        { name: 'Transport', completed: true, score: '65%' },
                        { name: 'Water', completed: false, score: '70%' },
                        { name: 'Materials', completed: false, score: '58%' },
                        { name: 'Waste', completed: true, score: '72%' },
                        { name: 'Land Use & Ecology', completed: false, score: '45%' },
                        { name: 'Pollution', completed: true, score: '80%' },
                      ].map((milestone, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${milestone.completed ? 'bg-sky-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                            {milestone.completed ? '✓' : idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-700">{milestone.name}</div>
                            <div className="text-xs text-gray-500">{milestone.score}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* WELL Milestones */}
                  <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center">
                        <span className="text-white font-bold text-xs">WELL</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">WELL Milestones</h3>
                    </div>
                    <div className="space-y-4">
                      {[
                        { name: 'Air', completed: true, points: '8/14' },
                        { name: 'Water', completed: true, points: '6/8' },
                        { name: 'Nourishment', completed: false, points: '4/9' },
                        { name: 'Light', completed: true, points: '7/10' },
                        { name: 'Movement', completed: false, points: '5/10' },
                        { name: 'Thermal Comfort', completed: true, points: '8/9' },
                        { name: 'Sound', completed: true, points: '6/9' },
                        { name: 'Materials', completed: false, points: '4/10' },
                        { name: 'Mind', completed: false, points: '3/12' },
                        { name: 'Community', completed: true, points: '3/9' },
                      ].map((milestone, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${milestone.completed ? 'bg-rose-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                            {milestone.completed ? '✓' : idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-700">{milestone.name}</div>
                            <div className="text-xs text-gray-500">{milestone.points} punti</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                  <h3 className="text-lg font-bold text-gray-800 mb-6">Timeline Certificazioni</h3>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                    <div className="space-y-6">
                      {[
                        { date: 'Gen 2023', event: 'LEED Gold Certification', type: 'leed' },
                        { date: 'Mar 2023', event: 'BREEAM In-Use Assessment Started', type: 'breeam' },
                        { date: 'Giu 2023', event: 'WELL Silver Achieved', type: 'well' },
                        { date: 'Set 2023', event: 'BREEAM Excellent Certified', type: 'breeam' },
                        { date: 'Gen 2024', event: 'WELL Gold Target Set', type: 'well' },
                        { date: 'Giu 2024', event: 'Mid-Year Performance Review', type: 'all' },
                        { date: 'Dic 2025', event: 'BREEAM Renewal Due', type: 'breeam' },
                        { date: 'Mar 2026', event: 'LEED Recertification', type: 'leed' },
                      ].map((item, idx) => (
                        <div key={idx} className="relative pl-10">
                          <div className={`absolute left-2 w-5 h-5 rounded-full border-2 border-white shadow ${
                            item.type === 'leed' ? 'bg-emerald-500' :
                            item.type === 'breeam' ? 'bg-sky-500' :
                            item.type === 'well' ? 'bg-rose-500' : 'bg-gray-400'
                          }`} />
                          <div className="text-xs text-gray-500 font-medium">{item.date}</div>
                          <div className="text-sm font-medium text-gray-700">{item.event}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pagination Dots */}
        <div className="flex justify-center items-center gap-4 md:gap-6 mt-1 md:mt-2 relative z-20">
          <button onClick={prevSlide} disabled={currentSlide === 0} className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-gray-300 hover:bg-white/80 disabled:opacity-30 bg-white/40 flex items-center justify-center transition text-gray-700">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-2 md:gap-3">
            {Array(totalSlides).fill(0).map((_, idx) => (
              <button key={idx} onClick={() => setCurrentSlide(idx)} className={`h-1.5 md:h-2 rounded-full transition-all duration-300 ${idx === currentSlide ? "w-5 md:w-6 bg-fgb-secondary" : "w-1.5 md:w-2 bg-gray-400 hover:bg-gray-500"}`} />
            ))}
          </div>
          <button onClick={nextSlide} disabled={currentSlide === totalSlides - 1} className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-gray-300 hover:bg-white/80 disabled:opacity-30 bg-white/40 flex items-center justify-center transition text-gray-700">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Modals are already included inside the component structure above via ChartFullscreenModal calls */}
      {/* ============================================================================== */}
      {/* MODALS PER I GRAFICI A SCHERMO INTERO                                          */}
      {/* Incolla questo blocco prima dell'ultimo </div> di chiusura del componente      */}
      {/* ============================================================================== */}

      {/* ENERGY: Actual vs Average */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'actualVsAvg'}
        onClose={() => setFullscreenChart(null)}
        title="Consumo Energetico - Dettaglio"
      >
        <ResponsiveContainer width="100%" height={500}>
          <AreaChart data={energyConsumptionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorGeneralFS" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(188, 100%, 35%)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="hsl(188, 100%, 35%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={autoDomainWithPadding} />
            <Tooltip {...tooltipStyle} />
            <Legend />

            {energyViewMode === 'category' ? (
              <>
                <Area
                  type="monotone"
                  dataKey="General"
                  stroke="hsl(188, 100%, 35%)"
                  strokeWidth={3}
                  fill="url(#colorGeneralFS)"
                  name="General (Total)"
                />
                <Line type="monotone" dataKey="HVAC" stroke="hsl(188, 100%, 19%)" strokeWidth={2.5} dot={false} name="HVAC" />
                <Line type="monotone" dataKey="Lighting" stroke="hsl(338, 50%, 45%)" strokeWidth={2.5} dot={false} name="Lights" />
                <Line type="monotone" dataKey="Plugs" stroke="hsl(338, 50%, 75%)" strokeWidth={2.5} dot={false} name="Plugs & Loads" />
              </>
            ) : (
              <>
                {deviceKeys.slice(0, 10).map((key, idx) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={`hsl(${(idx * 137.5) % 360}, 70%, 50%)`}
                    strokeWidth={2}
                    dot={false}
                    name={key.substring(0, 18)}
                  />
                ))}
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      {/* ENERGY: Heatmap */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'heatmap'}
        onClose={() => setFullscreenChart(null)}
        title="Heatmap Consumi"
      >
        <div className="flex flex-col h-full justify-center">
          <div className="flex gap-4 h-[500px]">
            <div className="text-sm text-gray-500 flex flex-col justify-between py-1 font-medium">
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i}>{String(i).padStart(2, '0')}:00</div>
              ))}
            </div>
            <div className="flex-1 flex flex-col">
              <div className="flex-1 grid grid-cols-7 gap-1">
                {heatmapData.flat().map((val, idx) => (
                  <div key={idx} className="rounded-sm hover:opacity-80 transition-opacity" style={{ backgroundColor: heatmapColors[val] }} title={`Livello: ${val}`} />
                ))}
              </div>
              <div className="flex justify-between text-sm text-gray-500 mt-4 font-medium px-2">
                {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => <span key={d}>{d}</span>)}
              </div>
            </div>
          </div>
        </div>
      </ChartFullscreenModal>

      {/* ENERGY: Device Consumption */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'deviceCons'}
        onClose={() => setFullscreenChart(null)}
        title="Consumo per Dispositivo"
      >
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={filteredDeviceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={autoDomainWithPadding} />
            <Tooltip {...tooltipStyle} />
            <Legend />
            <Bar dataKey="hvac" stackId="a" fill="hsl(188, 100%, 19%)" name="HVAC" />
            <Bar dataKey="lighting" stackId="a" fill="hsl(338, 50%, 45%)" name="Illuminazione" />
            <Bar dataKey="plugs" stackId="a" fill="hsl(338, 50%, 75%)" name="Prese" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      {/* ENERGY: Power Consumption */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'powerCons'}
        onClose={() => setFullscreenChart(null)}
        title="Power Consumption (Real-time)"
      >
        <div className="flex items-center gap-8 h-[500px]">
          <div className="space-y-2 flex-1 max-h-[450px] overflow-y-auto pr-4">
            {powerDistributionData.length === 0 ? (
              <div className="text-gray-400 italic">No real-time data</div>
            ) : (
              powerDistributionData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-gray-600">{item.name}</span>
                  <span className="text-sm font-semibold text-gray-800 ml-auto tabular-nums">
                    {item.value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW
                  </span>
                </div>
              ))
            )}
          </div>
          <div className="w-72 h-72 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={powerDistributionData}
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {powerDistributionData.map((entry, index) => (
                    <Cell key={`cell-fs-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [Number(value).toFixed(2) + ' kW', '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ChartFullscreenModal>

      {/* ENERGY: Carbon Footprint */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'carbon'}
        onClose={() => setFullscreenChart(null)}
        title="Carbon Footprint Analysis"
      >
        <ResponsiveContainer width="100%" height={500}>
          <AreaChart data={carbonChartData.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCarbonFS" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#129E97" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#129E97" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="tsLabel" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} unit=" kg" />
            <Tooltip {...tooltipStyle} formatter={(value: any) => [Number(value).toFixed(2) + ' kg CO₂', '']} />
            <Legend />
            <Area type="monotone" dataKey="co2" stroke="#129E97" strokeWidth={2} fill="url(#colorCarbonFS)" name="CO₂ Emissions" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      {/* ENERGY: Energy Trend */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'trend'}
        onClose={() => setFullscreenChart(null)}
        title="Energy Trend Over Time"
      >
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={energyTrendLiveData as any} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} unit=" kWh" />
            <Tooltip {...tooltipStyle} />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#129E97" strokeWidth={3} dot={{ r: 3, fill: '#129E97' }} name="Energy" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      {/* ENERGY: Energy vs Outdoor Condition */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'outdoor'}
        onClose={() => setFullscreenChart(null)}
        title="Energy vs Outdoor Condition"
      >
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={energyOutdoorLiveData as any} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis yAxisId="left" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} unit=" kWh" />
            <YAxis yAxisId="right" orientation="right" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} unit=" °C" />
            <Tooltip {...tooltipStyle} />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="energy" stroke="#129E97" strokeWidth={2} name="Energy (kWh)" />
            <Line yAxisId="right" type="monotone" dataKey="temperature" stroke="#F59E0B" strokeWidth={2} name="Temperature (°C)" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      {/* AIR: CO2 Trend */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'co2Trend'}
        onClose={() => setFullscreenChart(null)}
        title={`CO₂ Trend (${periodLabel})`}
      >
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={co2MultiSeries as any} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 1200]} />
            <Tooltip {...tooltipStyle} />
            <Legend />
            {selectedAirDevices.map((d) => (
              <Line
                key={d.id}
                type="monotone"
                dataKey={`d_${d.id.replace(/-/g, "")}`}
                stroke={airColorById.get(d.id)}
                strokeWidth={3}
                dot={false}
                name={airDeviceLabelById.get(d.id) || d.id}
              />
            ))}
            <Line type="monotone" dataKey="limit" stroke="#e63f26" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limite" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      {/* AIR: TVOC Trend */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'tvocTrend'}
        onClose={() => setFullscreenChart(null)}
        title={`TVOC Trend (${periodLabel})`}
      >
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={tvocMultiSeries as any} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 600]} />
            <Tooltip {...tooltipStyle} />
            <Legend />
            {selectedAirDevices.map((d) => (
              <Line
                key={d.id}
                type="monotone"
                dataKey={`d_${d.id.replace(/-/g, "")}`}
                stroke={airColorById.get(d.id)}
                strokeWidth={3}
                dot={false}
                name={airDeviceLabelById.get(d.id) || d.id}
              />
            ))}
            <Line type="monotone" dataKey="limit" stroke="#e63f26" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limite" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      {/* AIR: Temp & Humidity */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'tempHumidity'}
        onClose={() => setFullscreenChart(null)}
        title={`Temperatura & Umidità (${periodLabel})`}
      >
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={tempHumidityMultiSeries as any} margin={{ top: 10, right: 60, left: 10, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis yAxisId="temp" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[10, 35]} label={{ value: '°C', angle: -90, position: 'insideLeft' }} />
            <YAxis yAxisId="humidity" orientation="right" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 100]} label={{ value: '%HR', angle: 90, position: 'insideRight' }} />
            <Tooltip {...tooltipStyle} />
            <Legend />
            {selectedAirDevices.map((d) => (
              <Line
                key={`${d.id}-temp`}
                yAxisId="temp"
                type="monotone"
                dataKey={`d_${d.id.replace(/-/g, "")}_temp`}
                stroke={airColorById.get(d.id)}
                strokeWidth={3}
                dot={false}
                name={`${airDeviceLabelById.get(d.id) || d.id} · Temp`}
              />
            ))}
            {selectedAirDevices.map((d) => (
              <Line
                key={`${d.id}-hum`}
                yAxisId="humidity"
                type="monotone"
                dataKey={`d_${d.id.replace(/-/g, "")}_hum`}
                stroke={airColorById.get(d.id)}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                name={`${airDeviceLabelById.get(d.id) || d.id} · Umidità`}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      {/* AIR: PM2.5 */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'pm25'}
        onClose={() => setFullscreenChart(null)}
        title={`PM2.5 - Particolato Fine (${periodLabel})`}
      >
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={pm25MultiSeries as any} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 50]} label={{ value: 'μg/m³', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend />
            {selectedAirDevices.map((d) => (
              <Line
                key={d.id}
                type="monotone"
                dataKey={`d_${d.id.replace(/-/g, "")}`}
                stroke={airColorById.get(d.id)}
                strokeWidth={3}
                dot={false}
                name={airDeviceLabelById.get(d.id) || d.id}
              />
            ))}
            <Line type="monotone" dataKey="limit" stroke="#e63f26" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limite OMS" />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <span className="w-4 h-0.5 rounded" style={{ backgroundColor: '#e63f26' }} />
          <span>Limite OMS: 25 μg/m³</span>
        </div>
      </ChartFullscreenModal>

      {/* AIR: PM10 */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'pm10'}
        onClose={() => setFullscreenChart(null)}
        title={`PM10 - Particolato Grossolano (${periodLabel})`}
      >
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={pm10MultiSeries as any} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 80]} label={{ value: 'μg/m³', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend />
            {selectedAirDevices.map((d) => (
              <Line
                key={d.id}
                type="monotone"
                dataKey={`d_${d.id.replace(/-/g, "")}`}
                stroke={airColorById.get(d.id)}
                strokeWidth={3}
                dot={false}
                name={airDeviceLabelById.get(d.id) || d.id}
              />
            ))}
            <Line type="monotone" dataKey="limit" stroke="#e63f26" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limite OMS" />
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
          <span className="w-4 h-0.5 rounded" style={{ backgroundColor: '#e63f26' }} />
          <span>Limite OMS: 50 μg/m³</span>
        </div>
      </ChartFullscreenModal>

      {/* AIR: CO & O3 */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'coO3'}
        onClose={() => setFullscreenChart(null)}
        title="Monossido di Carbonio (CO) & Ozono (O₃)"
      >
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={coO3MultiSeries as any} margin={{ top: 10, right: 60, left: 10, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis yAxisId="co" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} label={{ value: 'ppm CO', angle: -90, position: 'insideLeft' }} />
            <YAxis yAxisId="o3" orientation="right" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} label={{ value: 'ppb O₃', angle: 90, position: 'insideRight' }} />
            <Tooltip {...tooltipStyle} />
            <Legend />
            {selectedAirDevices.map((d) => (
              <Line key={`${d.id}-co`} yAxisId="co" type="monotone" dataKey={`d_${d.id.replace(/-/g, "")}_co`} stroke={airColorById.get(d.id)} strokeWidth={3} dot={false} name={`${airDeviceLabelById.get(d.id) || d.id} · CO`} />
            ))}
            {selectedAirDevices.map((d) => (
              <Line key={`${d.id}-o3`} yAxisId="o3" type="monotone" dataKey={`d_${d.id.replace(/-/g, "")}_o3`} stroke={airColorById.get(d.id)} strokeWidth={2} strokeDasharray="4 4" dot={false} name={`${airDeviceLabelById.get(d.id) || d.id} · O₃`} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      {/* WATER: Consumption */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'waterConsumption'}
        onClose={() => setFullscreenChart(null)}
        title="Consumo Idrico"
      >
        <ResponsiveContainer width="100%" height={500}>
          <AreaChart data={filteredWaterData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="waterGradientFS" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(200, 80%, 50%)" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="hsl(200, 80%, 50%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <Tooltip {...tooltipStyle} />
            <Legend />
            <Area type="monotone" dataKey="consumption" stroke="hsl(200, 80%, 50%)" strokeWidth={3} fill="url(#waterGradientFS)" name="Consumo Attuale" />
            <Line type="monotone" dataKey="target" stroke="hsl(150, 60%, 45%)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Target" />
            <Line type="monotone" dataKey="lastYear" stroke="hsl(0, 0%, 60%)" strokeWidth={2} strokeDasharray="3 3" dot={false} name="Anno Precedente" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      {/* WATER: Trend */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'waterTrend'}
        onClose={() => setFullscreenChart(null)}
        title="Trend Consumo Giornaliero"
      >
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={waterDailyTrendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="hour" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="consumption" name="Consumo">
              {waterDailyTrendData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.peak ? 'hsl(200, 80%, 40%)' : 'hsl(200, 60%, 60%)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      {/* WATER: Quality */}
      <ChartFullscreenModal
        isOpen={fullscreenChart === 'waterQuality'}
        onClose={() => setFullscreenChart(null)}
        title="Parametri Qualità Acqua"
      >
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={waterQualityData} margin={{ top: 10, right: 60, left: 10, bottom: 0 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis yAxisId="ph" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[6, 9]} label={{ value: 'pH', angle: -90, position: 'insideLeft' }} />
            <YAxis yAxisId="other" orientation="right" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} label={{ value: 'mg/L / NTU', angle: 90, position: 'insideRight' }} />
            <Tooltip {...tooltipStyle} />
            <Legend />
            <Line yAxisId="ph" type="monotone" dataKey="ph" stroke="hsl(200, 80%, 50%)" strokeWidth={3} dot={false} name="pH" />
            <Line yAxisId="other" type="monotone" dataKey="turbidity" stroke="hsl(30, 80%, 50%)" strokeWidth={2} dot={false} name="Torbidità" />
            <Line yAxisId="other" type="monotone" dataKey="chlorine" stroke="hsl(150, 60%, 45%)" strokeWidth={2} dot={false} name="Cloro" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>
    </div>
  );
};

export default ProjectDetail;
