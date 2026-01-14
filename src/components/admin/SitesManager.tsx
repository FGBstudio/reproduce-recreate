import { useState } from 'react';
import { Plus, Pencil, Trash2, MapPin, Tag, Globe } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';

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

  const handleOpenCreate = () => {
    setEditingSite(null);
    setFormData({ ...defaultFormData, brandId: brands[0]?.id || '' });
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
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSite) {
      updateSite(editingSite.id, formData);
    } else {
      addSite(formData);
    }
    setIsDialogOpen(false);
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
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingSite ? 'Modifica Site' : 'Nuovo Site'}</DialogTitle>
                  <DialogDescription>
                    {editingSite ? 'Modifica i dati del site' : 'Inserisci i dati del nuovo site'}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="grid gap-4 py-4">
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Timezone</Label>
                        <Input
                          value={formData.timezone}
                          onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                          placeholder="Europe/Rome"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Immagine URL</Label>
                        <Input
                          value={formData.imageUrl}
                          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter className="mt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button type="submit" className="bg-fgb-secondary hover:bg-fgb-secondary/90">
                    {editingSite ? 'Salva' : 'Crea'}
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
                  <TableCell className="font-medium">{site.name}</TableCell>
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
    </Card>
  );
};
