import { useState, useEffect } from 'react';
import { Award, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

interface CertificationsDialogProps {
  siteId: string;
  siteName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface WellFormData {
  certType: string;
  level: string;
  score: number;
  targetScore: number;
  expiryDate: string;
  milestones: {
    category: string;
    score: number;
    maxScore: number;
  }[];
}

const DEFAULT_MILESTONES = [
  { category: 'AIR PRECONDITIONS', score: 0, maxScore: 0 },
  { category: 'AIR OPTIMIZATIONS', score: 0, maxScore: 0 },
  { category: '12 POINTS', score: 0, maxScore: 0 },
];

export const CertificationsDialog = ({ siteId, siteName, open, onOpenChange }: CertificationsDialogProps) => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<WellFormData>({
    certType: 'WELL v2',
    level: 'Silver',
    score: 0,
    targetScore: 80,
    expiryDate: '',
    milestones: JSON.parse(JSON.stringify(DEFAULT_MILESTONES)),
  });

  // Load existing data
  useEffect(() => {
    if (!open || !supabase) return;
    
    const loadData = async () => {
      setIsLoading(true);
      try {
        const { data: certs } = await supabase
          .from('certifications')
          .select('*')
          .eq('site_id', siteId)
          .ilike('cert_type', '%WELL%')
          .limit(1);

        if (certs && certs.length > 0) {
          const cert = certs[0];
          const { data: milestones } = await supabase
            .from('certification_milestones')
            .select('*')
            .eq('certification_id', cert.id);

          const mappedMilestones = DEFAULT_MILESTONES.map(dm => {
            const existing = milestones?.find(m => m.category === dm.category);
            return existing 
              ? { category: existing.category, score: existing.score || 0, maxScore: existing.max_score || 0 }
              : { ...dm };
          });

          setFormData({
            certType: cert.cert_type || 'WELL v2',
            level: cert.level || 'Silver',
            score: cert.score || 0,
            targetScore: cert.target_score || 80,
            expiryDate: cert.expiry_date || '',
            milestones: mappedMilestones,
          });
        }
      } catch (err) {
        console.error('Error loading certification data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [open, siteId]);

  const handleSave = async () => {
    if (!supabase) return;
    setIsSaving(true);
    try {
      // Upsert certification
      const { data: existingCerts } = await supabase
        .from('certifications')
        .select('id')
        .eq('site_id', siteId)
        .ilike('cert_type', '%WELL%')
        .limit(1);

      let certId: string;

      if (existingCerts && existingCerts.length > 0) {
        certId = existingCerts[0].id;
        await supabase
          .from('certifications')
          .update({
            cert_type: formData.certType,
            level: formData.level,
            score: formData.score,
            target_score: formData.targetScore,
            expiry_date: formData.expiryDate || null,
            status: 'active',
          })
          .eq('id', certId);
      } else {
        const { data: newCert } = await supabase
          .from('certifications')
          .insert({
            site_id: siteId,
            cert_type: formData.certType,
            level: formData.level,
            score: formData.score,
            target_score: formData.targetScore,
            expiry_date: formData.expiryDate || null,
            status: 'active',
          })
          .select('id')
          .single();
        
        if (!newCert) throw new Error('Failed to create certification');
        certId = newCert.id;
      }

      // Delete existing milestones and re-insert
      await supabase
        .from('certification_milestones')
        .delete()
        .eq('certification_id', certId);

      const milestonesToInsert = formData.milestones.map(m => ({
        certification_id: certId,
        category: m.category,
        requirement: m.category,
        score: m.score,
        max_score: m.maxScore,
        status: m.score >= m.maxScore && m.maxScore > 0 ? 'achieved' : 'in_progress',
      }));

      await supabase
        .from('certification_milestones')
        .insert(milestonesToInsert);

      queryClient.invalidateQueries({ queryKey: ['certifications'] });
      queryClient.invalidateQueries({ queryKey: ['certification_milestones'] });
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving certification:', err);
      alert('Errore durante il salvataggio della certificazione');
    } finally {
      setIsSaving(false);
    }
  };

  const updateMilestone = (index: number, field: 'score' | 'maxScore', value: number) => {
    setFormData(prev => {
      const milestones = [...prev.milestones];
      milestones[index] = { ...milestones[index], [field]: value };
      return { ...prev, milestones };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-rose-500" />
            Certificazione WELL - {siteName}
          </DialogTitle>
          <DialogDescription>
            Gestisci i dati della certificazione WELL per questo site
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 space-y-6 my-4">
            {/* General Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-700 border-b pb-2">Informazioni Generali</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Versione</Label>
                  <Select value={formData.certType} onValueChange={v => setFormData(p => ({ ...p, certType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WELL v1">WELL v1</SelectItem>
                      <SelectItem value="WELL v2">WELL v2</SelectItem>
                      <SelectItem value="WELL v2-Pilot">WELL v2-Pilot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Livello Target</Label>
                  <Select value={formData.level} onValueChange={v => setFormData(p => ({ ...p, level: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bronze">Bronze</SelectItem>
                      <SelectItem value="Silver">Silver</SelectItem>
                      <SelectItem value="Gold">Gold</SelectItem>
                      <SelectItem value="Platinum">Platinum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Punteggio Attuale</Label>
                  <Input
                    type="number"
                    value={formData.score}
                    onChange={e => setFormData(p => ({ ...p, score: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Target Points</Label>
                  <Input
                    type="number"
                    value={formData.targetScore}
                    onChange={e => setFormData(p => ({ ...p, targetScore: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Data di Scadenza</Label>
                <Input
                  type="date"
                  value={formData.expiryDate}
                  onChange={e => setFormData(p => ({ ...p, expiryDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Milestones */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-700 border-b pb-2">Moduli / Milestones</h4>
              
              {formData.milestones.map((m, i) => (
                <div key={m.category} className="p-3 bg-slate-50 rounded-lg space-y-2">
                  <span className="text-xs font-bold text-slate-600">{m.category}</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Punti</Label>
                      <Input
                        type="number"
                        value={m.score}
                        onChange={e => updateMilestone(i, 'score', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Max Punti</Label>
                      <Input
                        type="number"
                        value={m.maxScore}
                        onChange={e => updateMilestone(i, 'maxScore', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Annulla
          </Button>
          <Button onClick={handleSave} className="bg-fgb-secondary hover:bg-fgb-secondary/90" disabled={isSaving || isLoading}>
            {isSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvataggio...</>
            ) : 'Salva'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
