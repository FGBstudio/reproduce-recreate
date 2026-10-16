/**
 * Schede «approfondimento» della dashboard Energy (atlante §10.1):
 * Confronto (EUI vs pari), Meteo (dispersione/nel tempo), Carbonio
 * (mesi + giorno/notte), Periodi (elenco mesi con barra). SVG puro,
 * niente animazioni (§6.6), palette chiara §1.5.
 */
import { useState } from "react";
import { Moon, Sun, Sparkles, type LucideIcon } from "lucide-react";
import { AMBER, AXIS, INK, RULE, SUB, TEAL } from "./bits";
import type { EuiCompare, PeriodsYear, WeatherCorr } from "./useEnergyInsights";
import { hapticLight } from "@/lib/native";

const W = 342;

/* ── Confronto: sito ━ · pari ┅ · fascia pari ■ · target tratteggiato ── */
export const EuiCompareChart = ({ s, anchorMonth, monthLabels, labels }: {
  s: EuiCompare; anchorMonth: number; monthLabels: string[];
  labels: { site: string; peers: string; band: string; target: string; now: string };
}) => {
  const H = 170, PT = 16, PB = 18;
  const vals = s.months.flatMap(m => [m.site, m.peerMax].filter((v): v is number => v != null));
  const maxV = Math.max(...vals, s.targetMonthly ?? 0, 1) * 1.12;
  const x = (i: number) => 10 + (i / 11) * (W - 20);
  const y = (v: number) => PT + (1 - v / maxV) * (H - PT - PB);
  const path = (get: (m: EuiCompare["months"][0]) => number | null) => {
    let p = "", pen = false;
    s.months.forEach((m, i) => {
      const v = get(m);
      if (v == null) { pen = false; return; }
      p += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return p;
  };
  // fascia pari: poligono min→max
  const withBand = s.months.map((m, i) => ({ i, min: m.peerMin, max: m.peerMax })).filter(b => b.min != null && b.max != null);
  const band = withBand.length > 1
    ? `M${withBand.map(b => `${x(b.i).toFixed(1)},${y(b.max!).toFixed(1)}`).join(" L")} L${[...withBand].reverse().map(b => `${x(b.i).toFixed(1)},${y(b.min!).toFixed(1)}`).join(" L")} Z`
    : "";
  const cur = s.months[anchorMonth];
  return (
    <div className="px-6 mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
        {band && <path d={band} fill="rgba(159,178,179,.16)" />}
        {s.targetMonthly != null && (
          <g>
            <line x1={10} x2={W - 10} y1={y(s.targetMonthly)} y2={y(s.targetMonthly)} stroke="#b06a8f" strokeWidth="1.2" strokeDasharray="4 4" />
            <text x={10} y={y(s.targetMonthly) - 4} fontSize="9" fill="#b06a8f">{labels.target} {s.targetMonthly}</text>
          </g>
        )}
        <path d={path(m => m.peerAvg)} fill="none" stroke="#5f7779" strokeWidth="1.3" strokeDasharray="3 3" />
        <path d={path(m => m.site)} fill="none" stroke={TEAL} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {cur?.site != null && (
          <g>
            <circle cx={x(anchorMonth)} cy={y(cur.site)} r="3.8" fill={TEAL} />
            <text x={Math.min(x(anchorMonth) + 6, W - 54)} y={y(cur.site) - 7} fontSize="9.5" fontWeight="600" fill={INK}>
              {labels.now} {cur.site}
            </text>
          </g>
        )}
        {monthLabels.map((ml, i) => (
          <text key={i} x={x(i)} y={H - 4} fontSize="8" fill={i === anchorMonth ? INK : AXIS} fontWeight={i === anchorMonth ? 700 : 400} textAnchor="middle">{ml}</text>
        ))}
      </svg>
      <p className="text-center" style={{ fontSize: 10.5, color: SUB, marginTop: 2 }}>
        kWh/m² · {labels.site} ━ · {labels.peers} ┅ · {labels.band} ■
      </p>
    </div>
  );
};

/* ── Meteo: dispersione kWh/giorno vs temperatura + retta di tendenza ── */
export const WeatherScatter = ({ s, todayKey, fmt }: { s: WeatherCorr; todayKey: string; fmt: (v: number) => string }) => {
  const H = 190, PT = 14, PB = 22, PL = 8, PR = 40;
  const temps = s.points.map(p => p.temp);
  const kwhs = s.points.map(p => p.value);
  const tMin = Math.floor(Math.min(...temps) / 5) * 5;
  const tMax = Math.ceil(Math.max(...temps) / 5) * 5;
  const kMax = Math.max(...kwhs) * 1.1;
  const kMin = Math.min(...kwhs) * 0.85;
  const x = (t: number) => PL + ((t - tMin) / (tMax - tMin || 1)) * (W - PL - PR);
  const y = (k: number) => PT + (1 - (k - kMin) / (kMax - kMin || 1)) * (H - PT - PB);
  // retta di tendenza sul modello CDD18: piatta fino a 18°, poi sale.
  // La pendenza si stima SUI PUNTI MOSTRATI (minimi quadrati su CDD18), così
  // la retta è nelle unità del grafico a ogni scala — ore, giorni o mesi;
  // il numero in alto resta quello della finestra robusta del modello.
  const base = (() => {
    const under = s.points.filter(p => p.temp <= 18);
    const src = under.length >= 3 ? under : s.points;
    return src.reduce((a, p) => a + p.value, 0) / src.length;
  })();
  const slope = (() => {
    const pts = s.points.map(p => ({ x: Math.max(0, p.temp - 18), y: p.value })).filter(p => p.x > 0);
    if (pts.length < 3) return s.fitWindow == null ? (s.kwhPerDegree ?? 0) : 0;
    const n = pts.length;
    const mx = pts.reduce((a, p) => a + p.x, 0) / n;
    const my = pts.reduce((a, p) => a + p.y, 0) / n;
    let num = 0, den = 0;
    for (const p of pts) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
    return den > 0 ? Math.max(0, num / den) : 0;
  })();
  const trend = `M${x(tMin)},${y(base)} L${x(18)},${y(base)} L${x(tMax)},${y(base + slope * (tMax - 18))}`;
  const ticks = [];
  for (let tt = tMin; tt <= tMax; tt += 5) ticks.push(tt);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
      {[kMin + (kMax - kMin) * 0.33, kMin + (kMax - kMin) * 0.66].map((gv, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR + 6} y1={y(gv)} y2={y(gv)} stroke={RULE} strokeWidth="1" />
          <text x={W - PR + 9} y={y(gv) + 3} fontSize="8.5" fill={AXIS}>{fmt(gv)}</text>
        </g>
      ))}
      {slope > 0 && <path d={trend} fill="none" stroke="#8aa3a5" strokeWidth="1.5" strokeDasharray="5 3" />}
      {s.points.map((p, i) => {
        const isToday = p.key === todayKey || p.key.slice(0, 10) === todayKey;
        return (
          <circle key={i} cx={x(p.temp)} cy={y(p.value)} r={isToday ? 4.5 : 3}
            fill={isToday ? TEAL : "rgba(10,143,145,.38)"}
            stroke={isToday ? "#fff" : "none"} strokeWidth={isToday ? 1.5 : 0} />
        );
      })}
      {ticks.map(tt => (
        <text key={tt} x={x(tt)} y={H - 6} fontSize="8.5" fill={AXIS} textAnchor="middle">{tt}°</text>
      ))}
    </svg>
  );
};

/* ── Meteo «Nel tempo»: kWh come barre leggere + temperatura come linea ── */
export const WeatherTimeline = ({ s, axisLabels }: {
  s: WeatherCorr;
  /** etichette dell'asse X già formattate dal chiamante (date, ore, mesi) */
  axisLabels?: string[];
}) => {
  const H = 190, PT = 14, PB = 22;
  const n = s.points.length;
  const kMax = Math.max(...s.points.map(p => p.value)) * 1.1;
  const tVals = s.points.map(p => p.temp);
  const tMin = Math.min(...tVals), tMax = Math.max(...tVals);
  const x = (i: number) => 8 + (i / Math.max(1, n - 1)) * (W - 16);
  const yK = (k: number) => PT + (1 - k / kMax) * (H - PT - PB);
  const yT = (tv: number) => PT + 8 + (1 - (tv - tMin) / (tMax - tMin || 1)) * (H - PT - PB - 40);
  // con pochi punti le barre non devono diventare lastre né sbordare
  const bw = Math.min(30, Math.max(2, (W - 16) / n - 2));
  let tpath = "";
  s.points.forEach((p, i) => { tpath += `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yT(p.temp).toFixed(1)} `; });
  // con pochi punti si etichetta ogni passo, con molti si dirada
  const labels = axisLabels ?? s.points.map(p => p.label);
  const every = n <= 8 ? 1 : n <= 16 ? 2 : Math.ceil(n / 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
      {s.points.map((p, i) => (
        <rect key={i} x={x(i) - bw / 2} y={yK(p.value)} width={bw} height={H - PB - yK(p.value)} rx={1.5} fill="rgba(10,143,145,.30)" />
      ))}
      <path d={tpath} fill="none" stroke="#8aa3a5" strokeWidth="1.6" strokeLinejoin="round" />
      {/* estremi della temperatura, così la linea grigia si legge */}
      <text x={W - 2} y={yT(tMax) - 4} fontSize="8.5" fill="#8aa3a5" textAnchor="end">{Math.round(tMax)}°</text>
      <text x={W - 2} y={yT(tMin) + 10} fontSize="8.5" fill="#8aa3a5" textAnchor="end">{Math.round(tMin)}°</text>
      {labels.map((lb, i) => (
        i % every === 0 || i === n - 1
          ? <text key={i} x={x(i)} y={H - 5} fontSize="8.5" fill={AXIS} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{lb}</text>
          : null
      ))}
    </svg>
  );
};

/* ── Carbonio: 12 barre kgCO₂e, mese corrente evidenziato ── */
export const CarbonBars = ({ months, anchorMonth, monthLabels, fmt }: {
  months: Array<{ m: number; kg: number | null }>; anchorMonth: number; monthLabels: string[]; fmt: (v: number) => string;
}) => {
  const H = 150;
  const maxV = Math.max(...months.map(x => x.kg ?? 0), 1);
  return (
    <div className="px-6 mt-3">
      <div className="relative" style={{ height: H + 34 }}>
        <div className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-between">
          {months.map((x, i) => {
            const h = x.kg != null ? Math.max(6, (x.kg / maxV) * H) : 0;
            const isCur = i === anchorMonth;
            return (
              <div key={x.m} className="flex flex-col items-center justify-end" style={{ width: 24, height: H + 34 }}>
                {isCur && x.kg != null && (
                  <span className="tabular-nums" style={{ fontSize: 10, color: INK, fontWeight: 600, marginBottom: 2 }}>{fmt(x.kg)}</span>
                )}
                <span aria-hidden style={{
                  width: 10, height: h, borderRadius: 5,
                  background: x.kg == null ? "transparent" : isCur ? TEAL : "#9fd3d6",
                }} />
                <span style={{ fontSize: 10, color: isCur ? INK : AXIS, fontWeight: isCur ? 700 : 400, marginTop: 5 }}>{monthLabels[i]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ── Ripartizione per categoria (parità E1 = donut Breakdown del PC):
   barre orizzontali ordinate col kWh e la quota; tap su una barra apre
   la scheda di quella categoria. Il Virtual Split arriva già dichiarato
   dal hook (badge Sparkles + nota a carico del chiamante). ── */
export const CategoryBars = ({ title, badge, note, rows, onPick }: {
  title: string;
  badge?: string;                 // «RIPARTIZIONE SIMULATA» quando serve
  note?: string;
  rows: Array<{ id: string; label: string; pct: number; kwh?: number; pickable?: boolean; Icon?: LucideIcon }>;
  onPick?: (id: string) => void;
}) => {
  const COLORS = [TEAL, "#5fb6b8", "#9fd3d6", "#d9e6e6"];
  const nf0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
  const sorted = [...rows].sort((a, b) => b.pct - a.pct);
  return (
    <div className="px-6" style={{ marginTop: 22 }}>
      <div className="flex items-baseline justify-between gap-2">
        <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{title}</span>
        {badge && (
          <span className="inline-flex items-center gap-1" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: "#6b5a9e", background: "#ece7f7", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>
            <Sparkles size={10} strokeWidth={2.2} aria-hidden />{badge}
          </span>
        )}
      </div>
      {sorted.map((r, i) => (
        <button key={r.id} type="button" disabled={!r.pickable || !onPick}
          onClick={() => { if (r.pickable && onPick) { hapticLight(); onPick(r.id); } }}
          className="w-full flex items-center gap-2.5" style={{ marginTop: 9, fontSize: 12, minHeight: 24 }}>
          <span className="flex items-center gap-1.5 text-left" style={{ width: 74, flex: "none", color: INK }}>
            {/* l'ultima tinta è troppo chiara per un'icona: lì si usa il grigio */}
            {r.Icon && <r.Icon className="w-3.5 h-3.5 shrink-0" style={{ color: i < 3 ? COLORS[i] : SUB }} aria-hidden />}
            <span className="truncate">{r.label}</span>
          </span>
          <span className="flex-1 rounded-full" style={{ height: 14, background: "#eef4f4", position: "relative" }} aria-hidden>
            <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, r.pct)}%`, background: COLORS[i % COLORS.length] }} />
          </span>
          <span className="text-right tabular-nums" style={{ width: 110, flex: "none", color: SUB }}>
            {r.kwh != null ? `${nf0.format(r.kwh)} kWh · ` : ""}{r.pct}%
          </span>
        </button>
      ))}
      {note && <p style={{ fontSize: 11, color: SUB, margin: "8px 0 0" }}>{note}</p>}
    </div>
  );
};

/* ── Bollette (§10.6): per ogni mese la coppia fatturato | misurato.
   Fatturato = ardesia scura, misurato = teal (il dato dei NOSTRI
   contatori, lo stesso della vista Anno). Tap sul mese → vista Mese. ── */
export const BillsCompareChart = ({ months, monthLabels, labels, onOpenMonth, fmt }: {
  months: Array<{ m: number; billed: number | null; measured: number | null }>;
  monthLabels: string[];
  labels: { billed: string; measured: string };
  onOpenMonth?: (m: number) => void;
  fmt: (v: number) => string;
}) => {
  const H = 150;
  const maxV = Math.max(...months.flatMap(x => [x.billed ?? 0, x.measured ?? 0]), 1);
  const BILLED = "#3c5a5e";
  const [sel, setSel] = useState<number | null>(null);
  const hOf = (v: number | null) => (v != null ? Math.max(4, (v / maxV) * H) : 0);
  return (
    <div className="px-6 mt-3">
      <div className="relative" style={{ height: H + 22 }}>
        <div className="absolute inset-0 flex items-end justify-between">
          {months.map((x, i) => (
            <button key={x.m} type="button"
              onClick={() => {
                if (x.billed == null && x.measured == null) return;
                hapticLight();
                if (sel === i) { onOpenMonth?.(x.m); return; } // secondo tap: apre il mese
                setSel(i);
              }}
              className="flex flex-col items-center justify-end" style={{ width: 25, height: H + 22 }}>
              <span className="flex items-end" style={{ gap: 2, height: H }}>
                <span aria-hidden style={{ width: 7, height: hOf(x.billed), borderRadius: 3.5, background: x.billed == null ? "transparent" : BILLED, opacity: sel == null || sel === i ? 1 : 0.35 }} />
                <span aria-hidden style={{ width: 7, height: hOf(x.measured), borderRadius: 3.5, background: x.measured == null ? "transparent" : TEAL, opacity: sel == null || sel === i ? 1 : 0.35 }} />
              </span>
              <span style={{ fontSize: 10, color: sel === i ? INK : AXIS, fontWeight: sel === i ? 700 : 400, marginTop: 5 }}>{monthLabels[i]}</span>
            </button>
          ))}
        </div>
      </div>
      {/* mese selezionato: i due numeri a confronto (un tap; il secondo apre il mese) */}
      {sel != null && (months[sel].billed != null || months[sel].measured != null) && (
        <p className="text-center tabular-nums" style={{ fontSize: 11, color: SUB, margin: "4px 0 0" }}>
          {months[sel].billed != null ? `${fmt(months[sel].billed!)} ${labels.billed}` : ""}
          {months[sel].billed != null && months[sel].measured != null ? " · " : ""}
          {months[sel].measured != null ? `${fmt(months[sel].measured!)} ${labels.measured}` : ""}
        </p>
      )}
      <p className="text-center" style={{ fontSize: 10.5, color: SUB, marginTop: sel != null ? 2 : 6 }}>
        <span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: BILLED, marginRight: 4 }} />kWh {labels.billed}
        <span aria-hidden style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: TEAL, margin: "0 4px 0 12px" }} />kWh {labels.measured}
      </p>
    </div>
  );
};

/* ── Giorno / notte: i due anelli del desktop (24-Hour Energy Cycle), in
   palette FGB — giorno teal, notte ardesia. Giorno = ore 8–20 nel fuso
   del sito, come sul PC. ── */
export const DayNightRings = ({ day, night, labels, fmt }: {
  day: { pct: number; kwh: number }; night: { pct: number; kwh: number };
  labels: { title: string; sub: string; day: string; night: string };
  fmt: (kwh: number) => string;
}) => {
  const R = 28, C = 2 * Math.PI * R; // 175.9, come il desktop
  const ring = (pct: number, color: string, icon: "sun" | "moon", label: string, value: string) => (
    <div className="flex flex-col items-center" style={{ gap: 6 }}>
      <div className="flex items-center" style={{ gap: 4 }}>
        {icon === "sun"
          ? <Sun className="w-3.5 h-3.5" style={{ color: AMBER }} aria-hidden />
          : <Moon className="w-3.5 h-3.5" style={{ color: "#3c5a5e" }} aria-hidden />}
        <span className="uppercase" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: SUB }}>{label}</span>
      </div>
      <div className="relative" style={{ width: 64, height: 64 }}>
        <svg width="64" height="64" style={{ transform: "rotate(-90deg)" }} aria-hidden>
          <circle cx="32" cy="32" r={R} stroke="#eef4f4" strokeWidth="5" fill="none" />
          <circle cx="32" cy="32" r={R} stroke={color} strokeWidth="5" fill="none"
            strokeDasharray={C} strokeDashoffset={C - (Math.max(0, Math.min(100, pct)) / 100) * C} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="tabular-nums" style={{ fontSize: 14, fontWeight: 700, color: INK }}>{pct}%</span>
        </div>
      </div>
      <span className="tabular-nums" style={{ fontSize: 11, color: SUB }}>{value}</span>
    </div>
  );
  return (
    <div className="px-6" style={{ marginTop: 22 }}>
      <div className="flex items-baseline gap-2">
        <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{labels.title}</span>
        <span style={{ fontSize: 11, color: SUB }}>{labels.sub}</span>
      </div>
      <div className="flex justify-around" style={{ marginTop: 10 }}>
        {ring(day.pct, TEAL, "sun", labels.day, fmt(day.kwh))}
        {ring(night.pct, "#3c5a5e", "moon", labels.night, fmt(night.kwh))}
      </div>
    </div>
  );
};

/* ── Giorno / notte: due barre orizzontali (al posto di anello + gauge) ── */
export const DayNightBars = ({ day, night, labels, fmtMwh }: {
  day: { pct: number; kwh: number }; night: { pct: number; kwh: number };
  labels: { title: string; sub: string; day: string; night: string };
  fmtMwh: (kwh: number) => string;
}) => (
  <div className="px-6 mt-5">
    <div className="flex items-baseline gap-2 mb-2">
      <span style={{ fontSize: 12.5, fontWeight: 500, color: INK }}>{labels.title}</span>
      <span style={{ fontSize: 11, color: SUB }}>{labels.sub}</span>
    </div>
    {[{ k: labels.day, v: day, c: TEAL }, { k: labels.night, v: night, c: "#3c5a5e" }].map(row => (
      <div key={row.k} className="mb-2.5">
        <div className="flex justify-between" style={{ fontSize: 12, color: INK }}>
          <span>{row.k}</span>
          <span className="tabular-nums" style={{ color: SUB }}>{row.v.pct}% · {fmtMwh(row.v.kwh)}</span>
        </div>
        <div className="mt-1 overflow-hidden rounded-full" style={{ height: 8, background: "#e6eeee" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.v.pct)}%`, background: row.c }} />
        </div>
      </div>
    ))}
  </div>
);

/* ── Periodi: elenco mesi con barra sottile, MWh e costo; riga espandibile ── */
export const PeriodsList = ({ s, monthNames, labels, fmt0 }: {
  s: PeriodsYear; monthNames: string[];
  labels: { inProgress: string; peak: string; avgPrice: string; vsPrevYear: string };
  fmt0: (v: number) => string;
}) => {
  const [openM, setOpenM] = useState<number | null>(null);
  const maxV = Math.max(...s.months.map(x => x.kwh ?? 0), 1);
  return (
    <div className="px-6 mt-3">
      {s.months.map(x => {
        const open = openM === x.m;
        return (
          <div key={x.m} style={{ borderBottom: `1px solid ${RULE}` }}>
            <button type="button" className="w-full flex items-center gap-3 text-left" style={{ minHeight: 48 }}
              onClick={() => { if (x.kwh != null) { hapticLight(); setOpenM(open ? null : x.m); } }}>
              <span className="shrink-0" style={{ width: 76, fontSize: 13.5, color: x.kwh == null ? AXIS : INK, fontWeight: x.current ? 700 : 400 }}>
                {monthNames[x.m - 1]}
                {x.current && <em className="not-italic block" style={{ fontSize: 9.5, color: TEAL, fontWeight: 700, letterSpacing: ".08em" }}>{labels.inProgress}</em>}
              </span>
              <span className="flex-1 overflow-hidden rounded-full" style={{ height: 5, background: "#eef4f4" }} aria-hidden>
                {x.kwh != null && <span className="block h-full rounded-full" style={{ width: `${(x.kwh / maxV) * 100}%`, background: x.current ? TEAL : "#9fd3d6" }} />}
              </span>
              <span className="shrink-0 text-right tabular-nums" style={{ width: 44, fontSize: 13, color: x.kwh == null ? AXIS : INK }}>
                {x.kwh == null ? "—" : (x.kwh / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
              <span className="shrink-0 text-right tabular-nums" style={{ width: 62, fontSize: 12, color: x.kwh == null ? AXIS : SUB }}>
                {x.kwh == null ? "—" : x.cost != null ? `€ ${fmt0(x.cost)}` : ""}
              </span>
            </button>
            {open && x.kwh != null && (
              <div className="flex gap-4 pb-3 pl-[76px]" style={{ fontSize: 11.5, color: SUB }}>
                {x.peakDay && <span><b className="tabular-nums" style={{ color: INK, fontWeight: 600 }}>{fmt0(x.peakDay.kwh)} kWh</b> · {labels.peak} {x.peakDay.date.slice(8, 10)}/{x.peakDay.date.slice(5, 7)}</span>}
                {x.cost != null && x.kwh > 0 && <span><b className="tabular-nums" style={{ color: INK, fontWeight: 600 }}>{(x.cost / x.kwh).toFixed(2)} €/kWh</b> · {labels.avgPrice}</span>}
                {x.vsPrevYearPct != null && <span><b className="tabular-nums" style={{ color: x.vsPrevYearPct > 0 ? AMBER : INK, fontWeight: 600 }}>{x.vsPrevYearPct > 0 ? "+" : ""}{x.vsPrevYearPct}%</b> · {labels.vsPrevYear}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
