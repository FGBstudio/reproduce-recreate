import { useState } from 'react';
import { Plus, Pencil, Trash2, Tag, Building2 } from 'lucide-react';
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

export const BrandsManager = () => {
  const { holdings, brands, sites, addBrand, updateBrand, deleteBrand, getSitesByBrand } = useAdminData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  const [formData, setFormData] = useState({ name: '', holdingId: '', logo: '' });

  const handleOpenCreate = () => {
    setEditingBrand(null);
    setFormData({ name: '', holdingId: holdings[0]?.id || '', logo: '' });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (brand: AdminBrand) => {
    setEditingBrand(brand);
    setFormData({ name: brand.name, holdingId: brand.holdingId, logo: brand.logo || '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingBrand) {
      updateBrand(editingBrand.id, formData);
    } else {
      addBrand(formData);
    }
    setIsDialogOpen(false);
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
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingBrand ? 'Modifica Brand' : 'Nuovo Brand'}</DialogTitle>
                  <DialogDescription>
                    {editingBrand ? 'Modifica i dati del brand' : 'Inserisci i dati del nuovo brand'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
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
                  <div className="grid gap-2">
                    <Label htmlFor="logo">Logo URL</Label>
                    <Input
                      id="logo"
                      value={formData.logo}
                      onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button type="submit" className="bg-fgb-secondary hover:bg-fgb-secondary/90">
                    {editingBrand ? 'Salva' : 'Crea'}
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
              <TableHead className="w-12">Logo</TableHead>
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
                    {brand.logo ? (
                      <img src={brand.logo} alt={brand.name} className="h-8 w-8 object-contain" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center">
                        <Tag className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
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
