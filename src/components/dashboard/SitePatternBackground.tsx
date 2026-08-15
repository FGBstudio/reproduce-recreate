/**
 * Sfondo a pattern organico per la dashboard di sito — trasposizione fedele
 * del mockup approvato (fgb_google_pattern_sfondo_card.html):
 * base salvia #EDF5F2, forme tonali #E2EEE9, onda spessa #DCE9E4,
 * trame di punti #D3E3DD e firma corsiva "Future Green Building".
 *
 * Sta DIETRO ai contenuti (pointer-events-none) e si adatta al viewport
 * con preserveAspectRatio="slice", come nel mockup.
 */
const DOT = '#D3E3DD';

/** Griglia di punti tonali (r=2, passo 24) con origine in (x, y). */
const DotGrid = ({ x, y, cols, rows }: { x: number; y: number; cols: number; rows: number }) => (
  <g fill={DOT}>
    {Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => (
        <circle key={`${r}-${c}`} cx={x + c * 24} cy={y + r * 24} r="2" />
      ))
    )}
  </g>
);

const SitePatternBackground = () => (
  <div className="absolute inset-0 pointer-events-none" style={{ background: '#EDF5F2' }}>
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {/* forme organiche tonali */}
      <circle cx="1280" cy="90" r="300" fill="#E2EEE9" />
      <circle cx="90" cy="760" r="340" fill="#E2EEE9" />
      <path
        d="M-80,440 C240,340 480,540 840,440 C1080,375 1240,470 1520,400"
        fill="none"
        stroke="#DCE9E4"
        strokeWidth="90"
        strokeLinecap="round"
      />
      {/* trame di punti */}
      <DotGrid x={1090} y={600} cols={8} rows={5} />
      <DotGrid x={110} y={120} cols={5} rows={4} />
      {/* firma */}
      <text
        x="1400"
        y="860"
        textAnchor="end"
        fontSize="44"
        fill="#DCE9E4"
        fontFamily="cursive"
        fontStyle="italic"
      >
        Future Green Building
      </text>
    </svg>
    {/* Trama di loghi FGB (pwa-192x192.png), default per TUTTI i siti:
        distanziata ('space') e molto tenue, resta texture e non rumore.
        L'immagine caricata per il sito, quando c'e', sostituisce l'intero
        pattern (vedi ProjectDetail). */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'url(/pwa-192x192.png)',
        backgroundRepeat: 'space',
        backgroundSize: '110px',
        backgroundPosition: 'center',
        opacity: 0.05,
      }}
    />
  </div>
);

export default SitePatternBackground;
