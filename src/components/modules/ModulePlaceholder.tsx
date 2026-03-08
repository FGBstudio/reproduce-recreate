import { BarChart3, LineChart, PieChart, Activity } from 'lucide-react';
import { ModuleType } from '@/lib/types/admin';
import { useLanguage } from '@/contexts/LanguageContext';

interface ModulePlaceholderProps {
  module: ModuleType;
  variant?: 'chart' | 'kpi' | 'table';
  className?: string;
}

const moduleColors: Record<ModuleType, string> = {
  energy: 'from-teal-50 to-cyan-50 border-teal-200',
  air: 'from-sky-50 to-blue-50 border-sky-200',
  water: 'from-blue-50 to-indigo-50 border-blue-200',
};

const moduleTextColors: Record<ModuleType, string> = {
  energy: 'text-teal-600',
  air: 'text-sky-600',
  water: 'text-blue-600',
};

const placeholderIcons = {
  chart: LineChart,
  kpi: Activity,
  table: BarChart3,
};

const i18n: Record<string, { activate: string; available: string }> = {
  en: {
    activate: 'Activate the module to view data',
    available: 'Telemetry data will be available after activation',
  },
  it: {
    activate: 'Attiva il modulo per visualizzare i dati',
    available: 'I dati di telemetria saranno disponibili dopo l\'attivazione',
  },
  fr: {
    activate: 'Activez le module pour voir les données',
    available: 'Les données de télémétrie seront disponibles après activation',
  },
  es: {
    activate: 'Activa el módulo para ver los datos',
    available: 'Los datos de telemetría estarán disponibles tras la activación',
  },
  zh: {
    activate: '激活模块以查看数据',
    available: '激活后可查看遥测数据',
  },
};

export const ModulePlaceholder = ({ module, variant = 'chart', className = '' }: ModulePlaceholderProps) => {
  const Icon = placeholderIcons[variant];
  const { language } = useLanguage();
  const t = i18n[language] || i18n.en;
  
  return (
    <div className={`bg-gradient-to-br ${moduleColors[module]} border rounded-xl p-6 flex flex-col items-center justify-center min-h-[200px] ${className}`}>
      <div className={`w-16 h-16 rounded-full bg-white/60 flex items-center justify-center mb-4 ${moduleTextColors[module]}`}>
        <Icon className="w-8 h-8 opacity-50" />
      </div>
      <p className={`text-sm font-medium ${moduleTextColors[module]} text-center`}>
        {t.activate}
      </p>
      <p className="text-xs text-gray-500 mt-1 text-center">
        {t.available}
      </p>
    </div>
  );
};

// Multiple placeholder cards for layout consistency
export const ModulePlaceholderGrid = ({ module }: { module: ModuleType }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ModulePlaceholder module={module} variant="chart" className="md:col-span-2" />
      <ModulePlaceholder module={module} variant="kpi" />
      <ModulePlaceholder module={module} variant="table" />
    </div>
  );
};
