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
import { Award, Circle, Zap, Wind } from 'lucide-react';
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

const SchemeIcon = ({ scheme }: { scheme: string }) => {
  if (SCHEME_LOGO[scheme]) {
    return (
      <span className="w-9 h-9 rounded-lg bg-white/95 grid place-items-center p-1 shrink-0">
        <img src={SCHEME_LOGO[scheme]} alt={scheme} className="max-w-full max-h-full object-contain" />
      </span>
    );
  }
  if (scheme === 'Energy') {
    return <span className="w-9 h-9 rounded-lg bg-amber-900/60 grid place-items-center shrink-0"><Zap style={{ width: 18, height: 18 }} className="text-amber-200" /></span>;
  }
  if (scheme === 'Air') {
    return <span className="w-9 h-9 rounded-lg bg-cyan-900/60 grid place-items-center shrink-0"><Wind style={{ width: 18, height: 18 }} className="text-cyan-200" /></span>;
  }
  const b = SCHEME_BADGE[scheme] || { short: scheme.slice(0, 4).toUpperCase(), cls: 'bg-foreground/10 text-foreground' };
  return <span className={`w-9 h-9 rounded-lg grid place-items-center text-[10px] font-bold shrink-0 ${b.cls}`}>{b.short}</span>;
};

const cellCls = (c: SiteCertCell | null, scheme: string): string => {
  if (!c) return 'bg-foreground/[0.04] text-muted-foreground';
  if (c.expiringSoon) return 'bg-rose-500/15 text-rose-300';
  if (c.live === 'offline' || c.live === 'never') return 'bg-rose-500/12 text-rose-300/90';
  if (c.live === 'online') return 'bg-fgb-light/25 text-fgb-secondary';
  if (c.state === 'achieved') return 'bg-fgb-light/25 text-fgb-secondary';
  if (c.state === 'in_progress') return 'bg-fgb-accent/20 text-fgb-accent';
  return 'bg-foreground/[0.06] text-muted-foreground'; // pipeline / potential
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

const Bar = ({ parts, widthPct }: { parts: Array<{ n: number; cls: string }>; widthPct: number }) => (
  <div className="h-5 rounded-md overflow-hidden flex bg-foreground/5" style={{ width: `${widthPct}%`, minWidth: 36 }}>
    {parts.filter(p => p.n > 0).map((p, i) => (
      <span key={i} className={`grid place-items-center text-[11px] font-semibold ${p.cls}`} style={{ flex: p.n }}>{p.n}</span>
    ))}
  </div>
);

const SEG = {
  achieved: 'text-white bg-fgb-secondary',
  progress: 'text-background bg-fgb-accent/90',
  pipeline: 'text-foreground/80 bg-foreground/20',
  potential: 'text-fgb-light bg-fgb-light/20',
  online: 'text-white bg-fgb-secondary',
  offline: 'text-rose-200 bg-rose-500/45',
};

// Parti sticky: VERO glass, nessun colore pieno (navy bocciato). Il blur
// spinto + la leggera riduzione di luminosita' rendono illeggibile cio' che
// scorre sotto senza dipingere un blocco: quello che passa si vede solo
// come bagliore sfocato, come nelle barre glass del resto dell'app.
const GLASS_STICKY: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(26px) saturate(140%) brightness(0.72)',
  WebkitBackdropFilter: 'blur(26px) saturate(140%) brightness(0.72)',
};

interface Props {
  projects: Project[];
  domainLive?: Map<string, { energy: DomainLive; air: DomainLive }>;
  onOpenSite?: (siteId: string) => void;
}

const CertificationsOverview = ({ projects, domainLive, onOpenSite }: Props) => {
  const { kpis, schemes, sections, tableSchemes, isLoading, hasData } = useCertificationsOverview(projects, domainLive);
  const [activeScheme, setActiveScheme] = useState<string | null>(null);
  const [schemeFilter, setSchemeFilter] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState<SectionKey | null>(null);

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

  const scheme = schemes.find(s => s.scheme === (activeScheme ?? schemes[0]?.scheme)) ?? schemes[0];
  const maxRatedTotal = scheme?.model === 'rated'
    ? Math.max(...scheme.levels.map(l => l.achieved + l.inProgress + l.pipeline + l.potential), 1)
    : 1;
  const BAR_SCALE = 55;
  // Colonne flessibili: occupano tutta la larghezza; sotto il minimo parte lo scroll.
  const COLS = `minmax(180px, 1.6fr) repeat(${tableSchemes.length}, minmax(100px, 1fr))`;

  if (!isLoading && !hasData) {
    return (
      <div className="glass-panel rounded-2xl h-full flex flex-col items-center justify-center gap-3 text-center p-8">
        <Award className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground max-w-[36ch]">No certification projects for this portfolio yet.</p>
      </div>
    );
  }

  const legend = scheme?.model === 'monitoring'
    ? [ { cls: SEG.online, label: 'Online' }, { cls: SEG.offline, label: 'Offline' }, { cls: SEG.progress, label: 'Pipeline' }, { cls: SEG.potential, label: 'Potential' } ]
    : scheme?.model === 'binary'
      ? [ { cls: SEG.achieved, label: 'Achieved' }, { cls: SEG.progress, label: 'Not achieved' }, { cls: SEG.pipeline, label: 'Pipeline' } ]
      : [ { cls: SEG.achieved, label: 'Achieved' }, { cls: SEG.progress, label: 'In progress' }, { cls: SEG.pipeline, label: 'Pipeline' }, { cls: SEG.potential, label: 'Potential' } ];

  return (
    <div className="flex flex-col gap-3 h-full min-h-0 overflow-y-auto pr-1 custom-scrollbar">

      {/* ── KPI ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {[
          { v: kpis.active, k: 'Active certificates', cls: 'text-foreground' },
          { v: kpis.inProgress, k: 'In progress', cls: 'text-foreground' },
          { v: kpis.expiringSoon, k: 'Expiring < 6 months', cls: kpis.expiringSoon > 0 ? 'text-rose-400' : 'text-foreground' },
          { v: kpis.potential, k: 'Potential projects', cls: 'text-fgb-light' },
        ].map(x => (
          <div key={x.k} className="glass-panel rounded-2xl px-4 py-4 text-center">
            <div className={`text-3xl font-bold tabular-nums ${x.cls}`}>{isLoading ? '…' : x.v}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1.5">{x.k}</div>
          </div>
        ))}
      </div>

      {/* ── Achievements by level ───────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 shrink-0">
        <h4 className="text-base font-semibold text-foreground uppercase tracking-wider mb-3">Achievements by level</h4>
        <div className="flex gap-2 flex-wrap mb-4">
          {schemes.map(s => {
            const on = scheme?.scheme === s.scheme;
            return (
              <button key={s.scheme} onClick={() => setActiveScheme(s.scheme)}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all ${on ? 'bg-fgb-light/20 border-fgb-light/40' : 'bg-foreground/5 border-foreground/10 hover:bg-foreground/10'}`}>
                <SchemeIcon scheme={s.scheme} />
                <span className="text-left">
                  <span className="block text-sm text-foreground">{s.scheme.replace('_', ' ')}</span>
                  <span className="block text-[11px] text-muted-foreground">{s.total} projects</span>
                </span>
              </button>
            );
          })}
        </div>

        {scheme?.model === 'rated' && (
          <div className="space-y-2.5">
            {scheme.levels.map(l => {
              const tot = l.achieved + l.inProgress + l.pipeline + l.potential;
              return (
                <div key={l.level} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3">
                  <span className="text-sm text-foreground">{l.level === 'TBD' ? 'Level TBD' : l.level}</span>
                  <div className="flex items-center gap-3 min-w-0">
                    <Bar widthPct={(tot / maxRatedTotal) * BAR_SCALE}
                      parts={[
                        { n: l.achieved, cls: SEG.achieved },
                        { n: l.inProgress, cls: SEG.progress },
                        { n: l.pipeline, cls: SEG.pipeline },
                        { n: l.potential, cls: SEG.potential },
                      ]} />
                    <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                      {l.achieved} achieved · {l.inProgress} in progress{l.pipeline > 0 ? ` · ${l.pipeline} pipeline` : ''}{l.potential > 0 ? ` · ${l.potential} potential` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {scheme?.model === 'monitoring' && scheme.monitoring && (
          <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3">
            <span className="text-sm text-foreground">Monitors</span>
            <div className="flex items-center gap-3 min-w-0">
              <Bar widthPct={BAR_SCALE}
                parts={[
                  { n: scheme.monitoring.online, cls: SEG.online },
                  { n: scheme.monitoring.offline, cls: SEG.offline },
                  { n: scheme.monitoring.pipeline, cls: SEG.progress },
                  { n: scheme.monitoring.potential, cls: SEG.potential },
                ]} />
              <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                {scheme.monitoring.online} online · {scheme.monitoring.offline} offline · {scheme.monitoring.pipeline} pipeline · {scheme.monitoring.potential} potential
              </span>
            </div>
          </div>
        )}

        {scheme?.model === 'binary' && scheme.binary && (
          <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3">
            <span className="text-sm text-foreground">Status</span>
            <div className="flex items-center gap-3 min-w-0">
              <Bar widthPct={BAR_SCALE}
                parts={[
                  { n: scheme.binary.achieved, cls: SEG.achieved },
                  { n: scheme.binary.notAchieved, cls: SEG.progress },
                  { n: scheme.binary.pipeline, cls: SEG.pipeline },
                ]} />
              <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                {scheme.binary.achieved} achieved · {scheme.binary.notAchieved} not achieved · {scheme.binary.pipeline} pipeline
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
          {legend.map(l => (
            <span key={l.label} className="flex items-center gap-1.5">
              <i className={`w-2.5 h-2.5 rounded-sm inline-block ${l.cls}`} />{l.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Site directory · certifications ─────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex-1 min-h-0 flex flex-col">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h4 className="text-base font-semibold text-foreground uppercase tracking-wider">Site directory · certifications</h4>
            <p className="text-xs text-muted-foreground mb-2">
              Level and year achieved · hover a cell for the expiry date · scroll right for the full catalogue
            </p>
          </div>
          {/* Filtro per schema: trova un sito qualunque sia la sua sezione */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setSchemeFilter(null)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${!schemeFilter ? 'border-foreground/40 bg-foreground/10 text-foreground font-semibold' : 'border-foreground/10 text-muted-foreground hover:bg-foreground/5'}`}>
              All
            </button>
            {schemes.map(s => (
              <button key={s.scheme} onClick={() => setSchemeFilter(schemeFilter === s.scheme ? null : s.scheme)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${schemeFilter === s.scheme ? 'border-fgb-light/50 bg-fgb-light/15 text-fgb-light font-semibold' : 'border-foreground/10 text-muted-foreground hover:bg-foreground/5'}`}>
                {s.scheme.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-auto custom-scrollbar relative">
          <div style={{ minWidth: `${180 + tableSchemes.length * 104}px` }}>
            {/* Blocco sticky UNICO: intestazione colonne + sotto-riga sezioni.
                Un solo elemento sticky elimina le sovrapposizioni e le
                scritte che trasparivano durante lo scroll. */}
            <div className="sticky top-0 z-30" style={GLASS_STICKY}>
              <div className="grid gap-2 text-[10px] uppercase tracking-widest text-muted-foreground pb-1.5 pt-1"
                style={{ gridTemplateColumns: COLS }}>
                <span className="sticky left-0 z-40 pl-2" style={GLASS_STICKY}>Site</span>
                {tableSchemes.map(s => <span key={s} className="text-center">{s.replace('_', ' ')}</span>)}
              </div>
              <div className="flex items-center gap-1.5 pb-2 pt-0.5 overflow-x-auto pl-2">
                {visibleSections.map(s => (
                  <button key={s.key} onClick={() => jumpTo(s.key)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap transition-colors ${
                      (currentSection ?? visibleSections[0]?.key) === s.key
                        ? 'border-fgb-light/50 bg-fgb-light/20 text-foreground font-semibold'
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
                        className={`grid gap-2 items-center bg-foreground/[0.04] rounded-xl py-2 hover:bg-foreground/[0.08] transition-colors ${onOpenSite ? 'cursor-pointer' : ''}`}
                        style={{ gridTemplateColumns: COLS }}>
                        <div className="sticky left-0 z-20 min-w-0 rounded-l-xl pl-2 py-0.5" style={GLASS_STICKY}>
                          <p className="text-sm text-foreground truncate">{row.siteName}</p>
                          <p className="text-[11px] text-muted-foreground">{row.region}</p>
                        </div>
                        {tableSchemes.map(sch => {
                          const c = row.cells[sch];
                          const label = cellLabel(sch, c);
                          return (
                            <div key={sch}
                              className={`cert-cell relative rounded-lg px-2 py-1.5 text-center ${cellCls(c, sch)}`}
                              data-exp={c?.expiryDate ? new Date(c.expiryDate).toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' }) : undefined}>
                              <div className="text-[13px] font-semibold leading-tight">{label.top}</div>
                              {label.sub && <div className="text-[10.5px] opacity-75 leading-tight">{label.sub}</div>}
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
