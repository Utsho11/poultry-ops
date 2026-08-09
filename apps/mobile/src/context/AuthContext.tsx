import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setActiveFarmIdMemory } from '../config';

export interface AuthUser {
  userId: string;
  farmId?: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'owner' | 'manager' | 'worker';
  farmName?: string;
  animalType?: 'poultry' | 'layer' | 'broiler';
}

export interface IFirm {
  _id: string;
  name: string;
  animalType: 'poultry' | 'layer' | 'broiler';
  date?: string;
  location?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  farms: IFirm[];
  activeFarm: IFirm | null;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  switchFarm: (farm: IFirm, token?: string) => Promise<void>;
  updateUser: (newUser: AuthUser) => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [farms, setFarms] = useState<IFirm[]>([]);
  const [activeFarm, setActiveFarm] = useState<IFirm | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActiveFarmIdMemory(activeFarm?._id || null);
  }, [activeFarm]);

  useEffect(() => {
    // Restore session on app start
    const restoreSession = async () => {
      try {
        const savedToken = await SecureStore.getItemAsync('poultry_token');
        const savedUser = await SecureStore.getItemAsync('poultry_user');
        const savedFarm = await SecureStore.getItemAsync('poultry_active_farm');
        if (savedToken && savedUser) {
          setToken(savedToken);
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          // Always show firm list on app startup when logged in
          setActiveFarm(null);
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    setActiveFarm(null);
    await SecureStore.setItemAsync('poultry_token', newToken);
    await SecureStore.setItemAsync('poultry_user', JSON.stringify(newUser));
    await SecureStore.deleteItemAsync('poultry_active_farm');
  };

  const switchFarm = async (farm: IFirm, newToken?: string) => {
    setActiveFarm(farm);
    await SecureStore.setItemAsync('poultry_active_farm', JSON.stringify(farm));

    if (newToken) {
      setToken(newToken);
      await SecureStore.setItemAsync('poultry_token', newToken);
    }

    if (user) {
      const updatedUser: AuthUser = {
        ...user,
        farmId: farm._id,
        farmName: farm.name,
        animalType: farm.animalType
      };
      setUser(updatedUser);
      await SecureStore.setItemAsync('poultry_user', JSON.stringify(updatedUser));
    }
  };

  const updateUser = async (newUser: AuthUser) => {
    setUser(newUser);
    await SecureStore.setItemAsync('poultry_user', JSON.stringify(newUser));
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    setActiveFarm(null);
    setFarms([]);
    await SecureStore.deleteItemAsync('poultry_token');
    await SecureStore.deleteItemAsync('poultry_user');
    await SecureStore.deleteItemAsync('poultry_active_farm');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        farms,
        activeFarm,
        login,
        logout,
        switchFarm,
        updateUser,
        isAuthenticated: !!token,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
