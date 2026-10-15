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
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticLight } from "@/lib/native";
import { useBackDismiss } from "@/hooks/useBackDismiss";
import ExplainSheet from "@/components/dashboard/ExplainSheet";
import { AMBER, INK, RED, SUB, TEAL, MetricTabs, PeriodPager, PeriodSegment, ProbeSheet, SummaryRow, TimeAxisBand, VerdictLine, CauseTrack, ExportMenu, type Period } from "./bits";
import TimeSeriesChart from "./TimeSeriesChart";
import { HourHeatmap, LabelValueGrid, MonthCarpet, WeekBars, YearBars } from "./views";
import { CarbonBars, DayNightBars, EuiCompareChart, PeriodsList, WeatherScatter, WeatherTimeline } from "./insights";
import { useEuiCompare, usePeriodsYear, useWeatherCorr } from "./useEnergyInsights";
import {
  CO2_EMISSION_FACTOR, LEAK_LMIN, LEAK_NIGHTS, NIGHT_FROM, NIGHT_TO,
  useAirProbes, useSiteMetricsAvailable, useDaySeries, useEnergyCats, useMonthSeries, useWaterNight, useWeekSeries, useYearSeries,
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
  // metrica corrente del modulo (aria: co2…, acqua: flow…).
  // Per l'acqua «volume» e «notte» sono VISTE DERIVATE della portata
  // (§10.3): la query gira sempre su water.flow_rate.
  const [airMetric, setAirMetric] = useState(module === "water" ? "flow" : "co2");
  const waterDerived = module === "water" && (airMetric === "volume" || airMetric === "night");
  const queryMetric = waterDerived ? "flow" : airMetric;
  // Schede energia: categorie reali + derivate (CO₂/costo) + gli
  // APPROFONDIMENTI del PC (§10.1): Confronto · Meteo · Carbonio · Periodi.
  type EnergyTab = EnergyCat | "co2e" | "cost" | "compare" | "weather" | "carbon" | "periods";
  const [energyTab, setEnergyTab] = useState<EnergyTab>("power");
  const INSIGHT_TABS = ["compare", "weather", "carbon", "periods"] as const;
  const insightTab = module === "energy" && (INSIGHT_TABS as readonly string[]).includes(energyTab);
  const energyCat: EnergyCat = (["power", "hvac", "lighting", "plugs"] as const).includes(energyTab as EnergyCat) ? (energyTab as EnergyCat) : "power";
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
  // Qualità dell'acqua: site_thresholds non la copre — soglie FISSE dal
  // metrics_catalog (pH ≤8.5, torbidità 1 warning / 5 critical, cloro ≤1).
  // Come per temp/umidità si rappresenta solo l'eccesso del massimo.
  const WATER_LIMIT: Record<string, { l?: number; l2?: number }> = {
    ph: { l: 8.5 },
    turbidity: { l: 1, l2: 5 },
    chlorine: { l: 1 },
  };
  const LIMITS = module === "water" ? WATER_LIMIT : AIR_LIMIT;
  const limit = module === "energy"
    ? (energyLimitKw ?? thresholds?.energy_power_limit_kw ?? undefined)
    : (LIMITS[airMetric]?.l ?? undefined);
  const limit2 = module !== "energy" ? (LIMITS[airMetric]?.l2 ?? undefined) : undefined;

  // ── Selettore sonde (§10.2): la selezione filtra le query e decide quali
  // schede esistono. null = tutte le sonde del sito. Solo per l'aria. ──
  const probes = useAirProbes(module === "air" ? (isDemoSite ? siteId : safeSiteId) : undefined, isDemoSite);
  const [probeSel, setProbeSel] = useState<string[] | null>(null);
  const [probeSheetOpen, setProbeSheetOpen] = useState(false);
  const probeIds = module === "air" && probeSel && probeSel.length > 0 ? probeSel : undefined;
  const selProbes = useMemo(() => {
    const all = probes.data ?? [];
    return probeIds ? all.filter(p => probeIds.includes(p.id)) : all;
  }, [probes.data, probeIds]);
  // famiglia delle sonde selezionate: tutte LEED → solo le 4 metriche base
  const selAllLeed = module === "air" && selProbes.length > 0 && selProbes.every(p => p.family === "LEED");

  const dayRaw = useDaySeries(module, safeSiteId, dateKey, timezone, isDemoSite, limit, priceKwh, queryMetric, energyCat, limit2, probeIds);
  const weekRaw = useWeekSeries(module, safeSiteId, mondayKey, timezone, isDemoSite, priceKwh, queryMetric, energyCat, probeIds);
  const monthRaw = useMonthSeries(module, safeSiteId, monthKey, timezone, isDemoSite, priceKwh, queryMetric, energyCat, probeIds);
  const yearRaw = useYearSeries(module, safeSiteId, anchor.getFullYear(), timezone, isDemoSite, priceKwh, queryMetric, energyCat, probeIds);
  const cats = useEnergyCats(module === "energy" ? (isDemoSite ? siteId : safeSiteId) : undefined, isDemoSite);
  const avail = useSiteMetricsAvailable(module, module !== "energy" ? (isDemoSite ? siteId : safeSiteId) : undefined, isDemoSite);
  // §10.1 — approfondimenti: le schede esistono solo se hanno dati
  const eui = useEuiCompare(module === "energy" ? (isDemoSite ? siteId : safeSiteId) : undefined, anchor.getFullYear(), anchor.getMonth(), isDemoSite);
  const wcorr = useWeatherCorr(module === "energy" ? (isDemoSite ? siteId : safeSiteId) : undefined, monthKey, isDemoSite);
  const periodsY = usePeriodsYear(module === "energy" ? (isDemoSite ? siteId : safeSiteId) : undefined, anchor.getFullYear(), isDemoSite, priceKwh ?? (isDemoSite ? 0.19 : undefined));

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
      typical: s.typical?.map(v => (v == null ? null : r1(v))),
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
  // §10.3 — vista VOLUME: litri derivati dalla portata media (L/min × 60
  // per ogni ora; × 1440 sulle medie giornaliere). Derivazione dichiarata:
  // il contatore cumulativo non espone delta onesti nelle tabelle orarie.
  const scaleWaterDay = (s: DaySeries | null | undefined): DaySeries | null | undefined => {
    if (!s || !(module === "water" && airMetric === "volume")) return s;
    const r = (v: number) => Math.round(v * 60);
    const pts = s.points.map(p => ({ h: p.h, v: p.v == null ? null : r(p.v) }));
    const tot = pts.reduce((a, p) => a + (p.v ?? 0), 0);
    const peakPt = pts.reduce((a, b) => ((b.v ?? 0) > (a.v ?? 0) ? b : a), pts[0]);
    return {
      ...s,
      points: pts,
      typical: s.typical?.map(v => (v == null ? null : r(v))),
      peak: peakPt?.v ? { h: peakPt.h, v: peakPt.v } : undefined,
      avg: tot > 0 ? tot : undefined, // il «valore del giorno» è il totale litri
      limit: undefined, limit2: undefined, overLimitMinutes: undefined,
      unit: "L/h",
    };
  };
  const scaleWaterDays = <T extends WeekSeries | MonthSeries | YearSeries>(s: T | null | undefined): T | null | undefined => {
    if (!s || !(module === "water" && airMetric === "volume")) return s;
    const r = (v: number) => Math.round(v * 1440);
    const out = { ...s, unit: "L" } as T;
    if ("days" in out) {
      (out as WeekSeries).days = (s as WeekSeries).days.map(x => ({ ...x, v: x.v == null ? null : r(x.v) }));
      (out as WeekSeries).weekdayAvg = (s as WeekSeries).weekdayAvg != null ? r((s as WeekSeries).weekdayAvg!) : undefined;
      (out as WeekSeries).heat = (s as WeekSeries).heat.map(row => row.map(v => (v == null ? null : v * 60)));
      (out as WeekSeries).heatMax = (s as WeekSeries).heatMax * 60;
    }
    if ("cells" in out) {
      (out as MonthSeries).cells = (s as MonthSeries).cells.map(c => ({ ...c, v: c.v == null ? null : r(c.v) }));
      (out as MonthSeries).maxV = (s as MonthSeries).maxV * 1440;
      (out as MonthSeries).hours = (s as MonthSeries).hours.map(row => row.map(v => (v == null ? null : v * 60)));
      (out as MonthSeries).hoursMax = (s as MonthSeries).hoursMax * 60;
      (out as MonthSeries).peak = (s as MonthSeries).peak ? { date: (s as MonthSeries).peak!.date, v: r((s as MonthSeries).peak!.v) } : undefined;
    }
    if ("months" in out) {
      (out as YearSeries).months = (s as YearSeries).months.map(x => ({ ...x, v: x.v == null ? null : r(x.v) }));
      (out as YearSeries).avg = (s as YearSeries).avg != null ? r((s as YearSeries).avg!) : undefined;
    }
    return out;
  };
  const day = { ...dayRaw, data: scaleWaterDay(scaleDay(dayRaw.data)) };
  const week = { ...weekRaw, data: scaleWaterDays(scaleDays(weekRaw.data)) };
  const month = { ...monthRaw, data: scaleWaterDays(scaleDays(monthRaw.data)) };
  const yearData = { ...yearRaw, data: scaleWaterDays(scaleDays(yearRaw.data)) };

  // §10.3 — regola perdite: 3 notti con flusso 01–05 sopra 0,5 L/min.
  // In demo, il sito vetrina è «sano»; la variante in perdita si vede
  // cambiando la soglia dal DB su un sito reale.
  const wnight = useWaterNight(module === "water" ? (isDemoSite ? siteId : safeSiteId) : undefined, dateKey, timezone, isDemoSite, false);

  const nf = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 1 }), [language]);
  const nf0 = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 0 }), [language]);
  const nf2 = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 2 }), [language]);
  // precisione per metrica: pH, cloro, torbidità, bar e CO vivono nei
  // centesimi — arrotondarli all'intero li renderebbe tutti uguali
  const fineMetric = module === "water" ? airMetric !== "wtemp" : module === "air" && airMetric === "co";
  const fmtV = (v: number) => (fineMetric ? nf2 : nf0).format(v);
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
  const monthNamesLong = useMemo(() => {
    const f = new Intl.DateTimeFormat(language, { month: "long" });
    return Array.from({ length: 12 }, (_, i) => {
      const n = f.format(new Date(2026, i, 1));
      return n.charAt(0).toUpperCase() + n.slice(1);
    });
  }, [language]);
  // vista della scheda Meteo (§10.1): Dispersione / Nel tempo
  const [wxView, setWxView] = useState<"scatter" | "time">("scatter");

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
  const fmtGapT = (min: number) => {
    const h = Math.floor(min / 60), m = min % 60;
    return h > 0 ? (m > 0 ? `${h}h ${pad(m)}m` : `${h}h`) : `${m}m`;
  };
  const verdict = useMemo(() => {
    if (!d) return null;
    // §10.3 — vista NOTTE: il giudizio è la regola perdite, leggibile
    if (module === "water" && airMetric === "night") {
      if (!wnight.data) return { color: "#9fb2b3", word: t("md.partial"), summary: undefined };
      return wnight.data.leaking
        ? { color: AMBER, word: t("md.leak_possible"), summary: t("md.leak_nights").replace("{n}", String(wnight.data.streak)) }
        : { color: TEAL, word: t("md.v_normal"), summary: t("md.no_night_flow") };
    }
    // §10.3 — vista VOLUME: litri del giorno vs profilo tipico
    if (module === "water" && airMetric === "volume" && d.avg != null) {
      const typTot = d.typical ? d.typical.reduce((a, v) => a + (v ?? 0), 0) : 0;
      const deltaPct = typTot > 0 ? Math.round(((d.avg - typTot) / typTot) * 100) : null;
      const off = deltaPct != null && Math.abs(deltaPct) > 15;
      return {
        color: off ? AMBER : TEAL,
        word: off ? t("ovm.v_attention") : t("md.v_normal"),
        summary: off && deltaPct != null
          ? `${deltaPct > 0 ? "+" : ""}${deltaPct}% ${t("md.vs_typical").replace("{d}", new Intl.DateTimeFormat(language, { weekday: "long" }).format(anchor))}`
          : t("md.volume_in_line"),
      };
    }
    // §10.2: con un buco rilevante il giudizio viene SOSPESO, non inventato
    if (module !== "energy" && (d.missingMinutes ?? 0) >= 120) {
      return {
        color: "#9fb2b3",
        word: t("md.partial"),
        summary: t("md.partial_sub").replace("{t}", fmtGapT(d.missingMinutes!)),
      };
    }
    // §10.2 PM: fuori vs dentro — se non c'è mai un superamento, dillo
    if (module === "air" && (airMetric === "pm25" || airMetric === "pm10") && d.avg != null && d.limit != null) {
      const overruns = d.points.filter(p => (p.v ?? 0) > d.limit!).length;
      const lvl = overruns > 0 ? "MODERATE" : "GOOD";
      return {
        color: overruns > 0 ? AMBER : TEAL,
        word: t(AIR_V[lvl]),
        summary: overruns > 0 ? t("md.overruns").replace("{n}", String(overruns)) : t("md.under_who"),
      };
    }
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
    // altre metriche (aria o acqua): se c'è la soglia, il giudizio viene da lì
    // (superamenti = Attenzione); senza soglia si legge solo il valore medio
    if (d.limit != null) {
      const overruns = d.points.filter(p => (p.v ?? 0) > d.limit!).length;
      // per grandezze fisiche (temp, umidità, qualità dell'acqua) il giudizio
      // positivo è «Nella norma», non «Buona»
      const okWord = module === "water" || ["temp", "humidity"].includes(airMetric) ? t("md.v_in_range") : t(AIR_V.GOOD);
      return overruns > 0
        ? { color: AMBER, word: t("ovm.v_attention"), summary: t("md.overruns").replace("{n}", String(overruns)) }
        : { color: TEAL, word: okWord, summary: `${nf.format(d.avg)} ${d.unit}` };
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
  const WATER_LABEL: Record<string, string> = {
    flow: t("md.metric_flow"), volume: t("md.metric_volume"), night: t("md.metric_night"),
    ph: "pH", turbidity: t("md.metric_turb"),
    chlorine: t("md.metric_chlorine"), wtemp: t("ovm.row_temp"), pressure: t("md.metric_pressure"),
  };
  const AIR_ORDER = ["iaq", "co2", "pm25", "pm10", "tvoc", "co", "o3", "temp", "humidity"];
  // §10.3: Portata · Volume · Notte · Pressione, più la qualità SOLO se
  // il sensore esiste («niente Water Quality finta»)
  const WATER_ORDER = ["flow", "volume", "night", "pressure", "ph", "turbidity", "chlorine", "wtemp"];
  // §10.2: con sole sonde LEED selezionate restano le 4 metriche base
  // (IAQ, CO₂, TVOC, Temp, Umidità) — niente schede che portano nel vuoto
  const LEED_BASE = new Set(["iaq", "co2", "tvoc", "temp", "humidity"]);
  const metricTabs = module === "energy"
    ? [
        ...(cats.data ?? ["power"] as EnergyCat[]).map(c => ({ id: c as string, label: CAT_LABEL[c] })),
        { id: "co2e", label: "CO₂" },
        ...(effPrice ? [{ id: "cost", label: t("md.metric_cost") }] : []),
        /* §10.1: le schede approfondimento esistono solo coi loro dati */
        ...(eui.data ? [{ id: "compare", label: t("md.tab_compare") }] : []),
        ...(wcorr.data ? [{ id: "weather", label: t("md.tab_weather") }] : []),
        { id: "carbon", label: t("md.tab_carbon") },
        ...(period === "year" && periodsY.data ? [{ id: "periods", label: t("md.tab_periods") }] : []),
      ]
    : (module === "water" ? WATER_ORDER : AIR_ORDER)
        .filter(k => {
          // volume e notte sono viste derivate della portata (§10.3)
          const needed = k === "iaq" ? "co2" : k === "volume" || k === "night" ? "flow" : k;
          return (avail.data ?? []).includes(needed);
        })
        .filter(k => module !== "air" || !selAllLeed || LEED_BASE.has(k))
        .map(k => ({ id: k, label: module === "water" ? WATER_LABEL[k] : AIR_LABEL[k] }));
  // la metrica corrente deve sempre esistere fra le schede
  useEffect(() => {
    if (module !== "energy" && metricTabs.length > 0 && !metricTabs.some(tb => tb.id === airMetric)) {
      setAirMetric(metricTabs[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selAllLeed, avail.data, module]);

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

  const summaryLabel = module === "energy" ? t("md.summary_energy") : module === "water" ? t("md.summary_water") : t("md.summary_air");
  const moduleLabel = module === "energy" ? t("ovm.energy") : module === "water" ? t("ovm.water") : t("ovm.air");
  // «Dati spiegati»: le metriche acqua hanno schede dedicate (prefisso w)
  const WATER_XTAB: Record<string, string> = { flow: "wflow", ph: "wph", turbidity: "wturb", chlorine: "wchlor" };
  const openExplain = () => setExplainTab(
    module === "energy" ? "power" : module === "water" ? (WATER_XTAB[airMetric] ?? "wflow") : airMetric,
  );
  // Le schede metrica restano visibili su OGNI orizzonte temporale: il
  // cambio periodo non deve mai far sparire la selezione della variabile.
  const metricTabsEl = metricTabs.length > 1 ? (
    <MetricTabs
      tabs={metricTabs}
      value={module === "energy" ? energyTab : airMetric}
      onChange={id => {
        if (module !== "energy") { setAirMetric(id); return; }
        setEnergyTab(id as EnergyTab);
        // §10.1: Confronto/Meteo/Carbonio ragionano per MESE, Periodi per ANNO
        if (["compare", "weather", "carbon"].includes(id) && period !== "month") setPeriod("month");
        if (id === "periods" && period !== "year") setPeriod("year");
      }}
    />
  ) : null;
  // cambiando orizzonte, una scheda approfondimento incompatibile torna a Potenza
  useEffect(() => {
    if (!insightTab) return;
    if (energyTab === "periods" && period !== "year") setEnergyTab("power");
    if (["compare", "weather", "carbon"].includes(energyTab) && period !== "month") setEnergyTab("power");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);
  // ambra su SOGLIA (non su media) per barre e calendario di aria/acqua
  const overLimitFor = module !== "energy" ? (limit ?? undefined) : undefined;

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
          <span className="inline-block whitespace-nowrap" style={{ fontSize: 15, fontWeight: 600 }}>{period === "month" ? summaryLabel : moduleLabel}</span>
          <span className="truncate" style={{ fontSize: 13, color: SUB, marginLeft: 6 }}>{siteName}</span>
          {(d?.isDemo || week.data?.isDemo || month.data?.isDemo || yearData.data?.isDemo) && (
            <span className="align-middle" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#b45309", background: "rgba(217,154,43,.15)", borderRadius: 999, padding: "2px 7px", marginLeft: 6 }}>DEMO</span>
          )}
          {/* la dashboard Water è una PROPOSTA (§5.6): etichettata finché
              il proprietario non la consolida */}
          {module === "water" && (
            <span className="align-middle uppercase" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: SUB, background: "rgba(127,149,151,.14)", borderRadius: 999, padding: "2px 7px", marginLeft: 6 }}>{t("md.proposal")}</span>
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
      {period === "month" && !insightTab ? (
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

      {/* §10.2: il selettore sonde del PC diventa una riga toccabile */}
      {module === "air" && (probes.data?.length ?? 0) > 0 && (
        <button type="button" onClick={() => { hapticLight(); setProbeSheetOpen(true); }}
          className="mx-auto -mt-1 mb-1" style={{ fontSize: 12.5, color: SUB, minHeight: 36 }}>
          {t("md.probes_label").replace("{x}",
            probeIds == null ? t("md.all_f")
            : selProbes.length === 1 ? selProbes[0].label
            : String(selProbes.length))} ▾
        </button>
      )}

      {/* ── GIORNO ── */}
      {period === "day" && !insightTab && (
        <>
          {verdict && <VerdictLine color={verdict.color} verdict={verdict.word} summary={verdict.summary} onExplain={openExplain} />}
          {metricTabsEl}
          {day.isLoading ? (
            <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
          ) : d ? (
            <>
              <TimeSeriesChart
                points={d.points}
                /* col PM esterno in campo il fantasma «tipico» affollerebbe
                   il grafico: vince la serie esterna (§10.2) */
                typical={d.outdoor ? undefined : d.typical}
                secondary={d.outdoor}
                gapLabel={d.gap && (d.missingMinutes ?? 0) >= 120 ? {
                  from: d.gap.from, to: d.gap.to,
                  text: t("md.no_data_range").replace("{a}", `${pad(d.gap.from)}:00`).replace("{b}", `${pad(Math.min(23, d.gap.to))}:00`),
                } : undefined}
                nightWindow={module === "water" && airMetric === "night" ? {
                  from: NIGHT_FROM, to: NIGHT_TO,
                  alert: wnight.data?.leaking,
                  label: t("md.night_window"),
                } : undefined}
                unit={d.unit}
                limit={d.limit}
                limit2={d.limit2}
                limitLabel={d.limit != null ? (module === "air" && (airMetric === "pm25" || airMetric === "pm10") ? t("md.limit_who") : module === "energy" ? t("md.limit_contract") : t("md.limit")).replace("{v}", `${fmtV(d.limit)} ${d.unit}`) : undefined}
                nowHour={dateKey === todayKey ? new Date().getHours() : undefined}
                nowLabel={t("md.now")}
                peak={d.peak}
                peakLabel={d.peak ? t("md.peak").replace("{v}", `${fineMetric ? nf2.format(d.peak.v) : nf.format(d.peak.v)} ${d.unit}`).replace("{h}", `${pad(d.peak.h)}:00`) : undefined}
                onSwipe={dir => (dir === 1 && nextDisabled ? undefined : shift(dir))}
                fmt={fmtV}
                yMax={module === "air" && (airMetric === "iaq" || airMetric === "humidity") ? 100 : undefined}
              />
              <TimeAxisBand />
              {/* legenda: PM interno/esterno oppure profilo tipico */}
              {d.outdoor ? (
                <p className="text-center" style={{ fontSize: 10.5, color: SUB, marginTop: 2 }}>
                  ━ {t("md.indoor")} · – – {t("md.outdoor_lbl")}
                </p>
              ) : d.typical && (
                <p className="text-center" style={{ fontSize: 10.5, color: SUB, marginTop: 2 }}>
                  – – {t("md.typical_of").replace("{d}", new Intl.DateTimeFormat(language, { weekday: "long" }).format(anchor))}
                </p>
              )}
              {/* la causa (§6.1.8): temperatura esterna per l'energia,
                  HVAC acceso/spento per la CO₂ — stesso asse X */}
              {module === "energy" && d.outdoorTemp && (() => {
                const vals = d.outdoorTemp.filter((v): v is number => v != null);
                const range = vals.length ? `${nf0.format(Math.min(...vals))}° → ${nf0.format(Math.max(...vals))}°` : undefined;
                return <CauseTrack variant="line" series={d.outdoorTemp} label={t("md.outdoor_temp")} note={range} />;
              })()}
              {d.hvacStrip && <CauseTrack variant="onOff" strip={d.hvacStrip} label={t("md.hvac")} note={t("md.hvac_note")} />}
              {/* §10.3: la regola perdite scritta per esteso, leggibile */}
              {module === "water" && airMetric === "night" && (
                <div className="px-6 mt-3">
                  <p style={{ fontSize: 12.5, fontWeight: 500, color: INK, margin: 0 }}>
                    {t("md.leak_rule")}
                    <span style={{ fontWeight: 400, color: SUB, marginLeft: 6 }}>
                      {t("md.leak_rule_body").replace("{a}", `${pad(NIGHT_FROM)}–${pad(NIGHT_TO)}`).replace("{l}", String(LEAK_LMIN)).replace("{n}", String(LEAK_NIGHTS))}
                    </span>
                  </p>
                  {wnight.data?.leaking && wnight.data.estLitersPerDay != null && (
                    <p style={{ fontSize: 12, color: "#b97a14", margin: "4px 0 0" }}>
                      {t("md.leak_estimate")
                        .replace("{f}", nf2.format(wnight.data.nights[0].minFlow ?? 0))
                        .replace("{l}", nf0.format(wnight.data.estLitersPerDay))}
                    </p>
                  )}
                </div>
              )}
              <SummaryRow items={[
                ...(module === "energy" && d.totalKwh != null ? [{
                  value: DERIVED ? `${nf0.format(Math.round(d.totalKwh * DERIVED.f))} ${DERIVED.unit}` : `${nf0.format(d.totalKwh)} kWh`,
                  label: t("md.today_lbl"),
                }] : []),
                ...(module === "energy" && d.vsTypicalPct != null ? [{ value: `${d.vsTypicalPct > 0 ? "+" : ""}${d.vsTypicalPct}%`, label: t("md.vs_typical").replace("{d}", new Intl.DateTimeFormat(language, { weekday: "long" }).format(anchor)) }] : []),
                ...(module === "energy" && d.costEur != null && energyTab !== "cost" ? [{ value: `€ ${nf0.format(d.costEur)}`, label: t("md.cost_est") }] : []),
                /* §10.2 PM interno/esterno: tre colonne dedicate */
                ...(module === "air" && d.outdoor && d.avg != null ? (() => {
                  const outVals = d.outdoor!.filter((v): v is number => v != null);
                  const outAvg = outVals.length ? outVals.reduce((a, b) => a + b, 0) / outVals.length : null;
                  return [
                    { value: `${fmtV(d.avg)} ${d.unit}`, label: t("md.indoor_avg") },
                    ...(outAvg != null ? [{ value: nf0.format(outAvg), label: t("md.outdoor_avg") }] : []),
                    ...(outAvg != null && outAvg > 0 ? [{ value: `−${Math.round((1 - d.avg / outAvg) * 100)}%`, label: t("md.retained") }] : []),
                  ];
                })() : []),
                /* §10.3 — summary dedicate di Notte e Volume */
                ...(module === "water" && airMetric === "night" && wnight.data ? [
                  { value: wnight.data.nights[0]?.minFlow != null ? `${nf2.format(wnight.data.nights[0].minFlow)} L/min` : "—", label: t("md.night_min") },
                  { value: String(wnight.data.streak), label: t("md.nights_row") },
                  ...(wnight.data.estLitersPerDay != null ? [{ value: `≈ ${nf0.format(wnight.data.estLitersPerDay)} L`, label: t("md.wasted_day") }] : []),
                ] : []),
                ...(module === "water" && airMetric === "volume" && d.avg != null ? [
                  { value: `${nf0.format(d.avg)} L`, label: t("md.today_lbl") },
                  ...(d.typical ? (() => {
                    const typTot = d.typical!.reduce((a, v) => a + (v ?? 0), 0);
                    return typTot > 0 ? [{ value: `${nf0.format(typTot)} L`, label: t("md.typical_day") }] : [];
                  })() : []),
                  ...(d.peak ? [{ value: `${nf0.format(d.peak.v)} L/h`, label: t("md.peak_lbl") }] : []),
                ] : []),
                /* §10.2 dati parziali: media sui presenti + tempo senza dati */
                ...(module !== "energy" && !(module === "water" && waterDerived) && !d.outdoor && d.avg != null ? [{
                  value: d.unit ? `${fmtV(d.avg)} ${d.unit}` : `${nf0.format(d.avg)}/100`,
                  label: (d.missingMinutes ?? 0) >= 120 ? t("md.on_present") : t("md.avg"),
                }] : []),
                ...(module !== "energy" && (d.missingMinutes ?? 0) >= 120 ? [{ value: fmtGapT(d.missingMinutes!), label: t("md.no_data_lbl") }] : []),
                ...(module !== "energy" && !d.outdoor && d.overLimitMinutes ? [{ value: `${Math.floor(d.overLimitMinutes / 60)}h ${pad(d.overLimitMinutes % 60)}m`, label: t("md.over_time") }] : []),
                ...(module === "air" && d.hvacStrip ? [{ value: String(d.hvacStrip.reduce((a, on, i) => a + (i > 0 && !on && d.hvacStrip![i - 1] ? 1 : 0), 0)), label: t("md.hvac_pauses") }] : []),
              ].slice(0, 3)} />
            </>
          ) : (
            <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>{t("md.no_data")}</p>
          )}
          {/* §10.2: le metriche che la sonda non misura spariscono dalle
              schede — qui si spiega il perché, invece di un grafico vuoto */}
          {module === "air" && selAllLeed && (
            <div className="mx-6 mt-4 rounded-xl px-4 py-3" style={{ background: "#eef4f4" }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: INK, margin: 0 }}>{t("md.leed_missing_t")}</p>
              <p style={{ fontSize: 12, color: SUB, margin: "2px 0 0" }}>{t("md.leed_missing_b")}</p>
            </div>
          )}
        </>
      )}

      {/* ── SETTIMANA ── */}
      {period === "week" && !insightTab && (
        week.isLoading ? <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
        : week.data ? (
          <>
            {(() => {
              const w = week.data!;
              if (module === "energy" && w.totalKwh != null) {
                const total = DERIVED ? `${nf0.format(Math.round(w.totalKwh * DERIVED.f))} ${DERIVED.unit}` : `${nf.format(w.totalKwh / 1000)} MWh`;
                return <VerdictLine color={TEAL} verdict={t("md.v_average")} summary={total} onExplain={openExplain} />;
              }
              // aria/acqua: giudizio dalla media settimanale della metrica (§6.2)
              const vals = w.days.map(x => x.v).filter((v): v is number => v != null);
              if (module === "energy" || vals.length === 0) return null;
              const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
              if (module === "air" && (airMetric === "co2" || airMetric === "iaq")) {
                const lvl = airMetric === "co2" ? co2Level(mean) : scoreToLevel(mean);
                const color = lvl === "POOR" ? RED : lvl === "MODERATE" ? AMBER : TEAL;
                const summary = airMetric === "co2" ? `${nf0.format(mean)} ${w.unit}` : `${nf0.format(mean)} / 100`;
                return <VerdictLine color={color} verdict={t(AIR_V[lvl])} summary={summary} onExplain={openExplain} />;
              }
              if (limit != null) {
                const overDays = w.days.filter(x => x.v != null && x.v > limit).length;
                const okWord = module === "water" || ["temp", "humidity"].includes(airMetric) ? t("md.v_in_range") : t(AIR_V.GOOD);
                return overDays > 0
                  ? <VerdictLine color={AMBER} verdict={t("ovm.v_attention")} summary={`${nf0.format(overDays)} ${t("md.days_over")}`} onExplain={openExplain} />
                  : <VerdictLine color={TEAL} verdict={okWord} summary={`${fmtV(mean)} ${w.unit}`} onExplain={openExplain} />;
              }
              return <VerdictLine color={TEAL} verdict={`${fmtV(mean)} ${w.unit}`} onExplain={openExplain} />;
            })()}
            {metricTabsEl}
            <WeekBars
              s={week.data}
              onOpenDay={date => { if (!date.startsWith("demo")) { setAnchor(new Date(`${date}T12:00:00`)); } setPeriod("day"); }}
              avgLabel={week.data.weekdayAvg != null ? t("md.weekday_avg").replace("{v}", `${fmtV(week.data.weekdayAvg)} ${week.data.unit}`) : undefined}
              fmt={fmtV}
              weekdays={weekdayHeads}
              overLimit={overLimitFor}
            />
            <HourHeatmap
              s={week.data}
              onOpenDay={date => { if (!date.startsWith("demo")) { setAnchor(new Date(`${date}T12:00:00`)); } setPeriod("day"); }}
              title={module === "energy" ? t("md.hour_load") : t("md.hour_pattern")}
              hint={t("md.tap_day")}
              weekdays={weekdayHeads}
              fmtCell={(v, di, hi) => `${weekdayHeads[di]} ${pad(hi)}:00 · ${fmtV(v)}${week.data!.unit ? ` ${week.data!.unit}` : ""}`}
            />
            <SummaryRow items={[
              ...(week.data.totalKwh != null ? [{
                value: DERIVED ? `${nf0.format(Math.round(week.data.totalKwh * DERIVED.f))} ${DERIVED.unit}` : `${nf.format(week.data.totalKwh / 1000)} MWh`,
                label: t("md.week_lbl"),
              }] : []),
              ...(module !== "energy" ? (() => {
                const vals = week.data!.days.map(x => x.v).filter((v): v is number => v != null);
                if (!vals.length) return [];
                const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
                return [{ value: week.data!.unit ? `${fmtV(mean)} ${week.data!.unit}` : `${nf0.format(mean)}/100`, label: t("md.avg") }];
              })() : []),
              ...(module !== "energy" && limit != null ? (() => {
                const overDays = week.data!.days.filter(x => x.v != null && x.v! > limit).length;
                return overDays > 0 ? [{ value: String(overDays), label: t("md.days_over") }] : [];
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
      {period === "month" && !insightTab && (
        month.isLoading ? <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
        : month.data ? (
          <>
            {metricTabsEl}
            {/* carpet plot giorni × ore (atlante §6 v2): si vedono insieme
                orari di lavoro, weekend, notti col carico di base e anomalie */}
            <MonthCarpet
              s={month.data}
              overLimit={overLimitFor}
              legendLess={t("md.less")} legendMore={t("md.more")} legendWeekend={t("md.weekend")}
              onOpenDay={date => { setAnchor(new Date(`${date}T12:00:00`)); setPeriod("day"); }}
            />
            {month.data.totalKwh != null && (
              /* mockup §6.3: etichetta in evidenza, VALORE in grigio */
              <p className="text-center mt-4" style={{ fontSize: 14, color: INK, fontWeight: 600 }}>
                {energyTab === "co2e" ? t("md.co2_emitted") : energyTab === "cost" ? t("md.cost_est_cap") : t("md.month_total")}{" "}
                <span className="tabular-nums" style={{ color: SUB, fontWeight: 400 }}>
                  {DERIVED ? `${nf0.format(Math.round(month.data.totalKwh * DERIVED.f))} ${DERIVED.unit}` : `${nf.format(month.data.totalKwh / 1000)} MWh`}
                </span>
              </p>
            )}
            {/* aria/acqua: la riga centrata è la media del mese */}
            {module !== "energy" && (() => {
              const vals = month.data!.cells.map(c => c.v).filter((v): v is number => v != null);
              if (!vals.length) return null;
              const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
              return (
                <p className="text-center mt-4" style={{ fontSize: 14, color: INK, fontWeight: 600 }}>
                  {t("md.month_avg")}{" "}
                  <span className="tabular-nums" style={{ color: SUB, fontWeight: 400 }}>
                    {month.data!.unit ? `${fmtV(mean)} ${month.data!.unit}` : `${nf0.format(mean)}/100`}
                  </span>
                </p>
              );
            })()}
            <LabelValueGrid items={[
              ...(month.data.costEur != null && energyTab !== "cost" ? [{ label: t("md.cost_est"), value: `€ ${nf0.format(month.data.costEur)}` }] : []),
              ...(month.data.vsPrevPct != null ? [{ label: t("md.vs_prev_month"), value: `${month.data.vsPrevPct > 0 ? "+" : ""}${month.data.vsPrevPct}%` }] : []),
              /* aria/acqua con soglia: quanti giorni del mese l'hanno superata */
              ...(module !== "energy" && limit != null ? (() => {
                const overDays = month.data!.cells.filter(c => c.v != null && c.v > limit).length;
                return [{ label: t("md.days_over"), value: String(overDays) }];
              })() : []),
              /* mockup: «Picco · 12 ott» sopra, «23,2 kW» sotto */
              ...(month.data.peak ? [{
                label: `${t("md.peak_lbl")} · ${dfRange.format(new Date(`${month.data.peak.date}T12:00:00`))}`,
                value: `${fmtV(month.data.peak.v)}${month.data.unit ? ` ${month.data.unit}` : ""}`,
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
      {period === "year" && !insightTab && (
        yearData.isLoading ? <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
        : yearData.data ? (
          <>
            {metricTabsEl}
            <YearBars
              s={yearData.data}
              monthLabels={monthHeads}
              onOpenMonth={m => { const dd = new Date(anchor.getFullYear(), m - 1, 1); setAnchor(dd); setPeriod("month"); }}
              avgLabel={yearData.data.avg != null ? t("md.monthly_avg").replace("{v}", `${fmtV(yearData.data.avg)}${yearData.data.unit ? ` ${yearData.data.unit}` : ""}`) : undefined}
              fmt={fmtV}
            />
            <SummaryRow items={[
              ...(yearData.data.totalKwh != null ? [{
                value: DERIVED ? `${nf0.format(Math.round(yearData.data.totalKwh * DERIVED.f))} ${DERIVED.unit}` : `${nf.format(yearData.data.totalKwh / 1000)} MWh`,
                label: t("md.year_lbl"),
              }] : []),
              ...(module !== "energy" && yearData.data.avg != null ? [{ value: yearData.data.unit ? `${fmtV(yearData.data.avg)} ${yearData.data.unit}` : `${nf0.format(yearData.data.avg)}/100`, label: t("md.avg") }] : []),
              ...(module !== "energy" && limit != null ? (() => {
                const overMonths = yearData.data!.months.filter(x => x.v != null && x.v > limit).length;
                return overMonths > 0 ? [{ value: String(overMonths), label: t("md.months_over") }] : [];
              })() : []),
              ...(yearData.data.costEur != null && energyTab !== "cost" ? [{ value: `€ ${nf0.format(yearData.data.costEur)}`, label: t("md.cost_est") }] : []),
            ].slice(0, 3)} />
          </>
        ) : <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>{t("md.no_data")}</p>
      )}

      {/* ── APPROFONDIMENTI ENERGY (§10.1): Confronto · Meteo · Carbonio · Periodi ── */}
      {insightTab && energyTab === "compare" && (
        eui.isLoading ? <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
        : eui.data ? (
          <>
            {eui.data.vsPeersPct != null && (
              <VerdictLine
                color={eui.data.vsPeersPct > 0 ? AMBER : TEAL}
                verdict={t(eui.data.vsPeersPct > 0 ? "md.above_peers" : "md.below_peers").replace("{p}", nf.format(Math.abs(eui.data.vsPeersPct)))}
                summary={t("md.peers_n").replace("{n}", String(eui.data.peerCount))}
                onExplain={() => setExplainTab("intensity")}
              />
            )}
            {metricTabsEl}
            <EuiCompareChart
              s={eui.data} anchorMonth={anchor.getMonth()} monthLabels={monthHeads}
              labels={{ site: t("md.site_lbl"), peers: t("md.peers_lbl"), band: t("md.band_lbl"), target: t("md.target_eui"), now: monthHeads[anchor.getMonth()] }}
            />
            <p className="text-center" style={{ fontSize: 11, color: SUB, marginTop: 6 }}>
              {[eui.data.typology, eui.data.climateZone ? `${t("md.climate_zone")} ${eui.data.climateZone}` : null, t("md.same_period")].filter(Boolean).join(" · ")}
            </p>
            <SummaryRow items={[
              ...(eui.data.siteNow != null ? [{ value: nf.format(eui.data.siteNow), label: `kWh/m² ${t("md.site_lbl")}` }] : []),
              ...(eui.data.peerNow != null ? [{ value: nf.format(eui.data.peerNow), label: t("md.peers_avg") }] : []),
              ...(eui.data.targetMonthly != null ? [{ value: nf.format(eui.data.targetMonthly), label: t("md.target_eui") }] : []),
            ]} />
          </>
        ) : <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>{t("md.no_data")}</p>
      )}

      {insightTab && energyTab === "weather" && (
        wcorr.isLoading ? <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
        : wcorr.data ? (
          <>
            {wcorr.data.r2 != null && (
              <VerdictLine
                color={TEAL}
                verdict={t("md.weather_weighs").replace("{p}", String(Math.round(wcorr.data.r2 * 100)))}
                summary={t("md.weather_rest")}
                onExplain={() => setExplainTab("power")}
              />
            )}
            {metricTabsEl}
            {wxView === "scatter"
              ? <div className="px-6 mt-3"><WeatherScatter s={wcorr.data} todayKey={todayKey} fmt={v => nf0.format(v)} /></div>
              : <div className="px-6 mt-3"><WeatherTimeline s={wcorr.data} /></div>}
            <p className="text-center" style={{ fontSize: 10.5, color: SUB, marginTop: 2 }}>
              {wxView === "scatter" ? t("md.weather_axis") : t("md.weather_axis_time")}
            </p>
            <div className="flex justify-center gap-2 mt-3">
              {(["scatter", "time"] as const).map(v => (
                <button key={v} type="button" onClick={() => { hapticLight(); setWxView(v); }}
                  className="rounded-full font-semibold"
                  style={{ fontSize: 11.5, minHeight: 34, padding: "0 14px", color: wxView === v ? INK : SUB, background: wxView === v ? "#eef4f4" : "transparent" }}>
                  {v === "scatter" ? t("md.scatter") : t("md.in_time")}
                </button>
              ))}
            </div>
            <SummaryRow items={[
              ...(wcorr.data.r2 != null ? [{ value: `R² ${nf2.format(wcorr.data.r2)}`, label: t("md.temp_hum") }] : []),
              ...(wcorr.data.kwhPerDegree != null && wcorr.data.kwhPerDegree > 0 ? [{ value: `+${nf0.format(wcorr.data.kwhPerDegree)} kWh`, label: t("md.per_degree") }] : []),
              { value: String(wcorr.data.points.length), label: t("md.days_lbl") },
            ]} />
          </>
        ) : <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>{t("md.no_data")}</p>
      )}

      {insightTab && energyTab === "carbon" && (
        yearData.isLoading || month.isLoading ? <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
        : yearData.data ? (
          <>
            {month.data?.totalKwh != null && (
              <VerdictLine
                color={TEAL}
                verdict={`${nf0.format(Math.round(month.data.totalKwh * CO2_EMISSION_FACTOR))} kgCO₂e`}
                summary={month.data.vsPrevPct != null ? `${month.data.vsPrevPct > 0 ? "+" : ""}${month.data.vsPrevPct}% ${t("md.vs_prev_month_days")}` : undefined}
                onExplain={() => setExplainTab("power")}
              />
            )}
            {metricTabsEl}
            <CarbonBars
              months={yearData.data.months.map(x => ({ m: x.m, kg: x.v != null ? Math.round(x.v * CO2_EMISSION_FACTOR) : null }))}
              anchorMonth={anchor.getMonth()} monthLabels={monthHeads} fmt={v => nf0.format(v)}
            />
            <p className="text-center" style={{ fontSize: 10.5, color: SUB, marginTop: 2 }}>
              kgCO₂e · {t("md.ef_factor")}
            </p>
            {/* giorno/notte dal carpet del mese corrente (ore 8–20, fuso sito) */}
            {month.data && (() => {
              let dayKwh = 0, nightKwh = 0;
              for (const row of month.data.hours) for (let h = 0; h < 24; h++) {
                const v = row[h];
                if (v == null) continue;
                if (h >= 8 && h < 20) dayKwh += v; else nightKwh += v;
              }
              const tot = dayKwh + nightKwh;
              if (tot <= 0) return null;
              const dayPct = Math.round((dayKwh / tot) * 100);
              return (
                <>
                  <DayNightBars
                    day={{ pct: dayPct, kwh: dayKwh }} night={{ pct: 100 - dayPct, kwh: nightKwh }}
                    labels={{ title: t("md.day_night"), sub: t("md.day_night_sub"), day: t("md.day_lbl"), night: t("md.night_lbl") }}
                    fmtMwh={kwh => `${nf.format(kwh / 1000)} MWh`}
                  />
                  {month.data!.baseloadKw != null && (
                    <p className="px-6" style={{ fontSize: 11.5, color: SUB, marginTop: 6 }}>
                      {t("md.night_note").replace("{p}", String(100 - dayPct)).replace("{b}", nf.format(month.data!.baseloadKw))}
                    </p>
                  )}
                </>
              );
            })()}
          </>
        ) : <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>{t("md.no_data")}</p>
      )}

      {insightTab && energyTab === "periods" && (
        periodsY.isLoading ? <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
        : periodsY.data ? (
          <>
            <VerdictLine
              color={TEAL}
              verdict={`${nf.format(periodsY.data.totalKwh / 1000)} MWh`}
              summary={[
                periodsY.data.totalCost != null ? `€ ${nf0.format(periodsY.data.totalCost)}` : null,
                periodsY.data.vsPrevYearPct != null ? `${periodsY.data.vsPrevYearPct > 0 ? "+" : ""}${periodsY.data.vsPrevYearPct}% vs ${anchor.getFullYear() - 1}` : null,
              ].filter(Boolean).join(" · ") || undefined}
              onExplain={() => setExplainTab("power")}
            />
            {metricTabsEl}
            <PeriodsList
              s={periodsY.data}
              monthNames={monthNamesLong}
              labels={{ inProgress: t("md.in_progress"), peak: t("md.peak_lbl"), avgPrice: t("md.avg_price"), vsPrevYear: `vs ${anchor.getFullYear() - 1}` }}
              fmt0={v => nf0.format(v)}
            />
          </>
        ) : <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>{t("md.no_data")}</p>
      )}

      {/* Foglio selettore sonde (§10.2) */}
      {module === "air" && (
        <ProbeSheet
          open={probeSheetOpen}
          probes={probes.data ?? []}
          selected={probeSel}
          labels={{
            title: t("md.probes"),
            all: t("md.probes_all"),
            metrics: t("md.metrics_lbl"),
            offlineFor: t("md.offline_for"),
            note: t("md.probes_note"),
            apply: t("md.apply"),
          }}
          onApply={setProbeSel}
          onClose={() => setProbeSheetOpen(false)}
        />
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
          wflow: module === "water" && airMetric === "flow" ? d?.avg : undefined,
          wph: module === "water" && airMetric === "ph" ? d?.avg : undefined,
          wturb: module === "water" && airMetric === "turbidity" ? d?.avg : undefined,
          wchlor: module === "water" && airMetric === "chlorine" ? d?.avg : undefined,
        }}
      />
    </div>
  );
};

export default MobileModuleDashboard;
