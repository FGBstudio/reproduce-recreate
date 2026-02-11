import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, MapPin, Tag, Globe, ImageIcon, X, Loader2, Award } from 'lucide-react';
import { CertificationsDialog } from './CertificationsDialog';
import { useAdminData } from '@/contexts/AdminDataContext';
import { AdminSite, RegionCode } from '@/lib/types/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
// RIMOSSO: ScrollArea per evitare conflitti di layout
import { supabase } from '@/lib/supabase';

const regions: { value: RegionCode; label: string }[] = [
  { value: 'EU', label: 'Europe' },
  { value: 'AMER', label: 'Americas' },
  { value: 'APAC', label: 'Asia Pacific' },
  { value: 'MEA', label: 'Middle East & Africa' },
];

const defaultFormData = {
  brandId: '',
  name: '',
  address: '',
  city: '',
  country: '',
  region: 'EU' as RegionCode,
  lat: 0,
  lng: 0,
  areaSqm: 0,
  imageUrl: '',
  timezone: 'UTC',
};

export const SitesManager = () => {
  const { brands, sites, addSite, updateSite, deleteSite, getProjectsBySite } = useAdminData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<AdminSite | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  
  // Stati per la gestione dell'upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [certDialogSite, setCertDialogSite] = useState<{ id: string; name: string } | null>(null);

  const handleOpenCreate = () => {
    setEditingSite(null);
    setFormData({ ...defaultFormData, brandId: brands[0]?.id || '' });
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (site: AdminSite) => {
    setEditingSite(site);
    setFormData({
      brandId: site.brandId,
      name: site.name,
      address: site.address,
      city: site.city,
      country: site.country,
      region: site.region,
      lat: site.lat,
      lng: site.lng,
      areaSqm: site.areaSqm,
      imageUrl: site.imageUrl || '',
      timezone: site.timezone,
    });
    setSelectedFile(null);
    setPreviewUrl(site.imageUrl || null);
    setIsDialogOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const uploadImageToSupabase = async (file: File, siteIdOrTempId: string | number): Promise<string> => {
    // Genera un nome file sicuro
    const fileExt = file.name.split('.').pop();
    const fileName = `cover.${fileExt}`;
    // Usa un timestamp per evitare collisioni se non abbiamo ancora l'ID
    const pathId = editingSite ? siteIdOrTempId : `new/${Date.now()}`; 
    const filePath = `sites/${pathId}/${fileName}`;

    console.log("Tentativo upload su:", filePath);

    // Upload
    const { error: uploadError } = await supabase.storage
      .from('project-assets')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Errore Upload Supabase:", uploadError);
      throw new Error(`Errore caricamento immagine: ${uploadError.message}`);
    }

    // Get URL
    const { data: { publicUrl } } = supabase.storage
      .from('project-assets')
      .getPublicUrl(filePath);

    // Aggiungi timestamp per evitare la cache del browser
    return `${publicUrl}?t=${Date.now()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setIsUploading(!!selectedFile);

    try {
      let finalImageUrl = formData.imageUrl;

      if (selectedFile) {
        // Se c'è un file, caricalo prima
        finalImageUrl = await uploadImageToSupabase(selectedFile, editingSite ? editingSite.id : 'temp');
      }

      const dataToSave = {
        ...formData,
        imageUrl: finalImageUrl
      };

      if (editingSite) {
        await updateSite(editingSite.id, dataToSave);
      } else {
        await addSite(dataToSave);
      }
      
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error("Errore critico:", error);
      // Feedback VISIVO per l'utente in caso di errore
      alert(`Errore durante il salvataggio: ${error.message || error}`);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const getBrandName = (brandId: string) => brands.find(b => b.id === brandId)?.name || 'N/A';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Sites / Stores
            </CardTitle>
            <CardDescription>
              Gestisci le location fisiche (negozi, uffici, magazzini)
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="bg-fgb-secondary hover:bg-fgb-secondary/90">
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Site
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
              <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                <DialogHeader>
                  <DialogTitle>{editingSite ? 'Modifica Site' : 'Nuovo Site'}</DialogTitle>
                  <DialogDescription>
                    {editingSite ? 'Modifica i dati del site' : 'Inserisci i dati del nuovo site'}
                  </DialogDescription>
                </DialogHeader>
                
                {/* --- FIX SCORRIMENTO: Usa div con overflow-y-auto invece di ScrollArea --- */}
                <div className="flex-1 overflow-y-auto pr-2 my-4">
                  <div className="grid gap-4 py-2">
                    
                    {/* SEZIONE IMMAGINE */}
                    <div className="flex flex-col gap-2 p-4 border rounded-lg bg-slate-50/50">
                      <Label>Immagine di Copertina</Label>
                      <div className="flex items-start gap-4">
                        <div 
                          className="relative w-40 h-24 border-2 border-dashed border-slate-300 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer hover:border-fgb-secondary transition-colors group bg-white shrink-0"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {previewUrl ? (
                            <>
                              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Pencil className="w-6 h-6 text-white" />
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-slate-400">
                              <ImageIcon className="w-6 h-6" />
                              <span className="text-xs">Carica foto</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 text-sm text-slate-500 flex-1">
                          <p>Formati: JPG, PNG, WEBP.<br/>Se vuoto, verrà usato il pattern del brand.</p>
                          {previewUrl && (
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              className="w-fit text-red-500 hover:text-red-600 h-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFile(null);
                                setPreviewUrl('');
                                setFormData({ ...formData, imageUrl: '' });
                                if (fileInputRef.current) fileInputRef.current.value = '';
                              }}
                            >
                              <X className="w-3 h-3 mr-2" /> Rimuovi
                            </Button>
                          )}
                        </div>
                        
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileSelect}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Brand *</Label>
                        <Select
                          value={formData.brandId}
                          onValueChange={(value) => setFormData({ ...formData, brandId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona brand" />
                          </SelectTrigger>
                          <SelectContent>
                            {brands.map(b => (
                              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Region *</Label>
                        <Select
                          value={formData.region}
                          onValueChange={(value) => setFormData({ ...formData, region: value as RegionCode })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {regions.map(r => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Nome Site *</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Es. Milan Flagship Store"
                        required
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label>Indirizzo</Label>
                      <Input
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Via/Street"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Città *</Label>
                        <Input
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Paese *</Label>
                        <Input
                          value={formData.country}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-2">
                        <Label>Latitudine</Label>
                        <Input
                          type="number"
                          step="any"
                          value={formData.lat}
                          onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Longitudine</Label>
                        <Input
                          type="number"
                          step="any"
                          value={formData.lng}
                          onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Area (mq)</Label>
                        <Input
                          type="number"
                          value={formData.areaSqm}
                          onChange={(e) => setFormData({ ...formData, areaSqm: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label>Timezone</Label>
                      <Input
                        value={formData.timezone}
                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                        placeholder="Europe/Rome"
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-auto border-t pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                    Annulla
                  </Button>
                  <Button type="submit" className="bg-fgb-secondary hover:bg-fgb-secondary/90" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {isUploading ? 'Caricamento...' : 'Salvataggio...'}
                      </>
                    ) : (
                      editingSite ? 'Salva' : 'Crea'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      {/* Tabella visualizzazione Sites */}
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sites.map((site) => {
              const siteProjects = getProjectsBySite(site.id);
              return (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-200">
                        {site.imageUrl ? (
                          <img src={site.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      {site.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-xs">
                      <Tag className="w-3 h-3" />
                      {getBrandName(site.brandId)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {site.city}, {site.country}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                      <Globe className="w-3 h-3" />
                      {site.region}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {site.areaSqm > 0 ? `${site.areaSqm} mq` : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {siteProjects.length}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Certificazione WELL" onClick={() => setCertDialogSite({ id: site.id, name: site.name })}>
                        <Award className="w-4 h-4 text-rose-500" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(site)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Elimina Site</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sei sicuro di voler eliminare "{site.name}"? 
                              Questa azione eliminerà anche tutti i progetti associati.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteSite(site.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Elimina
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {sites.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  Nessun site presente. Crea prima una holding e un brand.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {certDialogSite && (
        <CertificationsDialog
          siteId={certDialogSite.id}
          siteName={certDialogSite.name}
          open={!!certDialogSite}
          onOpenChange={(open) => !open && setCertDialogSite(null)}
        />
      )}
    </Card>
  );
};
