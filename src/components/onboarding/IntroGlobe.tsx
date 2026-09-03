/**
 * Globo stilizzato dell'intro (SPEC §4.2): SVG con proiezione ortografica
 * calcolata da lat/lng. Il centro della proiezione e' la sede selezionata
 * (latitudine limitata a ±35° per non ribaltare il globo); al cambio sede
 * il globo RUOTA fino alla nuova (~700ms, easing out). I pin sull'emisfero
 * nascosto non vengono renderizzati (prodotto scalare < 0).
 * Selezionata = pin bordeaux con anello che pulsa; le altre = punti bianchi
 * cliccabili e navigabili da tastiera. Niente mappa geografica reale: e' il
 * globo grafico del company profile, come da spec.
 */
import React, { useEffect, useRef, useState } from 'react';
import { INTRO_LOCATIONS, IntroLocation } from '@/lib/intro/locations';

const R = 200;
const CX = 330;
const CY = 210;
const DEG = Math.PI / 180;
const LAT_CLAMP = 35;

interface Projected {
  loc: IntroLocation;
  x: number;
  y: number;
  visible: boolean;
}

function project(loc: IntroLocation, lon0: number, lat0: number): Projected {
  const phi = loc.lat * DEG;
  const lam = (loc.lng - lon0) * DEG;
  const phi0 = lat0 * DEG;
  const cosc = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
  const x = CX + R * Math.cos(phi) * Math.sin(lam);
  const y = CY - R * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lam));
  return { loc, x, y, visible: cosc > 0 };
}

interface Props {
  selectedSlug: string;
  onSelect: (slug: string) => void;
}

const IntroGlobe: React.FC<Props> = ({ selectedSlug, onSelect }) => {
  const selected = INTRO_LOCATIONS.find(l => l.slug === selectedSlug) ?? INTRO_LOCATIONS[0];
  const target = { lon: selected.lng, lat: Math.max(-LAT_CLAMP, Math.min(LAT_CLAMP, selected.lat)) };

  // Centro corrente della proiezione: parte GIA' sulla sede iniziale (§4.2:
  // al primo render nessuna rotazione), poi anima verso il target.
  const [center, setCenter] = useState(target);
  const centerRef = useRef(center);
  centerRef.current = center;
  const rafRef = useRef<number>();

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = { ...centerRef.current };
    // longitudine per la via piu' corta (es. Tokyo -> Los Angeles via Pacifico)
    let dLon = target.lon - from.lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const dLat = target.lat - from.lat;
    if (Math.abs(dLon) < 0.01 && Math.abs(dLat) < 0.01) return;
    if (reduce) { setCenter(target); return; }
    const t0 = performance.now();
    const DUR = 700;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / DUR);
      const e = 1 - Math.pow(1 - p, 3);
      setCenter({ lon: from.lon + dLon * e, lat: from.lat + dLat * e });
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlug]);

  const pts = INTRO_LOCATIONS.map(l => project(l, center.lon, center.lat));
  const sel = pts.find(p => p.loc.slug === selected.slug);

  const key = (e: React.KeyboardEvent, slug: string) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(slug); }
  };

  return (
    <div aria-label={`FGB locations worldwide, selected: ${selected.name}`} role="group">
      <svg viewBox="0 0 600 420" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <radialGradient id="fgb-globe-g" cx="38%" cy="32%" r="75%">
            <stop offset="0" stopColor="#e6f4f5" />
            <stop offset=".55" stopColor="#9fd5d9" />
            <stop offset="1" stopColor="#009193" />
          </radialGradient>
          <clipPath id="fgb-globe-c"><circle cx={CX} cy={CY} r={R} /></clipPath>
        </defs>
        <circle cx={CX} cy={CY} r={R} fill="url(#fgb-globe-g)" />
        <g clipPath="url(#fgb-globe-c)" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1">
          <ellipse cx={CX} cy={CY} rx={R} ry={R} />
          <ellipse cx={CX} cy={CY} rx={R * 0.7} ry={R} />
          <ellipse cx={CX} cy={CY} rx={R * 0.35} ry={R} />
          <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} />
          <ellipse cx={CX} cy={CY} rx={R} ry={R * 0.7} />
          <ellipse cx={CX} cy={CY} rx={R} ry={R * 0.35} />
          <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} />
        </g>

        {/* linea sottile dal pin selezionato verso il collage (a sinistra) */}
        {sel?.visible && (
          <line x1={20} y1={sel.y} x2={sel.x - 18} y2={sel.y} stroke="#4a4b4d" strokeOpacity=".35" strokeWidth="1" />
        )}

        {/* altre sedi: punti bianchi cliccabili (area di click >= 24px) */}
        {pts.filter(p => p.visible && p.loc.slug !== selected.slug).map(p => (
          <g
            key={p.loc.slug}
            role="button"
            tabIndex={0}
            aria-pressed={false}
            aria-label={p.loc.name}
            style={{ cursor: 'pointer', outline: 'none' }}
            onClick={() => onSelect(p.loc.slug)}
            onKeyDown={e => key(e, p.loc.slug)}
          >
            <title>{p.loc.name}</title>
            <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={3.2} fill="#fff" fillOpacity=".9" />
          </g>
        ))}

        {/* sede selezionata: pin bordeaux + anello che pulsa */}
        {sel?.visible && (
          <g aria-label={`${selected.name} (selected)`}>
            <circle className="fgb-globe-ring" cx={sel.x} cy={sel.y} r={18} fill="none" stroke="#931841" strokeWidth="2" style={{ transformOrigin: `${sel.x}px ${sel.y}px` }} />
            <path
              d={`M${sel.x} ${sel.y - 40}a14 14 0 0 0-14 14c0 10 14 26 14 26s14-16 14-26a14 14 0 0 0-14-14z`}
              fill="#931841"
            />
            <circle cx={sel.x} cy={sel.y - 26} r={5} fill="#fff" />
          </g>
        )}
      </svg>
      <style>{`
        .fgb-globe-ring{animation:fgb-globe-ring 2.6s ease-out infinite}
        @keyframes fgb-globe-ring{0%{transform:scale(.3);opacity:.9}100%{transform:scale(1.6);opacity:0}}
        @media (prefers-reduced-motion:reduce){.fgb-globe-ring{animation:none;opacity:.5}}
      `}</style>
    </div>
  );
};

export default IntroGlobe;
