import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Project, getBrandById, getHoldingById } from "@/lib/data";
import { TimePeriod } from "./TimePeriodSelector";
import { DateRange, getPeriodLabel } from "@/hooks/useTimeFilteredData";

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
  chartRefs?: ChartRefs;
}

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

export const generatePdfReport = async ({ project, timePeriod, dateRange, data, chartRefs }: GeneratePdfOptions) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  const brand = getBrandById(project.brandId);
  const holding = brand ? getHoldingById(brand.holdingId) : null;
  const periodLabel = getPeriodLabel(timePeriod, dateRange);
  const generatedDate = format(new Date(), "dd MMMM yyyy, HH:mm", { locale: it });

  // Capture chart images in parallel
  const [energyChartImg, deviceChartImg, waterChartImg, airQualityChartImg] = await Promise.all([
    chartRefs?.energyChart ? captureChartAsImage(chartRefs.energyChart) : null,
    chartRefs?.deviceChart ? captureChartAsImage(chartRefs.deviceChart) : null,
    chartRefs?.waterChart ? captureChartAsImage(chartRefs.waterChart) : null,
    chartRefs?.airQualityChart ? captureChartAsImage(chartRefs.airQualityChart) : null,
  ]);

  // Helper functions
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
    doc.setFont("helvetica", level === 1 ? "bold" : level === 2 ? "bold" : "normal");
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
    doc.text(key + ":", margin, yPos);
    doc.setTextColor(...COLORS.text);
    doc.setFont("helvetica", "bold");
    doc.text(value, margin + 45, yPos);
    doc.setFont("helvetica", "normal");
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
    doc.setFont("helvetica", "bold");
    doc.text(value + (unit ? ` ${unit}` : ""), x + 5, y + 18);
    doc.setFont("helvetica", "normal");
  };

  const addChartImage = (imageData: string, title: string, height: number = 60) => {
    checkPageBreak(height + 15);
    drawHeader(title, 3);
    
    const imgWidth = pageWidth - 2 * margin;
    doc.addImage(imageData, 'PNG', margin, yPos, imgWidth, height);
    yPos += height + 10;
  };

  // ========== COVER PAGE ==========
  doc.setFillColor(...COLORS.primary);
  doc.rect(0, 0, pageWidth, 80, "F");

  doc.setFontSize(28);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Report Dashboard", margin, 35);

  doc.setFontSize(16);
  doc.setFont("helvetica", "normal");
  doc.text(project.name, margin, 50);

  doc.setFontSize(11);
  doc.text(`Periodo: ${periodLabel}`, margin, 62);

  yPos = 95;
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 50, 3, 3, "F");

  yPos += 10;
  drawKeyValue("Indirizzo", project.address);
  if (brand) drawKeyValue("Brand", brand.name);
  if (holding) drawKeyValue("Holding", holding.name);
  drawKeyValue("Regione", project.region.toUpperCase());
  drawKeyValue("Generato il", generatedDate);

  yPos = 160;
  drawHeader("KPI Attuali", 2);
  yPos += 5;

  const cardWidth = (pageWidth - 2 * margin - 15) / 4;
  drawKpiCard(margin, yPos, cardWidth, "Temperatura", `${project.data.temp}`, "°C");
  drawKpiCard(margin + cardWidth + 5, yPos, cardWidth, "CO₂", `${project.data.co2}`, "ppm");
  drawKpiCard(margin + (cardWidth + 5) * 2, yPos, cardWidth, "Umidità", "45", "%");
  drawKpiCard(margin + (cardWidth + 5) * 3, yPos, cardWidth, "Qualità Aria", project.data.aq, "");

  // ========== ENERGY SECTION ==========
  addPage();
  drawHeader("📊 Dashboard Energia", 1);
  drawSeparator();

  // Add energy chart snapshot if available
  if (energyChartImg) {
    addChartImage(energyChartImg, "Grafico Consumi Energetici", 55);
  }

  drawHeader("Consumi Energetici", 2);
  if (data.energy.consumption.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [Object.keys(data.energy.consumption[0])],
      body: data.energy.consumption.map(row => Object.values(row)),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: COLORS.primary, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.lightGray },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Add device chart snapshot if available
  if (deviceChartImg) {
    checkPageBreak(70);
    addChartImage(deviceChartImg, "Grafico Consumi per Dispositivo", 55);
  }

  checkPageBreak(60);
  drawHeader("Consumi per Dispositivo", 2);
  if (data.energy.devices.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [Object.keys(data.energy.devices[0])],
      body: data.energy.devices.map(row => Object.values(row)),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: COLORS.primary, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.lightGray },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  checkPageBreak(60);
  drawHeader("Emissioni CO₂", 2);
  if (data.energy.co2.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [Object.keys(data.energy.co2[0])],
      body: data.energy.co2.map(row => Object.values(row)),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: COLORS.success, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.lightGray },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // ========== WATER SECTION ==========
  addPage();
  drawHeader("💧 Dashboard Acqua", 1);
  drawSeparator();

  // Add water chart snapshot if available
  if (waterChartImg) {
    addChartImage(waterChartImg, "Grafico Consumi Idrici", 55);
  }

  drawHeader("Consumi Idrici", 2);
  if (data.water.consumption.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [Object.keys(data.water.consumption[0])],
      body: data.water.consumption.map(row => Object.values(row)),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: COLORS.accent, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.lightGray },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  checkPageBreak(60);
  drawHeader("Qualità Acqua", 2);
  if (data.water.quality.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [Object.keys(data.water.quality[0])],
      body: data.water.quality.map(row => Object.values(row)),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: COLORS.accent, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.lightGray },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  checkPageBreak(60);
  drawHeader("Rilevamento Perdite", 2);
  if (data.water.leaks.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [["Zona", "Tasso Perdita (L/h)", "Stato", "Rilevato"]],
      body: data.water.leaks.map(row => [
        row.zone,
        row.leakRate,
        row.status === "ok" ? "✓ OK" : row.status === "warning" ? "⚠ Attenzione" : "⚠ Critico",
        row.detected || "-"
      ]),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: COLORS.warning, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.lightGray },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // ========== AIR QUALITY SECTION ==========
  addPage();
  drawHeader("🌬️ Dashboard Qualità Aria", 1);
  drawSeparator();

  // Add air quality chart snapshot if available
  if (airQualityChartImg) {
    addChartImage(airQualityChartImg, "Grafico Qualità Aria", 55);
  }

  drawHeader("Storico CO₂ e TVOC", 2);
  if (data.airQuality.co2History.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [Object.keys(data.airQuality.co2History[0])],
      body: data.airQuality.co2History.map(row => Object.values(row)),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: COLORS.success, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.lightGray },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  checkPageBreak(60);
  drawHeader("Temperatura e Umidità", 2);
  if (data.airQuality.tempHumidity.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [Object.keys(data.airQuality.tempHumidity[0])],
      body: data.airQuality.tempHumidity.map(row => Object.values(row)),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: COLORS.primary, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.lightGray },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  checkPageBreak(60);
  drawHeader("Particolato (PM2.5 / PM10)", 2);
  if (data.airQuality.particulates.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [Object.keys(data.airQuality.particulates[0])],
      body: data.airQuality.particulates.map(row => Object.values(row)),
      margin: { left: margin, right: margin },
      headStyles: { fillColor: COLORS.warning, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: COLORS.lightGray },
    });
    yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // ========== FOOTER ON ALL PAGES ==========
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.secondary);
    doc.text(
      `Pagina ${i} di ${totalPages} | ${project.name} | ${periodLabel}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }

  // Save the PDF
  const filename = `Report_${project.name.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  doc.save(filename);
};
