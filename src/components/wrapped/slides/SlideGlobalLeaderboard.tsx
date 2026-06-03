import { formatPct } from '../lib/wrappedMath';
import type { AggregateWeeklyData } from '../hooks/useAggregateWeeklyWrap';

const SlideGlobalLeaderboard = ({ data }: { data: AggregateWeeklyData }) => {
  // Aggregate by brandName
  const byBrand = new Map<string, { weekKwh: number; prevWeekKwh: number; sites: number }>();
  data.sites.forEach(s => {
    if (!s.brandName) return;
    const cur = byBrand.get(s.brandName) ?? { weekKwh: 0, prevWeekKwh: 0, sites: 0 };
    cur.sites += 1;
    if (s.weekKwh != null) cur.weekKwh += s.weekKwh;
    if (s.prevWeekKwh != null) cur.prevWeekKwh += s.prevWeekKwh;
    byBrand.set(s.brandName, cur);
  });
  const ranked = Array.from(byBrand.entries())
    .map(([name, v]) => ({
      name,
      sites: v.sites,
      deltaPct: v.prevWeekKwh > 0 ? ((v.weekKwh - v.prevWeekKwh) / v.prevWeekKwh) * 100 : null,
    }))
    .filter(b => b.deltaPct != null)
    .sort((a, b) => (a.deltaPct! - b.deltaPct!))
    .slice(0, 5);

  return (
    <div className="wr-slide on wr-bg-leader">
      <div className="wr-ey wr-a1" style={{ color: 'var(--amber)' }}>★ Top brand performers</div>
      <div className="wr-sub wr-a2">Brands cutting consumption the most.</div>
      <div className="wr-list wr-a3">
        {ranked.map((b, i) => (
          <div key={b.name} className={`wr-li ${i === 0 ? 'gold' : ''}`}>
            <div className="wr-li-pos">{i + 1}</div>
            <div className="wr-li-name">{b.name} <span style={{ opacity: .4, fontWeight: 400 }}>· {b.sites} sites</span></div>
            <div className="wr-li-val" style={{ color: 'var(--teal)' }}>{formatPct(b.deltaPct)}</div>
          </div>
        ))}
      </div>
      <div className="wr-cap wr-a5">Ranked by week-over-week energy reduction.</div>
    </div>
  );
};
export default SlideGlobalLeaderboard;