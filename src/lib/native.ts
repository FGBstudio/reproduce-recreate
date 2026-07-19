/**
 * Integrazione "feel nativo" per l'app Capacitor.
 * Tutte le funzioni sono no-op sicure quando l'app gira nel browser (PWA/web):
 * nessun crash, nessun import condizionale richiesto nei componenti.
 */
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { App as CapApp } from "@capacitor/app";

const isNative = Capacitor.isNativePlatform();

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

/**
 * Back hardware Android: senza questo listener il tasto back CHIUDE l'app
 * da qualsiasi schermata. Con il listener: se c'è storia di navigazione fa
 * back interno; solo alla radice minimizza l'app (comportamento Android standard).
 */
export function registerAndroidBackButton(): void {
  if (!isNative) return;
  CapApp.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack && window.history.length > 1) {
      window.history.back();
    } else {
      CapApp.minimizeApp().catch(() => {});
    }
  });
}
