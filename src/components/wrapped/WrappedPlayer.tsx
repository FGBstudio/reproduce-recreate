import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './styles/wrapped.css';
import { useWrapped } from './WrappedContext';
import { useSiteWeeklyWrap } from './hooks/useSiteWeeklyWrap';
import SlideWelcome from './slides/SlideWelcome';
import SlideEnergy from './slides/SlideEnergy';
import SlideRecap from './slides/SlideRecap';

const SLIDE_DUR = 6000;

const WrappedPlayer = () => {
  const { scope, close } = useWrapped();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // For now only the single-site variant is wired. Multi/admin will pick a different fetch.
  const siteId = scope?.kind === 'site' ? scope.siteId : null;
  const areaM2 = scope?.kind === 'site' ? scope.areaM2 : null;
  const siteName = scope?.kind === 'site' ? scope.siteName : (scope as any)?.label ?? '';
  const { data, isLoading } = useSiteWeeklyWrap(siteId, areaM2);

  // Reset on open
  useEffect(() => {
    if (!scope) return;
    setIdx(0); setPaused(false); setShowSplash(true);
    const t = setTimeout(() => setShowSplash(false), 2400);
    return () => clearTimeout(t);
  }, [scope]);

  const slides = scope?.kind === 'site' && data
    ? [
        <SlideWelcome key="w" siteName={siteName} weekLabel={data.weekLabel} />,
        <SlideEnergy key="e" data={data} />,
        <SlideRecap key="r" data={data} siteName={siteName} onDownload={handleDownload} isDownloading={downloading} />,
      ].filter(Boolean)
    : [];

  const total = slides.length;

  const go = useCallback((n: number) => {
    if (n < 0 || n >= total) return;
    setIdx(n);
  }, [total]);

  // Auto-advance
  useEffect(() => {
    if (showSplash || paused || total === 0) return;
    const t = setTimeout(() => {
      if (idx < total - 1) setIdx(i => i + 1);
    }, SLIDE_DUR);
    return () => clearTimeout(t);
  }, [idx, paused, showSplash, total]);

  // Keyboard
  useEffect(() => {
    if (!scope) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(idx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
      else if (e.key === 'Escape') close();
      else if (e.key.toLowerCase() === 'p') setPaused(p => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scope, idx, go, close]);

  function handleDownload() {
    // Light implementation: window.print of a recap HTML, like the original HTML does.
    if (!data || scope?.kind !== 'site') return;
    setDownloading(true);
    try {
      const w = window.open('', '_blank');
      if (!w) return;
      const fmt = (n: number | null) => n == null ? '—' : Math.round(n).toLocaleString('it-IT');
      const fmtPct = (n: number | null) => n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
      w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FGB Weekly Wrapped — ${siteName}</title>
        <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Century Gothic',sans-serif;background:#fff;color:#1a1a1a;-webkit-print-color-adjust:exact;}
        .cover{background:#00614A;color:#fff;padding:52px 48px;}.fgb{font-size:54px;font-weight:900;}.title{font-size:28px;font-weight:800;margin-top:14px;}.site{font-size:18px;opacity:.85;margin-top:6px;}.period{font-size:12px;letter-spacing:.12em;opacity:.6;margin-top:4px;}
        .body{padding:40px 48px;}.sec{font-size:18px;font-weight:800;color:#00614A;margin:24px 0 12px;padding-bottom:7px;border-bottom:2px solid #d4e8dc;}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px;}
        .card{border-radius:10px;padding:18px 20px;background:#f4f8f5;border:1px solid #d4e8dc;}.kl{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#666;}.kv{font-size:28px;font-weight:900;margin-top:6px;color:#00614A;}.kd{font-size:11px;font-weight:600;margin-top:4px;color:#666;}
        @media print{@page{margin:0;}}</style></head><body>
        <div class="cover"><div class="fgb">FGB</div><div class="title">Weekly Wrapped</div><div class="site">${siteName}</div><div class="period">${data.weekLabel}</div></div>
        <div class="body">
          <div class="sec">Key indicators</div>
          <div class="grid">
            <div class="card"><div class="kl">Energy</div><div class="kv">${fmt(data.energy.weekKwh)} kWh</div><div class="kd">${fmtPct(data.energy.deltaPct)} vs last week</div></div>
            <div class="card"><div class="kl">CO₂ saved</div><div class="kv">${fmt(data.co2.savedKg)} kg</div><div class="kd">≈ ${data.co2.treesEquiv ?? 0} trees/yr</div></div>
            <div class="card"><div class="kl">Avg CO₂ indoor</div><div class="kv">${data.air.avgCo2Ppm ?? '—'} ppm</div><div class="kd">${data.air.daysExcellent} excellent days</div></div>
            <div class="card"><div class="kl">Alerts</div><div class="kv">${data.alerts.activeNow}</div><div class="kd">${data.alerts.resolvedThisWeek} resolved this week</div></div>
          </div>
        </div>
        <script>window.onload=()=>window.print();<\/script></body></html>`);
      w.document.close();
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  }

  if (!scope) return null;

  return createPortal(
    <div className="wrapped-root" role="dialog" aria-modal="true">
      {showSplash && (
        <div className="wr-splash">
          <div className="wr-splash-glow" />
          <div className="wr-splash-mark">FGB</div>
        </div>
      )}

      <button className="wr-close" onClick={close} aria-label="Close">✕</button>

      <div className="wr-rail">
        {Array.from({ length: Math.max(total, 1) }).map((_, i) => (
          <div className="wr-seg" key={i}>
            <div
              className={`wr-seg-fill ${i < idx ? 'full' : i === idx && !paused ? 'active' : ''}`}
              style={i === idx && !paused ? { transitionDuration: `${SLIDE_DUR}ms` } : undefined}
            />
          </div>
        ))}
      </div>

      <div className="wr-cz left" onClick={() => go(idx - 1)} />
      <div className="wr-cz right" onClick={() => go(idx + 1)} />

      <div className="wr-nar left" style={{ opacity: idx === 0 ? 0.18 : 1 }} aria-hidden>‹</div>
      <div className="wr-nar right" style={{ opacity: idx >= total - 1 ? 0.18 : 1 }} aria-hidden>›</div>

      {isLoading || total === 0 ? (
        <div className="wr-slide on wr-bg-welcome">
          <div className="wr-empty">Preparing your weekly wrapped…</div>
        </div>
      ) : (
        slides[idx]
      )}

      <div className="wr-ctr">{idx + 1} / {Math.max(total, 1)}</div>
      <button className="wr-pause" onClick={() => setPaused(p => !p)} aria-label="Pause">{paused ? '▶' : '⏸'}</button>
    </div>,
    document.body
  );
};

export default WrappedPlayer;