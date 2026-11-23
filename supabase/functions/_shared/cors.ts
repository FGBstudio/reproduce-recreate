// CORS condiviso per tutte le edge functions (audit A5, nov 2026).
//
// Prima ogni funzione dichiarava `Access-Control-Allow-Origin: *`: qualsiasi
// sito web poteva invocarle dal browser di un utente. Ora l'origine viene
// riflessa SOLO se sta nella lista; ogni altra richiesta browser riceve
// l'origine di produzione e il preflight fallisce.
//
// Nota onesta: il CORS ferma i browser, non `curl` — la vera protezione è
// l'autenticazione dentro ogni funzione. Questo è il secondo lucchetto.
//
// Le app native Capacitor hanno origini proprie: `capacitor://localhost`
// (iOS) e `https://localhost` (Android). Toglierle rompe le app.

const ALLOWED = new Set([
  "https://xmonitoring.fgb-studio.com", // produzione (dominio custom)
  "https://fgbstudio.github.io",        // GitHub Pages (fallback)
  "capacitor://localhost",              // app iOS
  "https://localhost",                  // app Android
]);

// Dev locale: qualunque porta su localhost/127.0.0.1, solo http
const DEV_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const ok = ALLOWED.has(origin) || DEV_RE.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : "https://xmonitoring.fgb-studio.com",
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  };
}
