/**
 * Rapporto «FGB x cliente» per la pagina Welcome (specifica Monte-Carlo 1c).
 *
 * Tutti i numeri sono REALI e arrivano dalla tabella certifications, che
 * l'RLS filtra gia' sul perimetro dell'utente loggato: un utente Fendi vede
 * le righe Fendi, un holding manager il suo holding, lo staff FGB tutto.
 * Nessun dato inventato: se manca un award, la card mostra l'ultimo con la
 * sua data; se un brand non ha primati, la card del primato non appare.
 *
 * Regole di conteggio (dal documento FGB Monitoring, revisione 27.08):
 *  - progetti      = tutte le righe non cancellate (Energy/Air inclusi:
 *                    sono progetti di monitoraggio)
 *  - ottenute      = stato 'certificato', esclusi Energy e Air
 *  - in avanzamento= stati non-achieved non cancellati, esclusi Energy e Air
 */
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { classifyCertState } from '@/hooks/useCertificationsOverview';

const NOT_BUILDING = new Set(['Energy', 'Air']);

/** Primati mondiali (dal company profile) attribuibili a un cliente. */
const BRAND_RECORDS: { match: RegExp; text: string }[] = [
  { match: /kering/i, text: "World's first & largest Platinum luxury warehouses" },
  { match: /prada/i, text: "World's first LEED v4.1 O+M retail — Hong Kong" },
  { match: /luxottica/i, text: "World's largest existing retail portfolio — WELL at Scale" },
  { match: /salmoiraghi/i, text: "World's first retail WELL" },
  { match: /mcqueen/i, text: "UK's first LEED v4 Platinum — London Old Bond Street" },
  { match: /lavazza/i, text: "First Italian in food & beverage — WELL H&S Rating" },
  { match: /ferrovie|\bfs\b/i, text: "Europe's first & world's second government — WELL H&S" },
];

export interface PartnershipData {
  projects: number;          // tutte le righe non cancellate del perimetro
  achieved: number;          // certificazioni ottenute (no Energy/Air)
  inProgress: number;        // in corso + pipeline + quotate + potenziali
  sinceYear: number | null;  // primo anno del rapporto
  lastAward: { certType: string; level: string | null; siteId: string; date: string | null } | null;
  record: string | null;     // primato mondiale del cliente, se esiste
}

export function recordForClient(name: string | null | undefined): string | null {
  if (!name) return null;
  const hit = BRAND_RECORDS.find((r) => r.match.test(name));
  return hit ? hit.text : null;
}

export function useClientPartnership(clientName: string | null | undefined) {
  return useQuery<PartnershipData | null>({
    queryKey: ['client-partnership'],
    queryFn: async () => {
      if (!supabase) return null;
      // Niente filtro siti: e' l'RLS a delimitare il perimetro dell'utente.
      const { data, error } = await supabase
        .from('certifications')
        .select('site_id, cert_type, status, cert_level, issued_date, created_at')
        .limit(5000);
      if (error) throw error;
      const rows = (data || []) as {
        site_id: string; cert_type: string | null; status: string | null;
        cert_level: string | null; issued_date: string | null; created_at: string | null;
      }[];

      let projects = 0;
      let achieved = 0;
      let inProgress = 0;
      let sinceYear: number | null = null;
      let lastAward: PartnershipData['lastAward'] = null;
      let lastAwardTs = 0;

      for (const r of rows) {
        const state = classifyCertState(r.status);
        if (!state || !r.cert_type) continue; // cancellate fuori da tutto
        projects++;
        const building = !NOT_BUILDING.has(r.cert_type);
        if (building && state === 'achieved') achieved++;
        if (building && state !== 'achieved') inProgress++;

        const startTs = r.issued_date || r.created_at;
        if (startTs) {
          const y = new Date(startTs).getFullYear();
          if (Number.isFinite(y) && (sinceYear === null || y < sinceYear)) sinceYear = y;
        }
        if (building && state === 'achieved') {
          const ts = new Date(r.issued_date || r.created_at || 0).getTime();
          if (ts > lastAwardTs) {
            lastAwardTs = ts;
            lastAward = {
              certType: r.cert_type,
              level: r.cert_level || null,
              siteId: r.site_id,
              date: r.issued_date || r.created_at,
            };
          }
        }
      }

      return { projects, achieved, inProgress, sinceYear, lastAward, record: null };
    },
    select: (d) => (d ? { ...d, record: recordForClient(clientName) } : d),
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60 * 1000,
  });
}
