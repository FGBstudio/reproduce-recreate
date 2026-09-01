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
  issuedDate: string | null;
  expiryDate: string | null;
  createdAt: string | null;
  handoverDate: string | null;
  isOm: boolean;
  expiringSoon: boolean;
}

/** Sezioni della directory (ordine di visualizzazione). */
export type SectionKey = 'active' | 'in_progress' | 'pipeline' | 'expiring' | 'potential' | 'energy' | 'air';
export const SECTION_ORDER: SectionKey[] = ['active', 'in_progress', 'pipeline', 'expiring', 'potential', 'energy', 'air'];
export const SECTION_LABEL: Record<SectionKey, string> = {
  active: 'Active certificates',
  in_progress: 'In progress',
  pipeline: 'Pipeline',
  expiring: 'Expiring < 6 months',
  potential: 'Potential',
  energy: 'Energy',
  air: 'Air',
};

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
  monitoring?: { online: number; offline: number; pipeline: number; potential: number };
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
  live?: 'online' | 'offline' | 'never';
}

export interface SiteCertRow {
  siteId: string;
  siteName: string;
  region: string;
  cells: Record<string, SiteCertCell | null>;
  /** sezione di appartenenza (una sola: certificato dominante) */
  section: SectionKey;
}

export interface DirectorySection {
  key: SectionKey;
  label: string;
  rows: SiteCertRow[];
}

export interface CertificationsOverviewData {
  kpis: { active: number; inProgress: number; expiringSoon: number; potential: number };
  schemes: SchemeSummary[];
  /** Directory raggruppata per sezione, ordinata secondo la specifica */
  sections: DirectorySection[];
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

/** Classificazione stato condivisa (usata anche dal rapporto FGB x cliente). */
export const classifyCertState = classify;

function levelRank(scheme: string, level: string | null): number {
  const order = LEVEL_ORDER[scheme];
  if (!order || !level) return 999;
  const i = order.indexOf(level);
  return i === -1 ? 998 : i;
}

interface DbCertRow {
  site_id: string; cert_type: string | null; status: string | null; cert_level: string | null;
  level: string | null; issued_date: string | null; expiry_date: string | null; project_subtype: string | null;
  created_at: string | null; actual_handover_date: string | null;
}

async function fetchCerts(siteIds: string[]): Promise<CertRow[]> {
  if (!supabase || siteIds.length === 0) return [];
  const rows: DbCertRow[] = [];
  const batch = 50;
  for (let i = 0; i < siteIds.length; i += batch) {
    const { data, error } = await supabase
      .from('certifications')
      .select('site_id, cert_type, status, cert_level, level, issued_date, expiry_date, project_subtype, created_at, actual_handover_date')
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
      issuedDate: r.issued_date || null,
      expiryDate: r.expiry_date || null,
      createdAt: r.created_at || null,
      handoverDate: r.actual_handover_date || null,
      isOm: r.level === 'O+M' || r.project_subtype === 'Existing Buildings',
      expiringSoon: state === 'achieved' && !!expiry && expiry.getTime() - now < SIX_MONTHS_MS && expiry.getTime() > now,
    }];
  });
}

/** Certificato dominante del sito: comanda LEED, poi WELL, poi gli altri
 *  schemi edificio in ordine alfabetico; i monitoraggi (Energy/Air) contano
 *  solo se il sito non ha alcuno schema edificio. */
function dominantCert(list: CertRow[]): CertRow | null {
  const building = list.filter(r => schemeModel(r.certType) !== 'monitoring');
  const pool = building.length > 0 ? building : list;
  const pri = (r: CertRow) =>
    r.certType === 'LEED' ? 0 : r.certType === 'WELL' ? 1 : 2;
  const stateRank: Record<CertState, number> = { achieved: 0, in_progress: 1, pipeline: 2, potential: 3 };
  return [...pool].sort((a, b) =>
    pri(a) - pri(b) ||
    a.certType.localeCompare(b.certType) ||
    stateRank[a.state] - stateRank[b.state]
  )[0] ?? null;
}

/** Sezione del sito, dal certificato dominante (spec approvata). */
function sectionOf(dom: CertRow | null, list: CertRow[]): SectionKey {
  if (!dom) return 'potential';
  if (schemeModel(dom.certType) === 'monitoring') {
    return list.some(r => r.certType === 'Energy') ? 'energy' : 'air';
  }
  if (dom.state === 'achieved') return dom.expiringSoon ? 'expiring' : 'active';
  if (dom.state === 'in_progress') return 'in_progress';
  if (dom.state === 'pipeline') return 'pipeline';
  return 'potential';
}

/** Chiave di ordinamento dentro la sezione — ordine CRONOLOGICO (dal piu'
 *  vecchio) come da indicazione del proprietario:
 *  active: data di ottenimento · in_progress: partenza progetto (created_at)
 *  · expiring: scadenza piu' vicina in alto · potential: come inseriti ·
 *  energy/air: data di installazione (actual_handover_date, fallback
 *  created_at); i siti NON ancora installati (pipeline) vanno in coda. */
function sectionSortValue(section: SectionKey, dom: CertRow | null, live: 'online' | 'offline' | 'never' | null): number {
  const t = (d: string | null) => (d ? new Date(d).getTime() : Number.MAX_SAFE_INTEGER / 2);
  if (!dom) return 0;
  switch (section) {
    case 'active': return t(dom.issuedDate ?? dom.createdAt);
    case 'in_progress': return t(dom.createdAt);
    case 'pipeline': return t(dom.createdAt);
    case 'expiring': return t(dom.expiryDate);
    case 'potential': return t(dom.createdAt);
    case 'energy':
    case 'air': {
      // installati (device presenti) prima, per data di installazione;
      // da installare in coda, per ordine di inserimento
      const installed = live === 'online' || live === 'offline' || live === 'never';
      return (installed ? 0 : Number.MAX_SAFE_INTEGER) + t(dom.handoverDate ?? dom.createdAt);
    }
  }
}

export type DomainLive = 'online' | 'offline' | 'never' | null;

export function useCertificationsOverview(
  filteredProjects: Project[],
  /** siteId -> stato live per dominio (dai DEVICE, non dallo status del
   *  progetto): 'never' = censiti ma mai una lettura; null = nessun device */
  domainLive?: Map<string, { energy: DomainLive; air: DomainLive }>
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
    // Stato live per gli schemi monitoring: decidono i DEVICE del dominio.
    // Energy/Energy_Audit leggono il dominio energia, Air il dominio aria.
    const liveFor = (siteId: string, scheme: string): DomainLive => {
      const d = domainLive?.get(siteId);
      if (!d) return null;
      return scheme === 'Air' ? d.air : d.energy;
    };

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
        // Per Energy/Air lo status del progetto (perlopiu' da_configurare)
        // NON dice chi e' acceso: decidono i DEVICE del dominio.
        //   device presenti -> Online/Offline per freschezza (anche se non
        //     hanno mai trasmesso: sono installati, quindi offline — caso
        //     Fendi Bicester, deciso dal proprietario)
        //   progetto partito ma NESSUN device -> Pipeline (installazione
        //     in arrivo: per il proprietario installing e pipeline sono
        //     la stessa cosa)
        //   quotation/potential senza device -> Potential
        let online = 0, offline = 0, pipeline = 0, potential = 0;
        list.forEach(r => {
          const live = liveFor(r.siteId, scheme);
          if (live === 'online') online++;
          else if (live === 'offline' || live === 'never') offline++;
          else if (r.state === 'in_progress' || r.state === 'achieved') pipeline++;
          else potential++;
        });
        base.monitoring = { online, offline, pipeline, potential };
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
    }).sort((a, b) => {
      // prima le certificazioni edificio (LEED, WELL...), poi i monitoraggi
      const mon = (s: SchemeSummary) => (s.model === 'monitoring' ? 1 : 0);
      return mon(a) - mon(b) || b.total - a.total;
    });

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
    const withSort: Array<{ row: SiteCertRow; sortValue: number }> = Array.from(bySite.entries()).map(([siteId, list]) => {
      const project = nameById.get(siteId);
      const cells: Record<string, SiteCertCell | null> = {};
      tableSchemes.forEach(scheme => {
        const best = list
          .filter(r => r.certType === scheme)
          .sort((a, b) =>
            stateRank[a.state] - stateRank[b.state] ||
            levelRank(scheme, a.certLevel) - levelRank(scheme, b.certLevel)
          )[0];
        const domLive = (scheme === 'Energy' || scheme === 'Air') ? liveFor(siteId, scheme) : null;
        if (best) {
          cells[scheme] = {
            state: best.state,
            certLevel: best.certLevel,
            issuedYear: best.issuedYear,
            expiryDate: best.expiryDate,
            isOm: best.isOm,
            expiringSoon: best.expiringSoon,
            // monitoring: la cella riflette i DEVICE del dominio
            live: schemeModel(scheme) === 'monitoring' ? (domLive ?? undefined) : undefined,
          };
        } else if (domLive) {
          // Device del dominio presenti anche SENZA progetto in gestionale
          // (caso Fendi Bicester: meter censiti, nessuna riga Energy): la
          // colonna mostra comunque lo stato reale. Non entra nei KPI, che
          // contano le righe di certifications.
          cells[scheme] = {
            state: 'in_progress',
            certLevel: null, issuedYear: null, expiryDate: null,
            isOm: false, expiringSoon: false,
            live: domLive,
          };
        } else {
          cells[scheme] = null;
        }
      });
      const dom = dominantCert(list);
      const section = sectionOf(dom, list);
      const sectionLive = section === 'energy' ? liveFor(siteId, 'Energy')
        : section === 'air' ? liveFor(siteId, 'Air')
        : null;
      return {
        row: { siteId, siteName: project?.name || siteId, region: project?.region || '—', cells, section },
        sortValue: sectionSortValue(section, dom, sectionLive),
      };
    });

    // Raggruppamento per sezione, nell'ordine della specifica; dentro ogni
    // sezione l'ordinamento cronologico approvato (a parita', alfabetico).
    const sections: DirectorySection[] = SECTION_ORDER.map(key => ({
      key,
      label: SECTION_LABEL[key],
      rows: withSort
        .filter(x => x.row.section === key)
        .sort((a, b) => a.sortValue - b.sortValue || a.row.siteName.localeCompare(b.row.siteName))
        .map(x => x.row),
    })).filter(s => s.rows.length > 0);

    return { kpis, schemes, sections, tableSchemes, isLoading, hasData: rows.length > 0 };
  }, [certs, filteredProjects, isLoading, domainLive]);
}
