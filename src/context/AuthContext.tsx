import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  email?: string;
  fullName?: string;
  roles: string[];
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loginState: (token: string, userData: User) => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
  hasPermission: (mod: string) => boolean;
  updatePermissionsLocal: () => Promise<void>;
  updateUserLocal: (updates: Partial<User>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem('access_token');
      const storedUser  = localStorage.getItem('user_data');

      if (!storedToken || !storedUser) {
        setIsLoading(false);
        return;
      }

      // Intentar siempre refrescar el token al cargar la app.
      // Garantiza que los strings de permisos del JWT coincidan con la DB actual
      // (evita que tokens viejos con typos sigan activos tras una corrección de datos).
      try {
        const res = await fetch('http://localhost:3000/auth/refresh', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setToken(data.access_token);
          setUser(data.user);
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('user_data', JSON.stringify(data.user));
          setIsLoading(false);
          return;
        }
      } catch {
        // Servidor no disponible — usar sesión cacheada como respaldo
      }

      // Fallback: usar lo que hay en localStorage si el refresh falló
      const parsedUser = JSON.parse(storedUser);
      if (!parsedUser.permissions?.length) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_data');
        setIsLoading(false);
        return;
      }

      setToken(storedToken);
      setUser(parsedUser);
      setIsLoading(false);
    };

    init();
  }, []);

  // Refresca el token silenciosamente cuando la ventana recupera el foco.
  // Detecta cambios de permisos aplicados por el admin sin forzar logout.
  useEffect(() => {
    const handleFocus = async () => {
      const storedToken = localStorage.getItem('access_token');
      if (!storedToken) return;
      try {
        const res = await fetch('http://localhost:3000/auth/refresh', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const currentUser = localStorage.getItem('user_data');
        const oldPerms = JSON.stringify(JSON.parse(currentUser || '{}').permissions?.slice().sort() ?? []);
        const newPerms = JSON.stringify((data.user.permissions ?? []).slice().sort());
        if (oldPerms !== newPerms) {
          // Los permisos cambiaron — actualiza estado y token silenciosamente
          setToken(data.access_token);
          setUser(data.user);
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('user_data', JSON.stringify(data.user));
        }
      } catch {
        // fallo silencioso — no interrumpir la sesión
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loginState = (newToken: string, userData: User) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem('access_token', newToken);
    localStorage.setItem('user_data', JSON.stringify(userData));
  };

  const updateUserLocal = (updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem('user_data', JSON.stringify(updated));
      return updated;
    });
  };

  const updatePermissionsLocal = async () => {
     try {
        const locallyStoredToken = localStorage.getItem('access_token');
        if (!locallyStoredToken) return;
        const response = await fetch('http://localhost:3000/auth/refresh', {
           headers: { Authorization: `Bearer ${locallyStoredToken}` }
        });
        if (response.ok) {
           const resMap = await response.json();
           loginState(resMap.access_token, resMap.user);
        }
     } catch (e) {
        console.error('Error sincronizando identidad local');
     }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_data');
    window.location.href = '/login';
  };

  const hasRole = (role: string) => {
    return user?.roles?.includes(role) || false;
  };

  const hasPermission = (mod: string): boolean => {
    if (!user?.permissions?.length) return false;
    return user.permissions.includes(mod);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{
          width: 40,
          height: 40,
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, loginState, logout, hasRole, hasPermission, updatePermissionsLocal, updateUserLocal, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
