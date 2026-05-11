import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Building2, X, Save } from 'lucide-react';
import { logisticsCatalogApi } from '../../services/logistics-catalog';

const ESTADO_OPTS = ['ACTIVO', 'INACTIVO'];

const emptyForm = {
  Nombre_RazonSocial: '',
  NIT: '',
  Telefono: '',
  Direccion: '',
  Estado: 'ACTIVO',
};

export const ProveedoresPage = () => {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try { setProveedores(await logisticsCatalogApi.getProveedores()); }
    catch (e: any) { if (e?.response?.status !== 403) toast.error('No se pudo cargar la lista de proveedores.'); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setShowModal(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      Nombre_RazonSocial: p.Nombre_RazonSocial || '',
      NIT: p.NIT || '',
      Telefono: p.Telefono || '',
      Direccion: p.Direccion || '',
      Estado: p.Estado || 'ACTIVO',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.Nombre_RazonSocial.trim() || !form.NIT.trim()) {
      return toast.error('Nombre/Razón Social y NIT son obligatorios.');
    }
    setLoading(true);
    try {
      if (editing) {
        await logisticsCatalogApi.updateProveedor(editing.ID_Proveedor, form);
        toast.success('Proveedor actualizado correctamente.');
      } else {
        await logisticsCatalogApi.createProveedor(form);
        toast.success('Proveedor registrado correctamente.');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al guardar el proveedor.');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: number, nombre: string) => {
    if (!window.confirm(`¿Desactivar el proveedor "${nombre}"?`)) return;
    try {
      await logisticsCatalogApi.removeProveedor(id);
      toast.success('Proveedor desactivado.');
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al desactivar.');
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full relative z-10">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl sm:text-4xl font-black text-amber-500 dark:text-amber-400 drop-shadow-sm flex items-center gap-3">
          <Building2 className="w-9 h-9" /> Gestión de Proveedores
        </h2>
        <button
          onClick={openCreate}
          className="bg-amber-500/10 text-amber-500 px-5 py-2.5 rounded-xl hover:bg-amber-500 hover:text-white transition-colors flex items-center gap-2 font-bold shadow-sm border border-amber-500/20"
        >
          <Plus className="w-4 h-4" /> Nuevo Proveedor
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/60 dark:bg-black/60 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
            <thead className="bg-amber-500/10 border-b border-amber-500/20">
              <tr>
                {['ID', 'Nombre / Razón Social', 'NIT', 'Teléfono', 'Dirección', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="px-5 py-4 text-[11px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {proveedores.map(p => (
                <tr key={p.ID_Proveedor} className="hover:bg-amber-500/5 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs font-black text-amber-500">#{p.ID_Proveedor}</td>
                  <td className="px-5 py-4 font-bold text-sm">{p.Nombre_RazonSocial}</td>
                  <td className="px-5 py-4 font-mono text-sm">{p.NIT}</td>
                  <td className="px-5 py-4 text-sm">{p.Telefono || '—'}</td>
                  <td className="px-5 py-4 text-sm max-w-[200px] truncate" title={p.Direccion}>{p.Direccion || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${p.Estado === 'ACTIVO' ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'}`}>
                      {p.Estado}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(p)} className="bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white p-2 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p.ID_Proveedor, p.Nombre_RazonSocial)} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {proveedores.length === 0 && (
                <tr><td colSpan={7} className="text-center py-16 opacity-40 font-bold">Sin proveedores registrados.</td></tr>
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
            <h3 className="text-2xl font-black text-amber-500">{editing ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>

            <div className="flex flex-col gap-3">
              <input
                placeholder="Nombre / Razón Social *"
                value={form.Nombre_RazonSocial}
                onChange={e => setForm(f => ({ ...f, Nombre_RazonSocial: e.target.value }))}
                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-amber-500 font-medium"
              />
              <input
                placeholder="NIT *"
                value={form.NIT}
                onChange={e => setForm(f => ({ ...f, NIT: e.target.value }))}
                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-amber-500 font-medium"
              />
              <input
                placeholder="Teléfono"
                value={form.Telefono}
                onChange={e => setForm(f => ({ ...f, Telefono: e.target.value }))}
                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-amber-500 font-medium"
              />
              <input
                placeholder="Dirección"
                value={form.Direccion}
                onChange={e => setForm(f => ({ ...f, Direccion: e.target.value }))}
                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-amber-500 font-medium"
              />
              <select
                value={form.Estado}
                onChange={e => setForm(f => ({ ...f, Estado: e.target.value }))}
                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-amber-500 font-medium"
              >
                {ESTADO_OPTS.map(o => <option key={o} value={o} className="bg-slate-900 text-white">{o}</option>)}
              </select>
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-amber-500 hover:brightness-110 text-white font-black uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.3)] active:scale-95 transition-all disabled:opacity-50"
            >
              <Save className="w-5 h-5" /> {loading ? 'Guardando...' : (editing ? 'Actualizar Proveedor' : 'Registrar Proveedor')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
