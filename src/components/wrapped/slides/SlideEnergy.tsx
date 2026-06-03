import { formatKwh, formatPct, dayName } from '../lib/wrappedMath';
import type { SiteWeeklyData } from '../hooks/useSiteWeeklyWrap';

const SlideEnergy = ({ data }: { data: SiteWeeklyData }) => {
  const e = data.energy;
  if (e.weekKwh == null) {
    return (
      <div className="wr-slide on wr-bg-energy">
        <div className="wr-ey wr-a1" style={{ color: 'var(--amber)' }}>⚡ Energy</div>
        <div className="wr-empty wr-a2">No energy data for this week</div>
      </div>
    );
  }
  const maxKwh = Math.max(...e.daily.map(d => d.kwh ?? 0), 1);
  const deltaCls = e.deltaPct == null ? 'neutral' : e.deltaPct <= 0 ? 'good' : 'bad';
  return (
    <div className="wr-slide on wr-bg-energy">
      <div className="wr-ey wr-a1" style={{ color: 'var(--amber)' }}>⚡ Energy · this week</div>
      <div className="wr-stat wr-a2 wr-asc" style={{ color: 'var(--amber)' }}>
        {formatKwh(e.weekKwh).split(' ')[0]}<sup>{formatKwh(e.weekKwh).split(' ')[1]}</sup>
      </div>
      <div className="wr-bd wr-a3">
        {e.prevWeekKwh != null ? (
          <>
            <span className={`wr-delta ${deltaCls}`}>{formatPct(e.deltaPct)}</span> vs last week
            {e.onTarget ? <> · <strong>on target ✓</strong></> : null}
          </>
        ) : <em>No previous week data to compare</em>}
      </div>
      <div className="wr-vchart wr-a4">
        <div className="wr-vbars">
          {e.daily.map((d, i) => {
            const h = d.kwh != null ? (d.kwh / maxKwh) * 70 : 0;
            const isMin = e.goldenDay?.day === d.day;
            return (
              <div className="wr-vcol" key={d.day}>
                <div className="wr-vcol-val">{d.kwh != null ? Math.round(d.kwh) : '—'}</div>
                <div
                  className="wr-vbar"
                  style={{
                    height: `${h}px`,
                    background: isMin ? 'var(--teal)' : `rgba(245,166,35,${d.kwh != null ? 0.6 : 0.1})`,
                    transitionDelay: `${i * 80}ms`,
                  }}
                />
                <div className="wr-vcol-lbl">{dayName(d.day)}</div>
              </div>
            );
          })}
        </div>
      </div>
      {e.goldenDay && (
        <div className="wr-cap wr-a5">
          Golden day: <strong style={{ color: 'var(--teal)' }}>{dayName(e.goldenDay.day)}</strong> · {Math.round(e.goldenDay.kwh)} kWh
        </div>
      )}
    </div>
  );
};
export default SlideEnergy;