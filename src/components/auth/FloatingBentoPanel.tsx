import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Award, ChevronDown, Droplet, Wind, Zap } from "lucide-react";
import Globe3D from "./Globe3D";
import IdleOverlay from "./IdleOverlay";
import CityTicker from "./CityTicker";
import LoginModal from "./LoginModal";
import { COMPANY_STATS } from "@/lib/companyStats";

/* ───────── design tokens (Apple-minimal, FGB green) ───────── */
const INK = "#1d1d1f";
const SUB = "#86868b";
const BG = "#fbfbfd";
const SURFACE = "#ffffff";
const ACCENT = "#006367";
const ACCENT_SOFT = "#a0d5d6";
const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

/* ───────── HERO ───────── */
const Hero: React.FC<{ onScroll: () => void; onLogin: () => void; blurGlobe: boolean }> = ({
  onScroll,
  onLogin,
  blurGlobe,
}) => {
  const heroRef = useRef<HTMLDivElement>(null);
  return (
    <section
      ref={heroRef}
      id="top"
      className="relative w-full min-h-[100dvh] snap-start overflow-hidden flex flex-col items-center justify-between"
      style={{ background: BG }}
    >
      <div className="w-full pt-8 px-8 flex items-center justify-between z-20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em]" style={{ color: ACCENT }}>
          Future Green Building
        </p>
        <button
          type="button"
          onClick={onLogin}
          className="px-5 py-2 rounded-full text-[12px] font-semibold uppercase tracking-wider text-white transition-transform hover:scale-[1.03]"
          style={{ background: ACCENT, boxShadow: `0 10px 24px -10px ${ACCENT}80` }}
        >
          Sign in
        </button>
      </div>

      <div
        className="relative flex-1 w-full flex items-center justify-center transition-[filter] duration-500"
        style={{ filter: blurGlobe ? "blur(14px) saturate(0.9)" : "none" }}
      >
        <div className="relative w-[min(640px,72vw)] aspect-square">
          <div
            aria-hidden
            className="absolute inset-[-15%] rounded-full pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${ACCENT}22 0%, transparent 65%)`,
              filter: "blur(30px)",
            }}
          />
          <Globe3D />
        </div>
        <IdleOverlay targetRef={heroRef} onLoginClick={onLogin} onScrollHint={onScroll} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: EASE, delay: 0.3 }}
        className="w-full text-center px-8 z-10"
      >
        <div className="flex items-center justify-center gap-10 mb-4">
          {COMPANY_STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <span className="text-[clamp(1.25rem,2vw,1.75rem)] font-semibold tracking-tight" style={{ color: INK }}>
                {s.value}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.25em]" style={{ color: SUB }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <h1 className="text-[clamp(1.5rem,2.6vw,2.4rem)] font-semibold tracking-tight" style={{ color: INK }}>
          Precisely measured. Globally connected.
        </h1>
      </motion.div>

      <div className="w-full mt-6">
        <CityTicker />
      </div>

      <button onClick={onScroll} className="mt-2 mb-4 flex flex-col items-center gap-1" style={{ color: SUB }}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Scroll</span>
        <ChevronDown className="w-4 h-4 animate-bounce" />
      </button>
    </section>
  );
};

/* ───────── LEVEL 1 — Certifications ───────── */
const CERTIFICATIONS = [
  { name: "BREEAM", src: "/breeam_logo.webp" },
  { name: "Envision", src: "/envision.webp" },
  { name: "Fitwel", src: "/fitwel_logo.webp" },
  { name: "GRESB", src: "/logo_gresb.webp" },
  { name: "LEED", src: "/leed_logo.webp" },
  { name: "LIFE", src: "/life_logo.webp" },
  { name: "WELL", src: "/well_logo.webp" },
].sort((a, b) => a.name.localeCompare(b.name));

const Certifications: React.FC = () => (
  <section
    id="certifications"
    className="relative w-full min-h-[100dvh] snap-start flex flex-col items-center justify-center px-8 py-20"
    style={{ background: SURFACE }}
  >
    <div className="w-full max-w-[1080px] text-center">
      <div className="inline-flex items-center gap-2 justify-center mb-3">
        <Award className="w-4 h-4" style={{ color: ACCENT }} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: ACCENT }}>
          Level 1 · Certifications & Partners
        </p>
      </div>
      <h2 className="text-[clamp(1.5rem,2.5vw,2.25rem)] font-semibold tracking-tight" style={{ color: INK }}>
        Your path to Sustainability excellence.
        <br />
        <span style={{ color: ACCENT }}>Precisely measured.</span>
      </h2>

      <div className="mt-14 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center">
        {CERTIFICATIONS.map((c) => (
          <div
            key={c.name}
            className="w-[140px] h-[140px] rounded-2xl bg-white border border-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.04)] flex items-center justify-center p-5 transition-transform hover:-translate-y-1"
          >
            <img src={c.src} alt={c.name} className="max-w-full max-h-full object-contain" loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ───────── LEVEL 2 — Monitoring (Water / Air / Energy) ───────── */
type Tile = { title: string; Icon: React.ComponentType<any> };
const TILES: Tile[] = [
  { title: "WATER", Icon: Droplet },
  { title: "AIR", Icon: Wind },
  { title: "ENERGY", Icon: Zap },
];

const LynxHardwareAnimation: React.FC<{ Icon: Tile["Icon"] }> = ({ Icon }) => (
  <div
    className="relative w-full aspect-square rounded-3xl overflow-hidden"
    style={{ background: `linear-gradient(160deg, ${SURFACE}, ${ACCENT}08)` }}
  >
    <motion.div
      className="absolute left-1/2 top-1/2"
      initial={{ x: "-50%", y: "-50%", rotate: 0 }}
      animate={{ rotate: [0, -8, 6, 0], y: ["-50%", "-52%", "-48%", "-50%"] }}
      transition={{ duration: 4, ease: EASE, repeat: Infinity }}
    >
      <div
        className="w-[110px] h-[110px] rounded-2xl flex items-center justify-center"
        style={{
          background: `linear-gradient(160deg, #fff, ${ACCENT_SOFT}55)`,
          boxShadow: `0 20px 40px -15px ${ACCENT}55, inset 0 0 0 1px ${ACCENT}22`,
        }}
      >
        <Icon className="w-14 h-14" strokeWidth={1.5} style={{ color: ACCENT }} />
      </div>
    </motion.div>
  </div>
);

const Monitoring: React.FC = () => (
  <section
    id="discovery"
    className="relative w-full min-h-[100dvh] snap-start flex flex-col items-center justify-center px-8 py-20"
    style={{ background: BG }}
  >
    <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: ACCENT }}>
      Level 2 · Monitoring
    </p>
    <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-[1080px]">
      {TILES.map((tile, i) => (
        <motion.div
          key={tile.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
          className="flex flex-col items-center gap-4"
        >
          <h3 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold tracking-[0.05em]" style={{ color: INK }}>
            {tile.title}
          </h3>
          <LynxHardwareAnimation Icon={tile.Icon} />
        </motion.div>
      ))}
    </div>
  </section>
);

/* ───────── Access / CTA ───────── */
const PricingCTA: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <section
    id="pricing"
    className="relative w-full min-h-[100dvh] snap-start flex flex-col items-center justify-center px-8 py-20"
    style={{ background: SURFACE }}
  >
    <div className="w-full max-w-[1080px]">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: ACCENT }}>
          Access
        </p>
        <h2 className="mt-3 text-[clamp(1.75rem,3vw,2.5rem)] font-semibold tracking-tight" style={{ color: INK }}>
          Two ways in. One conversation.
        </h2>
        <p className="mt-3 text-[14px]" style={{ color: SUB }}>
          Commercial terms are always defined one-to-one.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[720px] mx-auto">
        {[
          { title: "Free", subtitle: "Explore the ecosystem." },
          { title: "Custom", subtitle: "Tailored to your portfolio." },
        ].map((p) => (
          <div
            key={p.title}
            className="rounded-3xl border border-black/[0.06] bg-white p-10 flex flex-col items-center text-center shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
          >
            <div
              className="text-[clamp(2rem,3vw,2.75rem)] font-semibold tracking-tight"
              style={{ color: ACCENT }}
            >
              {p.title}
            </div>
            <p className="mt-2 text-[13px]" style={{ color: SUB }}>
              {p.subtitle}
            </p>
            <p className="mt-6 text-[12px] uppercase tracking-[0.2em]" style={{ color: SUB }}>
              Defined one-to-one
            </p>
          </div>
        ))}
      </div>

      <div className="mt-14 flex justify-center">
        <button
          type="button"
          onClick={onCreate}
          className="h-14 px-10 rounded-full text-[15px] font-semibold text-white transition-transform hover:scale-[1.03]"
          style={{ background: ACCENT, boxShadow: `0 20px 40px -12px ${ACCENT}80` }}
        >
          Create One →
        </button>
      </div>
    </div>
  </section>
);

/* ───────── Main ───────── */
const FloatingBentoPanel: React.FC = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMode, setLoginMode] = useState<"login" | "request">("login");

  useEffect(() => {
    const openLogin = () => { setLoginMode("login"); setLoginOpen(true); };
    const openRequest = () => { setLoginMode("request"); setLoginOpen(true); };
    window.addEventListener("fgb:open-login", openLogin);
    window.addEventListener("fgb:create-account", openRequest);
    return () => {
      window.removeEventListener("fgb:open-login", openLogin);
      window.removeEventListener("fgb:create-account", openRequest);
    };
  }, []);

  const scrollToNext = () => {
    scrollerRef.current?.scrollBy({ top: window.innerHeight, behavior: "smooth" });
  };
  const scrollToId = (id: string) => {
    const el = scrollerRef.current?.querySelector(`#${id}`) as HTMLElement | null;
    if (el && scrollerRef.current) {
      scrollerRef.current.scrollTo({ top: el.offsetTop, behavior: "smooth" });
    }
  };

  return (
    <div
      ref={scrollerRef}
      className="w-full h-[100dvh] overflow-y-auto overflow-x-hidden snap-y snap-mandatory scroll-smooth relative"
      style={{ background: BG, scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`.fb-scroll::-webkit-scrollbar{display:none}`}</style>

      {/* Top nav — minimal, centered */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5 pointer-events-none">
        <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-8 text-[13px] font-medium pointer-events-auto" style={{ color: INK }}>
          <button onClick={() => scrollToId("certifications")} className="hover:opacity-70 transition-opacity">Certifications</button>
          <button onClick={() => scrollToId("discovery")} className="hover:opacity-70 transition-opacity">Monitoring</button>
          <button onClick={() => scrollToId("pricing")} className="hover:opacity-70 transition-opacity">Access</button>
        </div>
        <div className="ml-auto flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => { setLoginMode("login"); setLoginOpen(true); }}
            className="px-5 py-2 text-xs font-semibold uppercase tracking-wider rounded-full border transition-all"
            style={{ borderColor: `${ACCENT}55`, color: ACCENT, background: "rgba(255,255,255,0.7)", backdropFilter: "blur(10px)" }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setLoginMode("request"); setLoginOpen(true); }}
            className="px-5 py-2 text-white text-xs font-bold uppercase tracking-wider rounded-full transition-all"
            style={{ background: ACCENT, boxShadow: `0 8px 20px -8px ${ACCENT}80` }}
          >
            Create One
          </button>
        </div>
      </nav>

      <Hero
        onScroll={scrollToNext}
        onLogin={() => { setLoginMode("login"); setLoginOpen(true); }}
        blurGlobe={loginOpen}
      />
      <Certifications />
      <Monitoring />
      <PricingCTA onCreate={() => { setLoginMode("request"); setLoginOpen(true); }} />

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} initialMode={loginMode} />
    </div>
  );
};

export default FloatingBentoPanel;