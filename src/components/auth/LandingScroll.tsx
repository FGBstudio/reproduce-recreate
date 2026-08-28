import React, { useEffect, useMemo, useRef } from "react";
import Globe from "react-globe.gl";
import * as THREE from "three";

/**
 * Landing desktop "scroll-telling" (design dal PDF SITO MONITORAGGIO 2026):
 *
 *  1. Hero: globo 3D reale (texture blue marble locale) grande in basso a
 *     destra, visuale sugli USA, marker sulle sedi FGB.
 *  2. Primo scroll: la Terra si rimpicciolisce e si mostra intera a destra
 *     RUOTANDO verso la Cina; il titolo svanisce, entrano i numeri contando.
 *  3. Secondo scroll: il globo continua a ruotare fino a Monte-Carlo e ci si
 *     tuffa dentro; il bianco del marker invade la pagina e si atterra sulle
 *     certificazioni.
 *  4. Monitoring: sfondo verde, ARIA dall'alto, ENERGIA dal basso, ACQUA
 *     dall'alto.
 *  5. Free/Custom: card in bianco e nero che si colorano al passaggio.
 *
 * Tutto e' guidato dalla posizione di scroll (reversibile su e giu').
 * Attivabile/disattivabile con LANDING_SCROLL in src/lib/features.ts.
 */

interface Props {
  onSignIn: () => void;
  onCreate: () => void;
}

/* Sedi FGB (lat/lng reali). main = Monte-Carlo: bersaglio dello zoom. */
const MARKERS: { lat: number; lng: number; label: string; main?: boolean }[] = [
  { lat: 43.53, lng: 5.45, label: "Aix-en-Provence" },
  { lat: 52.37, lng: 4.9, label: "Amsterdam" },
  { lat: 25.2, lng: 55.27, label: "Dubai" },
  { lat: 10.78, lng: 106.7, label: "Ho Chi Minh" },
  { lat: 51.51, lng: -0.13, label: "London" },
  { lat: 34.05, lng: -118.24, label: "Los Angeles" },
  { lat: 25.76, lng: -80.19, label: "Miami" },
  { lat: 45.46, lng: 9.19, label: "Milan" },
  { lat: 40.71, lng: -74.01, label: "New York" },
  { lat: 48.86, lng: 2.35, label: "Paris" },
  { lat: 41.9, lng: 12.5, label: "Rome" },
  { lat: 31.23, lng: 121.47, label: "Shanghai" },
  { lat: 1.35, lng: 103.82, label: "Singapore" },
  { lat: 24.15, lng: 120.67, label: "Taichung" },
  { lat: 35.68, lng: 139.69, label: "Tokyo" },
  { lat: 43.74, lng: 7.43, label: "Monte-Carlo", main: true },
];

/* Tappe della rotazione (lng CONTINUA verso ovest: USA -> Pacifico -> Cina
   -> Medio Oriente -> Europa; -256 equivale a 104 E, -352.57 a 7.43 E). */
const POV_USA = { lat: 22, lng: -96 };
const POV_CHINA = { lat: 32, lng: -256 };
const POV_MC = { lat: 43.74, lng: -352.57 };
const ALT_FAR = 1.8;   /* altitudine camera hero/numeri */
const ALT_NEAR = 0.28; /* fine tuffo su Monte-Carlo */

/* Raggio apparente del globo dentro il canvas ad altitudine a (FOV 50):
   R/((1+a)*tan25) come frazione del mezzo lato canvas. */
const globeFrac = (alt: number) => 1 / ((1 + alt) * Math.tan((25 * Math.PI) / 180));

/* Lato del canvas WebGL: il compromesso nitidezza/fluidita'. Idealmente
   pari alla posa hero (diametro 1.75H ~ 2050px), ma il costo di fill rate
   cresce col quadrato: si tetta a 1600 (upscale hero ~1.3x, impercettibile
   sull'arco in movimento) e si recupera nitidezza col pixel ratio adattivo
   qui sotto. Nella posa numeri (globo ~900px) il canvas risulta anzi
   sovracampionato: crisp proprio dove l'utente si ferma a guardare. */
const canvasSideFor = (H: number) => Math.min(1600, Math.ceil((1.75 * H) / globeFrac(ALT_FAR)));

/* Pixel ratio adattivo: pieno da fermo (entro un budget di ~2200px reali),
   ridotto DURANTE lo scroll — in movimento la risoluzione persa non si
   vede, ma i pixel da riempire calano di ~3 volte. */
const PR_SCROLLING = 0.8;
const idlePixelRatio = (side: number) =>
  Math.min(window.devicePixelRatio || 1, 2200 / side, 1.6);

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

const LandingScroll: React.FC<Props> = ({ onSignIn, onCreate }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const stageA = useRef<HTMLElement>(null);
  const stickA = useRef<HTMLDivElement>(null);
  const globeWrap = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
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
  const cloudsMesh = useRef<THREE.Mesh | null>(null);
  const cloudsAnim = useRef<number | null>(null);
  /* lato del canvas: fissato alla posa hero della viewport di montaggio */
  const sideRef = useRef(canvasSideFor(typeof window !== "undefined" ? window.innerHeight : 900));
  const lastPr = useRef(0);
  const globePaused = useRef(false);

  /* Materiale del globo: texture NASA topo/bathy + rilievo (bump) + maschera
     dell'acqua come specular map (oceani che riflettono, terre opache).
     Le texture arrivano in async e si agganciano al materiale gia' montato;
     l'anisotropia al massimo consentito e' cio' che tiene nitide le zone
     oblique della sfera (era la seconda causa della sfocatura). */
  const globeMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: 0xffffff,
        shininess: 16,
        specular: new THREE.Color(0x33474f),
        bumpScale: 0.8,
      }),
    [],
  );

  /* Pin 3D: sagoma classica da mappa, snella e lucida, punta ESATTAMENTE
     sul lat/lng (base del cono a y=0). Geometrie a 32 segmenti: niente
     spigoli visibili nemmeno in avvicinamento. Il globo ha raggio 100. */
  const pinObject = useMemo(() => {
    return (d: any) => {
      const mat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        emissive: 0x9fb4b4,
        emissiveIntensity: 0.22,
        shininess: 55,
        specular: new THREE.Color(0x7a9a9a),
      });
      const g = new THREE.Group();
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.52, 2.6, 32), mat);
      tip.rotation.x = Math.PI; /* punta in giu', appoggiata al suolo */
      tip.position.y = 1.3;
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 24), mat);
      head.position.y = 3.05;
      g.add(tip, head);
      const s = d.main ? 1.55 : 1.0;
      g.scale.set(s, s, s);
      /* orienta +Y lungo la normale del punto lat/lng */
      const coords = globeRef.current?.getCoords?.(d.lat, d.lng, 0);
      if (coords) {
        const n = new THREE.Vector3(coords.x, coords.y, coords.z).normalize();
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      }
      return g;
    };
  }, []);

  useEffect(() => {
    const sc = scroller.current!;
    let raf: number | null = null;

    const layoutStageA = () => {
      const W = sc.clientWidth;
      const H = sc.clientHeight;
      const secA = stageA.current!;
      const total = secA.offsetHeight - H;
      const p = clamp((sc.scrollTop - secA.offsetTop) / total, 0, 1);

      /* Fasi: 0-0.30 rimpicciolisce+ruota verso la Cina | 0.30-0.60 numeri |
         0.60-1 ruota fino a Monte-Carlo e ci si tuffa dentro */
      const shrink = easeIO(clamp(p / 0.3, 0, 1));
      const zoomT = clamp((p - 0.6) / 0.4, 0, 1);

      /* --- Camera del globo --- */
      const g = globeRef.current;
      if (g) {
        let lat: number, lng: number, alt: number;
        if (zoomT <= 0) {
          lat = lerp(POV_USA.lat, POV_CHINA.lat, shrink);
          lng = lerp(POV_USA.lng, POV_CHINA.lng, shrink);
          alt = ALT_FAR;
        } else {
          /* la rotazione Cina -> Monte-Carlo si esaurisce al 70% del tuffo,
             l'avvicinamento continua fino in fondo */
          const rot = easeIO(clamp(zoomT / 0.7, 0, 1));
          lat = lerp(POV_CHINA.lat, POV_MC.lat, rot);
          lng = lerp(POV_CHINA.lng, POV_MC.lng, rot);
          alt = lerp(ALT_FAR, ALT_NEAR, easeIn(zoomT));
        }
        g.pointOfView({ lat, lng, altitude: alt }, 0);
      }

      /* --- Inquadratura del wrapper (canvas fisso, si trasla e scala) --- */
      const frac = globeFrac(ALT_FAR); /* frazione occupata dal globo */
      /* Posa 1 (hero): globo con diametro ~1.75H, centro in basso a destra,
         arco che parte sotto l'header e cielo scuro sopra */
      const S1 = (1.75 * H) / frac;
      const c1 = { x: 0.86 * W, y: 1.14 * H };
      /* Posa 2 (numeri): globo intero a destra */
      const S2 = Math.min(0.82 * H, 0.44 * W) / frac;
      const c2 = { x: 0.71 * W, y: 0.5 * H };

      const S = lerp(S1, S2, shrink);
      const cx = lerp(c1.x, c2.x, shrink);
      const cy = lerp(c1.y, c2.y, shrink);
      const tx = cx - S / 2;
      const ty = cy - S / 2;
      const wrap = globeWrap.current!;
      wrap.style.transform = `translate3d(${tx}px,${ty}px,0) scale(${S / sideRef.current})`;

      stickA.current!.style.backgroundColor =
        shrink < 1 ? cssMix("#0a1c20", "#0d2530", shrink) : "#0d2530";

      const hOut = clamp(shrink / 0.55, 0, 1);
      headline.current!.style.opacity = String(1 - hOut);
      headline.current!.style.transform = `translateY(${-34 * hOut}px)`;

      /* Numeri: entrano scaglionati contando, svaniscono al tuffo */
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

      /* Il bianco del marker invade la pagina: a fine rotazione Monte-Carlo
         e' al centro del globo, quindi il flood parte dal centro wrapper */
      const fl = clamp((zoomT - 0.52) / 0.34, 0, 1);
      const maxR = Math.hypot(W, H) / 40; /* il div base e' 80px */
      const f = flood.current!;
      f.style.left = cx + "px";
      f.style.top = cy + "px";
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

    const setPixelRatio = (v: number) => {
      const r = globeRef.current?.renderer?.();
      if (r && Math.abs(lastPr.current - v) > 0.01) {
        r.setPixelRatio(v);
        lastPr.current = v;
      }
    };

    /* Pausa totale del render loop del globo quando e' coperto dal flood o
       si e' oltre lo stage A: li' ridisegnarlo e' solo batteria bruciata. */
    const setGlobePaused = (want: boolean) => {
      const g = globeRef.current;
      if (!g || globePaused.current === want) return;
      globePaused.current = want;
      if (want) g.pauseAnimation?.();
      else g.resumeAnimation?.();
    };

    const frame = () => {
      raf = null;
      layoutStageA();
      layoutStageB();
      const secA = stageA.current!;
      const H = sc.clientHeight;
      const past = sc.scrollTop > secA.offsetTop + secA.offsetHeight - H - 8;
      setGlobePaused(past);
    };

    let idleT: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(frame);
      /* risoluzione ridotta finche' si scrolla, piena 180ms dopo l'ultimo evento */
      if (!globePaused.current) setPixelRatio(PR_SCROLLING);
      clearTimeout(idleT);
      idleT = setTimeout(() => setPixelRatio(idlePixelRatio(sideRef.current)), 180);
    };

    sc.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    frame();

    /* Texture del globo, in async sul materiale gia' montato, con
       anisotropia al massimo consentito dalla GPU */
    const loader = new THREE.TextureLoader();
    const applyTex = (key: "map" | "bumpMap" | "specularMap", url: string, srgb = false) =>
      loader.load(url, (tex) => {
        if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
        /* anisotropia 8: sopra non si vede quasi, sotto si sfoca; e' il
           punto di equilibrio anche per GPU integrate */
        tex.anisotropy = Math.min(8, globeRef.current?.renderer?.()?.capabilities.getMaxAnisotropy?.() ?? 8);
        (globeMaterial as any)[key] = tex;
        globeMaterial.needsUpdate = true;
      });
    applyTex("map", "/landing/earth-day.jpg", true);
    applyTex("bumpMap", "/landing/earth-topology.png");
    applyTex("specularMap", "/landing/earth-water.png");

    /* Fallback nel caso onGlobeReady fosse gia' passato */
    const t0 = setTimeout(() => {
      const controls = globeRef.current?.controls?.();
      if (controls) {
        controls.enabled = false;
        controls.enableZoom = false;
      }
      frame();
    }, 150);

    /* Debug DEV: ?lp=NNN scrolla il container (per screenshot automatici) */
    let t1: ReturnType<typeof setTimeout> | undefined;
    if (import.meta.env.DEV) {
      const m = window.location.href.match(/[?&]lp=(\d+)/);
      if (m) t1 = setTimeout(() => sc.scrollTo(0, Number(m[1])), 1500);
    }

    const io = new IntersectionObserver(
      (es) => es.forEach((en) => en.isIntersecting && en.target.classList.add("in")),
      { root: sc, threshold: 0.2 },
    );
    sc.querySelectorAll(".fgbl-reveal").forEach((el) => io.observe(el));

    return () => {
      sc.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(t0);
      if (t1) clearTimeout(t1);
      clearTimeout(idleT);
      if (cloudsAnim.current) cancelAnimationFrame(cloudsAnim.current);
      io.disconnect();
    };
  }, [globeMaterial]);

  /* Alla prima renderizzazione del globo: qualita' del renderer, controlli
     orbitali spenti, strato nuvole che ruota piano (da' vita al pianeta) */
  const onGlobeReady = () => {
    const g = globeRef.current;
    if (!g) return;
    const renderer = g.renderer?.();
    if (renderer) {
      renderer.setPixelRatio(idlePixelRatio(sideRef.current));
      lastPr.current = idlePixelRatio(sideRef.current);
      const maxA = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      [globeMaterial.map, globeMaterial.bumpMap, globeMaterial.specularMap].forEach((t) => {
        if (t) {
          t.anisotropy = maxA;
          t.needsUpdate = true;
        }
      });
    }
    const controls = g.controls?.();
    if (controls) {
      controls.enabled = false;
      controls.enableZoom = false;
    }
    if (!cloudsMesh.current) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(100 * 1.008, 48, 48),
        new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.48, depthWrite: false }),
      );
      new THREE.TextureLoader().load("/landing/clouds.webp", (t) => {
        (mesh.material as THREE.MeshPhongMaterial).map = t;
        (mesh.material as THREE.MeshPhongMaterial).needsUpdate = true;
      });
      g.scene().add(mesh);
      cloudsMesh.current = mesh;
      const spin = () => {
        /* niente lavoro quando il globo e' in pausa (coperto/fuori vista) */
        if (!globePaused.current) mesh.rotation.y += 0.00022;
        cloudsAnim.current = requestAnimationFrame(spin);
      };
      spin();
    }
  };

  const scrollToRef = (ref: React.RefObject<HTMLElement>) => {
    const sc = scroller.current;
    if (sc && ref.current) sc.scrollTo({ top: ref.current.offsetTop, behavior: "smooth" });
  };

  /* Stelle: generate una volta */
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

      {/* ============ STAGE A: globo (hero -> numeri -> tuffo su Monte-Carlo) ============ */}
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

          {/* Globo 3D: canvas a lato fisso, il wrapper si trasla e scala */}
          <div
            ref={globeWrap}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: sideRef.current,
              height: sideRef.current,
              transformOrigin: "0 0",
              willChange: "transform",
            }}
          >
            <Globe
              ref={globeRef}
              width={sideRef.current}
              height={sideRef.current}
              backgroundColor="rgba(0,0,0,0)"
              globeMaterial={globeMaterial}
              onGlobeReady={onGlobeReady}
              /* niente MSAA: il costo di fill rate e' la voce piu' cara e i
                 bordi li tiene puliti il sovracampionamento da fermo */
              rendererConfig={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
              showAtmosphere
              atmosphereColor="#7ad8d2"
              atmosphereAltitude={0.14}
              objectsData={MARKERS}
              objectLat={(d: any) => d.lat}
              objectLng={(d: any) => d.lng}
              objectAltitude={0}
              objectThreeObject={pinObject}
              ringsData={MARKERS.filter((m) => m.main)}
              ringLat={(d: any) => d.lat}
              ringLng={(d: any) => d.lng}
              ringColor={() => (t: number) => `rgba(242,243,241,${0.55 * (1 - t)})`}
              ringMaxRadius={7}
              ringPropagationSpeed={2.2}
              ringRepeatPeriod={1400}
            />
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
