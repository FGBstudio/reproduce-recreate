import { useState } from 'react';
import { Plus, Pencil, Trash2, Users, Shield, Eye, Edit, Crown } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { UserMembership, ScopeType, Permission } from '@/lib/types/admin';
import { mockUsers } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

const scopeTypeOptions: { value: ScopeType; label: string }[] = [
  { value: 'project', label: 'Progetto' },
  { value: 'site', label: 'Site' },
  { value: 'region', label: 'Regione' },
  { value: 'brand', label: 'Brand' },
  { value: 'holding', label: 'Holding' },
];

const permissionOptions: { value: Permission; label: string; icon: React.ReactNode }[] = [
  { value: 'view', label: 'Visualizzazione', icon: <Eye className="w-3 h-3" /> },
  { value: 'edit', label: 'Modifica', icon: <Edit className="w-3 h-3" /> },
  { value: 'admin', label: 'Amministratore', icon: <Crown className="w-3 h-3" /> },
];

const regionOptions = [
  { value: 'EU', label: 'Europe' },
  { value: 'AMER', label: 'Americas' },
  { value: 'APAC', label: 'Asia Pacific' },
  { value: 'MEA', label: 'Middle East & Africa' },
];

export const UserAccessManager = () => {
  const { holdings, brands, sites, projects, memberships, addMembership, updateMembership, deleteMembership } = useAdminData();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMembership, setEditingMembership] = useState<UserMembership | null>(null);
  const [formData, setFormData] = useState({
    userId: '',
    scopeType: 'project' as ScopeType,
    scopeId: '',
    permission: 'view' as Permission,
  });

  const users = Object.values(mockUsers);

  const handleOpenCreate = () => {
    setEditingMembership(null);
    setFormData({
      userId: users[0]?.id || '',
      scopeType: 'project',
      scopeId: '',
      permission: 'view',
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (membership: UserMembership) => {
    setEditingMembership(membership);
    setFormData({
      userId: membership.userId,
      scopeType: membership.scopeType,
      scopeId: membership.scopeId,
      permission: membership.permission,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMembership) {
      updateMembership(editingMembership.id, formData);
    } else {
      addMembership(formData);
    }
    setIsDialogOpen(false);
  };

  const getScopeOptions = () => {
    switch (formData.scopeType) {
      case 'holding':
        return holdings.map(h => ({ value: h.id, label: h.name }));
      case 'brand':
        return brands.map(b => ({ value: b.id, label: b.name }));
      case 'site':
        return sites.map(s => ({ value: s.id, label: s.name }));
      case 'project':
        return projects.map(p => ({ value: p.id, label: p.name }));
      case 'region':
        return regionOptions;
      default:
        return [];
    }
  };

  const getScopeName = (scopeType: ScopeType, scopeId: string) => {
    switch (scopeType) {
      case 'holding':
        return holdings.find(h => h.id === scopeId)?.name || scopeId;
      case 'brand':
        return brands.find(b => b.id === scopeId)?.name || scopeId;
      case 'site':
        return sites.find(s => s.id === scopeId)?.name || scopeId;
      case 'project':
        return projects.find(p => p.id === scopeId)?.name || scopeId;
      case 'region':
        return regionOptions.find(r => r.value === scopeId)?.label || scopeId;
      default:
        return scopeId;
    }
  };

  const getUserName = (userId: string) => users.find(u => u.id === userId)?.name || userId;
  const getUserEmail = (userId: string) => users.find(u => u.id === userId)?.email || '';

  const getPermissionBadge = (permission: Permission) => {
    const option = permissionOptions.find(p => p.value === permission);
    const colorClass = permission === 'admin' ? 'bg-purple-100 text-purple-700' :
                       permission === 'edit' ? 'bg-blue-100 text-blue-700' :
                       'bg-gray-100 text-gray-600';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${colorClass}`}>
        {option?.icon}
        {option?.label}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Access
            </CardTitle>
            <CardDescription>
              Gestisci i permessi utente per progetti, sites, brand e holding
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="bg-fgb-secondary hover:bg-fgb-secondary/90">
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Accesso
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingMembership ? 'Modifica Accesso' : 'Nuovo Accesso'}</DialogTitle>
                  <DialogDescription>
                    Assegna permessi a un utente per un determinato scope
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Utente *</Label>
                    <Select
                      value={formData.userId}
                      onValueChange={(value) => setFormData({ ...formData, userId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona utente" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(u => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Tipo Scope *</Label>
                      <Select
                        value={formData.scopeType}
                        onValueChange={(value) => setFormData({ ...formData, scopeType: value as ScopeType, scopeId: '' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {scopeTypeOptions.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Scope *</Label>
                      <Select
                        value={formData.scopeId}
                        onValueChange={(value) => setFormData({ ...formData, scopeId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona..." />
                        </SelectTrigger>
                        <SelectContent>
                          {getScopeOptions().map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Permesso *</Label>
                    <Select
                      value={formData.permission}
                      onValueChange={(value) => setFormData({ ...formData, permission: value as Permission })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {permissionOptions.map(p => (
                          <SelectItem key={p.value} value={p.value}>
                            <span className="flex items-center gap-2">
                              {p.icon}
                              {p.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button type="submit" className="bg-fgb-secondary hover:bg-fgb-secondary/90">
                    {editingMembership ? 'Salva' : 'Crea'}
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
              <TableHead>Utente</TableHead>
              <TableHead>Tipo Scope</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Permesso</TableHead>
              <TableHead>Creato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberships.map((membership) => (
              <TableRow key={membership.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{getUserName(membership.userId)}</p>
                    <p className="text-xs text-slate-500">{getUserEmail(membership.userId)}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {scopeTypeOptions.find(s => s.value === membership.scopeType)?.label}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {getScopeName(membership.scopeType, membership.scopeId)}
                </TableCell>
                <TableCell>
                  {getPermissionBadge(membership.permission)}
                </TableCell>
                <TableCell className="text-sm text-slate-500">
                  {membership.createdAt.toLocaleDateString('it-IT')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(membership)}>
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
                          <AlertDialogTitle>Rimuovi Accesso</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sei sicuro di voler rimuovere questo accesso?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMembership(membership.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Rimuovi
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {memberships.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  Nessun accesso configurato. Aggiungi il primo per assegnare permessi agli utenti.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
