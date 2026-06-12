import { useCurrency } from '@/contexts/CurrencyContext';
import { CurrencyCode, FormatMoneyOptions, isSupportedCurrency } from '@/lib/currency';

interface MoneyProps extends FormatMoneyOptions {
  /** Numeric amount in the `source` currency. */
  amount: number | null | undefined;
  /** Currency the amount is denominated in. Defaults to EUR. */
  source?: CurrencyCode | string | null;
  /** Currency to display. Defaults to source (no conversion). */
  display?: CurrencyCode | string | null;
  className?: string;
  /** Placeholder rendered when amount is null/NaN. */
  fallback?: string;
}

/**
 * Format and (optionally) convert a monetary value.
 * Single source of truth for currency rendering across the app.
 */
export function Money({
  amount,
  source,
  display,
  className,
  fallback = '—',
  ...opts
}: MoneyProps) {
  const { format } = useCurrency();
  if (amount == null || !isFinite(amount as number)) return <span className={className}>{fallback}</span>;
  const src: CurrencyCode = isSupportedCurrency(source) ? source : 'EUR';
  const dsp: CurrencyCode | undefined = isSupportedCurrency(display) ? display : undefined;
  return <span className={className}>{format(amount, src, dsp, opts)}</span>;
}