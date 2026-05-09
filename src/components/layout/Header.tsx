import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, Sun, Moon, X, Eye, EyeOff,
  UserRound, Mail, ShieldCheck, Lock, RefreshCw, Check,
  Settings, ArrowLeft,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authAdminApi } from '../../services/auth.admin';
import { toast } from 'sonner';

// ── Helpers ────────────────────────────────────────────────────────────────

const formatRole = (role: string) =>
  role.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ');

// ── Data Row ───────────────────────────────────────────────────────────────

const DataRow = ({
  icon: Icon,
  label,
  value,
  iconColor = 'text-emerald-500',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor?: string;
}) => (
  <div className="flex items-center gap-3 bg-surface rounded-md px-4 py-3 border border-divider">
    <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted mb-0.5">
        {label}
      </p>
      <p className="text-sm font-bold text-text truncate">
        {value}
      </p>
    </div>
  </div>
);

// ── MyProfile Modal ────────────────────────────────────────────────────────

const MyProfileModal = ({ onClose }: { onClose: () => void }) => {
  const { user, updateUserLocal } = useAuth();
  const [isEditing, setIsEditing] = useState(false);

  const [email,    setEmail]    = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  const displayName = user?.fullName || user?.username || '—';
  const rolLabel    = user?.roles?.[0] ? formatRole(user.roles[0]) : 'Sin rol asignado';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (email !== (user?.email ?? '')) payload.Email = email;
      if (password.trim())               payload.NewPassword = password;

      if (Object.keys(payload).length === 0) {
        toast.info('No hay cambios para guardar.');
        setSaving(false);
        return;
      }

      const res = await authAdminApi.updateSelfProfile(payload);
      toast.success(res.message ?? 'Perfil actualizado correctamente.');

      if (res.updatedUser) {
        updateUserLocal({ email: res.updatedUser.email });
      }

      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al actualizar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'bg-surface border border-divider ' +
    'rounded-md px-4 py-3 text-sm font-semibold text-text ' +
    'outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ' +
    'placeholder:text-muted transition-all w-full';

  const modal = (
    // ── Overlay: fixed sobre el VIEWPORT, no sobre el Header ──────────────
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      {/* ── Card ──────────────────────────────────────────────────────── */}
      <motion.div
        className="relative w-full max-w-md bg-card rounded-md shadow-2xl overflow-hidden border border-divider"
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        onClick={e => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">

          {/* ── VIEW MODE ──────────────────────────────────────────────── */}
          {!isEditing && (
            <motion.div
              key="view"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.16 }}
            >
              {/* Close */}
              <div className="flex justify-end px-6 pt-5 pb-0">
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md text-muted hover:text-text hover:bg-surface transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── SECCIÓN IDENTIDAD ─────────────────────────────────── */}
              <div className="flex flex-col items-center gap-3 px-8 pt-3 pb-5">
                <div className="w-20 h-20 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                  {initials}
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-black text-text leading-tight">
                    {displayName}
                  </h2>
                  <span className="inline-block mt-2 px-3 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
                    {rolLabel}
                  </span>
                </div>
              </div>

              {/* ── SECCIÓN CONTACTO ──────────────────────────────────── */}
              <div className="px-8 pb-2">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted mb-2 ml-1">
                  Contacto
                </p>
                <DataRow
                  icon={Mail}
                  label="Correo Electrónico"
                  value={user?.email || '—'}
                />
              </div>

              {/* ── SECCIÓN SISTEMA ───────────────────────────────────── */}
              <div className="px-8 pt-4 pb-6">
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted mb-2 ml-1">
                  Sistema
                </p>
                <div className="flex flex-col gap-2">
                  <DataRow
                    icon={UserRound}
                    label="Nombre de Usuario"
                    value={`@${user?.username ?? '—'}`}
                    iconColor="text-muted"
                  />
                  <DataRow
                    icon={ShieldCheck}
                    label="Rol de Sistema"
                    value={rolLabel}
                  />
                </div>
              </div>

              {/* ── GESTIONAR CUENTA ──────────────────────────────────── */}
              <div className="px-8 pb-8 border-t border-divider pt-5">
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:brightness-110 active:scale-[0.98] text-white px-5 py-3 rounded-md text-sm font-black uppercase tracking-wider transition-all shadow-lg shadow-primary/25"
                >
                  <Settings className="w-4 h-4" />
                  Gestionar Cuenta
                </button>
              </div>
            </motion.div>
          )}

          {/* ── EDIT MODE ──────────────────────────────────────────────── */}
          {isEditing && (
            <motion.div
              key="edit"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.16 }}
            >
              {/* Header barra */}
              <div className="flex items-center justify-between px-8 pt-6 pb-4 border-b border-divider">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1.5 text-xs font-black text-muted hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Volver a la Ficha
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-md text-muted hover:text-text hover:bg-surface transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Título */}
              <div className="px-8 pt-5 pb-1">
                <div className="flex items-center gap-2 mb-1">
                  <Settings className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-black text-text uppercase tracking-widest">
                    Gestionar Cuenta
                  </h3>
                </div>
                <p className="text-xs text-muted">
                  Actualiza tu email o contraseña de acceso.
                </p>
              </div>

              {/* Formulario */}
              <form onSubmit={handleSubmit} className="px-8 pb-8 flex flex-col gap-4 mt-5">

                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                    <Mail className="w-3 h-3 text-primary" />
                    Cambiar Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nuevo@correo.com"
                    className={inputCls}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted">
                    <Lock className="w-3 h-3 text-primary" />
                    Nueva Contraseña
                    <span className="ml-1 text-[9px] font-bold text-muted normal-case tracking-normal">
                      (vacío = sin cambio)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      minLength={password ? 8 : undefined}
                      className={`${inputCls} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
                      tabIndex={-1}
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3 mt-1 border-t border-divider">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 px-5 py-2.5 bg-surface hover:bg-background text-text rounded-md text-xs font-black uppercase tracking-wider transition-all border border-divider"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary hover:brightness-110 active:scale-95 disabled:opacity-50 text-white px-5 py-2.5 rounded-md text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-primary/25"
                  >
                    {saving
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Check className="w-3.5 h-3.5" />
                    }
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </motion.div>
  );

  // Portal: el modal se monta en document.body, fuera del stacking context del Header
  return ReactDOM.createPortal(modal, document.body);
};

// ── User Widget ────────────────────────────────────────────────────────────

const UserWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const displayName = user.fullName || user.username;
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-md border border-transparent hover:border-primary/30 hover:bg-primary/5 transition-all group"
        title="Mi Perfil"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-xs font-black shadow-sm flex-shrink-0">
          {initials}
        </div>
        <div className="flex flex-col items-start leading-tight">
          <span className="text-xs font-black text-text group-hover:text-primary transition-colors truncate max-w-[120px]">
            {displayName}
          </span>
          <span className="text-[9px] font-bold text-muted uppercase tracking-widest">
            Mi Perfil
          </span>
        </div>
      </button>

      {/* Portal montado FUERA del Header para evitar el stacking context de backdrop-blur */}
      <AnimatePresence>
        {open && <MyProfileModal onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  );
};

// ── Header ─────────────────────────────────────────────────────────────────

export const Header = () => {
  const { theme, setTheme, mode, setMode } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toUpperCase();
        if (term.startsWith('EMP-')) {
          navigate(`/empleados?q=${encodeURIComponent(term.replace('EMP-', ''))}`);
        } else if (
          term.startsWith('DSP-') ||
          (term.includes('-') && !term.startsWith('COMP-') && !term.startsWith('PAR-')) ||
          /^\d{1,4}$/.test(term)
        ) {
          navigate(`/logistica/monitor?q=${encodeURIComponent(term)}`);
        } else if (term.startsWith('COMP-') || term.startsWith('PAR-') || /^\d{5,}$/.test(term)) {
          navigate(`/pagos?q=${encodeURIComponent(term)}`);
        } else {
          navigate(`/inventario/productos?q=${encodeURIComponent(searchTerm)}`);
        }
      } else {
        navigate(`/inventario/productos`);
      }
    }
  };

  return (
    <header className="h-16 fixed top-0 right-0 left-64 bg-background/95 backdrop-blur-md border-b border-divider z-10 flex items-center justify-between px-6 transition-colors duration-300">

      {/* Search */}
      <div className="flex items-center bg-surface rounded-md px-4 py-2.5 w-[440px] border border-divider focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <Search className="h-5 w-5 text-primary" />
        <input
          type="text"
          placeholder="Buscador global: Enter para buscar Productos..."
          className="bg-transparent border-none outline-none ml-2 w-full text-sm text-text font-bold placeholder-gray-500"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyDown={handleSearch}
        />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <UserWidget />

        <div className="w-px h-6 bg-divider" />

        <select
          className="bg-primary/10 text-primary border-none rounded-md px-3 py-1 font-semibold outline-none cursor-pointer"
          value={theme}
          onChange={e => setTheme(e.target.value as any)}
        >
          <option value="ninos">Tema: Niños</option>
          <option value="jovenes">Tema: Jóvenes</option>
          <option value="adultos">Tema: Adultos</option>
        </select>

        <button
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          {mode === 'dark'
            ? <Sun className="h-5 w-5 text-secondary" />
            : <Moon className="h-5 w-5 text-secondary" />
          }
        </button>
      </div>
    </header>
  );
};
