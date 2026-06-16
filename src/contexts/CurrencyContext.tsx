import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  CurrencyCode,
  convertAmount,
  formatMoney,
  isSupportedCurrency,
  localeFor,
  FormatMoneyOptions,
} from '@/lib/currency';

interface CurrencyContextType {
  /** Map quote-currency -> rate (1 EUR = rate quote). EUR always = 1. */
  rates: Record<string, number>;
  ratesLoaded: boolean;
  /** Convert amount across currencies. Returns null if rate is missing. */
  convert: (amount: number, from: CurrencyCode, to: CurrencyCode) => number | null;
  /**
   * Format a value already in source currency, optionally converting to display currency.
   * If conversion fails, the source currency is used as a fallback.
   */
  format: (
    amount: number | null | undefined,
    source: CurrencyCode,
    display?: CurrencyCode,
    opts?: FormatMoneyOptions,
  ) => string;
  /** Triggers a fresh fx-rates refresh via the edge function. */
  refreshRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

const LS_KEY = 'fx_rates_cache_v1';
const STALE_MS = 12 * 60 * 60 * 1000; // 12h

function readCache(): { rates: Record<string, number>; ts: number } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function writeCache(rates: Record<string, number>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ rates, ts: Date.now() }));
  } catch { /* ignore */ }
}

async function fetchRates(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('fx_rates').select('quote, rate');
  if (error) throw error;
  const map: Record<string, number> = { EUR: 1 };
  for (const row of data || []) {
    if (typeof row.rate === 'number' || typeof row.rate === 'string') {
      map[row.quote as string] = Number(row.rate);
    }
  }
  return map;
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const cached = readCache();
  const [bootRates] = useState<Record<string, number>>(cached?.rates ?? { EUR: 1 });

  const { data: rates = bootRates } = useQuery({
    queryKey: ['fx-rates'],
    queryFn: fetchRates,
    staleTime: STALE_MS,
    initialData: cached ? cached.rates : undefined,
  });

  // Trigger a backend refresh if cache is stale or has only EUR
  useEffect(() => {
    const isStale = !cached || Date.now() - cached.ts > STALE_MS;
    const tooSmall = !rates || Object.keys(rates).length < 5;
    if (isStale || tooSmall) {
      supabase.functions.invoke('fx-rates-refresh').catch(() => { /* silent */ });
    }
    if (rates && Object.keys(rates).length > 1) writeCache(rates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rates]);

  const convert = useCallback((amount: number, from: CurrencyCode, to: CurrencyCode) => {
    return convertAmount(amount, from, to, rates);
  }, [rates]);

  const format = useCallback((
    amount: number | null | undefined,
    source: CurrencyCode,
    display?: CurrencyCode,
    opts?: FormatMoneyOptions,
  ) => {
    if (amount == null || !isFinite(amount)) return '—';
    const target = isSupportedCurrency(display) ? display : source;
    const converted = target === source ? amount : convertAmount(amount, source, target, rates);
    if (converted == null && target !== source) {
      return amount === 0 ? formatMoney(0, target, localeFor(language), opts) : '—';
    }
    const finalCurrency = target;
    const finalAmount = converted == null ? amount : converted;
    return formatMoney(finalAmount, finalCurrency, localeFor(language), opts);
  }, [rates, language]);

  const refreshRates = useCallback(async () => {
    await supabase.functions.invoke('fx-rates-refresh');
  }, []);

  const value = useMemo<CurrencyContextType>(() => ({
    rates,
    ratesLoaded: Object.keys(rates).length > 1,
    convert,
    format,
    refreshRates,
  }), [rates, convert, format, refreshRates]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextType {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}