'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize and check JWT on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('techbes_token');
        if (storedToken) {
          setToken(storedToken);
          const response = await api.get('/auth/me');
          if (response.data?.success) {
            setUser(response.data.data.user || response.data.data);
          } else {
            // fallback if response format is different
            setUser(response.data.user || response.data);
          }
        }
      } catch (err) {
        console.error('Failed to restore auth session:', err);
        localStorage.removeItem('techbes_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const data = response.data.data || response.data;
      const { token: receivedToken, user: receivedUser } = data;

      localStorage.setItem('techbes_token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/register', { name, email, password });
      const data = response.data.data || response.data;
      const { token: receivedToken, user: receivedUser } = data;

      localStorage.setItem('techbes_token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Registration failed. Email might be in use.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('techbes_token');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  const updateUser = (updatedUser: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updatedUser });
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
