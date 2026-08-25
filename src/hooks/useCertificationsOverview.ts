/**
 * Vista Certificazioni di portafoglio (livello Group/Brand).
 *
 * FONTE DATI: tabella `certifications` (una riga = un progetto di
 * certificazione legato a un sito). La tabella serve anche il gestionale
 * interno: qui si SELEZIONANO SOLO le colonne pertinenti al cliente
 * (mai fees, quotation, ore) e si legge soltanto.
 *
 * CONTEGGIO (regola approvata): ogni RIGA e' un certificato. Un sito con
 * LEED + Energy conta due volte e compare in entrambe le sezioni. I flag
 * has_*_monitoring sono ATTRIBUTI del progetto, non certificati: non
 * generano mai conteggi.
 *
 * MAPPATURA STATI (decisa dal proprietario, 25/08/2026):
 *   Achieved   <- 'certificato'
 *   In progress<- 'completato','in_corso','da_configurare','in_progress','active'
 *   Pipeline   <- 'quotation','quotation_approved'
 *   Potential  <- 'potential'
 *   ESCLUSI    <- 'canceled'
 *
 * MODELLI DI STATO PER SCHEMA:
 *   rated      (LEED/WELL/BREEAM)        -> breakdown per rating (cert_level)
 *   monitoring (Energy/Air/Energy_Audit) -> Online / Offline / Pipeline:
 *                gli installati (Achieved+In progress) si dividono per stato
 *                live del sito; Pipeline = quotation* + potential (da installare)
 *   binary     (TAXONOMY/CSRD/ESG)       -> Achieved / Not achieved / Pipeline:
 *                Not achieved = In progress; Pipeline = quotation* + potential
 *
 * CAMPI: cert_type=schema · cert_level=rating · level=VARIANTE (O+M, ID+C...)
 * · issued_date=anno conseguimento · expiry_date=scadenza (tooltip; "in
 * scadenza" = entro 6 mesi) · project_subtype='Existing Buildings' => O+M.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isValidUUID } from '@/lib/utils';
import { Project } from '@/lib/data';

export type CertState = 'achieved' | 'in_progress' | 'pipeline' | 'potential';
export type SchemeModel = 'rated' | 'monitoring' | 'binary';

export interface CertRow {
  siteId: string;
  certType: string;
  state: CertState;
  certLevel: string | null;
  issuedYear: number | null;
  expiryDate: string | null;
  isOm: boolean;
  expiringSoon: boolean;
}

export interface SchemeLevelBreakdown {
  level: string;
  achieved: number;
  inProgress: number;
  pipeline: number;
  potential: number;
}

export interface SchemeSummary {
  scheme: string;
  model: SchemeModel;
  total: number;
  /** modello rated */
  levels: SchemeLevelBreakdown[];
  /** modello monitoring */
  monitoring?: { online: number; offline: number; pipeline: number };
  /** modello binary */
  binary?: { achieved: number; notAchieved: number; pipeline: number };
}

export interface SiteCertCell {
  state: CertState;
  certLevel: string | null;
  issuedYear: number | null;
  expiryDate: string | null;
  isOm: boolean;
  expiringSoon: boolean;
  /** solo schemi monitoring: stato live del sito */
  live?: 'online' | 'offline';
}

export interface SiteCertRow {
  siteId: string;
  siteName: string;
  region: string;
  cells: Record<string, SiteCertCell | null>;
}

export interface CertificationsOverviewData {
  kpis: { active: number; inProgress: number; expiringSoon: number; potential: number };
  schemes: SchemeSummary[];
  siteRows: SiteCertRow[];
  /** colonne tabella: catalogo completo FGB, il sito resta fisso */
  tableSchemes: string[];
  isLoading: boolean;
  hasData: boolean;
}

const IN_PROGRESS = new Set(['completato', 'in_corso', 'da_configurare', 'in_progress', 'active']);
const PIPELINE = new Set(['quotation', 'quotation_approved']);
const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

const MONITORING_SCHEMES = new Set(['Energy', 'Air', 'Energy_Audit']);
const BINARY_SCHEMES = new Set(['TAXONOMY', 'CSRD', 'ESG']);

/** Catalogo colonne della tabella, nell'ordine di offerta FGB. */
export const SCHEME_CATALOG = ['LEED', 'BREEAM', 'WELL', 'Energy', 'Air', 'TAXONOMY', 'CSRD', 'ESG', 'Energy_Audit'];

const LEVEL_ORDER: Record<string, string[]> = {
  LEED: ['Platinum', 'Gold', 'Silver', 'Certified'],
  WELL: ['Platinum', 'Gold', 'Silver', 'Bronze'],
  BREEAM: ['Outstanding', 'Excellent', 'Very Good', 'Good', 'Pass'],
};

export function schemeModel(scheme: string): SchemeModel {
  if (MONITORING_SCHEMES.has(scheme)) return 'monitoring';
  if (BINARY_SCHEMES.has(scheme)) return 'binary';
  return 'rated';
}

function classify(status: string | null): CertState | null {
  const s = (status || '').toLowerCase();
  if (s === 'certificato') return 'achieved';
  if (IN_PROGRESS.has(s)) return 'in_progress';
  if (PIPELINE.has(s)) return 'pipeline';
  if (s === 'potential') return 'potential';
  return null; // canceled
}

function levelRank(scheme: string, level: string | null): number {
  const order = LEVEL_ORDER[scheme];
  if (!order || !level) return 999;
  const i = order.indexOf(level);
  return i === -1 ? 998 : i;
}

interface DbCertRow {
  site_id: string; cert_type: string | null; status: string | null; cert_level: string | null;
  level: string | null; issued_date: string | null; expiry_date: string | null; project_subtype: string | null;
}

async function fetchCerts(siteIds: string[]): Promise<CertRow[]> {
  if (!supabase || siteIds.length === 0) return [];
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
    return [{
      siteId: r.site_id,
      certType: String(r.cert_type),
      state,
      certLevel: r.cert_level || null,
      issuedYear: r.issued_date ? new Date(r.issued_date).getFullYear() : null,
      expiryDate: r.expiry_date || null,
      isOm: r.level === 'O+M' || r.project_subtype === 'Existing Buildings',
      expiringSoon: state === 'achieved' && !!expiry && expiry.getTime() - now < SIX_MONTHS_MS && expiry.getTime() > now,
    }];
  });
}

export function useCertificationsOverview(
  filteredProjects: Project[],
  /** siteId -> online live (per gli schemi monitoring) */
  siteOnline?: Map<string, boolean>
): CertificationsOverviewData {
  const siteIds = useMemo(
    () => filteredProjects.map(p => p.siteId).filter((id): id is string => !!id && isValidUUID(id)),
    [filteredProjects]
  );

  const { data: certs, isLoading } = useQuery({
    queryKey: ['certifications-overview-v2', [...siteIds].sort().join(',')],
    queryFn: () => fetchCerts(siteIds),
    enabled: isSupabaseConfigured && siteIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    const rows = certs || [];
    const now = Date.now();
    const isLive = (siteId: string) => siteOnline?.get(siteId) === true;

    // ── KPI: ogni riga conseguita e non scaduta conta 1 ──
    const achieved = rows.filter(r => r.state === 'achieved');
    const kpis = {
      active: achieved.filter(r => !r.expiryDate || new Date(r.expiryDate).getTime() > now).length,
      inProgress: rows.filter(r => r.state === 'in_progress').length,
      expiringSoon: rows.filter(r => r.expiringSoon).length,
      potential: rows.filter(r => r.state === 'potential').length,
    };

    // ── breakdown per schema, secondo il modello ──
    const byScheme = new Map<string, CertRow[]>();
    rows.forEach(r => {
      if (!byScheme.has(r.certType)) byScheme.set(r.certType, []);
      byScheme.get(r.certType)!.push(r);
    });

    const schemes: SchemeSummary[] = Array.from(byScheme.entries()).map(([scheme, list]) => {
      const model = schemeModel(scheme);
      const base: SchemeSummary = { scheme, model, total: list.length, levels: [] };

      if (model === 'monitoring') {
        const installed = list.filter(r => r.state === 'achieved' || r.state === 'in_progress');
        base.monitoring = {
          online: installed.filter(r => isLive(r.siteId)).length,
          offline: installed.filter(r => !isLive(r.siteId)).length,
          pipeline: list.filter(r => r.state === 'pipeline' || r.state === 'potential').length,
        };
      } else if (model === 'binary') {
        base.binary = {
          achieved: list.filter(r => r.state === 'achieved').length,
          notAchieved: list.filter(r => r.state === 'in_progress').length,
          pipeline: list.filter(r => r.state === 'pipeline' || r.state === 'potential').length,
        };
      } else {
        const byLevel = new Map<string, SchemeLevelBreakdown>();
        list.forEach(r => {
          const lv = r.certLevel || 'TBD';
          if (!byLevel.has(lv)) byLevel.set(lv, { level: lv, achieved: 0, inProgress: 0, pipeline: 0, potential: 0 });
          const b = byLevel.get(lv)!;
          if (r.state === 'achieved') b.achieved++;
          else if (r.state === 'in_progress') b.inProgress++;
          else if (r.state === 'pipeline') b.pipeline++;
          else b.potential++;
        });
        base.levels = Array.from(byLevel.values()).sort((a, b) => {
          if (a.level === 'TBD') return 1;
          if (b.level === 'TBD') return -1;
          return levelRank(scheme, a.level) - levelRank(scheme, b.level);
        });
      }
      return base;
    }).sort((a, b) => b.total - a.total);

    // ── tabella: colonne = catalogo completo (Site fissa, resto scorre) ──
    const extras = Array.from(byScheme.keys()).filter(s => !SCHEME_CATALOG.includes(s)).sort();
    const tableSchemes = [...SCHEME_CATALOG, ...extras];

    const nameById = new Map(filteredProjects.map(p => [p.siteId, p] as const));
    const bySite = new Map<string, CertRow[]>();
    rows.forEach(r => {
      if (!bySite.has(r.siteId)) bySite.set(r.siteId, []);
      bySite.get(r.siteId)!.push(r);
    });

    const stateRank: Record<CertState, number> = { achieved: 0, in_progress: 1, pipeline: 2, potential: 3 };
    const siteRows: SiteCertRow[] = Array.from(bySite.entries()).map(([siteId, list]) => {
      const project = nameById.get(siteId);
      const cells: Record<string, SiteCertCell | null> = {};
      tableSchemes.forEach(scheme => {
        const best = list
          .filter(r => r.certType === scheme)
          .sort((a, b) =>
            stateRank[a.state] - stateRank[b.state] ||
            levelRank(scheme, a.certLevel) - levelRank(scheme, b.certLevel)
          )[0];
        cells[scheme] = best ? {
          state: best.state,
          certLevel: best.certLevel,
          issuedYear: best.issuedYear,
          expiryDate: best.expiryDate,
          isOm: best.isOm,
          expiringSoon: best.expiringSoon,
          live: schemeModel(scheme) === 'monitoring' && (best.state === 'achieved' || best.state === 'in_progress')
            ? (isLive(siteId) ? 'online' : 'offline')
            : undefined,
        } : null;
      });
      return { siteId, siteName: project?.name || siteId, region: project?.region || '—', cells };
    }).sort((a, b) => {
      const score = (r: SiteCertRow) =>
        tableSchemes.reduce((s, k) => {
          const c = r.cells[k];
          return s + (c ? 4 - stateRank[c.state] : 0);
        }, 0);
      return score(b) - score(a) || a.siteName.localeCompare(b.siteName);
    });

    return { kpis, schemes, siteRows, tableSchemes, isLoading, hasData: rows.length > 0 };
  }, [certs, filteredProjects, isLoading, siteOnline]);
}
