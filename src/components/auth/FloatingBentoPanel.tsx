import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Droplet, Wind, Zap } from "lucide-react";

/* ───────── design tokens (Apple-minimal, FGB green) ───────── */
const INK = "#1d1d1f";
const SUB = "#86868b";
const BG = "#fbfbfd";
const SURFACE = "#ffffff";
const ACCENT = "#006367";
const ACCENT_SOFT = "#a0d5d6";
const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

/* ───────── event bridge with the left login form ───────── */
const requestCreateAccount = () => {
  window.dispatchEvent(new CustomEvent("fgb:create-account"));
};

/* ───────── Region → globe rotation (approx. longitude center) ───────── */
const REGION_TO_LNG: Record<string, number> = {
  EU: 10,
  AMER: -95,
  APAC: 120,
  MEA: 40,
  GLOBAL: 10,
};

type GeoIP = { country_code?: string; country?: string; latitude?: number; longitude?: number };

function countryToRegion(cc?: string): keyof typeof REGION_TO_LNG {
  if (!cc) return "GLOBAL";
  const c = cc.toUpperCase();
  if (["IT", "FR", "DE", "ES", "GB", "CH", "NL", "BE", "AT", "SE", "NO", "DK", "PT", "IE", "FI", "PL"].includes(c)) return "EU";
  if (["US", "CA", "MX", "BR", "AR", "CL", "CO", "PE"].includes(c)) return "AMER";
  if (["CN", "JP", "KR", "AU", "NZ", "SG", "IN", "TH", "VN", "ID", "MY", "PH"].includes(c)) return "APAC";
  if (["AE", "SA", "QA", "ZA", "EG", "TR", "KW", "OM", "MA", "TN"].includes(c)) return "MEA";
  return "GLOBAL";
}

/* ───────── Animated Globe (CSS + SVG, no heavy deps) ───────── */
const AnimatedGlobe: React.FC = () => {
  const [targetLng, setTargetLng] = useState<number | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = localStorage.getItem("fgb_geoip");
        let data: GeoIP | null = cached ? JSON.parse(cached) : null;
        if (!data) {
          const res = await fetch("https://ipapi.co/json/");
          data = await res.json();
          if (data) localStorage.setItem("fgb_geoip", JSON.stringify(data));
        }
        if (cancelled || !data) return;
        const region = countryToRegion(data.country_code || data.country);
        setTargetLng(REGION_TO_LNG[region]);
        if (typeof data.latitude === "number" && typeof data.longitude === "number") {
          setPin({ lat: data.latitude, lng: data.longitude });
        }
      } catch {
        setTargetLng(REGION_TO_LNG.EU);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Rotation: continuous spin until we know the region, then settle.
  const rotation = targetLng == null ? undefined : -targetLng;

  return (
    <div className="relative w-[min(520px,60vw)] aspect-square select-none">
      {/* halo */}
      <div
        aria-hidden
        className="absolute inset-[-12%] rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${ACCENT}22 0%, transparent 60%)`,
          filter: "blur(20px)",
        }}
      />

      {/* sphere */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: `radial-gradient(circle at 35% 30%, #e7f3f3 0%, ${ACCENT_SOFT} 45%, ${ACCENT} 100%)`,
          boxShadow: `inset -30px -30px 60px rgba(0,0,0,0.25), inset 20px 20px 40px rgba(255,255,255,0.35), 0 30px 60px -20px ${ACCENT}55`,
        }}
      >
        {/* rotating continents layer */}
        <motion.div
          className="absolute inset-0"
          animate={
            rotation == null
              ? { rotate: 360 }
              : { rotate: rotation }
          }
          transition={
            rotation == null
              ? { repeat: Infinity, duration: 40, ease: "linear" }
              : { duration: 2.2, ease: EASE }
          }
        >
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full opacity-70">
            <defs>
              <clipPath id="globeClip">
                <circle cx="100" cy="100" r="100" />
              </clipPath>
            </defs>
            <g clipPath="url(#globeClip)" fill="#ffffff" fillOpacity="0.55">
              {/* stylized continents — abstract blobs */}
              <path d="M20,70 Q35,55 55,60 T90,70 Q100,80 85,95 T50,110 Q30,100 20,85 Z" />
              <path d="M110,55 Q135,45 155,60 T175,90 Q170,110 150,105 T115,90 Q105,75 110,55 Z" />
              <path d="M60,130 Q80,120 100,130 T140,145 Q145,165 125,170 T80,165 Q60,155 60,130 Z" />
              <path d="M155,130 Q170,125 180,140 T175,165 Q160,170 155,155 Z" />
            </g>
            {/* meridians */}
            <g stroke="#ffffff" strokeOpacity="0.18" fill="none">
              <ellipse cx="100" cy="100" rx="100" ry="40" />
              <ellipse cx="100" cy="100" rx="100" ry="70" />
              <ellipse cx="100" cy="100" rx="40" ry="100" />
              <ellipse cx="100" cy="100" rx="70" ry="100" />
            </g>
          </svg>
        </motion.div>

        {/* pin marker — appears once we've located the user */}
        {pin && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2.4, duration: 0.5, ease: EASE }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ background: "#fff", boxShadow: `0 0 0 4px ${ACCENT}66, 0 0 20px #fff` }}
            />
            <div
              className="absolute inset-0 w-3 h-3 rounded-full animate-ping"
              style={{ background: "#fff", opacity: 0.6 }}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

/* ───────── Hero ───────── */
const Hero: React.FC<{ onScroll: () => void }> = ({ onScroll }) => (
  <section
    id="top"
    className="relative w-full h-[100dvh] snap-start overflow-hidden flex flex-col items-center justify-center"
    style={{ background: BG }}
  >
    <AnimatedGlobe />

    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: EASE, delay: 0.3 }}
      className="absolute bottom-24 left-0 right-0 text-center px-8"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: ACCENT }}>
        Future Green Building
      </p>
      <h1
        className="mt-3 text-[clamp(1.75rem,3vw,2.75rem)] font-semibold tracking-tight"
        style={{ color: INK }}
      >
        Precisely measured. Globally connected.
      </h1>
    </motion.div>

    <button
      onClick={onScroll}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
      style={{ color: SUB }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Scroll</span>
      <ChevronDown className="w-4 h-4 animate-bounce" />
    </button>
  </section>
);

/* ───────── Discovery of World (WATER / AIR / ENERGY) ───────── */
type DiscoveryTile = { title: string; Icon: React.ComponentType<any> };

const DISCOVERY: DiscoveryTile[] = [
  { title: "WATER", Icon: Droplet },
  { title: "AIR", Icon: Wind },
  { title: "ENERGY", Icon: Zap },
];

const LynxHardwareAnimation: React.FC<{ Icon: DiscoveryTile["Icon"] }> = ({ Icon }) => {
  // Playful placeholder animation: a lynx silhouette (SVG) batting at the brand device pictogram.
  return (
    <div className="relative w-full aspect-square rounded-3xl overflow-hidden" style={{ background: `linear-gradient(160deg, ${SURFACE}, ${ACCENT}08)` }}>
      {/* device */}
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

      {/* lynx silhouette — playful paw + ears */}
      <motion.svg
        viewBox="0 0 200 200"
        className="absolute inset-0 w-full h-full pointer-events-none"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: [0, 6, -4, 0], opacity: 1 }}
        transition={{ duration: 3, ease: EASE, repeat: Infinity, delay: 0.4 }}
      >
        {/* body */}
        <g fill={ACCENT} opacity="0.85">
          <ellipse cx="150" cy="150" rx="42" ry="26" />
          {/* head */}
          <circle cx="170" cy="120" r="20" />
          {/* ears (lynx tufts) */}
          <polygon points="160,100 156,84 168,98" />
          <polygon points="182,100 186,84 174,98" />
          {/* paw reaching for device */}
          <ellipse cx="118" cy="128" rx="12" ry="8" transform="rotate(-25 118 128)" />
          {/* tail */}
          <path d="M188,155 Q205,145 200,130" stroke={ACCENT} strokeWidth="6" fill="none" strokeLinecap="round" />
        </g>
        {/* eyes */}
        <circle cx="163" cy="118" r="1.8" fill="#fff" />
        <circle cx="176" cy="118" r="1.8" fill="#fff" />
      </motion.svg>
    </div>
  );
};

const Discovery: React.FC = () => (
  <section
    id="discovery"
    className="relative w-full min-h-[100dvh] snap-start flex flex-col items-center justify-center px-8 py-20"
    style={{ background: SURFACE }}
  >
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="text-[11px] font-semibold uppercase tracking-[0.3em]"
      style={{ color: ACCENT }}
    >
      Discovery of World
    </motion.p>

    <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-[1080px]">
      {DISCOVERY.map((tile, i) => (
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

/* ───────── Certifications (alphabetical, uniform tile size) ───────── */
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
    style={{ background: BG }}
  >
    <div className="w-full max-w-[1080px] text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: ACCENT }}>
        Certifications & Partners
      </p>
      <h2 className="mt-3 text-[clamp(1.5rem,2.5vw,2.25rem)] font-semibold tracking-tight" style={{ color: INK }}>
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
            <img
              src={c.src}
              alt={c.name}
              className="max-w-full max-h-full object-contain"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ───────── Pricing (Free / Custom) + single CTA "Create One" ───────── */
const PricingCTA: React.FC = () => (
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
          onClick={requestCreateAccount}
          className="h-14 px-10 rounded-full text-[15px] font-semibold text-white transition-transform hover:scale-[1.03]"
          style={{
            background: ACCENT,
            boxShadow: `0 20px 40px -12px ${ACCENT}80`,
          }}
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
      className="flex-1 w-full h-[100dvh] overflow-y-auto overflow-x-hidden snap-y snap-mandatory scroll-smooth relative"
      style={{ background: BG, scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`.fb-scroll::-webkit-scrollbar{display:none}`}</style>

      {/* Top nav — minimal */}
      <nav className="fixed top-0 right-0 w-full lg:w-[calc(100%-clamp(360px,35vw,520px))] z-50 flex items-center justify-between px-8 py-5 pointer-events-none">
        <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-8 text-[13px] font-medium pointer-events-auto" style={{ color: INK }}>
          <button onClick={() => scrollToId("discovery")} className="hover:opacity-70 transition-opacity">Discover</button>
          <button onClick={() => scrollToId("certifications")} className="hover:opacity-70 transition-opacity">Certifications</button>
          <button onClick={() => scrollToId("pricing")} className="hover:opacity-70 transition-opacity">Access</button>
        </div>

        <button
          type="button"
          onClick={requestCreateAccount}
          className="pointer-events-auto ml-auto px-6 py-2.5 text-white text-xs font-bold uppercase tracking-wider rounded-full transition-all"
          style={{ background: ACCENT, boxShadow: `0 8px 20px -8px ${ACCENT}80` }}
        >
          Create One
        </button>
      </nav>

      <Hero onScroll={scrollToNext} />
      <Discovery />
      <Certifications />
      <PricingCTA />
    </div>
  );
};

export default FloatingBentoPanel;