import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './styles/wrapped.css';
import { useWrapped } from './WrappedContext';
import { useSiteMonthlyWrap } from './hooks/useSiteMonthlyWrap';
import { useAggregateWeeklyWrap } from './hooks/useAggregateWeeklyWrap';
import { useMonoSiteSlides } from './variants/MonoSiteWrapped';
import { useAggregateSlides } from './variants/AggregateWrapped';
import { useAdminGlobalSlides } from './variants/AdminGlobalWrapped';
import { generateSitePdf, generateAggregatePdf, generateGlobalPdf } from './lib/wrappedPdf';

const SLIDE_DUR = 6000;

const WrappedPlayer = () => {
  const { scope, close } = useWrapped();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Always-call hooks (return early-empty results when scope kind doesn't match).
  const siteId = scope?.kind === 'site' ? scope.siteId : null;
  const siteName = scope?.kind === 'site' ? scope.siteName : '';
  const areaM2 = scope?.kind === 'site' ? scope.areaM2 ?? null : null;
  const siteQ = useSiteMonthlyWrap(siteId, areaM2);

  const aggSites = scope && scope.kind !== 'site' ? scope.sites : [];
  const aggLabel = scope && scope.kind !== 'site' ? scope.label : '';
  const aggQ = useAggregateWeeklyWrap(scope?.kind === 'aggregate' ? aggSites : []);
  const globalQ = useAggregateWeeklyWrap(scope?.kind === 'admin-global' ? aggSites : []);

  const handleDownload = useCallback(() => {
    if (!scope) return;
    setDownloading(true);
    try {
      if (scope.kind === 'site' && siteQ.data) {
        generateSitePdf(siteQ.data, scope.siteName);
      } else if (scope.kind === 'aggregate' && aggQ.data) {
        generateAggregatePdf(aggQ.data, scope.label);
      } else if (scope.kind === 'admin-global' && globalQ.data) {
        generateGlobalPdf(globalQ.data);
      }
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  }, [scope, siteQ.data, aggQ.data, globalQ.data]);

  const mono = useMonoSiteSlides({
    siteId: siteId ?? '',
    siteName,
    areaM2,
    onDownload: handleDownload,
    isDownloading: downloading,
  });
  const aggregate = useAggregateSlides({
    label: aggLabel,
    sites: scope?.kind === 'aggregate' ? aggSites : [],
    onDownload: handleDownload,
    isDownloading: downloading,
  });
  const adminGlobal = useAdminGlobalSlides({
    sites: scope?.kind === 'admin-global' ? aggSites : [],
    onDownload: handleDownload,
    isDownloading: downloading,
  });

  const active = scope?.kind === 'site' ? mono
    : scope?.kind === 'aggregate' ? aggregate
    : scope?.kind === 'admin-global' ? adminGlobal
    : { slides: [], isLoading: false, isEmpty: true };

  const slides = active.slides;
  const isLoading = active.isLoading;
  const total = slides.length;

  // Reset on open
  useEffect(() => {
    if (!scope) return;
    setIdx(0); setPaused(false); setShowSplash(true);
    const t = setTimeout(() => setShowSplash(false), 2400);
    return () => clearTimeout(t);
  }, [scope]);

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