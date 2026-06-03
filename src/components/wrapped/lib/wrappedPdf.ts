/**
 * PDF generation for FGB Wrapped — all variants use window.open + window.print.
 * No new dependencies. Each builder writes an inline HTML doc themed for print.
 */
import type { SiteWeeklyData } from '../hooks/useSiteWeeklyWrap';
import type { SiteMonthlyData } from '../hooks/useSiteMonthlyWrap';
import type { AggregateWeeklyData } from '../hooks/useAggregateWeeklyWrap';

const fmt = (n: number | null) => (n == null ? '—' : Math.round(n).toLocaleString('it-IT'));
const fmtPct = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}%`);

const baseCss = `
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Century Gothic',sans-serif;background:#fff;color:#1a1a1a;-webkit-print-color-adjust:exact;}
.cover{background:#00614A;color:#fff;padding:52px 48px;}
.fgb{font-size:54px;font-weight:900;}.title{font-size:28px;font-weight:800;margin-top:14px;}
.site{font-size:18px;opacity:.85;margin-top:6px;}.period{font-size:12px;letter-spacing:.12em;opacity:.6;margin-top:4px;}
.body{padding:40px 48px;}
.sec{font-size:18px;font-weight:800;color:#00614A;margin:24px 0 12px;padding-bottom:7px;border-bottom:2px solid #d4e8dc;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px;}
.card{border-radius:10px;padding:18px 20px;background:#f4f8f5;border:1px solid #d4e8dc;}
.kl{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#666;}
.kv{font-size:28px;font-weight:900;margin-top:6px;color:#00614A;}
.kd{font-size:11px;font-weight:600;margin-top:4px;color:#666;}
table{width:100%;border-collapse:collapse;margin-top:8px;}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #e0eae3;font-size:12px;}
th{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#888;}
@media print{@page{margin:0;}}
`;

function openPrint(title: string, body: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>${baseCss}</style></head><body>${body}<script>window.onload=()=>window.print();<\/script></body></html>`);
  w.document.close();
}

export function generateSitePdf(data: SiteWeeklyData | SiteMonthlyData, siteName: string) {
  const body = `
    <div class="cover">
      <div class="fgb">FGB</div>
      <div class="title">Weekly Wrapped</div>
      <div class="site">${siteName}</div>
      <div class="period">${data.weekLabel}</div>
    </div>
    <div class="body">
      <div class="sec">Key indicators</div>
      <div class="grid">
        <div class="card"><div class="kl">Energy</div><div class="kv">${fmt(data.energy.weekKwh)} kWh</div><div class="kd">${fmtPct(data.energy.deltaPct)} vs last week</div></div>
        <div class="card"><div class="kl">CO₂ saved</div><div class="kv">${fmt(data.co2.savedKg)} kg</div><div class="kd">≈ ${data.co2.treesEquiv ?? 0} trees/yr</div></div>
        <div class="card"><div class="kl">Avg CO₂ indoor</div><div class="kv">${data.air.avgCo2Ppm ?? '—'} ppm</div><div class="kd">${data.air.daysExcellent} excellent days</div></div>
        <div class="card"><div class="kl">Alerts</div><div class="kv">${data.alerts.activeNow}</div><div class="kd">${data.alerts.resolvedThisWeek} resolved this week</div></div>
      </div>
    </div>`;
  openPrint(`FGB Weekly Wrapped — ${siteName}`, body);
}

export function generateAggregatePdf(data: AggregateWeeklyData, label: string) {
  const lb = data.leaderboard.map((s, i) => `<tr><td>${i + 1}</td><td>${s.name}</td><td>${s.eui?.toFixed(2) ?? '—'} kWh/m²</td></tr>`).join('');
  const mi = data.mostImproved.map((s, i) => `<tr><td>${i + 1}</td><td>${s.name}</td><td>${fmtPct(s.deltaPct)}</td></tr>`).join('');
  const body = `
    <div class="cover">
      <div class="fgb">FGB</div>
      <div class="title">Portfolio Weekly Wrapped</div>
      <div class="site">${label}</div>
      <div class="period">${data.weekLabel} · ${data.totals.sitesWithData} sites</div>
    </div>
    <div class="body">
      <div class="sec">Totals</div>
      <div class="grid">
        <div class="card"><div class="kl">Total energy</div><div class="kv">${fmt(data.totals.weekKwh)} kWh</div><div class="kd">${fmtPct(data.totals.deltaPct)} vs last week</div></div>
        <div class="card"><div class="kl">CO₂ saved</div><div class="kv">${fmt(data.totals.savedKg)} kg</div><div class="kd">≈ ${data.totals.treesEquiv} trees/yr</div></div>
      </div>
      <div class="sec">Leaderboard (best EUI)</div>
      <table><thead><tr><th>#</th><th>Site</th><th>EUI</th></tr></thead><tbody>${lb || '<tr><td colspan="3">—</td></tr>'}</tbody></table>
      <div class="sec">Most improved</div>
      <table><thead><tr><th>#</th><th>Site</th><th>Δ</th></tr></thead><tbody>${mi || '<tr><td colspan="3">—</td></tr>'}</tbody></table>
    </div>`;
  openPrint(`FGB Portfolio Weekly — ${label}`, body);
}

export function generateGlobalPdf(data: AggregateWeeklyData) {
  const regs = Object.entries(data.byRegion).map(([r, v]) =>
    `<tr><td>${r}</td><td>${fmt(v.weekKwh)} kWh</td><td>${fmtPct(v.deltaPct)}</td><td>${fmt(v.savedKg)} kg</td><td>${v.sites}</td></tr>`
  ).join('');
  const body = `
    <div class="cover">
      <div class="fgb">FGB</div>
      <div class="title">Global Weekly Wrapped</div>
      <div class="site">Worldwide · ${data.totals.sitesWithData} active sites</div>
      <div class="period">${data.weekLabel}</div>
    </div>
    <div class="body">
      <div class="sec">Worldwide totals</div>
      <div class="grid">
        <div class="card"><div class="kl">Total energy</div><div class="kv">${fmt(data.totals.weekKwh)} kWh</div><div class="kd">${fmtPct(data.totals.deltaPct)} vs last week</div></div>
        <div class="card"><div class="kl">CO₂ saved</div><div class="kv">${fmt(data.totals.savedKg)} kg</div><div class="kd">≈ ${data.totals.treesEquiv} trees/yr</div></div>
      </div>
      <div class="sec">By region</div>
      <table><thead><tr><th>Region</th><th>Energy</th><th>Δ</th><th>CO₂ saved</th><th>Sites</th></tr></thead><tbody>${regs || '<tr><td colspan="5">—</td></tr>'}</tbody></table>
    </div>`;
  openPrint(`FGB Global Weekly — ${data.weekLabel}`, body);
}