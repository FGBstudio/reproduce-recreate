import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { User, UserRole, UserProfile, AuthState } from '@/lib/types/admin';

interface AuthContextType extends AuthState {
  users: User[];
  session: Session | null;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  signup: (email: string, password: string, metadata?: { display_name?: string; company?: string }) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  // Mock functions for development
  mockLogin: (email: string, role?: UserRole) => void;
  addUser: (userData: Omit<User, 'id'>) => User;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initial mock users for development (when Supabase is not configured)
const initialMockUsers: User[] = [
  { id: 'user-admin-1', email: 'admin@fgb.com', name: 'Admin User', role: 'admin' },
  { id: 'user-super-1', email: 'superuser@fgb.com', name: 'Super User', role: 'superuser' },
  { id: 'user-editor-1', email: 'editor@fgb.com', name: 'Editor User', role: 'editor' },
  { id: 'user-viewer-1', email: 'viewer@fgb.com', name: 'Viewer User', role: 'viewer' },
];

const generateId = () => `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [users, setUsers] = useState<User[]>(initialMockUsers);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  // Fetch user profile and role from database
  const fetchUserData = useCallback(async (supabaseUser: SupabaseUser) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id)
        .order('role')
        .limit(1)
        .single();

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error fetching role:', roleError);
      }

      const userProfile: UserProfile | null = profileData || null;
      const userRole: UserRole = (roleData?.role as UserRole) || 'viewer';

      setProfile(userProfile);
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email || '',
        name: userProfile?.display_name || userProfile?.first_name || supabaseUser.email?.split('@')[0] || 'User',
        role: userRole,
        avatar: userProfile?.avatar_url,
        profile: userProfile || undefined,
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        
        if (currentSession?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchUserData(currentSession.user), 0);
        } else {
          setUser(null);
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      if (initialSession?.user) {
        fetchUserData(initialSession.user);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  // Real Supabase login
  const login = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }
    
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    
    return { error: error ? new Error(error.message) : null };
  }, []);

  // Real Supabase signup
  const signup = useCallback(async (
    email: string, 
    password: string, 
    metadata?: { display_name?: string; company?: string }
  ) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }
    
    setIsLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: metadata,
      },
    });
    setIsLoading(false);
    
    return { error: error ? new Error(error.message) : null };
  }, []);

  // Real Supabase logout
  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setSession(null);
  }, []);

  // Update profile in database
  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    if (!isSupabaseConfigured || !user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (!error && profile) {
      setProfile({ ...profile, ...data });
      setUser(prev => prev ? {
        ...prev,
        name: data.display_name || data.first_name || prev.name,
        avatar: data.avatar_url || prev.avatar,
      } : null);
    }

    return { error: error ? new Error(error.message) : null };
  }, [user, profile]);

  // Mock login for development
  const mockLogin = useCallback((email: string, role: UserRole = 'viewer') => {
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      setUser(existingUser);
    } else {
      const newUser: User = {
        id: generateId(),
        email,
        name: email.split('@')[0],
        role,
      };
      setUsers(prev => [...prev, newUser]);
      setUser(newUser);
    }
  }, [users]);

  // Mock role change (dev only)
  const setRole = useCallback((role: UserRole) => {
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    }
  }, [user]);

  // Mock user management
  const addUser = useCallback((userData: Omit<User, 'id'>): User => {
    const newUser: User = { ...userData, id: generateId() };
    setUsers(prev => [...prev, newUser]);
    return newUser;
  }, []);

  const updateUser = useCallback((id: string, data: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    if (user?.id === id) {
      setUser(prev => prev ? { ...prev, ...data } : null);
    }
  }, [user]);

  const deleteUser = useCallback((id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    if (user?.id === id) {
      setUser(null);
    }
  }, [user]);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin' || user?.role === 'superuser';
  const isSuperuser = user?.role === 'superuser';

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      users,
      session,
      isLoading,
      isAuthenticated,
      isAdmin,
      isSuperuser,
      login,
      signup,
      logout,
      setRole,
      updateProfile,
      mockLogin,
      addUser,
      updateUser,
      deleteUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export mock users for backward compatibility
export const mockUsers = initialMockUsers.reduce((acc, user) => {
  acc[user.role] = user;
  return acc;
}, {} as Record<string, User>);
