import type { SiteMonthlyData } from '../hooks/useSiteMonthlyWrap';

const SlidePeerBenchmark = ({ data }: { data: SiteMonthlyData }) => {
  const p = data.peer!;
  const pctBelow = p.total > 1 ? Math.round(((p.total - p.rank) / (p.total - 1)) * 100) : 0;
  const best = p.top5[0]?.score ?? p.myScore;

  return (
    <div className="wr-slide on wr-bg-peer">
      <div className="wr-ey wr-a1" style={{ color: 'var(--purple)' }}>Peer benchmark</div>
      <div className="wr-peer-rank wr-asc">
        <span className="wr-peer-hash">#{p.rank}</span>
        <span className="wr-peer-of">of {p.total}</span>
      </div>
      <div className="wr-sub wr-a3">
        <span style={{ color: 'var(--purple)' }}>{pctBelow}%</span> of {p.brandName} stores score below you.
      </div>
      <div className="wr-peer-list wr-a4">
        {p.top5.map((row, i) => {
          const rank = row.isMe && i === 4 && p.rank > 5 ? p.rank : i + 1;
          const width = Math.max(8, Math.round((row.score / best) * 100));
          return (
            <div key={row.siteId} className={`wr-peer-row ${row.isMe ? 'me' : ''}`}>
              <div className="wr-peer-lbl">
                {row.isMe ? '▶ ' : ''}#{rank} {row.name}{row.isMe ? ' (you)' : ''}
                <span className="wr-peer-val">{row.score}</span>
              </div>
              <div className="wr-peer-track">
                <div
                  className="wr-peer-fill"
                  style={{
                    width: `${width}%`,
                    background: row.isMe ? 'var(--purple)' : i === 0 ? 'var(--amber)' : 'rgba(255,255,255,.22)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="wr-cap wr-a5">
        {p.brandName} · {p.total} buildings · {p.monthLabel}
      </div>
    </div>
  );
};
export default SlidePeerBenchmark;