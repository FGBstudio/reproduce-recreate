import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { useRegionEnergyIntensity } from "@/hooks/useRegionEnergyIntensity";
import { useAggregatedSiteData } from "@/hooks/useAggregatedSiteData";
import { useAllProjects } from "@/hooks/useRealTimeData";
import { regions, projects as allProjects } from "@/lib/data";

interface MobileKpiPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentRegion: string;
  selectedBrand: string | null;
  selectedHolding: string | null;
  showBrandOverlay: boolean;
}

// Inline region stats — no fixed positioning, used inside panel
const RegionPerformanceInline = ({ currentRegion }: { currentRegion: string }) => {
  const { projects: mergedProjects } = useAllProjects();
  const { intensityByRegion, avgCo2ByRegion, co2SiteCountByRegion } = useRegionEnergyIntensity();

  const regionProjects = useMemo(() => {
    const source = mergedProjects.length > 0 ? mergedProjects : allProjects;
    return source.filter((p) => p.region === currentRegion);
  }, [mergedProjects, currentRegion]);

  const aggregated = useAggregatedSiteData(regionProjects);
  const region = regions[currentRegion];

  const realIntensity = intensityByRegion[currentRegion];
  const realAvgCo2 = avgCo2ByRegion[currentRegion];
  const displayIntensity = realIntensity ?? region?.kpi?.intensity ?? 0;
  const displayCo2 = realAvgCo2 ?? aggregated.totals.avgCo2 ?? 0;
  const displayOnline = aggregated.hasRealData
    ? aggregated.totals.sitesOnline
    : region?.kpi?.online ?? 0;
  const displayCritical = aggregated.hasRealData
    ? aggregated.totals.alertsCritical
    : region?.kpi?.critical ?? 0;

  const aqScore =
    !displayCo2 || displayCo2 === 0
      ? "—"
      : displayCo2 < 600
      ? "GOOD"
      : displayCo2 < 1000
      ? "MODERATE"
      : "POOR";

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-white/5 rounded-xl p-3 border border-white/8">
        <div className="text-xs text-muted-foreground mb-1">Energy Intensity</div>
        <div className="text-xl font-bold text-foreground">{displayIntensity}</div>
        <div className="text-[10px] text-muted-foreground">kWh/m²</div>
      </div>
      <div className="bg-white/5 rounded-xl p-3 border border-white/8">
        <div className="text-xs text-muted-foreground mb-1">Air Quality</div>
        <div
          className={`text-xl font-bold ${
            aqScore === "GOOD"
              ? "text-emerald-400"
              : aqScore === "MODERATE"
              ? "text-yellow-400"
              : aqScore === "POOR"
              ? "text-rose-400"
              : "text-foreground"
          }`}
        >
          {aqScore}
        </div>
        {displayCo2 > 0 && (
          <div className="text-[10px] text-muted-foreground">CO₂: {displayCo2} ppm</div>
        )}
      </div>
      <div className="bg-white/5 rounded-xl p-3 border border-white/8">
        <div className="text-xs text-muted-foreground mb-1">Active Sites</div>
        <div className="text-xl font-bold text-foreground">{displayOnline}</div>
      </div>
      <div className="bg-white/5 rounded-xl p-3 border border-white/8">
        <div className="text-xs text-muted-foreground mb-1">Critical Alerts</div>
        <div
          className={`text-xl font-bold ${
            displayCritical > 0 ? "text-rose-400" : "text-emerald-400"
          }`}
        >
          {displayCritical}
        </div>
      </div>
    </div>
  );
};

const MobileKpiPanel = ({
  isOpen,
  onClose,
  currentRegion,
  selectedBrand,
  selectedHolding,
  showBrandOverlay,
}: MobileKpiPanelProps) => {
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 md:hidden transition-transform duration-300 ease-out`}
      style={{
        transform: isOpen ? "translateY(0)" : "translateY(100%)",
        height: "42vh",
        background: "rgba(10, 15, 25, 0.90)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.10)",
        borderRadius: "20px 20px 0 0",
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        zIndex: 38,
      }}
    >
      {/* Drag handle */}
      <div className="flex items-center justify-center pt-3 pb-1">
        <div className="w-10 h-1 bg-white/20 rounded-full" />
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-4 p-1.5 rounded-full hover:bg-white/10 transition-colors"
      >
        <ChevronDown className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Scrollable content */}
      <div className="overflow-y-auto h-full pb-16 px-4 pt-2">
        {showBrandOverlay ? (
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              {selectedBrand ? "Brand Overview" : "Holding Overview"}
            </h3>
            <p className="text-xs text-muted-foreground text-center py-6">
              Seleziona un sito sulla mappa per vedere i dettagli,
              <br />
              oppure usa i filtri per aggregare i dati.
            </p>
          </div>
        ) : currentRegion !== "GLOBAL" ? (
          <div className="space-y-3">
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
              Regional Performance — {currentRegion}
            </h3>
            <RegionPerformanceInline currentRegion={currentRegion} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm text-center">
            Seleziona una regione o usa i filtri
            <br />
            per vedere i KPI
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileKpiPanel;
