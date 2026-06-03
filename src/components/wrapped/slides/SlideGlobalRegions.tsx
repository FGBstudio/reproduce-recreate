import { formatKwh, formatPct } from '../lib/wrappedMath';
import type { AggregateWeeklyData } from '../hooks/useAggregateWeeklyWrap';

const REGION_ORDER = ['AMER', 'APAC', 'EU', 'MEA'];
const REGION_COLOR: Record<string, string> = {
  AMER: 'var(--amber)',
  APAC: 'var(--blue)',
  EU: 'var(--teal)',
  MEA: 'var(--purple)',
};

const SlideGlobalRegions = ({ data }: { data: AggregateWeeklyData }) => {
  // Normalise region keys: anything not in REGION_ORDER folds into "MEA" or shows under OTHER
  const rows = REGION_ORDER.map(r => {
    const k = Object.keys(data.byRegion).find(x => x.toUpperCase() === r);
    return { region: r, ...(k ? data.byRegion[k] : { weekKwh: 0, prevWeekKwh: 0, sites: 0, deltaPct: null, savedKg: 0 }) };
  });
  const max = Math.max(...rows.map(r => r.weekKwh), 1);

  return (
    <div className="wr-slide on wr-bg-regions">
      <div className="wr-ey wr-a1" style={{ color: 'var(--blue)' }}>🌎 Energy by region</div>
      <div className="wr-sub wr-a2">Where the world consumed this week.</div>
      <div className="wr-region-grid wr-a3">
        {rows.map((r, i) => {
          const h = (r.weekKwh / max) * 100;
          const deltaCls = r.deltaPct == null ? '' : r.deltaPct <= 0 ? 'wr-kd-g' : 'wr-kd-r';
          return (
            <div className="wr-region-col" key={r.region}>
              <div className="wr-region-val">{formatKwh(r.weekKwh)}</div>
              <div
                className="wr-region-bar"
                style={{
                  height: `${Math.max(2, h)}%`,
                  background: REGION_COLOR[r.region],
                  transitionDelay: `${i * 100}ms`,
                }}
              />
              <div className={`wr-region-delta ${deltaCls}`}>{formatPct(r.deltaPct)}</div>
              <div className="wr-region-lbl">{r.region}</div>
            </div>
          );
        })}
      </div>
      <div className="wr-cap wr-a5">Total saved CO₂: {rows.reduce((a, r) => a + r.savedKg, 0).toFixed(0)} kg</div>
    </div>
  );
};
export default SlideGlobalRegions;