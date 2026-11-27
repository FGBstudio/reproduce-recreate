import { jsPDF, GState } from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { Project, getBrandById, getHoldingById } from "@/lib/data";
import { TimePeriod } from "./TimePeriodSelector";
import { DateRange, getPeriodLabel } from "@/hooks/useTimeFilteredData";
import { generateEnergyDiagnosis, EnergyDiagnosisInput } from "@/lib/energyDiagnosis";
import { ReportLanguage, getTranslations, getDateLocale } from "@/lib/translations/pdfReport";
import { supabase } from "@/integrations/supabase/client";
import type { ReportTables, ReportTablePayload, ReportBucket } from "@/lib/report/granularity";

// --- INTERFACES ---
export interface ReportModuleConfig {
  energy: { enabled: boolean };
  water: { enabled: boolean };
  air: { enabled: boolean };
}

interface ReportData {
  energy: {
    consumption: Record<string, unknown>[];
    devices: Record<string, unknown>[];
    co2: Record<string, unknown>[];
  };
  water: {
    consumption: Record<string, unknown>[];
    quality: Record<string, unknown>[];
    leaks: Record<string, unknown>[];
  };
  airQuality: {
    co2History: Record<string, unknown>[];
    tempHumidity: Record<string, unknown>[];
    particulates: Record<string, unknown>[];
  };
}

interface ChartRefs {
  energyChart?: React.RefObject<HTMLDivElement | null>;
  deviceChart?: React.RefObject<HTMLDivElement | null>;
  waterChart?: React.RefObject<HTMLDivElement | null>;
  airQualityChart?: React.RefObject<HTMLDivElement | null>;
}

interface GeneratePdfOptions {
  project: Project;
  timePeriod: TimePeriod;
  dateRange?: DateRange;
  data: ReportData;
  moduleConfig: ReportModuleConfig;
  chartRefs?: ChartRefs;
  includeAiDiagnosis?: boolean;
  onProgress?: (message: string) => void;
  language?: ReportLanguage;
  precalculatedTotals?: {
    // null = nessuna misura nel periodo (→ "N/A"); 0 = misura reale a zero.
    totalEnergyKwh?: number | null;
    totalCostEur?: number | null;
    totalCo2Kg?: number | null;
  };
  /** Intervallo EFFETTIVO del report (analisi #7): per un mese in corso il
      "November 2026" nascondeva che sono 25 giorni su 30. */
  periodRange?: { start: string; end: string };
  /** Tabelle dati per granularità + sezione allarmi (Fase C2/C3). */
  reportTables?: ReportTables;
}

// --- COLORS ---
const COLORS = {
  primary: [0, 75, 77] as [number, number, number],
  secondary: [100, 116, 139] as [number, number, number],
  accent: [59, 130, 246] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  lightGray: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  tableHeaderGray: [71, 85, 105] as [number, number, number],
  zebraRow: [248, 250, 252] as [number, number, number],
};

// --- CO2 EMISSION FACTOR (Italy grid average) ---
const CO2_EMISSION_FACTOR_KG_KWH = 0.233;

// --- HELPERS ---

/** Preload an image URL into a base64 string, resolving only after fully loaded */
const preloadImageAsBase64 = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl.split(',')[1]);
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

const loadFileAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = `data:image/png;base64,${base64}`;
  });
};

const captureChartAsImage = async (ref: React.RefObject<HTMLDivElement | null>): Promise<string | null> => {
  if (!ref?.current) return null;
  try {
    // windowWidth fissa: su mobile i chart sono stretti; senza questo il PDF
    // conterrebbe grafici minuscoli catturati alla larghezza del telefono
    const canvas = await html2canvas(ref.current, {
      windowWidth: 1200,
      backgroundColor: '#ffffff',
      scale: 2.5,
      logging: false,
      useCORS: true,
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Chart capture failed:', error);
    return null;
  }
};

/** Clean LaTeX/MathJax artifacts from AI text */
const cleanLatex = (text: string): string => {
  return text
    // $25^{\circ}C$ → 25 °C
    .replace(/\$([0-9,.]+)\^\\{circ\\}C\$/g, '$1 °C')
    .replace(/\$([0-9,.]+)\s*\\circ\s*C\$/g, '$1 °C')
    .replace(/\$([0-9,.]+)\^{\\circ}C\$/g, '$1 °C')
    // $25/02$ → 25/02
    .replace(/\$([0-9/]+)\$/g, '$1')
    // Generic: remove remaining $ delimiters
    .replace(/\$/g, '')
    // Remove \text{} wrappers
    .replace(/\\text\{([^}]+)\}/g, '$1')
    // Remove \textbf{} wrappers
    .replace(/\\textbf\{([^}]+)\}/g, '$1')
    // Remove remaining backslash commands
    .replace(/\\[a-zA-Z]+/g, '')
    // Clean up braces
    .replace(/[{}]/g, '')
    // Normalize spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
};

/** Format a number with fixed decimals and thousands separator */
const fmtNum = (val: unknown, decimals = 2): string => {
  const n = Number(val);
  if (val === null || val === undefined || val === '' || isNaN(n)) return '–';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

/* Fase A (nov 2026) — un UNICO modo di dire "nessun dato".
   Prima lo stesso concetto usciva in 5 forme: `null °C`, `—`, `Undefined`,
   `No Data`, `0`. Peggio: lo ZERO trasformava un buco di misure in un numero
   falso che poi finiva nei totali e nell'AI. Regola: null/NaN => "N/A",
   SENZA unita'; un vero zero misurato resta "0". Mai la stringa "null". */
const N_A = 'N/A';
const isMissing = (v: unknown): boolean =>
  v === null || v === undefined || v === '' ||
  (typeof v === 'string' && /^(null|undefined|nan)$/i.test(v.trim())) ||
  (typeof v === 'number' && isNaN(v));

/** Valore + unita' per il PDF: "N/A" se manca (niente unita'), altrimenti
    il numero formattato con l'unita'. Un 0 reale resta 0. */
const fmtValue = (val: unknown, unit = '', decimals = 0): string => {
  if (isMissing(val)) return N_A;
  const n = Number(val);
  if (isNaN(n)) return String(val) + (unit ? ` ${unit}` : '');
  return fmtNum(n, decimals) + (unit ? ` ${unit}` : '');
};

/** Extract a numeric value from a record trying common keys */
const extractNum = (row: Record<string, unknown>, ...keys: string[]): number => {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) {
      const n = Number(row[k]);
      if (!isNaN(n)) return n;
    }
  }
  return 0;
};

// ========== MAIN GENERATION FUNCTION ==========
export const generatePdfReport = async ({
  project,
  timePeriod,
  dateRange,
  data,
  moduleConfig,
  chartRefs,
  includeAiDiagnosis = true,
  onProgress,
  language = 'en',
  precalculatedTotals,
  periodRange,
  reportTables,
}: GeneratePdfOptions) => {
  const t = getTranslations(language);
  const dateLocale = await getDateLocale(language);
  const isIt = language === 'it';

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // --- 1. RESOURCE LOADING (parallel, with image preload) ---
  onProgress?.(isIt ? "Caricamento risorse..." : "Loading resources...");

  let headerLogoData: string | null = null;
  let watermarkData: string | null = null;
  let brandLogoData: string | null = null;

  try {
    const brand = getBrandById(project.brandId);
    const brandLogoUrl = brand?.logo;

    const [fontRegular, fontBold, imgHeader, imgWatermark, imgBrand] = await Promise.all([
      loadFileAsBase64('/fonts/FuturaLT-Book.ttf'),
      loadFileAsBase64('/fonts/FuturaLT-Bold.ttf'),
      preloadImageAsBase64('/whiteLogoPayoff.png'),
      preloadImageAsBase64('/favicon.ico'),
      brandLogoUrl ? preloadImageAsBase64(brandLogoUrl) : Promise.resolve(null),
    ]);

    doc.addFileToVFS("FuturaLT-Regular.ttf", fontRegular);
    doc.addFileToVFS("FuturaLT-Bold.ttf", fontBold);
    doc.addFont("FuturaLT-Regular.ttf", "FuturaLT", "normal");
    doc.addFont("FuturaLT-Bold.ttf", "FuturaLT", "bold");
    doc.setFont("FuturaLT", "normal");

    headerLogoData = imgHeader;
    watermarkData = imgWatermark;
    brandLogoData = imgBrand;
  } catch (e) {
    console.error("Resource loading error, using fallback.", e);
    doc.setFont("helvetica");
  }

  const brand = getBrandById(project.brandId);
  const holding = brand ? getHoldingById(brand.holdingId) : null;
  const periodLabel = getPeriodLabel(timePeriod, dateRange, language);
  const dateFormat = isIt ? "dd MMMM yyyy, HH:mm" : "MMMM dd, yyyy, HH:mm";
  const generatedDate = format(new Date(), dateFormat, { locale: dateLocale });
  const energyPrice = project.energy_price_kwh || project.data.energy_price_kwh || 0;

  // --- 2. CAPTURE CHARTS (parallel) ---
  onProgress?.(t.progress.capturingCharts);
  const [energyChartImg, deviceChartImg, waterChartImg, airQualityChartImg] = await Promise.all([
    moduleConfig.energy.enabled && chartRefs?.energyChart ? captureChartAsImage(chartRefs.energyChart) : null,
    moduleConfig.energy.enabled && chartRefs?.deviceChart ? captureChartAsImage(chartRefs.deviceChart) : null,
    moduleConfig.water.enabled && chartRefs?.waterChart ? captureChartAsImage(chartRefs.waterChart) : null,
    moduleConfig.air.enabled && chartRefs?.airQualityChart ? captureChartAsImage(chartRefs.airQualityChart) : null,
  ]);

  // --- COMPUTED METRICS ---
  // null ≠ 0 (analisi #1.2): quando il chiamante passa null non c'e' NESSUNA
  // misura nel periodo → tutto N/A. Un 0 reale (impianto spento) resta 0.
  // Senza precalcolo si somma il consumo, e array vuoto => null (non 0).
  const totalEnergyKwh: number | null =
    precalculatedTotals?.totalEnergyKwh !== undefined
      ? precalculatedTotals.totalEnergyKwh
      : (moduleConfig.energy.enabled && data.energy.consumption.length > 0
          ? data.energy.consumption.reduce((s, r) => s + extractNum(r, 'value', 'Consumo (kWh)', 'Consumption (kWh)', 'kwh', 'actual'), 0)
          : null);
  const energyMissing = totalEnergyKwh == null;
  const totalCo2Kg: number | null =
    precalculatedTotals?.totalCo2Kg !== undefined ? precalculatedTotals.totalCo2Kg
      : (energyMissing ? null : (totalEnergyKwh as number) * CO2_EMISSION_FACTOR_KG_KWH);
  const totalCostEur: number | null =
    precalculatedTotals?.totalCostEur !== undefined ? precalculatedTotals.totalCostEur
      : (energyMissing || !(energyPrice > 0) ? null : (totalEnergyKwh as number) * energyPrice);

  // --- 3. AI DIAGNOSIS (parallel with chart capture if possible) ---
  // Guardia: la diagnosi AI parte SOLO se c'e' davvero qualcosa da
  // analizzare. Con tutti zeri il modello inventava un "blackout totale /
  // interruzione di corrente" (visto su un report reale): un documento del
  // genere in mano a un cliente e' un danno, e viola la regola d'oro
  // (mai spacciare un'assenza di dato per un fatto). Se non c'e' copertura,
  // niente diagnosi: al suo posto una riga neutra e onesta.
  const airHasData =
    data.airQuality.co2History.length > 0 ||
    data.airQuality.tempHumidity.length > 0 ||
    data.airQuality.particulates.length > 0;
  const hasAnalyzableData = (typeof totalEnergyKwh === 'number' && totalEnergyKwh > 0) || airHasData;
  let aiDiagnosis: string | null = null;
  if (includeAiDiagnosis && hasAnalyzableData) {
    onProgress?.(t.progress.generatingAiDiagnosis);
    aiDiagnosis = await generateAiDiagnosis(project, periodLabel, data, moduleConfig, language, totalEnergyKwh);
  }

  // --- LAYOUT HELPERS ---
  const addPage = () => { doc.addPage(); yPos = margin; };
  const checkPageBreak = (height: number) => {
    if (yPos + height > pageHeight - margin) { addPage(); return true; }
    return false;
  };

  const drawHeader = (text: string, level: 1 | 2 | 3 = 1) => {
    const sizes = { 1: 18, 2: 14, 3: 11 };
    const colors = { 1: COLORS.primary, 2: COLORS.text, 3: COLORS.secondary };
    checkPageBreak(15);
    doc.setFontSize(sizes[level]);
    doc.setTextColor(...colors[level]);
    doc.setFont("FuturaLT", level <= 2 ? "bold" : "normal");
    doc.text(text, margin, yPos);
    yPos += level === 1 ? 12 : level === 2 ? 10 : 8;
  };

  const drawSeparator = () => {
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;
  };

  /**
   * Il posto di una tabella che non ha dati.
   *
   * Un report che arriva al cliente non puo' riempire un buco con numeri
   * verosimili: se la misura non c'e' il documento lo dice, e dice anche
   * perche'. Senza questo blocco un'intestazione restava sospesa sul vuoto
   * e si leggeva come un errore di generazione.
   */
  const drawNoData = (reason?: string) => {
    checkPageBreak(14);
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.secondary);
    doc.setFont("FuturaLT", "normal");
    doc.text(reason ? `${t.noData} — ${reason}` : t.noData, margin, yPos);
    yPos += 9;
  };

  const drawKeyValue = (key: string, value: string) => {
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.secondary);
    doc.setFont("FuturaLT", "normal");
    doc.text(key + ":", margin, yPos);
    doc.setTextColor(...COLORS.text);
    doc.setFont("FuturaLT", "bold");
    doc.text(value, margin + 45, yPos);
    doc.setFont("FuturaLT", "normal");
    yPos += 6;
  };

  /** Draw a colored KPI macro-block */
  const drawKpiMacroBlock = (
    x: number, y: number, w: number, h: number,
    label: string, value: string, unit: string,
    delta: string | null, isPositive: boolean | null,
    bgColor: [number, number, number]
  ) => {
    // Background
    doc.setFillColor(...bgColor);
    doc.roundedRect(x, y, w, h, 3, 3, "F");

    // Label
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.setFont("FuturaLT", "normal");
    doc.text(label, x + 5, y + 8);

    // Value
    doc.setFontSize(16);
    doc.setFont("FuturaLT", "bold");
    doc.text(`${value} ${unit}`, x + 5, y + 20);

    // Delta badge
    if (delta !== null && isPositive !== null) {
      const arrow = isPositive ? '↓' : '↑';
      const deltaText = `${arrow} ${delta}`;
      doc.setFontSize(9);
      doc.setFont("FuturaLT", "bold");
      // Semi-transparent badge
      const badgeW = doc.getTextWidth(deltaText) + 6;
      doc.setFillColor(255, 255, 255);
      doc.saveGraphicsState();
      doc.setGState(new GState({ opacity: 0.25 }));
      doc.roundedRect(x + 5, y + h - 12, badgeW, 8, 2, 2, "F");
      doc.restoreGraphicsState();
      doc.setTextColor(255, 255, 255);
      doc.text(deltaText, x + 8, y + h - 6);
    }
    doc.setFont("FuturaLT", "normal");
  };

  const drawSmallKpiCard = (x: number, y: number, w: number, title: string, value: string, unit?: string) => {
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(x, y, w, 25, 3, 3, "F");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.secondary);
    doc.text(title, x + 5, y + 8);
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.primary);
    doc.setFont("FuturaLT", "bold");
    doc.text(value + (unit ? ` ${unit}` : ""), x + 5, y + 18);
    doc.setFont("FuturaLT", "normal");
  };

  const addChartImage = (imageData: string, title: string, height: number = 60) => {
    checkPageBreak(height + 15);
    drawHeader(title, 3);
    const imgWidth = pageWidth - 2 * margin;
    doc.addImage(imageData, 'PNG', margin, yPos, imgWidth, height);
    yPos += height + 10;
  };

  /** Professional table options with zebra striping and right-aligned numbers */
  const getTableOptions = (headerColor: [number, number, number] = COLORS.tableHeaderGray) => ({
    styles: {
      font: "FuturaLT",
      fontStyle: "normal" as const,
      fontSize: 8,
      cellPadding: 3,
      textColor: COLORS.text,
      lineColor: [226, 232, 240] as [number, number, number],
      lineWidth: 0.2,
    },
    headStyles: {
      font: "FuturaLT",
      fontStyle: "bold" as const,
      fillColor: headerColor,
      textColor: COLORS.white,
      fontSize: 9,
      halign: 'left' as const,
    },
    alternateRowStyles: { fillColor: COLORS.zebraRow },
    margin: { left: margin, right: margin },
    columnStyles: {} as Record<number, { halign: 'left' | 'right' | 'center' }>,
  });

  /** Render a properly formatted table with right-aligned numeric columns */
  const renderTable = (
    headers: string[],
    rows: (string | number)[][],
    headerColor: [number, number, number] = COLORS.tableHeaderGray,
  ) => {
    if (rows.length === 0) return;
    checkPageBreak(30);

    // Detect numeric columns for right-alignment
    const colStyles: Record<number, { halign: 'left' | 'right' | 'center' }> = {};
    headers.forEach((_, idx) => {
      // Check if most values in this column are numeric
      const numericCount = rows.filter(r => !isNaN(Number(String(r[idx]).replace(/[,€%]/g, '')))).length;
      if (numericCount > rows.length * 0.5 && idx > 0) {
        colStyles[idx] = { halign: 'right' };
      }
    });

    // @ts-ignore
    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body: rows.map(row => row.map(cell => {
        if (typeof cell === 'number') return fmtNum(cell);
        return String(cell);
      })),
      ...getTableOptions(headerColor),
      columnStyles: colStyles,
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  };

  // --- Data table per granularità (Fase C2) ---------------------------------
  /** Y finale dell'ultima autoTable, tipata (evita il cast ad any). */
  const lastTableY = (): number =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos;
  const MAGENTA: [number, number, number] = [138, 16, 96];   // #8A1060 — attenzione/allarme
  const WEEKEND_TINT: [number, number, number] = [230, 250, 240]; // mint1 #E6FAF0
  const MUTED: [number, number, number] = [148, 163, 184];   // futuro / vuoto
  const AMBER: [number, number, number] = [154, 91, 5];      // #9A5B05 — incompleto

  const fmtLocal = (v: number | null | undefined, dec: number): string => {
    if (v === null || v === undefined || !Number.isFinite(Number(v))) return '–';
    const s = Number(v).toFixed(dec);
    return isIt ? s.replace('.', ',') : s;
  };

  /** Stato testuale di un bucket (priorità: futuro > allarme > incompleto > ok). */
  const bucketStateText = (b: ReportBucket): string => {
    if (b.future) return t.dataTable.future;
    if (b.empty) return '–';
    if (b.alarm) return t.dataTable.alarm;
    if (b.incomplete) return t.dataTable.incomplete;
    return t.dataTable.ok;
  };

  const drawDataTable = (payload: ReportTablePayload, noteLine?: string) => {
    const { series } = payload;
    if (!series.buckets.length) return;
    const buckets = series.buckets;

    checkPageBreak(26);
    // Intestazione card: titolo + tag granularità a destra
    drawHeader(payload.title, 3);
    doc.setFont('FuturaLT', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.secondary);
    doc.text(series.granularityTag, pageWidth - margin, yPos - 6, { align: 'right' });
    if (noteLine) {
      doc.text(noteLine, margin, yPos - 1);
      yPos += 3;
    }

    const headers = [
      t.dataTable.bucket,
      `${t.dataTable.value}${payload.unit ? ` (${payload.unit})` : ''}`,
      t.dataTable.coverage,
      t.dataTable.state,
    ];
    const body = buckets.map((b) => [
      b.label,
      b.future || b.empty ? '–' : fmtLocal(b.value, payload.decimals),
      b.future || b.empty ? '–' : `${Math.round(b.coverage * 100)}%`,
      bucketStateText(b),
    ]);
    // Riga di sintesi (totale o media del periodo)
    body.push([
      payload.summaryLabel,
      fmtLocal(series.summaryValue, payload.decimals),
      '',
      '',
    ]);
    const summaryIdx = body.length - 1;

    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body,
      ...getTableOptions(COLORS.primary),
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'left' },
      },
      didParseCell: (hook: CellHookData) => {
        if (hook.section !== 'body') return;
        const r = hook.row.index;
        const c = hook.column.index;
        if (r === summaryIdx) {
          hook.cell.styles.fontStyle = 'bold';
          hook.cell.styles.fillColor = COLORS.lightGray;
          return;
        }
        const b = buckets[r];
        if (!b) return;
        if (b.weekend) hook.cell.styles.fillColor = WEEKEND_TINT;
        if (b.future || b.empty) {
          hook.cell.styles.textColor = MUTED;
          return;
        }
        // Valore + stato in allarme → magenta grassetto
        if (b.alarm && (c === 1 || c === 3)) {
          hook.cell.styles.textColor = MAGENTA;
          hook.cell.styles.fontStyle = 'bold';
        } else if (b.incomplete && c === 3) {
          hook.cell.styles.textColor = AMBER;
        }
      },
    });
    yPos = lastTableY() + 8;
  };

  // --- Sezione Allarmi completa (Fase C3) -----------------------------------
  const drawAlarmsSection = () => {
    const alarms = reportTables?.alarms ?? [];
    addPage();
    drawHeader(t.alarms.section, 2);
    doc.setFont('FuturaLT', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.secondary);
    const subLines = doc.splitTextToSize(t.alarms.subtitle, pageWidth - 2 * margin);
    doc.text(subLines, margin, yPos);
    yPos += subLines.length * 4 + 3;

    if (!alarms.length) {
      drawNoData(t.alarms.none);
      return;
    }
    const headers = [t.alarms.severity, t.alarms.metric, t.alarms.when, t.alarms.value, t.alarms.threshold];
    const body = alarms.map((a) => [
      a.severity === 'critical' ? t.status.critical : t.status.warning,
      a.metric,
      a.when,
      a.value,
      a.threshold,
    ]);
    autoTable(doc, {
      startY: yPos,
      head: [headers],
      body,
      ...getTableOptions(COLORS.primary),
      columnStyles: { 3: { halign: 'right' } },
      didParseCell: (hook: CellHookData) => {
        if (hook.section !== 'body') return;
        const a = alarms[hook.row.index];
        if (!a) return;
        if (hook.column.index === 0) {
          hook.cell.styles.fontStyle = 'bold';
          hook.cell.styles.textColor = a.severity === 'critical' ? MAGENTA : AMBER;
        }
      },
    });
    yPos = lastTableY() + 10;
  };

  // --- Invito all'attivazione (come la card dell'overview) ------------------
  // Mostra il pitch dei moduli non monitorati: oggi solo Acqua, quando il
  // sito non ha una sorgente idrica (al posto della sezione vuota rimossa).
  const drawInvite = (waterMissing: boolean) => {
    if (!waterMissing) return;
    const pitch = t.invite.water;
    checkPageBreak(42);
    const x = margin;
    const w = pageWidth - 2 * margin;
    const boxTop = yPos;
    // card chiara con bordo tenue, stile overview
    doc.setFillColor(246, 249, 248);
    doc.setDrawColor(227, 238, 233);
    doc.roundedRect(x, boxTop, w, 34, 3, 3, 'FD');
    let iy = boxTop + 8;
    doc.setFont('FuturaLT', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.primary);
    doc.text(t.invite.heading.toUpperCase(), x + 6, iy);
    iy += 7;
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.text);
    doc.text(pitch.title, x + 6, iy);
    iy += 6.5;
    doc.setFont('FuturaLT', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.secondary);
    const bodyLines = doc.splitTextToSize(pitch.body, w - 12);
    doc.text(bodyLines, x + 6, iy);
    iy += bodyLines.length * 4.4 + 2;
    doc.setFont('FuturaLT', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.primary);
    doc.text(t.invite.cta, x + 6, iy);
    yPos = boxTop + 34 + 10;
  };

  // ================================================================
  //  PAGE 1: COVER
  // ================================================================
  const headerHeight = 110;
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  // Logo (preloaded, no race condition)
  if (headerLogoData) {
    const originalDims = await getImageDimensions(headerLogoData);
    const targetWidth = 80;
    const aspectRatio = originalDims.height / originalDims.width;
    const targetHeight = targetWidth * aspectRatio;
    const hLogoX = (pageWidth - targetWidth) / 2;
    doc.addImage(headerLogoData, 'PNG', hLogoX, 15, targetWidth, targetHeight);
  }

  // Cover text
  doc.setTextColor(255, 255, 255);
  const centerX = pageWidth / 2;
  doc.setFontSize(26);
  doc.setFont("FuturaLT", "bold");
  doc.text(t.cover.title, centerX, 85, { align: 'center' });
  doc.setFontSize(16);
  doc.setFont("FuturaLT", "normal");
  doc.text(project.displayName || project.name, centerX, 95, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`${t.cover.period}: ${periodLabel}`, centerX, 102, { align: 'center' });

  // Intervallo EFFETTIVO (analisi #7): per un mese in corso dichiara i giorni
  // trascorsi su quelli del mese, cosi' "November 2026" non nasconde il parziale.
  if (periodRange?.start && periodRange?.end) {
    const ds = new Date(periodRange.start), de = new Date(periodRange.end);
    const fmtD = (d: Date) => format(d, isIt ? 'dd/MM/yyyy' : 'MMM dd, yyyy', { locale: dateLocale });
    const elapsedDays = Math.max(0, (de.getTime() - ds.getTime()) / 86400e3);
    // giorni totali del mese se l'orizzonte e' mensile
    const monthDays = new Date(ds.getFullYear(), ds.getMonth() + 1, 0).getDate();
    const partial = String(timePeriod).toLowerCase().includes('month') && elapsedDays < monthDays - 0.5;
    const rangeStr = `${fmtD(ds)} – ${fmtD(de)}`
      + (partial ? (isIt ? ` · parziale, ${elapsedDays.toFixed(0)} gg su ${monthDays}` : ` · partial, ${elapsedDays.toFixed(0)} of ${monthDays} days`) : '');
    doc.setFontSize(8.5);
    doc.text(rangeStr, centerX, 108, { align: 'center' });
    doc.setFontSize(11);
  }

  // Project info box
  yPos = 125;
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 50, 3, 3, "F");
  yPos += 10;
  doc.setTextColor(...COLORS.text);
  drawKeyValue(t.cover.address, project.address);
  if (brand) drawKeyValue(t.cover.brand, brand.name);
  if (holding) drawKeyValue(t.cover.holding, holding.name);
  drawKeyValue(t.cover.region, project.region.toUpperCase());
  drawKeyValue(t.cover.generatedOn, generatedDate);

  // --- KPI MACRO-BLOCKS (Cost / Consumption / Emissions) ---
  yPos = 190;
  drawHeader(isIt ? "Indicatori Chiave del Periodo" : "Key Period Indicators", 2);
  yPos += 3;

  if (moduleConfig.energy.enabled) {
    const blockW = (pageWidth - 2 * margin - 10) / 3;
    const blockH = 30;

    // value + unit insieme: "N/A" quando manca (nessuna unita'), altrimenti
    // il numero con la sua unita' (un vero 0 resta 0).
    const costMissing = totalCostEur == null;
    const co2Missing = totalCo2Kg == null;
    drawKpiMacroBlock(
      margin, yPos, blockW, blockH,
      isIt ? 'Costo Stimato' : 'Estimated Cost',
      costMissing ? N_A : fmtNum(totalCostEur, 0), costMissing ? '' : '€',
      null, null, COLORS.accent,
    );
    drawKpiMacroBlock(
      margin + blockW + 5, yPos, blockW, blockH,
      isIt ? 'Consumo Totale' : 'Total Consumption',
      energyMissing ? N_A : fmtNum(totalEnergyKwh, 0), energyMissing ? '' : 'kWh',
      null, null, COLORS.primary,
    );
    drawKpiMacroBlock(
      margin + 2 * (blockW + 5), yPos, blockW, blockH,
      isIt ? 'Emissioni CO2eq' : 'CO2eq Emissions',
      co2Missing ? N_A : fmtNum((totalCo2Kg as number) / 1000, 2), co2Missing ? '' : (isIt ? 'ton' : 't'),
      null, null, [120, 53, 15], // dark amber
    );
    yPos += blockH + 10;
  }

  // --- SMALL KPI CARDS (Air / Environment) ---
  // fmtValue: niente piu' la stringa "null" ne' il 45% hardcoded; se il dato
  // di periodo manca, la card mostra "N/A" senza unita'.
  const activeKpis: { title: string; value: string; unit: string }[] = [];
  if (moduleConfig.air.enabled || moduleConfig.energy.enabled) {
    activeKpis.push({ title: t.kpis.temperature, value: fmtValue(project.data.temp, "°C", 0), unit: "" });
  }
  if (moduleConfig.air.enabled) {
    activeKpis.push({ title: t.kpis.co2, value: fmtValue(project.data.co2, "ppm", 0), unit: "" });
    activeKpis.push({ title: t.kpis.airQuality, value: isMissing(project.data.aq) ? N_A : String(project.data.aq), unit: "" });
    activeKpis.push({ title: t.kpis.humidity, value: fmtValue(project.data.humidity, "%", 0), unit: "" });
  }
  if (activeKpis.length > 0) {
    const cardGap = 5;
    const cardWidth = (pageWidth - 2 * margin - (cardGap * (activeKpis.length - 1))) / activeKpis.length;
    activeKpis.forEach((kpi, index) => {
      drawSmallKpiCard(margin + (cardWidth + cardGap) * index, yPos, cardWidth, kpi.title, kpi.value, kpi.unit);
    });
    yPos += 30;
  }

  // ================================================================
  //  PAGE 2: EXECUTIVE SUMMARY + ACTION PLAN (AI Diagnosis First!)
  // ================================================================
  if (!aiDiagnosis && includeAiDiagnosis && !hasAnalyzableData) {
    // Nessun dato nel periodo: lo si dichiara, non si inventa una diagnosi.
    addPage();
    drawHeader(isIt ? "Sintesi Esecutiva e Piano d'Azione" : "Executive Summary & Action Plan", 1);
    drawSeparator();
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.secondary);
    doc.setFont("FuturaLT", "normal");
    const noDataMsg = isIt
      ? "Nessun dato disponibile per il periodo selezionato: la diagnosi non viene generata. Verificare la copertura dei sensori o scegliere un intervallo con letture."
      : "No data available for the selected period: the diagnosis is not generated. Check sensor coverage or choose a range with readings.";
    doc.text(doc.splitTextToSize(noDataMsg, pageWidth - 2 * margin), margin, yPos);
    yPos += 20;
  }
  if (aiDiagnosis) {
    addPage();
    drawHeader(isIt ? "Sintesi Esecutiva e Piano d'Azione" : "Executive Summary & Action Plan", 1);
    drawSeparator();

    // AI Badge
    doc.setFillColor(...COLORS.accent);
    const badgeText = t.aiSection.badge;
    const badgeWidth = doc.getTextWidth(badgeText) + 10;
    doc.roundedRect(margin, yPos, Math.min(badgeWidth, pageWidth - 2 * margin), 8, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(badgeText, margin + 3, yPos + 5.5);
    yPos += 15;

    // Carbon footprint: solo se l'energia ha davvero un dato (niente box con
    // "– kWh" su un sito solo-aria). «Correlazione» era un refuso (#13): e'
    // una moltiplicazione, non una correlazione.
    if (moduleConfig.energy.enabled && !energyMissing) {
      checkPageBreak(25);
      doc.setFillColor(240, 253, 244); // light green bg
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 20, 3, 3, "F");
      doc.setDrawColor(...COLORS.success);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 20, 3, 3, "S");

      doc.setFontSize(9);
      doc.setTextColor(...COLORS.text);
      doc.setFont("FuturaLT", "bold");
      const correlationTitle = isIt ? 'Emissioni da consumo energetico' : 'Emissions from energy consumption';
      doc.text(correlationTitle, margin + 5, yPos + 7);
      doc.setFont("FuturaLT", "normal");
      doc.setFontSize(8);
      const correlationText = isIt
        ? `Consumo: ${fmtNum(totalEnergyKwh, 0)} kWh × EF ${CO2_EMISSION_FACTOR_KG_KWH} kg/kWh = ${fmtNum(totalCo2Kg, 1)} kg CO2eq (${fmtNum(totalCo2Kg / 1000, 2)} tonnellate)`
        : `Consumption: ${fmtNum(totalEnergyKwh, 0)} kWh × EF ${CO2_EMISSION_FACTOR_KG_KWH} kg/kWh = ${fmtNum(totalCo2Kg, 1)} kg CO2eq (${fmtNum(totalCo2Kg / 1000, 2)} tonnes)`;
      doc.text(correlationText, margin + 5, yPos + 14);
      yPos += 25;
    }

    // Render AI diagnosis with clean markdown parsing
    renderAiDiagnosis(doc, aiDiagnosis, margin, pageWidth, pageHeight, yPos, checkPageBreak, drawSeparator, drawHeader);
    yPos = (doc as any).__lastYPos || yPos;

    // Disclaimer
    yPos += 10;
    checkPageBreak(20);
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 15, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.secondary);
    doc.text(t.aiSection.disclaimerLine1, margin + 3, yPos + 5);
    doc.text(t.aiSection.disclaimerLine2, margin + 3, yPos + 10);
    yPos += 20;
  }

  // ================================================================
  //  ENERGY SECTION
  // ================================================================
  if (moduleConfig.energy.enabled) {
    addPage();
    drawHeader(t.sections.energyDashboard, 1);
    drawSeparator();

    if (energyChartImg) addChartImage(energyChartImg, t.energy.consumptionChart, 55);

    // Energy consumption table with cost column.
    // Quando c'e' la nuova tabella granulare (reportTables.energy) la salto:
    // la sostituisce in fondo alla sezione, con copertura e flag di stato e
    // SENZA il vecchio energyScaleFactor che riscalava le righe sul totale.
    if (!reportTables?.energy) {
      drawHeader(t.energy.consumption, 2);
      if (data.energy.consumption.length > 0) {
        const headers = [
          isIt ? 'Periodo' : 'Period',
          isIt ? 'Consumo (kWh)' : 'Consumption (kWh)',
          isIt ? 'Costo Stimato (€)' : 'Est. Cost (€)',
          'CO2 (kg)',
        ];

        // Calculate energy scale factor so rows sum to totalEnergyKwh exactly
        const totalTableKwh = data.energy.consumption.reduce((s, r) => s + extractNum(r, 'value', 'Consumo (kWh)', 'Consumption (kWh)', 'kwh', 'actual'), 0);
        const energyScaleFactor = (totalTableKwh > 0 && typeof totalEnergyKwh === 'number' && totalEnergyKwh > 0) ? (totalEnergyKwh / totalTableKwh) : 1;

        const rows = data.energy.consumption.map(row => {
          const label = String(row['label'] || row['name'] || row['period'] || Object.values(row)[0] || '–');
          const rawKwh = extractNum(row, 'value', 'Consumo (kWh)', 'Consumption (kWh)', 'kwh', 'actual');
          const kwh = rawKwh * energyScaleFactor;
          const cost = kwh * energyPrice;
          const co2 = kwh * CO2_EMISSION_FACTOR_KG_KWH;
          return [label, fmtNum(kwh), energyPrice > 0 ? fmtNum(cost) : N_A, fmtNum(co2)];
        });
        renderTable(headers, rows, COLORS.primary);
      } else {
        // Fase A (analisi #4.2): Energy non lasciava il titolo nel vuoto come
        // Water/Air — stesso empty-state per tutte le sezioni.
        drawNoData(t.noDataReasons.period);
      }
    }

    if (deviceChartImg) {
      checkPageBreak(70);
      addChartImage(deviceChartImg, t.energy.deviceChart, 55);
    }

    // Device consumption table with cost
    checkPageBreak(60);
    drawHeader(t.energy.deviceConsumption, 2);
    if (data.energy.devices.length > 0) {
      const headers = [
        t.tables.device,
        t.tables.category || (isIt ? 'Categoria' : 'Category'),
        t.tables.consumptionKwh,
        isIt ? 'Costo (€)' : 'Cost (€)',
        t.tables.co2Kg,
      ];
      const rows = data.energy.devices.map(row => {
        const name = String(row['name'] || row['Dispositivo'] || row['Device'] || Object.values(row)[0] || '–');
        const category = String(row['category'] || row['Categoria'] || row['Category'] || '–');
        const kwh = extractNum(row, 'value', 'Consumo (kWh)', 'Consumption (kWh)', 'kwh');
        const cost = kwh * energyPrice;
        const co2 = kwh * CO2_EMISSION_FACTOR_KG_KWH;
        return [name, category, fmtNum(kwh), energyPrice > 0 ? fmtNum(cost) : '–', fmtNum(co2)];
      });
      renderTable(headers, rows, COLORS.primary);
    }

    // CO2 Emissions summary
    checkPageBreak(30);
    drawHeader(t.energy.co2Emissions, 2);
    const co2SummaryHeaders = [
      isIt ? 'Metrica' : 'Metric',
      isIt ? 'Valore' : 'Value',
      isIt ? 'Unità' : 'Unit',
    ];
    const co2SummaryRows = [
      [isIt ? 'Consumo Totale' : 'Total Consumption', energyMissing ? N_A : fmtNum(totalEnergyKwh), 'kWh'],
      [isIt ? 'Fattore di Emissione' : 'Emission Factor', String(CO2_EMISSION_FACTOR_KG_KWH), 'kg CO2/kWh'],
      [isIt ? 'Emissioni Totali' : 'Total Emissions', totalCo2Kg == null ? N_A : fmtNum(totalCo2Kg / 1000, 3), isIt ? 'tonnellate CO2eq' : 'tonnes CO2eq'],
    ];
    if (energyPrice > 0) {
      co2SummaryRows.push([isIt ? 'Costo Totale Stimato' : 'Estimated Total Cost', totalCostEur == null ? N_A : fmtNum(totalCostEur), '€']);
      co2SummaryRows.push([isIt ? 'Prezzo Unitario' : 'Unit Price', fmtNum(energyPrice, 4), '€/kWh']);
    }
    renderTable(co2SummaryHeaders, co2SummaryRows, COLORS.success);
  }

  // Tabella dati energia per granularità (Fase C2): chiude la sezione.
  if (reportTables?.energy) {
    drawDataTable(reportTables.energy, reportTables.granularityNote);
  }

  // ================================================================
  //  WATER SECTION
  // ================================================================
  // Acqua senza dati: niente sezione (richiesta del proprietario). Al suo
  // posto, un invito in fondo (drawInvite), come la card dell'overview.
  const hasWaterData =
    !!reportTables?.water ||
    data.water.consumption.length > 0 ||
    data.water.quality.length > 0 ||
    data.water.leaks.length > 0;
  if (moduleConfig.water.enabled && hasWaterData) {
    addPage();
    drawHeader(t.sections.waterDashboard, 1);
    drawSeparator();

    if (waterChartImg) addChartImage(waterChartImg, t.water.consumptionChart, 55);

    drawHeader(t.water.consumption, 2);
    if (data.water.consumption.length > 0) {
      const keys = Object.keys(data.water.consumption[0]);
      const headers = keys.map(k => k);
      const rows = data.water.consumption.map(row => keys.map(k => {
        const val = row[k];
        if (typeof val === 'number') return fmtNum(val);
        return String(val ?? '–');
      }));
      renderTable(headers, rows, COLORS.accent);
    } else {
      drawNoData(t.noDataReasons.period);
    }

    checkPageBreak(60);
    drawHeader(t.water.quality, 2);
    if (data.water.quality.length > 0) {
      const keys = Object.keys(data.water.quality[0]);
      const rows = data.water.quality.map(row => keys.map(k => {
        const val = row[k];
        if (typeof val === 'number') return fmtNum(val);
        return String(val ?? '–');
      }));
      renderTable(keys, rows, COLORS.accent);
    } else {
      // pH, torbidita' e cloro non sono misurati da nessun contatore installato
      drawNoData(t.noDataReasons.noSensors);
    }

    checkPageBreak(60);
    drawHeader(t.water.leakDetection, 2);
    if (data.water.leaks.length > 0) {
      const headers = [t.tables.zone, t.tables.leakRate, t.tables.status, t.tables.detected];
      const rows = data.water.leaks.map(row => [
        String(row.zone ?? '–'),
        String(row.leakRate ?? '–'),
        row.status === "ok" ? t.status.ok : row.status === "warning" ? t.status.warning : t.status.critical,
        String(row.detected || "–"),
      ]);
      renderTable(headers, rows, COLORS.warning);
    } else {
      // Il perimetro idrico non ha contatori per zona: nessuna perdita per zona
      drawNoData(t.noDataReasons.noSensors);
    }

    // Tabella dati acqua per granularità (Fase C2). Oggi assente: nessuna
    // telemetria idrica reale cablata → la sezione resta con gli empty-state
    // soprastanti, senza numeri inventati.
    if (reportTables?.water) {
      drawDataTable(reportTables.water, reportTables.granularityNote);
    }
  }

  // ================================================================
  //  AIR QUALITY SECTION
  // ================================================================
  if (moduleConfig.air.enabled) {
    addPage();
    drawHeader(t.sections.airQualityDashboard, 1);
    drawSeparator();

    if (airQualityChartImg) addChartImage(airQualityChartImg, t.airQuality.chart, 55);

    // CO₂/TVOC e T/RH: le vecchie tabelle-dump della serie. Quando ci sono le
    // nuove tabelle granulari (reportTables.air) le salto — le sostituiscono in
    // fondo, con copertura, flag di stato e valori in allarme evidenziati.
    if (!reportTables?.air?.length) {
      drawHeader(t.airQuality.co2TvocHistory, 2);
      if (data.airQuality.co2History.length > 0) {
        const keys = Object.keys(data.airQuality.co2History[0]);
        const rows = data.airQuality.co2History.map(row => keys.map(k => {
          const val = row[k];
          if (typeof val === 'number') return fmtNum(val);
          return String(val ?? '–');
        }));
        renderTable(keys, rows, COLORS.success);
      } else {
        drawNoData(t.noDataReasons.period);
      }

      checkPageBreak(60);
      drawHeader(t.airQuality.tempHumidity, 2);
      if (data.airQuality.tempHumidity.length > 0) {
        const keys = Object.keys(data.airQuality.tempHumidity[0]);
        const rows = data.airQuality.tempHumidity.map(row => keys.map(k => {
          const val = row[k];
          if (typeof val === 'number') return fmtNum(val);
          return String(val ?? '–');
        }));
        renderTable(keys, rows, COLORS.primary);
      } else {
        drawNoData(t.noDataReasons.period);
      }
    }

    checkPageBreak(60);
    drawHeader(t.airQuality.particulates, 2);
    if (data.airQuality.particulates.length > 0) {
      const keys = Object.keys(data.airQuality.particulates[0]);
      const rows = data.airQuality.particulates.map(row => keys.map(k => {
        const val = row[k];
        if (typeof val === 'number') return fmtNum(val);
        return String(val ?? '–');
      }));
      renderTable(keys, rows, COLORS.warning);
    } else {
      // Il particolato lo misurano solo le sonde WELL, non le LEED
      drawNoData(t.noDataReasons.noSensors);
    }

    // Tabelle dati aria per granularità (Fase C2): T, RH, CO₂. La nota di
    // granularità compare una sola volta, sulla prima tabella.
    if (reportTables?.air?.length) {
      reportTables.air.forEach((tbl, i) =>
        drawDataTable(tbl, i === 0 ? reportTables!.granularityNote : undefined),
      );
    }
  }

  // ================================================================
  //  ALARMS SECTION (Fase C3) — elenco completo, generato dal sistema
  // ================================================================
  if (reportTables) {
    drawAlarmsSection();
  }

  // Invito finale (stile overview) per i moduli non monitorati: Acqua.
  drawInvite(!hasWaterData);

  // ================================================================
  //  POST-PROCESSING: WATERMARK & FOOTER
  // ================================================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Watermark
    if (watermarkData) {
      doc.saveGraphicsState();
      doc.setGState(new GState({ opacity: 0.05 }));
      const wSize = 60;
      try {
        doc.addImage(watermarkData, 'PNG', (pageWidth - wSize) / 2, (pageHeight - wSize) / 2, wSize, wSize);
      } catch (e) {
        console.warn("Watermark rendering failed", e);
      }
      doc.restoreGraphicsState();
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.secondary);
    doc.setFont("FuturaLT", "normal");
    doc.text(
      `${t.footer.page} ${i} ${t.footer.of} ${totalPages} | ${project.displayName || project.name} | ${periodLabel}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" },
    );
  }

  onProgress?.(t.progress.savingPdf);
  const filename = `Report_${(project.displayName || project.name).replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  // Su app nativa: share sheet di sistema (WhatsApp, Mail, AirDrop...) invece
  // del download del blob, che su mobile è goffo e spesso "sparisce".
  const { Capacitor } = await import("@capacitor/core");
  if (Capacitor.isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      const base64 = doc.output("datauristring").split(",")[1];
      const write = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
      await Share.share({ title: filename, files: [write.uri] });
      return;
    } catch (e) {
      console.error("Native share failed, fallback to download", e);
    }
  }
  doc.save(filename);
};

// ================================================================
//  AI DIAGNOSIS MARKDOWN RENDERER (with LaTeX cleaning)
// ================================================================
function renderAiDiagnosis(
  doc: jsPDF,
  aiDiagnosis: string,
  margin: number,
  pageWidth: number,
  pageHeight: number,
  startY: number,
  checkPageBreak: (h: number) => boolean,
  drawSeparator: () => void,
  drawHeader: (text: string, level: 1 | 2 | 3) => void,
) {
  let yPos = startY;

  const lines = aiDiagnosis.split('\n');

  for (let line of lines) {
    line = line.trim();
    if (!line) { yPos += 3; continue; }

    // Clean LaTeX artifacts
    line = cleanLatex(line);

    if (yPos + 12 > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }

    // Separator lines
    if (line === '---' || line === '***') {
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;
      continue;
    }

    // Headings
    if (line.startsWith('#')) {
      const title = line.replace(/^#+\s*/, '').replace(/\*\*/g, '');
      yPos += 3;
      doc.setFontSize(12);
      doc.setFont("FuturaLT", "bold");
      doc.setTextColor(0, 75, 77);
      doc.text(title, margin, yPos);
      yPos += 7;
      continue;
    }

    // Bullet points
    if (line.match(/^[*•\-]\s/)) {
      const content = line.replace(/^[*•\-]\s*/, '').replace(/\*\*/g, '');
      doc.setFontSize(9);
      doc.setFont("FuturaLT", "normal");
      doc.setTextColor(30, 41, 59);
      const splitText = doc.splitTextToSize(`• ${content}`, pageWidth - 2 * margin - 5);
      doc.text(splitText, margin + 3, yPos);
      yPos += splitText.length * 5;
      continue;
    }

    // Normal text (clean bold markers)
    const cleanLine = line.replace(/\*\*/g, '').replace(/__/g, '');
    doc.setFontSize(9);
    const isKeyValue = /^[A-Za-zÀ-ú\s]+:/.test(cleanLine) && cleanLine.length < 80;
    doc.setFont("FuturaLT", isKeyValue ? "bold" : "normal");
    doc.setTextColor(30, 41, 59);
    const splitText = doc.splitTextToSize(cleanLine, pageWidth - 2 * margin);
    doc.text(splitText, margin, yPos);
    yPos += splitText.length * 5;
  }

  // Store final yPos for caller
  (doc as any).__lastYPos = yPos;
}

// ================================================================
//  AI DIAGNOSIS API CALL
// ================================================================
async function generateAiDiagnosis(
  project: Project,
  periodLabel: string,
  data: ReportData,
  moduleConfig: ReportModuleConfig,
  language: ReportLanguage,
  totalEnergyKwh?: number | null,
): Promise<string | null> {
  try {
    // Fase B (analisi #3.2/#3.3/#6): all'AI si passa solo cio' che e' stato
    // MISURATO, con null espliciti e l'inventario di cosa esiste sul sito.
    // Cosi' il modello non confonde "non installato" con "guasto" e non
    // inventa numeri. Energia null = nessuna misura nel periodo (non 0).
    const energyPresent = totalEnergyKwh != null && totalEnergyKwh > 0;
    const co2Total = data.energy.co2.reduce((s, r) => s + extractNum(r, 'value', 'CO2 (kg)', 'CO₂ (kg)', 'co2'), 0);

    const energyPayload = (moduleConfig.energy.enabled && energyPresent) ? {
      totalConsumption: totalEnergyKwh,
      breakdown: data.energy.devices.map(d => ({
        name: String(d['name'] || d['Dispositivo'] || d['Device'] || ''),
        kwh: extractNum(d, 'value', 'Consumo (kWh)', 'Consumption (kWh)', 'kwh'),
      })),
      co2Total: co2Total || (totalEnergyKwh as number) * CO2_EMISSION_FACTOR_KG_KWH,
    } : null;

    const waterTotal = data.water.consumption.reduce((s, r) => s + extractNum(r, 'value', 'consumption'), 0);
    const waterPayload = moduleConfig.water.enabled && data.water.consumption.length > 0 ? {
      totalConsumption: waterTotal,
      leaksDetected: data.water.leaks.filter(l => l['status'] !== 'ok').length,
    } : null;

    // Aria: solo le metriche davvero presenti; null dove manca, mai un numero
    // di comodo. L'elenco metricsAvailable dice all'AI cosa NON e' monitorato.
    const airMetricsAvailable: string[] = [];
    if (data.airQuality.co2History.length > 0) airMetricsAvailable.push('CO2');
    if (data.airQuality.tempHumidity.length > 0) airMetricsAvailable.push('temperature', 'humidity');
    if (data.airQuality.particulates.length > 0) airMetricsAvailable.push('PM2.5', 'PM10');
    const airPayload = (moduleConfig.air.enabled && airMetricsAvailable.length > 0) ? {
      avgTemp: project.data.temp ?? null,
      avgCo2: project.data.co2 ?? null,
      avgHumidity: project.data.humidity ?? null,
      avgAqi: project.data.aq ?? null,
      metricsAvailable: airMetricsAvailable,
    } : null;

    const { data: result, error } = await supabase.functions.invoke('energy-diagnosis', {
      body: {
        projectName: project.displayName || project.name,
        period: periodLabel,
        language,
        // Inventario: cosa e' effettivamente MONITORATO con dati nel periodo.
        installed: {
          energy: energyPayload !== null,
          water: waterPayload !== null,
          air: airPayload !== null,
        },
        siteAreaM2: Number(project.area_m2) > 0 ? Number(project.area_m2) : null,
        energyData: energyPayload,
        waterData: waterPayload,
        airData: airPayload,
      },
    });

    if (error) {
      console.error("AI Diagnosis function error:", error);
      return null;
    }

    return result.diagnosis;
  } catch (error) {
    console.error("Failed to generate AI diagnosis:", error);
    return `
# Diagnosis Unavailable
Unable to generate AI diagnosis at this time.
Please check your internet connection or try again later.
    `;
  }
}
