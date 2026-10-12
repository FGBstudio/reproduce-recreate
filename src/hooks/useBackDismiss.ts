/**
 * Pila unica degli overlay per il tasto Back Android (brief §2.2).
 *
 * Il back hardware arriva come evento cancelable `fgb:back` (dispatchato
 * dall'unico listener Capacitor in main.tsx). Prima lo ascoltava solo il
 * login sheet: con due overlay aperti il back usciva dall'app. Ora ogni
 * overlay aperto si registra qui; alla pressione si chiude SOLO l'ultimo
 * aperto (LIFO) e l'evento viene cancellato. A pila vuota il back segue
 * la navigazione normale: nessuna regressione.
 */
import { useEffect, useRef } from "react";

type Entry = { close: () => void };

const stack: Entry[] = [];
let listenerArmed = false;

function armListener() {
  if (listenerArmed || typeof window === "undefined") return;
  listenerArmed = true;
  window.addEventListener("fgb:back", (e: Event) => {
    const top = stack[stack.length - 1];
    if (top) {
      e.preventDefault();
      top.close();
    }
  });
}

/** Registra un overlay nella pila finché `open` è true. */
export function useBackDismiss(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    armListener();
    const entry: Entry = { close: () => closeRef.current() };
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
    };
  }, [open]);
}
