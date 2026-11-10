/**
 * Le due pagine del pacchetto — Fleet Status e Fleet Analysis — come HTML
 * autocontenuto (stile FGB, grafici SVG inline, niente dipendenze esterne),
 * poi stampate in PDF con Edge headless. Se Edge manca, gli HTML restano
 * nel pacchetto e si stampano dal browser: il contenuto è identico.
 */
const fs = require("fs");
const path = require("path");

const TEAL = "#009193", TEAL_DEEP = "#016368", TEAL_PALE = "#9fd5d9";
const INK = "#0e2224", SUB = "#5d7375", RULE = "#d7e4e4", FLAG = "#931841";

const CSS = `
  *{box-sizing:border-box} body{margin:0;font-family:"Segoe UI",system-ui,sans-serif;
    color:${INK};font-size:12px;line-height:1.5;background:#fff}
  .page{padding:34px 40px}
  h1{font-size:26px;font-weight:650;letter-spacing:-.02em;margin:0}
  h2{font-size:15px;font-weight:650;margin:26px 0 8px;color:${TEAL_DEEP}}
  .eyebrow{font-size:8.5px;letter-spacing:.18em;text-transform:uppercase;color:${SUB};margin-bottom:8px}
  .sub{color:${SUB};font-size:11px;margin-top:5px}
  .rule{height:2px;background:${TEAL_DEEP};margin:16px 0 18px}
  .board{display:flex;gap:10px;margin:14px 0}
  .board>div{flex:1;border:1px solid ${RULE};border-radius:6px;padding:10px 12px}
  .board .n{font-size:22px;font-weight:650;letter-spacing:-.02em}
  .board .k{font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:${SUB};margin-top:2px}
  table{border-collapse:collapse;width:100%;font-size:10.2px}
  th{text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.09em;color:${SUB};
    padding:6px 8px;border-bottom:1.5px solid ${RULE};white-space:nowrap}
  td{padding:5.5px 8px;border-bottom:.5px solid #edf3f3;vertical-align:top}
  td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  th.num{text-align:right}
  .pill{display:inline-block;font-size:8px;font-weight:650;text-transform:uppercase;
    letter-spacing:.07em;padding:2px 7px;border-radius:3px}
  .pill.online{background:${TEAL};color:#fff}
  .pill.offline{background:#fbe9ee;color:${FLAG}}
  .pill.installing{background:#fdf1dc;color:#8a5a12}
  .pill.pipeline{border:1px solid ${RULE};color:${SUB}}
  .note{font-size:9.5px;color:${SUB};margin-top:10px;max-width:640px}
  .foot{margin-top:26px;padding-top:10px;border-top:1px solid ${RULE};
    font-size:8.5px;color:${SUB};display:flex;justify-content:space-between}
  .chart{margin:6px 0 2px}
  .flag{color:${FLAG}} .ok{color:${TEAL_DEEP}}
  .pagebreak{page-break-before:always}
`;

const escH = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (n, d = 0) => n == null || n === "" ? "—"
  : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const shell = (title, brandName, stamp, body) => `<!doctype html><html><head>
<meta charset="utf-8"><title>${escH(title)}</title><style>${CSS}</style></head><body>
<div class="page">
  <div class="eyebrow">FGB Monitoring · ${escH(brandName)} · generated ${stamp}</div>
  ${body}
  <div class="foot"><span>FGB · Future Green Building — xmonitoring.fgb-studio.com</span>
  <span>Confidential — prepared for ${escH(brandName)}</span></div>
</div></body></html>`;

/* ── Pagina 1: Fleet Status ────────────────────────────────────────────── */
function buildStatusHtml(brandName, stamp, sites, counts, analytics) {
  const aBy = new Map(analytics.map(a => [a.site.id, a]));
  const order = { online: 0, offline: 1, installing: 2, pipeline: 3 };
  const sorted = [...sites].sort((a, b) => order[a._state] - order[b._state] || String(a.name).localeCompare(b.name));
  const rows = sorted.map(s => {
    const a = aBy.get(s.id);
    return `<tr>
      <td><strong>${escH(s.name)}</strong></td>
      <td>${escH([s.city, s.country].filter(Boolean).join(", "))}</td>
      <td class="num">${fmt(s.area_m2)}</td>
      <td><span class="pill ${s._state}">${s._state}</span></td>
      <td class="num">${s._devs.length}${s._devs.filter(d => d.category && d.category !== "general").length ? ` <span style="color:${SUB}">(+${s._devs.filter(d => d.category && d.category !== "general").length} sub)</span>` : ""}</td>
      <td class="num">${s._cov ? escH(String(s._cov.first_day).slice(0, 10)) : "—"}</td>
      <td class="num">${s._lastTs ? escH(new Date(s._lastTs).toISOString().slice(0, 16).replace("T", " ")) : "—"}</td>
      <td class="num">${a ? (a.coverage30 < 90 ? `<span class="flag">${a.coverage30}%</span>` : `${a.coverage30}%`) : "—"}</td>
      <td class="num">${a ? fmt(a.kwh30) : "—"}</td>
      <td class="num">${a?.eui30 != null ? fmt(a.eui30, 1) : "—"}</td>
    </tr>`;
  }).join("");

  const silent = sorted.filter(s => s._state === "offline" || s._state === "installing");
  const silentNote = silent.length
    ? `<p class="note"><strong>Reliability note.</strong> ${silent.length} site(s) are currently not transmitting:
       ${silent.map(s => `${escH(s.name)} (${s._state === "installing" ? "never transmitted — installation in progress" : "last data " + (s._lastTs ? new Date(s._lastTs).toISOString().slice(0, 10) : "n/a")})`).join(" · ")}.
       Their historical data is included; gaps are gaps — nothing is estimated.</p>`
    : `<p class="note"><strong>Reliability note.</strong> Every installed site is currently transmitting. Gaps in historical data, where present, are declared — nothing is estimated.</p>`;

  return shell("Fleet Status", brandName, stamp, `
    <h1>Energy Monitoring — Fleet Status</h1>
    <div class="sub">${escH(brandName)} stores under FGB energy monitoring · data as of ${stamp}</div>
    <div class="rule"></div>
    <div class="board">
      <div><div class="n">${sites.length}</div><div class="k">monitoring points</div></div>
      <div><div class="n ok">${counts.online}</div><div class="k">online</div></div>
      <div><div class="n flag">${counts.offline + counts.installing}</div><div class="k">offline / installing</div></div>
      <div><div class="n" style="color:${SUB}">${counts.pipeline}</div><div class="k">pipeline</div></div>
    </div>
    <h2>Sites</h2>
    <table>
      <tr><th>Site</th><th>Location</th><th class="num">m²</th><th>Status</th>
          <th class="num">Meters</th><th class="num">First data</th><th class="num">Last data (UTC)</th>
          <th class="num">Coverage 30d</th><th class="num">kWh 30d</th><th class="num">kWh/m² 30d</th></tr>
      ${rows}
    </table>
    ${silentNote}
    <p class="note">Status rule — <strong>online</strong>: last reading within 48 h · <strong>offline</strong>: has transmitted, currently silent · <strong>installing</strong>: devices registered, no reading yet · <strong>pipeline</strong>: planned point, devices not installed. Coverage = days with data in the last 30.</p>
  `);
}

/* ── Pagina 2: Fleet Analysis ──────────────────────────────────────────── */
function barChart(items, { unit = "", decimals = 1, width = 680 } = {}) {
  // barre orizzontali ordinate, mediana tratteggiata
  const vals = items.map(i => i.value).filter(v => v != null);
  if (!vals.length) return "";
  const max = Math.max(...vals);
  const med = [...vals].sort((a, b) => a - b)[Math.floor(vals.length / 2)];
  const rowH = 20, labelW = 190, chartW = width - labelW - 70;
  const H = items.length * rowH + 24;
  const x = (v) => (v / max) * chartW;
  let svg = `<svg class="chart" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  items.forEach((it, i) => {
    const y = i * rowH + 14;
    const w = it.value != null ? Math.max(2, x(it.value)) : 0;
    svg += `<text x="${labelW - 8}" y="${y + 4}" text-anchor="end" font-size="9.5" fill="${INK}">${escH(it.label).slice(0, 30)}</text>`;
    if (it.value != null) {
      svg += `<rect x="${labelW}" y="${y - 7}" width="${w}" height="14" rx="2.5" fill="${it.dim ? TEAL_PALE : TEAL}"/>`;
      svg += `<text x="${labelW + w + 6}" y="${y + 4}" font-size="9.5" fill="${SUB}">${fmt(it.value, decimals)}${unit ? " " + unit : ""}${it.dim ? " *" : ""}</text>`;
    } else {
      svg += `<text x="${labelW + 4}" y="${y + 4}" font-size="9" fill="${SUB}">no data</text>`;
    }
  });
  const mx = labelW + x(med);
  svg += `<line x1="${mx}" y1="4" x2="${mx}" y2="${H - 18}" stroke="${TEAL_DEEP}" stroke-width="1" stroke-dasharray="4 3"/>`;
  svg += `<text x="${mx + 4}" y="${H - 6}" font-size="8.5" fill="${TEAL_DEEP}">median ${fmt(med, decimals)}${unit ? " " + unit : ""}</text>`;
  return svg + "</svg>";
}

function buildAnalysisHtml(brandName, stamp, analytics, coverageMin) {
  const ranked = analytics.filter(a => a.ranked);
  const excluded = analytics.filter(a => !a.ranked);
  const nm = (a) => a.site.name;

  const euiItems = [...ranked].filter(a => a.eui30 != null).sort((x, y) => y.eui30 - x.eui30)
    .map(a => ({ label: nm(a), value: a.eui30 }));
  const baseItems = [...ranked].filter(a => a.baseloadSharePct != null).sort((x, y) => y.baseloadSharePct - x.baseloadSharePct)
    .map(a => ({ label: nm(a), value: a.baseloadSharePct }));
  const yoyItems = [...ranked].filter(a => a.yoyPct != null).sort((x, y) => x.yoyPct - y.yoyPct)
    .map(a => ({ label: nm(a), value: a.yoyPct }));

  const tableRows = [...analytics].sort((x, y) => (y.eui12m ?? -1) - (x.eui12m ?? -1)).map(a => `
    <tr>
      <td><strong>${escH(nm(a))}</strong>${a.ranked ? "" : ' <span class="flag">*</span>'}</td>
      <td class="num">${fmt(a.site.area_m2)}</td>
      <td class="num">${a.coverage30}%</td>
      <td class="num">${fmt(a.kwh12m)}</td>
      <td class="num">${a.eui12m != null ? fmt(a.eui12m, 1) : "—"}</td>
      <td class="num">${a.yoyPct != null ? (a.yoyPct > 0 ? "+" : "") + a.yoyPct + "%" : "—"}</td>
      <td class="num">${a.baseloadKw != null ? fmt(a.baseloadKw, 1) : "—"}</td>
      <td class="num">${a.peakKw != null ? `${fmt(a.peakKw, 1)} <span style="color:${SUB}">(${escH(a.peakDay ?? "")})</span>` : "—"}</td>
      <td class="num">${a.cost12m != null ? "€ " + fmt(a.cost12m) : "—"}</td>
      <td class="num">${fmt(a.co2kg12m / 1000, 1)} t</td>
    </tr>`).join("");

  return shell("Fleet Analysis", brandName, stamp, `
    <h1>Energy Monitoring — Fleet Analysis</h1>
    <div class="sub">${escH(brandName)} · cross-store comparison · rankings include only sites with ≥${coverageMin}% data coverage in the last 30 days</div>
    <div class="rule"></div>

    <h2>Energy intensity — kWh/m², last 30 days</h2>
    <p class="note">The one metric that puts a flagship and a small boutique on the same scale: energy per square metre. The dashed line is the fleet median.</p>
    ${barChart(euiItems, { unit: "kWh/m²", decimals: 1 })}

    <h2 class="pagebreak">Night baseload — % of average power left on at night</h2>
    <p class="note">Median of the nightly minimum (01:00–05:00 local) over the last 30 days, as a share of the site's average power. A high share means something stays on while the store is closed — the most immediately actionable saving.</p>
    ${barChart(baseItems, { unit: "%", decimals: 0 })}

    ${yoyItems.length ? `<h2>Year over year — last 12 months vs the previous 12</h2>
    <p class="note">Each store against itself. Negative is better. Only sites with at least 300 days of history in the earlier year.</p>
    ${barChart(yoyItems, { unit: "%", decimals: 0 })}` : ""}

    <h2 class="pagebreak">Full comparison table</h2>
    <table>
      <tr><th>Site</th><th class="num">m²</th><th class="num">Cov. 30d</th><th class="num">kWh 12m</th>
          <th class="num">kWh/m² 12m</th><th class="num">YoY</th><th class="num">Baseload kW</th>
          <th class="num">Peak kW (day)</th><th class="num">Cost 12m</th><th class="num">CO₂ 12m</th></tr>
      ${tableRows}
    </table>
    ${excluded.length ? `<p class="note"><span class="flag">*</span> ${excluded.map(a => escH(nm(a))).join(" · ")}: data coverage below ${coverageMin}% in the last 30 days — shown for completeness, excluded from rankings. Costs are computed with each site's configured tariff (historicized where available) and left empty where no tariff is configured; CO₂ uses 0.233 kg/kWh.</p>`
      : `<p class="note">Costs use each site's configured tariff (historicized where available) and are left empty where none is configured; CO₂ uses 0.233 kg/kWh.</p>`}
  `);
}

/* ── HTML → PDF con Edge headless ──────────────────────────────────────── */
async function htmlToPdf(htmlPath, pdfPath) {
  const puppeteer = require("puppeteer-core");
  const candidates = [
    process.env.EDGE_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/microsoft-edge", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
  ].filter(Boolean);
  const exe = candidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
  if (!exe) throw new Error("nessun browser trovato (imposta EDGE_PATH)");
  const browser = await puppeteer.launch({ executablePath: exe, headless: "new", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto("file:///" + path.resolve(htmlPath).replace(/\\/g, "/"), { waitUntil: "networkidle0" });
    await page.pdf({
      path: pdfPath, format: "A4", landscape: true, printBackground: true,
      margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" },
    });
  } finally {
    await browser.close();
  }
}

module.exports = { buildStatusHtml, buildAnalysisHtml, htmlToPdf };
