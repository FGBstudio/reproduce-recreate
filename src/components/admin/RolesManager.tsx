import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, Search, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type AppRole = 'viewer' | 'editor' | 'admin';

interface UserRoleWithProfile {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  profiles: {
    id: string;
    display_name: string | null;
    email: string;
    company: string | null;
    avatar_url: string | null;
  };
}

interface ProfileForAssignment {
  id: string;
  display_name: string | null;
  email: string;
  company: string | null;
}

const roleOptions: { value: AppRole; label: string; color: string; description: string }[] = [
  { value: 'viewer', label: 'Viewer', color: 'bg-slate-100 text-slate-700', description: 'Può solo visualizzare i dati' },
  { value: 'editor', label: 'Editor', color: 'bg-blue-100 text-blue-700', description: 'Può modificare i dati' },
  { value: 'admin', label: 'Admin', color: 'bg-purple-100 text-purple-700', description: 'Gestione completa' },
];

export const RolesManager = () => {
  const { session } = useAuth();
  const [roles, setRoles] = useState<UserRoleWithProfile[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<ProfileForAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('viewer');

  // Get API base URL
  const getApiUrl = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return null;
    return `${supabaseUrl}/functions/v1`;
  };

  // Fetch user roles from Edge Function
  const fetchRoles = useCallback(async () => {
    if (!isSupabaseConfigured || !session?.access_token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) throw new Error('API URL not configured');

      const response = await fetch(`${apiUrl}/admin-roles`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to fetch roles');
      }

      setRoles(result.data || []);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dei ruoli');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  // Fetch profiles for assignment dropdown
  const fetchProfiles = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, company')
        .order('display_name');

      if (error) throw error;
      setAvailableProfiles(data || []);
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchProfiles();
  }, [fetchRoles, fetchProfiles]);

  // Assign role to user
  const handleAssignRole = async () => {
    if (!selectedUserId || !selectedRole || !session?.access_token) return;

    setSubmitting(true);
    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) throw new Error('API URL not configured');

      const response = await fetch(`${apiUrl}/admin-roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: selectedUserId,
          role: selectedRole,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to assign role');
      }

      toast.success(`Ruolo "${selectedRole}" assegnato con successo`);
      setIsDialogOpen(false);
      setSelectedUserId('');
      setSelectedRole('viewer');
      fetchRoles();
    } catch (err) {
      console.error('Error assigning role:', err);
      toast.error(err instanceof Error ? err.message : 'Errore nell\'assegnazione del ruolo');
    } finally {
      setSubmitting(false);
    }
  };

  // Remove role from user
  const handleRemoveRole = async (userId: string, role: AppRole) => {
    if (!session?.access_token) return;

    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) throw new Error('API URL not configured');

      const response = await fetch(`${apiUrl}/admin-roles`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          role: role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Failed to remove role');
      }

      toast.success(`Ruolo "${role}" rimosso con successo`);
      fetchRoles();
    } catch (err) {
      console.error('Error removing role:', err);
      toast.error(err instanceof Error ? err.message : 'Errore nella rimozione del ruolo');
    }
  };

  const getRoleBadge = (role: AppRole) => {
    const option = roleOptions.find(r => r.value === role);
    return (
      <Badge className={`${option?.color} hover:${option?.color}`}>
        {option?.label}
      </Badge>
    );
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const filteredRoles = roles.filter(role => {
    const displayName = role.profiles?.display_name || '';
    const email = role.profiles?.email || '';
    const search = searchTerm.toLowerCase();
    return displayName.toLowerCase().includes(search) || email.toLowerCase().includes(search);
  });

  // Get users without any roles for the dropdown
  const usersWithRoles = new Set(roles.map(r => r.user_id));
  const usersWithoutRole = availableProfiles.filter(p => !usersWithRoles.has(p.id));

  if (!isSupabaseConfigured) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-slate-500">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Supabase non configurato. La gestione ruoli richiede una connessione al database.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Gestione Ruoli
            </CardTitle>
            <CardDescription>
              Assegna e gestisci i ruoli degli utenti (admin, editor, viewer)
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
            <Button
              variant="outline"
              size="icon"
              onClick={fetchRoles}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-fgb-secondary hover:bg-fgb-secondary/90 whitespace-nowrap">
                  <Plus className="w-4 h-4 mr-2" />
                  Assegna Ruolo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assegna Ruolo</DialogTitle>
                  <DialogDescription>
                    Seleziona un utente e assegna un ruolo
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Utente *</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona utente" />
                      </SelectTrigger>
                      <SelectContent>
                        {usersWithoutRole.length === 0 ? (
                          <div className="p-2 text-sm text-slate-500 text-center">
                            Tutti gli utenti hanno già un ruolo
                          </div>
                        ) : (
                          usersWithoutRole.map(profile => (
                            <SelectItem key={profile.id} value={profile.id}>
                              <span className="flex items-center gap-2">
                                <span>{profile.display_name || profile.email}</span>
                                {profile.company && (
                                  <span className="text-slate-400 text-xs">({profile.company})</span>
                                )}
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Ruolo *</Label>
                    <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
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
                      {roleOptions.find(r => r.value === selectedRole)?.description}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button 
                    onClick={handleAssignRole} 
                    className="bg-fgb-secondary hover:bg-fgb-secondary/90"
                    disabled={!selectedUserId || submitting}
                  >
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Assegna
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Azienda</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Data Assegnazione</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.map((userRole) => (
                <TableRow key={userRole.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={userRole.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="bg-fgb-secondary/10 text-fgb-secondary text-sm font-medium">
                          {getInitials(userRole.profiles?.display_name, userRole.profiles?.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {userRole.profiles?.display_name || 'N/A'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {userRole.profiles?.email}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {userRole.profiles?.company || '-'}
                  </TableCell>
                  <TableCell>{getRoleBadge(userRole.role)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {new Date(userRole.created_at).toLocaleDateString('it-IT')}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Rimuovi Ruolo</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sei sicuro di voler rimuovere il ruolo "{userRole.role}" da{' '}
                            "{userRole.profiles?.display_name || userRole.profiles?.email}"?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveRole(userRole.user_id, userRole.role)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Rimuovi
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRoles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    {searchTerm 
                      ? 'Nessun utente trovato con questo criterio'
                      : 'Nessun ruolo assegnato. Assegna il primo ruolo.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
