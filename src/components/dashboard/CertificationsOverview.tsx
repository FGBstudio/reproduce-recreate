/**
 * Vista "Certifications" di portafoglio — pannello destro di BrandOverlay
 * quando lo switch e' su Certifications (flag CERTIFICATIONS_OVERVIEW).
 *
 * Directory raggruppata in sezioni (spec approvata): Active -> In progress ->
 * Pipeline -> Expiring -> Potential -> Energy -> Air. Ogni sito compare UNA
 * volta (certificato dominante: LEED, poi WELL, poi alfabetico; monitoraggi
 * solo se il sito non ha schemi edificio) ma la sua riga mostra SEMPRE tutte
 * le celle. La sotto-riga sticky indica la sezione corrente (scroll-spy) ed
 * e' una barra di salto. Il filtro per schema trova un sito ovunque sia la
 * sua sezione (es. "Energy" mostra anche il suo LEED acceso): niente
 * duplicati, la vista resta esportabile come follow-up mensile.
 */
import { useMemo, useRef, useState } from 'react';
import { Award, Circle, Zap, Wind, ArrowUpRight, Minimize2 } from 'lucide-react';
import { Project } from '@/lib/data';
import {
  useCertificationsOverview,
  schemeModel,
  SiteCertCell,
  SectionKey,
  DomainLive,
} from '@/hooks/useCertificationsOverview';

/** Loghi ufficiali da /public dove esistono; Energy e Air usano le stesse
 *  icone lucide del resto del sito; per gli schemi senza logo resta il badge. */
const SCHEME_LOGO: Record<string, string> = {
  LEED: '/leed_logo.webp',
  WELL: '/well_logo.webp',
  BREEAM: '/breeam_logo.webp',
  ESG: '/Logo_ESG.png',
};
const SCHEME_BADGE: Record<string, { short: string; cls: string }> = {
  TAXONOMY: { short: 'TAX', cls: 'bg-indigo-900/70 text-indigo-200' },
  CSRD: { short: 'CSRD', cls: 'bg-violet-900/70 text-violet-200' },
  Energy_Audit: { short: 'AUD', cls: 'bg-orange-900/70 text-orange-200' },
};

const SchemeIcon = ({ scheme, size = 'sm' }: { scheme: string; size?: 'sm' | 'lg' }) => {
  const box = size === 'lg' ? 'w-14 h-14 rounded-xl' : 'w-9 h-9 rounded-lg';
  const icon = size === 'lg' ? 26 : 18;
  if (SCHEME_LOGO[scheme]) {
    return (
      <span className={`${box} bg-white/95 grid place-items-center p-1.5 shrink-0`}>
        <img src={SCHEME_LOGO[scheme]} alt={scheme} className="max-w-full max-h-full object-contain" />
      </span>
    );
  }
  if (scheme === 'Energy') {
    return <span className={`${box} bg-amber-900/60 grid place-items-center shrink-0`}><Zap style={{ width: icon, height: icon }} className="text-amber-200" /></span>;
  }
  if (scheme === 'Air') {
    return <span className={`${box} bg-cyan-900/60 grid place-items-center shrink-0`}><Wind style={{ width: icon, height: icon }} className="text-cyan-200" /></span>;
  }
  const b = SCHEME_BADGE[scheme] || { short: scheme.slice(0, 4).toUpperCase(), cls: 'bg-foreground/10 text-foreground' };
  return <span className={`${box} grid place-items-center ${size === 'lg' ? 'text-xs' : 'text-[10px]'} font-bold shrink-0 ${b.cls}`}>{b.short}</span>;
};

/** Pill OUTLINE per le celle della directory (niente riempimenti pieni):
 *  Platinum → aqua, Gold → oro, Expiring/Offline → wine, Pipeline e
 *  Potential → tratteggiate grigie, altri achieved/online → teal. */
const cellPillCls = (c: SiteCertCell | null): string | null => {
  if (!c) return null; // cella vuota: solo "—" dim, nessuna pill
  if (c.expiringSoon) return 'text-[#e9a6bd] border-fgb-brand-accent/60 bg-fgb-brand-accent/15';
  if (c.live === 'offline' || c.live === 'never') return 'text-[#e9a6bd] border-fgb-brand-accent/50 bg-fgb-brand-accent/10';
  if (c.live === 'online') return 'text-fgb-brand-light border-fgb-brand-medium/50 bg-fgb-brand-medium/10';
  if (c.state === 'achieved') {
    if (c.certLevel === 'Platinum') return 'text-fgb-brand-light border-fgb-brand-light/35 bg-fgb-brand-light/10';
    if (c.certLevel === 'Gold') return 'text-fgb-accent border-fgb-accent/35 bg-fgb-accent/10';
    return 'text-fgb-brand-light border-fgb-brand-medium/50 bg-fgb-brand-medium/10';
  }
  if (c.state === 'in_progress') return 'text-fgb-accent border-fgb-accent/35 bg-fgb-accent/10';
  return 'text-muted-foreground border-foreground/15 border-dashed'; // pipeline / potential
};

const cellLabel = (scheme: string, c: SiteCertCell | null): { top: string; sub: string | null } => {
  if (!c) return { top: '—', sub: null };
  const isMon = schemeModel(scheme) === 'monitoring';
  if (isMon) {
    // Device presenti -> stato reale (anche mai visti = installati ma spenti:
    // Offline, caso Fendi Bicester). Pipeline = progetto partito, device in
    // arrivo (per il proprietario installing e pipeline coincidono);
    // Potential = quotation/potential senza device.
    if (c.live === 'online') return { top: 'Online', sub: c.issuedYear ? String(c.issuedYear) : null };
    if (c.live === 'offline' || c.live === 'never') return { top: 'Offline', sub: c.issuedYear ? String(c.issuedYear) : null };
    if (c.state === 'in_progress' || c.state === 'achieved') return { top: 'Pipeline', sub: 'installation pending' };
    return { top: 'Potential', sub: 'to install' };
  }
  if (c.state === 'potential') return { top: 'Potential', sub: null };
  if (c.state === 'pipeline') return { top: 'Pipeline', sub: null };
  if (c.state === 'in_progress') return { top: 'In progress', sub: c.certLevel ? `target ${c.certLevel}` : null };
  const om = c.isOm ? 'O+M · ' : '';
  return {
    top: c.certLevel || 'Achieved',
    sub: c.issuedYear ? `${om}${c.issuedYear}` : (c.isOm ? 'O+M' : null),
  };
};

const Bar = ({ parts, widthPct }: { parts: Array<{ n: number; cls: string; label: string }>; widthPct: number }) => (
  <div className="h-7 rounded-lg overflow-hidden flex bg-foreground/[0.07] transition-all duration-500 shrink-0"
    style={{ width: `${widthPct}%`, minWidth: 44 }}>
    {parts.filter(p => p.n > 0).map((p, i) => (
      <span key={i} title={`${p.n} ${p.label}`}
        className={`grid place-items-center text-xs font-bold transition-all duration-500 ${p.cls}`}
        style={{ flex: p.n }}>{p.n}</span>
    ))}
  </div>
);

/** Chip di lettura accanto alla barra: pallino colore + numero + etichetta.
 *  Sostituisce il testo unico "3 achieved · 0 in progress · …" poco leggibile. */
const CountChip = ({ n, dot, label }: { n: number; dot: string; label: string }) =>
  n > 0 ? (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
      <i className={`w-2 h-2 rounded-full inline-block ${dot}`} />
      <b className="text-foreground font-semibold">{n}</b> {label}
    </span>
  ) : null;

/* Segmenti barre e pallini legenda rimappati sui token brand (modello):
   achieved → teal, in progress → oro, pipeline → bianco .28,
   potential → aqua, expiring/offline → wine. */
const SEG = {
  achieved: 'text-[#e8f6f6] bg-fgb-brand-medium',
  progress: 'text-background bg-fgb-accent/90',
  pipeline: 'text-foreground bg-white/25',
  potential: 'text-[#0f1113] bg-fgb-brand-light',
  online: 'text-[#e8f6f6] bg-fgb-brand-medium',
  offline: 'text-[#e9a6bd] bg-fgb-brand-accent/60',
};

const DOT = {
  achieved: 'bg-fgb-brand-medium',
  progress: 'bg-fgb-accent',
  pipeline: 'bg-white/30',
  potential: 'bg-fgb-brand-light',
  online: 'bg-fgb-brand-medium',
  offline: 'bg-fgb-brand-accent',
  expiring: 'bg-fgb-brand-accent',
};

// Superfici (modello certifications-surfaces.html): una sola superficie
// glass per tutti i contenitori (classe glass-panel), con il velo brand
// `glass-panel--brand` su KPI e Site directory. Le parti sticky della
// tabella usano `fgb-cert-sticky` (inchiostro neutro, non petrolio) —
// definite in index.css.

interface Props {
  projects: Project[];
  domainLive?: Map<string, { energy: DomainLive; air: DomainLive }>;
  onOpenSite?: (siteId: string) => void;
}

const CertificationsOverview = ({ projects, domainLive, onOpenSite }: Props) => {
  const { kpis, schemes, sections, tableSchemes, isLoading, hasData } = useCertificationsOverview(projects, domainLive);
  const [activeScheme, setActiveScheme] = useState<string | null>(null);
  const [hoverScheme, setHoverScheme] = useState<string | null>(null);
  const [schemeFilter, setSchemeFilter] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<SectionKey | null>(null);
  const [detailMode, setDetailMode] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<SectionKey, HTMLDivElement | null>>>({});

  // Filtro per schema: un sito resta nella SUA sezione ma compare solo se ha
  // quel certificato (con tutta la riga accesa) — niente duplicati.
  const visibleSections = useMemo(() => {
    if (!schemeFilter) return sections;
    return sections
      .map(s => ({ ...s, rows: s.rows.filter(r => r.cells[schemeFilter]) }))
      .filter(s => s.rows.length > 0);
  }, [sections, schemeFilter]);

  const totalRows = visibleSections.reduce((n, s) => n + s.rows.length, 0);

  // Colonne intelligenti: solo gli schemi con almeno una cella valorizzata
  // in questo portafoglio. Una colonna interamente vuota e' rumore.
  const activeTableSchemes = useMemo(
    () => tableSchemes.filter(sch => sections.some(sec => sec.rows.some(r => r.cells[sch]))),
    [tableSchemes, sections],
  );

  // Scroll-spy: la sotto-riga mostra la sezione che stai attraversando.
  const HEADER_OFFSET = 64; // altezza del blocco sticky (header + chips)
  const onScroll = () => {
    const cont = scrollRef.current;
    if (!cont) return;
    let current: SectionKey | null = visibleSections[0]?.key ?? null;
    for (const s of visibleSections) {
      const el = sectionRefs.current[s.key];
      if (el && el.offsetTop - cont.scrollTop <= HEADER_OFFSET + 8) current = s.key;
    }
    setCurrentSection(current);
  };

  const jumpTo = (key: SectionKey) => {
    const cont = scrollRef.current;
    const el = sectionRefs.current[key];
    if (cont && el) cont.scrollTo({ top: el.offsetTop - HEADER_OFFSET, behavior: 'smooth' });
  };

  // Il blocco dati segue il logo sotto il cursore (spotlight come nella
  // landing); al click la selezione resta.
  const scheme = schemes.find(s => s.scheme === (hoverScheme ?? activeScheme ?? schemes[0]?.scheme)) ?? schemes[0];
  const maxRatedTotal = scheme?.model === 'rated'
    ? Math.max(...scheme.levels.map(l => l.achieved + l.inProgress + l.pipeline + l.potential), 1)
    : 1;
  const BAR_SCALE = 55;
  // Colonne flessibili: occupano tutta la larghezza; sotto il minimo parte lo scroll.
  const COLS = `minmax(180px, 1.6fr) repeat(${activeTableSchemes.length}, minmax(100px, 1fr))`;

  if (!isLoading && !hasData) {
    return (
      <div className="glass-panel rounded-2xl h-full flex flex-col items-center justify-center gap-3 text-center p-8">
        <Award className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground max-w-[36ch]">No certification projects for this portfolio yet.</p>
      </div>
    );
  }

  const legend = scheme?.model === 'monitoring'
    ? [ { cls: DOT.online, label: 'Online' }, { cls: DOT.offline, label: 'Offline' }, { cls: DOT.progress, label: 'Pipeline' }, { cls: DOT.potential, label: 'Potential' } ]
    : scheme?.model === 'binary'
      ? [ { cls: DOT.achieved, label: 'Achieved' }, { cls: DOT.progress, label: 'Not achieved' }, { cls: DOT.pipeline, label: 'Pipeline' } ]
      : [ { cls: DOT.achieved, label: 'Achieved' }, { cls: DOT.progress, label: 'In progress' }, { cls: DOT.pipeline, label: 'Pipeline' }, { cls: DOT.potential, label: 'Potential' }, { cls: DOT.expiring, label: 'Expiring' } ];

  return (
    <div className="flex flex-col gap-3 h-full min-h-0 overflow-y-auto pr-1 custom-scrollbar">

      {/* ── KPI — ancorati in alto: restano il punto fermo mentre
             la vista sottostante cambia ──────────────────────── */}
      <div className="sticky top-0 z-40 shrink-0 -mx-1 px-1 pb-2 -mb-2 fgb-cert-kpiveil">
        <div className="grid grid-cols-4 gap-3">
          {[
            { v: kpis.active, k: 'Active certificates', cls: 'text-foreground', alert: false },
            { v: kpis.inProgress, k: 'In progress', cls: 'text-foreground', alert: false },
            /* la semantica sta nel numero, non nel box: wine se >0, dim se 0 */
            { v: kpis.expiringSoon, k: 'Expiring < 6 months', cls: kpis.expiringSoon > 0 ? 'text-[#e9a6bd]' : 'text-muted-foreground', alert: kpis.expiringSoon > 0 },
            { v: kpis.potential, k: 'Potential projects', cls: kpis.potential > 0 ? 'text-fgb-brand-light' : 'text-muted-foreground', alert: false },
          ].map(x => (
            <div
              key={x.k}
              className="glass-panel glass-panel--brand relative overflow-hidden rounded-2xl px-5 py-6 text-center transition-colors"
            >
              {x.alert && <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[2px] bg-fgb-brand-accent" />}
              <div className={`text-5xl font-light tracking-tight tabular-nums leading-none ${x.cls}`}>{isLoading ? '…' : x.v}</div>
              <div className="text-[10px] uppercase tracking-[0.22em] font-medium text-muted-foreground/90 mt-3">{x.k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Achievements by level — sparisce fluidamente in
             modalita' dettaglio ("Go in detail") ─────────────── */}
      <div className={`shrink-0 overflow-hidden transition-all duration-500 ease-in-out ${detailMode ? 'max-h-0 opacity-0 -mt-3 pointer-events-none' : 'max-h-[640px] opacity-100'}`}>
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h4 className="text-base font-semibold text-foreground uppercase tracking-wider">Achievements by level</h4>
          {/* Il dettaglio parte da qui: la fascia sparisce e la directory si
              aggancia sotto i KPI; il ritorno ("See less") vive nella directory. */}
          <button onClick={() => setDetailMode(true)}
            className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-fgb-brand-light hover:underline shrink-0">
            Go in detail <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {/* Loghi come "target": grandi, spotlight in hover (il resto sbiadisce)
            — stesso comportamento della sezione certificazioni della landing. */}
        <div className="flex gap-2.5 flex-wrap mb-4" onMouseLeave={() => setHoverScheme(null)}>
          {schemes.map(s => {
            const on = scheme?.scheme === s.scheme;
            const dimmed = hoverScheme != null && hoverScheme !== s.scheme;
            return (
              <button key={s.scheme} onClick={() => setActiveScheme(s.scheme)}
                onMouseEnter={() => setHoverScheme(s.scheme)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-300 ${on ? 'bg-foreground/[0.075] border-fgb-brand-light/30' : 'bg-foreground/[0.045] border-foreground/10'} ${dimmed ? 'opacity-40 scale-[0.98]' : 'opacity-100'}`}>
                <SchemeIcon scheme={s.scheme} size="lg" />
                <span className="text-left">
                  <span className="block text-base font-medium text-foreground leading-tight">{s.scheme.replace('_', ' ')}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{s.total} projects</span>
                </span>
              </button>
            );
          })}
        </div>

        {scheme?.model === 'rated' && (
          <div className="space-y-1.5">
            {scheme.levels.map(l => {
              const tot = l.achieved + l.inProgress + l.pipeline + l.potential;
              return (
                <div key={l.level}
                  className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4 rounded-xl px-3 py-2 hover:bg-foreground/[0.05] transition-colors">
                  <div className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground truncate">{l.level === 'TBD' ? 'Level TBD' : l.level}</span>
                    <span className="block text-[11px] text-muted-foreground tabular-nums">{tot} project{tot === 1 ? '' : 's'}</span>
                  </div>
                  <div className="flex items-center gap-4 min-w-0">
                    <Bar widthPct={(tot / maxRatedTotal) * BAR_SCALE}
                      parts={[
                        { n: l.achieved, cls: SEG.achieved, label: 'achieved' },
                        { n: l.inProgress, cls: SEG.progress, label: 'in progress' },
                        { n: l.pipeline, cls: SEG.pipeline, label: 'pipeline' },
                        { n: l.potential, cls: SEG.potential, label: 'potential' },
                      ]} />
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <CountChip n={l.achieved} dot={DOT.achieved} label="achieved" />
                      <CountChip n={l.inProgress} dot={DOT.progress} label="in progress" />
                      <CountChip n={l.pipeline} dot={DOT.pipeline} label="pipeline" />
                      <CountChip n={l.potential} dot={DOT.potential} label="potential" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {scheme?.model === 'monitoring' && scheme.monitoring && (
          <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4 rounded-xl px-3 py-2 hover:bg-foreground/[0.05] transition-colors">
            <div>
              <span className="block text-sm font-semibold text-foreground">Monitors</span>
              <span className="block text-[11px] text-muted-foreground tabular-nums">
                {scheme.monitoring.online + scheme.monitoring.offline + scheme.monitoring.pipeline + scheme.monitoring.potential} sites
              </span>
            </div>
            <div className="flex items-center gap-4 min-w-0">
              <Bar widthPct={BAR_SCALE}
                parts={[
                  { n: scheme.monitoring.online, cls: SEG.online, label: 'online' },
                  { n: scheme.monitoring.offline, cls: SEG.offline, label: 'offline' },
                  { n: scheme.monitoring.pipeline, cls: SEG.progress, label: 'pipeline' },
                  { n: scheme.monitoring.potential, cls: SEG.potential, label: 'potential' },
                ]} />
              <div className="flex items-center gap-3 flex-wrap min-w-0">
                <CountChip n={scheme.monitoring.online} dot={DOT.online} label="online" />
                <CountChip n={scheme.monitoring.offline} dot={DOT.offline} label="offline" />
                <CountChip n={scheme.monitoring.pipeline} dot={DOT.progress} label="pipeline" />
                <CountChip n={scheme.monitoring.potential} dot={DOT.potential} label="potential" />
              </div>
            </div>
          </div>
        )}

        {scheme?.model === 'binary' && scheme.binary && (
          <div className="grid grid-cols-[130px_minmax(0,1fr)] items-center gap-4 rounded-xl px-3 py-2 hover:bg-foreground/[0.05] transition-colors">
            <div>
              <span className="block text-sm font-semibold text-foreground">Status</span>
              <span className="block text-[11px] text-muted-foreground tabular-nums">
                {scheme.binary.achieved + scheme.binary.notAchieved + scheme.binary.pipeline} projects
              </span>
            </div>
            <div className="flex items-center gap-4 min-w-0">
              <Bar widthPct={BAR_SCALE}
                parts={[
                  { n: scheme.binary.achieved, cls: SEG.achieved, label: 'achieved' },
                  { n: scheme.binary.notAchieved, cls: SEG.progress, label: 'not achieved' },
                  { n: scheme.binary.pipeline, cls: SEG.pipeline, label: 'pipeline' },
                ]} />
              <div className="flex items-center gap-3 flex-wrap min-w-0">
                <CountChip n={scheme.binary.achieved} dot={DOT.achieved} label="achieved" />
                <CountChip n={scheme.binary.notAchieved} dot={DOT.progress} label="not achieved" />
                <CountChip n={scheme.binary.pipeline} dot={DOT.pipeline} label="pipeline" />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4 mt-3 pt-3 border-t border-foreground/[0.07] text-xs text-muted-foreground flex-wrap">
          {legend.map(l => (
            <span key={l.label} className="flex items-center gap-1.5">
              <i className={`w-2.5 h-2.5 rounded-sm inline-block ${l.cls}`} />{l.label}
            </span>
          ))}
        </div>
      </div>
      </div>

      {/* ── Site directory · certifications ─────────────────── */}
      <div className={`glass-panel glass-panel--brand rounded-2xl p-5 flex-1 min-h-0 flex flex-col transition-opacity duration-500 ${detailMode ? 'opacity-100' : 'opacity-[0.55]'}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h4 className="text-base font-semibold text-foreground uppercase tracking-wider">Site directory · certifications</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Level and year achieved · hover a cell for the expiry date · scroll right for the full catalogue
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro per schema: l'attivo e' l'UNICO elemento a fondo teal pieno */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setSchemeFilter(null)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${!schemeFilter ? 'border-fgb-brand-medium bg-fgb-brand-medium text-white font-semibold' : 'border-foreground/10 text-muted-foreground hover:bg-foreground/5'}`}>
                All
              </button>
              {schemes.map(s => (
                <button key={s.scheme} onClick={() => setSchemeFilter(schemeFilter === s.scheme ? null : s.scheme)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${schemeFilter === s.scheme ? 'border-fgb-brand-medium bg-fgb-brand-medium text-white font-semibold' : 'border-foreground/10 text-muted-foreground hover:bg-foreground/5'}`}>
                  {s.scheme.replace('_', ' ')}
                </button>
              ))}
            </div>
            {/* Ritorno alla base: il comando appare qui solo in dettaglio */}
            {detailMode && (
              <button onClick={() => setDetailMode(false)}
                className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-fgb-brand-light hover:underline">
                <Minimize2 className="w-3.5 h-3.5" /> See less
              </button>
            )}
          </div>
        </div>

        <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-auto custom-scrollbar relative">
          <div style={{ minWidth: `${180 + activeTableSchemes.length * 104}px` }}>
            {/* Blocco sticky UNICO: intestazione colonne + sotto-riga sezioni.
                Sfondo pieno: non deve mai fondersi con le righe che scorrono. */}
            <div className="sticky top-0 z-30 fgb-cert-sticky">
              <div className="grid gap-2 text-[10px] uppercase tracking-widest text-muted-foreground pb-1.5 pt-1"
                style={{ gridTemplateColumns: COLS }}>
                <span className="sticky left-0 z-40 pl-2 fgb-cert-sticky">Site</span>
                {activeTableSchemes.map(s => <span key={s} className="text-center">{s.replace('_', ' ')}</span>)}
              </div>
              <div className="flex items-center gap-1.5 pb-2 pt-0.5 overflow-x-auto pl-2">
                {visibleSections.map(s => (
                  <button key={s.key} onClick={() => jumpTo(s.key)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors ${
                      (currentSection ?? visibleSections[0]?.key) === s.key
                        ? 'border-foreground/20 bg-foreground/[0.075] text-foreground font-semibold'
                        : 'border-foreground/10 text-muted-foreground hover:bg-foreground/5'
                    }`}>
                    {s.label} <span className="opacity-70">{s.rows.length}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              {visibleSections.map(s => (
                <div key={s.key} ref={el => { sectionRefs.current[s.key] = el; }}>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 pl-2 pt-2 pb-1">
                    {s.label} · {s.rows.length}
                  </div>
                  <div className="space-y-1.5">
                    {s.rows.map(row => (
                      <div key={row.siteId} onClick={() => onOpenSite?.(row.siteId)}
                        className={`group relative grid gap-2 items-center bg-foreground/[0.04] rounded-xl py-2 transition-colors ${onOpenSite ? 'cursor-pointer' : ''}`}
                        style={{ gridTemplateColumns: COLS }}>
                        {/* Binario di lettura: in hover la riga sale a glass-hi
                            (sta sopra la colonna sticky, sotto l'header). */}
                        <span className="pointer-events-none absolute inset-0 rounded-xl bg-foreground/0 group-hover:bg-foreground/[0.07] transition-colors z-[25]" />
                        <div className="sticky left-0 z-20 min-w-0 rounded-l-xl pl-2 py-0.5 fgb-cert-sticky">
                          <p className="text-sm text-foreground truncate">{row.siteName}</p>
                          <p className="text-[11px] text-muted-foreground">{row.region}</p>
                        </div>
                        {activeTableSchemes.map(sch => {
                          const c = row.cells[sch];
                          const label = cellLabel(sch, c);
                          const pill = cellPillCls(c);
                          return (
                            <div key={sch}
                              className="cert-cell relative px-2 py-1 text-center"
                              data-exp={c?.expiryDate ? new Date(c.expiryDate).toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' }) : undefined}>
                              {pill ? (
                                <span className={`inline-flex flex-col items-center px-4 py-1 rounded-full border leading-tight ${pill}`}>
                                  <span className="text-[12.5px] font-semibold">{label.top}</span>
                                  {label.sub && <span className="text-[10.5px] font-light opacity-80">{label.sub}</span>}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {isLoading && totalRows === 0 && (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                  <Circle className="w-3 h-3 animate-pulse" /> Loading certifications…
                </div>
              )}
              {!isLoading && totalRows === 0 && schemeFilter && (
                <p className="text-sm text-muted-foreground text-center py-6">No sites with {schemeFilter} in this portfolio.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificationsOverview;
