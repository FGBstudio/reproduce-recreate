interface Props { label: string; weekLabel: string; sitesCount: number; }
const SlideAggWelcome = ({ label, weekLabel, sitesCount }: Props) => (
  <div className="wr-slide on wr-bg-welcome">
    <div className="wr-badge wr-a1">Portfolio Wrapped · {weekLabel}</div>
    <div className="wr-site wr-a2">{label} · {sitesCount} site{sitesCount === 1 ? '' : 's'}</div>
    <div className="wr-main wr-a3">Your<br/>Portfolio's<br/><span className="ac">Wrapped.</span></div>
    <div className="wr-mo wr-a4">{weekLabel}</div>
    <div className="wr-cap wr-a5">→ Click or arrow keys to navigate</div>
  </div>
);
export default SlideAggWelcome;