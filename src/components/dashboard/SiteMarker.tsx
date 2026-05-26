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
  onMarkerClick: (project: Project) => void;
  onSphereClick: (project: Project, section: ProjectSection) => void;
}

const SPHERE_META: Record<
  Exclude<ProjectSection, "overview">,
  { icon: typeof Zap; iconClass: string; shadow: string; label: string; unit: string }
> = {
  energy: {
    icon: Zap,
    iconClass: "text-fgb-accent",
    shadow: "shadow-[0_10px_40px_rgba(20,184,166,0.25)]",
    label: "Main Load",
    unit: "kW",
  },
  air: {
    icon: Wind,
    iconClass: "text-sky-400",
    shadow: "shadow-[0_10px_40px_rgba(56,189,248,0.22)]",
    label: "CO₂",
    unit: "ppm",
  },
  water: {
    icon: Droplet,
    iconClass: "text-blue-400",
    shadow: "shadow-[0_10px_40px_rgba(96,165,250,0.22)]",
    label: "Flow",
    unit: "L/m",
  },
};

const formatValue = (v: number | undefined | null): string => {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  if (v >= 1000) return v.toFixed(0);
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
  exit: { opacity: 0, transition: { staggerChildren: 0.04, staggerDirection: -1 } },
};

const sphereVariants = {
  hidden: { opacity: 0, scale: 0.2, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 22 } },
  exit: { opacity: 0, scale: 0.2, y: 10, transition: { duration: 0.15 } },
};

export const SiteMarker = ({ project, clientRole, onMarkerClick, onSphereClick }: SiteMarkerProps) => {
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

  const activeSpheres = (project.monitoring || []).filter((m): m is MonitoringType =>
    m === "energy" || m === "air" || m === "water"
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

  const handleSphereClick = (e: React.MouseEvent, section: Exclude<ProjectSection, "overview">) => {
    e.stopPropagation();
    const target: ProjectSection = clientRole === "STORE_USER" ? "overview" : section;
    onSphereClick(project, target);
  };

  return (
    <div
      className="site-marker-wrapper"
      style={{ position: "relative", width: 58, height: 58, pointerEvents: "auto" }}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {/* Spheres overlay */}
      <AnimatePresence>
        {isHovered && activeSpheres.length > 0 && (
          <motion.div
            key="spheres"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{
              position: "absolute",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginBottom: 8,
              transformOrigin: "bottom center",
              display: "flex",
              gap: 8,
              pointerEvents: "auto",
            }}
          >
            {activeSpheres.map((section) => {
              const meta = SPHERE_META[section];
              const Icon = meta.icon;
              const value = valueFor(section);
              return (
                <motion.button
                  key={section}
                  variants={sphereVariants}
                  style={{ transformOrigin: "bottom center" }}
                  onClick={(e) => handleSphereClick(e, section)}
                  aria-label={`Apri sezione ${section} di ${project.name}`}
                  className={[
                    "w-20 h-20 rounded-full",
                    "bg-background/70 backdrop-blur-xl",
                    "border border-white/10",
                    meta.shadow,
                    "flex flex-col items-center justify-center gap-0.5",
                    "cursor-pointer transition-transform hover:scale-110",
                  ].join(" ")}
                >
                  <Icon className={`w-4 h-4 ${meta.iconClass}`} strokeWidth={2.2} />
                  <div className="text-sm font-bold text-foreground leading-none">
                    {formatValue(value)}
                  </div>
                  <div className="text-[8px] uppercase tracking-wider text-muted-foreground leading-none">
                    {meta.label}
                  </div>
                  <div className="text-[8px] text-muted-foreground/70 leading-none">
                    {meta.unit}
                  </div>
                </motion.button>
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
          width: "100%",
          height: "100%",
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
            transform: isHovered ? "scale(1.1)" : "scale(1)",
          }}
        />
      </button>
    </div>
  );
};

export default SiteMarker;