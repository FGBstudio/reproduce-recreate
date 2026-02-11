import { useMemo } from 'react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { Project } from '@/lib/data';
import { CertificationType } from '@/lib/types/admin';

/**
 * Hook to get certifications configured for a project via Admin panel.
 * Returns the list of CertificationType[] selected in the admin Projects manager.
 */
export const useProjectCertifications = (project: Project | null): CertificationType[] => {
  const { projects: adminProjects } = useAdminData();

  return useMemo(() => {
    if (!project) return [];

    const projectSiteId = (project as any).siteId as string | undefined;
    if (projectSiteId) {
      const bySite = adminProjects.find(
        (ap) => ap.siteId === projectSiteId || ap.id === projectSiteId
      );
      if (bySite) return bySite.certifications;
    }

    // Fallback: match by name
    const adminProject = adminProjects.find((ap) => {
      const pName = project.name.toLowerCase().trim();
      const aName = ap.name.toLowerCase().trim();
      if (pName === aName) return true;
      if (ap.id === `proj-${project.id}`) return true;
      return false;
    });

    return adminProject?.certifications ?? [];
  }, [project, adminProjects]);
};
