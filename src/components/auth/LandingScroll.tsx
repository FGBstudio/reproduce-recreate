import React, { useEffect, useRef } from "react";

/**
 * Landing desktop "scroll-telling" (design dal PDF SITO MONITORAGGIO 2026):
 *
 *  1. Hero: mondo grande in basso a destra, "Precisely measured / Globally
 *     connected", cielo stellato.
 *  2. Primo scroll: la Terra si rimpicciolisce e si sposta a destra intera;
 *     il titolo svanisce, entrano i numeri (60 / 6.000 / 300) contando.
 *  3. Secondo scroll: zoom dentro il marker di Monte-Carlo; il suo bianco
 *     invade la pagina e si atterra sulle certificazioni.
 *  4. Monitoring: sfondo verde, ARIA scende dall'alto, ENERGIA sale dal
 *     basso, ACQUA scende dall'alto.
 *  5. Free/Custom: card in bianco e nero che si colorano al passaggio.
 *
 * Tutto e' guidato dalla posizione di scroll (reversibile su e giu').
 * Attivabile/disattivabile con LANDING_SCROLL in src/lib/features.ts.
 */

interface Props {
  onSignIn: () => void;
  onCreate: () => void;
}

/* Posizione (frazioni dell'immagine della Terra) del pin "utente" disegnato
   nella grafica originale (Sud America): ancora la composizione dell'hero. */
const PIN_USER = { x: 0.663, y: 0.435 };

/* Marker delle sedi, in frazioni dell'immagine. main = Monte-Carlo:
   e' il bersaglio dello zoom e l'origine del "flood" bianco. */
const MARKERS: { x: number; y: number; label: string; main?: boolean }[] = [
  { x: 0.300, y: 0.262, label: "New York" },
  { x: 0.218, y: 0.415, label: "Mexico City" },
  { x: 0.338, y: 0.368, label: "Miami" },
  { x: 0.404, y: 0.560, label: "Lima" },
  { x: 0.868, y: 0.270, label: "Monte-Carlo", main: true },
];
const PIN_ZOOM = { x: 0.868, y: 0.270 };

const CERT_LOGOS = [
  { name: "BREEAM", src: "/breeam_logo.webp" },
  { name: "ENVISION", src: "/envision.webp" },
  { name: "ESG", src: "/Logo_ESG.png" },
  { name: "Fitwel", src: "/fitwel_logo.webp" },
  { name: "GRESB", src: "/logo_gresb.webp" },
  { name: "LEED", src: "/leed_logo.webp" },
  { name: "LIFE LVMH", src: "/life_logo.webp" },
  { name: "WELL", src: "/well_logo.webp" },
];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeIO = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeIn = (t: number) => t * t * t;

function cssMix(a: string, b: string, t: number) {
  const pa = (a.match(/\w\w/g) || []).map((x) => parseInt(x, 16));
  const pb = (b.match(/\w\w/g) || []).map((x) => parseInt(x, 16));
  return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(",")})`;
}

const MarkerPin: React.FC<{ m: (typeof MARKERS)[number] }> = ({ m }) => (
  <svg
    viewBox="0 0 24 32"
    style={{
      position: "absolute",
      left: `${m.x * 100}%`,
      top: `${m.y * 100}%`,
      width: m.main ? "6.5%" : "4.2%",
      transform: "translate(-50%, -92%)",
      filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))",
    }}
  >
    <path
      d="M12 0C5.4 0 0 5.2 0 11.6 0 20.3 12 32 12 32s12-11.7 12-20.4C24 5.2 18.6 0 12 0z"
      fill="#f2f3f1"
    />
    <circle cx="12" cy="11.4" r="4.6" fill="#12323a" />
  </svg>
);

const LandingScroll: React.FC<Props> = ({ onSignIn, onCreate }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const stageA = useRef<HTMLElement>(null);
  const stickA = useRef<HTMLDivElement>(null);
  const earth = useRef<HTMLDivElement>(null);
  const headline = useRef<HTMLDivElement>(null);
  const numbers = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const signin = useRef<HTMLButtonElement>(null);
  const flood = useRef<HTMLDivElement>(null);
  const stageB = useRef<HTMLElement>(null);
  const stickB = useRef<HTMLDivElement>(null);
  const bandAir = useRef<HTMLDivElement>(null);
  const bandEnergy = useRef<HTMLDivElement>(null);
  const bandWater = useRef<HTMLDivElement>(null);
  const monTitle = useRef<HTMLDivElement>(null);
  const certsSec = useRef<HTMLElement>(null);
  const waysSec = useRef<HTMLElement>(null);

  useEffect(() => {
    const sc = scroller.current!;
    let raf: number | null = null;

    const layoutStageA = () => {
      const W = sc.clientWidth;
      const H = sc.clientHeight;
      const secA = stageA.current!;
      const total = secA.offsetHeight - H;
      const p = clamp((sc.scrollTop - secA.offsetTop) / total, 0, 1);

      /* Fasi: 0-0.30 rimpicciolimento | 0.30-0.60 numeri | 0.60-1 zoom */
      const shrink = easeIO(clamp(p / 0.3, 0, 1));
      const zoomT = clamp((p - 0.6) / 0.4, 0, 1);
      const zoom = easeIn(zoomT);

      /* Posa 1 (hero): arco in basso a destra, pin utente visibile */
      const S1 = 1.35 * H;
      const tl1 = { x: 0.8 * W - PIN_USER.x * S1, y: 0.16 * H };

      /* Posa 2 (numeri): mondo intero a destra, tutti i marker visibili */
      const S2 = Math.min(0.78 * H, 0.42 * W);
      const c2 = { x: 0.71 * W, y: 0.5 * H };
      const tl2 = { x: c2.x - S2 / 2, y: c2.y - S2 / 2 };

      let S = lerp(S1, S2, shrink);
      let tx = lerp(tl1.x, tl2.x, shrink);
      let ty = lerp(tl1.y, tl2.y, shrink);

      /* Zoom su Monte-Carlo: il mondo cresce col marker inchiodato */
      const pinScreen = { x: tx + PIN_ZOOM.x * S, y: ty + PIN_ZOOM.y * S };
      if (zoom > 0) {
        const k = 1 + 10 * zoom;
        tx = pinScreen.x - PIN_ZOOM.x * S * k;
        ty = pinScreen.y - PIN_ZOOM.y * S * k;
        S = S * k;
      }
      const e = earth.current!;
      e.style.transform = `translate3d(${tx}px,${ty}px,0)`;
      e.style.width = e.style.height = S + "px";

      stickA.current!.style.backgroundColor =
        shrink < 1 ? cssMix("#0a1c20", "#0d2530", shrink) : "#0d2530";

      const hOut = clamp(shrink / 0.55, 0, 1);
      headline.current!.style.opacity = String(1 - hOut);
      headline.current!.style.transform = `translateY(${-34 * hOut}px)`;

      /* Numeri: entrano scaglionati contando, svaniscono allo zoom */
      numbers.current!.querySelectorAll<HTMLElement>(".fgbl-num").forEach((el, i) => {
        const t = clamp((shrink - (0.35 + i * 0.12)) / 0.28, 0, 1);
        const gone = clamp(zoomT / 0.25, 0, 1);
        el.style.opacity = String(t * (1 - gone));
        el.style.transform = `translateY(${lerp(26, 0, t)}px)`;
        const b = el.querySelector("b")!;
        const target = Number(b.dataset.target);
        const v = Math.round(target * easeIO(t));
        b.textContent = b.dataset.fmt === "dot" ? v.toLocaleString("de-DE") : String(v);
      });

      const chrome = 1 - clamp(zoomT / 0.3, 0, 1);
      header.current!.style.opacity = signin.current!.style.opacity = String(chrome);
      header.current!.style.pointerEvents = signin.current!.style.pointerEvents =
        chrome > 0.3 ? "auto" : "none";

      /* Il bianco del marker invade la pagina (completa prima della fine) */
      const fl = clamp((zoomT - 0.52) / 0.34, 0, 1);
      const maxR = Math.hypot(W, H) / 40; /* il div base e' 80px */
      const f = flood.current!;
      f.style.left = pinScreen.x + "px";
      f.style.top = pinScreen.y + "px";
      f.style.transform = `translate(-50%,-50%) scale(${easeIn(fl) * maxR})`;
    };

    const layoutStageB = () => {
      const H = sc.clientHeight;
      const secB = stageB.current!;
      const total = secB.offsetHeight - H;
      const q = clamp((sc.scrollTop - secB.offsetTop) / total, 0, 1);

      stickB.current!.style.backgroundColor = cssMix(
        "#f3f4f2",
        "#25655f",
        easeIO(clamp(q / 0.2, 0, 1)),
      );

      const slide = (el: HTMLElement, from: number, start: number, dur: number) => {
        const t = easeIO(clamp((q - start) / dur, 0, 1));
        el.style.transform = `translateY(${lerp(from, 0, t)}%)`;
      };
      slide(bandAir.current!, -110, 0.06, 0.26);
      slide(bandEnergy.current!, 110, 0.38, 0.26);
      slide(bandWater.current!, -110, 0.68, 0.26);

      const mt = easeIO(clamp((q - 0.1) / 0.2, 0, 1));
      monTitle.current!.style.opacity = String(mt);
      monTitle.current!.style.transform = `translateY(${lerp(20, 0, mt)}px)`;
    };

    const frame = () => {
      raf = null;
      layoutStageA();
      layoutStageB();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    sc.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    frame();

    const io = new IntersectionObserver(
      (es) => es.forEach((en) => en.isIntersecting && en.target.classList.add("in")),
      { root: sc, threshold: 0.2 },
    );
    sc.querySelectorAll(".fgbl-reveal").forEach((el) => io.observe(el));

    return () => {
      sc.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  const scrollToRef = (ref: React.RefObject<HTMLElement>) => {
    const sc = scroller.current;
    if (sc && ref.current) sc.scrollTo({ top: ref.current.offsetTop, behavior: "smooth" });
  };

  /* Stelle: generate una volta, deterministiche abbastanza per una landing */
  const stars = useRef<string[]>();
  if (!stars.current) {
    stars.current = [0, 1].map((layer) => {
      const sh: string[] = [];
      const n = layer ? 60 : 110;
      for (let i = 0; i < n; i++) {
        const x = (Math.random() * 100).toFixed(2);
        const y = (Math.random() * 100).toFixed(2);
        const o = (0.25 + Math.random() * (layer ? 0.5 : 0.3)).toFixed(2);
        sh.push(`${x}vw ${y}vh 0 ${layer ? 1.4 : 0.9}px rgba(220,240,245,${o})`);
      }
      return sh.join(",");
    });
  }

  return (
    <div
      ref={scroller}
      className="fixed inset-0 overflow-y-auto overflow-x-hidden"
      style={{ background: "#f3f4f2", fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}
    >
      <style>{`
        .fgbl-reveal{opacity:0;transform:translateY(46px);transition:opacity .9s ease,transform .9s cubic-bezier(.22,.8,.32,1)}
        .fgbl-reveal.in{opacity:1;transform:none}
        .fgbl-card img{filter:grayscale(1);transition:filter .55s ease,transform .55s ease}
        .fgbl-card:hover img{filter:grayscale(0);transform:scale(1.03)}
        @media (prefers-reduced-motion: reduce){.fgbl-reveal{transition:none;opacity:1;transform:none}}
      `}</style>

      {/* ============ STAGE A: mondo (hero -> numeri -> zoom Monte-Carlo) ============ */}
      <section ref={stageA} style={{ height: "470vh", position: "relative" }}>
        <div
          ref={stickA}
          style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", background: "#0a1c20" }}
        >
          {/* cielo stellato */}
          {stars.current.map((sh, i) => (
            <i
              key={i}
              aria-hidden
              style={{ position: "absolute", width: 0, height: 0, borderRadius: "50%", boxShadow: sh }}
            />
          ))}

          <div
            ref={header}
            className="absolute top-0 left-0 right-0 z-[5] flex items-center justify-between"
            style={{ padding: "34px clamp(24px,5vw,64px)" }}
          >
            <img src="/green.webp" alt="FGB" className="h-12 w-auto drop-shadow-lg" />
            <nav className="flex" style={{ gap: "clamp(20px,4vw,58px)" }}>
              <button onClick={() => scrollToRef(certsSec)} className="text-[#e8ecec] font-semibold text-[clamp(13px,1.2vw,17px)] hover:text-[#7ad8d2] transition-colors">Certifications</button>
              <button onClick={() => scrollToRef(stageB)} className="text-[#e8ecec] font-semibold text-[clamp(13px,1.2vw,17px)] hover:text-[#7ad8d2] transition-colors">Monitoring</button>
              <button onClick={() => scrollToRef(waysSec)} className="text-[#e8ecec] font-semibold text-[clamp(13px,1.2vw,17px)] hover:text-[#7ad8d2] transition-colors">Access</button>
            </nav>
          </div>

          {/* Terra + marker delle sedi (scalano con lei) */}
          <div ref={earth} style={{ position: "absolute", left: 0, top: 0, willChange: "transform" }}>
            <img
              src="/landing/earth.webp"
              alt="Earth"
              className="w-full h-full rounded-full"
              style={{ boxShadow: "0 0 90px rgba(120,220,235,.28), 0 0 26px rgba(160,235,245,.35)" }}
            />
            {MARKERS.map((m) => (
              <MarkerPin key={m.label} m={m} />
            ))}
          </div>

          <div
            ref={headline}
            className="absolute z-[4]"
            style={{ left: "clamp(24px,5vw,64px)", top: "24vh", willChange: "opacity,transform" }}
          >
            <h1 className="text-[#e8ecec] font-medium" style={{ fontSize: "clamp(30px,4.6vw,62px)", lineHeight: 1.18, letterSpacing: ".5px" }}>
              Precisely measured
              <br />
              Globally connected
            </h1>
          </div>

          <div
            ref={numbers}
            className="absolute z-[4] flex flex-col"
            style={{ left: "clamp(24px,5vw,64px)", top: "20vh", gap: "5.2vh" }}
          >
            {[
              { target: 60, label: "COUNTRIES" },
              { target: 6000, label: "BUILDINGS MONITORED", fmt: "dot" },
              { target: 300, label: "CLIENTS" },
            ].map((n) => (
              <div key={n.label} className="fgbl-num" style={{ opacity: 0, transform: "translateY(26px)" }}>
                <b
                  data-target={n.target}
                  data-fmt={n.fmt}
                  className="block text-[#dfe5e6] font-medium tabular-nums"
                  style={{ fontSize: "clamp(40px,5.4vw,72px)", lineHeight: 1 }}
                >
                  0
                </b>
                <span className="block text-[#b9c4c6]" style={{ fontSize: "clamp(12px,1.15vw,17px)", letterSpacing: "2.5px", marginTop: 6 }}>
                  {n.label}
                </span>
              </div>
            ))}
          </div>

          <button
            ref={signin}
            onClick={onSignIn}
            className="absolute z-[6] rounded-full font-semibold"
            style={{
              left: "clamp(24px,5vw,64px)",
              bottom: "9vh",
              background: "#eef0ee",
              color: "#016368",
              padding: "12px 38px",
              fontSize: 15,
              letterSpacing: "1.5px",
            }}
          >
            SIGN IN
          </button>

          <div
            ref={flood}
            style={{
              position: "absolute",
              zIndex: 8,
              borderRadius: "50%",
              background: "#f3f4f2",
              pointerEvents: "none",
              left: 0,
              top: 0,
              width: 80,
              height: 80,
              transform: "translate(-50%,-50%) scale(0)",
              willChange: "transform",
            }}
          />
        </div>
      </section>

      {/* ============ CERTIFICAZIONI ============ */}
      <section
        ref={certsSec}
        className="grid items-center"
        style={{
          background: "#f3f4f2",
          minHeight: "100vh",
          gridTemplateColumns: "minmax(320px,1fr) minmax(0,1.1fr)",
          gap: "clamp(24px,4vw,72px)",
          padding: "clamp(48px,7vh,90px) clamp(24px,5vw,72px)",
        }}
      >
        <div className="fgbl-reveal">
          <h2 className="font-semibold text-[#585d60]" style={{ fontSize: "clamp(34px,4.4vw,60px)", lineHeight: 1.12 }}>
            Your path to
            <br />
            <span className="font-bold text-[#009193]">sustainability</span>
            <br />
            excellence
          </h2>
          <div className="grid grid-cols-2 gap-x-10 gap-y-8 items-center" style={{ marginTop: "clamp(28px,5vh,54px)", maxWidth: 430 }}>
            {CERT_LOGOS.map((l) => (
              <img key={l.name} src={l.src} alt={l.name} loading="lazy" className="max-h-[64px] w-auto object-contain justify-self-start" />
            ))}
          </div>
        </div>
        <div className="flex justify-end" style={{ gap: "clamp(14px,2vw,28px)" }}>
          {/* Slot media: per la versione video sostituire <img> con
              <video autoPlay muted loop playsInline src="..."> */}
          {["/landing/lynx.webp", "/landing/girl.webp"].map((src, i) => (
            <div
              key={src}
              className="fgbl-reveal overflow-hidden"
              style={{ borderRadius: 180, flex: "0 1 320px", aspectRatio: "0.47", maxHeight: "78vh", transitionDelay: `${0.15 * (i + 1)}s` }}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </section>

      {/* ============ STAGE B: MONITORING ============ */}
      <section ref={stageB} style={{ height: "380vh", position: "relative" }}>
        <div ref={stickB} style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", background: "#f3f4f2", willChange: "background-color" }}>
          <div
            className="absolute inset-0 grid grid-cols-3"
            style={{ columnGap: "clamp(10px,2vw,28px)", padding: "0 clamp(16px,6vw,110px)" }}
          >
            <div ref={bandAir} className="h-full flex flex-col items-center text-center text-white" style={{ background: "#4f9e98", padding: "7vh 5% 6vh", transform: "translateY(-110%)", willChange: "transform" }}>
              <h3 className="font-semibold" style={{ fontSize: "clamp(22px,2.6vw,38px)", letterSpacing: 2 }}>AIR</h3>
              <p style={{ fontSize: "clamp(12px,1.1vw,16px)", lineHeight: 1.55, marginTop: "2.2vh", maxWidth: 270 }}>
                <b className="block font-semibold">Every breath, measured.</b>
                CO₂, humidity and particles - where your people actually work.
              </p>
              <div className="rounded-full overflow-hidden" style={{ width: "clamp(140px,16vw,230px)", aspectRatio: "1", marginTop: "4.5vh" }}>
                <img src="/landing/dandelion.webp" alt="" className="w-full h-full object-cover" />
              </div>
            </div>
            <div ref={bandEnergy} className="h-full flex flex-col items-center justify-end text-center text-white" style={{ background: "#8fdcd4", padding: "7vh 5% 6vh", transform: "translateY(110%)", willChange: "transform" }}>
              <div className="rounded-full overflow-hidden" style={{ width: "clamp(140px,16vw,230px)", aspectRatio: "1", marginBottom: "4.5vh" }}>
                <img src="/landing/bulb.webp" alt="" className="w-full h-full object-cover" />
              </div>
              <p style={{ fontSize: "clamp(12px,1.1vw,16px)", lineHeight: 1.55, marginBottom: "2.2vh", maxWidth: 270 }}>
                <b className="block font-semibold">Every kWh, accounted for.</b>
                Consumption, load and cost - hour by hour, not once a quarter
              </p>
              <h3 className="font-semibold" style={{ fontSize: "clamp(22px,2.6vw,38px)", letterSpacing: 2 }}>ENERGY</h3>
            </div>
            <div ref={bandWater} className="h-full flex flex-col items-center text-center text-white" style={{ background: "#4f9e98", padding: "7vh 5% 6vh", transform: "translateY(-110%)", willChange: "transform" }}>
              <h3 className="font-semibold" style={{ fontSize: "clamp(22px,2.6vw,38px)", letterSpacing: 2 }}>WATER</h3>
              <p style={{ fontSize: "clamp(12px,1.1vw,16px)", lineHeight: 1.55, marginTop: "2.2vh", maxWidth: 270 }}>
                <b className="block font-semibold">Every drop, tracked.</b>
                Flow, leaks and waste - spotted live, before they hit the bill.
              </p>
              <div className="rounded-full overflow-hidden" style={{ width: "clamp(140px,16vw,230px)", aspectRatio: "1", marginTop: "4.5vh" }}>
                <img src="/landing/drop.webp" alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
          <div
            ref={monTitle}
            className="absolute z-[4] text-white font-semibold"
            style={{ left: "clamp(24px,4.5vw,64px)", bottom: "6vh", fontSize: "clamp(38px,5vw,64px)", opacity: 0, transform: "translateY(20px)", willChange: "opacity,transform" }}
          >
            Monitoring
          </div>
        </div>
      </section>

      {/* ============ FREE / CUSTOM ============ */}
      <section
        ref={waysSec}
        className="flex flex-col items-center justify-center"
        style={{ background: "#f3f4f2", minHeight: "100vh", padding: "clamp(48px,8vh,110px) 24px", gap: "clamp(28px,5vh,48px)" }}
      >
        <div className="text-center">
          <h2 className="font-bold text-[#009193]" style={{ fontSize: "clamp(30px,4vw,56px)" }}>
            Two ways in. One conversation.
          </h2>
          <p className="text-[#7c8285]" style={{ fontSize: "clamp(14px,1.4vw,20px)", marginTop: 10 }}>
            Commercial terms are always defined one-to-one
          </p>
        </div>
        <div className="flex flex-wrap justify-center" style={{ gap: "clamp(18px,3vw,46px)" }}>
          {[
            { src: "/landing/leaf.webp", alt: "FREE — Explore the ecosystem" },
            { src: "/landing/lynx2.webp", alt: "CUSTOM — Tailored to your portfolio" },
          ].map((c) => (
            <button key={c.src} type="button" onClick={onCreate} className="fgbl-card overflow-hidden rounded-[26px] cursor-pointer" style={{ width: "clamp(260px,30vw,380px)" }}>
              <img src={c.src} alt={c.alt} className="w-full" />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-full font-semibold text-white transition-transform hover:scale-[1.03]"
          style={{ background: "#009193", padding: "14px 44px", fontSize: 16, letterSpacing: "1.5px" }}
        >
          CREATE ONE
        </button>
      </section>
    </div>
  );
};

export default LandingScroll;
