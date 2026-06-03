interface Props { weekLabel: string; sitesCount: number; }
const SlideGlobalWelcome = ({ weekLabel, sitesCount }: Props) => (
  <div className="wr-slide on wr-bg-global">
    <div className="wr-badge wr-a1">FGB Global · {weekLabel}</div>
    <div className="wr-site wr-a2">{sitesCount} sites monitored worldwide</div>
    <div className="wr-main wr-a3">FGB's<br/>worldwide<br/><span className="ac">impact.</span></div>
    <div className="wr-mo wr-a4">{weekLabel}</div>
    <div className="wr-cap wr-a5">→ Click or arrow keys to navigate</div>
  </div>
);
export default SlideGlobalWelcome;