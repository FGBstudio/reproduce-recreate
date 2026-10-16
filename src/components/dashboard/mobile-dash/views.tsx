/**
 * Viste Settimana e Mese della dashboard modulo mobile (brief §6.2-6.3).
 * Settimana: barre capsula sottili (ambra solo sopra la media, weekend più
 * chiari), media feriale tratteggiata, heatmap 7×24 compatta che apre il
 * giorno al tocco. Mese: calendario con punto proporzionale al consumo,
 * oggi cerchiato, futuro in grigio; sintesi e griglia 2×2.
 */
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { AMBER, AXIS, INK, RED, RULE, SUB, TEAL } from "./bits";

/* Scala dell'intensità (decisione owner 16/10): CINQUE passi di teal, dal
   molto chiaro al scuro al crescere del consumo. Niente rosso: in palette
   il rosso segnala un problema, e consumare molto non è di per sé un
   problema. L'ambra resta per i superamenti di soglia (aria e acqua). */
export const HEAT_STEPS = ["#dcecec", "#b7dedf", "#7fc8ca", "#3aa8aa", "#016368"];
export const heatStep = (v: number | null | undefined, max: number): string | null => {
  if (v == null) return null;
  const r = Math.max(0, Math.min(1, v / (max || 1)));
  // quintili sulla scala del massimo: 0–20% … 80–100%
  return HEAT_STEPS[Math.min(4, Math.floor(r * 5))];
};
const EMPTY_CELL = "rgba(159,178,179,.12)";
import type { MonthSeries, WeekSeries, YearSeries } from "./useModuleSeries";
import { hapticLight } from "@/lib/native";

export const WeekBars = ({ s, onOpenDay, avgLabel, fmt, weekdays, overLimit }: {
  s: WeekSeries; onOpenDay: (date: string) => void; avgLabel?: string; fmt: (v: number) => string; weekdays?: string[];
  /** quando la metrica ha una soglia, l'ambra scatta sulla SOGLIA e non sulla media */
  overLimit?: number;
}) => {
  const max = Math.max(...s.days.map(d => d.v ?? 0), s.weekdayAvg ?? 0, 1);
  const H = 150;
  return (
    <div className="px-6 mt-4">
      <div className="relative" style={{ height: H + 36 }}>
        {/* media feriale tratteggiata */}
        {s.weekdayAvg != null && (
          <div className="absolute left-0 right-0 flex items-center" style={{ top: 18 + H * (1 - s.weekdayAvg / max) }} aria-hidden>
            <div className="flex-1" style={{ borderTop: "1.5px dashed #b9c9ca" }} />
            {avgLabel && <span className="pl-2 shrink-0" style={{ fontSize: 10.5, color: SUB }}>{avgLabel}</span>}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-between px-1">
          {s.days.map((d, i) => {
            const isWeekend = i >= 5;
            const over = d.v != null && (overLimit != null
              ? d.v > overLimit
              : s.weekdayAvg != null && !isWeekend && d.v > s.weekdayAvg * 1.1);
            const h = d.v != null ? Math.max(8, (d.v / max) * H) : 0;
            return (
              <button key={d.date} type="button" onClick={() => { if (d.v != null) { hapticLight(); onOpenDay(d.date); } }}
                className="flex flex-col items-center justify-end" style={{ width: 34, height: H + 36 }}>
                <span className="tabular-nums" style={{ fontSize: 10.5, color: SUB, marginBottom: 3 }}>{d.v != null ? fmt(d.v) : ""}</span>
                <span aria-hidden style={{
                  width: 14, height: h, borderRadius: 7,
                  background: d.v == null ? "transparent" : over ? AMBER : isWeekend ? "#dfe7e8" : "#9fd3d6",
                }} />
                <span style={{ fontSize: 11, color: AXIS, marginTop: 5 }}>{weekdays?.[i] ?? d.label}</span>
                {/* data sotto l'iniziale: «quale» lunedì si sta guardando */}
                {!d.date.startsWith("demo") && (
                  <span className="tabular-nums" style={{ fontSize: 9, color: "#b9c9ca", marginTop: 1 }}>{Number(d.date.slice(8, 10))}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const HourHeatmap = ({ s, onOpenDay, title, hint, weekdays, fmtCell }: {
  s: WeekSeries; onOpenDay: (date: string) => void; title: string; hint: string; weekdays?: string[];
  /** formatta il valore di una cella toccata (§6.2: «un tocco su una cella mostra il valore») */
  fmtCell?: (v: number, di: number, hi: number) => string;
}) => {
  const [cell, setCell] = useState<{ di: number; hi: number; v: number } | null>(null);
  return (
    <div className="px-6 mt-5">
      <div className="flex items-baseline gap-2 mb-2 min-h-[18px]">
        <span style={{ fontSize: 12.5, fontWeight: 500, color: INK }}>{title}</span>
        <span className="truncate" style={{ fontSize: 11, color: cell ? INK : SUB }}>
          {cell && fmtCell ? fmtCell(cell.v, cell.di, cell.hi) : hint}
        </span>
      </div>
      <div style={{ height: 100 }} className="flex flex-col justify-between">
        {s.heat.map((row, di) => (
          <div key={di} className="flex items-center gap-[2px]" style={{ height: 12 }}>
            {/* la lettera apre il GIORNO; le celle mostrano il valore */}
            <button type="button" onClick={() => { hapticLight(); onOpenDay(s.days[di].date); }}
              className="shrink-0 text-left" style={{ width: 14, fontSize: 9, color: AXIS }}>
              {weekdays?.[di] ?? s.days[di].label}
            </button>
            {row.map((v, hi) => (
              <button key={hi} type="button" tabIndex={-1} className="flex-1"
                onClick={() => { if (v != null) { hapticLight(); setCell(c => c && c.di === di && c.hi === hi ? null : { di, hi, v }); } }}
                style={{
                  height: 10, borderRadius: 3,
                  background: v == null ? "transparent" : heatStep(v, s.heatMax)!,
                  border: v == null ? `1px solid ${RULE}` : cell && cell.di === di && cell.hi === hi ? `1px solid ${INK}` : undefined,
                }} />
            ))}
          </div>
        ))}
      </div>
      <div className="flex justify-between pl-4 mt-1" style={{ fontSize: 9, color: AXIS }}>
        {[0, 6, 12, 18, 24].map(hh => <span key={hh}>{hh}</span>)}
      </div>
    </div>
  );
};

/** Carpet plot del mese (atlante §6 v2, «mappa del robot»): una colonna per
    giorno (1–31), una riga per ora (0–24 dall'alto), colore più intenso =
    valore più alto. Weekend segnati sotto, oggi contornato, futuri grigi.
    Un tocco su una colonna apre quel giorno. */
/** Striscia delle 24 ore del giorno (parità con le heatmap degli altri
 *  orizzonti): una cella per ora, intensità sul valore, ambra sopra soglia.
 *  Tap su una cella: ora e valore. */
export const HourStrip = ({ points, unit, overLimit, title, hint, fmt }: {
  points: Array<{ h: number; v: number | null }>;
  unit?: string;
  overLimit?: number;
  title: string;
  hint: string;
  fmt: (v: number) => string;
}) => {
  const [sel, setSel] = useState<number | null>(null);
  const maxV = Math.max(...points.map(p => p.v ?? 0), 1);
  return (
    <div className="px-6 mt-5">
      <div className="flex items-baseline justify-between mb-2">
        <span style={{ fontSize: 12.5, fontWeight: 500, color: INK }}>{title}</span>
        <span style={{ fontSize: 11, color: SUB }}>
          {sel != null && points[sel]?.v != null
            ? `${String(points[sel].h).padStart(2, "0")}:00 · ${fmt(points[sel].v!)}${unit ? ` ${unit}` : ""}`
            : hint}
        </span>
      </div>
      <div className="flex" style={{ gap: 2 }}>
        {points.map((p, i) => {
          const over = overLimit != null && p.v != null && p.v > overLimit;
          const a = p.v == null ? 0 : 0.1 + 0.85 * Math.min(1, p.v / maxV);
          return (
            <button key={p.h} type="button" className="flex-1" aria-label={`${p.h}:00`}
              onClick={() => { if (p.v != null) { hapticLight(); setSel(sel === i ? null : i); } }}
              style={{
                height: 30, borderRadius: 3,
                background: p.v == null ? EMPTY_CELL : over ? `rgba(217,154,43,${(0.35 + 0.6 * Math.min(1, p.v / maxV)).toFixed(2)})` : heatStep(p.v, maxV)!,
                outline: sel === i ? `1.5px solid ${TEAL}` : "none",
                outlineOffset: 1,
              }} />
          );
        })}
      </div>
      <div className="flex justify-between" style={{ fontSize: 9.5, color: AXIS, marginTop: 4 }}>
        {[0, 6, 12, 18, 24].map(h => <span key={h}>{h}</span>)}
      </div>
    </div>
  );
};

/** Carpet dell'anno: 12 colonne (mesi) × 31 righe (giorni) — l'equivalente
 *  «giorni × mesi» che il desktop mostra sugli intervalli lunghi. */
export const YearCarpet = ({ s, year, monthLabels, onOpenDay, overLimit, legendLess, legendMore }: {
  s: YearSeries; year: number; monthLabels: string[];
  onOpenDay: (date: string) => void;
  overLimit?: number;
  legendLess: string; legendMore: string;
}) => {
  const W = 342, H = 164, GAP = 1;
  const cw = (W - 14) / 12;
  const rh = H / 31;
  const max = s.daysMax || 1;
  return (
    <div className="px-6 mt-4">
      <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full block" style={{ touchAction: "pan-y" }}>
        {[1, 10, 20, 31].map(d => (
          <text key={d} x={0} y={(d - 1) * rh + 6} fontSize="7.5" fill={AXIS}>{d}</text>
        ))}
        {s.days.map((col, mi) => {
          const x = 14 + mi * cw;
          return (
            <g key={mi}>
              {col.map((v, di) => {
                const over = overLimit != null && v != null && v > overLimit;
                const fill = v == null
                  ? "rgba(159,178,179,.10)"
                  : over
                    ? `rgba(217,154,43,${(0.35 + 0.6 * Math.min(1, v / max)).toFixed(2)})`
                    : heatStep(v, max)!;
                return (
                  <rect key={di} x={x} y={di * rh} width={Math.max(0.5, cw - GAP)} height={rh - 0.5} rx={1} fill={fill}
                    onClick={() => {
                      if (v == null) return;
                      hapticLight();
                      onOpenDay(`${year}-${String(mi + 1).padStart(2, "0")}-${String(di + 1).padStart(2, "0")}`);
                    }}
                    style={{ cursor: v == null ? "default" : "pointer" }} />
                );
              })}
              <text x={x + (cw - GAP) / 2} y={H + 11} fontSize="8" fill={AXIS} textAnchor="middle">{monthLabels[mi]}</text>
            </g>
          );
        })}
        <g transform={`translate(14, ${H + 24})`}>
          <text x={0} y={4} fontSize="8" fill={SUB}>{legendLess}</text>
          {HEAT_STEPS.map((c2, i) => (
            <rect key={i} x={26 + i * 9} y={-2} width={7} height={7} rx={1.5} fill={c2} />
          ))}
          <text x={76} y={4} fontSize="8" fill={SUB}>{legendMore}</text>
        </g>
      </svg>
    </div>
  );
};

/** Barre giornaliere del mese: una barra per giorno, STESSA geometria del
 *  carpet che sta sotto (ogni barra è esattamente sopra la sua colonna).
 *  Weekend attenuati, oggi contornato, futuri assenti; tap → vista Giorno. */
export const MonthBars = ({ s, onOpenDay, overLimit, fmt, peakLabel }: {
  s: MonthSeries; onOpenDay: (date: string) => void;
  overLimit?: number;
  fmt: (v: number) => string;
  /** didascalia del giorno di picco, già formattata dal chiamante */
  peakLabel?: string;
}) => {
  const nDays = s.cells.length;
  const W = 342, H = 112;
  const cw = (W - 14) / nDays;
  /* barra più stretta della colonna e centrata: resta allineata al carpet
     sotto, ma con aria intorno invece di un blocco continuo */
  const bw = Math.max(2.5, cw * 0.56);
  const maxV = Math.max(...s.cells.map(c => c.v ?? 0), 1);
  return (
    <div className="px-6 mt-4">
      <svg viewBox={`0 0 ${W} ${H + 14}`} className="w-full block" style={{ touchAction: "pan-y" }}>
        {s.cells.map((c, di) => {
          const x = 14 + di * cw + (cw - bw) / 2;
          if (c.v == null) return null;
          const h = Math.max(bw, (c.v / maxV) * H); // mai più corta del suo diametro
          const over = overLimit != null && c.v > overLimit;
          return (
            <g key={c.date} onClick={() => { hapticLight(); onOpenDay(c.date); }} style={{ cursor: "pointer" }}>
              {/* area toccabile a tutta altezza e tutta colonna */}
              <rect x={14 + di * cw} y={0} width={cw} height={H} fill="transparent" />
              <rect
                x={x} y={H - h} width={bw} height={h}
                rx={bw / 2}
                fill={over ? AMBER : c.weekend ? "#dfeced" : c.today ? TEAL : "#9fd3d6"}
              />
            </g>
          );
        })}
        {/* linea di base, allineata all'asse del carpet */}
        <rect x={14} y={H} width={W - 14} height={0.7} fill={RULE} />
      </svg>
      {peakLabel && <p className="text-center" style={{ fontSize: 10.5, color: SUB, marginTop: -2 }}>{peakLabel}</p>}
    </div>
  );
};

export const MonthCarpet = ({ s, onOpenDay, legendLess, legendMore, legendWeekend, overLimit }: {
  s: MonthSeries; onOpenDay: (date: string) => void;
  legendLess: string; legendMore: string; legendWeekend: string;
  overLimit?: number;
}) => {
  const nDays = s.cells.length;
  const W = 342, H = 150, GAP = 1;
  const cw = (W - 14) / nDays;
  const ch = H / 24;
  return (
    <div className="px-6 mt-4">
      <svg viewBox={`0 0 ${W} ${H + 34}`} className="w-full block" style={{ touchAction: "pan-y" }}>
        {/* etichette ore a sinistra */}
        {[0, 6, 12, 18, 24].map(h => (
          <text key={h} x={0} y={Math.min(H - 1, (h / 24) * H) + 3.5} fontSize="7.5" fill={AXIS}>{h}</text>
        ))}
        {s.cells.map((c, di) => {
          const x = 14 + di * cw;
          return (
            <g key={c.date} onClick={() => { if (!c.future && c.v != null) { hapticLight(); onOpenDay(c.date); } }} style={{ cursor: c.future ? "default" : "pointer" }}>
              {Array.from({ length: 24 }, (_, h) => {
                const v = s.hours[di]?.[h];
                const over = overLimit != null && v != null && v > overLimit;
                const fill = c.future
                  ? "rgba(159,178,179,.10)"
                  : v == null
                    ? EMPTY_CELL
                    : over
                      ? `rgba(217,154,43,${(0.35 + 0.6 * Math.min(1, v / (s.hoursMax || 1))).toFixed(2)})`
                      : heatStep(v, s.hoursMax)!;
                return <rect key={h} x={x} y={(h / 24) * H} width={Math.max(0.5, cw - GAP)} height={ch - 0.6} rx={1} fill={fill} />;
              })}
              {/* oggi contornato */}
              {c.today && <rect x={x - 0.5} y={0} width={cw - GAP + 1} height={H} rx={2} fill="none" stroke={TEAL} strokeWidth="1.3" />}
              {/* numero del giorno (1, 5, 10, 15, 20, 25, 31) */}
              {(c.day === 1 || c.day % 5 === 0 || c.day === nDays) && (
                <text x={x + (cw - GAP) / 2} y={H + 11} fontSize="7.5" fill={c.future ? "rgba(159,178,179,.55)" : AXIS} textAnchor="middle">{c.day}</text>
              )}
              {/* tacca weekend sotto */}
              {c.weekend && <rect x={x} y={H + 15} width={Math.max(0.5, cw - GAP)} height={2.5} rx={1} fill={c.future ? "rgba(159,178,179,.35)" : "#b9c9ca"} />}
            </g>
          );
        })}
        {/* legenda: meno ▓▓▓ più + weekend */}
        <g transform={`translate(14, ${H + 27})`}>
          <text x={0} y={4} fontSize="8" fill={SUB}>{legendLess}</text>
          {HEAT_STEPS.map((c2, i) => (
            <rect key={i} x={26 + i * 9} y={-2} width={7} height={7} rx={1.5} fill={c2} />
          ))}
          <text x={76} y={4} fontSize="8" fill={SUB}>{legendMore}</text>
          <rect x={126} y={0} width={10} height={2.5} rx={1} fill="#b9c9ca" />
          <text x={140} y={4} fontSize="8" fill={SUB}>{legendWeekend}</text>
        </g>
      </svg>
    </div>
  );
};

export const MonthCalendar = ({ s, weekdays, onOpenDay, overLimit }: {
  s: MonthSeries; weekdays: string[]; onOpenDay: (date: string) => void;
  /** punto ambra per i giorni sopra la soglia della metrica */
  overLimit?: number;
}) => {
  const firstDow = (() => {
    const d = new Date(`${s.cells[0].date}T00:00:00`);
    return (d.getDay() + 6) % 7; // lunedì = 0
  })();
  return (
    <div className="px-6 mt-4">
      <div className="grid grid-cols-7 mb-1">
        {weekdays.map((w, i) => <span key={i} className="text-center" style={{ fontSize: 10, color: AXIS }}>{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: firstDow }).map((_, i) => <span key={`pad${i}`} />)}
        {s.cells.map(c => (
          <button key={c.date} type="button" disabled={c.future || c.v == null}
            onClick={() => { hapticLight(); onOpenDay(c.date); }}
            className="flex flex-col items-center justify-start" style={{ minHeight: 44 }}>
            <span
              className="grid place-items-center tabular-nums rounded-full"
              style={{
                width: 26, height: 26, fontSize: 12.5,
                color: c.future ? "#c3d2d3" : INK,
                border: c.today ? `1.5px solid ${TEAL}` : "1.5px solid transparent",
              }}
            >
              {c.day}
            </span>
            <span aria-hidden className="rounded-full" style={{
              width: c.v != null ? Math.max(4, Math.round((c.v / (s.maxV || 1)) * 14)) : 0,
              height: c.v != null ? Math.max(4, Math.round((c.v / (s.maxV || 1)) * 14)) : 0,
              background: overLimit != null && c.v != null && c.v > overLimit ? "rgba(217,154,43,.85)" : "rgba(10,143,145,.75)",
              marginTop: 2,
            }} />
          </button>
        ))}
      </div>
    </div>
  );
};

/** Vista «Anno» (§6.4 — PROPOSTA): 12 barre capsula, media tratteggiata,
    ambra solo i mesi sopra la media +10%. Tap su un mese lo apre. */
export const YearBars = ({ s, monthLabels, onOpenMonth, avgLabel, fmt }: {
  s: YearSeries; monthLabels: string[]; onOpenMonth: (m: number) => void; avgLabel?: string; fmt: (v: number) => string;
}) => {
  const max = Math.max(...s.months.map(x => x.v ?? 0), s.avg ?? 0, 1);
  const H = 150;
  return (
    <div className="px-6 mt-4">
      <div className="relative" style={{ height: H + 36 }}>
        {s.avg != null && (
          <div className="absolute left-0 right-0 flex items-center z-10" style={{ top: 18 + H * (1 - s.avg / max) }} aria-hidden>
            <div className="flex-1" style={{ borderTop: "1.5px dashed #b9c9ca" }} />
            {avgLabel && (
              <span className="pl-1.5 pr-1 shrink-0 rounded"
                style={{ fontSize: 10.5, color: SUB, background: "rgba(255,255,255,.85)" }}>
                {avgLabel}
              </span>
            )}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-between">
          {s.months.map((x, i) => {
            const over = x.v != null && s.avg != null && x.v > s.avg * 1.1;
            const h = x.v != null ? Math.max(8, (x.v / max) * H) : 0;
            return (
              <button key={x.m} type="button" onClick={() => { if (x.v != null) { hapticLight(); onOpenMonth(x.m); } }}
                className="flex flex-col items-center justify-end" style={{ width: 24, height: H + 36 }}>
                <span aria-hidden style={{
                  width: 10, height: h, borderRadius: 5,
                  background: x.v == null ? "transparent" : over ? AMBER : "#9fd3d6",
                }} />
                <span style={{ fontSize: 10, color: AXIS, marginTop: 5 }}>{monthLabels[i]}</span>
              </button>
            );
          })}
        </div>
      </div>
      {(() => {
        const top = [...s.months].filter(x => x.v != null).sort((a, b) => b.v! - a.v!)[0];
        return top ? (
          <p className="text-center mt-1" style={{ fontSize: 11, color: SUB }}>
            {monthLabels[top.m - 1]} · {fmt(top.v!)} {s.unit}
          </p>
        ) : null;
      })()}
    </div>
  );
};

/** Intervallo personalizzato (§10.6): una barra sottile per giorno. */
export const RangeBars = ({ days, onOpenDay, fmt }: {
  days: Array<{ date: string; v: number | null }>;
  onOpenDay: (date: string) => void;
  fmt: (v: number) => string;
}) => {
  const max = Math.max(...days.map(d => d.v ?? 0), 1);
  const H = 150;
  const n = days.length;
  const showEvery = n > 14 ? Math.ceil(n / 7) : 1;
  return (
    <div className="px-6 mt-4">
      <div className="flex items-end justify-between" style={{ height: H + 24, gap: n > 40 ? 1 : 2 }}>
        {days.map((d, i) => {
          const wd = new Date(`${d.date}T12:00:00`).getDay();
          const weekend = wd === 0 || wd === 6;
          const h = d.v != null ? Math.max(5, (d.v / max) * H) : 0;
          return (
            <button key={d.date} type="button" className="flex flex-col items-center justify-end min-w-0 flex-1"
              onClick={() => { if (d.v != null) { hapticLight(); onOpenDay(d.date); } }} style={{ height: H + 24 }}>
              <span aria-hidden style={{
                width: "100%", maxWidth: 12, height: h, borderRadius: 6,
                background: d.v == null ? "transparent" : weekend ? "#dfe7e8" : "#9fd3d6",
              }} />
              <span className="tabular-nums" style={{ fontSize: 8.5, color: AXIS, marginTop: 4, visibility: i % showEvery === 0 ? "visible" : "hidden" }}>
                {Number(d.date.slice(8, 10))}
              </span>
            </button>
          );
        })}
      </div>
      {(() => {
        const top = [...days].filter(d => d.v != null).sort((a, b) => b.v! - a.v!)[0];
        return top ? (
          <p className="text-center mt-1" style={{ fontSize: 11, color: SUB }}>
            {top.date.slice(8, 10)}/{top.date.slice(5, 7)} · {fmt(top.v!)}
          </p>
        ) : null;
      })()}
    </div>
  );
};

/** Building overview (parità col PC): tutte le metriche misurate adesso,
 *  due per riga, con icona, valore e una barra che dice dove sta il valore
 *  rispetto alla soglia. Tap su una scheda → quel grafico. */
export const BuildingOverview = ({ title, hint, rows, onPick }: {
  title: string;
  hint: string;
  rows: Array<{
    key: string; label: string; value: string; unit?: string;
    /** 0–1 rispetto alla soglia; assente = nessuna soglia nota */
    pct?: number;
    level: "ok" | "warn" | "crit";
    Icon: LucideIcon;
  }>;
  onPick?: (key: string) => void;
}) => (
  <div className="px-6" style={{ marginTop: 22 }}>
    <div className="flex items-baseline justify-between mb-2.5">
      <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{title}</span>
      <span style={{ fontSize: 11, color: SUB }}>{hint}</span>
    </div>
    <div className="grid grid-cols-2" style={{ gap: 10 }}>
      {rows.map(r => {
        const color = r.level === "crit" ? RED : r.level === "warn" ? AMBER : TEAL;
        return (
          <button key={r.key} type="button"
            onClick={() => { if (onPick) { hapticLight(); onPick(r.key); } }}
            className="text-left rounded-2xl"
            style={{ background: "#f4f9f9", padding: "11px 12px 12px", minHeight: 76 }}>
            <span className="flex items-center" style={{ gap: 6 }}>
              <r.Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} aria-hidden />
              <span className="truncate" style={{ fontSize: 11, color: SUB }}>{r.label}</span>
            </span>
            <span className="flex items-baseline" style={{ gap: 3, marginTop: 3 }}>
              <span className="tabular-nums" style={{ fontSize: 19, fontWeight: 600, color: INK, lineHeight: 1.1 }}>{r.value}</span>
              {r.unit && <span style={{ fontSize: 10.5, color: SUB }}>{r.unit}</span>}
            </span>
            {/* barra solo con una soglia nota: niente scale inventate */}
            {r.pct != null && (
              <span className="block rounded-full overflow-hidden" style={{ height: 4, background: "#e4eded", marginTop: 8 }} aria-hidden>
                <span className="block h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, r.pct * 100))}%`, background: color }} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

export const LabelValueGrid = ({ items }: { items: Array<{ label: string; value: string }> }) => (
  <div className="px-6 mt-4">
    <div className="grid grid-cols-2">
      {items.map((it, i) => (
        <div key={it.label} className="py-3.5 pr-3" style={{
          borderTop: `1px solid ${RULE}`,
          borderLeft: i % 2 === 1 ? `1px solid ${RULE}` : undefined,
          paddingLeft: i % 2 === 1 ? 14 : 0,
        }}>
          <div style={{ fontSize: 13, color: SUB }}>{it.label}</div>
          <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 500, color: INK, marginTop: 2 }}>{it.value}</div>
        </div>
      ))}
    </div>
  </div>
);
