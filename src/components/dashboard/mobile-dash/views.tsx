/**
 * Viste Settimana e Mese della dashboard modulo mobile (brief §6.2-6.3).
 * Settimana: barre capsula sottili (ambra solo sopra la media, weekend più
 * chiari), media feriale tratteggiata, heatmap 7×24 compatta che apre il
 * giorno al tocco. Mese: calendario con punto proporzionale al consumo,
 * oggi cerchiato, futuro in grigio; sintesi e griglia 2×2.
 */
import { AMBER, AXIS, INK, RULE, SUB, TEAL } from "./bits";
import type { MonthSeries, WeekSeries } from "./useModuleSeries";
import { hapticLight } from "@/lib/native";

export const WeekBars = ({ s, onOpenDay, avgLabel, fmt, weekdays }: {
  s: WeekSeries; onOpenDay: (date: string) => void; avgLabel?: string; fmt: (v: number) => string; weekdays?: string[];
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
            const over = d.v != null && s.weekdayAvg != null && !isWeekend && d.v > s.weekdayAvg * 1.1;
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
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const HourHeatmap = ({ s, onOpenDay, title, hint, weekdays }: {
  s: WeekSeries; onOpenDay: (date: string) => void; title: string; hint: string; weekdays?: string[];
}) => (
  <div className="px-6 mt-5">
    <div className="flex items-baseline gap-2 mb-2">
      <span style={{ fontSize: 12.5, fontWeight: 500, color: INK }}>{title}</span>
      <span style={{ fontSize: 11, color: SUB }}>{hint}</span>
    </div>
    <div style={{ height: 100 }} className="flex flex-col justify-between">
      {s.heat.map((row, di) => (
        <button key={di} type="button" onClick={() => { hapticLight(); onOpenDay(s.days[di].date); }}
          className="flex items-center gap-[2px]" style={{ height: 12 }}>
          <span className="shrink-0 text-left" style={{ width: 12, fontSize: 9, color: AXIS }}>{weekdays?.[di] ?? s.days[di].label}</span>
          {row.map((v, hi) => (
            <span key={hi} className="flex-1" style={{
              height: 10, borderRadius: 3,
              background: v == null ? "transparent" : `rgba(10,143,145,${(0.06 + 0.8 * Math.min(1, v / (s.heatMax || 1))).toFixed(2)})`,
              border: v == null ? `1px solid ${RULE}` : undefined,
            }} />
          ))}
        </button>
      ))}
    </div>
    <div className="flex justify-between pl-4 mt-1" style={{ fontSize: 9, color: AXIS }}>
      {[0, 6, 12, 18, 24].map(hh => <span key={hh}>{hh}</span>)}
    </div>
  </div>
);

export const MonthCalendar = ({ s, weekdays, onOpenDay }: {
  s: MonthSeries; weekdays: string[]; onOpenDay: (date: string) => void;
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
              background: "rgba(10,143,145,.75)", marginTop: 2,
            }} />
          </button>
        ))}
      </div>
    </div>
  );
};

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
