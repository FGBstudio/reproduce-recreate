/* Converte la connection string diretta (IPv6-only) nel pooler IPv4 di
   Supabase, scoprendo la region per tentativi. Non stampa mai credenziali. */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const f = path.join(__dirname, ".dbenv");
const raw = fs.readFileSync(f, "utf8");
const m = raw.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/m);
if (!m) { console.error("formato .dbenv inatteso"); process.exit(1); }
const u = new URL(m[1]);
const ref = (u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/) || [])[1];

const REGIONS = ["eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-south-1",
  "eu-north-1", "us-east-1", "us-east-2", "us-west-1", "ap-southeast-1"];

(async () => {
  if (!ref) {
    // gia' un pooler o host custom: prova cosi' com'e'
    const c = new Client({ connectionString: m[1], ssl: { rejectUnauthorized: false } });
    try { await c.connect(); await c.query("SELECT 1"); await c.end(); console.log("OK: la stringa attuale funziona"); }
    catch (e) { console.error("FALLITA:", e.message); process.exit(1); }
    return;
  }
  const hosts = [];
  for (const prefix of ["aws-1", "aws-0", "aws-2"]) for (const region of REGIONS) hosts.push({ region: `${prefix}-${region}`, host: `${prefix}-${region}.pooler.supabase.com` });
  for (const { region, host } of hosts) {
    const url = `postgresql://${encodeURIComponent("postgres." + ref)}:${u.password}@${host}:5432${u.pathname}`;
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    try {
      await c.connect();
      await c.query("SELECT 1");
      await c.end();
      fs.writeFileSync(f, `DATABASE_URL=${url}\n`, "utf8");
      console.log(`CONNESSO via pooler ${region} — .dbenv aggiornato`);
      return;
    } catch (e) {
      const msg = String(e.message || "");
      if (/password/i.test(msg)) { console.error(`AUTENTICAZIONE FALLITA (${region}): password errata — va cambiata su Supabase`); process.exit(2); }
      console.log(`  ${region}: ${msg.slice(0, 60)}`);
      try { await c.end(); } catch { /* gia' chiuso */ }
    }
  }
  console.error("Nessuna region ha accettato: rete bloccata o ref/region fuori lista");
  process.exit(1);
})();
