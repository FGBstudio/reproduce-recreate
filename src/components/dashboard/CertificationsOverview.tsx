/**
 * Vista "Certifications" di portafoglio — pannello destro di BrandOverlay
 * quando lo switch e' su Certifications. Stesso linguaggio glass scuro dei
 * pannelli di monitoraggio. Attivabile/disattivabile dal flag
 * CERTIFICATIONS_OVERVIEW (src/lib/features.ts).
 */
import { useState } from 'react';
import { Award, Circle } from 'lucide-react';
import { Project } from '@/lib/data';
import {
  useCertificationsOverview,
  TABLE_SCHEMES,
  SiteCertCell,
} from '@/hooks/useCertificationsOverview';

const SCHEME_BADGE: Record<string, { short: string; cls: string }> = {
  LEED: { short: 'LEED', cls: 'bg-emerald-900/70 text-emerald-200' },
  WELL: { short: 'WELL', cls: 'bg-sky-900/70 text-sky-200' },
  BREEAM: { short: 'BRE', cls: 'bg-lime-900/70 text-lime-200' },
  Energy: { short: 'EN', cls: 'bg-amber-900/70 text-amber-200' },
};

const cellCls = (c: SiteCertCell | null): string => {
  if (!c) return 'bg-foreground/[0.04] text-muted-foreground';
  if (c.expiringSoon) return 'bg-rose-500/15 text-rose-300';
  if (c.state === 'achieved') return 'bg-fgb-light/25 text-fgb-secondary';
  if (c.state === 'in_progress') return 'bg-fgb-accent/20 text-fgb-accent';
  return 'bg-foreground/[0.06] text-muted-foreground'; // potential
};

const cellLabel = (c: SiteCertCell | null): { top: string; sub: string | null } => {
  if (!c) return { top: '—', sub: null };
  if (c.state === 'potential') return { top: 'Potential', sub: null };
  if (c.state === 'in_progress') return { top: 'In progress', sub: c.certLevel ? `target ${c.certLevel}` : null };
  const om = c.isOm ? 'O+M · ' : '';
  return {
    top: c.certLevel || 'Certified',
    sub: c.issuedYear ? `${om}${c.issuedYear}` : (c.isOm ? 'O+M' : null),
  };
};

interface Props {
  projects: Project[];
  onOpenSite?: (siteId: string) => void;
}

const CertificationsOverview = ({ projects, onOpenSite }: Props) => {
  const { kpis, schemes, siteRows, isLoading, hasData } = useCertificationsOverview(projects);
  const [activeScheme, setActiveScheme] = useState<string | null>(null);

  const scheme = schemes.find(s => s.scheme === (activeScheme ?? schemes[0]?.scheme)) ?? schemes[0];
  const maxLevelTotal = scheme
    ? Math.max(...scheme.levels.map(l => l.achieved + l.inProgress + l.potential), 1)
    : 1;

  if (!isLoading && !hasData) {
    return (
      <div className="glass-panel rounded-2xl h-full flex flex-col items-center justify-center gap-3 text-center p-8">
        <Award className="w-8 h-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground max-w-[36ch]">
          No certification projects for this portfolio yet.
        </p>
      </div>
    );
  }

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
            <div className={`text-2xl font-bold tabular-nums ${x.cls}`}>{isLoading ? '…' : x.v}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5">{x.k}</div>
          </div>
        ))}
      </div>

      {/* ── Achievements by level ───────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 shrink-0">
        <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
          Achievements by level
        </h4>
        <div className="flex gap-2 flex-wrap mb-4">
          {schemes.map(s => {
            const badge = SCHEME_BADGE[s.scheme] || { short: s.scheme.slice(0, 4).toUpperCase(), cls: 'bg-foreground/10 text-foreground' };
            const on = scheme?.scheme === s.scheme;
            return (
              <button
                key={s.scheme}
                onClick={() => setActiveScheme(s.scheme)}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all ${
                  on
                    ? 'bg-fgb-light/20 border-fgb-light/40'
                    : 'bg-foreground/5 border-foreground/10 hover:bg-foreground/10'
                }`}
              >
                <span className={`w-8 h-8 rounded-lg grid place-items-center text-[9px] font-bold ${badge.cls}`}>{badge.short}</span>
                <span className="text-left">
                  <span className="block text-xs text-foreground">{s.scheme}</span>
                  <span className="block text-[10px] text-muted-foreground">{s.total} projects</span>
                </span>
              </button>
            );
          })}
        </div>

        {scheme && (
          <div className="space-y-2.5">
            {scheme.levels.map(l => {
              const tot = l.achieved + l.inProgress + l.potential;
              return (
                <div key={l.level} className="grid grid-cols-[96px_1fr_auto] items-center gap-3">
                  <span className="text-xs text-foreground">{l.level === 'TBD' ? 'Level TBD' : l.level}</span>
                  <div className="h-5 rounded-md overflow-hidden flex bg-foreground/5" style={{ width: `${(tot / maxLevelTotal) * 100}%`, minWidth: 40 }}>
                    {l.achieved > 0 && <span className="grid place-items-center text-[10px] font-semibold text-white bg-fgb-secondary" style={{ flex: l.achieved }}>{l.achieved}</span>}
                    {l.inProgress > 0 && <span className="grid place-items-center text-[10px] font-semibold text-background bg-fgb-accent/90" style={{ flex: l.inProgress }}>{l.inProgress}</span>}
                    {l.potential > 0 && <span className="grid place-items-center text-[10px] font-semibold text-fgb-light bg-fgb-light/20" style={{ flex: l.potential }}>{l.potential}</span>}
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">
                    {l.achieved} achieved · {l.inProgress} in progress · {l.potential} potential
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-4 mt-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-fgb-secondary inline-block" />Achieved</span>
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-fgb-accent/90 inline-block" />In progress</span>
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-fgb-light/30 inline-block" />Potential</span>
        </div>
      </div>

      {/* ── Site directory · certifications ─────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex-1 min-h-0 flex flex-col">
        <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Site directory · certifications</h4>
        <p className="text-[11px] text-muted-foreground mb-3">
          Level and year achieved · hover a cell to see the expiry date
        </p>
        <div className="grid grid-cols-[1.35fr_repeat(4,1fr)] gap-2 text-[9px] uppercase tracking-widest text-muted-foreground px-2 pb-2">
          <span>Site</span>
          {TABLE_SCHEMES.map(s => <span key={s} className="text-center">{s}</span>)}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
          {siteRows.map(row => (
            <div
              key={row.siteId}
              onClick={() => onOpenSite?.(row.siteId)}
              className={`grid grid-cols-[1.35fr_repeat(4,1fr)] gap-2 items-center bg-foreground/[0.04] rounded-xl px-2 py-2 hover:bg-foreground/[0.08] transition-colors ${onOpenSite ? 'cursor-pointer' : ''}`}
            >
              <div className="min-w-0">
                <p className="text-xs text-foreground truncate">{row.siteName}</p>
                <p className="text-[10px] text-muted-foreground">{row.region}</p>
              </div>
              {TABLE_SCHEMES.map(s => {
                const c = row.cells[s];
                const label = cellLabel(c);
                return (
                  <div
                    key={s}
                    className={`cert-cell relative rounded-lg px-2 py-1.5 text-center text-[11px] ${cellCls(c)}`}
                    data-exp={c?.expiryDate ? new Date(c.expiryDate).toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' }) : undefined}
                  >
                    <div className="font-semibold leading-tight">{label.top}</div>
                    {label.sub && <div className="text-[9px] opacity-75 leading-tight">{label.sub}</div>}
                  </div>
                );
              })}
            </div>
          ))}
          {isLoading && siteRows.length === 0 && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-xs gap-2">
              <Circle className="w-3 h-3 animate-pulse" /> Loading certifications…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CertificationsOverview;
