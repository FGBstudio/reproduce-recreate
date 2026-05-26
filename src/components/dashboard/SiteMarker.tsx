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
  { icon: typeof Zap; iconTint: string; label: string; unit: string }
> = {
  energy: { icon: Zap,     iconTint: "text-amber-500",  label: "Load", unit: "kW"  },
  air:    { icon: Wind,    iconTint: "text-sky-500",    label: "CO₂",  unit: "ppm" },
  water:  { icon: Droplet, iconTint: "text-blue-500",   label: "Flow", unit: "L/m" },
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
  hidden: { opacity: 0, scale: 0.3, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 24 } },
  exit: { opacity: 0, scale: 0.3, y: 8, transition: { duration: 0.15 } },
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
      style={{ position: "relative", width: 58, height: 58, pointerEvents: "auto", display: "flex", alignItems: "center", justifyContent: "center" }}
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
              marginBottom: 12,
              transformOrigin: "bottom center",
              display: "flex",
              gap: 10,
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
                    "w-[68px] h-[68px] rounded-full",
                    "bg-white/80 dark:bg-white/85 backdrop-blur-2xl",
                    "border border-white/60",
                    "shadow-[0_8px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.9)]",
                    "flex flex-col items-center justify-center gap-[2px]",
                    "cursor-pointer transition-all duration-200 hover:scale-105 hover:bg-white/95",
                    "ring-1 ring-black/5",
                  ].join(" ")}
                >
                  <Icon className={`w-[14px] h-[14px] ${meta.iconTint}`} strokeWidth={2.4} />
                  <div className="text-[13px] font-semibold text-neutral-900 leading-none tracking-tight">
                    {formatValue(value)}
                  </div>
                  <div className="text-[8px] font-medium uppercase tracking-[0.08em] text-neutral-500 leading-none">
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