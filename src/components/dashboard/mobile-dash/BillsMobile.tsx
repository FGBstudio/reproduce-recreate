/**
 * Schermata BOLLETTE (decisione owner 16/10: non è più una scheda della
 * dashboard — ha un suo ingresso dal footer e una sua pagina, perché porta
 * a un flusso diverso, il caricamento).
 *
 * Contiene tutto il modulo Bills del PC: confronto fatturato/misurato per
 * mese, totali, potenza impegnata, lista dell'anno con gli stati, dettaglio
 * per bolletta (le 5 card desktop) e caricamento da fotocamera o PDF.
 */
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackDismiss } from "@/hooks/useBackDismiss";
import { hapticLight } from "@/lib/native";
import { supabase } from "@/lib/supabase";
import { useSiteCurrency } from "@/hooks/useSiteCurrency";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { CurrencyCode } from "@/lib/currency";
import { AMBER, INK, PeriodPager, SUB, SummaryRow, TEAL, VerdictLine } from "./bits";
import { BillsCompareChart } from "./insights";
import BillDetail from "./BillDetail";
import BillUploadSheet from "./BillUploadSheet";
import { useBillsYear, type BillItem } from "./useEnergyInsights";
import { useYearSeries } from "./useModuleSeries";

interface Props {
  /** UUID reale del sito (undefined per i siti vetrina) */
  siteId?: string;
  /** id usato per le serie demo (può non essere un UUID) */
  demoId?: string;
  siteName: string;
  timezone: string;
  isDemoSite: boolean;
  /** potenza impegnata del sito, per il margine sul picco di bolletta */
  contractKw?: number;
  priceKwh?: number;
  onBack: () => void;
}

const BillsMobile = ({ siteId, demoId, siteName, timezone, isDemoSite, contractKw, priceKwh, onBack }: Props) => {
  const { t, language } = useLanguage();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selBill, setSelBill] = useState<BillItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const queryClient = useQueryClient();
  useBackDismiss(true, onBack);

  const bills = useBillsYear(isDemoSite ? demoId : siteId, year, isDemoSite);
  // il MISURATO è la stessa serie annuale della dashboard (react-query la
  // riusa dalla cache quando è già stata caricata)
  const measuredY = useYearSeries("energy", siteId, year, timezone, isDemoSite, priceKwh);

  const nf = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 1 }), [language]);
  const nf0 = useMemo(() => new Intl.NumberFormat(language, { maximumFractionDigits: 0 }), [language]);
  const dfShort = useMemo(() => new Intl.DateTimeFormat(language, { day: "numeric", month: "short" }), [language]);
  const monthHeads = useMemo(() => {
    const f = new Intl.DateTimeFormat(language, { month: "narrow" });
    return Array.from({ length: 12 }, (_, i) => f.format(new Date(2026, i, 1)));
  }, [language]);
  const monthNamesLong = useMemo(() => {
    const f = new Intl.DateTimeFormat(language, { month: "long" });
    return Array.from({ length: 12 }, (_, i) => {
      const n = f.format(new Date(2026, i, 1));
      return n.charAt(0).toUpperCase() + n.slice(1);
    });
  }, [language]);

  const siteCurrency = useSiteCurrency(siteId);
  const { format: fmtMoney } = useCurrency();
  const billCur = (bills.data?.currency ?? "EUR") as CurrencyCode;

  const retryBill = async (b: BillItem) => {
    if (!supabase) return;
    await supabase.from("bills").update({ status: "pending" }).eq("id", b.id);
    await supabase.functions.invoke("analyze-bill", { body: { billId: b.id, filePath: b.filePath } }).catch(() => undefined);
    queryClient.invalidateQueries({ queryKey: ["mdash-bills"] });
    toast.success(t("md.retry_started"));
  };
  const deleteBill = async (b: BillItem) => {
    if (!supabase) return;
    if (b.filePath) await supabase.storage.from("bills").remove([b.filePath]).catch(() => undefined);
    const { error } = await supabase.from("bills").delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["mdash-bills"] });
    toast.success(t("md.bill_deleted"));
  };

  const b = bills.data;
  const measured = measuredY.data?.months ?? [];
  const devs = (b?.months ?? [])
    .map((x, i) => (x.billed != null && measured[i]?.v != null && measured[i].v! > 0
      ? ((x.billed - measured[i].v!) / measured[i].v!) * 100 : null))
    .filter((v): v is number => v != null);
  const avgDev = devs.length ? Math.round((devs.reduce((a, v) => a + Math.abs(v), 0) / devs.length) * 10) / 10 : null;
  const merged = (b?.months ?? []).map((x, i) => ({ m: x.m, billed: x.billed, measured: measured[i]?.v ?? null }));
  const effContract = contractKw ?? (b?.isDemo ? 25 : undefined);
  const headroom = effContract != null && b?.maxPeakKw != null && effContract > 0
    ? Math.round((1 - b.maxPeakKw / effContract) * 100) : null;

  return (
    /* `fixed`, non `absolute`: la schermata è montata dentro il contenitore
       scorrevole della dashboard e deve coprirlo per intero (sotto il
       dettaglio bolletta, z-[60], e i fogli) */
    <div className="fixed inset-0 z-[55] overflow-y-auto no-scrollbar"
      style={{
        background: "linear-gradient(180deg, #f6fafa 0%, #ffffff 30%)", color: INK,
        paddingTop: "var(--sat, 0px)", paddingBottom: "calc(var(--sab, 0px) + 28px)", WebkitOverflowScrolling: "touch",
      }}>
      <div className="relative flex items-center justify-between px-2 pt-1">
        <button type="button" onClick={onBack} aria-label="←" className="grid place-items-center" style={{ width: 44, height: 44, color: INK }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0 flex-1">
          <span className="inline-block whitespace-nowrap" style={{ fontSize: 15, fontWeight: 600 }}>{t("md.bills_title")}</span>
          <span className="truncate" style={{ fontSize: 13, color: SUB, marginLeft: 6 }}>{siteName}</span>
          {b?.isDemo && <span className="align-middle" style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#b45309", background: "rgba(217,154,43,.15)", borderRadius: 999, padding: "2px 7px", marginLeft: 6 }}>DEMO</span>}
        </div>
        <span style={{ width: 44 }} />
      </div>

      <PeriodPager
        title={String(year)}
        subtitle={b ? t("md.bills_n").replace("{n}", String(b.count)) + (b.pendingCount > 0 ? ` · ${t("md.bills_analyzing_n").replace("{n}", String(b.pendingCount))}` : "") : "…"}
        onPrev={() => { hapticLight(); setYear(y => y - 1); }}
        onNext={() => { hapticLight(); setYear(y => Math.min(new Date().getFullYear(), y + 1)); }}
        nextDisabled={year >= new Date().getFullYear()}
      />

      {bills.isLoading ? (
        <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>…</p>
      ) : !b ? (
        <p className="text-center py-14" style={{ color: SUB, fontSize: 13 }}>{t("md.no_data")}</p>
      ) : (
        <>
          {b.count > 0 && (
            avgDev != null ? (
              <VerdictLine
                color={avgDev > 5 ? AMBER : TEAL}
                verdict={avgDev <= 2 ? t("md.bills_match") : t("md.bills_gap").replace("{p}", nf.format(avgDev))}
                summary={t("md.bills_avg_dev").replace("{p}", nf.format(avgDev))}
              />
            ) : (
              <VerdictLine color={TEAL} verdict={`${nf.format(b.totalBilledKwh / 1000)} MWh`} summary={t("md.billed_lbl")} />
            )
          )}

          {b.count > 0 ? (
            <>
              <BillsCompareChart
                months={merged}
                monthLabels={monthHeads}
                labels={{ billed: t("md.billed_lbl"), measured: t("md.measured_lbl") }}
                fmt={v => nf0.format(v)}
              />
              <SummaryRow items={[
                { value: nf.format(b.totalBilledKwh / 1000), label: `MWh ${t("md.billed_lbl")}` },
                ...(b.avgCostKwh != null ? [{ value: fmtMoney(b.avgCostKwh, billCur, siteCurrency, { maximumFractionDigits: 2 }), label: `/kWh · ${t("md.avg_cost")}` }] : []),
                ...(b.totalSpent != null ? [{ value: fmtMoney(b.totalSpent, billCur, siteCurrency, { maximumFractionDigits: 0 }), label: t("md.spent_lbl") }] : []),
              ]} />
              {effContract != null && (
                <div className="px-6 mt-4">
                  <p style={{ fontSize: 12.5, fontWeight: 500, color: INK, margin: 0 }}>
                    {t("md.contracted_power").replace("{v}", nf0.format(effContract))}
                    {b.maxPeakKw != null && headroom != null && (
                      <span style={{ fontWeight: 400, color: headroom < 10 ? "#b97a14" : SUB, marginLeft: 6 }}>
                        {t("md.bill_peak").replace("{v}", nf.format(b.maxPeakKw)).replace("{p}", String(headroom))}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-center py-10 px-8" style={{ color: SUB, fontSize: 13 }}>{t("md.bills_none")}</p>
          )}

          {/* lista dell'anno: periodo, azienda, totale, scarto, stati */}
          {b.items.length > 0 && (
            <>
              <div className="flex items-baseline justify-between px-6" style={{ marginTop: 22 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t("md.year_bills")}</span>
                <span style={{ fontSize: 11, color: SUB }}>{t("md.tap_detail")}</span>
              </div>
              {b.items.map(it => {
                const done = it.status === "completed";
                const refD = it.periodStart ?? it.uploadedAt;
                const m = refD ? Number(refD.slice(5, 7)) : NaN;
                const rowTitle = Number.isFinite(m) ? monthNamesLong[m - 1] : it.fileName;
                const range = it.periodStart && it.periodEnd
                  ? `${dfShort.format(new Date(`${it.periodStart.slice(0, 10)}T12:00:00`))} – ${dfShort.format(new Date(`${it.periodEnd.slice(0, 10)}T12:00:00`))}`
                  : null;
                const sub2 = done
                  ? [it.company, range, it.kwh != null ? `${nf0.format(it.kwh)} kWh` : null].filter(Boolean).join(" · ")
                  : [it.company, t("md.uploaded_on").replace("{d}", it.uploadedAt ? dfShort.format(new Date(`${it.uploadedAt.slice(0, 10)}T12:00:00`)) : "—")].filter(Boolean).join(" · ");
                return (
                  <button key={it.id} type="button" className="w-full flex items-center gap-3 text-left"
                    onClick={() => { hapticLight(); setSelBill(it); }}
                    style={{ padding: "11px 24px", minHeight: 56 }}>
                    <span className="grid place-items-center shrink-0 rounded-xl" style={{ width: 34, height: 34, background: "#e4efef", fontSize: 15 }} aria-hidden>
                      {done ? "🧾" : it.status === "error" ? "⚠️" : "⏳"}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2" style={{ fontSize: 13.5, fontWeight: 600 }}>
                        {rowTitle}
                        {!done && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", borderRadius: 999, padding: "2px 8px", background: it.status === "error" ? "#f9e4ea" : "#e8eef9", color: it.status === "error" ? "#a62c4f" : "#3b5fa0" }}>
                            {t(it.status === "error" ? "md.st_error" : "md.st_analyzing")}
                          </span>
                        )}
                      </span>
                      <span className="block truncate" style={{ fontSize: 11.5, color: SUB }}>{sub2}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block tabular-nums" style={{ fontSize: 14, fontWeight: 600, color: done ? INK : SUB }}>
                        {done && it.totalAmount != null ? fmtMoney(it.totalAmount, (it.currency ?? billCur) as CurrencyCode, siteCurrency, { maximumFractionDigits: 0 }) : "—"}
                      </span>
                      {done && it.devPct != null && (
                        <span className="block tabular-nums" style={{ fontSize: 11, color: Math.abs(it.devPct) > 5 ? "#b97a14" : TEAL }}>
                          {it.devPct > 0 ? "+" : ""}{nf.format(it.devPct)}% {t("md.vs_meas_short")}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          <button type="button"
            onClick={() => {
              hapticLight();
              if (isDemoSite || !siteId) { toast.info(t("md.bills_demo_note")); return; }
              setUploadOpen(true);
            }}
            className="mx-auto mt-6 font-bold uppercase block"
            style={{ fontSize: 12, letterSpacing: "0.14em", color: TEAL, minHeight: 44 }}>
            + {t("md.upload_bill")}
          </button>
        </>
      )}

      <BillDetail
        bill={selBill}
        siteName={siteName}
        isDemo={b?.isDemo ?? false}
        contractKw={effContract}
        fmtAmt={(v, f) => (v == null ? "—" : fmtMoney(v, (selBill?.currency ?? billCur) as CurrencyCode, siteCurrency, f === 4 ? { minimumFractionDigits: 2, maximumFractionDigits: 4 } : { maximumFractionDigits: f ?? 0 }))}
        onClose={() => setSelBill(null)}
        onRetry={!isDemoSite && siteId ? retryBill : undefined}
        onDelete={!isDemoSite && siteId ? deleteBill : undefined}
      />
      <BillUploadSheet
        open={uploadOpen}
        siteId={siteId}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          queryClient.invalidateQueries({ queryKey: ["mdash-bills"] });
          toast.success(t("md.bill_uploaded"));
        }}
      />
    </div>
  );
};

export default BillsMobile;
