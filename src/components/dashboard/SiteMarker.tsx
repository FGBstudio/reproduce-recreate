import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Wind, Droplet, Award, Info } from "lucide-react";
import { Project, MonitoringType } from "@/lib/data";
import { ClientRole } from "@/hooks/useUserScope";
import { useRealTimeLatestData } from "@/hooks/useRealTimeTelemetry";
import { useEnergyPowerByCategory } from "@/hooks/useEnergyPowerByCategory";
import { useProjectCertifications } from "@/hooks/useProjectCertifications";
import { CertificationType } from "@/lib/types/admin";
import markerPinIcon from "@/assets/marker.png";

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
  energy: { icon: Zap,     accentVar: "--fgb-gold", ringVar: "--fgb-gold",       label: "Main Power", unit: "kW"  },
  air:    { icon: Wind,    accentVar: "--fgb-teal", ringVar: "--fgb-teal-ring",  label: "Air CO₂",    unit: "ppm" },
  water:  { icon: Droplet, accentVar: "--fgb-navy", ringVar: "--fgb-navy-ring",  label: "Water Flow", unit: "L/m" },
  certifications: { icon: Award, accentVar: "--fgb-emerald", ringVar: "--fgb-emerald-ring", label: "Cert. Score", unit: "Pts" },
};

const formatValue = (v: number | undefined | null): string => {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  if (v >= 1000) return v.toFixed(0);
  if (v >= 100)  return v.toFixed(0);
  if (v >= 10)   return v.toFixed(1);
  return v.toFixed(2);
};

/** Logo asset map per certification type. Types without a logo fall back to the Award icon. */
const CERT_LOGOS: Partial<Record<CertificationType, string>> = {
  LEED:   "/leed_logo.png",
  WELL:   "/well_logo.png",
  BREEAM: "/breeam_logo.png",
};

/* ─────────────────────────── geometry constants ─────────────────────────── */

const WIDGET_PX            = 340;
const VB                   = 600;
const CIRCLE_R             = 180;
const CX                   = 300;
const CY                   = 300;
const FOCUS_X              = 580;
const FOCUS_Y              = 300;
const CONE_HALF_ANGLE_DEG  = 25;
const SCALE                = WIDGET_PX / VB;
const FOCUS_OFFSET_PX      = (FOCUS_X - CX) * SCALE;

const LENS_D = (CIRCLE_R * 2) * SCALE;
const LENS_L = (CX - CIRCLE_R) * SCALE;
const LENS_T = (CY - CIRCLE_R) * SCALE;

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
  customIconImgs?: string[]; // Loghi certificazioni (LEED/WELL/BREEAM/…) — uno o più
  onClick:         () => void;
  index:           number;
}

const MapMetricRadar = ({
  section,
  value,
  rotationDeg,
  backgroundImage,
  brandLogo,
  customIconImgs,
  onClick,
  index,
}: RadarProps) => {
  const meta = METRIC_META[section];
  const Icon = meta.icon;
  const accent     = css(meta.accentVar);
  const ringColor  = css(meta.ringVar);

  const hasLogos       = !!customIconImgs && customIconImgs.length > 0;
  const isMultiLogo    = hasLogos && customIconImgs!.length >= 2;
  const isCertifications = section === "certifications";
  // Per la sfera certificazioni con loghi reali nascondiamo il numero mock e il ring di progress.
  const showNumericValue = !(isCertifications && hasLogos);
  const showProgressRing = !(isCertifications && hasLogos);

  // Dimensione dinamica dei loghi in base al numero
  const logoHeightClass = (() => {
    if (!hasLogos) return "h-8";
    const n = customIconImgs!.length;
    if (n === 1) return "h-9";
    if (n === 2) return "h-7";
    if (n === 3) return "h-6";
    return "h-5"; // 4+
  })();

  return (
    <motion.div
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
        {/* ── Layer z-10: Brand Pattern ── */}
        {(backgroundImage || brandLogo) && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              width: "150%",
              height: "150%",
              left: "-25%",
              top: "-25%",
              zIndex: 20,
              transform: `rotate(${-rotationDeg}deg)`,
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
            zIndex: 10,
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
            transform: `rotate(${-rotationDeg}deg)`,
          }}
        >
          <div
            className="relative flex flex-col items-center justify-center rounded-full shadow-xl"
            style={{
              width: CARD_SIZE,
              height: CARD_SIZE,
              border: `1.5px solid rgba(255, 255, 255, 0.4)`,
              backgroundColor: "rgba(255, 255, 255, 0.85)", 
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            {/* Progress ring */}
            {showProgressRing && <svg
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
            </svg>}

            {/* Loghi certificazioni o icona standard */}
            {hasLogos ? (
              <div
                className="flex items-center justify-center flex-wrap gap-1 mb-1 relative z-10"
                style={{ maxWidth: 92 }}
              >
                {customIconImgs!.map((src, i) => (
                  <img
                    key={`${src}-${i}`}
                    src={src}
                    alt="Certification logo"
                    className={`${logoHeightClass} w-auto object-contain drop-shadow-sm`}
                  />
                ))}
              </div>
            ) : (
              <Icon
                className="w-4 h-4 mb-1"
                style={{ color: accent, position: "relative", zIndex: 1 }}
                strokeWidth={2.4}
              />
            )}

            <span
              className="text-[9px] font-bold uppercase leading-none tracking-[0.18em]"
              style={{ color: "#475569", position: "relative", zIndex: 1 }}
            >
              {isCertifications && hasLogos ? "Certifications" : meta.label}
            </span>
            {showNumericValue ? (
              <>
                <span
                  className="text-3xl font-black tracking-tighter leading-none mt-1"
                  style={{ color: "#0f172a", position: "relative", zIndex: 1 }}
                >
                  {formatValue(value)}
                </span>
                <span
                  className="text-[9px] font-semibold mt-0.5"
                  style={{ color: "#64748b", position: "relative", zIndex: 1 }}
                >
                  {meta.unit}
                </span>
              </>
            ) : (
              <span
                className="text-[10px] font-semibold mt-1"
                style={{ color: "#64748b", position: "relative", zIndex: 1 }}
              >
                {customIconImgs!.length} active
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/* ─────────────────────── MapNameCard (hover intro) ──────────────────────── */

interface NameCardProps {
  name: string;
  rotationDeg: number;
  backgroundImage?: string;
  brandLogo?: string;
  onInfoClick: () => void;
}

const MapNameCard = ({
  name,
  rotationDeg,
  backgroundImage,
  brandLogo,
  onInfoClick,
}: NameCardProps) => {
  const FGB_GREEN = "#006367";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, rotate: rotationDeg }}
      animate={{ opacity: 1, scale: 1, rotate: rotationDeg }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="absolute pointer-events-none"
      style={{
        width: WIDGET_PX,
        height: WIDGET_PX,
        left: `calc(50% - ${WIDGET_PX / 2}px)`,
        top: `calc(50% - ${WIDGET_PX / 2}px)`,
      }}
    >
      {/* Lens */}
      <div
        className="absolute rounded-full pointer-events-auto"
        style={{
          width: LENS_D,
          height: LENS_D,
          left: LENS_L,
          top: LENS_T,
          boxShadow: `0 20px 40px ${cssA("--lens-shadow", 0.45)}, 0 0 0 2.5px ${FGB_GREEN}, inset 0 0 0 1px rgba(255,255,255,0.4)`,
          overflow: "hidden",
          isolation: "isolate",
          transform: "translateZ(0)",
        }}
      >
        {/* Brand pattern / site image */}
        {(backgroundImage || brandLogo) && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              width: "150%",
              height: "150%",
              left: "-25%",
              top: "-25%",
              zIndex: 20,
              transform: `rotate(${-rotationDeg}deg)`,
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

        {/* Glass patina */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            zIndex: 10,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)`,
            pointerEvents: "none",
          }}
        />

        {/* Inner border */}
        <div
          className="absolute inset-2 rounded-full border"
          style={{ zIndex: 30, pointerEvents: "none", borderColor: "rgba(255,255,255,0.3)" }}
        />

        {/* Central card: site name + info button */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 40, transform: `rotate(${-rotationDeg}deg)` }}
        >
          <div
            className="relative flex flex-col items-center justify-center rounded-full shadow-xl px-3"
            style={{
              width: CARD_SIZE,
              height: CARD_SIZE,
              border: `1.5px solid rgba(255, 255, 255, 0.4)`,
              backgroundColor: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}
          >
            {brandLogo && (
              <img
                src={brandLogo}
                alt="Brand logo"
                style={{
                  width: CARD_SIZE - 40,
                  maxHeight: 60,
                  objectFit: "contain",
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))",
                  position: "relative",
                  zIndex: 1,
                  marginBottom: 4,
                }}
              />
            )}
            <span
              className="text-[10px] font-bold uppercase tracking-[0.08em] text-center leading-tight"
              style={{
                color: FGB_GREEN,
                position: "relative",
                zIndex: 1,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                maxWidth: CARD_SIZE - 20,
              }}
            >
              {name.toUpperCase()}
            </span>
            <button
              type="button"
              onPointerDown={(e) => { e.stopPropagation(); onInfoClick(); }}
              onClick={(e) => { e.stopPropagation(); onInfoClick(); }}
              aria-label="Show site metrics"
              className="mt-2 flex items-center justify-center rounded-full transition-transform hover:scale-110"
              style={{
                width: 26,
                height: 26,
                backgroundColor: FGB_GREEN,
                border: "1.5px solid rgba(255,255,255,0.6)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                position: "relative",
                zIndex: 2,
                cursor: "pointer",
              }}
            >
              <Info className="w-3.5 h-3.5" style={{ color: "white" }} strokeWidth={2.6} />
            </button>
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
  const [showMetrics, setShowMetrics] = useState(false);
  const closeTimer = useRef<number | null>(null);

  // Certificazioni configurate via Admin (LEED/WELL/BREEAM/…)
  const certTypes = useProjectCertifications(project);
  const certLogos = certTypes
    .map((t) => CERT_LOGOS[t])
    .filter((src): src is string => !!src);

  // Fetch real-time data only while hovered
  const siteIdForFetch = isHovered ? project.siteId : undefined;
  const latest = useRealTimeLatestData(siteIdForFetch);
  const power   = useEnergyPowerByCategory(siteIdForFetch);

  const handleEnter = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleLeave = useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setIsHovered(false);
      setShowMetrics(false);
    }, 150);
  }, []);


  // Costruiamo l'array delle sfere attive
  const activeSpheres: MetricSection[] = ((project.monitoring || []) as string[]).filter(
    (m): m is MetricSection =>
      m === "energy" || m === "air" || m === "water"
  );

  // La sfera "certifications" appare SOLO se ci sono certificazioni reali configurate via Admin.
  const hasCertifications = certTypes.length > 0;
  if (hasCertifications) {
    activeSpheres.push("certifications");
  }


  const valueFor = (section: MetricSection): number | undefined => {
    if (section === "energy") {
      return power.totalGeneral ?? undefined;
    }
    if (section === "air") {
      const m = latest?.metrics || {};
      return m["iaq.co2"] ?? m["co2"] ?? m["CO2"];
    }
    if (section === "water") {
      const m = latest?.metrics || {};
      return m["water.flow_lpm"] ?? m["water.flow"] ?? m["water_flow"] ?? m["flow"];
    }
    if (section === "certifications") {
      // Se hai il punteggio nel database dentro project.certScore o simili, cambialo qui.
      // Esempio: return (project as any).certScore ?? undefined;
      return undefined;
    }
    return undefined;
  };

  const handleSectionClick = (section: MetricSection) => {
    onSphereClick(project, section);
  };

  const arcAngles = (n: number): number[] => {
    if (n <= 1) return [270];          // single widget: directly above
    if (n === 2) return [210, 330];    // two widgets: upper-left, upper-right
    if (n === 3) return [90, 210, 330];// three: below, upper-right, upper-left
    if (n === 4) return [45, 135, 225, 315]; // four widgets: form an "X" per non coprire il pin
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
      <AnimatePresence>
        {isHovered && activeSpheres.length > 0 && !showMetrics && (
          <motion.div
            key="name-card"
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
            {(() => {
              const thetaDeg = 270;
              const theta = thetaDeg * (Math.PI / 180);
              const dx = -Math.cos(theta) * FOCUS_OFFSET_PX;
              const dy = -Math.sin(theta) * FOCUS_OFFSET_PX;
              return (
                <div
                  style={{
                    position: "absolute",
                    left: dx,
                    top: dy,
                    width: 0,
                    height: 0,
                    pointerEvents: "auto",
                  }}
                >
                  <MapNameCard
                    name={project.name}
                    rotationDeg={thetaDeg}
                    backgroundImage={project.img || undefined}
                    brandLogo={brandLogo}
                    onInfoClick={() => setShowMetrics(true)}
                  />
                </div>
              );
            })()}
          </motion.div>
        )}
        {isHovered && activeSpheres.length > 0 && showMetrics && (
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
              const dx = -Math.cos(theta) * FOCUS_OFFSET_PX;
              const dy = -Math.sin(theta) * FOCUS_OFFSET_PX;

              // Loghi certificazioni reali (multipli supportati)
              const customImgs =
                section === "certifications" && certLogos.length > 0
                  ? certLogos
                  : undefined;

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
                    customIconImgs={customImgs}
                    onClick={() => handleSectionClick(section)}
                    index={i}
                  />
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onPointerDown={(e) => { e.stopPropagation(); onMarkerClick(project); }}
        onClick={(e) => { e.stopPropagation(); onMarkerClick(project); }}
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
