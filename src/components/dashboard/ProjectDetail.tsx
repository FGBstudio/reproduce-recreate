import { useState, useMemo, useRef, ReactNode, useCallback, TouchEvent } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Wind, Thermometer, Droplet, Award, Lightbulb, Cloud, Image, FileJson, FileSpreadsheet, Maximize2, X, Building2, Tag, FileText, Loader2, LayoutDashboard } from "lucide-react";
import { Project, getBrandById, getHoldingById } from "@/lib/data";
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
import { generatePdfReport } from "./PdfReportGenerator";
import { Button } from "@/components/ui/button";
import { ModuleGate } from "@/components/modules/ModuleGate";
import { useProjectModuleConfig } from "@/hooks/useProjectModuleConfig";
import { EnergyDemoContent, AirDemoContent, WaterDemoContent } from "@/components/modules/DemoDashboards";
import { OverviewSection } from "./OverviewSection";

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
  
  // Get module configuration for this project
  const moduleConfig = useProjectModuleConfig(project);
  
  // Touch/swipe handling
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const minSwipeDistance = 50;
  
  // Dynamic data based on time period - only fetch if module is enabled
  const filteredEnergyData = useEnergyData(timePeriod, dateRange);
  const filteredDeviceData = useDeviceData(timePeriod, dateRange);
  const filteredCO2Data = useCO2Data(timePeriod, dateRange);
  const filteredWaterData = useWaterData(timePeriod, dateRange);
  const periodLabel = getPeriodLabel(timePeriod, dateRange);
  
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
        data: {
          energy: {
            consumption: filteredEnergyData as Record<string, unknown>[],
            devices: filteredDeviceData as Record<string, unknown>[],
            co2: filteredCO2Data as Record<string, unknown>[],
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
  }, [project, timePeriod, dateRange, filteredEnergyData, filteredDeviceData, filteredCO2Data, filteredWaterData, waterQualityData, waterLeaksData, co2HistoryData, tempHumidityData, pm25Data, isGeneratingPdf]);

  return (
    <div className="fixed inset-0 z-50 animate-slide-up">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img 
          data-project-bg={project.id}
          src={project.img} 
          alt={project.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/40 to-white/60" />
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
        <div className="px-4 md:px-16 mb-2 md:mb-4">
          {/* Dashboard Tabs - Scrollable on mobile */}
          <div className="flex items-center gap-2 md:gap-3 mb-2 overflow-x-auto pb-1 scrollbar-hide">
            <button 
              onClick={() => handleDashboardChange("overview")}
              className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                activeDashboard === "overview" 
                  ? "bg-fgb-secondary text-white" 
                  : "bg-gray-200 text-gray-500 hover:bg-gray-300"
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
                  : "bg-gray-200 text-gray-500 hover:bg-gray-300"
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
                  : "bg-gray-200 text-gray-500 hover:bg-gray-300"
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
                  : "bg-gray-200 text-gray-500 hover:bg-gray-300"
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
                  : "bg-gray-200 text-gray-500 hover:bg-gray-300"
              }`}
              title="Certification Dashboard"
            >
              <Award className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            {/* Time Period Selector & Export */}
            <div className="ml-auto flex items-center gap-1.5 md:gap-3 flex-shrink-0">
              <span className="text-sm text-gray-500 hidden lg:inline">{periodLabel}</span>
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
                className="h-7 md:h-9 px-2 md:px-3 bg-white/80 backdrop-blur-sm border-gray-200 rounded-full text-xs md:text-sm font-medium shadow-sm hover:bg-fgb-secondary hover:text-white hover:border-fgb-secondary transition-all"
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
            </div>
          </div>
          <h1 className="text-xl md:text-3xl lg:text-4xl font-bold text-fgb-secondary tracking-wide truncate">{project.name}</h1>
          <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm text-gray-600 flex-wrap">
            <span className="truncate max-w-[150px] md:max-w-none">{project.address}</span>
            <span className="text-gray-400 hidden sm:inline">|</span>
            <span className="flex items-center gap-1">
              {project.data.temp}° <Cloud className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </span>
            {/* Brand & Holding Info - Hidden on small mobile */}
            {(() => {
              const brand = getBrandById(project.brandId);
              const holding = brand ? getHoldingById(brand.holdingId) : null;
              return brand ? (
                <>
                  <span className="text-gray-400 hidden md:inline">|</span>
                  <span className="hidden md:flex items-center gap-2">
                    <Tag className="w-4 h-4 text-gray-400" />
                    <span className="font-medium">{brand.name}</span>
                  </span>
                  {holding && (
                    <>
                      <span className="text-gray-400 hidden lg:inline">|</span>
                      <span className="hidden lg:flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{holding.name}</span>
                      </span>
                    </>
                  )}
                </>
              ) : null;
            })()}
          </div>
        </div>

        {/* Carousel Content - Scrollable with touch support */}
        <div 
          className="flex-1 relative overflow-hidden"
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
                  moduleConfig={moduleConfig} 
                  onNavigate={(tab) => setActiveDashboard(tab as DashboardType)}
                />
              </div>
            )}
            
            {/* ENERGY DASHBOARD */}
            {activeDashboard === "energy" && (
              <ModuleGate module="energy" config={moduleConfig.energy} demoContent={<EnergyDemoContent />}>
                <>
                {/* Slide 1: Energy Overview - Like Water Dashboard */}
                <div className="w-full flex-shrink-0 px-3 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
                    {/* Consumo Energetico - Full width */}
                    <div ref={actualVsAvgRef} className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-3 md:mb-4">
                        <div>
                          <h3 className="text-base md:text-lg font-bold text-gray-800">Consumo Energetico</h3>
                          <p className="text-[10px] md:text-xs text-gray-500">Confronto con previsione e media</p>
                        </div>
                        <ExportButtons chartRef={actualVsAvgRef} data={filteredEnergyData} filename="energy-consumption" onExpand={() => setFullscreenChart('actualVsAvg')} />
                      </div>
                      <ResponsiveContainer width="100%" height={180} className="md:!h-[280px]">
                        <AreaChart data={filteredEnergyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(188, 100%, 35%)" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="hsl(188, 100%, 35%)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 9 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} interval="preserveStartEnd" />
                          <YAxis tick={{ ...axisStyle, fontSize: 9 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} width={35} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 9, fontWeight: 500, paddingTop: 5 }} />
                          <Area type="monotone" dataKey="actual" stroke="hsl(188, 100%, 35%)" strokeWidth={2} fill="url(#energyGradient)" name="Attuale" />
                          <Line type="monotone" dataKey="expected" stroke="hsl(150, 60%, 45%)" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Previsto" />
                          <Line type="monotone" dataKey="average" stroke="hsl(0, 0%, 60%)" strokeWidth={1} strokeDasharray="3 3" dot={false} name="Media" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Distribuzione del consumo energetico */}
                    <div ref={energyDensityRef} className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-3 md:mb-4">
                        <h3 className="text-base md:text-lg font-bold text-gray-800">Distribuzione del consumo energetico</h3>
                        <ExportButtons chartRef={energyDensityRef} data={energyDistributionData} filename="energy-distribution" />
                      </div>
                      <div className="flex items-center gap-4 md:gap-6">
                        <div className="space-y-1.5 md:space-y-2 flex-1">
                          {energyDistributionData.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="text-xs md:text-sm text-gray-600 truncate">{item.name}</span>
                              <span className="text-xs md:text-sm font-semibold text-gray-800 ml-auto">{item.kWh.toLocaleString()} kWh</span>
                            </div>
                          ))}
                        </div>
                        <div className="relative w-28 h-28 md:w-40 md:h-40 flex-shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={energyDistributionData} innerRadius="55%" outerRadius="80%" paddingAngle={2} dataKey="value">
                                {energyDistributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-lg md:text-xl font-bold text-fgb-secondary">{totalCumulativeKwh.toLocaleString()}</span>
                            <span className="text-[10px] md:text-xs text-gray-500">kWh</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* KPI Cards - 2x2 Grid */}
                    <div className="grid grid-cols-2 gap-2 md:gap-4">
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-5 shadow-lg text-center">
                        <p className="text-[10px] md:text-sm text-gray-500 mb-0.5 md:mb-1">Densità energetica media annua</p>
                        <p className="text-xl md:text-3xl font-bold text-fgb-secondary">{project.data.total}</p>
                        <p className="text-[9px] md:text-xs text-gray-500 mt-0.5 md:mt-1">kWh/m² / anno</p>
                        <div className="mt-1 md:mt-2 text-[10px] md:text-xs text-emerald-500 font-medium">↓ 8% vs anno precedente</div>
                      </div>
                      <div className="bg-white/95 backdrop-blur-sm rounded-xl md:rounded-2xl p-3 md:p-5 shadow-lg text-center">
                        <p className="text-[10px] md:text-sm text-gray-500 mb-0.5 md:mb-1">Costo Stimato Annuale</p>
                        <p className="text-xl md:text-3xl font-bold text-gray-800">€32,450</p>
                        <p className="text-[9px] md:text-xs text-gray-500 mt-0.5 md:mt-1">Consumo × €0.29/kWh</p>
                        <div className="mt-1 md:mt-2 text-[10px] md:text-xs text-emerald-500 font-medium">↓ €4,200 vs anno prec.</div>
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
                                <span className="text-sm text-fgb-secondary font-semibold">{level}</span>
                                <span className="text-sm text-gray-600">0</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div ref={periodRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Energy Periods</h3>
                        <ExportButtons chartRef={periodRef} data={periodData} filename="energy-periods" />
                      </div>
                      <table className="w-full">
                        <thead>
                          <tr className="text-gray-500 text-sm font-medium">
                            <th className="text-left pb-4 font-semibold">Period</th>
                            <th className="text-right pb-4 font-semibold">kWh</th>
                            <th className="text-right pb-4 font-semibold">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {periodData.map((row, idx) => (
                            <tr key={idx} className="border-t border-gray-100">
                              <td className="py-3 text-sm"><span className="text-gray-800 font-medium">{row.period}</span><span className="text-emerald-500 ml-1">↓</span></td>
                              <td className="py-3 text-sm text-right text-gray-600">{row.kWh.toLocaleString()}</td>
                              <td className="py-3 text-sm text-right text-gray-600 font-medium">{row.price}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div ref={heatmapRef} className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Heatmap</h3>
                        <ExportButtons chartRef={heatmapRef} data={heatmapExportData} filename="heatmap" onExpand={() => setFullscreenChart('heatmap')} />
                      </div>
                      <div className="flex gap-4">
                        <div className="text-xs text-gray-500 space-y-[6px] pt-1 font-medium">
                          {Array.from({ length: 24 }, (_, i) => (
                            <div key={i} className="h-4">{String(i).padStart(2, '0')}:00</div>
                          ))}
                        </div>
                        <div className="flex-1">
                          <div className="grid grid-cols-7 gap-[2px]">
                            {heatmapData.flat().map((val, idx) => (
                              <div key={idx} className="h-4 rounded-sm transition-transform hover:scale-110" style={{ backgroundColor: heatmapColors[val] }} />
                            ))}
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
                            {['27-05', '28-05', '29-05', '30-05', '31-05', '01-06', '02-06'].map(d => <span key={d}>{d}</span>)}
                          </div>
                          <div className="flex gap-4 mt-4 text-xs">
                            {[{ c: 1, l: 'Ottimo' }, { c: 2, l: 'Buono' }, { c: 3, l: 'Moderato' }, { c: 4, l: 'Elevato' }].map(({ c, l }) => (
                              <span key={c} className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: heatmapColors[c] }} /> {l}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slide 3: Actual vs Average & Device Consumption */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div ref={actualVsAvgRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Actual vs Average</h3>
                        <ExportButtons chartRef={actualVsAvgRef} data={filteredEnergyData} filename="actual-vs-average" onExpand={() => setFullscreenChart('actualVsAvg')} />
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={filteredEnergyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => `${v}`} label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Line type="monotone" dataKey="actual" stroke="hsl(188, 100%, 19%)" strokeWidth={2.5} dot={{ fill: 'hsl(188, 100%, 19%)', strokeWidth: 0, r: 3 }} activeDot={{ r: 5 }} name="Attuale" />
                          <Line type="monotone" dataKey="expected" stroke="hsl(188, 100%, 35%)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Previsto" />
                          <Line type="monotone" dataKey="average" stroke="hsl(338, 50%, 45%)" strokeWidth={2} dot={false} name="Media" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div ref={powerConsRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Power consumption</h3>
                        <ExportButtons chartRef={powerConsRef} data={donutData} filename="power-consumption" />
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="space-y-3">
                          {[{ n: 'HVAC', c: 'bg-fgb-secondary', v: '45%' }, { n: 'Lighting', c: 'bg-[hsl(338,50%,45%)]', v: '35%' }, { n: 'Plugs and Loads', c: 'bg-[hsl(338,50%,75%)]', v: '20%' }].map(({ n, c, v }) => (
                            <div key={n} className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-full ${c}`} />
                              <span className="text-sm text-gray-600">{n}</span>
                              <span className="text-sm font-semibold text-gray-800 ml-auto">{v}</span>
                            </div>
                          ))}
                        </div>
                        <div className="relative w-44 h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={donutData} innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                                {donutData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="white" strokeWidth={2} />)}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-4xl font-bold text-fgb-secondary">89</span>
                            <span className="text-xs text-gray-500">kW</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div ref={deviceConsRef} className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Consumo Dispositivi</h3>
                        <ExportButtons chartRef={deviceConsRef} data={filteredDeviceData} filename="device-consumption" onExpand={() => setFullscreenChart('deviceCons')} />
                      </div>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={filteredDeviceData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => `${v/1000}k`} label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Bar dataKey="hvac" stackId="a" fill="hsl(188, 100%, 19%)" name="HVAC" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="lighting" stackId="a" fill="hsl(338, 50%, 45%)" name="Illuminazione" />
                          <Bar dataKey="plugs" stackId="a" fill="hsl(338, 50%, 75%)" name="Prese" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Slide 4: Carbon Footprint & Energy Trends */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div ref={carbonRef} className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Carbon Footprint</h3>
                        <ExportButtons chartRef={carbonRef} data={carbonData} filename="carbon-footprint" onExpand={() => setFullscreenChart('carbon')} />
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={carbonData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="week" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} label={{ value: 'kg CO₂', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Bar dataKey="june" fill="hsl(188, 100%, 19%)" name="June" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="july" fill="hsl(338, 50%, 45%)" name="July" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="august" fill="hsl(338, 50%, 75%)" name="August" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="september" fill="hsl(188, 100%, 35%)" name="September" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div ref={trendRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Energy Trend Over Time</h3>
                        <ExportButtons chartRef={trendRef} data={trendData} filename="energy-trend" onExpand={() => setFullscreenChart('trend')} />
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="day" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => `${v}`} label={{ value: 'kW', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
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
                        <ExportButtons chartRef={outdoorRef} data={outdoorData} filename="energy-vs-outdoor" onExpand={() => setFullscreenChart('outdoor')} />
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={outdoorData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="day" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => `${v}`} label={{ value: 'kW', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Line type="monotone" dataKey="hvacOffice" stroke="hsl(188, 100%, 19%)" strokeWidth={2.5} dot={{ fill: 'hsl(188, 100%, 19%)', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }} name="HVAC Office" />
                          <Line type="monotone" dataKey="temperature" stroke="hsl(338, 50%, 45%)" strokeWidth={2.5} dot={{ fill: 'hsl(338, 50%, 45%)', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, stroke: 'white', strokeWidth: 2 }} name="Temperature" />
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
              <ModuleGate module="air" config={moduleConfig.air} demoContent={<AirDemoContent />}>
                <>
                {/* Slide 1: Overview + CO2 + TVOC */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Air Quality Overview Card */}
                    <div ref={airQualityRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg relative">
                      <div className="absolute top-4 right-4">
                        <ExportButtons chartRef={airQualityRef} data={airQualityData} filename="air-quality" />
                      </div>
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getAqBgColor(project.data.aq)} ${getAqColor(project.data.aq)} text-xs font-bold mb-4`}>
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                        LIVE
                      </div>
                      <h3 className={`text-4xl font-bold mb-1 tracking-tight ${getAqColor(project.data.aq)}`}>
                        {project.data.aq}
                      </h3>
                      <p className="text-gray-500 uppercase tracking-widest text-xs mb-4">Indoor Air Quality</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                          <Wind className="w-5 h-5 text-sky-500 mx-auto mb-1" />
                          <div className="text-xl font-bold text-gray-800">{project.data.co2}</div>
                          <div className="text-[9px] text-gray-500 uppercase">ppm CO₂</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-xl text-center">
                          <Thermometer className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                          <div className="text-xl font-bold text-gray-800">{project.data.temp}°</div>
                          <div className="text-[9px] text-gray-500 uppercase">Temp</div>
                        </div>
                      </div>
                    </div>

                    {/* CO2 Trend Chart */}
                    <div ref={co2TrendRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">CO₂ Trend (24h)</h3>
                        <ExportButtons chartRef={co2TrendRef} data={co2HistoryData} filename="co2-trend" onExpand={() => setFullscreenChart('co2Trend')} />
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={co2HistoryData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <defs>
                            <linearGradient id="co2Gradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(188, 100%, 35%)" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="hsl(188, 100%, 35%)" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 1200]} label={{ value: 'ppm', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Area type="monotone" dataKey="co2" stroke="hsl(188, 100%, 35%)" strokeWidth={2.5} fill="url(#co2Gradient)" name="CO₂" />
                          <Line type="monotone" dataKey="limit" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Limite" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* TVOC Trend Chart */}
                    <div ref={tvocTrendRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">TVOC Trend (24h)</h3>
                        <ExportButtons chartRef={tvocTrendRef} data={tvocHistoryData} filename="tvoc-trend" onExpand={() => setFullscreenChart('tvocTrend')} />
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={tvocHistoryData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <defs>
                            <linearGradient id="tvocGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(280, 60%, 50%)" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="hsl(280, 60%, 50%)" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 600]} label={{ value: 'ppb', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Area type="monotone" dataKey="tvoc" stroke="hsl(280, 60%, 50%)" strokeWidth={2.5} fill="url(#tvocGradient)" name="TVOC" />
                          <Line type="monotone" dataKey="limit" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Limite" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Temperature & Humidity Chart - Full Width */}
                    <div ref={tempHumidityRef} className="lg:col-span-3 bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Temperatura & Umidità Relativa (24h)</h3>
                        <ExportButtons chartRef={tempHumidityRef} data={tempHumidityData} filename="temp-humidity" onExpand={() => setFullscreenChart('tempHumidity')} />
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={tempHumidityData} margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis yAxisId="temp" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[18, 28]} label={{ value: '°C', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <YAxis yAxisId="humidity" orientation="right" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[20, 70]} label={{ value: '%HR', angle: 90, position: 'insideRight', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Line yAxisId="temp" type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} name="Temperatura (°C)" />
                          <Line yAxisId="humidity" type="monotone" dataKey="humidity" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: '#06b6d4', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} name="Umidità (%)" />
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
                          <p className="text-xs text-gray-500">Indoor vs Outdoor (settimanale)</p>
                        </div>
                        <ExportButtons chartRef={pm25Ref} data={pm25Data} filename="pm25" onExpand={() => setFullscreenChart('pm25')} />
                      </div>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={pm25Data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="day" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 50]} label={{ value: 'μg/m³', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Bar dataKey="indoor" fill="hsl(188, 100%, 35%)" name="Indoor" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="outdoor" fill="hsl(188, 100%, 60%)" name="Outdoor" radius={[4, 4, 0, 0]} />
                          <Line type="monotone" dataKey="limit" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limite OMS" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-3 h-0.5 bg-red-500 rounded" />
                        <span>Limite OMS: 25 μg/m³</span>
                      </div>
                    </div>

                    {/* PM10 Chart */}
                    <div ref={pm10Ref} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">PM10 - Particolato Grossolano</h3>
                          <p className="text-xs text-gray-500">Indoor vs Outdoor (settimanale)</p>
                        </div>
                        <ExportButtons chartRef={pm10Ref} data={pm10Data} filename="pm10" onExpand={() => setFullscreenChart('pm10')} />
                      </div>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={pm10Data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="day" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 80]} label={{ value: 'μg/m³', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Bar dataKey="indoor" fill="hsl(338, 50%, 45%)" name="Indoor" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="outdoor" fill="hsl(338, 50%, 70%)" name="Outdoor" radius={[4, 4, 0, 0]} />
                          <Line type="monotone" dataKey="limit" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limite OMS" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-3 h-0.5 bg-red-500 rounded" />
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
                        <ExportButtons chartRef={coO3Ref} data={coO3Data} filename="co-o3" onExpand={() => setFullscreenChart('coO3')} />
                      </div>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={coO3Data} margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="time" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis yAxisId="co" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 2]} label={{ value: 'ppm CO', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <YAxis yAxisId="o3" orientation="right" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 60]} label={{ value: 'ppb O₃', angle: 90, position: 'insideRight', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Line yAxisId="co" type="monotone" dataKey="co" stroke="#ef4444" strokeWidth={2.5} dot={{ fill: '#ef4444', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} name="CO (ppm)" />
                          <Line yAxisId="o3" type="monotone" dataKey="o3" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 4 }} activeDot={{ r: 6 }} name="O₃ (ppb)" />
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
              <ModuleGate module="water" config={moduleConfig.water} demoContent={<WaterDemoContent />}>
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

        {/* Pagination */}
        <div className="flex justify-center items-center gap-4 md:gap-6 mt-1 md:mt-2">
          <button 
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition text-gray-600"
          >
            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <div className="flex gap-2 md:gap-3">
            {Array(totalSlides).fill(0).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-1.5 md:h-2 rounded-full transition-all duration-300 ${
                  idx === currentSlide 
                    ? "w-5 md:w-6 bg-fgb-secondary" 
                    : "w-1.5 md:w-2 bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
          <button 
            onClick={nextSlide}
            disabled={currentSlide === totalSlides - 1}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition text-gray-600"
          >
            <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      {/* Time Scale - Hidden on mobile */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-4 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
        <div className="vertical-text rotate-180 cursor-pointer hover:text-gray-600 transition">Hour</div>
        <div className="vertical-text rotate-180 cursor-pointer hover:text-gray-600 transition">Day</div>
        <div className="vertical-text rotate-180 text-fgb-secondary border-l-2 border-fgb-secondary pl-2">Week</div>
        <div className="vertical-text rotate-180 cursor-pointer hover:text-gray-600 transition">Month</div>
        <div className="vertical-text rotate-180 cursor-pointer hover:text-gray-600 transition">Year</div>
      </div>

      {/* Fullscreen Modals */}
      <ChartFullscreenModal isOpen={fullscreenChart === 'heatmap'} onClose={() => setFullscreenChart(null)} title="Energy Heatmap">
        <div className="flex gap-4">
          <div className="text-xs text-gray-500 space-y-[8px] pt-1 font-medium">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="h-5">{String(i).padStart(2, '0')}:00</div>
            ))}
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-7 gap-1">
              {heatmapData.flat().map((val, idx) => (
                <div key={idx} className="h-5 rounded" style={{ backgroundColor: heatmapColors[val] }} />
              ))}
            </div>
            <div className="flex justify-between text-sm text-gray-500 mt-4 font-medium">
              {['27-05', '28-05', '29-05', '30-05', '31-05', '01-06', '02-06'].map(d => <span key={d}>{d}</span>)}
            </div>
          </div>
        </div>
      </ChartFullscreenModal>

      <ChartFullscreenModal isOpen={fullscreenChart === 'actualVsAvg'} onClose={() => setFullscreenChart(null)} title="Actual vs Average">
        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={filteredEnergyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Line type="monotone" dataKey="actual" stroke="hsl(188, 100%, 19%)" strokeWidth={3} dot={{ fill: 'hsl(188, 100%, 19%)', strokeWidth: 0, r: 4 }} activeDot={{ r: 7 }} name="Attuale" />
            <Line type="monotone" dataKey="expected" stroke="hsl(188, 100%, 35%)" strokeWidth={2.5} strokeDasharray="5 5" dot={false} name="Previsto" />
            <Line type="monotone" dataKey="average" stroke="hsl(338, 50%, 45%)" strokeWidth={2.5} dot={false} name="Media" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      <ChartFullscreenModal isOpen={fullscreenChart === 'deviceCons'} onClose={() => setFullscreenChart(null)} title="Consumo Dispositivi">
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={filteredDeviceData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => `${v/1000}k`} label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Bar dataKey="hvac" stackId="a" fill="hsl(188, 100%, 19%)" name="HVAC" />
            <Bar dataKey="lighting" stackId="a" fill="hsl(338, 50%, 45%)" name="Illuminazione" />
            <Bar dataKey="plugs" stackId="a" fill="hsl(338, 50%, 75%)" name="Prese" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      <ChartFullscreenModal isOpen={fullscreenChart === 'carbon'} onClose={() => setFullscreenChart(null)} title="Carbon Footprint">
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={carbonData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="week" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} label={{ value: 'kg CO₂', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Bar dataKey="june" fill="hsl(188, 100%, 19%)" name="June" radius={[6, 6, 0, 0]} />
            <Bar dataKey="july" fill="hsl(338, 50%, 45%)" name="July" radius={[6, 6, 0, 0]} />
            <Bar dataKey="august" fill="hsl(338, 50%, 75%)" name="August" radius={[6, 6, 0, 0]} />
            <Bar dataKey="september" fill="hsl(188, 100%, 35%)" name="September" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      <ChartFullscreenModal isOpen={fullscreenChart === 'trend'} onClose={() => setFullscreenChart(null)} title="Energy Trend Over Time">
        <ResponsiveContainer width="100%" height={450}>
          <AreaChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="day" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} label={{ value: 'kW', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Area type="monotone" dataKey="general" stackId="1" stroke="hsl(188, 100%, 19%)" fill="hsl(188, 100%, 19%)" fillOpacity={0.7} name="General" />
            <Area type="monotone" dataKey="hvac" stackId="2" stroke="hsl(338, 50%, 45%)" fill="hsl(338, 50%, 45%)" fillOpacity={0.7} name="HVAC" />
            <Area type="monotone" dataKey="lights" stackId="3" stroke="hsl(188, 100%, 35%)" fill="hsl(188, 100%, 35%)" fillOpacity={0.5} name="Lights" />
            <Area type="monotone" dataKey="plugs" stackId="4" stroke="hsl(338, 50%, 75%)" fill="hsl(338, 50%, 75%)" fillOpacity={0.5} name="Plugs" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      <ChartFullscreenModal isOpen={fullscreenChart === 'outdoor'} onClose={() => setFullscreenChart(null)} title="Energy vs Outdoor Condition">
        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={outdoorData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="day" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} label={{ value: 'kW', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Line type="monotone" dataKey="hvacOffice" stroke="hsl(188, 100%, 19%)" strokeWidth={3} dot={{ fill: 'hsl(188, 100%, 19%)', strokeWidth: 0, r: 5 }} activeDot={{ r: 8, stroke: 'white', strokeWidth: 2 }} name="HVAC Office" />
            <Line type="monotone" dataKey="temperature" stroke="hsl(338, 50%, 45%)" strokeWidth={3} dot={{ fill: 'hsl(338, 50%, 45%)', strokeWidth: 0, r: 5 }} activeDot={{ r: 8, stroke: 'white', strokeWidth: 2 }} name="Temperature" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      {/* Air Quality Fullscreen Modals */}
      <ChartFullscreenModal isOpen={fullscreenChart === 'co2Trend'} onClose={() => setFullscreenChart(null)} title="CO₂ Trend (24h)">
        <ResponsiveContainer width="100%" height={450}>
          <AreaChart data={co2HistoryData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <defs>
              <linearGradient id="co2GradientFull" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(188, 100%, 35%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(188, 100%, 35%)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 1200]} label={{ value: 'ppm', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Area type="monotone" dataKey="co2" stroke="hsl(188, 100%, 35%)" strokeWidth={3} fill="url(#co2GradientFull)" name="CO₂" />
            <Line type="monotone" dataKey="limit" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limite" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      <ChartFullscreenModal isOpen={fullscreenChart === 'tvocTrend'} onClose={() => setFullscreenChart(null)} title="TVOC Trend (24h)">
        <ResponsiveContainer width="100%" height={450}>
          <AreaChart data={tvocHistoryData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <defs>
              <linearGradient id="tvocGradientFull" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(280, 60%, 50%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(280, 60%, 50%)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 600]} label={{ value: 'ppb', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Area type="monotone" dataKey="tvoc" stroke="hsl(280, 60%, 50%)" strokeWidth={3} fill="url(#tvocGradientFull)" name="TVOC" />
            <Line type="monotone" dataKey="limit" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limite" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      <ChartFullscreenModal isOpen={fullscreenChart === 'tempHumidity'} onClose={() => setFullscreenChart(null)} title="Temperatura & Umidità Relativa (24h)">
        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={tempHumidityData} margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis yAxisId="temp" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[18, 28]} label={{ value: '°C', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <YAxis yAxisId="humidity" orientation="right" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[20, 70]} label={{ value: '%HR', angle: 90, position: 'insideRight', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Line yAxisId="temp" type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={3} dot={{ fill: '#f97316', strokeWidth: 0, r: 5 }} activeDot={{ r: 7 }} name="Temperatura (°C)" />
            <Line yAxisId="humidity" type="monotone" dataKey="humidity" stroke="#06b6d4" strokeWidth={3} dot={{ fill: '#06b6d4', strokeWidth: 0, r: 5 }} activeDot={{ r: 7 }} name="Umidità (%)" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      <ChartFullscreenModal isOpen={fullscreenChart === 'pm25'} onClose={() => setFullscreenChart(null)} title="PM2.5 - Particolato Fine">
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={pm25Data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="day" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 50]} label={{ value: 'μg/m³', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Bar dataKey="indoor" fill="hsl(188, 100%, 35%)" name="Indoor" radius={[6, 6, 0, 0]} />
            <Bar dataKey="outdoor" fill="hsl(188, 100%, 60%)" name="Outdoor" radius={[6, 6, 0, 0]} />
            <Line type="monotone" dataKey="limit" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limite OMS" />
          </BarChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      <ChartFullscreenModal isOpen={fullscreenChart === 'pm10'} onClose={() => setFullscreenChart(null)} title="PM10 - Particolato Grossolano">
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={pm10Data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="day" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 80]} label={{ value: 'μg/m³', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Bar dataKey="indoor" fill="hsl(338, 50%, 45%)" name="Indoor" radius={[6, 6, 0, 0]} />
            <Bar dataKey="outdoor" fill="hsl(338, 50%, 70%)" name="Outdoor" radius={[6, 6, 0, 0]} />
            <Line type="monotone" dataKey="limit" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Limite OMS" />
          </BarChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      <ChartFullscreenModal isOpen={fullscreenChart === 'coO3'} onClose={() => setFullscreenChart(null)} title="Monossido di Carbonio (CO) & Ozono (O₃)">
        <ResponsiveContainer width="100%" height={450}>
          <LineChart data={coO3Data} margin={{ top: 20, right: 60, left: 20, bottom: 20 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="time" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis yAxisId="co" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 2]} label={{ value: 'ppm CO', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <YAxis yAxisId="o3" orientation="right" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} domain={[0, 60]} label={{ value: 'ppb O₃', angle: 90, position: 'insideRight', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Line yAxisId="co" type="monotone" dataKey="co" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', strokeWidth: 0, r: 5 }} activeDot={{ r: 7 }} name="CO (ppm)" />
            <Line yAxisId="o3" type="monotone" dataKey="o3" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 5 }} activeDot={{ r: 7 }} name="O₃ (ppb)" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>
    </div>
  );
};

export default ProjectDetail;
