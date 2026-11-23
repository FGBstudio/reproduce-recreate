import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type VerdictTone = "GOOD" | "OK" | "WARNING" | "CRITICAL";

export interface FingerprintVerdict {
  headline: string;
  reason: string;
  tone: VerdictTone;
}

export interface FingerprintVerdictInput {
  siteId: string | null | undefined;
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
  /** Used while AI is loading or on error. */
  fallback: FingerprintVerdict;
}

// Bucket values to keep React-Query keys stable and avoid hammering the AI.
const bucket = (v: number | null | undefined, step: number) =>
  v == null || !Number.isFinite(v) ? null : Math.round(v / step) * step;

function signature(input: FingerprintVerdictInput): string {
  const t = input.telemetry || {};
  return [
    input.siteId,
    bucket(input.overall, 5),
    bucket(input.modules.energy.score, 5), input.modules.energy.enabled ? 1 : 0,
    bucket(input.modules.air.score, 5),    input.modules.air.enabled ? 1 : 0,
    bucket(input.modules.water.score, 5),  input.modules.water.enabled ? 1 : 0,
    input.alerts.critical, input.alerts.warning,
    bucket(t.co2, 100),
    bucket(t.temperature, 1),
    bucket(t.humidity, 5),
    bucket(t.voc, 50),
    bucket(t.pm25, 5),
    bucket(t.powerKw, 1),
    bucket(t.baselinePowerKw, 1),
    bucket(t.hvacKw, 1),
    bucket(t.lightingKw, 1),
    bucket(t.waterFlow, 1),
    t.leakDetected ? 1 : 0,
  ].join("|");
}

export function useFingerprintVerdict(input: FingerprintVerdictInput): FingerprintVerdict {
  const sig = signature(input);
  const enabled = !!input.siteId;

  const { data } = useQuery<FingerprintVerdict>({
    queryKey: ["fingerprint-verdict", sig],
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      // Audit A2: la funzione ora pretende un UTENTE autenticato — la anon
      // key come Bearer non basta più. functions.invoke allega da solo il
      // token della sessione corrente.
      if (!supabase) throw new Error("supabase_missing");
      const { data: json, error } = await supabase.functions.invoke("fingerprint-verdict", {
        body: {
          siteName: input.siteName,
          overall: input.overall,
          modules: input.modules,
          alerts: input.alerts,
          telemetry: input.telemetry || {},
        },
      });
      if (error) throw new Error(error.message || "invoke_failed");
      if (!json?.headline || !json?.reason || !json?.tone) throw new Error("invalid_response");
      return json as FingerprintVerdict;
    },
  });

  return data || input.fallback;
}