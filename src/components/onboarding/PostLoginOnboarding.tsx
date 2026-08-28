import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ArrowUpRight, ArrowRight } from "lucide-react";

/**
 * Pagina intermedia post-login ("Welcome"): replica fedele del Company
 * Profile FGB 31.07.26. Le grafiche originali del PDF sono importate come
 * immagini (public/landing/profile/*.webp, ritagliate dal documento) e
 * scorrono in una colonna continua; le parti lunghe — gli 11 world
 * records, le schermate della piattaforma, filantropia e community —
 * sono wrappate in espandibili chiusi di default, cosi' il percorso
 * verso la dashboard resta corto.
 * Chiusura: "Join FGB World" con il bivio ADVISORY (sito corporate) /
 * MONITORING (entra nella piattaforma).
 */

const TEAL = "#009193";
const TEAL_DARK = "#016368";
const PAPER = "#f3f4f2";
const EASE = "cubic-bezier(.22,.8,.32,1)";

const P = "/landing/profile";

/** Immagine del profile, con reveal morbido */
const Strip: React.FC<{ src: string; alt: string }> = ({ src, alt }) => (
  <img src={`${P}/${src}`} alt={alt} loading="lazy" className="fgbw-reveal block w-full" />
);

/** Espandibile: bottone pill + contenuto ripiegato (grid-template-rows) */
const Expander: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="fgbw-reveal" style={{ padding: "26px 0", textAlign: "center" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full font-semibold uppercase"
        style={{
          padding: "14px 34px",
          fontSize: 12,
          letterSpacing: "0.2em",
          color: open ? "#fff" : TEAL_DARK,
          background: open ? TEAL_DARK : "#fff",
          border: `1.5px solid ${TEAL_DARK}`,
          boxShadow: open ? "none" : "0 10px 28px -12px rgba(1,99,104,.35)",
          transition: `all .35s ${EASE}`,
        }}
      >
        {label}
        <ChevronDown
          className="w-4 h-4"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: `transform .35s ${EASE}` }}
        />
      </button>
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: `grid-template-rows .65s ${EASE}`,
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div style={{ paddingTop: 26 }}>{children}</div>
        </div>
      </div>
    </div>
  );
};

interface Props {
  onComplete: () => void;
}

const PostLoginOnboarding: React.FC<Props> = ({ onComplete }) => {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sc = scroller.current!;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { root: sc, threshold: 0.06 },
    );
    sc.querySelectorAll(".fgbw-reveal").forEach((el) => io.observe(el));

    /* Debug SOLO DEV: ?wp=NNN scrolla il container (screenshot automatici) */
    let t: ReturnType<typeof setTimeout> | undefined;
    if (import.meta.env.DEV) {
      const m = window.location.href.match(/[?&]wp=(\d+)/);
      if (m)
        t = setTimeout(() => {
          sc.querySelectorAll(".fgbw-reveal").forEach((el) => el.classList.add("in"));
          sc.scrollTo(0, Number(m[1]));
        }, 900);
    }
    return () => {
      io.disconnect();
      if (t) clearTimeout(t);
    };
  }, []);

  return (
    <div
      ref={scroller}
      className="fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden"
      style={{ background: PAPER, fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}
    >
      <style>{`
        .fgbw-reveal{opacity:0;transform:translateY(30px) scale(.985);transition:opacity .8s ease,transform .8s ${EASE}}
        .fgbw-reveal.in{opacity:1;transform:none}
        @media (prefers-reduced-motion: reduce){.fgbw-reveal{transition:none;opacity:1;transform:none}}
      `}</style>

      {/* Colonna-poster: il PDF, sezione per sezione */}
      <div className="mx-auto" style={{ maxWidth: "min(1040px, 100vw)" }}>
        {/* 1. Intro istituzionale (logo, tre cerchi, LCA/EPD) */}
        <Strip src="intro.webp" alt="FGB — international advisory firm: climate change, sustainability, well-being" />
        {/* 2. La ruota delle certificazioni */}
        <Strip src="wheel.webp" alt="FGB certifications wheel: WELL, BREEAM, Envision, ESG, LEED, GRESB, Fitwel, EU Taxonomy, LCA, LIFE LVMH" />
        {/* 3. Mappa: sedi e progetti nel mondo */}
        <Strip src="map.webp" alt="FGB offices and projects worldwide — from Amsterdam to Toronto" />
        {/* 4. Our Strenght: 50 / 60 / 11 / 300 / 6.000 */}
        <Strip src="strength.webp" alt="Our strength: 50 employees, 60 countries, 11 world records, 300 clients, 6.000 projects" />

        {/* 5. Gli 11 world records, ripiegati */}
        <Expander label="View our 11 world records">
          <Strip src="records1.webp" alt="World records: first Platinum luxury warehouse (Kering), Europe's first LEED for Cities (Savona), first railway station, Lavazza, largest Platinum warehouse (Kering Trecate)" />
          <Strip src="records2.webp" alt="World records: Ferrovie dello Stato, Alexander McQueen London, Prada Hong Kong, first retail WELL (Salmoiraghi e Vigano'), Prada worldwide, EssilorLuxottica portfolio" />
        </Expander>

        {/* 6. Timeline 2015 - 2019 - 2026 e visione */}
        <Strip src="timeline.webp" alt="FGB timeline: founded 2015, 20 locations in 2019, FGB Monitoring System launched 2026" />

        {/* 7. La piattaforma (software), ripiegata */}
        <Expander label="Discover the platform">
          <Strip src="software1.webp" alt="FGB Monitoring System: our own software, implemented in FGB projects" />
          <Strip src="software2.webp" alt="Create your own report, check your metrics: energy and indoor air quality in a flexible, dynamic way" />
        </Expander>

        {/* 8. Hardware proprietario: Clair, Greeny, ESG compliant */}
        <Strip src="hardware.webp" alt="FGB hardware: Clair for indoor air quality control, Greeny for energy efficiency — ESG compliant" />

        {/* 9. Filantropia e community, ripiegate */}
        <Expander label="Beyond buildings">
          <Strip src="beyond1.webp" alt="For FGB, philanthropy means uniting beauty and responsibility: inclusion and diversity, education and mentorship, art and architecture" />
          <Strip src="beyond2.webp" alt="The FGB community and cultural partners" />
        </Expander>

        {/* 10. Together */}
        <Strip src="together.webp" alt="Together we shape the spaces of the future" />
      </div>

      {/* ══ JOIN FGB WORLD ══ */}
      <section
        className="min-h-[88dvh] flex flex-col items-center justify-center text-center px-6"
        style={{ background: "#0d2530" }}
      >
        <div className="fgbw-reveal">
          <p className="font-semibold uppercase" style={{ fontSize: 11, letterSpacing: "0.3em", color: "#9fd5d9" }}>
            The choice is yours
          </p>
          <h2 className="font-semibold tracking-tight text-white" style={{ fontSize: "clamp(36px,5.5vw,72px)", marginTop: 18 }}>
            Join <span style={{ color: "#7ad8d2" }}>FGB World</span>
          </h2>

          <div className="flex flex-wrap justify-center" style={{ gap: 22, marginTop: 54 }}>
            <a
              href="https://www.fgb-studio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center justify-center rounded-3xl"
              style={{
                width: "min(300px,80vw)",
                padding: "34px 20px",
                border: "1.5px solid rgba(159,213,217,0.45)",
                color: "#e8ecec",
                transition: `all .35s ${EASE}`,
                textDecoration: "none",
              }}
            >
              <span className="font-semibold uppercase inline-flex items-center gap-2" style={{ fontSize: 22, letterSpacing: "0.12em" }}>
                Advisory <ArrowUpRight className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </span>
              <span className="uppercase" style={{ fontSize: 11, letterSpacing: "0.25em", color: "#9fb4b4", marginTop: 10 }}>
                Certifications
              </span>
            </a>

            <button
              type="button"
              onClick={onComplete}
              className="group flex flex-col items-center justify-center rounded-3xl"
              style={{
                width: "min(300px,80vw)",
                padding: "34px 20px",
                background: TEAL,
                color: "#fff",
                boxShadow: "0 24px 60px -18px rgba(0,145,147,.55)",
                transition: `all .35s ${EASE}`,
              }}
            >
              <span className="font-semibold uppercase inline-flex items-center gap-2" style={{ fontSize: 22, letterSpacing: "0.12em" }}>
                Monitoring <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </span>
              <span className="uppercase" style={{ fontSize: 11, letterSpacing: "0.25em", color: "#d3f1ef", marginTop: 10 }}>
                Energy · Air
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default PostLoginOnboarding;
