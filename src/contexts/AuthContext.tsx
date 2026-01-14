import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User, UserRole } from '@/lib/types/admin';

interface AuthContextType {
  user: User | null;
  users: User[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperuser: boolean;
  login: (email: string, role?: UserRole) => void;
  logout: () => void;
  setRole: (role: UserRole) => void;
  addUser: (userData: Omit<User, 'id'>) => User;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initial mock users for development
const initialMockUsers: User[] = [
  {
    id: 'user-admin-1',
    email: 'admin@fgb.com',
    name: 'Admin User',
    role: 'admin',
  },
  {
    id: 'user-super-1',
    email: 'superuser@fgb.com',
    name: 'Super User',
    role: 'superuser',
  },
  {
    id: 'user-editor-1',
    email: 'editor@fgb.com',
    name: 'Editor User',
    role: 'editor',
  },
  {
    id: 'user-viewer-1',
    email: 'viewer@fgb.com',
    name: 'Viewer User',
    role: 'viewer',
  },
];

const generateId = () => `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(initialMockUsers);

  const login = useCallback((email: string, role: UserRole = 'viewer') => {
    // Mock login - find user by email
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

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const setRole = useCallback((role: UserRole) => {
    if (user) {
      const updatedUser = { ...user, role };
      setUser(updatedUser);
      setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    }
  }, [user]);

  const addUser = useCallback((userData: Omit<User, 'id'>): User => {
    const newUser: User = {
      ...userData,
      id: generateId(),
    };
    setUsers(prev => [...prev, newUser]);
    return newUser;
  }, []);

  const updateUser = useCallback((id: string, data: Partial<User>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    // Update current user if it's the same
    if (user?.id === id) {
      setUser(prev => prev ? { ...prev, ...data } : null);
    }
  }, [user]);

  const deleteUser = useCallback((id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    // Logout if current user is deleted
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
      users,
      isAuthenticated,
      isAdmin,
      isSuperuser,
      login,
      logout,
      setRole,
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

// Export users for backward compatibility
export const mockUsers = initialMockUsers.reduce((acc, user) => {
  acc[user.role] = user;
  return acc;
}, {} as Record<string, User>);
