interface Props { siteName: string; weekLabel: string; }
const SlideWelcome = ({ siteName, weekLabel }: Props) => (
  <div className="wr-slide on wr-bg-welcome">
    <div className="wr-badge wr-a1">Weekly Wrapped · {weekLabel}</div>
    <div className="wr-site wr-a2">{siteName}</div>
    <div className="wr-main wr-a3">Your<br/>Building's<br/><span className="ac">Wrapped.</span></div>
    <div className="wr-mo wr-a4">{weekLabel}</div>
    <div className="wr-cap wr-a5">→ Arrow keys, click or swipe to navigate</div>
  </div>
);
export default SlideWelcome;