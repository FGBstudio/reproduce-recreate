import type { SiteWeeklyData } from '../hooks/useSiteWeeklyWrap';

const WELL_GOLD = 800;
const ASHRAE_MAX = 1000;
const OUTDOOR_REF = 420;
const SCALE_MAX = 1200;

const SlideAir = ({ data }: { data: SiteWeeklyData }) => {
  const avg = data.air.avgCo2Ppm!;
  const pct = (v: number) => Math.min(100, (v / SCALE_MAX) * 100);
  const headroom = WELL_GOLD - avg;
  const compliant = avg <= WELL_GOLD;

  return (
    <div className="wr-slide on wr-bg-water">
      <div className="wr-ey wr-a1" style={{ color: 'var(--blue)' }}>🌬 Indoor Air Quality</div>
      <div className="wr-stat wr-a2 wr-asc" style={{ color: 'var(--blue)' }}>
        {avg}<sup>ppm</sup>
      </div>
      <div className="wr-bd wr-a3">
        Average CO₂ this week. WELL Gold limit is <strong>800 ppm.</strong>
        {compliant
          ? <> You stayed <strong style={{ color: 'var(--blue)' }}>{Math.round((headroom / WELL_GOLD) * 100)}% below</strong> all week.</>
          : <> You exceeded the limit by <strong style={{ color: 'var(--red)' }}>{Math.round(((avg - WELL_GOLD) / WELL_GOLD) * 100)}%.</strong></>}
      </div>
      <div className="wr-cmp-bars wr-a4">
        <div className="wr-cmp-row">
          <div className="wr-cmp-lbl">Your avg</div>
          <div className="wr-cmp-track"><div className="wr-cmp-fill" style={{ background: 'var(--blue)', width: `${pct(avg)}%` }} /></div>
          <div className="wr-cmp-val" style={{ color: 'var(--blue)' }}>{avg} ppm</div>
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
      <div className="wr-cap wr-a5">
        {data.air.daysExcellent} excellent day{data.air.daysExcellent === 1 ? '' : 's'} · peak {data.air.peakPpm ?? '—'} ppm
      </div>
    </div>
  );
};
export default SlideAir;