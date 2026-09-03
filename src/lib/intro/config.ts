/**
 * Config della pagina intro (SPEC-intro-page §6, §4.1).
 * Scelta del proprietario (03/09): NIENTE DB — modalita' e contatore visite
 * vivono in localStorage; la soglia e i numeri del mosaico stanno qui,
 * mai hardcodati nei componenti.
 */

export type IntroMode = 'full' | 'short' | 'skip';

/* v2 (03/09): chiavi rinominate per azzerare i contatori bruciati dai test
   (ogni remount contava una "visita", StrictMode incluso: si finiva in short
   dopo pochi minuti). Ora una visita = una sessione, vedi bumpIntroViews. */
export const INTRO_MODE_KEY = 'fgb_intro_mode_v2';
export const INTRO_VIEWS_KEY = 'fgb_intro_views_v2';
const SESSION_BUMP_KEY = 'fgb_intro_viewed_session';
/** Dopo N aperture in modalita' full si passa da soli a short. */
export const INTRO_SHORT_AFTER = 3;

export function readIntroMode(): IntroMode {
  if (typeof window === 'undefined') return 'full';
  const v = localStorage.getItem(INTRO_MODE_KEY);
  return v === 'short' || v === 'skip' ? v : 'full';
}

export function writeIntroMode(mode: IntroMode) {
  try { localStorage.setItem(INTRO_MODE_KEY, mode); } catch { /* storage pieno/negato: pazienza */ }
}

/** Incrementa il contatore visite (max UNA per sessione: i remount e i
 *  rientri dal menu non contano) e applica l'auto-passaggio a short. */
export function bumpIntroViews(): { views: number; mode: IntroMode } {
  let views = 0;
  try {
    views = Number(localStorage.getItem(INTRO_VIEWS_KEY) || '0');
    if (sessionStorage.getItem(SESSION_BUMP_KEY) !== '1') {
      sessionStorage.setItem(SESSION_BUMP_KEY, '1');
      views += 1;
      localStorage.setItem(INTRO_VIEWS_KEY, String(views));
    }
  } catch { /* noop */ }
  let mode = readIntroMode();
  if (mode === 'full' && views >= INTRO_SHORT_AFTER) {
    mode = 'short';
    writeIntroMode(mode);
  }
  return { views, mode };
}

/** Mosaico "Who we are" — numeri aziendali hardcoded (§4.1, non in DB). */
export interface MosaicStat {
  n: number;
  suffix: string;
  label: string;
  color: string;
  img: string;
  icon: 'people' | 'pin' | 'chart' | 'folder';
  fmt?: 'it';
}

export const MOSAIC_STATS: MosaicStat[] = [
  { n: 50, suffix: '', label: 'Employees', color: '#009193', img: '/intro/stats-employees.jpg', icon: 'people' },
  { n: 60, suffix: '+', label: 'Countries', color: '#931841', img: '/intro/stats-countries.jpg', icon: 'pin' },
  { n: 300, suffix: '', label: 'Clients', color: '#e8a6b1', img: '/intro/stats-clients.jpg', icon: 'chart' },
  { n: 6000, suffix: '', label: 'Projects', color: '#016368', img: '/intro/stats-projects.jpg', icon: 'folder', fmt: 'it' },
];

export const TIMELINE = [
  { y: '2015', l: 'Francesca Galati Bolognesi founds FGB' },
  { y: '2019', l: '20 locations in the world' },
  { y: '2026', l: 'FGB Monitoring System launched' },
];
