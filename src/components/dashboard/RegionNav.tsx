import { useMemo } from "react";
import { Zap, Wind, Droplets, Building2, Tag } from "lucide-react";
import { MonitoringType, getBrandsByHolding } from "@/lib/data";
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
  onHoldingChange: (holdingId: string | null) => void;
  onBrandChange: (brandId: string | null) => void;
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
  onBrandChange
}: RegionNavProps) => {
  // Use combined real + mock data
  const { holdings } = useAllHoldings();
  const { brands } = useAllBrands();

  const availableBrands = useMemo(() => {
    return selectedHolding 
      ? getBrandsByHolding(selectedHolding) 
      : brands;
  }, [selectedHolding, brands]);

  return (
    <nav 
      className={`fixed bottom-4 md:bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col md:flex-row items-center gap-2 md:gap-3 transition-transform duration-500 w-[calc(100%-2rem)] md:w-auto ${
        visible ? "translate-y-0" : "translate-y-40"
      }`}
    >
      {/* Mobile: All controls in a single row with horizontal scroll */}
      <div className="md:hidden w-full overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 pb-1 min-w-max px-1">
          {/* Holding & Brand Select - Compact */}
          <div className="glass-panel rounded-full px-2 py-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <Select 
              value={selectedHolding || "all"} 
              onValueChange={(val) => {
                onHoldingChange(val === "all" ? null : val);
                onBrandChange(null);
              }}
            >
              <SelectTrigger className="w-[80px] h-6 border-0 bg-transparent text-xs focus:ring-0 px-1">
                <SelectValue placeholder="Holdings" />
              </SelectTrigger>
              <SelectContent className="glass-panel border-white/10">
                <SelectItem value="all">All</SelectItem>
                {holdings.map(h => (
                  <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="w-px h-4 bg-white/20" />

            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            <Select 
              value={selectedBrand || "all"} 
              onValueChange={(val) => onBrandChange(val === "all" ? null : val)}
            >
              <SelectTrigger className="w-[80px] h-6 border-0 bg-transparent text-xs focus:ring-0 px-1">
                <SelectValue placeholder="Brands" />
              </SelectTrigger>
              <SelectContent className="glass-panel border-white/10">
                <SelectItem value="all">All</SelectItem>
                {availableBrands.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Region Buttons - Compact */}
          <div className="glass-panel rounded-full px-2 py-1.5 flex items-center gap-1">
            {regionButtons.map((btn) => (
              <button
                key={btn.code}
                onClick={() => onRegionChange(btn.code)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide transition-all ${
                  currentRegion === btn.code
                    ? "bg-fgb-light text-foreground shadow-[0_0_10px_rgba(0,255,255,0.3)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
              >
                {btn.code === "GLOBAL" ? "🌍" : btn.label.slice(0, 2).toUpperCase()}
              </button>
            ))}
          </div>

          {/* Monitoring Filters - Compact */}
          <div className="glass-panel rounded-full p-1.5 flex gap-1">
            {monitoringFilters.map(({ type, icon: Icon }) => {
              const isActive = activeFilters.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => onFilterToggle(type)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                    isActive 
                      ? "bg-foreground text-background" 
                      : "hover:bg-white/10 text-foreground"
                  }`}
                  title={`Filter by ${type} monitoring`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop: Original layout */}
      <div className="hidden md:flex items-center gap-3">
        {/* Holding & Brand Filters */}
        <div className="glass-panel rounded-full px-4 py-2 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <Select 
            value={selectedHolding || "all"} 
            onValueChange={(val) => {
              onHoldingChange(val === "all" ? null : val);
              onBrandChange(null);
            }}
          >
            <SelectTrigger className="w-[120px] h-8 border-0 bg-transparent text-sm focus:ring-0">
              <SelectValue placeholder="All Holdings" />
            </SelectTrigger>
            <SelectContent className="glass-panel border-white/10">
              <SelectItem value="all">All Holdings</SelectItem>
              {holdings.map(h => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-6 bg-white/20" />

          <Tag className="w-4 h-4 text-muted-foreground" />
          <Select 
            value={selectedBrand || "all"} 
            onValueChange={(val) => onBrandChange(val === "all" ? null : val)}
          >
            <SelectTrigger className="w-[140px] h-8 border-0 bg-transparent text-sm focus:ring-0">
              <SelectValue placeholder="All Brands" />
            </SelectTrigger>
            <SelectContent className="glass-panel border-white/10">
              <SelectItem value="all">All Brands</SelectItem>
              {availableBrands.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Region Buttons */}
        <div className="glass-panel rounded-full px-6 py-3 flex items-center gap-2">
          {regionButtons.map((btn) => (
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
