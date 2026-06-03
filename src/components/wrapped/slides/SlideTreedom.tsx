import { formatKg } from '../lib/wrappedMath';
import type { SiteWeeklyData } from '../hooks/useSiteWeeklyWrap';

const SlideTreedom = ({ data }: { data: SiteWeeklyData }) => (
  <div className="wr-slide on wr-bg-trees">
    <div className="wr-tbadge wr-a1">✦ FGB × Treedom</div>
    <div className="wr-tree-ico wr-a2 wr-asc">🌳</div>
    <div className="wr-sub wr-a3">
      Your savings this week are equivalent<br/>to <span style={{ color: 'var(--teal)' }}>{data.co2.treesEquiv ?? 0} trees</span> growing for a year.
    </div>
    <div className="wr-bd wr-a4">
      Real, geotagged, traceable. Every FGB-monitored building contributes to reforestation in partnership with Treedom.
    </div>
    <div className="wr-tree-stats wr-a5">
      <div className="wr-ts-item">
        <div className="wr-ts-num">{data.co2.treesEquiv ?? 0}</div>
        <div className="wr-ts-lbl">Trees / year equiv.</div>
      </div>
      <div className="wr-ts-item">
        <div className="wr-ts-num" style={{ color: 'var(--amber)' }}>{formatKg(data.co2.savedKg)}</div>
        <div className="wr-ts-lbl">CO₂ saved this week</div>
      </div>
    </div>
  </div>
);
export default SlideTreedom;