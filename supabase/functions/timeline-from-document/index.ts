import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Timeline di progetto da DOCUMENTO (rev 15/09, richiesta owner).
 *
 * Riceve un documento di pianificazione (Gantt, cronoprogramma, scorecard
 * con scadenze — PDF o immagine) e ne estrae le attivita' CON LE DATE,
 * scrivendole in certification_milestones (milestone_type 'timeline').
 *
 * Regola chiave: le date vanno SEMPRE compilate. Se sono scritte si usano
 * quelle; se non lo sono si RICAVANO (durate, posizioni delle barre del
 * Gantt rispetto all'asse temporale, sequenza delle attivita', milestone
 * note, span di progetto). Le date ricavate sono marcate estimated: sara'
 * il PM a correggerle se qualcosa non torna. Un secondo passaggio server
 * ripara comunque i buchi per interpolazione: nessuna riga esce senza date.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Activity {
  name: string;
  start_date: string | null;
  end_date: string | null;
  status?: string | null;
  dates_estimated?: boolean;
  note?: string | null;
}

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const parse = (d: string | null | undefined): number | null => {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? t : null;
};

/**
 * Rete di sicurezza sulle date: l'AI deve gia' compilarle tutte, ma se
 * qualcosa arriva vuoto si interpola tra i vicini datati (o si distribuisce
 * sullo span di progetto). Garantisce end >= start e nessun null in uscita.
 */
function backfillDates(activities: Activity[], projectStart: string | null, projectEnd: string | null): Activity[] {
  const n = activities.length;
  if (n === 0) return activities;
  const starts: (number | null)[] = activities.map(a => parse(a.start_date));
  const ends: (number | null)[] = activities.map(a => parse(a.end_date));

  const known = [...starts, ...ends].filter((v): v is number => v != null);
  let span0 = parse(projectStart) ?? (known.length ? Math.min(...known) : Date.now());
  let span1 = parse(projectEnd) ?? (known.length ? Math.max(...known) : span0 + 365 * DAY);
  if (span1 <= span0) span1 = span0 + 365 * DAY;

  // start mancante: fine dell'attivita' precedente (o quota dello span)
  for (let i = 0; i < n; i++) {
    if (starts[i] == null) {
      const prevEnd = i > 0 ? (ends[i - 1] ?? starts[i - 1]) : null;
      starts[i] = prevEnd ?? span0 + Math.round(((span1 - span0) * i) / n);
      activities[i].dates_estimated = true;
    }
  }
  // end mancante: inizio della successiva datata, o quota dello span
  for (let i = 0; i < n; i++) {
    if (ends[i] == null) {
      let next: number | null = null;
      for (let j = i + 1; j < n && next == null; j++) next = starts[j];
      ends[i] = next ?? Math.min(span1, starts[i]! + Math.round((span1 - span0) / n));
      activities[i].dates_estimated = true;
    }
    if (ends[i]! < starts[i]!) ends[i] = starts[i];
  }
  return activities.map((a, i) => ({ ...a, start_date: iso(starts[i]!), end_date: iso(ends[i]!) }));
}

const VALID_STATUS = new Set(["not_started", "pending", "in_progress", "achieved"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY is not configured");

    // Verify auth (stesso pattern di analyze-bill)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { certificationId, fileBase64, mimeType, replace } = await req.json();
    if (!certificationId || !fileBase64) {
      return new Response(JSON.stringify({ error: "Missing certificationId or fileBase64" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // La certificazione deve esistere (e intercetta id sbagliati prima dell'AI)
    const { data: cert, error: certErr } = await supabase
      .from("certifications")
      .select("id, cert_type, issued_date, expiry_date")
      .eq("id", certificationId)
      .single();
    if (certErr || !cert) {
      return new Response(JSON.stringify({ error: "Certification not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mt = typeof mimeType === "string" && mimeType ? mimeType : "application/pdf";
    console.log(`timeline-from-document: cert ${certificationId}, payload ${Math.round(fileBase64.length / 1024)}KB, ${mt}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert project planner who reads construction/certification project schedules: Gantt charts, timeline tables, milestone lists, kickoff decks.
Extract the project activities IN CHRONOLOGICAL ORDER with their dates.

DATE RULES — the whole point of this tool:
- Every activity MUST come out with both start_date and end_date in YYYY-MM-DD. Never leave them empty.
- If dates are written explicitly (columns, labels, headers), use them. Set dates_estimated=false.
- If dates are NOT written, DERIVE them and set dates_estimated=true:
  * from durations ("2 weeks", "3 mesi") chained onto the previous activity;
  * from the position and length of Gantt bars measured against the chart's time axis (month/quarter headers);
  * from the sequence of activities within the overall project start/end;
  * from named milestones or phase boundaries.
- Month-only precision -> first day of the month for starts, last day for ends. Quarter-only -> first/last day of the quarter.
- A milestone (zero duration) gets start_date = end_date.
- Detect the document language (Italian schedules are common: "settimane", "mesi", "consegna", "sopralluogo") but always answer with the activity names AS WRITTEN in the document.
- status: "achieved" if clearly completed (checkmarks, 100%, strikethrough, dates fully in the past when the doc shows progress), "in_progress" if partially done or currently running, otherwise "not_started". When unsure use "not_started".`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the full project timeline from this planning document${cert.cert_type ? ` (certification project: ${cert.cert_type})` : ""}. List every activity/phase with its dates following the date rules. Also report the overall project start and end if the document shows them.`,
              },
              { type: "image_url", image_url: { url: `data:${mt};base64,${fileBase64}` } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_timeline",
              description: "Structured project timeline extracted from the document",
              parameters: {
                type: "object",
                properties: {
                  project_start: { type: "string", description: "Overall project start, YYYY-MM-DD, if shown" },
                  project_end: { type: "string", description: "Overall project end, YYYY-MM-DD, if shown" },
                  activities: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Activity/phase name as written in the document" },
                        start_date: { type: "string", description: "YYYY-MM-DD, explicit or derived - REQUIRED" },
                        end_date: { type: "string", description: "YYYY-MM-DD, explicit or derived - REQUIRED" },
                        status: { type: "string", enum: ["not_started", "pending", "in_progress", "achieved"] },
                        dates_estimated: { type: "boolean", description: "true when the dates were derived, not written" },
                        note: { type: "string", description: "How the dates were derived, when estimated" },
                      },
                      required: ["name", "start_date", "end_date"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["activities"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_timeline" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      const statusCode = aiResponse.status === 429 ? 429 : aiResponse.status === 402 ? 402 : 500;
      const errorMsg = aiResponse.status === 429 ? "Rate limit exceeded" : aiResponse.status === 402 ? "AI credits exhausted" : "AI analysis failed";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response");
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extracted: { project_start?: string; project_end?: string; activities?: Activity[] };
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse AI response:", e);
      return new Response(JSON.stringify({ error: "Failed to parse AI analysis" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = (extracted.activities || []).filter(a => a?.name?.trim());
    if (raw.length === 0) {
      return new Response(JSON.stringify({ error: "No activities found in the document" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rete di sicurezza: mai una riga senza date (fallback anche sulle date
    // della certificazione se il documento non dichiara lo span di progetto)
    const activities = backfillDates(
      raw,
      extracted.project_start ?? cert.issued_date ?? null,
      extracted.project_end ?? cert.expiry_date ?? null,
    );

    if (replace === true) {
      await supabase
        .from("certification_milestones")
        .delete()
        .eq("certification_id", certificationId)
        .eq("milestone_type", "timeline");
    }

    const rows = activities.map((a, i) => ({
      certification_id: certificationId,
      category: a.name.trim().slice(0, 200),
      requirement: a.note?.trim() || a.name.trim().slice(0, 200),
      status: VALID_STATUS.has(a.status || "") ? a.status : "not_started",
      start_date: a.start_date,
      due_date: a.end_date,
      completed_date: a.status === "achieved" ? a.end_date : null,
      milestone_type: "timeline",
      order_index: i + 1,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("certification_milestones")
      .insert(rows)
      .select("*");
    if (insertError) {
      console.error("Failed to insert timeline:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save extracted timeline" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const estimatedCount = activities.filter(a => a.dates_estimated).length;
    console.log(`timeline-from-document: ${rows.length} activities saved (${estimatedCount} with derived dates)`);

    return new Response(JSON.stringify({
      success: true,
      activities: inserted,
      estimatedCount,
      projectStart: extracted.project_start ?? null,
      projectEnd: extracted.project_end ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("timeline-from-document error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
