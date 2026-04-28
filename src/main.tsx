import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

/**
 * PWA / Service-Worker safety guard.
 * Service workers MUST NOT register inside the Lovable preview iframe or on
 * preview hosts — they would cache stale builds and break navigation.
 * If we detect an iframe or a Lovable preview hostname, we proactively
 * unregister any pre-existing service workers.
 */
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com"));

if ((isPreviewHost || isInIframe) && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

/**
 * Capacitor native bridges (StatusBar / SplashScreen) — only on real devices.
 * Imports are dynamic so the web bundle stays slim and browser users never pay
 * for native plugins they don't need.
 */
(async () => {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;

    const [{ StatusBar, Style }, { SplashScreen }, { App: CapApp }] =
      await Promise.all([
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
        import("@capacitor/app"),
      ]);

    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#002838" });
    }
    await SplashScreen.hide();

    // Android hardware back button: navigate back if possible, otherwise stay.
    CapApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
    });
  } catch {
    /* Capacitor not available — running in a normal browser */
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
