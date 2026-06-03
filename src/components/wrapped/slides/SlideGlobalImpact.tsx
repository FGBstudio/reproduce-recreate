import { formatKg, formatNumber } from '../lib/wrappedMath';
import type { AggregateWeeklyData } from '../hooks/useAggregateWeeklyWrap';

const SlideGlobalImpact = ({ data }: { data: AggregateWeeklyData }) => {
  const parts = formatKg(data.totals.savedKg).split(' ');
  return (
    <div className="wr-slide on wr-bg-co2">
      <div className="wr-ey wr-a1" style={{ color: 'var(--teal)' }}>FGB worldwide impact</div>
      <div className="wr-stat wr-a2 wr-asc" style={{ color: 'var(--teal)' }}>
        {parts[0]}<sup>{parts[1]}</sup>
      </div>
      <div className="wr-sub wr-a3">CO₂ saved this week<br/>thanks to FGB monitoring.</div>
      <div className="wr-bd wr-a4">
        Equivalent to <strong style={{ color: 'var(--teal)' }}>{formatNumber(data.totals.treesEquiv)} trees</strong> growing for a year across {data.totals.sitesWithData} sites.
      </div>
      <div className="wr-cap wr-a5">Every monitored building moves the needle.</div>
    </div>
  );
};
export default SlideGlobalImpact;