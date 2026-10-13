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
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticLight } from "@/lib/native";
import ExplainSheet from "@/components/dashboard/ExplainSheet";
import { AMBER, INK, RED, SUB, TEAL, MetricTabs, PeriodPager, PeriodSegment, SummaryRow, TimeAxisBand, VerdictLine, CauseTrack, ExportMenu, type Period } from "./bits";
import TimeSeriesChart from "./TimeSeriesChart";
import { HourHeatmap, LabelValueGrid, MonthCalendar, WeekBars } from "./views";
import { useDaySeries, useMonthSeries, useWeekSeries, type DashModule } from "./useModuleSeries";
import { co2Level } from "@/lib/airQuality";
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
  const [explainTab, setExplainTab] = useState<string | null>(null);

  const todayKey = keyOf(new Date());
  const dateKey = keyOf(anchor);
  const mondayKey = keyOf(mondayOf(anchor));
  const monthKey = dateKey.slice(0, 7);
  // soglie del sito (limite contratto / allarme CO₂) — solo con un UUID vero
  const safeSiteId = siteId && isValidUUID(siteId) && !isDemoSite && isSupabaseConfigured ? siteId : undefined;
  const { thresholds } = useSiteThresholds(safeSiteId);
  const limit = module === "energy"
    ? (energyLimitKw ?? thresholds?.energy_power_limit_kw ?? undefined)
    : (co2LimitPpm ?? thresholds?.air_co2_warning_ppm ?? undefined);

  const day = useDaySeries(module, safeSiteId, dateKey, timezone, isDemoSite, limit, priceKwh, airMetric);
  const week = useWeekSeries(module, safeSiteId, mondayKey, timezone, isDemoSite, priceKwh, airMetric);
  const month = useMonthSeries(module, safeSiteId, monthKey, timezone, isDemoSite, priceKwh, airMetric);

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

  const shift = (dir: 1 | -1) => {
    hapticLight();
    const d = new Date(anchor);
    if (period === "day") d.setDate(d.getDate() + dir);
    else if (period === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    if (keyOf(d) > todayKey && d > new Date()) return;
    setAnchor(d);
  };
  const nextDisabled = period === "day" ? dateKey >= todayKey
    : period === "week" ? keyOf(new Date(mondayOf(anchor).getTime() + 7 * 86400e3)) > todayKey
    : monthKey >= todayKey.slice(0, 7);

  // ── intestazioni del pager ──
  const pagerTitle = period === "day"
    ? (dateKey === todayKey ? t("md.today") : dfRange.format(anchor))
    : period === "week"
      ? (() => {
          const a = mondayOf(anchor), b = new Date(a.getTime() + 6 * 86400e3);
          try { return (dfRange as unknown as { formatRange: (x: Date, y: Date) => string }).formatRange(a, b); }
          catch { return `${dfRange.format(a)} – ${dfRange.format(b)}`; }
        })()
      : dfMonth.format(anchor).replace(/^./, c => c.toUpperCase());
  const pagerSub = period === "day" ? dfWeekday.format(anchor)
    : period === "week" ? t("md.week_n").replace("{n}", String(isoWeek(anchor)))
    : `${dfRange.format(new Date(anchor.getFullYear(), anchor.getMonth(), 1))} – ${dfRange.format(anchor)} ${anchor.getFullYear()}`;

  // ── verdetto del giorno ──
  const d = day.data;
  const verdict = useMemo(() => {
    if (!d) return null;
    if (module === "energy") {
      const over = d.limit != null && d.peak != null && d.peak.v > d.limit;
      return {
        color: over ? AMBER : TEAL,
        word: over ? t("ovm.v_attention") : t("md.v_efficient"),
        summary: d.avg != null ? t("md.avg_load").replace("{v}", `${nf.format(d.avg)} ${d.unit}`) : undefined,
      };
    }
    if (airMetric === "co2" && d.avg != null) {
      const lvl = co2Level(d.avg);
      const color = lvl === "POOR" ? RED : lvl === "MODERATE" ? AMBER : TEAL;
      const overruns = d.limit != null && d.points.filter(p => (p.v ?? 0) > d.limit!).length;
      return {
        color,
        word: t(`xp.lvl_${lvl === "EXCELLENT" ? "excellent" : lvl === "GOOD" ? "good" : lvl === "MODERATE" ? "moderate" : "poor"}`),
        summary: overruns ? t("md.overruns").replace("{n}", String(overruns)) : `${nf0.format(d.avg)} ${d.unit}`,
      };
    }
    return d.avg != null ? { color: TEAL, word: `${nf.format(d.avg)} ${d.unit}`, summary: undefined } : null;
  }, [d, module, airMetric, t, nf, nf0]);

  const metricTabs = module === "energy"
    ? [{ id: "power", label: t("md.metric_power") }]
    : [
        { id: "co2", label: "CO₂" },
        { id: "pm25", label: "PM2.5" },
        { id: "tvoc", label: "TVOC" },
        { id: "temp", label: t("ovm.row_temp") },
        { id: "humidity", label: t("ovm.row_humidity") },
      ];

  // ── esportazioni (menu «⋯», §6.1.1) ──
  const exportData = () => {
    if (period === "day") return d?.points.map(p => ({ hour: p.h, value: p.v }));
    if (period === "week") return week.data?.days.map(x => ({ date: x.date, value: x.v }));
    return month.data?.cells.map(c => ({ date: c.date, value: c.v }));
  };
  const download = (name: string, content: string, mime: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const exportItems = [
    { label: "CSV", onClick: () => { const rows = exportData() || []; download(`${module}-${dateKey}.csv`, Object.keys(rows[0] || { x: 1 }).join(",") + "\n" + rows.map(r => Object.values(r).join(",")).join("\n"), "text/csv"); } },
    { label: "JSON", onClick: () => download(`${module}-${dateKey}.json`, JSON.stringify(exportData() || [], null, 1), "application/json") },
    ...(onExportPdf ? [{ label: "PDF", onClick: onExportPdf }] : []),
  ];

  const summaryLabel = module === "energy" ? t("md.summary_energy") : t("md.summary_air");

  return (
    <div
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
          {(d?.isDemo || week.data?.isDemo) && (
            <span className="align-middle" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#b45309", background: "rgba(217,154,43,.15)", borderRadius: 999, padding: "2px 7px", marginLeft: 6 }}>DEMO</span>
          )}
        </div>
        <ExportMenu items={exportItems} />
      </div>

      <div className="shrink-0 mt-2">
        <PeriodSegment
          value={period}
          onChange={setPeriod}
          labels={{ day: t("md.day"), week: t("md.week"), month: t("md.month") } as Record<Period, string>}
        />
      </div>

      <PeriodPager title={pagerTitle} subtitle={pagerSub} onPrev={() => shift(-1)} onNext={() => shift(1)} nextDisabled={nextDisabled} titleSize={period === "week" ? 23 : 30} />

      {/* ── GIORNO ── */}
      {period === "day" && (
        <>
          {verdict && <VerdictLine color={verdict.color} verdict={verdict.word} summary={verdict.summary} onExplain={() => setExplainTab(module === "energy" ? "power" : airMetric)} />}
          <MetricTabs tabs={metricTabs} value={module === "energy" ? "power" : airMetric} onChange={id => { if (module !== "energy") setAirMetric(id); }} />
          {day.isLoading ? (
            <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
          ) : d ? (
            <>
              <TimeSeriesChart
                points={d.points}
                unit={d.unit}
                limit={d.limit}
                limitLabel={d.limit != null ? (module === "energy" ? t("md.limit_contract") : t("md.limit")).replace("{v}", `${nf0.format(d.limit)} ${d.unit}`) : undefined}
                nowHour={dateKey === todayKey ? new Date().getHours() : undefined}
                nowLabel={t("md.now")}
                peak={d.peak}
                peakLabel={d.peak ? t("md.peak").replace("{v}", `${nf.format(d.peak.v)} ${d.unit}`).replace("{h}", `${pad(d.peak.h)}:00`) : undefined}
                onSwipe={dir => (dir === 1 && nextDisabled ? undefined : shift(dir))}
                fmt={v => nf0.format(v)}
              />
              <TimeAxisBand />
              {d.hvacStrip && <CauseTrack variant="onOff" strip={d.hvacStrip} label={t("md.hvac")} note={t("md.hvac_note")} />}
              <SummaryRow items={[
                ...(module === "energy" && d.totalKwh != null ? [{ value: `${nf0.format(d.totalKwh)} kWh`, label: t("md.today_lbl") }] : []),
                ...(module === "energy" && d.vsTypicalPct != null ? [{ value: `${d.vsTypicalPct > 0 ? "+" : ""}${d.vsTypicalPct}%`, label: t("md.vs_typical").replace("{d}", new Intl.DateTimeFormat(language, { weekday: "long" }).format(anchor)) }] : []),
                ...(module === "energy" && d.costEur != null ? [{ value: `€ ${nf0.format(d.costEur)}`, label: t("md.cost_est") }] : []),
                ...(module === "air" && d.avg != null ? [{ value: `${nf0.format(d.avg)} ${d.unit}`, label: t("md.avg") }] : []),
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
            {week.data.totalKwh != null && (
              <VerdictLine color={TEAL} verdict={t("md.v_average")} summary={`${nf.format(week.data.totalKwh / 1000)} MWh`} onExplain={() => setExplainTab(module === "energy" ? "power" : airMetric)} />
            )}
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
              title={t("md.hour_load")}
              hint={t("md.tap_day")}
              weekdays={weekdayHeads}
            />
            <SummaryRow items={[
              ...(week.data.totalKwh != null ? [{ value: `${nf.format(week.data.totalKwh / 1000)} MWh`, label: t("md.week_lbl") }] : []),
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
              <p className="text-center mt-4" style={{ fontSize: 14, color: SUB }}>
                {t("md.month_total")} <b className="tabular-nums" style={{ color: INK, fontWeight: 600 }}>{nf.format(month.data.totalKwh / 1000)} MWh</b>
              </p>
            )}
            <LabelValueGrid items={[
              ...(month.data.costEur != null ? [{ label: t("md.cost_est"), value: `€ ${nf0.format(month.data.costEur)}` }] : []),
              ...(month.data.vsPrevPct != null ? [{ label: t("md.vs_prev_month"), value: `${month.data.vsPrevPct > 0 ? "+" : ""}${month.data.vsPrevPct}%` }] : []),
              ...(month.data.peak ? [{ label: t("md.peak_lbl"), value: `${dfRange.format(new Date(`${month.data.peak.date}T12:00:00`))} · ${nf0.format(month.data.peak.v)} ${month.data.unit}` }] : []),
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

      {/* «Dati spiegati» sulla metrica corrente (§6.7) */}
      <ExplainSheet
        tab={explainTab}
        onClose={() => setExplainTab(null)}
        onTab={setExplainTab}
        current={{
          power: module === "energy" ? d?.avg : undefined,
          co2: module === "air" && airMetric === "co2" ? d?.avg : undefined,
          pm25: module === "air" && airMetric === "pm25" ? d?.avg : undefined,
          tvoc: module === "air" && airMetric === "tvoc" ? d?.avg : undefined,
          temp: module === "air" && airMetric === "temp" ? d?.avg : undefined,
          humidity: module === "air" && airMetric === "humidity" ? d?.avg : undefined,
        }}
      />
    </div>
  );
};

export default MobileModuleDashboard;
