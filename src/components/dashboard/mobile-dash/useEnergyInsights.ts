/**
 * Approfondimenti Energy (atlante §10.1): gli equivalenti mobile delle slide
 * 2–4 del PC come SCHEDE della stessa dashboard — Confronto (Actual vs
 * Average), Meteo (Energy Weather Analytics), Carbonio (Carbon Footprint +
 * 24-Hour Cycle), Periodi (Consumption by Periods).
 *
 * Regola d'oro (§8.3): se una scheda non ha dati per quel sito (es. meno di
 * 3 pari comparabili) NON compare. Demo deterministica per i siti vetrina.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface DayRow { ts_day: string; value_sum?: number | null }

const ENERGY_METRICS = ["energy.active_energy", "energy.active_import_kwh"];

async function generalIds(siteId: string): Promise<string[]> {
  const { data } = await supabase!.from("devices")
    .select("id, category, device_type").eq("site_id", siteId);
  const all = (data || []) as unknown as Array<{ id: string; category: string | null; device_type: string | null }>;
  const general = all.filter(d => d.category === "general").map(d => d.id);
  if (general.length > 0) return general;
  const ENERGY = new Set(["hvac", "lighting", "plugs"]);
  return all.filter(d => (d.category && ENERGY.has(d.category)) || d.device_type === "energy_monitor").map(d => d.id);
}

/** kWh per giorno del sito (contatori general) in un intervallo. */
async function dailyKwh(siteId: string, first: string, last: string): Promise<Map<string, number>> {
  const ids = await generalIds(siteId);
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const { data } = await supabase!.from("energy_daily")
    .select("ts_day, value_sum").in("device_id", ids.slice(0, 50))
    .gte("ts_day", first).lte("ts_day", last).in("metric", ENERGY_METRICS);
  for (const r of (data || []) as unknown as DayRow[]) {
    if (r.value_sum == null || Number(r.value_sum) > 50000) continue;
    out.set(r.ts_day, (out.get(r.ts_day) || 0) + Number(r.value_sum));
  }
  return out;
}

/* ── Confronto (EUI vs pari, §10.1) ───────────────────────────────── */
export interface EuiCompare {
  months: Array<{ m: number; site: number | null; peerAvg: number | null; peerMin: number | null; peerMax: number | null }>;
  targetMonthly?: number;       // target EUI annuo / 12
  peerCount: number;            // k-anonimato: la scheda esiste solo se ≥3
  typology?: string;
  climateZone?: string;
  /** mese corrente: % vs media pari */
  vsPeersPct?: number;
  siteNow?: number; peerNow?: number;
  isDemo: boolean;
}

function demoEui(anchorMonth: number): EuiCompare {
  const shape = [1.2, 1.12, 0.95, 0.85, 0.88, 1.0, 1.18, 1.15, 0.95, 0.9, 1.0, 1.1];
  const months = shape.map((k, i) => {
    const has = i <= anchorMonth;
    const peer = 9.1 * k;
    return {
      m: i + 1,
      site: has ? Math.round(peer * 1.075 * 10) / 10 : null,
      peerAvg: has ? Math.round(peer * 10) / 10 : null,
      peerMin: has ? Math.round(peer * 0.78 * 10) / 10 : null,
      peerMax: has ? Math.round(peer * 1.22 * 10) / 10 : null,
    };
  });
  const cur = months[anchorMonth];
  return {
    months, targetMonthly: 8.5, peerCount: 18, typology: "office", climateZone: "E",
    vsPeersPct: 7.5, siteNow: cur.site ?? undefined, peerNow: cur.peerAvg ?? undefined, isDemo: true,
  };
}

export function useEuiCompare(siteId: string | undefined, year: number, anchorMonth: number, isDemoSite: boolean) {
  return useQuery<EuiCompare | null>({
    queryKey: ["mdash-eui", siteId, year],
    queryFn: async (): Promise<EuiCompare | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) return isDemoSite ? demoEui(anchorMonth) : null;
      // area + contesto del sito
      const { data: site } = await supabase!.from("sites")
        .select("area_m2, typology, climate_zone").eq("id", siteId).maybeSingle();
      const area = Number((site as { area_m2?: number | null } | null)?.area_m2 ?? 0);
      if (!area || area <= 0) return null; // senza area l'EUI non esiste
      // kWh mensili del sito
      const daily = await dailyKwh(siteId, `${year}-01-01`, `${year}-12-31`);
      const siteMonthly = new Map<number, number>();
      for (const [day, v] of daily) {
        const m = Number(day.slice(5, 7));
        siteMonthly.set(m, (siteMonthly.get(m) || 0) + v);
      }
      // pari anonimi mensili (stessa RPC del PC, k-anonimato ≥3)
      const { data: peers, error } = await (supabase!.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>)(
        "get_peer_energy_density",
        { p_site_id: siteId, p_start: new Date(year, 0, 1).toISOString(), p_end: new Date(year, 11, 31).toISOString(), p_granularity: "month" },
      );
      if (error) return null;
      const peerBy = new Map<number, { avg: number; min: number; max: number; count: number }>();
      let peerCount = 0;
      for (const r of (peers || []) as Array<{ bucket: string; peer_avg: number; peer_min: number; peer_max: number; peer_count: number }>) {
        const m = new Date(r.bucket).getMonth() + 1;
        peerBy.set(m, { avg: Number(r.peer_avg), min: Number(r.peer_min), max: Number(r.peer_max), count: Number(r.peer_count) });
        peerCount = Math.max(peerCount, Number(r.peer_count));
      }
      if (peerCount < 3) return null; // la scheda non esiste (§10.1)
      // target EUI annuo, solo se salvato
      const { data: th } = await supabase!.from("site_thresholds")
        .select("energy_target_eui_kwh_m2").eq("site_id", siteId).maybeSingle();
      const target = Number((th as { energy_target_eui_kwh_m2?: number | null } | null)?.energy_target_eui_kwh_m2 ?? 0);
      const months = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const kwh = siteMonthly.get(m);
        const p = peerBy.get(m);
        return {
          m,
          site: kwh != null ? Math.round((kwh / area) * 10) / 10 : null,
          peerAvg: p ? Math.round(p.avg * 10) / 10 : null,
          peerMin: p ? Math.round(p.min * 10) / 10 : null,
          peerMax: p ? Math.round(p.max * 10) / 10 : null,
        };
      });
      const cur = months[anchorMonth];
      const vs = cur?.site != null && cur?.peerAvg ? Math.round(((cur.site - cur.peerAvg) / cur.peerAvg) * 1000) / 10 : undefined;
      return {
        months,
        targetMonthly: target > 0 ? Math.round((target / 12) * 10) / 10 : undefined,
        peerCount,
        typology: (site as { typology?: string | null } | null)?.typology ?? undefined,
        climateZone: (site as { climate_zone?: string | null } | null)?.climate_zone ?? undefined,
        vsPeersPct: vs, siteNow: cur?.site ?? undefined, peerNow: cur?.peerAvg ?? undefined,
        isDemo: false,
      };
    },
    enabled: !!year,
    staleTime: 10 * 60 * 1000,
  });
}

/* ── Meteo (consumo vs temperatura, §10.1) ─────────────────────────── */
/** Scala dei punti mostrati: ore del giorno · giorni · mesi dell'anno. */
export type WxScale = "hour" | "day" | "month";

export interface WeatherCorr {
  /** un punto per ora / giorno / mese, secondo la scala */
  points: Array<{ key: string; label: string; value: number; temp: number; hum?: number }>;
  scale: WxScale;
  r2?: number;                 // R² multivariato (CDD18 + umidità), come il PC
  kwhPerDegree?: number;       // kWh in più per °C sopra 18°
  /** finestra su cui è calcolata la regressione, se diversa dai punti mostrati */
  fitWindow?: string;
  valueUnit: string;           // kW alla scala oraria, kWh altrove
  isDemo: boolean;
}

const MONTH_TEMP = [6, 8, 12, 16, 21, 26, 29, 28, 23, 17, 11, 7];

function demoWeatherCorr(scale: WxScale, fromKey: string, toKey: string): WeatherCorr {
  if (scale === "hour") {
    const points = Array.from({ length: 24 }, (_, h) => ({
      key: String(h), label: String(h),
      value: Math.round((6 + 10 * Math.exp(-((h - 13) ** 2) / 28)) * 10) / 10,
      temp: Math.round((14 + 11 * Math.max(0, Math.sin(((h - 6) / 24) * Math.PI))) * 10) / 10,
      hum: 52 - h % 7,
    }));
    return { points, scale, r2: 0.38, kwhPerDegree: 14, fitWindow: "month", valueUnit: "kW", isDemo: true };
  }
  if (scale === "month") {
    const nowM = new Date().getMonth();
    const shape = [1.15, 1.1, 0.95, 0.85, 0.9, 1.05, 1.2, 1.18, 0.95, 0.9, 1.0, 1.12];
    const points = shape.slice(0, nowM + 1).map((k, i) => ({
      key: String(i + 1), label: String(i + 1),
      value: Math.round((i === nowM ? 3800 : 11600 * k)),
      temp: MONTH_TEMP[i], hum: 55 + (i % 5) * 3,
    }));
    return { points, scale, r2: 0.44, kwhPerDegree: 14, valueUnit: "kWh", isDemo: true };
  }
  const n = Math.min(62, Math.max(1, Math.round((new Date(`${toKey}T12:00:00`).getTime() - new Date(`${fromKey}T12:00:00`).getTime()) / 86400e3) + 1));
  const points = Array.from({ length: n }, (_, i) => {
    const d = new Date(`${fromKey}T12:00:00`); d.setDate(d.getDate() + i);
    const wd = d.getDay();
    const temp = 14 + 12 * Math.abs(Math.sin(i / 5)) + (i % 3);
    const value = wd === 0 || wd === 6 ? 110 : Math.round(330 + Math.max(0, temp - 18) * 14 + 18 * Math.sin(i * 1.3));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { key, label: String(d.getDate()), value, temp: Math.round(temp * 10) / 10, hum: 45 + (i % 20) };
  });
  return { points, scale, r2: 0.38, kwhPerDegree: 14, valueUnit: "kWh", isDemo: true };
}

/** media oraria del meteo in un intervallo, aggregata per giorno. */
async function wxByDay(siteId: string, first: string, last: string) {
  const { data } = await supabase!.from("weather_data")
    .select("timestamp, temperature_c, humidity_percent")
    .eq("site_id", siteId)
    .gte("timestamp", `${first}T00:00:00`).lte("timestamp", `${last}T23:59:59`)
    .limit(1000);
  const by = new Map<string, { t: number; h: number; n: number }>();
  for (const r of (data || []) as unknown as Array<{ timestamp: string; temperature_c: number | null; humidity_percent: number | null }>) {
    if (r.temperature_c == null) continue;
    const k = r.timestamp.slice(0, 10);
    const e = by.get(k) || { t: 0, h: 0, n: 0 };
    e.t += Number(r.temperature_c); e.h += Number(r.humidity_percent ?? 0); e.n++;
    by.set(k, e);
  }
  return by;
}

/** punti giornalieri (kWh + meteo) di un intervallo — base del modello. */
async function dailyWxPoints(siteId: string, first: string, last: string) {
  const [daily, wx] = await Promise.all([dailyKwh(siteId, first, last), wxByDay(siteId, first, last)]);
  const out: Array<{ key: string; label: string; value: number; temp: number; hum?: number }> = [];
  for (const [day, kwh] of [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const w = wx.get(day);
    if (!w || w.n === 0) continue;
    out.push({
      key: day, label: String(Number(day.slice(8, 10))),
      value: Math.round(kwh), temp: Math.round((w.t / w.n) * 10) / 10, hum: Math.round(w.h / w.n),
    });
  }
  return out;
}

/**
 * Correlazione consumo/meteo su QUALSIASI orizzonte (decisione owner 16/10:
 * la scheda non cambia più il periodo sotto le dita).
 * - hour  → le 24 ore del giorno (kW + °C orari); la regressione resta sui
 *           giorni del mese, perché 24 ore autocorrelate non fanno un modello:
 *           `fitWindow` lo dichiara a chi legge;
 * - day   → un punto per giorno dell'intervallo (settimana o mese);
 * - month → un punto per mese dell'anno, modello sui giorni (più robusto);
 *           il meteo si legge mese per mese per restare sotto il limite di
 *           righe di PostgREST (≈744 ore al mese) e non troncare le medie.
 */
export function useWeatherCorr(
  siteId: string | undefined,
  fromKey: string,
  toKey: string,
  scale: WxScale,
  isDemoSite: boolean,
  tz = "UTC",
) {
  return useQuery<WeatherCorr | null>({
    queryKey: ["mdash-wcorr", siteId, fromKey, toKey, scale],
    queryFn: async (): Promise<WeatherCorr | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) {
        return isDemoSite ? demoWeatherCorr(scale, fromKey, toKey) : null;
      }

      if (scale === "hour") {
        const ids = await generalIds(siteId);
        if (ids.length === 0) return null;
        const fromUtc = new Date(new Date(`${fromKey}T00:00:00`).getTime() - 26 * 3600e3).toISOString();
        const toUtc = new Date(new Date(`${fromKey}T00:00:00`).getTime() + 50 * 3600e3).toISOString();
        const [{ data: hr }, { data: wx }] = await Promise.all([
          supabase!.from("energy_hourly")
            .select("ts_hour, metric, value_avg, value_sum").in("device_id", ids.slice(0, 50))
            .gte("ts_hour", fromUtc).lte("ts_hour", toUtc)
            .in("metric", ["energy.power_kw", "energy.active_energy", "energy.active_import_kwh"]),
          supabase!.from("weather_data")
            .select("timestamp, temperature_c, humidity_percent").eq("site_id", siteId)
            .gte("timestamp", fromUtc).lte("timestamp", toUtc).limit(200),
        ]);
        const hourKey = (iso: string) => new Date(iso).toLocaleString("sv-SE", { timeZone: tz }).slice(0, 13);
        const byHour = new Map<string, number>();
        for (const r of (hr || []) as unknown as Array<{ ts_hour: string; metric: string; value_avg: number | null; value_sum: number | null }>) {
          const v = r.metric === "energy.power_kw" ? r.value_avg : (r.value_sum != null && Number(r.value_sum) <= 50000 ? r.value_sum : null);
          if (v == null) continue;
          const k = hourKey(r.ts_hour);
          if (!k.startsWith(fromKey)) continue;
          byHour.set(k, (byHour.get(k) || 0) + Number(v));
        }
        const wxHour = new Map<string, { t: number; h: number; n: number }>();
        for (const r of (wx || []) as unknown as Array<{ timestamp: string; temperature_c: number | null; humidity_percent: number | null }>) {
          if (r.temperature_c == null) continue;
          const k = hourKey(r.timestamp);
          if (!k.startsWith(fromKey)) continue;
          const e = wxHour.get(k) || { t: 0, h: 0, n: 0 };
          e.t += Number(r.temperature_c); e.h += Number(r.humidity_percent ?? 0); e.n++;
          wxHour.set(k, e);
        }
        const points = [...byHour.entries()]
          .filter(([k]) => wxHour.has(k))
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([k, v]) => {
            const w = wxHour.get(k)!;
            const h = Number(k.slice(11, 13));
            return { key: k, label: String(h), value: Math.round(v * 10) / 10, temp: Math.round((w.t / w.n) * 10) / 10, hum: Math.round(w.h / w.n) };
          });
        if (points.length < 6) return null;
        // modello sui giorni del mese che contiene la giornata
        const monthKey = fromKey.slice(0, 7);
        const nDays = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate();
        const fit = await dailyWxPoints(siteId, `${monthKey}-01`, `${monthKey}-${String(nDays).padStart(2, "0")}`);
        const { r2, slope } = fit.length >= 5 ? fitCddModel(fit) : { r2: undefined, slope: undefined };
        return { points, scale, r2, kwhPerDegree: slope, fitWindow: "month", valueUnit: "kW", isDemo: false };
      }

      if (scale === "month") {
        const year = Number(fromKey.slice(0, 4));
        const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
        const perMonth = await Promise.all(months.map(mk => {
          const nd = new Date(year, Number(mk.slice(5, 7)), 0).getDate();
          return dailyWxPoints(siteId, `${mk}-01`, `${mk}-${String(nd).padStart(2, "0")}`);
        }));
        const all = perMonth.flat();
        if (all.length < 10) return null;
        const points = perMonth
          .map((days, i) => {
            if (days.length === 0) return null;
            return {
              key: `${year}-${String(i + 1).padStart(2, "0")}`,
              label: String(i + 1),
              value: Math.round(days.reduce((a, p) => a + p.value, 0)),
              temp: Math.round((days.reduce((a, p) => a + p.temp, 0) / days.length) * 10) / 10,
              hum: Math.round(days.reduce((a, p) => a + (p.hum ?? 0), 0) / days.length),
            };
          })
          .filter((x): x is NonNullable<typeof x> => x != null);
        if (points.length < 3) return null;
        const { r2, slope } = fitCddModel(all);
        return { points, scale, r2, kwhPerDegree: slope, fitWindow: "year", valueUnit: "kWh", isDemo: false };
      }

      const points = await dailyWxPoints(siteId, fromKey, toKey);
      if (points.length < 5) return null;
      const { r2, slope } = fitCddModel(points);
      return { points, scale, r2, kwhPerDegree: slope, valueUnit: "kWh", isDemo: false };
    },
    enabled: !!fromKey && !!toKey,
    staleTime: 10 * 60 * 1000,
  });
}

/** OLS multivariato valore ~ CDD18 + umidità (stesso spirito del PC: client-side). */
export function fitCddModel(points: Array<{ value: number; temp: number; hum?: number }>): { r2?: number; slope?: number } {
  const n = points.length;
  if (n < 5) return {};
  const X = points.map(p => [1, Math.max(0, p.temp - 18), p.hum ?? 0]);
  const Y = points.map(p => p.value);
  // normal equations 3×3: (XᵀX)β = XᵀY
  const XtX = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const XtY = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) {
    XtY[a] += X[i][a] * Y[i];
    for (let b = 0; b < 3; b++) XtX[a][b] += X[i][a] * X[i][b];
  }
  const beta = solve3(XtX, XtY);
  if (!beta) return {};
  const mean = Y.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = beta[0] + beta[1] * X[i][1] + beta[2] * X[i][2];
    ssTot += (Y[i] - mean) ** 2;
    ssRes += (Y[i] - pred) ** 2;
  }
  const r2 = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : undefined;
  return { r2: r2 != null ? Math.round(r2 * 100) / 100 : undefined, slope: Math.round(beta[1]) };
}

function solve3(A: number[][], b: number[]): number[] | null {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-9) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c < 4; c++) M[r][c] -= f * M[col][c];
    }
  }
  return [M[0][3] / M[0][0], M[1][3] / M[1][1], M[2][3] / M[2][2]];
}

/* ── Periodi (vista Anno, §10.1): mesi con MWh, costo, picco, vs anno prima ── */
export interface PeriodsYear {
  months: Array<{ m: number; kwh: number | null; cost?: number; peakDay?: { date: string; kwh: number }; vsPrevYearPct?: number; current?: boolean }>;
  totalKwh: number;
  totalCost?: number;
  vsPrevYearPct?: number;
  avgPrice?: number;
  isDemo: boolean;
}

function demoPeriods(): PeriodsYear {
  const vals = [11900, 10800, 10100, 8900, 9200, 10600, 12000, 11000, 10000, 3800, null, null];
  const nowM = new Date().getMonth();
  const months = vals.map((v, i) => ({
    m: i + 1,
    kwh: i <= nowM ? v : null,
    cost: v != null && i <= nowM ? Math.round(v * 0.19) : undefined,
    peakDay: v != null && i <= nowM ? { date: `2026-${String(i + 1).padStart(2, "0")}-17`, kwh: Math.round((v / 30) * 1.35) } : undefined,
    vsPrevYearPct: v != null && i <= nowM ? -4 : undefined,
    current: i === nowM,
  }));
  const totalKwh = months.reduce((a, x) => a + (x.kwh ?? 0), 0);
  return { months, totalKwh, totalCost: Math.round(totalKwh * 0.19), vsPrevYearPct: -3, avgPrice: 0.19, isDemo: true };
}

export function usePeriodsYear(siteId: string | undefined, year: number, isDemoSite: boolean, priceKwh?: number) {
  return useQuery<PeriodsYear | null>({
    queryKey: ["mdash-periods", siteId, year],
    queryFn: async (): Promise<PeriodsYear | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) return isDemoSite ? demoPeriods() : null;
      const [cur, prev] = await Promise.all([
        dailyKwh(siteId, `${year}-01-01`, `${year}-12-31`),
        dailyKwh(siteId, `${year - 1}-01-01`, `${year - 1}-12-31`),
      ]);
      if (cur.size === 0) return null;
      // prezzo STORICIZZATO per data (stessa fonte del PC, slide Periods):
      // il costo di ogni mese usa la tariffa in vigore giorno per giorno
      let priceAt: (day: string) => number | undefined = () => priceKwh;
      try {
        const { data: ph } = await supabase!.from("site_energy_price_history")
          .select("price_eur_per_kwh, effective_from").eq("site_id", siteId)
          .order("effective_from", { ascending: true });
        const hist = (ph || []) as unknown as Array<{ price_eur_per_kwh: number; effective_from: string }>;
        if (hist.length > 0) {
          priceAt = (day: string) => {
            let chosen = Number(hist[0].price_eur_per_kwh);
            for (const row of hist) {
              if (row.effective_from.slice(0, 10) <= day) chosen = Number(row.price_eur_per_kwh);
              else break;
            }
            return chosen;
          };
        }
      } catch { /* senza storico resta la tariffa corrente */ }
      const costBy = new Map<number, number>();
      let hasPrice = false;
      for (const [day, v] of cur) {
        const p = priceAt(day);
        if (p == null || p <= 0) continue;
        hasPrice = true;
        const m = Number(day.slice(5, 7));
        costBy.set(m, (costBy.get(m) || 0) + v * p);
      }
      const nowKey = new Date().toISOString().slice(0, 7);
      const agg = (map: Map<string, number>) => {
        const by = new Map<number, { sum: number; days: number; peak?: { date: string; kwh: number } }>();
        for (const [day, v] of map) {
          const m = Number(day.slice(5, 7));
          const e = by.get(m) || { sum: 0, days: 0 };
          e.sum += v; e.days++;
          if (!e.peak || v > e.peak.kwh) e.peak = { date: day, kwh: Math.round(v) };
          by.set(m, e);
        }
        return by;
      };
      const curBy = agg(cur), prevBy = agg(prev);
      const months = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const e = curBy.get(m);
        const p = prevBy.get(m);
        const monthKey = `${year}-${String(m).padStart(2, "0")}`;
        // vs anno prima a parità di giorni trascorsi (per il mese in corso)
        let vsPrev: number | undefined;
        if (e && p && p.sum > 0) {
          const scale = monthKey === nowKey ? e.days / Math.max(1, p.days) : 1;
          vsPrev = Math.round(((e.sum - p.sum * scale) / (p.sum * scale)) * 100);
        }
        return {
          m,
          kwh: e ? Math.round(e.sum) : null,
          cost: e && hasPrice && costBy.has(m) ? Math.round(costBy.get(m)!) : undefined,
          peakDay: e?.peak,
          vsPrevYearPct: vsPrev,
          current: monthKey === nowKey,
        };
      });
      const totalKwh = months.reduce((a, x) => a + (x.kwh ?? 0), 0);
      const totalCost = hasPrice ? Math.round([...costBy.values()].reduce((a, v) => a + v, 0)) : undefined;
      const prevTotal = [...prevBy.values()].reduce((a, e) => a + e.sum, 0);
      return {
        months,
        totalKwh,
        totalCost,
        vsPrevYearPct: prevTotal > 0 ? Math.round(((totalKwh - prevTotal) / prevTotal) * 100) : undefined,
        // media effettiva dell'anno, non la tariffa di oggi
        avgPrice: totalCost != null && totalKwh > 0 ? Math.round((totalCost / totalKwh) * 10000) / 10000 : priceKwh,
        isDemo: false,
      };
    },
    enabled: !!year,
    staleTime: 10 * 60 * 1000,
  });
}

/* ── Bollette (§10.6, decisione owner 15/10: entra nell'app) ──────────
   Le tabelle bills/bill_data sono il solo modulo PC senza mock. Qui si
   caricano le SINGOLE bollette dell'anno con tutti i campi delle card
   PC (periodo, consumo e fasce, potenza/PF, costi/oneri, dati extra) e
   il MISURATO nel periodo esatto di ciascuna (Σ energy_daily fra le
   date della bolletta), più l'aggregato mensile per il grafico. ── */
export interface BillItem {
  id: string;
  status: string;             // pending | analyzing | completed | error
  company: string;
  fileName: string;
  filePath: string;
  uploadedAt: string;         // created_at
  periodStart?: string;
  periodEnd?: string;
  kwh?: number;               // energy_consumption_kwh
  peakKwh?: number;           // fascia punta
  offPeakKwh?: number;        // fascia fuori punta
  reactiveKvarh?: number;
  powerFactor?: number;
  peakKw?: number;
  costPerKwh?: number;
  energyCost?: number;        // total_energy_cost
  fixedCharges?: number;
  taxes?: number;
  totalAmount?: number;
  currency?: string;
  additional?: Record<string, unknown>;
  /** Σ energy_daily del sito fra periodStart e periodEnd */
  measuredKwh?: number;
  /** (fatturato − misurato) / misurato × 100 */
  devPct?: number;
}

export interface BillsYear {
  /** kWh fatturati per mese (indice 0 = gennaio; null = nessuna bolletta) */
  months: Array<{ m: number; billed: number | null }>;
  /** bollette dell'anno: analizzate per periodo, le altre per data di caricamento */
  items: BillItem[];
  count: number;              // bollette ANALIZZATE con periodo nell'anno
  pendingCount: number;       // caricate ma non ancora analizzate (tutto il sito)
  totalBilledKwh: number;
  avgCostKwh?: number;        // Σ costo energia / Σ kWh (pesata), fallback media
  totalSpent?: number;        // Σ total_amount (energia + oneri + tasse)
  maxPeakKw?: number;         // massima potenza di picco letta dalle bollette
  currency?: string;          // valuta prevalente delle bollette (fonte)
  isDemo: boolean;
}

interface BillRow { id: string; status: string; company_name: string; file_name: string; file_path: string; created_at: string }
interface BillDataRow {
  bill_id: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
  energy_consumption_kwh: number | null;
  energy_cost_per_kwh: number | null;
  total_energy_cost: number | null;
  peak_consumption_kwh: number | null;
  off_peak_consumption_kwh: number | null;
  reactive_energy_kvarh: number | null;
  power_factor: number | null;
  fixed_charges: number | null;
  taxes: number | null;
  total_amount: number | null;
  peak_power_kw: number | null;
  currency: string | null;
  additional_data: Record<string, unknown> | null;
}

function demoBills(year: number): BillsYear {
  // coerente con demoYear energy: misurato = 11600 × shape, bollette
  // gen–set con scarto deterministico ±1% (media ≈ 0,8%)
  const shape = [1.15, 1.1, 0.95, 0.85, 0.9, 1.05, 1.2, 1.18, 0.95, 0.9, 1.0, 1.12];
  const dev = [0.006, -0.009, 0.012, 0.004, -0.007, 0.01, 0.008, -0.005, 0.011];
  const nowM = new Date().getMonth();
  const nBills = Math.min(9, nowM); // il mese in corso non è ancora fatturato
  const cur = year === new Date().getFullYear();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const items: BillItem[] = [];
  for (let i = nBills - 1; i >= 0; i--) {
    const measured = Math.round(11600 * shape[i]);
    const kwh = Math.round(measured * (1 + dev[i % dev.length]));
    const energyCost = Math.round(kwh * 0.1872);
    const fixed = 192, taxes = Math.round(energyCost * 0.072);
    const lastDay = new Date(year, i + 1, 0).getDate();
    items.push({
      id: `demo-bill-${i}`,
      status: "completed",
      company: "Enel Energia",
      fileName: `bolletta_${year}-${pad2(i + 1)}.pdf`,
      filePath: "",
      uploadedAt: `${year}-${pad2(i + 1 === 12 ? 12 : i + 2)}-05`,
      periodStart: `${year}-${pad2(i + 1)}-01`,
      periodEnd: `${year}-${pad2(i + 1)}-${pad2(lastDay)}`,
      kwh,
      peakKwh: Math.round(kwh * 0.58),
      offPeakKwh: kwh - Math.round(kwh * 0.58),
      reactiveKvarh: Math.round(kwh * 0.109),
      powerFactor: 0.97,
      peakKw: Math.round((20.4 + shape[i] * 2.4) * 10) / 10,
      costPerKwh: 0.1872,
      energyCost,
      fixedCharges: fixed,
      taxes,
      totalAmount: energyCost + fixed + taxes,
      currency: "EUR",
      additional: { pod: "IT001E93482710", contract_type: "Altri usi — trifase" },
      measuredKwh: measured,
      devPct: Math.round(((kwh - measured) / measured) * 1000) / 10,
    });
  }
  // il mese in corso: bolletta caricata oggi, ancora in analisi (vetrina §10.6)
  if (cur && nBills > 0) {
    items.unshift({
      id: "demo-bill-analyzing",
      status: "analyzing",
      company: "Enel Energia",
      fileName: `bolletta_${year}-${pad2(nBills + 1)}.jpg`,
      filePath: "",
      uploadedAt: new Date().toISOString().slice(0, 10),
    });
  }
  const months = shape.map((k, i) => ({
    m: i + 1,
    billed: cur && i < nBills ? Math.round(11600 * k * (1 + dev[i % dev.length])) : null,
  }));
  const total = months.reduce((a, x) => a + (x.billed ?? 0), 0);
  const spent = items.reduce((a, b) => a + (b.totalAmount ?? 0), 0);
  return {
    months,
    items: cur ? items : [],
    count: months.filter(x => x.billed != null).length,
    pendingCount: cur && nBills > 0 ? 1 : 0,
    totalBilledKwh: total,
    avgCostKwh: total > 0 ? 0.1872 : undefined,
    totalSpent: spent > 0 ? spent : undefined,
    maxPeakKw: total > 0 ? Math.max(...items.map(b => b.peakKw ?? 0)) : undefined,
    currency: "EUR",
    isDemo: true,
  };
}

export function useBillsYear(siteId: string | undefined, year: number, isDemoSite: boolean) {
  return useQuery<BillsYear | null>({
    queryKey: ["mdash-bills", siteId, year],
    queryFn: async (): Promise<BillsYear | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) {
        return isDemoSite ? demoBills(year) : null;
      }
      const { data: billRows } = await supabase!.from("bills")
        .select("id, status, company_name, file_name, file_path, created_at")
        .eq("site_id", siteId).order("created_at", { ascending: false });
      const bills = (billRows || []) as unknown as BillRow[];
      const pendingCount = bills.filter(b => b.status === "pending" || b.status === "analyzing").length;
      const completedIds = bills.filter(b => b.status === "completed").map(b => b.id);
      // le non analizzate non hanno periodo: compaiono nell'anno del caricamento
      const looseItems: BillItem[] = bills
        .filter(b => b.status !== "completed" && b.created_at.startsWith(String(year)))
        .map(b => ({
          id: b.id, status: b.status, company: b.company_name,
          fileName: b.file_name, filePath: b.file_path, uploadedAt: b.created_at,
        }));
      const empty: BillsYear = {
        months: Array.from({ length: 12 }, (_, i) => ({ m: i + 1, billed: null })),
        items: looseItems, count: 0, pendingCount, totalBilledKwh: 0, isDemo: false,
      };
      if (completedIds.length === 0) return empty;
      const { data: bdRows } = await supabase!.from("bill_data")
        .select("bill_id, billing_period_start, billing_period_end, energy_consumption_kwh, energy_cost_per_kwh, total_energy_cost, peak_consumption_kwh, off_peak_consumption_kwh, reactive_energy_kvarh, power_factor, fixed_charges, taxes, total_amount, peak_power_kw, currency, additional_data")
        .in("bill_id", completedIds.slice(0, 200));
      // una bolletta appartiene all'anno (e al mese) del suo periodo di
      // fatturazione — come la vista mensile del modulo desktop
      const inYear = ((bdRows || []) as unknown as BillDataRow[]).filter(r => {
        const dte = r.billing_period_start || r.billing_period_end;
        return dte != null && dte.startsWith(String(year));
      });
      if (inYear.length === 0) return empty;
      // misurato per bolletta: UNA query energy_daily sull'arco min–max dei
      // periodi, poi la somma per intervallo di ciascuna
      const starts = inYear.map(r => r.billing_period_start).filter(Boolean) as string[];
      const ends = inYear.map(r => r.billing_period_end).filter(Boolean) as string[];
      let measuredByDay = new Map<string, number>();
      if (starts.length > 0 && ends.length > 0) {
        try {
          measuredByDay = await dailyKwh(siteId, starts.sort()[0], ends.sort().at(-1)!);
        } catch { /* senza contatori il confronto semplicemente non compare */ }
      }
      const sumRange = (a?: string | null, b?: string | null): number | undefined => {
        if (!a || !b || measuredByDay.size === 0) return undefined;
        let s = 0, n = 0;
        for (const [day, v] of measuredByDay) if (day >= a && day <= b) { s += v; n++; }
        return n > 0 ? Math.round(s) : undefined;
      };
      const billById = new Map(bills.map(b => [b.id, b]));
      const num = (v: number | null) => (v != null ? Number(v) : undefined);
      const items: BillItem[] = inYear.map(r => {
        const b = billById.get(r.bill_id);
        const kwh = num(r.energy_consumption_kwh);
        const measured = sumRange(r.billing_period_start, r.billing_period_end);
        return {
          id: r.bill_id,
          status: "completed",
          company: b?.company_name ?? "—",
          fileName: b?.file_name ?? "—",
          filePath: b?.file_path ?? "",
          uploadedAt: b?.created_at ?? "",
          periodStart: r.billing_period_start ?? undefined,
          periodEnd: r.billing_period_end ?? undefined,
          kwh,
          peakKwh: num(r.peak_consumption_kwh),
          offPeakKwh: num(r.off_peak_consumption_kwh),
          reactiveKvarh: num(r.reactive_energy_kvarh),
          powerFactor: num(r.power_factor),
          peakKw: num(r.peak_power_kw),
          costPerKwh: num(r.energy_cost_per_kwh),
          energyCost: num(r.total_energy_cost),
          fixedCharges: num(r.fixed_charges),
          taxes: num(r.taxes),
          totalAmount: num(r.total_amount),
          currency: r.currency ?? undefined,
          additional: r.additional_data ?? undefined,
          measuredKwh: measured,
          devPct: kwh != null && measured != null && measured > 0
            ? Math.round(((kwh - measured) / measured) * 1000) / 10 : undefined,
        };
      }).sort((a, b) => (b.periodStart ?? "").localeCompare(a.periodStart ?? ""));
      const byMonth = new Map<number, number>();
      let spent = 0, energySum = 0, energyKwh = 0, costSum = 0, costN = 0, maxPeak = 0;
      for (const it of items) {
        const dte = it.periodStart || it.periodEnd;
        if (dte && it.kwh != null) {
          const m = Number(dte.slice(5, 7));
          byMonth.set(m, (byMonth.get(m) || 0) + it.kwh);
        }
        if (it.totalAmount != null) spent += it.totalAmount;
        if (it.energyCost != null && it.kwh != null) { energySum += it.energyCost; energyKwh += it.kwh; }
        if (it.costPerKwh != null) { costSum += it.costPerKwh; costN++; }
        if (it.peakKw != null) maxPeak = Math.max(maxPeak, it.peakKw);
      }
      const months = Array.from({ length: 12 }, (_, i) => ({
        m: i + 1,
        billed: byMonth.has(i + 1) ? Math.round(byMonth.get(i + 1)!) : null,
      }));
      const total = months.reduce((a, x) => a + (x.billed ?? 0), 0);
      // €/kWh medio: pesato sul costo ENERGIA (come la bolletta lo intende),
      // fallback media semplice dei costi unitari dichiarati
      const avgCost = energyKwh > 0 ? energySum / energyKwh : costN > 0 ? costSum / costN : undefined;
      // valuta prevalente fra le bollette (fonte per la conversione)
      const curCount = new Map<string, number>();
      for (const it of items) if (it.currency) curCount.set(it.currency, (curCount.get(it.currency) || 0) + 1);
      const currency = [...curCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return {
        months,
        items: [...looseItems, ...items],
        count: items.length,
        pendingCount,
        totalBilledKwh: total,
        avgCostKwh: avgCost != null ? Math.round(avgCost * 10000) / 10000 : undefined,
        totalSpent: spent > 0 ? Math.round(spent) : undefined,
        maxPeakKw: maxPeak > 0 ? Math.round(maxPeak * 10) / 10 : undefined,
        currency,
        isDemo: false,
      };
    },
    enabled: !!year,
    staleTime: 5 * 60 * 1000,
    // con una bolletta in analisi la lista si aggiorna da sola ogni 30 s
    // (l'equivalente del bottone «Aggiorna» del PC, senza bottone)
    refetchInterval: query => (((query.state.data as BillsYear | null)?.pendingCount ?? 0) > 0 ? 30_000 : false),
  });
}

/* ── Ripartizione per categoria (parità E1 = donut «Breakdown» del PC) ──
   Quote % del periodo per HVAC / Luci / Prese / Altro, dai contatori di
   categoria quando esistono; col solo contatore generale la quota è il
   VIRTUAL SPLIT del PC (energy_benchmarks per tipologia/zona climatica,
   default 40/25/20/15), sempre dichiarato come simulazione. In più
   l'area del sito per il KPI kWh/m² — MAI il fallback 850 m² del PC. ── */
export interface EnergySplit {
  /** quote del periodo, Σ≈100; "other" = generale − categorie misurate */
  shares: Array<{ cat: "hvac" | "lighting" | "plugs" | "other"; pct: number }>;
  simulated: boolean;
  areaM2?: number;
  isDemo: boolean;
}

const DEFAULT_SPLIT = { hvac: 40, lighting: 25, plugs: 20, other: 15 } as const;

export function useEnergySplit(siteId: string | undefined, fromKey: string, toKey: string, isDemoSite: boolean) {
  return useQuery<EnergySplit | null>({
    queryKey: ["mdash-esplit", siteId, fromKey, toKey],
    queryFn: async (): Promise<EnergySplit | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) {
        // demo: le stesse proporzioni delle schede categoria (DEMO_CAT_FACTOR)
        return isDemoSite ? {
          shares: [
            { cat: "hvac", pct: 45 }, { cat: "lighting", pct: 30 },
            { cat: "plugs", pct: 18 }, { cat: "other", pct: 7 },
          ],
          simulated: false, areaM2: 420, isDemo: true,
        } : null;
      }
      const [{ data: devs }, { data: site }] = await Promise.all([
        supabase!.from("devices").select("id, category, device_type").eq("site_id", siteId),
        supabase!.from("sites").select("area_m2, typology, climate_zone, region").eq("id", siteId).maybeSingle(),
      ]);
      const all = (devs || []) as unknown as Array<{ id: string; category: string | null; device_type: string | null }>;
      const siteRow = site as unknown as { area_m2: number | null; typology: string | null; climate_zone: string | null; region: string | null } | null;
      const areaM2 = siteRow?.area_m2 != null && Number(siteRow.area_m2) > 0 ? Number(siteRow.area_m2) : undefined;
      const byCat = (c: string) => all.filter(d => d.category === c).map(d => d.id);
      const cats = { hvac: byCat("hvac"), lighting: byCat("lighting"), plugs: byCat("plugs") };
      const general = byCat("general");
      const catIds = [...cats.hvac, ...cats.lighting, ...cats.plugs];
      const ids = [...new Set([...catIds, ...general])].slice(0, 50);
      if (ids.length === 0) return areaM2 != null ? { shares: [], simulated: false, areaM2, isDemo: false } : null;
      const { data: rows } = await supabase!.from("energy_daily")
        .select("device_id, value_sum").in("device_id", ids)
        .gte("ts_day", fromKey).lte("ts_day", toKey).in("metric", ENERGY_METRICS);
      const sumOf = (set: string[]) => {
        const s = new Set(set);
        let tot = 0;
        for (const r of (rows || []) as unknown as Array<{ device_id: string; value_sum: number | null }>) {
          if (r.value_sum == null || Number(r.value_sum) > 50000 || !s.has(r.device_id)) continue;
          tot += Number(r.value_sum);
        }
        return tot;
      };
      const hv = sumOf(cats.hvac), li = sumOf(cats.lighting), pl = sumOf(cats.plugs);
      const measured = hv + li + pl;
      if (measured > 0) {
        // contatori di categoria veri: quota misurata; «Altro» = resto del generale
        const gen = general.length > 0 ? sumOf(general) : 0;
        const total = gen > measured ? gen : measured;
        const other = Math.max(0, total - measured);
        const pct = (v: number) => Math.round((v / total) * 100);
        const shares = [
          { cat: "hvac" as const, pct: pct(hv) }, { cat: "lighting" as const, pct: pct(li) },
          { cat: "plugs" as const, pct: pct(pl) },
          ...(other / total > 0.005 ? [{ cat: "other" as const, pct: pct(other) }] : []),
        ].filter(s => s.pct > 0);
        return shares.length > 0 ? { shares, simulated: false, areaM2, isDemo: false } : null;
      }
      // solo contatore generale: Virtual Split dichiarato come sul PC
      const gen = sumOf(general);
      if (gen <= 0) return areaM2 != null ? { shares: [], simulated: false, areaM2, isDemo: false } : null;
      let split = { ...DEFAULT_SPLIT } as Record<keyof typeof DEFAULT_SPLIT, number>;
      if (siteRow?.typology && siteRow?.climate_zone) {
        try {
          let q = supabase!.from("energy_benchmarks")
            .select("hvac_pct, lighting_pct, plugs_pct, other_pct")
            .eq("typology", siteRow.typology).eq("climate_zone", siteRow.climate_zone);
          if (siteRow.region) q = q.eq("region", siteRow.region);
          const { data: bm } = await q.limit(500);
          const list = (bm || []) as unknown as Array<{ hvac_pct: number; lighting_pct: number; plugs_pct: number; other_pct: number }>;
          if (list.length > 0) {
            const avg = (k: keyof typeof list[0]) => list.reduce((a, r) => a + Number(r[k]), 0) / list.length;
            split = { hvac: avg("hvac_pct"), lighting: avg("lighting_pct"), plugs: avg("plugs_pct"), other: avg("other_pct") };
          }
        } catch { /* resta il default 40/25/20/15 */ }
      }
      return {
        shares: (["hvac", "lighting", "plugs", "other"] as const)
          .map(cat => ({ cat, pct: Math.round(split[cat]) }))
          .filter(s => s.pct > 0),
        simulated: true, areaM2, isDemo: false,
      };
    },
    enabled: !!siteId || isDemoSite,
    staleTime: 10 * 60 * 1000,
  });
}
