import { ReactNode } from 'react';
import { Lock, Mail, ExternalLink, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModuleConfig, ModuleType } from '@/lib/types/admin';
import { useLanguage } from '@/contexts/LanguageContext';

interface ModuleLockedNoticeProps {
  module: ModuleType;
  config: ModuleConfig['lockCopy'];
  children?: ReactNode;
}

const moduleIcons: Record<ModuleType, string> = {
  energy: '⚡',
  air: '🌬️',
  water: '💧',
};

const moduleLabels: Record<string, Record<ModuleType, string>> = {
  en: { energy: 'Energy', air: 'Air Quality', water: 'Water' },
  it: { energy: 'Energia', air: 'Qualità dell\'Aria', water: 'Acqua' },
  fr: { energy: 'Énergie', air: "Qualité de l'air", water: 'Eau' },
  es: { energy: 'Energía', air: 'Calidad del aire', water: 'Agua' },
  zh: { energy: '能源', air: '空气质量', water: '水' },
};

const i18n: Record<string, { emailSubject: string; whatsappText: string }> = {
  en: { emailSubject: 'Module activation request', whatsappText: 'I would like to activate the module' },
  it: { emailSubject: 'Richiesta attivazione modulo', whatsappText: 'Vorrei attivare il modulo' },
  fr: { emailSubject: "Demande d'activation du module", whatsappText: "Je souhaite activer le module" },
  es: { emailSubject: 'Solicitud de activación del módulo', whatsappText: 'Me gustaría activar el módulo' },
  zh: { emailSubject: '模块激活请求', whatsappText: '我希望激活模块' },
};

const defaultLockCopy: Record<string, { title: string; description: string; ctaLabel: string }> = {
  en: { title: 'Module Not Active', description: 'This module is not currently active for the selected project. Contact us to activate it.', ctaLabel: 'Request Activation' },
  it: { title: 'Modulo Non Attivo', description: 'Questo modulo non è attualmente attivo per il progetto selezionato. Contattaci per attivarlo.', ctaLabel: 'Richiedi Attivazione' },
  fr: { title: 'Module non actif', description: "Ce module n'est pas actif pour le projet sélectionné. Contactez-nous pour l'activer.", ctaLabel: "Demander l'activation" },
  es: { title: 'Módulo no activo', description: 'Este módulo no está activo para el proyecto seleccionado. Contáctenos para activarlo.', ctaLabel: 'Solicitar activación' },
  zh: { title: '模块未激活', description: '此模块尚未为所选项目激活。请联系我们进行激活。', ctaLabel: '请求激活' },
};

export const ModuleLockedNotice = ({ module, config, children }: ModuleLockedNoticeProps) => {
  const { language } = useLanguage();
  const labels = moduleLabels[language] || moduleLabels.en;
  const t = i18n[language] || i18n.en;
  const defaults = defaultLockCopy[language] || defaultLockCopy.en;
  const itDefaults = defaultLockCopy.it;

  // If config values match Italian defaults, use translated version instead
  const title = config.title === itDefaults.title ? defaults.title : config.title;
  const description = config.description === itDefaults.description ? defaults.description : config.description;
  const ctaLabel = config.ctaLabel === itDefaults.ctaLabel ? defaults.ctaLabel : config.ctaLabel;

  const handleCTA = () => {
    switch (config.ctaType) {
      case 'email':
        window.location.href = `mailto:${config.ctaValue}?subject=${t.emailSubject} ${labels[module]}`;
        break;
      case 'whatsapp':
        window.open(`https://wa.me/${config.ctaValue}?text=${t.whatsappText} ${labels[module]}`, '_blank');
        break;
      case 'link':
        window.open(config.ctaValue, '_blank');
        break;
    }
  };

  const getCtaIcon = () => {
    switch (config.ctaType) {
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'whatsapp':
        return <MessageCircle className="w-4 h-4" />;
      case 'link':
        return <ExternalLink className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 md:p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
          <Lock className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{moduleIcons[module]}</span>
            <h3 className="text-base md:text-lg font-semibold text-amber-800">
              {title}
            </h3>
          </div>
          <p className="text-sm text-amber-700 mb-3">
            {description}
          </p>
          <Button
            onClick={handleCTA}
            variant="outline"
            size="sm"
            className="bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200 hover:border-amber-400"
          >
            {getCtaIcon()}
            <span className="ml-2">{ctaLabel}</span>
          </Button>
          {children}
        </div>
      </div>
    </div>
  );
};
