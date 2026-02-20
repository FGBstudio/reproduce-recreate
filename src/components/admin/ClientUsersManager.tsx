import { useState, useEffect } from 'react';
import { Plus, Mail, Trash2, UserPlus, Building2, Tag, MapPin, Search, RefreshCw } from 'lucide-react';
import { useAdminData } from '@/contexts/AdminDataContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Client role types for the UI
type ClientRoleType = 'ADMIN_HOLDING' | 'ADMIN_BRAND' | 'STORE_USER';

interface ClientUser {
  id: string;
  email: string;
  name: string;
  roleType: ClientRoleType;
  scopeId: string;
  scopeName: string;
  createdAt: Date;
  lastSignIn?: Date;
}

const roleOptions: { value: ClientRoleType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'ADMIN_HOLDING', label: 'Admin Holding Client', description: 'Vede tutti i brand e progetti della holding', icon: <Building2 className="w-4 h-4" /> },
  { value: 'ADMIN_BRAND', label: 'Admin Brand Client', description: 'Vede tutti i progetti del brand', icon: <Tag className="w-4 h-4" /> },
  { value: 'STORE_USER', label: 'Store User', description: 'Vede solo il proprio progetto/store', icon: <MapPin className="w-4 h-4" /> },
];

export const ClientUsersManager = () => {
  const { holdings, brands, sites, addMembership, deleteMembership, refreshData } = useAdminData();
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    roleType: 'STORE_USER' as ClientRoleType,
    scopeId: '',
  });

  // Fetch client users from database
  const fetchClientUsers = async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Get all user memberships with user profiles
      const { data: memberships, error } = await supabase
        .from('user_memberships')
        .select(`
          id,
          scope_type,
          scope_id,
          permission,
          created_at,
          user_id
        `)
        .in('scope_type', ['holding', 'brand', 'site']);

      if (error) throw error;

      if (!memberships || memberships.length === 0) {
        setClientUsers([]);
        setIsLoading(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(memberships.map(m => m.user_id))];
      
      // Fetch profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, display_name, first_name, last_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Map to ClientUser format
      const users: ClientUser[] = memberships.map(m => {
        const profile = profileMap.get(m.user_id);
        let roleType: ClientRoleType = 'STORE_USER';
        let scopeName = '';

        if (m.scope_type === 'holding') {
          roleType = 'ADMIN_HOLDING';
          scopeName = holdings.find(h => h.id === m.scope_id)?.name || m.scope_id;
        } else if (m.scope_type === 'brand') {
          roleType = 'ADMIN_BRAND';
          scopeName = brands.find(b => b.id === m.scope_id)?.name || m.scope_id;
        } else if (m.scope_type === 'site') {
          roleType = 'STORE_USER';
          scopeName = sites.find(s => s.id === m.scope_id)?.name || m.scope_id;
        }

        return {
          id: m.id,
          email: profile?.email || 'N/A',
          name: profile?.display_name || profile?.first_name || profile?.email?.split('@')[0] || 'Unknown',
          roleType,
          scopeId: m.scope_id,
          scopeName,
          createdAt: new Date(m.created_at),
        };
      });

      setClientUsers(users);
    } catch (error) {
      console.error('Error fetching client users:', error);
      toast.error('Errore nel caricamento degli utenti client');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClientUsers();
  }, [holdings, brands, sites]);

  // Get scope options based on selected role type
  const getScopeOptions = () => {
    switch (formData.roleType) {
      case 'ADMIN_HOLDING':
        return holdings.map(h => ({ value: h.id, label: h.name }));
      case 'ADMIN_BRAND':
        return brands.map(b => ({ 
          value: b.id, 
          label: `${b.name} (${holdings.find(h => h.id === b.holdingId)?.name || 'N/A'})` 
        }));
      case 'STORE_USER':
        return sites.map(s => {
          const brand = brands.find(b => b.id === s.brandId);
          const holding = holdings.find(h => h.id === brand?.holdingId);
          return { 
            value: s.id, 
            label: `${s.name} - ${brand?.name || 'N/A'} (${holding?.name || 'N/A'})` 
          };
        });
      default:
        return [];
    }
  };

  const getScopeTypeFromRole = (role: ClientRoleType): 'holding' | 'brand' | 'site' => {
    switch (role) {
      case 'ADMIN_HOLDING': return 'holding';
      case 'ADMIN_BRAND': return 'brand';
      case 'STORE_USER': return 'site';
    }
  };

  // Handle invite user
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.scopeId) {
      toast.error('Compila tutti i campi obbligatori');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!isSupabaseConfigured) {
        toast.error('Supabase non configurato');
        setIsSubmitting(false);
        return;
      }

      // 1. Invite user via Supabase Auth (creates user with email)
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(formData.email, {
        data: {
          display_name: formData.displayName || formData.email.split('@')[0],
        },
      });

      let userId: string;

      if (inviteError) {
        // User might already exist - try to find them
        const { data: existingUsers, error: lookupError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', formData.email)
          .single();

        if (lookupError || !existingUsers) {
          // If invite failed and user doesn't exist, show error
          toast.error(`Errore invito: ${inviteError.message}`);
          setIsSubmitting(false);
          return;
        }

        userId = existingUsers.id;
        toast.info('Utente esistente, aggiunta membership...');
      } else {
        userId = inviteData.user.id;
      }

      // 2. Create membership for the user
      const scopeType = getScopeTypeFromRole(formData.roleType);
      const result = await addMembership({
        userId,
        scopeType,
        scopeId: formData.scopeId,
        permission: formData.roleType === 'STORE_USER' ? 'view' : 'admin',
        allowedRegions: null,
      });

      if (result) {
        toast.success(`Utente ${formData.email} invitato come ${roleOptions.find(r => r.value === formData.roleType)?.label}`);
        setIsDialogOpen(false);
        setFormData({ email: '', displayName: '', roleType: 'STORE_USER', scopeId: '' });
        fetchClientUsers();
      }
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast.error(`Errore: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete client user
  const handleDeleteUser = async (user: ClientUser) => {
    try {
      await deleteMembership(user.id);
      setClientUsers(prev => prev.filter(u => u.id !== user.id));
      toast.success('Accesso utente rimosso');
    } catch (error) {
      console.error('Error deleting user access:', error);
    }
  };

  // Get role badge color
  const getRoleBadge = (role: ClientRoleType) => {
    const option = roleOptions.find(r => r.value === role);
    const colorClass = 
      role === 'ADMIN_HOLDING' ? 'bg-purple-100 text-purple-700 border-purple-200' :
      role === 'ADMIN_BRAND' ? 'bg-blue-100 text-blue-700 border-blue-200' :
      'bg-green-100 text-green-700 border-green-200';
    
    return (
      <Badge variant="outline" className={`${colorClass} gap-1`}>
        {option?.icon}
        {option?.label}
      </Badge>
    );
  };

  // Filter users
  const filteredUsers = clientUsers.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.scopeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Client Users
            </CardTitle>
            <CardDescription>
              Invita e gestisci utenti esterni (Admin Holding, Admin Brand, Store User)
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchClientUsers} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Ricarica
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-fgb-secondary hover:bg-fgb-secondary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Invita Utente
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleInviteUser}>
                  <DialogHeader>
                    <DialogTitle>Invita Utente Client</DialogTitle>
                    <DialogDescription>
                      Invita un utente esterno e assegnagli accesso a una holding, brand o progetto
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="utente@azienda.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="displayName">Nome (opzionale)</Label>
                      <Input
                        id="displayName"
                        placeholder="Mario Rossi"
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Ruolo Client *</Label>
                      <Select
                        value={formData.roleType}
                        onValueChange={(value) => setFormData({ ...formData, roleType: value as ClientRoleType, scopeId: '' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map(role => (
                            <SelectItem key={role.value} value={role.value}>
                              <div className="flex items-center gap-2">
                                {role.icon}
                                <div>
                                  <p className="font-medium">{role.label}</p>
                                  <p className="text-xs text-muted-foreground">{role.description}</p>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>
                        {formData.roleType === 'ADMIN_HOLDING' ? 'Holding *' :
                         formData.roleType === 'ADMIN_BRAND' ? 'Brand *' : 'Progetto/Store *'}
                      </Label>
                      <Select
                        value={formData.scopeId}
                        onValueChange={(value) => setFormData({ ...formData, scopeId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona..." />
                        </SelectTrigger>
                        <SelectContent>
                          {getScopeOptions().map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
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
                    <Button 
                      type="submit" 
                      className="bg-fgb-secondary hover:bg-fgb-secondary/90"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Invio in corso...' : 'Invia Invito'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search bar */}
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per email, nome o scope..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Users table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utente</TableHead>
              <TableHead>Ruolo Client</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Creato</TableHead>
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'Nessun risultato trovato' : 'Nessun utente client. Invita il primo per assegnare accesso.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(user.roleType)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {user.scopeName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.createdAt.toLocaleDateString('it-IT')}
                  </TableCell>
                  <TableCell className="text-right">
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
                            Sei sicuro di voler rimuovere l'accesso di <strong>{user.name}</strong> ({user.email}) a <strong>{user.scopeName}</strong>?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteUser(user)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Rimuovi
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
