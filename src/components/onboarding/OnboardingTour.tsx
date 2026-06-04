import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useSpring, useTransform } from "framer-motion";
import { X, MousePointer2 } from "lucide-react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import type { StepPlacement } from "./onboardingSteps";

/* ── tokens (mirror FloatingBentoPanel.tsx) ─────────────────────────── */
const INK = "#1d1d1f";
const SUB = "#86868b";
const ACCENT = "#0a7d7a";
const ACCENT_SOFT = "rgba(10,125,122,0.18)";
const SURFACE = "rgba(255,255,255,0.92)";
const BORDER = "rgba(0,0,0,0.06)";
const EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

interface Rect { top: number; left: number; width: number; height: number }

/* ── helpers ────────────────────────────────────────────────────────── */

function useTargetRect(selector: string | undefined): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!selector) { setRect(null); return; }
    let raf = 0;
    let stopped = false;

    const measure = () => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    // Scroll target into view before locking on
    const el = document.querySelector(selector) as HTMLElement | null;
    if (el && typeof el.scrollIntoView === "function") {
      try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch {}
    }

    const loop = () => {
      if (stopped) return;
      measure();
      raf = requestAnimationFrame(loop);
    };
    loop();

    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [selector]);

  return rect;
}

function computeCardPos(rect: Rect | null, placement: StepPlacement, tipW: number, tipH: number) {
  const margin = 18;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect || placement === "center") {
    return {
      top: Math.max(24, vh / 2 - tipH / 2),
      left: Math.max(24, vw / 2 - tipW / 2),
      arrow: "none" as const,
    };
  }

  let top = rect.top + rect.height / 2 - tipH / 2;
  let left = rect.left + rect.width / 2 - tipW / 2;
  let arrow: "up" | "dn" | "lt" | "rt" = "up";

  switch (placement) {
    case "bottom":
      top = rect.top + rect.height + margin;
      left = rect.left + rect.width / 2 - tipW / 2;
      arrow = "up";
      break;
    case "top":
      top = rect.top - tipH - margin;
      left = rect.left + rect.width / 2 - tipW / 2;
      arrow = "dn";
      break;
    case "right":
      top = rect.top + rect.height / 2 - tipH / 2;
      left = rect.left + rect.width + margin;
      arrow = "lt";
      break;
    case "left":
      top = rect.top + rect.height / 2 - tipH / 2;
      left = rect.left - tipW - margin;
      arrow = "rt";
      break;
  }

  top = Math.max(16, Math.min(vh - tipH - 16, top));
  left = Math.max(16, Math.min(vw - tipW - 16, left));
  return { top, left, arrow };
}

/* ── Ghost cursor ───────────────────────────────────────────────────── */
const GhostCursor: React.FC<{ x: number; y: number; clicking: boolean }> = ({ x, y, clicking }) => {
  const sx = useSpring(x, { stiffness: 110, damping: 18, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 110, damping: 18, mass: 0.6 });
  useEffect(() => { sx.set(x); }, [x, sx]);
  useEffect(() => { sy.set(y); }, [y, sy]);
  const tx = useTransform(sx, (v) => `${v}px`);
  const ty = useTransform(sy, (v) => `${v}px`);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed z-[9300]"
      style={{ display: "none", left: tx as unknown as string, top: ty as unknown as string, transform: "translate(-6px,-4px)" }}
    >
      {/* halo */}
      <motion.div
        className="absolute -inset-3 rounded-full"
        style={{ background: ACCENT_SOFT }}
        animate={{ scale: clicking ? [1, 1.8, 1] : 1, opacity: clicking ? [0.6, 0, 0.6] : 0.5 }}
        transition={{ duration: 0.55, ease: EASE }}
      />
      <MousePointer2 className="relative w-5 h-5" style={{ color: ACCENT, fill: "white", strokeWidth: 1.5 }} />
      {/* click ripple */}
      <AnimatePresence>
        {clicking && (
          <motion.span
            key="ripple"
            className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ border: `2px solid ${ACCENT}` }}
            initial={{ width: 8, height: 8, opacity: 0.9 }}
            animate={{ width: 64, height: 64, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ── Spotlight mask (light backdrop with rounded cutout, click-through hole) ── */
const SpotlightMask: React.FC<{ rect: Rect | null }> = ({ rect }) => {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onR = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  const padding = 8;
  const radius = 16;

  return (
    <svg
      className="fixed inset-0 z-[9180]"
      width={vp.w}
      height={vp.h}
      style={{ pointerEvents: "none" }}
    >
      <defs>
        <mask id="ob-spot-mask">
          <rect x="0" y="0" width={vp.w} height={vp.h} fill="white" />
          {rect && (
            <rect
              x={rect.left - padding}
              y={rect.top - padding}
              width={rect.width + padding * 2}
              height={rect.height + padding * 2}
              rx={radius}
              ry={radius}
              fill="black"
            />
          )}
        </mask>
      </defs>
      {/* Light wash — keeps the page legible, unlike a dark overlay */}
      <rect
        x="0"
        y="0"
        width={vp.w}
        height={vp.h}
        fill="rgba(245,247,248,0.55)"
        mask="url(#ob-spot-mask)"
        style={{ pointerEvents: "auto" }}
      />
    </svg>
  );
};

/* ── Tour ───────────────────────────────────────────────────────────── */
export const OnboardingTour: React.FC = () => {
  const { isActive, steps, index, currentStep, next, prev, stop } = useOnboarding();

  const [autoPlay, setAutoPlay] = useState(true);
  const [clicking, setClicking] = useState(false);
  const advancedRef = useRef(false);

  // Skip steps whose selector is missing (defensive)
  useEffect(() => {
    if (!isActive || !currentStep) return;
    advancedRef.current = false;
    if (!currentStep.selector) return;
    let cancelled = false;
    // Wait briefly for selector — covers SPA route changes
    const start = Date.now();
    const check = () => {
      if (cancelled) return;
      const el = document.querySelector(currentStep.selector!);
      if (el) return;
      if (Date.now() - start > 1500) { next(); return; }
      setTimeout(check, 80);
    };
    check();
    return () => { cancelled = true; };
  }, [isActive, currentStep, next]);

  const rect = useTargetRect(currentStep?.selector);
  const placement = currentStep?.placement ?? "center";
  const TIP_W = placement === "center" ? 480 : 380;
  const TIP_H = 360;
  const pos = computeCardPos(rect, placement, TIP_W, TIP_H);

  // Ghost cursor position — defaults to off-screen so it springs in
  const cursorX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const cursorY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

  // Auto-click behaviour for "click" steps
  useEffect(() => {
    if (!isActive || !currentStep || currentStep.action !== "click") return;
    if (!autoPlay) return;
    if (!rect || !currentStep.selector) return;

    const delay = currentStep.autoAdvanceMs ?? 2600;
    const t1 = window.setTimeout(() => setClicking(true), delay - 500);
    const t2 = window.setTimeout(() => {
      // Try to click the underlying target — first child button if any
      const el = document.querySelector(currentStep.selector!) as HTMLElement | null;
      if (el) {
        const clickable =
          el.matches("button,a,input,select,[role='button']")
            ? el
            : (el.querySelector("button,a,[role='button']") as HTMLElement | null) ?? el;
        try { clickable.click(); } catch {}
      }
      setClicking(false);
      if (!advancedRef.current) {
        advancedRef.current = true;
        window.setTimeout(() => next(), 800);
      }
    }, delay);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [isActive, currentStep, rect, autoPlay, next]);

  // If user manually clicks the highlighted element, advance
  useEffect(() => {
    if (!isActive || !currentStep || currentStep.action !== "click" || !currentStep.selector) return;
    const el = document.querySelector(currentStep.selector) as HTMLElement | null;
    if (!el) return;
    const onClick = () => {
      if (advancedRef.current) return;
      advancedRef.current = true;
      setClicking(true);
      window.setTimeout(() => { setClicking(false); next(); }, 500);
    };
    el.addEventListener("click", onClick, true);
    return () => el.removeEventListener("click", onClick, true);
  }, [isActive, currentStep, next]);

  if (!isActive || !currentStep) return null;

  const total = steps.length;
  const isLast = index >= total - 1;
  const isFirst = index === 0;
  const isClickStep = currentStep.action === "click";

  return (
    <AnimatePresence>
      <motion.div
        key="ob-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: EASE }}
        className="fixed inset-0 z-[9100]"
        aria-live="polite"
      >
        {/* Light spotlight mask (full backdrop with rounded cutout over target) */}
        <SpotlightMask rect={rect} />

        {/* Spotlight ring (drawn above the mask) */}
        {rect && currentStep.selector && (
          <motion.div
            aria-hidden
            initial={false}
            animate={{
              top: rect.top - 8,
              left: rect.left - 8,
              width: rect.width + 16,
              height: rect.height + 16,
            }}
            transition={{ duration: 0.45, ease: EASE }}
            className="pointer-events-none fixed z-[9190] rounded-2xl"
            style={{
              border: `2px solid ${ACCENT}`,
              boxShadow: `0 0 0 6px ${ACCENT_SOFT}, 0 20px 50px rgba(0,0,0,0.10)`,
              animation: "obPulseLight 2.6s ease-in-out infinite",
            }}
          />
        )}

        {/* Ghost cursor */}
        {rect && currentStep.selector && (
          <GhostCursor x={cursorX} y={cursorY} clicking={clicking} />
        )}

        {/* Card */}
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="fixed z-[9210] rounded-[28px]"
          style={{
            top: pos.top,
            left: pos.left,
            width: TIP_W,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            boxShadow: "0 24px 60px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)",
            backdropFilter: "blur(22px)",
            WebkitBackdropFilter: "blur(22px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* soft teal halo behind card */}
          <div
            aria-hidden
            className="absolute -inset-px rounded-[28px] pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(10,125,122,0.08), transparent 60%)",
            }}
          />

          {/* Arrow */}
          {pos.arrow !== "none" && rect && (
            <span
              aria-hidden
              className="absolute w-3.5 h-3.5 rotate-45"
              style={{
                background: SURFACE,
                borderTop: pos.arrow === "up" ? `1px solid ${BORDER}` : "none",
                borderLeft: pos.arrow === "up" || pos.arrow === "lt" ? `1px solid ${BORDER}` : "none",
                borderBottom: pos.arrow === "dn" ? `1px solid ${BORDER}` : "none",
                borderRight: pos.arrow === "rt" || pos.arrow === "dn" ? `1px solid ${BORDER}` : "none",
                top: pos.arrow === "up" ? -8 : pos.arrow === "dn" ? "auto" : "50%",
                bottom: pos.arrow === "dn" ? -8 : "auto",
                left: pos.arrow === "lt" ? -8 : pos.arrow === "rt" ? "auto" : "50%",
                right: pos.arrow === "rt" ? -8 : "auto",
                transform:
                  pos.arrow === "up" || pos.arrow === "dn"
                    ? "translateX(-50%) rotate(45deg)"
                    : "translateY(-50%) rotate(45deg)",
              }}
            />
          )}

          <div className="relative px-7 pt-6 pb-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{
                  color: ACCENT,
                  background: `${ACCENT}14`,
                  border: `1px solid ${ACCENT}33`,
                }}
              >
                Step {index + 1} / {total}
              </span>
              <button
                onClick={() => stop()}
                aria-label="Close tour"
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-black/[0.04]"
                style={{ color: SUB, border: `1px solid ${BORDER}` }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Title + body */}
            <h3
              className="font-semibold tracking-tight leading-tight mb-2"
              style={{ color: INK, fontSize: "clamp(1.15rem, 1.6vw, 1.45rem)" }}
            >
              {currentStep.title}
            </h3>
            <p
              className="leading-relaxed"
              style={{ color: SUB, fontSize: 14 }}
              dangerouslySetInnerHTML={{ __html: currentStep.body }}
            />

            {/* Click-prompt hint */}
            {isClickStep && (
              <div
                className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium"
                style={{ background: `${ACCENT}10`, color: ACCENT, border: `1px solid ${ACCENT}22` }}
              >
                <MousePointer2 className="w-3 h-3" />
                {autoPlay ? "La freccia cliccherà tra poco — o fallo tu" : "Clicca l'elemento evidenziato"}
              </div>
            )}

            {/* Progress rail */}
            <div className="mt-5 flex gap-1.5">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className="flex-1 h-[3px] rounded-full transition-colors"
                  style={{
                    background:
                      i < index
                        ? ACCENT
                        : i === index
                        ? `${ACCENT}80`
                        : "rgba(0,0,0,0.08)",
                  }}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={prev}
                  disabled={isFirst}
                  className="text-[12px] font-medium transition-colors disabled:opacity-30"
                  style={{ color: SUB }}
                >
                  ← Back
                </button>
                {/* Auto-play toggle 
                <label
                  className="hidden sm:flex items-center gap-1.5 text-[11px] cursor-pointer select-none"
                  style={{ color: SUB }}
                >
                  <input
                    type="checkbox"
                    checked={autoPlay}
                    onChange={(e) => setAutoPlay(e.target.checked)}
                    className="accent-current"
                    style={{ accentColor: ACCENT }}
                  />
                  Auto-play
                </label> */}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => stop()}
                  className="px-4 py-2 rounded-full text-[12px] font-medium transition-colors hover:bg-black/[0.04]"
                  style={{ color: INK, border: `1px solid ${BORDER}` }}
                >
                  Jump tour
                </button>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={next}
                  className="px-5 py-2 rounded-full text-[12px] font-semibold text-white shadow-sm"
                  style={{ background: ACCENT }}
                >
                  {isLast ? "End" : "Next →"}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        <style>{`
          @keyframes obPulseLight {
            0%,100% { box-shadow: 0 0 0 6px ${ACCENT_SOFT}, 0 20px 50px rgba(0,0,0,0.10); }
            50%     { box-shadow: 0 0 0 14px rgba(10,125,122,0.06), 0 20px 50px rgba(0,0,0,0.10); }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingTour;
