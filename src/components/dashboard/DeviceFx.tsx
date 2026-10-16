/**
 * Il movimento che dice COSA sta misurando il dispositivo, nelle facciate
 * mobile (§5.4). Due linguaggi distinti, entrambi SVG puro — niente
 * librerie, niente asset:
 *
 *  · EnergyCircuitFx — tracce di circuito con pacchetti di luce che
 *    scorrono verso il dispositivo (Powerwall / Polestar): la VELOCITÀ e
 *    la densità dei pacchetti seguono il carico reale del sito.
 *  · AirRibbonFx — nastri d'aria traslucidi che ondeggiano da sinistra a
 *    destra attraversando la sonda (MyDyson / Apple Weather): la calma
 *    del flusso segue la qualità dell'aria misurata.
 *
 * `level` è 0…1 (0 = calmo/poco carico, 1 = intenso). Con
 * prefers-reduced-motion tutto resta fermo: le forme restano, il moto no.
 */

interface FxProps {
  /** 0…1 — da telemetria reale; senza dato si usa un valore di riposo */
  level: number;
  /** facciata chiara (inchiostro scuro) o scura (inchiostro bianco) */
  light?: boolean;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.3);

/* ── ENERGIA ─────────────────────────────────────────────────────────
   Tre tracce che convergono nel dispositivo. Ogni traccia ha una linea
   di base spenta e un pacchetto luminoso che la percorre: più sale il
   carico, più i pacchetti corrono e si avvicinano. */
export const EnergyCircuitFx = ({ level, light }: FxProps) => {
  const k = clamp01(level);
  const ink = light ? "rgba(1,71,75," : "rgba(255,255,255,";
  // 3,4 s a riposo → 1,1 s a pieno carico
  const dur = 3.4 - 2.3 * k;
  // le tracce entrano dai bordi e terminano sul corpo del dispositivo
  const traces = [
    { d: "M0,14 H56 Q74,14 74,32 V60", delay: 0 },
    { d: "M200,24 H152 Q134,24 134,42 V62", delay: dur * 0.38 },
    { d: "M0,110 H44 Q62,110 62,92 V68", delay: dur * 0.66 },
    { d: "M200,116 H144 Q126,116 126,98 V72", delay: dur * 0.2 },
  ];
  const nodes = [
    { x: 74, y: 60 }, { x: 134, y: 62 }, { x: 62, y: 68 }, { x: 126, y: 72 },
  ];
  return (
    <svg
      viewBox="0 0 200 130" aria-hidden
      style={{ position: "absolute", width: "128%", top: "6%", left: "-14%", overflow: "visible", pointerEvents: "none" }}
    >
      <defs>
        <mask id="fx-energy-fade">
          <linearGradient id="fx-energy-grad" gradientUnits="userSpaceOnUse" x1="0" x2="200">
            <stop offset="0" stopColor="#000" />
            <stop offset="0.16" stopColor="#fff" />
            <stop offset="0.84" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <rect x="-20" y="-20" width="240" height="170" fill="url(#fx-energy-grad)" />
        </mask>
      </defs>
      <g mask="url(#fx-energy-fade)">
        {traces.map((tr, i) => (
          <g key={i}>
            {/* traccia spenta */}
            <path d={tr.d} fill="none" stroke={`${ink}.28)`} strokeWidth="1.4" strokeLinecap="round" />
            {/* scia che precede il pacchetto, in dissolvenza */}
            <path
              d={tr.d} fill="none" stroke={`${ink}.4)`} strokeWidth="2" strokeLinecap="round"
              className="animate-fx-packet motion-reduce:animate-none"
              style={{
                strokeDasharray: "34 340",
                animationDuration: `${dur.toFixed(2)}s`,
                animationDelay: `${(tr.delay - 0.1).toFixed(2)}s`,
              }}
            />
            {/* pacchetto di luce */}
            <path
              d={tr.d} fill="none" stroke={`${ink}1)`} strokeWidth="2.6" strokeLinecap="round"
              className="animate-fx-packet motion-reduce:animate-none"
              style={{
                strokeDasharray: "20 354",
                animationDuration: `${dur.toFixed(2)}s`,
                animationDelay: `${tr.delay.toFixed(2)}s`,
                filter: light ? "drop-shadow(0 0 3px rgba(1,71,75,.5))" : "drop-shadow(0 0 6px rgba(255,255,255,.9))",
              }}
            />
          </g>
        ))}
        {/* il punto in cui la corrente entra nel dispositivo */}
        {nodes.map((n, i) => (
          <circle
            key={`n${i}`} cx={n.x} cy={n.y} r="2.6" fill={`${ink}.85)`}
            className="animate-fx-spark motion-reduce:animate-none"
            style={{
              animationDuration: `${dur.toFixed(2)}s`,
              animationDelay: `${(traces[i].delay + dur * 0.45).toFixed(2)}s`,
              filter: light ? undefined : "drop-shadow(0 0 5px rgba(255,255,255,.9))",
            }}
          />
        ))}
      </g>
    </svg>
  );
};

/* ── ARIA ────────────────────────────────────────────────────────────
   Cinque nastri che scorrono e ondeggiano. L'onda si ripete ogni 100
   unità e l'animazione trasla esattamente di un periodo: il ciclo non
   ha giunture. Aria buona = nastri lenti e distesi. */
export const AirRibbonFx = ({ level }: FxProps) => {
  const k = clamp01(level);
  /* l'aria si legge chiara: nastri bianchi traslucidi sul fondo acqua
     della facciata, come una foschia che passa (MyDyson / Apple Weather) */
  const ink = "255,255,255";
  const ribbons = [
    { y: 10, amp: 8, w: 1.4, o: 0.34, s: 16.5 },
    { y: 30, amp: 12, w: 2.2, o: 0.55, s: 13 },
    { y: 52, amp: 9, w: 3, o: 0.72, s: 10.5 },
    { y: 74, amp: 13, w: 2, o: 0.5, s: 14 },
    { y: 94, amp: 7, w: 1.3, o: 0.3, s: 17.5 },
  ];
  // più l'aria è carica, più il flusso si muove: 1× … 1,9×
  const speed = 1 + 0.9 * k;
  const wave = (y: number, a: number) => {
    let d = `M-100,${y}`;
    for (let x = -100; x < 320; x += 50) d += ` q 25,${a} 50,0 q 25,${-a} 50,0`;
    return d;
  };
  return (
    <svg
      viewBox="0 0 200 110" aria-hidden
      style={{ position: "absolute", width: "150%", top: "8%", left: "-25%", overflow: "visible", pointerEvents: "none" }}
    >
      <defs>
        <mask id="fx-air-fade">
          <linearGradient id="fx-air-grad" gradientUnits="userSpaceOnUse" x1="0" x2="200">
            <stop offset="0" stopColor="#000" />
            <stop offset="0.2" stopColor="#fff" />
            <stop offset="0.8" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <rect x="-40" y="-20" width="280" height="150" fill="url(#fx-air-grad)" />
        </mask>
      </defs>
      <g mask="url(#fx-air-fade)">
        {ribbons.map((r, i) => (
          <path
            key={i}
            d={wave(r.y, r.amp)}
            fill="none"
            stroke={`rgba(${ink},${r.o})`}
            strokeWidth={r.w}
            strokeLinecap="round"
            className="animate-fx-drift motion-reduce:animate-none"
            style={{
              animationDuration: `${(r.s / speed).toFixed(2)}s`,
              animationDelay: `${(-i * 1.7).toFixed(2)}s`,
            }}
          />
        ))}
      </g>
    </svg>
  );
};
