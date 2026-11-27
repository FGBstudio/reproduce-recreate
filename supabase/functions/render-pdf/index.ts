// render-pdf — HTML -> PDF lato server (A4 vettoriale nitido, scaricato diretto).
//
// Il report e' HTML print-ready: renderizzarlo con la stampa del browser
// dipende dalle impostazioni della finestra (margini/scala) e lascia bordi.
// Qui lo convertiamo lato server con dimensioni fisse A4 e margini 0, cosi'
// esce SEMPRE giusto e il client lo scarica direttamente.
//
// Servizio: PDFShift (https://pdfshift.io). Secret richiesto:
//   supabase secrets set PDFSHIFT_API_KEY=<la-tua-chiave>
// Finche' la chiave non c'e', la funzione risponde 503 e il client ripiega
// sulla stampa del browser.
//
// Sicurezza: utente autenticato obbligatorio (requireUser) + CORS allowlist
// + tetto giornaliero per account (non si bruciano i crediti del servizio).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders as buildCors } from "../_shared/cors.ts";
import { requireUser, rateLimit } from "../_shared/auth.ts";

const MAX_HTML_BYTES = 8 * 1024 * 1024; // 8 MB

serve(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const auth = await requireUser(req);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const MAX_PER_DAY = Number(Deno.env.get("PDF_DAILY_LIMIT") ?? "200");
    if (!(await rateLimit(auth.user.id, "render-pdf", MAX_PER_DAY))) {
      return json({ error: "Daily PDF quota reached" }, 429);
    }

    const key = Deno.env.get("PDFSHIFT_API_KEY");
    if (!key) return json({ error: "PDF service not configured" }, 503);

    const { html } = await req.json() as { html?: string };
    if (typeof html !== "string" || html.length < 50) return json({ error: "Missing html" }, 400);
    if (new Blob([html]).size > MAX_HTML_BYTES) return json({ error: "HTML too large" }, 413);

    const resp = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa("api:" + key),
      },
      body: JSON.stringify({
        source: html,
        format: "A4",
        margin: "0",
        use_print: true,     // usa le regole @media print (A4, margini 0, sfondi)
        sandbox: false,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error("PDFShift error", resp.status, detail.slice(0, 500));
      return json({ error: "PDF render failed", status: resp.status }, 502);
    }

    const pdf = await resp.arrayBuffer();
    return new Response(pdf, {
      headers: {
        ...cors,
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=\"report.pdf\"",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("render-pdf failed", e);
    return json({ error: "Internal error" }, 500);
  }
});
