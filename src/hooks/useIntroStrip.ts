/**
 * Dati REALI per la striscia «FGB × cliente» dell'intro (SPEC §3).
 * Ogni card ha una fonte e un fallback esplicito; il perimetro e' quello
 * dell'RLS gia' in produzione (nessuna nuova logica di autorizzazione):
 * un utente Fendi vede Fendi, una membership su un sito vede quel sito.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { classifyCertState } from '@/hooks/useCertificationsOverview';

const SIX_MONTHS_MS = 183 * 24 * 3600 * 1000;
const NOT_BUILDING = new Set(['Energy', 'Air']);

export interface IntroStripData {
  /** null → card nascosta (0 siti nel perimetro) */
  portfolio: { sites: number; energy: number; air: number; pipeline: number } | null;
  /** null → card nascosta (0 achieved E 0 in progress) */
  certs: { achieved: number; platinum: number; gold: number; inProgress: number; potential: number } | null;
  latestAward: { certType: string; level: string | null; siteId: string; date: string | null } | null;
  expiry: {
    count: number; // in scadenza < 6 mesi
    first: { siteId: string; date: string } | null;       // prima scadenza nella finestra
    firstBeyond: { siteId: string; date: string } | null; // prima oltre i 6 mesi (fallback)
  };
  /** null → card nascosta (nessun sito energy con dati) */
  energy: { siteId: string; deltaPct: number | null; kwh30: number } | null;
}

export function useIntroStrip() {
  return useQuery<IntroStripData | null>({
    queryKey: ['intro-strip'],
    queryFn: async () => {
      if (!supabase) return null;

      /* ── certificazioni: portafoglio, livelli, award, scadenze ── */
      const { data: certRows, error: certErr } = await supabase
        .from('certifications')
        .select('site_id, cert_type, status, cert_level, issued_date, expiry_date, created_at, has_energy_monitoring, has_iaq_monitoring')
        .limit(5000);
      if (certErr) throw certErr;

      const now = Date.now();
      const siteSet = new Set<string>();
      const energySites = new Set<string>();
      const airSites = new Set<string>();
      const pipelineSites = new Set<string>();
      let achieved = 0, platinum = 0, gold = 0, inProgress = 0, potential = 0;
      let latestAward: IntroStripData['latestAward'] = null;
      let lastTs = 0;
      let expCount = 0;
      let first: IntroStripData['expiry']['first'] = null;
      let firstBeyond: IntroStripData['expiry']['firstBeyond'] = null;

      interface CertRow {
        site_id: string; cert_type: string | null; status: string | null; cert_level: string | null;
        issued_date: string | null; expiry_date: string | null; created_at: string | null;
        has_energy_monitoring: boolean | null; has_iaq_monitoring: boolean | null;
      }
      for (const r of (certRows || []) as CertRow[]) {
        const state = classifyCertState(r.status);
        if (!state || !r.cert_type) continue;
        siteSet.add(r.site_id);
        const isMonitoring = NOT_BUILDING.has(r.cert_type) || r.has_energy_monitoring || r.has_iaq_monitoring;
        if (r.cert_type === 'Energy' || r.has_energy_monitoring) {
          if (state === 'achieved') energySites.add(r.site_id); else pipelineSites.add(r.site_id);
        }
        if (r.cert_type === 'Air' || r.has_iaq_monitoring) {
          if (state === 'achieved') airSites.add(r.site_id); else pipelineSites.add(r.site_id);
        }
        if (NOT_BUILDING.has(r.cert_type)) continue; // il resto conta solo gli schemi edificio
        void isMonitoring;

        if (state === 'achieved') {
          achieved++;
          const lvl = (r.cert_level || '').toLowerCase();
          if (lvl.includes('platinum')) platinum++;
          else if (lvl.includes('gold')) gold++;
          const ts = new Date(r.issued_date || r.created_at || 0).getTime();
          if (ts > lastTs) {
            lastTs = ts;
            latestAward = { certType: r.cert_type, level: r.cert_level || null, siteId: r.site_id, date: r.issued_date || r.created_at };
          }
          if (r.expiry_date) {
            const exp = new Date(r.expiry_date).getTime();
            if (exp > now && exp - now < SIX_MONTHS_MS) {
              expCount++;
              if (!first || exp < new Date(first.date).getTime()) first = { siteId: r.site_id, date: r.expiry_date };
            } else if (exp > now) {
              if (!firstBeyond || exp < new Date(firstBeyond.date).getTime()) firstBeyond = { siteId: r.site_id, date: r.expiry_date };
            }
          }
        } else if (state === 'potential') potential++;
        else inProgress++; // in corso + pipeline + quotate
      }

      /* ── energia: delta 30gg vs 30 precedenti sul sito col consumo maggiore.
            Precedenza al contatore generale, come nel resto dell'app. ── */
      let energy: IntroStripData['energy'] = null;
      try {
        const since = new Date(now - 60 * 86400000).toISOString().slice(0, 10);
        const [{ data: devs }, { data: daily }] = await Promise.all([
          supabase.from('devices').select('id, site_id, category').limit(5000),
          supabase
            .from('energy_daily')
            .select('site_id, device_id, ts_day, value_sum')
            .eq('metric', 'energy.active_energy')
            .gte('ts_day', since)
            .limit(50000),
        ]);
        const generalBySite = new Map<string, Set<string>>();
        for (const d of (devs || []) as { id: string; site_id: string | null; category: string | null }[]) {
          if (d.category === 'general' && d.site_id) {
            if (!generalBySite.has(d.site_id)) generalBySite.set(d.site_id, new Set());
            generalBySite.get(d.site_id)!.add(d.id);
          }
        }
        const cut = now - 30 * 86400000;
        const acc = new Map<string, { last: number; prev: number }>();
        for (const r of (daily || []) as { site_id: string | null; device_id: string; ts_day: string; value_sum: number | null }[]) {
          if (!r.site_id || !Number.isFinite(Number(r.value_sum))) continue;
          const gens = generalBySite.get(r.site_id);
          if (gens && gens.size > 0 && !gens.has(r.device_id)) continue;
          const e = acc.get(r.site_id) || { last: 0, prev: 0 };
          if (new Date(r.ts_day).getTime() >= cut) e.last += Number(r.value_sum);
          else e.prev += Number(r.value_sum);
          acc.set(r.site_id, e);
        }
        let top: { siteId: string; last: number; prev: number } | null = null;
        for (const [siteId, e] of acc) {
          if (e.last > 0 && (!top || e.last > top.last)) top = { siteId, last: e.last, prev: e.prev };
        }
        if (top) {
          energy = {
            siteId: top.siteId,
            deltaPct: top.prev > 0 ? ((top.last - top.prev) / top.prev) * 100 : null,
            kwh30: top.last,
          };
        }
      } catch { energy = null; /* card nascosta, mai un numero inventato */ }

      return {
        portfolio: siteSet.size > 0
          ? { sites: siteSet.size, energy: energySites.size, air: airSites.size, pipeline: [...pipelineSites].filter(s => !energySites.has(s) && !airSites.has(s)).length }
          : null,
        certs: achieved > 0 || inProgress > 0 ? { achieved, platinum, gold, inProgress, potential } : null,
        latestAward,
        expiry: { count: expCount, first, firstBeyond },
        energy,
      };
    },
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60 * 1000,
  });
}
