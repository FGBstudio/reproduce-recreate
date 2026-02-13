import { useState, useMemo, useRef, ReactNode, useCallback, TouchEvent, useEffect } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Wind, Thermometer, Droplet, Droplets, Award, Lightbulb, Cloud, Image, FileJson, FileSpreadsheet, Maximize2, X, Building2, Tag, FileText, Loader2, LayoutDashboard, Activity, Gauge, Sparkles, Settings } from "lucide-react";
// MODIFICA 1: Import aggiornati per supportare dati reali
import { Project, getHoldingById } from "@/lib/data"; // Rimossa getBrandById statica
import { useAllBrands } from "@/hooks/useRealTimeData"; // Aggiunto hook dati reali
import { formatChartLabel, resolveTimezone, getPartsInTz } from "@/lib/timezoneUtils";

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
import { useWellCertification } from "@/hooks/useCertifications";
import { useProjectCertifications } from "@/hooks/useProjectCertifications";
import { useEnergyPowerByCategory } from "@/hooks/useEnergyPowerByCategory";


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
 * (which can make lines appear "invisible" on small charts).
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
  
  // WELL certification data
  const { wellCert, milestones: wellMilestones } = useWellCertification(project?.siteId);
  
  // Certifications configured in admin panel for this project
  const projectCertifications = useProjectCertifications(project);
  const hasCertifications = projectCertifications.length > 0;
  const hasLEED = projectCertifications.includes('LEED');
  const hasBREEAM = projectCertifications.includes('BREEAM');
  const hasWELL = projectCertifications.includes('WELL');

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
  const realTimeEnergy = useRealTimeEnergyData(project?.siteId, timePeriod, dateRange, project?.timezone);
  const projectTelemetry = useProjectTelemetry(project?.siteId, timePeriod, dateRange, project?.timezone);

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
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        break;
      case "year":
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
        category: d.category ? d.category.toLowerCase() : 'other',
        label: d.circuit_name || d.name || d.device_id,
      });
    });
    return map;
  }, [siteDevices]);

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

  // Shared hook for Power Consumption widget (energy_latest + device categories)
  const energyPowerBreakdown = useEnergyPowerByCategory(project?.siteId);

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

  // Build series by metric for charts
  // This function aggregates timeseries data by metric and device
  function buildSeriesByMetric(timeseriesData: any[], metrics: string[], deviceIds: string[]) {
    const series: Record<string, { name: string; data: { ts: string; value: number }[] }[]> = {};
    metrics.forEach((metric) => {
      series[metric] = [];
      deviceIds.forEach((deviceId) => {
        const filtered = timeseriesData.filter(
          (d) => d.metric === metric && d.device_id === deviceId
        );
        if (filtered.length > 0) {
          series[metric].push({
            name: deviceMap.get(deviceId)?.label || deviceId,
            data: filtered.map((d) => ({ ts: d.ts, value: d.value })),
          });
        }
      });
    });
    return series;
  }

  // Build air quality series
  const airSeries = useMemo(() => {
    if (!airTimeseriesResp) return {};
    return buildSeriesByMetric(airTimeseriesResp, airMetrics, selectedAirDeviceIds);
  }, [airTimeseriesResp, airMetrics, selectedAirDeviceIds]);

  // Build energy series
  const energySeries = useMemo(() => {
    if (!energyTimeseriesResp) return {};
    return buildSeriesByMetric(energyTimeseriesResp, energyMetrics, siteDeviceIds);
  }, [energyTimeseriesResp, energyMetrics, siteDeviceIds]);

  // Build water series (similar approach, omitted for brevity)
  // ...

  // --- 6. WIDGET: HEATMAP (Matrice Temporale Dinamica) ---

  // Preferisci il VirtualMeter general (aggrega i PAN12 fisici) per evitare doppi conteggi
  const heatmapDeviceIds = useMemo(() => {
    if (!siteDevices || siteDevices.length === 0) return [];

    // 1) Preferisci VirtualMeter con category general
    const virtualGenerals = siteDevices.filter(
      (d) => (d.category || '').toLowerCase() === 'general' && (d.model || '').toLowerCase() === 'virtualmeter'
    );
    if (virtualGenerals.length > 0) return virtualGenerals.map((d) => d.id);

    // 2) Fallback: device fisici con category general
    const generals = siteDevices.filter(
      (d) => (d.category || '').toLowerCase() === 'general'
    );
    if (generals.length > 0) return generals.map((d) => d.id);

    // 3) Fallback: qualunque device energia
    const anyEnergy = siteDevices.filter((d) => ENERGY_DEVICE_TYPES.includes(d.device_type));
    return anyEnergy.map((d) => d.id);
  }, [siteDevices, ENERGY_DEVICE_TYPES]);

  // Query heatmap data for these devices
  const heatmapConfig = useMemo(() => ({
    device_ids: heatmapDeviceIds,
    metrics: ['energy.power_kw'],
    start: timeRange.start.toISOString(),
    end: timeRange.end.toISOString(),
    bucket: timeRange.bucket,
  }), [heatmapDeviceIds, timeRange]);

  const heatmapResp = useTimeseries(heatmapConfig, { enabled: heatmapDeviceIds.length > 0 && isSupabaseConfigured });
  const heatmapData = heatmapResp.data || [];

  // Build heatmap grid data structure: rows = hours/days, columns = days/months depending on bucket
  // For simplicity, assume bucket 15m or 1h or 1d and build accordingly
  const heatmapGrid = useMemo(() => {
    if (!heatmapData.length) return [];

    // Group data by timestamp truncated to bucket and sum values
    const grouped: Record<string, number> = {};
    heatmapData.forEach((d) => {
      const key = d.ts;
      grouped[key] = (grouped[key] || 0) + d.value;
    });

    // Build array of { ts, value } sorted by ts
    const sorted = Object.entries(grouped)
      .map(([ts, value]) => ({ ts, value }))
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    return sorted;
  }, [heatmapData]);

  // Remaining component code, JSX, event handlers, rendering dashboards, etc.

  // Example: render overview dashboard with charts and export buttons
  // ...

  return (
    <div className="project-detail-container">
      <header className="flex items-center justify-between p-4 border-b border-gray-200">
        <button onClick={onClose} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
          <ArrowLeft size={20} />
          Back
        </button>
        <h1 className="text-xl font-bold">{project?.name || "Project Detail"}</h1>
        <Button onClick={() => setSettingsOpen(true)} variant="outline" size="sm" className="flex items-center gap-1">
          <Settings size={16} />
          Settings
        </Button>
      </header>

      <nav className="flex gap-4 p-4 border-b border-gray-200">
        {['overview', 'energy', 'air', 'water', 'certification'].map((tab) => (
          <button
            key={tab}
            className={`px-3 py-1 rounded-md font-semibold ${activeDashboard === tab ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={() => setActiveDashboard(tab as DashboardType)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <main className="p-4 overflow-auto">
        {activeDashboard === "overview" && (
          <OverviewSection
            project={project}
            energyData={energyTimeseriesResp}
            airData={airTimeseriesResp}
            waterData={null} // Placeholder
            timePeriod={timePeriod}
            onTimePeriodChange={setTimePeriod}
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        )}

        {activeDashboard === "energy" && (
          <ModuleGate module="energy" enabled={resolvedModuleConfig.energy.enabled}>
            {/* Energy charts and widgets */}
            {/* Example: Power consumption bar chart */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Power Consumption</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={energyTimeseriesResp || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ts" tickFormatter={(ts) => formatChartLabel(ts, timePeriod, project?.timezone)} />
                  <YAxis domain={autoDomainWithPadding} />
                  <Tooltip {...tooltipStyle} labelFormatter={(label) => formatChartLabel(label, timePeriod, project?.timezone)} />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
              <ExportButtons
                chartRef={null}
                data={energyTimeseriesResp || []}
                filename={`${project?.name || "project"}_energy`}
              />
            </div>
          </ModuleGate>
        )}

        {activeDashboard === "air" && (
          <ModuleGate module="air" enabled={resolvedModuleConfig.air.enabled}>
            {/* Air quality charts */}
            <AirDeviceSelector
              devices={airDevices}
              selectedDeviceIds={selectedAirDeviceIds}
              onChange={setSelectedAirDeviceIds}
            />
            {airMetrics.map((metric) => (
              <div key={metric} className="mb-6">
                <h3 className="text-md font-semibold mb-1">{metric.toUpperCase()}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ts" tickFormatter={(ts) => formatChartLabel(ts, timePeriod, project?.timezone)} />
                    <YAxis domain={autoDomainWithPadding} />
                    <Tooltip {...tooltipStyle} labelFormatter={(label) => formatChartLabel(label, timePeriod, project?.timezone)} />
                    <Legend />
                    {airSeries[metric]?.map((seriesItem, idx) => (
                      <Line
                        key={seriesItem.name}
                        data={seriesItem.data}
                        dataKey="value"
                        name={seriesItem.name}
                        stroke={airColorById.get(selectedAirDeviceIds[idx]) || "#8884d8"}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <ExportButtons
                  chartRef={null}
                  data={airSeries[metric]?.flatMap(s => s.data.map(d => ({ ...d, device: s.name }))) || []}
                  filename={`${project?.name || "project"}_air_${metric}`}
                />
              </div>
            ))}
          </ModuleGate>
        )}

        {activeDashboard === "water" && (
          <ModuleGate module="water" enabled={resolvedModuleConfig.water.enabled}>
            {/* Water charts and widgets */}
            <WaterDemoContent />
          </ModuleGate>
        )}

        {activeDashboard === "certification" && (
          <ModuleGate module="certification" enabled={hasCertifications}>
            {/* Certification details */}
            <div className="space-y-4">
              {hasLEED && <div>LEED Certification details here</div>}
              {hasBREEAM && <div>BREEAM Certification details here</div>}
              {hasWELL && (
                <div>
                  <h3>WELL Certification</h3>
                  <pre>{JSON.stringify(wellCert, null, 2)}</pre>
                  <h4>Milestones</h4>
                  <ul>
                    {wellMilestones.map((m) => (
                      <li key={m.id}>{m.name} - {m.status}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ModuleGate>
        )}

        {/* Heatmap widget */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Energy Heatmap</h2>
          {heatmapResp.isLoading && <div>Loading heatmap...</div>}
          {heatmapResp.error && <div>Error loading heatmap: {heatmapResp.error.message}</div>}
          {!heatmapResp.isLoading && !heatmapResp.error && heatmapGrid.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={heatmapGrid}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ts" tickFormatter={(ts) => formatChartLabel(ts, timePeriod, project?.timezone)} />
                <YAxis />
                <Tooltip {...tooltipStyle} labelFormatter={(label) => formatChartLabel(label, timePeriod, project?.timezone)} />
                <Bar dataKey="value" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <ExportButtons
            chartRef={null}
            data={heatmapGrid}
            filename={`${project?.name || "project"}_heatmap`}
          />
        </section>
      </main>

      <ProjectSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        project={project}
      />

      <ChartFullscreenModal
        isOpen={!!fullscreenChart}
        onClose={() => setFullscreenChart(null)}
        title={fullscreenChart || ""}
      >
        {/* Render fullscreen chart content based on fullscreenChart state */}
      </ChartFullscreenModal>
    </div>
  );
};

export default ProjectDetail;
