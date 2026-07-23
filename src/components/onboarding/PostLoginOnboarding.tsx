import React, { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ACCENT = "#006367";
const ACCENT_SOFT = "#a0d5d6";
const INK = "#1d1d1f";
const SUB = "#86868b";
const BG = "#fbfbfd";
const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const SOLUTIONS: {
  title: string;
  caption: string;
  video: string;
}[] = [
  {
    title: "Navigate at a glance",
    caption:
      "From holding to single site in one gesture — every KPI is one tap away, on any device.",
    video: "/videos/app-nav.mp4",
  },
  {
    title: "One dashboard. Every metric.",
    caption:
      "Energy, air and water live side by side. No juggling between systems, no wiring, always in sync.",
    video: "/videos/dashboard.mp4",
  },
  {
    title: "Analysis, not just data",
    caption:
      "AI-assisted diagnostics turn raw telemetry into decisions you can act on today.",
    video: "/videos/analysis.mp4",
  },
  {
    title: "Reports that write themselves",
    caption:
      "Multilingual PDF reports for ESG, LEED and internal reviews — generated on demand.",
    video: "/videos/report.mp4",
  },
];

interface Props {
  onComplete: () => void;
}

const PostLoginOnboarding: React.FC<Props> = ({ onComplete }) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const firstName =
    (user as any)?.user_metadata?.first_name ||
    (user as any)?.user_metadata?.full_name?.split(" ")?.[0] ||
    user?.email?.split("@")?.[0] ||
    "there";

  const scrollDown = () =>
    scrollerRef.current?.scrollBy({ top: window.innerHeight, behavior: "smooth" });

  return (
    <div
      ref={scrollerRef}
      className="fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden snap-y snap-mandatory scroll-smooth"
      style={{ background: BG }}
    >
      {/* ── Hero ── */}
      <section
        className="relative w-full h-[100dvh] snap-start flex flex-col items-center justify-center overflow-hidden px-8"
        style={{
          background: `
            radial-gradient(circle at 20% 20%, ${ACCENT_SOFT}55 0%, transparent 45%),
            radial-gradient(circle at 80% 80%, ${ACCENT}22 0%, transparent 50%),
            url("/green.webp") center/cover no-repeat,
            ${BG}
          `,
          backgroundBlendMode: "normal, normal, soft-light, normal",
        }}
      >
        <div className="absolute inset-0" style={{ background: "rgba(251,251,253,0.72)" }} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE }}
          className="relative z-10 text-center max-w-3xl"
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.35em]"
            style={{ color: ACCENT }}
          >
            Future Green Building
          </p>
          <h1
            className="mt-6 text-[clamp(2.25rem,5vw,4.5rem)] font-semibold tracking-tight leading-[1.05]"
            style={{ color: INK }}
          >
            Welcome to FGB,
            <br />
            <span style={{ color: ACCENT }}>{firstName}</span>.
          </h1>
          <p
            className="mt-6 text-[clamp(0.95rem,1.4vw,1.15rem)]"
            style={{ color: SUB }}
          >
            Precision hardware. Zero wiring. Real-time everywhere.
            <br />
            Take a minute to see what your platform can do.
          </p>
        </motion.div>

        {/* Hardware trio */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.4 }}
          className="relative z-10 mt-12 flex items-end justify-center gap-4"
        >
          {[
            { src: "/FGB_Mac.webp", w: 220 },
            { src: "/FGB_Pad.webp", w: 150 },
            { src: "/FGB_Phone.webp", w: 90 },
          ].map((d) => (
            <img
              key={d.src}
              src={d.src}
              alt=""
              style={{ width: d.w, filter: `drop-shadow(0 20px 40px ${ACCENT}44)` }}
              className="object-contain"
            />
          ))}
        </motion.div>

        <button
          onClick={scrollDown}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10"
          style={{ color: SUB }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em]">
            Discover our solution
          </span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </button>
      </section>

      {/* ── Solution intro banner ── */}
      <section
        className="relative w-full h-[60dvh] snap-start flex flex-col items-center justify-center px-8"
        style={{ background: "#fff" }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.35em]"
          style={{ color: ACCENT }}
        >
          Our Solution
        </p>
        <h2
          className="mt-4 text-center text-[clamp(1.75rem,3.5vw,3rem)] font-semibold tracking-tight max-w-3xl"
          style={{ color: INK }}
        >
          One platform.
          <br />
          <span style={{ color: ACCENT }}>Every metric that matters.</span>
        </h2>
      </section>

      {/* ── Solution feature sections ── */}
      {SOLUTIONS.map((s, i) => (
        <section
          key={s.video}
          className="relative w-full min-h-[100dvh] snap-start flex flex-col lg:flex-row items-center justify-center gap-10 px-8 py-16"
          style={{ background: i % 2 === 0 ? BG : "#fff" }}
        >
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.8, ease: EASE }}
            className="max-w-md lg:max-w-sm text-center lg:text-left"
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.3em]"
              style={{ color: ACCENT }}
            >
              {String(i + 1).padStart(2, "0")}
            </p>
            <h3
              className="mt-3 text-[clamp(1.5rem,2.6vw,2.25rem)] font-semibold tracking-tight"
              style={{ color: INK }}
            >
              {s.title}
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: SUB }}>
              {s.caption}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="w-full max-w-[720px] rounded-3xl overflow-hidden shadow-[0_30px_60px_-30px_rgba(0,99,103,0.4)] border border-black/[0.06] bg-black"
          >
            <video
              src={s.video}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          </motion.div>
        </section>
      ))}

      {/* ── Final CTA ── */}
      <section
        className="relative w-full h-[100dvh] snap-start flex flex-col items-center justify-center px-8 text-center overflow-hidden"
        style={{
          background: `linear-gradient(160deg, ${ACCENT} 0%, #004a4d 100%)`,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "url('/white.png')",
            backgroundSize: "220px",
            backgroundRepeat: "repeat",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.9, ease: EASE }}
          className="relative z-10 max-w-2xl"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-white/70">
            You're ready
          </p>
          <h2 className="mt-6 text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-tight text-white">
            Join your world.
          </h2>
          <p className="mt-4 text-[15px] text-white/80">
            Your live sites, KPIs and alerts are one click away.
          </p>

          <button
            onClick={onComplete}
            className="mt-10 inline-flex items-center gap-3 h-14 px-10 rounded-full text-[15px] font-semibold bg-white transition-transform hover:scale-[1.03]"
            style={{ color: ACCENT, boxShadow: "0 20px 40px -10px rgba(0,0,0,0.4)" }}
          >
            Join your world
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </section>
    </div>
  );
};

export default PostLoginOnboarding;