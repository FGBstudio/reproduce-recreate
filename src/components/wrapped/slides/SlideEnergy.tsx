import { formatPct } from '../lib/wrappedMath';
import type { SiteMonthlyData } from '../hooks/useSiteMonthlyWrap';

const fmtInt = (n: number) => Math.round(n).toLocaleString('it-IT');

const SlideEnergy = ({ data }: { data: SiteMonthlyData }) => {
  const e = data.energy;
  if (e.weekKwh == null && e.prevMonthKwh == null) {
    return (
      <div className="wr-slide on wr-bg-energy">
        <div className="wr-ey wr-a1" style={{ color: 'var(--amber)' }}>⚡ Energy</div>
        <div className="wr-empty wr-a2">No energy data for this month</div>
      </div>
    );
  }

  // Average draw in kW = total kWh / hours in the period
  const presentDaysCount = e.daily.filter(d => d.kwh != null).length || e.daily.length || 1;
  const hoursElapsed = presentDaysCount * 24;
  const avgKw = e.weekKwh != null ? e.weekKwh / hoursElapsed : null;

  const weeks = (e.weeks ?? []).filter(w => w.kwh != null);
  const peak = weeks.length ? weeks.reduce((m, w) => (w.kwh! > (m.kwh ?? 0) ? w : m)) : null;
  const maxBar = Math.max(...weeks.map(w => w.kwh ?? 0), 1);

  const monthName = data.monthLabel.split(' ')[0];
  const prevMonthName = data.prevMonthLabel.split(' ')[0];

  const deltaCls = e.deltaPct == null ? 'neutral' : e.deltaPct <= 0 ? 'good' : 'bad';
  const yoyCls = e.yoyDeltaPct == null ? 'neutral' : e.yoyDeltaPct <= 0 ? 'good' : 'bad';

  const maxTotal = Math.max(e.weekKwh ?? 0, e.prevMonthKwh ?? 0, 1);

  return (
    <div className="wr-slide on wr-bg-energy">
      <div className="wr-ey wr-a1" style={{ color: 'var(--amber)' }}>⚡ Energy</div>

      <div className="wr-stat wr-a2 wr-asc" style={{ color: 'var(--amber)' }}>
        {avgKw != null
          ? <>{avgKw.toFixed(1)}<sup>kW</sup></>
          : <>—</>}
      </div>

      <div className="wr-bd wr-a3">
        Average draw in <strong>{monthName}</strong>
        {e.deltaPct != null && (
          <> — <span className={`wr-delta ${deltaCls}`}>{formatPct(e.deltaPct)}</span> vs {prevMonthName}.</>
        )}
        {peak && (
          <> Peak week: <strong>W{peak.index} at {fmtInt(peak.kwh!)} kWh.</strong></>
        )}
      </div>

      {weeks.length > 0 && (
        <div className="wr-vchart wr-a4">
          <div className="wr-vbars" style={{ height: 90 }}>
            {weeks.map((w, i) => {
              const isPeak = peak?.index === w.index;
              const h = (w.kwh! / maxBar) * 78;
              return (
                <div className="wr-vcol" key={w.index}>
                  <div className="wr-vcol-val" style={{ color: isPeak ? 'var(--amber)' : undefined, opacity: isPeak ? 1 : 0.6 }}>
                    {fmtInt(w.kwh!)}
                  </div>
                  <div
                    className="wr-vbar"
                    style={{
                      height: `${h}px`,
                      background: isPeak ? 'var(--amber)' : 'rgba(245,166,35,0.35)',
                      borderRadius: 4,
                      transitionDelay: `${i * 100}ms`,
                    }}
                  />
                  <div className="wr-vcol-lbl" style={{ color: isPeak ? 'var(--amber)' : undefined }}>
                    W{w.index}{isPeak ? ' ↑' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="wr-hbars wr-a5" style={{ marginTop: 14 }}>
        {e.prevMonthKwh != null && (
          <div className="wr-hbrow">
            <div className="wr-hblbl"><span>{data.prevMonthLabel}</span><span>{fmtInt(e.prevMonthKwh)} kWh</span></div>
            <div className="wr-hbtrack">
              <div className="wr-hbfill" style={{ background: 'rgba(255,255,255,.25)', width: `${(e.prevMonthKwh / maxTotal) * 100}%` }} />
            </div>
          </div>
        )}
        {e.weekKwh != null && (
          <div className="wr-hbrow">
            <div className="wr-hblbl"><span>{data.monthLabel}</span><span>{fmtInt(e.weekKwh)} kWh</span></div>
            <div className="wr-hbtrack">
              <div className="wr-hbfill" style={{ background: 'var(--amber)', width: `${(e.weekKwh / maxTotal) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="wr-cap wr-a5">
        {e.weekKwh != null && <>Total {fmtInt(e.weekKwh)} kWh</>}
        {e.yoyDeltaPct != null && (
          <> · YoY <span className={`wr-delta ${yoyCls}`} style={{ padding: '2px 8px', fontSize: 9 }}>
            {formatPct(e.yoyDeltaPct)}
          </span>{e.yoyDeltaPct <= 0 ? ' ✓' : ''}</>
        )}
      </div>
    </div>
  );
};
export default SlideEnergy;