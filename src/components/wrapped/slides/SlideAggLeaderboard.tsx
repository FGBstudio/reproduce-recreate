import type { AggregateWeeklyData } from '../hooks/useAggregateWeeklyWrap';

const SlideAggLeaderboard = ({ data }: { data: AggregateWeeklyData }) => (
  <div className="wr-slide on wr-bg-leader">
    <div className="wr-ey wr-a1" style={{ color: 'var(--amber)' }}>★ Leaderboard · best EUI</div>
    <div className="wr-sub wr-a2">Top performers this week.</div>
    <div className="wr-list wr-a3">
      {data.leaderboard.map((s, i) => (
        <div key={s.siteId} className={`wr-li ${i === 0 ? 'gold' : ''}`}>
          <div className="wr-li-pos">{i + 1}</div>
          <div className="wr-li-name">{s.name}</div>
          <div className="wr-li-val">{s.eui!.toFixed(2)} kWh/m²</div>
        </div>
      ))}
    </div>
    <div className="wr-cap wr-a5">Lower EUI is better — energy used per square metre.</div>
  </div>
);
export default SlideAggLeaderboard;