import { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  FileText, Trash2, RefreshCw, Loader2, Eye, Upload, FileUp,
  CheckCircle2, ArrowLeft, Zap, Calendar, DollarSign, Gauge, Activity,
  TrendingUp, TrendingDown, BarChart3, Building2, Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip_REMOVE,
} from 'recharts';
import { ZoomableChart } from '@/components/ui/ZoomableChart';

// Types matching DB schema
interface Bill {
  id: string;
  site_id: string;
  uploaded_by: string | null;
  company_name: string;
  file_name: string;
  file_path: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface BillData {
  id: string;
  bill_id: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
  energy_consumption_kwh: number | null;
  energy_cost_per_kwh: number | null;
  total_energy_cost: number | null;
  peak_power_kw: number | null;
  off_peak_consumption_kwh: number | null;
  peak_consumption_kwh: number | null;
  reactive_energy_kvarh: number | null;
  power_factor: number | null;
  fixed_charges: number | null;
  taxes: number | null;
  total_amount: number | null;
  currency: string | null;
  additional_data: Record<string, unknown> | null;
  created_at: string;
}

const i18n = {
  en: {
    title: 'Bill Analysis',
    subtitle: 'Upload and analyze energy bills with AI',
    upload: 'Upload Bill',
    uploadDesc: 'Upload your energy bill PDF for AI-powered analysis',
    company: 'Company Name',
    companyPh: 'e.g. Enel Energia',
    dropzone: 'Drop your PDF here or click to browse',
    dropzoneHint: 'PDF files only, max 10MB',
    uploading: 'Uploading & Analyzing...',
    uploadAnother: 'Upload Another',
    uploadAnalyze: 'Upload & Analyze',
    myBills: 'Uploaded Bills',
    noBills: 'No bills uploaded yet',
    fileName: 'File Name',
    companyCol: 'Company',
    status: 'Status',
    uploaded: 'Uploaded',
    actions: 'Actions',
    refresh: 'Refresh',
    billDetail: 'Bill Detail',
    noData: 'No extracted data available',
    analyzing: 'Analysis is still in progress...',
    analysisFailed: 'Analysis failed. Try re-analyzing.',
    backToList: 'Back to list',
    overview: 'Overview',
    totalBills: 'Total Bills',
    totalConsumption: 'Total Consumption',
    avgCost: 'Avg Cost/kWh',
    totalSpent: 'Total Spent',
    monthlyConsumption: 'Monthly Consumption',
    period: 'Billing Period',
    consumption: 'Energy Consumption',
    power: 'Power & Performance',
    costs: 'Costs & Charges',
    additionalData: 'Additional Data',
    peakPower: 'Peak Power',
    months: 'Months',
    analyzed: 'Analyzed',
  },
  it: {
    title: 'Analisi Bollette',
    subtitle: 'Carica e analizza bollette energetiche con AI',
    upload: 'Carica Bolletta',
    uploadDesc: 'Carica la tua bolletta energetica in PDF per l\'analisi AI',
    company: 'Nome Azienda',
    companyPh: 'es. Enel Energia',
    dropzone: 'Trascina il PDF qui o clicca per sfogliare',
    dropzoneHint: 'Solo file PDF, max 10MB',
    uploading: 'Caricamento & Analisi...',
    uploadAnother: 'Carica Un\'Altra',
    uploadAnalyze: 'Carica & Analizza',
    myBills: 'Bollette Caricate',
    noBills: 'Nessuna bolletta caricata',
    fileName: 'Nome File',
    companyCol: 'Azienda',
    status: 'Stato',
    uploaded: 'Caricata',
    actions: 'Azioni',
    refresh: 'Aggiorna',
    billDetail: 'Dettaglio Bolletta',
    noData: 'Nessun dato estratto disponibile',
    analyzing: 'Analisi ancora in corso...',
    analysisFailed: 'Analisi fallita. Prova a rieseguire.',
    backToList: 'Torna alla lista',
    overview: 'Panoramica',
    totalBills: 'Totale Bollette',
    totalConsumption: 'Consumo Totale',
    avgCost: 'Costo Medio/kWh',
    totalSpent: 'Totale Speso',
    monthlyConsumption: 'Consumo Mensile',
    period: 'Periodo di Fatturazione',
    consumption: 'Consumo Energetico',
    power: 'Potenza & Performance',
    costs: 'Costi & Oneri',
    additionalData: 'Dati Aggiuntivi',
    peakPower: 'Potenza di Picco',
    months: 'Mesi',
    analyzed: 'Analizzate',
  },
};

const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    border: 'none',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    padding: '12px 16px',
  },
};

type View = 'dashboard' | 'upload' | 'list' | 'detail';

interface BillAnalysisModuleProps {
  siteId: string | undefined;
  siteName?: string;
}

export const BillAnalysisModule = ({ siteId, siteName }: BillAnalysisModuleProps) => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = i18n[language] || i18n.en;

  const [view, setView] = useState<View>('dashboard');
  const [bills, setBills] = useState<Bill[]>([]);
  const [billDataMap, setBillDataMap] = useState<Record<string, BillData>>({});
  const [loading, setLoading] = useState(true);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);

  // Upload state
  const [companyName, setCompanyName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBills = async () => {
    if (!siteId || !isSupabaseConfigured || !supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load bills');
    } else {
      const billsList = (data || []) as unknown as Bill[];
      setBills(billsList);

      // Fetch bill_data for completed bills
      const completedIds = billsList.filter(b => b.status === 'completed').map(b => b.id);
      if (completedIds.length > 0) {
        const { data: bdData } = await supabase
          .from('bill_data')
          .select('*')
          .in('bill_id', completedIds);
        
        const map: Record<string, BillData> = {};
        (bdData || []).forEach((bd: any) => { map[bd.bill_id] = bd as BillData; });
        setBillDataMap(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBills();
  }, [siteId]);

  // Dashboard KPIs
  const kpis = useMemo(() => {
    const completed = Object.values(billDataMap);
    const totalConsumption = completed.reduce((s, d) => s + (d.energy_consumption_kwh || 0), 0);
    const totalSpent = completed.reduce((s, d) => s + (d.total_amount || 0), 0);
    const costs = completed.map(d => d.energy_cost_per_kwh).filter((c): c is number => c !== null);
    const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
    const maxPeak = Math.max(...completed.map(d => d.peak_power_kw || 0), 0);

    // Monthly chart data
    const monthMap = new Map<string, { month: string; consumption: number; cost: number }>();
    completed.forEach(d => {
      const date = d.billing_period_start || d.billing_period_end;
      if (!date) return;
      const key = date.substring(0, 7);
      const label = new Date(date).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { year: '2-digit', month: 'short' });
      const existing = monthMap.get(key) || { month: label, consumption: 0, cost: 0 };
      existing.consumption += d.energy_consumption_kwh || 0;
      existing.cost += d.total_amount || 0;
      monthMap.set(key, existing);
    });
    const monthlyData = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

    return { totalConsumption, totalSpent, avgCost, maxPeak, monthlyData, completedCount: completed.length };
  }, [billDataMap, language]);

  // Upload handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setUploadSuccess(false);
    } else {
      toast.error('Please select a PDF file');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped);
      setUploadSuccess(false);
    } else {
      toast.error('Please drop a PDF file');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user || !siteId || !supabase) return;

    if (!companyName.trim()) {
      toast.error('Please fill in company name');
      return;
    }

    setUploading(true);
    try {
      const filePath = `${siteId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('bills').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: bill, error: insertError } = await supabase
        .from('bills')
        .insert({
          site_id: siteId,
          uploaded_by: user.id,
          company_name: companyName.trim(),
          file_name: file.name,
          file_path: filePath,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Trigger AI analysis
      const { error: fnError } = await supabase.functions.invoke('analyze-bill', {
        body: { billId: bill.id, filePath },
      });

      if (fnError) {
        console.error('AI analysis failed:', fnError);
        toast.warning('Bill uploaded. AI analysis will be retried.');
      }

      setUploadSuccess(true);
      setCompanyName('');
      setFile(null);
      toast.success('Bill uploaded and analysis started!');
      fetchBills();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload bill');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (bill: Bill) => {
    if (!supabase) return;
    setDeletingId(bill.id);
    try {
      await supabase.storage.from('bills').remove([bill.file_path]);
      const { error } = await supabase.from('bills').delete().eq('id', bill.id);
      if (error) throw error;
      setBills(prev => prev.filter(b => b.id !== bill.id));
      toast.success('Bill deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete bill');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetry = async (bill: Bill) => {
    if (!supabase) return;
    try {
      await supabase.from('bills').update({ status: 'pending' }).eq('id', bill.id);
      const { error } = await supabase.functions.invoke('analyze-bill', {
        body: { billId: bill.id, filePath: bill.file_path },
      });
      if (error) throw error;
      toast.success('Re-analysis started');
      fetchBills();
    } catch {
      toast.error('Failed to retry analysis');
    }
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    analyzing: { label: 'Analyzing', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    error: { label: 'Error', className: 'bg-red-100 text-red-800 border-red-200' },
  };

  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  const formatNumber = (v: number | null | undefined, decimals = 2) =>
    v != null ? v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—';

  const selectedBill = selectedBillId ? bills.find(b => b.id === selectedBillId) : null;
  const selectedBillData = selectedBillId ? billDataMap[selectedBillId] : null;

  // ── DETAIL VIEW ──
  if (view === 'detail' && selectedBill) {
    const sc = statusConfig[selectedBill.status] || statusConfig.pending;
    const bd = selectedBillData;

    const sections = [
      {
        title: t.period,
        fields: [
          { label: 'Period Start', value: formatDate(bd?.billing_period_start), icon: <Calendar className="h-4 w-4" /> },
          { label: 'Period End', value: formatDate(bd?.billing_period_end), icon: <Calendar className="h-4 w-4" /> },
          { label: 'Currency', value: bd?.currency || '—', icon: <DollarSign className="h-4 w-4" /> },
        ],
      },
      {
        title: t.consumption,
        fields: [
          { label: 'Total Consumption', value: formatNumber(bd?.energy_consumption_kwh), unit: 'kWh', icon: <Zap className="h-4 w-4" /> },
          { label: 'Peak Consumption', value: formatNumber(bd?.peak_consumption_kwh), unit: 'kWh', icon: <Activity className="h-4 w-4" /> },
          { label: 'Off-Peak Consumption', value: formatNumber(bd?.off_peak_consumption_kwh), unit: 'kWh', icon: <Activity className="h-4 w-4" /> },
          { label: 'Reactive Energy', value: formatNumber(bd?.reactive_energy_kvarh), unit: 'kVArh', icon: <Gauge className="h-4 w-4" /> },
        ],
      },
      {
        title: t.power,
        fields: [
          { label: 'Peak Power', value: formatNumber(bd?.peak_power_kw), unit: 'kW', icon: <Gauge className="h-4 w-4" /> },
          { label: 'Power Factor', value: formatNumber(bd?.power_factor, 3), icon: <Activity className="h-4 w-4" /> },
        ],
      },
      {
        title: t.costs,
        fields: [
          { label: 'Cost per kWh', value: formatNumber(bd?.energy_cost_per_kwh, 4), unit: `${bd?.currency || '€'}/kWh`, icon: <DollarSign className="h-4 w-4" /> },
          { label: 'Total Energy Cost', value: formatNumber(bd?.total_energy_cost), unit: bd?.currency || '€', icon: <DollarSign className="h-4 w-4" /> },
          { label: 'Fixed Charges', value: formatNumber(bd?.fixed_charges), unit: bd?.currency || '€', icon: <DollarSign className="h-4 w-4" /> },
          { label: 'Taxes', value: formatNumber(bd?.taxes), unit: bd?.currency || '€', icon: <DollarSign className="h-4 w-4" /> },
          { label: 'Total Amount', value: formatNumber(bd?.total_amount), unit: bd?.currency || '€', icon: <DollarSign className="h-4 w-4" /> },
        ],
      },
    ];

    const additionalEntries = bd?.additional_data
      ? Object.entries(bd.additional_data).filter(([, v]) => v != null && v !== '')
      : [];

    return (
      <div className="space-y-6 pb-8">
        {/* Back + Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setView('list'); setSelectedBillId(null); }} className="mt-1 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-800">{selectedBill.file_name}</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${sc.className}`}>
                {sc.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {selectedBill.company_name} — {formatDate(selectedBill.created_at)}
            </p>
          </div>
        </div>

        {!bd ? (
          <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FileText className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">{t.noData}</p>
              <p className="text-sm">
                {selectedBill.status === 'pending' || selectedBill.status === 'analyzing' ? t.analyzing : t.analysisFailed}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sections.map((section) => (
              <Card key={section.title} className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-gray-800">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {section.fields.map((field) => (
                      <div key={field.label} className="flex items-start gap-3 rounded-xl bg-gray-50/80 p-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                          {field.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">{field.label}</p>
                          <p className="text-base font-semibold text-gray-800 truncate">
                            {field.value}
                            {'unit' in field && (field as any).unit && field.value !== '—' && (
                              <span className="ml-1 text-xs font-normal text-gray-400">{(field as any).unit}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {additionalEntries.length > 0 && (
              <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-gray-800">{t.additionalData}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {additionalEntries.map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center rounded-lg bg-gray-50/80 p-3">
                        <span className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="font-medium text-sm text-gray-800">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── UPLOAD VIEW ──
  if (view === 'upload') {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView('dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{t.upload}</h2>
            <p className="text-sm text-gray-500">{t.uploadDesc}</p>
          </div>
        </div>

        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleUpload} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="company">{t.company}</Label>
                <Input
                  id="company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t.companyPh}
                  required
                  maxLength={100}
                  className="bg-white"
                />
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all duration-200 cursor-pointer ${
                  dragOver
                    ? 'border-teal-500 bg-teal-50/50'
                    : file
                    ? 'border-teal-400/50 bg-teal-50/30'
                    : 'border-gray-300 hover:border-teal-400/40 hover:bg-gray-50/50'
                }`}
                onClick={() => document.getElementById('bill-file-input')?.click()}
              >
                <input
                  id="bill-file-input"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileUp className="h-10 w-10 text-teal-600" />
                    <p className="font-medium text-gray-800">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-gray-400" />
                    <p className="font-medium text-gray-700">{t.dropzone}</p>
                    <p className="text-sm text-gray-400">{t.dropzoneHint}</p>
                  </div>
                )}
              </div>

              <Button type="submit" disabled={uploading || !file} className="w-full bg-teal-600 hover:bg-teal-700">
                {uploading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t.uploading}</>
                ) : uploadSuccess ? (
                  <><CheckCircle2 className="mr-2 h-4 w-4" />{t.uploadAnother}</>
                ) : (
                  <><Upload className="mr-2 h-4 w-4" />{t.uploadAnalyze}</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── LIST VIEW ──
  if (view === 'list') {
    return (
      <div className="space-y-6 pb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setView('dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{t.myBills} ({bills.length})</h2>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchBills} disabled={loading} className="bg-white/50">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t.refresh}
          </Button>
        </div>

        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              </div>
            ) : bills.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">{t.noBills}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.fileName}</TableHead>
                      <TableHead>{t.companyCol}</TableHead>
                      <TableHead>{t.status}</TableHead>
                      <TableHead>{t.uploaded}</TableHead>
                      <TableHead className="text-right">{t.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => {
                      const sc = statusConfig[bill.status] || statusConfig.pending;
                      return (
                        <TableRow key={bill.id}>
                          <TableCell
                            className="font-medium cursor-pointer hover:text-teal-600 transition-colors"
                            onClick={() => { setSelectedBillId(bill.id); setView('detail'); }}
                          >
                            {bill.file_name}
                          </TableCell>
                          <TableCell>{bill.company_name}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${sc.className}`}>
                              {sc.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-500">
                            {new Date(bill.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedBillId(bill.id); setView('detail'); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {bill.status === 'error' && (
                                <Button variant="ghost" size="sm" onClick={() => handleRetry(bill)}>
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(bill)} disabled={deletingId === bill.id} className="text-red-500 hover:text-red-600">
                                {deletingId === bill.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── DASHBOARD VIEW (default) ──
  const kpiCards = [
    { title: t.totalBills, value: bills.length.toString(), icon: FileText },
    { title: t.totalConsumption, value: `${kpis.totalConsumption.toLocaleString()} kWh`, icon: Zap },
    { title: t.avgCost, value: `€${kpis.avgCost.toFixed(4)}`, icon: TrendingUp },
    { title: t.totalSpent, value: `€${kpis.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{t.title}</h2>
          <p className="text-sm text-gray-500">{t.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView('list')} className="bg-white/50">
            <FileText className="mr-2 h-4 w-4" />
            {t.myBills}
          </Button>
          <Button size="sm" onClick={() => setView('upload')} className="bg-teal-600 hover:bg-teal-700">
            <Upload className="mr-2 h-4 w-4" />
            {t.upload}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.title} className="bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{card.title}</CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50">
                <card.icon className="h-4.5 w-4.5 text-teal-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-800">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart + Quick Stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Monthly Consumption Chart */}
        <Card className="lg:col-span-2 bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-800">{t.monthlyConsumption}</CardTitle>
            <CardDescription>kWh</CardDescription>
          </CardHeader>
          <CardContent>
            {kpis.monthlyData.length > 0 ? (
              <ZoomableChart width="100%" height={240}>
                <BarChart data={kpis.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="consumption" fill="hsl(175, 60%, 35%)" radius={[4, 4, 0, 0]} name="kWh" />
                </BarChart>
              </ZoomableChart>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-gray-400 text-sm">
                <BarChart3 className="h-8 w-8 mr-2 opacity-40" /> No data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-800">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50/80 p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider">{t.peakPower}</p>
                <p className="text-lg font-bold text-gray-800 mt-1">{kpis.maxPeak.toLocaleString()} kW</p>
              </div>
              <div className="rounded-xl bg-gray-50/80 p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider">{t.analyzed}</p>
                <p className="text-lg font-bold text-gray-800 mt-1">{kpis.completedCount}</p>
              </div>
              <div className="rounded-xl bg-gray-50/80 p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider">{t.months}</p>
                <p className="text-lg font-bold text-gray-800 mt-1">{kpis.monthlyData.length}</p>
              </div>
              <div className="rounded-xl bg-gray-50/80 p-4 text-center">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Pending</p>
                <p className="text-lg font-bold text-gray-800 mt-1">{bills.filter(b => b.status !== 'completed').length}</p>
              </div>
            </div>

            {/* Recent Bills */}
            {bills.slice(0, 3).map(bill => {
              const sc = statusConfig[bill.status] || statusConfig.pending;
              return (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50/80 transition-colors cursor-pointer"
                  onClick={() => { setSelectedBillId(bill.id); setView('detail'); }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 shrink-0">
                      <FileText className="h-4 w-4 text-teal-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate text-gray-800">{bill.file_name}</p>
                      <p className="text-xs text-gray-400">{bill.company_name}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${sc.className}`}>
                    {sc.label}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
