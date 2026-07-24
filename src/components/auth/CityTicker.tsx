import React from "react";

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

const Row: React.FC = () => (
  <div className="flex shrink-0 items-center gap-10 pr-10">
    {CITIES.map((c) => (
      <span
        key={c}
        className="text-[11px] font-semibold uppercase tracking-[0.35em] whitespace-nowrap"
        style={{ color: SUB }}
      >
        {c}
        <span className="ml-10" style={{ color: ACCENT }}>·</span>
      </span>
    ))}
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