import { ReactNode } from 'react';
import { Lock, Mail, ExternalLink, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ModuleConfig, ModuleType } from '@/lib/types/admin';

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

const moduleLabels: Record<ModuleType, string> = {
  energy: 'Energy',
  air: 'Air Quality',
  water: 'Water',
};

export const ModuleLockedNotice = ({ module, config, children }: ModuleLockedNoticeProps) => {
  const handleCTA = () => {
    switch (config.ctaType) {
      case 'email':
        window.location.href = `mailto:${config.ctaValue}?subject=Richiesta attivazione modulo ${moduleLabels[module]}`;
        break;
      case 'whatsapp':
        window.open(`https://wa.me/${config.ctaValue}?text=Vorrei attivare il modulo ${moduleLabels[module]}`, '_blank');
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
              {config.title}
            </h3>
          </div>
          <p className="text-sm text-amber-700 mb-3">
            {config.description}
          </p>
          <Button
            onClick={handleCTA}
            variant="outline"
            size="sm"
            className="bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200 hover:border-amber-400"
          >
            {getCtaIcon()}
            <span className="ml-2">{config.ctaLabel}</span>
          </Button>
          {children}
        </div>
      </div>
    </div>
  );
};
