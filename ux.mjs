import puppeteer from 'puppeteer-core';
const chrome = '/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome';
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox','--disable-gpu','--no-proxy-server','--proxy-bypass-list=*'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const measure = () => page.evaluate(() => {
  const els = [...document.querySelectorAll('button, [role=button], a, input, .leaflet-marker-icon, .fgb-cluster')];
  return els.filter(e => e.offsetParent !== null).map(e => {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    return { tag: e.tagName, txt: (e.textContent||'').trim().slice(0,20) || e.className.toString().slice(0,25), w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize };
  }).filter(x => x.w > 0 && x.w < 390);
});

// ── 1. LOGIN: performance + form + target ──
const t0 = Date.now();
await page.goto('http://127.0.0.1:8080/#/auth', { waitUntil: 'networkidle2', timeout: 30000 }).catch(()=>{});
const loadMs = Date.now() - t0;
await new Promise(r=>setTimeout(r,2500));
const perf = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const fcp = performance.getEntriesByType('paint').find(p=>p.name==='first-contentful-paint');
  return { domContentLoaded: Math.round(nav?.domContentLoadedEventEnd||0), fcp: Math.round(fcp?.startTime||0), transferKB: Math.round((performance.getEntriesByType('resource').reduce((a,r)=>a+(r.transferSize||0),0))/1024) };
});
const formInfo = await page.evaluate(() => [...document.querySelectorAll('input')].map(i => ({ type: i.type, inputmode: i.inputMode||'-', autocomplete: i.autocomplete||'-', autocapitalize: i.autocapitalize||'-' })));
const loginTargets = await measure();

// ── 2. MAPPA: target barra inferiore ──
await page.goto('http://127.0.0.1:8080/#/', { waitUntil: 'networkidle2' }).catch(()=>{});
await new Promise(r=>setTimeout(r,5000));
const mapTargets = await measure();
const meta = await page.evaluate(() => ({ viewport: document.querySelector('meta[name=viewport]')?.content, overscroll: getComputedStyle(document.body).overscrollBehavior, touchAction: getComputedStyle(document.body).touchAction }));

// ── 3. SITO: target icone top + frecce carosello + swipe test ──
const cl = await page.$('.fgb-cluster'); if (cl) { await cl.click(); await new Promise(r=>setTimeout(r,2500)); }
const mk = await page.$('.leaflet-marker-icon.fgb-site-marker'); if (mk) { await mk.click(); await new Promise(r=>setTimeout(r,4000)); }
const siteTargets = await measure();
// swipe orizzontale sul carosello: cambia slide?
const dotsBefore = await page.evaluate(() => [...document.querySelectorAll('button, div')].filter(e=>e.className?.toString?.().includes('rounded-full') && e.getBoundingClientRect().width < 12).length);
await page.touchscreen.touchStart(320, 500); await page.touchscreen.touchMove(80, 500); await page.touchscreen.touchEnd();
await new Promise(r=>setTimeout(r,1500));
await page.screenshot({ path: '/home/claude/shots/ux_after_swipe.png' });
// testo minuscolo: censimento font < 11px visibili
const tinyText = await page.evaluate(() => {
  const walk = [...document.querySelectorAll('span,div,p')].filter(e=>e.children.length===0 && e.offsetParent && e.textContent.trim());
  const tiny = walk.filter(e => parseFloat(getComputedStyle(e).fontSize) < 11);
  return { total: walk.length, tiny: tiny.length, examples: tiny.slice(0,5).map(e=>({ fs: getComputedStyle(e).fontSize, t: e.textContent.trim().slice(0,18) })) };
});

console.log(JSON.stringify({ loadMs, perf, formInfo, meta, tinyText,
  loginSmall: loginTargets.filter(t=>t.h<44 && t.h>0),
  mapSmall: mapTargets.filter(t=>t.h<44),
  siteSmall: siteTargets.filter(t=>t.h<44).slice(0,15),
  dotsBefore }, null, 1));
await browser.close();
