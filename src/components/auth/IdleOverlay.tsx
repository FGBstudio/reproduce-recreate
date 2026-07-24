import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ACCENT = "#006367";

const IdleOverlay: React.FC<{
  targetRef: React.RefObject<HTMLElement>;
  delayMs?: number;
  onLoginClick?: () => void;
  onScrollHint?: () => void;
}> = ({ targetRef, delayMs = 3500, onLoginClick, onScrollHint }) => {
  const [visible, setVisible] = useState(false);
  const dismissedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (dismissedRef.current) return;
    const el = targetRef.current;
    if (!el) return;

    const start = () => {
      if (dismissedRef.current) return;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setVisible(true), delayMs);
    };
    const stop = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    const dismiss = () => {
      dismissedRef.current = true;
      setVisible(false);
      stop();
    };

    const onMove = () => {
      if (visible) {
        dismiss();
      } else {
        start();
      }
    };

    start();
    el.addEventListener("mousemove", onMove);
    el.addEventListener("pointerdown", dismiss);
    window.addEventListener("scroll", dismiss, { passive: true });
    window.addEventListener("keydown", dismiss);

    return () => {
      stop();
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("scroll", dismiss);
      window.removeEventListener("keydown", dismiss);
    };
  }, [targetRef, delayMs, visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
        >
          <motion.div
            initial={{ scale: 0.95, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 8 }}
            transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
            className="pointer-events-auto rounded-full bg-white/85 backdrop-blur-xl border border-black/[0.06] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)] px-7 py-4 flex items-center gap-5"
          >
            <p className="text-[13px] font-medium tracking-wide" style={{ color: "#1d1d1f" }}>
              Login or scroll down to discover
            </p>
            {onLoginClick && (
              <button
                type="button"
                onClick={() => {
                  onLoginClick();
                }}
                className="px-4 py-1.5 rounded-full text-[12px] font-semibold text-white uppercase tracking-wider"
                style={{ background: ACCENT }}
              >
                Sign in
              </button>
            )}
            {onScrollHint && (
              <button
                type="button"
                onClick={onScrollHint}
                className="text-[12px] font-medium uppercase tracking-wider"
                style={{ color: ACCENT }}
              >
                Discover ↓
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IdleOverlay;