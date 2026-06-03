import { formatPct } from '../lib/wrappedMath';
import type { AggregateWeeklyData } from '../hooks/useAggregateWeeklyWrap';

const SlideAggMostImproved = ({ data }: { data: AggregateWeeklyData }) => (
  <div className="wr-slide on wr-bg-improved">
    <div className="wr-ey wr-a1" style={{ color: 'var(--teal)' }}>↘ Most improved</div>
    <div className="wr-sub wr-a2">Biggest week-over-week energy reductions.</div>
    <div className="wr-list wr-a3">
      {data.mostImproved.map((s, i) => (
        <div key={s.siteId} className={`wr-li ${i === 0 ? 'gold' : ''}`}>
          <div className="wr-li-pos">{i + 1}</div>
          <div className="wr-li-name">{s.name}</div>
          <div className="wr-li-val" style={{ color: 'var(--teal)' }}>{formatPct(s.deltaPct)}</div>
        </div>
      ))}
    </div>
    <div className="wr-cap wr-a5">Negative delta = lower consumption than last week.</div>
  </div>
);
export default SlideAggMostImproved;