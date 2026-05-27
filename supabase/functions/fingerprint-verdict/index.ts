import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerdictRequest {
  siteName?: string;
  overall: number;
  modules: {
    energy: { enabled: boolean; score: number };
    air:    { enabled: boolean; score: number };
    water:  { enabled: boolean; score: number };
  };
  alerts: { critical: number; warning: number };
  telemetry?: {
    co2?: number | null;
    temperature?: number | null;
    humidity?: number | null;
    voc?: number | null;
    pm25?: number | null;
    powerKw?: number | null;
    baselinePowerKw?: number | null;
    hvacKw?: number | null;
    lightingKw?: number | null;
    waterFlow?: number | null;
    leakDetected?: boolean | null;
  };
}

const SYSTEM_PROMPT = `You are an expert Facility Manager analyzing a building's live telemetry.
Generate a SHORT, ACTIONABLE verdict for the operator.
Rules:
- headline: max 6 words, imperative or descriptive (e.g. "Open a Window", "All Systems Nominal", "Lower the AC Setpoint").
- reason: ONE short sentence (max 110 chars) citing the SPECIFIC metric that drives the verdict (value + unit). No fluff.
- tone: GOOD | OK | WARNING | CRITICAL — must match the severity of the situation.
- Prioritize: leaks > critical alerts > air quality (CO2>1000ppm, PM2.5>25, VOC high) > energy overconsumption (>20% above baseline) > warnings > general status.
- Suggest a concrete action when a problem exists (open window, lower setpoint, check leak, etc.).
- Always in English. No emojis. No quotes.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as VerdictRequest;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPayload = JSON.stringify(body, null, 2);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Site telemetry snapshot:\n${userPayload}\n\nReturn the verdict via the function call.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "set_verdict",
            description: "Set the fingerprint verdict shown to the facility operator.",
            parameters: {
              type: "object",
              properties: {
                headline: { type: "string", description: "Max 6 words." },
                reason:   { type: "string", description: "One short sentence, max 110 chars, with concrete metric." },
                tone:     { type: "string", enum: ["GOOD", "OK", "WARNING", "CRITICAL"] },
              },
              required: ["headline", "reason", "tone"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "set_verdict" } },
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("[fingerprint-verdict] gateway error", aiResp.status, text);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "credits_exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "ai_gateway_error" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments;
    if (!args) {
      return new Response(JSON.stringify({ error: "no_tool_call" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: { headline: string; reason: string; tone: string };
    try {
      parsed = typeof args === "string" ? JSON.parse(args) : args;
    } catch {
      return new Response(JSON.stringify({ error: "parse_error" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tone = (["GOOD", "OK", "WARNING", "CRITICAL"].includes(parsed.tone) ? parsed.tone : "OK") as
      "GOOD" | "OK" | "WARNING" | "CRITICAL";

    return new Response(JSON.stringify({
      headline: String(parsed.headline || "").slice(0, 60),
      reason:   String(parsed.reason   || "").slice(0, 140),
      tone,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[fingerprint-verdict] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});