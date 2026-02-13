/**
 * Timezone utilities for site-specific time display.
 *
 * All timestamps from the DB are in UTC. Charts must render them
 * in the **site's** local time, NOT the browser's local time.
 *
 * Uses the native Intl.DateTimeFormat API (no external dependencies).
 */

// =============================================================================
// Core conversion: UTC Date → parts in target IANA timezone
// =============================================================================

interface TzParts {
  year: number
  month: number   // 1-12
  day: number
  hour: number
  minute: number
  second: number
  weekday: string // "Mon", "Tue", ...
}

const partCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(tz: string): Intl.DateTimeFormat {
  if (!partCache.has(tz)) {
    partCache.set(
      tz,
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'short',
        hour12: false,
      })
    )
  }
  return partCache.get(tz)!
}

/**
 * Convert a UTC Date to its constituent parts in the given IANA timezone.
 */
export function getPartsInTz(utcDate: Date, tz: string): TzParts {
  const fmt = getFormatter(tz)
  const parts = fmt.formatToParts(utcDate)

  const find = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''

  return {
    year: Number(find('year')),
    month: Number(find('month')),
    day: Number(find('day')),
    hour: Number(find('hour') === '24' ? '0' : find('hour')),
    minute: Number(find('minute')),
    second: Number(find('second')),
    weekday: find('weekday'),
  }
}

// =============================================================================
// Formatting helpers for chart labels
// =============================================================================

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Format a UTC timestamp for chart X-axis labels in the site's timezone.
 *
 * @param utcDate  - Date object (UTC)
 * @param bucket   - The forced bucket: '15m' | '1h' | '1d'
 * @param tz       - IANA timezone string (e.g. 'Asia/Shanghai')
 * @param period   - Optional time period hint for context
 */
export function formatChartLabel(
  utcDate: Date,
  bucket: '15m' | '1h' | '1d' | string,
  tz: string,
  period?: 'today' | 'week' | 'month' | 'year' | 'custom'
): string {
  const p = getPartsInTz(utcDate, tz)

  if (bucket === '15m') {
    // 15-minute granularity: "HH:MM"
    return `${pad(p.hour)}:${pad(p.minute)}`
  }

  if (bucket === '1h') {
    if (period === 'today') {
      return `${pad(p.hour)}:00`
    }
    // Week/month: "dd/MM HH:00"
    return `${pad(p.day)}/${pad(p.month)} ${pad(p.hour)}:00`
  }

  // Daily granularity: "dd/MM"
  return `${pad(p.day)}/${pad(p.month)}`
}

/**
 * Format a UTC timestamp for tooltip display in the site's timezone.
 */
export function formatTooltipTime(utcDate: Date, tz: string): string {
  const p = getPartsInTz(utcDate, tz)
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`
}

/**
 * Get the short weekday name in the site's timezone (e.g. "Mon", "Tue").
 */
export function getWeekdayInTz(utcDate: Date, tz: string): string {
  return getPartsInTz(utcDate, tz).weekday
}

/**
 * Get the hour (0-23) in the site's timezone.
 */
export function getHourInTz(utcDate: Date, tz: string): number {
  return getPartsInTz(utcDate, tz).hour
}

/**
 * Resolve timezone: if value is missing, offset-based (UTC+X), or 'UTC',
 * return a safe fallback. Otherwise return the IANA string.
 */
export function resolveTimezone(tz: string | null | undefined): string {
  if (!tz || tz === 'UTC') return 'UTC'
  // Reject offset-style (UTC+1, GMT-5) — these don't handle DST
  if (/^(UTC|GMT)[+-]\d+$/i.test(tz)) return 'UTC'
  return tz
}
