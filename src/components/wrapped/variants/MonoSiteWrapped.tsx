import { ReactNode } from 'react';
import { useSiteMonthlyWrap } from '../hooks/useSiteMonthlyWrap';
import SlideWelcome from '../slides/SlideWelcome';
import SlideScore from '../slides/SlideScore';
import SlideEnergy from '../slides/SlideEnergy';
import SlideAir from '../slides/SlideAir';
import SlideAlerts from '../slides/SlideAlerts';
import SlidePeerBenchmark from '../slides/SlidePeerBenchmark';
import SlideFun from '../slides/SlideFun';
import SlideArchetype from '../slides/SlideArchetype';
import SlideTreedom from '../slides/SlideTreedom';
import SlideIdentity from '../slides/SlideIdentity';
import SlideRecap from '../slides/SlideRecap';

interface Args {
  siteId: string;
  siteName: string;
  areaM2: number | null | undefined;
  onDownload: () => void;
  isDownloading: boolean;
}

export function useMonoSiteSlides({ siteId, siteName, areaM2, onDownload, isDownloading }: Args): {
  slides: ReactNode[]; isLoading: boolean; isEmpty: boolean;
} {
  const { data, isLoading } = useSiteMonthlyWrap(siteId, areaM2);

  if (isLoading || !data) return { slides: [], isLoading: true, isEmpty: false };

  // Score uses the same dashboard formula on weekly averages — keeps the
  // Wrap number in sync with the FGB score shown in the OverviewSection.
  const score = data.siteScore;

  const slides: ReactNode[] = [
    <SlideWelcome key="welcome" siteName={siteName} weekLabel={data.monthLabel} badge="FGB Wrapped" />,
  ];

  if (score != null) {
    slides.push(
      <SlideScore
        key="score"
        score={score}
        yoy={data.energy.yoyKwh != null ? {
          label: data.prevYearMonthLabel,
          kwh: data.energy.yoyKwh,
          deltaPct: data.energy.yoyDeltaPct,
        } : null}
      />
    );
  }
  if (data.energy.weekKwh != null) slides.push(<SlideEnergy key="energy" data={data} />);
  if (data.peer && data.peer.total >= 2) {
    slides.push(<SlidePeerBenchmark key="peer" data={data} />);
  }
  if (
    data.hasAirDevices ||
    data.air.avgCo2Ppm != null ||
    data.air.hoursExcellent != null ||
    (data.air.perMetric && data.air.perMetric.length > 0)
  ) {
    slides.push(<SlideAir key="air" data={data} />);
  }
  // Always show alerts slide for mono-site — even "all clear" is a meaningful story.
  slides.push(<SlideAlerts key="alerts" data={data} />);
  if ((data.energy.monthKwh ?? data.energy.weekKwh ?? 0) > 0) {
    slides.push(<SlideFun key="fun" data={data} seed={`${siteId}-${data.monthLabel}`} />);
  }
  if (data.energy.archetype) {
    slides.push(<SlideArchetype key="archetype" data={data} />);
  }
  slides.push(<SlideTreedom key="trees" data={data} />);
  slides.push(<SlideIdentity key="identity" score={score} />);
  slides.push(
    <SlideRecap key="recap" data={data} siteName={siteName} onDownload={onDownload} isDownloading={isDownloading} />
  );

  return { slides, isLoading: false, isEmpty: !data.hasAnyData };
}