import { Zap, Wind, Droplets } from "lucide-react";

interface RegionNavProps {
  currentRegion: string;
  onRegionChange: (region: string) => void;
  visible?: boolean;
}

const regionButtons = [
  { code: "GLOBAL", label: "Global" },
  { code: "EU", label: "Europe" },
  { code: "AMER", label: "Americas" },
  { code: "APAC", label: "APAC" },
  { code: "MEA", label: "MEA" },
];

const RegionNav = ({ currentRegion, onRegionChange, visible = true }: RegionNavProps) => {
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

      {/* Metric Toggles */}
      <div className="glass-panel rounded-full p-2 flex gap-2">
        <button className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center transition hover:scale-110">
          <Zap className="w-5 h-5" />
        </button>
        <button className="w-10 h-10 rounded-full hover:bg-white/10 text-foreground flex items-center justify-center transition hover:scale-110">
          <Wind className="w-5 h-5" />
        </button>
        <button className="w-10 h-10 rounded-full hover:bg-white/10 text-foreground flex items-center justify-center transition hover:scale-110">
          <Droplets className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
};

export default RegionNav;
