import { formatKg } from '../lib/wrappedMath';
import type { AggregateWeeklyData } from '../hooks/useAggregateWeeklyWrap';

const SlideAggCO2 = ({ data }: { data: AggregateWeeklyData }) => {
  const parts = formatKg(data.totals.savedKg).split(' ');
  return (
    <div className="wr-slide on wr-bg-trees">
      <div className="wr-tbadge wr-a1">✦ Combined CO₂ impact</div>
      <div className="wr-stat wr-a2 wr-asc" style={{ color: 'var(--teal)' }}>
        {parts[0]}<sup>{parts[1]}</sup>
      </div>
      <div className="wr-sub wr-a3">CO₂ avoided this week across the portfolio.</div>
      <div className="wr-bd wr-a4">
        Equivalent to <strong style={{ color: 'var(--teal)' }}>{data.totals.treesEquiv} trees</strong> growing for a year.
      </div>
      <div className="wr-cap wr-a5">FGB × Treedom · weekly aggregate</div>
    </div>
  );
};
export default SlideAggCO2;