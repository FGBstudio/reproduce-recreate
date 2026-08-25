/**
 * Vista Certificazioni di portafoglio (livello Group/Brand).
 *
 * FONTE DATI: tabella `certifications` (una riga = un progetto di
 * certificazione legato a un sito). La tabella serve anche il gestionale
 * interno: qui si SELEZIONANO SOLO le colonne pertinenti al cliente
 * (mai fees, quotation, ore) e si legge soltanto.
 *
 * MAPPATURA STATI (dai valori reali in produzione, 24/08/2026):
 *   conseguita    <- status in ('certificato','completato','active')
 *   in corso      <- status in ('in_corso','in_progress')
 *   potential     <- status = 'potential'
 *   ESCLUSI       <- 'canceled', 'da_configurare', 'quotation',
 *                    'quotation_approved' (pipeline commerciale/setup interno:
 *                    non sono informazione di certificazione per il cliente)
 *
 * CAMPI:
 *   cert_type   -> schema (LEED, WELL, BREEAM, Energy, ...)
 *   cert_level  -> rating (Platinum/Gold/... ; Good/Very Good/...)
 *   level       -> VARIANTE dello schema (O+M, ID+C, BD+C, In Use...) — NON
 *                  e' il rating: negli storici veniva usata per la variante
 *   issued_date -> anno di conseguimento mostrato in tabella
 *   expiry_date -> scadenza (tooltip; "in scadenza" = entro 6 mesi)
 *   project_subtype = 'Existing Buildings' -> equivalente O+M per LEED
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isValidUUID } from '@/lib/utils';
import { Project } from '@/lib/data';

export type CertState = 'achieved' | 'in_progress' | 'potential';

export interface CertRow {
  siteId: string;
  certType: string;
  state: CertState;
  certLevel: string | null;
  variant: string | null;      // O+M, ID+C, ...
  issuedYear: number | null;
  expiryDate: string | null;
  isOm: boolean;
  expiringSoon: boolean;       // conseguita e scade entro 6 mesi
}

export interface SchemeLevelBreakdown {
  level: string;               // 'Platinum' | ... | 'TBD'
  achieved: number;
  inProgress: number;
  potential: number;
}

export interface SchemeSummary {
  scheme: string;
  total: number;
  levels: SchemeLevelBreakdown[];
}

export interface SiteCertCell {
  state: CertState;
  certLevel: string | null;
  issuedYear: number | null;
  expiryDate: string | null;
  isOm: boolean;
  expiringSoon: boolean;
  /** avanzamento testuale per gli in corso, se derivabile — per ora null */
}

export interface SiteCertRow {
  siteId: string;
  siteName: string;
  region: string;
  cells: Record<string, SiteCertCell | null>;   // chiave = schema
}

export interface CertificationsOverviewData {
  kpis: { active: number; inProgress: number; expiringSoon: number; potential: number };
  schemes: SchemeSummary[];
  /** Solo i siti con almeno una certificazione (conseguita/in corso/potential) */
  siteRows: SiteCertRow[];
  isLoading: boolean;
  hasData: boolean;
}

const ACHIEVED = new Set(['certificato', 'completato', 'active']);
const IN_PROGRESS = new Set(['in_corso', 'in_progress']);
const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

/** Ordine dei rating per schema (dal migliore): decide riga migliore e ordinamento barre. */
const LEVEL_ORDER: Record<string, string[]> = {
  LEED: ['Platinum', 'Gold', 'Silver', 'Certified'],
  WELL: ['Platinum', 'Gold', 'Silver', 'Bronze'],
  BREEAM: ['Outstanding', 'Excellent', 'Very Good', 'Good', 'Pass'],
};

/** Colonne fisse della tabella siti, nell'ordine approvato. */
export const TABLE_SCHEMES = ['LEED', 'BREEAM', 'WELL', 'Energy'];

function classify(status: string | null): CertState | null {
  const s = (status || '').toLowerCase();
  if (ACHIEVED.has(s)) return 'achieved';
  if (IN_PROGRESS.has(s)) return 'in_progress';
  if (s === 'potential') return 'potential';
  return null; // canceled / da_configurare / quotation* -> fuori dalla vista cliente
}

function levelRank(scheme: string, level: string | null): number {
  const order = LEVEL_ORDER[scheme];
  if (!order || !level) return 999;
  const i = order.indexOf(level);
  return i === -1 ? 998 : i;
}

async function fetchCerts(siteIds: string[]): Promise<CertRow[]> {
  if (!supabase || siteIds.length === 0) return [];
  interface DbCertRow { site_id: string; cert_type: string | null; status: string | null; cert_level: string | null; level: string | null; issued_date: string | null; expiry_date: string | null; project_subtype: string | null }
  const rows: DbCertRow[] = [];
  const batch = 50;
  for (let i = 0; i < siteIds.length; i += batch) {
    const { data, error } = await supabase
      .from('certifications')
      .select('site_id, cert_type, status, cert_level, level, issued_date, expiry_date, project_subtype')
      .in('site_id', siteIds.slice(i, i + batch));
    if (!error && data) rows.push(...(data as DbCertRow[]));
  }
  const now = Date.now();
  return rows.flatMap((r) => {
    const state = classify(r.status);
    if (!state || !r.cert_type) return [];
    const expiry = r.expiry_date ? new Date(r.expiry_date) : null;
    const isOm = r.level === 'O+M' || r.project_subtype === 'Existing Buildings';
    return [{
      siteId: r.site_id,
      certType: String(r.cert_type),
      state,
      certLevel: r.cert_level || null,
      variant: r.level || null,
      issuedYear: r.issued_date ? new Date(r.issued_date).getFullYear() : null,
      expiryDate: r.expiry_date || null,
      isOm,
      expiringSoon: state === 'achieved' && !!expiry && expiry.getTime() - now < SIX_MONTHS_MS && expiry.getTime() > now,
    }];
  });
}

export function useCertificationsOverview(filteredProjects: Project[]): CertificationsOverviewData {
  const siteIds = useMemo(
    () => filteredProjects.map(p => p.siteId).filter((id): id is string => !!id && isValidUUID(id)),
    [filteredProjects]
  );

  const { data: certs, isLoading } = useQuery({
    queryKey: ['certifications-overview', [...siteIds].sort().join(',')],
    queryFn: () => fetchCerts(siteIds),
    enabled: isSupabaseConfigured && siteIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const rows = certs || [];
    const now = Date.now();

    // ── KPI ──
    const achieved = rows.filter(r => r.state === 'achieved');
    const kpis = {
      // "attivo" = conseguito e non scaduto (senza expiry = attivo)
      active: achieved.filter(r => !r.expiryDate || new Date(r.expiryDate).getTime() > now).length,
      inProgress: rows.filter(r => r.state === 'in_progress').length,
      expiringSoon: rows.filter(r => r.expiringSoon).length,
      potential: rows.filter(r => r.state === 'potential').length,
    };

    // ── breakdown per schema/livello ──
    const bySch = new Map<string, Map<string, SchemeLevelBreakdown>>();
    rows.forEach(r => {
      const lv = r.certLevel || 'TBD';
      if (!bySch.has(r.certType)) bySch.set(r.certType, new Map());
      const m = bySch.get(r.certType)!;
      if (!m.has(lv)) m.set(lv, { level: lv, achieved: 0, inProgress: 0, potential: 0 });
      const b = m.get(lv)!;
      if (r.state === 'achieved') b.achieved++;
      else if (r.state === 'in_progress') b.inProgress++;
      else b.potential++;
    });
    const schemes: SchemeSummary[] = Array.from(bySch.entries())
      .map(([scheme, m]) => ({
        scheme,
        total: Array.from(m.values()).reduce((s, b) => s + b.achieved + b.inProgress + b.potential, 0),
        levels: Array.from(m.values()).sort((a, b) => {
          if (a.level === 'TBD') return 1;
          if (b.level === 'TBD') return -1;
          return levelRank(scheme, a.level) - levelRank(scheme, b.level);
        }),
      }))
      .sort((a, b) => b.total - a.total);

    // ── tabella siti: cella = miglior progetto per sito x schema ──
    const nameById = new Map(filteredProjects.map(p => [p.siteId, p] as const));
    const bySite = new Map<string, CertRow[]>();
    rows.forEach(r => {
      (bySite.get(r.siteId) || bySite.set(r.siteId, []).get(r.siteId)!).push(r);
    });

    const stateRank: Record<CertState, number> = { achieved: 0, in_progress: 1, potential: 2 };
    const siteRows: SiteCertRow[] = Array.from(bySite.entries()).map(([siteId, list]) => {
      const project = nameById.get(siteId);
      const cells: Record<string, SiteCertCell | null> = {};
      TABLE_SCHEMES.forEach(scheme => {
        const candidates = list
          .filter(r => r.certType === scheme)
          .sort((a, b) =>
            stateRank[a.state] - stateRank[b.state] ||
            levelRank(scheme, a.certLevel) - levelRank(scheme, b.certLevel)
          );
        const best = candidates[0];
        cells[scheme] = best ? {
          state: best.state,
          certLevel: best.certLevel,
          issuedYear: best.issuedYear,
          expiryDate: best.expiryDate,
          isOm: best.isOm,
          expiringSoon: best.expiringSoon,
        } : null;
      });
      return {
        siteId,
        siteName: project?.name || siteId,
        region: project?.region || '—',
        cells,
      };
    }).sort((a, b) => {
      const score = (r: SiteCertRow) =>
        TABLE_SCHEMES.reduce((s, k) => s + (r.cells[k] ? (r.cells[k]!.state === 'achieved' ? 3 : r.cells[k]!.state === 'in_progress' ? 2 : 1) : 0), 0);
      return score(b) - score(a) || a.siteName.localeCompare(b.siteName);
    });

    return { kpis, schemes, siteRows, isLoading, hasData: rows.length > 0 };
  }, [certs, filteredProjects, isLoading]);
}
