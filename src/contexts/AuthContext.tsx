import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { User, UserRole, UserProfile, AuthState } from '@/lib/types/admin';

interface AuthContextType extends AuthState {
  session: Session | null;
  isPasswordRecovery: boolean;
  login: (email: string, password: string) => Promise<{ error: Error | null }>;
  signup: (email: string, password: string, metadata?: { display_name?: string; company?: string }) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Fetch user profile and role from database
  const fetchUserData = useCallback(async (supabaseUser: SupabaseUser) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, display_name, first_name, last_name, avatar_url, company, job_title')
        .eq('id', supabaseUser.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      // Fetch role (prefer SECURITY DEFINER function to avoid RLS visibility issues)
      let userRole: UserRole = 'viewer';
      try {
        const { data: roleValue, error: roleRpcError } = await supabase.rpc('get_user_role', {
          _user_id: supabaseUser.id,
        });

        if (roleRpcError) {
          // Fall back to direct select (older DBs / missing RPC)
          const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', supabaseUser.id)
            .limit(1)
            .maybeSingle();

          if (roleError && roleError.code !== 'PGRST116') {
            console.error('Error fetching role (fallback):', roleError);
          }

          userRole = (roleData?.role as UserRole) || 'viewer';
        } else {
          userRole = (roleValue as UserRole) || 'viewer';
        }
      } catch (e) {
        console.error('Error resolving role:', e);
      }

      const userProfile: UserProfile | null = profileData || null;

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
        
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        }
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
  

  const updatePassword = useCallback(async (password: string) => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase not configured') };
    }
    
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);
    
    if (!error) {
      setIsPasswordRecovery(false); // Chiudiamo la modalità recupero
    }
    
    return { error: error ? new Error(error.message) : null };
  }, []);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin' || user?.role === 'superuser';
  const isSuperuser = user?.role === 'superuser';

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      isLoading,
      isAuthenticated,
      isAdmin,
      isSuperuser,
      isPasswordRecovery, // <-- AGGIUNGI AL PROVIDER
      login,
      signup,
      logout,
      updateProfile,
      updatePassword,     // <-- AGGIUNGI AL PROVIDER
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
