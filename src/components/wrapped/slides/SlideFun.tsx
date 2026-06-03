import { formatPct, formatNumber } from '../lib/wrappedMath';
import type { SiteWeeklyData } from '../hooks/useSiteWeeklyWrap';

const SlideFun = ({ data }: { data: SiteWeeklyData }) => {
  const savedKwh = (data.energy.prevWeekKwh ?? 0) - (data.energy.weekKwh ?? 0);
  const phones = Math.round(savedKwh * 100); // ≈ 0.01 kWh per full phone charge
  const aptMonths = (savedKwh / 300).toFixed(1).replace('.', ','); // 300 kWh/month ≈ small apt
  const co2Kg = Math.round(data.co2.savedKg ?? 0);

  return (
    <div className="wr-slide on wr-bg-fun">
      <div className="wr-ey wr-a1" style={{ color: 'var(--teal)' }}>In numbers</div>
      <div className="wr-stat wr-a2 wr-asc" style={{ color: 'var(--teal)' }}>
        {formatPct(data.energy.deltaPct)}
      </div>
      <div className="wr-sub wr-a3">Energy saved vs last week.<br/>That translates to…</div>
      <div className="wr-fgrid wr-a4">
        <div className="wr-fitem">
          <div className="wr-fitem-ico">📱</div>
          <div className="wr-fitem-v">{formatNumber(phones)}</div>
          <div className="wr-fitem-l">phones<br/>charged</div>
        </div>
        <div className="wr-f-sep">·</div>
        <div className="wr-fitem">
          <div className="wr-fitem-ico">🏠</div>
          <div className="wr-fitem-v">{aptMonths}</div>
          <div className="wr-fitem-l">months apt<br/>powered</div>
        </div>
        <div className="wr-f-sep">·</div>
        <div className="wr-fitem">
          <div className="wr-fitem-ico">🌍</div>
          <div className="wr-fitem-v">{formatNumber(co2Kg)} kg</div>
          <div className="wr-fitem-l">CO₂ not<br/>emitted</div>
        </div>
      </div>
      <div className="wr-cap wr-a5">Keep the streak — small choices, big impact.</div>
    </div>
  );
};
export default SlideFun;