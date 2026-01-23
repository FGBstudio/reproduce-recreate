import { useState, useMemo, useRef, ReactNode, useCallback, TouchEvent, useEffect } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Wind, Thermometer, Droplet, Droplets, Award, Lightbulb, Cloud, Image, FileJson, FileSpreadsheet, Maximize2, X, Building2, Tag, FileText, Loader2, LayoutDashboard, Activity, Gauge, Sparkles } from "lucide-react";
import { Project, getHoldingById } from "@/lib/data";
import { useAllBrands } from "@/hooks/useRealTimeData";

import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
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
  getPeriodLabel 
} from "@/hooks/useTimeFilteredData";
import { useRealTimeEnergyData, useProjectTelemetry } from "@/hooks/useRealTimeTelemetry";
import { generatePdfReport } from "./PdfReportGenerator";
import { Button } from "@/components/ui/button";
import { ModuleGate } from "@/components/modules/ModuleGate";
import { useProjectModuleConfig } from "@/hooks/useProjectModuleConfig";
import { EnergyDemoContent, AirDemoContent, WaterDemoContent } from "@/components/modules/DemoDashboards";
import { OverviewSection } from "./OverviewSection";
import { DataSourceBadge } from "./DataSourceBadge";
import { AirDeviceSelector } from "@/components/dashboard/AirDeviceSelector";
import { useDevices, useLatestTelemetry, useTimeseries } from "@/lib/api";
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
  
  // MODIFICA 2: Hook per recuperare i brand reali + mock
  const { brands } = useAllBrands();

  // Get module configuration for this project
  const moduleConfig = useProjectModuleConfig(project);
  
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
  // CORREZIONE 1: Usa device_type invece di type per coerenza col DB
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

  const airColorById = useMemo(() => {
    const palette = [
      "hsl(var(--secondary))",
      "hsl(var(--primary))",
      "hsl(var(--emerald))",
      "hsl(var(--rose))",
      "hsl(var(--muted-foreground))",
    ];
    const map = new Map<string, string>();
    airDeviceIds.forEach((id, idx) => map.set(id, palette[idx % palette.length]));
    return map;
  }, [airDeviceIds]);

  const getTimeRangeParams = useCallback((tp: TimePeriod, dr?: DateRange) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;
    let bucket: string;

    switch (tp) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        bucket = "1h";
        break;
      case "week":
        start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        bucket = "1d";
        break;
      case "month":
        start = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
        bucket = "1d";
        break;
      case "year":
        start = new Date(now.getFullYear(), 0, 1);
        bucket = "1M";
        break;
      case "custom":
        if (!dr) {
          start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          bucket = "1d";
        } else {
          start = dr.from;
          end = dr.to;
          const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 1) bucket = "1h";
          else if (daysDiff <= 90) bucket = "1d";
          else bucket = "1M";
        }
        break;
      default:
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        bucket = "1d";
    }

    return { start, end, bucket };
  }, []);

  const { start: airStart, end: airEnd, bucket: airBucket } = getTimeRangeParams(timePeriod, dateRange);
  
  // CORREZIONE 2: Aggiornati i nomi delle metriche per corrispondere al Database
  // iaq.tvoc -> iaq.voc
  const airMetrics = useMemo(
    () => [
      "iaq.co2",
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

  const { data: airTimeseriesResp } = useTimeseries(
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
      const labelOf = (ts: Date) => {
        // keep this lightweight; aligns to the same logic used elsewhere in telemetry hooks
        const pad = (n: number) => String(n).padStart(2, "0");
        if (timePeriod === "today") return `${pad(ts.getHours())}:00`;
        if (timePeriod === "week") return ts.toLocaleDateString("it-IT", { weekday: "short" });
        if (timePeriod === "year") return ts.toLocaleDateString("it-IT", { month: "short" });
        return ts.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
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
    [airTimeseriesResp, timePeriod]
  );
  
  // Use real data if available, otherwise fall back to mock generators
  const filteredEnergyData = realTimeEnergy.isRealData ? realTimeEnergy.data : useEnergyData(timePeriod, dateRange);
  const filteredDeviceData = useDeviceData(timePeriod, dateRange);
  const filteredCO2Data = useCO2Data(timePeriod, dateRange);
  const filteredWaterData = useWaterData(timePeriod, dateRange);
  const periodLabel = getPeriodLabel(timePeriod, dateRange);
  
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
    // CORREZIONE 3: Usa il nome metrica corretto del DB: 'iaq.voc'
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
  const energyDistributionData = useMemo(() => {
    // Base annual values
    const hvacKwh = 42000;
    const lightingKwh = 33600;
    const plugsKwh = 21600;
    const otherKwh = 14400;
    
    // Scale factor based on time period
    let scaleFactor = 1;
    if (timePeriod === 'today') scaleFactor = 1/365;
    else if (timePeriod === 'week') scaleFactor = 7/365;
    else if (timePeriod === 'month') scaleFactor = 1/12;
    else if (timePeriod === 'year') scaleFactor = 1;
    else if (dateRange?.from && dateRange?.to) {
      const diffMs = dateRange.to.getTime() - dateRange.from.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      scaleFactor = diffDays / 365;
    }
    
    return [
      { name: 'HVAC', value: 35, kWh: Math.round(hvacKwh * scaleFactor), color: 'hsl(188, 100%, 19%)' },
      { name: 'Lighting', value: 28, kWh: Math.round(lightingKwh * scaleFactor), color: 'hsl(338, 50%, 45%)' },
      { name: 'Plugs & Loads', value: 18, kWh: Math.round(plugsKwh * scaleFactor), color: 'hsl(338, 50%, 75%)' },
      { name: 'Other', value: 12, kWh: Math.round(otherKwh * scaleFactor), color: 'hsl(188, 100%, 35%)' },
    ];
  }, [timePeriod, dateRange]);

  // Calculate total cumulative energy
  const totalCumulativeKwh = useMemo(() => {
    return energyDistributionData.reduce((sum, item) => sum + item.kWh, 0);
  }, [energyDistributionData]);

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

    // 1. Immagine Custom (o Unsplash legacy)
    if (project.img) {
      return {
        backgroundImage: `url(${project.img})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }

    // 2. Pattern del Brand (Fallback Smart)
    if (brand?.logo) {
      return {
        // Overlay scuro leggero + pattern logo ripetuto
        backgroundImage: `
          linear-gradient(rgba(240,240,240,0.92), rgba(240,240,240,0.85)), 
          url(${brand.logo})
        `,
        backgroundRepeat: 'repeat',
        backgroundSize: '120px', // Dimensione logo nel pattern
        backgroundPosition: 'center',
      };
    }

    // 3. Fallback neutro
    return { backgroundColor: '#f0f2f5' };
  }, [project, brand]);

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
