import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ArrowUpRight, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Pagina intermedia post-login ("Welcome"): la via di mezzo.
 * Impianto editoriale "software" (tipografia, sezioni, espandibili) con
 * dentro le grafiche VERE del Company Profile FGB 31.07.26, ritagliate
 * pulite e contestualizzate (public/landing/profile/*.webp): i tre cerchi
 * dell'identita', la ruota delle certificazioni, il laptop/tablet della
 * piattaforma, l'hardware Clair e Greeny.
 * Le parti lunghe (records, piattaforma) restano wrappate in espandibili
 * chiusi di default per non allungare la strada verso la dashboard.
 */

const INK = "#3f4649";
const SUB = "#7c8285";
const TEAL = "#009193";
const TEAL_DARK = "#016368";
const PAPER = "#f3f4f2";
const EASE = "cubic-bezier(.22,.8,.32,1)";

const CITIES = [
  "Amsterdam", "Doha", "Dubai", "Ho Chi Minh", "Loano", "London", "Los Angeles",
  "Miami", "Milan", "Monte Carlo", "New York", "Paris", "Rome", "Shanghai",
  "Singapore", "St. Moritz", "Taichung", "Tokyo", "Torino", "Toronto",
];

const RECORDS: { title: string; detail: string }[] = [
  { title: "World's first Platinum luxury warehouse", detail: "LEED v3 BD+C: Warehouse — Kering, Sant'Antonino, Switzerland" },
  { title: "World's largest Platinum luxury warehouse", detail: "LEED v4 BD+C: Warehouse — Kering, Trecate, Italy" },
  { title: "World's first retail WELL", detail: "Salmoiraghi e Viganò — Cascina Merlata, Milan, Italy" },
  { title: "World's largest existing retail portfolio", detail: "WELL at Scale, WELL v2 — EssilorLuxottica, worldwide" },
  { title: "World's largest existing retail submission", detail: "LEED v4 O+M: Retail — Prada, worldwide" },
  { title: "World's first LEED v4.1 O+M retail", detail: "LEED v4 O+M: Interiors — Prada Alexandra House, Hong Kong" },
  { title: "UK's first LEED v4 Platinum", detail: "LEED v4 ID+C: Retail — Alexander McQueen, London Old Bond Street" },
  { title: "Europe's first LEED for Cities", detail: "LEED for Cities — Savona, Italy" },
  { title: "World's first railway station", detail: "LEED v4 BD+C: Transit Stations — Frosinone, Italy" },
  { title: "Europe's first & world's second government", detail: "WELL Health & Safety Rating — Ferrovie dello Stato Italiane" },
  { title: "First Italian in food & beverage", detail: "WELL Health & Safety Rating — Lavazza Group, Italy" },
];

const IDENTITY_CIRCLES = [
  { src: "/landing/profile/circle-climate.webp", label: "Combating climate change" },
  { src: "/landing/profile/circle-sustain.webp", label: "Promoting sustainability" },
  { src: "/landing/profile/circle-well.webp", label: "Enhancing well-being" },
];

const Eyebrow: React.FC<{ children: React.ReactNode; light?: boolean }> = ({ children, light }) => (
  <p
    className="font-semibold uppercase"
    style={{ fontSize: 11, letterSpacing: "0.3em", color: light ? "#9fd5d9" : TEAL_DARK }}
  >
    {children}
  </p>
);

interface Props {
  onComplete: () => void;
}

const PostLoginOnboarding: React.FC<Props> = ({ onComplete }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const { user } = useAuth();

  const firstName =
    (user as any)?.user_metadata?.first_name ||
    (user as any)?.user_metadata?.full_name?.split(" ")?.[0] ||
    user?.email?.split("@")?.[0] ||
    "there";

  useEffect(() => {
    const sc = scroller.current!;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { root: sc, threshold: 0.15 },
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

  const scrollDown = () =>
    scroller.current?.scrollBy({ top: window.innerHeight, behavior: "smooth" });

  return (
    <div
      ref={scroller}
      className="fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden"
      style={{ background: PAPER, fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif", color: INK }}
    >
      <style>{`
        .fgbw-reveal{opacity:0;transform:translateY(34px) scale(.99);transition:opacity .85s ease,transform .85s ${EASE}}
        .fgbw-reveal.in{opacity:1;transform:none}
        .fgbw-city{transition:color .3s ease}
        .fgbw-city:hover{color:${TEAL}}
        .fgbw-photo{transition:transform .6s ${EASE}}
        .fgbw-photo:hover{transform:scale(1.03)}
        @media (prefers-reduced-motion: reduce){.fgbw-reveal{transition:none;opacity:1;transform:none}}
      `}</style>

      {/* ══ 1. WELCOME ══ */}
      <section className="min-h-[100dvh] flex flex-col items-center justify-center text-center px-6 relative">
        <div className="fgbw-reveal in">
          <Eyebrow>Hello {firstName}</Eyebrow>
          <h1
            className="font-semibold tracking-tight"
            style={{ fontSize: "clamp(44px,7.5vw,104px)", color: INK, marginTop: 18, lineHeight: 1.04 }}
          >
            Welcome to <span style={{ color: TEAL }}>FGB</span>.
          </h1>
          <p style={{ fontSize: "clamp(16px,1.8vw,24px)", color: SUB, marginTop: 22 }}>
            Your path to sustainability excellence
          </p>
        </div>
        <button
          onClick={scrollDown}
          className="absolute bottom-8 flex flex-col items-center gap-1"
          style={{ color: SUB }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Scroll</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </button>
      </section>

      {/* ══ 2a. CHI SIAMO (testo + i tre cerchi del profile) ══ */}
      <section className="px-6 py-20">
        <div className="max-w-[980px] mx-auto">
          <div className="fgbw-reveal">
            <Eyebrow>Who we are</Eyebrow>
            <p style={{ fontSize: "clamp(22px,2.7vw,36px)", lineHeight: 1.35, marginTop: 26, fontWeight: 500 }}>
              FGB is an international <span style={{ color: TEAL }}>advisory firm</span> that assists
              organizations in achieving their ambitious goals related to climate change,
              sustainability and well-being.
            </p>
          </div>
          <div className="fgbw-reveal grid gap-6 sm:grid-cols-3" style={{ marginTop: 44 }}>
            {IDENTITY_CIRCLES.map((c) => (
              <figure key={c.label} className="flex flex-col items-center text-center">
                <div className="fgbw-photo rounded-full overflow-hidden" style={{ width: "min(210px,58vw)", aspectRatio: "1" }}>
                  <img src={c.src} alt="" className="w-full h-full object-cover" />
                </div>
                <figcaption className="font-semibold" style={{ fontSize: 15, marginTop: 14, color: INK }}>
                  {c.label}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="fgbw-reveal" style={{ fontSize: "clamp(14px,1.4vw,18px)", lineHeight: 1.7, marginTop: 40, color: SUB, maxWidth: 760 }}>
            Thanks to a team of global specialists, FGB sets up and supervises projects with the
            same high quality all over the world — providing advanced carbon footprint (LCA/EPD)
            and energy simulations, and serving as a leading authority for certifications.
          </p>
        </div>
      </section>

      {/* ══ 2b. LA SCALA GLOBALE ══ */}
      <section className="px-6 py-20" style={{ background: "#ffffff" }}>
        <div className="max-w-[1080px] mx-auto w-full">
          <div className="fgbw-reveal">
            <Eyebrow>Global scale</Eyebrow>
            <div className="flex flex-wrap gap-x-14 gap-y-8" style={{ marginTop: 34 }}>
              {[
                { n: "60+", l: "countries" },
                { n: "6.000", l: "projects" },
                { n: "300", l: "clients" },
                { n: "20", l: "strategic locations" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-semibold tabular-nums" style={{ fontSize: "clamp(40px,5vw,72px)", color: INK, lineHeight: 1 }}>
                    {s.n}
                  </div>
                  <div className="uppercase" style={{ fontSize: 12, letterSpacing: "0.25em", color: SUB, marginTop: 8 }}>
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* pattern tipografico delle sedi: niente mappa */}
          <div className="fgbw-reveal" style={{ marginTop: 60 }}>
            <div
              className="flex flex-wrap items-baseline"
              style={{ gap: "14px clamp(18px,2.6vw,34px)", maxWidth: 980 }}
            >
              {CITIES.map((c, i) => {
                const hot = ["London", "Shanghai", "Los Angeles", "Dubai", "Monte Carlo", "Milan"].includes(c);
                return (
                  <React.Fragment key={c}>
                    <span
                      className="fgbw-city font-semibold uppercase whitespace-nowrap"
                      style={{
                        fontSize: hot ? "clamp(20px,2.4vw,34px)" : "clamp(14px,1.6vw,22px)",
                        letterSpacing: "0.12em",
                        color: hot ? TEAL_DARK : "#b3bab8",
                      }}
                    >
                      {c}
                    </span>
                    {i < CITIES.length - 1 && (
                      <span aria-hidden style={{ color: "#d8dcd9", fontSize: 14 }}>✦</span>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <p style={{ fontSize: 14, color: SUB, marginTop: 28 }}>
              From London to Shanghai, from Los Angeles to Dubai — one standard of quality.
            </p>
          </div>

          {/* timeline compatta */}
          <div className="fgbw-reveal flex flex-wrap items-center" style={{ gap: "10px clamp(18px,3vw,40px)", marginTop: 54 }}>
            {[
              { y: "2015", l: "Francesca Galati Bolognesi founds FGB" },
              { y: "2019", l: "20 locations in the world" },
              { y: "2026", l: "FGB Monitoring System launched" },
            ].map((s, i) => (
              <React.Fragment key={s.y}>
                {i > 0 && <span aria-hidden style={{ color: "#c9cecb" }}>→</span>}
                <div className="flex items-baseline gap-3">
                  <span className="font-semibold tabular-nums" style={{ color: TEAL, fontSize: 22 }}>{s.y}</span>
                  <span style={{ fontSize: 13, color: SUB }}>{s.l}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 3. SETTING GLOBAL STANDARDS (compresso) ══ */}
      <section className="px-6 py-24" style={{ background: PAPER }}>
        <div className="max-w-[1080px] mx-auto fgbw-reveal">
          <Eyebrow>Setting global standards</Eyebrow>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4" style={{ marginTop: 26 }}>
            <div className="font-semibold" style={{ fontSize: "clamp(72px,10vw,140px)", color: TEAL, lineHeight: 0.9 }}>
              11
            </div>
            <div style={{ paddingBottom: 10 }}>
              <div className="font-semibold" style={{ fontSize: "clamp(22px,2.6vw,34px)", color: INK }}>
                world records
              </div>
              <p style={{ fontSize: 15, color: SUB, marginTop: 4, maxWidth: 460 }}>
                Firsts and largests that redefined what certified buildings can be.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setRecordsOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full font-semibold uppercase"
            style={{
              marginTop: 30,
              padding: "13px 30px",
              fontSize: 12,
              letterSpacing: "0.18em",
              color: recordsOpen ? "#fff" : TEAL_DARK,
              background: recordsOpen ? TEAL_DARK : "transparent",
              border: `1.5px solid ${TEAL_DARK}`,
              transition: `all .35s ${EASE}`,
            }}
          >
            View our records
            <ChevronDown
              className="w-4 h-4"
              style={{ transform: recordsOpen ? "rotate(180deg)" : "none", transition: `transform .35s ${EASE}` }}
            />
          </button>

          <div
            style={{
              display: "grid",
              gridTemplateRows: recordsOpen ? "1fr" : "0fr",
              transition: `grid-template-rows .6s ${EASE}`,
            }}
          >
            <div style={{ overflow: "hidden" }}>
              <div
                className="grid gap-x-10 gap-y-6"
                style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", paddingTop: 38 }}
              >
                {RECORDS.map((r, i) => (
                  <div key={r.title} style={{ borderTop: "1px solid #dfe3e0", paddingTop: 14 }}>
                    <div className="flex items-baseline gap-3">
                      <span className="tabular-nums font-semibold" style={{ color: TEAL, fontSize: 13 }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <div className="font-semibold" style={{ fontSize: 16, color: INK, lineHeight: 1.3 }}>
                          {r.title}
                        </div>
                        <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>{r.detail}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 4a. L'ECOSISTEMA: piattaforma (laptop del profile) + hardware ══ */}
      <section className="px-6 py-24" style={{ background: "#ffffff" }}>
        <div className="max-w-[1080px] mx-auto">
          <div className="fgbw-reveal">
            <Eyebrow>FGB Monitoring System — launched 2026</Eyebrow>
            <h2 className="font-semibold tracking-tight" style={{ fontSize: "clamp(28px,3.6vw,48px)", marginTop: 18, maxWidth: 760 }}>
              Advisory, evolved into <span style={{ color: TEAL }}>real-time data</span>.
            </h2>
            <p style={{ fontSize: "clamp(15px,1.5vw,19px)", color: SUB, marginTop: 16, maxWidth: 640, lineHeight: 1.7 }}>
              View energy consumption and indoor air quality data in a flexible, dynamic way —
              on proprietary hardware, designed by FGB.
            </p>
          </div>

          {/* il laptop del profile, contestualizzato */}
          <div className="fgbw-reveal" style={{ marginTop: 44, textAlign: "center" }}>
            <img
              src="/landing/profile/laptop.webp"
              alt="FGB Monitoring System — Your Sustainable Space dashboard"
              loading="lazy"
              className="inline-block w-full"
              style={{ maxWidth: 780 }}
            />
          </div>

          {/* schermate extra ripiegate */}
          <div className="fgbw-reveal" style={{ textAlign: "center", marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setPlatformOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full font-semibold uppercase"
              style={{
                padding: "13px 30px",
                fontSize: 12,
                letterSpacing: "0.18em",
                color: platformOpen ? "#fff" : TEAL_DARK,
                background: platformOpen ? TEAL_DARK : "transparent",
                border: `1.5px solid ${TEAL_DARK}`,
                transition: `all .35s ${EASE}`,
              }}
            >
              Discover the platform
              <ChevronDown
                className="w-4 h-4"
                style={{ transform: platformOpen ? "rotate(180deg)" : "none", transition: `transform .35s ${EASE}` }}
              />
            </button>
            <div
              style={{
                display: "grid",
                gridTemplateRows: platformOpen ? "1fr" : "0fr",
                transition: `grid-template-rows .6s ${EASE}`,
              }}
            >
              <div style={{ overflow: "hidden" }}>
                <div className="grid gap-8 md:grid-cols-2 items-center" style={{ paddingTop: 34, textAlign: "left" }}>
                  <div>
                    <div className="font-semibold" style={{ fontSize: 20, color: INK }}>Create your own report</div>
                    <p style={{ fontSize: 14, color: SUB, marginTop: 6 }}>
                      Actual vs average, device consumption, power breakdown — ready to share.
                    </p>
                    <img src="/landing/profile/report.webp" alt="Report widgets" loading="lazy" className="w-full" style={{ marginTop: 14 }} />
                  </div>
                  <div>
                    <div className="font-semibold" style={{ fontSize: 20, color: INK }}>Check your metrics</div>
                    <p style={{ fontSize: 14, color: SUB, marginTop: 6 }}>
                      Air quality index and core metrics, on any device.
                    </p>
                    <img src="/landing/profile/tablet.webp" alt="Metrics on tablet and phone" loading="lazy" className="w-full" style={{ marginTop: 14 }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* hardware proprietario */}
          <div className="grid gap-8 md:grid-cols-2" style={{ marginTop: 54 }}>
            {[
              {
                img: "/landing/clair.webp",
                name: "Clair",
                claim: "For indoor air quality control",
                points: ["Wellness boost", "Healthy workplace", "Positive environment"],
              },
              {
                img: "/landing/greeny.webp",
                name: "Greeny",
                claim: "For energy efficiency",
                points: ["Improve operations", "Find inefficiency", "Control your portfolio"],
              },
            ].map((h) => (
              <div
                key={h.name}
                className="fgbw-reveal rounded-3xl overflow-hidden"
                style={{ background: PAPER, border: "1px solid #e4e7e4" }}
              >
                <div className="flex items-center justify-center" style={{ height: 260, background: "#fff" }}>
                  <img src={h.img} alt={h.name} className="fgbw-photo" style={{ maxHeight: 230, maxWidth: "80%", objectFit: "contain" }} />
                </div>
                <div style={{ padding: "26px 30px 30px" }}>
                  <div className="font-semibold" style={{ fontSize: 26, color: TEAL_DARK }}>{h.name}</div>
                  <div style={{ fontSize: 15, color: INK, marginTop: 2 }}>{h.claim}</div>
                  <ul style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                    {h.points.map((p) => (
                      <li key={p} className="flex items-center gap-2" style={{ fontSize: 14, color: SUB }}>
                        <span aria-hidden style={{ color: TEAL, fontSize: 12 }}>✦</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 4b. I TRE PILASTRI ══ */}
      <section className="px-6 py-24" style={{ background: "#25655f" }}>
        <div className="max-w-[1080px] mx-auto">
          <div className="fgbw-reveal">
            <Eyebrow light>Monitoring</Eyebrow>
          </div>
          <div className="grid gap-6 md:grid-cols-3" style={{ marginTop: 34 }}>
            {[
              { t: "AIR", b: "Every breath, measured.", d: "CO₂, humidity and particles — where your people actually work.", img: "/landing/dandelion.webp", bg: "#4f9e98" },
              { t: "ENERGY", b: "Every kWh, accounted for.", d: "Consumption, load and cost — hour by hour, not once a quarter.", img: "/landing/bulb.webp", bg: "#8fdcd4" },
              { t: "WATER", b: "Every drop, tracked.", d: "Flow, leaks and waste — spotted live, before they hit the bill.", img: "/landing/drop.webp", bg: "#4f9e98" },
            ].map((p, i) => (
              <div
                key={p.t}
                className="fgbw-reveal flex flex-col items-center text-center text-white rounded-2xl"
                style={{ background: p.bg, padding: "42px 26px", transitionDelay: `${i * 0.12}s` }}
              >
                <h3 className="font-semibold" style={{ fontSize: 28, letterSpacing: 2 }}>{p.t}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 12, maxWidth: 250 }}>
                  <b className="block font-semibold">{p.b}</b>
                  {p.d}
                </p>
                <div className="rounded-full overflow-hidden" style={{ width: 150, height: 150, marginTop: 24 }}>
                  <img src={p.img} alt="" className="w-full h-full object-cover" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 5. CERTIFICAZIONI: la ruota del profile ══ */}
      <section className="px-6 py-24" style={{ background: PAPER }}>
        <div className="max-w-[1080px] mx-auto grid gap-10 md:grid-cols-2 items-center">
          <div className="fgbw-reveal">
            <Eyebrow>Leading authority for certifications</Eyebrow>
            <h2 className="font-semibold tracking-tight" style={{ fontSize: "clamp(26px,3.2vw,42px)", marginTop: 16 }}>
              Our data creates your <span style={{ color: TEAL }}>compliance</span>.
            </h2>
            <p style={{ fontSize: 15, color: SUB, marginTop: 14, lineHeight: 1.7, maxWidth: 460 }}>
              LEED, WELL, BREEAM, GRESB, Fitwel, ESG, EU Taxonomy, Envision, LCA, LIFE —
              one data flow feeding every framework.
            </p>
          </div>
          <div className="fgbw-reveal flex justify-center">
            <img
              src="/landing/profile/wheel.webp"
              alt="FGB certifications wheel"
              loading="lazy"
              className="fgbw-photo w-full"
              style={{ maxWidth: 440 }}
            />
          </div>
        </div>
      </section>

      {/* ══ 6. JOIN FGB WORLD ══ */}
      <section
        className="min-h-[92dvh] flex flex-col items-center justify-center text-center px-6"
        style={{ background: "#0d2530" }}
      >
        <div className="fgbw-reveal">
          <Eyebrow light>The choice is yours</Eyebrow>
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
