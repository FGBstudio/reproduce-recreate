import type { SiteWeeklyData } from '../hooks/useSiteWeeklyWrap';

const SlideAlerts = ({ data }: { data: SiteWeeklyData }) => {
  const a = data.alerts;
  const total = a.activeNow + a.resolvedThisWeek;
  const allClear = a.activeNow === 0;

  return (
    <div className="wr-slide on wr-bg-alerts">
      <div className="wr-ey wr-a1" style={{ color: allClear ? 'var(--teal)' : 'var(--red)' }}>
        Alerts this week
      </div>
      <div className="wr-stat wr-a2 wr-asc" style={{ color: allClear ? 'var(--teal)' : 'var(--red)' }}>
        {total}
      </div>
      <div className="wr-sub wr-a3">
        {allClear
          ? <>All <span style={{ color: 'var(--teal)' }}>resolved.</span></>
          : <><span style={{ color: 'var(--red)' }}>{a.activeNow}</span> still active.</>}
      </div>
      <div className="wr-alert-grid wr-a4">
        <div className="wr-alert-col">
          <div className="wr-alert-num" style={{ color: 'var(--red)' }}>{a.activeNow}</div>
          <div className="wr-alert-lbl">Active</div>
        </div>
        <div style={{ opacity: .2, fontSize: 28 }}>·</div>
        <div className="wr-alert-col">
          <div className="wr-alert-num" style={{ color: 'var(--teal)' }}>{a.resolvedThisWeek}</div>
          <div className="wr-alert-lbl">Resolved</div>
        </div>
      </div>
      <div className="wr-cap wr-a5">
        {allClear ? 'Calm week. Keep going.' : 'Open the alerts panel to review and action.'}
      </div>
    </div>
  );
};
export default SlideAlerts;