import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Wind, Droplet } from "lucide-react";
import { Project, MonitoringType } from "@/lib/data";
import { ClientRole } from "@/hooks/useUserScope";
import { useRealTimeLatestData } from "@/hooks/useRealTimeTelemetry";
import { useEnergyPowerByCategory } from "@/hooks/useEnergyPowerByCategory";
import markerPinIcon from "@/assets/marker.png";

export type ProjectSection = "overview" | "energy" | "air" | "water";

interface SiteMarkerProps {
  project: Project;
  clientRole: ClientRole;
  brandLogo?: string;
  onMarkerClick: (project: Project) => void;
  onSphereClick: (project: Project, section: ProjectSection) => void;
}

type MetricSection = Exclude<ProjectSection, "overview">;

const METRIC_META: Record<
  MetricSection,
  { icon: typeof Zap; accent: string; ring: string; label: string; unit: string }
> = {
  energy: { icon: Zap,     accent: "#f97316", ring: "#10b981", label: "Main Power", unit: "kW"  },
  air:    { icon: Wind,    accent: "#0ea5e9", ring: "#22d3ee", label: "Air CO₂",    unit: "ppm" },
  water:  { icon: Droplet, accent: "#3b82f6", ring: "#60a5fa", label: "Water Flow", unit: "L/m" },
};

const formatValue = (v: number | undefined | null): string => {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  if (v >= 1000) return v.toFixed(0);
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
};

/* ------------------------- MapMetricRadar widget ------------------------- */

const WIDGET_PX = 280;        // rendered size on screen
const VB = 600;               // SVG viewBox (matches user spec)
const CIRCLE_R = 180;
const CX = 300;
const CY = 300;
const FOCUS_X = 580;          // focal distance from center along +x = 280 SVG units
const FOCUS_Y = 300;
const CONE_HALF_ANGLE_DEG = 25;
const SCALE = WIDGET_PX / VB;
const FOCUS_OFFSET_PX = (FOCUS_X - CX) * SCALE; // px distance from widget center to focal point

const conePath = (() => {
  const a = CONE_HALF_ANGLE_DEG * (Math.PI / 180);
  const p1x = CX + CIRCLE_R * Math.cos(-a);
  const p1y = CY + CIRCLE_R * Math.sin(-a);
  const p2x = CX + CIRCLE_R * Math.cos(a);
  const p2y = CY + CIRCLE_R * Math.sin(a);
  return `M ${FOCUS_X} ${FOCUS_Y} L ${p1x} ${p1y} A ${CIRCLE_R} ${CIRCLE_R} 0 0 0 ${p2x} ${p2y} Z`;
})();

interface RadarProps {
  section: MetricSection;
  value: number | undefined;
  rotationDeg: number;           // direction from widget center to marker (deg)
  backgroundImage?: string;
  brandLogo?: string;
  onClick: () => void;
  index: number;
}

const MapMetricRadar = ({ section, value, rotationDeg, backgroundImage, brandLogo, onClick, index }: RadarProps) => {
  const meta = METRIC_META[section];
  const Icon = meta.icon;
  const ringR = 82;
  const ringC = 2 * Math.PI * ringR;

  return (
    <motion.button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay: index * 0.05 }}
      className="absolute pointer-events-auto cursor-pointer"
      style={{
        width: WIDGET_PX,
        height: WIDGET_PX,
        left: `calc(50% - ${WIDGET_PX / 2}px)`,
        top: `calc(50% - ${WIDGET_PX / 2}px)`,
        background: 0,
        border: 0,
        padding: 0,
      }}
      aria-label={`Apri sezione ${section}`}
    >
      {/* Inner rotated frame: rotation aligns focal point with the marker */}
      <div
        className="absolute inset-0"
        style={{
          transform: `rotate(${rotationDeg}deg)`,
          transformOrigin: "50% 50%",
        }}
      >
        <div
          className="relative w-full h-full rounded-[28px] overflow-hidden border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
          style={{ background: "#0a0f0c" }}
        >
          {/* grid */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_10%,_#0a0f0c_90%)] pointer-events-none" />

          {/* Background image OR brand logo pattern, masked to circle */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none z-0"
            style={{
              width: (CIRCLE_R * 2) * SCALE,
              height: (CIRCLE_R * 2) * SCALE,
              ...(backgroundImage
                ? {
                    backgroundImage: `url(${backgroundImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    opacity: 0.45,
                    mixBlendMode: "luminosity" as const,
                  }
                : brandLogo
                ? {
                    backgroundImage: `url(${brandLogo})`,
                    backgroundRepeat: "space",
                    backgroundSize: "60px",
                    backgroundPosition: "center",
                    opacity: 0.18,
                  }
                : { backgroundColor: "rgba(255,255,255,0.04)" }),
            }}
          />

          {/* SVG geometries */}
          <svg
            viewBox={`0 0 ${VB} ${VB}`}
            className="absolute inset-0 w-full h-full z-10 pointer-events-none overflow-visible"
          >
            <motion.path
              d={conePath}
              fill="rgba(255,255,255,0.05)"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth={1.5}
              strokeDasharray="6 6"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              style={{ transformOrigin: `${FOCUS_X}px ${FOCUS_Y}px` }}
            />
            <motion.circle
              cx={CX}
              cy={CY}
              r={CIRCLE_R}
              fill={`${meta.accent}59`}
              stroke={`${meta.accent}80`}
              strokeWidth={2}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, type: "spring", bounce: 0.4 }}
            />
          </svg>

          {/* Counter-rotated central card so value reads upright */}
          <div
            className="absolute z-30 inset-0 flex items-center justify-center"
            style={{ transform: `rotate(${-rotationDeg}deg)` }}
          >
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="relative bg-white rounded-full shadow-[0_18px_40px_rgba(0,0,0,0.45)] flex flex-col items-center justify-center text-center"
              style={{ width: 120, height: 120, padding: 14 }}
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                <circle cx="60" cy="60" r="54" stroke="#f1f5f9" strokeWidth="5" fill="none" />
                <motion.circle
                  cx="60" cy="60" r="54"
                  stroke={meta.ring} strokeWidth="5" fill="none" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 54}
                  initial={{ strokeDashoffset: 2 * Math.PI * 54 }}
                  animate={{ strokeDashoffset: (2 * Math.PI * 54) * 0.25 }}
                  transition={{ delay: 0.6, duration: 1.1, ease: "easeOut" }}
                />
              </svg>
              <Icon className="w-3.5 h-3.5 mb-0.5" style={{ color: meta.accent }} strokeWidth={2.4} />
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.18em] leading-none">
                {meta.label}
              </span>
              <span className="text-2xl font-black text-gray-900 tracking-tighter leading-none mt-1">
                {formatValue(value)}
              </span>
              <span className="text-[9px] font-semibold text-gray-400 mt-0.5">{meta.unit}</span>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.button>
  );
};

/* --------------------------- SiteMarker wrapper -------------------------- */

export const SiteMarker = ({ project, clientRole, brandLogo, onMarkerClick, onSphereClick }: SiteMarkerProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const closeTimer = useRef<number | null>(null);

  // Fetch realtime data only while hovered (siteId undefined when not hovered disables the hooks)
  const siteIdForFetch = isHovered ? project.siteId : undefined;
  const latest = useRealTimeLatestData(siteIdForFetch);
  const power = useEnergyPowerByCategory(siteIdForFetch);

  const handleEnter = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleLeave = useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setIsHovered(false), 150);
  }, []);

  const activeSpheres = (project.monitoring || []).filter(
    (m): m is MetricSection => m === "energy" || m === "air" || m === "water"
  );

  const valueFor = (section: Exclude<ProjectSection, "overview">): number | undefined => {
    if (section === "energy") {
      return power.totalGeneral ?? undefined;
    }
    if (section === "air") {
      const m = latest.metrics;
      return m["iaq.co2"] ?? m["co2"] ?? m["CO2"];
    }
    if (section === "water") {
      const m = latest.metrics;
      return m["water.flow_lpm"] ?? m["water.flow"] ?? m["water_flow"] ?? m["flow"];
    }
    return undefined;
  };

  const handleSectionClick = (section: MetricSection) => {
    const target: ProjectSection = clientRole === "STORE_USER" ? "overview" : section;
    onSphereClick(project, target);
  };

  /**
   * Fan widgets in an arc ABOVE the marker. Each widget is placed so that the
   * cone's focal point coincides with the marker center.
   *
   *   widgetCenter = marker − FOCUS_OFFSET_PX * (cos θ, sin θ)
   *
   * where θ is the direction from widget center → marker (the rotation we
   * apply to the widget so its cone aims at the marker).
   */
  const arcAngles = (n: number): number[] => {
    if (n <= 1) return [90]; // straight down from widget → marker is below
    if (n === 2) return [70, 110];
    return [55, 90, 125];
  };
  const angles = arcAngles(activeSpheres.length);

  return (
    <div
      className="site-marker-wrapper"
      style={{ position: "relative", width: 58, height: 58, pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Radar widgets overlay — anchored on marker, fanned upward */}
      <AnimatePresence>
        {isHovered && activeSpheres.length > 0 && (
          <motion.div
            key="radars"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 0,
              height: 0,
              pointerEvents: "none",
              zIndex: 50,
            }}
          >
            {activeSpheres.map((section, i) => {
              const thetaDeg = angles[i] ?? 90;
              const theta = thetaDeg * (Math.PI / 180);
              // Widget center offset from marker (marker is "below" widget along θ)
              const dx = -Math.cos(theta) * FOCUS_OFFSET_PX;
              const dy = -Math.sin(theta) * FOCUS_OFFSET_PX;
              return (
                <div
                  key={section}
                  style={{
                    position: "absolute",
                    left: dx,
                    top: dy,
                    width: 0,
                    height: 0,
                    pointerEvents: "auto",
                  }}
                >
                  <MapMetricRadar
                    section={section}
                    value={valueFor(section)}
                    rotationDeg={thetaDeg - 0} // align cone (default +x) to point at marker
                    backgroundImage={project.img || undefined}
                    brandLogo={brandLogo}
                    onClick={() => handleSectionClick(section)}
                    index={i}
                  />
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Marker pin */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMarkerClick(project);
        }}
        title={project.name}
        style={{
          width: 36,
          height: 36,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "block",
        }}
      >
        <img
          src={markerPinIcon}
          alt={project.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))",
            transition: "transform 0.2s ease",
          }}
        />
      </button>
    </div>
  );
};

export default SiteMarker;