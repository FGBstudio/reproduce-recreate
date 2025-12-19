import { useState, useMemo, useRef, ReactNode } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Wind, Thermometer, Droplet, Award, Lightbulb, Cloud, Image, FileJson, FileSpreadsheet, Maximize2, X } from "lucide-react";
import { Project } from "@/lib/data";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import html2canvas from "html2canvas";
import { createPortal } from "react-dom";

// Dashboard types
type DashboardType = "energy" | "air" | "water" | "certification";

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
  const [activeDashboard, setActiveDashboard] = useState<DashboardType>("energy");
  const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);
  
  // Different total slides based on dashboard
  const getTotalSlides = () => {
    switch (activeDashboard) {
      case "energy": return 4;
      case "air": return 3;
      case "water": return 1;
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

  const heatmapColors = ['#e8f5e9', '#81c784', '#fdd835', '#f57c00', '#d32f2f'];

  // Air quality data for export
  const airQualityData = [
    { metric: 'Air Quality Index', value: project.data.aq },
    { metric: 'CO2 (ppm)', value: project.data.co2 },
    { metric: 'Temperature', value: project.data.temp },
  ];

  return (
    <div className="fixed inset-0 z-50 animate-slide-up">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img 
          src={project.img} 
          alt={project.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/40 to-white/60" />
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 w-full px-8 py-6 flex justify-between items-center z-10">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-black/10 hover:bg-black/20 backdrop-blur-md rounded-full text-sm font-semibold transition-all group border border-black/10"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Region
        </button>
      </div>

      {/* Main Content */}
      <div className="absolute inset-0 pt-20 pb-24 flex flex-col">
        {/* Title Area with Dashboard Tabs */}
        <div className="px-8 md:px-16 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <button 
              onClick={() => handleDashboardChange("energy")}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeDashboard === "energy" 
                  ? "bg-fgb-secondary text-white" 
                  : "bg-gray-200 text-gray-500 hover:bg-gray-300"
              }`}
              title="Energy Dashboard"
            >
              <Lightbulb className="w-5 h-5" />
            </button>
            <button 
              onClick={() => handleDashboardChange("air")}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeDashboard === "air" 
                  ? "bg-fgb-secondary text-white" 
                  : "bg-gray-200 text-gray-500 hover:bg-gray-300"
              }`}
              title="Air Quality Dashboard"
            >
              <Cloud className="w-5 h-5" />
            </button>
            <button 
              onClick={() => handleDashboardChange("water")}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeDashboard === "water" 
                  ? "bg-fgb-secondary text-white" 
                  : "bg-gray-200 text-gray-500 hover:bg-gray-300"
              }`}
              title="Water Dashboard"
            >
              <Droplet className="w-5 h-5" />
            </button>
            <button 
              onClick={() => handleDashboardChange("certification")}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                activeDashboard === "certification" 
                  ? "bg-fgb-secondary text-white" 
                  : "bg-gray-200 text-gray-500 hover:bg-gray-300"
              }`}
              title="Certification Dashboard"
            >
              <Award className="w-5 h-5" />
            </button>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-fgb-secondary tracking-wide">{project.name}</h1>
          <div className="flex items-center gap-3 text-gray-600">
            <span>{project.address}</span>
            <span className="text-gray-400">|</span>
            <span className="flex items-center gap-1">
              {project.data.temp}° <Cloud className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* Carousel Content - Scrollable */}
        <div className="flex-1 relative overflow-hidden">
          <div 
            className="flex h-full transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {/* ENERGY DASHBOARD */}
            {activeDashboard === "energy" && (
              <>
                {/* Slide 1: Energy Density Overview */}
                <div className="w-full flex-shrink-0 px-4 md:px-16 overflow-y-auto pb-4">
                  <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    <div ref={energyDensityRef} className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Energy density</h3>
                        <ExportButtons chartRef={energyDensityRef} data={donutData} filename="energy-density" />
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-fgb-secondary" />
                            <span className="text-sm text-gray-600">HVAC</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-[hsl(338,50%,45%)]" />
                            <span className="text-sm text-gray-600">Lighting</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-[hsl(338,50%,75%)]" />
                            <span className="text-sm text-gray-600">Plugs and Loads</span>
                          </div>
                        </div>
                        <div className="relative w-40 h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={donutData} innerRadius={45} outerRadius={65} paddingAngle={2} dataKey="value">
                                {donutData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-4xl font-bold text-fgb-secondary">{project.data.total}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg text-center">
                        <p className="text-sm text-gray-500 mb-1">Energy density</p>
                        <p className="text-sm font-semibold text-fgb-secondary mb-2">HVAC</p>
                        <p className="text-4xl font-bold text-fgb-secondary">{project.data.hvac}</p>
                        <p className="text-xs text-gray-500 mt-1">KWh/m²</p>
                      </div>
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg text-center">
                        <p className="text-sm text-gray-500 mb-1">Energy density</p>
                        <p className="text-sm font-semibold text-[hsl(338,50%,45%)] mb-2">Lighting</p>
                        <p className="text-4xl font-bold text-[hsl(338,50%,45%)]">{project.data.light}</p>
                        <p className="text-xs text-gray-500 mt-1">KWh/m²</p>
                      </div>
                      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg text-center">
                        <p className="text-sm text-gray-500 mb-1">Energy density</p>
                        <p className="text-sm font-semibold text-[hsl(338,50%,75%)] mb-2">Plugs & Loads</p>
                        <p className="text-4xl font-bold text-[hsl(338,50%,75%)]">11</p>
                        <p className="text-xs text-gray-500 mt-1">KWh/m²</p>
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
                            {[{ c: 1, l: '0-4.9 kWh' }, { c: 2, l: '4.9-9.8 kWh' }, { c: 3, l: '14.7-19.6 kWh' }, { c: 4, l: '19.6-24.5 kWh' }].map(({ c, l }) => (
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
                        <ExportButtons chartRef={actualVsAvgRef} data={monthlyData} filename="actual-vs-average" onExpand={() => setFullscreenChart('actualVsAvg')} />
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="month" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => `${v}`} label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Line type="monotone" dataKey="actual" stroke="hsl(188, 100%, 19%)" strokeWidth={2.5} dot={{ fill: 'hsl(188, 100%, 19%)', strokeWidth: 0, r: 3 }} activeDot={{ r: 5 }} name="Actual" />
                          <Line type="monotone" dataKey="expected" stroke="hsl(188, 100%, 35%)" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Expected" />
                          <Line type="monotone" dataKey="average" stroke="hsl(338, 50%, 45%)" strokeWidth={2} dot={false} name="Average" />
                          <Line type="monotone" dataKey="offHours" stroke="hsl(338, 50%, 75%)" strokeWidth={2} dot={false} name="Off Hours" />
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
                            <span className="text-xs text-gray-500">kWh/m²</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div ref={deviceConsRef} className="lg:col-span-2 bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Device consumption</h3>
                        <ExportButtons chartRef={deviceConsRef} data={deviceData} filename="device-consumption" onExpand={() => setFullscreenChart('deviceCons')} />
                      </div>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={deviceData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="month" tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
                          <YAxis tick={axisStyle} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => `${v/1000}k`} label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { ...axisStyle, textAnchor: 'middle' } }} />
                          <Tooltip {...tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 10 }} />
                          <Bar dataKey="hvac" stackId="a" fill="hsl(188, 100%, 19%)" name="HVAC" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="lighting" stackId="a" fill="hsl(338, 50%, 45%)" name="Lighting" />
                          <Bar dataKey="plugs" stackId="a" fill="hsl(338, 50%, 75%)" name="Plugs" radius={[4, 4, 0, 0]} />
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
            )}

            {/* AIR QUALITY DASHBOARD */}
            {activeDashboard === "air" && (
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
            )}

            {/* WATER DASHBOARD */}
            {activeDashboard === "water" && (
              <div className="w-full flex-shrink-0 px-4 md:px-16 flex items-center justify-center">
                <div className="w-full max-w-4xl bg-white/95 backdrop-blur-sm rounded-2xl p-12 shadow-lg text-center">
                  <Droplet className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                  <h3 className="text-3xl font-bold text-gray-800 mb-2">Water Monitoring</h3>
                  <p className="text-gray-500">Water consumption data coming soon...</p>
                </div>
              </div>
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
        <div className="flex justify-center items-center gap-6 mt-4">
          <button 
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="w-10 h-10 rounded-full border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition text-gray-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex gap-3">
            {Array(totalSlides).fill(0).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentSlide 
                    ? "w-6 bg-fgb-secondary" 
                    : "w-2 bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>
          <button 
            onClick={nextSlide}
            disabled={currentSlide === totalSlides - 1}
            className="w-10 h-10 rounded-full border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition text-gray-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Time Scale */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 text-[10px] font-bold tracking-widest text-gray-400 uppercase">
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
          <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="month" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Line type="monotone" dataKey="actual" stroke="hsl(188, 100%, 19%)" strokeWidth={3} dot={{ fill: 'hsl(188, 100%, 19%)', strokeWidth: 0, r: 4 }} activeDot={{ r: 7 }} name="Actual" />
            <Line type="monotone" dataKey="expected" stroke="hsl(188, 100%, 35%)" strokeWidth={2.5} strokeDasharray="5 5" dot={false} name="Expected" />
            <Line type="monotone" dataKey="average" stroke="hsl(338, 50%, 45%)" strokeWidth={2.5} dot={false} name="Average" />
            <Line type="monotone" dataKey="offHours" stroke="hsl(338, 50%, 75%)" strokeWidth={2.5} dot={false} name="Off Hours" />
          </LineChart>
        </ResponsiveContainer>
      </ChartFullscreenModal>

      <ChartFullscreenModal isOpen={fullscreenChart === 'deviceCons'} onClose={() => setFullscreenChart(null)} title="Device Consumption">
        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={deviceData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid {...gridStyle} />
            <XAxis dataKey="month" tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} />
            <YAxis tick={{ ...axisStyle, fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => `${v/1000}k`} label={{ value: 'kWh', angle: -90, position: 'insideLeft', style: { ...axisStyle, fontSize: 14, textAnchor: 'middle' } }} />
            <Tooltip {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 13, fontWeight: 500, paddingTop: 20 }} />
            <Bar dataKey="hvac" stackId="a" fill="hsl(188, 100%, 19%)" name="HVAC" />
            <Bar dataKey="lighting" stackId="a" fill="hsl(338, 50%, 45%)" name="Lighting" />
            <Bar dataKey="plugs" stackId="a" fill="hsl(338, 50%, 75%)" name="Plugs" radius={[6, 6, 0, 0]} />
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
