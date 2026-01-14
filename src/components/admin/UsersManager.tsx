import { useState } from 'react';
import { Plus, Pencil, Trash2, Users, Mail, Shield, UserPlus, Search } from 'lucide-react';
import { User, UserRole } from '@/lib/types/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const roleOptions: { value: UserRole; label: string; color: string }[] = [
  { value: 'viewer', label: 'Viewer', color: 'bg-gray-100 text-gray-700' },
  { value: 'editor', label: 'Editor', color: 'bg-blue-100 text-blue-700' },
  { value: 'admin', label: 'Admin', color: 'bg-purple-100 text-purple-700' },
  { value: 'superuser', label: 'Superuser', color: 'bg-red-100 text-red-700' },
];

interface UsersManagerProps {
  users: User[];
  onAddUser: (user: Omit<User, 'id'>) => void;
  onUpdateUser: (id: string, data: Partial<User>) => void;
  onDeleteUser: (id: string) => void;
}

export const UsersManager = ({ users, onAddUser, onUpdateUser, onDeleteUser }: UsersManagerProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Omit<User, 'id'>>({
    email: '',
    name: '',
    role: 'viewer',
    avatar: '',
  });

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({ email: '', name: '', role: 'viewer', avatar: '' });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ email: user.email, name: user.name, role: user.role, avatar: user.avatar || '' });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      onUpdateUser(editingUser.id, formData);
    } else {
      onAddUser(formData);
    }
    setIsDialogOpen(false);
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: UserRole) => {
    const option = roleOptions.find(r => r.value === role);
    return (
      <Badge className={`${option?.color} hover:${option?.color}`}>
        {option?.label}
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Utenti
            </CardTitle>
            <CardDescription>
              Gestisci gli utenti della piattaforma e i loro ruoli
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Cerca utente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full sm:w-64"
              />
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenCreate} className="bg-fgb-secondary hover:bg-fgb-secondary/90 whitespace-nowrap">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Nuovo Utente
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit}>
                  <DialogHeader>
                    <DialogTitle>{editingUser ? 'Modifica Utente' : 'Nuovo Utente'}</DialogTitle>
                    <DialogDescription>
                      {editingUser ? 'Modifica i dati dell\'utente' : 'Inserisci i dati del nuovo utente'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nome Completo *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Mario Rossi"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="mario@azienda.com"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Ruolo *</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map(r => (
                            <SelectItem key={r.value} value={r.value}>
                              <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${r.color.replace('text-', 'bg-').replace('-700', '-500')}`} />
                                {r.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        {formData.role === 'viewer' && 'Può solo visualizzare i dati dei progetti assegnati'}
                        {formData.role === 'editor' && 'Può modificare i dati dei progetti assegnati'}
                        {formData.role === 'admin' && 'Accesso completo alla sezione Admin'}
                        {formData.role === 'superuser' && 'Controllo totale su tutta la piattaforma'}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="avatar">Avatar URL (opzionale)</Label>
                      <Input
                        id="avatar"
                        value={formData.avatar}
                        onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Annulla
                    </Button>
                    <Button type="submit" className="bg-fgb-secondary hover:bg-fgb-secondary/90">
                      {editingUser ? 'Salva' : 'Crea Utente'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utente</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ruolo</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar} />
                      <AvatarFallback className="bg-fgb-secondary/10 text-fgb-secondary text-sm font-medium">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Mail className="w-3.5 h-3.5" />
                    {user.email}
                  </div>
                </TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(user)}>
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
                          <AlertDialogTitle>Elimina Utente</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sei sicuro di voler eliminare "{user.name}"? 
                            L'utente perderà tutti gli accessi.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDeleteUser(user.id)}
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
            ))}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                  {searchTerm ? 'Nessun utente trovato' : 'Nessun utente presente. Crea il primo utente.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
