import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogIn, User, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'sonner';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { loginState } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.warning('Por favor, ingresa tu usuario y contraseña (Obligatorio).');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Backend request a NestJS
      const res = await api.post('/auth/login', { UserName: username, Password: password });
      
      const { access_token, user } = res.data;
      
      // Persistir contexto
      loginState(access_token, user);
      
      // Redireccionar al portal seguro
      toast.success('Sesión validada exitosamente');
      navigate('/');
    } catch (err: any) {
      console.error(err);
      // Consume el throw HTTP (401 o 403) devuelto por NestJS (Bloqueos, intentos)
      const msg = err.response?.data?.message || 'Error de comunicación con el sistema central.';
      toast.error('Contraseña inválida', { description: msg, icon: <ShieldAlert className="w-4 h-4 text-red-500" /> });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative p-4 transition-colors duration-300">
      
      <div className="absolute top-10 left-10">
        <h1 className="text-3xl font-black text-primary tracking-widest drop-shadow-md">PARADISO</h1>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-black/80 backdrop-blur-3xl rounded-[2rem] p-8 border border-black/10 dark:border-white/10 shadow-2xl relative z-10 transition-colors">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-5 border border-primary/20">
            <LogIn className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-text">Acceso Restringido</h2>
          <p className="text-sm opacity-60 mt-1 max-w-[250px] text-center font-medium">Ingresa tus credenciales para administrar el centro logístico</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-start gap-3 transition-all animate-pulse">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-semibold leading-relaxed tracking-wide">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-primary">
               <User className="w-5 h-5 text-gray-400 group-focus-within:text-primary" />
             </div>
             <input 
               type="text"
               className="w-full bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary text-text font-medium rounded-xl py-4 pl-12 pr-4 outline-none transition-colors duration-200"
               placeholder="Nombre de usuario"
               value={username}
               onChange={e => setUsername(e.target.value)}
             />
          </div>

          <div className="relative group">
             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
               <Lock className="w-5 h-5 text-gray-400 group-focus-within:text-primary transition-colors" />
             </div>
             <input 
               type="password"
               className="w-full bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary text-text font-medium rounded-xl py-4 pl-12 pr-4 outline-none transition-colors duration-200"
               placeholder="Contraseña criptográfica"
               value={password}
               onChange={e => setPassword(e.target.value)}
             />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:brightness-110 active:scale-95 text-white font-bold py-4 rounded-xl transition duration-200 shadow-[0_0_20px_rgba(var(--color-primary),0.3)] disabled:opacity-50 mt-4 uppercase tracking-widest text-sm"
          >
            {loading ? 'Validando Seguridad...' : 'Autenticar Sesión'}
          </button>
        </form>
      </div>

       {/* Decorativos Orgánicos (Efecto Glass UI Glow) */}
       <div className="absolute bottom-10 -right-20 w-[600px] h-[600px] bg-primary/20 blur-[120px] rounded-full z-0 opacity-60"></div>
       <div className="absolute -top-32 -left-20 w-[500px] h-[500px] bg-secondary/20 blur-[100px] rounded-full z-0 opacity-60"></div>
    </div>
  );
};
