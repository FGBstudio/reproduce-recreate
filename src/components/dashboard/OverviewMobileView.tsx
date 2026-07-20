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

import { Zap, Wind, Droplet, AlertTriangle, Award, Cloud } from "lucide-react";
import { performanceColor, ratioFromLimit, ratioFromScore } from "@/lib/gradientColor";

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
  alerts: { criticalCount: number; warningCount: number; list: Array<{ title: string; ago?: string; severity?: string }> };
  fingerprintAxes: Record<string, { label: string; value: number }>;
  verdictHeadline?: string;
  isRealData: boolean;
  onNavigate?: (tab: string) => void;
  /** Certificazioni attive del sito (LEED, BREEAM, ...): sezione grigia dedicata */
  certifications?: string[];
}

// Loghi ufficiali già presenti in public/ (stessi path di SiteMarker).
// Le certificazioni senza logo (ISO, energy audit) mostrano il nome.
const CERT_LOGOS: Record<string, string> = {
  LEED: "/leed_logo.webp",
  WELL: "/well_logo.webp",
  BREEAM: "/breeam_logo.webp",
};

const VERDICT: Record<StatusLevel, string> = {
  GOOD: "Good",
  OK: "Fair",
  WARNING: "Attention",
  CRITICAL: "Critical",
  NO_DATA: "No data",
};

const fmt = (v?: number, digits = 1) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";
const fmtInt = (v?: number) =>
  typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : "—";

/** Anello dello score complessivo. */
const ScoreRing = ({ score }: { score: number }) => {
  const r = 68;
  const circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 164 164" className="w-[164px] h-[164px]" aria-hidden="true">
      <circle cx="82" cy="82" r={r} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="10" />
      <circle
        cx="82" cy="82" r={r} fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.max(0, Math.min(100, score)) / 100)}
        transform="rotate(-90 82 82)"
      />
      <text x="82" y="90" textAnchor="middle" fontSize="44" fontWeight="700" fill="#ffffff">{score}</text>
      <text x="82" y="110" textAnchor="middle" fontSize="10" letterSpacing="4" fill="rgba(255,255,255,.75)">SCORE</text>
    </svg>
  );
};

/** Radar del fingerprint, colori chiari su fondo teal scuro. */
const FingerprintRadar = ({ axes }: { axes: OverviewMobileViewProps["fingerprintAxes"] }) => {
  const entries = Object.values(axes);
  const cx = 105, cy = 84, R = 58;
  const pt = (i: number, f: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / entries.length;
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f];
  };
  const poly = (f: number) => entries.map((_, i) => pt(i, f).join(",")).join(" ");
  return (
    <svg viewBox="0 0 210 158" className="w-[210px] h-[158px]" aria-hidden="true">
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={poly(f)} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1" />
      ))}
      {entries.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,.25)" strokeWidth="1" />;
      })}
      <polygon
        points={entries.map((e, i) => pt(i, Math.max((e.value || 0) / 100, 0.04)).join(",")).join(" ")}
        fill="rgba(159,213,217,.30)" stroke="#9fd5d9" strokeWidth="1.6"
      />
      {entries.map((e, i) => {
        const [x, y] = pt(i, 1.24);
        return (
          <text key={e.label} x={x} y={y} textAnchor="middle" fontSize="7.5" letterSpacing="1.5" fill="rgba(255,255,255,.75)">
            {e.label.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
};

/** Fascia con le condizioni esterne al sito, sopra l'edificio. */
const Outdoor = ({ city, temp, extra }: { city?: string; temp?: number; extra?: string }) => (
  <div className="relative overflow-hidden flex-shrink-0 px-5 pt-10 pb-9 text-center text-[#01565b] bg-gradient-to-b from-white via-[#eef8f9] to-[#9fd5d9]">
    <div className="text-[9px] font-bold tracking-[0.26em] opacity-70">
      {(city || "OUTDOOR").toUpperCase()}{city ? " · OUTDOOR" : ""}
    </div>
    <div className="text-[17px] font-semibold mt-1 flex items-center justify-center gap-1.5">
      <Cloud className="w-4 h-4 opacity-80" aria-hidden="true" />
      {typeof temp === "number" ? `${Math.round(temp)}°` : "—"}{extra ? ` · ${extra}` : ""}
    </div>
    {/* skyline: i "comignoli" appoggiati sulla linea del tetto (come nel mockup) */}
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-9 opacity-[0.16] pointer-events-none"
      style={{
        background: [
          "linear-gradient(#01565b,#01565b) 5% 100%/24px 32px no-repeat",
          "linear-gradient(#01565b,#01565b) 20% 100%/16px 20px no-repeat",
          "linear-gradient(#01565b,#01565b) 70% 100%/28px 26px no-repeat",
          "linear-gradient(#01565b,#01565b) 86% 100%/14px 15px no-repeat",
        ].join(", "),
      }}
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
        <small className="text-[7.5px] tracking-[0.18em] opacity-70 font-bold mt-0.5">{it.label}</small>
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

const CtaGlass = ({ children, onClick, light }: { children: React.ReactNode; onClick?: () => void; light?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full max-w-[250px] py-3.5 rounded-full font-bold text-[10.5px] tracking-[0.14em] transition-all active:scale-[0.98] backdrop-blur-md border shadow-lg ${
      light
        ? "text-[#01474b] bg-white/40 border-[#01474b]/25"
        : "text-white bg-white/[0.16] border-white/40"
    }`}
  >
    {children}
  </button>
);

/** Sezione a piena altezza: fascia esterna + edificio col contenuto del modulo. */
const ModuleScreen = ({
  city, outdoorTemp, outdoorExtra, icon, label, verdict, scoreLine,
  values, limitRatio, big, bigUnit, bigColor, rows, ctaLabel, onCta, light, buildingClass, pitch,
  centerContent,
}: any) => (
  <section className="h-full snap-start snap-always flex flex-col shrink-0">
    <Outdoor city={city} temp={outdoorTemp} extra={outdoorExtra} />
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
            <div className="text-[31px] font-bold leading-tight mt-3">{verdict}</div>
            <div className="text-[11px] opacity-75 tracking-wide">{scoreLine}</div>
            {values && <ValueRow items={values} light={light} />}
            {typeof limitRatio === "number" && <LimitBar ratio={limitRatio} light={light} />}
            {centerContent ? (
              <div className="my-auto py-2 w-full">{centerContent}</div>
            ) : (
              <div className="my-auto py-2">
                <div className="text-[64px] font-bold leading-none tracking-tight" style={bigColor ? { color: bigColor } : undefined}>
                  {big}
                </div>
                <div className="text-[9px] tracking-[0.26em] font-bold opacity-75 mt-2">{bigUnit}</div>
              </div>
            )}
            {rows && rows.length > 0 && (
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
            )}
          </>
        )}

        <CtaGlass onClick={onCta} light={light}>{ctaLabel}</CtaGlass>
      </div>
    </div>
  </section>
);

export const OverviewMobileView = ({
  siteName, city, outdoorTemp, periodLabel, overall, energy, air, water, moduleConfig,
  power, energyAvgKw, energyLimitKw, airMetrics, waterFlow, alerts, fingerprintAxes,
  verdictHeadline, isRealData, onNavigate, certifications,
}: OverviewMobileViewProps) => {
  const energyRatio = ratioFromLimit(power.total, energyLimitKw);
  const energyPct = energyLimitKw ? Math.round(energyRatio * 100) : undefined;
  const airRatio = ratioFromLimit(airMetrics.avgCo2 ?? airMetrics.co2, airMetrics.co2Limit);
  const airPct = airMetrics.co2Limit ? Math.round(airRatio * 100) : undefined;

  const modules = [
    { key: "energy", icon: Zap, score: energy.score, enabled: moduleConfig.energy.enabled, level: energy.level },
    { key: "air", icon: Wind, score: air.score, enabled: moduleConfig.air.enabled, level: air.level },
    { key: "water", icon: Droplet, score: water.score, enabled: moduleConfig.water.enabled, level: water.level },
  ];

  return (
    <div className="h-full overflow-y-auto snap-y snap-mandatory scroll-smooth motion-reduce:scroll-auto">
      {/* ── 1 · HERO: score complessivo ── */}
      {/* pb-16: clearance per la barra periodo/report/settings in overlay */}
      <section className="h-full snap-start snap-always shrink-0 flex flex-col items-center text-center text-white px-5 pt-10 pb-16 bg-gradient-to-b from-[#016368] via-[#009193] to-[#33a7a9]">
        <div className="font-bold text-[19px] tracking-wide">{siteName}</div>
        <div className="text-[11px] opacity-80 tracking-[0.08em] flex items-center justify-center gap-1">
          <span>{(city || "").toUpperCase()}</span>
          {typeof outdoorTemp === "number" && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                {Math.round(outdoorTemp)}° <Cloud className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            </>
          )}
          <span>· {periodLabel.toUpperCase()}</span>
        </div>
        {isRealData && (
          <div className="mt-1.5">
            <span className="inline-block text-[8px] font-bold tracking-[0.16em] text-[#01474b] bg-[#9fd5d9] px-2.5 py-[3px] rounded-full">
              ● LIVE
            </span>
          </div>
        )}

        <div className="mt-auto mb-1.5"><ScoreRing score={overall.score} /></div>
        <div className="text-[34px] font-bold leading-none">{VERDICT[overall.level]}</div>
        <div className="text-[11px] opacity-80 tracking-wide mb-auto">
          {verdictHeadline || `Overall performance · ${overall.score} / 100`}
        </div>

        <div className="flex gap-7 justify-center pt-1.5">
          {modules.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => m.enabled && onNavigate?.(m.key)}
              className={`text-center transition-transform active:scale-95 ${m.enabled ? "" : "opacity-45"}`}
            >
              <m.icon className="w-[21px] h-[21px] mx-auto" />
              <div className="text-[22px] font-bold leading-tight mt-1">
                {m.enabled && m.level !== "NO_DATA" ? m.score : "—"}
              </div>
              <div className="text-[8px] tracking-[0.16em] opacity-75 font-bold">{m.key.toUpperCase()}</div>
            </button>
          ))}
          <div className="text-center" style={{ color: alerts.criticalCount > 0 ? "#f9cace" : undefined }}>
            <AlertTriangle className="w-[21px] h-[21px] mx-auto" />
            <div className="text-[22px] font-bold leading-tight mt-1">{alerts.criticalCount + alerts.warningCount}</div>
            <div className="text-[8px] tracking-[0.16em] opacity-75 font-bold">ALERTS</div>
          </div>
        </div>

        <div className="opacity-65 text-[9px] tracking-[0.24em] pt-2">
          SCROLL
          <span className="block text-[13px] motion-safe:animate-bounce">▾</span>
        </div>
      </section>

      {/* ── 2 · ENERGY ── */}
      <ModuleScreen
        city={city} outdoorTemp={outdoorTemp}
        icon={Zap} label="Energy"
        buildingClass="bg-gradient-to-b from-[#028084] to-[#016368]"
        verdict={VERDICT[energy.level]}
        scoreLine={`score ${energy.score} / 100`}
        values={moduleConfig.energy.enabled ? [
          { value: fmt(energyAvgKw), unit: "kW", label: `AVG ${periodLabel.toUpperCase()}` },
          { value: energyLimitKw ? fmt(energyLimitKw, 0) : "—", unit: energyLimitKw ? "kW" : undefined, label: "LIMIT SET" },
          {
            value: energyPct != null ? String(energyPct) : "—", unit: energyPct != null ? "%" : undefined,
            label: "OF LIMIT", color: energyPct != null ? performanceColor(energyRatio, "dark") : undefined,
          },
        ] : undefined}
        limitRatio={energyLimitKw ? energyRatio : undefined}
        big={fmt(power.total)}
        bigUnit="KW · CURRENT LOAD"
        // Senza dati niente colore di performance: un "—" bordeaux sembrerebbe
        // un allarme invece che assenza di telemetria
        bigColor={energy.level !== "NO_DATA" && power.total != null
          ? performanceColor(energyLimitKw ? energyRatio : ratioFromScore(energy.score), "dark")
          : undefined}
        rows={[
          { label: "HVAC", value: fmt(power.hvac) },
          { label: "Lighting", value: fmt(power.lighting) },
          { label: "Plugs", value: fmt(power.plugs) },
          { label: "Other", value: fmt(power.other) },
        ]}
        pitch={!moduleConfig.energy.enabled ? {
          title: "Every kWh has a story.",
          body: "See where energy goes, hour by hour — and what it costs you.",
        } : undefined}
        ctaLabel={moduleConfig.energy.enabled ? "ENERGY DASHBOARD →" : "ASK US HOW →"}
        onCta={() => moduleConfig.energy.enabled && onNavigate?.("energy")}
      />

      {/* ── 3 · AIR (edificio chiaro: testi scuri) ── */}
      <ModuleScreen
        light
        city={city} outdoorTemp={outdoorTemp}
        icon={Wind} label="Air"
        buildingClass="bg-gradient-to-b from-[#b7e0e3] to-[#9fd5d9]"
        verdict={VERDICT[air.level]}
        scoreLine={`IAQ index · ${air.score} / 100`}
        values={moduleConfig.air.enabled ? [
          { value: fmtInt(airMetrics.avgCo2), unit: "ppm", label: "AVG CO₂" },
          { value: airMetrics.co2Limit ? fmtInt(airMetrics.co2Limit) : "—", unit: airMetrics.co2Limit ? "ppm" : undefined, label: "LIMIT SET" },
          {
            value: airPct != null ? String(airPct) : "—", unit: airPct != null ? "%" : undefined,
            label: "OF LIMIT", color: airPct != null ? performanceColor(airRatio, "light") : undefined,
          },
        ] : undefined}
        limitRatio={airMetrics.co2Limit ? airRatio : undefined}
        big={air.level === "NO_DATA" ? "—" : String(air.score)}
        bigUnit="IAQ INDEX · NOW"
        bigColor={air.level !== "NO_DATA" ? performanceColor(ratioFromScore(air.score), "light") : undefined}
        rows={[
          { label: "Temp", value: airMetrics.temperature != null ? `${fmt(airMetrics.temperature)}°` : "—" },
          { label: "Humidity", value: airMetrics.humidity != null ? `${fmtInt(airMetrics.humidity)}%` : "—" },
          { label: "TVOC", value: fmtInt(airMetrics.voc) },
          { label: "PM2.5", value: fmtInt(airMetrics.pm25) },
        ]}
        pitch={!moduleConfig.air.enabled ? {
          title: "You breathe it all day.",
          body: "CO₂, humidity and particles — measured where your people actually work.",
        } : undefined}
        ctaLabel={moduleConfig.air.enabled ? "AIR DASHBOARD →" : "ASK US HOW →"}
        onCta={() => moduleConfig.air.enabled && onNavigate?.("air")}
      />

      {/* ── 4 · WATER ── */}
      <ModuleScreen
        city={city} outdoorTemp={outdoorTemp}
        icon={Droplet} label="Water"
        buildingClass="bg-gradient-to-b from-[#02a3a5] to-[#009193]"
        verdict={VERDICT[water.level]}
        scoreLine={`score ${water.score} / 100`}
        big={fmt(waterFlow)}
        bigUnit="L/MIN · CURRENT FLOW"
        bigColor={water.level !== "NO_DATA" && waterFlow != null
          ? performanceColor(ratioFromScore(water.score), "dark")
          : undefined}
        pitch={!moduleConfig.water.enabled ? {
          title: "You can't save what you don't measure.",
          body: "Leaks, waste and savings — spotted live, before they hit the bill.",
        } : undefined}
        ctaLabel={moduleConfig.water.enabled ? "WATER DASHBOARD →" : "ASK US HOW →"}
        onCta={() => moduleConfig.water.enabled && onNavigate?.("water")}
      />

      {/* ── 4b · CERTIFICATIONS (grigio, solo se presenti) ── */}
      {certifications && certifications.length > 0 && (
        <ModuleScreen
          city={city} outdoorTemp={outdoorTemp}
          icon={Award} label="Certifications"
          buildingClass="bg-gradient-to-b from-[#7d8a8f] to-[#5c696e]"
          verdict="Certified"
          scoreLine={`${certifications.length} active certification${certifications.length > 1 ? "s" : ""}`}
          centerContent={
            /* I loghi ufficiali al centro, distribuiti uniformemente;
               chip bianco per leggibilità sul grigio */
            <div className="flex flex-wrap items-center justify-evenly gap-6 px-2">
              {certifications.slice(0, 6).map((c) => (
                <div
                  key={c}
                  className="w-[104px] h-[104px] rounded-2xl bg-white shadow-lg flex items-center justify-center p-3"
                >
                  {CERT_LOGOS[c] ? (
                    <img src={CERT_LOGOS[c]} alt={c} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-[13px] font-bold text-[#5c696e] text-center leading-tight">
                      {c.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          }
          ctaLabel="CERTIFICATIONS →"
          onCta={() => onNavigate?.("certification")}
        />
      )}

      {/* ── 5 · FINGERPRINT + ALERTS ── */}
      <section className="h-full snap-start snap-always shrink-0 flex flex-col items-center text-center text-white px-6 pt-12 pb-16 bg-gradient-to-b from-[#016368] to-[#01474b]">
        <h4 className="m-0 text-[9px] font-bold tracking-[0.3em] opacity-75">SITE FINGERPRINT</h4>
        <FingerprintRadar axes={fingerprintAxes} />

        <h4 className="mt-3.5 mb-0 text-[9px] font-bold tracking-[0.3em] opacity-75">
          ALERTS · {alerts.criticalCount + alerts.warningCount} OPEN
        </h4>
        <div className="w-full max-w-[270px] mx-auto text-left text-[12.5px]">
          {alerts.list.length === 0 ? (
            <div className="opacity-70 text-center py-4 text-[12px]">No open alerts</div>
          ) : (
            alerts.list.slice(0, 3).map((a, i) => (
              <div key={i} className="flex justify-between gap-2.5 py-2 border-b border-white/15">
                <span className={a.severity === "critical" ? "text-[#f9cace]" : undefined}>{a.title}</span>
                {a.ago && <b className="opacity-65 font-normal shrink-0">{a.ago}</b>}
              </div>
            ))
          )}
        </div>

        <div className="mt-auto w-full flex justify-center">
          <CtaGlass onClick={() => onNavigate?.("energy")}>ALL ALERTS →</CtaGlass>
        </div>
      </section>
    </div>
  );
};

export default OverviewMobileView;
