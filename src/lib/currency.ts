/**
 * Currency support module.
 * Source of truth for supported currencies, symbols, and number formatting.
 */

export type CurrencyCode =
  | 'EUR' | 'USD' | 'GBP' | 'CHF' | 'JPY' | 'CNY'
  | 'AUD' | 'CAD' | 'SEK' | 'NOK' | 'DKK' | 'PLN'
  | 'AED' | 'SGD' | 'HKD';

export const SUPPORTED_CURRENCIES: { code: CurrencyCode; symbol: string; name: string }[] = [
  { code: 'EUR', symbol: '€',  name: 'Euro' },
  { code: 'USD', symbol: '$',  name: 'US Dollar' },
  { code: 'GBP', symbol: '£',  name: 'British Pound' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
  { code: 'JPY', symbol: '¥',  name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥',  name: 'Chinese Yuan' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' },
  { code: 'AED', symbol: 'د.إ',name: 'UAE Dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$',name: 'Hong Kong Dollar' },
];

const SUPPORTED_SET = new Set(SUPPORTED_CURRENCIES.map(c => c.code));

export function isSupportedCurrency(c: string | null | undefined): c is CurrencyCode {
  return !!c && SUPPORTED_SET.has(c as CurrencyCode);
}

export function getCurrencySymbol(code: CurrencyCode): string {
  return SUPPORTED_CURRENCIES.find(c => c.code === code)?.symbol ?? code;
}

const LANG_TO_LOCALE: Record<string, string> = {
  it: 'it-IT', en: 'en-US', fr: 'fr-FR', es: 'es-ES', zh: 'zh-CN',
};

export function localeFor(lang: string | undefined): string {
  return LANG_TO_LOCALE[lang ?? 'en'] ?? 'en-US';
}

export interface FormatMoneyOptions {
  /** Min/max fraction digits. Defaults: 0/0 for whole numbers, 2/2 for "precise". */
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
  /** "Standard" full number, "compact" => 12.3K. */
  notation?: 'standard' | 'compact';
  /** When true uses Intl currency formatting (e.g. "€ 1.234"); when false outputs `€1234`. */
  withSymbol?: boolean;
}

/**
 * Format a number as a currency amount, using the given locale.
 * No FX conversion is performed here.
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: CurrencyCode,
  locale = 'en-US',
  opts: FormatMoneyOptions = {},
): string {
  if (amount == null || !isFinite(amount)) return '—';
  const {
    maximumFractionDigits = 0,
    minimumFractionDigits = 0,
    notation = 'standard',
    withSymbol = true,
  } = opts;

  try {
    return new Intl.NumberFormat(locale, {
      style: withSymbol ? 'currency' : 'decimal',
      currency,
      maximumFractionDigits,
      minimumFractionDigits,
      notation,
    } as Intl.NumberFormatOptions).format(amount);
  } catch {
    const sym = getCurrencySymbol(currency);
    return `${sym}${Math.round(amount).toLocaleString(locale)}`;
  }
}

/**
 * Convert an amount from one currency to another using rates keyed on EUR base.
 * `rates` is a map quote->rate where 1 EUR = rate quote.
 * Returns null if the conversion is impossible.
 */
export function convertAmount(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: Record<string, number>,
): number | null {
  if (from === to) return amount;
  const fromRate = from === 'EUR' ? 1 : rates[from];
  const toRate = to === 'EUR' ? 1 : rates[to];
  if (!fromRate || !toRate) return null;
  const amountInEur = amount / fromRate;
  return amountInEur * toRate;
}