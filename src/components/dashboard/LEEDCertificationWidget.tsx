import { useMemo } from 'react';
import { CheckCircle2, Clock, CircleDashed, Award, Gauge, CalendarDays } from 'lucide-react';
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

// Default milestone timeline
const DEFAULT_MILESTONES_TIMELINE = [
  { name: 'Registrazione Progetto', nameEn: 'Project Registration', status: 'completed', date: '15 Gen 2024' },
  { name: 'Fine Fase di Progettazione', nameEn: 'Design Phase Complete', status: 'completed', date: '20 Giu 2024' },
  { name: 'Fine Costruzione Cantiere', nameEn: 'Construction Complete', status: 'in_progress', date: '15 Mar 2025' },
  { name: 'Fine Attività di Commissioning', nameEn: 'Commissioning Activities (Cx)', status: 'future', date: '01 Set 2025' },
  { name: 'Sottomissione Finale GBCI', nameEn: 'Final GBCI Submission', status: 'future', date: '15 Nov 2025' },
  { name: 'Rilascio Certificazione', nameEn: 'Certification Release', status: 'future', date: '01 Feb 2026' },
];

export const LEEDCertificationWidget = ({ leedCert, milestones }: LEEDCertificationWidgetProps) => {
  const { language } = useLanguage();

  const score = leedCert?.score ?? 65;
  const targetScore = leedCert?.target_score ?? 110;
  const level = leedCert?.level ?? 'Gold';
  const certType = leedCert?.cert_type ?? 'LEED v4';

  // Parse category scores from milestones or use defaults
  const categoryData = useMemo(() => {
    return LEED_CATEGORIES.map(cat => {
      const milestone = milestones.find(m => m.category.toUpperCase().includes(cat.key));
      return {
        ...cat,
        label: language === 'it' ? cat.label : cat.labelEn,
        score: milestone?.score ?? Math.round(cat.max * 0.55),
      };
    });
  }, [milestones, language]);

  // Donut chart data
  const acquired = score;
  const underReview = Math.round(targetScore * 0.18);
  const remaining = Math.max(0, 110 - acquired - underReview);

  const donutData = [
    { name: language === 'it' ? 'Acquisiti' : 'Acquired', value: acquired, color: '#10b981' },
    { name: language === 'it' ? 'Sotto Revisione' : 'Under Review', value: underReview, color: '#f59e0b' },
    { name: language === 'it' ? 'Non Tentati' : 'Not Attempted', value: remaining, color: '#3f3f46' },
  ];

  const levelThresholds = [
    { label: 'Certified', min: 40 },
    { label: 'Silver', min: 50 },
    { label: 'Gold', min: 60 },
    { label: 'Platinum', min: 80 },
  ];

  return (
    <div className="space-y-6">
      {/* ====== SECTION 1: Header & Score ====== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Info */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-lg">LEED</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">{certType}</h3>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                level === 'Platinum' ? 'bg-slate-200 text-slate-700' :
                level === 'Gold' ? 'bg-amber-100 text-amber-700' :
                level === 'Silver' ? 'bg-gray-200 text-gray-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>{level}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl">
              <Clock className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <div className="text-xs text-amber-700 font-semibold uppercase tracking-wider">
                  {language === 'it' ? 'Stato Attuale' : 'Current Status'}
                </div>
                <div className="text-sm font-bold text-amber-800">
                  {language === 'it' ? 'In fase di Costruzione' : 'Under Construction'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
              <CalendarDays className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">
                  {language === 'it' ? 'Certificazione Attesa' : 'Expected Certification'}
                </div>
                <div className="text-sm font-bold text-emerald-800">
                  {leedCert?.expiry_date ? new Date(leedCert.expiry_date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' }) : 'Q1 2026'}
                </div>
              </div>
            </div>

            {/* Score bar */}
            <div className="mt-2">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">{language === 'it' ? 'Punti Previsti' : 'Expected Points'}</span>
                <span className="font-bold text-gray-800">{score} / 110</span>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all" style={{ width: `${(score / 110) * 100}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                {levelThresholds.map(t => (
                  <span key={t.label} className={level === t.label ? 'font-bold text-emerald-700' : ''}>
                    {t.label} ({t.min})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Donut chart */}
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
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-gray-800">{score}</span>
              <span className="text-xs text-gray-500 font-semibold">/ 110 pt</span>
            </div>
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-2 flex-wrap justify-center">
            {donutData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs text-gray-600">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ====== SECTION 2: Timeline delle Milestone ====== */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-600" />
          {language === 'it' ? 'Timeline Milestone LEED' : 'LEED Milestone Timeline'}
        </h3>
        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-gray-200" />

          <div className="space-y-6">
            {DEFAULT_MILESTONES_TIMELINE.map((ms, idx) => {
              const Icon = ms.status === 'completed' ? CheckCircle2 :
                           ms.status === 'in_progress' ? Clock : CircleDashed;
              const iconColor = ms.status === 'completed' ? 'text-emerald-500' :
                                ms.status === 'in_progress' ? 'text-amber-500' : 'text-gray-400';
              const isActive = ms.status === 'in_progress';

              return (
                <div key={idx} className="relative flex items-start gap-4">
                  <div className={`absolute -left-8 w-7 h-7 rounded-full flex items-center justify-center bg-white border-2 ${
                    ms.status === 'completed' ? 'border-emerald-500' :
                    ms.status === 'in_progress' ? 'border-amber-500 ring-4 ring-amber-100' :
                    'border-gray-300'
                  }`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                  </div>
                  <div className={`flex-1 p-3 rounded-xl transition-all ${isActive ? 'bg-amber-50 border border-amber-200' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-semibold ${isActive ? 'text-amber-800' : ms.status === 'completed' ? 'text-gray-800' : 'text-gray-500'}`}>
                        {language === 'it' ? ms.name : ms.nameEn}
                      </span>
                      <span className={`text-xs font-medium ${isActive ? 'text-amber-600' : 'text-gray-400'}`}>
                        {ms.date}
                      </span>
                    </div>
                    {isActive && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs text-amber-600 font-medium">
                          {language === 'it' ? 'In corso' : 'In progress'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ====== SECTION 3: Categories ====== */}
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-emerald-600" />
          {language === 'it' ? 'Categorie LEED' : 'LEED Categories'}
        </h3>
        <div className="space-y-4">
          {categoryData.map((cat) => {
            const pct = cat.max > 0 ? Math.round((cat.score / cat.max) * 100) : 0;
            return (
              <div key={cat.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 w-6">{cat.key}</span>
                    <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{cat.score}/{cat.max}</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {/* Total */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-600">
            {language === 'it' ? 'Totale Previsto' : 'Projected Total'}
          </span>
          <span className="text-lg font-black text-emerald-600">{score} / 110</span>
        </div>
      </div>
    </div>
  );
};
