import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { billId, filePath } = await req.json();
    if (!billId || !filePath) {
      return new Response(JSON.stringify({ error: "Missing billId or filePath" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update bill status to analyzing
    await supabase.from("bills").update({ status: "analyzing" }).eq("id", billId);

    // Download the PDF file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("bills")
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("Failed to download file:", downloadError);
      await supabase.from("bills").update({ status: "error" }).eq("id", billId);
      return new Response(JSON.stringify({ error: "Failed to download file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert PDF to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);

    console.log(`Analyzing bill ${billId}, file size: ${arrayBuffer.byteLength} bytes`);

    // Call AI Gateway with tool calling for structured output
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert energy bill analyzer. You extract structured data from energy bills (electricity, gas, etc.).
Extract all available data points from the bill. Always use numeric values without currency symbols.
If a value is not found in the bill, use null. Dates should be in YYYY-MM-DD format.
The billing_period_start and billing_period_end are critical - always try to find them.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this energy bill PDF and extract all relevant data. Extract: billing period dates, energy consumption (kWh), energy cost per kWh, total energy cost, peak power (kW), off-peak consumption, peak consumption, reactive energy (kVArh), power factor, fixed charges, taxes, total amount, and currency. Also extract any additional noteworthy data.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_bill_data",
              description: "Extract structured energy bill data",
              parameters: {
                type: "object",
                properties: {
                  billing_period_start: { type: "string", description: "Start date in YYYY-MM-DD format" },
                  billing_period_end: { type: "string", description: "End date in YYYY-MM-DD format" },
                  energy_consumption_kwh: { type: "number", description: "Total energy consumption in kWh" },
                  energy_cost_per_kwh: { type: "number", description: "Cost per kWh" },
                  total_energy_cost: { type: "number", description: "Total energy cost" },
                  peak_power_kw: { type: "number", description: "Peak power demand in kW" },
                  off_peak_consumption_kwh: { type: "number", description: "Off-peak consumption in kWh" },
                  peak_consumption_kwh: { type: "number", description: "Peak hours consumption in kWh" },
                  reactive_energy_kvarh: { type: "number", description: "Reactive energy in kVArh" },
                  power_factor: { type: "number", description: "Power factor" },
                  fixed_charges: { type: "number", description: "Fixed charges amount" },
                  taxes: { type: "number", description: "Tax amount" },
                  total_amount: { type: "number", description: "Total bill amount" },
                  currency: { type: "string", description: "Currency code (EUR, USD, GBP, etc.)" },
                  additional_data: {
                    type: "object",
                    description: "Any additional noteworthy data from the bill",
                    properties: {},
                    additionalProperties: true,
                  },
                },
                required: ["billing_period_start", "billing_period_end"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_bill_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      await supabase.from("bills").update({ status: "error" }).eq("id", billId);
      
      const statusCode = aiResponse.status === 429 ? 429 : aiResponse.status === 402 ? 402 : 500;
      const errorMsg = aiResponse.status === 429 ? "Rate limit exceeded" : aiResponse.status === 402 ? "AI credits exhausted" : "AI analysis failed";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    console.log("AI response received:", JSON.stringify(aiData).substring(0, 500));

    let extractedData: any = {};
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        extractedData = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Failed to parse AI response:", e);
        await supabase.from("bills").update({ status: "error" }).eq("id", billId);
        return new Response(JSON.stringify({ error: "Failed to parse AI analysis" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.error("No tool call in AI response");
      await supabase.from("bills").update({ status: "error" }).eq("id", billId);
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Extracted bill data:", JSON.stringify(extractedData));

    const { error: insertError } = await supabase.from("bill_data").insert({
      bill_id: billId,
      billing_period_start: extractedData.billing_period_start || null,
      billing_period_end: extractedData.billing_period_end || null,
      energy_consumption_kwh: extractedData.energy_consumption_kwh || null,
      energy_cost_per_kwh: extractedData.energy_cost_per_kwh || null,
      total_energy_cost: extractedData.total_energy_cost || null,
      peak_power_kw: extractedData.peak_power_kw || null,
      off_peak_consumption_kwh: extractedData.off_peak_consumption_kwh || null,
      peak_consumption_kwh: extractedData.peak_consumption_kwh || null,
      reactive_energy_kvarh: extractedData.reactive_energy_kvarh || null,
      power_factor: extractedData.power_factor || null,
      fixed_charges: extractedData.fixed_charges || null,
      taxes: extractedData.taxes || null,
      total_amount: extractedData.total_amount || null,
      currency: extractedData.currency || "EUR",
      additional_data: extractedData.additional_data || {},
    });

    if (insertError) {
      console.error("Failed to insert bill data:", insertError);
      await supabase.from("bills").update({ status: "error" }).eq("id", billId);
      return new Response(JSON.stringify({ error: "Failed to save extracted data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("bills").update({ status: "completed" }).eq("id", billId);
    console.log(`Bill ${billId} analysis completed successfully`);

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-bill error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
