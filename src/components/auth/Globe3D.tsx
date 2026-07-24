import React, { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";

const ACCENT = "#006367";

type GeoIP = { country_code?: string; latitude?: number; longitude?: number };

function countryToLatLng(cc?: string): { lat: number; lng: number } | null {
  if (!cc) return null;
  const c = cc.toUpperCase();
  const map: Record<string, { lat: number; lng: number }> = {
    IT: { lat: 41.9, lng: 12.5 }, FR: { lat: 46.2, lng: 2.2 }, DE: { lat: 51.1, lng: 10.4 },
    ES: { lat: 40.4, lng: -3.7 }, GB: { lat: 51.5, lng: -0.1 }, US: { lat: 39.8, lng: -98.6 },
    CA: { lat: 56.1, lng: -106.3 }, BR: { lat: -14.2, lng: -51.9 }, CN: { lat: 35.9, lng: 104.2 },
    JP: { lat: 36.2, lng: 138.3 }, SG: { lat: 1.35, lng: 103.8 }, AE: { lat: 23.4, lng: 53.8 },
    AU: { lat: -25.3, lng: 133.8 }, IN: { lat: 20.6, lng: 78.96 }, NL: { lat: 52.1, lng: 5.3 },
  };
  return map[c] || null;
}

const Globe3D: React.FC<{ size?: number }> = ({ size }) => {
  const globeRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 600 });
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => {
      const r = wrapRef.current!.getBoundingClientRect();
      const s = Math.min(r.width, r.height);
      setDims({ w: s, h: s });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    // initial camera + slow auto-rotate
    g.pointOfView({ lat: 30, lng: 10, altitude: 2.2 }, 0);
    const controls = g.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
      controls.enableZoom = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = localStorage.getItem("fgb_geoip");
        let data: GeoIP | null = cached ? JSON.parse(cached) : null;
        if (!data) {
          const res = await fetch("https://ipapi.co/json/");
          data = await res.json();
          if (data) localStorage.setItem("fgb_geoip", JSON.stringify(data));
        }
        if (cancelled || !data) return;
        const target =
          (typeof data.latitude === "number" && typeof data.longitude === "number"
            ? { lat: data.latitude, lng: data.longitude }
            : countryToLatLng(data.country_code)) || null;
        if (!target) return;
        setPin(target);
        setTimeout(() => {
          const g = globeRef.current;
          if (!g) return;
          const controls = g.controls();
          if (controls) controls.autoRotate = false;
          g.pointOfView({ lat: target.lat, lng: target.lng, altitude: 1.8 }, 2200);
        }, 900);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pointsData = useMemo(() => (pin ? [pin] : []), [pin]);
  const ringsData = useMemo(() => (pin ? [pin] : []), [pin]);

  return (
    <div
      ref={wrapRef}
      className="w-full h-full flex items-center justify-center"
      style={size ? { width: size, height: size } : undefined}
    >
      <Globe
        ref={globeRef}
        width={dims.w}
        height={dims.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        showAtmosphere
        atmosphereColor={ACCENT}
        atmosphereAltitude={0.18}
        pointsData={pointsData}
        pointLat={(d: any) => d.lat}
        pointLng={(d: any) => d.lng}
        pointColor={() => "#ffffff"}
        pointAltitude={0.02}
        pointRadius={0.6}
        ringsData={ringsData}
        ringLat={(d: any) => d.lat}
        ringLng={(d: any) => d.lng}
        ringColor={() => (t: number) => `rgba(0,99,103,${1 - t})`}
        ringMaxRadius={5}
        ringPropagationSpeed={2}
        ringRepeatPeriod={1200}
      />
    </div>
  );
};

export default Globe3D;