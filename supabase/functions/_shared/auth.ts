// Autenticazione condivisa per le edge functions (audit C2/A2, nov 2026).
//
// Due pezzi:
//
//  · requireUser(req) — pretende un JWT utente valido (non basta la anon
//    key come Bearer: getUser la rifiuta) e restituisce sia l'utente sia un
//    client che opera CON IL TOKEN DEL CHIAMANTE: ogni query passa dalla
//    RLS perimetrata (`accessible_site_ids()`), quindi l'utente vede solo i
//    suoi siti. Prima qui giravano client service-role: chiunque conoscesse
//    l'URL leggeva i dati di qualunque sito.
//
//  · rateLimit(userId, fn, max) — contatore giornaliero su public.ai_usage
//    (RLS chiusa, scrive solo il service role). Ferma il consumo del
//    credito AI aziendale da parte di un singolo account.

import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

export async function requireUser(req: Request): Promise<
  { ok: true; user: User; client: SupabaseClient } | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing bearer token" };
  }
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    return { ok: false, status: 401, error: "Invalid or expired token" };
  }
  return { ok: true, user: data.user, client };
}

/** true = sotto il tetto (e incrementa); false = tetto superato. */
export async function rateLimit(userId: string, fn: string, max: number): Promise<boolean> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await admin.from("ai_usage")
    .select("n").eq("user_id", userId).eq("day", day).eq("fn", fn).maybeSingle();
  const n = data?.n ?? 0;
  if (n >= max) return false;
  await admin.from("ai_usage").upsert(
    { user_id: userId, day, fn, n: n + 1 },
    { onConflict: "user_id,day,fn" },
  );
  return true;
}

/** Sanifica un campo libero prima che entri in un prompt AI (audit A2:
    il testo del chiamante influenzava le "diagnosi" mostrate agli operatori). */
export function promptSafe(s: unknown, maxLen = 120): string {
  return String(s ?? "")
    .replace(/[\r\n\t]+/g, " ")        // niente righe nuove: niente finti ruoli/istruzioni
    .replace(/[#*`<>{}[\]\\]/g, "")     // via la sintassi markdown/markup
    .slice(0, maxLen)
    .trim();
}
