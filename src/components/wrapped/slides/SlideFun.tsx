import { Fragment } from 'react';
import { formatNumber, formatKwh, energyEquivalences } from '../lib/wrappedMath';
import type { SiteMonthlyData } from '../hooks/useSiteMonthlyWrap';

const SlideFun = ({ data, seed }: { data: SiteMonthlyData; seed: string }) => {
  const kwh = data.energy.monthKwh ?? data.energy.weekKwh ?? 0;
  const equivs = energyEquivalences(kwh, seed);

  return (
    <div className="wr-slide on wr-bg-fun">
      <div className="wr-ey wr-a1" style={{ color: 'var(--teal)' }}>In numbers</div>
      <div className="wr-stat wr-a2 wr-asc" style={{ color: 'var(--teal)' }}>
        {formatKwh(kwh).split(' ')[0]}<sup>{formatKwh(kwh).split(' ')[1]}</sup>
      </div>
      <div className="wr-sub wr-a3">You used enough energy to…</div>
      <div className="wr-fgrid wr-a4">
        {equivs.map((e, i) => (
          <Fragment key={e.label}>
            {i > 0 && <div className="wr-f-sep">·</div>}
            <div className="wr-fitem">
              <div className="wr-fitem-ico">{e.icon}</div>
              <div className="wr-fitem-v">{formatNumber(e.value)}{e.unit && ` ${e.unit}`}</div>
              <div className="wr-fitem-l">{e.label}</div>
            </div>
          </Fragment>
        ))}
      </div>
      <div className="wr-cap wr-a5">A new way to look at kilowatt-hours.</div>
    </div>
  );
};
export default SlideFun;