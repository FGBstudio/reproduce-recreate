/**
 * Grafico della vista Giorno (brief §6.1.6) — SVG puro, niente Recharts:
 * linea sottile teal con area tenue, SOLO i tratti sopra soglia colorati
 * (ambra, poi rosso) via clipPath — la linea non cambia mai colore intera;
 * limite tratteggiato con etichetta, linea «ora» con punto di fine serie,
 * picco annotato, assi a destra, tocco prolungato = cursore col valore,
 * swipe orizzontale = periodo precedente/successivo.
 * Nessuna animazione (§6.6): su mobile si paga in frame.
 */
import { useMemo, useRef, useState } from "react";
import { AMBER, AXIS, INK, RED, RULE, SUB, TEAL } from "./bits";
import type { DayPoint } from "./useModuleSeries";

const W = 390, H = 230, PT = 26, PB = 14, PL = 14, PR = 44;

interface Props {
  points: DayPoint[];
  unit: string;
  limit?: number;
  limitLabel?: string;   // es. «limite contratto 25 kW»
  limit2?: number;       // soglia rossa (opzionale)
  nowHour?: number;      // linea «ora» (solo se il periodo è oggi)
  nowLabel?: string;
  peak?: { h: number; v: number };
  peakLabel?: string;    // es. «picco 23,2 kW · 11:40»
  onSwipe?: (dir: 1 | -1) => void;
  fmt: (v: number) => string;
  /** Tetto dell'asse Y per scale chiuse (es. IAQ e umidità: 100). */
  yMax?: number;
}

const TimeSeriesChart = ({ points, unit, limit, limitLabel, limit2, nowHour, nowLabel, peak, peakLabel, onSwipe, fmt, yMax }: Props) => {
  const [cursor, setCursor] = useState<number | null>(null); // ora selezionata
  const pressTimer = useRef<number | undefined>(undefined);
  const pressing = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { maxV, x, y, linePath, areaPath, segs } = useMemo(() => {
    const vals = points.map(p => p.v).filter((v): v is number => v != null);
    const rawMax = Math.max(...vals, limit ?? 0, 1);
    const maxV = yMax != null ? yMax : Math.ceil((rawMax * 1.15) / 5) * 5;
    const x = (h: number) => PL + (h / 23) * (W - PL - PR);
    const y = (v: number) => PT + (1 - v / maxV) * (H - PT - PB);
    // segmenti contigui (i buchi spezzano la linea)
    const segs: DayPoint[][] = [];
    let cur: DayPoint[] = [];
    for (const p of points) {
      if (p.v == null) { if (cur.length) segs.push(cur); cur = []; }
      else cur.push(p);
    }
    if (cur.length) segs.push(cur);
    const d = (seg: DayPoint[]) => seg.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.h).toFixed(1)},${y(p.v!).toFixed(1)}`).join(" ");
    const linePath = segs.map(d).join(" ");
    const areaPath = segs.map(seg =>
      `${d(seg)} L${x(seg[seg.length - 1].h).toFixed(1)},${H - PB} L${x(seg[0].h).toFixed(1)},${H - PB} Z`
    ).join(" ");
    return { maxV, x, y, linePath, areaPath, segs };
  }, [points, limit, yMax]);

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY };
    pressing.current = false;
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => {
      pressing.current = true;
      updateCursor(e.clientX);
    }, 350);
  };
  const updateCursor = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fx = ((clientX - rect.left) / rect.width) * W;
    const h = Math.round(((fx - PL) / (W - PL - PR)) * 23);
    setCursor(Math.max(0, Math.min(23, h)));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (pressing.current) { updateCursor(e.clientX); return; }
    if (start.current && Math.abs(e.clientY - start.current.y) > 24) {
      window.clearTimeout(pressTimer.current); // è uno scroll: niente cursore
      start.current = null;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    window.clearTimeout(pressTimer.current);
    if (pressing.current) { pressing.current = false; setCursor(null); start.current = null; return; }
    if (start.current && onSwipe) {
      const dx = e.clientX - start.current.x;
      const dy = Math.abs(e.clientY - start.current.y);
      if (Math.abs(dx) > 50 && Math.abs(dx) > dy * 1.5) onSwipe(dx < 0 ? 1 : -1);
    }
    start.current = null;
  };

  const cursorPt = cursor != null ? points[cursor] : null;
  const gridYs = [maxV / 2, maxV];

  return (
    <div className="mt-2 select-none" style={{ touchAction: "pan-y" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full block"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <linearGradient id="mdArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity=".13" />
            <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
          </linearGradient>
          {limit != null && (
            <clipPath id="mdClipAmber">
              <rect x="0" y="0" width={W} height={Math.max(0, y(limit))} />
            </clipPath>
          )}
          {limit2 != null && (
            <clipPath id="mdClipRed">
              <rect x="0" y="0" width={W} height={Math.max(0, y(limit2))} />
            </clipPath>
          )}
        </defs>

        {/* griglia leggera + assi a destra */}
        {gridYs.map(gv => (
          <g key={gv}>
            <line x1={PL} x2={W - PR + 6} y1={y(gv)} y2={y(gv)} stroke={RULE} strokeWidth="1" />
            <text x={W - 2} y={y(gv) + 4} fontSize="10" fill={AXIS} textAnchor="end">{fmt(gv)}</text>
          </g>
        ))}
        <text x={W - 2} y={H - PB + 4} fontSize="10" fill={AXIS} textAnchor="end">0 {unit}</text>

        {/* limite tratteggiato con etichetta sopra a sinistra */}
        {limit != null && (
          <g>
            <line x1={PL} x2={W - PR + 6} y1={y(limit)} y2={y(limit)} stroke="#b9c9ca" strokeWidth="1.2" strokeDasharray="3 4" />
            {limitLabel && <text x={PL} y={y(limit) - 5} fontSize="10" fill={SUB}>{limitLabel}</text>}
          </g>
        )}

        {/* area + linea base (teal) */}
        <path d={areaPath} fill="url(#mdArea)" />
        <path d={linePath} fill="none" stroke={TEAL} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {/* la STESSA linea ritagliata sopra le soglie (§6.1.6) */}
        {limit != null && (
          <path d={linePath} fill="none" stroke={AMBER} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" clipPath="url(#mdClipAmber)" />
        )}
        {limit2 != null && (
          <path d={linePath} fill="none" stroke={RED} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" clipPath="url(#mdClipRed)" />
        )}

        {/* linea «ora» + punto di fine serie */}
        {nowHour != null && (
          <g>
            <line x1={x(nowHour)} x2={x(nowHour)} y1={PT - 10} y2={H - PB} stroke="#c8d6d7" strokeWidth="1.2" strokeDasharray="3 4" />
            {nowLabel && <text x={x(nowHour)} y={PT - 14} fontSize="10" fill={SUB} textAnchor="middle">{nowLabel}</text>}
            {(() => {
              const lastSeg = segs[segs.length - 1];
              const lastPt = lastSeg?.[lastSeg.length - 1];
              return lastPt ? <circle cx={x(lastPt.h)} cy={y(lastPt.v!)} r="4" fill="#fff" stroke={TEAL} strokeWidth="2" /> : null;
            })()}
          </g>
        )}

        {/* picco annotato */}
        {peak && (
          <g>
            <circle cx={x(peak.h)} cy={y(peak.v)} r="3.5" fill={limit != null && peak.v > (limit2 ?? Infinity) ? RED : limit != null && peak.v > limit ? AMBER : TEAL} />
            {peakLabel && (
              <text
                x={Math.min(x(peak.h) + 8, W - PR - 4)} y={Math.max(y(peak.v) - 8, 12)}
                fontSize="10" fontWeight="600" fill={INK}
                textAnchor={x(peak.h) > W * 0.6 ? "end" : "start"}
              >
                {peakLabel}
              </text>
            )}
          </g>
        )}

        {/* cursore da tocco prolungato */}
        {cursorPt && cursorPt.v != null && (
          <g>
            <line x1={x(cursorPt.h)} x2={x(cursorPt.h)} y1={PT - 6} y2={H - PB} stroke={INK} strokeWidth="1" />
            <circle cx={x(cursorPt.h)} cy={y(cursorPt.v)} r="4" fill={INK} />
            <g transform={`translate(${Math.max(PL + 34, Math.min(x(cursorPt.h), W - PR - 34))}, ${PT - 8})`}>
              <rect x="-36" y="-16" width="72" height="20" rx="10" fill={INK} />
              <text x="0" y="-2" fontSize="10.5" fontWeight="600" fill="#fff" textAnchor="middle">
                {fmt(cursorPt.v)} · {String(cursorPt.h).padStart(2, "0")}:00
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};

export default TimeSeriesChart;
