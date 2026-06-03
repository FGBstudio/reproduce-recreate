import { ReactNode } from 'react';
import { useAggregateWeeklyWrap } from '../hooks/useAggregateWeeklyWrap';
import SlideAggWelcome from '../slides/SlideAggWelcome';
import SlideAggTotals from '../slides/SlideAggTotals';
import SlideAggCO2 from '../slides/SlideAggCO2';
import SlideAggLeaderboard from '../slides/SlideAggLeaderboard';
import SlideAggMostImproved from '../slides/SlideAggMostImproved';
import SlideAggRecap from '../slides/SlideAggRecap';

interface SiteInput { id: string; name: string; region?: string | null; brandName?: string | null; areaM2?: number | null; }

interface Args {
  label: string;
  sites: SiteInput[];
  onDownload: () => void;
  isDownloading: boolean;
}

export function useAggregateSlides({ label, sites, onDownload, isDownloading }: Args) {
  const { data, isLoading } = useAggregateWeeklyWrap(sites);

  if (isLoading || !data) return { slides: [] as ReactNode[], isLoading: true, isEmpty: false };

  const slides: ReactNode[] = [
    <SlideAggWelcome key="welcome" label={label} weekLabel={data.weekLabel} sitesCount={sites.length} />,
  ];
  if (data.totals.weekKwh > 0) slides.push(<SlideAggTotals key="totals" data={data} />);
  if (data.totals.savedKg > 0) slides.push(<SlideAggCO2 key="co2" data={data} />);
  if (data.leaderboard.length > 0) slides.push(<SlideAggLeaderboard key="leader" data={data} />);
  if (data.mostImproved.length > 0) slides.push(<SlideAggMostImproved key="improved" data={data} />);
  slides.push(
    <SlideAggRecap key="recap" data={data} label={label} onDownload={onDownload} isDownloading={isDownloading} />
  );

  return { slides, isLoading: false, isEmpty: data.totals.sitesWithData === 0 };
}