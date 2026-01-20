import { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Tag, Building2, ImageIcon, X, Loader2 } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { AdminBrand } from '@/lib/types/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';

export const BrandsManager = () => {
  const { holdings, brands, addBrand, updateBrand, deleteBrand, getSitesByBrand } = useAdminData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  
  // Stati del form e upload
  const [formData, setFormData] = useState({ name: '', holdingId: '', logo: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenCreate = () => {
    setEditingBrand(null);
    setFormData({ name: '', holdingId: holdings[0]?.id || '', logo: '' });
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (brand: AdminBrand) => {
    setEditingBrand(brand);
    setFormData({ name: brand.name, holdingId: brand.holdingId, logo: brand.logo || '' });
    setSelectedFile(null);
    setPreviewUrl(brand.logo || null);
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

  const uploadLogoToSupabase = async (file: File, brandIdOrTemp: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `logo.${fileExt}`;
    // Se è nuovo, usiamo un timestamp, altrimenti l'ID del brand
    const pathId = editingBrand ? brandIdOrTemp : `new_brand/${Date.now()}`;
    const filePath = `brands/${pathId}/${fileName}`;

    console.log("Tentativo upload logo su:", filePath);

    const { error: uploadError } = await supabase.storage
      .from('project-assets')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Errore Upload Logo:", uploadError);
      throw new Error(`Errore caricamento logo: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('project-assets')
      .getPublicUrl(filePath);

    return `${publicUrl}?t=${Date.now()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setIsUploading(!!selectedFile);

    try {
      let finalLogoUrl = formData.logo;

      if (selectedFile) {
        finalLogoUrl = await uploadLogoToSupabase(selectedFile, editingBrand ? editingBrand.id : 'temp');
      }

      const dataToSave = {
        ...formData,
        logo: finalLogoUrl
      };

      if (editingBrand) {
        await updateBrand(editingBrand.id, dataToSave);
      } else {
        await addBrand(dataToSave);
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error("Errore salvataggio brand:", error);
      alert(`Errore durante il salvataggio: ${error.message || error}`);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const getHoldingName = (holdingId: string) => {
    return holdings.find(h => h.id === holdingId)?.name || 'N/A';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Brands
            </CardTitle>
            <CardDescription>
              Gestisci i brand e associali alle holding
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="bg-fgb-secondary hover:bg-fgb-secondary/90">
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Brand
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <DialogHeader>
                  <DialogTitle>{editingBrand ? 'Modifica Brand' : 'Nuovo Brand'}</DialogTitle>
                  <DialogDescription>
                    {editingBrand ? 'Modifica i dati del brand' : 'Inserisci i dati del nuovo brand'}
                  </DialogDescription>
                </DialogHeader>
                
                <div className="flex flex-col gap-4 py-2">
                  
                  {/* UPLOAD LOGO */}
                  <div className="flex flex-col gap-2 p-4 border rounded-lg bg-slate-50/50">
                    <Label>Logo Brand</Label>
                    <div className="flex items-center gap-4">
                      <div 
                        className="relative w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg overflow-hidden flex items-center justify-center cursor-pointer hover:border-fgb-secondary transition-colors group bg-white shrink-0"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {previewUrl ? (
                          <>
                            <img src={previewUrl} alt="Logo Preview" className="w-full h-full object-contain p-1" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Pencil className="w-5 h-5 text-white" />
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-slate-400">
                            <ImageIcon className="w-5 h-5" />
                            <span className="text-[10px]">Carica</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 text-sm text-slate-500 flex-1">
                        <p className="text-xs">PNG o SVG con sfondo trasparente raccomandati per il pattern.</p>
                        {previewUrl && (
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            className="w-fit text-red-500 hover:text-red-600 h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                              setPreviewUrl('');
                              setFormData({ ...formData, logo: '' });
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

                  <div className="grid gap-2">
                    <Label htmlFor="holdingId">Holding *</Label>
                    <Select
                      value={formData.holdingId}
                      onValueChange={(value) => setFormData({ ...formData, holdingId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona holding" />
                      </SelectTrigger>
                      <SelectContent>
                        {holdings.map(h => (
                          <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome Brand *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Es. Gucci, Dior"
                      required
                    />
                  </div>
                </div>

                <DialogFooter>
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
                      editingBrand ? 'Salva' : 'Crea'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Logo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Holding</TableHead>
              <TableHead>Sites</TableHead>
              <TableHead>Creato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((brand) => {
              const brandSites = getSitesByBrand(brand.id);
              return (
                <TableRow key={brand.id}>
                  <TableCell>
                    <div className="h-10 w-10 rounded border border-slate-100 bg-white flex items-center justify-center overflow-hidden">
                      {brand.logo ? (
                        <img src={brand.logo} alt={brand.name} className="h-full w-full object-contain p-1" />
                      ) : (
                        <Tag className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{brand.name}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-xs">
                      <Building2 className="w-3 h-3" />
                      {getHoldingName(brand.holdingId)}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {brandSites.length} sites
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {brand.createdAt.toLocaleDateString('it-IT')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(brand)}>
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
                            <AlertDialogTitle>Elimina Brand</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sei sicuro di voler eliminare "{brand.name}"? 
                              Questa azione eliminerà anche tutti i sites e progetti associati.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteBrand(brand.id)}
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
            {brands.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  Nessun brand presente. Crea prima una holding, poi aggiungi i brand.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
