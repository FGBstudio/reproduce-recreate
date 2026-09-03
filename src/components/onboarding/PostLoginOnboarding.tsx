import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ArrowUpRight, ArrowRight, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserScope } from "@/hooks/useUserScope";
import { useAdminData } from "@/contexts/AdminDataContext";
import { recordForClient } from "@/hooks/useClientPartnership";
import { useIntroStrip } from "@/hooks/useIntroStrip";
import IntroGlobe from "@/components/onboarding/IntroGlobe";
import { INTRO_LOCATIONS, INITIAL_LOCATION_SLUG } from "@/lib/intro/locations";
import { MOSAIC_STATS, TIMELINE, bumpIntroViews, readIntroMode, writeIntroMode, IntroMode } from "@/lib/intro/config";

/**
 * Pagina intro tra login e dashboard (SPEC-intro-page, 03/09).
 * Ordine fisso: hero → striscia «FGB × cliente» (dati reali dal perimetro
 * RLS) → Who we are (mosaico duotone + globo interattivo + citta' +
 * timeline) → 11 world records → platform con espandibile → news → CTA.
 * Chrome persistente: barra di avanzamento, logo, pill "Go to the dashboard".
 * Modalita' full/short/skip su localStorage (scelta owner: niente DB);
 * dopo 3 aperture full passa da sola a short. Tutte le animazioni
 * rispettano prefers-reduced-motion.
 */

const INK = "#3f4649";
const SUB = "#7c8285";
const TEAL = "#009193";
const TEAL_DARK = "#016368";
const WINE = "#931841";
const PAPER = "#f3f4f2";
const EASE = "cubic-bezier(.22,.8,.32,1)";

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

/* News hardcoded per scelta del proprietario (03/09: niente DB). */
const NEWS = [
  { img: "/landing/profile/laptop.webp", tag: "Platform", title: "FGB Monitoring System is live", line: "Energy and indoor air quality in real time, on every device.", date: "2 Sep 2026" },
  { img: "/landing/clair.webp", tag: "Hardware · Air", title: "Clair, indoor air under control", line: "Wellness boost and healthy workplaces, measured where people actually work.", date: "28 Aug 2026" },
  { img: "/landing/greeny.webp", tag: "Hardware · Energy", title: "Greeny, efficiency at the socket", line: "Find inefficiency and control your portfolio, kilowatt by kilowatt.", date: "14 Aug 2026" },
];

const Eyebrow: React.FC<{ children: React.ReactNode; light?: boolean }> = ({ children, light }) => (
  <p className="font-semibold uppercase" style={{ fontSize: 11, letterSpacing: "0.3em", color: light ? "#9fd5d9" : TEAL_DARK }}>
    {children}
  </p>
);

/** Count-up 1.1s out-cubic al primo ingresso nel viewport, una volta sola. */
const Count: React.FC<{ n: number; fmt?: "it" }> = ({ n, fmt }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (v: number) => { el.textContent = fmt === "it" ? v.toLocaleString("it-IT") : String(v); };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || n === 0) { set(n); return; }
    set(0);
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1100);
        set(Math.round(n * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [n, fmt]);
  return <span ref={ref} className="tabular-nums" />;
};

const Fold: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => (
  <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: `grid-template-rows .6s ${EASE}` }}>
    <div style={{ overflow: "hidden" }}>{children}</div>
  </div>
);

const Disc: React.FC<{ open: boolean; onClick: () => void; children: React.ReactNode }> = ({ open, onClick, children }) => (
  <button
    type="button"
    aria-expanded={open}
    onClick={onClick}
    className="inline-flex items-center gap-2 rounded-full font-semibold uppercase"
    style={{
      marginTop: 30, padding: "13px 30px", fontSize: 12, letterSpacing: "0.18em",
      color: open ? "#fff" : TEAL_DARK, background: open ? TEAL_DARK : "transparent",
      border: `1.5px solid ${TEAL_DARK}`, transition: `all .35s ${EASE}`,
    }}
  >
    {children}
    <ChevronDown className="w-4 h-4" style={{ transform: open ? "rotate(180deg)" : "none", transition: `transform .35s ${EASE}` }} />
  </button>
);

const TILE_ICONS: Record<string, React.ReactNode> = {
  people: <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0z" /></svg>,
  pin: <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}><path d="M3 12l4-4 5 5 5-5 4 4M7 8v8m10-8v8" /></svg>,
  folder: <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 20, height: 20 }}><path d="M3 6h6l2 2h10v11H3z" /></svg>,
};

/** Foto del collage: se il file manca resta il placeholder tintato. */
const CollagePhoto: React.FC<{ src: string; city: string; ratio: string }> = ({ src, city, ratio }) => (
  <div className="relative overflow-hidden" style={{ aspectRatio: ratio, borderRadius: 16, background: "linear-gradient(160deg,#cfe9ea,#8fc9cc)" }}>
    <span className="absolute inset-0 grid place-items-center font-semibold uppercase" style={{ fontSize: 11, letterSpacing: "0.2em", color: "#ffffffcc" }}>
      {city}
    </span>
    <img
      key={src}
      src={src}
      alt=""
      loading="lazy"
      className="fgbw-xfade absolute inset-0 w-full h-full object-cover"
      onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  </div>
);

const monthYear = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null;
const monthShort = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });

interface Props { onComplete: () => void; }

const PostLoginOnboarding: React.FC<Props> = ({ onComplete }) => {
  const scroller = useRef<HTMLDivElement>(null);
  const sbar = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLElement>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [mode, setMode] = useState<IntroMode>(() => readIntroMode());
  const [peeks, setPeeks] = useState<Set<string>>(new Set());
  const [selLoc, setSelLoc] = useState(INITIAL_LOCATION_SLUG);
  const [marqueeStopped, setMarqueeStopped] = useState(false);
  const [showPill, setShowPill] = useState(false);
  const [onDark, setOnDark] = useState(false);
  const [straight, setStraight] = useState(false);
  const { user } = useAuth();

  const firstName =
    (user as any)?.user_metadata?.first_name ||
    (user as any)?.user_metadata?.full_name?.split(" ")?.[0] ||
    user?.email?.split("@")?.[0] ||
    "there";

  const { brandId, holdingId, clientRole } = useUserScope();
  const { brands, holdings, sites } = useAdminData();
  const isStaff = clientRole === "ADMIN_FGB" || clientRole === "USER_FGB";
  const clientName =
    (brandId && brands.find(b => b.id === brandId)?.name) ||
    (holdingId && holdings.find(h => h.id === holdingId)?.name) ||
    (isStaff ? "FGB World" : null);
  const { data: strip } = useIntroStrip();
  const siteName = (id: string | null | undefined) => (id && sites.find(s => s.id === id)?.name) || null;
  const clientRecord = recordForClient(clientName);
  const stripCards = strip && (strip.portfolio || strip.certs || strip.latestAward || strip.energy);

  const selected = INTRO_LOCATIONS.find(l => l.slug === selLoc) ?? INTRO_LOCATIONS[0];
  const monthNow = useMemo(() => new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }), []);

  /* contatore aperture + auto-short (config, non hardcoded) */
  useEffect(() => {
    const { mode: m } = bumpIntroViews();
    setMode(prev => (prev === "skip" ? prev : m));
  }, []);

  /* Alla selezione il marquee si ferma (spec §4.2) ma RIPRENDE dopo qualche
     secondo — fermarlo per sempre sembrava un guasto (riscontro 03/09). */
  const marqueeTimer = useRef<ReturnType<typeof setTimeout>>();
  const pickLocation = (slug: string) => {
    setSelLoc(slug);
    setMarqueeStopped(true);
    clearTimeout(marqueeTimer.current);
    marqueeTimer.current = setTimeout(() => setMarqueeStopped(false), 5000);
  };
  useEffect(() => () => clearTimeout(marqueeTimer.current), []);

  const short = mode === "short";
  const sectionVisible = (key: "about" | "records" | "platform") => !short || peeks.has(key);
  const togglePeek = (key: string) =>
    setPeeks(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });

  useEffect(() => {
    const sc = scroller.current!;
    const io = new IntersectionObserver(
      es => es.forEach(e => e.isIntersecting && e.target.classList.add("in")),
      { root: sc, threshold: 0.15 },
    );
    sc.querySelectorAll(".fgbw-reveal").forEach(el => io.observe(el));

    let sbarT: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const H = sc.clientHeight, S = sc.scrollHeight, st = sc.scrollTop;
      /* barra di avanzamento */
      if (progressRef.current) progressRef.current.style.width = S > H ? (st / (S - H)) * 100 + "%" : "0%";
      /* pill scorciatoia + logo su fondo scuro */
      const ctaTop = ctaRef.current ? ctaRef.current.offsetTop : Infinity;
      const inCta = ctaTop - st < 80;
      setShowPill((st > H * 0.6 || readIntroMode() === "short") && !inCta);
      setOnDark(inCta);
      /* indicatore di scorrimento custom */
      const b = sbar.current;
      if (b) {
        if (S <= H + 1) b.style.opacity = "0";
        else {
          const th = Math.max(44, (H / S) * H);
          b.style.height = th + "px";
          b.style.transform = `translateY(${8 + (st / (S - H)) * (H - th - 16)}px)`;
          b.style.opacity = "0.55";
          clearTimeout(sbarT);
          sbarT = setTimeout(() => { if (sbar.current) sbar.current.style.opacity = "0.14"; }, 900);
        }
      }
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* Debug SOLO DEV: ?wp=NNN scrolla il container (screenshot automatici) */
    let t: ReturnType<typeof setTimeout> | undefined;
    if (import.meta.env.DEV) {
      const m = window.location.href.match(/[?&]wp=(\d+)/);
      if (m) t = setTimeout(() => {
        sc.querySelectorAll(".fgbw-reveal").forEach(el => el.classList.add("in"));
        sc.scrollTo(0, Number(m[1]));
      }, 900);
    }
    return () => {
      io.disconnect();
      sc.removeEventListener("scroll", onScroll);
      clearTimeout(sbarT);
      if (t) clearTimeout(t);
    };
    /* stripCards nelle dipendenze: la striscia monta DOPO l'arrivo dei dati
       (query asincrona) e senza ri-osservare i suoi .fgbw-reveal restavano
       a opacity 0 per sempre — sezione "sparita" (bug 03/09). */
  }, [mode, peeks, stripCards]);

  const stripRef = useRef<HTMLDivElement>(null);
  const scrollDown = () => scroller.current?.scrollBy({ top: window.innerHeight, behavior: "smooth" });
  const scrollStrip = (dir: number) =>
    stripRef.current?.scrollBy({ left: 358 * dir, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

  const onStraightChange = (checked: boolean) => {
    setStraight(checked);
    if (checked) writeIntroMode("skip");
    else writeIntroMode(short ? "short" : "full");
  };

  /* formattazione onesta dell'energia misurata */
  const meteredLabel = strip?.energy
    ? strip.energy.kwh30 >= 1e6
      ? `${(strip.energy.kwh30 / 1e6).toFixed(1)} GWh metered`
      : strip.energy.kwh30 >= 1e3
        ? `${(strip.energy.kwh30 / 1e3).toFixed(1)} MWh metered`
        : `${Math.round(strip.energy.kwh30)} kWh metered`
    : null;

  return (
    <div
      ref={scroller}
      className="fgbw-scroll fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden"
      style={{ background: PAPER, fontFamily: "'Futura','Poppins','Century Gothic',system-ui,sans-serif", color: INK }}
    >
      {/* ── chrome persistente ── */}
      <div ref={progressRef} aria-hidden style={{ position: "fixed", left: 0, top: 0, height: 2, width: 0, background: TEAL, zIndex: 90 }} />
      <div aria-hidden className="fgbw-logo" style={{ transition: "color .35s ease", color: onDark ? "#fff" : TEAL }}>
        FGB
        <span style={{ display: "block", fontSize: 9, letterSpacing: "0.08em", fontWeight: 400, color: onDark ? "#ffffff99" : SUB, marginTop: 2 }}>Future Green Building</span>
      </div>
      <button
        type="button"
        onClick={onComplete}
        className="fgbw-pill"
        style={{ opacity: showPill ? 1 : 0, transform: showPill ? "none" : "translateY(-8px)", pointerEvents: showPill ? "auto" : "none" }}
      >
        Go to the dashboard
        <b>→</b>
      </button>
      <div ref={sbar} aria-hidden style={{ position: "fixed", right: 5, top: 0, width: 5, height: 60, borderRadius: 999, background: TEAL, opacity: 0, transition: "opacity .45s ease", zIndex: 80, pointerEvents: "none" }} />

      <style>{`
        .fgbw-reveal{opacity:0;transform:translateY(18px);transition:opacity .7s ${EASE},transform .7s ${EASE}}
        .fgbw-reveal.in{opacity:1;transform:none}
        .fgbw-photo{transition:transform .6s ${EASE}}
        .fgbw-photo:hover{transform:scale(1.03)}
        .fgbw-scroll{scrollbar-width:none;-ms-overflow-style:none}
        .fgbw-scroll::-webkit-scrollbar{display:none}
        .fgbw-pill{position:fixed;right:28px;top:20px;z-index:85;display:flex;align-items:center;gap:10px;
          padding:10px 10px 10px 18px;border-radius:999px;background:rgba(255,255,255,.72);border:1px solid rgba(74,75,77,.14);
          -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);
          font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:${INK};
          transition:opacity .35s ${EASE},transform .35s ${EASE},background .2s}
        .fgbw-pill:hover{background:#fff}
        .fgbw-pill b{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:${TEAL};color:#fff;font-weight:400}
        /* Striscia a tutta larghezza: esce dalla colonna fino ai bordi del
           viewport, il primo cubotto resta allineato alla colonna e i limiti
           laterali sfumano in trasparenza (rev 03/09). */
        /* NIENTE scroll-snap: misurato in headless (03/09) — il 50% dentro
           scroll-padding si risolve sullo scrollport (= 50vw), quindi vale 0
           e lo snap aggancia la prima card al bordo del viewport: mandatory
           sempre, proximity sugli schermi stretti. Senza snap la card parte
           allineata alla colonna del titolo a ogni larghezza. */
        .fgbw-strip{display:flex;gap:18px;overflow-x:auto;scrollbar-width:none;
          margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);
          padding:6px calc(50vw - 50%) 26px;
          -webkit-mask:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent);
          mask:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}
        .fgbw-strip::-webkit-scrollbar{display:none}
        .fgbw-card{flex:0 0 clamp(320px,23vw,430px);scroll-snap-align:start;min-height:300px;border-radius:26px;padding:30px 30px 26px;position:relative;overflow:hidden;
          background:#fff;border:1px solid rgba(74,75,77,.14);display:flex;flex-direction:column;justify-content:space-between;
          transition:transform .5s ${EASE},box-shadow .5s ${EASE}}
        .fgbw-card:hover{transform:translateY(-4px);box-shadow:0 30px 60px -30px rgba(0,0,0,.25)}
        .fgbw-tag{position:absolute;right:22px;top:22px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;padding:6px 10px;border-radius:999px;background:#eeefee;color:${SUB}}
        .fgbw-xfade{animation:fgbwFade .4s ease both}
        @keyframes fgbwFade{from{opacity:0}}
        .fgbw-marquee{overflow:hidden;-webkit-mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
        .fgbw-track{display:flex;gap:40px;width:max-content;align-items:baseline;animation:fgbwMarquee 46s linear infinite}
        .fgbw-marquee:hover .fgbw-track,.fgbw-track.stopped{animation-play-state:paused}
        @keyframes fgbwMarquee{to{transform:translateX(-50%)}}
        .fgbw-newscard{border-radius:24px;overflow:hidden;background:#fff;border:1px solid #e4e7e4;transition:transform .5s ${EASE},box-shadow .5s ${EASE}}
        .fgbw-newscard:hover{transform:translateY(-4px);box-shadow:0 30px 60px -30px rgba(0,0,0,.25)}
        .fgbw-logo{position:fixed;left:36px;top:24px;z-index:85;line-height:1;font-weight:700;font-size:30px;letter-spacing:-0.03em}
        @media (prefers-reduced-motion: reduce){
          .fgbw-reveal{transition:none;opacity:1;transform:none}
          .fgbw-track{animation:none}
          .fgbw-xfade{animation:none}
        }
        /* ── mobile (blocco max-width:900px del mockup fgb-intro.html) ──
           mosaico 2x2 e collage+globo impilati arrivano dalle classi
           min-[901px]; qui il resto: card della striscia piu' strette,
           chrome rientrato, sezioni piu' compatte. */
        @media (max-width:900px){
          .fgbw-card{flex:0 0 290px;min-height:270px;padding:24px 24px 22px}
          /* le tre opzioni Monitoring (Clair/Greeny/Water) scorrono in
             orizzontale invece di impilarsi (rev 03/09) */
          .fgbw-hw{display:flex;overflow-x:auto;gap:14px;scrollbar-width:none;
            margin-left:-24px;margin-right:-24px;padding:4px 24px 14px}
          .fgbw-hw::-webkit-scrollbar{display:none}
          .fgbw-hw-card{flex:0 0 260px}
          .fgbw-logo{left:20px;top:18px;font-size:26px}
          .fgbw-pill{right:14px;top:14px;padding:8px 8px 8px 14px;font-size:11px}
          .fgbw-scroll section{padding-top:70px !important;padding-bottom:70px !important}
          .fgbw-scroll section.fgbw-hero{padding-top:0 !important;padding-bottom:0 !important}
          .fgbw-track{gap:26px}
        }
      `}</style>

      {/* ══ 1 · HERO (invariata; eyebrow personalizzato) ══ */}
      <section className="fgbw-hero min-h-[100dvh] flex flex-col items-center justify-center text-center px-6 relative">
        <div className="fgbw-reveal in">
          <Eyebrow>Hello {firstName}{clientName ? ` · ${clientName}` : ""}</Eyebrow>
          <h1 className="font-semibold tracking-tight" style={{ fontSize: "clamp(44px,7.5vw,104px)", color: INK, marginTop: 18, lineHeight: 1.04 }}>
            Welcome to <span style={{ color: TEAL }}>FGB</span>.
          </h1>
          <p style={{ fontSize: "clamp(16px,1.8vw,24px)", color: SUB, marginTop: 22 }}>
            Your path to sustainability excellence
          </p>
        </div>
        <button onClick={scrollDown} className="absolute bottom-8 flex flex-col items-center gap-1" style={{ color: SUB }}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Scroll</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </button>
      </section>

      {/* ══ 2 · FGB × CLIENTE — striscia wrapped (dati reali, fallback espliciti) ══ */}
      {stripCards && (
        <section className="px-6" style={{ paddingTop: 40, paddingBottom: 60 }}>
          <div className="max-w-[1560px] mx-auto">
            <div className="fgbw-reveal flex flex-wrap items-end justify-between gap-6">
              <div>
                <Eyebrow>FGB × {clientName ?? "you"} · {monthNow}</Eyebrow>
                <h2 className="font-semibold tracking-tight" style={{ fontSize: "clamp(30px,4vw,50px)", marginTop: 12 }}>
                  Your month, <span style={{ color: TEAL }}>in numbers.</span>
                </h2>
              </div>
              <div className="flex gap-2" aria-label="Scroll cards">
                {[-1, 1].map(d => (
                  <button key={d} type="button" onClick={() => scrollStrip(d)} aria-label={d < 0 ? "Previous" : "Next"}
                    className="w-11 h-11 rounded-full grid place-items-center"
                    style={{ border: "1px solid rgba(74,75,77,.18)", background: "#fff", fontSize: 17 }}>
                    {d < 0 ? "←" : "→"}
                  </button>
                ))}
              </div>
            </div>

            <div ref={stripRef} className="fgbw-strip fgbw-reveal" style={{ marginTop: 34 }}>
              {strip?.portfolio && (
                <div className="fgbw-card" style={{ background: "linear-gradient(160deg,#e3f2f2,#fff 70%)" }}>
                  <Eyebrow>Your portfolio</Eyebrow>
                  <div>
                    <div className="font-semibold" style={{ fontSize: 84, letterSpacing: "-0.04em", lineHeight: 1, color: TEAL, margin: "18px 0 8px" }}>
                      <Count n={strip.portfolio.sites} />
                    </div>
                    <div className="font-semibold" style={{ fontSize: 16 }}>sites covered by FGB</div>
                    <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>
                      {strip.portfolio.energy} energy · {strip.portfolio.air} air · {strip.portfolio.pipeline} in pipeline
                    </div>
                  </div>
                  <span className="fgbw-tag">Live</span>
                </div>
              )}

              {strip?.certs && (
                <div className="fgbw-card" style={{ background: "linear-gradient(160deg,#eaf6f7,#fff 70%)" }}>
                  <Eyebrow>Certifications</Eyebrow>
                  <div>
                    <div className="font-semibold" style={{ fontSize: 84, letterSpacing: "-0.04em", lineHeight: 1, color: TEAL_DARK, margin: "18px 0 8px" }}>
                      <Count n={strip.certs.achieved > 0 ? strip.certs.achieved : strip.certs.inProgress} />
                      <small style={{ fontSize: 24, fontWeight: 400, marginLeft: 6, color: SUB }}>
                        {strip.certs.achieved > 0 ? "active" : "in progress"}
                      </small>
                    </div>
                    {strip.certs.achieved > 0 ? (
                      <>
                        <div className="font-semibold" style={{ fontSize: 16 }}>
                          {strip.certs.gold} Gold · {strip.certs.platinum} Platinum
                        </div>
                        <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>
                          {strip.certs.inProgress} in progress · {strip.certs.potential} potential
                        </div>
                      </>
                    ) : (
                      <div className="font-semibold" style={{ fontSize: 16 }}>certifications advancing</div>
                    )}
                  </div>
                  <span className="fgbw-tag">Portfolio</span>
                </div>
              )}

              {strip?.latestAward && (
                <div className="fgbw-card" style={{ background: TEAL_DARK, color: "#fff", borderColor: "transparent" }}>
                  <Eyebrow light>Latest award</Eyebrow>
                  <div>
                    <div className="font-semibold" style={{ fontSize: 32, lineHeight: 1.08, margin: "18px 0 12px" }}>
                      {strip.latestAward.level || "Achieved"}
                      {siteName(strip.latestAward.siteId) ? <><br />{siteName(strip.latestAward.siteId)}</> : null}
                    </div>
                    <span className="inline-flex items-center gap-2 font-semibold rounded-full" style={{ fontSize: 12, padding: "6px 12px", background: "#9fd5d9", color: TEAL_DARK }}>
                      <Trophy className="w-3.5 h-3.5" /> {strip.latestAward.certType}
                    </span>
                    {monthYear(strip.latestAward.date) && (
                      <div style={{ fontSize: 13, color: "#ffffffa6", marginTop: 12 }}>Achieved {monthYear(strip.latestAward.date)}</div>
                    )}
                  </div>
                  <span className="fgbw-tag" style={{ background: "rgba(255,255,255,.14)", color: "#fff" }}>Award</span>
                </div>
              )}

              {strip?.energy && (
                <div className="fgbw-card" style={{ background: "linear-gradient(160deg,#fdeef0,#fff 70%)" }}>
                  <Eyebrow>Energy · {siteName(strip.energy.siteId) ?? "top site"}</Eyebrow>
                  <div>
                    {strip.energy.deltaPct != null ? (
                      <>
                        <div className="font-semibold" style={{ fontSize: 84, letterSpacing: "-0.04em", lineHeight: 1, color: WINE, margin: "18px 0 8px" }}>
                          {strip.energy.deltaPct < 0 ? "−" : "+"}
                          <Count n={Math.round(Math.abs(strip.energy.deltaPct))} />
                          <small style={{ fontSize: 24, fontWeight: 400, marginLeft: 4, color: SUB }}>%</small>
                        </div>
                        <div className="font-semibold" style={{ fontSize: 16 }}>vs the previous 30 days</div>
                      </>
                    ) : (
                      <div className="font-semibold" style={{ fontSize: 30, lineHeight: 1.1, margin: "18px 0 8px", color: WINE }}>
                        First 30 days of data
                      </div>
                    )}
                    {meteredLabel && <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>{meteredLabel}</div>}
                  </div>
                  <span className="fgbw-tag">30 days</span>
                </div>
              )}

              {strip && (
                <div className="fgbw-card">
                  <Eyebrow>Next expiry</Eyebrow>
                  <div>
                    <div className="font-semibold" style={{ fontSize: 84, letterSpacing: "-0.04em", lineHeight: 1, color: strip.expiry.count > 0 ? WINE : "#b3bab8", margin: "18px 0 8px" }}>
                      <Count n={strip.expiry.count} />
                    </div>
                    <div className="font-semibold" style={{ fontSize: 16 }}>certificates expiring in 6 months</div>
                    <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>
                      {strip.expiry.first
                        ? `First renewal: ${siteName(strip.expiry.first.siteId) ?? "—"}, ${monthShort(strip.expiry.first.date)}`
                        : strip.expiry.firstBeyond
                          ? `First renewal: ${siteName(strip.expiry.firstBeyond.siteId) ?? "—"}, ${monthShort(strip.expiry.firstBeyond.date)}`
                          : "No expiry dates on file"}
                    </div>
                  </div>
                  <span className="fgbw-tag">Expiry</span>
                </div>
              )}

              {clientRecord && (
                <div className="fgbw-card" style={{ background: TEAL_DARK, color: "#fff", borderColor: "transparent" }}>
                  <Eyebrow light>Your record</Eyebrow>
                  <div>
                    <div className="font-semibold" style={{ fontSize: 24, lineHeight: 1.25, margin: "18px 0 8px" }}>{clientRecord}</div>
                    <div style={{ fontSize: 13, color: "#ffffffa6" }}>One of FGB's 11 world records — yours.</div>
                  </div>
                  <span className="fgbw-tag" style={{ background: "rgba(255,255,255,.14)", color: "#fff" }}>World record</span>
                </div>
              )}
            </div>

            <div className="fgbw-reveal flex gap-7" style={{ fontSize: 12, color: "#a9abae" }}>
              {["Real data from your perimeter", "Updated daily"].map(s => (
                <span key={s} className="flex items-center gap-2">
                  <i style={{ width: 6, height: 6, borderRadius: 99, background: TEAL, display: "inline-block" }} />{s}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ modalità breve: capitoli a richiesta ══ */}
      {short && (
        <section className="px-6" style={{ padding: "60px 24px", borderTop: "1px solid rgba(74,75,77,.14)" }}>
          <div className="max-w-[1560px] mx-auto">
            <Eyebrow>About FGB</Eyebrow>
            <div className="flex flex-wrap gap-3" style={{ marginTop: 18 }}>
              {[
                { key: "about", b: "Who we are", s: "60+ countries, 6.000 projects" },
                { key: "records", b: "11 world records", s: "firsts and largests" },
                { key: "platform", b: "The platform", s: "hardware and reports" },
              ].map(x => (
                <button key={x.key} type="button" aria-pressed={peeks.has(x.key)} onClick={() => togglePeek(x.key)}
                  className="flex items-center gap-2 rounded-full"
                  style={{
                    padding: "12px 20px", fontSize: 13, border: `1px solid ${peeks.has(x.key) ? TEAL : "rgba(74,75,77,.18)"}`,
                    background: peeks.has(x.key) ? "#e3f2f2" : "#fff", color: INK,
                  }}>
                  <b style={{ color: TEAL, fontWeight: 600 }}>{x.b}</b> {x.s}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ 3 · WHO WE ARE — mosaico + sede→mondo + città + timeline ══ */}
      {sectionVisible("about") && (
        <section className="px-6" style={{ paddingTop: 60, paddingBottom: 100, borderTop: "1px solid rgba(74,75,77,.14)" }}>
          <div className="max-w-[1560px] mx-auto">
            <div className="fgbw-reveal">
              <Eyebrow>Who we are</Eyebrow>
              <p style={{ fontSize: "clamp(24px,3vw,38px)", lineHeight: 1.28, marginTop: 18, fontWeight: 300, maxWidth: "30ch" }}>
                FGB is an international <span style={{ color: TEAL, fontWeight: 500 }}>advisory firm</span> that assists organizations
                in achieving their ambitious goals related to climate change, sustainability and well-being.
              </p>
            </div>

            {/* mosaico duotone: foto a colori, tinta in CSS */}
            <div className="grid gap-3.5 grid-cols-2 min-[901px]:grid-cols-4" style={{ marginTop: 52 }}>
              {MOSAIC_STATS.map((s, i) => (
                <div key={s.label} className={`fgbw-reveal relative overflow-hidden`} style={{ aspectRatio: "4/5", borderRadius: 20, background: s.color, color: "#fff", isolation: "isolate", transitionDelay: `${i * 0.08}s` }}>
                  <img
                    src={s.img} alt="" loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: "grayscale(1) contrast(1.05)", mixBlendMode: "luminosity", opacity: 0.9 }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(180deg,transparent 40%,rgba(0,0,0,.28))" }} />
                  <span className="absolute grid place-items-center" style={{ left: 18, top: 18, width: 44, height: 44, borderRadius: 99, background: "#fff", color: s.color, zIndex: 2 }}>
                    {TILE_ICONS[s.icon]}
                  </span>
                  <span className="absolute" style={{ left: 22, right: 22, bottom: 20, zIndex: 2 }}>
                    <b className="block font-light" style={{ fontSize: "clamp(40px,5vw,72px)", letterSpacing: "-0.03em", lineHeight: 0.95 }}>
                      <Count n={s.n} fmt={s.fmt} />{s.suffix}
                    </b>
                    <span className="block uppercase" style={{ fontSize: 13, letterSpacing: "0.22em", marginTop: 6, opacity: 0.92 }}>{s.label}</span>
                  </span>
                </div>
              ))}
            </div>

            {/* sede selezionata → mondo (collage + globo interattivo) */}
            <div className="grid gap-10 min-[901px]:grid-cols-[1fr_1.2fr] min-[901px]:gap-12 items-center" style={{ marginTop: 90 }}>
              <div className="fgbw-reveal relative grid grid-cols-2 gap-3.5 items-end">
                <div className="grid gap-3.5">
                  <CollagePhoto src={selected.images[0]} city={selected.name} ratio="3/4" />
                </div>
                <div className="grid gap-3.5">
                  <CollagePhoto src={selected.images[1]} city={selected.name} ratio="4/5" />
                  <CollagePhoto src={selected.images[2]} city={selected.name} ratio="3/4" />
                </div>
                <div className="absolute font-bold uppercase" style={{ left: 0, bottom: "44%", zIndex: 2, background: TEAL_DARK, color: "#fff", fontSize: 20, letterSpacing: "0.28em", padding: "10px 18px 10px 22px", borderRadius: "0 999px 999px 0" }}>
                  {selected.name}
                  {selected.subtitle && (
                    <span className="block" style={{ fontSize: 9, letterSpacing: "0.24em", fontWeight: 400, opacity: 0.75, marginTop: 2 }}>{selected.subtitle}</span>
                  )}
                </div>
              </div>
              <div className="fgbw-reveal">
                <IntroGlobe selectedSlug={selLoc} onSelect={pickLocation} />
                <div style={{ marginTop: 22 }}>
                  <p style={{ fontSize: 19, fontWeight: 300, lineHeight: 1.4, maxWidth: "38ch" }}>
                    Thanks to a team of <span style={{ color: TEAL, fontWeight: 500 }}>global specialists</span>, FGB sets up and
                    supervises projects with the <span style={{ color: TEAL, fontWeight: 500 }}>same high quality</span> all over the world.
                  </p>
                  <div className="flex gap-10" style={{ marginTop: 20 }}>
                    <div>
                      <b className="block font-semibold" style={{ fontSize: 38, letterSpacing: "-0.03em", lineHeight: 1 }}><Count n={INTRO_LOCATIONS.length} /></b>
                      <span className="block uppercase" style={{ fontSize: 11, letterSpacing: "0.28em", color: SUB, marginTop: 6 }}>Strategic locations</span>
                    </div>
                    <div>
                      <b className="block font-semibold" style={{ fontSize: 38, letterSpacing: "-0.03em", lineHeight: 1 }}>1</b>
                      <span className="block uppercase" style={{ fontSize: 11, letterSpacing: "0.28em", color: SUB, marginTop: 6 }}>Standard of quality</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* marquee città — anche selettore (le sedi sull'emisfero nascosto) */}
            <div className="fgbw-reveal fgbw-marquee" style={{ marginTop: 56 }} aria-label="Locations">
              <div className={`fgbw-track ${marqueeStopped ? "stopped" : ""}`}>
                {[0, 1].map(dup => (
                  <React.Fragment key={dup}>
                    {INTRO_LOCATIONS.map(l => {
                      const on = l.slug === selLoc;
                      return (
                        <button
                          key={`${dup}-${l.slug}`}
                          type="button"
                          aria-pressed={on}
                          aria-hidden={dup === 1}
                          tabIndex={dup === 1 ? -1 : 0}
                          onClick={() => pickLocation(l.slug)}
                          className="uppercase font-semibold whitespace-nowrap"
                          style={{
                            fontSize: l.hub ? 25 : 19, letterSpacing: "0.2em", background: "none", border: 0, padding: 0,
                            color: on ? TEAL : l.hub ? TEAL_DARK : "#b3bab8", cursor: "pointer",
                            transition: "color .3s ease",
                          }}
                        >
                          {l.name}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* timeline */}
            <div className="fgbw-reveal flex flex-wrap items-center" style={{ gap: "10px clamp(18px,3vw,40px)", marginTop: 48 }}>
              {TIMELINE.map((s, i) => (
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
      )}

      {/* ══ 4 · WORLD RECORDS (invariata) ══ */}
      {sectionVisible("records") && (
        <section className="px-6 py-24" style={{ background: "#eeefee" }}>
          <div className="max-w-[1560px] mx-auto fgbw-reveal">
            <Eyebrow>Setting global standards</Eyebrow>
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4" style={{ marginTop: 26 }}>
              <div className="font-semibold" style={{ fontSize: "clamp(72px,10vw,140px)", color: TEAL, lineHeight: 0.9 }}>11</div>
              <div style={{ paddingBottom: 10 }}>
                <div className="font-semibold" style={{ fontSize: "clamp(22px,2.6vw,34px)", color: INK }}>world records</div>
                <p style={{ fontSize: 15, color: SUB, marginTop: 4, maxWidth: 460 }}>
                  Firsts and largests that redefined what certified buildings can be.
                </p>
              </div>
            </div>
            <Disc open={recordsOpen} onClick={() => setRecordsOpen(v => !v)}>View our records</Disc>
            <Fold open={recordsOpen}>
              <div className="grid gap-x-10 gap-y-6" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", paddingTop: 38 }}>
                {RECORDS.map((r, i) => (
                  <div key={r.title} style={{ borderTop: "1px solid #dfe3e0", paddingTop: 14 }}>
                    <div className="flex items-baseline gap-3">
                      <span className="tabular-nums font-semibold" style={{ color: TEAL, fontSize: 13 }}>{String(i + 1).padStart(2, "0")}</span>
                      <div>
                        <div className="font-semibold" style={{ fontSize: 16, color: INK, lineHeight: 1.3 }}>{r.title}</div>
                        <div style={{ fontSize: 13, color: SUB, marginTop: 4 }}>{r.detail}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Fold>
          </div>
        </section>
      )}

      {/* ══ 5 · PLATFORM — l'espandibile assorbe hardware e compliance ══ */}
      {sectionVisible("platform") && (
        <section className="px-6 py-24" style={{ background: "#ffffff" }}>
          <div className="max-w-[1560px] mx-auto">
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

            <div className="fgbw-reveal" style={{ marginTop: 44, textAlign: "center" }}>
              <img src="/landing/profile/laptop.webp" alt="FGB Monitoring System — Your Sustainable Space dashboard" loading="lazy" className="inline-block w-full" style={{ maxWidth: 780 }} />
            </div>

            <div className="fgbw-reveal" style={{ textAlign: "center", marginTop: 8 }}>
              <Disc open={platformOpen} onClick={() => setPlatformOpen(v => !v)}>Discover the platform</Disc>
              <Fold open={platformOpen}>
                <div style={{ paddingTop: 34, textAlign: "left", display: "grid", gap: 28 }}>
                  <div className="grid gap-8 min-[901px]:grid-cols-2 items-start">
                    <div>
                      <div className="font-semibold" style={{ fontSize: 20, color: INK }}>Create your own report</div>
                      <p style={{ fontSize: 14, color: SUB, marginTop: 6 }}>Actual vs average, device consumption, power breakdown — ready to share.</p>
                      <img src="/landing/profile/report.webp" alt="Report widgets" loading="lazy" className="w-full" style={{ marginTop: 14 }} />
                    </div>
                    <div>
                      <div className="font-semibold" style={{ fontSize: 20, color: INK }}>Check your metrics</div>
                      <p style={{ fontSize: 14, color: SUB, marginTop: 6 }}>Air quality index and core metrics, on any device.</p>
                      <img src="/landing/profile/tablet.webp" alt="Metrics on tablet and phone" loading="lazy" className="w-full" style={{ marginTop: 14 }} />
                    </div>
                  </div>

                  {/* hardware: Clair · Greeny · Water — su mobile scorrono
                      in orizzontale a dito (rev 03/09), su desktop griglia */}
                  <div className="fgbw-hw grid gap-6 min-[901px]:grid-cols-3">
                    {[
                      { img: "/landing/clair.webp", name: "Clair", claim: "Air — for indoor air quality control", points: ["Wellness boost", "Healthy workplace", "Positive environment"] },
                      { img: "/landing/greeny.webp", name: "Greeny", claim: "Energy — for energy efficiency", points: ["Improve operations", "Find inefficiency", "Control your portfolio"] },
                      { img: "/landing/pillar-water.webp", name: "Water", claim: "Every drop, tracked", points: ["Flow, leaks and waste", "Spotted live", "Before they hit the bill"] },
                    ].map(h => (
                      <div key={h.name} className="fgbw-hw-card rounded-3xl overflow-hidden" style={{ background: PAPER, border: "1px solid #e4e7e4" }}>
                        <div className="flex items-center justify-center" style={{ height: 190, background: "#fff" }}>
                          <img src={h.img} alt={h.name} className="fgbw-photo" style={{ maxHeight: 165, maxWidth: "78%", objectFit: "contain" }}
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        </div>
                        <div style={{ padding: "20px 24px 24px" }}>
                          <div className="font-semibold" style={{ fontSize: 23, color: TEAL_DARK }}>{h.name}</div>
                          <div style={{ fontSize: 14, color: INK, marginTop: 2 }}>{h.claim}</div>
                          <ul style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 5 }}>
                            {h.points.map(p => (
                              <li key={p} className="flex items-center gap-2" style={{ fontSize: 13.5, color: SUB }}>
                                <span aria-hidden style={{ color: TEAL, fontSize: 11 }}>✦</span>{p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* compliance: da sezione a pannello dentro l'espandibile */}
                  <div className="rounded-3xl" style={{ border: "1px solid #e4e7e4", background: "#fff", padding: 28 }}>
                    <Eyebrow>Leading authority for certifications</Eyebrow>
                    <div className="font-semibold" style={{ fontSize: 22, marginTop: 10 }}>
                      Our data creates your <span style={{ color: TEAL }}>compliance</span>.
                    </div>
                    <p style={{ fontSize: 14, color: SUB, marginTop: 4 }}>One data flow feeding every framework.</p>
                    <div className="flex flex-wrap gap-2" style={{ marginTop: 16 }}>
                      {["LEED", "WELL", "BREEAM", "GRESB", "Fitwel", "ESG", "EU Taxonomy", "Envision", "LCA", "LIFE"].map(f => (
                        <span key={f} className="rounded-full" style={{ fontSize: 12, letterSpacing: "0.1em", padding: "7px 14px", border: "1px solid rgba(74,75,77,.16)", color: SUB }}>{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </Fold>
            </div>
          </div>
        </section>
      )}

      {/* ══ 6 · NEWS ══ */}
      <section className="px-6 py-24" style={{ background: PAPER }}>
        <div className="max-w-[1560px] mx-auto">
          <div className="fgbw-reveal">
            <Eyebrow>News from FGB</Eyebrow>
            <h2 className="font-semibold tracking-tight" style={{ fontSize: "clamp(24px,3vw,38px)", marginTop: 14 }}>
              What's new in our world
            </h2>
          </div>
          <div className="grid gap-6 min-[901px]:grid-cols-3" style={{ marginTop: 36 }}>
            {NEWS.map((n, i) => (
              <article key={n.title} className="fgbw-reveal fgbw-newscard" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="flex items-center justify-center" style={{ height: 170, background: "#fff" }}>
                  <img src={n.img} alt="" loading="lazy" style={{ maxHeight: 150, maxWidth: "82%", objectFit: "contain" }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div style={{ padding: "18px 22px 24px" }}>
                  <div className="uppercase font-semibold" style={{ fontSize: 10, letterSpacing: "0.22em", color: TEAL }}>{n.tag}</div>
                  <div className="font-semibold" style={{ fontSize: 17, marginTop: 6, lineHeight: 1.3 }}>{n.title}</div>
                  <p style={{ fontSize: 13.5, color: SUB, marginTop: 6, lineHeight: 1.55 }}>{n.line}</p>
                  <time className="block uppercase" style={{ fontSize: 11, letterSpacing: "0.18em", color: "#a9abae", marginTop: 14 }}>{n.date}</time>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 7 · JOIN FGB WORLD (invariata + preferenza scorciatoia) ══ */}
      <section ref={ctaRef} className="relative overflow-hidden min-h-[92dvh] flex flex-col items-center justify-center text-center px-6" style={{ background: "#0d2530" }}>
        {/* pattern di fondo col marchio (rev 03/09): tile leggerissimo che
            sfuma verso i bordi, il contenuto resta protagonista */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "url(/pwa-512x512.png)",
            backgroundSize: "140px 140px",
            opacity: 0.05,
            WebkitMaskImage: "radial-gradient(80% 80% at 50% 45%, #000 30%, transparent 100%)",
            maskImage: "radial-gradient(80% 80% at 50% 45%, #000 30%, transparent 100%)",
          }}
        />
        <div className="fgbw-reveal relative">
          <Eyebrow light>The choice is yours</Eyebrow>
          <h2 className="font-semibold tracking-tight text-white" style={{ fontSize: "clamp(36px,5.5vw,72px)", marginTop: 18 }}>
            Join <span style={{ color: "#7ad8d2" }}>FGB World</span>
          </h2>

          <div className="flex flex-wrap justify-center max-[900px]:flex-col max-[900px]:items-center" style={{ gap: 22, marginTop: 54 }}>
            <a
              href="https://www.fgb-studio.com" target="_blank" rel="noopener noreferrer"
              className="group flex flex-col items-center justify-center rounded-3xl"
              style={{ width: "min(300px,80vw)", padding: "34px 20px", border: "1.5px solid rgba(159,213,217,0.45)", color: "#e8ecec", transition: `all .35s ${EASE}`, textDecoration: "none" }}
            >
              <span className="font-semibold uppercase inline-flex items-center gap-2" style={{ fontSize: 22, letterSpacing: "0.12em" }}>
                Advisory <ArrowUpRight className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </span>
              <span className="uppercase" style={{ fontSize: 11, letterSpacing: "0.25em", color: "#9fb4b4", marginTop: 10 }}>Certifications</span>
            </a>

            <button
              type="button" onClick={onComplete}
              className="group flex flex-col items-center justify-center rounded-3xl"
              style={{ width: "min(300px,80vw)", padding: "34px 20px", background: TEAL, color: "#fff", boxShadow: "0 24px 60px -18px rgba(0,145,147,.55)", transition: `all .35s ${EASE}` }}
            >
              <span className="font-semibold uppercase inline-flex items-center gap-2" style={{ fontSize: 22, letterSpacing: "0.12em" }}>
                Monitoring <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </span>
              <span className="uppercase" style={{ fontSize: 11, letterSpacing: "0.25em", color: "#d3f1ef", marginTop: 10 }}>Energy · Air</span>
            </button>
          </div>

          <label className="fgbw-reveal flex items-center justify-center gap-2.5" style={{ marginTop: 44, fontSize: 12, color: "rgba(255,255,255,.45)", cursor: "pointer" }}>
            <input type="checkbox" checked={straight} onChange={e => onStraightChange(e.target.checked)} style={{ accentColor: TEAL }} />
            Take me straight to the dashboard next time
          </label>
        </div>
      </section>
    </div>
  );
};

export default PostLoginOnboarding;
