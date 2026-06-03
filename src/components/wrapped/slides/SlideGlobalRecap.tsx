import { formatKwh, formatKg, formatPct, formatNumber } from '../lib/wrappedMath';
import type { AggregateWeeklyData } from '../hooks/useAggregateWeeklyWrap';

interface Props { data: AggregateWeeklyData; onDownload: () => void; isDownloading: boolean; }

const SlideGlobalRecap = ({ data, onDownload, isDownloading }: Props) => {
  const t = data.totals;
  return (
    <div className="wr-slide on wr-bg-recap">
      <div className="wr-ey wr-a1" style={{ color: 'var(--teal)' }}>FGB Global · weekly recap</div>
      <div className="wr-card-wrap wr-a2">
        <div className="wr-pcard">
          <div className="wr-pc-hd">
            <div>
              <div className="wr-pc-title">FGB Worldwide</div>
              <div className="wr-pc-sub">{data.weekLabel} · {t.sitesWithData} active sites</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="wr-pc-fgb">FGB</div>
              <div className="wr-pc-sub">Global</div>
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
              <div className="wr-pc-kd wr-kd-g">≈ {formatNumber(t.treesEquiv)} trees/yr</div>
            </div>
            <div className="wr-pc-kpi">
              <div className="wr-pc-kv" style={{ color: 'var(--blue)' }}>{Object.keys(data.byRegion).length}</div>
              <div className="wr-pc-kl">Regions active</div>
              <div className="wr-pc-kd">AMER / APAC / EU / MEA</div>
            </div>
            <div className="wr-pc-kpi">
              <div className="wr-pc-kv" style={{ color: 'var(--purple)' }}>{t.sitesWithData}</div>
              <div className="wr-pc-kl">Reporting sites</div>
              <div className="wr-pc-kd">of {data.sites.length} total</div>
            </div>
          </div>
        </div>
        <button className="wr-dl-btn" onClick={onDownload} disabled={isDownloading}>
          {isDownloading ? '…' : '↓ Download FGB Global PDF'}
        </button>
        <div className="wr-cap">Share with stakeholders worldwide.</div>
      </div>
    </div>
  );
};
export default SlideGlobalRecap;