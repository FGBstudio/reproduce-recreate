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

    // Prefer deterministic matching via siteId (UUID) when available.
    // This prevents accidental matches when many projects share a common first word.
    const projectSiteId = (project as any).siteId as string | undefined;
    if (projectSiteId) {
      const bySite = adminProjects.find((ap) => ap.siteId === projectSiteId || ap.id === projectSiteId);
      if (bySite) {
        return bySite.modules;
      }
    }

    // Try to find matching admin project by name or id pattern
    // Since we're using mock data, match by project name containing similar text
    const adminProject = adminProjects.find(ap => {
      const projectNameNormalized = project.name.toLowerCase();
      const adminNameNormalized = ap.name.toLowerCase();

      // Prefer exact name match (trimmed)
      if (projectNameNormalized.trim() === adminNameNormalized.trim()) return true;

      // Legacy compatibility: match by a stable id pattern (mock data)
      if (ap.id === `proj-${project.id}`) return true;

      // Last resort (legacy): fuzzy match by first token
      return projectNameNormalized.includes(adminNameNormalized.split(' ')[0]) ||
             adminNameNormalized.includes(projectNameNormalized.split(' ')[0]);
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
