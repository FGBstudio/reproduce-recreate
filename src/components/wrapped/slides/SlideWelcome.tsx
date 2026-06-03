interface Props {
  siteName: string;
  weekLabel: string;
  title?: { line1: string; line2: string; accent: string };
  badge?: string;
}
const SlideWelcome = ({ siteName, weekLabel, title, badge }: Props) => {
  const t = title ?? { line1: 'Your', line2: "Building's", accent: 'Wrapped.' };
  return (
    <div className="wr-slide on wr-bg-welcome">
      <div className="wr-badge wr-a1">{badge ?? 'Weekly Wrapped'} · {weekLabel}</div>
      <div className="wr-site wr-a2">{siteName}</div>
      <div className="wr-main wr-a3">{t.line1}<br/>{t.line2}<br/><span className="ac">{t.accent}</span></div>
      <div className="wr-mo wr-a4">{weekLabel}</div>
      <div className="wr-cap wr-a5">→ Arrow keys, click or swipe to navigate</div>
    </div>
  );
};
export default SlideWelcome;