/**
 * Report di monitoraggio FGB — generatore HTML (stampa A4 dal browser).
 *
 * Porta nel prodotto il generatore validato a mano su `report-reference.html`
 * (27/11/2026). Output in inglese, numeri en-GB, grafici SVG con attributi
 * SEMPRE quotati (il bug #1 era l'attributo non quotato prima di `/>`).
 *
 * Pura: dato un `ReportHtmlInput` restituisce una stringa HTML completa,
 * pronta per essere aperta in una finestra e stampata in PDF.
 */
import { REPORT_CSS } from "./reportCss";

export interface ReportDailyEnergy { d: number; v: number | null; hours: number }
export interface ReportDailyAir { d: number; avg: number | null; min: number | null; max: number | null; hours: number }
export interface ReportBand { in_band: number; below: number; above: number }

export interface ReportHtmlInput {
  site: { name: string; displayName?: string; address: string; areaM2: number | null; timezone: string; price: number; currency: string };
  year: number;
  month: number; // 1-12
  lastDay: number;
  nowDay: number;
  nowHour: number;
  energyDaily: ReportDailyEnergy[];
  /** metric key -> daily rows. Metriche attese: iaq.co2, env.temperature, env.humidity, iaq.voc, iaq.pm25, iaq.pm10 */
  airDaily: Record<string, ReportDailyAir[]>;
  /** metric key -> % in band / below / above (ore occupate) */
  band: Record<string, ReportBand>;
  /** URL del logo bianco (stessa origin). Default /whiteLogoPayoff.png */
  logo?: string;
}

interface Day {
  d: number; label: string; weekend: boolean; future: boolean; inProgress: boolean; empty: boolean;
  v: number | null; avg: number | null; min: number | null; max: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const nf = (v: number | null | undefined, dec = 0): string =>
  v == null || !isFinite(Number(v)) ? "–" : Number(v).toLocaleString("en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const diM = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const dow = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const isWe = (y: number, m: number, d: number) => { const w = dow(y, m, d); return w === 0 || w === 6; };
const MONTH_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const classOf = (s: number): [string, string] =>
  s >= 85 ? ["A", "Excellent"] : s >= 70 ? ["B", "Good"] : s >= 55 ? ["C", "Fair"] : s >= 40 ? ["D", "Poor"] : ["E", "Critical"];
const pillClass = (s: number) => (s >= 70 ? "ok" : s >= 55 ? "warn" : "crit");
const bandResult = (io: number): [string, string] => (io >= 90 ? ["Good", "ok"] : io >= 70 ? ["Verify", "warn"] : ["Caution", "crit"]);

// ---- SVG primitives (tutti gli attributi quotati) ----
const W = 700, X0 = 46, X1 = 694, BT = 120, PT = 14;
const niceCeil = (v: number): number => {
  if (!(v > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return s * mag;
};
const hatchDef = (id: string, col: string) =>
  `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#E6FAF0"/><line x1="0" y1="0" x2="0" y2="6" stroke="${col}" stroke-width="2.2"/></pattern></defs>`;
const roundBar = (x: number, y: number, w: number, fill: string) =>
  `<path d="M${x.toFixed(2)},${BT} L${x.toFixed(2)},${(y + 3).toFixed(2)} Q${x.toFixed(2)},${y.toFixed(2)} ${(x + 3).toFixed(2)},${y.toFixed(2)} L${(x + w - 3).toFixed(2)},${y.toFixed(2)} Q${(x + w).toFixed(2)},${y.toFixed(2)} ${(x + w).toFixed(2)},${(y + 3).toFixed(2)} L${(x + w).toFixed(2)},${BT} Z" fill="${fill}"/>`;

function barChart(
  s: Day[],
  opts: { fillFn: (b: Day) => string; threshold?: number; thresholdLabel?: string; avgLabel?: string; dec?: number; hatchId: string; hatchCol: string },
): string {
  const dec = opts.dec ?? 0;
  const vals = s.filter(b => !b.future && !b.empty && b.v != null).map(b => b.v as number);
  if (!vals.length) return `<div class="empty">No measurements in the period</div>`;
  const yMax = niceCeil(Math.max(...vals, opts.threshold || 0) * 1.12);
  const n = s.length, slot = (X1 - X0) / n, bw = Math.min(slot * 0.62, 16);
  const yOf = (v: number) => BT - (v / yMax) * (BT - PT);
  let out = `<svg class="chart" viewBox="0 0 ${W} 150">` + hatchDef(opts.hatchId, opts.hatchCol);
  for (let g = 0; g <= 2; g++) {
    const yv = (yMax * g) / 2, yy = yOf(yv).toFixed(2);
    out += `<line x1="${X0}" x2="${X1}" y1="${yy}" y2="${yy}" stroke="#E6EEEA" stroke-width="1"${g ? ' stroke-dasharray="3 3"' : ""}/><text x="${X0 - 6}" y="${(yOf(yv) + 3.5).toFixed(2)}" class="ax" text-anchor="end">${nf(yv, yMax >= 100 ? 0 : 1)}</text>`;
  }
  if (opts.threshold) { const ty = yOf(Math.min(opts.threshold, yMax)); out += `<rect x="${X0}" y="${PT}" width="${X1 - X0}" height="${Math.max(0, ty - PT).toFixed(2)}" fill="#8A1060" opacity="0.08"/>`; }
  s.forEach((b, i) => {
    const cx = X0 + slot * (i + 0.5);
    if (b.future || b.empty || b.v == null) { out += `<circle cx="${cx.toFixed(2)}" cy="${BT}" r="1.6" fill="#E6EEEA"/>`; return; }
    const y = yOf(b.v);
    out += roundBar(cx - bw / 2, y, bw, opts.fillFn(b));
  });
  out += `<line x1="${X0}" x2="${X1}" y1="${BT}" y2="${BT}" stroke="#E6EEEA" stroke-width="1"/>`;
  if (opts.threshold) { const ty = yOf(Math.min(opts.threshold, yMax)).toFixed(2); out += `<line x1="${X0}" x2="${X1}" y1="${ty}" y2="${ty}" stroke="#8A1060" stroke-width="1.2" stroke-dasharray="4 3"/><text x="${X1}" y="${(Number(ty) - 2).toFixed(2)}" class="thr" text-anchor="end">${opts.thresholdLabel}</text>`; }
  if (opts.avgLabel != null) {
    const w2 = s.filter(b => !b.weekend && !b.empty && !b.future && b.v != null).map(b => b.v as number);
    if (w2.length >= 2) { const av = w2.reduce((a, c) => a + c, 0) / w2.length, ay = yOf(av).toFixed(2); out += `<line x1="${X0}" x2="${X1}" y1="${ay}" y2="${ay}" stroke="#8A1060" stroke-width="1.2" stroke-dasharray="4 3"/><text x="${X1}" y="${(Number(ay) - 2).toFixed(2)}" class="thr" text-anchor="end">${opts.avgLabel} ${nf(av, dec)}</text>`; }
  }
  const step = n > 20 ? Math.ceil(n / 15) : 1;
  s.forEach((b, i) => { if (i % step && i !== n - 1) return; out += `<text x="${(X0 + slot * (i + 0.5)).toFixed(2)}" y="136" class="ax"${b.weekend ? ' fill="#2BB582"' : ""} text-anchor="middle">${b.d}</text>`; });
  return out + `</svg>`;
}

function lineChart(s: Day[], opts: { targetMin?: number; targetMax?: number; dec?: number }): string {
  const dec = opts.dec ?? 1;
  const pres = s.map((b, i) => ({ b, i })).filter(({ b }) => !b.future && !b.empty && b.avg != null);
  if (!pres.length) return `<div class="empty">No measurements in the period</div>`;
  const allV: number[] = [];
  pres.forEach(({ b }) => allV.push(b.avg as number, b.max as number, b.min as number));
  if (opts.targetMin != null) allV.push(opts.targetMin);
  if (opts.targetMax != null) allV.push(opts.targetMax);
  let lo = Math.min(...allV); let hi = Math.max(...allV); if (hi === lo) hi = lo + 1; const pd = (hi - lo) * 0.12; lo -= pd; hi += pd;
  const n = s.length, slot = (X1 - X0) / n;
  const xOf = (i: number) => X0 + slot * (i + 0.5), yOf = (v: number) => BT - ((v - lo) / (hi - lo)) * (BT - PT);
  let out = `<svg class="chart wide" viewBox="0 0 ${W} 150">`;
  if (opts.targetMin != null && opts.targetMax != null) {
    const yt = yOf(opts.targetMax), yb = yOf(opts.targetMin);
    out += `<rect x="${X0}" y="${yt.toFixed(2)}" width="${X1 - X0}" height="${(yb - yt).toFixed(2)}" fill="#E6FAF0"/><line x1="${X0}" x2="${X1}" y1="${yt.toFixed(2)}" y2="${yt.toFixed(2)}" stroke="#9FE0C3" stroke-dasharray="3 3"/><line x1="${X0}" x2="${X1}" y1="${yb.toFixed(2)}" y2="${yb.toFixed(2)}" stroke="#9FE0C3" stroke-dasharray="3 3"/>`;
  }
  for (let g = 0; g <= 2; g++) { const yv = lo + ((hi - lo) * g) / 2, yy = yOf(yv).toFixed(2); out += `<line x1="${X0}" x2="${X1}" y1="${yy}" y2="${yy}" stroke="#E6EEEA" stroke-width="1"${g ? ' stroke-dasharray="3 3"' : ""}/><text x="${X0 - 6}" y="${(yOf(yv) + 3.5).toFixed(2)}" class="ax" text-anchor="end">${nf(yv, dec)}</text>`; }
  pres.forEach(({ b, i }) => { const yt = yOf(b.max as number), yb = yOf(b.min as number); out += `<rect x="${(xOf(i) - slot * 0.42).toFixed(2)}" y="${yt.toFixed(2)}" width="${(slot * 0.84).toFixed(2)}" height="${Math.max(0.6, yb - yt).toFixed(2)}" fill="#2BB582" opacity="0.35"/>`; });
  for (let k = 1; k < pres.length; k++) { const a = pres[k - 1], c = pres[k]; if (c.i - a.i !== 1) continue; out += `<line x1="${xOf(a.i).toFixed(2)}" y1="${yOf(a.b.avg as number).toFixed(2)}" x2="${xOf(c.i).toFixed(2)}" y2="${yOf(c.b.avg as number).toFixed(2)}" stroke="#11624F" stroke-width="1.6"/>`; }
  pres.forEach(({ b, i }) => { out += `<circle cx="${xOf(i).toFixed(2)}" cy="${yOf(b.avg as number).toFixed(2)}" r="1.6" fill="#fff" stroke="#11624F" stroke-width="1"/>`; });
  out += `<line x1="${X0}" x2="${X1}" y1="${BT}" y2="${BT}" stroke="#E6EEEA" stroke-width="1"/>`;
  const step = n > 20 ? Math.ceil(n / 15) : 1;
  s.forEach((b, i) => { if (i % step && i !== n - 1) return; out += `<text x="${xOf(i).toFixed(2)}" y="136" class="ax"${b.weekend ? ' fill="#2BB582"' : ""} text-anchor="middle">${b.d}</text>`; });
  return out + `</svg>`;
}

const starPath = (cx: number, cy: number, r: number, fill: string | null, stroke?: string) => {
  const c = r * 0.11, f = (v: number) => v.toFixed(2);
  const d = `M${f(cx)},${f(cy - r)} Q${f(cx + c)},${f(cy - c)} ${f(cx + r)},${f(cy)} Q${f(cx + c)},${f(cy + c)} ${f(cx)},${f(cy + r)} Q${f(cx - c)},${f(cy + c)} ${f(cx - r)},${f(cy)} Q${f(cx - c)},${f(cy - c)} ${f(cx)},${f(cy - r)}Z`;
  return `<path d="${d}" fill="${fill || "none"}"${stroke ? ` stroke="${stroke}" stroke-width="2.2"` : ""}/>`;
};
function coverStars(): string {
  const cols = ["#F3C6CF", "#FFFFFF", "#1A8A8C", "#C5DEDE", "#7DB8B9"];
  let s = "";
  for (let r = 0; r < 3; r++) for (let i = 0; i < 17; i++) {
    const x = 20 + i * 46 + (r % 2) * 23, y = -10 + r * 46;
    if ((i + r) % 5 === 4) continue;
    s += starPath(x, y, 20, cols[(i * 2 + r) % cols.length]);
  }
  return `<svg class="band" viewBox="0 0 794 150" preserveAspectRatio="xMidYMin slice">${s}</svg>`;
}
const headStars = () => `<svg class="hstars" viewBox="0 0 140 50">${starPath(22, 26, 19, "#1A8A8C")}${starPath(50, 18, 15, "#F3C6CF")}${starPath(74, 30, 17, "#96103F")}${starPath(98, 16, 14, "#FFFFFF")}${starPath(120, 30, 12, null, "#C5DEDE")}</svg>`;

function scaleBar(score: number, onWhite: boolean): string {
  const segs: [string, number, number, string][] = [["E", 0, 40, "#C6162A"], ["D", 40, 55, "#E06C2A"], ["C", 55, 70, "#E0A526"], ["B", 70, 85, "#2BB582"], ["A", 85, 100, "#11624F"]];
  const bx = (v: number) => 11 + (v / 100) * 498;
  let s = `<svg class="ibar" viewBox="0 0 520 66">`;
  segs.forEach(([l, a, b, c]) => {
    const active = score >= a && score < (b === 100 ? 101 : b);
    const x = bx(a).toFixed(1), w = (bx(b) - bx(a)).toFixed(1);
    const fill = onWhite ? c : "#FFFFFF", op = active ? 1 : onWhite ? 0.22 : 0.16;
    const txt = active ? (onWhite ? "#fff" : "#0A6367") : onWhite ? c : "#FFFFFF";
    s += `<rect x="${x}" y="30" width="${w}" height="16" rx="3" fill="${fill}" fill-opacity="${op}"/><text x="${(bx(a) + (bx(b) - bx(a)) / 2).toFixed(1)}" y="42" text-anchor="middle" class="sl" fill="${txt}">${l}</text><text x="${x}" y="62" class="sn2" fill="${onWhite ? "#7F7F7F" : "#C5DEDE"}" text-anchor="middle">${a}</text>`;
  });
  s += `<text x="510" y="62" class="sn2" fill="${onWhite ? "#7F7F7F" : "#C5DEDE"}" text-anchor="end">100</text>`;
  const mx = bx(score);
  s += `<path d="M${(mx - 7).toFixed(1)},12 L${(mx + 7).toFixed(1)},12 L${mx.toFixed(1)},26 Z" fill="${onWhite ? "#272727" : "#fff"}"/><text x="${mx.toFixed(1)}" y="9" text-anchor="middle" class="mk" fill="${onWhite ? "#272727" : "#fff"}">${score}</text></svg>`;
  return s;
}

const statusCell = (b: Day) => b.future ? `<span class="sd fu">Future</span>` : b.empty ? `<span class="sd off"><i></i>Offline</span>` : `<span class="sd on"><i></i>Online</span>`;
const kpi = (lab: string, val: string, unit: string, sub: string, cls = "") => `<div class="kpi ${cls}"><div class="kl">${lab}</div><div class="kv">${val}<span>${unit || ""}</span></div><div class="ks">${sub || ""}</div></div>`;

/** Costruisce il report HTML completo (6 pagine A4) dai dati del periodo. */
export function buildReportHtml(input: ReportHtmlInput): string {
  const { site } = input;
  const Y = input.year, M = input.month, lastDay = input.lastDay, nowDay = input.nowDay, nowHour = input.nowHour;
  const partial = nowDay < lastDay;
  const logo = input.logo || "/whiteLogoPayoff.png";

  const buildSeries = (rows: { d: number; v?: number | null; avg?: number | null; min?: number | null; max?: number | null; hours: number }[]): Day[] => {
    const byDay = new Map<number, typeof rows[number]>();
    rows.forEach(r => byDay.set(r.d, r));
    const arr: Day[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const r = byDay.get(d);
      const hours = r ? Number(r.hours) : 0;
      arr.push({
        d, label: `${pad(d)}/${pad(M)}`, weekend: isWe(Y, M, d),
        future: d > nowDay, inProgress: d === nowDay, empty: !r || hours === 0,
        v: r?.v ?? null, avg: r?.avg ?? null, min: r?.min ?? null, max: r?.max ?? null,
      });
    }
    return arr;
  };

  const energy = buildSeries(input.energyDaily);
  const AIR = ["iaq.co2", "env.temperature", "env.humidity", "iaq.voc", "iaq.pm25", "iaq.pm10"];
  const air: Record<string, Day[]> = {};
  AIR.forEach(m => { air[m] = buildSeries((input.airDaily[m] || []).map(r => ({ d: r.d, avg: r.avg, min: r.min, max: r.max, hours: r.hours }))); });

  const done = energy.filter(b => !b.future && !b.empty && b.v != null);
  const totKwh = done.reduce((a, b) => a + (b.v as number), 0);
  const price = Number(site.price) || 0;
  const cost = totKwh * price;
  const co2t = (totKwh * 0.233) / 1000;
  const area = site.areaM2;
  const intensity = area ? totKwh / area : null;
  const wd = done.filter(b => !b.weekend), we = done.filter(b => b.weekend);
  const wdAvg = wd.length ? wd.reduce((a, b) => a + (b.v as number), 0) / wd.length : null;
  const weAvg = we.length ? we.reduce((a, b) => a + (b.v as number), 0) / we.length : null;
  const peakDay = done.length ? Math.max(...done.map(b => b.v as number)) : null;
  const aAvg = (m: string) => { const a = air[m].filter(b => !b.future && !b.empty && b.avg != null); return a.length ? a.reduce((s, b) => s + (b.avg as number), 0) / a.length : null; };
  const aMax = (m: string) => { const a = air[m].filter(b => !b.future && !b.empty && b.max != null); return a.length ? Math.max(...a.map(b => b.max as number)) : null; };
  const aMin = (m: string) => { const a = air[m].filter(b => !b.future && !b.empty && b.min != null); return a.length ? Math.min(...a.map(b => b.min as number)) : null; };

  const bv = (m: string, k: keyof ReportBand) => Number(input.band[m]?.[k] ?? 0);
  const tIn = bv("env.temperature", "in_band"), hIn = bv("env.humidity", "in_band"), cIn = bv("iaq.co2", "in_band");
  const comfort = Math.round(0.35 * tIn + 0.25 * hIn + 0.4 * cIn);
  const idx = comfort;
  const [iCls, iJud] = classOf(idx);

  // allarmi
  const THR: Record<string, { w: number; c?: number; u: string; lab: string }> = {
    "iaq.co2": { w: 1000, c: 1500, u: "ppm", lab: "CO₂" }, "iaq.voc": { w: 300, u: "ppb", lab: "TVOC" },
    "iaq.pm25": { w: 15, u: "µg/m³", lab: "PM2.5" }, "iaq.pm10": { w: 25, u: "µg/m³", lab: "PM10" },
  };
  const alarms: { lab: string; day: string; peak: number; unit: string; sev: string; th: string }[] = [];
  Object.entries(THR).forEach(([m, t]) => air[m]?.forEach(b => {
    if (b.future || b.empty || b.max == null) return;
    if (b.max > t.w) { const crit = t.c != null && b.max > t.c; alarms.push({ lab: t.lab, day: b.label, peak: b.max, unit: t.u, sev: crit ? "crit" : "warn", th: crit ? `> ${nf(t.c)} ${t.u}` : `> ${nf(t.w)} ${t.u}` }); }
  }));
  alarms.sort((a, b) => b.peak - a.peak);
  const critN = alarms.filter(a => a.sev === "crit").length;
  const verifyN = alarms.length - critN;

  // ---- componenti tabellari ----
  const energyCol = (slice: Day[], withTotal: boolean) => {
    let rows = slice.map(b => `<tr class="${b.empty || b.future ? "mut" : ""}${b.weekend ? " we" : ""}"><td>${b.label}${b.weekend ? ' <span class="tg">WE</span>' : ""}</td><td class="r">${b.future || b.empty ? "–" : nf(b.v, 1)}</td><td>${statusCell(b)}</td></tr>`).join("");
    if (withTotal) rows += `<tr class="sum"><td>Period total</td><td class="r">${nf(totKwh, 1)}</td><td></td></tr>`;
    return `<table class="tbl dt"><tr><th>Day</th><th class="r">kWh</th><th>Status</th></tr>${rows}</table>`;
  };
  const airTable = () => {
    const cols: [string, string, string, number, number][] = [["iaq.co2", "CO₂", "ppm", 1000, 0], ["iaq.voc", "TVOC", "ppb", 300, 0], ["iaq.pm25", "PM2.5", "µg/m³", 15, 0], ["iaq.pm10", "PM10", "µg/m³", 25, 0]];
    const present = cols.filter(c => air[c[0]].some(b => !b.future && !b.empty));
    const head = `<th>Day</th>` + present.map(c => `<th class="r">${c[1]}<br><span class="u">${c[2]}</span></th>`).join("") + `<th>Status</th>`;
    let rows = "";
    for (let d = 0; d < lastDay; d++) {
      const b0 = air["iaq.co2"][d];
      const anyData = present.some(c => { const b = air[c[0]][d]; return !b.empty && !b.future; });
      const cls = ((b0.future || !anyData ? "mut" : "") + (b0.weekend ? " we" : "")).trim();
      let cells = `<td>${b0.label}${b0.weekend ? ' <span class="tg">WE</span>' : ""}</td>`;
      present.forEach(([m, , , thr, dec]) => {
        const b = air[m][d];
        const show = b.future || b.empty ? "–" : nf(b.avg, dec);
        const mag = !b.future && !b.empty && b.max != null && b.max > thr;
        cells += `<td class="r${mag ? " mag" : ""}">${show}</td>`;
      });
      cells += `<td>${statusCell(b0)}</td>`;
      rows += `<tr class="${cls}">${cells}</tr>`;
    }
    let mean = `<td>Period mean</td>`;
    present.forEach(([m, , , , dec]) => mean += `<td class="r">${nf(aAvg(m), dec)}</td>`);
    mean += `<td></td>`;
    rows += `<tr class="sum">${mean}</tr>`;
    return `<table class="tbl dt air"><tr>${head}</tr>${rows}</table>`;
  };
  const alarmsTable = () => {
    if (!alarms.length) return `<div class="empty">No threshold exceedances in the period.</div>`;
    const top = alarms.slice(0, 10);
    let rows = top.map(a => `<tr><td><span class="pill ${a.sev === "crit" ? "crit" : "warn"}"><i></i>${a.sev === "crit" ? "Caution" : "Verify"}</span></td><td>${a.lab}</td><td>${a.day}</td><td class="r">${nf(a.peak)} ${a.unit}</td><td>${esc(a.th)}</td></tr>`).join("");
    const summary = alarms.length > 10
      ? `Top 10 peaks shown · ${alarms.length} exceedances in the period: ${critN} Caution, ${verifyN} Verify.`
      : `${alarms.length} exceedances in the period: ${critN} Caution, ${verifyN} Verify.`;
    rows += `<tr class="sum"><td colspan="5">${summary}</td></tr>`;
    return `<table class="tbl dt"><tr><th>Level</th><th>Parameter</th><th>Day</th><th class="r">Peak value</th><th>Threshold</th></tr>${rows}</table>`;
  };

  const periodLabel = `${MONTH_EN[M - 1]} ${Y}`;
  const nameU = site.name.toUpperCase();
  const foot = (n: number) => `<footer class="pf"><span>${esc(nameU)} · MONITORING REPORT · ${periodLabel.toUpperCase()}</span><span>${n} / 6</span></footer>`;
  const header = () => `<header class="ph">${headStars()}<div class="pht"><b>${esc(nameU)}</b><br><span>Monitoring report · ${periodLabel}</span></div><img class="phl" src="${logo}"></header>`;
  const idxNote = `A ≥ 85 · B 70–84 · C 55–69 · D 40–54 · E &lt; 40. Categories that cannot be rated are excluded and their weight is redistributed: this index currently reflects Comfort only, until an energy target is set.`;
  const addr = esc(site.address || "—");
  const curr = site.currency || "EUR";

  let html = `<style>\n${REPORT_CSS}\n</style>\n`;

  // PAGE 1 — cover
  html += `<section class="page cover">${coverStars()}
<div class="cv"><div class="eyebrow">Monitoring report</div><h1>${esc(nameU)}</h1>
<div class="addr">${addr}</div>
<div class="per">${periodLabel}${partial ? "<span>month to date</span>" : ""}</div>
<div class="rng">01/${pad(M)}/${Y} 00:00 – ${pad(nowDay)}/${pad(M)}/${Y} ${pad(nowHour)}:00 · ${esc(site.timezone)}</div>
<div class="cidx"><div class="cil">FGB Site Index</div><div class="civ">${idx}<span>/ 100</span><em>${iCls} · ${iJud}</em></div>${scaleBar(idx, false)}
<div class="cis">Comfort &amp; air quality ${comfort} (${classOf(comfort)[0]}) · Energy — (target not yet set) · Water — (not monitored)</div></div></div>
<div class="cfoot"><img src="${logo}"><div class="web">FGB-studio.com</div>
<div class="cities">AIX-EN-PROVENCE | AMSTERDAM | DUBAI | LOANO | LONDON | MIAMI | MILAN | NEW YORK | PARIS | ROME | SHANGHAI | SINGAPORE | TOKYO</div>
<div class="gen">Generated on ${pad(nowDay)}/${pad(M)}/${Y} at ${pad(nowHour)}:00 · monitoring@fgb-studio.com</div></div></section>`;

  // PAGE 2 — Period summary
  html += `<section class="page">${header()}<main>
<div class="sec"><span class="sn">1</span><h2>Period summary</h2><p>Key figures for the reporting period.</p></div>
<div class="box"><div class="bh"><div><div class="bt">Site details</div></div></div><div class="bb"><table class="st">
<tr><th>Site</th><td>${esc(site.name)}</td><th>Period</th><td>01/${pad(M)}–${pad(nowDay)}/${pad(M)}/${Y}${partial ? ` · month to date, ${nowDay} of ${lastDay} days` : ""}</td></tr>
<tr><th>Floor area</th><td>${area ? nf(area) + " m²" : "—"}</td><th>Report type</th><td>Monthly · daily values</td></tr>
<tr><th>Time zone</th><td>${esc(site.timezone)}</td><th>Energy price</th><td>${nf(price, 2)} ${esc(curr)}/kWh</td></tr></table></div></div>
<div class="box"><div class="bh"><div><div class="bt">FGB Site Index</div><div class="bs">A–E scale, 0–100 · provisional</div></div></div><div class="bb">
<div style="display:flex;align-items:center;gap:4mm"><div style="font-size:28pt;font-weight:400;color:#11624F">${idx}<span style="font-size:9pt;color:#7F7F7F">/ 100</span></div><span class="pill ${pillClass(idx)}"><i></i>${iCls} · ${iJud}</span><div style="flex:1">${scaleBar(idx, true)}</div></div>
<table class="tbl"><tr><th style="width:26%">Category</th><th style="width:8%">Weight</th><th>Indicators</th><th class="r" style="width:10%">Score</th><th style="width:12%">Class</th></tr>
<tr><td>Comfort &amp; air quality</td><td>40 %</td><td>time in band: temperature ${tIn}% · humidity ${hIn}% · CO₂ ${cIn}%</td><td class="r"><b>${comfort}</b></td><td><span class="pill ${pillClass(comfort)}"><i></i>${classOf(comfort)[0]} · ${classOf(comfort)[1]}</span></td></tr>
<tr class="mut"><td>Energy</td><td>40 %</td><td>intensity ${nf(intensity, 2)} kWh/m² · <b>target not yet set</b></td><td class="r">—</td><td><span class="pill na"><i></i>not rated</span></td></tr>
<tr class="mut"><td>Water</td><td>20 %</td><td>meter installed, no data transmitted</td><td class="r">—</td><td><span class="pill na"><i></i>not monitored</span></td></tr></table>
<p class="note">${idxNote}</p></div></div>
<h3>Energy</h3><div class="kgrid">
${kpi("Energy use", nf(totKwh), "kWh", `${nowDay} days, month to date`, "big")}
${kpi("Estimated cost", nf(cost), curr === "EUR" ? "€" : esc(curr), `at ${nf(price, 2)} ${curr === "EUR" ? "€" : esc(curr)}/kWh`)}
${kpi("Emissions", nf(co2t, 2), "t CO₂eq", "location-based · 0.233 kg/kWh")}
${kpi("Intensity", nf(intensity, 2), "kWh/m²", "in the period")}</div>
<h3>Air quality &amp; comfort</h3><div class="kgrid">
${kpi("Avg temperature", nf(aAvg("env.temperature"), 1), "°C", `min ${nf(aMin("env.temperature"), 1)} · max ${nf(aMax("env.temperature"), 1)}`)}
${kpi("Avg humidity", nf(aAvg("env.humidity"), 0), "%", `below target band ${bv("env.humidity", "below")}% of occupied hours`, "warn")}
${kpi("Avg CO₂", nf(aAvg("iaq.co2"), 0), "ppm", `max ${nf(aMax("iaq.co2"), 0)} · above 1,000 ppm ${bv("iaq.co2", "above")}% of occupied hours`, "warn")}
${kpi("Avg TVOC", nf(aAvg("iaq.voc"), 0), "ppb", `max ${nf(aMax("iaq.voc"), 0)}`)}</div>
</main>${foot(2)}</section>`;

  // PAGE 3 — Energy
  const half = Math.ceil(lastDay / 2);
  html += `<section class="page">${header()}<main>
<div class="sec"><span class="sn">2</span><h2>Energy</h2><p>Daily consumption, site local time.</p></div>
<div class="box"><div class="bh"><div><div class="bt">Daily consumption</div><div class="bs">kWh · main meter</div></div><span class="tag">Daily</span></div><div class="bb">
${barChart(energy, { fillFn: b => b.inProgress ? "url(#he)" : b.weekend ? "#9FE0C3" : "#11624F", avgLabel: "weekday avg", dec: 0, hatchId: "he", hatchCol: "#11624F" })}
<div class="legend"><span><i style="background:#11624F"></i>weekday</span><span><i style="background:#9FE0C3"></i>weekend</span><span><i class="ha"></i>today (in progress)</span></div></div></div>
<div class="box"><div class="bh"><div><div class="bt">Daily values</div></div></div><div class="bb"><div class="two tight">
${energyCol(energy.slice(0, half), false)}
${energyCol(energy.slice(half), true)}
</div></div></div>
<div class="box"><div class="bh"><div><div class="bt">Cost &amp; emissions</div></div></div><div class="bb"><table class="tbl">
<tr><th>Item</th><th class="r">Value</th><th>Method &amp; source</th></tr>
<tr><td>Estimated cost</td><td class="r">${nf(cost)} ${curr === "EUR" ? "€" : esc(curr)}</td><td>${nf(price, 2)} ${curr === "EUR" ? "€" : esc(curr)}/kWh, from site settings</td></tr>
<tr><td>Emissions</td><td class="r">${nf(co2t, 2)} t CO₂eq</td><td>0.233 kg CO₂eq/kWh · location-based</td></tr>
<tr><td>Daily peak</td><td class="r">${nf(peakDay, 1)} kWh</td><td>highest-consumption day</td></tr>
<tr><td>Weekday / weekend average</td><td class="r">${nf(wdAvg, 1)} / ${nf(weAvg, 1)} kWh</td><td>average of days with data</td></tr></table></div></div>
</main>${foot(3)}</section>`;

  // PAGE 4 — Air quality & comfort (charts)
  const co2Series: Day[] = air["iaq.co2"].map(b => ({ ...b, v: b.avg }));
  const co2Fill = (b: Day) => b.inProgress ? "url(#hc)" : (!b.future && !b.empty && b.max != null && b.max > 1000) ? "#8A1060" : "#9FE0C3";
  const tRes = bandResult(tIn), hRes = bandResult(hIn), cRes = bandResult(cIn);
  html += `<section class="page">${header()}<main>
<div class="sec"><span class="sn">3</span><h2>Air quality &amp; comfort</h2><p>Daily values from the indoor air quality sensors.</p></div>
<div class="box"><div class="bh"><div><div class="bt">CO₂</div><div class="bs">ppm · bar = daily mean; colour = whether the daily peak exceeded the threshold</div></div><span class="tag">Daily</span></div><div class="bb">
${barChart(co2Series, { fillFn: co2Fill, threshold: 1000, thresholdLabel: "1,000 ppm", dec: 0, hatchId: "hc", hatchCol: "#9FE0C3" })}
<div class="legend"><span><i style="background:#9FE0C3"></i>daily mean · peak within 1,000 ppm</span><span><i style="background:#8A1060"></i>daily mean · peak above 1,000 ppm</span><span><i class="ln" style="border-color:#8A1060;border-top-style:dashed"></i>1,000 ppm threshold</span><span><i class="ha"></i>today (in progress)</span></div></div></div>
<div class="box"><div class="bh"><div><div class="bt">Temperature</div><div class="bs">°C · daily mean and min–max · target band 20–26 °C</div></div></div><div class="bb">
${lineChart(air["env.temperature"], { targetMin: 20, targetMax: 26, dec: 1 })}
<div class="legend"><span><i class="ln" style="border-color:#11624F"></i>daily mean</span><span><i class="sq" style="background:#2BB582;opacity:.35"></i>daily min–max</span><span><i class="sq" style="background:#E6FAF0;border:1px solid #9FE0C3"></i>target band</span></div></div></div>
<div class="box"><div class="bh"><div><div class="bt">Relative humidity</div><div class="bs">% · daily mean and min–max · target band 40–60 %</div></div></div><div class="bb">
${lineChart(air["env.humidity"], { targetMin: 40, targetMax: 60, dec: 0 })}
<div class="legend"><span><i class="ln" style="border-color:#11624F"></i>daily mean</span><span><i class="sq" style="background:#2BB582;opacity:.35"></i>daily min–max</span><span><i class="sq" style="background:#E6FAF0;border:1px solid #9FE0C3"></i>target band</span></div></div></div>
<div class="box"><div class="bh"><div><div class="bt">Time within target band</div><div class="bs">occupied hours (Mon–Fri 08:00–18:00)</div></div></div><div class="bb"><table class="tbl">
<tr><th>Parameter</th><th>Target band</th><th class="r">In band</th><th class="r">Below</th><th class="r">Above</th><th>Result</th></tr>
<tr><td>Temperature</td><td>20–26 °C</td><td class="r">${tIn} %</td><td class="r">${bv("env.temperature", "below")} %</td><td class="r">${bv("env.temperature", "above")} %</td><td><span class="pill ${tRes[1]}"><i></i>${tRes[0]}</span></td></tr>
<tr><td>Relative humidity</td><td>40–60 %</td><td class="r">${hIn} %</td><td class="r">${bv("env.humidity", "below")} %</td><td class="r">${bv("env.humidity", "above")} %</td><td><span class="pill ${hRes[1]}"><i></i>${hRes[0]}</span></td></tr>
<tr><td>CO₂</td><td>≤ 1,000 ppm</td><td class="r">${cIn} %</td><td class="r">${bv("iaq.co2", "below")} %</td><td class="r">${bv("iaq.co2", "above")} %</td><td><span class="pill ${cRes[1]}"><i></i>${cRes[0]}</span></td></tr></table>
<p class="note">Good ≥ 90% of occupied hours in band · Verify 70–89% · Caution &lt; 70%. The 1,000 ppm CO₂ value is a ventilation reference (EN 16798), not a WHO limit.</p></div></div>
</main>${foot(4)}</section>`;

  // PAGE 5 — Air quality daily values
  html += `<section class="page">${header()}<main>
<div class="sec"><span class="sn">3</span><h2>Air quality — daily values</h2><p>Daily mean per parameter, occupied and non-occupied hours.</p></div>
<div class="box"><div class="bb">${airTable()}
<p class="note"><span class="mag">Highlighted</span>: the parameter exceeded its threshold at least once that day (the value shown is the daily mean).</p></div></div>
</main>${foot(5)}</section>`;

  // PAGE 6 — Water + Alarms + Methodology
  const waterSubject = encodeURIComponent(`Water monitoring - ${site.name}`);
  html += `<section class="page">${header()}<main>
<div class="sec"><span class="sn">4</span><h2>Water</h2><p>Water consumption, leaks and water quality.</p></div>
<div class="box"><div class="bh"><div><div class="bt">Water monitoring status</div></div><span class="pill na"><i></i>Not monitored</span></div><div class="bb"><table class="tbl">
<tr><th>Parameter</th><th>Status</th></tr>
<tr><td>Water consumption</td><td>Meter installed — no data transmitted in the period</td></tr>
<tr><td>Leak detection</td><td>Not monitored</td></tr>
<tr><td>Water quality</td><td>Not monitored</td></tr></table></div></div>
<div class="inv"><div class="il">Expand your monitoring</div><div class="it">You can't save what you don't measure.</div><div class="ib">Leaks, waste and savings — detected live, before they reach your bill.</div><div class="ic"><a href="mailto:monitoring@fgb-studio.com?subject=${waterSubject}">Ask us how →</a></div></div>
<div class="sec"><span class="sn">5</span><h2>Alarms</h2><p>Threshold exceedances in the period. Verify = above 1,000 ppm · Caution = above 1,500 ppm.</p></div>
<div class="box"><div class="bb">${alarmsTable()}</div></div>
<div class="sec"><span class="sn">6</span><h2>Methodology notes</h2></div>
<div class="box"><div class="bb"><table class="tbl">
<tr><th>Parameter</th><th>Daily aggregation</th><th>Values reported</th></tr>
<tr><td>Energy</td><td>sum of energy (or integrated power)</td><td>sum · peak</td></tr>
<tr><td>T, RH, CO₂, TVOC, PM</td><td>time-weighted mean</td><td>mean · min · max · % in band</td></tr>
<tr><td>Cost, CO₂eq</td><td>derived from daily energy</td><td>sum</td></tr></table>
<p class="note">Status: <b>Online</b> = data received · <b>Offline</b> = no data received · <b>Future</b> = day not yet elapsed.</p></div></div>
<div class="disc">Report generated by FGB Monitoring for information purposes. For details: <b>monitoring@fgb-studio.com</b></div>
</main>${foot(6)}</section>`;

  return html;
}

/**
 * Scarica DIRETTAMENTE il report come file PDF (niente finestra di stampa).
 * Renderizza l'HTML in un iframe isolato (per non inquinare gli stili
 * dell'app), lo rasterizza pagina per pagina con html2canvas e compone un
 * PDF A4 con jsPDF, poi lo salva. Il PDF e' quindi un raster ad alta
 * risoluzione dell'HTML corretto (vettoriale nitido = render lato server,
 * follow-up). Restituisce false se qualcosa va storto (il chiamante puo'
 * ripiegare sulla stampa).
 */
export async function downloadReportPdf(input: ReportHtmlInput, filename = "FGB Monitoring Report.pdf"): Promise<boolean> {
  const inner = buildReportHtml(input);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:2000mm;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    if (!doc) return false;
    doc.open();
    doc.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>${inner}</body></html>`);
    doc.close();

    const [{ default: html2canvas }, jspdf] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const JsPDF = (jspdf as { jsPDF: typeof import("jspdf").jsPDF }).jsPDF;

    // attendi font (Jost/Gloock via Google Fonts) e immagini (logo)
    try { await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* no FontFaceSet */ }
    const imgs = Array.from(doc.querySelectorAll("img"));
    await Promise.all(imgs.map(im => im.complete ? Promise.resolve() : new Promise<void>(r => { im.onload = () => r(); im.onerror = () => r(); })));
    await new Promise(r => setTimeout(r, 200));

    const pages = Array.from(doc.querySelectorAll<HTMLElement>(".page"));
    if (!pages.length) return false;
    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], { scale: 2.5, backgroundColor: "#ffffff", useCORS: true, logging: false });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297);
    }
    pdf.save(filename);
    return true;
  } catch (e) {
    console.error("downloadReportPdf failed", e);
    return false;
  } finally {
    document.body.removeChild(iframe);
  }
}

/** Apre il report in una nuova finestra e lancia la stampa (PDF del browser).
 *  `win` va aperta SINCRONA sul click (gesto utente) per non farla bloccare
 *  dai popup blocker; se assente, prova ad aprirla qui (puo' essere bloccata). */
export function openReportForPrint(input: ReportHtmlInput, docTitle = "FGB Monitoring Report", win?: Window | null): void {
  const body = buildReportHtml(input);
  const w = win ?? window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${docTitle.replace(/</g, "&lt;")}</title></head><body>${body}` +
    `<script>window.addEventListener('load',function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},400);});</scr` + `ipt>` +
    `</body></html>`,
  );
  w.document.close();
}
