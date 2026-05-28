import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserScope } from "@/hooks/useUserScope";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { buildSteps, type TourStep, type StepContext } from "@/components/onboarding/onboardingSteps";

type StartReason = "auto" | "manual";

interface OnboardingContextValue {
  isActive: boolean;
  steps: TourStep[];
  index: number;
  currentStep: TourStep | null;
  start: (reason?: StartReason) => void;
  stop: (opts?: { completed?: boolean }) => void;
  next: () => void;
  prev: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

const MAX_AUTO_RUNS = 2;

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, isLoading, updateProfile } = useAuth();
  const { clientRole, siteId, accessibleSiteIds, isLoading: scopeLoading } = useUserScope();

  const [moduleFlags, setModuleFlags] = useState<StepContext["modules"]>({
    energy: true, air: true, water: true, certification: true,
  });
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [index, setIndex] = useState(0);
  const autoTriedRef = useRef(false);

  // Resolve enabled modules from the user's scope.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured || !user || scopeLoading) return;
      // STORE_USER → single site; otherwise aggregate across accessible sites (any enabled = step shown).
      const ids = siteId ? [siteId] : accessibleSiteIds.length ? accessibleSiteIds : [];
      if (!ids.length) {
        // No scope restriction → assume all enabled (ADMIN_FGB / USER_FGB)
        if (!cancelled) setModuleFlags({ energy: true, air: true, water: true, certification: true });
        return;
      }
      const { data } = await supabase
        .from("sites")
        .select("module_energy_enabled, module_air_enabled, module_water_enabled")
        .in("id", ids);
      if (cancelled) return;
      const any = (k: "module_energy_enabled" | "module_air_enabled" | "module_water_enabled") =>
        (data || []).some((r: any) => r?.[k]);
      setModuleFlags({
        energy: any("module_energy_enabled"),
        air: any("module_air_enabled"),
        water: any("module_water_enabled"),
        certification: true, // certifications are universally available
      });
    })();
    return () => { cancelled = true; };
  }, [user, siteId, accessibleSiteIds, scopeLoading]);

  const buildCurrentSteps = useCallback((): TourStep[] => {
    return buildSteps({ clientRole, modules: moduleFlags });
  }, [clientRole, moduleFlags]);

  const start = useCallback((_reason: StartReason = "manual") => {
    const next = buildCurrentSteps();
    setSteps(next);
    setIndex(0);
    setIsActive(true);
  }, [buildCurrentSteps]);

  const stop = useCallback((opts?: { completed?: boolean }) => {
    setIsActive(false);
    // Increment counter on any close (skip or finish) so we don't re-prompt forever.
    if (user && isSupabaseConfigured) {
      const current = profile?.onboarding_completed_count ?? 0;
      updateProfile({ onboarding_completed_count: current + 1 } as any);
    }
    void opts;
  }, [user, profile, updateProfile]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= steps.length) {
        // Finish
        setTimeout(() => stop({ completed: true }), 0);
        return i;
      }
      return i + 1;
    });
  }, [steps.length, stop]);

  const prev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Auto-start when the user has seen the tour fewer than MAX_AUTO_RUNS times.
  useEffect(() => {
    if (autoTriedRef.current) return;
    if (isLoading || scopeLoading) return;
    if (!user) return;
    const count = profile?.onboarding_completed_count ?? 0;
    if (count >= MAX_AUTO_RUNS) { autoTriedRef.current = true; return; }
    autoTriedRef.current = true;
    // Wait for layout to settle so target selectors exist.
    const t = window.setTimeout(() => start("auto"), 900);
    return () => window.clearTimeout(t);
  }, [isLoading, scopeLoading, user, profile, start]);

  const value = useMemo<OnboardingContextValue>(() => ({
    isActive,
    steps,
    index,
    currentStep: steps[index] ?? null,
    start,
    stop,
    next,
    prev,
  }), [isActive, steps, index, start, stop, next, prev]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export const useOnboarding = () => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
};