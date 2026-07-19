import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { Navigate } from "react-router";

interface AuthState {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  user: { id: string; email: string; displayName: string } | null;
  getAccessToken: () => string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "fb-store-auth";

function persist(state: AuthState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load(): AuthState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

function clear(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState | null>(load);
  const [user, setUser] = useState<AuthContextValue["user"]>(null);

  const getAccessToken = useCallback((): string | null => {
    return authState?.accessToken ?? null;
  }, [authState]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || "Login failed");
    }
    const data: AuthState = await res.json();
    setAuthState(data);
    persist(data);

    const meRes = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${data.accessToken}` },
    });
    if (meRes.ok) {
      const meData = await meRes.json();
      setUser(meData.data);
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!authState?.refreshToken) return false;
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: authState.refreshToken }),
      });
      if (!res.ok) {
        clear();
        setAuthState(null);
        setUser(null);
        return false;
      }
      const data: AuthState = await res.json();
      setAuthState(data);
      persist(data);
      return true;
    } catch {
      clear();
      setAuthState(null);
      setUser(null);
      return false;
    }
  }, [authState]);

  const logout = useCallback(async () => {
    if (authState?.accessToken) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${authState.accessToken}` },
        });
      } catch {
        // ignore network errors
      }
    }
    clear();
    setAuthState(null);
    setUser(null);
  }, [authState]);

  // Auto-refresh on mount if we have stored tokens
  useEffect(() => {
    if (authState && !user) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${authState.accessToken}` },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setUser(d.data))
        .catch(() => {
          // If /me fails, try refresh
          refreshSession().then((ok) => {
            if (!ok) {
              clear();
              setAuthState(null);
            }
          });
        });
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!authState,
        user,
        getAccessToken,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
