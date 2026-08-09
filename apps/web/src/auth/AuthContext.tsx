import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../api/client';
import { ApiError } from '../api/types';
import type { User } from '../api/types';

type AuthState = {
  user: User | null;
  loading: boolean;
  needsSignup: boolean | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSignup, setNeedsSignup] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const setup = await api.setup();
      setNeedsSignup(setup.needsSignup);
    } catch {
      setNeedsSignup(null);
    }

    try {
      const me = await api.me();
      if (me.id && me.email) {
        setUser({ id: me.id, email: me.email });
        setNeedsSignup(false);
      } else {
        setUser(null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.login(email, password);
    setUser(u);
    setNeedsSignup(false);
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const u = await api.signup(email, password);
    setUser(u);
    setNeedsSignup(false);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    try {
      const setup = await api.setup();
      setNeedsSignup(setup.needsSignup);
    } catch {
      setNeedsSignup(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, needsSignup, login, signup, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
