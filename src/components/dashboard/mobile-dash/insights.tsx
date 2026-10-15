/**
 * Schede «approfondimento» della dashboard Energy (atlante §10.1):
 * Confronto (EUI vs pari), Meteo (dispersione/nel tempo), Carbonio
 * (mesi + giorno/notte), Periodi (elenco mesi con barra). SVG puro,
 * niente animazioni (§6.6), palette chiara §1.5.
 */
import { useState } from "react";
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
  const kwhs = s.points.map(p => p.kwh);
  const tMin = Math.floor(Math.min(...temps) / 5) * 5;
  const tMax = Math.ceil(Math.max(...temps) / 5) * 5;
  const kMax = Math.max(...kwhs) * 1.1;
  const kMin = Math.min(...kwhs) * 0.85;
  const x = (t: number) => PL + ((t - tMin) / (tMax - tMin || 1)) * (W - PL - PR);
  const y = (k: number) => PT + (1 - (k - kMin) / (kMax - kMin || 1)) * (H - PT - PB);
  // retta di tendenza sul modello CDD18: piatta fino a 18°, poi sale
  const base = (() => {
    const under = s.points.filter(p => p.temp <= 18);
    const src = under.length >= 3 ? under : s.points;
    return src.reduce((a, p) => a + p.kwh, 0) / src.length;
  })();
  const slope = s.kwhPerDegree ?? 0;
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
        const isToday = p.day === todayKey;
        return (
          <circle key={i} cx={x(p.temp)} cy={y(p.kwh)} r={isToday ? 4.5 : 3}
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
export const WeatherTimeline = ({ s }: { s: WeatherCorr }) => {
  const H = 190, PT = 14, PB = 20;
  const n = s.points.length;
  const kMax = Math.max(...s.points.map(p => p.kwh)) * 1.1;
  const tVals = s.points.map(p => p.temp);
  const tMin = Math.min(...tVals), tMax = Math.max(...tVals);
  const x = (i: number) => 8 + (i / Math.max(1, n - 1)) * (W - 16);
  const yK = (k: number) => PT + (1 - k / kMax) * (H - PT - PB);
  const yT = (tv: number) => PT + 8 + (1 - (tv - tMin) / (tMax - tMin || 1)) * (H - PT - PB - 40);
  const bw = Math.max(2, (W - 16) / n - 2);
  let tpath = "";
  s.points.forEach((p, i) => { tpath += `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yT(p.temp).toFixed(1)} `; });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
      {s.points.map((p, i) => (
        <rect key={i} x={x(i) - bw / 2} y={yK(p.kwh)} width={bw} height={H - PB - yK(p.kwh)} rx={1.5} fill="rgba(10,143,145,.30)" />
      ))}
      <path d={tpath} fill="none" stroke="#8aa3a5" strokeWidth="1.6" strokeLinejoin="round" />
      <text x={8} y={H - 5} fontSize="8.5" fill={AXIS}>1</text>
      <text x={W - 8} y={H - 5} fontSize="8.5" fill={AXIS} textAnchor="end">{n}</text>
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
