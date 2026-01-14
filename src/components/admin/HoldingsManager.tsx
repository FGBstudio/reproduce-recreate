import { useState } from 'react';
import { Plus, Pencil, Trash2, Building2, ExternalLink } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { AdminHolding } from '@/lib/types/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export const HoldingsManager = () => {
  const { holdings, brands, addHolding, updateHolding, deleteHolding, getBrandsByHolding } = useAdminData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<AdminHolding | null>(null);
  const [formData, setFormData] = useState({ name: '', logo: '' });

  const handleOpenCreate = () => {
    setEditingHolding(null);
    setFormData({ name: '', logo: '' });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (holding: AdminHolding) => {
    setEditingHolding(holding);
    setFormData({ name: holding.name, logo: holding.logo || '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingHolding) {
      updateHolding(editingHolding.id, formData);
    } else {
      addHolding(formData);
    }
    setIsDialogOpen(false);
    setFormData({ name: '', logo: '' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Holdings
            </CardTitle>
            <CardDescription>
              Gestisci le holding (gruppi aziendali) della piattaforma
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="bg-fgb-secondary hover:bg-fgb-secondary/90">
                <Plus className="w-4 h-4 mr-2" />
                Nuova Holding
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingHolding ? 'Modifica Holding' : 'Nuova Holding'}</DialogTitle>
                  <DialogDescription>
                    {editingHolding ? 'Modifica i dati della holding' : 'Inserisci i dati della nuova holding'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Es. Kering, LVMH"
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
                  {formData.logo && (
                    <div className="flex items-center gap-2">
                      <img src={formData.logo} alt="Preview" className="h-8 object-contain" />
                      <span className="text-xs text-slate-500">Preview logo</span>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button type="submit" className="bg-fgb-secondary hover:bg-fgb-secondary/90">
                    {editingHolding ? 'Salva Modifiche' : 'Crea Holding'}
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
              <TableHead>Brand</TableHead>
              <TableHead>Creato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding) => {
              const holdingBrands = getBrandsByHolding(holding.id);
              return (
                <TableRow key={holding.id}>
                  <TableCell>
                    {holding.logo ? (
                      <img src={holding.logo} alt={holding.name} className="h-8 w-8 object-contain" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{holding.name}</TableCell>
                  <TableCell>
                    <span className="text-sm text-slate-500">
                      {holdingBrands.length} brand
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {holding.createdAt.toLocaleDateString('it-IT')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(holding)}>
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
                            <AlertDialogTitle>Elimina Holding</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sei sicuro di voler eliminare "{holding.name}"? 
                              Questa azione eliminerà anche tutti i brand, sites e progetti associati.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteHolding(holding.id)}
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
            {holdings.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  Nessuna holding presente. Crea la prima holding per iniziare.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
