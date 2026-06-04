import { Fragment } from 'react';
import type { SiteMonthlyData } from '../hooks/useSiteMonthlyWrap';

const WELL_GOLD = 800;
const ASHRAE_MAX = 1000;
const OUTDOOR_REF = 420;
const SCALE_MAX = 1200;

const SlideAir = ({ data }: { data: SiteMonthlyData }) => {
  const avg = data.air.avgCo2Ppm;
  const pct = (v: number) => Math.min(100, (v / SCALE_MAX) * 100);
  const headroom = avg != null ? WELL_GOLD - avg : null;
  const compliant = avg != null ? avg <= WELL_GOLD : null;
  const hours = data.air.hoursExcellent;
  const perMetric = data.air.perMetric ?? [];
  const hasAnySignal = avg != null || hours != null || perMetric.length > 0;

  return (
    <div className="wr-slide on wr-bg-water">
      <div className="wr-ey wr-a1" style={{ color: 'var(--blue)' }}>🌬 Indoor Air Quality</div>
      <div className="wr-stat wr-a2 wr-asc" style={{ color: 'var(--blue)' }}>
        {avg != null
          ? <>{avg}<sup>ppm</sup></>
          : hours != null
            ? <>{hours}<sup>h</sup></>
            : <>—</>}
      </div>
      <div className="wr-bd wr-a3">
        {avg != null ? (
          <>Average CO₂ — WELL Gold limit is <strong>800 ppm.</strong>{' '}
            {compliant
              ? <>You stayed <strong style={{ color: 'var(--blue)' }}>{Math.round((headroom! / WELL_GOLD) * 100)}% below</strong> all month.</>
              : <>You exceeded the limit by <strong style={{ color: 'var(--red)' }}>{Math.round(((avg - WELL_GOLD) / WELL_GOLD) * 100)}%.</strong></>}
          </>
        ) : hours != null ? (
          <>of <strong>excellent air</strong> this month — all sensors within WELL/ASHRAE limits.</>
        ) : (
          <em>No indoor air readings for this month yet</em>
        )}
      </div>
      {perMetric.length > 0 && (
        <div className="wr-fgrid wr-a4" style={{ margin: '10px auto 8px' }}>
          {perMetric.map((m, i) => (
            <Fragment key={m.metric}>
              {i > 0 && <div className="wr-f-sep">·</div>}
              <div className="wr-fitem">
                <div className="wr-fitem-ico" style={{ fontSize: 14, opacity: .6 }}>
                  {m.metric === 'co2' ? 'CO₂' : m.metric === 'voc' ? 'VOC' : 'PM2.5'}
                </div>
                <div className="wr-fitem-v" style={{ color: 'var(--blue)' }}>{m.avg ?? '—'}</div>
                <div className="wr-fitem-l">{m.unit} · {m.hoursExcellent}h ok</div>
              </div>
            </Fragment>
          ))}
        </div>
      )}
      {hasAnySignal && (
      <div className="wr-cmp-bars wr-a4">
        <div className="wr-cmp-row">
          <div className="wr-cmp-lbl">Your avg</div>
          <div className="wr-cmp-track"><div className="wr-cmp-fill" style={{ background: 'var(--blue)', width: `${avg != null ? pct(avg) : 0}%` }} /></div>
          <div className="wr-cmp-val" style={{ color: 'var(--blue)' }}>{avg != null ? `${avg} ppm` : '—'}</div>
        </div>
        <div className="wr-cmp-row">
          <div className="wr-cmp-lbl">WELL Gold</div>
          <div className="wr-cmp-track"><div className="wr-cmp-fill" style={{ background: 'rgba(255,255,255,.25)', width: `${pct(WELL_GOLD)}%` }} /></div>
          <div className="wr-cmp-val" style={{ opacity: .4 }}>800 ppm</div>
        </div>
        <div className="wr-cmp-row">
          <div className="wr-cmp-lbl">Outdoor ref.</div>
          <div className="wr-cmp-track"><div className="wr-cmp-fill" style={{ background: 'rgba(0,196,154,.55)', width: `${pct(OUTDOOR_REF)}%` }} /></div>
          <div className="wr-cmp-val" style={{ color: 'var(--teal)' }}>{OUTDOOR_REF} ppm</div>
        </div>
        <div className="wr-cmp-row">
          <div className="wr-cmp-lbl">ASHRAE max</div>
          <div className="wr-cmp-track"><div className="wr-cmp-fill" style={{ background: 'rgba(232,82,58,.35)', width: `${pct(ASHRAE_MAX)}%` }} /></div>
          <div className="wr-cmp-val" style={{ opacity: .35 }}>1000 ppm</div>
        </div>
      </div>
      )}
      <div className="wr-cap wr-a5">
        {hours != null ? `${Math.round((hours / 720) * 100)}% of hours within WELL Gold · ${data.monthLabel}` :
          `${data.air.daysExcellent} excellent day${data.air.daysExcellent === 1 ? '' : 's'} · peak ${data.air.peakPpm ?? '—'} ppm`}
      </div>
    </div>
  );
};
export default SlideAir;