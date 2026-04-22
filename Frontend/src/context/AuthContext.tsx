import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '../types';
import { authApi } from '../api/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** The backend uses user_id / full_name — normalise to our User shape */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseUser(raw: any): User {
  return {
    id:            raw.id        ?? raw.user_id,
    name:          raw.name      ?? raw.full_name,
    email:         raw.email,
    phone:         raw.phone     ?? undefined,
    role:          raw.role,
    avatar_url:    raw.avatar_url ?? undefined,
    loyalty_points: raw.loyalty_points ?? undefined,
    loyalty_tier:  raw.loyalty_tier   ?? undefined,
    is_verified:   raw.is_verified    ?? undefined,
    created_at:    raw.created_at     ?? undefined,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<User | null>(null);
  const [token, setToken]       = useState<string | null>(() => localStorage.getItem('fg_token'));
  const [isLoading, setLoading] = useState(true);

  // Handle Google OAuth redirect — ?token=xxx
  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('fg_token', urlToken);
      setToken(urlToken);
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    } else {
      setLoading(false);
    }
  }, []);

  // Hydrate user from token
  useEffect(() => {
    if (!token) { 
      setLoading(false);
      return; 
    }
    authApi.me()
      .then(u => setUser(normaliseUser(u)))
      .catch(() => {
        localStorage.removeItem('fg_token');
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password) as { token: string; user: unknown };
    localStorage.setItem('fg_token', res.token);
    setToken(res.token);
    setUser(normaliseUser(res.user));
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('fg_token');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((u: User) => setUser(u), []);

  const value = useMemo(
    () => ({ user, token, isLoading, login, logout, updateUser }),
    [user, token, isLoading, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const AuthContextValue = AuthContext;
