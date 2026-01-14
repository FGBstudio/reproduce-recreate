import { ReactNode } from 'react';
import { ModuleConfig, ModuleType } from '@/lib/types/admin';
import { ModuleLockedNotice } from './ModuleLockedNotice';
import { DemoBadge } from './DemoBadge';
import { ModulePlaceholderGrid } from './ModulePlaceholder';

interface ModuleGateProps {
  module: ModuleType;
  config: ModuleConfig;
  children: ReactNode;
  demoContent?: ReactNode;
}

/**
 * ModuleGate - Wrapper component for module access control
 * 
 * Logic:
 * - If module.enabled = true → render children (real data)
 * - If module.enabled = false AND module.showDemo = true → render demoContent with DEMO badge
 * - If module.enabled = false AND module.showDemo = false → render placeholder
 * 
 * Always shows ModuleLockedNotice when module is not enabled
 */
export const ModuleGate = ({ module, config, children, demoContent }: ModuleGateProps) => {
  // Module is enabled - render real content
  if (config.enabled) {
    return <>{children}</>;
  }

  // Module not enabled - show locked notice first
  return (
    <div className="space-y-4">
      <ModuleLockedNotice module={module} config={config.lockCopy} />
      
      {config.showDemo && demoContent ? (
        // Show demo content with badge
        <div className="relative">
          <div className="absolute top-2 right-2 z-10">
            <DemoBadge />
          </div>
          {demoContent}
        </div>
      ) : (
        // Show placeholder
        <ModulePlaceholderGrid module={module} />
      )}
    </div>
  );
};

/**
 * Hook to check if data fetching should be disabled
 */
export const useModuleDataEnabled = (config: ModuleConfig): boolean => {
  // Only fetch real data if module is enabled
  return config.enabled;
};
