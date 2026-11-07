import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthResponse, LoginInput, Permission, SessionUser } from '@cdms/contracts';
import { api, refreshSession, tokenStore } from './api';
import { applyLocale } from './i18n';
import { queryClient } from './query';

interface AuthState {
  user: SessionUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: SessionUser) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  useEffect(() => {
    tokenStore.onChange((auth) => {
      setUser(auth?.user ?? null);
      setStatus(auth ? 'authenticated' : 'anonymous');
    });
    void refreshSession();
  }, []);

  // Refresh the access token shortly before it expires.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const id = setInterval(() => void refreshSession(), 10 * 60_000);
    return () => clearInterval(id);
  }, [status]);

  const login = useCallback(async (input: LoginInput) => {
    const auth = await api.post<AuthResponse>('/auth/login', input);
    tokenStore.set(auth.accessToken);
    applyLocale(auth.user.locale);
    setUser(auth.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      tokenStore.set(null);
      queryClient.clear();
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout, setUser }),
    [user, status, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Permission check for UI affordances only (hide/disable buttons). The backend enforces
 * every permission again — never rely on this for security.
 */
export function useCan() {
  const { user } = useAuth();
  return useCallback(
    (...perms: Permission[]) => !!user && perms.every((p) => user.permissions.includes(p)),
    [user],
  );
}
