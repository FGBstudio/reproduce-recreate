/**
 * Dashboard modulo MOBILE (brief §6, mockup v2 approvato 12/10).
 * Sostituisce su mobile il carosello di card del ProjectDetail per Energy e
 * Air: fondo chiaro, verdetto prima del grafico, una metrica alla volta,
 * grafico a tutta larghezza senza cornice, causa sullo stesso asse, riepilogo
 * del mese come pagina. Desktop intatto.
 *
 * La vista Anno non è stata mockuppata (§6.4): il segmented la omette finché
 * il proprietario non approva una proposta. Le schede HVAC/Luci/Prese/Base
 * dell'energia arrivano con il loader per categoria (v2).
 */
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticLight } from "@/lib/native";
import { useBackDismiss } from "@/hooks/useBackDismiss";
import ExplainSheet from "@/components/dashboard/ExplainSheet";
import { AMBER, INK, RED, SUB, TEAL, MetricTabs, PeriodPager, PeriodSegment, SummaryRow, TimeAxisBand, VerdictLine, CauseTrack, ExportMenu, type Period } from "./bits";
import TimeSeriesChart from "./TimeSeriesChart";
import { HourHeatmap, LabelValueGrid, MonthCalendar, WeekBars, YearBars } from "./views";
import {
  CO2_EMISSION_FACTOR, useAirMetricsAvailable, useDaySeries, useEnergyCats, useMonthSeries, useWeekSeries, useYearSeries,
  type DashModule, type DaySeries, type EnergyCat, type MonthSeries, type WeekSeries, type YearSeries,
} from "./useModuleSeries";
import { co2Level, scoreToLevel } from "@/lib/airQuality";
import { isValidUUID } from "@/lib/utils";
import { useSiteThresholds } from "@/hooks/useSiteThresholds";
import { isSupabaseConfigured } from "@/lib/supabase";

interface Props {
  module: DashModule;
  siteId?: string;
  siteName: string;
  timezone: string;
  isDemoSite: boolean;
  energyLimitKw?: number;
  co2LimitPpm?: number;
  priceKwh?: number;
  onBack: () => void;
  onExportPdf?: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mondayOf = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const isoWeek = (d: Date) => {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - dayNum);
  const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x.getTime() - y0.getTime()) / 86400e3 + 1) / 7);
};

const MobileModuleDashboard = ({ module, siteId, siteName, timezone, isDemoSite, energyLimitKw, co2LimitPpm, priceKwh, onBack, onExportPdf }: Props) => {
  const { t, language } = useLanguage();
  const [period, setPeriod] = useState<Period>("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const [airMetric, setAirMetric] = useState("co2");
  // Schede energia: le categorie reali più le serie DERIVATE che allineano i
  // grafici desktop — CO₂ emessa (Carbon Footprint) e costo (× tariffa).
  const [energyTab, setEnergyTab] = useState<EnergyCat | "co2e" | "cost">("power");
  const energyCat: EnergyCat = energyTab === "co2e" || energyTab === "cost" ? "power" : energyTab;
  const [explainTab, setExplainTab] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // back Android/gesto: chiude la dashboard e torna alla overview (§2.2)
  useBackDismiss(true, onBack);

  const todayKey = keyOf(new Date());
  const dateKey = keyOf(anchor);
  const mondayKey = keyOf(mondayOf(anchor));
  const monthKey = dateKey.slice(0, 7);
  // soglie del sito — solo con un UUID vero. Ogni metrica aria ha la SUA
  // soglia warning in site_thresholds (come i grafici desktop); la CO₂ ha
  // anche la critical, che diventa la seconda soglia (rossa) del grafico.
  const safeSiteId = siteId && isValidUUID(siteId) && !isDemoSite && isSupabaseConfigured ? siteId : undefined;
  const { thresholds } = useSiteThresholds(safeSiteId);
  const AIR_LIMIT: Record<string, { l?: number | null; l2?: number | null }> = {
    co2: { l: co2LimitPpm ?? thresholds?.air_co2_warning_ppm, l2: thresholds?.air_co2_critical_ppm },
    pm25: { l: thresholds?.air_pm25_warning_ugm3 },
    pm10: { l: thresholds?.air_pm10_warning_ugm3 },
    // TVOC: il desktop mostra ppb con limite FISSO a 500 (il grafico PC non
    // legge air_voc_warning_ppb) — decisione owner 13/10: identico al PC
    tvoc: { l: 500 },
    co: { l: thresholds?.air_co_warning_ppm },
    o3: { l: thresholds?.air_o3_warning_ppb },
    // per temperatura e umidità si rappresenta solo l'ECCESSO (max):
    // il sotto-soglia richiederebbe una banda min-max, non prevista dal grafico
    temp: { l: thresholds?.air_temp_max_c },
    humidity: { l: thresholds?.air_humidity_max_pct },
  };
  const limit = module === "energy"
    ? (energyLimitKw ?? thresholds?.energy_power_limit_kw ?? undefined)
    : (AIR_LIMIT[airMetric]?.l ?? undefined);
  const limit2 = module === "air" ? (AIR_LIMIT[airMetric]?.l2 ?? undefined) : undefined;

  const dayRaw = useDaySeries(module, safeSiteId, dateKey, timezone, isDemoSite, limit, priceKwh, airMetric, energyCat, limit2);
  const weekRaw = useWeekSeries(module, safeSiteId, mondayKey, timezone, isDemoSite, priceKwh, airMetric, energyCat);
  const monthRaw = useMonthSeries(module, safeSiteId, monthKey, timezone, isDemoSite, priceKwh, airMetric, energyCat);
  const yearRaw = useYearSeries(module, safeSiteId, anchor.getFullYear(), timezone, isDemoSite, priceKwh, airMetric, energyCat);
  const cats = useEnergyCats(module === "energy" ? (isDemoSite ? siteId : safeSiteId) : undefined, isDemoSite);
  const airAvail = useAirMetricsAvailable(module === "air" ? (isDemoSite ? siteId : safeSiteId) : undefined, isDemoSite);

  // ── Serie derivate (CO₂ emessa / costo): la stessa serie kWh del sito,
  // riscalata. Nessuna query in più; gli stessi numeri del Carbon Footprint
  // e del costo stimato desktop (EF 0.233 kg/kWh, tariffa del sito). ──
  // in demo la tariffa non c'è: si usa quella delle serie demo (0,19 €/kWh)
  const effPrice = priceKwh ?? (isDemoSite ? 0.19 : undefined);
  const DERIVED = energyTab === "co2e"
    ? { f: CO2_EMISSION_FACTOR, unit: "kg" }
    : energyTab === "cost" && effPrice
      ? { f: effPrice, unit: "€" }
      : null;
  const scaleDay = (s: DaySeries | null | undefined): DaySeries | null | undefined => {
    if (!s || !DERIVED) return s;
    const r1 = (v: number) => Math.round(v * DERIVED.f * 10) / 10;
    return {
      ...s,
      points: s.points.map(p => ({ h: p.h, v: p.v == null ? null : r1(p.v) })),
      peak: s.peak ? { h: s.peak.h, v: r1(s.peak.v) } : undefined,
      avg: s.avg != null ? r1(s.avg) : undefined,
      limit: undefined, limit2: undefined, overLimitMinutes: undefined,
      unit: DERIVED.unit,
    };
  };
  const scaleDays = <T extends WeekSeries | MonthSeries | YearSeries>(s: T | null | undefined): T | null | undefined => {
    if (!s || !DERIVED) return s;
    const r0 = (v: number) => Math.round(v * DERIVED.f);
    const out = { ...s, unit: DERIVED.unit } as T;
    if ("days" in out) {
      (out as WeekSeries).days = (s as WeekSeries).days.map(x => ({ ...x, v: x.v == null ? null : r0(x.v) }));
      (out as WeekSeries).weekdayAvg = (s as WeekSeries).weekdayAvg != null ? r0((s as WeekSeries).weekdayAvg!) : undefined;
      (out as WeekSeries).heat = (s as WeekSeries).heat.map(row => row.map(v => (v == null ? null : v * DERIVED.f)));
      (out as WeekSeries).heatMax = (s as WeekSeries).heatMax * DERIVED.f;
    }
    if ("cells" in out) {
      (out as MonthSeries).cells = (s as MonthSeries).cells.map(c => ({ ...c, v: c.v == null ? null : r0(c.v) }));
      (out as MonthSeries).maxV = (s as MonthSeries).maxV * DERIVED.f;
      (out as MonthSeries).peak = (s as MonthSeries).peak ? { date: (s as MonthSeries).peak!.date, v: r0((s as MonthSeries).peak!.v) } : undefined;
      (out as MonthSeries).baseloadKw = undefined;
    }
    if ("months" in out) {
      (out as YearSeries).months = (s as YearSeries).months.map(x => ({ ...x, v: x.v == null ? null : r0(x.v) }));
      (out as YearSeries).avg = (s as YearSeries).avg != null ? r0((s as YearSeries).avg!) : undefined;
    }
    return out;
  };
  const day = { ...dayRaw, data: scaleDay(dayRaw.data) };
  const week = { ...weekRaw, data: scaleDays(weekRaw.data) };
  const month = { ...monthRaw, data: scaleDays(monthRaw.data) };
  const yearData = { ...yearRaw, data: scaleDays(yearRaw.data) };

  const nf = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 1 }), [language]);
  const nf0 = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 0 }), [language]);
  const dfWeekday = useMemo(() => new Intl.DateTimeFormat(language, { weekday: "long", day: "numeric", month: "long" }), [language]);
  const dfRange = useMemo(() => new Intl.DateTimeFormat(language, { day: "numeric", month: "long" }), [language]);
  const dfMonth = useMemo(() => new Intl.DateTimeFormat(language, { month: "long" }), [language]);
  const weekdayHeads = useMemo(() => {
    const base = new Date(2026, 5, 1); // un lunedì
    const f = new Intl.DateTimeFormat(language, { weekday: "narrow" });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(base.getTime() + i * 86400e3)));
  }, [language]);
  const monthHeads = useMemo(() => {
    const f = new Intl.DateTimeFormat(language, { month: "narrow" });
    return Array.from({ length: 12 }, (_, i) => f.format(new Date(2026, i, 1)));
  }, [language]);

  const shift = (dir: 1 | -1) => {
    hapticLight();
    const d = new Date(anchor);
    if (period === "day") d.setDate(d.getDate() + dir);
    else if (period === "week") d.setDate(d.getDate() + dir * 7);
    else if (period === "month") d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    if (keyOf(d) > todayKey && d > new Date()) return;
    setAnchor(d);
  };
  const nextDisabled = period === "day" ? dateKey >= todayKey
    : period === "week" ? keyOf(new Date(mondayOf(anchor).getTime() + 7 * 86400e3)) > todayKey
    : period === "month" ? monthKey >= todayKey.slice(0, 7)
    : anchor.getFullYear() >= new Date().getFullYear();

  // ── intestazioni del pager ──
  const pagerTitle = period === "day"
    ? (dateKey === todayKey ? t("md.today") : dfRange.format(anchor))
    : period === "week"
      ? (() => {
          const a = mondayOf(anchor), b = new Date(a.getTime() + 6 * 86400e3);
          try { return (dfRange as unknown as { formatRange: (x: Date, y: Date) => string }).formatRange(a, b); }
          catch { return `${dfRange.format(a)} – ${dfRange.format(b)}`; }
        })()
      : period === "month"
        ? dfMonth.format(anchor).replace(/^./, c => c.toUpperCase())
        : String(anchor.getFullYear());
  const pagerSub = period === "day" ? dfWeekday.format(anchor)
    : period === "week" ? t("md.week_n").replace("{n}", String(isoWeek(anchor)))
    : period === "month"
      ? `${dfRange.format(new Date(anchor.getFullYear(), anchor.getMonth(), 1))} – ${dfRange.format(anchor)} ${anchor.getFullYear()}`
      // Anno = proposta §6.4: etichettata finché il proprietario non conferma
      : t("md.proposal");

  // ── verdetto del giorno ──
  const d = day.data;
  // giudizi dell'aria al FEMMINILE («Buona», non «Buono»: nel mockup è così)
  const AIR_V: Record<string, string> = {
    EXCELLENT: "md.v_air_excellent", GOOD: "md.v_air_good", MODERATE: "md.v_air_moderate", POOR: "md.v_air_poor",
  };
  const verdict = useMemo(() => {
    if (!d) return null;
    if (module === "energy") {
      if (d.limit != null) {
        const over = d.peak != null && d.peak.v > d.limit;
        return {
          color: over ? AMBER : TEAL,
          word: over ? t("ovm.v_attention") : t("md.v_efficient"),
          summary: d.avg != null ? t("md.avg_load").replace("{v}", `${nf.format(d.avg)} ${d.unit}`) : undefined,
        };
      }
      // categorie/derivate senza limite di contratto: niente giudizio
      // inventato, si legge il valore medio e il totale del giorno
      return d.avg != null ? {
        color: TEAL,
        word: `${nf.format(d.avg)} ${d.unit}`,
        summary: d.totalKwh != null
          ? (DERIVED ? `${nf0.format(Math.round(d.totalKwh * DERIVED.f))} ${DERIVED.unit}` : `${nf0.format(d.totalKwh)} kWh`)
          : undefined,
      } : null;
    }
    if (airMetric === "co2" && d.avg != null) {
      const lvl = co2Level(d.avg);
      const color = lvl === "POOR" ? RED : lvl === "MODERATE" ? AMBER : TEAL;
      const overruns = d.limit != null && d.points.filter(p => (p.v ?? 0) > d.limit!).length;
      return {
        color,
        word: t(AIR_V[lvl]),
        summary: overruns ? t("md.overruns").replace("{n}", String(overruns)) : `${nf0.format(d.avg)} ${d.unit}`,
      };
    }
    if (airMetric === "iaq" && d.avg != null) {
      const lvl = scoreToLevel(d.avg);
      return {
        color: lvl === "POOR" ? RED : lvl === "MODERATE" ? AMBER : TEAL,
        word: t(AIR_V[lvl]),
        summary: `${nf0.format(d.avg)} / 100`,
      };
    }
    if (d.avg == null) return null;
    // altre metriche aria: se il sito ha la soglia, il giudizio viene da lì
    // (superamenti = Attenzione); senza soglia si legge solo il valore medio
    if (d.limit != null) {
      const overruns = d.points.filter(p => (p.v ?? 0) > d.limit!).length;
      return overruns > 0
        ? { color: AMBER, word: t("ovm.v_attention"), summary: t("md.overruns").replace("{n}", String(overruns)) }
        : { color: TEAL, word: t(AIR_V.GOOD), summary: `${nf.format(d.avg)} ${d.unit}` };
    }
    return { color: TEAL, word: `${nf.format(d.avg)} ${d.unit}`, summary: undefined };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, module, airMetric, t, nf, nf0]);

  // Schede metrica (§6.1.5). Energy: le categorie con dispositivi reali
  // (regola d'oro §8.3) più le derivate CO₂/costo dei grafici desktop;
  // «Base» non è una serie esistente e resta fuori. Aria: solo le metriche
  // che il sito misura davvero (telemetry degli ultimi 45 giorni).
  const CAT_LABEL: Record<EnergyCat, string> = {
    power: t("md.metric_power"), hvac: "HVAC", lighting: t("md.metric_lights"), plugs: t("md.metric_plugs"),
  };
  const AIR_LABEL: Record<string, string> = {
    iaq: "IAQ", co2: "CO₂", pm25: "PM2.5", pm10: "PM10", tvoc: "TVOC",
    co: "CO", o3: "O₃", temp: t("ovm.row_temp"), humidity: t("ovm.row_humidity"),
  };
  const AIR_ORDER = ["iaq", "co2", "pm25", "pm10", "tvoc", "co", "o3", "temp", "humidity"];
  const metricTabs = module === "energy"
    ? [
        ...(cats.data ?? ["power"] as EnergyCat[]).map(c => ({ id: c as string, label: CAT_LABEL[c] })),
        { id: "co2e", label: "CO₂" },
        ...(effPrice ? [{ id: "cost", label: t("md.metric_cost") }] : []),
      ]
    : AIR_ORDER
        .filter(k => k === "iaq" ? (airAvail.data ?? []).includes("co2") : (airAvail.data ?? []).includes(k))
        .map(k => ({ id: k, label: AIR_LABEL[k] }));

  // ── esportazioni (menu «⋯», §6.1.1) ──
  const exportData = () => {
    if (period === "day") return d?.points.map(p => ({ hour: p.h, value: p.v }));
    if (period === "week") return week.data?.days.map(x => ({ date: x.date, value: x.v }));
    if (period === "month") return month.data?.cells.map(c => ({ date: c.date, value: c.v }));
    return yearData.data?.months.map(x => ({ month: x.m, value: x.v }));
  };
  // PNG del grafico Giorno (§6.1.1): l'SVG serializzato su canvas 2×
  const exportPng = () => {
    const svg = rootRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 780; c.height = 460;
      const ctx = c.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => {
        if (!b) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `${module}-${dateKey}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    };
    img.src = url;
  };
  const download = (name: string, content: string, mime: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportItems = [
    ...(period === "day" ? [{ label: "PNG", onClick: exportPng }] : []),
    { label: "CSV", onClick: () => { const rows = exportData() || []; download(`${module}-${dateKey}.csv`, Object.keys(rows[0] || { x: 1 }).join(",") + "\n" + rows.map(r => Object.values(r).join(",")).join("\n"), "text/csv"); } },
    { label: "JSON", onClick: () => download(`${module}-${dateKey}.json`, JSON.stringify(exportData() || [], null, 1), "application/json") },
    ...(onExportPdf ? [{ label: "PDF", onClick: onExportPdf }] : []),
  ];

  const summaryLabel = module === "energy" ? t("md.summary_energy") : t("md.summary_air");

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-30 flex flex-col overflow-y-auto no-scrollbar"
      style={{
        background: "linear-gradient(180deg, #f6fafa 0%, #ffffff 30%)",
        color: INK,
        paddingTop: "var(--sat, 0px)",
        paddingBottom: "calc(var(--sab, 0px) + 20px)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {/* barra superiore: ← · modulo + sito · ⋯ */}
      <div className="relative shrink-0 flex items-center justify-between px-2 pt-1">
        <button type="button" onClick={onBack} aria-label="←" className="grid place-items-center" style={{ width: 44, height: 44, color: INK }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0 flex-1">
          <span className="inline-block whitespace-nowrap" style={{ fontSize: 15, fontWeight: 600 }}>{period === "month" ? summaryLabel : module === "energy" ? t("ovm.energy") : t("ovm.air")}</span>
          <span className="truncate" style={{ fontSize: 13, color: SUB, marginLeft: 6 }}>{siteName}</span>
          {(d?.isDemo || week.data?.isDemo || month.data?.isDemo || yearData.data?.isDemo) && (
            <span className="align-middle" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#b45309", background: "rgba(217,154,43,.15)", borderRadius: 999, padding: "2px 7px", marginLeft: 6 }}>DEMO</span>
          )}
        </div>
        <ExportMenu items={exportItems} />
      </div>

      <div className="shrink-0 mt-2">
        <PeriodSegment
          value={period}
          onChange={setPeriod}
          labels={{ day: t("md.day"), week: t("md.week"), month: t("md.month"), year: t("md.year") }}
        />
      </div>

      {/* Il mese ha l'intestazione del mockup §6.3 («attività del robot»):
          titolo grande a sinistra con l'orologio, frecce a destra. */}
      {period === "month" ? (
        <div className="px-6 mt-3 flex items-start justify-between">
          <div className="min-w-0">
            <div style={{ fontSize: 32, fontWeight: 600, color: INK, lineHeight: 1.1 }}>{pagerTitle}</div>
            <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />
              {pagerSub}
            </div>
          </div>
          <div className="flex shrink-0 -mr-2">
            <button type="button" onClick={() => shift(-1)} aria-label="‹" className="grid place-items-center" style={{ width: 44, height: 44, color: SUB }}>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => shift(1)} aria-label="›" disabled={nextDisabled} className="grid place-items-center" style={{ width: 44, height: 44, color: nextDisabled ? "#eaf0f0" : SUB }}>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <PeriodPager title={pagerTitle} subtitle={pagerSub} onPrev={() => shift(-1)} onNext={() => shift(1)} nextDisabled={nextDisabled} titleSize={period === "week" ? 23 : 30} />
      )}

      {/* ── GIORNO ── */}
      {period === "day" && (
        <>
          {verdict && <VerdictLine color={verdict.color} verdict={verdict.word} summary={verdict.summary} onExplain={() => setExplainTab(module === "energy" ? "power" : airMetric)} />}
          <MetricTabs
            tabs={metricTabs}
            value={module === "energy" ? energyTab : airMetric}
            onChange={id => { if (module === "energy") setEnergyTab(id as EnergyCat | "co2e" | "cost"); else setAirMetric(id); }}
          />
          {day.isLoading ? (
            <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
          ) : d ? (
            <>
              <TimeSeriesChart
                points={d.points}
                unit={d.unit}
                limit={d.limit}
                limit2={d.limit2}
                limitLabel={d.limit != null ? (module === "energy" ? t("md.limit_contract") : t("md.limit")).replace("{v}", `${nf0.format(d.limit)} ${d.unit}`) : undefined}
                nowHour={dateKey === todayKey ? new Date().getHours() : undefined}
                nowLabel={t("md.now")}
                peak={d.peak}
                peakLabel={d.peak ? t("md.peak").replace("{v}", `${nf.format(d.peak.v)} ${d.unit}`).replace("{h}", `${pad(d.peak.h)}:00`) : undefined}
                onSwipe={dir => (dir === 1 && nextDisabled ? undefined : shift(dir))}
                fmt={v => nf0.format(v)}
                yMax={module === "air" && (airMetric === "iaq" || airMetric === "humidity") ? 100 : undefined}
              />
              <TimeAxisBand />
              {/* la causa (§6.1.8): temperatura esterna per l'energia,
                  HVAC acceso/spento per la CO₂ — stesso asse X */}
              {module === "energy" && d.outdoorTemp && (() => {
                const vals = d.outdoorTemp.filter((v): v is number => v != null);
                const range = vals.length ? `${nf0.format(Math.min(...vals))}° → ${nf0.format(Math.max(...vals))}°` : undefined;
                return <CauseTrack variant="line" series={d.outdoorTemp} label={t("md.outdoor_temp")} note={range} />;
              })()}
              {d.hvacStrip && <CauseTrack variant="onOff" strip={d.hvacStrip} label={t("md.hvac")} note={t("md.hvac_note")} />}
              <SummaryRow items={[
                ...(module === "energy" && d.totalKwh != null ? [{
                  value: DERIVED ? `${nf0.format(Math.round(d.totalKwh * DERIVED.f))} ${DERIVED.unit}` : `${nf0.format(d.totalKwh)} kWh`,
                  label: t("md.today_lbl"),
                }] : []),
                ...(module === "energy" && d.vsTypicalPct != null ? [{ value: `${d.vsTypicalPct > 0 ? "+" : ""}${d.vsTypicalPct}%`, label: t("md.vs_typical").replace("{d}", new Intl.DateTimeFormat(language, { weekday: "long" }).format(anchor)) }] : []),
                ...(module === "energy" && d.costEur != null && energyTab !== "cost" ? [{ value: `€ ${nf0.format(d.costEur)}`, label: t("md.cost_est") }] : []),
                ...(module === "air" && d.avg != null ? [{ value: d.unit ? `${nf0.format(d.avg)} ${d.unit}` : `${nf0.format(d.avg)}/100`, label: t("md.avg") }] : []),
                ...(module === "air" && d.overLimitMinutes ? [{ value: `${Math.floor(d.overLimitMinutes / 60)}h ${pad(d.overLimitMinutes % 60)}m`, label: t("md.over_time") }] : []),
                ...(module === "air" && d.hvacStrip ? [{ value: String(d.hvacStrip.reduce((a, on, i) => a + (i > 0 && !on && d.hvacStrip![i - 1] ? 1 : 0), 0)), label: t("md.hvac_pauses") }] : []),
              ].slice(0, 3)} />
            </>
          ) : (
            <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>{t("md.no_data")}</p>
          )}
        </>
      )}

      {/* ── SETTIMANA ── */}
      {period === "week" && (
        week.isLoading ? <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
        : week.data ? (
          <>
            {(() => {
              const w = week.data!;
              const openExplain = () => setExplainTab(module === "energy" ? "power" : airMetric);
              if (module === "energy" && w.totalKwh != null) {
                const total = DERIVED ? `${nf0.format(Math.round(w.totalKwh * DERIVED.f))} ${DERIVED.unit}` : `${nf.format(w.totalKwh / 1000)} MWh`;
                return <VerdictLine color={TEAL} verdict={t("md.v_average")} summary={total} onExplain={openExplain} />;
              }
              // aria: giudizio dalla media settimanale della metrica (§6.2)
              const vals = w.days.map(x => x.v).filter((v): v is number => v != null);
              if (module !== "air" || vals.length === 0) return null;
              const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
              if (airMetric === "co2" || airMetric === "iaq") {
                const lvl = airMetric === "co2" ? co2Level(mean) : scoreToLevel(mean);
                const color = lvl === "POOR" ? RED : lvl === "MODERATE" ? AMBER : TEAL;
                const summary = airMetric === "co2" ? `${nf0.format(mean)} ${w.unit}` : `${nf0.format(mean)} / 100`;
                return <VerdictLine color={color} verdict={t(AIR_V[lvl])} summary={summary} onExplain={openExplain} />;
              }
              return <VerdictLine color={TEAL} verdict={`${nf0.format(mean)} ${w.unit}`} onExplain={openExplain} />;
            })()}
            <WeekBars
              s={week.data}
              onOpenDay={date => { if (!date.startsWith("demo")) { setAnchor(new Date(`${date}T12:00:00`)); } setPeriod("day"); }}
              avgLabel={week.data.weekdayAvg != null ? t("md.weekday_avg").replace("{v}", `${nf0.format(week.data.weekdayAvg)} ${week.data.unit}`) : undefined}
              fmt={v => nf0.format(v)}
              weekdays={weekdayHeads}
            />
            <HourHeatmap
              s={week.data}
              onOpenDay={date => { if (!date.startsWith("demo")) { setAnchor(new Date(`${date}T12:00:00`)); } setPeriod("day"); }}
              title={module === "energy" ? t("md.hour_load") : t("md.hour_pattern")}
              hint={t("md.tap_day")}
              weekdays={weekdayHeads}
              fmtCell={(v, di, hi) => `${weekdayHeads[di]} ${pad(hi)}:00 · ${nf0.format(v)}${week.data!.unit ? ` ${week.data!.unit}` : ""}`}
            />
            <SummaryRow items={[
              ...(week.data.totalKwh != null ? [{
                value: DERIVED ? `${nf0.format(Math.round(week.data.totalKwh * DERIVED.f))} ${DERIVED.unit}` : `${nf.format(week.data.totalKwh / 1000)} MWh`,
                label: t("md.week_lbl"),
              }] : []),
              ...(module === "air" ? (() => {
                const vals = week.data!.days.map(x => x.v).filter((v): v is number => v != null);
                if (!vals.length) return [];
                const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                return [{ value: week.data!.unit ? `${nf0.format(mean)} ${week.data!.unit}` : `${nf0.format(mean)}/100`, label: t("md.avg") }];
              })() : []),
              ...(week.data.topDay ? [{
                value: new Intl.DateTimeFormat(language, { weekday: "long" }).format(
                  week.data.topDay.startsWith("demo")
                    ? new Date(mondayOf(anchor).getTime() + (Number(week.data.topDay.slice(5)) || 0) * 86400e3)
                    : new Date(`${week.data.topDay}T12:00:00`)
                ),
                label: t("md.top_day"),
              }] : []),
              ...(week.data.costEur != null ? [{ value: `€ ${nf0.format(week.data.costEur)}`, label: t("md.cost_est") }] : []),
            ].slice(0, 3)} />
          </>
        ) : <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>{t("md.no_data")}</p>
      )}

      {/* ── MESE (riepilogo, §6.3) ── */}
      {period === "month" && (
        month.isLoading ? <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
        : month.data ? (
          <>
            <MonthCalendar s={month.data} weekdays={weekdayHeads} onOpenDay={date => { setAnchor(new Date(`${date}T12:00:00`)); setPeriod("day"); }} />
            {month.data.totalKwh != null && (
              /* mockup §6.3: etichetta in evidenza, VALORE in grigio */
              <p className="text-center mt-4" style={{ fontSize: 14, color: INK, fontWeight: 600 }}>
                {energyTab === "co2e" ? t("md.co2_emitted") : energyTab === "cost" ? t("md.cost_est_cap") : t("md.month_total")}{" "}
                <span className="tabular-nums" style={{ color: SUB, fontWeight: 400 }}>
                  {DERIVED ? `${nf0.format(Math.round(month.data.totalKwh * DERIVED.f))} ${DERIVED.unit}` : `${nf.format(month.data.totalKwh / 1000)} MWh`}
                </span>
              </p>
            )}
            <LabelValueGrid items={[
              ...(month.data.costEur != null && energyTab !== "cost" ? [{ label: t("md.cost_est"), value: `€ ${nf0.format(month.data.costEur)}` }] : []),
              ...(month.data.vsPrevPct != null ? [{ label: t("md.vs_prev_month"), value: `${month.data.vsPrevPct > 0 ? "+" : ""}${month.data.vsPrevPct}%` }] : []),
              /* mockup: «Picco · 12 ott» sopra, «23,2 kW» sotto */
              ...(month.data.peak ? [{
                label: `${t("md.peak_lbl")} · ${dfRange.format(new Date(`${month.data.peak.date}T12:00:00`))}`,
                value: `${nf0.format(month.data.peak.v)}${month.data.unit ? ` ${month.data.unit}` : ""}`,
              }] : []),
              ...(month.data.baseloadKw != null ? [{ label: t("md.baseload"), value: `${nf.format(month.data.baseloadKw)} kW` }] : []),
            ]} />
            {onExportPdf && (
              <button type="button" onClick={onExportPdf} className="mx-auto mt-5 font-bold uppercase"
                style={{ fontSize: 12, letterSpacing: "0.14em", color: TEAL, minHeight: 44 }}>
                {t("md.export_pdf")}
              </button>
            )}
          </>
        ) : <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>{t("md.no_data")}</p>
      )}

      {/* ── ANNO (§6.4 — PROPOSTA da confermare col proprietario) ── */}
      {period === "year" && (
        yearData.isLoading ? <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
        : yearData.data ? (
          <>
            <YearBars
              s={yearData.data}
              monthLabels={monthHeads}
              onOpenMonth={m => { const dd = new Date(anchor.getFullYear(), m - 1, 1); setAnchor(dd); setPeriod("month"); }}
              avgLabel={yearData.data.avg != null ? t("md.monthly_avg").replace("{v}", `${nf0.format(yearData.data.avg)}${yearData.data.unit ? ` ${yearData.data.unit}` : ""}`) : undefined}
              fmt={v => nf0.format(v)}
            />
            <SummaryRow items={[
              ...(yearData.data.totalKwh != null ? [{
                value: DERIVED ? `${nf0.format(Math.round(yearData.data.totalKwh * DERIVED.f))} ${DERIVED.unit}` : `${nf.format(yearData.data.totalKwh / 1000)} MWh`,
                label: t("md.year_lbl"),
              }] : []),
              ...(module === "air" && yearData.data.avg != null ? [{ value: yearData.data.unit ? `${nf0.format(yearData.data.avg)} ${yearData.data.unit}` : `${nf0.format(yearData.data.avg)}/100`, label: t("md.avg") }] : []),
              ...(yearData.data.costEur != null && energyTab !== "cost" ? [{ value: `€ ${nf0.format(yearData.data.costEur)}`, label: t("md.cost_est") }] : []),
            ].slice(0, 3)} />
          </>
        ) : <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>{t("md.no_data")}</p>
      )}

      {/* «Dati spiegati» sulla metrica corrente (§6.7) */}
      <ExplainSheet
        tab={explainTab}
        onClose={() => setExplainTab(null)}
        onTab={setExplainTab}
        current={{
          power: module === "energy" ? d?.avg : undefined,
          iaq: module === "air" && airMetric === "iaq" ? d?.avg : undefined,
          co2: module === "air" && airMetric === "co2" ? d?.avg : undefined,
          pm25: module === "air" && airMetric === "pm25" ? d?.avg : undefined,
          pm10: module === "air" && airMetric === "pm10" ? d?.avg : undefined,
          co: module === "air" && airMetric === "co" ? d?.avg : undefined,
          o3: module === "air" && airMetric === "o3" ? d?.avg : undefined,
          tvoc: module === "air" && airMetric === "tvoc" ? d?.avg : undefined,
          temp: module === "air" && airMetric === "temp" ? d?.avg : undefined,
          humidity: module === "air" && airMetric === "humidity" ? d?.avg : undefined,
        }}
      />
    </div>
  );
};

export default MobileModuleDashboard;
