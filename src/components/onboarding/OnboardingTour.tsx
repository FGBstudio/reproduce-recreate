import React, { useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useOnboarding } from "@/contexts/OnboardingContext";
import type { StepPlacement } from "./onboardingSteps";

const ACCENT = "hsl(var(--fgb-accent))";
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface Rect { top: number; left: number; width: number; height: number }

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

    // Scroll target into view first
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

function computeTooltipPos(rect: Rect | null, placement: StepPlacement, tipW = 320, tipH = 220) {
  const margin = 14;
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

  // Clamp to viewport
  top = Math.max(16, Math.min(vh - tipH - 16, top));
  left = Math.max(16, Math.min(vw - tipW - 16, left));
  return { top, left, arrow };
}

export const OnboardingTour: React.FC = () => {
  const { isActive, steps, index, currentStep, next, prev, stop } = useOnboarding();

  // Skip steps whose selector is missing from the DOM (defensive).
  useEffect(() => {
    if (!isActive || !currentStep?.selector) return;
    const el = document.querySelector(currentStep.selector);
    if (!el) {
      // Advance silently — selector is not on this page.
      const t = window.setTimeout(() => next(), 250);
      return () => window.clearTimeout(t);
    }
  }, [isActive, currentStep, next]);

  const rect = useTargetRect(currentStep?.selector);
  const placement = currentStep?.placement ?? "center";
  const TIP_W = placement === "center" ? 420 : 320;
  const TIP_H = 240;
  const pos = computeTooltipPos(rect, placement, TIP_W, TIP_H);

  if (!isActive || !currentStep) return null;

  const total = steps.length;
  const isLast = index >= total - 1;
  const isFirst = index === 0;

  return (
    <AnimatePresence>
      <motion.div
        key="ob-root"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        className="fixed inset-0 z-[9200]"
        aria-live="polite"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          onClick={() => stop()}
        />

        {/* Spotlight ring */}
        {rect && currentStep.selector && (
          <motion.div
            aria-hidden
            initial={false}
            animate={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
            }}
            transition={{ duration: 0.4, ease: EASE }}
            className="pointer-events-none fixed rounded-[14px]"
            style={{
              border: `2px solid ${ACCENT}`,
              boxShadow: `0 0 0 4px hsl(var(--fgb-accent) / 0.18), 0 0 0 9999px rgba(0,0,0,0.0)`,
              animation: "obPulse 2.4s ease-in-out infinite",
            }}
          />
        )}

        {/* Tooltip card */}
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="fixed rounded-2xl border shadow-2xl"
          style={{
            top: pos.top,
            left: pos.left,
            width: TIP_W,
            background: "hsl(var(--popover) / 0.96)",
            borderColor: "hsl(var(--fgb-accent) / 0.3)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Arrow */}
          {pos.arrow !== "none" && rect && (
            <span
              aria-hidden
              className="absolute w-3 h-3 rotate-45"
              style={{
                background: "hsl(var(--popover) / 0.96)",
                borderTop: pos.arrow === "up" ? `1.5px solid hsl(var(--fgb-accent) / 0.3)` : "none",
                borderLeft: pos.arrow === "up" || pos.arrow === "lt" ? `1.5px solid hsl(var(--fgb-accent) / 0.3)` : "none",
                borderBottom: pos.arrow === "dn" ? `1.5px solid hsl(var(--fgb-accent) / 0.3)` : "none",
                borderRight: pos.arrow === "rt" || pos.arrow === "dn" ? `1.5px solid hsl(var(--fgb-accent) / 0.3)` : "none",
                top: pos.arrow === "up" ? -7 : pos.arrow === "dn" ? "auto" : "50%",
                bottom: pos.arrow === "dn" ? -7 : "auto",
                left: pos.arrow === "lt" ? -7 : pos.arrow === "rt" ? "auto" : "50%",
                right: pos.arrow === "rt" ? -7 : "auto",
                transform: (pos.arrow === "up" || pos.arrow === "dn")
                  ? "translateX(-50%) rotate(45deg)"
                  : "translateY(-50%) rotate(45deg)",
              }}
            />
          )}

          <div className="px-5 pt-4 pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2.5">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.08em]"
                style={{
                  color: ACCENT,
                  background: "hsl(var(--fgb-accent) / 0.12)",
                  border: `1px solid hsl(var(--fgb-accent) / 0.25)`,
                  fontFamily: "var(--font-mono, ui-monospace)",
                }}
              >
                Step {index + 1} of {total}
              </span>
              <button
                onClick={() => stop()}
                aria-label="Close tour"
                className="w-6 h-6 rounded-md border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Title + body */}
            <h3 className="text-[15px] font-bold text-foreground leading-tight mb-1.5">
              {currentStep.title}
            </h3>
            <p
              className="text-[12px] text-muted-foreground leading-[1.6] mb-3.5"
              dangerouslySetInnerHTML={{ __html: currentStep.body }}
            />

            {/* Progress pips */}
            <div className="flex gap-1 mb-3.5">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className="flex-1 h-[3px] rounded-full transition-colors"
                  style={{
                    background:
                      i < index ? ACCENT
                        : i === index ? `hsl(var(--fgb-accent) / 0.5)`
                          : "hsl(var(--muted-foreground) / 0.18)",
                  }}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={prev}
                disabled={isFirst}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground"
              >
                ← Back
              </button>
              <div className="flex gap-1.5">
                <button
                  onClick={() => stop()}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-medium border border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                >
                  Skip tour
                </button>
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={next}
                  className="px-4 py-1.5 rounded-lg text-[11px] font-bold transition-colors"
                  style={{ background: ACCENT, color: "hsl(var(--fgb-base))" }}
                >
                  {isLast ? "Finish" : "Next →"}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>

        <style>{`@keyframes obPulse{0%,100%{box-shadow:0 0 0 4px hsl(var(--fgb-accent)/0.18);}50%{box-shadow:0 0 0 10px hsl(var(--fgb-accent)/0.06);}}`}</style>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingTour;