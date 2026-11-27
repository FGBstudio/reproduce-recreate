/**
 * Report granularity model — Fase C1.
 *
 * Pure, render-agnostic logic that turns the raw telemetry points already
 * fetched for a report into the **canonical buckets** the FGB report layout
 * expects, per the granularity rule (same rule for charts AND tables):
 *
 *   | Horizon  | One value every | Points | Tag            |
 *   |----------|-----------------|--------|----------------|
 *   | daily    | hour            | 24     | ORARIO         |
 *   | weekly   | half day        | 14     | MEZZA GIORNATA |
 *   | monthly  | day             | 28-31  | GIORNALIERO    |
 *   | annual   | month           | 12     | MENSILE        |
 *
 * Every bucket carries coverage and the flags the layout needs
 * (weekend / future / in-progress / incomplete / empty / alarm). Empty
 * buckets keep `value: null` — the report must render them as "nothing",
 * never as a plausible-looking 0 (data-honesty rule).
 *
 * All bucketing is done in the SITE's local time (DST-safe): points are
 * assigned by their wall-clock parts in the site timezone, and the bucket
 * skeleton is enumerated with integer calendar math so the 23h/25h DST days
 * don't drop or duplicate a bucket.
 */

import { getPartsInTz, resolveTimezone } from "@/lib/timezoneUtils";
import { parseTimestamp, type ApiTimeseriesPoint } from "@/lib/api";

export type ReportHorizon = "daily" | "weekly" | "monthly" | "annual";

/** Tag shown in the card header — describes the BUCKET granularity. */
export const GRANULARITY_TAG: Record<ReportHorizon, string> = {
  daily: "ORARIO",
  weekly: "MEZZA GIORNATA",
  monthly: "GIORNALIERO",
  annual: "MENSILE",
};

export type ReportLang = "it" | "en";

const WEEKDAY_SHORT: Record<ReportLang, string[]> = {
  // index 0 = Sunday .. 6 = Saturday (matches Date.getUTCDay)
  it: ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};
const MONTH_SHORT: Record<ReportLang, string[]> = {
  it: ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (year: number, month1to12: number) =>
  new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
/** Day of week for a calendar date, tz-independent (0=Sun..6=Sat). */
const weekdayOf = (year: number, month1to12: number, day: number) =>
  new Date(Date.UTC(year, month1to12 - 1, day)).getUTCDay();
const isWeekendDate = (year: number, month1to12: number, day: number) => {
  const w = weekdayOf(year, month1to12, day);
  return w === 0 || w === 6;
};

// ============================================================================
// Horizon selection
// ============================================================================

/** The dashboard time-period values that map to report horizons. */
export type TimePeriod =
  | "today"
  | "week"
  | "month"
  | "mtd"
  | "year"
  | "ytd"
  | "custom"
  | string;

/**
 * Resolve the report horizon. Named periods map directly; a custom range is
 * classified by its span so the rule still applies to arbitrary ranges.
 */
export function horizonForPeriod(period: TimePeriod, start: Date, end: Date): ReportHorizon {
  switch (period) {
    case "today":
      return "daily";
    case "week":
      return "weekly";
    case "month":
    case "mtd":
      return "monthly";
    case "year":
    case "ytd":
      return "annual";
    default: {
      const hours = (end.getTime() - start.getTime()) / 36e5;
      if (hours <= 48) return "daily";
      if (hours <= 16 * 24) return "weekly";
      if (hours <= 70 * 24) return "monthly";
      return "annual";
    }
  }
}

/** UTC instant whose site-local wall clock is (y, m, d) at noon. Converges in
 *  a couple of iterations and is DST-safe (noon is never in a DST gap). */
function instantForLocalNoon(y: number, m: number, d: number, tz: string): Date {
  let utc = Date.UTC(y, m - 1, d, 12, 0, 0);
  for (let i = 0; i < 4; i++) {
    const p = getPartsInTz(new Date(utc), tz);
    const got = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    const want = Date.UTC(y, m - 1, d, 12, 0);
    const diff = want - got;
    if (diff === 0) break;
    utc += diff;
  }
  return new Date(utc);
}

/**
 * Enumeration end for a report table/chart: the NATURAL end of the horizon, so
 * a report shows every bucket of the period — including future ones (e.g. the
 * 26–30 of a month reported on the 25th). The data fetch still stops at `now`;
 * buckets past `now` come out empty and are flagged `future`.
 *
 * Only month/mtd (→ month end) and ytd (→ 31 Dec) extend past the fetch end;
 * rolling windows (today/week/year/custom) keep their own end — a rolling
 * window has no "future" inside it, and `daily` already spans all 24 hours.
 */
export function reportEnumerationEnd(
  period: TimePeriod,
  start: Date,
  fallbackEnd: Date,
  timezone: string | null | undefined,
): Date {
  const tz = resolveTimezone(timezone);
  const s = getPartsInTz(start, tz);
  if (period === "month" || period === "mtd") {
    return instantForLocalNoon(s.year, s.month, daysInMonth(s.year, s.month), tz);
  }
  if (period === "ytd") {
    return instantForLocalNoon(s.year, 12, 31, tz);
  }
  return fallbackEnd;
}

// ============================================================================
// Bucket skeleton (ordered, value-free)
// ============================================================================

interface BucketDef {
  key: string;
  label: string;
  weekend: boolean;
  /** Calendar coordinates in site-local time (for `now` matching). */
  y: number;
  m: number; // 1-12
  d: number; // day of month (daily uses the single day)
  slot: number; // hour 0-23 (daily), half 0/1 (weekly), 0 otherwise
}

/** Site-local calendar key of an instant, in the same shape as the skeleton keys. */
function localKey(instant: Date, tz: string, horizon: ReportHorizon): string | null {
  const p = getPartsInTz(instant, tz);
  switch (horizon) {
    case "daily":
      return `h${pad(p.hour)}`;
    case "weekly":
      return `${p.year}-${pad(p.month)}-${pad(p.day)}-${p.hour < 12 ? "A" : "B"}`;
    case "monthly":
      return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
    case "annual":
      return `${p.year}-${pad(p.month)}`;
  }
}

/** Iterate local calendar dates from start to end inclusive (integer math). */
function eachLocalDate(
  start: { y: number; m: number; d: number },
  end: { y: number; m: number; d: number },
  fn: (y: number, m: number, d: number) => void,
) {
  let { y, m, d } = start;
  // guard against pathological ranges
  for (let i = 0; i < 400; i++) {
    fn(y, m, d);
    if (y === end.y && m === end.m && d === end.d) return;
    d += 1;
    if (d > daysInMonth(y, m)) {
      d = 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
}

function enumerateBuckets(
  horizon: ReportHorizon,
  start: Date,
  end: Date,
  tz: string,
  lang: ReportLang,
): BucketDef[] {
  const s = getPartsInTz(start, tz);
  const e = getPartsInTz(end, tz);
  const wd = WEEKDAY_SHORT[lang];
  const mo = MONTH_SHORT[lang];
  const out: BucketDef[] = [];

  if (horizon === "daily") {
    // Single local day = the day of `start`.
    for (let h = 0; h < 24; h++) {
      out.push({
        key: `h${pad(h)}`,
        label: `${pad(h)}:00`,
        weekend: false, // daily uses occupancy, not weekend
        y: s.year,
        m: s.month,
        d: s.day,
        slot: h,
      });
    }
    return out;
  }

  if (horizon === "annual") {
    let y = s.year;
    let m = s.month;
    for (let i = 0; i < 48; i++) {
      out.push({
        key: `${y}-${pad(m)}`,
        label: mo[m - 1],
        weekend: false,
        y,
        m,
        d: 1,
        slot: 0,
      });
      if (y === e.year && m === e.month) break;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out;
  }

  // weekly / monthly: enumerate local dates
  eachLocalDate(
    { y: s.year, m: s.month, d: s.day },
    { y: e.year, m: e.month, d: e.day },
    (y, m, d) => {
      const weekend = isWeekendDate(y, m, d);
      if (horizon === "monthly") {
        out.push({
          key: `${y}-${pad(m)}-${pad(d)}`,
          label: `${pad(d)}/${pad(m)}`,
          weekend,
          y,
          m,
          d,
          slot: 0,
        });
      } else {
        // weekly: two half-day buckets per date
        const wname = wd[weekdayOf(y, m, d)];
        out.push({
          key: `${y}-${pad(m)}-${pad(d)}-A`,
          label: `${wname} 00–12`,
          weekend,
          y,
          m,
          d,
          slot: 0,
        });
        out.push({
          key: `${y}-${pad(m)}-${pad(d)}-B`,
          label: `${wname} 12–24`,
          weekend,
          y,
          m,
          d,
          slot: 1,
        });
      }
    },
  );
  return out;
}

/** Hours spanned by one canonical bucket (for coverage expectations). */
function bucketWindowHours(horizon: ReportHorizon, def: BucketDef): number {
  switch (horizon) {
    case "daily":
      return 1;
    case "weekly":
      return 12;
    case "monthly":
      return 24; // DST days are 23/25 but coverage tolerance absorbs it
    case "annual":
      return daysInMonth(def.y, def.m) * 24;
  }
}

// ============================================================================
// Builder
// ============================================================================

export interface BucketStats {
  /** kWh / m³ / mean depending on the series — `null` only if the bucket is empty. */
  value: number | null;
  /** Max across the bucket (value_max ?? value). `null` if empty. */
  peak: number | null;
  /** Min across the bucket (value_min ?? value). `null` if empty. */
  trough: number | null;
  sampleCount: number;
}

export interface ReportBucket extends BucketStats {
  key: string;
  label: string;
  coverage: number; // 0..1
  weekend: boolean;
  future: boolean;
  inProgress: boolean;
  incomplete: boolean; // coverage < threshold OR in-progress
  empty: boolean; // no samples at all
  alarm: boolean;
  alarmKind?: "above" | "below";
}

export interface ReportSeries {
  horizon: ReportHorizon;
  granularityTag: string; // GRANULARITY_TAG[horizon]
  buckets: ReportBucket[];
  summaryKind: "total" | "average";
  summaryValue: number | null;
  /** Count of non-empty, non-future buckets (for "N of M days" style notes). */
  populated: number;
  expected: number;
}

// ----------------------------------------------------------------------------
// Presentation payload — produced by the dashboard, consumed by the PDF layer.
// Kept here so both sides share one shape and can't drift.
// ----------------------------------------------------------------------------

export interface ReportTablePayload {
  /** Card title, e.g. "Consumo per bucket" / "Temperatura". */
  title: string;
  unit: string; // "kWh", "°C", "%", "m³", "ppm"
  decimals: number;
  /** Summary-row label: "Totale periodo" (total) or "Media periodo" (average). */
  summaryLabel: string;
  series: ReportSeries;
  /** Optional chart spec for the vector renderer (Fase D). */
  chart?: {
    kind: "bar" | "line";
    /** Threshold line (bar charts): dashed magenta + over-threshold shading. */
    threshold?: number;
    /** Target band (line charts): shaded comfort band with dashed borders. */
    targetMin?: number;
    targetMax?: number;
  };
}

export interface ReportAlarmRow {
  metric: string; // localized metric label
  when: string; // bucket label / instant
  value: string; // formatted value with unit
  threshold: string; // e.g. "> 1.000 ppm"
  severity: "warning" | "critical";
}

export interface ReportTables {
  horizon: ReportHorizon;
  /** Localized "one value every …" note for section subtitles + method notes. */
  granularityNote: string;
  energy?: ReportTablePayload;
  air?: ReportTablePayload[];
  water?: ReportTablePayload;
  alarms?: ReportAlarmRow[];
}

/** Localized "one value every …" sentence for the given horizon. */
export function granularityNote(horizon: ReportHorizon, lang: ReportLang): string {
  if (lang === "en") {
    const per: Record<ReportHorizon, string> = {
      daily: "one value per hour (24 points, site local time)",
      weekly: "one value per half-day (14 points: 00–12 and 12–24)",
      monthly: "one value per day (site local time)",
      annual: "one value per month (Jan–Dec)",
    };
    return `Aggregation: ${per[horizon]}.`;
  }
  const per: Record<ReportHorizon, string> = {
    daily: "un valore all'ora (24 punti, ora locale del sito)",
    weekly: "un valore ogni mezza giornata (14 punti: 00–12 e 12–24)",
    monthly: "un valore al giorno (ora locale del sito)",
    annual: "un valore al mese (gen–dic)",
  };
  return `Granularità: ${per[horizon]}.`;
}

export interface BuildSeriesArgs {
  points: ApiTimeseriesPoint[] | undefined | null;
  timezone: string | null | undefined;
  horizon: ReportHorizon;
  start: Date;
  end: Date;
  now: Date;
  lang?: ReportLang;
  /** Raw query bucket width in hours (0.25 for 15m, 1 for 1h, 24 for 1d). */
  rawBucketHours: number;
  /** 'total' sums the bucket values; 'average' means the non-empty buckets. */
  summaryKind: "total" | "average";
  /** Per-bucket value reducer (sum vs mean vs kWh is the caller's call). */
  reduce: (points: ApiTimeseriesPoint[]) => number | null;
  /** Coverage below this marks the bucket incomplete. Default 0.95. */
  coverageThreshold?: number;
  /** Optional alarm policy, evaluated per bucket. */
  checkAlarm?: (stats: BucketStats) => { kind: "above" | "below" } | null;
}

/** Numeric reading from a point, preferring the field matching the series. */
const peakOf = (p: ApiTimeseriesPoint): number | null => {
  const v = p.value_max ?? p.value ?? p.value_avg ?? p.value_sum;
  const n = Number(v);
  return v == null || !Number.isFinite(n) ? null : n;
};
const troughOf = (p: ApiTimeseriesPoint): number | null => {
  const v = p.value_min ?? p.value ?? p.value_avg ?? p.value_sum;
  const n = Number(v);
  return v == null || !Number.isFinite(n) ? null : n;
};
const tsOf = (p: ApiTimeseriesPoint): Date | null =>
  parseTimestamp(p.ts ?? p.ts_bucket ?? p.ts_hour ?? p.ts_day);

/**
 * Build the canonical bucket series for one metric family.
 */
export function buildReportSeries(args: BuildSeriesArgs): ReportSeries {
  const {
    points,
    horizon,
    start,
    end,
    now,
    rawBucketHours,
    summaryKind,
    reduce,
    coverageThreshold = 0.95,
    checkAlarm,
  } = args;
  const tz = resolveTimezone(args.timezone);
  const lang: ReportLang = args.lang === "en" ? "en" : "it";

  const defs = enumerateBuckets(horizon, start, end, tz, lang);

  // Assign points to buckets by their site-local key.
  const byKey = new Map<string, ApiTimeseriesPoint[]>();
  for (const p of points ?? []) {
    const t = tsOf(p);
    if (!t) continue;
    const key = localKey(t, tz, horizon);
    if (!key) continue;
    const arr = byKey.get(key);
    if (arr) arr.push(p);
    else byKey.set(key, [p]);
  }

  // Which bucket contains `now` (only relevant when the range reaches the present).
  const includesNow = end.getTime() >= now.getTime() - 60_000;
  const nowKey = includesNow ? localKey(now, tz, horizon) : null;
  const nowIndex = nowKey ? defs.findIndex((d) => d.key === nowKey) : -1;

  const buckets: ReportBucket[] = defs.map((def, i) => {
    const pts = byKey.get(def.key) ?? [];
    const empty = pts.length === 0;

    const value = empty ? null : reduce(pts);
    let peak: number | null = null;
    let trough: number | null = null;
    for (const p of pts) {
      const pk = peakOf(p);
      const tr = troughOf(p);
      if (pk != null) peak = peak == null ? pk : Math.max(peak, pk);
      if (tr != null) trough = trough == null ? tr : Math.min(trough, tr);
    }

    // Coverage: distinct raw timestamps present vs expected slots in the window.
    const expectedSlots = Math.max(1, Math.round(bucketWindowHours(horizon, def) / rawBucketHours));
    const seenTs = new Set<string>();
    for (const p of pts) {
      const t = tsOf(p);
      if (t) seenTs.add(t.toISOString());
    }
    const coverage = empty ? 0 : Math.min(1, seenTs.size / expectedSlots);

    const future = nowIndex >= 0 && i > nowIndex;
    const inProgress = nowIndex >= 0 && i === nowIndex;
    const incomplete = !empty && !future && (inProgress || coverage < coverageThreshold);

    const stats: BucketStats = { value, peak, trough, sampleCount: pts.length };
    const alarmRes = !empty && checkAlarm ? checkAlarm(stats) : null;

    return {
      ...stats,
      key: def.key,
      label: def.label,
      coverage,
      weekend: def.weekend,
      future,
      inProgress,
      incomplete,
      empty,
      alarm: !!alarmRes,
      alarmKind: alarmRes?.kind,
    };
  });

  // Summary row.
  const usable = buckets.filter((b) => !b.empty && !b.future && typeof b.value === "number");
  let summaryValue: number | null = null;
  if (usable.length > 0) {
    if (summaryKind === "total") {
      summaryValue = usable.reduce((acc, b) => acc + (b.value as number), 0);
    } else {
      summaryValue =
        usable.reduce((acc, b) => acc + (b.value as number), 0) / usable.length;
    }
  }

  return {
    horizon,
    granularityTag: GRANULARITY_TAG[horizon],
    buckets,
    summaryKind,
    summaryValue,
    populated: usable.length,
    expected: buckets.filter((b) => !b.future).length,
  };
}
