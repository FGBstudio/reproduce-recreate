import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Banner globale di stato offline. Senza questo, a rete assente l'app
 * mostrava spinner e vuoti senza spiegare il perché: l'utente non sa se il
 * problema è suo, della rete o del sito monitorato.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 rounded-full bg-amber-500/95 text-amber-950 text-[12px] font-semibold px-4 py-2 shadow-lg"
      style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
      Sei offline — i dati potrebbero non essere aggiornati
    </div>
  );
}
