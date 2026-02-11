import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Certification {
  id: string;
  site_id: string;
  cert_type: string;
  level: string | null;
  score: number | null;
  target_score: number | null;
  status: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  categories: Record<string, unknown> | null;
}

export interface CertificationMilestone {
  id: string;
  certification_id: string;
  category: string;
  requirement: string;
  score: number | null;
  max_score: number | null;
  status: string | null;
}

export function useCertifications(siteId?: string) {
  return useQuery({
    queryKey: ['certifications', siteId],
    queryFn: async () => {
      if (!supabase || !siteId) return [];
      const { data, error } = await supabase
        .from('certifications')
        .select('*')
        .eq('site_id', siteId);
      if (error) {
        console.error('Error fetching certifications:', error);
        return [];
      }
      return (data || []) as Certification[];
    },
    enabled: !!siteId && !!supabase,
  });
}

export function useCertificationMilestones(certificationId?: string) {
  return useQuery({
    queryKey: ['certification_milestones', certificationId],
    queryFn: async () => {
      if (!supabase || !certificationId) return [];
      const { data, error } = await supabase
        .from('certification_milestones')
        .select('*')
        .eq('certification_id', certificationId);
      if (error) {
        console.error('Error fetching milestones:', error);
        return [];
      }
      return (data || []) as CertificationMilestone[];
    },
    enabled: !!certificationId && !!supabase,
  });
}

export function useWellCertification(siteId?: string) {
  const { data: certs, ...rest } = useCertifications(siteId);
  const wellCert = certs?.find(c => c.cert_type.toUpperCase().includes('WELL')) || null;

  const { data: milestones } = useCertificationMilestones(wellCert?.id);

  return {
    wellCert,
    milestones: milestones || [],
    ...rest,
  };
}
