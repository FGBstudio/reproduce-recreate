import { it, enUS } from "date-fns/locale";
import type { Language } from "@/contexts/LanguageContext";

/**
 * Returns the date-fns locale object for the given language.
 */
export function getDateLocale(language: Language) {
  return language === 'it' ? it : enUS;
}
