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
  // FGB palette: gold #c0a062, teal #004d61, navy #002838
  energy: { icon: Zap,     accent: "#c0a062", ring: "#c0a062", label: "Main Power", unit: "kW"  },
  air:    { icon: Wind,    accent: "#004d61", ring: "#0a6e85", label: "Air CO₂",    unit: "ppm" },
  water:  { icon: Droplet, accent: "#002838", ring: "#1a5a73", label: "Water Flow", unit: "L/m" },
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
        background: "transparent",
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
        {/* Floating circular lens — no rectangular container */}
        <div className="relative w-full h-full">
          {/* SVG: cone (beam) + circular lens */}
          <svg
            viewBox={`0 0 ${VB} ${VB}`}
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
            style={{ filter: "drop-shadow(0 20px 40px rgba(0,40,56,0.45))" }}
          >
            <defs>
              <radialGradient id={`lens-bg-${section}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={`${meta.accent}33`} />
                <stop offset="70%" stopColor={`${meta.accent}1f`} />
                <stop offset="100%" stopColor={`${meta.accent}10`} />
              </radialGradient>
              <clipPath id={`lens-clip-${section}`}>
                <circle cx={CX} cy={CY} r={CIRCLE_R} />
              </clipPath>
            </defs>

            {/* Optical beam from marker focal point to the lens */}
            <motion.path
              d={conePath}
              fill={`${meta.accent}1a`}
              stroke={`${meta.accent}66`}
              strokeWidth={1.25}
              strokeDasharray="5 5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />

            {/* Image/logo background INSIDE the lens (clipped to circle) */}
            <g clipPath={`url(#lens-clip-${section})`}>
              <rect x={CX - CIRCLE_R} y={CY - CIRCLE_R} width={CIRCLE_R * 2} height={CIRCLE_R * 2} fill="#ffffff" />
              {backgroundImage ? (
                <image
                  href={backgroundImage}
                  x={CX - CIRCLE_R}
                  y={CY - CIRCLE_R}
                  width={CIRCLE_R * 2}
                  height={CIRCLE_R * 2}
                  preserveAspectRatio="xMidYMid slice"
                  opacity={0.55}
                />
              ) : brandLogo ? (
                <>
                  {Array.from({ length: 4 }).map((_, row) =>
                    Array.from({ length: 4 }).map((__, col) => (
                      <image
                        key={`${row}-${col}`}
                        href={brandLogo}
                        x={CX - CIRCLE_R + col * 90 + 10}
                        y={CY - CIRCLE_R + row * 90 + 10}
                        width={70}
                        height={70}
                        opacity={0.18}
                      />
                    ))
                  )}
                </>
              ) : null}
              {/* tint with FGB accent */}
              <rect
                x={CX - CIRCLE_R}
                y={CY - CIRCLE_R}
                width={CIRCLE_R * 2}
                height={CIRCLE_R * 2}
                fill={`url(#lens-bg-${section})`}
              />
            </g>

            {/* Lens border (gold/teal accent ring) */}
            <motion.circle
              cx={CX}
              cy={CY}
              r={CIRCLE_R}
              fill="none"
              stroke={meta.accent}
              strokeWidth={2.5}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, type: "spring", bounce: 0.35 }}
              style={{ transformOrigin: `${CX}px ${CY}px` }}
            />
            <circle
              cx={CX}
              cy={CY}
              r={CIRCLE_R - 6}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={0.4}
              strokeWidth={1}
            />
          </svg>

          {/* Counter-rotated central card so text always reads upright */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ transform: `rotate(${-rotationDeg}deg)` }}
          >
            <motion.div
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.45 }}
              className="relative rounded-full flex flex-col items-center justify-center text-center backdrop-blur-xl"
              style={{
                width: 124,
                height: 124,
                padding: 14,
                background: "rgba(255,255,255,0.92)",
                boxShadow: "0 14px 36px rgba(0,40,56,0.35), inset 0 1px 0 rgba(255,255,255,0.9)",
                border: `1px solid ${meta.accent}55`,
              }}
            >
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                <circle cx="62" cy="62" r="56" stroke="#eef2f4" strokeWidth="4" fill="none" />
                <motion.circle
                  cx="62" cy="62" r="56"
                  stroke={meta.ring} strokeWidth="4" fill="none" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 56}
                  initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                  animate={{ strokeDashoffset: (2 * Math.PI * 56) * 0.25 }}
                  transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
                />
              </svg>
              <Icon className="w-4 h-4 mb-1" style={{ color: meta.accent }} strokeWidth={2.4} />
              <span
                className="text-[8px] font-bold uppercase tracking-[0.18em] leading-none"
                style={{ color: "#5b6770" }}
              >
                {meta.label}
              </span>
              <span
                className="text-2xl font-black tracking-tighter leading-none mt-1"
                style={{ color: "#002838" }}
              >
                {formatValue(value)}
              </span>
              <span className="text-[9px] font-semibold mt-0.5" style={{ color: "#8a96a0" }}>
                {meta.unit}
              </span>
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