'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI, handleAPIError } from '@/services/api';

interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'senior_analyst' | 'analyst' | 'viewer';
  department?: string;
  isActive: boolean;
  lastLogin?: string;
  performance?: {
    totalCasesAssigned: number;
    totalCasesResolved: number;
    avgResolutionTime: number;
    currentCaseLoad: number;
    overdueCases: number;
    rating: number;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  department?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check if user is already logged in on app start
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          
          // Verify token is still valid by fetching current user data
          try {
            const response = await authAPI.getCurrentUser();
            if (response.success) {
              setUser(response.data);
              // Update stored user data
              localStorage.setItem('user', JSON.stringify(response.data));
            }
          } catch {
            // Token is invalid, clear storage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          }
        }
      } catch {
        // Error during initialization, clear storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const response = await authAPI.login(email, password);
      
      if (response.success) {
        setToken(response.token);
        setUser(response.user);
        // Token and user are already stored in localStorage by authAPI
      } else {
        throw new Error(response.error?.message || 'Login failed');
      }
      
    } catch (error) {
      console.error('Login error:', error);
      const apiError = handleAPIError(error);
      throw new Error(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterData) => {
    try {
      setIsLoading(true);
      
      const response = await authAPI.register(userData);
      
      if (response.success) {
        setToken(response.token);
        setUser(response.user);
        // Token and user are already stored in localStorage by authAPI
      } else {
        throw new Error(response.error?.message || 'Registration failed');
      }
      
    } catch (error) {
      console.error('Registration error:', error);
      const apiError = handleAPIError(error);
      throw new Error(apiError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setToken(null);
      router.push('/auth/login');
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const updateProfile = async (userData: Partial<User>) => {
    try {
      const response = await authAPI.updateProfile(userData);
      
      if (response.success) {
        setUser(response.data);
        // User data is already updated in localStorage by authAPI
      } else {
        throw new Error(response.error?.message || 'Profile update failed');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      const apiError = handleAPIError(error);
      throw new Error(apiError.message);
    }
  };

  const updatePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const response = await authAPI.updatePassword(currentPassword, newPassword);
      
      if (response.success) {
        // Password updated successfully, token is refreshed
        setToken(response.token);
        setUser(response.user);
      } else {
        throw new Error(response.error?.message || 'Password update failed');
      }
    } catch (error) {
      console.error('Password update error:', error);
      const apiError = handleAPIError(error);
      throw new Error(apiError.message);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    updateUser,
    updateProfile,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}