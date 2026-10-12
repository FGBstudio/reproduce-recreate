import * as React from "react";

/**
 * Brief mobile §2.1: il layout si decide SOLO su punti CSS via matchMedia —
 * mai pixel fisici, devicePixelRatio o user-agent. Un telefono in orizzontale
 * (fino a ~956pt di larghezza ma basso e touch) resta MOBILE: senza la
 * seconda clausola un iPhone ruotato (844×390) riceveva il layout desktop
 * in 390pt di altezza. La stessa condizione vive nel CSS (index.css).
 */
const MOBILE_QUERY =
  "(max-width: 767px), ((pointer: coarse) and (max-height: 500px))";

export function useIsMobile() {
  // Inizializzazione sincrona: con `undefined` il primo render è sempre
  // "desktop" e su telefono si vedeva un frame della vista sbagliata.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(() =>
    typeof window === "undefined" ? undefined : window.matchMedia(MOBILE_QUERY).matches,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
