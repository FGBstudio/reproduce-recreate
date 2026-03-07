import { it, enUS, fr, es } from "date-fns/locale";
import type { Language } from "@/contexts/LanguageContext";

/**
 * Returns the date-fns locale object for the given language.
 */
export function getDateLocale(language: Language) {
  if (language === 'it') return it;
  if (language === 'fr') return fr;
  if (language === 'es') return es;
  return enUS;
}
