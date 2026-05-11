import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { warehouseApi } from '../../services/warehouse';
import { useAuth } from '../../context/AuthContext';
import {
  Store, MapPin, Phone, Plus, Pencil, Trash2, X,
  AlertTriangle, Building2, ShieldAlert, Lock,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type Almacen  = { ID_Almacen: number; Nombre: string; Direccion: string; Latitud?: number; Longitud?: number };
type Sucursal = { ID_Sucursal: number; Nombre: string; Direccion: string; Telefono?: string; StockCritico: number; Latitud?: number; Longitud?: number };

const INPUT = 'bg-surface rounded-md px-4 py-3 outline-none focus:ring-2 ring-primary border border-divider font-bold text-text w-full';

// ── Edit modals ────────────────────────────────────────────────────────────

const EditAlmacenModal = ({ alm, onClose, onSaved }: { alm: Almacen; onClose: () => void; onSaved: () => void }) => {
  const [nombre,    setNombre]    = useState(alm.Nombre);
  const [direccion, setDireccion] = useState(alm.Direccion);
  const [latitud,   setLatitud]   = useState(alm.Latitud ? String(alm.Latitud) : '');
  const [longitud,  setLongitud]  = useState(alm.Longitud ? String(alm.Longitud) : '');

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await warehouseApi.updateAlmacen(alm.ID_Almacen, {
        Nombre: nombre, Direccion: direccion,
        Latitud: latitud ? parseFloat(latitud) : undefined,
        Longitud: longitud ? parseFloat(longitud) : undefined,
      });
      toast.success('Almacén actualizado.');
      onSaved(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error al actualizar.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-card rounded-md w-full max-w-md shadow-2xl border border-divider p-4 sm:p-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-primary flex items-center gap-2"><Pencil className="w-5 h-5" /> Editar Almacén</h3>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-surface opacity-40 hover:opacity-80 transition-all"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del almacén" className={INPUT} />
          <input required value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección física" className={INPUT} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="number" step="any" value={latitud} onChange={e => setLatitud(e.target.value)} placeholder="Latitud (-17.764...)" className={INPUT} />
            <input type="number" step="any" value={longitud} onChange={e => setLongitud(e.target.value)} placeholder="Longitud (-63.204...)" className={INPUT} />
          </div>
          <p className="text-[10px] font-bold opacity-40 -mt-2 px-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Coordenadas GPS opcionales para visualización en mapa.
          </p>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="w-1/3 bg-card font-black py-3 rounded-md hover:bg-surface text-text transition-all text-sm">CANCELAR</button>
            <button type="submit" className="w-2/3 bg-primary text-white font-black py-3 rounded-md active:scale-95 hover:brightness-110 transition-all text-sm">GUARDAR →</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditSucursalModal = ({ suc, onClose, onSaved }: { suc: Sucursal; onClose: () => void; onSaved: () => void }) => {
  const [nombre,    setNombre]    = useState(suc.Nombre);
  const [direccion, setDireccion] = useState(suc.Direccion);
  const [telefono,  setTelefono]  = useState(suc.Telefono ?? '');
  const [critico,   setCritico]   = useState(String(suc.StockCritico));
  const [latitud,   setLatitud]   = useState(suc.Latitud ? String(suc.Latitud) : '');
  const [longitud,  setLongitud]  = useState(suc.Longitud ? String(suc.Longitud) : '');

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await warehouseApi.updateSucursal(suc.ID_Sucursal, {
        Nombre: nombre, Direccion: direccion,
        Telefono: telefono || undefined, StockCritico: parseInt(critico),
        Latitud: latitud ? parseFloat(latitud) : undefined,
        Longitud: longitud ? parseFloat(longitud) : undefined,
      });
      toast.success('Sucursal actualizada.');
      onSaved(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error al actualizar.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-card rounded-md w-full max-w-md shadow-2xl border border-divider p-4 sm:p-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-primary flex items-center gap-2"><Pencil className="w-5 h-5" /> Editar Sucursal</h3>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-surface opacity-40 hover:opacity-80 transition-all"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre de sucursal" className={INPUT} />
          <input required value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección física" className={INPUT} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Teléfono" className={INPUT} />
            <input required type="number" min="0" value={critico} onChange={e => setCritico(e.target.value)} placeholder="Stock crítico" className={INPUT} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="number" step="any" value={latitud} onChange={e => setLatitud(e.target.value)} placeholder="Latitud (-17.764...)" className={INPUT} />
            <input type="number" step="any" value={longitud} onChange={e => setLongitud(e.target.value)} placeholder="Longitud (-63.204...)" className={INPUT} />
          </div>
          <p className="text-[10px] font-bold opacity-40 -mt-2 px-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Coordenadas GPS opcionales para visualización en mapa.
          </p>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="w-1/3 bg-card font-black py-3 rounded-md hover:bg-surface text-text transition-all text-sm">CANCELAR</button>
            <button type="submit" className="w-2/3 bg-primary text-white font-black py-3 rounded-md active:scale-95 hover:brightness-110 transition-all text-sm">GUARDAR →</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────

export const AlmacenesPage = () => {
  const { hasPermission, hasRole } = useAuth();

  // Permisos: ADMINISTRADOR siempre puede todo; el resto según permiso explícito
  const isSuperAdmin = hasRole('ADMINISTRADOR');
  const canView = isSuperAdmin || hasPermission('MODULO_ALMACEN');
  const canEdit = isSuperAdmin || hasPermission('MODULO_ALMACEN');

  const [tab,        setTab]        = useState<'almacenes' | 'sucursales'>('almacenes');
  const [almacenes,  setAlmacenes]  = useState<Almacen[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [editingAlm, setEditingAlm] = useState<Almacen | null>(null);
  const [editingSuc, setEditingSuc] = useState<Sucursal | null>(null);
  const [loading,    setLoading]    = useState(true);

  // Form — almacén
  const [almNombre,    setAlmNombre]    = useState('');
  const [almDireccion, setAlmDireccion] = useState('');
  const [almLatitud,   setAlmLatitud]   = useState('');
  const [almLongitud,  setAlmLongitud]  = useState('');

  // Form — sucursal
  const [sucNombre,    setSucNombre]    = useState('');
  const [sucDireccion, setSucDireccion] = useState('');
  const [sucTelefono,  setSucTelefono]  = useState('');
  const [sucCritico,   setSucCritico]   = useState('0');
  const [sucLatitud,   setSucLatitud]   = useState('');
  const [sucLongitud,  setSucLongitud]  = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadAlm = async () => { try { setAlmacenes(await warehouseApi.getAlmacenes()); } catch { /* silent */ } };
  const loadSuc = async () => { try { setSucursales(await warehouseApi.getSucursales()); } catch { /* silent */ } };

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    Promise.all([loadAlm(), loadSuc()]).finally(() => setLoading(false));
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCreateAlm = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await warehouseApi.createAlmacen({
        Nombre: almNombre, Direccion: almDireccion,
        Latitud: almLatitud ? parseFloat(almLatitud) : undefined,
        Longitud: almLongitud ? parseFloat(almLongitud) : undefined,
      });
      toast.success(`Almacén "${almNombre}" registrado.`);
      setAlmNombre(''); setAlmDireccion(''); setAlmLatitud(''); setAlmLongitud(''); loadAlm();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error al crear almacén.'); }
  };

  const handleDeleteAlm = (alm: Almacen) => {
    toast.warning(`¿Eliminar almacén "${alm.Nombre}"?`, {
      action: { label: 'Confirmar', onClick: async () => {
        try { await warehouseApi.deleteAlmacen(alm.ID_Almacen); toast.success('Almacén eliminado.'); loadAlm(); }
        catch (err: any) { toast.error(err.response?.data?.message || 'No se pudo eliminar.'); }
      }},
    });
  };

  const handleCreateSuc = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await warehouseApi.createSucursal({
        Nombre: sucNombre, Direccion: sucDireccion,
        Telefono: sucTelefono || undefined, StockCritico: parseInt(sucCritico),
        Latitud: sucLatitud ? parseFloat(sucLatitud) : undefined,
        Longitud: sucLongitud ? parseFloat(sucLongitud) : undefined,
      });
      toast.success(`Sucursal "${sucNombre}" registrada.`);
      setSucNombre(''); setSucDireccion(''); setSucTelefono(''); setSucCritico('0');
      setSucLatitud(''); setSucLongitud(''); loadSuc();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error al crear sucursal.'); }
  };

  const handleDeleteSuc = (suc: Sucursal) => {
    toast.warning(`¿Eliminar sucursal "${suc.Nombre}"?`, {
      action: { label: 'Confirmar', onClick: async () => {
        try { await warehouseApi.deleteSucursal(suc.ID_Sucursal); toast.success('Sucursal eliminada.'); loadSuc(); }
        catch (err: any) { toast.error(err.response?.data?.message || 'No se pudo eliminar.'); }
      }},
    });
  };

  // ── Sucursal card color según StockCritico ────────────────────────────────

  const criticoBadge = (val: number) => {
    if (val >= 100) return { bar: 'bg-red-500',    badge: 'bg-red-500/10 text-red-500 border-red-500/20',       icon: <ShieldAlert className="w-3.5 h-3.5" /> };
    if (val >= 50)  return { bar: 'bg-amber-500',  badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: <AlertTriangle className="w-3.5 h-3.5" /> };
    return              { bar: 'bg-emerald-500', badge: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: null };
  };

  // ── Sin permiso de lectura ────────────────────────────────────────────────

  if (!loading && !canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-md bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <Lock className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-text dark:text-gray-100 mb-2">Acceso Restringido</h2>
          <p className="font-bold opacity-50 max-w-sm">
            No tienes permiso para ver la gestión de almacenes y sucursales.
            Contacta a un administrador para solicitar acceso.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 w-full relative z-10 transition-all duration-300">

      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-4xl font-black text-primary drop-shadow-sm flex items-center gap-3">
          <Store className="w-10 h-10" /> Gestión de Ubicaciones
        </h2>
        <p className="mt-2 text-lg font-bold text-text opacity-70">
          Almacenes físicos y sucursales de destino de mercancía.
        </p>
        {!canEdit && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 text-sm font-bold">
            <Lock className="w-4 h-4" /> Modo solo lectura — no tienes permiso para crear o modificar registros.
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-3 p-2 bg-card rounded-md w-max border border-divider shadow-sm">
        <button onClick={() => setTab('almacenes')}
          className={`flex items-center gap-2 px-6 py-3 rounded-md font-bold transition-all duration-300 ${tab === 'almacenes' ? 'bg-primary text-white' : 'text-text hover:bg-surface'}`}>
          <Store className="w-4 h-4" /> Almacenes Físicos
          <span className="ml-1 bg-current/20 text-xs font-black px-2 py-0.5 rounded">{almacenes.length}</span>
        </button>
        <button onClick={() => setTab('sucursales')}
          className={`flex items-center gap-2 px-6 py-3 rounded-md font-bold transition-all duration-300 ${tab === 'sucursales' ? 'bg-primary text-white' : 'text-text hover:bg-surface'}`}>
          <Building2 className="w-4 h-4" /> Sucursales de Destino
          <span className="ml-1 bg-current/20 text-xs font-black px-2 py-0.5 rounded">{sucursales.length}</span>
        </button>
      </div>

      <div className={`grid grid-cols-1 gap-8 mt-2 ${canEdit ? 'lg:grid-cols-3' : ''}`}>

        {/* Form panel — solo visible si puede editar */}
        {canEdit && (
          <div className="lg:col-span-1 bg-card border border-divider rounded-md p-4 sm:p-8 shadow-sm relative overflow-hidden h-max">
            <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/20 blur-[60px] rounded-full pointer-events-none" />
            <h3 className="text-xl font-black text-text dark:text-gray-100 mb-6">
              {tab === 'almacenes' ? 'Nuevo Almacén' : 'Nueva Sucursal'}
            </h3>

            {tab === 'almacenes' ? (
              <form onSubmit={handleCreateAlm} className="flex flex-col gap-4 relative z-10">
                <input required value={almNombre} onChange={e => setAlmNombre(e.target.value)} placeholder="Nombre (Ej. Central Warnes)" className={INPUT} />
                <input required value={almDireccion} onChange={e => setAlmDireccion(e.target.value)} placeholder="Dirección física" className={INPUT} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="number" step="any" value={almLatitud} onChange={e => setAlmLatitud(e.target.value)} placeholder="Latitud (GPS)" className={INPUT} />
                  <input type="number" step="any" value={almLongitud} onChange={e => setAlmLongitud(e.target.value)} placeholder="Longitud (GPS)" className={INPUT} />
                </div>
                <p className="text-[10px] font-bold opacity-40 -mt-2 px-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Coordenadas GPS opcionales para el mapa (ej. -17.764, -63.204).
                </p>
                <button type="submit" className="bg-primary hover:brightness-110 text-white font-black uppercase tracking-wider py-3.5 rounded-md flex items-center justify-center gap-2 mt-2 shadow-[0_0_20px_rgba(var(--color-primary),0.3)] active:scale-95 transition-all">
                  <Plus className="w-4 h-4" /> Registrar Almacén
                </button>
              </form>
            ) : (
              <form onSubmit={handleCreateSuc} className="flex flex-col gap-4 relative z-10">
                <input required value={sucNombre} onChange={e => setSucNombre(e.target.value)} placeholder="Nombre (Ej. Sucursal Norte)" className={INPUT} />
                <input required value={sucDireccion} onChange={e => setSucDireccion(e.target.value)} placeholder="Dirección física" className={INPUT} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={sucTelefono} onChange={e => setSucTelefono(e.target.value)} placeholder="Teléfono" className={INPUT} />
                  <input required type="number" min="0" value={sucCritico} onChange={e => setSucCritico(e.target.value)} placeholder="Stock crítico" className={INPUT} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" step="any" value={sucLatitud} onChange={e => setSucLatitud(e.target.value)} placeholder="Latitud (GPS)" className={INPUT} />
                  <input type="number" step="any" value={sucLongitud} onChange={e => setSucLongitud(e.target.value)} placeholder="Longitud (GPS)" className={INPUT} />
                </div>
                <p className="text-[10px] font-bold opacity-40 -mt-2 px-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Stock crítico: umbral mínimo para alertas. GPS: para mapa.
                </p>
                <button type="submit" className="bg-primary hover:brightness-110 text-white font-black uppercase tracking-wider py-3.5 rounded-md flex items-center justify-center gap-2 mt-2 shadow-[0_0_20px_rgba(var(--color-primary),0.3)] active:scale-95 transition-all">
                  <Plus className="w-4 h-4" /> Registrar Sucursal
                </button>
              </form>
            )}
          </div>
        )}

        {/* Content panel */}
        <div className={canEdit ? 'lg:col-span-2' : 'col-span-1'}>

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card rounded-md p-6 animate-pulse border border-divider">
                  <div className="flex gap-4 mb-4">
                    <div className="w-14 h-14 rounded-md bg-surface" />
                    <div className="flex-1 space-y-2 pt-2">
                      <div className="h-3 w-1/3 bg-surface rounded" />
                      <div className="h-5 w-2/3 bg-surface rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-3/4 bg-surface rounded" />
                </div>
              ))}
            </div>
          )}

          {/* ── Almacenes grid ── */}
          {!loading && tab === 'almacenes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {almacenes.map(alm => (
                <div key={alm.ID_Almacen}
                  className="bg-card border border-divider rounded-md p-6 shadow-sm flex flex-col gap-4 hover:-translate-y-1 transition-all hover:border-primary/40 group">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20 flex-shrink-0">
                      <Store className="w-7 h-7 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-70">
                        ALM-{String(alm.ID_Almacen).padStart(4, '0')}
                      </span>
                      <h4 className="text-lg font-black text-text dark:text-gray-100 leading-tight">{alm.Nombre}</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-60 text-sm font-bold">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="line-clamp-1">{alm.Direccion}</span>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingAlm(alm)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95">
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button onClick={() => handleDeleteAlm(alm)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {almacenes.length === 0 && (
                <div className="col-span-2 flex flex-col items-center justify-center py-16 gap-3 opacity-25">
                  <Store className="w-12 h-12" /> <p className="font-black text-sm">Sin almacenes registrados.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Sucursales grid ── */}
          {!loading && tab === 'sucursales' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {sucursales.map(suc => {
                const { bar, badge, icon } = criticoBadge(suc.StockCritico);
                return (
                  <div key={suc.ID_Sucursal}
                    className="bg-card border border-divider rounded-md p-6 shadow-sm flex flex-col gap-4 hover:-translate-y-1 transition-all hover:border-primary/40 group relative overflow-hidden">

                    {/* Stock crítico color bar */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${bar} opacity-70`} />

                    <div className="flex items-start gap-4 pt-1">
                      <div className="w-14 h-14 rounded-md bg-secondary/10 flex items-center justify-center border border-secondary/20 flex-shrink-0">
                        <Building2 className="w-7 h-7 text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-widest text-secondary opacity-70">
                          SUC-{String(suc.ID_Sucursal).padStart(4, '0')}
                        </span>
                        <h4 className="text-lg font-black text-text dark:text-gray-100 leading-tight">{suc.Nombre}</h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-60 text-sm font-bold">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="line-clamp-1">{suc.Direccion}</span>
                    </div>

                    {suc.Telefono && (
                      <div className="flex items-center gap-2 opacity-50 text-sm font-bold -mt-2">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span>{suc.Telefono}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-black border ${badge}`}>
                        {icon} Stock Crítico: {suc.StockCritico}
                      </span>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingSuc(suc)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95">
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                        <button onClick={() => handleDeleteSuc(suc)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95">
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {sucursales.length === 0 && (
                <div className="col-span-2 flex flex-col items-center justify-center py-16 gap-3 opacity-25">
                  <Building2 className="w-12 h-12" /> <p className="font-black text-sm">Sin sucursales registradas.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editingAlm && <EditAlmacenModal alm={editingAlm} onClose={() => setEditingAlm(null)} onSaved={loadAlm} />}
      {editingSuc && <EditSucursalModal suc={editingSuc} onClose={() => setEditingSuc(null)} onSaved={loadSuc} />}
    </div>
  );
};