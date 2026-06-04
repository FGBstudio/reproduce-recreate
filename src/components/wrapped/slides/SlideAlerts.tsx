import type { ReactNode } from 'react';
import type { SiteMonthlyData } from '../hooks/useSiteMonthlyWrap';

const SlideAlerts = ({ data }: { data: SiteMonthlyData }) => {
  const a = data.alerts;
  const items = a.items ?? [];
  const total = items.length || (a.activeNow + a.resolvedThisWeek);
  const allClear = total === 0;
  const crit = a.countsBySeverity?.critical ?? 0;
  const warn = a.countsBySeverity?.warning ?? 0;
  const maxDur = items.reduce((m, it) => Math.max(m, it.durationMin ?? 0), 1);
  const formatDur = (d: number | null) => d == null ? '—' : d < 60 ? `${d} min` : `${Math.round(d / 60)} h`;
  const sevColor = (s: 'critical' | 'warning' | 'info') =>
    s === 'critical' ? 'var(--red)' : s === 'warning' ? 'var(--amber)' : 'var(--blue)';

  let headline: ReactNode;
  if (allClear) headline = <>All <span style={{ color: 'var(--teal)' }}>clear.</span></>;
  else if (crit && warn) headline = <><span style={{ color: 'var(--red)' }}>{crit} critical,</span> {warn} warning.</>;
  else if (crit) headline = <><span style={{ color: 'var(--red)' }}>{crit} critical</span> alert{crit > 1 ? 's' : ''}.</>;
  else if (warn) headline = <><span style={{ color: 'var(--amber)' }}>{warn} warning</span>{warn > 1 ? 's' : ''}.</>;
  else headline = <><span style={{ color: 'var(--blue)' }}>{total}</span> info event{total > 1 ? 's' : ''}.</>;

  return (
    <div className="wr-slide on wr-bg-alerts">
      <div className="wr-ey wr-a1" style={{ color: allClear ? 'var(--teal)' : 'var(--red)' }}>
        Alerts in {data.monthLabel}
      </div>
      <div className="wr-stat wr-a2 wr-asc" style={{ color: allClear ? 'var(--teal)' : 'var(--red)' }}>
        {total}
      </div>
      <div className="wr-sub wr-a3">{headline}</div>
      {!allClear && a.totalDurationMin > 0 && (
        <div className="wr-bd wr-a4" style={{ marginBottom: 14 }}>
          Site impacted <strong style={{ color: 'var(--red)' }}>{formatDur(a.totalDurationMin)}</strong> total.
          {a.activeNow === 0 && <> <em>Resolved same day. No lasting impact.</em></>}
        </div>
      )}
      {items.length > 0 && (
        <div className="wr-alert-list wr-a5">
          {items.slice(0, 4).map((it, i) => (
            <div key={it.id} className="wr-alert-item">
              <span className="wr-alert-dot" style={{ background: sevColor(it.severity) }} />
              <span className="wr-alert-name">Alert #{i + 1}</span>
              <div className="wr-alert-track">
                <div
                  className="wr-alert-fill"
                  style={{
                    width: `${Math.max(3, Math.round(((it.durationMin ?? 0) / maxDur) * 100))}%`,
                    background: sevColor(it.severity),
                    opacity: it.durationMin == null ? 0.35 : 1,
                  }}
                />
              </div>
              <span className="wr-alert-dur">{formatDur(it.durationMin)}</span>
            </div>
          ))}
        </div>
      )}
      {allClear && (
        <div className="wr-cap wr-a5">Calm month. Keep going.</div>
      )}
    </div>
  );
};
export default SlideAlerts;