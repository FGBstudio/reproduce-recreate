import React, { useEffect, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import CityTicker from "./CityTicker";
import MobileAppHeader from "@/components/mobile/MobileAppHeader";
import { MARKERS, CERT_LOGOS } from "./LandingScroll";

/**
 * Landing MOBILE per app wrapped (SPEC mobile-landing-login §2, 08/09):
 *
 *  - scroller unico .app-scroll (nessuna scrollbar) + barra di avanzamento
 *    2px aqua in alto;
 *  - header CONDIVISO (MobileAppHeader, variante scura, logo bianco) con
 *    pill "Sign in": il logo sta SOLO nell'header (via l'animazione wrap);
 *  - hero in una schermata: titolo, globo 3D esistente (INVARIATO),
 *    3 numeri, Sign in, hint;
 *  - certificazioni in swipe orizzontale con dots + riga 11 world records;
 *    GLANCE/BREATH e riga citta' MANTENUTE (scelta owner 08/09);
 *  - monitoring in swipe orizzontale (3 card 80% con snap e dots, foto in
 *    cerchio DENTRO la card) al posto delle tre schermate impilate;
 *  - footer + CTA sticky "Sign in" che appare superata la hero, sopra la
 *    barra home (--sab).
 */

interface Props {
  onSignIn: () => void;
  onCreate: () => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const CANVAS = 640;

/** Dots di uno swipe: 6px, il corrente 18x6, aggiornati sullo scroll. */
const useSwipeDots = (count: number) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const onScroll = () => {
      const first = row.firstElementChild as HTMLElement | null;
      if (!first) return;
      const w = first.offsetWidth + 12;
      setIdx(clamp(Math.round(row.scrollLeft / w), 0, count - 1));
    };
    row.addEventListener("scroll", onScroll, { passive: true });
    return () => row.removeEventListener("scroll", onScroll);
  }, [count]);
  return { rowRef, idx };
};

const Dots: React.FC<{ count: number; idx: number; light?: boolean }> = ({ count, idx, light }) => (
  <div className="flex justify-center" style={{ gap: 6, paddingTop: 16 }}>
    {Array.from({ length: count }, (_, i) => (
      <i
        key={i}
        style={{
          width: i === idx ? 18 : 6, height: 6, borderRadius: i === idx ? 3 : 99,
          background: i === idx ? (light ? "#009193" : "#fff") : (light ? "rgba(74,75,77,.2)" : "rgba(255,255,255,.28)"),
          transition: "width .2s",
        }}
      />
    ))}
  </div>
);

const LandingScrollMobile: React.FC<Props> = ({ onSignIn, onCreate }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const heroSec = useRef<HTMLElement>(null);
  const certsSec = useRef<HTMLElement>(null);
  const monSec = useRef<HTMLElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const globePaused = useRef(false);
  const [hdrScrolled, setHdrScrolled] = useState(false);
  const [ctaShow, setCtaShow] = useState(false);

  const certDots = useSwipeDots(CERT_LOGOS.length);
  const monDots = useSwipeDots(3);

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

    const onScroll = () => {
      const max = sc.scrollHeight - sc.clientHeight;
      if (barRef.current) barRef.current.style.width = max > 0 ? (sc.scrollTop / max) * 100 + "%" : "0%";
      setHdrScrolled(sc.scrollTop > 10);
      const heroH = heroSec.current?.offsetHeight ?? sc.clientHeight;
      setCtaShow(sc.scrollTop > heroH * 0.7);
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* Scene: si animano da sole quando entrano (mai guidate dal dito) */
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { root: sc, threshold: 0.25 },
    );
    sc.querySelectorAll(".fgm-reveal, .fgm-color").forEach((el) => io.observe(el));

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
          sc.querySelectorAll(".fgm-reveal, .fgm-color").forEach((el) => el.classList.add("in"));
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
    if (sc && ref.current) sc.scrollTo({ top: ref.current.offsetTop - 60, behavior: "smooth" });
  };

  const globeSize = Math.min(typeof window !== "undefined" ? window.innerWidth * 0.76 : 300, 320);

  return (
    <div
      ref={scroller}
      className="app-scroll fixed inset-0"
      style={{ background: "#f3f4f2", fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}
    >
      <style>{`
        .fgm-reveal{opacity:0;transform:translateY(30px);transition:opacity .8s ease,transform .8s cubic-bezier(.22,.8,.32,1)}
        .fgm-reveal.in{opacity:1;transform:none}
        .fgm-color img{filter:grayscale(1);transition:filter .9s ease}
        .fgm-color.in img{filter:grayscale(0)}
        .fgm-snap{scrollbar-width:none;-ms-overflow-style:none}
        .fgm-snap::-webkit-scrollbar{display:none}
        @media (prefers-reduced-motion: reduce){
          .fgm-reveal{transition:none;opacity:1;transform:none}
          .fgm-color img{filter:none}
          .fgm-cta{transition:none}
        }
      `}</style>

      {/* barra di avanzamento: sostituisce la scrollbar */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, height: 2 }}>
        <div ref={barRef} style={{ height: "100%", width: 0, background: "#9fd5d9" }} />
      </div>

      {/* ══ Header condiviso (§1.3): logo bianco, pill Sign in ══ */}
      <MobileAppHeader
        variant="dark"
        scrolled={hdrScrolled}
        links={[
          { label: "Certifications", onClick: () => scrollToRef(certsSec) },
          { label: "Monitoring", onClick: () => scrollToRef(monSec) },
        ]}
        action={{ label: "Sign in", onClick: onSignIn }}
      />

      {/* ══ HERO in una schermata: titolo, globo (invariato), numeri, CTA ══ */}
      <section
        ref={heroSec}
        className="relative flex flex-col items-center px-6"
        style={{
          minHeight: "calc(100dvh - var(--sat) - 52px)",
          background: "linear-gradient(180deg,#0a1c20 0%,#0d2530 100%)",
          marginTop: "calc((var(--sat) + 50px) * -1)",
          paddingTop: "calc(var(--sat) + 62px)",
          paddingBottom: 26,
        }}
      >
        <h1 className="text-center text-[#e8ecec] font-medium" style={{ fontSize: "clamp(24px,6.8vw,32px)", lineHeight: 1.2, marginTop: 4 }}>
          Precisely measured<br />Globally connected
        </h1>
        <div className="relative mt-4" style={{ width: globeSize, height: globeSize }}>
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
        <div className="fgm-nums flex items-start justify-center gap-7 mt-5">
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
          className="rounded-full font-semibold"
          style={{ marginTop: 24, background: "#eef0ee", color: "#016368", padding: "14px 40px", fontSize: 14, letterSpacing: "1.5px", minHeight: 52, width: "100%", maxWidth: 300 }}
        >
          SIGN IN
        </button>
        <div className="text-center uppercase" style={{ marginTop: "auto", paddingTop: 18, fontSize: 9, letterSpacing: "0.3em", color: "rgba(244,243,239,.62)" }}>
          Discover
          <i className="block mx-auto" style={{ width: 1, height: 20, marginTop: 8, background: "linear-gradient(rgba(244,243,239,.62),transparent)" }} />
        </div>
      </section>

      {/* ══ CERTIFICAZIONI: swipe con dots + 11 world records + GLANCE/BREATH + citta' ══ */}
      <section ref={certsSec} className="py-14" style={{ background: "#f3f4f2" }}>
        <div className="fgm-reveal px-6">
          <p className="text-[10px] font-semibold uppercase" style={{ letterSpacing: "0.28em", color: "#016368" }}>Certifications</p>
          <h2 className="font-semibold" style={{ fontSize: 26, lineHeight: 1.2, marginTop: 8, color: "#585d60" }}>
            Your path to <span style={{ color: "#009193" }}>sustainability</span> excellence
          </h2>
        </div>
        <div
          ref={certDots.rowRef}
          className="fgm-reveal fgm-snap flex overflow-x-auto"
          style={{ gap: 12, scrollSnapType: "x mandatory", padding: "22px 22px 6px", overscrollBehaviorX: "contain" }}
        >
          {CERT_LOGOS.map((l) => (
            <div key={l.name} className="flex flex-col items-center text-center rounded-2xl bg-white/70 border border-black/[0.05] px-5 py-6" style={{ flex: "0 0 74%", scrollSnapAlign: "center" }}>
              <div className="flex items-center justify-center" style={{ height: 92 }}>
                <img src={l.src} alt={l.name} loading="lazy" style={{ maxHeight: Math.round(l.h * 0.8), maxWidth: 170, objectFit: "contain" }} />
              </div>
              <p className="font-semibold" style={{ fontSize: 14, color: "#3f4649", marginTop: 10 }}>{l.name}</p>
              <p style={{ fontSize: 11.5, color: "#7c8285", lineHeight: 1.45, marginTop: 4 }}>{l.desc}</p>
            </div>
          ))}
        </div>
        <Dots count={CERT_LOGOS.length} idx={certDots.idx} light />

        {/* riga 11 world records (mockup §2) */}
        <div className="fgm-reveal flex items-center" style={{ gap: 16, padding: "26px 22px 0" }}>
          <b className="font-semibold" style={{ fontSize: 60, color: "#009193", letterSpacing: "-0.04em", lineHeight: 0.9 }}>11</b>
          <div style={{ fontSize: 13, lineHeight: 1.35, color: "#7c8285" }}>
            <strong className="block font-semibold" style={{ fontSize: 16, color: "#3f4649" }}>world records</strong>
            Firsts and largests that redefined what certified buildings can be.
          </div>
        </div>

        {/* lince + ragazza al 50%, GLANCE / BREATH al bordo alto (mantenute) */}
        <div className="fgm-reveal flex gap-3 mt-8 px-6">
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

        <div className="mt-8">
          <CityTicker transparent color="#009193" />
        </div>
      </section>

      {/* ══ MONITORING: swipe orizzontale, 3 card 80% con foto DENTRO ══ */}
      <section ref={monSec} className="py-13" style={{ background: "#25655f", paddingTop: 52, paddingBottom: 52 }}>
        <div className="fgm-reveal px-6">
          <p className="text-[10px] font-semibold uppercase" style={{ letterSpacing: "0.3em", color: "#9fd5d9" }}>Monitoring</p>
          <h2 className="font-semibold text-white" style={{ fontSize: 28, lineHeight: 1.1, marginTop: 10 }}>
            Air, energy, water. <em className="not-italic" style={{ color: "#9fd5d9" }}>Live.</em>
          </h2>
        </div>
        <div
          ref={monDots.rowRef}
          className="fgm-reveal fgm-snap flex overflow-x-auto"
          style={{ gap: 12, scrollSnapType: "x mandatory", padding: "22px 22px 6px", overscrollBehaviorX: "contain" }}
        >
          {[
            { t: "AIR", b: "Every breath, measured.", d: "CO₂, humidity and particles - where your people actually work.", img: "/landing/pillar-air.webp", bg: "#2d7472", fg: "#fff" },
            { t: "ENERGY", b: "Every kWh, accounted for.", d: "Consumption, load and cost - hour by hour, not once a quarter.", img: "/landing/pillar-energy.webp", bg: "#9fd5d9", fg: "#0b2429" },
            { t: "WATER", b: "Every drop, tracked.", d: "Flow, leaks and waste - spotted live, before they hit the bill.", img: "/landing/pillar-water.webp", bg: "#016368", fg: "#fff" },
          ].map((a) => (
            <article
              key={a.t}
              className="relative flex flex-col rounded-[22px] overflow-hidden"
              style={{ flex: "0 0 80%", scrollSnapAlign: "center", minHeight: 330, padding: "26px 22px 22px", background: a.bg, color: a.fg }}
            >
              <h3 className="font-semibold uppercase" style={{ fontSize: 26, letterSpacing: "0.2em" }}>{a.t}</h3>
              <b className="block font-semibold" style={{ marginTop: 12, fontSize: 15 }}>{a.b}</b>
              <p style={{ fontWeight: 300, fontSize: 14, lineHeight: 1.4, opacity: 0.9, marginTop: 4, maxWidth: "26ch" }}>{a.d}</p>
              {/* foto in un cerchio DENTRO la card: non esce piu' dal riquadro */}
              <div className="rounded-full overflow-hidden" style={{ marginTop: "auto", alignSelf: "flex-end", width: 118, height: 118, boxShadow: "0 20px 40px -20px rgba(0,0,0,.6)" }}>
                <img src={a.img} alt="" loading="lazy" className="w-full h-full object-cover" />
              </div>
            </article>
          ))}
        </div>
        <Dots count={3} idx={monDots.idx} />
      </section>

      {/* ══ FREE / CUSTOM: impilate, si colorano quando entrano in vista ══ */}
      <section className="flex flex-col items-center px-6 py-16" style={{ background: "#f3f4f2" }}>
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
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="text-center" style={{ padding: "36px 24px calc(var(--sab) + 110px)", fontSize: 12, color: "#7c8285", background: "#f3f4f2" }}>
        <img src="/green.webp" alt="FGB — Future Green Building" style={{ height: 26, width: "auto", margin: "0 auto 10px" }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        Milan · 21 locations worldwide<br />© 2026 FGB
      </footer>

      {/* ══ CTA sticky: appare superata la hero, sopra la barra home ══ */}
      <div
        className="fgm-cta"
        style={{
          position: "sticky", bottom: 0, zIndex: 35, marginTop: -90,
          padding: "14px 24px calc(var(--sab) + 14px)",
          background: "linear-gradient(transparent, #f3f4f2 40%)",
          transform: ctaShow ? "none" : "translateY(110%)",
          transition: "transform .35s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <button
          type="button"
          onClick={onSignIn}
          className="w-full rounded-full font-semibold text-white"
          style={{ background: "#009193", minHeight: 54, fontSize: 14, letterSpacing: "0.24em", textTransform: "uppercase" }}
        >
          Sign in
        </button>
      </div>
    </div>
  );
};

export default LandingScrollMobile;
