import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Certification, CertificationMilestone, useCertifications } from './useCertifications';

export function useLeedCertification(siteId?: string) {
  const { data: certs, ...rest } = useCertifications(siteId);
  const leedCert = certs?.find(c => c.cert_type.toUpperCase().includes('LEED')) || null;

  // 1. Fetch ESCLUSIVO per i Crediti della Scorecard
  const { data: scorecard } = useQuery({
    queryKey: ['leed_scorecard', leedCert?.id],
    queryFn: async () => {
      if (!leedCert?.id) return [];
      const { data, error } = await supabase
        .from('certification_milestones')
        .select('*')
        .eq('certification_id', leedCert.id)
        .eq('milestone_type', 'scorecard');
      if (error) throw error;
      return data || [];
    },
    enabled: !!leedCert?.id,
  });

  // 2. Fetch ESCLUSIVO per la Timeline di Progetto (Gantt)
  const { data: timeline } = useQuery({
    queryKey: ['leed_timeline', leedCert?.id],
    queryFn: async () => {
      if (!leedCert?.id) return [];
      const { data, error } = await supabase
        .from('certification_milestones')
        .select('*')
        .eq('certification_id', leedCert.id)
        .eq('milestone_type', 'timeline')
        .order('order_index', { ascending: true }); // Ordine tassativo per la timeline
      if (error) throw error;
      return data || [];
    },
    enabled: !!leedCert?.id,
  });

  return {
    leedCert,
    milestones: scorecard || [], // Retrocompatibilità per vecchi componenti
    scorecard: scorecard || [],
    timeline: timeline || [],
    ...rest,
  };
}
