import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Map as MapIcon, LayoutDashboard, LineChart, FileText, Play, Pause } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ACCENT = "#006367";
const ACCENT_SOFT = "#a0d5d6";
const INK = "#1d1d1f";
const SUB = "#86868b";
const BG = "#fbfbfd";
const SURFACE = "#ffffff";
const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

type Service = {
  key: string;
  title: string;
  caption: string;
  video: string;
  Icon: React.ComponentType<any>;
};

const SERVICES: Service[] = [
  {
    key: "nav",
    title: "Navigate the portfolio",
    caption: "One map, every asset. Zoom from continent to control panel.",
    video: "/videos/app-nav.mp4",
    Icon: MapIcon,
  },
  {
    key: "dashboard",
    title: "Real-time dashboards",
    caption: "Air, water and energy — measured, correlated, always live.",
    video: "/videos/dashboard.mp4",
    Icon: LayoutDashboard,
  },
  {
    key: "analysis",
    title: "Deep analysis",
    caption: "Trends, anomalies and benchmarks across the entire estate.",
    video: "/videos/analysis.mp4",
    Icon: LineChart,
  },
  {
    key: "report",
    title: "Reports & certifications",
    caption: "LEED, BREEAM, WELL — packaged into shareable documents.",
    video: "/videos/report.mp4",
    Icon: FileText,
  },
];

const VideoCard: React.FC<{ service: Service; index: number; onEnter: () => void }> = ({
  service,
  index,
  onEnter,
}) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };
  const Icon = service.Icon;
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, ease: EASE, delay: index * 0.08 }}
      className="rounded-3xl overflow-hidden border border-black/[0.06] bg-white shadow-[0_10px_30px_-15px_rgba(0,0,0,0.15)] flex flex-col"
    >
      <div className="relative aspect-video bg-black/90 group">
        <video
          ref={ref}
          src={service.video}
          className="w-full h-full object-cover"
          muted
          loop
          playsInline
          preload="metadata"
          onClick={toggle}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <span
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: `${ACCENT}f0`, boxShadow: `0 12px 30px -8px ${ACCENT}` }}
          >
            {playing ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white ml-0.5" />}
          </span>
        </button>
      </div>
      <div className="p-6 flex-1 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${ACCENT}12` }}
          >
            <Icon className="w-4 h-4" style={{ color: ACCENT }} />
          </span>
          <h3 className="text-[15px] font-semibold tracking-tight" style={{ color: INK }}>
            {service.title}
          </h3>
        </div>
        <p className="text-[13px] leading-relaxed" style={{ color: SUB }}>
          {service.caption}
        </p>
        <button
          type="button"
          onClick={onEnter}
          className="mt-auto inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.15em] self-start transition-transform hover:translate-x-0.5"
          style={{ color: ACCENT }}
        >
          Go to map <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.article>
  );
};

const ServiceHub: React.FC<{ onEnter: () => void }> = ({ onEnter }) => {
  const { user } = useAuth() as any;
  const displayName =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    (user?.email ? String(user.email).split("@")[0] : "");

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{ background: BG }}
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 md:py-14">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: ACCENT, boxShadow: `0 8px 20px -8px ${ACCENT}80` }}
            >
              <img
                src="/green.webp"
                alt="FGB"
                className="w-6 h-6 object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.35em]"
              style={{ color: ACCENT }}
            >
              Service Hub
            </p>
          </div>
          <button
            type="button"
            onClick={onEnter}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[12px] font-semibold uppercase tracking-wider text-white transition-transform hover:scale-[1.03]"
            style={{ background: ACCENT, boxShadow: `0 10px 24px -10px ${ACCENT}80` }}
          >
            Go to map <ArrowRight className="w-4 h-4" />
          </button>
        </header>

        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="max-w-[720px]"
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.3em] mb-3" style={{ color: SUB }}>
            {displayName ? `Welcome back, ${displayName}` : "Welcome back"}
          </p>
          <h1
            className="text-[clamp(1.75rem,3.4vw,3rem)] font-semibold tracking-tight leading-[1.05]"
            style={{ color: INK }}
          >
            Your buildings.<br />
            <span style={{ color: ACCENT }}>Precisely measured.</span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed max-w-[560px]" style={{ color: SUB }}>
            A quick tour of what the platform can do — navigate the portfolio,
            monitor in real time, analyse trends and publish certification-ready
            reports.
          </p>
        </motion.div>

        {/* Services grid */}
        <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {SERVICES.map((s, i) => (
            <VideoCard key={s.key} service={s} index={i} onEnter={onEnter} />
          ))}
        </section>

        {/* Final CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mt-14 rounded-3xl p-10 md:p-14 text-center"
          style={{
            background: `linear-gradient(135deg, ${ACCENT} 0%, #004a4d 100%)`,
            boxShadow: `0 30px 60px -25px ${ACCENT}`,
          }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.35em] mb-3"
            style={{ color: ACCENT_SOFT }}
          >
            Ready when you are
          </p>
          <h2 className="text-[clamp(1.5rem,2.6vw,2.25rem)] font-semibold tracking-tight text-white">
            Enter the operational view.
          </h2>
          <button
            type="button"
            onClick={onEnter}
            className="mt-8 inline-flex items-center gap-2 h-12 px-8 rounded-full text-[14px] font-semibold transition-transform hover:scale-[1.03]"
            style={{ background: SURFACE, color: ACCENT }}
          >
            Open the map <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        <p
          className="mt-10 text-center text-[11px] uppercase tracking-[0.3em]"
          style={{ color: SUB }}
        >
          Future Green Building · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default ServiceHub;