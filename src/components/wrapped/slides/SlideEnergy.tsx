import { formatKwh, formatPct, dayName } from '../lib/wrappedMath';
import type { SiteMonthlyData } from '../hooks/useSiteMonthlyWrap';

const SlideEnergy = ({ data }: { data: SiteMonthlyData }) => {
  const e = data.energy;
  if (e.weekKwh == null) {
    return (
      <div className="wr-slide on wr-bg-energy">
        <div className="wr-ey wr-a1" style={{ color: 'var(--amber)' }}>⚡ Energy</div>
        <div className="wr-empty wr-a2">No energy data for this month</div>
      </div>
    );
  }
  const recent = e.daily.slice(-14); // show last two weeks for readability
  const maxKwh = Math.max(...recent.map(d => d.kwh ?? 0), 1);
  const deltaCls = e.deltaPct == null ? 'neutral' : e.deltaPct <= 0 ? 'good' : 'bad';
  const bk = e.byCategory;
  const pct = (n: number) => bk && bk.total > 0 ? (n / bk.total) * 100 : 0;
  return (
    <div className="wr-slide on wr-bg-energy">
      <div className="wr-ey wr-a1" style={{ color: 'var(--amber)' }}>⚡ Energy · this month</div>
      <div className="wr-stat wr-a2 wr-asc" style={{ color: 'var(--amber)' }}>
        {formatKwh(e.weekKwh).split(' ')[0]}<sup>{formatKwh(e.weekKwh).split(' ')[1]}</sup>
      </div>
      <div className="wr-bd wr-a3">
        {e.prevWeekKwh != null ? (
          <>
            <span className={`wr-delta ${deltaCls}`}>{formatPct(e.deltaPct)}</span> vs your baseline (last month)
            {e.onTarget ? <> · <strong>on target ✓</strong></> : null}
          </>
        ) : <em>No baseline yet to compare</em>}
      </div>
      {bk && (
        <div className="wr-hbars wr-a4" style={{ marginBottom: 14 }}>
          <div className="wr-hbrow">
            <div className="wr-hblbl"><span>End-use breakdown</span><span>{Math.round(bk.total).toLocaleString('it-IT')} kWh</span></div>
            <div className="wr-hbtrack" style={{ display: 'flex', height: 10 }}>
              <div className="wr-hbfill" style={{ background: 'var(--amber)', width: `${pct(bk.hvac)}%` }} title={`HVAC ${Math.round(pct(bk.hvac))}%`} />
              <div className="wr-hbfill" style={{ background: 'var(--purple)', width: `${pct(bk.lighting)}%` }} title={`Lighting ${Math.round(pct(bk.lighting))}%`} />
              <div className="wr-hbfill" style={{ background: 'var(--red)', width: `${pct(bk.plugs)}%` }} title={`Plugs ${Math.round(pct(bk.plugs))}%`} />
              <div className="wr-hbfill" style={{ background: 'rgba(255,255,255,.18)', width: `${pct(bk.other)}%` }} title={`Other ${Math.round(pct(bk.other))}%`} />
            </div>
            <div className="wr-hb-legend">
              <span><i style={{ background: 'var(--amber)' }} />HVAC {Math.round(pct(bk.hvac))}%</span>
              <span><i style={{ background: 'var(--purple)' }} />Lighting {Math.round(pct(bk.lighting))}%</span>
              <span><i style={{ background: 'var(--red)' }} />Plugs {Math.round(pct(bk.plugs))}%</span>
              {bk.other > 0 && <span><i style={{ background: 'rgba(255,255,255,.4)' }} />Other {Math.round(pct(bk.other))}%</span>}
            </div>
          </div>
        </div>
      )}
      <div className="wr-vchart wr-a4">
        <div className="wr-vbars">
          {recent.map((d, i) => {
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