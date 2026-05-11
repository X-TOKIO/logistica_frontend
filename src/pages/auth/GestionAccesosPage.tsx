import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { authAdminApi } from '../../services/auth.admin';
import { ShieldAlert, ShieldCheck, UserCheck, CheckCircle, Search, Trash2, ShieldQuestion, PlusCircle, Pencil, X, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

type Tab = 'asignar' | 'roles';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: transforma ACCESO_PRODUCTO_VER → Producto: Ver
// ─────────────────────────────────────────────────────────────────────────────
const mapPermisoVisual = (name: string) =>
  name
    .replace('ACCESO_', '')
    .replace(/_/g, ' ')
    .replace(/ VER$/, ': Ver')
    .replace(/ EDITAR$/, ': Editar')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());

// ─────────────────────────────────────────────────────────────────────────────
// PermisosGrid – cuadrícula reutilizable de checkboxes
// ─────────────────────────────────────────────────────────────────────────────
const PermisosGrid = ({
  permisos,
  selected,
  onToggle,
}: {
  permisos: any[];
  selected: number[];
  onToggle: (id: number) => void;
}) => {
  const [filter, setFilter] = useState('');
  const visible = permisos.filter(p =>
    mapPermisoVisual(p.Nombre).toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3 bg-black/5 dark:bg-slate-800/60 rounded-xl p-4 border border-transparent dark:border-slate-700">
      {/* Buscador */}
      <div className="flex items-center bg-background dark:bg-[#0B0D14] rounded-lg px-3 py-2 shadow-inner border border-black/5 dark:border-white/5">
        <Search className="w-4 h-4 text-primary opacity-60 mr-2 flex-shrink-0" />
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filtrar permiso..."
          className="bg-transparent text-sm border-none outline-none w-full font-bold dark:text-gray-200"
        />
        {filter && (
          <button onClick={() => setFilter('')} className="ml-1 opacity-50 hover:opacity-100">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Botones rápidos */}
      <div className="flex gap-2 text-[10px]">
        <button
          type="button"
          onClick={() => permisos.forEach(p => !selected.includes(p.ID_Permiso) && onToggle(p.ID_Permiso))}
          className="px-2 py-1 bg-primary/10 text-primary rounded font-black uppercase hover:bg-primary hover:text-white transition-all"
        >
          Marcar Todos
        </button>
        <button
          type="button"
          onClick={() => selected.forEach(id => onToggle(id))}
          className="px-2 py-1 bg-red-500/10 text-red-500 rounded font-black uppercase hover:bg-red-500 hover:text-white transition-all"
        >
          <RotateCcw className="w-3 h-3 inline mr-1" />
          Limpiar
        </button>
        <span className="ml-auto opacity-50 font-bold self-center">{selected.length} seleccionado(s)</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto max-h-52 pr-1">
        {visible.map(p => {
          const on = selected.includes(p.ID_Permiso);
          return (
            <div
              key={p.ID_Permiso}
              onClick={() => onToggle(p.ID_Permiso)}
              className={`cursor-pointer text-[10px] tracking-wider p-2 rounded-lg font-black uppercase text-center border-2 transition-all flex items-center gap-1 justify-center select-none ${
                on
                  ? 'border-primary bg-primary text-white shadow-md scale-105'
                  : 'border-transparent bg-background text-text opacity-60 hover:opacity-100 hover:border-primary/50'
              }`}
            >
              {on && <ShieldCheck className="w-3 h-3 flex-shrink-0" />}
              {mapPermisoVisual(p.Nombre)}
            </div>
          );
        })}
        {visible.length === 0 && (
          <span className="col-span-3 text-center opacity-40 font-bold py-4 text-xs">Sin resultados</span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PESTAÑA: Asignar Accesos a Usuario
// ─────────────────────────────────────────────────────────────────────────────
const TabAsignar = ({ permisos, roles }: { permisos: any[]; roles: any[] }) => {
  const { user, updatePermissionsLocal } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userMatrix, setUserMatrix] = useState<any[]>([]);
  const [formRol, setFormRol] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<number[]>([]);

  useEffect(() => {
    authAdminApi.getUsers().then(setUsers).catch(() => {});
  }, []);

  const handleSelectUser = async (u: any) => {
    setSelectedUser(u);
    const um = await authAdminApi.getUserMatrix(u.ID_Usuario);
    setUserMatrix(um);
    setFormRol('');
    setSelectedPerms([]);
  };

  const togglePerm = (id: number) =>
    setSelectedPerms(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRol) { toast.warning('Selecciona un Rol Base.'); return; }

    toast.promise(
      authAdminApi.syncPermisos({
        ID_Usuario: selectedUser.ID_Usuario,
        ID_Rol: Number(formRol),
        ID_Permisos: selectedPerms,
      }),
      {
        loading: 'Sincronizando permisos...',
        success: () => {
          handleSelectUser(selectedUser);
          if (selectedUser.ID_Usuario === user?.id) {
            updatePermissionsLocal();
            toast.success('Tu sesión fue refrescada con los nuevos permisos.');
          } else {
            toast.warning('El usuario deberá re-iniciar sesión para ver los cambios.');
          }
          setSelectedPerms([]);
          return '¡Permisos sincronizados correctamente!';
        },
        error: 'Error al sincronizar',
      },
    );
  };

  const handleRevoke = (um: any) => {
    toast.promise(
      authAdminApi.revokeRole({
        ID_Usuario: selectedUser.ID_Usuario,
        ID_Rol: um.rolPermiso.ID_Rol,
        ID_Permiso: um.rolPermiso.ID_Permiso,
      }),
      {
        loading: 'Revocando...',
        success: () => { handleSelectUser(selectedUser); return 'Permiso revocado'; },
        error: 'Error al revocar',
      },
    );
  };

  const displayUsers = users.filter(
    u =>
      u.UserName.toLowerCase().includes(searchQ.toLowerCase()) ||
      u.empleado?.Nombre?.toLowerCase().includes(searchQ.toLowerCase()),
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Lista de usuarios */}
      <div className="bg-white/40 dark:bg-[#0B0D14]/80 backdrop-blur-3xl border border-black/10 dark:border-slate-700 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[780px]">
        <div className="absolute top-0 left-0 w-40 h-40 bg-primary/20 blur-[60px] rounded-full pointer-events-none" />
        <h3 className="text-lg font-black text-text dark:text-gray-200 mb-4 z-10">Directorio de Usuarios</h3>

        <div className="flex items-center bg-black/5 dark:bg-slate-800 rounded-xl px-4 py-3 mb-4 border dark:border-slate-700 focus-within:border-primary transition-all z-10">
          <Search className="w-5 h-5 text-primary opacity-60 mr-2" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Buscar usuario o empleado..."
            className="bg-transparent border-none outline-none w-full font-bold dark:text-gray-200"
          />
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1 z-10">
          {displayUsers.map(u => (
            <div
              key={u.ID_Usuario}
              onClick={() => handleSelectUser(u)}
              className={`p-4 rounded-xl cursor-pointer border flex justify-between items-center transition-all ${
                selectedUser?.ID_Usuario === u.ID_Usuario
                  ? 'bg-primary border-primary text-white shadow-lg'
                  : 'bg-background hover:border-primary/50 text-text dark:text-gray-200 dark:bg-slate-800 border-black/10 dark:border-slate-700'
              }`}
            >
              <div>
                <p className="font-black text-lg">@{u.UserName}</p>
                <p className={`text-xs uppercase font-bold mt-1 ${selectedUser?.ID_Usuario === u.ID_Usuario ? 'opacity-80' : 'opacity-50'}`}>
                  EMP-{u.empleado?.ID_Empleado} / CI {u.empleado?.CI}
                </p>
              </div>
              {u.Estado === 'ACTIVO' ? (
                <span className="flex items-center gap-1 bg-green-500/20 text-green-500 px-2 py-1 rounded-full text-[10px] font-black uppercase">
                  <CheckCircle className="w-3 h-3" /> ACTIVO
                </span>
              ) : (
                <span className="flex items-center gap-1 bg-red-500/20 text-red-500 px-2 py-1 rounded-full text-[10px] font-black uppercase">
                  <ShieldAlert className="w-3 h-3" /> {u.Estado}
                </span>
              )}
            </div>
          ))}
          {displayUsers.length === 0 && <span className="opacity-50 font-bold p-10 text-center">Sin usuarios.</span>}
        </div>
      </div>

      {/* Asignador + Matriz */}
      <div className="flex flex-col gap-6">
        {/* Asignador */}
        <div className={`bg-white/60 dark:bg-[#0B0D14]/80 backdrop-blur-3xl border border-black/10 dark:border-slate-700 rounded-[2rem] p-6 shadow-2xl transition-all duration-500 ${!selectedUser ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
          <h3 className="text-lg font-black text-text dark:text-gray-200 mb-1 flex items-center gap-2">
            <UserCheck className="text-primary w-5 h-5" /> Asignar Módulos
          </h3>
          <p className="opacity-50 font-bold text-xs mb-4 tracking-widest uppercase dark:text-gray-400">
            @{selectedUser?.UserName || '— sin selección —'}
          </p>

          <form onSubmit={handleSync} className="flex flex-col gap-4">
            <select
              required
              value={formRol}
              onChange={e => setFormRol(e.target.value)}
              className="w-full bg-black/5 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary border border-transparent dark:border-slate-700 font-black cursor-pointer uppercase text-sm dark:text-gray-200"
            >
              <option value="">-- Rol Base --</option>
              {roles.map(r => <option key={r.ID_Rol} value={r.ID_Rol}>{r.Nombre}</option>)}
            </select>

            <PermisosGrid permisos={permisos} selected={selectedPerms} onToggle={togglePerm} />

            <button
              type="submit"
              className="w-full bg-primary text-white font-black uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:brightness-110 active:scale-95 transition-all"
            >
              <ShieldCheck className="w-5 h-5" />
              Sincronizar Permisos ({selectedPerms.length})
            </button>
          </form>
        </div>

        {/* Tabla Matriz */}
        <div className={`bg-white/40 dark:bg-[#0B0D14]/80 backdrop-blur-3xl border border-black/10 dark:border-slate-700 rounded-[2rem] p-6 shadow-2xl flex-1 flex flex-col transition-all duration-500 ${!selectedUser ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
          <h3 className="text-lg font-black text-text dark:text-gray-200 mb-4">Matriz Activa en BD</h3>
          <div className="bg-background dark:bg-slate-800 rounded-2xl overflow-x-auto border border-black/10 dark:border-slate-700 max-h-80 overflow-y-auto">
            <table className="w-full min-w-[400px] text-left text-sm">
              <thead className="bg-black/5 dark:bg-slate-700/50 border-b border-black/10 dark:border-slate-700 sticky top-0 backdrop-blur-sm">
                <tr>
                  <th className="p-3 font-black uppercase text-xs">Rol</th>
                  <th className="p-3 font-black uppercase text-xs">Permiso</th>
                  <th className="p-3 font-black uppercase text-xs text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {userMatrix.map((um, i) => (
                  <tr key={i} className="hover:bg-primary/5 transition-colors group">
                    <td className="p-3 font-bold text-xs">
                      <span className="bg-primary text-background px-2 py-1 rounded-md text-[10px] mr-2">SYS</span>
                      {um.rolPermiso?.rol?.Nombre || '—'}
                    </td>
                    <td className="p-3 font-bold text-secondary text-[10px] uppercase flex items-center gap-1 mt-1">
                      <ShieldQuestion className="w-3 h-3 opacity-50" />
                      {mapPermisoVisual(um.rolPermiso?.permiso?.Nombre || '')}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleRevoke(um)}
                        className="opacity-0 group-hover:opacity-100 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white p-1.5 rounded-md text-[10px] font-black uppercase transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {userMatrix.length === 0 && (
              <div className="p-10 font-bold opacity-40 text-center">Sin privilegios asignados.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PESTAÑA: Gestión de Roles (CRUD + permisos por rol)
// ─────────────────────────────────────────────────────────────────────────────
const TabRoles = ({ permisos, roles, onRolesChange }: { permisos: any[]; roles: any[]; onRolesChange: () => void }) => {
  const [editingRol, setEditingRol] = useState<any>(null); // null = modo crear
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRolId, setExpandedRolId] = useState<number | null>(null);

  const openCreate = () => {
    setEditingRol(null);
    setNombre('');
    setDescripcion('');
    setSelectedPerms([]);
    setShowForm(true);
  };

  const openEdit = async (rol: any) => {
    setEditingRol(rol);
    setNombre(rol.Nombre);
    setDescripcion(rol.Descripcion || '');
    // permisoIds ya viene en el objeto porque getAllRoles los enriquece
    setSelectedPerms(rol.permisoIds || []);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { toast.warning('El nombre del rol es obligatorio.'); return; }
    setLoading(true);
    // Garantizar que permisos sean IDs numéricos válidos
    const permisosIds = selectedPerms.map(Number).filter(n => !isNaN(n) && n > 0);
    try {
      if (editingRol) {
        await authAdminApi.updateRol(editingRol.ID_Rol, { nombre, descripcion, permisos: permisosIds });
        toast.success(`Rol "${nombre}" actualizado con ${permisosIds.length} permisos.`);
      } else {
        await authAdminApi.createRol({ nombre, descripcion, permisos: permisosIds });
        toast.success(`Rol "${nombre}" creado con ${permisosIds.length} permisos.`);
      }
      setShowForm(false);
      onRolesChange();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al guardar el rol.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (rol: any) => {
    toast.promise(authAdminApi.deleteRol(rol.ID_Rol), {
      loading: 'Eliminando...',
      success: () => { onRolesChange(); return `Rol "${rol.Nombre}" eliminado.`; },
      error: 'No se pudo eliminar. Puede tener usuarios asignados.',
    });
  };

  const togglePerm = (id: number) =>
    setSelectedPerms(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]));

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      {/* Tabla de Roles */}
      <div className="bg-white/40 dark:bg-[#0B0D14]/80 backdrop-blur-3xl border border-black/10 dark:border-slate-700 rounded-[2rem] p-6 shadow-2xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-black text-text dark:text-gray-200">Catálogo de Roles</h3>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-black uppercase hover:brightness-110 active:scale-95 transition-all shadow-md"
          >
            <PlusCircle className="w-4 h-4" /> Nuevo Rol
          </button>
        </div>

        <div className="bg-background dark:bg-slate-800 rounded-2xl overflow-x-auto border border-black/10 dark:border-slate-700">
          <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-black/5 dark:bg-slate-700/50 border-b border-black/10 dark:border-slate-700">
              <tr>
                <th className="p-3 font-black uppercase text-xs">Nombre</th>
                <th className="p-3 font-black uppercase text-xs">Descripción</th>
                <th className="p-3 font-black uppercase text-xs">Permisos</th>
                <th className="p-3 font-black uppercase text-xs text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {roles.map(r => (
                <tr key={r.ID_Rol} className="hover:bg-primary/5 transition-colors group">
                  <td className="p-3 font-black text-xs uppercase text-primary">{r.Nombre}</td>
                  <td className="p-3 text-xs opacity-60 font-bold">{r.Descripcion || '—'}</td>
                  <td className="p-3 align-top">
                    {(r.permisoIds?.length > 0) ? (
                      <div className="flex flex-wrap gap-1">
                        {(expandedRolId === r.ID_Rol
                          ? r.permisoIds
                          : r.permisoIds.slice(0, 3)
                        ).map((pid: number) => {
                          const p = permisos.find((x: any) => x.ID_Permiso === pid);
                          return p ? (
                            <span key={pid} className="bg-primary/10 text-primary text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                              {mapPermisoVisual(p.Nombre)}
                            </span>
                          ) : null;
                        })}
                        {r.permisoIds.length > 3 && (
                          <button
                            onClick={() => setExpandedRolId(expandedRolId === r.ID_Rol ? null : r.ID_Rol)}
                            className="text-[9px] font-black px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 hover:bg-primary hover:text-white transition-all"
                          >
                            {expandedRolId === r.ID_Rol
                              ? '▲ Ver menos'
                              : `+${r.permisoIds.length - 3} más`}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] opacity-30 font-bold">Sin permisos</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(r)}
                        className="bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white p-1.5 rounded-md transition-all"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-1.5 rounded-md transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {roles.length === 0 && <div className="p-8 text-center opacity-40 font-bold">Sin roles registrados.</div>}
        </div>
      </div>

      {/* Formulario Crear/Editar */}
      {showForm ? (
        <div className="bg-white/60 dark:bg-[#0B0D14]/80 backdrop-blur-3xl border border-black/10 dark:border-slate-700 rounded-[2rem] p-6 shadow-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-text dark:text-gray-200">
              {editingRol ? `Editando: ${editingRol.Nombre}` : 'Nuevo Rol'}
            </h3>
            <button onClick={() => setShowForm(false)} className="opacity-50 hover:opacity-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <input
              required
              value={nombre}
              onChange={e => setNombre(e.target.value.toUpperCase())}
              placeholder="NOMBRE_DEL_ROL"
              className="w-full bg-black/5 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary border border-transparent dark:border-slate-700 font-black uppercase text-sm dark:text-gray-200"
            />
            <input
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Descripción (opcional)"
              className="w-full bg-black/5 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary border border-transparent dark:border-slate-700 font-bold text-sm dark:text-gray-200"
            />

            <p className="text-xs font-black uppercase opacity-50 tracking-widest">Permisos del Rol</p>
            <PermisosGrid permisos={permisos} selected={selectedPerms} onToggle={togglePerm} />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-black uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              <ShieldCheck className="w-5 h-5" />
              {loading ? 'Guardando...' : `Guardar Rol (${selectedPerms.length} permisos)`}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-white/20 dark:bg-white/5 border-2 border-dashed border-black/10 dark:border-white/10 rounded-[2rem] flex items-center justify-center cursor-pointer hover:border-primary/50 transition-all" onClick={openCreate}>
          <div className="text-center opacity-40 p-10">
            <PlusCircle className="w-12 h-12 mx-auto mb-3" />
            <p className="font-black uppercase tracking-widest text-sm">Selecciona un rol para editar<br/>o crea uno nuevo</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export const GestionAccesosPage = () => {
  const [tab, setTab] = useState<Tab>('asignar');
  const [roles, setRoles] = useState<any[]>([]);
  const [permisos, setPermisos] = useState<any[]>([]);

  const loadMatrix = async () => {
    try {
      const [r, p] = await Promise.all([authAdminApi.getRoles(), authAdminApi.getPermisos()]);
      setRoles(r);
      setPermisos(p);
    } catch { console.error('Error loading matrix'); }
  };

  useEffect(() => { loadMatrix(); }, []);

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      className={`px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-wider transition-all ${
        tab === t
          ? 'bg-primary text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]'
          : 'opacity-50 hover:opacity-80'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6 w-full relative z-10">
      <h2 className="text-2xl sm:text-4xl font-black text-primary drop-shadow-sm">Seguridad y Gestión de Accesos</h2>

      {/* Tabs */}
      <div className="flex flex-wrap gap-3 bg-black/5 dark:bg-white/5 p-1.5 rounded-2xl w-fit border border-black/10 dark:border-white/10">
        {tabBtn('asignar', '👤 Asignar Accesos')}
        {tabBtn('roles', '🛡️ Gestión de Roles')}
      </div>

      {tab === 'asignar' && <TabAsignar permisos={permisos} roles={roles} />}
      {tab === 'roles'   && <TabRoles   permisos={permisos} roles={roles} onRolesChange={loadMatrix} />}
    </div>
  );
};
