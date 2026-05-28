import type { ClientRole } from "@/hooks/useUserScope";

export type StepPlacement = "top" | "bottom" | "left" | "right" | "center";
export type StepAction = "highlight" | "click" | "wait";

export interface TourStep {
  id: string;
  title: string;
  body: string; // supports inline <strong>/<span style="...">
  /** CSS selector for the highlighted element. Omit for centered welcome / closing card. */
  selector?: string;
  placement?: StepPlacement;
  /** What the ghost cursor should do on this step. */
  action?: StepAction;
  /** After action completes, wait for this selector to appear before advancing. */
  awaitSelector?: string;
  /** Force auto-advance after N ms even if user does nothing (only when action === "click"). */
  autoAdvanceMs?: number;
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
    title: "Welcome to FGB Monitoring World",
    body:
      "I will take you on a guided tour. You will see an animated arrow moving across the screen: follow its steps or click yourself when I prompt you to do so.",
    placement: "center",
    action: "highlight",
  });

  steps.push({
    id: "search",
    title: "Search for a Site",
    body:
      "From here, you can reach any facility: type the name or address to jump directly to the site's profile. Each sphere represents a monitored building.",
    selector: '[data-tour="header-search"]',
    placement: "bottom",
    action: "highlight",
  });

  steps.push({
    id: "map",
    title: "The interactive map",
    body:
      "Each marker is a monitored site. moving over there will show the istant features of the of the site - Power | CO₂ | Water | Awards",
    selector: '[data-tour="map"]',
    placement: "left",
    action: "highlight",
  });

  steps.push({
    id: "region-buttons",
    title: "Change Region",
    body:
      "With one click, you can filter the map by geographical area. The arrow will click Europe for you — watch as the map repositions itself.",
    selector: '[data-tour="region-buttons"]',
    placement: "top",
    action: "click",
    autoAdvanceMs: 4500,
  });

  steps.push({
    id: "module-filters",
    title: "Filter by module",
    body:
      "Show or hide sites based on active modules: <strong>Energy · Air · Water</strong>. This is useful for focusing only on what you are currently analyzing.",
    selector: '[data-tour="module-filters"]',
    placement: "top",
    action: "highlight",
  });

  if (
    ctx.clientRole === "ADMIN_FGB" ||
    ctx.clientRole === "USER_FGB" ||
    ctx.clientRole === "ADMIN_HOLDING"
  ) {
    steps.push({
      id: "scope",
      title: "Group and Brand",
      body:
        "Narrow your view to a single <strong>group</strong> or <strong>brand</strong>. The map and KPIs will update accordingly.",
      selector: '[data-tour="scope-selectors"]',
      placement: "top",
      action: "highlight",
    });
  }

  // Module-aware narrative steps (centered cards — no deep DOM coupling needed)
  if (ctx.modules.energy) {
    steps.push({
      id: "mod-energy",
      title: "Energy Module",
      body:
        "Within a site, you will find <strong>live kW</strong>, day/night split, HVAC vs. lighting breakdown, and historical kWh — all for every facility",
      placement: "center",
      action: "highlight",
    });
  }
  if (ctx.modules.air) {
    steps.push({
      id: "mod-air",
      title: "Air Module",
      body:
        "<strong>CO₂, VOC, PM2.5</strong> and temperature compared against WHO thresholds, with time series per device and advanced diagnostics.",
      placement: "center",
      action: "highlight",
    });
  }
  if (ctx.modules.water) {
    steps.push({
      id: "mod-water",
      title: "Water Module",
      body:
        "Flow, consumption, and leak detection with instant alerts when a site deviates from its baseline",
      placement: "center",
      action: "highlight",
    });
  }
  if (ctx.modules.certification) {
    steps.push({
      id: "mod-cert",
      title: "Certifications",
      body:
        "<strong>LEED, BREEAM, WELL</strong> scorecards site by site: current level, gaps, and upcoming milestones",
      placement: "center",
      action: "highlight",
    });
  }

  steps.push({
    id: "profile",
    title: "Profile, Alerts, and Help",
    body:
      "Your <strong>avatar</strong> opens preferences, notifications, and FAQs. From there, you can always <strong>restart this tour</strong>via the Help tab.",
    selector: '[data-tour="profile-button"]',
    placement: "bottom",
    action: "highlight",
  });

  steps.push({
    id: "finish",
    title: "You are ready.",
    body:
      "Explore freely. To review this guide, open your profile and tap <strong>Restart guided tour</strong>. Enjoy your work.",
    placement: "center",
    action: "highlight",
  });

  return steps;
}
