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
export interface WeatherCorr {
  /** un punto per giorno del mese */
  points: Array<{ day: string; kwh: number; temp: number; hum?: number }>;
  r2?: number;                 // R² multivariato (CDD18 + umidità), come il PC
  kwhPerDegree?: number;       // kWh in più per °C sopra 18°
  isDemo: boolean;
}

function demoWeatherCorr(): WeatherCorr {
  const points = Array.from({ length: 31 }, (_, i) => {
    const temp = 14 + 12 * Math.abs(Math.sin(i / 5)) + (i % 3);
    const kwh = 330 + Math.max(0, temp - 18) * 14 + 18 * Math.sin(i * 1.3);
    return { day: `demo-${i + 1}`, kwh: Math.round(kwh), temp: Math.round(temp * 10) / 10, hum: 45 + (i % 20) };
  });
  return { points, r2: 0.38, kwhPerDegree: 14, isDemo: true };
}

export function useWeatherCorr(siteId: string | undefined, monthKey: string, isDemoSite: boolean) {
  return useQuery<WeatherCorr | null>({
    queryKey: ["mdash-wcorr", siteId, monthKey],
    queryFn: async (): Promise<WeatherCorr | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) return isDemoSite ? demoWeatherCorr() : null;
      const [y, m] = monthKey.split("-").map(Number);
      const nDays = new Date(y, m, 0).getDate();
      const first = `${monthKey}-01`, last = `${monthKey}-${String(nDays).padStart(2, "0")}`;
      const daily = await dailyKwh(siteId, first, last);
      if (daily.size < 7) return null; // troppo pochi giorni per una tendenza
      const { data: wx } = await supabase!.from("weather_data")
        .select("timestamp, temperature_c, humidity_percent")
        .eq("site_id", siteId)
        .gte("timestamp", `${first}T00:00:00`).lte("timestamp", `${last}T23:59:59`);
      const byDay = new Map<string, { t: number; h: number; n: number }>();
      for (const r of (wx || []) as unknown as Array<{ timestamp: string; temperature_c: number | null; humidity_percent: number | null }>) {
        if (r.temperature_c == null) continue;
        const k = r.timestamp.slice(0, 10);
        const e = byDay.get(k) || { t: 0, h: 0, n: 0 };
        e.t += Number(r.temperature_c); e.h += Number(r.humidity_percent ?? 0); e.n++;
        byDay.set(k, e);
      }
      const points: WeatherCorr["points"] = [];
      for (const [day, kwh] of daily) {
        const w = byDay.get(day);
        if (!w || w.n === 0) continue;
        points.push({ day, kwh: Math.round(kwh), temp: Math.round((w.t / w.n) * 10) / 10, hum: Math.round(w.h / w.n) });
      }
      if (points.length < 7) return null;
      const { r2, slope } = fitCddModel(points);
      return { points, r2, kwhPerDegree: slope, isDemo: false };
    },
    enabled: !!monthKey,
    staleTime: 10 * 60 * 1000,
  });
}

/** OLS multivariato kwh ~ CDD18 + umidità (stesso spirito del PC: client-side). */
export function fitCddModel(points: Array<{ kwh: number; temp: number; hum?: number }>): { r2?: number; slope?: number } {
  const n = points.length;
  if (n < 5) return {};
  const X = points.map(p => [1, Math.max(0, p.temp - 18), p.hum ?? 0]);
  const Y = points.map(p => p.kwh);
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
          cost: e && priceKwh ? Math.round(e.sum * priceKwh) : undefined,
          peakDay: e?.peak,
          vsPrevYearPct: vsPrev,
          current: monthKey === nowKey,
        };
      });
      const totalKwh = months.reduce((a, x) => a + (x.kwh ?? 0), 0);
      const prevTotal = [...prevBy.values()].reduce((a, e) => a + e.sum, 0);
      return {
        months,
        totalKwh,
        totalCost: priceKwh ? Math.round(totalKwh * priceKwh) : undefined,
        vsPrevYearPct: prevTotal > 0 ? Math.round(((totalKwh - prevTotal) / prevTotal) * 100) : undefined,
        avgPrice: priceKwh,
        isDemo: false,
      };
    },
    enabled: !!year,
    staleTime: 10 * 60 * 1000,
  });
}
