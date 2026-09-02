/**
 * Trend di PORTAFOGLIO per i card deck di dominio (spec v2 Step 5).
 *
 * Energia: energy_daily del perimetro (24 mesi) con la stessa precedenza
 * dei contatori usata ovunque — se il sito ha contatori 'general' contano
 * solo quelli, altrimenti la somma dei sottocarichi. Produce il trend a 12
 * mesi e il confronto anno-su-anno; la temperatura media mensile arriva
 * dalla RPC get_portfolio_weather_monthly (solo aggregati).
 *
 * Aria: telemetry_daily (iaq.co2, 12 mesi) per il trend; telemetry_hourly
 * (30 giorni) per composizione delle ore e heatmap ora x giorno.
 *
 * Tutto reale: serie vuote dove non ci sono dati, mai numeri inventati.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { CO2_THRESHOLDS, computeAirIndex } from '@/lib/airQuality';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthKey = (d: string) => d.slice(0, 7); // 'YYYY-MM'

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const PAGE = 10000;
  const out: T[] = [];
  for (let from = 0; from < 300000; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

export interface EnergyTrends {
  monthly12: { month: string; label: string; kwh: number; temp: number | null }[];
  yoy: { label: string; [year: string]: number | string | null }[];
  years: string[];
  /** kWh mensili PER SITO, allineati ai 12 mesi di monthly12 (null = nessun
      dato quel mese): alimentano il benchmarking multi-store del trend. */
  perSite: Record<string, (number | null)[]>;
}

export function usePortfolioEnergyTrend(siteIds: string[], enabled: boolean) {
  const key = [...siteIds].sort().join(',');
  return useQuery<EnergyTrends | null>({
    queryKey: ['portfolio-energy-trend', key],
    queryFn: async () => {
      if (!supabase || siteIds.length === 0) return null;
      const since = new Date();
      since.setMonth(since.getMonth() - 24);
      const sinceIso = since.toISOString().slice(0, 10);

      // Categorie device per la precedenza general
      const devices = await fetchAll<{ id: string; site_id: string; category: string | null }>((a, b) =>
        supabase!.from('devices').select('id, site_id, category').in('site_id', siteIds).range(a, b),
      );
      const generalBySite = new Map<string, Set<string>>();
      for (const d of devices) {
        if (d.category === 'general') {
          if (!generalBySite.has(d.site_id)) generalBySite.set(d.site_id, new Set());
          generalBySite.get(d.site_id)!.add(d.id);
        }
      }

      const rows = await fetchAll<{ site_id: string; device_id: string; ts_day: string; value_sum: number | null }>((a, b) =>
        supabase!
          .from('energy_daily')
          .select('site_id, device_id, ts_day, value_sum')
          .eq('metric', 'energy.active_energy')
          .gte('ts_day', sinceIso)
          .in('site_id', siteIds)
          .range(a, b),
      );

      // kWh per mese (totale e per sito), con precedenza general per sito
      const byMonth = new Map<string, number>();
      const bySiteMonth = new Map<string, Map<string, number>>();
      for (const r of rows) {
        const gen = generalBySite.get(r.site_id);
        if (gen && gen.size > 0 && !gen.has(r.device_id)) continue; // solo general dove esiste
        const v = Number(r.value_sum || 0);
        if (v <= 0) continue;
        const k = monthKey(r.ts_day);
        byMonth.set(k, (byMonth.get(k) || 0) + v);
        if (!bySiteMonth.has(r.site_id)) bySiteMonth.set(r.site_id, new Map());
        const sm = bySiteMonth.get(r.site_id)!;
        sm.set(k, (sm.get(k) || 0) + v);
      }
      if (byMonth.size === 0) return { monthly12: [], yoy: [], years: [], perSite: {} };

      // Temperatura media mensile del perimetro (RPC, solo aggregati)
      const tempByMonth = new Map<string, number>();
      try {
        const { data: wx } = await (supabase!.rpc as CallableFunction)('get_portfolio_weather_monthly', {
          p_site_ids: siteIds,
          p_months: 13,
        });
        (wx || []).forEach((w: { bucket: string; avg_temp: number }) => tempByMonth.set(w.bucket, Number(w.avg_temp)));
      } catch { /* meteo assente: la linea semplicemente non appare */ }

      const now = new Date();
      const monthly12: EnergyTrends['monthly12'] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthly12.push({
          month: k,
          label: MONTH_LABELS[d.getMonth()],
          kwh: Math.round(byMonth.get(k) || 0),
          temp: tempByMonth.has(k) ? tempByMonth.get(k)! : null,
        });
      }

      // Anno su anno: anno corrente vs precedente, mese per mese
      const currY = String(now.getFullYear());
      const prevY = String(now.getFullYear() - 1);
      const yoy: EnergyTrends['yoy'] = MONTH_LABELS.map((label, mi) => {
        const kCurr = `${currY}-${String(mi + 1).padStart(2, '0')}`;
        const kPrev = `${prevY}-${String(mi + 1).padStart(2, '0')}`;
        return {
          label,
          [prevY]: byMonth.has(kPrev) ? Math.round(byMonth.get(kPrev)!) : null,
          [currY]: byMonth.has(kCurr) ? Math.round(byMonth.get(kCurr)!) : null,
        };
      });
      const perSite: EnergyTrends['perSite'] = {};
      for (const [sid, sm] of bySiteMonth) {
        perSite[sid] = monthly12.map(m => (sm.has(m.month) ? Math.round(sm.get(m.month)!) : null));
      }

      return { monthly12, yoy, years: [prevY, currY], perSite };
    },
    enabled: Boolean(isSupabaseConfigured && enabled && siteIds.length > 0),
    staleTime: 10 * 60 * 1000,
  });
}

/** Temperatura media mensile per un sottoinsieme di siti (es. una citta'):
    riusa la RPC di soli aggregati. Ritorna mese 'YYYY-MM' -> °C. */
export function useWeatherMonthly(siteIds: string[], enabled: boolean) {
  const key = [...siteIds].sort().join(',');
  return useQuery<Record<string, number>>({
    queryKey: ['weather-monthly', key],
    queryFn: async () => {
      if (!supabase || siteIds.length === 0) return {};
      const { data, error } = await (supabase.rpc as CallableFunction)('get_portfolio_weather_monthly', {
        p_site_ids: siteIds,
        p_months: 13,
      });
      if (error) throw error;
      const out: Record<string, number> = {};
      (data || []).forEach((w: { bucket: string; avg_temp: number }) => { out[w.bucket] = Number(w.avg_temp); });
      return out;
    },
    enabled: Boolean(isSupabaseConfigured && enabled && siteIds.length > 0),
    staleTime: 10 * 60 * 1000,
  });
}

export interface AirTrends {
  /** Portfolio IAQ Index (0-100, worst-pollutant, media dei siti) per mese */
  monthly12: { month: string; label: string; iaq: number | null }[];
  /** IAQ mensile PER SITO, allineato a monthly12 — per il benchmarking */
  perSite: Record<string, (number | null)[]>;
  /** Indice attuale del parco: ultimo mese, con delta vs mese precedente */
  iaqNow: { score: number; delta: number | null } | null;
  /** Migliore e peggiore per IAQ dell'ultimo mese */
  bestWorstIaq: { best: { siteId: string; score: number }; worst: { siteId: string; score: number } } | null;
  /** CO2 media nelle ORE DI APERTURA (10-19 locali del sito), ultimi 30gg */
  openingCo2: number | null;
  /** Quota delle ore di apertura in aria buona (CO2 <= good), 0-1 */
  openingGoodShare: number | null;
  /** Composizione delle ore (30gg, tutte le ore) per sito */
  composition: { siteId: string; good: number; warn: number; crit: number; hours: number }[];
  /** Heatmap ora x giorno (30gg): IAQ Index aggregato del parco per cella */
  heatmap: (number | null)[][]; // [7 giorni Lun..Dom][24 ore LOCALI del sito]
}

/** Tutte le colonne metriche che alimentano l'indice worst-pollutant. */
const AIR_METRICS = ['iaq.co2', 'co2', 'iaq.voc', 'tvoc', 'voc', 'iaq.pm25', 'pm25', 'iaq.pm10', 'pm10', 'iaq.o3', 'o3', 'iaq.co', 'co'];

/** Ora e giorno LOCALI del sito (Lun=0..Dom=6), con formatter cache per tz. */
const tzFormatters = new Map<string, Intl.DateTimeFormat>();
const DAY_IDX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
function localParts(ts: string, tz: string | undefined): { day: number; hour: number } {
  const zone = tz || 'UTC';
  let fmt = tzFormatters.get(zone);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hour12: false, weekday: 'short' });
    } catch {
      fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hour: 'numeric', hour12: false, weekday: 'short' });
    }
    tzFormatters.set(zone, fmt);
  }
  const parts = fmt.formatToParts(new Date(ts));
  const wd = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';
  const hr = Number(parts.find(p => p.type === 'hour')?.value ?? '0') % 24;
  return { day: DAY_IDX[wd] ?? 0, hour: hr };
}

const OPEN_FROM = 10; // orario di apertura standard retail, dichiarato in UI
const OPEN_TO = 19;

export function usePortfolioAirTrend(siteIds: string[], enabled: boolean, tzBySite: Record<string, string>) {
  const key = [...siteIds].sort().join(',');
  return useQuery<AirTrends | null>({
    queryKey: ['portfolio-air-trend-v2', key],
    queryFn: async () => {
      if (!supabase || siteIds.length === 0) return null;

      /* ── Mensile 12 mesi, multi-metrica: IAQ index per sito per mese ── */
      const since12m = new Date();
      since12m.setMonth(since12m.getMonth() - 12);
      const daily = await fetchAll<{ site_id: string; ts_day: string; metric: string; value_avg: number | null }>((a, b) =>
        supabase!
          .from('telemetry_daily')
          .select('site_id, ts_day, metric, value_avg')
          .in('metric', AIR_METRICS)
          .gte('ts_day', since12m.toISOString().slice(0, 10))
          .in('site_id', siteIds)
          .range(a, b),
      );
      // site -> month -> metric -> {s,n}
      const acc = new Map<string, Map<string, Map<string, { s: number; n: number }>>>();
      for (const r of daily) {
        const v = Number(r.value_avg || 0);
        if (v <= 0) continue;
        const mk = monthKey(r.ts_day);
        if (!acc.has(r.site_id)) acc.set(r.site_id, new Map());
        const bySite = acc.get(r.site_id)!;
        if (!bySite.has(mk)) bySite.set(mk, new Map());
        const byMetric = bySite.get(mk)!;
        const e = byMetric.get(r.metric) || { s: 0, n: 0 };
        e.s += v; e.n++;
        byMetric.set(r.metric, e);
      }

      const now = new Date();
      const months: { month: string; label: string }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MONTH_LABELS[d.getMonth()] });
      }
      const perSite: AirTrends['perSite'] = {};
      for (const [sid, bySite] of acc) {
        perSite[sid] = months.map(({ month }) => {
          const byMetric = bySite.get(month);
          if (!byMetric) return null;
          const metricAvgs: Record<string, number> = {};
          for (const [m, e] of byMetric) metricAvgs[m] = e.s / e.n;
          return computeAirIndex(metricAvgs)?.score ?? null;
        });
      }
      const monthly12: AirTrends['monthly12'] = months.map(({ month, label }, i) => {
        const scores = Object.values(perSite).map(arr => arr[i]).filter((v): v is number => v != null);
        return { month, label, iaq: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null };
      });

      const lastIdx = 11;
      const iaqLast = monthly12[lastIdx]?.iaq ?? null;
      const iaqPrev = monthly12[lastIdx - 1]?.iaq ?? null;
      const iaqNow = iaqLast != null ? { score: iaqLast, delta: iaqPrev != null ? iaqLast - iaqPrev : null } : null;

      const siteScoresNow = Object.entries(perSite)
        .map(([siteId, arr]) => ({ siteId, score: arr[lastIdx] ?? arr[lastIdx - 1] }))
        .filter((x): x is { siteId: string; score: number } => x.score != null)
        .sort((a, b) => b.score - a.score);
      const bestWorstIaq = siteScoresNow.length >= 2
        ? { best: siteScoresNow[0], worst: siteScoresNow[siteScoresNow.length - 1] }
        : null;

      /* ── Orario 30 giorni, multi-metrica: heatmap a IAQ (ore locali),
            CO2 in apertura e composizione delle ore ── */
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const hourly = await fetchAll<{ site_id: string; ts_hour: string; metric: string; value_avg: number | null }>((a, b) =>
        supabase!
          .from('telemetry_hourly')
          .select('site_id, ts_hour, metric, value_avg')
          .in('metric', AIR_METRICS)
          .gte('ts_hour', since30)
          .in('site_id', siteIds)
          .range(a, b),
      );

      const comp = new Map<string, { good: number; warn: number; crit: number }>();
      const grid: Map<string, { s: number; n: number }>[][] = Array.from({ length: 7 }, () =>
        Array.from({ length: 24 }, () => new Map<string, { s: number; n: number }>()),
      );
      let openSum = 0, openN = 0, openGood = 0;
      const isCo2 = (m: string) => m === 'iaq.co2' || m === 'co2';
      for (const r of hourly) {
        const v = Number(r.value_avg || 0);
        if (v <= 0) continue;
        const { day, hour } = localParts(r.ts_hour, tzBySite[r.site_id]);
        const cell = grid[day][hour];
        const e = cell.get(r.metric) || { s: 0, n: 0 };
        e.s += v; e.n++;
        cell.set(r.metric, e);
        if (isCo2(r.metric)) {
          const c = comp.get(r.site_id) || { good: 0, warn: 0, crit: 0 };
          if (v <= CO2_THRESHOLDS.good) c.good++;
          else if (v <= CO2_THRESHOLDS.moderate) c.warn++;
          else c.crit++;
          comp.set(r.site_id, c);
          if (hour >= OPEN_FROM && hour < OPEN_TO) {
            openSum += v; openN++;
            if (v <= CO2_THRESHOLDS.good) openGood++;
          }
        }
      }
      const heatmap: AirTrends['heatmap'] = grid.map(row =>
        row.map(cell => {
          if (cell.size === 0) return null;
          const metricAvgs: Record<string, number> = {};
          for (const [m, e] of cell) metricAvgs[m] = e.s / e.n;
          return computeAirIndex(metricAvgs)?.score ?? null;
        }),
      );
      const composition = [...comp.entries()]
        .map(([siteId, e]) => {
          const hours = e.good + e.warn + e.crit;
          return { siteId, hours, good: e.good / hours, warn: e.warn / hours, crit: e.crit / hours };
        })
        .sort((a, b) => b.crit - a.crit || b.warn - a.warn);

      return {
        monthly12,
        perSite,
        iaqNow,
        bestWorstIaq,
        openingCo2: openN > 0 ? Math.round(openSum / openN) : null,
        openingGoodShare: openN > 0 ? openGood / openN : null,
        composition,
        heatmap,
      };
    },
    enabled: Boolean(isSupabaseConfigured && enabled && siteIds.length > 0),
    staleTime: 10 * 60 * 1000,
  });
}
