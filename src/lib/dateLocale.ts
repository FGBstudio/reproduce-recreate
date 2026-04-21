import { it } from "date-fns/locale/it";
import { enUS } from "date-fns/locale/en-US";
import { fr } from "date-fns/locale/fr";
import { es } from "date-fns/locale/es";
import { zhCN } from "date-fns/locale/zh-CN";
import type { Language } from "@/contexts/LanguageContext";

/**
 * Returns the date-fns locale object for the given language.
 * Using direct imports instead of the index to prevent massive chunk sizes.
 */
export function getDateLocale(language: Language) {
  if (language === 'it') return it;
  if (language === 'fr') return fr;
  if (language === 'es') return es;
  if (language === 'zh') return zhCN;
  return enUS;
}
