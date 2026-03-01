import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Certification, CertificationMilestone, useCertifications, useCertificationMilestones } from './useCertifications';

export function useLeedCertification(siteId?: string) {
  const { data: certs, ...rest } = useCertifications(siteId);
  const leedCert = certs?.find(c => c.cert_type.toUpperCase().includes('LEED')) || null;

  const { data: milestones } = useCertificationMilestones(leedCert?.id);

  return {
    leedCert,
    milestones: milestones || [],
    ...rest,
  };
}
