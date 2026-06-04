import { formatKwh, formatKg, formatPct, dayName } from '../lib/wrappedMath';
import type { SiteMonthlyData } from '../hooks/useSiteMonthlyWrap';

interface Props { data: SiteMonthlyData; siteName: string; onDownload: () => void; isDownloading: boolean; }

const SlideRecap = ({ data, siteName, onDownload, isDownloading }: Props) => {
  const days = (data.energy.daily ?? []).filter(d => d.kwh != null);
  return (
  <div className="wr-slide on wr-bg-recap">
    <div className="wr-ey wr-a1" style={{ color: 'var(--teal)' }}>Weekly recap</div>
    <div className="wr-card-wrap wr-a2">
      <div className="wr-pcard">
        <div className="wr-pc-hd">
          <div>
            <div className="wr-pc-title">{siteName}</div>
            <div className="wr-pc-sub">{data.weekLabel}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="wr-pc-fgb">FGB</div>
            <div className="wr-pc-sub">Wrapped</div>
          </div>
        </div>
        <div className="wr-pc-grid">
          <div className="wr-pc-kpi">
            <div className="wr-pc-kv" style={{ color: 'var(--amber)' }}>{formatKwh(data.energy.weekKwh)}</div>
            <div className="wr-pc-kl">Energy</div>
            <div className={`wr-pc-kd ${data.energy.deltaPct != null && data.energy.deltaPct <= 0 ? 'wr-kd-g' : 'wr-kd-r'}`}>
              {formatPct(data.energy.deltaPct)} vs baseline
            </div>
          </div>
          <div className="wr-pc-kpi">
            <div className="wr-pc-kv" style={{ color: (data.co2.savedKg ?? 0) > 0 ? 'var(--teal)' : 'var(--amber)' }}>
              {(data.co2.savedKg ?? 0) > 0 ? formatKg(data.co2.savedKg) : formatKg(data.co2.weekKg)}
            </div>
            <div className="wr-pc-kl">{(data.co2.savedKg ?? 0) > 0 ? 'CO₂ saved' : 'CO₂ emitted'}</div>
            <div className="wr-pc-kd wr-kd-g">≈ {data.co2.treesEquiv ?? 0} trees/yr</div>
          </div>
          <div className="wr-pc-kpi">
            <div className="wr-pc-kv" style={{ color: 'var(--blue)' }}>{data.air.avgCo2Ppm ?? '—'}</div>
            <div className="wr-pc-kl">Avg CO₂ ppm</div>
            <div className="wr-pc-kd">{data.air.daysExcellent} excellent days</div>
          </div>
          <div className="wr-pc-kpi">
            <div className="wr-pc-kv" style={{ color: 'var(--red)' }}>{data.alerts.activeNow}</div>
            <div className="wr-pc-kl">Active alerts</div>
            <div className="wr-pc-kd">{data.alerts.resolvedThisWeek} resolved</div>
          </div>
        </div>
        {days.length > 0 && (
          <table className="wr-recap-table">
            <thead>
              <tr><th>Day</th><th>kWh</th><th>CO₂</th></tr>
            </thead>
            <tbody>
              {days.map(d => (
                <tr key={d.day}>
                  <td>{dayName(d.day)} <span style={{ opacity: .4 }}>{d.day.slice(5)}</span></td>
                  <td>{Math.round(d.kwh!).toLocaleString('it-IT')}</td>
                  <td>{Math.round(d.kwh! * 0.233)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <button className="wr-dl-btn" onClick={onDownload} disabled={isDownloading}>
        {isDownloading ? '…' : '↓ Download weekly PDF'}
      </button>
      <div className="wr-cap">Need the deep-dive? Use the full report generator.</div>
    </div>
  </div>
  );
};
export default SlideRecap;