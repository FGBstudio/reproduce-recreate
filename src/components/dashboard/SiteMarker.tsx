import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Wind, Droplet, Award } from "lucide-react";
import { Project, MonitoringType } from "@/lib/data";
import { ClientRole } from "@/hooks/useUserScope";
import { useRealTimeLatestData } from "@/hooks/useRealTimeTelemetry";
import { useEnergyPowerByCategory } from "@/hooks/useEnergyPowerByCategory";
import markerPinIcon from "@/assets/marker.png";
import { useProjectCertifications } from "@/hooks/useProjectCertifications";

export type ProjectSection = "overview" | "energy" | "air" | "water" | "certifications";

interface SiteMarkerProps {
  project: Project;
  clientRole: ClientRole;
  brandLogo?: string;
  onMarkerClick: (project: Project) => void;
  onSphereClick: (project: Project, section: ProjectSection) => void;
}

type MetricSection = Exclude<ProjectSection, "overview">;

/** Design-system token helpers — keep hsl() outside of Tailwind class scope */
const css  = (v: string) => `hsl(var(${v}))`;
const cssA = (v: string, a: number) => `hsl(var(${v}) / ${a})`;

const METRIC_META: Record<
  MetricSection,
  { icon: typeof Zap; accentVar: string; ringVar: string; label: string; unit: string }
> = {
  // FGB palette via semantic HSL tokens (see index.css)
  energy: { icon: Zap,     accentVar: "--fgb-gold", ringVar: "--fgb-gold",      label: "Main Power", unit: "kW"  },
  air:    { icon: Wind,    accentVar: "--fgb-teal", ringVar: "--fgb-teal-ring", label: "Air CO₂",    unit: "ppm" },
  water:  { icon: Droplet, accentVar: "--fgb-navy", ringVar: "--fgb-navy-ring", label: "Water Flow", unit: "L/m" },
  certifications: { icon: Award, accentVar: "--fgb-emerald", ringVar: "--fgb-emerald-ring", label: "Cert. Score", unit: "Pts" },
};

const formatValue = (v: number | undefined | null): string => {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  if (v >= 1000) return v.toFixed(0);
  if (v >= 100)  return v.toFixed(0);
  if (v >= 10)   return v.toFixed(1);
  return v.toFixed(2);
};

/* ─────────────────────────── geometry constants ─────────────────────────── */

const WIDGET_PX            = 340;        // rendered size on screen (px)
const VB                   = 600;        // SVG viewBox side
const CIRCLE_R             = 180;        // lens radius in VB units
const CX                   = 300;
const CY                   = 300;
const FOCUS_X              = 580;        // cone focal point along +x
const FOCUS_Y              = 300;
const CONE_HALF_ANGLE_DEG  = 25;
const SCALE                = WIDGET_PX / VB;
const FOCUS_OFFSET_PX      = (FOCUS_X - CX) * SCALE;

const LENS_D = (CIRCLE_R * 2) * SCALE;  // lens diameter in px
const LENS_L = (CX - CIRCLE_R) * SCALE; // lens left offset in px
const LENS_T = (CY - CIRCLE_R) * SCALE; // lens top offset in px

const conePath = (() => {
  const a  = CONE_HALF_ANGLE_DEG * (Math.PI / 180);
  const p1x = CX + CIRCLE_R * Math.cos(-a);
  const p1y = CY + CIRCLE_R * Math.sin(-a);
  const p2x = CX + CIRCLE_R * Math.cos(a);
  const p2y = CY + CIRCLE_R * Math.sin(a);
  return `M ${FOCUS_X} ${FOCUS_Y} L ${p1x} ${p1y} A ${CIRCLE_R} ${CIRCLE_R} 0 0 0 ${p2x} ${p2y} Z`;
})();

/* ────────────────────────── MapMetricRadar widget ───────────────────────── */

const CARD_SIZE = 140;
const RING_R    = 56;
const RING_C    = 2 * Math.PI * RING_R;

interface RadarProps {
  section:         MetricSection;
  value:           number | undefined;
  rotationDeg:     number;
  backgroundImage?: string;
  brandLogo?:      string;
  onClick:         () => void;
  index:           number;
}

const MapMetricRadar = ({
  section,
  value,
  rotationDeg,
  backgroundImage,
  brandLogo,
  onClick,
  index,
}: RadarProps) => {
  const meta = METRIC_META[section];
  const Icon = meta.icon;
  const accent     = css(meta.accentVar);
  const ringColor  = css(meta.ringVar);

  return (
    <motion.div
      // 1. ROOT CAUSE FIX: Passa la rotazione direttamente a Framer Motion, non al CSS 'transform'
      initial={{ opacity: 0, scale: 0.6, rotate: rotationDeg }}
      animate={{ opacity: 1, scale: 1, rotate: rotationDeg }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay: index * 0.05 }}
      className="absolute pointer-events-none"
      style={{
        width:     WIDGET_PX,
        height:    WIDGET_PX,
        left:      `calc(50% - ${WIDGET_PX / 2}px)`,
        top:       `calc(50% - ${WIDGET_PX / 2}px)`,
      }}
    >
      {/* ── CONE ── */}
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        className="absolute inset-0 w-full h-full"
        style={{ zIndex: -1, overflow: "visible", pointerEvents: "none" }}
      >
        <path
          d={conePath}
          fill={cssA(meta.accentVar, 0.12)}
          stroke={cssA(meta.accentVar, 0.33)}
          strokeWidth={1.25}
          strokeDasharray="6 6"
        />
      </svg>

      {/* ── LENS ── */}
      <div
        className="absolute rounded-full pointer-events-auto cursor-pointer"
        // ROOT CAUSE FIX: Leaflet ruba i click. onPointerDown bypassa la mappa.
        onPointerDown={(e) => { e.stopPropagation(); onClick(); }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        role="button"
        aria-label={`${meta.label} lens`}
        style={{
          width:     LENS_D,
          height:    LENS_D,
          left:      LENS_L,
          top:       LENS_T,
          boxShadow:  `0 20px 40px ${cssA("--lens-shadow", 0.45)}, 0 0 0 2.5px ${accent}, inset 0 0 0 1px rgba(255,255,255,0.4)`,
          overflow: "hidden",
          isolation: "isolate",
          transform: "translateZ(0)",
        }}
      >
        {/* ── Layer z-10: Brand Pattern (Scollegato dalla rotazione) ── */}
        {(backgroundImage || brandLogo) && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              // 2. ROOT CAUSE FIX: Maggiorato al 150% per evitare angoli tagliati durante la contro-rotazione
              width: "150%",
              height: "150%",
              left: "-25%",
              top: "-25%",
              zIndex: 10,
              transform: `rotate(${-rotationDeg}deg)`, // Pattern sempre orizzontale
            }}
          >
            {backgroundImage ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${backgroundImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  opacity: 0.5,
                }}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${brandLogo})`,
                  backgroundRepeat: "repeat",
                  backgroundSize: "80px 80px",
                  opacity: 0.15,
                }}
              />
            )}
          </div>
        )}

        {/* ── Layer z-20: LA PATINA DI VETRO ── */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            zIndex: 20,
            // 3. ROOT CAUSE FIX: Blur nativo sopra il pattern z-10
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)`,
            pointerEvents: "none",
          }}
        />

        {/* ── Layer z-30: Inner border ring ── */}
        <div
          className="absolute inset-2 rounded-full border"
          style={{ zIndex: 30, pointerEvents: "none", borderColor: "rgba(255,255,255,0.3)" }}
        />

        {/* ── Layer z-40: Central Metric Card ── */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            zIndex: 40,
            transform: `rotate(${-rotationDeg}deg)`, // Contenuti orizzontali
          }}
        >
          <div
            className="relative flex flex-col items-center justify-center rounded-full shadow-xl"
            style={{
              width: CARD_SIZE,
              height: CARD_SIZE,
              border: `1.5px solid rgba(255, 255, 255, 0.4)`,
              // 4. ROOT CAUSE FIX: Trasparenza intenzionale bianca + extra blur
              backgroundColor: "rgba(255, 255, 255, 0.85)", 
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            {/* Progress ring */}
            <svg
              className="absolute inset-0 pointer-events-none"
              viewBox={`0 0 ${CARD_SIZE} ${CARD_SIZE}`}
              style={{ zIndex: 0, transform: "rotate(-90deg)" }}
            >
              <circle
                cx={CARD_SIZE / 2} cy={CARD_SIZE / 2} r={RING_R}
                stroke="rgba(0,0,0,0.06)" strokeWidth={5} fill="none"
              />
              <motion.circle
                cx={CARD_SIZE / 2} cy={CARD_SIZE / 2} r={RING_R}
                stroke={ringColor} strokeWidth={5} fill="none" strokeLinecap="round"
                strokeDasharray={RING_C}
                initial={{ strokeDashoffset: RING_C }}
                animate={{ strokeDashoffset: RING_C * 0.25 }}
                transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
              />
            </svg>

            {/* Testo scuro ad alto contrasto per fondo chiaro */}
            <Icon
              className="w-4 h-4 mb-1"
              style={{ color: accent, position: "relative", zIndex: 1 }}
              strokeWidth={2.4}
            />
            <span
              className="text-[9px] font-bold uppercase leading-none tracking-[0.18em]"
              style={{ color: "#475569", position: "relative", zIndex: 1 }} // Slate 600
            >
              {meta.label}
            </span>
            <span
              className="text-3xl font-black tracking-tighter leading-none mt-1"
              style={{ color: "#0f172a", position: "relative", zIndex: 1 }} // Slate 900
            >
              {formatValue(value)}
            </span>
            <span
              className="text-[9px] font-semibold mt-0.5"
              style={{ color: "#64748b", position: "relative", zIndex: 1 }} // Slate 500
            >
              {meta.unit}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ──────────────────────────── SiteMarker wrapper ────────────────────────── */

export const SiteMarker = ({
  project,
  clientRole,
  brandLogo,
  onMarkerClick,
  onSphereClick,
}: SiteMarkerProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const closeTimer = useRef<number | null>(null);

  // Fetch real-time data only while hovered
  const siteIdForFetch = isHovered ? project.siteId : undefined;
  const latest = useRealTimeLatestData(siteIdForFetch);
  const power   = useEnergyPowerByCategory(siteIdForFetch);
  const certs   = useProjectCertifications(siteIdForFetch);

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
    (m): m is MetricSection => m === "energy" || m === "air" || m === "water" || m === "certifications"
  );

  const valueFor = (section: MetricSection): number | undefined => {
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
    if (section === "certifications") {
      // Calculate total points across all certifications for this project
      if (!certs.certifications || certs.certifications.length === 0) return undefined;
      const totalPoints = certs.certifications.reduce((sum, c) => sum + (c.points_achieved || 0), 0);
      return totalPoints > 0 ? totalPoints : undefined;
    }
    return undefined;
  };

  /**
   * Click on a specific lens opens that section of the site dashboard.
   * STORE_USER is always redirected to overview.
   */
  const handleSectionClick = (section: MetricSection) => {
    onSphereClick(project, section);
  };

  /**
   * Fan widgets in an arc around the marker. Each widget is placed so that the
   * cone's focal point coincides with the marker centre.
   *
   * widgetCenter = markerCenter − FOCUS_OFFSET_PX · (cos θ, sin θ)
   *
   * θ = direction from widget center → marker (screen coords: 0°=right, 90°=down).
   */
  const arcAngles = (n: number): number[] => {
    if (n <= 1) return [270];          // single widget: directly above
    if (n === 2) return [210, 330];    // two widgets: upper-left, upper-right
    if (n === 3) return [90, 210, 330];// three: below, upper-right, upper-left
    if (n === 4) return [45, 135, 225, 315]; // four widgets: form an "X"
    
    // Fallback for n > 4
    return Array.from({ length: n }, (_, i) => (360 / n) * i);
  };
  const angles = arcAngles(activeSpheres.length);

  return (
    <div
      className="site-marker-wrapper"
      style={{
        position:       "relative",
        width:          58,
        height:         58,
        pointerEvents:  "auto",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
      }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* ── Radar lens overlay — anchored on marker, fanned outward ── */}
      <AnimatePresence>
        {isHovered && activeSpheres.length > 0 && (
          <motion.div
            key="radars"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position:      "absolute",
              left:          "50%",
              top:           "50%",
              width:         0,
              height:        0,
              pointerEvents: "none",
              zIndex:        50,
            }}
          >
            {activeSpheres.map((section, i) => {
              const thetaDeg = angles[i] ?? 90;
              const theta    = thetaDeg * (Math.PI / 180);
              // Widget centre offset so cone focal point aligns with marker
              const dx = -Math.cos(theta) * FOCUS_OFFSET_PX;
              const dy = -Math.sin(theta) * FOCUS_OFFSET_PX;

              return (
                <div
                  key={section}
                  style={{
                    position:      "absolute",
                    left:          dx,
                    top:           dy,
                    width:         0,
                    height:        0,
                    pointerEvents: "auto",
                  }}
                >
                  <MapMetricRadar
                    section={section}
                    value={valueFor(section)}
                    rotationDeg={thetaDeg}
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

      {/* ── Marker pin — click opens site Overview ── */}
      <button
        // ROOT CAUSE FIX: Protezione eventi Leaflet
        onPointerDown={(e) => {
          e.stopPropagation();
          onMarkerClick(project); 
        }}
        onClick={(e) => {
          e.stopPropagation();
          onMarkerClick(project); 
        }}
        title={project.name}
        style={{
          width:      36,
          height:     36,
          background: "transparent",
          border:     "none",
          padding:    0,
          cursor:     "pointer",
          display:    "block",
        }}
      >
        <img
          src={markerPinIcon}
          alt={project.name}
          style={{
            width:      "100%",
            height:     "100%",
            objectFit:  "contain",
            filter:     "drop-shadow(0 4px 6px rgba(0,0,0,0.3))",
            transition: "transform 0.2s ease",
          }}
        />
      </button>
    </div>
  );
};

export default SiteMarker;
