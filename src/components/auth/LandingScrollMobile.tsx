import React, { useEffect, useRef } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import CityTicker from "./CityTicker";
import { MARKERS, CERT_LOGOS } from "./LandingScroll";

/**
 * Landing MOBILE (<768px): stesso racconto del desktop, grammatica da
 * telefono (spec landing-mobile + accorgimenti del proprietario 01/09):
 *
 *  - header con Certifications | Monitoring | Access;
 *  - logo FGB grande e centrato all'apertura, che si "wrappa" nell'angolo
 *    dell'header appena si scrolla (interpolato, reversibile);
 *  - hero col globo AUTO-ROTANTE (nessuno scroll-jacking: su touch le
 *    scene si animano da sole quando entrano) e i numeri che contano;
 *  - certificazioni a CAROSELLO orizzontale: logo + caption sotto
 *    (niente hover sul touch);
 *  - lince e ragazza affiancate al 50% con GLANCE / BREATH al bordo alto;
 *  - monitoring in tre ATTI ORIZZONTALI, uno per schermata: banda piena
 *    larghezza che finisce a meta' del cerchio, ingressi da sinistra /
 *    destra / sinistra;
 *  - Free/Custom impilate che si colorano da sole quando entrano in vista.
 *
 * Budget batteria: canvas 640 scalato, pixel ratio <=1.25, texture 2048,
 * niente nuvole/bump, render in pausa quando il globo esce dalla vista.
 */

interface Props {
  onSignIn: () => void;
  onCreate: () => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const CANVAS = 640;

const LandingScrollMobile: React.FC<Props> = ({ onSignIn, onCreate }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const heroSec = useRef<HTMLElement>(null);
  const certsSec = useRef<HTMLElement>(null);
  const monSec = useRef<HTMLElement>(null);
  const waysSec = useRef<HTMLElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const globePaused = useRef(false);

  const globeMaterial = React.useMemo(
    () => new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 12, specular: new THREE.Color(0x2c3e46) }),
    [],
  );

  const pinObject = React.useMemo(() => {
    return (d: { lat: number; lng: number; main?: boolean }) => {
      const mat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x9fb4b4, emissiveIntensity: 0.22, shininess: 55 });
      const g = new THREE.Group();
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.62, 3.0, 24), mat);
      tip.rotation.x = Math.PI;
      tip.position.y = 1.5;
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 18), mat);
      head.position.y = 3.5;
      g.add(tip, head);
      const s = d.main ? 1.5 : 1.0;
      g.scale.set(s, s, s);
      const coords = globeRef.current?.getCoords?.(d.lat, d.lng, 0);
      if (coords) {
        const n = new THREE.Vector3(coords.x, coords.y, coords.z).normalize();
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      }
      return g;
    };
  }, []);

  const onGlobeReady = () => {
    const g = globeRef.current;
    if (!g) return;
    const renderer = g.renderer?.();
    if (renderer) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    g.pointOfView({ lat: 24, lng: -40, altitude: 1.9 }, 0);
    const controls = g.controls?.();
    if (controls) {
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = false;
      controls.autoRotate = true;       /* il "viaggio" diventa rotazione ambientale */
      controls.autoRotateSpeed = 0.55;
    }
    new THREE.TextureLoader().load("/landing/earth-day-mobile.jpg", (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      globeMaterial.map = tex;
      globeMaterial.needsUpdate = true;
    });
  };

  useEffect(() => {
    const sc = scroller.current!;

    /* Logo: grande e centrato -> angolo dell'header, guidato dallo scroll */
    const LOGO_W = 190;
    const layoutLogo = () => {
      const el = logoRef.current;
      if (!el) return;
      const p = clamp(sc.scrollTop / 150, 0, 1);
      const vw = sc.clientWidth;
      const x = lerp((vw - LOGO_W) / 2, 12, p);
      const y = lerp(66, 8, p);
      const s = lerp(1, 0.44, p);
      el.style.transform = `translate3d(${x}px,${y}px,0) scale(${s})`;
    };
    const onScroll = () => requestAnimationFrame(layoutLogo);
    sc.addEventListener("scroll", onScroll, { passive: true });
    layoutLogo();

    /* Scene: si animano da sole quando entrano (mai guidate dal dito) */
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { root: sc, threshold: 0.25 },
    );
    sc.querySelectorAll(".fgm-reveal, .fgm-act, .fgm-color").forEach((el) => io.observe(el));

    /* Numeri: contano una volta sola quando il blocco entra in vista */
    const nums = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        nums.unobserve(e.target);
        e.target.querySelectorAll<HTMLElement>("b[data-target]").forEach((b) => {
          const target = Number(b.dataset.target);
          const t0 = performance.now();
          const tick = (t: number) => {
            const k = clamp((t - t0) / 1400, 0, 1);
            const v = Math.round(target * (1 - Math.pow(1 - k, 3)));
            b.textContent = b.dataset.fmt === "dot" ? v.toLocaleString("de-DE") : String(v);
            if (k < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      });
    }, { root: sc, threshold: 0.5 });
    const numsEl = sc.querySelector(".fgm-nums");
    if (numsEl) nums.observe(numsEl);

    /* Globo in pausa quando esce dalla vista: batteria salva */
    const heroIo = new IntersectionObserver((es) => {
      es.forEach((e) => {
        const g = globeRef.current;
        if (!g) return;
        if (e.isIntersecting && globePaused.current) { g.resumeAnimation?.(); globePaused.current = false; }
        if (!e.isIntersecting && !globePaused.current) { g.pauseAnimation?.(); globePaused.current = true; }
      });
    }, { root: sc, threshold: 0.05 });
    if (heroSec.current) heroIo.observe(heroSec.current);

    /* Debug SOLO DEV: ?lp=NNN scrolla il container (screenshot automatici) */
    let dbgT: ReturnType<typeof setTimeout> | undefined;
    if (import.meta.env.DEV) {
      const m = window.location.href.match(/[?&]lp=(\d+)/);
      if (m)
        dbgT = setTimeout(() => {
          sc.querySelectorAll(".fgm-reveal, .fgm-act, .fgm-color").forEach((el) => el.classList.add("in"));
          sc.scrollTo(0, Number(m[1]));
        }, 1200);
    }

    return () => {
      sc.removeEventListener("scroll", onScroll);
      io.disconnect();
      nums.disconnect();
      heroIo.disconnect();
      if (dbgT) clearTimeout(dbgT);
    };
  }, []);

  const scrollToRef = (ref: React.RefObject<HTMLElement>) => {
    const sc = scroller.current;
    if (sc && ref.current) sc.scrollTo({ top: ref.current.offsetTop - 52, behavior: "smooth" });
  };

  const globeSize = Math.min(typeof window !== "undefined" ? window.innerWidth * 0.86 : 340, 400);

  return (
    <div
      ref={scroller}
      className="fixed inset-0 overflow-y-auto overflow-x-hidden"
      style={{ background: "#f3f4f2", fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}
    >
      <style>{`
        .fgm-reveal{opacity:0;transform:translateY(30px);transition:opacity .8s ease,transform .8s cubic-bezier(.22,.8,.32,1)}
        .fgm-reveal.in{opacity:1;transform:none}
        .fgm-act{opacity:0;transition:opacity .85s ease,transform .85s cubic-bezier(.22,.8,.32,1)}
        .fgm-act.from-left{transform:translateX(-56px)}
        .fgm-act.from-right{transform:translateX(56px)}
        .fgm-act.in{opacity:1;transform:none}
        .fgm-color img{filter:grayscale(1);transition:filter .9s ease}
        .fgm-color.in img{filter:grayscale(0)}
        .fgm-snap{scrollbar-width:none;-ms-overflow-style:none}
        .fgm-snap::-webkit-scrollbar{display:none}
        @media (prefers-reduced-motion: reduce){
          .fgm-reveal,.fgm-act{transition:none;opacity:1;transform:none}
          .fgm-color img{filter:none}
        }
      `}</style>

      {/* ══ Header: nav in alto + spazio per il logo che si wrappa ══ */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-end gap-4 px-4"
        style={{ height: 52, paddingTop: "env(safe-area-inset-top)", background: "linear-gradient(180deg, rgba(10,28,32,.92), rgba(10,28,32,0))" }}
      >
        <button onClick={() => scrollToRef(certsSec)} className="text-[11px] font-semibold text-[#e8ecec]">Certifications</button>
        <button onClick={() => scrollToRef(monSec)} className="text-[11px] font-semibold text-[#e8ecec]">Monitoring</button>
        <button onClick={() => scrollToRef(waysSec)} className="text-[11px] font-semibold text-[#e8ecec]">Access</button>
      </div>
      {/* logo animato: parte grande al centro, si aggancia nell'angolo */}
      <img
        ref={logoRef}
        src="/white-logo.png"
        alt="FGB"
        className="fixed top-0 left-0 z-50 pointer-events-none drop-shadow-lg"
        style={{ width: 190, transformOrigin: "0 0", willChange: "transform" }}
      />

      {/* ══ HERO: globo auto-rotante + numeri ══ */}
      <section ref={heroSec} className="relative flex flex-col items-center px-6" style={{ minHeight: "100svh", background: "linear-gradient(180deg,#0a1c20 0%,#0d2530 100%)", paddingTop: 148 }}>
        <h1 className="text-center text-[#e8ecec] font-medium" style={{ fontSize: "clamp(26px,7.5vw,34px)", lineHeight: 1.2 }}>
          Precisely measured<br />Globally connected
        </h1>
        <div className="relative mt-6" style={{ width: globeSize, height: globeSize }}>
          {/* absolute: il canvas 640 scalato non deve contribuire al layout,
              o allarga la pagina e sposta tutto (headline tagliata) */}
          <div style={{ position: "absolute", top: 0, left: 0, width: CANVAS, height: CANVAS, transform: `scale(${globeSize / CANVAS})`, transformOrigin: "0 0" }}>
            <Globe
              ref={globeRef}
              width={CANVAS}
              height={CANVAS}
              backgroundColor="rgba(0,0,0,0)"
              globeMaterial={globeMaterial}
              onGlobeReady={onGlobeReady}
              rendererConfig={{ antialias: false, alpha: true, powerPreference: "low-power" }}
              showAtmosphere
              atmosphereColor="#7ad8d2"
              atmosphereAltitude={0.13}
              objectsData={MARKERS}
              objectLat={(d: { lat: number }) => d.lat}
              objectLng={(d: { lng: number }) => d.lng}
              objectAltitude={0}
              objectThreeObject={pinObject}
            />
          </div>
        </div>
        <div className="fgm-nums flex items-start justify-center gap-7 mt-6 pb-10">
          {[
            { t: 60, l: "countries" },
            { t: 6000, l: "buildings", fmt: "dot" },
            { t: 300, l: "clients" },
          ].map((n) => (
            <div key={n.l} className="text-center">
              <b data-target={n.t} data-fmt={n.fmt} className="block text-[#dfe5e6] font-medium tabular-nums" style={{ fontSize: 26, lineHeight: 1 }}>0</b>
              <span className="block text-[#b9c4c6] uppercase" style={{ fontSize: 9, letterSpacing: "0.22em", marginTop: 4 }}>{n.l}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onSignIn}
          className="mb-10 rounded-full font-semibold"
          style={{ background: "#eef0ee", color: "#016368", padding: "12px 40px", fontSize: 14, letterSpacing: "1.5px" }}
        >
          SIGN IN
        </button>
      </section>

      {/* ══ CERTIFICAZIONI: carosello orizzontale logo + caption ══ */}
      <section ref={certsSec} className="px-6 py-14" style={{ background: "#f3f4f2" }}>
        <div className="fgm-reveal">
          <p className="text-[10px] font-semibold uppercase" style={{ letterSpacing: "0.28em", color: "#016368" }}>Certifications</p>
          <h2 className="font-semibold" style={{ fontSize: 26, lineHeight: 1.2, marginTop: 8, color: "#585d60" }}>
            Your path to <span style={{ color: "#009193" }}>sustainability</span> excellence
          </h2>
        </div>
        <div className="fgm-reveal fgm-snap flex overflow-x-auto gap-4 mt-7 -mx-6 px-6" style={{ scrollSnapType: "x mandatory" }}>
          {CERT_LOGOS.map((l) => (
            <div key={l.name} className="shrink-0 flex flex-col items-center text-center rounded-2xl bg-white/70 border border-black/[0.05] px-5 py-6" style={{ width: "64vw", maxWidth: 250, scrollSnapAlign: "center" }}>
              <div className="flex items-center justify-center" style={{ height: 92 }}>
                <img src={l.src} alt={l.name} loading="lazy" style={{ maxHeight: Math.round(l.h * 0.8), maxWidth: 170, objectFit: "contain" }} />
              </div>
              <p className="font-semibold" style={{ fontSize: 14, color: "#3f4649", marginTop: 10 }}>{l.name}</p>
              <p style={{ fontSize: 11.5, color: "#7c8285", lineHeight: 1.45, marginTop: 4 }}>{l.desc}</p>
            </div>
          ))}
        </div>

        {/* lince + ragazza al 50%, GLANCE / BREATH al bordo alto */}
        <div className="fgm-reveal flex gap-3 mt-8">
          {[
            { src: "/landing/cert-lynx.webp", word: "GLANCE" },
            { src: "/landing/cert-girl.webp", word: "BREATH" },
          ].map((c) => (
            <div key={c.word} className="relative flex-1 rounded-2xl overflow-hidden" style={{ aspectRatio: "0.52" }}>
              <img src={c.src} alt="" loading="lazy" className="w-full h-full object-cover" />
              <span
                className="absolute left-0 right-0 text-center font-bold text-white uppercase"
                style={{ top: 10, fontSize: 13, letterSpacing: "0.34em", textShadow: "0 1px 10px rgba(0,0,0,.55)" }}
              >
                {c.word}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-8 -mx-6">
          <CityTicker transparent color="#009193" />
        </div>
      </section>

      {/* ══ MONITORING: tre atti orizzontali, uno per schermata ══ */}
      <section ref={monSec} style={{ background: "#25655f" }}>
        {[
          { t: "AIR", b: "Every breath, measured.", d: "CO₂, humidity and particles - where your people actually work.", img: "/landing/pillar-air.webp", bg: "#4f9e98", dir: "from-left", flip: false },
          { t: "ENERGY", b: "Every kWh, accounted for.", d: "Consumption, load and cost - hour by hour, not once a quarter.", img: "/landing/pillar-energy.webp", bg: "#8fdcd4", dir: "from-right", flip: true },
          { t: "WATER", b: "Every drop, tracked.", d: "Flow, leaks and waste - spotted live, before they hit the bill.", img: "/landing/pillar-water.webp", bg: "#4f9e98", dir: "from-left", flip: false },
        ].map((a, i) => (
          <div key={a.t} className="relative flex flex-col justify-center px-5" style={{ minHeight: "92svh" }}>
            {i === 0 && (
              <p className="absolute top-8 left-5 text-[10px] font-semibold uppercase" style={{ letterSpacing: "0.3em", color: "#9fd5d9" }}>Monitoring</p>
            )}
            {/* banda orizzontale piena larghezza che finisce a meta' cerchio */}
            <div className={`fgm-act ${a.dir} relative w-full rounded-xl text-white text-center`} style={{ background: a.bg, padding: a.flip ? "calc(23vw + 20px) 22px 30px" : "30px 22px calc(23vw + 20px)" }}>
              <h3 className="font-semibold" style={{ fontSize: 30, letterSpacing: 2, order: a.flip ? 2 : 0 }}>{a.t}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 10, maxWidth: 300, marginInline: "auto" }}>
                <b className="block font-semibold">{a.b}</b>
                {a.d}
              </p>
              <div
                className="absolute left-1/2 rounded-full overflow-hidden"
                style={{
                  width: "46vw", maxWidth: 220, aspectRatio: "1",
                  transform: "translateX(-50%)",
                  ...(a.flip ? { top: 0, translate: "0 -50%" } : { bottom: 0, translate: "0 50%" }),
                }}
              >
                <img src={a.img} alt="" loading="lazy" className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ══ FREE / CUSTOM: impilate, si colorano quando entrano in vista ══ */}
      <section ref={waysSec} className="flex flex-col items-center px-6 py-16" style={{ background: "#f3f4f2" }}>
        <h2 className="fgm-reveal font-bold text-center" style={{ fontSize: 27, color: "#009193" }}>Two ways in. One conversation.</h2>
        <p className="fgm-reveal text-center" style={{ fontSize: 13.5, color: "#7c8285", marginTop: 8 }}>Commercial terms are always defined one-to-one</p>
        <div className="flex flex-col gap-5 mt-8 w-full" style={{ maxWidth: 380 }}>
          {[
            { src: "/landing/leaf.webp", alt: "FREE — Explore the ecosystem" },
            { src: "/landing/lynx2.webp", alt: "CUSTOM — Tailored to your portfolio" },
          ].map((c) => (
            <button key={c.src} type="button" onClick={onCreate} className="fgm-color overflow-hidden rounded-[24px] w-full">
              <img src={c.src} alt={c.alt} className="w-full" />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="mt-8 w-full rounded-full font-semibold text-white"
          style={{ maxWidth: 380, background: "#009193", padding: "16px 0", fontSize: 15, letterSpacing: "1.5px", minHeight: 52 }}
        >
          CREATE ONE
        </button>
        <button onClick={onSignIn} className="mt-4 text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#016368", paddingBottom: "env(safe-area-inset-bottom)" }}>
          Sign in
        </button>
      </section>
    </div>
  );
};

export default LandingScrollMobile;
