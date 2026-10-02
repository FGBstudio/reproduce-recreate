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
    /* Status bar OVERLAY/traslucida (SPEC mobile §1.2): il colore di fondo
       e' continuo con la pagina; il contenuto si tiene sotto con --sat. */
    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    if (Capacitor.getPlatform() === "android") {
      /* Android < 15: env(safe-area-inset-*) resta 0 nella WebView.
         Misuriamo env() con un probe; se e' vuoto iniettiamo le inset
         dal plugin (getInfo().height) su --sat/--sab. */
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;top:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none";
      document.body.appendChild(probe);
      const envTop = probe.getBoundingClientRect().height;
      probe.remove();
      if (envTop < 1) {
        let h = 28; // fallback prudente se il plugin non espone l'altezza
        try {
          const info = (await StatusBar.getInfo()) as { height?: number };
          if (Number.isFinite(info?.height) && info.height! > 0) h = info.height!;
        } catch { /* noop */ }
        document.documentElement.style.setProperty("--sat", `${h}px`);
        document.documentElement.style.setProperty("--sab", "16px");
      }
    }
    await SplashScreen.hide();

    // Android hardware back button — UNICO listener dell'app: prima chance ai
    // layer aperti (es. login sheet, che chiama preventDefault su fgb:back),
    // poi navigazione; alla radice minimizza (comportamento Android standard).
    // Il secondo listener che viveva in lib/native.ts ignorava il contratto
    // preventDefault e faceva doppio history.back(): rimosso.
    CapApp.addListener("backButton", ({ canGoBack }) => {
      const ev = new CustomEvent("fgb:back", { cancelable: true });
      const proceed = window.dispatchEvent(ev); // false se preventDefault()
      if (!proceed) return;
      if (canGoBack) window.history.back();
      else CapApp.minimizeApp().catch(() => {});
    });

    // Deep link (schema com.fgb.world://...): i frammenti di Supabase Auth
    // (#access_token / type=recovery / #error) vengono rimessi nell'hash,
    // dove AuthContext li consuma e riporta l'utente su #/auth.
    CapApp.addListener("appUrlOpen", ({ url }) => {
      try {
        const hashIdx = url.indexOf("#");
        const frag = hashIdx >= 0 ? url.slice(hashIdx) : "";
        if (/access_token|type=recovery|error/.test(frag)) {
          window.location.hash = frag;
        } else if (frag.startsWith("#/")) {
          window.location.hash = frag; // rotta interna condivisa via link
        }
      } catch { /* URL non parsabile: ignora */ }
    });
  } catch {
    /* Capacitor not available — running in a normal browser */
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
