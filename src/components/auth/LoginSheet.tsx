/**
 * Login MOBILE come bottom sheet (SPEC mobile-landing-login §3): sale dal
 * basso sopra la landing sfocata. Riusa LoginForm cosi' com'e' (tutta la
 * logica auth resta la'): il foglio e' solo un contenitore pensato per la
 * tastiera e il pollice.
 *
 *  - chiusura: X, tap sullo scrim, swipe verso il basso sulla maniglia,
 *    Back di Android (evento fgb:back da main.tsx + fallback popstate);
 *  - max-height: 100dvh - --sat - 16px, e con la tastiera aperta segue
 *    visualViewport cosi' il bottone resta raggiungibile;
 *  - il submit di LoginForm viene reso sticky in fondo all'area scrollabile
 *    via CSS (sempre visibile sopra la tastiera, senza toccare il form);
 *  - campi a 16px (iOS non zooma al focus), altezza 54px, focus teal.
 * Niente librerie: transform + transizioni.
 */
import React, { useEffect, useRef, useState } from "react";
import LoginForm from "./LoginForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "login" | "request";
}

const LoginSheet: React.FC<Props> = ({ open, onOpenChange, initialMode = "login" }) => {
  const [vvh, setVvh] = useState<number | null>(null);
  const dragStart = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  /* tastiera: l'altezza utile e' quella del visualViewport */
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setVvh(Math.round(vv.height));
    vv.addEventListener("resize", onResize);
    onResize();
    return () => { vv.removeEventListener("resize", onResize); setVvh(null); };
  }, [open]);

  /* Back di Android: chiude lo sheet invece di uscire dalla app */
  useEffect(() => {
    if (!open) return;
    const onBack = (e: Event) => { e.preventDefault(); onOpenChange(false); };
    window.addEventListener("fgb:back", onBack);
    /* fallback web/gesto: uno stato fittizio nella history */
    window.history.pushState({ fgbSheet: 1 }, "");
    const onPop = () => onOpenChange(false);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("fgb:back", onBack);
      window.removeEventListener("popstate", onPop);
      if (window.history.state?.fgbSheet) window.history.back();
    };
  }, [open, onOpenChange]);

  /* swipe verso il basso sulla zona maniglia */
  const onGrabPointerDown = (e: React.PointerEvent) => { dragStart.current = e.clientY; };
  const onGrabPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current == null || !sheetRef.current) return;
    const dy = Math.max(0, e.clientY - dragStart.current);
    sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onGrabPointerUp = (e: React.PointerEvent) => {
    if (dragStart.current == null || !sheetRef.current) return;
    const dy = e.clientY - dragStart.current;
    dragStart.current = null;
    sheetRef.current.style.transform = "";
    if (dy > 80) onOpenChange(false);
  };

  const maxH = vvh
    ? `calc(${vvh}px - var(--sat) - 16px)`
    : "calc(100dvh - var(--sat) - 16px)";

  return (
    <>
      <style>{`
        .fgb-sheet input{font-size:16px !important;height:54px !important;border-radius:14px !important;background:#fff !important}
        .fgb-sheet input:focus{border-color:#009193 !important;box-shadow:0 0 0 3px rgba(0,145,147,.15) !important}
        .fgb-sheet textarea{font-size:16px !important;background:#fff !important;border-radius:14px !important}
        /* il submit resta visibile in fondo all'area scrollabile, sopra la
           tastiera, senza ristrutturare LoginForm */
        .fgb-sheet form button[type="submit"]{position:sticky;bottom:0;z-index:2}
        @media (prefers-reduced-motion: reduce){.fgb-sheet-anim{transition:none !important}}
      `}</style>

      {/* scrim */}
      <div
        onClick={() => onOpenChange(false)}
        className="fgb-sheet-anim fixed inset-0 z-[80]"
        style={{
          background: "rgba(6,18,21,.55)",
          WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)",
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
          transition: "opacity .3s",
        }}
        aria-hidden
      />

      {/* sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
        className="fgb-sheet fgb-sheet-anim fixed left-0 right-0 bottom-0 z-[90] flex flex-col"
        style={{
          maxHeight: maxH,
          background: "#f6f6f5", color: "#4a4b4d",
          borderRadius: "28px 28px 0 0",
          transform: open ? "none" : "translateY(105%)",
          transition: "transform .45s cubic-bezier(.2,.8,.2,1)",
          visibility: open ? "visible" : "hidden",
          transitionProperty: "transform, visibility",
        }}
      >
        <div
          className="shrink-0"
          style={{ touchAction: "none", cursor: "grab", padding: "10px 0 4px" }}
          onPointerDown={onGrabPointerDown}
          onPointerMove={onGrabPointerMove}
          onPointerUp={onGrabPointerUp}
          onPointerCancel={() => { dragStart.current = null; if (sheetRef.current) sheetRef.current.style.transform = ""; }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 4, background: "rgba(74,75,77,.25)", margin: "0 auto" }} />
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="absolute grid place-items-center rounded-full"
          style={{ right: 14, top: 14, width: 36, height: 36, background: "#eeefee", color: "#4a4b4d", fontSize: 18, border: 0, zIndex: 3 }}
        >
          ×
        </button>

        <div className="app-scroll flex-1" style={{ padding: "6px 22px calc(var(--sab) + 16px)" }}>
          <img src="/green.webp" alt="FGB" style={{ height: 28, width: "auto", marginTop: 6, marginBottom: 14 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          {/* Il form monta solo con lo sheet aperto: stato pulito a ogni apertura */}
          {open && <LoginForm initialMode={initialMode} theme="light" onSuccess={() => onOpenChange(false)} />}
        </div>
      </div>
    </>
  );
};

export default LoginSheet;
