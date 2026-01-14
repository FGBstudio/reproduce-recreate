import { useMemo } from 'react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { Project } from '@/lib/data';
import { ModuleConfig, ModuleType, defaultProjectModules } from '@/lib/types/admin';

/**
 * Hook to get module configuration for a project
 * Maps frontend Project to AdminProject module config
 */
export const useProjectModuleConfig = (project: Project | null) => {
  const { projects: adminProjects } = useAdminData();

  return useMemo(() => {
    if (!project) {
      return {
        energy: defaultProjectModules.energy,
        air: defaultProjectModules.air,
        water: defaultProjectModules.water,
      };
    }

    // Try to find matching admin project by name or id pattern
    // Since we're using mock data, match by project name containing similar text
    const adminProject = adminProjects.find(ap => {
      const projectNameNormalized = project.name.toLowerCase();
      const adminNameNormalized = ap.name.toLowerCase();
      return projectNameNormalized.includes(adminNameNormalized.split(' ')[0]) ||
             adminNameNormalized.includes(projectNameNormalized.split(' ')[0]) ||
             ap.id === `proj-${project.id}`;
    });

    if (adminProject) {
      return adminProject.modules;
    }

    // Default: all modules enabled for backward compatibility
    return {
      energy: { ...defaultProjectModules.energy, enabled: true },
      air: { ...defaultProjectModules.air, enabled: true },
      water: { ...defaultProjectModules.water, enabled: true },
    };
  }, [project, adminProjects]);
};

/**
 * Hook to check if a specific module should fetch real data
 */
export const useModuleFetchEnabled = (project: Project | null, module: ModuleType): boolean => {
  const moduleConfig = useProjectModuleConfig(project);
  return moduleConfig[module].enabled;
};

/**
 * Get module config for a specific module type
 */
export const useModuleConfig = (project: Project | null, module: ModuleType): ModuleConfig => {
  const moduleConfig = useProjectModuleConfig(project);
  return moduleConfig[module];
};
