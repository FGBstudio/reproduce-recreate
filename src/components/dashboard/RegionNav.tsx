import { useMemo } from "react";
import { Zap, Wind, Droplets, Building2, Tag, BarChart2 } from "lucide-react";
import { MonitoringType } from "@/lib/data";
import { useAllHoldings, useAllBrands } from "@/hooks/useRealTimeData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RegionNavProps {
  currentRegion: string;
  onRegionChange: (region: string) => void;
  visible?: boolean;
  activeFilters: MonitoringType[];
  onFilterToggle: (filter: MonitoringType) => void;
  selectedHolding: string | null;
  selectedBrand: string | null;
  onHoldingChange?: (holdingId: string | null) => void;
  onBrandChange?: (brandId: string | null) => void;
  kpiPanelOpen?: boolean;
  onKpiPanelToggle?: () => void;
  allowedRegions?: string[] | null;
}

const regionButtons = [
  { code: "GLOBAL", label: "Global" },
  { code: "EU", label: "Europe" },
  { code: "AMER", label: "Americas" },
  { code: "APAC", label: "APAC" },
  { code: "MEA", label: "MEA" },
];

const monitoringFilters: { type: MonitoringType; icon: typeof Zap }[] = [
  { type: "energy", icon: Zap },
  { type: "air", icon: Wind },
  { type: "water", icon: Droplets },
];

const RegionNav = ({
  currentRegion,
  onRegionChange,
  visible = true,
  activeFilters,
  onFilterToggle,
  selectedHolding,
  selectedBrand,
  onHoldingChange,
  onBrandChange,
  kpiPanelOpen = false,
  onKpiPanelToggle,
  allowedRegions,
}: RegionNavProps) => {
  const { holdings } = useAllHoldings();
  const { brands } = useAllBrands();

  // Filter region buttons based on allowed regions
  const visibleRegionButtons = useMemo(() => {
    if (!allowedRegions || allowedRegions.length === 0) return regionButtons;
    return regionButtons.filter(
      btn => btn.code === 'GLOBAL' || allowedRegions.includes(btn.code)
    );
  }, [allowedRegions]);

  const availableBrands = useMemo(() => {
    if (!selectedHolding) return brands;
    return brands.filter((b) => b.holdingId === selectedHolding);
  }, [selectedHolding, brands]);

  return (
    <nav
      className={`fixed bottom-0 md:bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col md:flex-row items-center gap-2 md:gap-3 transition-transform duration-500 w-full md:w-auto ${
        visible ? "translate-y-0" : "translate-y-40"
      }`}
    >
      {/* ── MOBILE: Bottom "plancia di comando" galleggiante ── */}
      <div
        className="md:hidden w-full flex items-center justify-between px-4"
        style={{
          paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))",
          paddingTop: "0.5rem",
          background: "transparent",
        }}
      >
        {/* Left group: Region compact + 3 monitoring toggles */}
        <div className="flex items-center gap-2">
          {/* Region Buttons */}
          <div className="glass-panel rounded-full px-1 py-0.5 flex items-center gap-0">
            {visibleRegionButtons.map((btn) => (
              <button
                key={btn.code}
                onClick={() => onRegionChange(btn.code)}
                className={`px-2 py-1.5 rounded-full text-[10px] font-semibold tracking-wide transition-all ${
                  currentRegion === btn.code
                    ? "bg-fgb-light text-foreground shadow-[0_0_10px_rgba(0,255,255,0.3)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
              >
                {btn.code === "GLOBAL" ? "🌍" : btn.label.slice(0, 2).toUpperCase()}
              </button>
            ))}
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-white/15" />

          {/* 3 Monitoring toggles */}
          <div className="glass-panel rounded-full p-0.5 flex gap-0.5">
            {monitoringFilters.map(({ type, icon: Icon }) => {
              const isActive = activeFilters.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => onFilterToggle(type)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                    isActive
                      ? "bg-foreground text-background"
                      : "text-foreground/50 hover:bg-white/10 hover:text-foreground"
                  }`}
                  title={`Toggle ${type}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: KPI button */}
        <button
          onClick={onKpiPanelToggle}
          className={`glass-panel flex items-center gap-1 rounded-full px-3 py-[7px] transition-all ${
            kpiPanelOpen
              ? "bg-fgb-accent text-background shadow-[0_0_12px_rgba(0,255,255,0.5)]"
              : "text-foreground hover:bg-fgb-light/30"
          }`}
          title="KPI Dashboard"
        >
          <BarChart2 className="w-4 h-4" />
          <span className="text-[10px] font-bold">KPI</span>
        </button>
      </div>

      {/* ── DESKTOP: Original layout (unchanged) ── */}
      <div className="hidden md:flex items-center gap-3" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Holding & Brand Filters */}
        <div className="glass-panel rounded-full px-4 py-2 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <Select
            value={selectedHolding || "all"}
            onValueChange={(val) => {
              onHoldingChange?.(val === "all" ? null : val);
              onBrandChange?.(null);
            }}
            disabled={!onHoldingChange}
          >
            <SelectTrigger className="w-[120px] h-8 border-0 bg-transparent text-sm focus:ring-0">
              <SelectValue placeholder="All Holdings" />
            </SelectTrigger>
            <SelectContent className="glass-panel border-white/10">
              <SelectItem value="all">All Holdings</SelectItem>
              {holdings.map((h) => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-6 bg-white/20" />

          <Tag className="w-4 h-4 text-muted-foreground" />
          <Select
            value={selectedBrand || "all"}
            onValueChange={(val) => onBrandChange?.(val === "all" ? null : val)}
            disabled={!onBrandChange}
          >
            <SelectTrigger className="w-[140px] h-8 border-0 bg-transparent text-sm focus:ring-0">
              <SelectValue placeholder="All Brands" />
            </SelectTrigger>
            <SelectContent className="glass-panel border-white/10">
              <SelectItem value="all">All Brands</SelectItem>
              {availableBrands.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Region Buttons */}
        <div className="glass-panel rounded-full px-6 py-3 flex items-center gap-2">
          {visibleRegionButtons.map((btn) => (
            <button
              key={btn.code}
              onClick={() => onRegionChange(btn.code)}
              className={`px-4 py-2 rounded-full text-sm font-semibold tracking-wide transition-all duration-300 hover:scale-105 ${
                currentRegion === btn.code
                  ? "bg-fgb-light text-foreground shadow-[0_0_15px_rgba(0,255,255,0.3)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/10"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Monitoring Filters */}
        <div className="glass-panel rounded-full p-2 flex gap-2">
          {monitoringFilters.map(({ type, icon: Icon }) => {
            const isActive = activeFilters.includes(type);
            return (
              <button
                key={type}
                onClick={() => onFilterToggle(type)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition hover:scale-110 ${
                  isActive
                    ? "bg-foreground text-background"
                    : "hover:bg-white/10 text-foreground"
                }`}
                title={`Filter by ${type} monitoring`}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default RegionNav;
