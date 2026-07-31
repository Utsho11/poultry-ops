import React, { createContext, useContext, useState, useEffect } from 'react';
import { IAuthUser } from '@poultry-ops/types';

interface AuthContextType {
  user: IAuthUser | null;
  token: string | null;
  login: (token: string, user: IAuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IAuthUser | null>(() => {
    const savedUser = localStorage.getItem('poultry_ops_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('poultry_ops_token') || null;
  });

  const login = (newToken: string, newUser: IAuthUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('poultry_ops_token', newToken);
    localStorage.setItem('poultry_ops_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('poultry_ops_token');
    localStorage.removeItem('poultry_ops_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
