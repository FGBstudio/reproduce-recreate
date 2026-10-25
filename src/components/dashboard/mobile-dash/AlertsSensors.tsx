/**
 * «Alert e sensori» — il pannello della schermata finale dell'overview
 * (§10.5), estratto perché serve in due posti (parità grafici, I1):
 *
 *  · nell'overview del sito, come schermata a piena altezza (tutti i moduli);
 *  · nella dashboard modulo, come overlay `fgb:back` filtrato sul modulo —
 *    chi guarda Energy vede gli alert di Energy senza uscire.
 *
 * Il pannello è presentazionale: conteggi per gravità, lista con «mostra
 * tutti», Trust layer dei sensori. I dati arrivano dal chiamante
 * (useThresholdAlerts / useSensorHealth); qui niente query.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackDismiss } from "@/hooks/useBackDismiss";
import type { ThresholdAlert } from "@/hooks/useThresholdAlerts";

export interface AlertRow {
  title: string;
  module?: string;
  device?: string;
  ago?: string;
  severity?: string;
}
export interface AlertsModel {
  criticalCount: number;
  warningCount: number;
  infoCount?: number;
  list: AlertRow[];
}
export interface SensorTrustModel {
  score: number;
  offline: number;
  flatline: number;
  flapping: number;
  offlineNames: string[];
}

/** Modulo di un alert, dal prefisso della metrica — stessa regola usata
    dall'overview (OverviewSection): energy/power → energy, water/leak →
    water, tutto il resto → air. */
export const alertModuleOf = (metric?: string): "energy" | "water" | "air" =>
  metric?.startsWith("energy") || metric?.includes("power") ? "energy"
    : metric?.startsWith("water") || metric?.includes("leak") ? "water"
    : "air";

/** «da quanto»: min → h → gg, come nell'overview. */
export const agoLabel = (ts?: string): string | undefined => {
  if (!ts) return undefined;
  const min = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  return min < 60 ? `${min} min` : min < 2880 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} gg`;
};

const MODULE_WORD: Record<ReturnType<typeof alertModuleOf>, string> = {
  energy: "Energy", water: "Water", air: "Air",
};

/** Dalla riga DB alla riga di lista del pannello. */
export const toAlertRows = (alerts: ThresholdAlert[]): AlertRow[] =>
  alerts.map(a => ({
    title: a.message,
    module: MODULE_WORD[alertModuleOf(a.metric)],
    device: a.deviceName ?? undefined,
    ago: agoLabel(a.timestamp),
    severity: a.severity,
  }));

/* ── Il pannello: conteggi · lista · Trust layer ─────────────────────── */
export const AlertsSensorsPanel = ({ alerts, sensorHealth }: {
  alerts: AlertsModel;
  sensorHealth?: SensorTrustModel;
}) => {
  const { t, language } = useLanguage();
  const nf0 = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 0 }), [language]);
  const [showAll, setShowAll] = useState(false);

  return (
    <>
      {/* conteggi per gravità */}
      <div className="grid grid-cols-3 gap-3 text-center mt-5 w-full max-w-[290px] mx-auto">
        {[
          { n: alerts.criticalCount, label: t("ovm.sev_critical"), hot: alerts.criticalCount > 0 },
          { n: alerts.warningCount, label: t("ovm.sev_medium"), warn: alerts.warningCount > 0 },
          { n: alerts.infoCount ?? 0, label: t("ovm.sev_low") },
        ].map((x, i) => (
          <div key={i}>
            <div className={`text-[24px] font-bold tabular-nums ${x.hot ? "text-[#f9cace]" : x.warn ? "text-[#f2b84b]" : ""}`}>{nf0.format(x.n)}</div>
            <div className="text-[10.5px] opacity-70 tracking-wide">{x.label}</div>
          </div>
        ))}
      </div>

      <div className="w-full max-w-[290px] mx-auto text-left text-[12.5px] mt-4">
        {alerts.list.length === 0 ? (
          <div className="opacity-70 text-center py-3 text-[12px]">{t("ovm.no_alerts")}</div>
        ) : (
          (showAll ? alerts.list : alerts.list.slice(0, 3)).map((a, i) => (
            <div key={i} className="py-2 border-b border-white/15">
              <span className={`block ${a.severity === "critical" ? "text-[#f9cace]" : ""}`}>{a.title}</span>
              <span className="block text-[11px] opacity-65 mt-0.5">
                {[a.module, a.device, a.ago ? `${t("ovm.since")} ${a.ago}` : null].filter(Boolean).join(" · ")}
              </span>
            </div>
          ))
        )}
        {alerts.list.length > 3 && !showAll && (
          <button type="button" onClick={() => setShowAll(true)}
            className="w-full text-center py-2.5 font-bold text-[11px] tracking-[0.14em] uppercase opacity-85" style={{ minHeight: 44 }}>
            {t("ovm.cta_alerts")}
          </button>
        )}
      </div>

      {/* Trust layer (§10.5): affidabilità dei sensori */}
      {sensorHealth && (
        <div className="w-full max-w-[290px] mx-auto mt-6 pt-4 border-t border-white/20">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-bold tracking-[0.18em] uppercase opacity-80">{t("ovm.sensor_trust")}</span>
            <span className="text-[22px] font-bold tabular-nums">{nf0.format(sensorHealth.score)}<em className="not-italic text-[12px] opacity-70 font-normal">/100</em></span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mt-3">
            {[
              { n: sensorHealth.offline, label: t("ovm.offline_lbl"), warn: sensorHealth.offline > 0 },
              { n: sensorHealth.flatline, label: t("ovm.flatline_lbl"), warn: sensorHealth.flatline > 0 },
              { n: sensorHealth.flapping, label: t("ovm.flapping_lbl") },
            ].map((x, i) => (
              <div key={i}>
                <div className={`text-[20px] font-bold tabular-nums ${x.warn ? "text-[#f2b84b]" : ""}`}>{nf0.format(x.n)}</div>
                <div className="text-[10.5px] opacity-70">{x.label}</div>
              </div>
            ))}
          </div>
          {/* i dati del sensore offline MANCANO dai grafici, non vengono stimati */}
          {sensorHealth.offline > 0 && sensorHealth.offlineNames.length > 0 && (
            <p className="text-[11.5px] opacity-80 mt-3 leading-relaxed">
              {t("ovm.offline_note").replace("{names}", sensorHealth.offlineNames.join(", "))}
            </p>
          )}
        </div>
      )}
    </>
  );
};

/* ── L'overlay per la dashboard modulo (I1) ──────────────────────────────
   Stesso fondo teal della schermata overview, stesso pattern di BillsMobile:
   fixed z-[55], back hardware/gesto via fgb:back. Sola lettura —
   l'acknowledge resta una decisione di prodotto (criterio C4). */
const AlertsSheet = ({ moduleLabel, siteName, alerts, sensorHealth, onBack }: {
  moduleLabel: string;
  siteName: string;
  alerts: AlertsModel;
  sensorHealth?: SensorTrustModel;
  onBack: () => void;
}) => {
  const { t } = useLanguage();
  useBackDismiss(true, onBack);

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto no-scrollbar text-white bg-gradient-to-b from-[#016368] to-[#01474b]"
      style={{ paddingTop: "var(--sat, 0px)", paddingBottom: "calc(var(--sab, 0px) + 28px)", WebkitOverflowScrolling: "touch" }}>
      <div className="relative flex items-center justify-between px-2 pt-1">
        <button type="button" onClick={onBack} aria-label="←" className="grid place-items-center shrink-0" style={{ width: 44, height: 44 }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0 flex-1">
          <span className="inline-block whitespace-nowrap uppercase tracking-[0.18em]" style={{ fontSize: 12, fontWeight: 700 }}>{t("ovm.alerts_sensors")}</span>
          <span className="block truncate opacity-70" style={{ fontSize: 12 }}>{moduleLabel} · {siteName}</span>
        </div>
        {/* spalla destra = la larghezza del back: il titolo resta centrato */}
        <span className="shrink-0" style={{ width: 44 }} aria-hidden />
      </div>

      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-2 justify-center">
          <AlertTriangle className="w-6 h-6 opacity-80" aria-hidden="true" />
        </div>
        <AlertsSensorsPanel alerts={alerts} sensorHealth={sensorHealth} />
      </div>
    </div>
  );
};

export default AlertsSheet;
