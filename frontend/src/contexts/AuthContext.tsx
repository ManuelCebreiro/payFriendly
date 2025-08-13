import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { authApi, setAuthToken, removeAuthToken, getAuthToken } from '@/lib/api';
// Note: We'll use the toast system from the component that uses this context
import { useRouter } from 'next/router';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check if user is authenticated on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          await refreshUser();
        } catch (error) {
          // Token is invalid, remove it
          removeAuthToken();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      const { access_token } = response.data;
      
      setAuthToken(access_token);
      await refreshUser();
      
      router.push('/dashboard');
    } catch (error: any) {
      // Error handling will be done by the component using this context
      throw error;
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    try {
      await authApi.register({ email, password, full_name: fullName });
      
      // Auto login after registration
      await login(email, password);
      
      // Success handling will be done by the component using this context
    } catch (error: any) {
      // Error handling will be done by the component using this context
      throw error;
    }
  };

  const logout = () => {
    removeAuthToken();
    setUser(null);
    router.push('/login');
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.getProfile();
      setUser(response.data);
    } catch (error) {
      removeAuthToken();
      setUser(null);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;