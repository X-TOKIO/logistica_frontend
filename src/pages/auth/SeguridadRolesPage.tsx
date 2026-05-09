import { useMemo, useEffect, useState } from 'react';
import React from 'react';
import { toast } from 'sonner';
import {
  ShieldCheck, Plus, Pencil, Trash2, Eye, Package,
  Store, Tags, Satellite, Truck, CreditCard, Users,
  ArrowLeft, Shield, X, Lock,
  PackagePlus, PackageMinus, AlertTriangle, ClipboardList,
  Building2, ShoppingCart, BarChart2, UserCog,
} from 'lucide-react';
import { authAdminApi } from '../../services/auth.admin';

// ── Types ──────────────────────────────────────────────────────────────────

type PageView = 'list' | 'form';
type Permiso  = { ID_Permiso: number; Nombre: string };
type Rol      = { ID_Rol: number; Nombre: string; Descripcion?: string; permisos?: Permiso[] };
type ModuleDef   = { id: string; label: string; Icon: React.ComponentType<{ className?: string }>; permKey: string };
type SectionGroup = { section: string; modules: ModuleDef[] };

// ── Constants ──────────────────────────────────────────────────────────────

const SYSTEM_ROLE = 'ADMINISTRADOR';

// Mapeo: nombre del módulo DB → sección en el modal de detalle
const MODULO_TO_SECTION: Record<string, string> = {
  MODULO_CATALOGO:    'ALMACENES',
  MODULO_ALMACEN:     'ALMACENES',
  MODULO_INVENTARIO:  'INVENTARIO',
  MODULO_DESPACHOS:   'LOGÍSTICA TERRESTRE',
  MODULO_TERMINAL:    'LOGÍSTICA TERRESTRE',
  MODULO_PROVEEDORES: 'LOGÍSTICA TERRESTRE',
  MODULO_FINANZAS:    'FINANZAS Y PAGOS',
  MODULO_REPORTES:    'REPORTES Y ESTADÍSTICAS',
  MODULO_RRHH:        'ADMINISTRACIÓN',
  MODULO_USUARIOS:    'ADMINISTRACIÓN',
  MODULO_SEGURIDAD:   'ADMINISTRACIÓN',
};

const SECTION_GROUPS: SectionGroup[] = [
  {
    section: 'ALMACENES',
    modules: [
      { id: 'catalogo', label: 'Maestros (Cat/Med)',  Icon: Tags,    permKey: 'MODULO_CATALOGO' },
      { id: 'producto',  label: 'Catálogo Productos',  Icon: Package, permKey: 'MODULO_CATALOGO' },
      { id: 'almacen',   label: 'Almacenes',            Icon: Store,   permKey: 'MODULO_ALMACEN'  },
    ],
  },
  {
    section: 'INVENTARIO',
    modules: [
      { id: 'ingreso', label: 'Notas de Ingreso',  Icon: PackagePlus,   permKey: 'MODULO_INVENTARIO' },
      { id: 'egreso',  label: 'Notas de Egreso',   Icon: PackageMinus,  permKey: 'MODULO_INVENTARIO' },
      { id: 'mermas',  label: 'Control de Mermas', Icon: AlertTriangle, permKey: 'MODULO_INVENTARIO' },
    ],
  },
  {
    section: 'LOGÍSTICA TERRESTRE',
    modules: [
      { id: 'despacho',    label: 'Asignar Despacho',     Icon: ClipboardList, permKey: 'MODULO_DESPACHOS'   },
      { id: 'vehicular',   label: 'Terminal Vehicular',    Icon: Truck,         permKey: 'MODULO_TERMINAL'    },
      { id: 'satelital',   label: 'Monitor Satelital',     Icon: Satellite,     permKey: 'MODULO_TERMINAL'    },
      { id: 'proveedores', label: 'Gestionar Proveedores', Icon: Building2,     permKey: 'MODULO_PROVEEDORES' },
    ],
  },
  {
    section: 'FINANZAS Y PAGOS',
    modules: [
      { id: 'compras', label: 'Gestionar Compras', Icon: ShoppingCart, permKey: 'MODULO_FINANZAS' },
      { id: 'cxp',     label: 'Cuentas por Pagar', Icon: CreditCard,   permKey: 'MODULO_FINANZAS' },
    ],
  },
  {
    section: 'REPORTES Y ESTADÍSTICAS',
    modules: [
      { id: 'reportes', label: 'Inteligencia de Negocios', Icon: BarChart2, permKey: 'MODULO_REPORTES' },
    ],
  },
  {
    section: 'ADMINISTRACIÓN',
    modules: [
      { id: 'rrhh',     label: 'Recursos Humanos', Icon: Users,       permKey: 'MODULO_RRHH'      },
      { id: 'usuarios', label: 'Gestión Usuarios',  Icon: UserCog,     permKey: 'MODULO_USUARIOS'  },
      { id: 'roles',    label: 'Seguridad y Roles', Icon: ShieldCheck, permKey: 'MODULO_SEGURIDAD' },
    ],
  },
];

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-rose-500', 'bg-cyan-500', 'bg-amber-500',
];

// ── Helpers ────────────────────────────────────────────────────────────────

const avatarColor = (name: string) =>
  AVATAR_COLORS[name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const formatTag = (nombre: string): string => {
  if (nombre.startsWith('MODULO_')) {
    return nombre.replace('MODULO_', '').toLowerCase().replace(/_/g, ' ');
  }
  // compatibilidad con formato antiguo
  const parts = nombre.replace('ACCESO_', '').toLowerCase().split('_');
  const action = parts.pop() ?? '';
  return `${parts.join('_')}.${action}`;
};

// ── Toggle (iOS-style switch) ──────────────────────────────────────────────

const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
      disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
    } ${checked ? 'bg-primary' : 'bg-slate-300 dark:bg-surface border border-slate-400 dark:border-divider'}`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
        checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
      }`}
    />
  </button>
);

// ── Permission Card ────────────────────────────────────────────────────────
// Un único switch On/Off por módulo — sin checkboxes individuales

type PermCardProps = {
  module: ModuleDef;
  permLookup: Record<string, Permiso>;
  selected: Set<number>;
  onToggle: (permKey: string) => void;
};

const PermCard = ({ module, permLookup, selected, onToggle }: PermCardProps) => {
  const perm    = permLookup[module.permKey];
  const isOn    = perm ? selected.has(perm.ID_Permiso) : false;
  const noPerms = !perm;

  return (
    <div
      className={`bg-card rounded-md border shadow-sm transition-all duration-200 flex items-center gap-3 px-5 py-4 ${
        noPerms
          ? 'border-divider opacity-50'
          : isOn
          ? 'border-primary/30 shadow-primary/5'
          : 'border-divider'
      }`}
    >
      {/* Ícono */}
      <span className={`p-1.5 rounded flex-shrink-0 ${isOn ? 'bg-primary/10' : 'bg-surface'}`}>
        <module.Icon className={`w-4 h-4 ${isOn ? 'text-primary' : 'text-text opacity-50'}`} />
      </span>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <span className="font-black text-sm text-text truncate block">{module.label}</span>
        {noPerms && (
          <span className="text-[9px] font-black uppercase tracking-wider text-amber-500 opacity-70">
            Solo Administrador
          </span>
        )}
        {!noPerms && (
          <span className={`text-[9px] font-black uppercase tracking-wider transition-colors ${
            isOn ? 'text-primary opacity-70' : 'text-text opacity-25'
          }`}>
            {isOn ? 'Habilitado' : 'Deshabilitado'}
          </span>
        )}
      </div>

      {/* Switch único */}
      <Toggle
        checked={isOn}
        disabled={noPerms}
        onChange={() => !noPerms && onToggle(module.permKey)}
      />
    </div>
  );
};

// ── Rol Detail Modal ───────────────────────────────────────────────────────

type RolDetailProps = {
  rol: Rol;
  onClose: () => void;
  onEdit: (rol: Rol) => void;
};

const RolDetailModal = ({ rol, onClose, onEdit }: RolDetailProps) => {
  const totalPerms = rol.permisos?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-md w-full max-w-xl shadow-2xl border border-divider max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-8 py-6 border-b border-divider">
          <div className={`w-14 h-14 rounded-md flex items-center justify-center text-white font-black text-lg shadow-lg flex-shrink-0 ${avatarColor(rol.Nombre)}`}>
            {rol.Nombre.replace(/_/g, '').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-35 mb-0.5">Plantilla de Rol</p>
            <h3 className="text-xl font-black text-text dark:text-gray-100 uppercase tracking-wider leading-tight">{rol.Nombre}</h3>
            {rol.Descripcion && (
              <p className="text-xs opacity-45 font-bold mt-1 dark:text-gray-400">{rol.Descripcion}</p>
            )}
          </div>
          <div className="flex flex-col items-end flex-shrink-0 ml-2">
            <span className="text-3xl font-black text-primary leading-none">{totalPerms}</span>
            <span className="text-[9px] font-black uppercase tracking-widest opacity-35 mt-0.5">módulos</span>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-1 p-2 rounded-md hover:bg-surface text-text opacity-40 hover:opacity-80 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-5">
          {totalPerms === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 opacity-25">
              <Shield className="w-14 h-14 mb-3" />
              <p className="font-black text-sm">Sin módulos asignados</p>
            </div>
          ) : (
            SECTION_GROUPS.map(({ section }) => {
              const sectionPerms = (rol.permisos ?? []).filter(p =>
                MODULO_TO_SECTION[p.Nombre] === section
              );
              // Deduplicar (varios cards pueden compartir el mismo permiso)
              const uniquePerms = sectionPerms.filter(
                (p, i, arr) => arr.findIndex(x => x.ID_Permiso === p.ID_Permiso) === i
              );
              if (uniquePerms.length === 0) return null;
              return (
                <div key={section}>
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] opacity-30 mb-2.5 dark:text-gray-400">{section}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {uniquePerms.map(p => (
                      <span
                        key={p.ID_Permiso}
                        className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded border border-primary/15"
                      >
                        {formatTag(p.Nombre)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-divider flex items-center gap-3 bg-surface">
          {rol.Nombre === SYSTEM_ROLE ? (
            <span className="flex items-center gap-2 px-5 py-2.5 rounded-md text-xs font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 cursor-default select-none">
              <Lock className="w-3.5 h-3.5" /> Rol de sistema protegido
            </span>
          ) : (
            <button
              onClick={() => { onClose(); onEdit(rol); }}
              className="flex items-center gap-2 bg-primary/10 hover:bg-primary text-primary hover:text-white px-5 py-2.5 rounded-md text-xs font-black uppercase tracking-wider transition-all"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar Rol
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto px-5 py-2.5 bg-card hover:bg-surface text-text rounded-md text-xs font-black uppercase tracking-wider transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Tag cell with expand/collapse ─────────────────────────────────────────

const TAGS_PREVIEW = 5;

const TagCell = ({ rol }: { rol: Rol }) => {
  const [expanded, setExpanded] = useState(false);
  const perms = (rol.permisos ?? []).filter(
    (p, i, arr) => arr.findIndex(x => x.ID_Permiso === p.ID_Permiso) === i
  );
  const visible = expanded ? perms : perms.slice(0, TAGS_PREVIEW);
  const remaining = perms.length - TAGS_PREVIEW;

  if (perms.length === 0)
    return <span className="text-[11px] font-bold opacity-25 dark:text-gray-500">Sin módulos asignados</span>;

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {visible.map(p => (
        <span
          key={p.ID_Permiso}
          className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded whitespace-nowrap border border-primary/10"
        >
          {formatTag(p.Nombre)}
        </span>
      ))}
      {remaining > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          className="text-[10px] font-black px-2.5 py-0.5 rounded transition-all whitespace-nowrap border bg-surface border-divider text-text opacity-50 hover:opacity-100 hover:bg-primary/10 hover:text-primary hover:border-primary/20"
        >
          {expanded ? '↑ Ver menos' : `+${remaining} más`}
        </button>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────

export const SeguridadRolesPage = () => {
  const [view,       setView]       = useState<PageView>('list');
  const [roles,      setRoles]      = useState<Rol[]>([]);
  const [permisos,   setPermisos]   = useState<Permiso[]>([]);
  const [editingRol, setEditingRol] = useState<Rol | null>(null);
  const [viewingRol, setViewingRol] = useState<Rol | null>(null);

  // Form state
  const [fNombre,  setFNombre]  = useState('');
  const [fDesc,    setFDesc]    = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Lookup: MODULO_* → Permiso entity
  const permLookup = useMemo(() => {
    const map: Record<string, Permiso> = {};
    for (const p of permisos) {
      if (p.Nombre.startsWith('MODULO_')) {
        map[p.Nombre] = p;
      }
    }
    return map;
  }, [permisos]);

  useEffect(() => {
    loadRoles();
    authAdminApi.getPermisos()
      .then(data => setPermisos(Array.isArray(data) ? data : (data.permisos ?? [])))
      .catch(() =>
        authAdminApi.getMatrix()
          .then(d => setPermisos(d.permisos ?? []))
          .catch(() => {})
      );
  }, []);

  const loadRoles = async () => {
    try { setRoles(await authAdminApi.getRoles()); } catch { /* silent */ }
  };

  // ── Navigation ────────────────────────────────────────────────────────

  const openNew = () => {
    setEditingRol(null);
    setFNombre(''); setFDesc('');
    setSelected(new Set());
    setView('form');
  };

  const openEdit = async (rol: Rol) => {
    if (rol.Nombre === SYSTEM_ROLE) return;
    setEditingRol(rol);
    setFNombre(rol.Nombre);
    setFDesc(rol.Descripcion ?? '');
    if (rol.permisos) {
      setSelected(new Set(rol.permisos.map(p => p.ID_Permiso)));
    } else {
      try {
        const full = await authAdminApi.getRolById(rol.ID_Rol);
        setSelected(new Set((full.permisos ?? []).map((p: Permiso) => p.ID_Permiso)));
      } catch { setSelected(new Set()); }
    }
    setView('form');
  };

  // ── Toggle: activa/desactiva el módulo completo con un solo click ──────

  const toggleModule = (permKey: string) => {
    const perm = permLookup[permKey];
    if (!perm) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(perm.ID_Permiso) ? next.delete(perm.ID_Permiso) : next.add(perm.ID_Permiso);
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(Object.values(permLookup).map(p => p.ID_Permiso)));

  const deselectAll = () => setSelected(new Set());

  // ── Save / Delete ─────────────────────────────────────────────────────

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fNombre.trim()) return toast.warning('El nombre del rol es requerido.');
    const payload = { nombre: fNombre.trim(), descripcion: fDesc, permisos: [...selected] };
    toast.promise(
      editingRol
        ? authAdminApi.updateRol(editingRol.ID_Rol, payload)
        : authAdminApi.createRol(payload),
      {
        loading: editingRol ? 'Actualizando rol...' : 'Creando rol...',
        success: () => {
          loadRoles(); setView('list');
          return editingRol ? 'Rol actualizado.' : `Rol "${fNombre}" creado.`;
        },
        error: 'Error al guardar el rol.',
      }
    );
  };

  const handleDelete = (id: number, nombre: string) =>
    toast.promise(authAdminApi.deleteRol(id), {
      loading: 'Eliminando...',
      success: () => { loadRoles(); return `"${nombre}" eliminado.`; },
      error:   'No se pudo eliminar. Puede estar en uso.',
    });

  // ═══════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════════

  if (view === 'list') return (
    <div className="flex flex-col gap-6 w-full relative z-10 transition-all duration-300">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-4xl font-black text-primary drop-shadow-sm flex items-center gap-3">
            <ShieldCheck className="w-9 h-9 opacity-80" />
            Seguridad y Roles
          </h2>
          <p className="mt-1 text-sm font-bold text-text opacity-50">
            Plantillas de acceso modular para el sistema Paradiso.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-primary text-white font-black uppercase tracking-wider px-6 py-3.5 rounded-md shadow-[0_0_20px_rgba(var(--color-primary),0.3)] hover:-translate-y-0.5 transition-all active:scale-95 border-b-[3px] border-black/20"
        >
          <Plus className="w-5 h-5" /> Nuevo Rol
        </button>
      </div>

      {/* Roles table */}
      <div className="bg-card border border-divider rounded-md shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface border-b border-divider">
            <tr>
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest opacity-40 w-14" />
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest opacity-40">Rol / Cargo</th>
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest opacity-40">Módulos Habilitados</th>
              <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest opacity-40 text-right w-48">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {roles.map(rol => (
              <tr key={rol.ID_Rol} className="group hover:bg-primary/4 dark:hover:bg-primary/6 transition-colors duration-150">

                {/* Avatar */}
                <td className="px-6 py-5">
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center text-white text-xs font-black tracking-wider shadow-sm ${avatarColor(rol.Nombre)}`}>
                    {rol.Nombre.replace(/_/g, '').slice(0, 2).toUpperCase()}
                  </div>
                </td>

                {/* Name + description */}
                <td className="px-6 py-5 min-w-[160px]">
                  <p className="font-black text-sm text-text dark:text-gray-100 uppercase tracking-wider">{rol.Nombre}</p>
                  {rol.Descripcion && (
                    <p className="text-xs opacity-40 font-bold mt-0.5 dark:text-gray-400">{rol.Descripcion}</p>
                  )}
                </td>

                {/* Module tags */}
                <td className="px-6 py-5">
                  <TagCell rol={rol} />
                </td>

                {/* Row actions */}
                <td className="px-6 py-5">
                  <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button
                      onClick={() => setViewingRol(rol)}
                      title="Ver detalle"
                      className="flex items-center gap-1 bg-text/8 hover:bg-text text-muted hover:text-white px-2.5 py-1.5 rounded text-xs font-black uppercase tracking-wider transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver
                    </button>
                    {rol.Nombre === SYSTEM_ROLE ? (
                      <span
                        title="Rol de sistema protegido"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-black uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 cursor-default select-none"
                      >
                        <Lock className="w-3.5 h-3.5" /> Protegido
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => openEdit(rol)}
                          title="Editar rol"
                          className="flex items-center gap-1 bg-primary/10 hover:bg-primary text-primary hover:text-white px-2.5 py-1.5 rounded text-xs font-black uppercase tracking-wider transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button
                          onClick={() => handleDelete(rol.ID_Rol, rol.Nombre)}
                          title="Eliminar rol"
                          className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-2.5 py-1.5 rounded text-xs font-black uppercase tracking-wider transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Borrar
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {roles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 opacity-30">
            <Shield className="w-14 h-14" />
            <p className="font-black text-sm">No hay roles definidos. Crea el primero.</p>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {viewingRol && (
        <RolDetailModal
          rol={viewingRol}
          onClose={() => setViewingRol(null)}
          onEdit={rol => { setViewingRol(null); openEdit(rol); }}
        />
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // FORM VIEW
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col gap-6 w-full relative z-10 transition-all duration-300">

      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-2 text-sm font-bold opacity-50 hover:opacity-100 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <h2 className="text-3xl font-black text-primary">
            {editingRol ? `Editar: ${editingRol.Nombre}` : 'Nuevo Rol'}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs font-black uppercase tracking-widest text-primary bg-primary/10 hover:bg-primary/20 px-4 py-2.5 rounded-md transition-all"
          >
            Habilitar todos
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="text-xs font-black uppercase tracking-widest opacity-50 hover:opacity-100 bg-card hover:bg-surface px-4 py-2.5 rounded-md transition-all"
          >
            Deshabilitar todos
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-8">

        {/* Role metadata */}
        <div className="bg-card border border-divider rounded-md p-6 shadow-xl relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-40 h-40 bg-primary/8 blur-[60px] rounded-full pointer-events-none" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black uppercase tracking-widest opacity-50">Nombre del Rol *</label>
              <input
                required
                value={fNombre}
                onChange={e => setFNombre(e.target.value.toUpperCase().replace(/\s/g, '_'))}
                placeholder="Ej. GERENTE_ALMACEN"
                className="bg-surface rounded-md px-4 py-3.5 outline-none focus:ring-2 ring-primary border border-divider font-black tracking-widest uppercase text-text text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black uppercase tracking-widest opacity-50">Descripción</label>
              <input
                value={fDesc}
                onChange={e => setFDesc(e.target.value)}
                placeholder="Descripción breve del rol..."
                className="bg-surface rounded-md px-4 py-3.5 outline-none focus:ring-2 ring-primary border border-divider font-bold text-text text-sm"
              />
            </div>
          </div>
        </div>

        {/* Module cards grouped by section */}
        {SECTION_GROUPS.map(({ section, modules }) => (
          <div key={section} className="flex flex-col gap-3">
            <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-text opacity-35 px-1">
              {section}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
              {modules.map(module => (
                <PermCard
                  key={module.id}
                  module={module}
                  permLookup={permLookup}
                  selected={selected}
                  onToggle={toggleModule}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Sticky footer */}
        <div className="sticky bottom-4 flex items-center gap-4 bg-card/95 backdrop-blur-md border border-divider rounded-md px-6 py-4 shadow-2xl">
          <p className="text-sm font-black text-text opacity-40 flex-1">
            {selected.size} módulo{selected.size !== 1 ? 's' : ''} habilitado{selected.size !== 1 ? 's' : ''}
          </p>
          <button
            type="button"
            onClick={() => setView('list')}
            className="px-6 py-3 bg-card font-black rounded-md hover:bg-surface text-text transition-all text-sm uppercase tracking-wider"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-8 py-3 bg-primary text-white font-black rounded-md shadow-[0_0_20px_rgba(var(--color-primary-rgb),0.3)] hover:brightness-110 active:scale-95 transition-all text-sm uppercase tracking-widest"
          >
            {editingRol ? 'Actualizar Rol' : 'Guardar Rol'}
          </button>
        </div>
      </form>
    </div>
  );
};
