import type { SiteMonthlyData } from '../hooks/useSiteMonthlyWrap';

const SlideArchetype = ({ data }: { data: SiteMonthlyData }) => {
  const a = data.energy.archetype!;
  const profile = data.energy.hourlyProfile;
  const max = Math.max(...profile.map(v => v ?? 0), 1);
  const peakLabel = `${String(a.peakHour).padStart(2, '0')}:00`;
  return (
    <div className="wr-slide on wr-bg-identity">
      <div className="wr-ey wr-a1" style={{ color: 'var(--teal)' }}>Your building behaves like</div>
      <div className="wr-identity-emoji wr-a2 wr-asc">{a.emoji}</div>
      <div className="wr-identity-name wr-a3"><span className="ac">{a.name}.</span></div>
      <div className="wr-bd wr-a4" style={{ maxWidth: 520 }}>
        <strong>{a.caption}</strong><br/><br/>{a.description}
      </div>
      <div className="wr-archetype-profile wr-a5">
        {profile.map((v, h) => {
          const hh = (v ?? 0) / max * 100;
          return (
            <div key={h} className="wr-ap-col" title={`${h}:00 · ${v != null ? v.toFixed(2) : '—'} kWh`}>
              <div className="wr-ap-bar" style={{
                height: `${hh}%`,
                background: h === a.peakHour ? 'var(--teal)' : 'rgba(255,255,255,.18)',
              }} />
            </div>
          );
        })}
      </div>
      <div className="wr-cap">Peak hour · <strong style={{ color: 'var(--teal)' }}>{peakLabel}</strong></div>
    </div>
  );
};
export default SlideArchetype;