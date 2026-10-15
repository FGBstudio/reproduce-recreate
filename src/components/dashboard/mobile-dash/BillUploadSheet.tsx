/**
 * Foglio «Carica bolletta» (atlante §10.6): il vantaggio del mobile è la
 * FOTOCAMERA — foto diretta della bolletta, oppure un PDF. Stesso flusso
 * del modulo desktop (storage `bills` → riga `bills` → edge `analyze-bill`),
 * nessuna logica nuova lato server. Chiuso da ×, velo o back (§2.2).
 */
import { useRef, useState } from "react";
import { Camera, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackDismiss } from "@/hooks/useBackDismiss";
import { hapticLight } from "@/lib/native";
import { supabase } from "@/lib/supabase";
import { INK, RULE, SUB, TEAL } from "./bits";

const BillUploadSheet = ({ open, siteId, onClose, onUploaded }: {
  open: boolean;
  siteId: string | undefined;
  onClose: () => void;
  onUploaded: () => void;
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [company, setCompany] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  useBackDismiss(open, onClose);

  if (!open) return null;

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // limite del PC: 10 MB, verificato PRIMA di caricare
    if (f && f.size > 10 * 1024 * 1024) {
      setErr(t("md.file_too_big").replace("{s}", (f.size / 1048576).toFixed(1)));
    } else if (f) {
      setFile(f); setErr(null);
    }
    e.target.value = "";
  };

  const upload = async () => {
    if (!file || !siteId || !supabase || busy) return;
    // fornitore obbligatorio come sul PC (max 100 caratteri)
    if (!company.trim()) { setErr(t("md.company_required")); return; }
    hapticLight();
    setBusy(true); setErr(null);
    try {
      const safe = file.name.replace(/[^\w.-]+/g, "_");
      const filePath = `${siteId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from("bills").upload(filePath, file);
      if (upErr) throw upErr;
      const { data: bill, error: insErr } = await supabase.from("bills").insert({
        site_id: siteId,
        uploaded_by: user?.id ?? null,
        company_name: company.trim().slice(0, 100),
        file_name: file.name,
        file_path: filePath,
        status: "pending",
      }).select().single();
      if (insErr) throw insErr;
      // analisi AI: se l'invoke fallisce la bolletta resta `pending` e si
      // può rianalizzare dal desktop — il caricamento è comunque riuscito
      await supabase.functions.invoke("analyze-bill", { body: { billId: bill.id, filePath } }).catch(() => undefined);
      setFile(null); setCompany("");
      onUploaded();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const srcBtn = (label: string, Icon: typeof Camera, onTap: () => void, active: boolean) => (
    <button type="button" onClick={() => { hapticLight(); onTap(); }}
      className="flex-1 flex flex-col items-center gap-1.5 rounded-2xl"
      style={{ minHeight: 76, padding: "14px 8px", background: active ? "rgba(10,143,145,.1)" : "#eef4f4", border: active ? `1.4px solid ${TEAL}` : "1.4px solid transparent" }}>
      <Icon className="w-5 h-5" style={{ color: active ? TEAL : INK }} aria-hidden />
      <span style={{ fontSize: 12, fontWeight: 600, color: active ? TEAL : INK }}>{label}</span>
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-[70]" style={{ background: "rgba(5,20,22,.42)" }} onClick={onClose} aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-[71] rounded-t-3xl" role="dialog" aria-modal="true"
        style={{ background: "#fbfdfd", boxShadow: "0 -12px 40px rgba(5,20,22,.25)", paddingBottom: "calc(var(--sab, 0px) + 14px)" }}>
        <div className="flex justify-center pt-2.5 pb-1" aria-hidden><span className="rounded-full" style={{ width: 40, height: 4, background: "#d4e0e0" }} /></div>
        <div className="flex items-center justify-between pl-6 pr-2">
          <span className="uppercase font-bold" style={{ fontSize: 12, letterSpacing: "0.18em", color: INK }}>{t("md.upload_t")}</span>
          <button type="button" onClick={onClose} aria-label="×" className="grid place-items-center" style={{ width: 44, height: 44, fontSize: 18, color: SUB }}>×</button>
        </div>
        <div className="px-6">
          {/* fotocamera (capture) oppure PDF — gli input restano invisibili */}
          <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={pick} className="hidden" aria-hidden />
          <input ref={pdfRef} type="file" accept="application/pdf" onChange={pick} className="hidden" aria-hidden />
          <div className="flex gap-3 mt-1">
            {srcBtn(t("md.take_photo"), Camera, () => camRef.current?.click(), !!file && file.type.startsWith("image/"))}
            {srcBtn(t("md.pick_pdf"), FileText, () => pdfRef.current?.click(), !!file && file.type === "application/pdf")}
          </div>
          {file && (
            <p className="truncate" style={{ fontSize: 12, color: SUB, margin: "8px 0 0" }}>
              {file.name} · {(file.size / 1048576).toFixed(2)} MB <span style={{ color: "#9fb2b3" }}>({t("md.max10")})</span>
            </p>
          )}
          <input
            type="text" value={company} onChange={e => setCompany(e.target.value)}
            placeholder={t("md.bill_company_ph")} inputMode="text" autoComplete="off"
            className="w-full rounded-xl mt-3"
            style={{ minHeight: 46, padding: "0 14px", fontSize: 13.5, color: INK, background: "#ffffff", border: `1px solid ${RULE}` }}
          />
          <p style={{ fontSize: 11.5, color: SUB, margin: "10px 0 0" }}>{t("md.bill_note")}</p>
          {err && <p style={{ fontSize: 12, color: "#b4232f", margin: "8px 0 0" }}>{err}</p>}
          <button type="button" disabled={!file || busy} onClick={upload}
            className="w-full rounded-full font-bold uppercase text-white"
            style={{ minHeight: 48, fontSize: 12, letterSpacing: "0.1em", background: file && !busy ? TEAL : "#c3d2d3", marginTop: 12 }}>
            {busy ? t("md.bill_uploading") : t("md.bill_send")}
          </button>
        </div>
      </div>
    </>
  );
};

export default BillUploadSheet;
