import puppeteer from 'puppeteer-core';
const chrome = '/home/claude/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome';
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox','--disable-gpu','--no-proxy-server','--proxy-bypass-list=*'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const S = (n) => page.screenshot({ path: `/home/claude/shots/t_${n}.png` });
const wait = (ms) => new Promise(r=>setTimeout(r,ms));
const go = async (h, ms=4500) => { await page.goto('http://127.0.0.1:8080/'+h, { waitUntil: 'networkidle2', timeout: 30000 }).catch(()=>{}); await wait(ms); };

// 1) MAPPA: pannello KPI
await go('#/');
const clickByText = async (txt) => {
  const ok = await page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, [role=button], div, span')];
    const el = els.find(e => e.childElementCount===0 && e.textContent.trim()===t) || els.find(e => e.textContent.trim()===t);
    if (el) { el.closest('button, [role=button]')?.click() || el.click(); return true; }
    return false;
  }, txt);
  return ok;
};
await clickByText('KPI'); await wait(2500); await S('kpi_panel');
// 2) burger menu
await go('#/'); await page.mouse.click(37, 37); await wait(1800); await S('burger_menu');
// 3) search
await go('#/'); await page.mouse.click(181, 37); await wait(1800); await S('search');
// 4) region EU
await go('#/'); await clickByText('EU'); await wait(2500); await S('region_eu');
// 5) SITE VIEW e slide del carosello
await go('#/'); const m = await page.$('.leaflet-marker-icon'); if (m) { await m.click(); await wait(4000); }
await S('site_slide1');
for (let i=2;i<=4;i++){ await page.mouse.click(220, 717); await wait(2000); await S('site_slide'+i); }
// 6) moduli dalla barra in alto: energy, air, water, cert
const tabs = [['energy',84],['air',133],['water',181],['cert',229]];
for (const [name,x] of tabs){ await page.mouse.click(x, 87); await wait(3000); await S('site_'+name); }
// 7) wrapped (sparkle in alto al centro)
await page.mouse.click(183, 31); await wait(3000); await S('wrapped');
await browser.close(); console.log('TOUR OK');
