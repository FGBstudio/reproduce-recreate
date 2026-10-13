/**
 * Foglio «Dati spiegati» (brief §5.5, contenuti §7).
 *
 * Bottom sheet CHIARO (come la pagina, niente pannelli scuri) che spiega ogni
 * KPI: definizione in una frase e livelli con soglie; il livello in cui si
 * trova adesso il sito è evidenziato con l'etichetta «ADESSO · valore».
 * Si chiude con ×, swipe sulla maniglia, tap sul velo o back Android.
 *
 * Le soglie: CO₂ e intensità dal brief (indicative, da validare FGB); IAQ da
 * airQuality.ts; TVOC scala UBA (già nel codice); PM2.5 dalla curva del
 * codice (indicativa); LEED/WELL/BREEAM ufficiali. Temp/umidità: solo
 * definizione, fasce da definire con FGB (niente soglie inventate).
 */
import { useMemo, useRef } from "react";
import { X, Wind, Zap, Award, Thermometer, Droplets, FlaskConical, Haze, Gauge, CalendarClock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackDismiss } from "@/hooks/useBackDismiss";

type Group = "air" | "energy" | "water" | "cert";

interface LevelRow {
  nameKey: string;      // chiave i18n del nome livello (o nome proprio es. "Gold")
  properName?: boolean; // true = nome ufficiale non tradotto
  range: string;        // intervallo mostrato a destra (numeri/unità, no i18n)
  adviceKey?: string;
  color: string;
  /** true se il valore corrente del sito cade in questo livello */
  match?: (v: number) => boolean;
}

interface TabDef {
  id: string;
  group: Group;
  label: string;         // etichetta scheda (nomi tecnici: CO₂, TVOC… no i18n)
  icon: typeof Wind;
  titleKey?: string;     // titolo esteso (se diverso dall'etichetta)
  defKey: string;
  unit?: string;
  levels?: LevelRow[];
}

const C = { exc: "#37b98a", good: "#0a8f91", mod: "#d99a2b", poor: "#cf4a6e" };

const TABS: TabDef[] = [
  {
    id: "iaq", group: "air", label: "IAQ", icon: Gauge, defKey: "xp.def_iaq",
    levels: [
      { nameKey: "xp.lvl_excellent", range: "≥ 85", adviceKey: "xp.iaq_l1", color: C.exc, match: v => v >= 85 },
      { nameKey: "xp.lvl_good", range: "70–84", adviceKey: "xp.iaq_l2", color: C.good, match: v => v >= 70 && v < 85 },
      { nameKey: "xp.lvl_moderate", range: "50–69", adviceKey: "xp.iaq_l3", color: C.mod, match: v => v >= 50 && v < 70 },
      { nameKey: "xp.lvl_poor", range: "< 50", adviceKey: "xp.iaq_l4", color: C.poor, match: v => v < 50 },
    ],
  },
  {
    id: "co2", group: "air", label: "CO₂", icon: Wind, defKey: "xp.def_co2", unit: "ppm",
    levels: [
      { nameKey: "xp.lvl_excellent", range: "< 600 ppm", adviceKey: "xp.co2_l1", color: C.exc, match: v => v < 600 },
      { nameKey: "xp.lvl_good", range: "600–1000 ppm", adviceKey: "xp.co2_l2", color: C.good, match: v => v >= 600 && v <= 1000 },
      { nameKey: "xp.lvl_moderate", range: "1000–1500 ppm", adviceKey: "xp.co2_l3", color: C.mod, match: v => v > 1000 && v <= 1500 },
      { nameKey: "xp.lvl_poor", range: "> 1500 ppm", adviceKey: "xp.co2_l4", color: C.poor, match: v => v > 1500 },
    ],
  },
  { id: "temp", group: "air", label: "Temp", icon: Thermometer, defKey: "xp.def_temp", unit: "°C" },
  { id: "humidity", group: "air", label: "RH", icon: Droplets, defKey: "xp.def_humidity", unit: "%" },
  {
    /* Soglie allineate alle bande del grafico TVOC desktop (verde <250,
       giallo 250–500, rosso >500 ppb) — decisione owner 13/10 */
    id: "tvoc", group: "air", label: "TVOC", icon: FlaskConical, defKey: "xp.def_tvoc", unit: "ppb",
    levels: [
      { nameKey: "xp.lvl_good", range: "< 250 ppb", adviceKey: "xp.tvoc_l1", color: C.good, match: v => v < 250 },
      { nameKey: "xp.lvl_moderate", range: "250–500 ppb", adviceKey: "xp.tvoc_l2", color: C.mod, match: v => v >= 250 && v <= 500 },
      { nameKey: "xp.lvl_poor", range: "> 500 ppb", adviceKey: "xp.tvoc_l3", color: C.poor, match: v => v > 500 },
    ],
  },
  {
    id: "pm25", group: "air", label: "PM2.5", icon: Haze, defKey: "xp.def_pm25", unit: "µg/m³",
    levels: [
      { nameKey: "xp.lvl_excellent", range: "< 5", adviceKey: "xp.pm25_l1", color: C.exc, match: v => v < 5 },
      { nameKey: "xp.lvl_good", range: "5–15", adviceKey: "xp.pm25_l2", color: C.good, match: v => v >= 5 && v <= 15 },
      { nameKey: "xp.lvl_moderate", range: "15–35", adviceKey: "xp.pm25_l3", color: C.mod, match: v => v > 15 && v <= 35 },
      { nameKey: "xp.lvl_poor", range: "> 35", adviceKey: "xp.pm25_l4", color: C.poor, match: v => v > 35 },
    ],
  },
  {
    /* Soglie dal metrics_catalog (GOOD <50 / OK 50–100 / WARN 100–150 / CRIT >150) */
    id: "pm10", group: "air", label: "PM10", icon: Haze, defKey: "xp.def_pm10", unit: "µg/m³",
    levels: [
      { nameKey: "xp.lvl_good", range: "< 50", adviceKey: "xp.pm10_l1", color: C.good, match: v => v < 50 },
      { nameKey: "xp.lvl_moderate", range: "50–100", adviceKey: "xp.pm10_l2", color: C.mod, match: v => v >= 50 && v <= 100 },
      { nameKey: "xp.lvl_poor", range: "> 100", adviceKey: "xp.pm10_l3", color: C.poor, match: v => v > 100 },
    ],
  },
  {
    id: "co", group: "air", label: "CO", icon: Wind, defKey: "xp.def_co", unit: "ppm",
    levels: [
      { nameKey: "xp.lvl_good", range: "< 4 ppm", adviceKey: "xp.co_l1", color: C.good, match: v => v < 4 },
      { nameKey: "xp.lvl_moderate", range: "4–9 ppm", adviceKey: "xp.co_l2", color: C.mod, match: v => v >= 4 && v <= 9 },
      { nameKey: "xp.lvl_poor", range: "> 9 ppm", adviceKey: "xp.co_l3", color: C.poor, match: v => v > 9 },
    ],
  },
  {
    id: "o3", group: "air", label: "O₃", icon: Wind, defKey: "xp.def_o3", unit: "ppb",
    levels: [
      { nameKey: "xp.lvl_good", range: "< 50 ppb", adviceKey: "xp.o3_l1", color: C.good, match: v => v < 50 },
      { nameKey: "xp.lvl_moderate", range: "50–100 ppb", adviceKey: "xp.o3_l2", color: C.mod, match: v => v >= 50 && v <= 100 },
      { nameKey: "xp.lvl_poor", range: "> 100 ppb", adviceKey: "xp.o3_l3", color: C.poor, match: v => v > 100 },
    ],
  },
  /* ── Acqua (soglie dal metrics_catalog: pH 6.5–8.5, torbidità 1/5, cloro 0.2–0.5) ── */
  { id: "wflow", group: "water", label: "L/min", icon: Droplets, defKey: "xp.def_wflow", unit: "L/min" },
  {
    id: "wph", group: "water", label: "pH", icon: FlaskConical, defKey: "xp.def_wph", unit: "pH",
    levels: [
      { nameKey: "xp.lvl_optimal", range: "6.5–8.5", adviceKey: "xp.wph_l1", color: C.good, match: v => v >= 6.5 && v <= 8.5 },
      { nameKey: "xp.lvl_poor", range: "< 6.5 · > 8.5", adviceKey: "xp.wph_l2", color: C.poor, match: v => v < 6.5 || v > 8.5 },
    ],
  },
  {
    id: "wturb", group: "water", label: "NTU", icon: Haze, defKey: "xp.def_wturb", unit: "NTU",
    levels: [
      { nameKey: "xp.lvl_optimal", range: "0–1 NTU", adviceKey: "xp.wturb_l1", color: C.good, match: v => v <= 1 },
      { nameKey: "xp.lvl_moderate", range: "1–5 NTU", adviceKey: "xp.wturb_l2", color: C.mod, match: v => v > 1 && v <= 5 },
      { nameKey: "xp.lvl_poor", range: "> 5 NTU", adviceKey: "xp.wturb_l3", color: C.poor, match: v => v > 5 },
    ],
  },
  {
    id: "wchlor", group: "water", label: "Cl", icon: FlaskConical, defKey: "xp.def_wchlor", unit: "mg/L",
    levels: [
      { nameKey: "xp.lvl_optimal", range: "0.2–0.5 mg/L", adviceKey: "xp.wchlor_l1", color: C.good, match: v => v >= 0.2 && v <= 0.5 },
      { nameKey: "xp.lvl_moderate", range: "0.1–1.0 mg/L", adviceKey: "xp.wchlor_l2", color: C.mod, match: v => (v >= 0.1 && v < 0.2) || (v > 0.5 && v <= 1) },
      { nameKey: "xp.lvl_poor", range: "< 0.1 · > 1.0", adviceKey: "xp.wchlor_l3", color: C.poor, match: v => v < 0.1 || v > 1 },
    ],
  },
  {
    id: "power", group: "energy", label: "kW", icon: Zap, defKey: "xp.def_power", unit: "kW",
  },
  {
    id: "intensity", group: "energy", label: "kWh/m²", icon: Gauge, defKey: "xp.def_intensity", unit: "kWh/m²·y",
    levels: [
      { nameKey: "xp.lvl_excellent", range: "< 50", adviceKey: "xp.int_l1", color: C.exc, match: v => v < 50 },
      { nameKey: "xp.lvl_good", range: "50–90", adviceKey: "xp.int_l2", color: C.good, match: v => v >= 50 && v <= 90 },
      { nameKey: "xp.lvl_medium", range: "90–150", adviceKey: "xp.int_l3", color: C.mod, match: v => v > 90 && v <= 150 },
      { nameKey: "xp.lvl_high", range: "> 150", adviceKey: "xp.int_l4", color: C.poor, match: v => v > 150 },
    ],
  },
  {
    id: "leed", group: "cert", label: "LEED", icon: Award, defKey: "xp.def_leed", unit: "pt",
    levels: [
      { nameKey: "Certified", properName: true, range: "40–49 pt", adviceKey: "xp.leed_l1", color: C.good },
      { nameKey: "Silver", properName: true, range: "50–59 pt", adviceKey: "xp.leed_l2", color: C.good },
      { nameKey: "Gold", properName: true, range: "60–79 pt", adviceKey: "xp.leed_l3", color: C.mod },
      { nameKey: "Platinum", properName: true, range: "80+ pt", adviceKey: "xp.leed_l4", color: C.exc },
    ],
  },
  {
    id: "well", group: "cert", label: "WELL", icon: Award, defKey: "xp.def_well", unit: "pt",
    levels: [
      { nameKey: "Bronze", properName: true, range: "40 pt", color: C.good },
      { nameKey: "Silver", properName: true, range: "50 pt", color: C.good },
      { nameKey: "Gold", properName: true, range: "60 pt", color: C.mod },
      { nameKey: "Platinum", properName: true, range: "80 pt", color: C.exc },
    ],
  },
  {
    id: "breeam", group: "cert", label: "BREEAM", icon: Award, defKey: "xp.def_breeam", unit: "%",
    levels: [
      { nameKey: "Pass", properName: true, range: "≥ 30%", color: C.good },
      { nameKey: "Good", properName: true, range: "≥ 45%", color: C.good },
      { nameKey: "Very Good", properName: true, range: "≥ 55%", color: C.good },
      { nameKey: "Excellent", properName: true, range: "≥ 70%", color: C.mod },
      { nameKey: "Outstanding", properName: true, range: "≥ 85%", color: C.exc },
    ],
  },
];

interface Props {
  /** scheda aperta (id) o null = chiuso */
  tab: string | null;
  onClose: () => void;
  onTab: (id: string) => void;
  /** valori correnti per l'etichetta «ADESSO»: id scheda → valore */
  current?: Record<string, number | undefined>;
  /** livello certificazione corrente per scheda (es. leed → "Gold") */
  currentCertLevel?: Record<string, string | undefined>;
}

const ExplainSheet = ({ tab, onClose, onTab, current, currentCertLevel }: Props) => {
  const { t, language } = useLanguage();
  const open = tab != null;
  useBackDismiss(open, onClose);

  const dragStart = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => TABS.find(x => x.id === tab) ?? TABS[0], [tab]);
  const group = active.group;
  const groupTabs = TABS.filter(x => x.group === group);
  const nf = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 1 }), [language]);

  const curValue = current?.[active.id];
  const curCert = currentCertLevel?.[active.id];

  const levelName = (l: LevelRow) => (l.properName ? l.nameKey : t(l.nameKey));
  const isNow = (l: LevelRow) =>
    curCert != null
      ? levelName(l).toLowerCase() === curCert.toLowerCase()
      : curValue != null && l.match?.(curValue) === true;

  return (
    <>
      {/* velo sopra la facciata */}
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-[88] transition-opacity duration-300"
        style={{ background: "rgba(5,20,22,.42)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
      />
      {/* foglio chiaro dal ~17% dall'alto (§5.5) */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("xp.title")}
        aria-hidden={!open}
        className="fixed left-0 right-0 bottom-0 z-[89] flex flex-col"
        style={{
          top: "17%",
          background: "#fbfdfd",
          color: "#163a3c",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -12px 40px rgba(5,20,22,.25)",
          transform: open ? "none" : "translateY(104%)",
          transition: "transform .4s cubic-bezier(.2,.8,.2,1)",
          visibility: open ? "visible" : "hidden",
          transitionProperty: "transform, visibility",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {/* maniglia: swipe giù chiude */}
        <div
          className="shrink-0"
          style={{ touchAction: "none", cursor: "grab", padding: "10px 0 4px" }}
          onPointerDown={e => { dragStart.current = e.clientY; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ } }}
          onPointerMove={e => {
            if (dragStart.current == null || !sheetRef.current) return;
            const dy = Math.max(0, e.clientY - dragStart.current);
            sheetRef.current.style.transform = `translateY(${dy}px)`;
          }}
          onPointerUp={e => {
            if (dragStart.current == null || !sheetRef.current) return;
            const dy = e.clientY - dragStart.current;
            dragStart.current = null;
            sheetRef.current.style.transform = "";
            if (dy > 80) onClose();
          }}
          onPointerCancel={() => { dragStart.current = null; if (sheetRef.current) sheetRef.current.style.transform = ""; }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 4, background: "rgba(22,58,60,.25)", margin: "0 auto" }} />
        </div>

        {/* titolo + × */}
        <div className="shrink-0 flex items-center justify-between pl-6 pr-3">
          <span className="text-[11px] font-bold tracking-[0.24em]" style={{ color: "#7f9597" }}>{t("xp.title")}</span>
          <button type="button" onClick={onClose} aria-label={t("xp.close")} className="grid place-items-center" style={{ width: 44, height: 44 }}>
            <X className="w-5 h-5" style={{ color: "#163a3c" }} />
          </button>
        </div>

        {/* schede del gruppo, scorribili */}
        <div className="shrink-0 flex gap-1 overflow-x-auto no-scrollbar px-4 mt-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {groupTabs.map(x => {
            const sel = x.id === active.id;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => onTab(x.id)}
                className="shrink-0 flex flex-col items-center gap-1 px-3"
                style={{ minHeight: 48, borderBottom: sel ? "2px solid #0a8f91" : "2px solid transparent", opacity: sel ? 1 : 0.55 }}
              >
                <x.icon className="w-4 h-4" aria-hidden="true" />
                <span className="text-[11px] font-semibold tracking-wide">{x.label}</span>
              </button>
            );
          })}
        </div>

        {/* contenuto */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 pt-4" style={{ WebkitOverflowScrolling: "touch", paddingBottom: "calc(var(--sab, 0px) + 24px)" }}>
          <h3 className="text-[24px] font-semibold m-0">{active.label}</h3>
          <p className="text-[13.5px] leading-relaxed mt-1.5 mb-4" style={{ color: "#5c7375" }}>{t(active.defKey)}</p>

          {active.levels?.map(l => {
            const now = isNow(l);
            return (
              <div
                key={l.nameKey + l.range}
                className="flex gap-3 items-start rounded-xl px-3 py-2.5 mb-1"
                style={{ background: now ? "rgba(10,143,145,.08)" : undefined }}
              >
                <span className="shrink-0 rounded-full" style={{ width: 3, alignSelf: "stretch", background: l.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px] font-semibold">{levelName(l)}</span>
                    <span className="text-[12px] tabular-nums shrink-0" style={{ color: "#7f9597" }}>{l.range}</span>
                  </div>
                  {l.adviceKey && <p className="text-[12px] m-0 mt-0.5" style={{ color: "#5c7375" }}>{t(l.adviceKey)}</p>}
                  {now && (
                    <span className="inline-block mt-1.5 text-[10px] font-bold tracking-[0.12em] px-2 py-0.5 rounded-full" style={{ background: "#0a8f91", color: "#fff" }}>
                      {t("xp.now")}{curValue != null ? ` · ${nf.format(curValue)}${active.unit ? ` ${active.unit}` : ""}` : curCert ? ` · ${curCert}` : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default ExplainSheet;
export { TABS as EXPLAIN_TABS };
