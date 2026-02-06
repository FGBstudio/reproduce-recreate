import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { Project, getBrandById, getHoldingById } from "@/lib/data";
import { TimePeriod } from "./TimePeriodSelector";
import { DateRange, getPeriodLabel } from "@/hooks/useTimeFilteredData";
import { generateEnergyDiagnosis, EnergyDiagnosisInput } from "@/lib/energyDiagnosis";
import { ReportLanguage, getTranslations, getDateLocale } from "@/lib/translations/pdfReport";

// --- INTERFACCE DATI ---
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
}

// --- COSTANTI E COLORI ---
const COLORS = {
  primary: [0, 75, 77] as [number, number, number],
  secondary: [100, 116, 139] as [number, number, number],
  accent: [59, 130, 246] as [number, number, number],
  success: [16, 185, 129] as [number, number, number],
  warning: [245, 158, 11] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  lightGray: [241, 245, 249] as [number, number, number],
};

// --- HELPER FUNCTIONS ---

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

// Helper per ottenere le dimensioni originali dell'immagine (per mantenere aspect ratio)
const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = `data:image/png;base64,${base64}`;
  });
};

const captureChartAsImage = async (ref: React.RefObject<HTMLDivElement | null>): Promise<string | null> => {
  if (!ref?.current) return null;
  try {
    const canvas = await html2canvas(ref.current, { 
      backgroundColor: '#ffffff', 
      scale: 2,
      logging: false,
      useCORS: true
    });
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Chart capture failed:', error);
    return null;
  }
};

// --- FUNZIONE PRINCIPALE DI GENERAZIONE ---
export const generatePdfReport = async ({ 
  project, 
  timePeriod, 
  dateRange, 
  data, 
  moduleConfig,
  chartRefs, 
  includeAiDiagnosis = true, 
  onProgress,
  language = 'en'
}: GeneratePdfOptions) => {
  const t = getTranslations(language);
  const dateLocale = await getDateLocale(language);
  
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // --- 1. CARICAMENTO RISORSE ---
  onProgress?.("Caricamento Risorse...");
  
  let headerLogoData: string | null = null;
  let watermarkData: string | null = null;
  
  try {
    const [fontRegular, fontBold, imgHeader, imgWatermark] = await Promise.all([
      loadFileAsBase64('/fonts/FuturaLT-Book.ttf'),
      loadFileAsBase64('/fonts/FuturaLT-Bold.ttf'),
      loadFileAsBase64('/white-logo.png').catch(() => null),
      loadFileAsBase64('/favicon.ico').catch(() => null)
    ]);

    doc.addFileToVFS("FuturaLT-Regular.ttf", fontRegular);
    doc.addFileToVFS("FuturaLT-Bold.ttf", fontBold);
    doc.addFont("FuturaLT-Regular.ttf", "FuturaLT", "normal");
    doc.addFont("FuturaLT-Bold.ttf", "FuturaLT", "bold");
    doc.setFont("FuturaLT", "normal");

    headerLogoData = imgHeader;
    watermarkData = imgWatermark;

  } catch (e) {
    console.error("Errore risorse, uso fallback.", e);
    doc.setFont("helvetica");
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  const brand = getBrandById(project.brandId);
  const holding = brand ? getHoldingById(brand.holdingId) : null;
  const periodLabel = getPeriodLabel(timePeriod, dateRange);
  const dateFormat = language === 'it' ? "dd MMMM yyyy, HH:mm" : "MMMM dd, yyyy, HH:mm";
  const generatedDate = format(new Date(), dateFormat, { locale: dateLocale });

  onProgress?.(t.progress.capturingCharts);

  const [energyChartImg, deviceChartImg, waterChartImg, airQualityChartImg] = await Promise.all([
    moduleConfig.energy.enabled && chartRefs?.energyChart ? captureChartAsImage(chartRefs.energyChart) : null,
    moduleConfig.energy.enabled && chartRefs?.deviceChart ? captureChartAsImage(chartRefs.deviceChart) : null,
    moduleConfig.water.enabled && chartRefs?.waterChart ? captureChartAsImage(chartRefs.waterChart) : null,
    moduleConfig.air.enabled && chartRefs?.airQualityChart ? captureChartAsImage(chartRefs.airQualityChart) : null,
  ]);

  let aiDiagnosis: string | null = null;
  if (includeAiDiagnosis) {
    onProgress?.(t.progress.generatingAiDiagnosis);
    const diagnosisResult = await generateAiDiagnosis(project, periodLabel, data, moduleConfig, language);
    if (diagnosisResult) {
      aiDiagnosis = diagnosisResult;
    }
  }

  // Helpers
  const addPage = () => {
    doc.addPage();
    yPos = margin;
  };

  const checkPageBreak = (height: number) => {
    if (yPos + height > pageHeight - margin) {
      addPage();
      return true;
    }
    return false;
  };

  const drawHeader = (text: string, level: 1 | 2 | 3 = 1) => {
    const sizes = { 1: 18, 2: 14, 3: 11 };
    const colors = { 1: COLORS.primary, 2: COLORS.text, 3: COLORS.secondary };
    
    checkPageBreak(15);
    doc.setFontSize(sizes[level]);
    doc.setTextColor(...colors[level]);
    doc.setFont("FuturaLT", level === 1 ? "bold" : level === 2 ? "bold" : "normal");
    doc.text(text, margin, yPos);
    yPos += level === 1 ? 12 : level === 2 ? 10 : 8;
  };

  const drawSeparator = () => {
    doc.setDrawColor(...COLORS.lightGray);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;
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

  const drawKpiCard = (x: number, y: number, width: number, title: string, value: string, unit?: string) => {
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(x, y, width, 25, 3, 3, "F");
    
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

  const getTableOptions = () => ({
    styles: {
      font: "FuturaLT",
      fontStyle: "normal",
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: { 
        font: "FuturaLT",
        fontStyle: "bold",
        fillColor: COLORS.primary, 
        fontSize: 9,
        halign: 'left' as const
    },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: margin, right: margin },
  });

  // ========== COVER PAGE ==========
  
  // 1. Sfondo Verde Intestazione
  const headerHeight = 110; 
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  // 2. Logo Intestazione (white.png) - CENTRATO CON ASPECT RATIO CORRETTO
  if (headerLogoData) {
    const originalDims = await getImageDimensions(headerLogoData);
    
    // Larghezza fissa desiderata: 60mm
    const targetWidth = 60; 
    
    // Calcoliamo l'altezza proporzionale: width * (h / w)
    const aspectRatio = originalDims.height / originalDims.width;
    const targetHeight = targetWidth * aspectRatio;

    // Calcolo posizione X per centrare
    const hLogoX = (pageWidth - targetWidth) / 2;
    const hLogoY = 15; // Margine dall'alto
    
    doc.addImage(headerLogoData, 'PNG', hLogoX, hLogoY, targetWidth, targetHeight);
  }

  // 3. Testi Cover - CENTRATI
  doc.setTextColor(255, 255, 255);
  const centerX = pageWidth / 2;
  
  // Titolo Report
  doc.setFontSize(26);
  doc.setFont("FuturaLT", "bold");
  doc.text(t.cover.title, centerX, 85, { align: 'center' });

  // Nome Progetto
  doc.setFontSize(16);
  doc.setFont("FuturaLT", "normal");
  doc.text(project.name, centerX, 95, { align: 'center' });

  // Periodo
  doc.setFontSize(11);
  doc.text(`${t.cover.period}: ${periodLabel}`, centerX, 102, { align: 'center' });

  // 4. Box Info Progetto
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

  // --- KPI CARDS DINAMICHE ---
  yPos = 190;
  drawHeader(t.cover.currentKpis, 2);
  yPos += 5;

  const activeKpis = [];
  if (moduleConfig.air.enabled || moduleConfig.energy.enabled) {
    activeKpis.push({ title: t.kpis.temperature, value: `${project.data.temp}`, unit: "°C" });
  }
  if (moduleConfig.air.enabled) {
     activeKpis.push({ title: t.kpis.co2, value: `${project.data.co2}`, unit: "ppm" });
     activeKpis.push({ title: t.kpis.airQuality, value: project.data.aq, unit: "" });
     activeKpis.push({ title: t.kpis.humidity, value: "45", unit: "%" });
  }
  
  if (activeKpis.length > 0) {
      const cardGap = 5;
      const cardWidth = (pageWidth - 2 * margin - (cardGap * (activeKpis.length - 1))) / activeKpis.length;
      activeKpis.forEach((kpi, index) => {
         drawKpiCard(margin + (cardWidth + cardGap) * index, yPos, cardWidth, kpi.title, kpi.value, kpi.unit);
      });
  }

  // ========== ENERGY SECTION ==========
  if (moduleConfig.energy.enabled) {
      addPage();
      drawHeader(t.sections.energyDashboard, 1);
      drawSeparator();

      if (energyChartImg) addChartImage(energyChartImg, t.energy.consumptionChart, 55);

      drawHeader(t.energy.consumption, 2);
      if (data.energy.consumption.length > 0) {
        // @ts-ignore
        autoTable(doc, {
          startY: yPos,
          head: [Object.keys(data.energy.consumption[0])],
          body: data.energy.consumption.map(row => Object.values(row)),
          ...getTableOptions(),
          headStyles: { ...getTableOptions().headStyles, fillColor: COLORS.primary },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      if (deviceChartImg) {
        checkPageBreak(70);
        addChartImage(deviceChartImg, t.energy.deviceChart, 55);
      }

      checkPageBreak(60);
      drawHeader(t.energy.deviceConsumption, 2);
      if (data.energy.devices.length > 0) {
        // @ts-ignore
        autoTable(doc, {
          startY: yPos,
          head: [Object.keys(data.energy.devices[0])],
          body: data.energy.devices.map(row => Object.values(row)),
          ...getTableOptions(),
          headStyles: { ...getTableOptions().headStyles, fillColor: COLORS.primary },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      checkPageBreak(60);
      drawHeader(t.energy.co2Emissions, 2);
      if (data.energy.co2.length > 0) {
        // @ts-ignore
        autoTable(doc, {
          startY: yPos,
          head: [Object.keys(data.energy.co2[0])],
          body: data.energy.co2.map(row => Object.values(row)),
          ...getTableOptions(),
          headStyles: { ...getTableOptions().headStyles, fillColor: COLORS.success },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
  }

  // ========== WATER SECTION ==========
  if (moduleConfig.water.enabled) {
      addPage();
      drawHeader(t.sections.waterDashboard, 1);
      drawSeparator();

      if (waterChartImg) addChartImage(waterChartImg, t.water.consumptionChart, 55);

      drawHeader(t.water.consumption, 2);
      if (data.water.consumption.length > 0) {
        // @ts-ignore
        autoTable(doc, {
          startY: yPos,
          head: [Object.keys(data.water.consumption[0])],
          body: data.water.consumption.map(row => Object.values(row)),
          ...getTableOptions(),
          headStyles: { ...getTableOptions().headStyles, fillColor: COLORS.accent },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      checkPageBreak(60);
      drawHeader(t.water.quality, 2);
      if (data.water.quality.length > 0) {
        // @ts-ignore
        autoTable(doc, {
          startY: yPos,
          head: [Object.keys(data.water.quality[0])],
          body: data.water.quality.map(row => Object.values(row)),
          ...getTableOptions(),
          headStyles: { ...getTableOptions().headStyles, fillColor: COLORS.accent },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      checkPageBreak(60);
      drawHeader(t.water.leakDetection, 2);
      if (data.water.leaks.length > 0) {
        // @ts-ignore
        autoTable(doc, {
          startY: yPos,
          head: [[t.tables.zone, t.tables.leakRate, t.tables.status, t.tables.detected]],
          body: data.water.leaks.map(row => [
            row.zone,
            row.leakRate,
            row.status === "ok" ? t.status.ok : row.status === "warning" ? t.status.warning : t.status.critical,
            row.detected || "-"
          ]),
          ...getTableOptions(),
          headStyles: { ...getTableOptions().headStyles, fillColor: COLORS.warning },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
  }

  // ========== AIR QUALITY SECTION ==========
  if (moduleConfig.air.enabled) {
      addPage();
      drawHeader(t.sections.airQualityDashboard, 1);
      drawSeparator();

      if (airQualityChartImg) addChartImage(airQualityChartImg, t.airQuality.chart, 55);

      drawHeader(t.airQuality.co2TvocHistory, 2);
      if (data.airQuality.co2History.length > 0) {
        // @ts-ignore
        autoTable(doc, {
          startY: yPos,
          head: [Object.keys(data.airQuality.co2History[0])],
          body: data.airQuality.co2History.map(row => Object.values(row)),
          ...getTableOptions(),
          headStyles: { ...getTableOptions().headStyles, fillColor: COLORS.success },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      checkPageBreak(60);
      drawHeader(t.airQuality.tempHumidity, 2);
      if (data.airQuality.tempHumidity.length > 0) {
        // @ts-ignore
        autoTable(doc, {
          startY: yPos,
          head: [Object.keys(data.airQuality.tempHumidity[0])],
          body: data.airQuality.tempHumidity.map(row => Object.values(row)),
          ...getTableOptions(),
          headStyles: { ...getTableOptions().headStyles, fillColor: COLORS.primary },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      checkPageBreak(60);
      drawHeader(t.airQuality.particulates, 2);
      if (data.airQuality.particulates.length > 0) {
        // @ts-ignore
        autoTable(doc, {
          startY: yPos,
          head: [Object.keys(data.airQuality.particulates[0])],
          body: data.airQuality.particulates.map(row => Object.values(row)),
          ...getTableOptions(),
          headStyles: { ...getTableOptions().headStyles, fillColor: COLORS.warning },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }
  }

  // ========== AI DIAGNOSIS SECTION ==========
  if (aiDiagnosis) {
    addPage();
    drawHeader(t.sections.aiDiagnosis, 1);
    drawSeparator();
    
    doc.setFillColor(59, 130, 246);
    const badgeWidth = language === 'it' ? 85 : 95;
    doc.roundedRect(margin, yPos, badgeWidth, 8, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(t.aiSection.badge, margin + 3, yPos + 5.5);
    yPos += 15;
    
    const diagnosisLines = aiDiagnosis.split('\n');
    doc.setTextColor(...COLORS.text);
    
    for (const line of diagnosisLines) {
      if (!line.trim()) {
        yPos += 3;
        continue;
      }
      checkPageBreak(12);
      
      if (line.startsWith('## ')) {
        yPos += 3;
        doc.setFontSize(12);
        doc.setFont("FuturaLT", "bold");
        doc.setTextColor(...COLORS.primary);
        doc.text(line.replace('## ', ''), margin, yPos);
        yPos += 7;
      } else if (line.startsWith('**') && line.endsWith('**')) {
        doc.setFontSize(10);
        doc.setFont("FuturaLT", "bold");
        doc.setTextColor(...COLORS.text);
        doc.text(line.replace(/\*\*/g, ''), margin, yPos);
        yPos += 6;
      } else if (line.startsWith('- ') || line.startsWith('• ')) {
        doc.setFontSize(9);
        doc.setFont("FuturaLT", "normal");
        doc.setTextColor(...COLORS.text);
        const bulletText = line.replace(/^[-•]\s*/, '');
        const splitText = doc.splitTextToSize(`• ${bulletText}`, pageWidth - 2 * margin - 5);
        doc.text(splitText, margin + 3, yPos);
        yPos += splitText.length * 5;
      } else if (line.match(/^\d+\.\s/)) {
        doc.setFontSize(9);
        doc.setFont("FuturaLT", "normal");
        doc.setTextColor(...COLORS.text);
        const splitText = doc.splitTextToSize(line, pageWidth - 2 * margin - 5);
        doc.text(splitText, margin + 3, yPos);
        yPos += splitText.length * 5;
      } else {
        doc.setFontSize(9);
        doc.setFont("FuturaLT", "normal");
        doc.setTextColor(...COLORS.text);
        const splitText = doc.splitTextToSize(line, pageWidth - 2 * margin);
        doc.text(splitText, margin, yPos);
        yPos += splitText.length * 5;
      }
    }
    
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

  // ========== POST-PROCESSING: WATERMARK & FOOTER ==========
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // --- WATERMARK ---
    if (watermarkData) {
      doc.saveGraphicsState();
      
      doc.setGState(new doc.GState({ opacity: 0.05 }));
      
      const wWidth = 60; 
      const wHeight = 60; 
      const x = (pageWidth - wWidth) / 2;
      const y = (pageHeight - wHeight) / 2;

      try {
          doc.addImage(watermarkData, 'PNG', x, y, wWidth, wHeight);
      } catch (e) {
          console.warn("Impossibile renderizzare favicon come immagine nel PDF", e);
      }
      
      doc.restoreGraphicsState();
    }

    // --- FOOTER ---
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.secondary);
    doc.setFont("FuturaLT", "normal");
    doc.text(
      `${t.footer.page} ${i} ${t.footer.of} ${totalPages} | ${project.name} | ${periodLabel}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  onProgress?.(t.progress.savingPdf);
  const filename = `Report_${project.name.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  doc.save(filename);
};

// ... (Resto del file invariato: generateAiDiagnosis)
async function generateAiDiagnosis(
  project: Project,
  periodLabel: string,
  data: ReportData,
  moduleConfig: ReportModuleConfig,
  language: ReportLanguage
): Promise<string | null> {
  try {
    let totalConsumption = 0;
    let deviceBreakdown = undefined;
    let waterConsumption = undefined;
    let waterLeaks = undefined;

    if (moduleConfig.energy.enabled) {
        totalConsumption = data.energy.consumption.reduce((sum, row) => {
        const val = row['Consumo (kWh)'] || row['Consumption (kWh)'] || row['consumption'] || row['value'] || 0;
        return sum + (typeof val === 'number' ? val : parseFloat(String(val)) || 0);
        }, 0) || project.data.total * 24;

        deviceBreakdown = data.energy.devices.map(row => ({
        name: String(row['Dispositivo'] || row['Device'] || row['device'] || row['name'] || 'Unknown'),
        consumption: typeof row['Consumo (kWh)'] === 'number' 
            ? row['Consumo (kWh)'] 
            : parseFloat(String(row['Consumo (kWh)'] || row['Consumption (kWh)'] || row['consumption'] || 0)) || 0,
        category: String(row['Categoria'] || row['Category'] || row['category'] || '')
        }));
    }

    const hvacConsumption = project.data.hvac * 24;
    const lightingConsumption = project.data.light * 24;
    
    const co2Total = moduleConfig.energy.enabled ? (data.energy.co2.reduce((sum, row) => {
      const val = row['CO₂ (kg)'] || row['co2'] || row['value'] || 0;
      return sum + (typeof val === 'number' ? val : parseFloat(String(val)) || 0);
    }, 0) || totalConsumption * 0.4) : 0;

    if (moduleConfig.water.enabled) {
        waterConsumption = data.water.consumption.reduce((sum, row) => {
        const val = row['Consumo (L)'] || row['Consumption (L)'] || row['consumption'] || row['value'] || 0;
        return sum + (typeof val === 'number' ? val : parseFloat(String(val)) || 0);
        }, 0);

        waterLeaks = data.water.leaks.filter(
        leak => leak['status'] === 'warning' || leak['status'] === 'critical'
        ).length;
    }

    const diagnosisInput: EnergyDiagnosisInput = {
      projectName: project.name,
      period: periodLabel,
      totalConsumption: totalConsumption,
      hvacConsumption,
      lightingConsumption,
      co2Emissions: co2Total,
      avgTemperature: project.data.temp,
      avgCo2: project.data.co2,
      avgHumidity: 45,
      airQualityIndex: project.data.aq,
      area_m2: project.area_m2,
      energy_price_kwh: project.energy_price_kwh,
      deviceBreakdown: deviceBreakdown && deviceBreakdown.length > 0 ? deviceBreakdown : undefined,
      waterConsumption: waterConsumption && waterConsumption > 0 ? waterConsumption : undefined,
      waterLeaks: waterLeaks && waterLeaks > 0 ? waterLeaks : undefined,
      language: language,
    };

    const result = await generateEnergyDiagnosis(diagnosisInput);
    
    if (result.error) {
      console.warn("AI diagnosis error:", result.error);
      return null;
    }

    return result.diagnosis;
  } catch (error) {
    console.error("Failed to generate AI diagnosis:", error);
    return null;
  }
}
