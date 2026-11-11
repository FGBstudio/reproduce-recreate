#!/usr/bin/env node
/**
 * FGB · Export energia per brand (proposta «Export Fendi Energy», nov 2026).
 *
 * Genera un pacchetto consegnabile al cliente:
 *   <out>/<BRAND>_Energy_Export_<data>/
 *   ├── 00_README.txt            convenzioni, unità, retention
 *   ├── 01_fleet_summary.csv     stato flotta, machine-readable
 *   ├── 02_fleet_analytics.csv   indicatori di confronto per sito
 *   ├── Fleet_Status.pdf         pagina introduttiva brandizzata
 *   ├── Fleet_Analysis.pdf       grafici di confronto
 *   └── <SITO>/                  una cartella per sito con device censiti
 *       ├── site_info.csv · devices.csv
 *       ├── energy_hourly.csv    (finestra di retention: ~12 mesi)
 *       ├── energy_daily.csv     (tutto lo storico)
 *       └── energy_daily_wide.csv
 *
 * Uso:  node export.cjs --brand fendi [--out DIR] [--hourly-months 12] [--no-pdf]
 * Credenziali: env DATABASE_URL, oppure un file .dbenv accanto allo script
 * (riga `DATABASE_URL=postgres://…`). Il file è in .gitignore: MAI committarlo.
 *
 * Regole ereditate dalla piattaforma, qui replicate alla lettera:
 *  · stato sito  — online = ultima lettura ≤48h; offline = ha trasmesso ma
 *    tace; «installing» = device censiti, zero letture; pipeline = nessun
 *    device (punto previsto). Stessa semantica di useAggregatedSiteData.
 *  · kWh         — per le metriche di ENERGIA vale value_sum del bucket; per
 *    quelle di POTENZA l'energia è value_avg × ore del bucket; se un device
 *    riporta entrambe nello stesso bucket vince la misura diretta (il fix
 *    sumPointsAsKwh del 16/10). Guardia anti-outlier: value_sum > 50000 kWh
 *    in un bucket è scartato come spike di ingestione (stessa soglia mobile).
 *  · onestà      — niente fallback inventati: tariffa assente ⇒ costo vuoto;
 *    copertura sotto soglia ⇒ fuori classifica, dichiarato.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { buildStatusHtml, buildAnalysisHtml, htmlToPdf } = require("./report.cjs");

/* ── argomenti ─────────────────────────────────────────────────────────── */
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1] : dflt;
};
const BRAND_Q = arg("brand", null);
const OUT_BASE = arg("out", path.join(require("os").homedir(), "Downloads"));
const HOURLY_MONTHS = Number(arg("hourly-months", "12"));
const NO_PDF = process.argv.includes("--no-pdf");
if (!BRAND_Q) { console.error("Uso: node export.cjs --brand <nome> [--out DIR]"); process.exit(1); }

/* ── credenziali ───────────────────────────────────────────────────────── */
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const f = path.join(__dirname, ".dbenv");
  if (fs.existsSync(f)) {
    const raw = fs.readFileSync(f, "utf8");
    const m = raw.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
    if (m) return m[1];
    // tolleranza: il file può contenere la sola connection string nuda
    const bare = raw.replace(/^﻿/, "").trim();
    if (/^postgres(ql)?:\/\//.test(bare)) return bare;
  }
  console.error("DATABASE_URL mancante: esporta la variabile o crea tools/brand-export/.dbenv");
  process.exit(1);
}

/* ── classificazione metriche (allineata a api.ts/isEnergyKwhMetric) ───── */
const isEnergyMetric = (m) => /active_energy|kwh/i.test(m || "");
const isPowerMetric = (m) => /power_kw|hvac_kw/i.test(m || "");
const shortMetric = (m) => isEnergyMetric(m) ? "energy_kwh" : isPowerMetric(m) ? "power_kw" : String(m).replace(/^energy\./, "");
const unitOf = (m) => isEnergyMetric(m) ? "kWh" : isPowerMetric(m) ? "kW" : "";
const SPIKE_KWH = 50000; // guardia bucket, come sul mobile

const CO2_EF = 0.233; // kg/kWh — stesso fattore della piattaforma
const ONLINE_H = 48;
const COVERAGE_MIN = 90; // % sotto cui un sito esce dalle classifiche

/* ── CSV helpers (Excel-safe: UTF-8 BOM, virgola, decimale punto) ──────── */
const esc = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function writeCsv(file, header, rows) {
  const out = ["﻿" + header.join(","), ...rows.map(r => r.map(esc).join(","))].join("\r\n");
  fs.writeFileSync(file, out, "utf8");
}
const slug = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) || "site";
/* pg restituisce le colonne DATE come oggetti Date (mezzanotte LOCALE):
   niente toISOString, che su fusi positivi scala al giorno prima — si
   compongono le parti locali. Le stringhe passano con lo slice. */
const pad2 = (n) => String(n).padStart(2, "0");
const day = (d) => d instanceof Date
  ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  : String(d).slice(0, 10);
const r1 = (n) => n == null ? null : Math.round(n * 10) / 10;
const r2 = (n) => n == null ? null : Math.round(n * 100) / 100;

/** ora locale del sito, senza dipendenze: Intl con il fuso del DB */
function localStamp(dateUtc, tz) {
  try {
    const p = new Intl.DateTimeFormat("sv-SE", {
      timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(dateUtc);
    return p.replace("T", " ");
  } catch { return ""; }
}

/* ── connessione resiliente ────────────────────────────────────────────
   Il pooler tronca le connessioni lunghe (ECONNRESET a metà run, visto al
   primo collaudo): ogni query passa da q(), che riconnette e riprova fino
   a 3 volte sui soli errori di rete. Un errore SQL vero esce subito. */
let client = null;
async function connectDb() {
  client = new Client({
    connectionString: databaseUrl(), ssl: { rejectUnauthorized: false },
    keepAlive: true, connectionTimeoutMillis: 15000,
  });
  // reset mentre siamo a riposo: niente crash, riconnessione alla prossima query
  client.on("error", () => { client = null; });
  await client.connect();
}
async function q(sql, params) {
  for (let attempt = 0; ; attempt++) {
    try {
      if (!client) await connectDb();
      return await client.query(sql, params);
    } catch (e) {
      const transient = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|Connection terminated|server closed|SSL|timeout/i.test(String(e?.message));
      try { const dead = client; client = null; dead?.end?.()?.catch?.(() => {}); } catch { /* già chiusa */ }
      if (!transient || attempt >= 3) throw e;
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

/* ── introspezione difensiva: colonne/tabelle opzionali ────────────────── */
async function tableCols(_c, table) {
  const res = await q(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1`, [table]);
  return new Set(res.rows.map(r => r.column_name));
}

/* ── kWh di un insieme di righe bucket (fix 16/10, lato SQL in JS) ─────── */
function rowsToKwh(rows, bucketHours) {
  // chiave device|bucket → { direct, derived }
  const slots = new Map();
  for (const r of rows) {
    let kwh = null;
    if (isEnergyMetric(r.metric)) {
      const v = Number(r.value_sum);
      if (Number.isFinite(v) && v >= 0 && v <= SPIKE_KWH) kwh = v;
    } else if (isPowerMetric(r.metric)) {
      const v = Number(r.value_avg);
      if (Number.isFinite(v) && v >= 0) kwh = v * bucketHours;
    }
    if (kwh == null) continue;
    const k = `${r.device_id}|${r.ts}`;
    const s = slots.get(k) ?? { direct: null, derived: null };
    if (isEnergyMetric(r.metric)) s.direct = (s.direct ?? 0) + kwh;
    else s.derived = (s.derived ?? 0) + kwh;
    slots.set(k, s);
  }
  let tot = 0;
  for (const s of slots.values()) tot += s.direct ?? s.derived ?? 0;
  return tot;
}

/* ══════════════════════════ MAIN ══════════════════════════ */
(async () => {
  const t0 = Date.now();
  await connectDb();
  const c = null; // le query passano tutte da q(); c resta solo per tableCols(c, …)
  const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

  /* 1 · brand e siti */
  const b = await q(`SELECT id, name FROM brands WHERE name ILIKE $1 ORDER BY name LIMIT 1`, [`%${BRAND_Q}%`]);
  if (!b.rows.length) { console.error(`Nessun brand corrisponde a "${BRAND_Q}"`); process.exit(1); }
  const brand = b.rows[0];
  log(`Brand: ${brand.name} (${brand.id})`);

  const siteCols = await tableCols(c, "sites");
  const opt = (n) => siteCols.has(n) ? `s.${n}` : `NULL AS ${n}`;
  const sites = (await q(`
    SELECT s.id, s.name, ${opt("city")}, ${opt("country")}, ${opt("timezone")},
           ${opt("area_m2")}, ${opt("energy_price_kwh")}
    FROM sites s WHERE s.brand_id = $1 ORDER BY s.name`, [brand.id])).rows;
  log(`Siti del brand: ${sites.length}`);
  if (!sites.length) process.exit(1);
  const siteIds = sites.map(s => s.id);

  /* 2 · device energia */
  const devCols = await tableCols(c, "devices");
  const devices = (await q(`
    SELECT d.id, d.site_id, d.name, d.category, d.last_seen
           ${devCols.has("model") ? ", d.model" : ", NULL AS model"}
    FROM devices d
    WHERE d.site_id = ANY($1) AND d.device_type = 'energy_monitor'
    ORDER BY d.site_id, d.category, d.name`, [siteIds])).rows;
  const devsBySite = new Map(siteIds.map(id => [id, []]));
  for (const d of devices) devsBySite.get(d.site_id)?.push(d);
  const devName = new Map(devices.map(d => [d.id, d]));
  log(`Device energia: ${devices.length}`);

  /* 3 · copertura e ultimo dato (daily = storico intero, hourly = finestra) */
  const cov = (await q(`
    SELECT d.site_id, min(ed.ts_day) AS first_day, max(ed.ts_day) AS last_day,
           count(DISTINCT ed.ts_day)::int AS days_with_data
    FROM energy_daily ed JOIN devices d ON d.id = ed.device_id
    WHERE d.site_id = ANY($1) GROUP BY d.site_id`, [siteIds])).rows;
  // normalizza subito le DATE in stringhe ISO: tutto il resto confronta stringhe
  for (const r of cov) { r.first_day = day(r.first_day); r.last_day = day(r.last_day); }
  const covBy = new Map(cov.map(r => [r.site_id, r]));
  const lastHour = (await q(`
    SELECT d.site_id, max(eh.ts_hour) AS last_ts
    FROM energy_hourly eh JOIN devices d ON d.id = eh.device_id
    WHERE d.site_id = ANY($1) GROUP BY d.site_id`, [siteIds])).rows;
  const lastBy = new Map(lastHour.map(r => [r.site_id, r.last_ts]));

  /* 4 · stato per sito (regola piattaforma) */
  const now = Date.now();
  for (const s of sites) {
    const devs = devsBySite.get(s.id) ?? [];
    const cv = covBy.get(s.id);
    const lastTs = lastBy.get(s.id) ?? cv?.last_day ?? null;
    const fresh = lastTs && (now - new Date(lastTs).getTime()) <= ONLINE_H * 3600e3;
    s._devs = devs;
    s._cov = cv ?? null;
    s._lastTs = lastTs;
    s._state = devs.length === 0 ? "pipeline"
      : fresh ? "online"
      : cv ? "offline"
      : "installing";
  }
  const counts = { online: 0, offline: 0, installing: 0, pipeline: 0 };
  sites.forEach(s => counts[s._state]++);
  log(`Stato: online ${counts.online} · offline ${counts.offline} · installing ${counts.installing} · pipeline ${counts.pipeline}`);

  /* 5 · cartelle output */
  const stamp = new Date().toISOString().slice(0, 10);
  const pkgName = `${slug(brand.name).toUpperCase()}_Energy_Export_${stamp}`;
  const outDir = path.join(OUT_BASE, pkgName);
  fs.mkdirSync(outDir, { recursive: true });

  /* 6 · tariffa storicizzata, se la tabella esiste (introspezione) — va
     caricata PRIMA dei CSV per-sito, che la usano per la colonna cost_eur */
  const priceHist = new Map(); // site → [{from, price}] ordinati
  try {
    const ph = await tableCols(c, "site_energy_price_history");
    if (ph.size) {
      const fromCol = ph.has("valid_from") ? "valid_from" : ph.has("effective_from") ? "effective_from" : null;
      const priceCol = ph.has("price_eur_kwh") ? "price_eur_kwh" : ph.has("price_kwh") ? "price_kwh" : ph.has("price") ? "price" : null;
      if (fromCol && priceCol) {
        const rows = (await q(`
          SELECT site_id, ${fromCol} AS vfrom, ${priceCol} AS price
          FROM site_energy_price_history WHERE site_id = ANY($1)
          ORDER BY site_id, ${fromCol}`, [siteIds])).rows;
        for (const r of rows) {
          if (!priceHist.has(r.site_id)) priceHist.set(r.site_id, []);
          priceHist.get(r.site_id).push({ from: day(r.vfrom), price: Number(r.price) });
        }
        log(`Tariffe storicizzate: ${rows.length} righe`);
      }
    }
  } catch { /* tabella assente: si usa la tariffa piatta del sito */ }
  function effectivePrice(s, dKey) {
    const hist = priceHist.get(s.id);
    if (hist?.length) {
      let p = null;
      for (const h of hist) { if (h.from <= dKey) p = h.price; else break; }
      if (p != null && Number.isFinite(p) && p > 0) return p;
    }
    const flat = Number(s.energy_price_kwh);
    return Number.isFinite(flat) && flat > 0 ? flat : null; // MAI un fallback inventato
  }

  /* 7 · per ogni sito con storico: CSV */
  const hourlyFrom = new Date(now - HOURLY_MONTHS * 30.44 * 86400e3).toISOString();
  const exportable = sites.filter(s => s._cov); // è o è stato online
  const perSiteDaily = new Map(); // site → [{day, kwh, peak, minNight, price}]

  for (const s of exportable) {
    const dir = path.join(outDir, slug(`${brand.name}_${s.name}`));
    fs.mkdirSync(dir, { recursive: true });
    const devIds = s._devs.map(d => d.id);

    writeCsv(path.join(dir, "site_info.csv"),
      ["site_id", "name", "city", "country", "timezone", "area_m2", "energy_price_kwh_eur", "status", "first_data_day", "last_data"],
      [[s.id, s.name, s.city, s.country, s.timezone, s.area_m2, s.energy_price_kwh, s._state, day(s._cov.first_day), s._lastTs ? new Date(s._lastTs).toISOString() : ""]]);

    writeCsv(path.join(dir, "devices.csv"),
      ["device_id", "name", "category", "model", "last_seen_utc"],
      s._devs.map(d => [d.id, d.name, d.category, d.model, d.last_seen ? new Date(d.last_seen).toISOString() : ""]));

    /* hourly — long format, finestra di retention */
    const hr = await q(`
      SELECT eh.ts_hour, eh.device_id, eh.metric, eh.value_avg, eh.value_sum,
             eh.value_min, eh.value_max, eh.sample_count
      FROM energy_hourly eh
      WHERE eh.device_id = ANY($1) AND eh.ts_hour >= $2
      ORDER BY eh.ts_hour, eh.device_id, eh.metric`, [devIds, hourlyFrom]);
    writeCsv(path.join(dir, "energy_hourly.csv"),
      ["ts_utc", "ts_local", "device_id", "device_name", "category", "metric", "unit", "value", "value_min", "value_max", "samples"],
      hr.rows.map(r => {
        const d = devName.get(r.device_id);
        const value = isEnergyMetric(r.metric) ? r.value_sum : r.value_avg;
        return [new Date(r.ts_hour).toISOString(), localStamp(new Date(r.ts_hour), s.timezone),
          r.device_id, d?.name, d?.category, shortMetric(r.metric), unitOf(r.metric),
          r2(Number(value)), isPowerMetric(r.metric) ? r2(Number(r.value_min)) : "",
          isPowerMetric(r.metric) ? r2(Number(r.value_max)) : "", r.sample_count];
      }));

    /* daily — long format, storico intero */
    const dr = await q(`
      SELECT ed.ts_day, ed.device_id, ed.metric, ed.value_avg, ed.value_sum,
             ed.value_min, ed.value_max, ed.sample_count
      FROM energy_daily ed
      WHERE ed.device_id = ANY($1)
      ORDER BY ed.ts_day, ed.device_id, ed.metric`, [devIds]);
    writeCsv(path.join(dir, "energy_daily.csv"),
      ["day", "device_id", "device_name", "category", "metric", "unit", "value", "value_min", "value_max", "samples"],
      dr.rows.map(r => {
        const d = devName.get(r.device_id);
        const value = isEnergyMetric(r.metric) ? r.value_sum : r.value_avg;
        return [day(r.ts_day), r.device_id, d?.name, d?.category, shortMetric(r.metric), unitOf(r.metric),
          r2(Number(value)), isPowerMetric(r.metric) ? r2(Number(r.value_min)) : "",
          isPowerMetric(r.metric) ? r2(Number(r.value_max)) : "", r.sample_count];
      }));

    /* daily wide — cortesia Excel. kWh col fix 16/10, per categoria. */
    const byDay = new Map();
    for (const r of dr.rows) {
      const k = day(r.ts_day);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push({ ...r, ts: k });
    }
    /* min notturno: dalle ore locali 01–05 — esiste solo dentro la finestra
       hourly (retention), e il README lo dichiara */
    const nightMin = new Map(); // day → kW min
    for (const r of hr.rows) {
      if (!isPowerMetric(r.metric)) continue;
      if (devName.get(r.device_id)?.category !== "general") continue;
      const local = localStamp(new Date(r.ts_hour), s.timezone); // "YYYY-MM-DD HH:mm"
      const h = Number(local.slice(11, 13));
      if (h >= 1 && h < 5) {
        const dKey = local.slice(0, 10);
        const vMin = Number(r.value_min ?? r.value_avg);
        if (Number.isFinite(vMin)) nightMin.set(dKey, Math.min(nightMin.get(dKey) ?? Infinity, vMin));
      }
    }
    const hasCat = (name) => s._devs.some(d => d.category === name);
    const dailyRows = [];
    const dailyForAnalytics = [];
    for (const [dKey, rows] of [...byDay.entries()].sort()) {
      const gen = rows.filter(r => devName.get(r.device_id)?.category === "general");
      const cat = (name) => hasCat(name)
        ? r1(rowsToKwh(rows.filter(r => devName.get(r.device_id)?.category === name), 24)) : "";
      const kwhTotal = rowsToKwh(gen, 24);
      const price = effectivePrice(s, dKey);
      /* picco del giorno dal value_max del daily (copre TUTTO lo storico) */
      let peak = null;
      for (const r of gen) {
        if (!isPowerMetric(r.metric)) continue;
        const v = Number(r.value_max);
        if (Number.isFinite(v) && (peak == null || v > peak)) peak = v;
      }
      const mn = nightMin.get(dKey) ?? null;
      dailyRows.push([dKey, r1(kwhTotal), cat("hvac"), cat("lighting"), cat("plugs"),
        peak != null ? r2(peak) : "", mn != null && mn !== Infinity ? r2(mn) : "",
        price != null ? r2(kwhTotal * price) : "", r1(kwhTotal * CO2_EF)]);
      dailyForAnalytics.push({ day: dKey, kwh: kwhTotal, peak, minNight: mn === Infinity ? null : mn, price });
    }
    writeCsv(path.join(dir, "energy_daily_wide.csv"),
      ["day", "kwh_total", "kwh_hvac", "kwh_lighting", "kwh_plugs", "kw_peak", "kw_min_night", "cost_eur", "co2_kg"],
      dailyRows);
    perSiteDaily.set(s.id, dailyForAnalytics);
    log(`CSV ${s.name}: hourly ${hr.rows.length} righe · daily ${dr.rows.length}`);
  }

  /* 8 · analytics di flotta */
  log("Analisi di confronto…");
  const D30 = new Date(now - 30 * 86400e3).toISOString().slice(0, 10);
  const D365 = new Date(now - 365 * 86400e3).toISOString().slice(0, 10);
  const D730 = new Date(now - 730 * 86400e3).toISOString().slice(0, 10);
  const analytics = [];
  for (const s of exportable) {
    const dd = perSiteDaily.get(s.id) ?? [];
    const win = (from, to) => dd.filter(r => r.day >= from && (!to || r.day < to));
    const sum = (rows) => rows.reduce((a, r) => a + (r.kwh || 0), 0);
    /* il taglio della finestra è in UTC ma i giorni sono locali al sito: per
       i fusi avanti (Cina) entrano 31 chiavi-giorno → si tengono le ULTIME
       30/365, così la copertura non supera mai il 100% (dd è ordinato) */
    const clamp = (rows, n) => rows.length > n ? rows.slice(-n) : rows;
    const last30 = clamp(win(D30), 30), last365 = clamp(win(D365), 365), prev365 = win(D730, D365);
    const area = Number(s.area_m2) > 0 ? Number(s.area_m2) : null;
    const covDays30 = last30.filter(r => r.kwh > 0).length;
    const coverage30 = Math.round((covDays30 / 30) * 100);
    const kwh30 = sum(last30), kwh12m = sum(last365), kwhPrev = sum(prev365);
    const nightMins = last30.map(r => r.minNight).filter(v => v != null).sort((a, b) => a - b);
    const baseload = nightMins.length >= 7 ? nightMins[Math.floor(nightMins.length / 2)] : null;
    const avgKw30 = covDays30 > 0 ? kwh30 / (covDays30 * 24) : null;
    let peak = null, peakDay = null;
    for (const r of last365) if (r.peak != null && (peak == null || r.peak > peak)) { peak = r.peak; peakDay = r.day; }
    const cost12 = last365.reduce((a, r) => a + (r.price != null ? r.kwh * r.price : 0), 0);
    const hasPrice = last365.some(r => r.price != null);
    analytics.push({
      site: s, coverage30,
      kwh30: r1(kwh30), eui30: area ? r2(kwh30 / area) : null,
      kwh12m: r1(kwh12m), eui12m: area ? r1(kwh12m / area) : null,
      yoyPct: kwhPrev > 0 && prev365.length >= 300 ? Math.round(((kwh12m - kwhPrev) / kwhPrev) * 100) : null,
      baseloadKw: baseload != null ? r2(baseload) : null,
      baseloadSharePct: baseload != null && avgKw30 > 0 ? Math.round((baseload / avgKw30) * 100) : null,
      peakKw: peak != null ? r2(peak) : null, peakDay,
      cost12m: hasPrice ? Math.round(cost12) : null,
      co2kg12m: Math.round(kwh12m * CO2_EF),
      ranked: coverage30 >= COVERAGE_MIN,
    });
  }
  writeCsv(path.join(outDir, "02_fleet_analytics.csv"),
    ["site", "city", "country", "area_m2", "coverage_30d_pct", "kwh_30d", "kwh_per_m2_30d",
     "kwh_12m", "kwh_per_m2_12m", "yoy_pct", "baseload_kw", "baseload_share_pct",
     "peak_kw", "peak_day", "cost_eur_12m", "co2_kg_12m", "in_ranking"],
    analytics.map(a => [a.site.name, a.site.city, a.site.country, a.site.area_m2, a.coverage30,
      a.kwh30, a.eui30, a.kwh12m, a.eui12m, a.yoyPct, a.baseloadKw, a.baseloadSharePct,
      a.peakKw, a.peakDay, a.cost12m, a.co2kg12m, a.ranked ? "yes" : "no"]));

  /* 9 · fleet summary */
  writeCsv(path.join(outDir, "01_fleet_summary.csv"),
    ["site", "city", "country", "area_m2", "status", "energy_devices", "sub_circuits",
     "first_data_day", "last_data_utc", "coverage_30d_pct", "kwh_30d", "kwh_per_m2_30d"],
    sites.map(s => {
      const a = analytics.find(x => x.site.id === s.id);
      return [s.name, s.city, s.country, s.area_m2, s._state,
        s._devs.length, s._devs.filter(d => d.category && d.category !== "general").length,
        s._cov ? day(s._cov.first_day) : "", s._lastTs ? new Date(s._lastTs).toISOString() : "",
        a?.coverage30 ?? "", a?.kwh30 ?? "", a?.eui30 ?? ""];
    }));

  /* 10 · README */
  fs.writeFileSync(path.join(outDir, "00_README.txt"), readmeText(brand.name, stamp), "utf8");

  /* 11 · PDF (via Edge headless); senza Edge restano gli HTML */
  const statusHtml = buildStatusHtml(brand.name, stamp, sites, counts, analytics);
  const analysisHtml = buildAnalysisHtml(brand.name, stamp, analytics, COVERAGE_MIN);
  fs.writeFileSync(path.join(outDir, "Fleet_Status.html"), statusHtml, "utf8");
  fs.writeFileSync(path.join(outDir, "Fleet_Analysis.html"), analysisHtml, "utf8");
  if (!NO_PDF) {
    try {
      await htmlToPdf(path.join(outDir, "Fleet_Status.html"), path.join(outDir, "Fleet_Status.pdf"));
      await htmlToPdf(path.join(outDir, "Fleet_Analysis.html"), path.join(outDir, "Fleet_Analysis.pdf"));
      fs.unlinkSync(path.join(outDir, "Fleet_Status.html"));
      fs.unlinkSync(path.join(outDir, "Fleet_Analysis.html"));
      log("PDF generati");
    } catch (e) {
      log(`PDF non generati (${e.message}) — restano le versioni HTML, stampabili dal browser`);
    }
  }

  if (client) await client.end();
  log(`FATTO → ${outDir}`);
  console.log(`\nPer lo ZIP:  Compress-Archive -Path "${outDir}" -DestinationPath "${outDir}.zip"`);
})().catch(e => { console.error("ERRORE:", e.message); process.exit(1); });

/* ── README ────────────────────────────────────────────────────────────── */
function readmeText(brandName, stamp) {
  return `${brandName.toUpperCase()} — ENERGY DATA EXPORT (${stamp})
Generated by FGB Monitoring · xmonitoring.fgb-studio.com

CONTENTS
  01_fleet_summary.csv    One row per site: status, devices, data coverage.
  02_fleet_analytics.csv  Comparison indicators per site (see ANALYTICS).
  Fleet_Status.pdf        Fleet overview, human-readable.
  Fleet_Analysis.pdf      Comparison charts.
  <SITE>/                 One folder per site that has transmitted data.

SITE STATUS (same rule as the FGB platform)
  online      last reading within 48 hours
  offline     has transmitted in the past, currently silent
  installing  devices registered, no reading received yet
  pipeline    monitoring point planned, devices not yet installed

DATA FILES (per site)
  energy_hourly.csv  Long format, one row per hour x device x metric.
                     Retention limit: hourly data is kept 365 days, so this
                     file covers at most the last 12 months.
  energy_daily.csv   Long format, full available history (kept indefinitely).
  energy_daily_wide.csv  One row per day, convenience columns for Excel.

COLUMN SEMANTICS (important)
  metric=power_kw    value = average power in kW over the bucket
                     (value_min / value_max = min/max within the bucket)
  metric=energy_kwh  value = total energy in kWh for the bucket
  Never sum power_kw values to obtain kWh: multiply the average by the
  bucket duration, or use the energy_kwh rows / the *_wide file, where the
  conversion has already been done correctly.
  kw_min_night       minimum power between 01:00-05:00 local time (baseload
                     indicator); only available inside the hourly window.
  cost_eur           energy x site tariff (historicized where configured).
                     Empty when no tariff is configured - never estimated.
  co2_kg             energy x 0.233 kg CO2e/kWh (Italian grid average).

TIMESTAMPS
  ts_utc is UTC (ISO 8601). ts_local is the store's local time, timezone
  declared in site_info.csv. Days in daily files are site-local days.

ANALYTICS (02_fleet_analytics.csv)
  kwh_per_m2_*       energy intensity (EUI); comparable across store sizes.
  baseload_kw        median nightly minimum over the last 30 days.
  baseload_share_pct baseload as % of average power: what stays on at night.
  yoy_pct            last 12 months vs the previous 12 (needs >=300 days
                     of history in the earlier year, otherwise empty).
  coverage_30d_pct   days with data in the last 30. Sites below 90% are
                     flagged in_ranking=no and excluded from rankings.
  kw_peak            maximum power of the day (from daily aggregates: full
                     history). kw_min_night only within the hourly window.

HONESTY RULES
  Missing data is missing: no interpolation, no estimated fallbacks.
  Files are UTF-8 with BOM, comma-separated, dot decimal, ISO dates.

Contact: monitoring@fgb-studio.com
`;
}
