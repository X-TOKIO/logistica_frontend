import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { authAdminApi } from '../../services/auth.admin';
import {
  UserCog, Search, LockOpen, LockKeyhole, ShieldOff,
  ShieldCheck, Clock, X, RefreshCw, UserX, Pencil, Eye, EyeOff,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type Usuario = {
  ID_Usuario: number;
  UserName: string;
  Email: string;
  Estado: string;
  intentosFallidos: number;
  bloqueadoHasta: string | null;
  ultimoLogin: string | null;
  empleado?: { Nombre: string; Paterno: string; Materno?: string; Cargo?: string };
};

type Rol = { ID_Rol: number; Nombre: string };

// ── Helpers ────────────────────────────────────────────────────────────────

const estadoBadge = (estado: string) => {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    ACTIVO:               { label: 'Activo',             cls: 'bg-green-500/10 text-green-500 border-green-500/20',  icon: <ShieldCheck className="w-3 h-3" /> },
    BLOQUEADO:            { label: 'Bloqueado temp.',     cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20',  icon: <Clock className="w-3 h-3" /> },
    BLOQUEADO_PERMANENTE: { label: 'Bloqueado perm.',     cls: 'bg-red-500/10 text-red-500 border-red-500/20',        icon: <LockKeyhole className="w-3 h-3" /> },
    INACTIVO:             { label: 'Inactivo',            cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20',  icon: <UserX className="w-3 h-3" /> },
    SISTEMA:              { label: 'Sistema',             cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: <ShieldOff className="w-3 h-3" /> },
  };
  const cfg = map[estado] ?? { label: estado, cls: 'bg-black/10 text-text border-black/10', icon: null };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
};

// ── Edit Modal ─────────────────────────────────────────────────────────────

type EditProps = { user: Usuario; roles: Rol[]; onClose: () => void; onSaved: () => void };

const EditModal = ({ user, roles, onClose, onSaved }: EditProps) => {
  const [nombre,   setNombre]   = useState(user.empleado?.Nombre ?? '');
  const [paterno,  setPaterno]  = useState(user.empleado?.Paterno ?? '');
  const [email,    setEmail]    = useState(user.Email);
  const [idRol,    setIdRol]    = useState<number | ''>('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (nombre  !== (user.empleado?.Nombre  ?? '')) payload.Nombre  = nombre;
      if (paterno !== (user.empleado?.Paterno ?? '')) payload.Paterno = paterno;
      if (email   !== user.Email)                     payload.Email   = email;
      if (idRol !== '')                               payload.ID_Rol  = Number(idRol);
      if (password.trim())                            payload.NewPassword = password;

      if (Object.keys(payload).length === 0) {
        toast.info('No hay cambios para guardar.');
        setSaving(false);
        return;
      }

      const res = await authAdminApi.updateUsuario(user.ID_Usuario, payload);
      toast.success(res.message ?? 'Usuario actualizado correctamente.');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al actualizar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{label}</label>
      {children}
    </div>
  );

  const inputCls = 'bg-black/5 dark:bg-slate-800 border border-black/10 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm font-bold text-text dark:text-gray-200 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all w-full';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-card rounded-3xl w-full max-w-lg shadow-2xl border border-divider overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-8 pt-7 pb-5 border-b border-black/8 dark:border-slate-700 bg-black/2 dark:bg-white/2 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 mb-0.5">Editar cuenta</p>
            <h3 className="text-lg font-black text-text dark:text-gray-100">@{user.UserName}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/8 dark:hover:bg-white/8 text-text opacity-40 hover:opacity-80 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre">
              <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre" className={inputCls} />
            </Field>
            <Field label="Apellido">
              <input value={paterno} onChange={e => setPaterno(e.target.value)} placeholder="Apellido" className={inputCls} />
            </Field>
          </div>

          <Field label="Email">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className={inputCls} />
          </Field>

          <Field label="Rol">
            <select value={idRol} onChange={e => setIdRol(e.target.value === '' ? '' : Number(e.target.value))} className={inputCls}>
              <option value="">— Sin cambiar rol —</option>
              {roles.map(r => (
                <option key={r.ID_Rol} value={r.ID_Rol}>{r.Nombre}</option>
              ))}
            </select>
          </Field>

          <Field label="Nueva contraseña (dejar vacío para no cambiar)">
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className={`${inputCls} pr-12`}
                minLength={password ? 8 : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text opacity-40 hover:opacity-80 transition-opacity"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          <p className="text-[10px] font-bold opacity-30 mt-1">
            La contraseña actual nunca se muestra. Si se deja en blanco, permanece sin cambios.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-black/8 dark:border-slate-700 mt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-black/6 dark:bg-slate-800 hover:bg-black/12 dark:hover:bg-slate-700 text-text dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Detail Modal ───────────────────────────────────────────────────────────

type DetailProps = { user: Usuario; onClose: () => void; onUnlock: (u: Usuario) => void; onDeactivate: (u: Usuario) => void };

const DetailModal = ({ user, onClose, onUnlock, onDeactivate }: DetailProps) => {
  const fullName = [user.empleado?.Paterno, user.empleado?.Materno, user.empleado?.Nombre].filter(Boolean).join(' ');
  const initials = [(user.empleado?.Paterno ?? '')[0], (user.empleado?.Nombre ?? '')[0]].join('').toUpperCase() || user.UserName[0].toUpperCase();
  const isBlocked = user.Estado === 'BLOQUEADO' || user.Estado === 'BLOQUEADO_PERMANENTE';

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex flex-col gap-1">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30">{label}</p>
      <p className="text-sm font-bold text-text dark:text-gray-200">{value || '—'}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-card rounded-3xl w-full max-w-md shadow-2xl border border-divider overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 border-b border-black/8 dark:border-slate-700 bg-black/2 dark:bg-white/2">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-xl font-black shadow-lg flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 mb-1">Cuenta de Sistema</p>
              <h3 className="text-xl font-black text-text dark:text-gray-100 leading-tight">@{user.UserName}</h3>
              <div className="mt-1.5">{estadoBadge(user.Estado)}</div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/8 dark:hover:bg-white/8 text-text opacity-40 hover:opacity-80 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 grid grid-cols-2 gap-5">
          <div className="col-span-2">
            <Field label="Empleado" value={fullName || '—'} />
          </div>
          <Field label="Email" value={<span className="text-xs break-all">{user.Email}</span>} />
          <Field label="Cargo" value={user.empleado?.Cargo || '—'} />
          <Field label="Último Login" value={fmtDate(user.ultimoLogin)} />
          <Field label="Intentos fallidos" value={
            <span className={user.intentosFallidos > 0 ? 'text-red-500' : ''}>
              {user.intentosFallidos}
            </span>
          } />
          {user.bloqueadoHasta && (
            <div className="col-span-2">
              <Field label="Bloqueado hasta" value={
                <span className="text-amber-500">{fmtDate(user.bloqueadoHasta)}</span>
              } />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-black/8 dark:border-slate-700 flex items-center gap-3 bg-black/2 dark:bg-white/2 flex-wrap">
          {isBlocked && (
            <button
              onClick={() => { onClose(); onUnlock(user); }}
              className="flex items-center gap-2 bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
            >
              <LockOpen className="w-3.5 h-3.5" /> Desbloquear
            </button>
          )}
          {user.Estado === 'ACTIVO' && (
            <button
              onClick={() => { onClose(); onDeactivate(user); }}
              className="flex items-center gap-2 bg-slate-500/10 hover:bg-slate-500 text-slate-500 hover:text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
            >
              <UserX className="w-3.5 h-3.5" /> Desactivar
            </button>
          )}
          {user.Estado === 'INACTIVO' && (
            <button
              onClick={() => { onClose(); onUnlock(user); }}
              className="flex items-center gap-2 bg-primary/10 hover:bg-primary text-primary hover:text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Reactivar
            </button>
          )}
          <button onClick={onClose} className="ml-auto px-5 py-2.5 bg-black/6 dark:bg-slate-800 hover:bg-black/12 dark:hover:bg-slate-700 text-text dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────

export const UsuariosPage = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles,    setRoles]    = useState<Rol[]>([]);
  const [searchQ,  setSearchQ]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [viewing,  setViewing]  = useState<Usuario | null>(null);
  const [editing,  setEditing]  = useState<Usuario | null>(null);

  const load = async () => {
    setLoading(true);
    const [usuResult, rolesResult] = await Promise.allSettled([
      authAdminApi.getUsuarios(),
      authAdminApi.getRoles(),
    ]);
    if (usuResult.status === 'fulfilled') {
      setUsuarios(usuResult.value);
    } else {
      toast.error('No se pudieron cargar los usuarios.');
    }
    if (rolesResult.status === 'fulfilled') {
      setRoles(rolesResult.value);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUnlock = (user: Usuario) => {
    const action = user.Estado === 'INACTIVO' ? 'reactivar' : 'desbloquear';
    toast.warning(`¿${action.charAt(0).toUpperCase() + action.slice(1)} a @${user.UserName}?`, {
      description: action === 'desbloquear'
        ? 'Se restablecerán los intentos fallidos y el usuario podrá iniciar sesión.'
        : 'El usuario volverá al estado ACTIVO.',
      action: {
        label: 'Confirmar',
        onClick: async () => {
          try {
            const res = await (user.Estado === 'INACTIVO'
              ? authAdminApi.updateEstadoUsuario(user.ID_Usuario, 'ACTIVO')
              : authAdminApi.desbloquearUsuario(user.ID_Usuario));
            toast.success(res.message);
            load();
          } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error al actualizar usuario.');
          }
        },
      },
    });
  };

  const handleDeactivate = (user: Usuario) => {
    toast.warning(`¿Desactivar a @${user.UserName}?`, {
      description: 'El usuario no podrá iniciar sesión hasta ser reactivado.',
      action: {
        label: 'Confirmar',
        onClick: async () => {
          try {
            const res = await authAdminApi.updateEstadoUsuario(user.ID_Usuario, 'INACTIVO');
            toast.success(res.message);
            load();
          } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error al desactivar usuario.');
          }
        },
      },
    });
  };

  const blocked = usuarios.filter(u =>
    u.Estado === 'BLOQUEADO' || u.Estado === 'BLOQUEADO_PERMANENTE'
  );

  const filtered = usuarios.filter(u =>
    u.UserName.toLowerCase().includes(searchQ.toLowerCase()) ||
    u.Email.toLowerCase().includes(searchQ.toLowerCase()) ||
    (u.empleado?.Nombre ?? '').toLowerCase().includes(searchQ.toLowerCase()) ||
    (u.empleado?.Paterno ?? '').toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 w-full relative z-10">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-primary drop-shadow-sm flex items-center gap-3">
            <UserCog className="w-10 h-10" /> Gestión de Usuarios
          </h2>
          <p className="mt-2 text-lg font-bold text-text opacity-70">
            Administración de cuentas, estados y desbloqueos.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 bg-primary/10 hover:bg-primary text-primary hover:text-white font-black uppercase tracking-wider px-5 py-3 rounded-xl transition-all active:scale-95 border border-primary/20 hover:border-transparent"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Alert banner: usuarios bloqueados */}
      {blocked.length > 0 && (
        <div className="flex items-center gap-4 bg-red-500/8 border border-red-500/20 rounded-2xl px-6 py-4">
          <LockKeyhole className="w-6 h-6 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-black text-red-500 text-sm">
              {blocked.length} {blocked.length === 1 ? 'usuario bloqueado' : 'usuarios bloqueados'}
            </p>
            <p className="text-xs font-bold opacity-60 mt-0.5 dark:text-gray-400">
              {blocked.map(u => `@${u.UserName}`).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white/40 dark:bg-black/40 backdrop-blur-3xl border border-black/10 dark:border-slate-700 rounded-[2rem] p-8 shadow-2xl">

        {/* Search */}
        <div className="flex items-center bg-surface border border-divider rounded-xl px-4 py-3 mb-6 focus-within:border-primary transition-all">
          <Search className="w-5 h-5 text-primary opacity-60 mr-2" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Buscar por usuario, email o nombre..."
            className="bg-transparent border-none outline-none w-full font-bold text-text"
          />
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-card border-b border-divider">
            <tr>
              <th className="p-4 font-black text-xs tracking-wider uppercase text-muted">Usuario</th>
              <th className="p-4 font-black text-xs tracking-wider uppercase text-muted">Empleado</th>
              <th className="p-4 font-black text-xs tracking-wider uppercase text-muted">Estado</th>
              <th className="p-4 font-black text-xs tracking-wider uppercase text-muted">Último Login</th>
              <th className="p-4 font-black text-xs tracking-wider uppercase text-muted text-center">Intentos</th>
              <th className="p-4 font-black text-xs tracking-wider uppercase text-muted text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-slate-700/50">
            {filtered.map(u => {
              const isBlocked = u.Estado === 'BLOQUEADO' || u.Estado === 'BLOQUEADO_PERMANENTE';
              const fullName  = [u.empleado?.Paterno, u.empleado?.Nombre].filter(Boolean).join(', ');
              const isSistema = u.Estado === 'SISTEMA';
              return (
                <tr
                  key={u.ID_Usuario}
                  onClick={() => setViewing(u)}
                  className="hover:bg-primary/4 dark:hover:bg-primary/6 transition-colors duration-150 group cursor-pointer"
                >
                  <td className="p-4">
                    <p className="font-black font-mono tracking-wider text-primary dark:text-gray-200">@{u.UserName}</p>
                    <p className="text-[11px] font-bold opacity-50 mt-0.5 dark:text-gray-400">{u.Email}</p>
                  </td>
                  <td className="p-4 font-bold text-text dark:text-gray-300">
                    {fullName || '—'}
                    {u.empleado?.Cargo && (
                      <p className="text-[11px] font-bold opacity-40 mt-0.5 uppercase tracking-wider">{u.empleado.Cargo}</p>
                    )}
                  </td>
                  <td className="p-4">{estadoBadge(u.Estado)}</td>
                  <td className="p-4 font-mono text-xs text-text dark:text-gray-400">{fmtDate(u.ultimoLogin)}</td>
                  <td className="p-4 text-center">
                    <span className={`font-black text-sm ${u.intentosFallidos >= 3 ? 'text-red-500' : u.intentosFallidos > 0 ? 'text-amber-500' : 'text-text dark:text-gray-400 opacity-40'}`}>
                      {u.intentosFallidos}
                    </span>
                  </td>
                  <td className="p-4">
                    <div
                      className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Botón Editar */}
                      {!isSistema && (
                        <button
                          onClick={() => setEditing(u)}
                          title="Editar usuario"
                          className="p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all active:scale-95"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}

                      {isBlocked && (
                        <button
                          onClick={() => handleUnlock(u)}
                          title="Desbloquear usuario"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all active:scale-95 text-xs font-black uppercase tracking-wider"
                        >
                          <LockOpen className="w-3.5 h-3.5" /> Desbloquear
                        </button>
                      )}
                      {u.Estado === 'ACTIVO' && !isSistema && (
                        <button
                          onClick={() => handleDeactivate(u)}
                          title="Desactivar cuenta"
                          className="p-2 rounded-xl bg-slate-500/10 text-slate-500 hover:bg-slate-500 hover:text-white transition-all active:scale-95"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      {u.Estado === 'INACTIVO' && (
                        <button
                          onClick={() => handleUnlock(u)}
                          title="Reactivar cuenta"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all active:scale-95 text-xs font-black uppercase tracking-wider"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Reactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-25">
            <UserCog className="w-12 h-12" />
            <p className="font-black text-sm">No hay usuarios que coincidan.</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {viewing && (
        <DetailModal
          user={viewing}
          onClose={() => setViewing(null)}
          onUnlock={u => { setViewing(null); handleUnlock(u); }}
          onDeactivate={u => { setViewing(null); handleDeactivate(u); }}
        />
      )}

      {/* Edit Modal */}
      {editing && (
        <EditModal
          user={editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </div>
  );
};
