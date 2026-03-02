import { useMemo } from 'react';
import { CheckCircle2, Clock, CircleDashed, Award, Gauge, CalendarDays, ShieldCheck, TrendingUp, ListChecks, CalendarClock } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Certification, CertificationMilestone } from '@/hooks/useCertifications';
import { useLanguage } from '@/contexts/LanguageContext';

interface LEEDCertificationWidgetProps {
  leedCert: Certification | null;
  milestones: CertificationMilestone[];
}

// LEED categories with max scores
const LEED_CATEGORIES = [
  { key: 'EA', label: 'Energia e Atmosfera', labelEn: 'Energy & Atmosphere', max: 33, color: '#10b981' },
  { key: 'WE', label: 'Efficienza Idrica', labelEn: 'Water Efficiency', max: 12, color: '#3b82f6' },
  { key: 'MR', label: 'Materiali e Risorse', labelEn: 'Materials & Resources', max: 13, color: '#f59e0b' },
  { key: 'EQ', label: 'Qualità Ambientale Interna', labelEn: 'Indoor Env. Quality', max: 16, color: '#8b5cf6' },
  { key: 'SS', label: 'Siti Sostenibili', labelEn: 'Sustainable Sites', max: 26, color: '#06b6d4' },
  { key: 'IN', label: 'Innovazione', labelEn: 'Innovation', max: 6, color: '#ec4899' },
  { key: 'RP', label: 'Priorità Regionale', labelEn: 'Regional Priority', max: 4, color: '#64748b' },
];

const LEVEL_THRESHOLDS = [
  { label: 'Certified', min: 40 },
  { label: 'Silver', min: 50 },
  { label: 'Gold', min: 60 },
  { label: 'Platinum', min: 80 },
];

export const LEEDCertificationWidget = ({ leedCert, milestones }: LEEDCertificationWidgetProps) => {
  const { language } = useLanguage();

  // === Real data from DB, fallback to 0/empty ===
  const score = leedCert?.score ?? 0;
  const level = leedCert?.level ?? null;
  const certType = leedCert?.cert_type ?? 'LEED';
  const status = leedCert?.status ?? null;
  const issuedDate = leedCert?.issued_date ?? null;
  const expiryDate = leedCert?.expiry_date ?? null;

  // Parse category scores from milestones (real DB data)
  const categoryData = useMemo(() => {
    return LEED_CATEGORIES.map(cat => {
      const milestone = milestones.find(m => m.category.toUpperCase() === cat.key);
      return {
        ...cat,
        label: language === 'it' ? cat.label : cat.labelEn,
        score: milestone?.score ?? 0,
        maxScore: milestone?.max_score ?? cat.max,
        dbStatus: milestone?.status ?? null,
      };
    });
  }, [milestones, language]);

  // Compute total from category milestones (source of truth)
  const totalFromCategories = categoryData.reduce((sum, c) => sum + c.score, 0);
  // Use cert-level score if available, otherwise sum from categories
  const displayScore = score > 0 ? score : totalFromCategories;

  // Donut chart: acquired vs remaining (no fake "under review")
  const acquired = displayScore;
  const remaining = Math.max(0, 110 - acquired);

  const donutData = [
    { name: language === 'it' ? 'Acquisiti' : 'Acquired', value: acquired, color: '#10b981' },
    { name: language === 'it' ? 'Rimanenti' : 'Remaining', value: remaining, color: '#3f3f46' },
  ];

  // Summary stats from real data
  const milestonesCompleted = milestones.filter(m => m.status === 'achieved' || m.status === 'completed').length;
  const milestonesInProgress = milestones.filter(m => m.status === 'in_progress').length;
  const nextAuditYear = expiryDate ? new Date(expiryDate).getFullYear() : null;

  // Certified since
  const certifiedSince = issuedDate
    ? new Date(issuedDate).getFullYear().toString()
    : null;

  // Determine current level based on score
  const achievedLevel = useMemo(() => {
    if (level) return level;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (displayScore >= LEVEL_THRESHOLDS[i].min) return LEVEL_THRESHOLDS[i].label;
    }
    return null;
  }, [level, displayScore]);

  const levelBadgeClass = achievedLevel === 'Platinum' ? 'bg-slate-200 text-slate-700' :
    achievedLevel === 'Gold' ? 'bg-amber-100 text-amber-700' :
    achievedLevel === 'Silver' ? 'bg-gray-200 text-gray-700' :
    achievedLevel === 'Certified' ? 'bg-emerald-100 text-emerald-700' :
    'bg-gray-100 text-gray-500';

  return (
    <div className="space-y-6">
      {/* ====== SECTION 1: Header Card (like reference image) ====== */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-lg">LEED</span>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">{certType}</h3>
            {achievedLevel && (
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1 ${levelBadgeClass}`}>
                {achievedLevel}
              </span>
            )}
          </div>
        </div>

        {/* Points obtained bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">{language === 'it' ? 'Punti ottenuti' : 'Points obtained'}</span>
            <span className="font-bold text-gray-800">{displayScore} / 110</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${(displayScore / 110) * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            {LEVEL_THRESHOLDS.map(t => (
              <span key={t.label} className={achievedLevel === t.label ? 'font-bold text-emerald-700' : ''}>
                {t.label} ({t.min})
              </span>
            ))}
          </div>
        </div>

        {/* Certified since */}
        {certifiedSince && (
          <div className="flex items-center gap-2 mt-4">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">
              {language === 'it' ? `Certificato dal ${certifiedSince}` : `Certified since ${certifiedSince}`}
            </span>
          </div>
        )}

        {/* Status indicator if not yet certified */}
        {!certifiedSince && status && (
          <div className="flex items-center gap-2 mt-4">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-medium text-amber-700">
              {status === 'active' ? (language === 'it' ? 'Certificazione attiva' : 'Active certification') :
               status === 'in_progress' ? (language === 'it' ? 'In corso' : 'In progress') :
               status}
            </span>
          </div>
        )}
      </div>

      {/* ====== SECTION 2: Summary Stats (like reference image bottom cards) ====== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-lg text-center">
          <ShieldCheck className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-black text-blue-500">{leedCert ? 1 : 0}</div>
          <div className="text-xs text-gray-500 font-medium mt-1">
            {language === 'it' ? 'Certificazioni Attive' : 'Active Certifications'}
          </div>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-lg text-center">
          <ListChecks className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
          <div className="text-2xl font-black text-emerald-500">{milestonesCompleted}</div>
          <div className="text-xs text-gray-500 font-medium mt-1">
            {language === 'it' ? 'Milestone Raggiunte' : 'Milestones Reached'}
          </div>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-lg text-center">
          <TrendingUp className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <div className="text-2xl font-black text-amber-500">{milestonesInProgress}</div>
          <div className="text-xs text-gray-500 font-medium mt-1">
            {language === 'it' ? 'In Corso' : 'In Progress'}
          </div>
        </div>
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-5 shadow-lg text-center">
          <CalendarClock className="w-5 h-5 text-rose-500 mx-auto mb-2" />
          <div className="text-2xl font-black text-rose-500">{nextAuditYear ?? '—'}</div>
          <div className="text-xs text-gray-500 font-medium mt-1">
            {language === 'it' ? 'Prossimo Audit' : 'Next Audit'}
          </div>
        </div>
      </div>

      {/* ====== SECTION 3: Donut + Categories side by side ====== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Donut chart */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg flex flex-col items-center justify-center">
          <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">
            {language === 'it' ? 'Distribuzione Punti' : 'Points Distribution'}
          </h4>
          <div className="relative w-full" style={{ maxWidth: 260, height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-gray-800">{displayScore}</span>
              <span className="text-xs text-gray-500 font-semibold">/ 110 pt</span>
            </div>
          </div>
          <div className="flex gap-4 mt-2 flex-wrap justify-center">
            {donutData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-gray-600">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
          <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-emerald-600" />
            {language === 'it' ? 'Categorie LEED' : 'LEED Categories'}
          </h4>
          <div className="space-y-3">
            {categoryData.map((cat) => {
              const pct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
              return (
                <div key={cat.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-500 w-6">{cat.key}</span>
                      <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-800">{cat.score}/{cat.maxScore}</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-600">
              {language === 'it' ? 'Totale' : 'Total'}
            </span>
            <span className="text-lg font-black text-emerald-600">{displayScore} / 110</span>
          </div>
        </div>
      </div>
    </div>
  );
};