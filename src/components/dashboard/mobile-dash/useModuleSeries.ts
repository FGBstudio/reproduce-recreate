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
import { co2ToScore } from "@/lib/airQuality";
import { getMonitorFamilyLabel } from "@/lib/airMonitorType";

export type DashModule = "energy" | "air" | "water";

/** Schede energia (§6.1.5): potenza totale o una categoria di dispositivi.
    «Base» (carico di base) non è una serie esistente in DB: resta fuori. */
export type EnergyCat = "power" | "hvac" | "lighting" | "plugs";

/** Metriche aria disponibili (telemetry_hourly/daily) — stesso set dei grafici
    desktop e dell'hardware WEEL/LEED (metrics_catalog): CO₂, TVOC, PM2.5,
    PM10, CO, O₃, temperatura, umidità. Alias storici da api.ts. */
export const AIR_METRICS: Record<string, { ids: string[]; unit: string }> = {
  co2: { ids: ["iaq.co2", "co2", "CO2"], unit: "ppm" },
  pm25: { ids: ["iaq.pm25", "pm25", "PM2.5", "pm2_5"], unit: "µg/m³" },
  pm10: { ids: ["iaq.pm10", "pm10", "PM10"], unit: "µg/m³" },
  tvoc: { ids: ["iaq.voc", "iaq.tvoc", "tvoc", "voc"], unit: "ppb" },
  co: { ids: ["iaq.co", "co", "CO"], unit: "ppm" },
  o3: { ids: ["iaq.o3", "o3", "O3"], unit: "ppb" },
  temp: { ids: ["env.temperature", "env.temp", "iaq.temp", "temp", "temperature", "temp_c"], unit: "°C" },
  humidity: { ids: ["env.humidity", "env.hum", "iaq.humidity", "humidity", "hum", "humidity_rh"], unit: "%" },
};

/** Fattore emissioni (kgCO2e/kWh) — stesso valore di ProjectDetail e del PDF. */
export const CO2_EMISSION_FACTOR = 0.233;

/** Metriche acqua (telemetry, hardware water_meter/water_quality del
    metrics_catalog). Il «consumo» in litri è un contatore cumulativo
    (water.volume): da value_avg orario non si ricava un delta onesto,
    quindi la serie primaria è la PORTATA media. */
export const WATER_METRICS: Record<string, { ids: string[]; unit: string }> = {
  flow: { ids: ["water.flow_rate", "flow_rate", "flow"], unit: "L/min" },
  ph: { ids: ["water.ph", "ph"], unit: "pH" },
  turbidity: { ids: ["water.turbidity", "turbidity"], unit: "NTU" },
  chlorine: { ids: ["water.chlorine", "chlorine"], unit: "mg/L" },
  wtemp: { ids: ["water.temp", "water_temp"], unit: "°C" },
  pressure: { ids: ["water.pressure", "pressure"], unit: "bar" },
};

/** Tabella metriche del modulo (aria o acqua). */
const metricsFor = (module: DashModule) => (module === "water" ? WATER_METRICS : AIR_METRICS);

/** Arrotondamento per metrica: le grandezze piccole (pH, cloro, CO, bar)
    hanno bisogno dei centesimi; le altre restano intere come oggi. */
const roundFor = (module: DashModule, metric: string) => {
  const fine = module === "water" ? metric !== "wtemp" : metric === "co";
  return (v: number) => (fine ? Math.round(v * 100) / 100 : Math.round(v));
};

export interface DayPoint { h: number; v: number | null }       // ora locale 0-23
export interface DaySeries {
  points: DayPoint[];
  /** profilo tipico: media oraria degli ultimi 4 stessi giorni-settimana
      (il pattern di «Actual vs Average» desktop, reso come linea fantasma) */
  typical?: Array<number | null>;
  peak?: { h: number; v: number };
  limit?: number;
  limit2?: number;             // seconda soglia (rosso), es. CO₂ critical
  unit: string;
  totalKwh?: number;           // energia del giorno (solo energy)
  avg?: number;                // media del giorno
  overLimitMinutes?: number;   // minuti sopra il limite (stima oraria)
  vsTypicalPct?: number;       // vs stesso giorno-settimana medio (4 settimane)
  costEur?: number;            // solo se la tariffa esiste
  hvacStrip?: boolean[];       // 24 ore: HVAC acceso (striscia causa, aria)
  outdoorTemp?: Array<number | null>; // 24 ore: causa energia (se disponibile)
  /** PM esterno orario da weather_data (§10.2): stesso asse del PM interno */
  outdoor?: Array<number | null>;
  /** dati parziali (§10.2): minuti senza dati e buco più grande */
  missingMinutes?: number;
  gap?: { from: number; to: number };
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
export interface MonthDayCell { day: number; date: string; v: number | null; future: boolean; today: boolean; weekend: boolean }
export interface MonthSeries {
  cells: MonthDayCell[];       // 1..n del mese
  maxV: number;
  /** carpet plot (atlante §6 v2): hours[giorno-1][ora] = valore orario */
  hours: Array<Array<number | null>>;
  hoursMax: number;
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

/** Parametri demo per metrica aria: scala plausibile, MAI valori di un'altra
    metrica. Le soglie demo ricalcano i default di site_thresholds. */
const DEMO_AIR: Record<string, { base: number; amp: number; wiggle: number; limit?: number; limit2?: number }> = {
  co2: { base: 480, amp: 420, wiggle: 60, limit: 1000, limit2: 1500 },
  pm25: { base: 7, amp: 5, wiggle: 1.2, limit: 15 },
  pm10: { base: 14, amp: 8, wiggle: 2.2, limit: 25 },
  tvoc: { base: 140, amp: 130, wiggle: 25, limit: 500 },
  co: { base: 1.1, amp: 1.6, wiggle: 0.3, limit: 4 },
  o3: { base: 20, amp: 18, wiggle: 4, limit: 50 },
  temp: { base: 20.5, amp: 3, wiggle: 0.4, limit: 26 },
  humidity: { base: 42, amp: 9, wiggle: 1.5, limit: 60 },
};

/** Demo acqua: soglie qualità dal metrics_catalog (pH 6.5–8.5, torbidità 1/5, cloro ≤1). */
const DEMO_WATER: Record<string, { base: number; amp: number; wiggle: number; limit?: number; limit2?: number }> = {
  // di notte il negozio chiuso va a ~0,2 L/min: coerente con la vista Notte
  flow: { base: 0.2, amp: 11, wiggle: 0.9 },
  ph: { base: 7.15, amp: 0.25, wiggle: 0.08, limit: 8.5 },
  turbidity: { base: 0.55, amp: 0.55, wiggle: 0.12, limit: 1, limit2: 5 },
  chlorine: { base: 0.45, amp: 0.1, wiggle: 0.04, limit: 1 },
  wtemp: { base: 15.5, amp: 3, wiggle: 0.4 },
  pressure: { base: 2.4, amp: 0.35, wiggle: 0.1 },
};
const demoCfgFor = (module: DashModule, metric: string) =>
  module === "water"
    ? (DEMO_WATER[metric] ?? DEMO_WATER.flow)
    : (DEMO_AIR[metric === "iaq" ? "co2" : metric] ?? DEMO_AIR.co2);

/** Metriche «di livello» (pH, temperatura, pressione, umidità): non calano
    nel weekend come i consumi — il modulatore giorno/weekend va appiattito. */
const isLevelMetric = (module: DashModule, metric: string) =>
  module === "water" ? ["ph", "wtemp", "pressure"].includes(metric) : ["temp", "humidity"].includes(metric);

/** Serie demo deterministica per i siti vetrina (badge DEMO obbligatorio). */
function demoDay(module: DashModule, airMetric: string, energyCat: EnergyCat = "power"): DaySeries {
  const cfg = demoCfgFor(module, airMetric);
  const k = module === "energy" ? DEMO_CAT_FACTOR[energyCat] : 1;
  const isIaq = module === "air" && airMetric === "iaq";
  const dp = cfg.base < 5 ? 100 : 10; // centesimi per le grandezze piccole (cloro, torbidità…)
  const pts: DayPoint[] = Array.from({ length: 24 }, (_, h) => {
    const base = module === "energy" ? 6 + 10 * Math.exp(-((h - 13) ** 2) / 28) : cfg.base + cfg.amp * Math.exp(-((h - 15) ** 2) / 30);
    const wiggle = Math.sin(h * 1.7) * (module === "energy" ? 1.4 : cfg.wiggle);
    const raw = (base + wiggle) * k;
    return { h, v: isIaq ? co2ToScore(raw) : Math.round(raw * dp) / dp };
  });
  // profilo tipico demo: la stessa giornata, leggermente più piatta
  const typicalBase = module === "energy" ? 6 * k : cfg.base;
  const typical = Array.from({ length: 24 }, (_, h) => {
    const v = pts[h].v;
    return v == null ? null : Math.round((v * 0.92 + typicalBase * 0.06) * dp) / dp;
  });
  const peakPt = pts.reduce((a, b) => ((b.v ?? 0) > (a.v ?? 0) ? b : a));
  const limit = module === "energy" ? (energyCat === "power" ? 25 : undefined) : isIaq ? undefined : cfg.limit;
  const avg = Math.round((pts.reduce((a, p) => a + (p.v ?? 0), 0) / pts.length) * dp) / dp;
  return {
    // per l'IAQ «più alto = meglio»: niente annotazione del picco
    points: pts, peak: isIaq ? undefined : { h: peakPt.h, v: peakPt.v! },
    typical,
    limit,
    limit2: module !== "energy" && !isIaq ? cfg.limit2 : undefined,
    unit: module === "energy" ? "kW" : isIaq ? "" : (metricsFor(module)[airMetric] ?? AIR_METRICS.co2).unit,
    totalKwh: module === "energy" ? Math.round(412 * k) : undefined,
    avg: module === "energy" ? Math.round(11.6 * k * 10) / 10 : avg,
    // coerente con la serie: minuti davvero sopra il limite disegnato
    overLimitMinutes: limit != null ? pts.filter(p => (p.v ?? 0) > limit).length * 60 : undefined,
    vsTypicalPct: module === "energy" ? -6 : undefined,
    costEur: module === "energy" ? Math.round(78 * k) : undefined,
    hvacStrip: module === "air" && ["co2", "temp", "humidity"].includes(airMetric) ? Array.from({ length: 24 }, (_, h) => h >= 7 && h <= 20 && h !== 13 && h !== 17) : undefined,
    // causa energia (§6.1.8): temperatura esterna, giornata mite 14→25°
    outdoorTemp: module === "energy" ? Array.from({ length: 24 }, (_, h) => Math.round((14 + 11 * Math.exp(-((h - 15) ** 2) / 34)) * 10) / 10) : undefined,
    // PM esterno demo (§10.2): fuori peggio che dentro (media ~22 µg/m³)
    outdoor: module === "air" && (airMetric === "pm25" || airMetric === "pm10")
      ? Array.from({ length: 24 }, (_, h) => Math.round(((airMetric === "pm25" ? 18 : 30) + 8 * Math.exp(-((h - 9) ** 2) / 22) + 5 * Math.exp(-((h - 19) ** 2) / 16)) * 10) / 10)
      : undefined,
    isDemo: true,
  };
}
function demoWeek(module: DashModule, airMetric: string, energyCat: EnergyCat = "power"): WeekSeries {
  const isIaq = module === "air" && airMetric === "iaq";
  const cfg = demoCfgFor(module, airMetric);
  const kCat = DEMO_CAT_FACTOR[energyCat];
  const dp = cfg.base < 5 ? 100 : 10;
  const flat = isLevelMetric(module, airMetric);
  const airShape = [0.95, 1.0, 1.12, 0.92, 1.02, 0.64, 0.59];
  const vals = module === "energy"
    ? [421, 398, 468, 388, 412, 118, 96].map(v => Math.round(v * kCat))
    : airShape.map(k => {
        const kk = flat ? 1 + (k - 1) * 0.06 : k; // livelli quasi piatti
        const raw = (cfg.base + cfg.amp * 0.38) * kk;
        return isIaq ? co2ToScore(raw) : Math.round(raw * dp) / dp;
      });
  const heat = Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => {
    const open = h >= 7 && h <= 20 && d < 5;
    return open ? Math.round(40 + 60 * Math.exp(-((h - 13) ** 2) / 30)) : Math.round(8 + (d >= 5 ? 4 : 0));
  }));
  return {
    days: ["L", "M", "M", "G", "V", "S", "D"].map((label, i) => ({ label, date: `demo-${i}`, v: vals[i] })),
    weekdayAvg: Math.round((vals.slice(0, 5).reduce((a, b) => a + b, 0) / 5) * dp) / dp,
    heat, heatMax: 100,
    totalKwh: module === "energy" ? Math.round(2290 * kCat) : undefined,
    topDay: "demo-2",
    costEur: module === "energy" ? Math.round(430 * kCat) : undefined,
    unit: module === "energy" ? "kWh" : isIaq ? "" : (metricsFor(module)[airMetric] ?? AIR_METRICS.co2).unit, isDemo: true,
  };
}
function demoMonth(module: DashModule, airMetric: string, energyCat: EnergyCat = "power"): MonthSeries {
  const isIaq = module === "air" && airMetric === "iaq";
  const cfg = demoCfgFor(module, airMetric);
  const dp = cfg.base < 5 ? 100 : 10;
  const kCat = DEMO_CAT_FACTOR[energyCat];
  const now = new Date();
  const nDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cells: MonthDayCell[] = Array.from({ length: nDays }, (_, i) => {
    const day = i + 1;
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const future = day > now.getDate();
    const wd = new Date(now.getFullYear(), now.getMonth(), day).getDay();
    const flat = isLevelMetric(module, airMetric);
    const v = future ? null
      : module === "energy"
        ? Math.round((wd === 0 || wd === 6 ? 110 : 390 + Math.round(60 * Math.sin(day))) * kCat)
        : (() => {
            const weekendK = flat ? 1 : wd === 0 || wd === 6 ? 0.62 : 1;
            const sinAmp = flat ? 0.02 : 0.08;
            const raw = (cfg.base + cfg.amp * 0.38) * weekendK * (1 + sinAmp * Math.sin(day));
            return isIaq ? co2ToScore(raw) : Math.round(raw * dp) / dp;
          })();
    return { day, date, v, future, today: day === now.getDate(), weekend: wd === 0 || wd === 6 };
  });
  const present = cells.filter(c => c.v != null);
  const demoPeak = [...present].sort((a, b) => (b.v! - a.v!))[0];
  // carpet plot demo: profilo diurno coerente con demoDay, scalato sul giorno
  const flatH = isLevelMetric(module, airMetric);
  const hours: Array<Array<number | null>> = cells.map(c => {
    if (c.v == null) return Array(24).fill(null);
    return Array.from({ length: 24 }, (_, h) => {
      const shape = module === "energy"
        ? (c.weekend ? 0.35 : 1) * (0.3 + Math.exp(-((h - 13) ** 2) / 28))
        : flatH ? 1 + 0.04 * Math.sin(h / 3)
        : 0.55 + 0.75 * Math.exp(-((h - 15) ** 2) / 30);
      return Math.round(c.v! * shape * dp) / dp;
    });
  });
  const hoursMax = Math.max(...hours.flat().filter((v): v is number => v != null), 1);
  return {
    cells, maxV: Math.max(...present.map(c => c.v!), 1),
    hours, hoursMax,
    totalKwh: module === "energy" ? Math.round(3800 * kCat) : undefined,
    costEur: module === "energy" ? Math.round(720 * kCat) : undefined,
    vsPrevPct: module === "energy" ? -6 : undefined,
    peak: demoPeak ? { date: demoPeak.date, v: demoPeak.v! } : undefined,
    baseloadKw: module === "energy" ? Math.round(4.2 * kCat * 10) / 10 : undefined,
    unit: module === "energy" ? "kWh" : isIaq ? "" : (metricsFor(module)[airMetric] ?? AIR_METRICS.co2).unit, isDemo: true,
  };
}

/** Dispositivi del sito per categoria (precedenza general per la potenza totale). */
async function deviceSets(siteId: string): Promise<Record<EnergyCat, string[]>> {
  const { data } = await supabase!.from("devices")
    .select("id, category, device_type")
    .eq("site_id", siteId);
  const all = (data || []) as unknown as DeviceRow[];
  const byCat = (c: string) => all.filter(d => d.category === c).map(d => d.id);
  const general = byCat("general");
  const hvac = byCat("hvac");
  const lighting = byCat("lighting");
  const plugs = byCat("plugs");
  const ENERGY = new Set(["hvac", "lighting", "plugs"]);
  const fallback = all.filter(d => (d.category && ENERGY.has(d.category)) || d.device_type === "energy_monitor").map(d => d.id);
  return { power: general.length > 0 ? general : fallback, hvac, lighting, plugs };
}

async function generalDeviceIds(siteId: string): Promise<{ ids: string[]; hvacIds: string[] }> {
  const sets = await deviceSets(siteId);
  return { ids: sets.power, hvacIds: sets.hvac };
}

/** Categorie energia con almeno un dispositivo: decide le schede visibili. */
export function useEnergyCats(siteId: string | undefined, isDemoSite: boolean) {
  return useQuery<EnergyCat[]>({
    queryKey: ["mdash-cats", siteId],
    queryFn: async () => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) {
        return isDemoSite ? ["power", "hvac", "lighting", "plugs"] : ["power"];
      }
      const sets = await deviceSets(siteId);
      const cats: EnergyCat[] = ["power"];
      (["hvac", "lighting", "plugs"] as const).forEach(c => { if (sets[c].length > 0) cats.push(c); });
      return cats;
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Fattori demo per le categorie (quota plausibile del carico totale). */
const DEMO_CAT_FACTOR: Record<EnergyCat, number> = { power: 1, hvac: 0.45, lighting: 0.3, plugs: 0.18 };

/* ── Facciata Water (§10.3): soli dati del contatore ──
   litri di oggi (Σ portata oraria × 60), media dello stesso giorno-settimana
   (4 settimane, telemetry_daily × 1440), minimo notturno e picco di oggi,
   ultima pressione, volume della settimana. Niente distribuzione per uso
   finale: senza sotto-contatori non è misurabile. ── */
export interface WaterFacade {
  todayLiters?: number;
  typicalLiters?: number;      // stesso giorno-settimana, media 4 settimane
  nightMin?: number;           // L/min, finestra 01–05 di oggi
  peakLmin?: number;
  pressureBar?: number;
  weekM3?: number;
  isDemo: boolean;
}

export function useWaterFacade(siteId: string | undefined, tz: string, isDemoSite: boolean, enabled: boolean) {
  return useQuery<WaterFacade | null>({
    queryKey: ["mdash-wfacade", siteId],
    queryFn: async (): Promise<WaterFacade | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) {
        return isDemoSite
          ? { todayLiters: 1840, typicalLiters: 2100, nightMin: 0.2, peakLmin: 24, pressureBar: 3.1, weekM3: 12.9, isDemo: true }
          : null;
      }
      const todayKey = dayKeyInTz(new Date(), tz);
      const fromUtc = new Date(Date.now() - 26 * 3600e3).toISOString();
      const [{ data: hr }, { data: dd }, { data: pr }] = await Promise.all([
        supabase!.from("telemetry_hourly")
          .select("ts_hour, metric, value_avg").eq("site_id", siteId)
          .gte("ts_hour", fromUtc).in("metric", WATER_METRICS.flow.ids),
        supabase!.from("telemetry_daily")
          .select("ts_day, metric, value_avg").eq("site_id", siteId)
          .gte("ts_day", new Date(Date.now() - 29 * 86400e3).toISOString().slice(0, 10))
          .in("metric", [...WATER_METRICS.flow.ids]),
        supabase!.from("telemetry_latest")
          .select("metric, value").eq("site_id", siteId).in("metric", WATER_METRICS.pressure.ids).limit(5),
      ]);
      let todayLiters = 0, nightMin: number | undefined, peakLmin: number | undefined, hasToday = false;
      for (const r of (hr || []) as unknown as HourRow[]) {
        if (r.value_avg == null || dayKeyInTz(new Date(r.ts_hour), tz) !== todayKey) continue;
        hasToday = true;
        const h = hourInTz(r.ts_hour, tz);
        const v = Number(r.value_avg);
        todayLiters += v * 60;
        if (h >= NIGHT_FROM && h < NIGHT_TO) nightMin = Math.min(nightMin ?? Infinity, v);
        peakLmin = Math.max(peakLmin ?? 0, v);
      }
      // media dello stesso giorno-settimana + volume della settimana corrente
      const wd = new Date(`${todayKey}T12:00:00`).getDay();
      let typSum = 0, typN = 0, weekL = 0;
      const weekStart = (() => { const d = new Date(`${todayKey}T12:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
      for (const r of (dd || []) as unknown as DayRow[]) {
        if (r.value_avg == null) continue;
        const liters = Number(r.value_avg) * 1440;
        if (new Date(`${r.ts_day}T12:00:00`).getDay() === wd && r.ts_day < todayKey) { typSum += liters; typN++; }
        if (r.ts_day >= weekStart && r.ts_day < todayKey) weekL += liters;
      }
      if (!hasToday && typN === 0) return null;
      const pressRow = ((pr || []) as unknown as Array<{ value: number | null }>)[0];
      return {
        todayLiters: hasToday ? Math.round(todayLiters) : undefined,
        typicalLiters: typN > 0 ? Math.round(typSum / typN) : undefined,
        nightMin: nightMin != null && nightMin !== Infinity ? Math.round(nightMin * 100) / 100 : undefined,
        peakLmin: peakLmin != null ? Math.round(peakLmin * 10) / 10 : undefined,
        pressureBar: pressRow?.value != null ? Math.round(Number(pressRow.value) * 10) / 10 : undefined,
        weekM3: weekL + todayLiters > 0 ? Math.round((weekL + todayLiters) / 100) / 10 : undefined,
        isDemo: false,
      };
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/* ── Selettore sonde aria (§10.2): una riga per sonda con famiglia
   (WELL 8 metriche / LEED 4) e stato offline. La selezione filtra le query
   e decide QUALI schede esistono: niente «slide fantasma». ── */
export interface AirProbe {
  id: string;
  label: string;
  family: "WELL" | "LEED" | null;
  metricsCount: number;
  offlineHours?: number;       // presente solo se la sonda è offline (>2h)
}

export function useAirProbes(siteId: string | undefined, isDemoSite: boolean) {
  return useQuery<AirProbe[]>({
    queryKey: ["mdash-probes", siteId],
    queryFn: async () => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) {
        return isDemoSite ? [{ id: "demo-air", label: "Open space", family: "WELL" as const, metricsCount: 8 }] : [];
      }
      const { data } = await supabase!.from("devices")
        .select("id, device_id, name, model, location, device_type")
        .eq("site_id", siteId)
        .eq("device_type", "air_quality");
      const rows = (data || []) as unknown as Array<{ id: string; device_id?: string; name?: string | null; model?: string | null; location?: string | null }>;
      if (rows.length === 0) return [];
      // ultimo segnale per device da telemetry_latest (offline se >2h)
      const { data: latest } = await supabase!.from("telemetry_latest")
        .select("device_id, ts").in("device_id", rows.map(r => r.id)).limit(500);
      const lastTs = new Map<string, number>();
      for (const r of (latest || []) as unknown as Array<{ device_id: string; ts: string }>) {
        const t = new Date(r.ts).getTime();
        if (!lastTs.has(r.device_id) || t > lastTs.get(r.device_id)!) lastTs.set(r.device_id, t);
      }
      return rows.map(r => {
        const family = getMonitorFamilyLabel(r);
        const ageH = lastTs.has(r.id) ? (Date.now() - lastTs.get(r.id)!) / 3600e3 : undefined;
        return {
          id: r.id,
          label: r.location || r.name || r.device_id || r.id,
          family,
          metricsCount: family === "LEED" ? 4 : 8,
          offlineHours: ageH != null && ageH > 2 ? Math.floor(ageH) : undefined,
        };
      });
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Metriche (aria o acqua) che il sito misura DAVVERO (regola d'oro §8.3):
    si guardano gli ultimi 45 giorni di telemetry_daily e si mostrano solo
    quelle schede. */
export function useSiteMetricsAvailable(module: DashModule, siteId: string | undefined, isDemoSite: boolean) {
  return useQuery<string[]>({
    queryKey: ["mdash-metrics", module, siteId],
    queryFn: async () => {
      const TBL = metricsFor(module);
      const ALL = Object.keys(TBL);
      if (isDemoSite || !isSupabaseConfigured || !siteId) return isDemoSite ? ALL : [];
      const since = new Date(Date.now() - 45 * 86400e3).toISOString().slice(0, 10);
      const { data } = await supabase!.from("telemetry_daily")
        .select("metric").eq("site_id", siteId).gte("ts_day", since).limit(2000);
      const present = new Set(((data || []) as unknown as Array<{ metric: string }>).map(r => r.metric));
      return ALL.filter(k => TBL[k].ids.some(id => present.has(id)));
    },
    staleTime: 10 * 60 * 1000,
  });
}

const HVAC_ON_KW = 2; // soglia acceso/spento (brief §8.2, da raffinare per sito)

/* ── Acqua (§10.3): regola perdite sul flusso notturno ──
   «flusso nella finestra 01–05 sopra 0,5 L/min per 3 notti → possibile
   perdita». Si guardano le ultime 3 notti concluse rispetto al giorno
   selezionato, dalla telemetria oraria della portata. ── */
export const NIGHT_FROM = 1, NIGHT_TO = 5, LEAK_LMIN = 0.5, LEAK_NIGHTS = 3;

export interface WaterNight {
  nights: Array<{ date: string; minFlow: number | null }>; // più recente per prima
  streak: number;              // notti consecutive sopra soglia
  leaking: boolean;            // streak >= LEAK_NIGHTS
  estLitersPerDay?: number;    // min notturno × 24h, stima dello spreco
  isDemo: boolean;
}

export function useWaterNight(siteId: string | undefined, dateKey: string, tz: string, isDemoSite: boolean, leaking = false) {
  return useQuery<WaterNight | null>({
    queryKey: ["mdash-wnight", siteId, dateKey, leaking],
    queryFn: async (): Promise<WaterNight | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) {
        if (!isDemoSite) return null;
        // demo: sito sano (min 0) o in perdita (1,2 L/min per 3 notti)
        const nights = [0, 1, 2].map(i => {
          const d = new Date(`${dateKey}T12:00:00`); d.setDate(d.getDate() - i);
          return { date: d.toISOString().slice(0, 10), minFlow: leaking ? 1.2 : 0.2 };
        });
        return {
          nights, streak: leaking ? 3 : 0, leaking,
          estLitersPerDay: leaking ? Math.round(1.2 * 60 * 24) : undefined, isDemo: true,
        };
      }
      const from = new Date(`${dateKey}T00:00:00`);
      const fromUtc = new Date(from.getTime() - (LEAK_NIGHTS + 1) * 86400e3).toISOString();
      const toUtc = new Date(from.getTime() + 26 * 3600e3).toISOString();
      const { data } = await supabase!.from("telemetry_hourly")
        .select("ts_hour, metric, value_avg").eq("site_id", siteId)
        .gte("ts_hour", fromUtc).lte("ts_hour", toUtc)
        .in("metric", WATER_METRICS.flow.ids);
      const byNight = new Map<string, number>(); // data → min flow nella finestra
      for (const r of (data || []) as unknown as HourRow[]) {
        if (r.value_avg == null) continue;
        const h = hourInTz(r.ts_hour, tz);
        if (h < NIGHT_FROM || h >= NIGHT_TO) continue;
        const k = dayKeyInTz(new Date(r.ts_hour), tz);
        const v = Number(r.value_avg);
        byNight.set(k, Math.min(byNight.get(k) ?? Infinity, v));
      }
      const nights: WaterNight["nights"] = [];
      for (let i = 0; i < LEAK_NIGHTS; i++) {
        const d = new Date(`${dateKey}T12:00:00`); d.setDate(d.getDate() - i);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const v = byNight.get(k);
        nights.push({ date: k, minFlow: v != null && v !== Infinity ? Math.round(v * 100) / 100 : null });
      }
      if (nights.every(n => n.minFlow == null)) return null;
      let streak = 0;
      for (const n of nights) {
        if (n.minFlow != null && n.minFlow > LEAK_LMIN) streak++;
        else break;
      }
      const isLeak = streak >= LEAK_NIGHTS;
      return {
        nights, streak, leaking: isLeak,
        estLitersPerDay: isLeak && nights[0].minFlow != null ? Math.round(nights[0].minFlow * 60 * 24) : undefined,
        isDemo: false,
      };
    },
    enabled: !!dateKey,
    staleTime: 5 * 60 * 1000,
  });
}

/** Profilo orario di UN giorno (somma device per l'energia, media sito per
    aria/acqua): mattone del «profilo tipico» dei 4 stessi giorni-settimana. */
async function fetchDayHourMap(
  module: DashModule, siteId: string, ids: string[], metricIds: string[], dayKey: string, tz: string,
): Promise<Map<number, number>> {
  const from = new Date(`${dayKey}T00:00:00`);
  const fromUtc = new Date(from.getTime() - 26 * 3600e3).toISOString();
  const toUtc = new Date(from.getTime() + 50 * 3600e3).toISOString();
  if (module === "energy") {
    const { data } = await supabase!.from("energy_hourly")
      .select("ts_hour, metric, value_avg, value_sum")
      .in("device_id", ids.slice(0, 50))
      .gte("ts_hour", fromUtc).lte("ts_hour", toUtc)
      .in("metric", ["energy.power_kw", "energy.active_energy", "energy.active_import_kwh"]);
    const p = new Map<number, number>(), e = new Map<number, number>();
    for (const r of (data || []) as unknown as HourRow[]) {
      if (dayKeyInTz(new Date(r.ts_hour), tz) !== dayKey) continue;
      const h = hourInTz(r.ts_hour, tz);
      if (r.metric === "energy.power_kw" && r.value_avg != null) p.set(h, (p.get(h) || 0) + Number(r.value_avg));
      else if (r.value_sum != null && Number(r.value_sum) <= 50000) e.set(h, (e.get(h) || 0) + Number(r.value_sum));
    }
    return p.size > 0 ? p : e;
  }
  // aria/acqua: media del sito, o delle sole sonde selezionate (ids)
  let q = supabase!.from("telemetry_hourly")
    .select("ts_hour, metric, value_avg").eq("site_id", siteId)
    .gte("ts_hour", fromUtc).lte("ts_hour", toUtc).in("metric", metricIds);
  if (ids.length > 0) q = q.in("device_id", ids.slice(0, 50));
  const { data } = await q;
  const agg = new Map<number, { s: number; n: number }>();
  for (const r of (data || []) as unknown as HourRow[]) {
    if (r.value_avg == null || dayKeyInTz(new Date(r.ts_hour), tz) !== dayKey) continue;
    const h = hourInTz(r.ts_hour, tz);
    const x = agg.get(h) || { s: 0, n: 0 };
    x.s += Number(r.value_avg); x.n++;
    agg.set(h, x);
  }
  return new Map([...agg.entries()].map(([h, x]) => [h, x.s / x.n]));
}

/** Media oraria dei 4 stessi giorni-settimana precedenti; null se scarsa. */
async function fetchTypical(
  module: DashModule, siteId: string, ids: string[], metricIds: string[], dateKey: string, tz: string,
  mapV: (v: number) => number,
): Promise<Array<number | null> | undefined> {
  const prevKeys = [1, 2, 3, 4].map(i => {
    const d = new Date(`${dateKey}T12:00:00`);
    d.setDate(d.getDate() - 7 * i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const maps = await Promise.all(prevKeys.map(k => fetchDayHourMap(module, siteId, ids, metricIds, k, tz).catch(() => new Map<number, number>())));
  const typical = Array.from({ length: 24 }, (_, h) => {
    const vals = maps.map(m => m.get(h)).filter((v): v is number => v != null);
    return vals.length >= 2 ? mapV(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });
  return typical.filter(v => v != null).length >= 6 ? typical : undefined;
}

export function useDaySeries(module: DashModule, siteId: string | undefined, dateKey: string, tz: string, isDemoSite: boolean, limit?: number, priceKwh?: number, airMetric: string = "co2", energyCat: EnergyCat = "power", limit2?: number, probeIds?: string[]) {
  return useQuery<DaySeries | null>({
    queryKey: ["mdash-day", module, siteId, dateKey, airMetric, energyCat, probeIds?.join(",") ?? ""],
    queryFn: async (): Promise<DaySeries | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) return isDemoSite ? demoDay(module, airMetric, energyCat) : null;
      const from = `${dateKey}T00:00:00`;
      // finestra UTC larga: filtriamo poi per giorno locale
      const fromUtc = new Date(new Date(from).getTime() - 26 * 3600e3).toISOString();
      const toUtc = new Date(new Date(from).getTime() + 50 * 3600e3).toISOString();
      // il limite di contratto vale solo per la potenza totale (§6.1.5)
      const effLimit = module === "energy" && energyCat !== "power" ? undefined : limit;

      if (module === "energy") {
        const sets = await deviceSets(siteId);
        const ids = sets[energyCat];
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
        const over = effLimit ? present.filter(pt => pt.v > effLimit).length * 60 : undefined;
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
        // la causa (§6.1.8): temperatura esterna oraria da weather_data
        let outdoorTemp: Array<number | null> | undefined;
        const { data: wx } = await supabase!.from("weather_data")
          .select("timestamp, temperature_c")
          .eq("site_id", siteId)
          .gte("timestamp", fromUtc).lte("timestamp", toUtc);
        const wxByHour = new Map<number, { s: number; n: number }>();
        for (const r of (wx || []) as unknown as Array<{ timestamp: string; temperature_c: number | null }>) {
          if (r.temperature_c == null || dayKeyInTz(new Date(r.timestamp), tz) !== dateKey) continue;
          const h = hourInTz(r.timestamp, tz);
          const e = wxByHour.get(h) || { s: 0, n: 0 };
          e.s += Number(r.temperature_c); e.n++;
          wxByHour.set(h, e);
        }
        if (wxByHour.size > 1) {
          outdoorTemp = Array.from({ length: 24 }, (_, h) => {
            const e = wxByHour.get(h);
            return e ? Math.round((e.s / e.n) * 10) / 10 : null;
          });
        }
        // il PATTERN: profilo orario medio dei 4 stessi giorni-settimana
        // (la versione mobile di «Actual vs Average»)
        const typical = await fetchTypical("energy", siteId, ids, [], dateKey, tz, v => Math.round(v * 10) / 10);
        return {
          points, typical, peak: peakPt ? { h: peakPt.h, v: peakPt.v } : undefined, limit: effLimit, unit: "kW",
          totalKwh, avg, overLimitMinutes: over, vsTypicalPct,
          costEur: totalKwh && priceKwh ? Math.round(totalKwh * priceKwh) : undefined,
          outdoorTemp,
          isDemo: false,
        };
      }

      // ── ARIA / ACQUA: metrica oraria dalla telemetria del sito ──
      // IAQ (§6.1.5) non è una colonna: si deriva dalla CO₂ con la stessa
      // scala dell'overview (co2ToScore) — niente indici inventati.
      const isIaq = module === "air" && airMetric === "iaq";
      const rnd = roundFor(module, airMetric);
      const metricIds = (metricsFor(module)[isIaq ? "co2" : airMetric] ?? AIR_METRICS.co2).ids;
      let q = supabase!.from("telemetry_hourly")
        .select("ts_hour, metric, value_avg")
        .eq("site_id", siteId)
        .gte("ts_hour", fromUtc).lte("ts_hour", toUtc)
        .in("metric", metricIds);
      if (probeIds && probeIds.length > 0) q = q.in("device_id", probeIds.slice(0, 50));
      const { data } = await q;
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
        if (!e) return { h, v: null };
        const mean = e.s / e.n;
        return { h, v: isIaq ? co2ToScore(mean) : rnd(mean) };
      });
      const present = points.filter(pt => pt.v != null) as Array<{ h: number; v: number }>;
      const peakPt = present.reduce((a, b) => (b.v > a.v ? b : a), present[0]);
      const avg = rnd(present.reduce((a, b) => a + b.v, 0) / present.length);
      const over = limit ? present.filter(pt => pt.v > limit).length * 60 : undefined;

      // ── dati parziali (§10.2): i buchi restano buchi, con l'orario.
      // Si contano le ore mancanti tra la prima e l'ultima ora con dati
      // (se il giorno è oggi, fino all'ora corrente nel fuso del sito). ──
      let missingMinutes: number | undefined;
      let gap: { from: number; to: number } | undefined;
      {
        const isToday = dateKey === dayKeyInTz(new Date(), tz);
        const firstH = present[0]?.h ?? 0;
        const lastH = isToday ? hourInTz(new Date().toISOString(), tz) : (present[present.length - 1]?.h ?? 23);
        let missing = 0, run = 0, runStart = -1, bestLen = 0, bestStart = -1;
        for (let h = firstH; h <= lastH; h++) {
          if (points[h].v == null) {
            missing++;
            if (run === 0) runStart = h;
            run++;
            if (run > bestLen) { bestLen = run; bestStart = runStart; }
          } else run = 0;
        }
        if (missing > 0) {
          missingMinutes = missing * 60;
          if (bestLen > 0) gap = { from: bestStart, to: bestStart + bestLen };
        }
      }

      // il PATTERN tipico degli stessi giorni-settimana, anche per aria/acqua
      const typical = await fetchTypical(module, siteId, probeIds ?? [], metricIds, dateKey, tz,
        v => (isIaq ? co2ToScore(v) : rnd(v)));

      // ── PM interno/esterno (§10.2): l'esterno da weather_data, stesso asse ──
      let outdoor: Array<number | null> | undefined;
      if (module === "air" && (airMetric === "pm25" || airMetric === "pm10")) {
        const col = airMetric === "pm25" ? "pm2_5" : "pm10";
        const { data: wx } = await supabase!.from("weather_data")
          .select(`timestamp, ${col}`)
          .eq("site_id", siteId)
          .gte("timestamp", fromUtc).lte("timestamp", toUtc);
        const byH = new Map<number, { s: number; n: number }>();
        for (const r of (wx || []) as unknown as Array<Record<string, unknown>>) {
          const v = r[col];
          if (v == null || dayKeyInTz(new Date(String(r.timestamp)), tz) !== dateKey) continue;
          const h = hourInTz(String(r.timestamp), tz);
          const e = byH.get(h) || { s: 0, n: 0 };
          e.s += Number(v); e.n++;
          byH.set(h, e);
        }
        if (byH.size > 1) {
          outdoor = Array.from({ length: 24 }, (_, h) => {
            const e = byH.get(h);
            return e ? Math.round((e.s / e.n) * 10) / 10 : null;
          });
        }
      }
      // causa: HVAC acceso/spento dal modulo Energy (potenza hvac > soglia).
      // Pertinente per CO₂ (ventilazione) e per temperatura/umidità (clima);
      // per PM/CO/O₃ e per l'acqua non si propone una causa non verificata (§6.1.8).
      const wantsHvac = module === "air" && ["co2", "temp", "humidity"].includes(airMetric);
      let hvacStrip: boolean[] | undefined;
      const { hvacIds } = wantsHvac ? await generalDeviceIds(siteId) : { hvacIds: [] as string[] };
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
      return {
        points,
        typical,
        // per l'IAQ «più alto = meglio»: l'annotazione del picco sarebbe fuorviante
        peak: !isIaq && peakPt ? { h: peakPt.h, v: peakPt.v } : undefined,
        // soglia della metrica corrente (site_thresholds / metrics_catalog)
        limit: isIaq ? undefined : limit,
        limit2: isIaq ? undefined : limit2,
        unit: isIaq ? "" : (metricsFor(module)[airMetric] ?? AIR_METRICS.co2).unit,
        avg,
        overLimitMinutes: isIaq ? undefined : over,
        hvacStrip: wantsHvac ? hvacStrip : undefined,
        outdoor,
        missingMinutes,
        gap,
        isDemo: false,
      };
    },
    enabled: !!dateKey,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWeekSeries(module: DashModule, siteId: string | undefined, mondayKey: string, tz: string, isDemoSite: boolean, priceKwh?: number, airMetric: string = "co2", energyCat: EnergyCat = "power", probeIds?: string[]) {
  return useQuery<WeekSeries | null>({
    queryKey: ["mdash-week", module, siteId, mondayKey, airMetric, energyCat, probeIds?.join(",") ?? ""],
    queryFn: async (): Promise<WeekSeries | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) return isDemoSite ? demoWeek(module, airMetric, energyCat) : null;
      const start = new Date(`${mondayKey}T00:00:00`);
      const endKey = new Date(start.getTime() + 6 * 86400e3).toISOString().slice(0, 10);
      const fromUtc = new Date(start.getTime() - 26 * 3600e3).toISOString();
      const toUtc = new Date(start.getTime() + 8 * 86400e3).toISOString();
      const dayKeys = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400e3).toISOString().slice(0, 10));

      let heatRows: Array<{ ts: string; v: number }> = [];
      let daySums = new Map<string, number>();

      const isIaq = module === "air" && airMetric === "iaq";
      if (module === "energy") {
        const ids = (await deviceSets(siteId))[energyCat];
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
        let qw = supabase!.from("telemetry_hourly")
          .select("ts_hour, metric, value_avg").eq("site_id", siteId)
          .gte("ts_hour", fromUtc).lte("ts_hour", toUtc)
          .in("metric", (metricsFor(module)[isIaq ? "co2" : airMetric] ?? AIR_METRICS.co2).ids);
        if (probeIds && probeIds.length > 0) qw = qw.in("device_id", probeIds.slice(0, 50));
        const { data: hr } = await qw;
        const agg = new Map<string, { s: number; n: number }>();
        for (const r of (hr || []) as unknown as HourRow[]) {
          if (r.value_avg == null) continue;
          const e = agg.get(r.ts_hour) || { s: 0, n: 0 };
          e.s += Number(r.value_avg); e.n++;
          agg.set(r.ts_hour, e);
        }
        // IAQ: si converte la CO₂ oraria in score (stessa scala dell'overview)
        heatRows = [...agg.entries()].map(([ts, e]) => ({ ts, v: isIaq ? co2ToScore(e.s / e.n) : e.s / e.n }));
        // per l'aria la "barra giorno" è la media giornaliera della metrica
        const dAgg = new Map<string, { s: number; n: number }>();
        for (const { ts, v } of heatRows) {
          const k = dayKeyInTz(new Date(ts), tz);
          const e = dAgg.get(k) || { s: 0, n: 0 };
          e.s += v; e.n++;
          dAgg.set(k, e);
        }
        const rnd = roundFor(module, airMetric);
        daySums = new Map([...dAgg.entries()].map(([k, e]) => [k, isIaq ? Math.round(e.s / e.n) : rnd(e.s / e.n)]));
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
      const rndW = roundFor(module, airMetric);
      const days: WeekDay[] = dayKeys.map((date, i) => ({
        label: labels[i], date,
        v: daySums.has(date) ? (module === "energy" ? Math.round(daySums.get(date)!) : daySums.get(date)!) : null,
      }));
      const weekdayVals = days.slice(0, 5).map(d => d.v).filter((v): v is number => v != null);
      const weekdayAvg = weekdayVals.length ? rndW(weekdayVals.reduce((a, b) => a + b, 0) / weekdayVals.length) : undefined;
      const totalKwh = module === "energy" ? Math.round([...daySums.values()].reduce((a, b) => a + b, 0)) : undefined;
      const top = days.filter(d => d.v != null).sort((a, b) => (b.v! - a.v!))[0];
      return {
        days, weekdayAvg, heat, heatMax,
        totalKwh, topDay: top?.date,
        costEur: totalKwh && priceKwh ? Math.round(totalKwh * priceKwh) : undefined,
        unit: module === "energy" ? "kWh" : isIaq ? "" : (metricsFor(module)[airMetric] ?? AIR_METRICS.co2).unit, isDemo: false,
      };
    },
    enabled: !!mondayKey,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMonthSeries(module: DashModule, siteId: string | undefined, monthKey: string /* YYYY-MM */, tz: string, isDemoSite: boolean, priceKwh?: number, airMetric: string = "co2", energyCat: EnergyCat = "power", probeIds?: string[]) {
  return useQuery<MonthSeries | null>({
    queryKey: ["mdash-month", module, siteId, monthKey, airMetric, energyCat, probeIds?.join(",") ?? ""],
    queryFn: async (): Promise<MonthSeries | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) return isDemoSite ? demoMonth(module, airMetric, energyCat) : null;
      const [y, m] = monthKey.split("-").map(Number);
      const nDays = new Date(y, m, 0).getDate();
      const first = `${monthKey}-01`;
      const last = `${monthKey}-${String(nDays).padStart(2, "0")}`;
      const prevFirst = new Date(y, m - 2, 1).toISOString().slice(0, 10);
      const todayKey = dayKeyInTz(new Date(), tz);

      const vals = new Map<string, number>();
      let prevTotal = 0;
      const isIaq = module === "air" && airMetric === "iaq";
      if (module === "energy") {
        const ids = (await deviceSets(siteId))[energyCat];
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
        let qm = supabase!.from("telemetry_daily")
          .select("ts_day, metric, value_avg").eq("site_id", siteId)
          .gte("ts_day", first).lte("ts_day", last)
          .in("metric", (metricsFor(module)[isIaq ? "co2" : airMetric] ?? AIR_METRICS.co2).ids);
        if (probeIds && probeIds.length > 0) qm = qm.in("device_id", probeIds.slice(0, 50));
        const { data } = await qm;
        const agg = new Map<string, { s: number; n: number }>();
        for (const r of (data || []) as unknown as DayRow[]) {
          if (r.value_avg == null) continue;
          const e = agg.get(r.ts_day) || { s: 0, n: 0 };
          e.s += Number(r.value_avg); e.n++;
          agg.set(r.ts_day, e);
        }
        const rnd = roundFor(module, airMetric);
        for (const [k, e] of agg) vals.set(k, isIaq ? co2ToScore(e.s / e.n) : rnd(e.s / e.n));
      }
      if (vals.size === 0) return null;

      const cells: MonthDayCell[] = Array.from({ length: nDays }, (_, i) => {
        const day = i + 1;
        const date = `${monthKey}-${String(day).padStart(2, "0")}`;
        const wd = new Date(`${date}T12:00:00`).getDay();
        return {
          day, date,
          v: vals.has(date) ? (module === "energy" ? Math.round(vals.get(date)!) : vals.get(date)!) : null,
          future: date > todayKey, today: date === todayKey, weekend: wd === 0 || wd === 6,
        };
      });

      // ── carpet plot (atlante §6 v2): tutte le ore del mese ──
      const hours: Array<Array<number | null>> = Array.from({ length: nDays }, () => Array(24).fill(null));
      let hoursMax = 0;
      {
        const fromUtc = new Date(new Date(`${first}T00:00:00`).getTime() - 26 * 3600e3).toISOString();
        const toUtc = new Date(new Date(`${last}T00:00:00`).getTime() + 50 * 3600e3).toISOString();
        const put = (iso: string, v: number, mode: "sum" | "avgCount", counts?: Array<Array<number>>) => {
          const k = dayKeyInTz(new Date(iso), tz);
          if (!k.startsWith(monthKey)) return;
          const di = Number(k.slice(8, 10)) - 1;
          if (di < 0 || di >= nDays) return;
          const h = hourInTz(iso, tz);
          if (mode === "sum") hours[di][h] = (hours[di][h] || 0) + v;
          else { hours[di][h] = (hours[di][h] || 0) + v; counts![di][h]++; }
        };
        if (module === "energy") {
          const ids = (await deviceSets(siteId))[energyCat];
          const { data: hr } = await supabase!.from("energy_hourly")
            .select("ts_hour, metric, value_avg, value_sum")
            .in("device_id", ids.slice(0, 50))
            .gte("ts_hour", fromUtc).lte("ts_hour", toUtc)
            .in("metric", ["energy.power_kw", "energy.active_energy", "energy.active_import_kwh"]);
          for (const r of (hr || []) as unknown as HourRow[]) {
            const v = r.metric === "energy.power_kw" ? r.value_avg : (r.value_sum != null && Number(r.value_sum) <= 50000 ? r.value_sum : null);
            if (v == null) continue;
            put(r.ts_hour, Number(v), "sum");
          }
        } else {
          const counts: Array<Array<number>> = Array.from({ length: nDays }, () => Array(24).fill(0));
          let qc = supabase!.from("telemetry_hourly")
            .select("ts_hour, metric, value_avg").eq("site_id", siteId)
            .gte("ts_hour", fromUtc).lte("ts_hour", toUtc)
            .in("metric", (metricsFor(module)[isIaq ? "co2" : airMetric] ?? AIR_METRICS.co2).ids);
          if (probeIds && probeIds.length > 0) qc = qc.in("device_id", probeIds.slice(0, 50));
          const { data: hr } = await qc;
          for (const r of (hr || []) as unknown as HourRow[]) {
            if (r.value_avg == null) continue;
            put(r.ts_hour, Number(r.value_avg), "avgCount", counts);
          }
          const rndH = roundFor(module, airMetric);
          for (let d2 = 0; d2 < nDays; d2++) for (let h2 = 0; h2 < 24; h2++) {
            if (counts[d2][h2] > 0) {
              const mean = hours[d2][h2]! / counts[d2][h2];
              hours[d2][h2] = isIaq ? co2ToScore(mean) : rndH(mean);
            }
          }
        }
        for (const row of hours) for (const v of row) if (v != null && v > hoursMax) hoursMax = v;
      }
      const present = cells.filter(c => c.v != null) as Array<MonthDayCell & { v: number }>;
      const maxV = Math.max(...present.map(c => c.v));
      const totalKwh = module === "energy" ? Math.round(present.reduce((a, c) => a + c.v, 0)) : undefined;
      const peakCell = present.sort((a, b) => b.v - a.v)[0];
      // vs mese precedente: confronto a pari giorni trascorsi
      let vsPrevPct: number | undefined;
      if (module === "energy" && totalKwh && prevTotal > 0) {
        vsPrevPct = Math.round(((totalKwh - prevTotal * (present.length / nDays)) / (prevTotal * (present.length / nDays))) * 100);
      }
      // carico di base (§6.3): stima onesta dal giorno più basso del mese
      // (kWh del giorno / 24h ≈ kW medi a negozio chiuso) — niente query extra
      const baseloadKw = module === "energy" && present.length >= 3
        ? Math.round((Math.min(...present.map(c => c.v)) / 24) * 10) / 10
        : undefined;
      return {
        cells, maxV,
        hours, hoursMax: hoursMax || 1,
        totalKwh,
        costEur: totalKwh && priceKwh ? Math.round(totalKwh * priceKwh) : undefined,
        vsPrevPct,
        peak: peakCell ? { date: peakCell.date, v: peakCell.v } : undefined,
        baseloadKw,
        unit: module === "energy" ? "kWh" : isIaq ? "" : (metricsFor(module)[airMetric] ?? AIR_METRICS.co2).unit, isDemo: false,
      };
    },
    enabled: !!monthKey,
    staleTime: 10 * 60 * 1000,
  });
}

/* ── Vista «Anno» (§6.4 — PROPOSTA, non mockuppata: 12 barre per mese).
   Energy: somma mensile da energy_daily; Air: media mensile della metrica. ── */
export interface YearMonth { m: number; v: number | null }
export interface YearSeries {
  months: YearMonth[];        // indice 0 = gennaio
  avg?: number;               // media dei mesi con dati
  totalKwh?: number;
  costEur?: number;
  unit: string;
  isDemo: boolean;
}

function demoYear(module: DashModule, airMetric: string, energyCat: EnergyCat = "power"): YearSeries {
  const isIaq = module === "air" && airMetric === "iaq";
  const cfg = demoCfgFor(module, airMetric);
  const rnd = roundFor(module, airMetric);
  const kCat = DEMO_CAT_FACTOR[energyCat];
  const nowM = new Date().getMonth();
  const shape = [1.15, 1.1, 0.95, 0.85, 0.9, 1.05, 1.2, 1.18, 0.95, 0.9, 1.0, 1.12];
  const months: YearMonth[] = shape.map((k, i) => {
    if (i > nowM) return { m: i + 1, v: null };
    // il mese corrente è parziale: coerente col riepilogo mese demo (3.800 kWh)
    const raw = module === "energy"
      ? (i === nowM ? 3800 : 11600 * k) * kCat
      : (cfg.base + cfg.amp * 0.38) * (0.9 + 0.2 * (k - 0.85));
    return { m: i + 1, v: module === "energy" ? Math.round(raw) : isIaq ? co2ToScore(raw) : rnd(raw) };
  });
  const present = months.filter(x => x.v != null).map(x => x.v!) ;
  const totalKwh = module === "energy" ? present.reduce((a, b) => a + b, 0) : undefined;
  return {
    months,
    avg: present.length ? (module === "energy" || isIaq ? Math.round : rnd)(present.reduce((a, b) => a + b, 0) / present.length) : undefined,
    totalKwh,
    costEur: module === "energy" ? Math.round((totalKwh || 0) * 0.19) : undefined,
    unit: module === "energy" ? "kWh" : isIaq ? "" : (metricsFor(module)[airMetric] ?? AIR_METRICS.co2).unit,
    isDemo: true,
  };
}

export function useYearSeries(module: DashModule, siteId: string | undefined, year: number, tz: string, isDemoSite: boolean, priceKwh?: number, airMetric: string = "co2", energyCat: EnergyCat = "power", probeIds?: string[]) {
  return useQuery<YearSeries | null>({
    queryKey: ["mdash-year", module, siteId, year, airMetric, energyCat, probeIds?.join(",") ?? ""],
    queryFn: async (): Promise<YearSeries | null> => {
      if (isDemoSite || !isSupabaseConfigured || !siteId) return isDemoSite ? demoYear(module, airMetric, energyCat) : null;
      const first = `${year}-01-01`;
      const last = `${year}-12-31`;
      const isIaq = module === "air" && airMetric === "iaq";
      const byMonth = new Map<number, { s: number; n: number }>();

      if (module === "energy") {
        const ids = (await deviceSets(siteId))[energyCat];
        if (ids.length === 0) return null;
        const { data } = await supabase!.from("energy_daily")
          .select("ts_day, value_sum").in("device_id", ids.slice(0, 50))
          .gte("ts_day", first).lte("ts_day", last)
          .in("metric", ["energy.active_energy", "energy.active_import_kwh"]);
        for (const r of (data || []) as unknown as DayRow[]) {
          if (r.value_sum == null || Number(r.value_sum) > 50000) continue;
          const m = Number(r.ts_day.slice(5, 7));
          const e = byMonth.get(m) || { s: 0, n: 0 };
          e.s += Number(r.value_sum); e.n++;
          byMonth.set(m, e);
        }
      } else {
        let qy = supabase!.from("telemetry_daily")
          .select("ts_day, metric, value_avg").eq("site_id", siteId)
          .gte("ts_day", first).lte("ts_day", last)
          .in("metric", (metricsFor(module)[isIaq ? "co2" : airMetric] ?? AIR_METRICS.co2).ids);
        if (probeIds && probeIds.length > 0) qy = qy.in("device_id", probeIds.slice(0, 50));
        const { data } = await qy;
        for (const r of (data || []) as unknown as DayRow[]) {
          if (r.value_avg == null) continue;
          const m = Number(r.ts_day.slice(5, 7));
          const e = byMonth.get(m) || { s: 0, n: 0 };
          e.s += Number(r.value_avg); e.n++;
          byMonth.set(m, e);
        }
      }
      if (byMonth.size === 0) return null;

      const rnd = roundFor(module, airMetric);
      const months: YearMonth[] = Array.from({ length: 12 }, (_, i) => {
        const e = byMonth.get(i + 1);
        if (!e) return { m: i + 1, v: null };
        const v = module === "energy" ? Math.round(e.s) : isIaq ? co2ToScore(e.s / e.n) : rnd(e.s / e.n);
        return { m: i + 1, v };
      });
      const present = months.filter(x => x.v != null).map(x => x.v!);
      const totalKwh = module === "energy" ? present.reduce((a, b) => a + b, 0) : undefined;
      return {
        months,
        avg: present.length ? (module === "energy" || isIaq ? Math.round : rnd)(present.reduce((a, b) => a + b, 0) / present.length) : undefined,
        totalKwh,
        costEur: totalKwh && priceKwh ? Math.round(totalKwh * priceKwh) : undefined,
        unit: module === "energy" ? "kWh" : isIaq ? "" : (metricsFor(module)[airMetric] ?? AIR_METRICS.co2).unit,
        isDemo: false,
      };
    },
    enabled: !!year,
    staleTime: 10 * 60 * 1000,
  });
}
