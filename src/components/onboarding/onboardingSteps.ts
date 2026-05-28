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
    title: "Benvenuto in FGB Monitoring",
    body:
      "Ti accompagno per un giro guidato. Vedrai una <strong>freccia animata</strong> muoversi sullo schermo: segui i suoi passaggi o clicca tu stesso quando ti invito a farlo.",
    placement: "center",
    action: "highlight",
  });

  steps.push({
    id: "search",
    title: "Cerca un sito",
    body:
      "Da qui puoi raggiungere qualsiasi struttura: digita il nome o l'indirizzo per saltare direttamente alla scheda del sito.",
    selector: '[data-tour="header-search"]',
    placement: "bottom",
    action: "highlight",
  });

  steps.push({
    id: "map",
    title: "La mappa interattiva",
    body:
      "Ogni sfera è un edificio monitorato. <strong style=\"color:#0a7d7a\">Verde</strong> ok · <strong style=\"color:#f0a020\">Ambra</strong> anomalia · <strong style=\"color:#e8523a\">Rosso</strong> offline.",
    selector: '[data-tour="map"]',
    placement: "left",
    action: "highlight",
  });

  steps.push({
    id: "region-buttons",
    title: "Cambia continente",
    body:
      "Con un click filtri la mappa per area geografica. La freccia cliccherà <strong>Europa</strong> per te — guarda come la mappa si riposiziona.",
    selector: '[data-tour="region-buttons"]',
    placement: "top",
    action: "click",
    autoAdvanceMs: 4500,
  });

  steps.push({
    id: "module-filters",
    title: "Filtri per modulo",
    body:
      "Mostra o nascondi i siti in base ai moduli attivi: <strong>Energia · Aria · Acqua</strong>. Utile per concentrarti solo su quello che stai analizzando.",
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
      title: "Gruppo e Brand",
      body:
        "Restringi la vista a un singolo <strong>gruppo</strong> o <strong>brand</strong>. Mappa e KPI si aggiornano di conseguenza.",
      selector: '[data-tour="scope-selectors"]',
      placement: "top",
      action: "highlight",
    });
  }

  // Module-aware narrative steps (centered cards — no deep DOM coupling needed)
  if (ctx.modules.energy) {
    steps.push({
      id: "mod-energy",
      title: "Modulo Energia",
      body:
        "All'interno di un sito troverai <strong>kW live</strong>, split giorno/notte, ripartizione HVAC vs illuminazione, e lo storico kWh — tutto per ogni struttura.",
      placement: "center",
      action: "highlight",
    });
  }
  if (ctx.modules.air) {
    steps.push({
      id: "mod-air",
      title: "Modulo Aria",
      body:
        "<strong>CO₂, VOC, PM2.5</strong> e temperatura confrontati con le soglie WHO, con timeseries per dispositivo e diagnostica avanzata.",
      placement: "center",
      action: "highlight",
    });
  }
  if (ctx.modules.water) {
    steps.push({
      id: "mod-water",
      title: "Modulo Acqua",
      body:
        "Flusso, consumi e <strong>leak detection</strong> con alert istantaneo quando un sito si discosta dal proprio baseline.",
      placement: "center",
      action: "highlight",
    });
  }
  if (ctx.modules.certification) {
    steps.push({
      id: "mod-cert",
      title: "Certificazioni",
      body:
        "Scorecard di <strong>LEED, BREEAM, WELL</strong> sito per sito: livello attuale, gap e prossimi milestone.",
      placement: "center",
      action: "highlight",
    });
  }

  steps.push({
    id: "profile",
    title: "Profilo, alert e aiuto",
    body:
      "Il tuo <strong>avatar</strong> apre preferenze, notifiche e FAQ. Da lì potrai sempre <strong>riavviare questo tour</strong> dal tab Aiuto.",
    selector: '[data-tour="profile-button"]',
    placement: "bottom",
    action: "highlight",
  });

  steps.push({
    id: "finish",
    title: "Sei pronto.",
    body:
      "Esplora liberamente. Per rivedere questa guida apri il tuo profilo e tocca <strong>Riavvia tour guidato</strong>. Buon lavoro.",
    placement: "center",
    action: "highlight",
  });

  return steps;
}