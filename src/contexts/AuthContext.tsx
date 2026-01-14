import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User, UserRole } from '@/lib/types/admin';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperuser: boolean;
  login: (email: string, role?: UserRole) => void;
  logout: () => void;
  setRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for development
const mockUsers: Record<string, User> = {
  admin: {
    id: 'user-admin-1',
    email: 'admin@fgb.com',
    name: 'Admin User',
    role: 'admin',
  },
  superuser: {
    id: 'user-super-1',
    email: 'superuser@fgb.com',
    name: 'Super User',
    role: 'superuser',
  },
  editor: {
    id: 'user-editor-1',
    email: 'editor@fgb.com',
    name: 'Editor User',
    role: 'editor',
  },
  viewer: {
    id: 'user-viewer-1',
    email: 'viewer@fgb.com',
    name: 'Viewer User',
    role: 'viewer',
  },
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback((email: string, role: UserRole = 'viewer') => {
    // Mock login - find user by role or create new
    const existingUser = Object.values(mockUsers).find(u => u.email === email);
    if (existingUser) {
      setUser(existingUser);
    } else {
      setUser({
        id: `user-${Date.now()}`,
        email,
        name: email.split('@')[0],
        role,
      });
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const setRole = useCallback((role: UserRole) => {
    if (user) {
      setUser({ ...user, role });
    }
  }, [user]);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin' || user?.role === 'superuser';
  const isSuperuser = user?.role === 'superuser';

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isAdmin,
      isSuperuser,
      login,
      logout,
      setRole,
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

export { mockUsers };
