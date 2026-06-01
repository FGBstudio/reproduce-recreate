import { useMemo } from 'react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { Project } from '@/lib/data';
import { CertificationType } from '@/lib/types/admin';

const normalizeCertificationType = (value: unknown): CertificationType | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');

  if (normalized.startsWith('LEED')) return 'LEED';
  if (normalized.startsWith('BREEAM')) return 'BREEAM';
  if (normalized.startsWith('WELL')) return 'WELL';
  if (normalized.includes('ENERGY_AUDIT')) return 'ENERGY_AUDIT';
  if (normalized.startsWith('ISO_14001')) return 'ISO_14001';
  if (normalized.startsWith('ISO_50001')) return 'ISO_50001';

  return null;
};

const onlyRealCertifications = (certifications: unknown[] | undefined): CertificationType[] => {
  const unique = new Set<CertificationType>();
  (certifications || []).forEach((cert) => {
    const normalized = normalizeCertificationType(cert);
    if (normalized) unique.add(normalized);
  });
  return Array.from(unique);
};

/**
 * Hook to get certifications configured for a project via Admin panel.
 * Returns the list of CertificationType[] selected in the admin Projects manager.
 */
export const useProjectCertifications = (project: Project | null): CertificationType[] => {
  const { projects: adminProjects } = useAdminData();

  return useMemo(() => {
    if (!project) return [];

    const projectSiteId = project.siteId;
    if (projectSiteId) {
      const bySite = adminProjects.find(
        (ap) => ap.siteId === projectSiteId || ap.id === projectSiteId
      );
      if (bySite) return onlyRealCertifications(bySite.certifications);
    }

    // Fallback: match by name
    const adminProject = adminProjects.find((ap) => {
      const pName = project.name.toLowerCase().trim();
      const aName = ap.name.toLowerCase().trim();
      if (pName === aName) return true;
      if (ap.id === `proj-${project.id}`) return true;
      return false;
    });

    return onlyRealCertifications(adminProject?.certifications);
  }, [project, adminProjects]);
};
