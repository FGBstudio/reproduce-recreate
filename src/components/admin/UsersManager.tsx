import { useState, useEffect, useCallback } from 'react';
import { Users, Mail, Shield, Search, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { UserRole } from '@/lib/types/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface UserWithRole {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  avatar_url: string | null;
  created_at: string | null;
  role: UserRole | null;
}

const roleOptions: { value: UserRole; label: string; color: string }[] = [
  { value: 'viewer', label: 'Viewer', color: 'bg-gray-100 text-gray-700' },
  { value: 'editor', label: 'Editor', color: 'bg-blue-100 text-blue-700' },
  { value: 'admin', label: 'Admin', color: 'bg-purple-100 text-purple-700' },
  { value: 'superuser', label: 'Superuser', color: 'bg-red-100 text-red-700' },
];

export const UsersManager = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, display_name, first_name, last_name, company, avatar_url, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Build a map of user_id -> highest role
      const roleMap = new Map<string, UserRole>();
      const rolePriority: Record<string, number> = { superuser: 1, admin: 2, editor: 3, viewer: 4 };
      
      for (const r of (roles || [])) {
        const existing = roleMap.get(r.user_id);
        if (!existing || (rolePriority[r.role] || 99) < (rolePriority[existing] || 99)) {
          roleMap.set(r.user_id, r.role as UserRole);
        }
      }

      // Merge profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map(p => ({
        ...p,
        role: roleMap.get(p.id) || null,
      }));

      setUsers(usersWithRoles);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Errore nel caricamento utenti');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter(user => {
    const name = user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const search = searchTerm.toLowerCase();
    return name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search);
  });

  const getRoleBadge = (role: UserRole | null) => {
    if (!role) {
      return <Badge className="bg-gray-50 text-gray-400">Nessun ruolo</Badge>;
    }
    const option = roleOptions.find(r => r.value === role);
    return (
      <Badge className={`${option?.color} hover:${option?.color}`}>
        {option?.label}
      </Badge>
    );
  };

  const getDisplayName = (user: UserWithRole) => {
    return user.display_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0];
  };

  const getInitials = (user: UserWithRole) => {
    const name = getDisplayName(user);
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!isSupabaseConfigured) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Supabase non configurato. La gestione utenti richiede una connessione al database.</p>
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
              <Users className="w-5 h-5" />
              Utenti
            </CardTitle>
            <CardDescription>
              Utenti registrati nella piattaforma (da Supabase Auth)
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
              onClick={fetchUsers}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
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
                <TableHead>Registrato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-fgb-secondary/10 text-fgb-secondary text-sm font-medium">
                          {getInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{getDisplayName(user)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Mail className="w-3.5 h-3.5" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {user.company || '-'}
                  </TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('it-IT') : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    {searchTerm ? 'Nessun utente trovato' : 'Nessun utente registrato.'}
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
