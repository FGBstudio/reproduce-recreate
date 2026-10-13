/**
 * Dati per la dashboard modulo mobile (brief §6) — stesse fonti delle card:
 * energy_hourly/energy_daily per l'energia, telemetry_hourly/daily per l'aria,
 * con la precedenza «general» dei contatori e fallback dichiarati.
 *
 * Regola d'oro (§8.3): se un dato non esiste l'elemento non si mostra.
 * In demo mode (sito vetrina, Supabase non configurato) la serie è sintetica
 * e DEVE essere presentata col badge DEMO — mai come reale.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type DashModule = "energy" | "air";

/** Metriche aria disponibili (telemetry_hourly/daily, alias storici inclusi). */
export const AIR_METRICS: Record<string, { ids: string[]; unit: string }> = {
  co2: { ids: ["iaq.co2", "co2"], unit: "ppm" },
  pm25: { ids: ["iaq.pm25", "pm25"], unit: "µg/m³" },
  tvoc: { ids: ["iaq.voc", "tvoc", "voc"], unit: "ppb" },
  temp: { ids: ["env.temperature", "temp", "temperature"], unit: "°C" },
  humidity: { ids: ["env.humidity", "humidity"], unit: "%" },
};

export interface DayPoint { h: number; v: number | null }       // ora locale 0-23
export interface DaySeries {
  points: DayPoint[];
  peak?: { h: number; v: number };
  limit?: number;
  unit: string;
  totalKwh?: number;           // energia del giorno (solo energy)
  avg?: number;                // media del giorno
  overLimitMinutes?: number;   // minuti sopra il limite (stima oraria)
  vsTypicalPct?: number;       // vs stesso giorno-settimana medio (4 settimane)
  costEur?: number;            // solo se la tariffa esiste
  hvacStrip?: boolean[];       // 24 ore: HVAC acceso (striscia causa, aria)
  outdoorTemp?: Array<number | null>; // 24 ore: causa energia (se disponibile)
  isDemo: boolean;
}
export interface WeekDay { label: string; date: string; v: number | null }
export interface WeekSeries {
  days: WeekDay[];             // L..D
  weekdayAvg?: number;
  heat: Array<Array<number | null>>; // 7×24
  heatMax: number;
  totalKwh?: number;
  topDay?: string;
  costEur?: number;
  unit: string;
  isDemo: boolean;
}
export interface MonthDayCell { day: number; date: string; v: number | null; future: boolean; today: boolean }
export interface MonthSeries {
  cells: MonthDayCell[];       // 1..n del mese
  maxV: number;
  totalKwh?: number;
  costEur?: number;
  vsPrevPct?: number;
  peak?: { date: string; v: number };
  baseloadKw?: number;
  unit: string;
  isDemo: boolean;
}

/* Righe come arrivano dalle tabelle (il client non è tipizzato su questo
   schema: il DB di produzione diverge dalle migrazioni del repo). */
interface DeviceRow { id: string; category: string | null; device_type: string | null }
interface HourRow { device_id?: string; ts_hour: string; metric: string; value_avg: number | null; value_sum?: number | null }
interface DayRow { ts_day: string; metric?: string; value_avg?: number | null; value_sum?: number | null }

const dayKeyInTz = (d: Date, tz: string) => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch { return d.toISOString().slice(0, 10); }
};
const hourInTz = (iso: string, tz: string) => {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hour12: false }).format(new Date(iso))) % 24;
  } catch { return new Date(iso).getUTCHours(); }
};

/** Parametri demo per metrica aria: scala plausibile, MAI valori di un'altra metrica. */
const DEMO_AIR: Record<string, { base: number; amp: number; wiggle: number; limit?: number }> = {
  co2: { base: 480, amp: 420, wiggle: 60, limit: 1000 },
  pm25: { base: 7, amp: 5, wiggle: 1.2, limit: 15 },
  tvoc: { base: 140, amp: 130, wiggle: 25, limit: 500 },
  temp: { base: 20.5, amp: 3, wiggle: 0.4 },
  humidity: { base: 42, amp: 9, wiggle: 1.5 },
};

/** Serie demo deterministica per i siti vetrina (badge DEMO obbligatorio). */
function demoDay(module: DashModule, airMetric: string): DaySeries {
  const cfg = DEMO_AIR[airMetric] ?? DEMO_AIR.co2;
  const pts: DayPoint[] = Array.from({ length: 24 }, (_, h) => {
    const base = module === "energy" ? 6 + 10 * Math.exp(-((h - 13) ** 2) / 28) : cfg.base + cfg.amp * Math.exp(-((h - 15) ** 2) / 30);
    const wiggle = Math.sin(h * 1.7) * (module === "energy" ? 1.4 : cfg.wiggle);
    return { h, v: Math.round((base + wiggle) * 10) / 10 };
  });
  const peakPt = pts.reduce((a, b) => ((b.v ?? 0) > (a.v ?? 0) ? b : a));
  const limit = module === "energy" ? 25 : cfg.limit;
  const avg = Math.round((pts.reduce((a, p) => a + (p.v ?? 0), 0) / pts.length) * 10) / 10;
  return {
    points: pts, peak: { h: peakPt.h, v: peakPt.v! },
    limit,
    unit: module === "energy" ? "kW" : (AIR_METRICS[airMetric] ?? AIR_METRICS.co2).unit,
    totalKwh: module === "energy" ? 412 : undefined,
    avg: module === "energy" ? 11.6 : avg,
    // coerente con la serie: minuti davvero sopra il limite disegnato
    overLimitMinutes: limit != null ? pts.filter(p => (p.v ?? 0) > limit).length * 60 : undefined,
    vsTypicalPct: module === "energy" ? -6 : undefined,
    costEur: module === "energy" ? 78 : undefined,
    hvacStrip: module === "air" && airMetric === "co2" ? Array.from({ length: 24 }, (_, h) => h >= 7 && h <= 20 && h !== 13 && h !== 17) : undefined,
    isDemo: true,
  };
}
function demoWeek(module: DashModule, airMetric: string): WeekSeries {
  const cfg = DEMO_AIR[airMetric] ?? DEMO_AIR.co2;
  const airShape = [0.95, 1.0, 1.12, 0.92, 1.02, 0.64, 0.59];
  const vals = module === "energy"
    ? [421, 398, 455, 388, 412, 118, 96]
    : airShape.map(k => Math.round((cfg.base + cfg.amp * 0.38) * k * 10) / 10);
  const heat = Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => {
    const open = h >= 7 && h <= 20 && d < 5;
    return open ? Math.round(40 + 60 * Math.exp(-((h - 13) ** 2) / 30)) : Math.round(8 + (d >= 5 ? 4 : 0));
  }));
  return {
    days: ["L", "M", "M", "G", "V", "S", "D"].map((label, i) => ({ label, date: `demo-${i}`, v: vals[i] })),
    weekdayAvg: Math.round((vals.slice(0, 5).reduce((a, b) => a + b, 0) / 5) * 10) / 10,
    heat, heatMax: 100,
    totalKwh: module === "energy" ? 2290 : undefined,
    topDay: "demo-2",
    costEur: module === "energy" ? 430 : undefined,
    unit: module === "energy" ? "kWh" : (AIR_METRICS[airMetric] ?? AIR_METRICS.co2).unit, isDemo: true,
  };
}
function demoMonth(module: DashModule, airMetric: string): MonthSeries {
  const cfg = DEMO_AIR[airMetric] ?? DEMO_AIR.co2;
  const now = new Date();
  const nDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cells: MonthDayCell[] = Array.from({ length: nDays }, (_, i) => {
    const day = i + 1;
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const future = day > now.getDate();
    const wd = new Date(now.getFullYear(), now.getMonth(), day).getDay();
    const v = future ? null
      : module === "energy"
        ? (wd === 0 || wd === 6 ? 110 : 390 + Math.round(60 * Math.sin(day)))
        : Math.round((cfg.base + cfg.amp * 0.38) * (wd === 0 || wd === 6 ? 0.62 : 1 + 0.08 * Math.sin(day)) * 10) / 10;
    return { day, date, v, future, today: day === now.getDate() };
  });
  const present = cells.filter(c => c.v != null);
  const demoPeak = [...present].sort((a, b) => (b.v! - a.v!))[0];
  return {
    cells, maxV: Math.max(...present.map(c => c.v!), 1),
    totalKwh: module === "energy" ? 3800 : undefined,
    costEur: module === "energy" ? 720 : undefined,
    vsPrevPct: module === "energy" ? -6 : undefined,
    peak: demoPeak ? { date: demoPeak.date, v: demoPeak.v! } : undefined,
    baseloadKw: module === "energy" ? 4.2 : undefined,
    unit: module === "energy" ? "kWh" : (AIR_METRICS[airMetric] ?? AIR_METRICS.co2).unit, isDemo: true,
  };
}

async function generalDeviceIds(siteId: string): Promise<{ ids: string[]; hvacIds: string[] }> {
  const { data } = await supabase!.from("devices")
    .select("id, category, device_type")
    .eq("site_id", siteId);
  const all = (data || []) as unknown as DeviceRow[];
  const general = all.filter(d => d.category === "general").map(d => d.id);
  const hvacIds = all.filter(d => d.category === "hvac").map(d => d.id);
  if (general.length > 0) return { ids: general, hvacIds };
  const ENERGY = new Set(["hvac", "lighting", "plugs"]);
  return {
    ids: all.filter(d => (d.category && ENERGY.has(d.category)) || d.device_type === "energy_monitor").map(d => d.id),
    hvacIds,
  };
}

const HVAC_ON_KW = 2; // soglia acceso/spento (brief §8.2, da raffinare per sito)

export function useDaySeries(module: DashModule, siteId: string | undefined, dateKey: string, tz: string, isDemoSite: boolean, limit?: number, priceKwh?: number, airMetric: string = "co2") {
  return useQuery<DaySeries | null>({
    queryKey: ["mdash-day", module, siteId, dateKey, airMetric],
    queryFn: async (): Promise<DaySeries | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) return isDemoSite ? demoDay(module, airMetric) : null;
      const from = `${dateKey}T00:00:00`;
      // finestra UTC larga: filtriamo poi per giorno locale
      const fromUtc = new Date(new Date(from).getTime() - 26 * 3600e3).toISOString();
      const toUtc = new Date(new Date(from).getTime() + 50 * 3600e3).toISOString();

      if (module === "energy") {
        const { ids, hvacIds } = await generalDeviceIds(siteId);
        if (ids.length === 0) return null;
        const { data } = await supabase!.from("energy_hourly")
          .select("device_id, ts_hour, metric, value_avg, value_sum")
          .in("device_id", ids.slice(0, 50))
          .gte("ts_hour", fromUtc).lte("ts_hour", toUtc)
          .in("metric", ["energy.power_kw", "energy.active_energy", "energy.active_import_kwh"]);
        const byHourPower = new Map<number, number>();
        const byHourEnergy = new Map<number, number>();
        for (const r of (data || []) as unknown as HourRow[]) {
          if (dayKeyInTz(new Date(r.ts_hour), tz) !== dateKey) continue;
          const h = hourInTz(r.ts_hour, tz);
          if (r.metric === "energy.power_kw" && r.value_avg != null) {
            byHourPower.set(h, (byHourPower.get(h) || 0) + Number(r.value_avg));
          } else if (r.value_sum != null && Number(r.value_sum) <= 50000) {
            byHourEnergy.set(h, (byHourEnergy.get(h) || 0) + Number(r.value_sum));
          }
        }
        // potenza: media kW se c'è, altrimenti energia oraria (kWh ≈ kW medi)
        const src = byHourPower.size > 0 ? byHourPower : byHourEnergy;
        if (src.size === 0) return null;
        const points: DayPoint[] = Array.from({ length: 24 }, (_, h) => ({ h, v: src.has(h) ? Math.round(src.get(h)! * 10) / 10 : null }));
        const present = points.filter(pt => pt.v != null) as Array<{ h: number; v: number }>;
        const peakPt = present.reduce((a, b) => (b.v > a.v ? b : a), present[0]);
        const totalKwh = byHourEnergy.size > 0
          ? Math.round([...byHourEnergy.values()].reduce((a, b) => a + b, 0))
          : undefined;
        const avg = Math.round((present.reduce((a, b) => a + b.v, 0) / present.length) * 10) / 10;
        const over = limit ? present.filter(pt => pt.v > limit).length * 60 : undefined;
        // vs stesso giorno-settimana (ultime 4 settimane) da energy_daily
        let vsTypicalPct: number | undefined;
        if (totalKwh) {
          const back = new Date(from); back.setDate(back.getDate() - 28);
          const { data: dd } = await supabase!.from("energy_daily")
            .select("ts_day, value_sum").in("device_id", ids.slice(0, 50))
            .gte("ts_day", back.toISOString().slice(0, 10)).lt("ts_day", dateKey)
            .in("metric", ["energy.active_energy", "energy.active_import_kwh"]);
          const target = new Date(from).getDay();
          const sums = new Map<string, number>();
          for (const r of (dd || []) as unknown as DayRow[]) {
            if (new Date(r.ts_day).getDay() !== target || r.value_sum == null || Number(r.value_sum) > 50000) continue;
            sums.set(r.ts_day, (sums.get(r.ts_day) || 0) + Number(r.value_sum));
          }
          if (sums.size > 0) {
            const typical = [...sums.values()].reduce((a, b) => a + b, 0) / sums.size;
            if (typical > 0) vsTypicalPct = Math.round(((totalKwh - typical) / typical) * 100);
          }
        }
        return {
          points, peak: peakPt ? { h: peakPt.h, v: peakPt.v } : undefined, limit, unit: "kW",
          totalKwh, avg, overLimitMinutes: over, vsTypicalPct,
          costEur: totalKwh && priceKwh ? Math.round(totalKwh * priceKwh) : undefined,
          isDemo: false,
        };
      }

      // ── ARIA: CO₂ oraria + striscia HVAC come causa ──
      const { data } = await supabase!.from("telemetry_hourly")
        .select("ts_hour, metric, value_avg")
        .eq("site_id", siteId)
        .gte("ts_hour", fromUtc).lte("ts_hour", toUtc)
        .in("metric", (AIR_METRICS[airMetric] ?? AIR_METRICS.co2).ids);
      const byHour = new Map<number, { s: number; n: number }>();
      for (const r of (data || []) as unknown as HourRow[]) {
        if (r.value_avg == null || dayKeyInTz(new Date(r.ts_hour), tz) !== dateKey) continue;
        const h = hourInTz(r.ts_hour, tz);
        const e = byHour.get(h) || { s: 0, n: 0 };
        e.s += Number(r.value_avg); e.n++;
        byHour.set(h, e);
      }
      if (byHour.size === 0) return null;
      const points: DayPoint[] = Array.from({ length: 24 }, (_, h) => {
        const e = byHour.get(h);
        return { h, v: e ? Math.round(e.s / e.n) : null };
      });
      const present = points.filter(pt => pt.v != null) as Array<{ h: number; v: number }>;
      const peakPt = present.reduce((a, b) => (b.v > a.v ? b : a), present[0]);
      const avg = Math.round(present.reduce((a, b) => a + b.v, 0) / present.length);
      const over = limit ? present.filter(pt => pt.v > limit).length * 60 : undefined;
      // causa: HVAC acceso/spento dal modulo Energy (potenza hvac > soglia)
      let hvacStrip: boolean[] | undefined;
      const { hvacIds } = await generalDeviceIds(siteId);
      if (hvacIds.length > 0) {
        const { data: hv } = await supabase!.from("energy_hourly")
          .select("ts_hour, metric, value_avg")
          .in("device_id", hvacIds.slice(0, 50))
          .gte("ts_hour", fromUtc).lte("ts_hour", toUtc)
          .eq("metric", "energy.power_kw");
        const on = new Map<number, number>();
        for (const r of (hv || []) as unknown as HourRow[]) {
          if (r.value_avg == null || dayKeyInTz(new Date(r.ts_hour), tz) !== dateKey) continue;
          const h = hourInTz(r.ts_hour, tz);
          on.set(h, (on.get(h) || 0) + Number(r.value_avg));
        }
        if (on.size > 0) hvacStrip = Array.from({ length: 24 }, (_, h) => (on.get(h) || 0) > HVAC_ON_KW);
      }
      return { points, peak: peakPt ? { h: peakPt.h, v: peakPt.v } : undefined, limit: airMetric === "co2" ? limit : undefined, unit: (AIR_METRICS[airMetric] ?? AIR_METRICS.co2).unit, avg, overLimitMinutes: airMetric === "co2" ? over : undefined, hvacStrip: airMetric === "co2" ? hvacStrip : undefined, isDemo: false };
    },
    enabled: !!dateKey,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWeekSeries(module: DashModule, siteId: string | undefined, mondayKey: string, tz: string, isDemoSite: boolean, priceKwh?: number, airMetric: string = "co2") {
  return useQuery<WeekSeries | null>({
    queryKey: ["mdash-week", module, siteId, mondayKey, airMetric],
    queryFn: async (): Promise<WeekSeries | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) return isDemoSite ? demoWeek(module, airMetric) : null;
      const start = new Date(`${mondayKey}T00:00:00`);
      const endKey = new Date(start.getTime() + 6 * 86400e3).toISOString().slice(0, 10);
      const fromUtc = new Date(start.getTime() - 26 * 3600e3).toISOString();
      const toUtc = new Date(start.getTime() + 8 * 86400e3).toISOString();
      const dayKeys = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400e3).toISOString().slice(0, 10));

      let heatRows: Array<{ ts: string; v: number }> = [];
      let daySums = new Map<string, number>();

      if (module === "energy") {
        const { ids } = await generalDeviceIds(siteId);
        if (ids.length === 0) return null;
        const [{ data: hr }, { data: dd }] = await Promise.all([
          supabase!.from("energy_hourly").select("ts_hour, metric, value_avg, value_sum")
            .in("device_id", ids.slice(0, 50)).gte("ts_hour", fromUtc).lte("ts_hour", toUtc)
            .in("metric", ["energy.power_kw", "energy.active_energy", "energy.active_import_kwh"]),
          supabase!.from("energy_daily").select("ts_day, value_sum")
            .in("device_id", ids.slice(0, 50)).gte("ts_day", mondayKey).lte("ts_day", endKey)
            .in("metric", ["energy.active_energy", "energy.active_import_kwh"]),
        ]);
        for (const r of (dd || []) as unknown as DayRow[]) {
          if (r.value_sum == null || Number(r.value_sum) > 50000) continue;
          daySums.set(r.ts_day, (daySums.get(r.ts_day) || 0) + Number(r.value_sum));
        }
        const agg = new Map<string, number>();
        for (const r of (hr || []) as unknown as HourRow[]) {
          const v = r.metric === "energy.power_kw" ? r.value_avg : r.value_sum;
          if (v == null) continue;
          agg.set(r.ts_hour, (agg.get(r.ts_hour) || 0) + Number(v));
        }
        heatRows = [...agg.entries()].map(([ts, v]) => ({ ts, v }));
      } else {
        const { data: hr } = await supabase!.from("telemetry_hourly")
          .select("ts_hour, metric, value_avg").eq("site_id", siteId)
          .gte("ts_hour", fromUtc).lte("ts_hour", toUtc).in("metric", (AIR_METRICS[airMetric] ?? AIR_METRICS.co2).ids);
        const agg = new Map<string, { s: number; n: number }>();
        for (const r of (hr || []) as unknown as HourRow[]) {
          if (r.value_avg == null) continue;
          const e = agg.get(r.ts_hour) || { s: 0, n: 0 };
          e.s += Number(r.value_avg); e.n++;
          agg.set(r.ts_hour, e);
        }
        heatRows = [...agg.entries()].map(([ts, e]) => ({ ts, v: e.s / e.n }));
        // per l'aria la "barra giorno" è la media giornaliera di CO₂
        const dAgg = new Map<string, { s: number; n: number }>();
        for (const { ts, v } of heatRows) {
          const k = dayKeyInTz(new Date(ts), tz);
          const e = dAgg.get(k) || { s: 0, n: 0 };
          e.s += v; e.n++;
          dAgg.set(k, e);
        }
        daySums = new Map([...dAgg.entries()].map(([k, e]) => [k, Math.round(e.s / e.n)]));
      }
      if (heatRows.length === 0 && daySums.size === 0) return null;

      const heat: Array<Array<number | null>> = Array.from({ length: 7 }, () => Array(24).fill(null));
      let heatMax = 0;
      for (const { ts, v } of heatRows) {
        const k = dayKeyInTz(new Date(ts), tz);
        const di = dayKeys.indexOf(k);
        if (di === -1) continue;
        const h = hourInTz(ts, tz);
        heat[di][h] = (heat[di][h] || 0) + v;
        if (heat[di][h]! > heatMax) heatMax = heat[di][h]!;
      }
      const labels = ["L", "M", "M", "G", "V", "S", "D"];
      const days: WeekDay[] = dayKeys.map((date, i) => ({ label: labels[i], date, v: daySums.has(date) ? Math.round(daySums.get(date)!) : null }));
      const weekdayVals = days.slice(0, 5).map(d => d.v).filter((v): v is number => v != null);
      const weekdayAvg = weekdayVals.length ? Math.round(weekdayVals.reduce((a, b) => a + b, 0) / weekdayVals.length) : undefined;
      const totalKwh = module === "energy" ? Math.round([...daySums.values()].reduce((a, b) => a + b, 0)) : undefined;
      const top = days.filter(d => d.v != null).sort((a, b) => (b.v! - a.v!))[0];
      return {
        days, weekdayAvg, heat, heatMax,
        totalKwh, topDay: top?.date,
        costEur: totalKwh && priceKwh ? Math.round(totalKwh * priceKwh) : undefined,
        unit: module === "energy" ? "kWh" : (AIR_METRICS[airMetric] ?? AIR_METRICS.co2).unit, isDemo: false,
      };
    },
    enabled: !!mondayKey,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMonthSeries(module: DashModule, siteId: string | undefined, monthKey: string /* YYYY-MM */, tz: string, isDemoSite: boolean, priceKwh?: number, airMetric: string = "co2") {
  return useQuery<MonthSeries | null>({
    queryKey: ["mdash-month", module, siteId, monthKey, airMetric],
    queryFn: async (): Promise<MonthSeries | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) return isDemoSite ? demoMonth(module, airMetric) : null;
      const [y, m] = monthKey.split("-").map(Number);
      const nDays = new Date(y, m, 0).getDate();
      const first = `${monthKey}-01`;
      const last = `${monthKey}-${String(nDays).padStart(2, "0")}`;
      const prevFirst = new Date(y, m - 2, 1).toISOString().slice(0, 10);
      const todayKey = dayKeyInTz(new Date(), tz);

      const vals = new Map<string, number>();
      let prevTotal = 0;
      if (module === "energy") {
        const { ids } = await generalDeviceIds(siteId);
        if (ids.length === 0) return null;
        const { data } = await supabase!.from("energy_daily")
          .select("ts_day, value_sum").in("device_id", ids.slice(0, 50))
          .gte("ts_day", prevFirst).lte("ts_day", last)
          .in("metric", ["energy.active_energy", "energy.active_import_kwh"]);
        for (const r of (data || []) as unknown as DayRow[]) {
          if (r.value_sum == null || Number(r.value_sum) > 50000) continue;
          if (r.ts_day >= first) vals.set(r.ts_day, (vals.get(r.ts_day) || 0) + Number(r.value_sum));
          else prevTotal += Number(r.value_sum);
        }
      } else {
        const { data } = await supabase!.from("telemetry_daily")
          .select("ts_day, metric, value_avg").eq("site_id", siteId)
          .gte("ts_day", first).lte("ts_day", last).in("metric", (AIR_METRICS[airMetric] ?? AIR_METRICS.co2).ids);
        const agg = new Map<string, { s: number; n: number }>();
        for (const r of (data || []) as unknown as DayRow[]) {
          if (r.value_avg == null) continue;
          const e = agg.get(r.ts_day) || { s: 0, n: 0 };
          e.s += Number(r.value_avg); e.n++;
          agg.set(r.ts_day, e);
        }
        for (const [k, e] of agg) vals.set(k, Math.round(e.s / e.n));
      }
      if (vals.size === 0) return null;

      const cells: MonthDayCell[] = Array.from({ length: nDays }, (_, i) => {
        const day = i + 1;
        const date = `${monthKey}-${String(day).padStart(2, "0")}`;
        return { day, date, v: vals.has(date) ? Math.round(vals.get(date)!) : null, future: date > todayKey, today: date === todayKey };
      });
      const present = cells.filter(c => c.v != null) as Array<MonthDayCell & { v: number }>;
      const maxV = Math.max(...present.map(c => c.v));
      const totalKwh = module === "energy" ? Math.round(present.reduce((a, c) => a + c.v, 0)) : undefined;
      const peakCell = present.sort((a, b) => b.v - a.v)[0];
      // vs mese precedente: confronto a pari giorni trascorsi
      let vsPrevPct: number | undefined;
      if (module === "energy" && totalKwh && prevTotal > 0) {
        vsPrevPct = Math.round(((totalKwh - prevTotal * (present.length / nDays)) / (prevTotal * (present.length / nDays))) * 100);
      }
      return {
        cells, maxV,
        totalKwh,
        costEur: totalKwh && priceKwh ? Math.round(totalKwh * priceKwh) : undefined,
        vsPrevPct,
        peak: peakCell ? { date: peakCell.date, v: peakCell.v } : undefined,
        unit: module === "energy" ? "kWh" : (AIR_METRICS[airMetric] ?? AIR_METRICS.co2).unit, isDemo: false,
      };
    },
    enabled: !!monthKey,
    staleTime: 10 * 60 * 1000,
  });
}
