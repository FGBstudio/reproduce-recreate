import { Zap, Wind, Droplets } from "lucide-react";
import { MonitoringType } from "@/lib/data";

interface RegionNavProps {
  currentRegion: string;
  onRegionChange: (region: string) => void;
  visible?: boolean;
  activeFilters: MonitoringType[];
  onFilterToggle: (filter: MonitoringType) => void;
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
  onFilterToggle
}: RegionNavProps) => {
  return (
    <nav 
      className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 transition-transform duration-500 ${
        visible ? "translate-y-0" : "translate-y-40"
      }`}
    >
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
    </nav>
  );
};

export default RegionNav;
