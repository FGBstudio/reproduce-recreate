/**
 * Integrazione "feel nativo" per l'app Capacitor.
 * Tutte le funzioni sono no-op sicure quando l'app gira nel browser (PWA/web):
 * nessun crash, nessun import condizionale richiesto nei componenti.
 */
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

const isNative = Capacitor.isNativePlatform();

/** URL pubblico dell'app web (dominio custom, gia' nella allow-list Supabase):
    e' l'unico posto che puo' ricevere i link delle email di Supabase anche
    quando si usa l'app nativa — nel WebView `window.location.origin` e'
    capacitor://localhost e i link risulterebbero inapribili ovunque. */
const WEB_APP_URL = "https://xmonitoring.fgb-studio.com/";

/** Redirect per le email di auth (signup, reset password). */
export function authRedirectUrl(): string {
  if (isNative) return WEB_APP_URL;
  return window.location.origin + window.location.pathname;
}

/** Vibrazione leggera per i tap primari (selezioni, toggle, tab). */
export function hapticLight(): void {
  if (!isNative) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

/** Vibrazione media per azioni importanti (apertura sito, conferme). */
export function hapticMedium(): void {
  if (!isNative) return;
  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
}

/* Il listener del back hardware Android vive SOLO in main.tsx (fgb:back con
   contratto preventDefault + minimizeApp alla radice). La copia che stava qui
   ne ignorava il contratto e causava doppio history.back(): eliminata. */
