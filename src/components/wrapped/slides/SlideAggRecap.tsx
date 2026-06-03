import { formatKwh, formatKg, formatPct } from '../lib/wrappedMath';
import type { AggregateWeeklyData } from '../hooks/useAggregateWeeklyWrap';

interface Props { data: AggregateWeeklyData; label: string; onDownload: () => void; isDownloading: boolean; }

const SlideAggRecap = ({ data, label, onDownload, isDownloading }: Props) => {
  const t = data.totals;
  return (
    <div className="wr-slide on wr-bg-recap">
      <div className="wr-ey wr-a1" style={{ color: 'var(--teal)' }}>Portfolio recap</div>
      <div className="wr-card-wrap wr-a2">
        <div className="wr-pcard">
          <div className="wr-pc-hd">
            <div>
              <div className="wr-pc-title">{label}</div>
              <div className="wr-pc-sub">{data.weekLabel} · {t.sitesWithData} sites</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="wr-pc-fgb">FGB</div>
              <div className="wr-pc-sub">Wrapped</div>
            </div>
          </div>
          <div className="wr-pc-grid">
            <div className="wr-pc-kpi">
              <div className="wr-pc-kv" style={{ color: 'var(--amber)' }}>{formatKwh(t.weekKwh)}</div>
              <div className="wr-pc-kl">Total energy</div>
              <div className={`wr-pc-kd ${t.deltaPct != null && t.deltaPct <= 0 ? 'wr-kd-g' : 'wr-kd-r'}`}>{formatPct(t.deltaPct)} vs last week</div>
            </div>
            <div className="wr-pc-kpi">
              <div className="wr-pc-kv" style={{ color: 'var(--teal)' }}>{formatKg(t.savedKg)}</div>
              <div className="wr-pc-kl">CO₂ saved</div>
              <div className="wr-pc-kd wr-kd-g">≈ {t.treesEquiv} trees/yr</div>
            </div>
            <div className="wr-pc-kpi">
              <div className="wr-pc-kv" style={{ color: 'var(--blue)' }}>{data.leaderboard[0]?.name ?? '—'}</div>
              <div className="wr-pc-kl">Top site (EUI)</div>
              <div className="wr-pc-kd">{data.leaderboard[0]?.eui?.toFixed(2) ?? '—'} kWh/m²</div>
            </div>
            <div className="wr-pc-kpi">
              <div className="wr-pc-kv" style={{ color: 'var(--amber)' }}>{data.mostImproved[0]?.name ?? '—'}</div>
              <div className="wr-pc-kl">Most improved</div>
              <div className="wr-pc-kd wr-kd-g">{formatPct(data.mostImproved[0]?.deltaPct ?? null)}</div>
            </div>
          </div>
        </div>
        <button className="wr-dl-btn" onClick={onDownload} disabled={isDownloading}>
          {isDownloading ? '…' : '↓ Download portfolio PDF'}
        </button>
        <div className="wr-cap">Need the deep-dive? Use the full report generator.</div>
      </div>
    </div>
  );
};
export default SlideAggRecap;