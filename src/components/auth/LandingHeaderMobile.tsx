/**
 * Header della landing mobile (brief §3.1, approvato 9/10).
 *
 * - In cima alla pagina è invisibile: l'hero ha tutto lo schermo.
 * - Scroll giù lo nasconde (translateY(-100%) + opacità 0), scroll su lo fa
 *   ricomparire. 320ms cubic-bezier(.2,.7,.2,1); con prefers-reduced-motion
 *   si anima solo l'opacità.
 * - Fondo bianco che sfuma in trasparenza verso il basso (~100px).
 * - A destra l'icona menu (due linee: lunga grigia, corta teal) apre un
 *   pannello bianco a mezza pagina con Certifications / Monitoring / Sign in,
 *   registrato nella pila del back (§2.2). Il velo sotto chiude al tocco.
 *
 * Il logo usa /green.webp come SEGNAPOSTO dichiarato: l'SVG ufficiale
 * ricolorato teal arriva con gli asset (§9).
 */
import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, LogIn, X } from "lucide-react";
import { useBackDismiss } from "@/hooks/useBackDismiss";

interface Props {
  scrollerRef: React.RefObject<HTMLDivElement>;
  links: { label: string; onClick: () => void }[];
  onSignIn: () => void;
}

const TEAL = "#009193";
const INKGREY = "#3f4649";

const LandingHeaderMobile: React.FC<Props> = ({ scrollerRef, links, onSignIn }) => {
  const [shown, setShown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  useBackDismiss(menuOpen, () => setMenuOpen(false));

  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    let last = sc.scrollTop;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = sc.scrollTop;
        const dy = y - last;
        last = y;
        if (y < 12) setShown(false);          // in cima: hero a tutto schermo
        else if (dy > 3) setShown(false);     // scroll giù → sparisce
        else if (dy < -3) setShown(true);     // scroll su → ricompare
      });
    };
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => { sc.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [scrollerRef]);

  // menu aperto = scroll della pagina bloccato (§3.1)
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    sc.style.overflowY = menuOpen ? "hidden" : "";
    return () => { sc.style.overflowY = ""; };
  }, [menuOpen, scrollerRef]);

  const logo = logoBroken ? (
    <span className="font-bold" style={{ fontSize: 18, letterSpacing: "-0.02em", color: TEAL }}>FGB</span>
  ) : (
    <img src="/green.webp" alt="FGB — Future Green Building" style={{ height: 20, width: "auto", display: "block" }} onError={() => setLogoBroken(true)} />
  );

  return (
    <>
      <style>{`
        .fgm-hdr{transition:transform .32s cubic-bezier(.2,.7,.2,1),opacity .32s cubic-bezier(.2,.7,.2,1)}
        @media (prefers-reduced-motion: reduce){.fgm-hdr{transition:opacity .32s ease}}
      `}</style>
      <header
        className="fgm-hdr fixed top-0 left-0 right-0 z-40"
        aria-hidden={!shown}
        style={{
          height: "calc(var(--sat, 0px) + 100px)",
          background: "linear-gradient(to bottom, #fff 0%, rgba(255,255,255,.94) 42%, rgba(255,255,255,.55) 70%, rgba(255,255,255,0) 100%)",
          transform: shown ? "none" : "translateY(-100%)",
          opacity: shown ? 1 : 0,
          pointerEvents: shown ? "auto" : "none",
        }}
      >
        <div className="flex items-center justify-between pl-5 pr-1" style={{ paddingTop: "calc(var(--sat, 0px) + 10px)" }}>
          {logo}
          {/* icona menu: due linee allineate a destra, presa 44×44 */}
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Menu"
            className="flex flex-col items-end justify-center" style={{ width: 44, height: 44, gap: 5, paddingRight: 12 }}>
            <span style={{ width: 16, height: 1.4, background: INKGREY, display: "block" }} />
            <span style={{ width: 10, height: 1.4, background: TEAL, display: "block" }} />
          </button>
        </div>
      </header>

      {/* ── Menu a mezza pagina ── */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[48]" style={{ background: "rgba(20,30,32,.38)" }} onClick={() => setMenuOpen(false)} aria-hidden />
          <div
            className="fixed top-0 left-0 right-0 z-[49] bg-white"
            style={{ borderRadius: "0 0 24px 24px", boxShadow: "0 10px 24px rgba(0,0,0,.14)", paddingTop: "calc(var(--sat, 0px) + 10px)" }}
            role="dialog" aria-modal="true"
          >
            <div className="flex items-center justify-between pl-5 pr-1">
              {logo}
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close" className="grid place-items-center" style={{ width: 44, height: 44 }}>
                <X className="w-5 h-5" style={{ color: INKGREY }} />
              </button>
            </div>
            <nav className="px-5 pt-2 pb-5">
              {links.map(l => (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => { setMenuOpen(false); l.onClick(); }}
                  className="w-full flex items-center justify-between uppercase"
                  style={{ minHeight: 52, fontSize: 15, letterSpacing: "0.16em", color: INKGREY, borderBottom: "1px solid rgba(63,70,73,.09)" }}
                >
                  {l.label}
                  <ChevronRight className="w-4 h-4" style={{ color: "rgba(63,70,73,.35)" }} />
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onSignIn(); }}
                className="w-full flex items-center justify-between uppercase font-semibold"
                style={{ minHeight: 52, fontSize: 15, letterSpacing: "0.16em", color: TEAL }}
              >
                Sign in
                <LogIn className="w-[18px] h-[18px]" strokeWidth={1.8} style={{ color: TEAL }} />
              </button>
            </nav>
          </div>
        </>
      )}
    </>
  );
};

export default LandingHeaderMobile;
