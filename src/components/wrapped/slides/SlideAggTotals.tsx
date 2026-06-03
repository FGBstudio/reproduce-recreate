import { formatKwh, formatPct } from '../lib/wrappedMath';
import type { AggregateWeeklyData } from '../hooks/useAggregateWeeklyWrap';

const SlideAggTotals = ({ data }: { data: AggregateWeeklyData }) => {
  const t = data.totals;
  const deltaCls = t.deltaPct == null ? 'neutral' : t.deltaPct <= 0 ? 'good' : 'bad';
  const parts = formatKwh(t.weekKwh).split(' ');
  return (
    <div className="wr-slide on wr-bg-energy">
      <div className="wr-ey wr-a1" style={{ color: 'var(--amber)' }}>⚡ Total energy · this week</div>
      <div className="wr-stat wr-a2 wr-asc" style={{ color: 'var(--amber)' }}>
        {parts[0]}<sup>{parts[1]}</sup>
      </div>
      <div className="wr-bd wr-a3">
        {t.deltaPct != null
          ? <><span className={`wr-delta ${deltaCls}`}>{formatPct(t.deltaPct)}</span> vs last week</>
          : <em>No previous week data to compare</em>}
      </div>
      <div className="wr-cap wr-a5">{t.sitesWithData} site{t.sitesWithData === 1 ? '' : 's'} reporting this week</div>
    </div>
  );
};
export default SlideAggTotals;