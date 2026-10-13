/**
 * Pezzi comuni della dashboard modulo mobile (brief §6.1):
 * segmented control, pager del periodo, riga del verdetto, schede metrica,
 * asse del tempo, riga di sintesi, menu esportazioni, striscia causa.
 * Palette §1.5 (dashboard chiara).
 */
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, Moon, Sun } from "lucide-react";
import { useBackDismiss } from "@/hooks/useBackDismiss";
import { hapticLight } from "@/lib/native";

export const INK = "#163a3c";
export const SUB = "#7f9597";
export const AXIS = "#9fb2b3";
export const RULE = "#eaf0f0";
export const TEAL = "#0a8f91";
export const AMBER = "#d99a2b";
export const RED = "#cf4a6e";

export type Period = "day" | "week" | "month" | "year";

export const PeriodSegment = ({ value, onChange, labels }: { value: Period; onChange: (p: Period) => void; labels: Record<Period, string> }) => (
  <div className="flex rounded-full p-1 mx-auto" style={{ background: "#eef4f4", width: "fit-content" }}>
    {(Object.keys(labels) as Period[]).map(p => (
      <button
        key={p}
        type="button"
        onClick={() => { hapticLight(); onChange(p); }}
        className="rounded-full font-semibold transition-all"
        style={{
          fontSize: 12.5, minHeight: 36, padding: "0 14px",
          color: value === p ? INK : SUB,
          background: value === p ? "#ffffff" : "transparent",
          boxShadow: value === p ? "0 1px 4px rgba(22,58,60,.12)" : undefined,
        }}
      >
        {labels[p]}
      </button>
    ))}
  </div>
);

export const PeriodPager = ({ title, subtitle, onPrev, onNext, nextDisabled, titleSize = 30 }: {
  title: string; subtitle?: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean; titleSize?: number;
}) => (
  <div className="flex items-center justify-center gap-2 mt-3">
    <button type="button" onClick={onPrev} aria-label="‹" className="grid place-items-center" style={{ width: 44, height: 44, color: SUB }}>
      <ChevronLeft className="w-5 h-5" />
    </button>
    <div className="text-center" style={{ minWidth: 190, maxWidth: 270 }}>
      <div style={{ fontSize: titleSize, fontWeight: 600, color: INK, lineHeight: 1.1 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>{subtitle}</div>}
    </div>
    <button type="button" onClick={onNext} aria-label="›" disabled={nextDisabled} className="grid place-items-center" style={{ width: 44, height: 44, color: nextDisabled ? RULE : SUB }}>
      <ChevronRight className="w-5 h-5" />
    </button>
  </div>
);

export const VerdictLine = ({ color, verdict, summary, onExplain }: { color: string; verdict: string; summary?: string; onExplain?: () => void }) => (
  <div className="flex items-center justify-center gap-2 mt-2 px-6 flex-wrap">
    <span aria-hidden className="rounded-full shrink-0" style={{ width: 8, height: 8, background: color }} />
    <span style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{verdict}</span>
    {summary && <span style={{ fontSize: 13, color: SUB }}>· {summary}</span>}
    {onExplain && (
      <button type="button" onClick={onExplain} aria-label="?" className="grid place-items-center" style={{ width: 44, height: 44, margin: -12 }}>
        <span aria-hidden className="grid place-items-center rounded-full"
          style={{ width: 20, height: 20, fontSize: 12, fontWeight: 600, border: `1.3px solid ${SUB}`, color: SUB }}>
          ?
        </span>
      </button>
    )}
  </div>
);

export const MetricTabs = ({ tabs, value, onChange }: { tabs: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) => (
  <div className="flex gap-5 overflow-x-auto no-scrollbar px-6 mt-4" style={{ WebkitOverflowScrolling: "touch" }}>
    {tabs.map(tb => {
      const sel = tb.id === value;
      return (
        <button
          key={tb.id}
          type="button"
          onClick={() => { hapticLight(); onChange(tb.id); }}
          className="shrink-0 uppercase font-semibold"
          style={{
            fontSize: 12, letterSpacing: "0.12em", minHeight: 40,
            color: sel ? INK : AXIS,
            borderBottom: sel ? `2px solid ${TEAL}` : "2px solid transparent",
          }}
        >
          {tb.label}
        </button>
      );
    })}
  </div>
);

export const TimeAxisBand = () => (
  <div className="flex items-center justify-between px-8 mt-1" style={{ color: AXIS, fontSize: 11 }}>
    <Moon className="w-3.5 h-3.5" aria-hidden />
    <span>06:00</span>
    <Sun className="w-4 h-4" aria-hidden />
    <span>18:00</span>
    <Moon className="w-3.5 h-3.5" aria-hidden />
  </div>
);

export const SummaryRow = ({ items }: { items: Array<{ value: string; label: string }> }) => (
  <div className="px-6 mt-5">
    <div style={{ borderTop: `1px solid ${RULE}` }} />
    <div className="grid grid-cols-3 gap-3 pt-4">
      {items.map(it => (
        <div key={it.label}>
          <div className="tabular-nums" style={{ fontSize: 20, fontWeight: 400, color: INK }}>{it.value}</div>
          <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{it.label}</div>
        </div>
      ))}
    </div>
  </div>
);

/** Causa sotto il grafico (§6.1.8): traccia sottile o striscia acceso/spento. */
export const CauseTrack = ({ variant, strip, label, note }: {
  variant: "onOff"; strip: boolean[]; label: string; note?: string;
}) => (
  <div className="px-6 mt-4">
    <div className="flex items-baseline gap-2 mb-1.5">
      <span style={{ fontSize: 12.5, fontWeight: 500, color: INK }}>{label}</span>
      {note && <span style={{ fontSize: 11, color: SUB }}>{note}</span>}
    </div>
    <div className="flex overflow-hidden" style={{ height: 10, borderRadius: 5, background: "#e6eeee" }} aria-hidden>
      {strip.map((on, i) => (
        <span key={i} className="flex-1" style={{ background: on ? "#9fd3d6" : "transparent" }} />
      ))}
    </div>
  </div>
);

/** Menu «⋯»: tutte le esportazioni in un posto solo (§6.1.1). */
export const ExportMenu = ({ items }: { items: Array<{ label: string; onClick: () => void }> }) => {
  const [open, setOpen] = useState(false);
  useBackDismiss(open, () => setOpen(false));
  return (
    <>
      <button type="button" aria-label="⋯" onClick={() => setOpen(o => !o)} className="grid place-items-center" style={{ width: 44, height: 44, color: INK }}>
        <MoreHorizontal className="w-5 h-5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-3 z-[61] rounded-2xl py-1.5"
            style={{ top: 52, background: "#fff", boxShadow: "0 10px 30px rgba(22,58,60,.18)", border: `1px solid ${RULE}`, minWidth: 150 }}>
            {items.map(it => (
              <button key={it.label} type="button"
                onClick={() => { setOpen(false); it.onClick(); }}
                className="block w-full text-left px-4" style={{ minHeight: 44, fontSize: 13.5, color: INK }}>
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
};
