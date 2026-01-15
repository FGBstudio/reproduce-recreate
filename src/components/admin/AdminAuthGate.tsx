import { ReactNode, useState } from 'react';
import { useAuth, mockUsers } from '@/contexts/AuthContext';
import { Shield, LogIn, User, Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserRole } from '@/lib/types/admin';
import { isSupabaseConfigured } from '@/lib/supabase';

interface AdminAuthGateProps {
  children: ReactNode;
}

export const AdminAuthGate = ({ children }: AdminAuthGateProps) => {
  const { user, isAdmin, isLoading, login, signup, mockLogin, setRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    const { error } = await login(email, password);
    if (error) {
      setError(error.message);
    }
    setIsSubmitting(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    
    const { error } = await signup(email, password, { display_name: displayName, company });
    if (error) {
      setError(error.message);
    } else {
      setError('Controlla la tua email per confermare la registrazione.');
    }
    setIsSubmitting(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-fgb-secondary" />
      </div>
    );
  }

  // Not logged in - show login form
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-fgb-secondary/10 flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-fgb-secondary" />
            </div>
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>
              {isSupabaseConfigured 
                ? 'Accedi con le tue credenziali'
                : 'Seleziona un ruolo per accedere (modalità demo)'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSupabaseConfigured ? (
              // Real Supabase Auth
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Accedi</TabsTrigger>
                  <TabsTrigger value="signup">Registrati</TabsTrigger>
                </TabsList>
                
                <TabsContent value="login" className="space-y-4 mt-4">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="email@azienda.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    {error && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}
                    <Button 
                      type="submit"
                      className="w-full bg-fgb-secondary hover:bg-fgb-secondary/90"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <LogIn className="w-4 h-4 mr-2" />
                      )}
                      Accedi
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup" className="space-y-4 mt-4">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Nome</Label>
                        <Input
                          id="displayName"
                          placeholder="Mario Rossi"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="company">Azienda</Label>
                        <Input
                          id="company"
                          placeholder="Azienda SpA"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signupEmail">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          id="signupEmail"
                          type="email"
                          placeholder="email@azienda.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-9"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signupPassword">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          id="signupPassword"
                          type="password"
                          placeholder="Min. 8 caratteri"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-9"
                          minLength={8}
                          required
                        />
                      </div>
                    </div>
                    {error && (
                      <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
                        error.includes('confermare') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                      }`}>
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}
                    <Button 
                      type="submit"
                      className="w-full bg-fgb-secondary hover:bg-fgb-secondary/90"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <User className="w-4 h-4 mr-2" />
                      )}
                      Registrati
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            ) : (
              // Mock auth for development
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Seleziona Ruolo</Label>
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
                  onClick={() => mockLogin(mockUsers[selectedRole]?.email || 'admin@fgb.com', selectedRole)}
                  className="w-full bg-fgb-secondary hover:bg-fgb-secondary/90"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Accedi come {selectedRole}
                </Button>
                <p className="text-xs text-center text-slate-500 bg-amber-50 p-2 rounded">
                  ⚠️ Supabase non configurato. Usando mock auth per development.
                </p>
              </div>
            )}
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
            {!isSupabaseConfigured && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Cambia Ruolo (dev only)</Label>
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
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin access granted
  return <>{children}</>;
};
