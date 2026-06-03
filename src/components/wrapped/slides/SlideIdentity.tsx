import { identityForScore } from '../lib/wrappedMath';

const SlideIdentity = ({ score }: { score: number | null }) => {
  const id = identityForScore(score);
  return (
    <div className="wr-slide on wr-bg-identity">
      <div className="wr-ey wr-a1" style={{ color: 'var(--teal)' }}>This week your building is</div>
      <div className="wr-identity-emoji wr-a2 wr-asc">{id.emoji}</div>
      <div className="wr-identity-name wr-a3">A <span className="ac">{id.name}.</span></div>
      <div className="wr-bd wr-a4" style={{ maxWidth: 520 }}>
        <strong>{id.traits}</strong><br/><br/>
        {id.description}
      </div>
      {score != null && <div className="wr-cap wr-a5">Score this week · {score}/100</div>}
    </div>
  );
};
export default SlideIdentity;