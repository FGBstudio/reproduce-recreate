import { ReactNode } from 'react';
import { useAggregateWeeklyWrap } from '../hooks/useAggregateWeeklyWrap';
import SlideGlobalWelcome from '../slides/SlideGlobalWelcome';
import SlideGlobalRegions from '../slides/SlideGlobalRegions';
import SlideGlobalImpact from '../slides/SlideGlobalImpact';
import SlideGlobalLeaderboard from '../slides/SlideGlobalLeaderboard';
import SlideGlobalRecap from '../slides/SlideGlobalRecap';

interface SiteInput { id: string; name: string; region?: string | null; brandName?: string | null; areaM2?: number | null; }

interface Args {
  sites: SiteInput[];
  onDownload: () => void;
  isDownloading: boolean;
}

export function useAdminGlobalSlides({ sites, onDownload, isDownloading }: Args) {
  const { data, isLoading } = useAggregateWeeklyWrap(sites);

  if (isLoading || !data) return { slides: [] as ReactNode[], isLoading: true, isEmpty: false };

  const slides: ReactNode[] = [
    <SlideGlobalWelcome key="welcome" weekLabel={data.weekLabel} sitesCount={sites.length} />,
  ];
  if (Object.keys(data.byRegion).length > 0 && data.totals.weekKwh > 0) {
    slides.push(<SlideGlobalRegions key="regions" data={data} />);
  }
  if (data.totals.savedKg > 0) slides.push(<SlideGlobalImpact key="impact" data={data} />);
  const hasBrandRanking = data.sites.some(s => s.brandName);
  if (hasBrandRanking) slides.push(<SlideGlobalLeaderboard key="leader" data={data} />);
  slides.push(
    <SlideGlobalRecap key="recap" data={data} onDownload={onDownload} isDownloading={isDownloading} />
  );

  return { slides, isLoading: false, isEmpty: data.totals.sitesWithData === 0 };
}