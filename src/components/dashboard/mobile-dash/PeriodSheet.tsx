/**
 * Foglio «Periodo» (atlante §10.6): si apre toccando il titolo del periodo.
 * Le scorciatoie coprono i casi del PC «Month to date» e «Year to date»
 * (Mese/Anno correnti sono già «in corso»); il calendario a doppio mese fa
 * da selettore dell'intervallo «Custom». Chiuso da ×, velo o back (§2.2).
 */
import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackDismiss } from "@/hooks/useBackDismiss";
import { hapticLight } from "@/lib/native";
import { INK, RULE, SUB, TEAL } from "./bits";

export type PeriodChoice =
  | { kind: "month" } | { kind: "year" } | { kind: "last30" }
  | { kind: "range"; from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const PeriodSheet = ({ open, onApply, onClose }: {
  open: boolean;
  onApply: (c: PeriodChoice) => void;
  onClose: () => void;
}) => {
  const { t, language } = useLanguage();
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  useBackDismiss(open, onClose);

  const todayKey = keyOf(new Date());
  const months = useMemo(() => {
    // mese precedente + mese corrente, lunedì-first
    const now = new Date();
    return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1)];
  }, []);
  const monthName = useMemo(() => new Intl.DateTimeFormat(language, { month: "long", year: "numeric" }), [language]);
  const dfShort = useMemo(() => new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }), [language]);
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(language, { weekday: "narrow" });
    const base = new Date(2026, 5, 1); // lunedì
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(base.getTime() + i * 86400e3)));
  }, [language]);

  if (!open) return null;

  const pick = (key: string) => {
    hapticLight();
    if (!from || (from && to)) { setFrom(key); setTo(null); return; }
    if (key < from) { setFrom(key); setTo(from); return; }
    setTo(key);
  };
  const inRange = (key: string) => from && to && key >= from && key <= to;

  const shortcut = (label: string, choice: PeriodChoice) => (
    <button key={label} type="button" onClick={() => { hapticLight(); onApply(choice); onClose(); }}
      className="rounded-full font-semibold"
      style={{ fontSize: 12, minHeight: 38, padding: "0 13px", background: "#eef4f4", color: INK }}>
      {label}
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-[70]" style={{ background: "rgba(5,20,22,.42)" }} onClick={onClose} aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-[71] rounded-t-3xl overflow-y-auto no-scrollbar" role="dialog" aria-modal="true"
        style={{ background: "#fbfdfd", boxShadow: "0 -12px 40px rgba(5,20,22,.25)", maxHeight: "82dvh", paddingBottom: "calc(var(--sab, 0px) + 14px)" }}>
        <div className="flex justify-center pt-2.5 pb-1" aria-hidden><span className="rounded-full" style={{ width: 40, height: 4, background: "#d4e0e0" }} /></div>
        <div className="flex items-center justify-between pl-6 pr-2">
          <span className="uppercase font-bold" style={{ fontSize: 12, letterSpacing: "0.18em", color: INK }}>{t("md.period")}</span>
          <button type="button" onClick={onClose} aria-label="×" className="grid place-items-center" style={{ width: 44, height: 44, fontSize: 18, color: SUB }}>×</button>
        </div>
        {/* scorciatoie: coprono Month-to-date / Year-to-date / ultimi 30 gg */}
        <div className="flex flex-wrap gap-2 px-6 pt-1 pb-3">
          {shortcut(t("md.cur_month"), { kind: "month" })}
          {shortcut(t("md.cur_year"), { kind: "year" })}
          {shortcut(t("md.last30"), { kind: "last30" })}
          <span className="rounded-full font-semibold grid place-items-center"
            style={{ fontSize: 12, minHeight: 38, padding: "0 13px", border: `1.4px solid ${TEAL}`, color: TEAL }}>
            {t("md.custom")}
          </span>
        </div>
        {/* calendario a doppio mese */}
        {months.map(m0 => {
          const nDays = new Date(m0.getFullYear(), m0.getMonth() + 1, 0).getDate();
          const firstDow = (new Date(m0.getFullYear(), m0.getMonth(), 1).getDay() + 6) % 7;
          return (
            <div key={m0.getMonth()} className="px-6 pb-2">
              <p style={{ fontSize: 13, fontWeight: 600, color: INK, margin: "6px 0 4px", textTransform: "capitalize" }}>{monthName.format(m0)}</p>
              <div className="grid grid-cols-7">
                {weekdays.map((w, i) => <span key={i} className="text-center" style={{ fontSize: 9.5, color: "#9fb2b3" }}>{w}</span>)}
                {Array.from({ length: firstDow }).map((_, i) => <span key={`p${i}`} />)}
                {Array.from({ length: nDays }, (_, i) => {
                  const day = i + 1;
                  const key = `${m0.getFullYear()}-${pad(m0.getMonth() + 1)}-${pad(day)}`;
                  const future = key > todayKey;
                  const isEdge = key === from || key === to;
                  const mid = inRange(key) && !isEdge;
                  return (
                    <button key={day} type="button" disabled={future} onClick={() => pick(key)}
                      className="grid place-items-center tabular-nums"
                      style={{
                        minHeight: 38, fontSize: 13,
                        color: future ? "#c3d2d3" : isEdge ? "#fff" : INK,
                        background: isEdge ? TEAL : mid ? "rgba(10,143,145,.12)" : "transparent",
                        borderRadius: isEdge ? 999 : mid ? 0 : 999,
                      }}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="flex gap-3 px-6 pt-1" style={{ borderTop: `1px solid ${RULE}` }}>
          <button type="button" onClick={onClose} className="flex-1 rounded-full font-semibold"
            style={{ minHeight: 46, fontSize: 13, color: SUB, border: `1.4px solid ${RULE}`, marginTop: 10 }}>
            {t("md.cancel")}
          </button>
          <button type="button" disabled={!from || !to}
            onClick={() => { if (from && to) { hapticLight(); onApply({ kind: "range", from, to }); onClose(); } }}
            className="flex-[2] rounded-full font-bold uppercase text-white"
            style={{ minHeight: 46, fontSize: 12, letterSpacing: "0.1em", background: from && to ? TEAL : "#c3d2d3", marginTop: 10 }}>
            {t("md.apply")}{from && to ? ` · ${dfShort.format(new Date(`${from}T12:00:00`))} – ${dfShort.format(new Date(`${to}T12:00:00`))}` : ""}
          </button>
        </div>
      </div>
    </>
  );
};

export default PeriodSheet;
