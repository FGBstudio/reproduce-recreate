import { ReactNode, useState } from 'react';
import { useAuth, mockUsers } from '@/contexts/AuthContext';
import { Shield, LogIn, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserRole } from '@/lib/types/admin';

interface AdminAuthGateProps {
  children: ReactNode;
}

export const AdminAuthGate = ({ children }: AdminAuthGateProps) => {
  const { user, isAdmin, login, setRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');

  // Not logged in - show mock login
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-fgb-secondary/10 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-fgb-secondary" />
            </div>
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>
              Seleziona un ruolo per accedere all'area admin (mock auth per development)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Seleziona Ruolo</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superuser">Superuser (Full Access)</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={() => login(mockUsers[selectedRole]?.email || 'admin@fgb.com', selectedRole)}
              className="w-full bg-fgb-secondary hover:bg-fgb-secondary/90"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Accedi come {selectedRole}
            </Button>
            <p className="text-xs text-center text-slate-500">
              Questo è un mock auth per development. L'integrazione con Supabase Auth verrà implementata successivamente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logged in but not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-red-500" />
            </div>
            <CardTitle>Accesso Negato</CardTitle>
            <CardDescription>
              Il tuo ruolo attuale ({user.role}) non ha accesso all'area admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg flex items-center gap-3">
              <User className="w-5 h-5 text-slate-400" />
              <div>
                <p className="font-medium text-slate-700">{user.name}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
              <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-600 rounded">
                {user.role}
              </span>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Cambia Ruolo (dev only)</label>
              <Select value={user.role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superuser">Superuser</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin access granted
  return <>{children}</>;
};
