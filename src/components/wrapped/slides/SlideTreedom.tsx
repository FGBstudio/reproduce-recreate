import { formatKg } from '../lib/wrappedMath';
import type { SiteMonthlyData } from '../hooks/useSiteMonthlyWrap';

const SlideTreedom = ({ data }: { data: SiteMonthlyData }) => {
  const saved = data.co2.savedKg ?? 0;
  const trees = data.co2.treesEquiv ?? 0;
  const positive = saved > 0;
  const emittedKg = data.co2.weekKg ?? null;

  if (!positive) {
    return (
      <div className="wr-slide on wr-bg-trees">
        <div className="wr-tbadge wr-a1">✦ FGB × Treedom</div>
        <div className="wr-tree-ico wr-a2 wr-asc">🌍</div>
        <div className="wr-sub wr-a3">
          This week you emitted<br/><span style={{ color: 'var(--teal)' }}>{formatKg(emittedKg)} CO₂</span>.
        </div>
        <div className="wr-bd wr-a4">
          Compared to last week (or the same week last year) consumption was not lower. Aim for less next cycle — every kWh avoided becomes a real, geotagged tree through Treedom.
        </div>
      </div>
    );
  }

  return (
    <div className="wr-slide on wr-bg-trees">
      <div className="wr-tbadge wr-a1">✦ FGB × Treedom</div>
      <div className="wr-tree-ico wr-a2 wr-asc">🌳</div>
      <div className="wr-sub wr-a3">
        Your savings this week are equivalent<br/>to <span style={{ color: 'var(--teal)' }}>{trees} trees</span> growing for a year.
      </div>
      <div className="wr-bd wr-a4">
        Real, geotagged, traceable. Every FGB-monitored building contributes to reforestation in partnership with Treedom.
      </div>
      <div className="wr-tree-stats wr-a5">
        <div className="wr-ts-item">
          <div className="wr-ts-num">{trees}</div>
          <div className="wr-ts-lbl">Trees / year equiv.</div>
        </div>
        <div className="wr-ts-item">
          <div className="wr-ts-num" style={{ color: 'var(--amber)' }}>{formatKg(saved)}</div>
          <div className="wr-ts-lbl">CO₂ saved this week</div>
        </div>
      </div>
    </div>
  );
};
export default SlideTreedom;