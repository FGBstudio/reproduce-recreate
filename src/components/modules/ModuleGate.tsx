import { ReactNode, useState } from 'react';
import { ModuleConfig, ModuleType } from '@/lib/types/admin';
import { ModuleLockedNotice } from './ModuleLockedNotice';
import { DemoBadge } from './DemoBadge';
import { ModulePlaceholderGrid } from './ModulePlaceholder';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ModuleGateProps {
  module: ModuleType;
  config: ModuleConfig;
  children: ReactNode;
  demoContent?: ReactNode;
}

const moduleLabels: Record<string, Record<ModuleType, string>> = {
  en: { energy: 'Energy', air: 'Air', water: 'Water' },
  it: { energy: 'Energia', air: 'Aria', water: 'Acqua' },
};

const i18n = {
  en: { demoPrompt: (mod: string) => `Would you like to see a demo of the ${mod} dashboard?` },
  it: { demoPrompt: (mod: string) => `Vuoi vedere una demo della dashboard ${mod}?` },
};

/**
 * ModuleGate - Wrapper component for module access control
 */
export const ModuleGate = ({ module, config, children, demoContent }: ModuleGateProps) => {
  const [showDemoExpanded, setShowDemoExpanded] = useState(false);
  const { language } = useLanguage();
  const labels = moduleLabels[language];
  const t = i18n[language];

  // Module is enabled - render real content
  if (config.enabled) {
    return <>{children}</>;
  }

  // Module not enabled - show locked notice with demo toggle option
  return (
    <div className="w-full flex-shrink-0 space-y-4">
      <div className="px-3 md:px-16">
        <ModuleLockedNotice module={module} config={config.lockCopy}>
        {config.showDemo && demoContent && (
          <div className="mt-4 pt-4 border-t border-amber-200/50">
            <div 
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setShowDemoExpanded(!showDemoExpanded)}
            >
              <Checkbox 
                id={`demo-toggle-${module}`}
                checked={showDemoExpanded}
                onCheckedChange={(checked) => setShowDemoExpanded(checked === true)}
                className="border-amber-400 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
              />
              <Label 
                htmlFor={`demo-toggle-${module}`}
                className="text-sm text-amber-800 cursor-pointer group-hover:text-amber-900 transition-colors flex items-center gap-2"
              >
                {t.demoPrompt(labels[module])}
                {showDemoExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Label>
            </div>
          </div>
          )}
        </ModuleLockedNotice>
      </div>
      
      {showDemoExpanded && config.showDemo && demoContent ? (
        <div className="relative w-full flex-shrink-0 px-3 md:px-16 overflow-y-auto pb-4 animate-in slide-in-from-top-2 duration-300">
          <div className="absolute top-4 right-6 md:right-20 z-10">
            <DemoBadge />
          </div>
          {demoContent}
        </div>
      ) : !config.showDemo ? (
        <div className="w-full px-3 md:px-16">
          <ModulePlaceholderGrid module={module} />
        </div>
      ) : null}
    </div>
  );
};

/**
 * Hook to check if data fetching should be disabled
 */
export const useModuleDataEnabled = (config: ModuleConfig): boolean => {
  return config.enabled;
};
