/**
 * Pezzi comuni della dashboard modulo mobile (brief §6.1):
 * segmented control, pager del periodo, riga del verdetto, schede metrica,
 * asse del tempo, riga di sintesi, menu esportazioni, striscia causa.
 * Palette §1.5 (dashboard chiara).
 */
import { useEffect, useRef, useState } from "react";
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

export type Period = "day" | "week" | "month" | "year" | "range";

export const PeriodSegment = ({ value, onChange, labels }: { value: Period; onChange: (p: Period) => void; labels: Partial<Record<Period, string>> }) => (
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

export const PeriodPager = ({ title, subtitle, onPrev, onNext, nextDisabled, titleSize = 30, onTitleTap }: {
  title: string; subtitle?: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean; titleSize?: number;
  /** §10.6: un tocco sul titolo apre il foglio del periodo personalizzato */
  onTitleTap?: () => void;
}) => (
  <div className="flex items-center justify-center gap-2 mt-3">
    <button type="button" onClick={onPrev} aria-label="‹" className="grid place-items-center" style={{ width: 44, height: 44, color: SUB }}>
      <ChevronLeft className="w-5 h-5" />
    </button>
    <button type="button" onClick={onTitleTap} disabled={!onTitleTap} className="text-center" style={{ minWidth: 190, maxWidth: 270 }}>
      <div style={{ fontSize: titleSize, fontWeight: 600, color: INK, lineHeight: 1.1 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: SUB, marginTop: 2 }}>{subtitle}</div>}
    </button>
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

/** Causa sotto il grafico (§6.1.8): striscia acceso/spento (HVAC) o traccia
    sottile (temperatura esterna), sullo stesso asse X del grafico. */
export const CauseTrack = (props:
  | { variant: "onOff"; strip: boolean[]; label: string; note?: string }
  | { variant: "line"; series: Array<number | null>; label: string; note?: string }
) => (
  <div className="px-6 mt-4">
    <div className="flex items-baseline gap-2 mb-1.5">
      <span style={{ fontSize: 12.5, fontWeight: 500, color: INK }}>{props.label}</span>
      {props.note && <span style={{ fontSize: 11, color: SUB }}>{props.note}</span>}
    </div>
    {props.variant === "onOff" ? (
      <div className="flex overflow-hidden" style={{ height: 10, borderRadius: 5, background: "#e6eeee" }} aria-hidden>
        {props.strip.map((on, i) => (
          <span key={i} className="flex-1" style={{ background: on ? "#9fd3d6" : "transparent" }} />
        ))}
      </div>
    ) : (
      (() => {
        /* stessa geometria orizzontale di TimeSeriesChart (PL14/PR44 su 390),
           ma qui il contenitore è già dentro px-6: si disegna 0→342 */
        const W = 342, H = 40;
        const vals = props.series.filter((v): v is number => v != null);
        if (vals.length < 2) return null;
        const min = Math.min(...vals), max = Math.max(...vals);
        const x = (h: number) => (h / 23) * W;
        const y = (v: number) => 4 + (1 - (v - min) / (max - min || 1)) * (H - 8);
        let d = "", pen = false;
        props.series.forEach((v, h) => {
          if (v == null) { pen = false; return; }
          d += `${pen ? "L" : "M"}${x(h).toFixed(1)},${y(v).toFixed(1)} `;
          pen = true;
        });
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ height: H }} aria-hidden>
            <path d={d} fill="none" stroke="#8aa3a5" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        );
      })()
    )}
  </div>
);

/** Foglio selettore sonde (§10.2): una riga per sonda con famiglia e numero
    di metriche; la sonda offline è segnalata. La selezione decide anche
    QUALI schede metriche esistono — niente «slide fantasma». */
export interface ProbeRow {
  id: string; label: string; family: "WELL" | "LEED" | null; metricsCount: number; offlineHours?: number;
}
export const ProbeSheet = ({ open, probes, selected, labels, onApply, onClose }: {
  open: boolean;
  probes: ProbeRow[];
  selected: string[] | null;          // null = tutte
  labels: { title: string; all: string; metrics: string; offlineFor: string; note: string; apply: string };
  onApply: (ids: string[] | null) => void;
  onClose: () => void;
}) => {
  const [sel, setSel] = useState<string[] | null>(selected);
  useEffect(() => { if (open) setSel(selected); }, [open, selected]);
  useBackDismiss(open, onClose);
  if (!open) return null;
  const isAll = sel == null || sel.length === probes.length;
  const toggle = (id: string) => {
    hapticLight();
    const cur = sel == null ? probes.map(p => p.id) : [...sel];
    const i = cur.indexOf(id);
    if (i >= 0) { if (cur.length > 1) cur.splice(i, 1); } else cur.push(id);
    setSel(cur.length === probes.length ? null : cur);
  };
  return (
    <>
      <div className="fixed inset-0 z-[70]" style={{ background: "rgba(5,20,22,.42)" }} onClick={onClose} aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-[71] rounded-t-3xl" role="dialog" aria-modal="true"
        style={{ background: "#fbfdfd", boxShadow: "0 -12px 40px rgba(5,20,22,.25)", paddingBottom: "calc(var(--sab, 0px) + 14px)" }}>
        <div className="flex justify-center pt-2.5 pb-1" aria-hidden><span className="rounded-full" style={{ width: 40, height: 4, background: "#d4e0e0" }} /></div>
        <div className="flex items-center justify-between pl-6 pr-2">
          <span className="uppercase font-bold" style={{ fontSize: 12, letterSpacing: "0.18em", color: INK }}>{labels.title}</span>
          <button type="button" onClick={onClose} aria-label="×" className="grid place-items-center" style={{ width: 44, height: 44, fontSize: 18, color: SUB }}>×</button>
        </div>
        <div className="px-6 pt-1">
          <button type="button" onClick={() => { hapticLight(); setSel(null); }}
            className="w-full flex items-center gap-3 text-left" style={{ minHeight: 48, borderBottom: `1px solid ${RULE}` }}>
            <span aria-hidden style={{ width: 18, color: TEAL, fontWeight: 700 }}>{isAll ? "✓" : ""}</span>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>{labels.all.replace("{n}", String(probes.length))}</span>
          </button>
          {probes.map(p => {
            const on = isAll || (sel ?? []).includes(p.id);
            return (
              <button key={p.id} type="button" onClick={() => toggle(p.id)} disabled={p.offlineHours != null && probes.length === 1}
                className="w-full flex items-center gap-3 text-left" style={{ minHeight: 52, borderBottom: `1px solid ${RULE}`, opacity: p.offlineHours != null ? 0.55 : 1 }}>
                <span aria-hidden style={{ width: 18, color: TEAL, fontWeight: 700 }}>{on ? "✓" : ""}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ fontSize: 14.5, color: INK }}>{p.label}</span>
                  <span className="block" style={{ fontSize: 11.5, color: SUB }}>
                    {p.family ?? "—"} · {p.metricsCount} {labels.metrics}
                    {p.offlineHours != null && ` · ${labels.offlineFor.replace("{h}", String(p.offlineHours))}`}
                  </span>
                </span>
              </button>
            );
          })}
          <p style={{ fontSize: 12, color: SUB, margin: "10px 0 12px", lineHeight: 1.5 }}>{labels.note}</p>
          <button type="button" onClick={() => { hapticLight(); onApply(sel); onClose(); }}
            className="w-full rounded-full font-bold uppercase text-white"
            style={{ minHeight: 48, fontSize: 12.5, letterSpacing: "0.14em", background: TEAL }}>
            {labels.apply}
          </button>
        </div>
      </div>
    </>
  );
};

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
