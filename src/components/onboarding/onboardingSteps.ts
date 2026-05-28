import type { ClientRole } from "@/hooks/useUserScope";

export type StepPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  id: string;
  title: string;
  body: string; // supports <strong>
  /** CSS selector for the highlighted element. Omit for centered welcome / closing card. */
  selector?: string;
  placement?: StepPlacement;
}

export interface StepContext {
  clientRole: ClientRole;
  modules: { energy: boolean; air: boolean; water: boolean; certification: boolean };
}

/**
 * Build the active step list adapting to user role and enabled modules.
 * Steps whose selector is not in the DOM are filtered out at runtime by the tour.
 */
export function buildSteps(ctx: StepContext): TourStep[] {
  const steps: TourStep[] = [];

  steps.push({
    id: "welcome",
    title: "Welcome to FGB Monitoring",
    body: "Your command centre for <strong>energy</strong>, <strong>air</strong> and <strong>water</strong>. Live data, one place. Take the quick tour — you can re-open it anytime from your profile.",
    placement: "center",
  });

  steps.push({
    id: "search",
    title: "Jump to any site",
    body: "Use <strong>Search</strong> to instantly open any site you have access to — type the name or the address.",
    selector: '[data-tour="header-search"]',
    placement: "bottom",
  });

  steps.push({
    id: "map",
    title: "Interactive Map",
    body: "Each pin is a building. <strong style=\"color:#00C49A\">Green</strong> ok · <strong style=\"color:#F0A020\">Orange</strong> anomaly · <strong style=\"color:#E8523A\">Red</strong> offline. Click a pin to drill into the site.",
    selector: '[data-tour="map"]',
    placement: "right",
  });

  steps.push({
    id: "regions",
    title: "Regions & Filters",
    body: "Switch <strong>continent</strong> and toggle <strong>Energy · Air · Water</strong> layers to focus on what matters now.",
    selector: '[data-tour="region-nav"]',
    placement: "top",
  });

  if (ctx.clientRole === "ADMIN_FGB" || ctx.clientRole === "USER_FGB" || ctx.clientRole === "ADMIN_HOLDING") {
    steps.push({
      id: "scope",
      title: "Group & Brand",
      body: "Narrow the view to a specific <strong>group</strong> or <strong>brand</strong>. Your KPIs and the map will follow your selection.",
      selector: '[data-tour="scope-selectors"]',
      placement: "top",
    });
  }

  // Module-aware steps (shown when the module is enabled for the user's scope)
  if (ctx.modules.energy) {
    steps.push({
      id: "mod-energy",
      title: "Energy Module",
      body: "Live <strong>kW</strong>, day/night split, HVAC vs lighting breakdown and historical kWh — all per site. Open any site to dive in.",
      placement: "center",
    });
  }
  if (ctx.modules.air) {
    steps.push({
      id: "mod-air",
      title: "Air Quality Module",
      body: "Indoor <strong>CO₂, VOC, PM2.5</strong> and temperature against WHO thresholds, with per-device timeseries and diagnostics.",
      placement: "center",
    });
  }
  if (ctx.modules.water) {
    steps.push({
      id: "mod-water",
      title: "Water Module",
      body: "Flow, consumption and <strong>leak detection</strong> with instant alerts when a site behaves outside its baseline.",
      placement: "center",
    });
  }
  if (ctx.modules.certification) {
    steps.push({
      id: "mod-cert",
      title: "Certifications",
      body: "Track <strong>LEED, BREEAM, WELL</strong> scorecards site-by-site — current level, gaps and next milestones.",
      placement: "center",
    });
  }

  steps.push({
    id: "profile",
    title: "Profile, Alerts & Help",
    body: "Your <strong>avatar</strong> opens preferences, notifications and FAQs. You can restart this tour anytime from the <strong>Help</strong> tab.",
    selector: '[data-tour="profile-button"]',
    placement: "bottom",
  });

  steps.push({
    id: "finish",
    title: "You're all set",
    body: "Explore freely. Any time you want a refresher, open your profile and tap <strong>Restart guided tour</strong>.",
    placement: "center",
  });

  return steps;
}