"use client";

/**
 * OverviewMobileView — vista overview sito per schermi mobile.
 *
 * Sezioni immersive a scorrimento verticale con snap: hero (score complessivo),
 * una schermata per modulo (energy/air/water) con l'edificio colorato, e la
 * schermata finale con fingerprint + alert.
 *
 * IMPORTANTE: è un componente di sola PRESENTAZIONE. Tutti i valori arrivano
 * già calcolati da OverviewSection, che resta l'unica fonte della logica: le
 * due viste non devono mai poter divergere sui numeri mostrati al cliente.
 *
 * Scroll verticale e non carosello orizzontale: la vista sito è già dentro un
 * carosello che intercetta gli swipe orizzontali.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Zap, Wind, Droplet, AlertTriangle, Award, Cloud, ArrowLeft } from "lucide-react";
import { hapticLight } from "@/lib/native";
import type { DeviceFamily, SiteDeviceGroup } from "@/hooks/useSiteDevices";
import { performanceColor, ratioFromLimit, ratioFromScore } from "@/lib/gradientColor";
import ExplainSheet from "@/components/dashboard/ExplainSheet";

type StatusLevel = "GOOD" | "OK" | "WARNING" | "CRITICAL" | "NO_DATA";

interface ModuleStatus {
  score: number;
  level: StatusLevel;
  isLive: boolean;
}

interface OverviewMobileViewProps {
  siteName: string;
  city?: string;
  outdoorTemp?: number;
  /** Umidità esterna reale — compare nel cielo della facciata Energy (§5.4.1) */
  outdoorHumidity?: number;
  periodLabel: string;
  overall: ModuleStatus;
  energy: ModuleStatus;
  air: ModuleStatus;
  water: ModuleStatus;
  moduleConfig: {
    energy: { enabled: boolean };
    air: { enabled: boolean };
    water: { enabled: boolean };
  };
  /** kW attuali per categoria, già risolti (reali o ripartiti) */
  power: {
    total?: number;
    hvac?: number;
    lighting?: number;
    plugs?: number;
    other?: number;
  };
  energyAvgKw?: number;
  energyLimitKw?: number;
  airMetrics: {
    co2?: number;
    avgCo2?: number;
    co2Limit?: number;
    temperature?: number;
    humidity?: number;
    voc?: number;
    pm25?: number;
  };
  waterFlow?: number;
  /** Facciata Water §10.3: riassunto del contatore (litri oggi, notte, picco…) */
  waterFacade?: {
    todayLiters?: number; typicalLiters?: number; nightMin?: number;
    peakLmin?: number; pressureBar?: number; weekM3?: number; isDemo: boolean;
  };
  alerts: { criticalCount: number; warningCount: number; infoCount?: number; list: Array<{ title: string; module?: string; device?: string; ago?: string; severity?: string }> };
  /** Trust layer §10.5: affidabilità sensori (schermata «Alert e sensori») */
  sensorHealth?: { score: number; offline: number; flatline: number; flapping: number; offlineNames: string[] };
  /** Store senza dispositivi: hero con parole giuste al posto di 0/100 */
  notInstalled?: boolean;
  /** Certificazioni edificio ottenute (pill Award) */
  certCount?: number;
  verdictHeadline?: string;
  /** Livello cert piu alto raggiunto: scala Certified→Platinum nell'hero */
  certTopLevel?: string | null;
  isRealData: boolean;
  onNavigate?: (tab: string) => void;
  /** chiude il dettaglio sito e torna alla mappa (16/10) */
  onExit?: () => void;
  /** dispositivi installati, per la rotazione nell'hero (§5.2) */
  deviceGroups?: SiteDeviceGroup[];
  /** Certificazioni attive del sito (LEED, BREEAM, ...): sezione grigia dedicata */
  certifications?: string[];
  /** Dettaglio certificazioni ottenute (livelli, punti, rinnovo — §5.4) */
  certDetails?: { type: string; level: string | null; score?: number | null; targetScore?: number | null; expiry?: string | null }[];
}

// Loghi ufficiali già presenti in public/ (stessi path di SiteMarker).
// Le certificazioni senza logo (ISO, energy audit) mostrano il nome.
const CERT_LOGOS: Record<string, string> = {
  LEED: "/leed_logo.webp",
  WELL: "/well_logo.webp",
  BREEAM: "/breeam_logo.webp",
};

const VERDICT_KEY: Record<StatusLevel, string> = {
  GOOD: "ovm.v_good",
  OK: "ovm.v_fair",
  WARNING: "ovm.v_attention",
  CRITICAL: "ovm.v_critical",
  NO_DATA: "ovm.v_nodata",
};



/** Anello dello score complessivo. */
const ScoreRing = ({ score, dash, label }: { score: number; dash?: boolean; label: string }) => {
  const r = 68;
  const circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 164 164" className="w-[164px] h-[164px]" aria-hidden="true">
      <circle cx="82" cy="82" r={r} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="10" />
      <circle
        cx="82" cy="82" r={r} fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={dash ? circ : circ * (1 - Math.max(0, Math.min(100, score)) / 100)}
        transform="rotate(-90 82 82)"
      />
      <text x="82" y="90" textAnchor="middle" fontSize="44" fontWeight="700" fill="#ffffff">{dash ? "—" : score}</text>
      <text x="82" y="110" textAnchor="middle" fontSize="10" letterSpacing="4" fill="rgba(255,255,255,.75)">{label}</text>
    </svg>
  );
};

/** Fascia con le condizioni esterne al sito, sopra l'edificio. */
const Outdoor = ({ city, temp, extra, outdoorLabel }: { city?: string; temp?: number; extra?: string; outdoorLabel: string }) => (
  <div className="relative overflow-hidden flex-shrink-0 px-5 pt-10 pb-9 text-center text-[#01565b] bg-gradient-to-b from-white via-[#eef8f9] to-[#9fd5d9]">
    <div className="text-[11px] font-bold tracking-[0.26em] opacity-70">
      {(city || outdoorLabel).toUpperCase()}{city ? ` · ${outdoorLabel}` : ""}
    </div>
    <div className="text-[17px] font-semibold mt-1 flex items-center justify-center gap-1.5">
      <Cloud className="w-4 h-4 opacity-80" aria-hidden="true" />
      {typeof temp === "number" ? `${Math.round(temp)}°` : "—"}{extra ? ` · ${extra}` : ""}
    </div>
    {/* Forma del cornicione (§5.4): UN solo volume tecnico sul tetto, a
        sinistra (≈ x 18–43, alto ~16px), appoggiato sul parapetto. */}
    <div
      aria-hidden="true"
      className="absolute bottom-0 pointer-events-none opacity-[0.22]"
      style={{ left: 18, width: 25, height: 16, background: "#01565b", borderRadius: "2px 2px 0 0" }}
    />
  </div>
);

/** Icona del modulo in cerchio sottile: identifica la sezione a colpo d'occhio. */
const ModuleMark = ({ icon: Icon, label, light }: { icon: typeof Zap; label: string; light?: boolean }) => (
  <div
    className={`w-12 h-12 rounded-full flex items-center justify-center border-[1.5px] ${
      light ? "border-[#01474b]/50" : "border-white/65"
    }`}
    aria-label={label}
  >
    <Icon className="w-5 h-5" />
  </div>
);

/** Riga valori periodo/limite/percentuale sotto il verdetto. */
const ValueRow = ({
  items, light,
}: {
  items: Array<{ value: string; unit?: string; label: string; color?: string }>;
  light?: boolean;
}) => (
  <div className="flex items-stretch justify-center mt-4">
    {items.map((it, i) => (
      <div
        key={it.label}
        className={`px-4 flex flex-col justify-end ${
          i > 0 ? (light ? "border-l border-[#01474b]/25" : "border-l border-white/30") : ""
        }`}
      >
        <span className="text-[21px] font-bold leading-tight" style={it.color ? { color: it.color } : undefined}>
          {it.value}
          {it.unit && <em className="not-italic text-[11px] font-semibold opacity-80 ml-0.5">{it.unit}</em>}
        </span>
        <small className="text-[11px] tracking-[0.18em] opacity-70 font-bold mt-0.5">{it.label}</small>
      </div>
    ))}
  </div>
);

/** Misuratori sottili (§5.4.5): valore, barra 30×5 riempita in %, etichetta. */
const MeterRow = ({ items, light, ink }: { items: Array<{ label: string; value: string; pct?: number }>; light?: boolean; ink?: string }) => (
  <div className="grid grid-cols-4 gap-2 mb-4 w-full max-w-[300px]">
    {items.map(it => (
      <div key={it.label} className="flex flex-col items-center">
        <span className="text-[14px] font-medium tabular-nums" style={ink ? { color: ink } : undefined}>{it.value}</span>
        <span className="block rounded-[3px] mt-1" style={{ width: 30, height: 5, background: light ? "rgba(1,71,75,.18)" : "rgba(255,255,255,.25)" }}>
          {typeof it.pct === "number" && (
            <span className="block h-full rounded-[3px]" style={{ width: `${Math.max(0, Math.min(100, it.pct))}%`, background: ink || (light ? "#0b5357" : "#fff") }} />
          )}
        </span>
        <span className="text-[11px] tracking-[0.12em] uppercase opacity-70 font-semibold mt-1">{it.label}</span>
      </div>
    ))}
  </div>
);

/** Barra della posizione rispetto al limite impostato. */
const LimitBar = ({ ratio, light }: { ratio: number; light?: boolean }) => (
  <div className="w-[150px] mx-auto mt-3.5">
    <div className="h-[5px] rounded-full relative bg-gradient-to-r from-[#009193] via-[#f9cace] to-[#931841]">
      <div
        className={`absolute -top-[3.5px] w-[3px] h-3 rounded-sm ${light ? "bg-[#01474b]" : "bg-white"}`}
        style={{ left: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
      />
    </div>
  </div>
);

/* ── Hero «device-first» (brief §5.2, mockup v2 approvato 12/10) ── */

/** Gradiente e accento dell'hero secondo il giudizio (token §1.4). */
const HERO_TONES: Record<string, { c1: string; c2: string; acc: string }> = {
  GOOD: { c1: "#0d6b6d", c2: "#0b3437", acc: "#3fd0d2" },
  OK: { c1: "#7a5a12", c2: "#2f240b", acc: "#f2b84b" },
  WARNING: { c1: "#7a5a12", c2: "#2f240b", acc: "#f2b84b" },
  CRITICAL: { c1: "#6b1638", c2: "#2c0c1a", acc: "#e5577a" },
  NO_DATA: { c1: "#2a3a3e", c2: "#141c1e", acc: "#9fb0b0" },
};

/** Colori delle sotto-sezioni dell'hero (mockup §5.2). */
const HERO_MODULE_COLOR: Record<string, string> = {
  energy: "#f2b84b",
  air: "#3fd0d2",
  water: "#7fb2ff",
};

/** Scala a tacche dello score: finestra min · score · max (mockup: 70·85·100). */
const TickScale = ({ value, acc }: { value: number; acc: string }) => {
  const min = Math.max(0, Math.floor((value - 15) / 10) * 10);
  const max = Math.min(100, min + 30);
  const N = 29;
  const pos = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const activeIdx = Math.round(pos * (N - 1));
  return (
    <div className="mt-6 max-w-[270px]">
      <div className="relative flex justify-between items-end text-[12px] opacity-70 mb-1.5" style={{ height: 26 }}>
        <span className="tabular-nums">{min}</span>
        <span
          className="absolute -translate-x-1/2 text-[21px] font-bold tabular-nums text-white"
          style={{ left: `${pos * 100}%`, opacity: 1 }}
        >
          {value}
        </span>
        <span className="tabular-nums">{max}</span>
      </div>
      <div className="flex items-end justify-between" aria-hidden="true" style={{ height: 22 }}>
        {Array.from({ length: N }, (_, i) => (
          <span
            key={i}
            style={{
              width: i === activeIdx ? 3 : 1.4,
              height: i === activeIdx ? 22 : i % 5 === 0 ? 16 : 11,
              background: i === activeIdx ? acc : "rgba(255,255,255,.55)",
              boxShadow: i === activeIdx ? `0 0 8px ${acc}` : undefined,
              borderRadius: 2,
            }}
          />
        ))}
      </div>
    </div>
  );
};

/** Scala dei livelli certificazione col marker sul più alto raggiunto. */
const CERT_LEVELS = ["Certified", "Silver", "Gold", "Platinum"];
const LevelScale = ({ top, acc }: { top: string; acc: string }) => {
  const idx = Math.max(0, CERT_LEVELS.findIndex(l => l.toLowerCase() === top.toLowerCase()));
  const N = 25;
  const activeIdx = Math.round((idx / (CERT_LEVELS.length - 1)) * (N - 1));
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-[11px] mb-1">
        {CERT_LEVELS.map((l, i) => (
          <span key={l} className={i === idx ? "font-bold text-white" : "opacity-55"}>{l}</span>
        ))}
      </div>
      <div className="flex items-end justify-between" aria-hidden="true" style={{ height: 15 }}>
        {Array.from({ length: N }, (_, i) => (
          <span
            key={i}
            style={{
              width: i === activeIdx ? 3 : 1.3,
              height: i === activeIdx ? 15 : 9,
              background: i === activeIdx ? acc : "rgba(255,255,255,.5)",
              boxShadow: i === activeIdx ? `0 0 8px ${acc}` : undefined,
              borderRadius: 2,
            }}
          />
        ))}
      </div>
    </div>
  );
};

/** Modulo non installato: una sola riga in trasparenza al posto della
    schermata intera (brief §5.3). snap-none: lo scroll la attraversa. */
const NotMonitoredRow = ({ text }: { text: string }) => (
  <section className="snap-none shrink-0 flex items-center justify-center bg-[#01474b]" style={{ minHeight: 56 }}>
    <span className="text-white/30 text-[12px] font-bold tracking-[0.18em] uppercase">{text}</span>
  </section>
);

/**
 * Indicatore di posizione fra le schermate: sostituisce la scrollbar di
 * sistema, che sul WebView si materializzava come una banda opaca sul bordo
 * destro (la regola globale in index.css le dà una larghezza esplicita, quindi
 * occupa spazio invece di stare in overlay).
 */
const ScrollDots = ({ count, active, light }: { count: number; active: number; light?: boolean }) => (
  <div
    aria-hidden="true"
    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-[5px] pointer-events-none"
  >
    {Array.from({ length: count }, (_, i) => (
      <span
        key={i}
        className={`w-[3px] rounded-full transition-all duration-300 ${
          i === active
            ? `h-4 ${light ? "bg-[#01474b]/80" : "bg-white/90"}`
            : `h-[3px] ${light ? "bg-[#01474b]/35" : "bg-white/40"}`
        }`}
      />
    ))}
  </div>
);

const CtaGlass = ({ children, onClick, light }: { children: React.ReactNode; onClick?: () => void; light?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full max-w-[250px] min-h-[44px] py-3.5 rounded-full font-bold text-[11px] tracking-[0.14em] transition-all active:scale-[0.98] backdrop-blur-md border shadow-lg ${
      light
        ? "text-[#01474b] bg-white/40 border-[#01474b]/25"
        : "text-white bg-white/[0.16] border-white/40"
    }`}
  >
    {children}
  </button>
);

/**
 * Hero (§5.2): il dispositivo a rotazione fra quelli DAVVERO installati.
 * Un frame ogni 5 s con dissolvenza e micro-scala — abbastanza lento da
 * leggere l'etichetta, abbastanza vivo da notarlo. Con un solo gruppo non
 * ruota; senza dispositivi non esiste. `prefers-reduced-motion`: resta
 * fermo sul primo.
 */
const DeviceRotator = ({ groups, installedLabel, onPick }: {
  groups: SiteDeviceGroup[];
  installedLabel: (n: number) => string;
  onPick?: (family: DeviceFamily) => void;
}) => {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(true);
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (groups.length < 2 || reduce) return;
    const id = setInterval(() => {
      setShown(false);
      setTimeout(() => {
        setI(v => (v + 1) % groups.length);
        setShown(true);
      }, 420);
    }, 5000);
    return () => clearInterval(id);
  }, [groups.length, reduce]);
  if (groups.length === 0) return null;
  const g = groups[Math.min(i, groups.length - 1)];
  return (
    <button
      type="button"
      onClick={() => { hapticLight(); onPick?.(g.family); }}
      className="absolute flex flex-col items-center"
      /* sotto la riga meteo, all'altezza del giudizio: «più piccolo, così
         non compete con il giudizio» (atlante §5.2) */
      style={{ right: 10, top: "calc(var(--sat, 0px) + 116px)", width: 104, zIndex: 4 }}
      aria-label={`${g.label} · ${installedLabel(g.count)}`}
    >
      <img
        src={g.img} alt="" aria-hidden
        className="object-contain"
        style={{
          height: 86, maxWidth: 96,
          opacity: shown ? 1 : 0,
          transform: shown ? "scale(1)" : "scale(.94)",
          transition: reduce ? undefined : "opacity .42s ease, transform .42s cubic-bezier(.2,.7,.2,1)",
        }}
      />
      <span
        className="block"
        aria-hidden
        style={{ width: 62, height: 10, background: "radial-gradient(ellipse at center, rgba(0,0,0,.22) 0%, rgba(0,0,0,0) 68%)", marginTop: -4, opacity: shown ? 1 : 0, transition: reduce ? undefined : "opacity .42s ease" }}
      />
      <span
        style={{
          fontSize: 9.5, lineHeight: 1.25, marginTop: 3, color: "rgba(255,255,255,.88)",
          opacity: shown ? 1 : 0, transition: reduce ? undefined : "opacity .42s ease",
        }}
      >
        <b style={{ fontWeight: 700 }}>{g.label}</b>
        <br />
        {installedLabel(g.count)}
      </span>
    </button>
  );
};

/** Sezione a piena altezza: fascia esterna + edificio col contenuto del modulo. */
const ModuleScreen = ({
  city, outdoorTemp, outdoorExtra, outdoorLabel, icon, label, verdict, scoreLine,
  values, limitRatio, big, bigUnit, bigColor, rows, meters, ctaLabel, onCta, light, buildingClass, pitch,
  centerContent, onExplain, explainLabel, ink, deviceImg,
}: any) => (
  <section data-screen className="h-full snap-start snap-always flex flex-col shrink-0">
    <Outdoor city={city} temp={outdoorTemp} extra={outdoorExtra} outdoorLabel={outdoorLabel} />
    <div
      className={`flex-1 flex flex-col items-center text-center relative -mt-[26px] px-5 pt-11 pb-16 ${buildingClass} ${
        light ? "text-[#01474b]" : "text-white"
      }`}
      style={{ clipPath: "polygon(0 26px, 7% 0, 93% 0, 100% 26px, 100% 100%, 0 100%)" }}
    >
      {/* linea di soffitto: dà profondità all'interno dell'edificio */}
      <div
        aria-hidden="true"
        className={`absolute top-0 left-0 right-0 h-[26px] ${light ? "bg-white/70" : "bg-white/40"}`}
        style={{ clipPath: "polygon(0 26px, 7% 0, 93% 0, 100% 26px, 93% 12px, 7% 12px)" }}
      />
      <div className="relative flex flex-col items-center w-full h-full">
        <ModuleMark icon={icon} label={label} light={light} />

        {pitch ? (
          <div className="my-auto py-2">
            <div className="text-[26px] font-bold leading-tight text-balance">{pitch.title}</div>
            <div className="text-[12.5px] opacity-85 mt-2.5 max-w-[230px] mx-auto leading-relaxed">{pitch.body}</div>
          </div>
        ) : (
          <>
            <div className="text-[31px] font-bold leading-tight mt-3 flex items-center justify-center gap-2">
              {verdict}
              {onExplain && (
                <button
                  type="button"
                  onClick={onExplain}
                  aria-label={explainLabel}
                  className="grid place-items-center"
                  style={{ width: 44, height: 44, margin: "-12px -12px -12px -6px" }}
                >
                  {/* cerchio ~20px, bordo 1.4, colore testo al 70% (§5.4.2) */}
                  <span aria-hidden className="grid place-items-center rounded-full font-semibold"
                    style={{ width: 20, height: 20, fontSize: 12, border: `1.4px solid ${light ? "rgba(1,71,75,.7)" : "rgba(255,255,255,.7)"}`, opacity: .85 }}>
                    ?
                  </span>
                </button>
              )}
            </div>
            <div className="text-[11px] opacity-75 tracking-wide">{scoreLine}</div>
            {values && <ValueRow items={values} light={light} />}
            {typeof limitRatio === "number" && <LimitBar ratio={limitRatio} light={light} />}
            {/* Centro della facciata (§5.4.3): il dispositivo che misura —
                render ufficiale ~120px con ombra ellittica a terra — oppure
                il contenuto dedicato (loghi cert), poi il valore live grande. */}
            <div className="my-auto py-2 w-full flex flex-col items-center">
              {deviceImg && (
                /* il render respira (6 s, fermo con prefers-reduced-motion)
                   e l'ombra si stringe quando sale: l'immagine statica
                   sembrava un ritaglio incollato */
                <div className="flex flex-col items-center" aria-hidden="true">
                  <img
                    src={deviceImg}
                    alt=""
                    loading="lazy"
                    className="object-contain animate-hw-float motion-reduce:animate-none"
                    style={{ height: "clamp(72px, 14svh, 120px)", maxWidth: 190 }}
                  />
                  <span
                    className="block -mt-1 animate-hw-shadow motion-reduce:animate-none"
                    style={{ width: 104, height: 14, background: "radial-gradient(ellipse at center, rgba(0,0,0,.18) 0%, rgba(0,0,0,0) 68%)" }}
                  />
                </div>
              )}
              {centerContent}
              {big != null && (
                <div className={deviceImg || centerContent ? "mt-3" : undefined}>
                  <div className="text-[64px] font-bold leading-none tracking-tight" style={bigColor ? { color: bigColor } : undefined}>
                    {big}
                  </div>
                  <div className="text-[11px] tracking-[0.26em] font-bold opacity-75 mt-2">{bigUnit}</div>
                </div>
              )}
            </div>
            {meters && meters.length > 0 ? (
              <MeterRow items={meters} light={light} ink={ink} />
            ) : rows && rows.length > 0 ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-4 text-[12.5px] w-full max-w-[250px]">
                {rows.map((r: any) => (
                  <div
                    key={r.label}
                    className={`flex justify-between py-1.5 border-b ${light ? "border-[#01474b]/20" : "border-white/20"}`}
                  >
                    <span>{r.label}</span>
                    <b className="font-bold">{r.value}</b>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}

        {onExplain && !pitch ? (
          <div className="flex gap-2.5 w-full max-w-[320px]">
            <button
              type="button"
              onClick={onExplain}
              className={`flex-1 min-h-[44px] rounded-full font-bold text-[10px] tracking-[0.14em] whitespace-nowrap border transition-all active:scale-[0.98] ${
                light ? "text-[#01474b] border-[#01474b]/30" : "text-white border-white/35"
              }`}
            >
              ⓘ {explainLabel}
            </button>
            <button
              type="button"
              onClick={onCta}
              className={`flex-1 min-h-[44px] rounded-full font-bold text-[10px] tracking-[0.14em] whitespace-nowrap backdrop-blur-md border shadow-lg transition-all active:scale-[0.98] ${
                light ? "text-[#01474b] bg-white/45 border-[#01474b]/25" : "text-white bg-white/[0.16] border-white/40"
              }`}
            >
              {ctaLabel}
            </button>
          </div>
        ) : (
          <CtaGlass onClick={onCta} light={light}>{ctaLabel}</CtaGlass>
        )}
      </div>
    </div>
  </section>
);

export const OverviewMobileView = ({
  siteName, city, outdoorTemp, outdoorHumidity, periodLabel, overall, energy, air, water, moduleConfig,
  power, energyAvgKw, energyLimitKw, airMetrics, waterFlow, waterFacade, alerts, sensorHealth, notInstalled, certCount = 0,
  verdictHeadline, isRealData, onNavigate, onExit, deviceGroups, certifications, certTopLevel, certDetails,
}: OverviewMobileViewProps) => {
  const { t, language } = useLanguage();
  // Numeri localizzati (brief §2.3): «12,4» in it/fr/es, «12.4» in en
  const nf1 = useMemo(() => new Intl.NumberFormat(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), [language]);
  const nf0 = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 0 }), [language]);
  const fmt = (v?: number, digits = 1) =>
    typeof v === "number" && Number.isFinite(v) ? (digits === 0 ? nf0 : nf1).format(v) : "—";
  const fmtInt = (v?: number) =>
    typeof v === "number" && Number.isFinite(v) ? nf0.format(Math.round(v)) : "—";
  /** Sostituisce {n} e i marcatori di plurale della chiave. */
  const tn = (key: string, n: number) => t(key)
    .replace("{n}", nf0.format(n))
    .split("{s_it2}").join(n === 1 ? "a" : "e")
    .split("{s_it}").join(n === 1 ? "e" : "i")
    .split("{s_es}").join(n === 1 ? "" : "es")
    .split("{s}").join(n === 1 ? "" : "s");
  const outdoorLabel = t("ovm.outdoor");
  /** Variante approvata §5.4: facciata ambra quando il giudizio del modulo
      è Fair (OK). Per Poor il bordeaux è ancora da confermare (§8.4). */
  const FAIR = { buildingClass: "bg-gradient-to-b from-[#f2dcae] to-[#e3c487]", light: true, ink: "#5b3d0c" };

  /* ── Certificazioni (§5.4): rinnovo più vicino come «valore live» e
     misuratori a punti (72/110). Il mockup dice «next audit»: in DB esiste
     solo expiry_date, quindi l'etichetta parla di rinnovo — non si inventa. */
  const certRenewal = useMemo(() => {
    const future = (certDetails || [])
      .map(c => (c.expiry ? new Date(c.expiry) : null))
      .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()) && d.getTime() > Date.now())
      .sort((a, b) => a.getTime() - b.getTime())[0];
    if (!future) return null;
    const months = Math.max(0, Math.round((future.getTime() - Date.now()) / (30.44 * 86400e3)));
    const label = new Intl.DateTimeFormat(language, { month: "short" }).format(future).replace(/\.$/, "");
    return {
      big: `${label.charAt(0).toUpperCase() + label.slice(1)} ’${String(future.getFullYear()).slice(2)}`,
      months,
    };
  }, [certDetails, language]);
  const certMeters = useMemo(() => {
    const rows = (certDetails || []).filter(c => typeof c.score === "number");
    if (rows.length === 0) return undefined;
    return rows.slice(0, 4).map(c => {
      const target = typeof c.targetScore === "number" && c.targetScore > 0 ? c.targetScore : undefined;
      const asPct = !target && (c.score as number) <= 100;
      return {
        label: target ? `${c.type} PT` : c.type,
        value: target ? `${nf0.format(c.score as number)}/${nf0.format(target)}` : asPct ? `${nf0.format(c.score as number)}%` : nf0.format(c.score as number),
        pct: target ? ((c.score as number) / target) * 100 : asPct ? (c.score as number) : undefined,
      };
    });
  }, [certDetails, nf0]);
  const energyRatio = ratioFromLimit(power.total, energyLimitKw);
  const energyPct = energyLimitKw ? Math.round(energyRatio * 100) : undefined;
  const airRatio = ratioFromLimit(airMetrics.avgCo2 ?? airMetrics.co2, airMetrics.co2Limit);
  const airPct = airMetrics.co2Limit ? Math.round(airRatio * 100) : undefined;

  /** Stati di modulo (brief §5.3): derivati dalle INSTALLAZIONI, mai
      dall'assenza di dati. `enabled` viene dai flag sites.module_* (accesi
      dall'assegnazione dei device): non installato = flag spento; offline =
      installato ma senza dati recenti (level NO_DATA). Un sito offline non
      deve mai apparire «non installato». */
  type ModState = "active" | "not_installed" | "offline";
  const stateOf = (enabled: boolean, level: StatusLevel): ModState =>
    !enabled ? "not_installed" : level === "NO_DATA" ? "offline" : "active";

  const modules = [
    { key: "energy", icon: Zap, score: energy.score, enabled: moduleConfig.energy.enabled, level: energy.level, state: stateOf(moduleConfig.energy.enabled, energy.level) },
    { key: "air", icon: Wind, score: air.score, enabled: moduleConfig.air.enabled, level: air.level, state: stateOf(moduleConfig.air.enabled, air.level) },
    { key: "water", icon: Droplet, score: water.score, enabled: moduleConfig.water.enabled, level: water.level, state: stateOf(moduleConfig.water.enabled, water.level) },
  ];

  // Tono dell'hero secondo il giudizio; il motivo prende l'icona del modulo
  // attivo che pesa di piu (score piu basso) — brief §5.2.
  const heroTone = HERO_TONES[notInstalled ? "NO_DATA" : overall.level] ?? HERO_TONES.GOOD;
  const worstActive = modules.filter(m => m.state === "active").sort((a, b) => a.score - b.score)[0];
  const ReasonIcon = worstActive?.icon;

  /** Nota transitoria al tap su un modulo non installato (brief §5.3). */
  const [moduleNote, setModuleNote] = useState(false);
  const noteTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(noteTimer.current), []);
  const showModuleNote = () => {
    setModuleNote(true);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setModuleNote(false), 2500);
  };

  const hasCerts = !!certifications && certifications.length > 0;
  // Schermate a piena altezza: hero + moduli INSTALLATI + [cert] + alert.
  // I moduli non installati sono righe compatte (brief §5.3) e non contano.
  const fullModules = modules.filter(m => m.state !== "not_installed");
  const screenCount = 1 + fullModules.length + (hasCerts ? 1 : 0) + 1;
  // unica schermata a fondo chiaro (aria): i puntini vanno scuri
  const AIR_INDEX = moduleConfig.air.enabled
    ? 1 + (moduleConfig.energy.enabled ? 1 : 0)
    : -1;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeScreen, setActiveScreen] = useState(0);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  // Foglio «Dati spiegati» (§5.5): quale scheda aprire, null = chiuso
  const [explainTab, setExplainTab] = useState<string | null>(null);
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || !el.clientHeight) return;
    // le righe compatte dei moduli non installati rompono l'assunto
    // «ogni sezione è alta una schermata»: si usa la posizione reale
    const tops: number[] = [];
    el.querySelectorAll("[data-screen]").forEach(n => tops.push((n as HTMLElement).offsetTop));
    if (tops.length === 0) return;
    let best = 0;
    tops.forEach((tp, i) => { if (Math.abs(tp - el.scrollTop) < Math.abs(tops[best] - el.scrollTop)) best = i; });
    setActiveScreen(prev => (prev === best ? prev : best));
  }, []);

  return (
    <div className="relative h-full">
      <ScrollDots count={screenCount} active={activeScreen} light={activeScreen === AIR_INDEX} />
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth motion-reduce:scroll-auto no-scrollbar"
      >
      {/* ── 1 · HERO: score complessivo ── */}
      {/* pb-16: clearance per la barra periodo/report/settings in overlay */}
      <section
        data-screen
        className="relative h-full snap-start snap-always shrink-0 flex flex-col text-left text-white px-6 pt-10 pb-16 overflow-hidden"
        style={{ background: `linear-gradient(180deg, ${heroTone.c1} 0%, ${heroTone.c2} 26%, #0a0f11 52%, #050809 100%)` }}
      >
        {/* intestazione: nome sito + condizioni (niente Live/Online/Month,
            brief §5.2 — il periodo resta nella barra comandi in basso).
            16/10: il ritorno alla mappa era affidato al solo gesto di
            sistema; nel browser non esiste, quindi c'è una freccia. */}
        {onExit && (
          <button
            type="button"
            onClick={() => { hapticLight(); onExit(); }}
            aria-label={t("ovm.back_to_map")}
            className="absolute grid place-items-center rounded-full"
            style={{
              top: "calc(var(--sat, 0px) + 8px)", left: 10, width: 40, height: 40,
              background: "rgba(255,255,255,.14)", backdropFilter: "blur(6px)", color: "#fff", zIndex: 5,
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        {/* §5.2: il dispositivo a rotazione, piccolo, a destra — non
            compete col giudizio e dice cosa è installato davvero */}
        {deviceGroups && deviceGroups.length > 0 && (
          <DeviceRotator
            groups={deviceGroups}
            installedLabel={n => tn("ovm.installed_n", n)}
            onPick={family => onNavigate?.(family)}
          />
        )}
        <div className="font-bold text-[19px] tracking-wide" style={{ marginLeft: onExit ? 44 : 0 }}>{siteName}</div>
        <div className="text-[11px] opacity-80 tracking-[0.08em] flex items-center gap-1.5 mt-0.5">
          <Cloud className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{(city || "").toUpperCase()}</span>
          {typeof outdoorTemp === "number" && <span>· {Math.round(outdoorTemp)}°</span>}
        </div>

        {/* 1 · cuore: giudizio grande, motivo, scala a tacche */}
        <div className="mt-8">
          <div style={{ fontSize: 62, fontWeight: 300, lineHeight: 1.02, letterSpacing: "-0.01em" }}>
            {notInstalled ? (certCount > 0 ? t("ovm.certified") : t("ovm.not_monitored")) : t(VERDICT_KEY[overall.level])}
          </div>
          <div className="flex items-center gap-2 text-[12.5px] opacity-85 mt-2.5">
            {ReasonIcon && !notInstalled && <ReasonIcon className="w-4 h-4 shrink-0" style={{ color: heroTone.acc }} aria-hidden="true" />}
            <span>
              {notInstalled
                ? (certCount > 0 ? tn("ovm.certs_no_monitoring", certCount) : t("ovm.no_devices"))
                : (verdictHeadline || t("ovm.overall_line").replace("{s}", String(overall.score)))}
            </span>
          </div>
        </div>

        {!notInstalled && <TickScale value={overall.score} acc={heroTone.acc} />}

        {/* 2 · sotto-sezioni: moduli + alert, stati §5.3 */}
        <div className="mt-auto pt-5 border-t border-white/10 flex items-start justify-between gap-2">
          {modules.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => (m.state === "not_installed" ? showModuleNote() : onNavigate?.(m.key))}
              className={`text-left transition-transform active:scale-95 ${m.state === "not_installed" ? "opacity-30" : ""}`}
            >
              <div className="text-[27px] tabular-nums leading-tight" style={{ fontWeight: 300 }}>
                {m.state === "active" ? m.score : "—"}
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: HERO_MODULE_COLOR[m.key] }}>
                <span className="relative inline-flex">
                  <m.icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {m.state === "offline" && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                      style={{ background: "#f59e0b", border: "1.2px solid #fff" }}
                    />
                  )}
                </span>
                <span className="capitalize">{t(`ovm.${m.key}`).toLowerCase()}</span>
              </div>
            </button>
          ))}
          <div className="text-left">
            <div className="text-[27px] tabular-nums leading-tight" style={{ fontWeight: 300, color: alerts.criticalCount + alerts.warningCount > 0 ? "#ffcf7a" : undefined }}>
              {alerts.criticalCount + alerts.warningCount}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#9fe3c8" }}>
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="capitalize">{t("ovm.alerts").toLowerCase()}</span>
            </div>
          </div>
        </div>

        {/* 3 · awards: conteggio + scala Certified → Platinum */}
        <div className="mt-6 mb-1 flex items-end gap-5">
          <button
            type="button"
            onClick={() => onNavigate?.("certification")}
            className={`text-left shrink-0 transition-transform active:scale-95 ${certCount > 0 ? "" : "opacity-40"}`}
          >
            <div className="text-[34px] tabular-nums leading-none" style={{ fontWeight: 300 }}>
              {certCount > 0 ? certCount : "—"}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold mt-1" style={{ color: "#f2b84b" }}>
              <Award className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t("ovm.awards")}</span>
            </div>
          </button>
          {certCount > 0 && certTopLevel && <LevelScale top={certTopLevel} acc={heroTone.acc} />}
        </div>

        {moduleNote && (
          <div className="absolute left-8 right-8 bottom-24 z-10 text-[12px] text-white bg-[#01474b]/90 rounded-full px-4 py-2.5 shadow-lg">
            {t("ovm.module_not_installed")}
          </div>
        )}

        <div className="opacity-65 text-[11px] tracking-[0.24em] pt-3 text-center">
          {t("ovm.scroll")}
          <span className="block text-[13px] motion-safe:animate-bounce">▾</span>
        </div>
      </section>

      {/* ── 2 · ENERGY (riga compatta se non installato, brief §5.3) ── */}
      {modules[0].state === "not_installed" ? (
        <NotMonitoredRow text={t("ovm.not_monitored_row").replace("{m}", t("ovm.energy"))} />
      ) : (
      <ModuleScreen
        city={city} outdoorTemp={outdoorTemp} outdoorLabel={outdoorLabel}
        /* §5.4.1: il cielo racconta il fuori col dato che spiega il modulo —
           per l'energia l'umidità relativa (clima → carico HVAC) */
        outdoorExtra={typeof outdoorHumidity === "number" ? `${t("ovm.rh")} ${nf0.format(outdoorHumidity)}%` : undefined}
        deviceImg="/intro/hw-greeny.webp"
        icon={Zap} label={t("ovm.energy")}
        buildingClass={energy.level === "OK" ? FAIR.buildingClass : "bg-gradient-to-b from-[#028084] to-[#016368]"}
        light={energy.level === "OK" ? true : undefined}
        ink={energy.level === "OK" ? FAIR.ink : undefined}
        onExplain={moduleConfig.energy.enabled ? () => setExplainTab("power") : undefined}
        explainLabel={t("ovm.explain")}
        verdict={t(VERDICT_KEY[energy.level])}
        scoreLine={t("ovm.score_line").replace("{s}", String(energy.score))}
        values={moduleConfig.energy.enabled ? [
          { value: fmt(energyAvgKw), unit: "kW", label: t("ovm.avg_period").replace("{p}", periodLabel.toUpperCase()) },
          { value: energyLimitKw ? fmt(energyLimitKw, 0) : "—", unit: energyLimitKw ? "kW" : undefined, label: t("ovm.limit_set") },
          {
            value: energyPct != null ? String(energyPct) : "—", unit: energyPct != null ? "%" : undefined,
            label: t("ovm.of_limit"), color: energyPct != null ? performanceColor(energyRatio, "dark") : undefined,
          },
        ] : undefined}
        limitRatio={energyLimitKw ? energyRatio : undefined}
        big={fmt(power.total)}
        bigUnit={t("ovm.current_load")}
        // Senza dati niente colore di performance: un "—" bordeaux sembrerebbe
        // un allarme invece che assenza di telemetria
        bigColor={energy.level !== "NO_DATA" && power.total != null
          ? performanceColor(energyLimitKw ? energyRatio : ratioFromScore(energy.score), "dark")
          : undefined}
        meters={[power.hvac, power.lighting, power.plugs, power.other].some(v => typeof v === "number") ? [
          { label: t("ovm.row_hvac"), value: fmt(power.hvac), pct: power.total ? ((power.hvac ?? 0) / power.total) * 100 : undefined },
          { label: t("ovm.row_lighting"), value: fmt(power.lighting), pct: power.total ? ((power.lighting ?? 0) / power.total) * 100 : undefined },
          { label: t("ovm.row_plugs"), value: fmt(power.plugs), pct: power.total ? ((power.plugs ?? 0) / power.total) * 100 : undefined },
          { label: t("ovm.row_other"), value: fmt(power.other), pct: power.total ? ((power.other ?? 0) / power.total) * 100 : undefined },
        ] : undefined}
        pitch={!moduleConfig.energy.enabled ? { title: t("ovm.pitch_energy_t"), body: t("ovm.pitch_energy_b") } : undefined}
        ctaLabel={moduleConfig.energy.enabled ? t("ovm.cta_energy") : t("ovm.cta_ask")}
        onCta={() => moduleConfig.energy.enabled && onNavigate?.("energy")}
      />
      )}

      {/* ── 3 · AIR (edificio chiaro: testi scuri) ── */}
      {modules[1].state === "not_installed" ? (
        <NotMonitoredRow text={t("ovm.not_monitored_row").replace("{m}", t("ovm.air"))} />
      ) : (
      <ModuleScreen
        light
        city={city} outdoorTemp={outdoorTemp} outdoorLabel={outdoorLabel}
        /* §5.4.1 prevede qui la pill con l'AQI esterno: il provider meteo
           (weather_data) non lo fornisce — non si inventa (§8.3) */
        deviceImg="/intro/hw-clair.webp"
        icon={Wind} label={t("ovm.air")}
        buildingClass={air.level === "OK" ? FAIR.buildingClass : "bg-gradient-to-b from-[#b7e0e3] to-[#9fd5d9]"}
        ink={air.level === "OK" ? FAIR.ink : undefined}
        onExplain={moduleConfig.air.enabled ? () => setExplainTab("co2") : undefined}
        explainLabel={t("ovm.explain")}
        verdict={t(VERDICT_KEY[air.level])}
        scoreLine={t("ovm.iaq_line").replace("{s}", String(air.score))}
        values={moduleConfig.air.enabled ? [
          { value: fmtInt(airMetrics.avgCo2), unit: "ppm", label: t("ovm.avg_co2") },
          { value: airMetrics.co2Limit ? fmtInt(airMetrics.co2Limit) : "—", unit: airMetrics.co2Limit ? "ppm" : undefined, label: t("ovm.limit_set") },
          {
            value: airPct != null ? String(airPct) : "—", unit: airPct != null ? "%" : undefined,
            label: t("ovm.of_limit"), color: airPct != null ? performanceColor(airRatio, "light") : undefined,
          },
        ] : undefined}
        limitRatio={airMetrics.co2Limit ? airRatio : undefined}
        big={air.level === "NO_DATA" ? "—" : String(air.score)}
        bigUnit={t("ovm.iaq_now")}
        bigColor={air.level !== "NO_DATA" ? performanceColor(ratioFromScore(air.score), "light") : undefined}
        meters={[
          { label: t("ovm.row_temp"), value: airMetrics.temperature != null ? `${fmt(airMetrics.temperature)}°` : "—", pct: airMetrics.temperature != null ? (airMetrics.temperature / 40) * 100 : undefined },
          { label: t("ovm.row_humidity"), value: airMetrics.humidity != null ? `${fmtInt(airMetrics.humidity)}%` : "—", pct: airMetrics.humidity ?? undefined },
          /* scala 0–600 come il grafico TVOC desktop (limite 500 ppb) */
          { label: "TVOC", value: fmtInt(airMetrics.voc), pct: airMetrics.voc != null ? Math.min(100, (airMetrics.voc / 600) * 100) : undefined },
          { label: "PM2.5", value: fmtInt(airMetrics.pm25), pct: airMetrics.pm25 != null ? Math.min(100, (airMetrics.pm25 / 35) * 100) : undefined },
        ]}
        pitch={!moduleConfig.air.enabled ? { title: t("ovm.pitch_air_t"), body: t("ovm.pitch_air_b") } : undefined}
        ctaLabel={moduleConfig.air.enabled ? t("ovm.cta_air") : t("ovm.cta_ask")}
        onCta={() => moduleConfig.air.enabled && onNavigate?.("air")}
      />
      )}

      {/* ── 4 · WATER ── */}
      {modules[2].state === "not_installed" ? (
        <NotMonitoredRow text={t("ovm.not_monitored_row").replace("{m}", t("ovm.water"))} />
      ) : (
      <ModuleScreen
        city={city} outdoorTemp={outdoorTemp} outdoorLabel={outdoorLabel}
        deviceImg="/intro/hw-water.webp"
        icon={Droplet} label={t("ovm.water")}
        buildingClass="bg-gradient-to-b from-[#02a3a5] to-[#009193]"
        /* §10.3: verdetto dal consumo di oggi vs media dello stesso giorno —
           «Normale · consumo in linea con i giorni simili» */
        verdict={waterFacade?.todayLiters != null && waterFacade?.typicalLiters
          ? (Math.abs((waterFacade.todayLiters - waterFacade.typicalLiters) / waterFacade.typicalLiters) > 0.2 ? t("ovm.v_attention") : t("md.v_normal"))
          : t(VERDICT_KEY[water.level])}
        scoreLine={waterFacade?.todayLiters != null && waterFacade?.typicalLiters
          ? t("md.volume_in_line")
          : t("ovm.score_line").replace("{s}", String(water.score))}
        onExplain={moduleConfig.water.enabled ? () => setExplainTab("wflow") : undefined}
        explainLabel={t("ovm.explain")}
        /* riga valori: litri di oggi · media dello stesso giorno · perdite */
        values={moduleConfig.water.enabled && waterFacade && (waterFacade.todayLiters != null || waterFacade.typicalLiters != null) ? [
          { value: waterFacade.todayLiters != null ? nf0.format(waterFacade.todayLiters) : "—", unit: "L", label: t("ovm.today_lbl") },
          { value: waterFacade.typicalLiters != null ? nf0.format(waterFacade.typicalLiters) : "—", unit: "L", label: t("ovm.weekday_avg_lbl") },
          { value: nf0.format(alerts.list.filter(a => /water|leak|acqua|perdita/i.test(a.title)).length), label: t("ovm.leaks_lbl") },
        ] : undefined}
        big={fmt(waterFlow)}
        bigUnit={t("ovm.current_flow")}
        bigColor={water.level !== "NO_DATA" && waterFlow != null
          ? performanceColor(ratioFromScore(water.score), "dark")
          : undefined}
        /* misuratori del contatore (§10.3): niente distribuzione per uso finale */
        meters={moduleConfig.water.enabled && waterFacade ? [
          { label: t("ovm.night_min_lbl"), value: waterFacade.nightMin != null ? nf1.format(waterFacade.nightMin) : "—", pct: waterFacade.nightMin != null ? Math.min(100, (waterFacade.nightMin / 2) * 100) : undefined },
          { label: t("ovm.peak_lmin_lbl"), value: waterFacade.peakLmin != null ? nf0.format(waterFacade.peakLmin) : "—", pct: waterFacade.peakLmin != null ? Math.min(100, (waterFacade.peakLmin / 30) * 100) : undefined },
          { label: "Bar", value: waterFacade.pressureBar != null ? nf1.format(waterFacade.pressureBar) : "—", pct: waterFacade.pressureBar != null ? Math.min(100, (waterFacade.pressureBar / 6) * 100) : undefined },
          { label: t("ovm.week_m3_lbl"), value: waterFacade.weekM3 != null ? nf1.format(waterFacade.weekM3) : "—", pct: undefined },
        ] : undefined}
        pitch={!moduleConfig.water.enabled ? { title: t("ovm.pitch_water_t"), body: t("ovm.pitch_water_b") } : undefined}
        ctaLabel={moduleConfig.water.enabled ? t("ovm.cta_water") : t("ovm.cta_ask")}
        onCta={() => moduleConfig.water.enabled && onNavigate?.("water")}
      />
      )}

      {/* ── 4b · CERTIFICATIONS (grigio, solo se presenti) ── */}
      {certifications && certifications.length > 0 && (
        <ModuleScreen
          city={city} outdoorTemp={outdoorTemp} outdoorLabel={outdoorLabel}
          icon={Award} label={t("ovm.cta_cert").replace(" →", "")}
          buildingClass="bg-gradient-to-b from-[#7d8a8f] to-[#5c696e]"
          verdict={t("ovm.certified")}
          scoreLine={tn("ovm.active_certs", certifications.length)}
          onExplain={() => setExplainTab("leed")}
          explainLabel={t("ovm.explain")}
          values={certDetails && certDetails.filter(c => c.level).length > 0
            ? certDetails.filter(c => c.level).slice(0, 3).map(c => ({
                value: String(c.level).length > 8 ? String(c.level).slice(0, 5) + "." : String(c.level),
                label: c.type,
              }))
            : undefined}
          centerContent={
            /* §5.4.3: niente dispositivo — i tre loghi ufficiali in FILA,
               tile bianche ~78pt, raggio 16, ombra leggera (mockup v2) */
            <div className="flex items-center justify-center gap-3 px-2">
              {certifications.slice(0, 3).map((c) => (
                <div
                  key={c}
                  className="flex items-center justify-center bg-white p-2.5"
                  style={{ width: 78, height: 78, borderRadius: 16, boxShadow: "0 6px 16px rgba(0,0,0,.18)" }}
                >
                  {CERT_LOGOS[c] ? (
                    <img src={CERT_LOGOS[c]} alt={c} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-[11px] font-bold text-[#5c696e] text-center leading-tight">
                      {c.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          }
          /* Valore live (§5.4.4): il rinnovo più vicino, stile «Mar ’27» */
          big={certRenewal?.big}
          bigUnit={certRenewal ? tn("ovm.next_renewal", certRenewal.months) : undefined}
          meters={certMeters}
          ctaLabel={t("ovm.cta_cert")}
          onCta={() => onNavigate?.("certification")}
        />
      )}

      {/* ── 5 · ALERT E SENSORI (§10.5): gravità + lista, poi il Trust layer
             del PC — spiega al cliente perché un grafico ha un buco ── */}
      <section data-screen className="h-full snap-start snap-always shrink-0 flex flex-col text-white px-6 pt-12 pb-16 bg-gradient-to-b from-[#016368] to-[#01474b] overflow-y-auto no-scrollbar">
        <div className="flex items-center gap-2 justify-center">
          <AlertTriangle className="w-6 h-6 opacity-80" aria-hidden="true" />
          <h4 className="m-0 text-[11px] font-bold tracking-[0.3em] opacity-75 uppercase">{t("ovm.alerts_sensors")}</h4>
        </div>

        {/* conteggi per gravità */}
        <div className="grid grid-cols-3 gap-3 text-center mt-5 w-full max-w-[290px] mx-auto">
          {[
            { n: alerts.criticalCount, label: t("ovm.sev_critical"), hot: alerts.criticalCount > 0 },
            { n: alerts.warningCount, label: t("ovm.sev_medium"), warn: alerts.warningCount > 0 },
            { n: alerts.infoCount ?? 0, label: t("ovm.sev_low") },
          ].map((x, i) => (
            <div key={i}>
              <div className={`text-[24px] font-bold tabular-nums ${x.hot ? "text-[#f9cace]" : x.warn ? "text-[#f2b84b]" : ""}`}>{nf0.format(x.n)}</div>
              <div className="text-[10.5px] opacity-70 tracking-wide">{x.label}</div>
            </div>
          ))}
        </div>

        <div className="w-full max-w-[290px] mx-auto text-left text-[12.5px] mt-4">
          {alerts.list.length === 0 ? (
            <div className="opacity-70 text-center py-3 text-[12px]">{t("ovm.no_alerts")}</div>
          ) : (
            (showAllAlerts ? alerts.list : alerts.list.slice(0, 3)).map((a, i) => (
              <div key={i} className="py-2 border-b border-white/15">
                <span className={`block ${a.severity === "critical" ? "text-[#f9cace]" : ""}`}>{a.title}</span>
                <span className="block text-[11px] opacity-65 mt-0.5">
                  {[a.module, a.device, a.ago ? `${t("ovm.since")} ${a.ago}` : null].filter(Boolean).join(" · ")}
                </span>
              </div>
            ))
          )}
          {alerts.list.length > 3 && !showAllAlerts && (
            <button type="button" onClick={() => setShowAllAlerts(true)}
              className="w-full text-center py-2.5 font-bold text-[11px] tracking-[0.14em] uppercase opacity-85" style={{ minHeight: 44 }}>
              {t("ovm.cta_alerts")}
            </button>
          )}
        </div>

        {/* Trust layer (§10.5): affidabilità dei sensori */}
        {sensorHealth && (
          <div className="w-full max-w-[290px] mx-auto mt-6 pt-4 border-t border-white/20">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-bold tracking-[0.18em] uppercase opacity-80">{t("ovm.sensor_trust")}</span>
              <span className="text-[22px] font-bold tabular-nums">{nf0.format(sensorHealth.score)}<em className="not-italic text-[12px] opacity-70 font-normal">/100</em></span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center mt-3">
              {[
                { n: sensorHealth.offline, label: t("ovm.offline_lbl"), warn: sensorHealth.offline > 0 },
                { n: sensorHealth.flatline, label: t("ovm.flatline_lbl"), warn: sensorHealth.flatline > 0 },
                { n: sensorHealth.flapping, label: t("ovm.flapping_lbl") },
              ].map((x, i) => (
                <div key={i}>
                  <div className={`text-[20px] font-bold tabular-nums ${x.warn ? "text-[#f2b84b]" : ""}`}>{nf0.format(x.n)}</div>
                  <div className="text-[10.5px] opacity-70">{x.label}</div>
                </div>
              ))}
            </div>
            {/* i dati del sensore offline MANCANO dai grafici, non vengono stimati */}
            {sensorHealth.offline > 0 && sensorHealth.offlineNames.length > 0 && (
              <p className="text-[11.5px] opacity-80 mt-3 leading-relaxed">
                {t("ovm.offline_note").replace("{names}", sensorHealth.offlineNames.join(", "))}
              </p>
            )}
          </div>
        )}
      </section>
      </div>

      {/* Foglio «Dati spiegati» (§5.5): schede, livelli e «ADESSO» */}
      <ExplainSheet
        tab={explainTab}
        onClose={() => setExplainTab(null)}
        onTab={setExplainTab}
        current={{
          iaq: air.level !== "NO_DATA" ? air.score : undefined,
          co2: airMetrics.avgCo2 ?? airMetrics.co2,
          temp: airMetrics.temperature,
          humidity: airMetrics.humidity,
          tvoc: airMetrics.voc,
          pm25: airMetrics.pm25,
          power: power.total,
        }}
        currentCertLevel={{
          leed: certDetails?.find(c => c.type === "LEED")?.level ?? undefined,
          well: certDetails?.find(c => c.type === "WELL")?.level ?? undefined,
          breeam: certDetails?.find(c => c.type === "BREEAM")?.level ?? undefined,
        }}
      />
    </div>
  );
};

export default OverviewMobileView;
