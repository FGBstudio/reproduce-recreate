import { useEffect, useState } from 'react';

interface Props { score: number; trend?: number[] | null; }

const SlideScore = ({ score, trend }: Props) => {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 80);
    return () => clearTimeout(t);
  }, [score]);

  const C = 2 * Math.PI * 86; // circumference
  const offset = C - (animated / 100) * C;

  const label = score >= 90 ? 'Exceptional' : score >= 75 ? 'Strong' : score >= 60 ? 'On track' : 'Needs care';
  const pctTop = score >= 90 ? 'top 10%' : score >= 75 ? 'top 25%' : score >= 60 ? 'top 50%' : '';

  return (
    <div className="wr-slide on wr-bg-score">
      <div className="wr-ey wr-a1" style={{ color: 'var(--teal)' }}>Overall Performance</div>
      <div className="wr-rw wr-asc">
        <svg className="wr-rsv" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="wr-rg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00C49A" />
              <stop offset="100%" stopColor="#00FFCC" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="86" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" />
          <circle
            cx="100" cy="100" r="86" fill="none"
            stroke="url(#wr-rg)" strokeWidth="10"
            strokeDasharray={C} strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dashoffset 2.2s cubic-bezier(.16,1,.3,1)' }}
          />
        </svg>
        <div className="wr-ri">
          <div className="wr-rn" style={{ color: 'var(--teal)' }}>{score}</div>
          <div className="wr-rl">out of 100</div>
        </div>
      </div>
      <div className="wr-sub wr-a2">
        {label}{pctTop && <> · <span style={{ color: 'var(--teal)' }}>{pctTop}</span></>}.
      </div>
      {trend && trend.length > 1 && (
        <>
          <div className="wr-month-bars wr-a4">
            {trend.map((v, i) => (
              <div
                key={i}
                className={`wr-mb ${i === trend.length - 1 ? 'hi' : ''}`}
                style={{ height: `${Math.max(2, (v / 100) * 100)}%`, transitionDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
          <div className="wr-cap wr-a5">Score trend (last weeks)</div>
        </>
      )}
    </div>
  );
};
export default SlideScore;