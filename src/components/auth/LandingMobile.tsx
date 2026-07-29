import React from "react";
import { Droplet, Wind, Zap } from "lucide-react";
import Globe3D from "./Globe3D";
import { COMPANY_STATS } from "@/lib/companyStats";

/**
 * LandingMobile — presentazione della landing per schermi < 768px.
 *
 * Gemella di FloatingBentoPanel (desktop): stessi contenuti e stesse azioni
 * (fgb:open-login / fgb:create-account passano dal genitore), presentazione
 * diversa. Implementa il mockup "Landing mobile — proposta FGB" v3 approvato:
 * fondo teal, tre schermate a snap pieno (Hero / Certifications / Monitoring)
 * e barra CTA persistente in basso. La schermata "Access" del desktop non
 * compare su mobile: la frase sul rapporto uno-a-uno vive dentro il form di
 * richiesta accesso.
 */

const SCREEN_BG = "linear-gradient(172deg,#013b40,#016368 70%,#02777c)";

/* Stesso elenco del desktop, ordine alfabetico. */
const CERTIFICATIONS = [
  { name: "BREEAM", src: "/breeam_logo.webp" },
  { name: "Envision", src: "/envision.webp" },
  { name: "ESG", src: "/Logo_ESG.png" },
  { name: "Fitwel", src: "/fitwel_logo.webp" },
  { name: "GRESB", src: "/logo_gresb.webp" },
  { name: "LEED", src: "/leed_logo.webp" },
  { name: "LIFE", src: "/life_logo.webp" },
  { name: "WELL", src: "/well_logo.webp" },
];

/* Ordine alfabetico, coerente con desktop e con la vista mobile dei moduli. */
const MODULES = [
  {
    title: "AIR",
    caption: "Every breath, measured.",
    body: "CO₂, humidity and particles — where your people actually work.",
    Icon: Wind,
  },
  {
    title: "ENERGY",
    caption: "Every kWh, accounted for.",
    body: "Consumption, load and cost — hour by hour, not once a quarter.",
    Icon: Zap,
  },
  {
    title: "WATER",
    caption: "Every drop, tracked.",
    body: "Flow, leaks and waste — spotted live, before they hit the bill.",
    Icon: Droplet,
  },
];

/** Sezione a schermo pieno: il padding basso lascia respirare la barra CTA. */
const Section: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section
    className="h-full w-full shrink-0 flex flex-col items-center text-center px-5 pt-[18px] pb-24"
    style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
  >
    {children}
  </section>
);

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-7 text-[9px] font-bold uppercase tracking-[0.3em] opacity-75">{children}</p>
);

const LandingMobile: React.FC<{
  onSignIn: () => void;
  onCreate: () => void;
  blurGlobe: boolean;
}> = ({ onSignIn, onCreate, blurGlobe }) => (
  <div className="relative h-[100dvh] w-full overflow-hidden text-white" style={{ background: SCREEN_BG }}>
    <div
      className="h-full w-full overflow-y-auto overflow-x-hidden scroll-smooth no-scrollbar"
      style={{ scrollSnapType: "y mandatory" }}
    >
      {/* 1 · HERO */}
      <Section>
        <img
          src="/whiteLogoPayoff.png"
          alt="FGB — Future Green Building"
          className="mt-5 h-[92px] object-contain drop-shadow-[0_3px_14px_rgba(0,0,0,0.3)]"
        />

        {/* Globo centrato con la lince davanti: le zampe agganciano il bordo,
            la testa sporge oltre la scena (overflow visibile di proposito). */}
        <div
          className="relative my-auto mb-1.5 h-[195px] w-[335px] transition-[filter] duration-500"
          style={{ filter: blurGlobe ? "blur(14px) saturate(0.9)" : "none" }}
        >
          <div className="absolute left-[78px] top-[9px] h-[180px] w-[180px] drop-shadow-[0_14px_30px_rgba(0,20,24,0.35)]">
            <Globe3D size={180} />
          </div>
          <img
            src="/lince_peek.png"
            alt=""
            aria-hidden
            className="pointer-events-none absolute left-px top-[-8px] z-[2] w-[384px] max-w-none drop-shadow-[0_8px_18px_rgba(0,20,24,0.3)]"
          />
        </div>

        <div className="flex justify-center">
          {COMPANY_STATS.map((s, i) => (
            <div
              key={s.label}
              className={`px-[15px] ${i > 0 ? "border-l border-white/25" : ""}`}
            >
              <div className="text-[21px] font-bold leading-[1.1]">{s.value}</div>
              <div className="text-[7.5px] font-bold uppercase tracking-[0.18em] opacity-70">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[15px] font-semibold">Precisely measured. Globally connected.</p>

        <div className="mt-auto pt-2 text-[9px] tracking-[0.24em] opacity-60">
          SCROLL
          <span className="block animate-bounce text-[13px] motion-reduce:animate-none">▾</span>
        </div>
      </Section>

      {/* 2 · CERTIFICATIONS & PARTNERS */}
      <Section>
        <Eyebrow>Certifications &amp; Partners</Eyebrow>
        <h2 className="mt-2 text-[22px] font-bold leading-[1.28]">
          Your path to
          <br />
          sustainability excellence.
        </h2>
        <div className="my-auto grid w-full max-w-[250px] grid-cols-2 gap-2.5">
          {CERTIFICATIONS.map((c) => (
            <div
              key={c.name}
              className="flex aspect-[1.35] items-center justify-center rounded-[14px] bg-white p-2.5 shadow-[0_6px_16px_rgba(0,20,24,0.22)]"
            >
              <img src={c.src} alt={c.name} loading="lazy" className="max-h-full max-w-full object-contain" />
            </div>
          ))}
        </div>
      </Section>

      {/* 3 · MONITORING */}
      <Section>
        <Eyebrow>Monitoring</Eyebrow>
        <h2 className="mt-2 text-[22px] font-bold leading-[1.28]">
          One platform.
          <br />
          Every flow of your building.
        </h2>
        <div className="my-auto grid w-full max-w-[278px] gap-[11px]">
          {MODULES.map(({ title, caption, body, Icon }) => (
            <div
              key={title}
              className="flex items-center gap-[13px] rounded-[18px] border border-white/20 bg-white/10 px-4 py-[15px] text-left backdrop-blur-md"
            >
              <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-white/60">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <span>
                <b className="block text-[13.5px] tracking-[0.16em]">{title}</b>
                <i className="my-[3px] block text-[13px] font-semibold not-italic">{caption}</i>
                <small className="block text-[10.5px] leading-[1.4] opacity-70">{body}</small>
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>

    {/* Barra CTA persistente sopra ogni schermata. */}
    <div
      className="absolute inset-x-0 bottom-0 z-[6] flex gap-2.5 px-4 pt-3"
      style={{
        background: "linear-gradient(transparent, rgba(1,59,64,0.9) 40%)",
        paddingBottom: "calc(18px + env(safe-area-inset-bottom))",
      }}
    >
      <button
        type="button"
        onClick={onSignIn}
        className="flex-1 rounded-full bg-white py-[14px] text-[11.5px] font-bold tracking-[0.12em] transition-transform active:scale-95"
        style={{ color: "#016368" }}
      >
        SIGN IN
      </button>
      <button
        type="button"
        onClick={onCreate}
        className="flex-1 rounded-full border-[1.5px] border-white/55 bg-white/10 py-[14px] text-[11.5px] font-bold tracking-[0.12em] backdrop-blur-md transition-transform active:scale-95"
      >
        CREATE ONE
      </button>
    </div>
  </div>
);

export default LandingMobile;
