import { useMemo, useState } from "react";
import { useAllProjects, useAllBrands, useAllHoldings } from "@/hooks/useRealTimeData";
import { useAggregatedSiteData, type SiteState } from "@/hooks/useAggregatedSiteData";
import { useClientOverviewKpis } from "@/hooks/useClientOverviewKpis";
import { useUserScope } from "@/hooks/useUserScope";
import { CO2_THRESHOLDS } from "@/lib/airQuality";
import { CERTIFICATIONS_OVERVIEW } from "@/lib/features";
import CertificationsOverview from "./CertificationsOverview";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ReferenceLine, BarChart, Bar, Legend
} from "recharts";
import { ZoomableChart } from "@/components/ui/ZoomableChart";
import { ChevronUp, ChevronDown, Wifi, WifiOff, Circle, Info, BarChart3, Building2, LayoutList, Zap, Wind} from "lucide-react";
import { Sparkles } from "lucide-react";
import { useWrapped } from "@/components/wrapped/WrappedContext";
import { useAdminData } from "@/contexts/AdminDataContext";
import { BrandOverlaySkeleton } from "./DashboardSkeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

/** Stati della directory (spec Q5): etichette, pallino e pillola per stato. */
const DIR_STATE_META: Record<SiteState | 'all', { label: { en: string; it: string }; dot: string; pill: string }> = {
  all: { label: { en: 'All', it: 'Tutti' }, dot: '', pill: '' },
  online: {
    label: { en: 'Online', it: 'Online' },
    dot: 'text-emerald-500',
    pill: 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10',
  },
  offline: {
    label: { en: 'Offline', it: 'Offline' },
    dot: 'text-gray-400',
    pill: 'border-gray-400/30 text-gray-400 bg-gray-400/10',
  },
  stale: {
    label: { en: 'Stale', it: 'Stale' },
    dot: 'text-yellow-500',
    pill: 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10',
  },
  not_installed: {
    label: { en: 'Not installed', it: 'Non installato' },
    dot: 'text-foreground/20',
    pill: 'border-foreground/15 text-muted-foreground bg-foreground/5',
  },
};

/* Vecchia griglia KPI (Sites Online / MWh / CO2 / Alerts): spenta dalla
   spec v2 del 27.08, conservata per reversibilita' immediata. */
const LEGACY_CLIENT_KPIS = false;

/* Scatter Efficiency vs Comfort: bocciato dalla spec v2 (aria ed energia
   non si mescolano piu'); il posto del 4o grafico energia lo prendera'
   consumo vs temperatura esterna (Step 5). Conservato per reversibilita'. */
const LEGACY_SCATTER = false;

interface BrandOverlayProps {
  selectedBrand: string | null;
  selectedHolding: string | null;
  visible?: boolean;
  currentRegion?: string;
  activeFilters?: string[];
  /** Spec Q3/Q4: click su una riga di leaderboard o matrix apre il sito */
  onOpenSite?: (siteId: string) => void;
}

const BrandOverlay = ({ selectedBrand, selectedHolding, visible = true, currentRegion = 'GLOBAL', activeFilters = ['energy', 'air', 'water'], onOpenSite }: BrandOverlayProps) => {
  const { t, language } = useLanguage();
  const [chartsExpanded, setChartsExpanded] = useState(false);
  // Spec v2 (27.08): il pannello nasce SINTETICO — l'invasione della mappa
  // si apre con "See more", il click serve ad aprire (e poi a chiudere).
  const [isDesktopVisible, setIsDesktopVisible] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [dirFilter, setDirFilter] = useState<SiteState | 'all'>('all');
  const [showAllEnergyRank, setShowAllEnergyRank] = useState(false);
  const [showAllAirRank, setShowAllAirRank] = useState(false);
  // Switch Certifications | Monitoring (flag CERTIFICATIONS_OVERVIEW):
  // Certifications viene PRIMA ed e' il default (spec 27.08: "il cliente
  // compra prima la certificazione, poi il monitoraggio").
  const [overlayView, setOverlayView] = useState<'monitoring' | 'certifications'>(
    CERTIFICATIONS_OVERVIEW ? 'certifications' : 'monitoring'
  );
  const certView = CERTIFICATIONS_OVERVIEW && overlayView === 'certifications';

  const { brands } = useAllBrands();
  const { holdings } = useAllHoldings();
  const { projects, isLoading: projectsLoading } = useAllProjects();
  const { sites: adminSites } = useAdminData();
  const { open: openWrapped } = useWrapped();
  const { clientRole } = useUserScope();
  const isStaff = clientRole === 'ADMIN_FGB' || clientRole === 'USER_FGB';

  const brand = useMemo(() => 
    selectedBrand ? brands.find(b => b.id === selectedBrand) : null
  , [selectedBrand, brands]);

  const holding = useMemo(() => 
    selectedHolding ? holdings.find(h => h.id === selectedHolding) : null
  , [selectedHolding, holdings]);
  
  const filteredProjects = useMemo(() => {
    let result: typeof projects = [];
    if (selectedBrand) {
      result = projects.filter(p => p.brandId === selectedBrand);
    } else if (selectedHolding) {
      const holdingBrandIds = brands
        .filter(b => b.holdingId === selectedHolding)
        .map(b => b.id);
      result = projects.filter(p => holdingBrandIds.includes(p.brandId));
    }
    if (currentRegion && currentRegion !== 'GLOBAL') {
      result = result.filter(p => p.region === currentRegion);
    }
    return result;
  }, [selectedBrand, selectedHolding, projects, brands, currentRegion]);

  const {
    sites: allSitesData,
    sitesWithEnergy,
    sitesWithAir,
    totals,
    isLoading: telemetryLoading,
    hasRealData,
  } = useAggregatedSiteData(filteredProjects);

  // Stato live PER DOMINIO per gli schemi "monitoring" della vista
  // certificazioni: Online/Offline dalla freschezza del dominio, 'never' =
  // device censiti che non hanno mai trasmesso (=> Installing).
  const certDomainLive = useMemo(
    () => new Map(allSitesData.map(s => [s.siteId, { energy: s.energyLive, air: s.airLive }] as const)),
    [allSitesData]
  );

  // ===================================================================
  // Spec v2 (27.08): KPI del pannello per sezione + punti di monitoraggio
  // ===================================================================
  const perimeterSiteIds = useMemo(
    () => filteredProjects.map(p => p.siteId).filter((id): id is string => !!id),
    [filteredProjects]
  );
  const { data: overviewKpis } = useClientOverviewKpis(perimeterSiteIds);

  /** Incrocia i punti di monitoraggio (contratti/flag) con i device reali:
      installed = device censiti; pipeline = punto previsto senza device. */
  const buildDomainStats = (pointIds: string[], domain: 'energy' | 'air') => {
    const nameOf = (id: string) => adminSites.find(s => s.id === id)?.name || id;
    let online = 0, offline = 0, pipeline = 0;
    const list: { name: string; state: 'online' | 'offline' | 'pipeline' }[] = [];
    for (const id of pointIds) {
      const live = certDomainLive.get(id)?.[domain] ?? null;
      const state: 'online' | 'offline' | 'pipeline' =
        live === 'online' ? 'online' : live === 'offline' || live === 'never' ? 'offline' : 'pipeline';
      if (state === 'online') online++;
      else if (state === 'offline') offline++;
      else pipeline++;
      list.push({ name: nameOf(id), state });
    }
    const order = { online: 0, offline: 1, pipeline: 2 } as const;
    list.sort((a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name));
    return { total: pointIds.length, online, offline, installed: online + offline, pipeline, list };
  };
  const energyPoints = useMemo(
    () => buildDomainStats(overviewKpis?.energyPointSites ?? [], 'energy'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overviewKpis, certDomainLive, adminSites]
  );
  const airPoints = useMemo(
    () => buildDomainStats(overviewKpis?.airPointSites ?? [], 'air'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overviewKpis, certDomainLive, adminSites]
  );

  // ── Spec v2 Step 3: invasione Monitoring a schermo splittato ─────────
  // null = split ENERGY|AIR; 'energy'/'air' = vista di dominio aperta
  const [monDomain, setMonDomain] = useState<'energy' | 'air' | null>(null);

  /** Intensita' media del parco: kWh totali / m² totali, SOLO sui siti con
      area compilata e consumo nel periodo — il KPI dichiara il denominatore. */
  const energyIntensity = useMemo(() => {
    let kwh = 0, m2 = 0, n = 0;
    for (const s of sitesWithEnergy) {
      const site = adminSites.find(a => a.id === s.siteId);
      const area = site?.area_m2 ?? site?.areaSqm;
      const v = s.energy.monthlyKwh ?? 0;
      if (area && area > 0 && v > 0) { kwh += v; m2 += area; n++; }
    }
    return m2 > 0 ? { value: kwh / m2, sites: n } : null;
  }, [sitesWithEnergy, adminSites]);

  /** Salute dell'aria del parco: CO2 media e siti "salubri" (sotto soglia
      good) tra quelli con dato nel periodo. Proxy CO2, dichiarato. */
  const airHealth = useMemo(() => {
    const withCo2 = sitesWithAir.filter(s => (s.air.co2 ?? 0) > 0);
    if (withCo2.length === 0) return null;
    const avg = Math.round(withCo2.reduce((a, s) => a + (s.air.co2 || 0), 0) / withCo2.length);
    const label = avg <= CO2_THRESHOLDS.excellent ? 'Excellent' : avg <= CO2_THRESHOLDS.good ? 'Good' : 'Attention';
    const healthy = withCo2.filter(s => (s.air.co2 || 0) <= CO2_THRESHOLDS.good).length;
    return { avg, label, healthy, total: withCo2.length };
  }, [sitesWithAir]);

  // Geografia del perimetro: SOLO in visuale global (in region i dati sono
  // gia' filtrati dal redirect e non tutti hanno accesso al globale)
  const regionBreakdown = useMemo(() => {
    if (currentRegion !== 'GLOBAL') return [];
    const counts = new Map<string, number>();
    for (const p of filteredProjects) {
      if (p.region) counts.set(p.region, (counts.get(p.region) || 0) + 1);
    }
    return [...counts.entries()].map(([region, n]) => ({ region, n })).sort((a, b) => b.n - a.n);
  }, [filteredProjects, currentRegion]);

  // =====================================================================
  // Chart 1: Scatter Plot data (Energy kWh vs CO₂)
  // =====================================================================
  const scatterData = useMemo(() => {
    return sitesWithEnergy.map(site => {
      const airData = sitesWithAir.find(s => s.siteId === site.siteId);
      return {
        name: site.siteName,
        kwh: site.energy.monthlyKwh ?? 0,
        co2: airData?.air.co2 ?? 0,
        isOnline: site.isOnline,
      };
    }).filter(s => s.kwh > 0 || s.co2 > 0);
  }, [sitesWithEnergy, sitesWithAir]);

  const scatterMedians = useMemo(() => {
    if (scatterData.length === 0) return { medianKwh: 0, medianCo2: 0 };
    const kwhValues = scatterData.map(s => s.kwh).sort((a, b) => a - b);
    const co2Values = scatterData.filter(s => s.co2 > 0).map(s => s.co2).sort((a, b) => a - b);
    const median = (arr: number[]) => arr.length === 0 ? 0 : arr[Math.floor(arr.length / 2)];
    return { medianKwh: median(kwhValues), medianCo2: median(co2Values) || 600 };
  }, [scatterData]);

  // =====================================================================
  // Chart 2: Leaderboard data (Top consumers & worst air)
  // =====================================================================
  // Spec Q3: kWh assoluti 30gg (niente m²: nessun sito escluso per anagrafica
  // incompleta); aria = CO2 media 30gg del singolo sito, barre scalate sul
  // massimo riscontrato. Solo siti con dato nel periodo: mai zeri finti.
  const energyLeaderboard = useMemo(() => {
    return sitesWithEnergy
      .filter(s => (s.energy.monthlyKwh ?? 0) > 0)
      .map(s => ({ siteId: s.siteId, name: s.siteName, value: s.energy.monthlyKwh ?? 0 }))
      .sort((a, b) => b.value - a.value);
  }, [sitesWithEnergy]);

  const airLeaderboard = useMemo(() => {
    return sitesWithAir
      .filter(s => (s.air.co2 ?? 0) > 0)
      .map(s => ({ siteId: s.siteId, name: s.siteName, value: Math.round(s.air.co2 ?? 0) }))
      .sort((a, b) => b.value - a.value);
  }, [sitesWithAir]);

  /** Migliore e peggiore del periodo (spec v2: KPI qualitativo immediato). */
  const energyBestWorst = useMemo(() => {
    if (energyLeaderboard.length < 2) return null;
    return { best: energyLeaderboard[energyLeaderboard.length - 1], worst: energyLeaderboard[0] };
  }, [energyLeaderboard]);
  const airBestWorst = useMemo(() => {
    if (airLeaderboard.length < 2) return null;
    return { best: airLeaderboard[airLeaderboard.length - 1], worst: airLeaderboard[0] };
  }, [airLeaderboard]);

  // =====================================================================
  // Chart 3: Health Matrix data
  // =====================================================================
  const healthMatrixData = useMemo(() => {
    // Spec Q4: righe = tutti i siti monitorati, offline inclusi (attenuati).
    // Energia: baseline PROPRIA del sito (media 30gg vs 90gg) — verde <=+10%,
    // giallo +10-25%, rosso >+25%. Aria: soglie canoniche di airQuality.ts.
    // Alert: da site_alerts, rosso se >=1 critical. "—" se il dominio non e'
    // installato o non ha dati.
    return allSitesData.map(site => {
      const co2 = site.air.co2;
      const delta = site.baselineDeltaPct;

      const energyStatus = !site.capabilities.energy || delta === null
        ? 'none'
        : delta <= 10 ? 'good' : delta <= 25 ? 'moderate' : 'critical';
      const airStatus = !site.capabilities.air || co2 === null || co2 <= 0
        ? 'none'
        : co2 <= CO2_THRESHOLDS.good ? 'good' : co2 <= CO2_THRESHOLDS.moderate ? 'moderate' : 'critical';
      const alertsStatus = site.alerts.critical >= 1
        ? 'critical'
        : site.alerts.warning >= 1 ? 'moderate' : 'good';

      return {
        siteId: site.siteId,
        name: site.siteName,
        isOnline: site.isOnline,
        state: site.state,
        energy: { value: delta, kwh: site.energy.monthlyKwh, status: energyStatus },
        air: { value: co2 !== null ? Math.round(co2) : null, status: airStatus },
        alerts: { value: site.alerts.critical + site.alerts.warning, status: alertsStatus },
      };
    }).sort((a, b) => {
      // Ordine richiesto: prima gli OK, poi i warning, in fondo i critical.
      const score = (s: typeof a) => {
        const map: Record<string, number> = { critical: 3, moderate: 2, good: 1, none: 0 };
        return (map[s.energy.status] || 0) + (map[s.air.status] || 0) + (map[s.alerts.status] || 0);
      };
      return score(a) - score(b);
    });
  }, [allSitesData]);

  // =====================================================================
  // Chart 4: Store Directory
  // =====================================================================
  // Spec Q5: la directory e' il censimento dell'INTERO portfolio, ma con stati
  // veri a quattro livelli. Lo stato si giudica sui soli domini installati
  // (aria monitorata e online => sito Online, anche senza energia); un sito
  // senza alcun dispositivo e' Not installed — MAI "Online" per default,
  // com'era prima (isOnline ?? true e hasData cablato a true: da li' il
  // 96 "Online" contro 38 online veri).
  const storeDirectory = useMemo(() => {
    return filteredProjects.map(p => {
      const targetSiteId = p.siteId || `s-demo-${p.id}`;
      const siteData = allSitesData.find(s => s.siteId === targetSiteId);
      const state: SiteState = siteData?.state ?? 'not_installed';
      return {
        siteId: targetSiteId,
        name: p.displayName || p.name,
        city: p.address?.split(',').pop()?.trim() || '—',
        region: p.region || '—',
        state,
        capabilities: siteData?.capabilities ?? { energy: false, air: false, water: false },
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredProjects, allSitesData]);

  // === Popover drill-down lists ===
  const siteStatusList = useMemo(() => {
    const order: Record<SiteState, number> = { online: 0, offline: 1, stale: 2, not_installed: 3 };
    return storeDirectory
      .map(d => ({ name: d.name, status: d.state }))
      .sort((a, b) => order[a.status] - order[b.status]);
  }, [storeDirectory]);

  const energyRankedList = useMemo(() => {
    return sitesWithEnergy
      .filter(s => (s.energy.monthlyKwh ?? 0) > 0)
      .map(s => ({ name: s.siteName, kwh: s.energy.monthlyKwh ?? 0 }))
      .sort((a, b) => b.kwh - a.kwh);
  }, [sitesWithEnergy]);

  const getAqLabel = (co2: number | null): string => {
    if (!co2 || co2 === 0) return "N/A";
    if (co2 < 400) return "EXCELLENT";
    if (co2 < 600) return "GOOD";
    if (co2 < 1000) return "MODERATE";
    return "POOR";
  };
  const aqRank: Record<string, number> = { EXCELLENT: 0, GOOD: 1, MODERATE: 2, POOR: 3, "N/A": 4 };
  const co2RankedList = useMemo(() => {
    return sitesWithAir
      .map(s => ({ name: s.siteName, co2: s.air.co2 ?? 0, label: getAqLabel(s.air.co2) }))
      .sort((a, b) => aqRank[a.label] - aqRank[b.label]);
  }, [sitesWithAir]);

  const alertsList = useMemo(() => {
    return [...sitesWithEnergy, ...sitesWithAir]
      .filter((s, i, arr) => arr.findIndex(x => x.siteId === s.siteId) === i)
      .filter(s => s.alerts.critical > 0 || s.alerts.warning > 0)
      .map(s => ({ name: s.siteName, critical: s.alerts.critical, warning: s.alerts.warning }))
      .sort((a, b) => (b.critical + b.warning) - (a.critical + a.warning));
  }, [sitesWithEnergy, sitesWithAir]);

  const aqColorMap: Record<string, string> = {
    EXCELLENT: 'text-emerald-400', GOOD: 'text-emerald-500', MODERATE: 'text-yellow-500', POOR: 'text-red-400', 'N/A': 'text-muted-foreground'
  };
  const statusColor: Record<string, string> = { online: 'text-emerald-500', offline: 'text-yellow-500', not_installed: 'text-red-400' };
  const statusLabelMap = (s: string) => {
    const map: Record<string, string> = { online: t('region.status_online'), offline: t('region.status_offline'), not_installed: t('region.status_not_installed') };
    return map[s] ?? s;
  };

  const displayEntity = brand || holding;

  if (!displayEntity || !visible) return null;

  if (projectsLoading || telemetryLoading) {
    return (
      <div className="hidden md:block fixed top-24 right-4 md:right-8 z-30 pointer-events-none">
        <BrandOverlaySkeleton />
      </div>
    );
  }

  const filterEnergy = activeFilters.includes('energy');
  const filterAir = activeFilters.includes('air');
  const showScatter = scatterData.length >= 2 && filterEnergy && filterAir;
  const showLeaderboards = (energyLeaderboard.length >= 1 && filterEnergy) || (airLeaderboard.length >= 1 && filterAir);
  const showHealthMatrix = healthMatrixData.length >= 1;
  const showAnyChart = showScatter || showLeaderboards || showHealthMatrix;

  // Scatter quadrant coloring
  const getQuadrantColor = (kwh: number, co2: number) => {
    const highEnergy = kwh > scatterMedians.medianKwh;
    const highCo2 = co2 > scatterMedians.medianCo2;
    if (highEnergy && highCo2) return 'hsl(0, 70%, 55%)';       // Red: critical
    if (!highEnergy && highCo2) return 'hsl(45, 80%, 55%)';     // Yellow: health risk
    if (highEnergy && !highCo2) return 'hsl(30, 70%, 55%)';     // Orange: energy waste
    return 'hsl(160, 60%, 45%)';                                 // Green: best performer
  };

  const healthStatusColors: Record<string, string> = {
    good: 'bg-emerald-500/80',
    moderate: 'bg-yellow-500/80',
    critical: 'bg-red-500/80',
    none: 'bg-muted/40',
  };

  return (
    <>
      {/* ============================================================ */}
      {/* Summary Panel — top-right, like RegionOverlay */}
      {/* ============================================================ */}
      <div className={`fixed top-24 left-4 md:left-8 z-30 w-72 md:w-[320px] pointer-events-none transition-all duration-500 hidden md:block ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
      }`}>
        <div className="glass-panel p-6 rounded-2xl pointer-events-auto">
          {/* Logo + Title */}
          <div className="flex flex-col items-center gap-3 mb-5">
            {displayEntity.logo ? (
              <img src={displayEntity.logo} alt={displayEntity.name} className="h-12 w-auto object-contain opacity-90 filter drop-shadow-[0_0_20px_rgba(255,255,255,0.65)] drop-shadow-[0_0_40px_rgba(255,255,255,0.4)] transition-all duration-300" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-foreground/10 border border-foreground/5 flex items-center justify-center text-foreground font-bold text-base shadow-inner">
                {displayEntity.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              {/* <h3 className="text-lg font-bold text-foreground truncate leading-tight">{displayEntity.name}</h3> */}
              <p className="text-[10px] text-fgb-accent uppercase tracking-widest mt-1 font-medium">
                {brand ? t('brand.brand_overview') : t('brand.holding_overview')}
              </p>
            </div>
            {CERTIFICATIONS_OVERVIEW && (
              <div className="flex bg-foreground/5 border border-foreground/10 rounded-full p-0.5" role="tablist" aria-label="Overlay view">
                {(['certifications', 'monitoring'] as const).map(v => (
                  <button
                    key={v}
                    role="tab"
                    aria-selected={overlayView === v}
                    onClick={() => setOverlayView(v)}
                    className={`px-3.5 py-1.5 rounded-full text-[10px] tracking-wide uppercase transition-all ${
                      overlayView === v
                        ? 'bg-fgb-secondary text-white font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {v === 'monitoring' ? 'Monitoring' : 'Certifications'}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                const ids = new Set(filteredProjects.map(p => p.siteId).filter(Boolean));
                const sitesList = adminSites.filter(s => ids.has(s.id)).map(s => ({
                  id: s.id, name: s.name, region: s.region,
                  brandName: brand?.name ?? null,
                  areaM2: s.area_m2 ?? s.areaSqm ?? null,
                }));
                if (sitesList.length === 0) return;
                openWrapped({ kind: 'aggregate', label: displayEntity.name, sites: sitesList });
              }}
              className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 transition-colors"
              title="Play weekly Wrapped"
            >
              <Sparkles className="w-3.5 h-3.5 text-fgb-accent" />
              <span className="text-[10px] uppercase tracking-widest text-foreground">Weekly Wrapped</span>
            </button>
          </div>

          {/* Spec v2: al posto di DATA AVAILABLE, il claim di copertura —
              globale o regionale a seconda della visuale corrente */}
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <Sparkles className="w-3 h-3 text-fgb-accent" />
            <span className="text-[10px] text-fgb-accent uppercase tracking-wider text-center">
              {filteredProjects.length}{' '}
              {currentRegion === 'GLOBAL'
                ? (language === 'it' ? 'siti nel mondo coperti da FGB' : 'sites worldwide covered by FGB')
                : (language === 'it' ? `siti in ${currentRegion} coperti da FGB` : `sites in ${currentRegion} covered by FGB`)}
            </span>
          </div>

          {/* Stats Grid */}
          <TooltipProvider delayDuration={300}>

          {/* ── Spec v2: KPI per sezione ─────────────────────────────── */}
          {certView ? (
            <div className="grid grid-cols-2 gap-2.5">
              {/* Certificazioni ottenute */}
              <div
                onClick={() => setIsDesktopVisible(true)}
                className="text-center p-3 rounded-xl bg-foreground/5 border border-foreground/10 cursor-pointer hover:bg-foreground/10 transition-colors group"
              >
                <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <UITooltip>
                    <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60" /></TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px] text-xs">
                      {language === 'it'
                        ? 'Certificazioni di edificio ottenute nel tuo perimetro (i progetti Energy e Air sono conteggiati nella vista Monitoring). Clic per aprire la vista completa.'
                        : 'Building certifications achieved in your portfolio (Energy and Air projects are counted in the Monitoring view). Click to open the full view.'}
                    </TooltipContent>
                  </UITooltip>
                </div>
                <div className="text-2xl font-bold text-foreground mt-0.5">{overviewKpis ? overviewKpis.certAchieved : '—'}</div>
                <div className="text-[11px] uppercase text-muted-foreground mt-1">{language === 'it' ? 'Cert. ottenute' : 'Certs achieved'}</div>
                {overviewKpis && overviewKpis.certAchievedLevels.length > 0 && (
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {overviewKpis.certAchievedLevels.map(l => `${l.n} ${l.level}`).join(' · ')}
                  </div>
                )}
              </div>
              {/* Certificazioni in avanzamento */}
              <div
                onClick={() => setIsDesktopVisible(true)}
                className="text-center p-3 rounded-xl bg-foreground/5 border border-foreground/10 cursor-pointer hover:bg-foreground/10 transition-colors group"
              >
                <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <UITooltip>
                    <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60" /></TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px] text-xs">
                      {language === 'it'
                        ? 'Tutte le certificazioni non ancora ottenute: in corso, in pipeline, quotate e potenziali. Clic per aprire la vista completa.'
                        : 'Every certification not yet achieved: in progress, pipeline, quoted and potential. Click to open the full view.'}
                    </TooltipContent>
                  </UITooltip>
                </div>
                <div className="text-2xl font-bold text-foreground mt-0.5">{overviewKpis ? overviewKpis.certAdvancing : '—'}</div>
                <div className="text-[11px] uppercase text-muted-foreground mt-1">{language === 'it' ? 'In avanzamento' : 'In progress'}</div>
                {overviewKpis && overviewKpis.certAdvancing > 0 && (
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {overviewKpis.certAdvancingBreakdown.inProgress} {language === 'it' ? 'in corso' : 'active'} · {overviewKpis.certAdvancingBreakdown.pipeline} pipeline · {overviewKpis.certAdvancingBreakdown.potential} potential
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {/* Siti energia (punti di monitoraggio) */}
              <Popover>
                <PopoverTrigger asChild>
                  <div className="text-center p-3 rounded-xl bg-foreground/5 border border-foreground/10 cursor-pointer hover:bg-foreground/10 transition-colors group">
                    <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <UITooltip>
                        <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60" /></TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs">
                          {language === 'it'
                            ? 'Siti con un punto di monitoraggio energia: progetti Energy o certificazioni con hardware energia. Clic per l\'elenco dei siti.'
                            : 'Sites with an energy monitoring point: standalone Energy projects or certifications with energy hardware. Click for the site list.'}
                        </TooltipContent>
                      </UITooltip>
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-0.5">{overviewKpis ? energyPoints.total : '—'}</div>
                    <div className="text-[11px] uppercase text-muted-foreground mt-1">{language === 'it' ? 'Siti energia' : 'Energy sites'}</div>
                    {overviewKpis && energyPoints.total > 0 && (
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {energyPoints.online} online
                        {energyPoints.offline > 0 && <span className="text-yellow-500"> · {energyPoints.offline} ⚠ offline</span>}
                        {energyPoints.pipeline > 0 && ` · ${energyPoints.pipeline} pipeline`}
                      </div>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0 border-border/50 bg-popover/95 backdrop-blur-xl" side="right" align="start">
                  <div className="px-3 py-2 border-b border-border/30">
                    <p className="text-xs font-semibold text-foreground">{language === 'it' ? 'Punti energia per sito' : 'Energy points by site'}</p>
                  </div>
                  <ScrollArea className="max-h-[220px]">
                    <div className="p-2 space-y-0.5">
                      {energyPoints.list.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/5">
                          <Circle className={`w-2.5 h-2.5 fill-current ${s.state === 'online' ? 'text-emerald-500' : s.state === 'offline' ? 'text-yellow-500' : 'text-foreground/25'}`} />
                          <span className="text-xs text-foreground break-words flex-1">{s.name}</span>
                          <span className={`text-[10px] ${s.state === 'online' ? 'text-emerald-500' : s.state === 'offline' ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                            {s.state === 'pipeline' ? 'Pipeline' : s.state === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              {/* Siti aria (punti di monitoraggio) */}
              <Popover>
                <PopoverTrigger asChild>
                  <div className="text-center p-3 rounded-xl bg-foreground/5 border border-foreground/10 cursor-pointer hover:bg-foreground/10 transition-colors group">
                    <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <UITooltip>
                        <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60" /></TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs">
                          {language === 'it'
                            ? 'Siti con un punto di monitoraggio aria: progetti Air o certificazioni con hardware IAQ. Clic per l\'elenco dei siti.'
                            : 'Sites with an air monitoring point: standalone Air projects or certifications with IAQ hardware. Click for the site list.'}
                        </TooltipContent>
                      </UITooltip>
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-0.5">{overviewKpis ? airPoints.total : '—'}</div>
                    <div className="text-[11px] uppercase text-muted-foreground mt-1">{language === 'it' ? 'Siti aria' : 'Air sites'}</div>
                    {overviewKpis && airPoints.total > 0 && (
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {airPoints.online} online
                        {airPoints.offline > 0 && <span className="text-yellow-500"> · {airPoints.offline} ⚠ offline</span>}
                        {airPoints.pipeline > 0 && ` · ${airPoints.pipeline} pipeline`}
                      </div>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0 border-border/50 bg-popover/95 backdrop-blur-xl" side="right" align="start">
                  <div className="px-3 py-2 border-b border-border/30">
                    <p className="text-xs font-semibold text-foreground">{language === 'it' ? 'Punti aria per sito' : 'Air points by site'}</p>
                  </div>
                  <ScrollArea className="max-h-[220px]">
                    <div className="p-2 space-y-0.5">
                      {airPoints.list.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/5">
                          <Circle className={`w-2.5 h-2.5 fill-current ${s.state === 'online' ? 'text-emerald-500' : s.state === 'offline' ? 'text-yellow-500' : 'text-foreground/25'}`} />
                          <span className="text-xs text-foreground break-words flex-1">{s.name}</span>
                          <span className={`text-[10px] ${s.state === 'online' ? 'text-emerald-500' : s.state === 'offline' ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                            {s.state === 'pipeline' ? 'Pipeline' : s.state === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              {/* Acqua: predisposto — tratteggiato, solo per lo staff FGB */}
              {isStaff && (
                <div className="col-span-2 text-center py-2 px-3 rounded-xl border border-dashed border-foreground/15 opacity-60">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {language === 'it' ? 'Siti acqua — predisposto' : 'Water sites — pre-wired'}
                    {overviewKpis && overviewKpis.waterPointSites.length > 0 ? ` · ${overviewKpis.waterPointSites.length}` : ''}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Geografia del perimetro: SOLO in visuale global */}
          {regionBreakdown.length > 0 && (
            <div className="mt-2.5 py-2 px-3 rounded-xl bg-foreground/5 border border-foreground/10 text-center">
              <span className="text-[10px] text-muted-foreground tracking-wide">
                {regionBreakdown.map((r, i) => (
                  <span key={r.region}>{i > 0 && ' · '}{r.region} <b className="text-foreground">{r.n}</b></span>
                ))}
              </span>
            </div>
          )}

          {LEGACY_CLIENT_KPIS && (
          <div className="grid grid-cols-2 gap-2.5">

            {/* Sites Online */}
            <Popover>
              <PopoverTrigger asChild>
                <div className="text-center p-3 rounded-xl bg-foreground/5 border border-foreground/10 cursor-pointer hover:bg-foreground/10 transition-colors group">
                  <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <UITooltip>
                      <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60" /></TooltipTrigger>
                       <TooltipContent side="top" className="max-w-[220px] text-xs">
                        {t('brand.sites_tooltip')}
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-0.5">{hasRealData ? `${totals.sitesOnline} / ${totals.sitesMonitored}` : "—"}</div>
                  <div className="text-[11px] uppercase text-muted-foreground mt-1">{t('brand.sites_online')}</div>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 border-border/50 bg-popover/95 backdrop-blur-xl" side="right" align="start">
                <div className="px-3 py-2 border-b border-border/30">
                  <p className="text-xs font-semibold text-foreground">{t('brand.sites_status')}</p>
                </div>
                <ScrollArea className="max-h-[220px]">
                  <div className="p-2 space-y-0.5">
                    {siteStatusList.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/5">
                        <Circle className={`w-2.5 h-2.5 fill-current ${statusColor[s.status]}`} />
                        <span className="text-xs text-foreground break-words flex-1">{s.name}</span>
                        <span className={`text-[10px] ${statusColor[s.status]}`}>{statusLabelMap(s.status)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* kWh (30d) */}
            <Popover>
              <PopoverTrigger asChild>
                <div className={`text-center p-3 rounded-xl bg-foreground/5 border border-foreground/10 transition-colors group ${filterEnergy ? 'cursor-pointer hover:bg-foreground/10' : 'opacity-30 grayscale pointer-events-none'}`}>
                  <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <UITooltip>
                      <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        {t('brand.energy_tooltip')}
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-0.5">
                    {filterEnergy && hasRealData && totals.monthlyEnergyKwh > 0 ? (totals.monthlyEnergyKwh / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                  </div>
                  <div className="text-[11px] uppercase text-muted-foreground mt-1">MWh (30d)</div>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 border-border/50 bg-popover/95 backdrop-blur-xl" side="right" align="start">
                <div className="px-3 py-2 border-b border-border/30">
                  <p className="text-xs font-semibold text-foreground">{t('brand.consumption_per_site')}</p>
                </div>
                <ScrollArea className="max-h-[220px]">
                  <div className="p-2 space-y-0.5">
                    {energyRankedList.length > 0 ? energyRankedList.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/5">
                        <span className="text-[10px] text-muted-foreground w-4 text-right">{i + 1}.</span>
                        <span className="text-xs text-foreground break-words flex-1">{s.name}</span>
                        <span className="text-xs font-semibold text-foreground tabular-nums">{(s.kwh / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-muted-foreground font-normal">MWh</span></span>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground text-center py-3">{t('region.no_data_short')}</p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Avg CO₂ */}
            <Popover>
              <PopoverTrigger asChild>
                <div className={`text-center p-3 rounded-xl bg-foreground/5 border border-foreground/10 transition-colors group ${filterAir ? 'cursor-pointer hover:bg-foreground/10' : 'opacity-30 grayscale pointer-events-none'}`}>
                  <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <UITooltip>
                      <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        {t('brand.air_tooltip')}
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-0.5">
                    {filterAir && hasRealData && totals.avgCo2 > 0 ? totals.avgCo2 : '—'}
                  </div>
                  <div className="text-[11px] uppercase text-muted-foreground mt-1">Avg CO₂</div>
                  {/* Spec Q1: la media dichiara il proprio denominatore */}
                  {filterAir && hasRealData && sitesWithAir.length > 0 && (
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {language === 'it' ? `su ${sitesWithAir.length} siti con aria` : `across ${sitesWithAir.length} air sites`}
                    </div>
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 border-border/50 bg-popover/95 backdrop-blur-xl" side="right" align="start">
                <div className="px-3 py-2 border-b border-border/30">
                  <p className="text-xs font-semibold text-foreground">{t('brand.air_per_site')}</p>
                </div>
                <ScrollArea className="max-h-[220px]">
                  <div className="p-2 space-y-0.5">
                    {co2RankedList.length > 0 ? co2RankedList.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/5">
                        <Circle className={`w-2.5 h-2.5 fill-current ${aqColorMap[s.label]}`} />
                        <span className="text-xs text-foreground break-words flex-1">{s.name}</span>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-foreground tabular-nums">{s.co2} <span className="text-muted-foreground font-normal">ppm</span></span>
                          <div className={`text-[9px] font-medium ${aqColorMap[s.label]}`}>{s.label}</div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground text-center py-3">{t('region.no_data_short')}</p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Active Alerts */}
            <Popover>
              <PopoverTrigger asChild>
                <div className="text-center p-3 rounded-xl bg-foreground/5 border border-foreground/10 cursor-pointer hover:bg-foreground/10 transition-colors group">
                  <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <UITooltip>
                      <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60" /></TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        {t('brand.alerts_tooltip')}
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-0.5">
                    {hasRealData && (totals.alertsCritical > 0 || totals.alertsWarning > 0)
                      ? <span className={totals.alertsCritical > 0 ? 'text-destructive' : 'text-yellow-500'}>{totals.alertsCritical + totals.alertsWarning}</span>
                      : '0'}
                  </div>
                  <div className="text-[11px] uppercase text-muted-foreground mt-1">{t('brand.active_alerts')}</div>
                  {/* Spec Q1b: lo stale e' "no-data", mai mescolato ai critical */}
                  {hasRealData && totals.alertsNoData > 0 && (
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {totals.alertsNoData} no-data
                    </div>
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0 border-border/50 bg-popover/95 backdrop-blur-xl" side="right" align="start">
                <div className="px-3 py-2 border-b border-border/30">
                  <p className="text-xs font-semibold text-foreground">{t('brand.alerts_per_site')}</p>
                </div>
                <ScrollArea className="max-h-[220px]">
                  <div className="p-2 space-y-0.5">
                    {alertsList.length > 0 ? alertsList.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/5">
                        <span className="text-xs text-foreground break-words flex-1">{s.name}</span>
                        <div className="flex items-center gap-1.5">
                          {s.critical > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">{s.critical} crit</span>}
                          {s.warning > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500">{s.warning} warn</span>}
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground text-center py-3">{t('brand.no_active_alerts')}</p>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

          </div>
          )}
          </TooltipProvider>

          {/* Chart toggle */}
          <button
            onClick={() => {
              if (isDesktopVisible) setMonDomain(null); /* chiudendo si torna allo split */
              setIsDesktopVisible(!isDesktopVisible);
            }}
            className="relative z-10 flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-lg border border-foreground/10 text-xs font-medium transition-all pointer-events-auto mt-3 bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            {/* Spec v2: "See more" — caption invitante, il default e' chiuso */}
            <span>{isDesktopVisible ? (language === 'it' ? 'Chiudi' : 'See less') : (language === 'it' ? 'Vedi di più' : 'See more')}</span>
            {isDesktopVisible ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {!hasRealData && (
            <div className="mt-3 p-2 rounded-lg bg-muted/30 border border-muted">
              <p className="text-[10px] text-muted-foreground text-center">{t('brand.no_active_modules')}</p>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* Certifications Panel — sostituisce i chart quando lo switch  */}
      {/* e' su Certifications (flag CERTIFICATIONS_OVERVIEW)          */}
      {/* ============================================================ */}
      {certView && isDesktopVisible && (
        <div className="hidden md:block fixed top-24 right-4 md:right-8 z-20 pointer-events-none" style={{ width: 'calc(100% - 360px - 3rem)' }}>
          <div className="pointer-events-auto h-[calc(100vh-14rem)]">
            <CertificationsOverview projects={filteredProjects} domainLive={certDomainLive} onOpenSite={onOpenSite} />
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Charts Panel — positioned below, centered */}
      {/* ============================================================ */}
      {!certView && isDesktopVisible && (
        <div className="hidden md:block fixed top-24 right-4 md:right-8 z-20 pointer-events-none" style={{ width: 'calc(100% - 360px - 3rem)' }}>
          <style>{`
            .fgb-invasion-scroll{scrollbar-width:thin;scrollbar-color:rgba(0,145,147,.4) transparent}
            .fgb-invasion-scroll::-webkit-scrollbar{width:5px}
            .fgb-invasion-scroll::-webkit-scrollbar-track{background:transparent}
            .fgb-invasion-scroll::-webkit-scrollbar-thumb{background:rgba(0,145,147,.4);border-radius:999px}
            .fgb-invasion-scroll > .glass-panel{height:calc(100vh - 15.5rem);flex-shrink:0}
          `}</style>
          {monDomain !== null ? (
            /* ══ Vista di dominio (spec v2): 4 KPI + classifica, un tema alla volta ══ */
            <div className="pointer-events-auto h-[calc(100vh-14rem)]">
              <div className="glass-panel rounded-2xl p-6 h-full flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <button onClick={() => setMonDomain(null)} className="px-3 py-1.5 rounded-full bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    ← {language === 'it' ? 'Indietro' : 'Back'}
                  </button>
                  {monDomain === 'energy' ? <Zap className="w-5 h-5 text-amber-500" /> : <Wind className="w-5 h-5 text-blue-400" />}
                  <h4 className="text-lg font-semibold text-foreground uppercase tracking-wider">{monDomain === 'energy' ? 'Energy' : 'Air'} · {displayEntity.name}</h4>
                </div>
                {/* 4 KPI del dominio (spec: max 4, aperti su tutto lo spazio) */}
                <div className="grid grid-cols-4 gap-2.5 mb-5">
                  {(monDomain === 'energy' ? [
                    { v: totals.monthlyEnergyKwh > 0 ? `${(totals.monthlyEnergyKwh / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} MWh` : '—', l: language === 'it' ? 'Consumo 30 giorni' : 'Consumption 30 days', small: false },
                    { v: energyIntensity ? `${energyIntensity.value.toFixed(1)} kWh/m²` : '—', l: energyIntensity ? (language === 'it' ? `Intensità · ${energyIntensity.sites} siti con area` : `Intensity · ${energyIntensity.sites} sites with area`) : (language === 'it' ? 'Intensità' : 'Intensity'), small: false },
                    { v: energyBestWorst ? energyBestWorst.best.name : '—', l: language === 'it' ? 'Migliore del periodo' : 'Best of the period', small: true },
                    { v: energyBestWorst ? energyBestWorst.worst.name : '—', l: language === 'it' ? 'Da attenzionare' : 'Needs attention', small: true },
                  ] : [
                    { v: airHealth ? `${airHealth.avg} ppm · ${airHealth.label}` : '—', l: language === 'it' ? 'CO₂ media del parco' : 'Portfolio average CO₂', small: false },
                    { v: airHealth ? `${airHealth.healthy} / ${airHealth.total}` : '—', l: language === 'it' ? 'Siti in aria salubre' : 'Sites in healthy air', small: false },
                    { v: airBestWorst ? airBestWorst.best.name : '—', l: language === 'it' ? 'Migliore del periodo' : 'Best of the period', small: true },
                    { v: airBestWorst ? airBestWorst.worst.name : '—', l: language === 'it' ? 'Da attenzionare' : 'Needs attention', small: true },
                  ]).map((k, i) => (
                    <div key={i} className="text-center p-3 rounded-xl bg-foreground/5 border border-foreground/10 min-w-0">
                      <div className={`${k.small ? 'text-sm' : 'text-xl'} font-bold text-foreground truncate`} title={String(k.v)}>{k.v}</div>
                      <div className="text-[10px] uppercase text-muted-foreground mt-1">{k.l}</div>
                    </div>
                  ))}
                </div>
                {/* Un grafico alla volta: la classifica del dominio */}
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{language === 'it' ? 'Classifica dei siti' : 'Site ranking'} · {monDomain === 'energy' ? 'kWh (30d)' : 'CO₂ ppm (30d)'}</p>
                <div className="flex-1 min-h-0 overflow-y-auto fgb-invasion-scroll pr-1 space-y-1.5">
                  {(monDomain === 'energy' ? energyLeaderboard : airLeaderboard).map((s, i, list) => {
                    const max = list[0]?.value || 1;
                    return (
                      <button key={s.siteId} onClick={() => onOpenSite?.(s.siteId)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-foreground/5 transition-colors text-left">
                        <span className="text-[10px] text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                        <span className="text-xs text-foreground w-44 truncate shrink-0">{s.name}</span>
                        <div className="flex-1 h-2 rounded-full bg-foreground/5 overflow-hidden">
                          <div className={`h-full rounded-full ${monDomain === 'energy' ? 'bg-fgb-secondary' : (s.value > CO2_THRESHOLDS.good ? 'bg-yellow-500' : 'bg-emerald-500')}`} style={{ width: `${Math.max(4, (s.value / max) * 100)}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-foreground tabular-nums w-20 text-right shrink-0">
                          {monDomain === 'energy' ? `${(s.value / 1000).toFixed(1)} MWh` : `${s.value} ppm`}
                        </span>
                      </button>
                    );
                  })}
                  {(monDomain === 'energy' ? energyLeaderboard : airLeaderboard).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">{t('region.no_data_short')}</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
          <div className="pointer-events-auto h-[calc(100vh-14rem)] overflow-y-auto space-y-3 fgb-invasion-scroll">
            {/* ══ SPLIT ENERGY | AIR (spec v2: come "Two ways in" della landing) ══ */}
            <div className="grid grid-cols-2 gap-3" style={{ height: 'calc(100vh - 15.5rem)' }}>
              <button onClick={() => setMonDomain('energy')} className="glass-panel rounded-2xl p-8 h-full flex flex-col items-center justify-center text-center transition-all duration-300 hover:scale-[1.02] hover:border-amber-500/30 group cursor-pointer">
                <Zap className="w-10 h-10 text-amber-500 mb-4 transition-transform group-hover:scale-110" />
                <h4 className="text-3xl font-bold text-foreground uppercase tracking-[0.2em]">Energy</h4>
                <div className="mt-8 space-y-5">
                  <div>
                    <div className="text-3xl font-bold text-foreground tabular-nums">{totals.monthlyEnergyKwh > 0 ? (totals.monthlyEnergyKwh / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—'} <span className="text-base font-normal text-muted-foreground">MWh</span></div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{language === 'it' ? 'consumo · ultimi 30 giorni' : 'consumption · last 30 days'}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground tabular-nums">{energyIntensity ? energyIntensity.value.toFixed(1) : '—'} <span className="text-sm font-normal text-muted-foreground">kWh/m²</span></div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{energyIntensity ? (language === 'it' ? `intensità media · ${energyIntensity.sites} siti con area` : `avg intensity · ${energyIntensity.sites} sites with area`) : (language === 'it' ? 'intensità media' : 'avg intensity')}</div>
                  </div>
                </div>
                <span className="mt-8 text-xs text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-widest">{language === 'it' ? 'Apri la vista energia →' : 'Open the energy view →'}</span>
              </button>
              <button onClick={() => setMonDomain('air')} className="glass-panel rounded-2xl p-8 h-full flex flex-col items-center justify-center text-center transition-all duration-300 hover:scale-[1.02] hover:border-blue-400/30 group cursor-pointer">
                <Wind className="w-10 h-10 text-blue-400 mb-4 transition-transform group-hover:scale-110" />
                <h4 className="text-3xl font-bold text-foreground uppercase tracking-[0.2em]">Air</h4>
                <div className="mt-8 space-y-5">
                  <div>
                    <div className="text-3xl font-bold text-foreground tabular-nums">{airHealth ? airHealth.avg : '—'} <span className="text-base font-normal text-muted-foreground">ppm</span>{airHealth && <span className={`text-lg font-semibold ${airHealth.label === 'Attention' ? 'text-yellow-500' : 'text-emerald-500'}`}> · {airHealth.label}</span>}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{language === 'it' ? 'CO₂ media del parco' : 'portfolio average CO₂'}</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground tabular-nums">{airHealth ? `${airHealth.healthy} / ${airHealth.total}` : '—'}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{language === 'it' ? 'siti in aria salubre oggi' : 'sites in healthy air today'}</div>
                  </div>
                </div>
                <span className="mt-8 text-xs text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-widest">{language === 'it' ? 'Apri la vista aria →' : 'Open the air view →'}</span>
              </button>
            </div>

            {/* ========== Chart 1: Efficiency vs Comfort Scatter (LEGACY: spento) ========== */}
            {LEGACY_SCATTER && showScatter && (
              <div className="glass-panel rounded-2xl p-5 h-full min-h-0 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-lg font-semibold text-foreground uppercase tracking-wider">
                    {t('brand.efficiency_vs_comfort')}
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 font-medium">LIVE</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('brand.scatter_subtitle')}
                </p>
                {/* Quadrant legend */}
                <div className="flex flex-wrap gap-3 mb-4">
                  {[
                    { color: 'bg-emerald-500', label: t('brand.best_performer') },
                    { color: 'bg-yellow-500', label: t('brand.health_risk') },
                    { color: 'bg-orange-500', label: t('brand.energy_waste') },
                    { color: 'bg-red-500', label: t('brand.critical') },
                  ].map(q => (
                    <div key={q.label} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${q.color}`} />
                      <span className="text-xs text-muted-foreground">{q.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-h-0">
                  <ZoomableChart width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 15, left: 5, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis 
                        type="number" dataKey="kwh" name="kWh" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 14 }} 
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        label={{ value: 'kWh (30d)', position: 'insideBottom', offset: -8, style: { fill: 'hsl(var(--muted-foreground))', fontSize: 14 } }}
                      />
                      <YAxis 
                        type="number" dataKey="co2" name="CO₂ (ppm)" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 14 }} 
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        label={{ value: 'CO₂ ppm', angle: -90, position: 'insideLeft', offset: 10, style: { fill: 'hsl(var(--muted-foreground))', fontSize: 14 } }}
                      />
                      <ReferenceLine x={scatterMedians.medianKwh} stroke="hsl(var(--muted-foreground) / 0.4)" strokeDasharray="4 4" />
                      <ReferenceLine y={scatterMedians.medianCo2} stroke="hsl(var(--muted-foreground) / 0.4)" strokeDasharray="4 4" />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="glass-panel rounded-lg p-3 text-sm border border-foreground/10">
                              <p className="font-semibold text-foreground mb-1.5">{d.name}</p>
                              
                              {/* Sostituzione Energia con icona Zap */}
                              <p className="text-muted-foreground flex items-center gap-1.5 py-0.5">
                                <Zap className="w-3.5 h-3.5 text-amber-500 inline-block shrink-0" aria-hidden="true" /> 
                                <span>{(d.kwh / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MWh</span>
                              </p>
                              
                              {/* Sostituzione Aria con icona Wind */}
                              <p className="text-muted-foreground flex items-center gap-1.5 py-0.5">
                                <Wind className="w-3.5 h-3.5 text-blue-500 inline-block shrink-0" aria-hidden="true" /> 
                                <span>{d.co2} ppm CO₂</span>
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={scatterData} shape="circle">
                        {scatterData.map((entry, idx) => (
                          <Cell key={idx} fill={getQuadrantColor(entry.kwh, entry.co2)} r={10} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ZoomableChart>
                </div>
              </div>
            )}

            {/* ========== Chart 2: Horizontal Leaderboards ========== */}
            {showLeaderboards && (
              <div className="glass-panel rounded-2xl p-5 h-full min-h-0 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-lg font-semibold text-foreground uppercase tracking-wider">
                    {t('brand.site_leaderboard')}
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 font-medium">LIVE</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('brand.leaderboard_subtitle')}
                </p>
                <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
                  {/* Energy leaderboard */}
                  {filterEnergy && energyLeaderboard.length > 0 && (
                    <div className="flex flex-col min-h-0">
                      <p className="text-base text-muted-foreground uppercase tracking-wider mb-3 font-medium flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-amber-500 shrink-0" /> {t('brand.energy_consumption_label')}
                      </p>
                      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-2.5">
                          {(showAllEnergyRank ? energyLeaderboard : energyLeaderboard.slice(0, 10)).map((s, i) => {
                            const maxVal = energyLeaderboard[0]?.value || 1;
                            const pct = (s.value / maxVal) * 100;
                            const barColor = pct > 80 ? 'bg-red-500/70' : pct > 50 ? 'bg-yellow-500/70' : 'bg-emerald-500/70';
                            return (
                              <div key={i} className={`group ${onOpenSite ? 'cursor-pointer' : ''}`} onClick={() => onOpenSite?.(s.siteId)}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm text-foreground truncate max-w-[140px] group-hover:underline" title={s.name}>{s.name}</span>
                                  <span className="text-sm font-semibold text-foreground tabular-nums ml-2">{(s.value / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-muted-foreground font-normal text-xs">MWh</span></span>
                                </div>
                                <div className="w-full h-2 bg-foreground/5 rounded-full overflow-hidden">
                                  <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {energyLeaderboard.length > 10 && (
                            <button
                              onClick={() => setShowAllEnergyRank(v => !v)}
                              className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors"
                            >
                              {showAllEnergyRank
                                ? (language === 'it' ? 'Mostra meno' : 'Show less')
                                : (language === 'it' ? `Vedi tutti (${energyLeaderboard.length})` : `See all (${energyLeaderboard.length})`)}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Air leaderboard */}
                  {filterAir && airLeaderboard.length > 0 && (
                    <div className="flex flex-col min-h-0">
                      <p className="text-base text-muted-foreground uppercase tracking-wider mb-3 font-medium flex items-center gap-1.5">
                        <Wind className="w-4 h-4 text-blue-500 shrink-0" /> {t('brand.air_quality_co2')}
                      </p>
                      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                        <div className="space-y-2.5">
                          {(showAllAirRank ? airLeaderboard : airLeaderboard.slice(0, 10)).map((s, i) => {
                            const maxVal = airLeaderboard[0]?.value || 1;
                            const pct = (s.value / maxVal) * 100;
                            const barColor = s.value > 1000 ? 'bg-red-500/70' : s.value > 600 ? 'bg-yellow-500/70' : 'bg-emerald-500/70';
                            return (
                              <div key={i} className={`group ${onOpenSite ? 'cursor-pointer' : ''}`} onClick={() => onOpenSite?.(s.siteId)}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm text-foreground truncate max-w-[140px] group-hover:underline" title={s.name}>{s.name}</span>
                                  <span className="text-sm font-semibold text-foreground tabular-nums ml-2">{s.value.toLocaleString()} <span className="text-muted-foreground font-normal text-xs">ppm</span></span>
                                </div>
                                <div className="w-full h-2 bg-foreground/5 rounded-full overflow-hidden">
                                  <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {airLeaderboard.length > 10 && (
                            <button
                              onClick={() => setShowAllAirRank(v => !v)}
                              className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors"
                            >
                              {showAllAirRank
                                ? (language === 'it' ? 'Mostra meno' : 'Show less')
                                : (language === 'it' ? `Vedi tutti (${airLeaderboard.length})` : `See all (${airLeaderboard.length})`)}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ========== Chart 3: System Health Matrix ========== */}
            {showHealthMatrix && (
              <div className="glass-panel rounded-2xl p-5 h-full min-h-0 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-lg font-semibold text-foreground uppercase tracking-wider">
                    {t('brand.system_health')}
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 font-medium">LIVE</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('brand.health_subtitle')}
                </p>
                {/* Legend */}
                <div className="flex items-center gap-4 mb-4">
                  {[
                    { color: 'bg-emerald-500/80', label: t('brand.ok') },
                    { color: 'bg-yellow-500/80', label: t('brand.warning') },
                    { color: 'bg-red-500/80', label: t('brand.critical') },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                      <span className="text-xs text-muted-foreground">{l.label}</span>
                    </div>
                  ))}
                </div>
                {/* Header */}
                <div className="grid grid-cols-[1fr_70px_70px_70px] gap-2 mb-2 px-1 shrink-0 items-center">
                  <span className="text-xs text-muted-foreground uppercase font-medium">{t('brand.site')}</span>
                  {filterEnergy && <span className="flex justify-center"><Zap className="w-4 h-4 text-muted-foreground" /></span>}
                  {!filterEnergy && <span />}
                  {filterAir && <span className="flex justify-center"><Wind className="w-4 h-4 text-muted-foreground" /></span>}
                  {!filterAir && <span />}
                  <span className="text-lg text-muted-foreground uppercase text-center">⚠️</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-1">
                    {healthMatrixData.map((site, i) => (
                      /* Spec Q4: offline/stale inclusi ma attenuati; la cella
                         energia mostra lo scostamento dalla PROPRIA baseline
                         (media 30gg vs 90gg), non un kWh assoluto. */
                      <div key={i} onClick={() => onOpenSite?.(site.siteId)} className={`grid grid-cols-[1fr_70px_70px_70px] gap-2 items-center py-1.5 px-1 rounded-lg hover:bg-foreground/5 transition-colors ${site.state !== 'online' ? 'opacity-55' : ''} ${onOpenSite ? 'cursor-pointer' : ''}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Circle className={`w-2.5 h-2.5 fill-current shrink-0 ${DIR_STATE_META[site.state].dot}`} />
                          <span className="text-sm text-foreground truncate" title={site.name}>{site.name}</span>
                        </div>
                        {filterEnergy ? (
                          <div className={`rounded-md py-1.5 text-center ${healthStatusColors[site.energy.status]}`} title={site.energy.kwh != null ? `${Math.round(site.energy.kwh)} kWh / 30gg` : undefined}>
                            <span className="text-xs font-semibold text-foreground">
                              {site.energy.value !== null ? `${site.energy.value > 0 ? '+' : ''}${site.energy.value}%` : '—'}
                            </span>
                          </div>
                        ) : <div className="rounded-md py-1.5 bg-muted/20" />}
                        {filterAir ? (
                          <div className={`rounded-md py-1.5 text-center ${healthStatusColors[site.air.status]}`}>
                            <span className="text-xs font-semibold text-foreground">
                              {site.air.value !== null && site.air.value > 0 ? site.air.value : '—'}
                            </span>
                          </div>
                        ) : <div className="rounded-md py-1.5 bg-muted/20" />}
                        <div className={`rounded-md py-1.5 text-center ${healthStatusColors[site.alerts.status]}`}>
                          <span className="text-xs font-semibold text-foreground">
                            {site.alerts.value}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ========== Chart 4: Store Directory ========== */}
            <div className="glass-panel rounded-2xl p-5 h-full min-h-0 flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-muted-foreground" />
                <h4 className="text-lg font-semibold text-foreground uppercase tracking-wider">
                  {t('brand.site_directory')}
                </h4>
              </div>
              {/* Spec Q5: sottotitolo riconciliabile + filtro rapido per stato.
                  Il numero di pillole "Online" e il KPI SITES ONLINE derivano
                  dalla stessa definizione (lettura < 60 min): coincidono per
                  costruzione. */}
              <p className="text-sm text-muted-foreground mb-2 shrink-0">
                {`${storeDirectory.length} ${language === 'it' ? 'siti' : 'sites'} · ${totals.sitesMonitored} ${language === 'it' ? 'monitorati' : 'monitored'} · ${totals.sitesOnline} online`}
              </p>
              <div className="flex items-center gap-1.5 mb-3 shrink-0 flex-wrap">
                {(['all', 'online', 'offline', 'stale', 'not_installed'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setDirFilter(f)}
                    className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                      dirFilter === f
                        ? 'border-foreground/40 bg-foreground/10 text-foreground font-semibold'
                        : 'border-foreground/10 text-muted-foreground hover:bg-foreground/5'
                    }`}
                  >
                    {DIR_STATE_META[f].label[language === 'it' ? 'it' : 'en']}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-1">
                  {storeDirectory
                    .filter(site => dirFilter === 'all' || site.state === dirFilter)
                    .map((site, i) => {
                      const meta = DIR_STATE_META[site.state];
                      return (
                        <div key={i} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-foreground/5 transition-colors">
                          <Circle className={`w-3 h-3 fill-current shrink-0 ${meta.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{site.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {site.city} · {site.region}
                              {/* Contesto delle aspettative: cosa e' monitorato qui */}
                              {site.state !== 'not_installed' && (
                                <span className="ml-1.5 opacity-70">
                                  {[site.capabilities.energy && '⚡', site.capabilities.air && '☁', site.capabilities.water && '💧'].filter(Boolean).join(' ')}
                                </span>
                              )}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full border font-medium ${meta.pill}`}>
                            {meta.label[language === 'it' ? 'it' : 'en']}
                          </span>
                        </div>
                      );
                    })}
                  {storeDirectory.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {language === 'it' ? 'Nessun sito disponibile' : 'No sites available'}
                    </p>
                  )}
                </div>
              </div>
            </div>

          </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Mobile: Collapsible summary + Detail Drawer */}
      {/* ============================================================ */}
      <div className="md:hidden fixed bottom-20 left-2 right-2 z-30 pointer-events-auto">
        <div className="glass-panel rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {displayEntity.logo ? (
                <img src={displayEntity.logo} alt={displayEntity.name} className="h-5 object-contain" />
              ) : (
                <span className="text-xs font-bold text-foreground">{displayEntity.name.substring(0, 2).toUpperCase()}</span>
              )}
              <span className="text-xs font-semibold text-foreground">{displayEntity.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setMobileDrawerOpen(true)} className="p-1.5 rounded-lg bg-fgb-accent/20 hover:bg-fgb-accent/30 border border-fgb-accent/30 transition-colors">
                <LayoutList className="w-4 h-4 text-fgb-accent" />
              </button>
              <button onClick={() => setChartsExpanded(!chartsExpanded)} className="p-1.5 rounded-lg bg-foreground/10 hover:bg-foreground/20">
                {chartsExpanded ? <ChevronDown className="w-4 h-4 text-foreground" /> : <ChevronUp className="w-4 h-4 text-foreground" />}
              </button>
            </div>
          </div>
          {chartsExpanded && (
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              <div className="text-center p-1.5 rounded-lg bg-foreground/5 border border-foreground/10">
                <div className="text-base font-bold text-foreground">{hasRealData ? `${totals.sitesOnline} / ${totals.sitesMonitored}` : "—"}</div>
                <div className="text-[10px] uppercase text-muted-foreground">{t('brand.sites_online')}</div>
              </div>
              <div className={`text-center p-1.5 rounded-lg bg-foreground/5 border border-foreground/10 ${!filterEnergy ? 'opacity-30 grayscale' : ''}`}>
                <div className="text-base font-bold text-foreground">{filterEnergy && hasRealData && totals.monthlyEnergyKwh > 0 ? (totals.monthlyEnergyKwh / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}</div>
                <div className="text-[10px] uppercase text-muted-foreground">MWh (30d)</div>
              </div>
              <div className={`text-center p-1.5 rounded-lg bg-foreground/5 border border-foreground/10 ${!filterAir ? 'opacity-30 grayscale' : ''}`}>
                <div className="text-base font-bold text-foreground">{filterAir && hasRealData && totals.avgCo2 > 0 ? totals.avgCo2 : '—'}</div>
                <div className="text-[10px] uppercase text-muted-foreground">CO₂</div>
              </div>
              <div className="text-center p-1.5 rounded-lg bg-foreground/5 border border-foreground/10">
                <div className="text-base font-bold text-foreground">
                  {hasRealData && (totals.alertsCritical + totals.alertsWarning) > 0 
                    ? <span className={totals.alertsCritical > 0 ? 'text-destructive' : 'text-yellow-500'}>{totals.alertsCritical + totals.alertsWarning}</span> 
                    : '0'}
                </div>
                <div className="text-[10px] uppercase text-muted-foreground">{t('brand.active_alerts')}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Detail Drawer */}
      <Drawer open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
        <DrawerContent className="max-h-[90dvh] border-t border-foreground/10" style={{ background: 'rgba(10, 15, 25, 0.95)', backdropFilter: 'blur(24px)' }}>
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="text-foreground flex items-center gap-2">
              {displayEntity.logo ? (
                <img src={displayEntity.logo} alt={displayEntity.name} className="h-6 object-contain" />
              ) : null}
              {displayEntity.name}
            </DrawerTitle>
            <DrawerDescription className="text-muted-foreground">
              {brand ? t('brand.brand_overview') : t('brand.holding_overview')}
            </DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="flex-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ maxHeight: 'calc(90dvh - 100px)' }}>
            <div className="space-y-6 pb-6">

              {/* Energy Leaderboard */}
              {filterEnergy && energyLeaderboard.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><Zap className="w-4 h-4 text-amber-500 shrink-0" /> {t('brand.energy_leaderboard')}</h4>
                  <div className="space-y-2">
                    {energyLeaderboard.map((s, i) => {
                      const maxVal = energyLeaderboard[0]?.value || 1;
                      const pct = (s.value / maxVal) * 100;
                      const barColor = pct > 80 ? 'bg-red-500/70' : pct > 50 ? 'bg-yellow-500/70' : 'bg-emerald-500/70';
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-foreground truncate max-w-[180px]">{s.name}</span>
                            <span className="text-xs font-semibold text-foreground tabular-nums">{(s.value / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MWh</span>
                          </div>
                          <div className="w-full h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Air Leaderboard */}
              {filterAir && airLeaderboard.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><Wind className="w-4 h-4 text-blue-500 shrink-0" /> {t('brand.co2_leaderboard')}</h4>
                  <div className="space-y-2">
                    {airLeaderboard.map((s, i) => {
                      const maxVal = airLeaderboard[0]?.value || 1;
                      const pct = (s.value / maxVal) * 100;
                      const barColor = s.value > 1000 ? 'bg-red-500/70' : s.value > 600 ? 'bg-yellow-500/70' : 'bg-emerald-500/70';
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-foreground truncate max-w-[180px]">{s.name}</span>
                            <span className="text-xs font-semibold text-foreground tabular-nums">{s.value.toLocaleString()} ppm</span>
                          </div>
                          <div className="w-full h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Health Matrix (mobile list format) */}
              {showHealthMatrix && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">🏥 {t('brand.system_health_short')}</h4>
                  <div className="space-y-1.5">
                    {healthMatrixData.map((site, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-foreground/5 border border-foreground/5">
                        <Circle className={`w-2 h-2 fill-current shrink-0 ${site.isOnline ? 'text-emerald-500' : 'text-red-400'}`} />
                        <span className="text-xs text-foreground flex-1 truncate">{site.name}</span>
                        <div className="flex items-center gap-1">
                          {filterEnergy && <div className={`w-5 h-5 rounded ${healthStatusColors[site.energy.status]} flex items-center justify-center`}><Zap className="w-3 h-3 text-foreground" /></div>}
                          {filterAir && <div className={`w-5 h-5 rounded ${healthStatusColors[site.air.status]} flex items-center justify-center`}><Wind className="w-3 h-3 text-foreground" /></div>}
                          <div className={`w-5 h-5 rounded ${healthStatusColors[site.alerts.status]} flex items-center justify-center`}><span className="text-[8px] font-bold text-foreground">⚠</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Store Directory */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3">🏢 {t('brand.site_directory')} ({storeDirectory.length})</h4>
                <div className="space-y-1">
                  {storeDirectory.map((site, i) => {
                    const meta = DIR_STATE_META[site.state];
                    return (
                      <div key={i} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-foreground/5">
                        <Circle className={`w-2.5 h-2.5 fill-current shrink-0 ${meta.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground truncate">{site.name}</p>
                          <p className="text-[10px] text-muted-foreground">{site.city} · {site.region}</p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${meta.pill}`}>
                          {meta.label[language === 'it' ? 'it' : 'en']}
                        </span>
                      </div>
                    );
                  })}
                  {storeDirectory.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {language === 'it' ? 'Nessun sito disponibile' : 'No sites available'}
                    </p>
                  )}
                </div>
              </div>

            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default BrandOverlay;
