import React from "react";
import { COMPANY_STATS } from "@/lib/companyStats";

const CITIES = [
  "AIX-EN-PROVENCE",
  "AMSTERDAM",
  "DUBAI",
  "HO CHI MINH",
  "LOANO",
  "LONDON",
  "LOS ANGELES",
  "MIAMI",
  "MILAN",
  "NEW YORK",
  "PARIS",
  "ROME",
  "SHANGHAI",
  "SINGAPORE",
  "TAICHUNG",
  "TOKYO",
];

const ACCENT = "#006367";
const SUB = "#86868b";
const INK = "#1d1d1f";

/** Interleave company stats every N cities so the ticker carries both
 *  the geographic footprint and the institutional numbers in one flow. */
const buildSequence = () => {
  const seq: Array<{ kind: "city"; label: string } | { kind: "stat"; value: string; label: string }> = [];
  const stats = [...COMPANY_STATS];
  CITIES.forEach((c, i) => {
    seq.push({ kind: "city", label: c });
    if ((i + 1) % 5 === 0 && stats.length) {
      const s = stats.shift()!;
      seq.push({ kind: "stat", value: s.value, label: s.label.toUpperCase() });
    }
  });
  // Any remaining stats go at the end
  stats.forEach((s) => seq.push({ kind: "stat", value: s.value, label: s.label.toUpperCase() }));
  return seq;
};

const SEQUENCE = buildSequence();

const Row: React.FC = () => (
  <div className="flex shrink-0 items-center gap-10 pr-10">
    {SEQUENCE.map((item, idx) =>
      item.kind === "city" ? (
        <span
          key={`c-${idx}`}
          className="text-[11px] font-semibold uppercase tracking-[0.35em] whitespace-nowrap"
          style={{ color: SUB }}
        >
          {item.label}
          <span className="ml-10" style={{ color: ACCENT }}>·</span>
        </span>
      ) : (
        <span
          key={`s-${idx}`}
          className="inline-flex items-baseline gap-2 whitespace-nowrap"
        >
          <span className="text-[13px] font-bold tracking-tight" style={{ color: ACCENT }}>
            {item.value}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: INK }}>
            {item.label}
          </span>
          <span className="ml-10" style={{ color: ACCENT }}>·</span>
        </span>
      )
    )}
  </div>
);

const CityTicker: React.FC = () => {
  return (
    <div
      className="w-full overflow-hidden py-4 border-y border-black/[0.06] bg-white"
      aria-label="Cities where FGB operates"
    >
      <style>{`
        @keyframes fgb-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .fgb-marquee-track { animation: fgb-marquee 45s linear infinite; }
        .fgb-marquee-wrap:hover .fgb-marquee-track { animation-play-state: paused; }
      `}</style>
      <div className="fgb-marquee-wrap flex w-full">
        <div className="fgb-marquee-track flex w-max">
          <Row />
          <Row />
        </div>
      </div>
    </div>
  );
};

export default CityTicker;