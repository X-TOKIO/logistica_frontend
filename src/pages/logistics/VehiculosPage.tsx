import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Car, X, Save, User } from 'lucide-react';
import { logisticsCatalogApi } from '../../services/logistics-catalog';
import { authAdminApi } from '../../services/auth.admin';

const ESTADO_OPTS = ['DISPONIBLE', 'EN RUTA', 'MANTENIMIENTO'];

const ESTADO_COLOR: Record<string, string> = {
  'DISPONIBLE':   'bg-green-500/15 text-green-500',
  'EN RUTA':      'bg-blue-500/15 text-blue-500',
  'MANTENIMIENTO':'bg-orange-500/15 text-orange-500',
};

const emptyForm = { Placa: '', Marca: '', Modelo: '', Capacidad_Carga: '', Estado: 'DISPONIBLE', ID_Empleado: '' };

export const VehiculosPage = () => {
  const [vehiculos, setVehiculos]   = useState<any[]>([]);
  const [empleados, setEmpleados]   = useState<any[]>([]);
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<any | null>(null);
  const [form, setForm]             = useState({ ...emptyForm });
  const [loading, setLoading]       = useState(false);

  const load = async () => {
    try {
      const vehs = await logisticsCatalogApi.getVehiculos();
      setVehiculos(vehs);
    } catch (e: any) {
      if (e?.response?.status !== 403) toast.error('No se pudo cargar los vehículos.');
    }
    try {
      const emps = await authAdminApi.getEmpleados();
      setEmpleados(emps);
    } catch {
      // fallo silencioso — el dropdown de choferes no estará disponible sin MODULO_RRHH/TERMINAL
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setShowModal(true); };
  const openEdit   = (v: any) => {
    setEditing(v);
    setForm({
      Placa:          v.Placa || '',
      Marca:          v.Marca || '',
      Modelo:         v.Modelo || '',
      Capacidad_Carga:v.Capacidad_Carga?.toString() || '',
      Estado:         v.Estado || 'DISPONIBLE',
      ID_Empleado:    v.ID_Empleado?.toString() || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.Placa.trim() || !form.Marca.trim() || !form.Modelo.trim())
      return toast.error('Placa, Marca y Modelo son obligatorios.');
    if (!form.Capacidad_Carga || isNaN(Number(form.Capacidad_Carga)))
      return toast.error('Capacidad de carga debe ser un número válido.');

    setLoading(true);
    try {
      const payload = {
        ...form,
        Capacidad_Carga: Number(form.Capacidad_Carga),
        ID_Empleado: form.ID_Empleado ? Number(form.ID_Empleado) : null,
      };
      if (editing) {
        await logisticsCatalogApi.updateVehiculo(editing.ID_Vehiculo, payload);
        toast.success('Vehículo actualizado correctamente.');
      } else {
        await logisticsCatalogApi.createVehiculo(payload);
        toast.success('Vehículo registrado correctamente.');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al guardar el vehículo.');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: number, placa: string) => {
    if (!window.confirm(`¿Eliminar el vehículo con placa "${placa}"?`)) return;
    try {
      await logisticsCatalogApi.removeVehiculo(id);
      toast.success('Vehículo eliminado.');
      load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error al eliminar.'); }
  };

  return (
    <div className="flex flex-col gap-6 w-full relative z-10">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl sm:text-4xl font-black text-cyan-500 dark:text-cyan-400 drop-shadow-sm flex items-center gap-3">
          <Car className="w-9 h-9" /> Gestión de Vehículos
        </h2>
        <button
          onClick={openCreate}
          className="bg-cyan-500/10 text-cyan-500 px-5 py-2.5 rounded-xl hover:bg-cyan-500 hover:text-white transition-colors flex items-center gap-2 font-bold shadow-sm border border-cyan-500/20"
        >
          <Plus className="w-4 h-4" /> Nuevo Vehículo
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/60 dark:bg-black/60 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="bg-cyan-500/10 border-b border-cyan-500/20">
              <tr>
                {['ID','Placa','Marca','Modelo','Cap. (kg)','Chofer Asignado','Estado','Acciones'].map(h => (
                  <th key={h} className="px-5 py-4 text-[11px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {vehiculos.map(v => (
                <tr key={v.ID_Vehiculo} className="hover:bg-cyan-500/5 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs font-black text-cyan-500">#{v.ID_Vehiculo}</td>
                  <td className="px-5 py-4 font-mono font-black text-sm tracking-widest">{v.Placa}</td>
                  <td className="px-5 py-4 font-bold text-sm">{v.Marca}</td>
                  <td className="px-5 py-4 text-sm">{v.Modelo}</td>
                  <td className="px-5 py-4 text-sm font-mono">{Number(v.Capacidad_Carga).toLocaleString()}</td>
                  <td className="px-5 py-4 text-sm">
                    {v.empleado
                      ? <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-cyan-500"/>{v.empleado.Nombre} {v.empleado.Apellido || ''}</span>
                      : <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${ESTADO_COLOR[v.Estado] || 'bg-gray-500/15 text-gray-500'}`}>
                      {v.Estado}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(v)} className="bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white p-2 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(v.ID_Vehiculo, v.Placa)} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {vehiculos.length === 0 && (
                <tr><td colSpan={8} className="text-center py-16 opacity-40 font-bold">Sin vehículos registrados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-background border border-black/10 dark:border-white/10 rounded-[2rem] p-4 sm:p-8 w-full max-w-lg shadow-2xl flex flex-col gap-5 relative">
            <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 text-text opacity-40 hover:opacity-100 transition-opacity">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-2xl font-black text-cyan-500">{editing ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h3>

            <div className="flex flex-col gap-3">
              <input
                placeholder="Placa (ej: ABC-1234) *"
                value={form.Placa}
                onChange={e => setForm(f => ({ ...f, Placa: e.target.value.toUpperCase() }))}
                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-cyan-500 font-mono font-bold tracking-widest"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  placeholder="Marca *"
                  value={form.Marca}
                  onChange={e => setForm(f => ({ ...f, Marca: e.target.value }))}
                  className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-cyan-500 font-medium"
                />
                <input
                  placeholder="Modelo *"
                  value={form.Modelo}
                  onChange={e => setForm(f => ({ ...f, Modelo: e.target.value }))}
                  className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-cyan-500 font-medium"
                />
              </div>
              <input
                type="number"
                placeholder="Capacidad de Carga (kg) *"
                value={form.Capacidad_Carga}
                onChange={e => setForm(f => ({ ...f, Capacidad_Carga: e.target.value }))}
                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-cyan-500 font-medium"
              />
              {/* Chofer */}
              <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-xl px-4 py-1 focus-within:ring-2 ring-cyan-500 transition-all group">
                <User className="w-4 h-4 text-cyan-500 opacity-50 group-focus-within:opacity-100 mr-3 shrink-0" />
                <select
                  value={form.ID_Empleado}
                  onChange={e => setForm(f => ({ ...f, ID_Empleado: e.target.value }))}
                  className="bg-transparent border-none outline-none w-full font-medium py-2.5 text-sm"
                >
                  <option value="">-- Sin Chofer Asignado --</option>
                  {empleados.map(e => (
                    <option key={e.ID_Empleado} value={e.ID_Empleado} className="bg-slate-900 text-white">
                      {e.Nombre} {e.Apellido || ''} ({e.Cargo || 'Sin cargo'})
                    </option>
                  ))}
                </select>
              </div>
              <select
                value={form.Estado}
                onChange={e => setForm(f => ({ ...f, Estado: e.target.value }))}
                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-cyan-500 font-medium"
              >
                {ESTADO_OPTS.map(o => <option key={o} value={o} className="bg-slate-900 text-white">{o}</option>)}
              </select>
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-cyan-500 hover:brightness-110 text-white font-black uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-95 transition-all disabled:opacity-50"
            >
              <Save className="w-5 h-5" /> {loading ? 'Guardando...' : (editing ? 'Actualizar Vehículo' : 'Registrar Vehículo')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
