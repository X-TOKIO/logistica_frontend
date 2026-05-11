import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, MapPinned, X, Save, Navigation } from 'lucide-react';
import { logisticsCatalogApi } from '../../services/logistics-catalog';
import { PARADISO_LOCATIONS, getLocationByName } from '../../constants/paradiso-locations';

const emptyForm = {
  Nombre_Ruta: '',
  Origen: '',
  Destino: '',
  Distancia_KM: '',
  Tiempo_Estimado_Horas: '',
};

const SPEED_KMH = 60;

const formatTiempo = (horas: number): string => {
  if (!horas || isNaN(horas)) return '—';
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  if (h === 0) return `${m} mins`;
  if (m === 0) return `${h} hrs`;
  return `${h} hrs ${m} mins`;
};

export const RutasPage = () => {
  const [rutas, setRutas] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try { setRutas(await logisticsCatalogApi.getRutas()); }
    catch (e: any) { if (e?.response?.status !== 403) toast.error('No se pudo cargar la lista de rutas.'); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm }); setShowModal(true); };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      Nombre_Ruta: r.Nombre_Ruta || '',
      Origen: r.Origen || '',
      Destino: r.Destino || '',
      Distancia_KM: r.Distancia_KM?.toString() || '',
      Tiempo_Estimado_Horas: r.Tiempo_Estimado_Horas?.toString() || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.Nombre_Ruta.trim() || !form.Origen || !form.Destino) {
      return toast.error('Nombre, Origen y Destino son obligatorios.');
    }
    if (form.Origen === form.Destino) {
      return toast.error('El origen y destino no pueden ser el mismo punto.');
    }

    setLoading(true);
    try {
      const locOrigen = getLocationByName(form.Origen);
      const locDestino = getLocationByName(form.Destino);

      const payload: any = {
        Nombre_Ruta: form.Nombre_Ruta,
        Origen: form.Origen,
        Destino: form.Destino,
        Distancia_KM: form.Distancia_KM ? Number(form.Distancia_KM) : undefined,
        Tiempo_Estimado_Horas: form.Tiempo_Estimado_Horas ? Number(form.Tiempo_Estimado_Horas) : undefined,
      };

      // Guardar coordenadas automáticamente desde PARADISO_LOCATIONS
      if (locOrigen) {
        payload.LatitudOrigen = locOrigen.lat;
        payload.LongitudOrigen = locOrigen.lng;
      }
      if (locDestino) {
        payload.LatitudDestino = locDestino.lat;
        payload.LongitudDestino = locDestino.lng;
      }

      if (editing) {
        await logisticsCatalogApi.updateRuta(editing.ID_Ruta, payload);
        toast.success('Ruta actualizada correctamente.');
      } else {
        await logisticsCatalogApi.createRuta(payload);
        toast.success('Ruta registrada con coordenadas GPS correctas.');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al guardar la ruta.');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: number, nombre: string) => {
    if (!window.confirm(`¿Eliminar la ruta "${nombre}"?`)) return;
    try {
      await logisticsCatalogApi.removeRuta(id);
      toast.success('Ruta eliminada.');
      load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error al eliminar.'); }
  };

  const previewData = (() => {
    const locO = getLocationByName(form.Origen);
    const locD = getLocationByName(form.Destino);
    if (!locO || !locD) return null;
    const R = 6371;
    const dLat = ((locD.lat - locO.lat) * Math.PI) / 180;
    const dLng = ((locD.lng - locO.lng) * Math.PI) / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(locO.lat*Math.PI/180)*Math.cos(locD.lat*Math.PI/180)*Math.sin(dLng/2)**2;
    const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const horas = km / SPEED_KMH;
    return { km: km.toFixed(1), horas };
  })();

  return (
    <div className="flex flex-col gap-6 w-full relative z-10">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl sm:text-4xl font-black text-violet-500 dark:text-violet-400 drop-shadow-sm flex items-center gap-3">
          <MapPinned className="w-9 h-9" /> Gestión de Rutas
        </h2>
        <button
          onClick={openCreate}
          className="bg-violet-500/10 text-violet-500 px-5 py-2.5 rounded-xl hover:bg-violet-500 hover:text-white transition-colors flex items-center gap-2 font-bold shadow-sm border border-violet-500/20"
        >
          <Plus className="w-4 h-4" /> Nueva Ruta
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/60 dark:bg-black/60 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="bg-violet-500/10 border-b border-violet-500/20">
              <tr>
                {['ID','Nombre de Ruta','Origen','Destino','Distancia (km)','T. Estimado','GPS','Acciones'].map(h => (
                  <th key={h} className="px-5 py-4 text-[11px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {rutas.map(r => (
                <tr key={r.ID_Ruta} className="hover:bg-violet-500/5 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs font-black text-violet-500">#{r.ID_Ruta}</td>
                  <td className="px-5 py-4 font-bold text-sm">{r.Nombre_Ruta || <span className="opacity-30">—</span>}</td>
                  <td className="px-5 py-4 text-sm max-w-[140px] truncate" title={r.Origen}>{r.Origen || <span className="opacity-30">—</span>}</td>
                  <td className="px-5 py-4 text-sm max-w-[140px] truncate" title={r.Destino}>{r.Destino || <span className="opacity-30">—</span>}</td>
                  <td className="px-5 py-4 font-mono text-sm">
                    {r.Distancia_KM ? <span className="text-violet-500 font-black">{Number(r.Distancia_KM).toFixed(1)} km</span> : <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-5 py-4 font-mono text-sm">
                    {r.Tiempo_Estimado_Horas
                      ? <span className="text-violet-500 font-black">{formatTiempo(Number(r.Tiempo_Estimado_Horas))}</span>
                      : <span className="opacity-30">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    {r.LatitudOrigen
                      ? <span className="bg-green-500/15 text-green-500 px-2 py-0.5 rounded-full text-[10px] font-black">GPS OK</span>
                      : <span className="bg-gray-500/15 text-gray-400 px-2 py-0.5 rounded-full text-[10px] font-black">Sin GPS</span>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(r)} className="bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white p-2 rounded-lg transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(r.ID_Ruta, r.Nombre_Ruta || `#${r.ID_Ruta}`)} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rutas.length === 0 && (
                <tr><td colSpan={8} className="text-center py-16 opacity-40 font-bold">Sin rutas registradas.</td></tr>
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
            <h3 className="text-2xl font-black text-violet-500">{editing ? 'Editar Ruta' : 'Nueva Ruta'}</h3>

            <div className="flex flex-col gap-3">
              <input
                placeholder="Nombre de la Ruta *"
                value={form.Nombre_Ruta}
                onChange={e => setForm(f => ({ ...f, Nombre_Ruta: e.target.value }))}
                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-violet-500 font-medium"
              />

              {/* Origen dropdown */}
              <select
                value={form.Origen}
                onChange={e => setForm(f => ({ ...f, Origen: e.target.value }))}
                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-violet-500 font-medium"
              >
                <option value="">-- Punto de Origen * --</option>
                {PARADISO_LOCATIONS.map(l => (
                  <option key={l.nombre} value={l.nombre} className="bg-slate-900 text-white">{l.nombre}</option>
                ))}
              </select>

              {/* Destino dropdown */}
              <select
                value={form.Destino}
                onChange={e => setForm(f => ({ ...f, Destino: e.target.value }))}
                className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-violet-500 font-medium"
              >
                <option value="">-- Punto de Destino * --</option>
                {PARADISO_LOCATIONS.filter(l => l.nombre !== form.Origen).map(l => (
                  <option key={l.nombre} value={l.nombre} className="bg-slate-900 text-white">{l.nombre}</option>
                ))}
              </select>

              {/* Preview de distancia y tiempo */}
              {previewData && (
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 flex flex-col gap-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-violet-500 shrink-0" />
                    <span className="font-bold text-violet-500">Dist. lineal aprox.: {previewData.km} km</span>
                    <span className="opacity-50 text-xs">(OSRM calcula la real)</span>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <span className="font-bold text-violet-400 text-xs">
                      Tiempo estimado a {SPEED_KMH} km/h: <span className="text-violet-500">{formatTiempo(previewData.horas)}</span>
                    </span>
                  </div>
                </div>
              )}

              {previewData && !form.Distancia_KM && (
                <button
                  type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    Distancia_KM: previewData.km,
                    Tiempo_Estimado_Horas: previewData.horas.toFixed(4),
                  }))}
                  className="text-violet-500 text-xs font-bold underline text-left"
                >
                  Autocompletar distancia ({previewData.km} km) y tiempo ({formatTiempo(previewData.horas)})
                </button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Distancia real (km)"
                  value={form.Distancia_KM}
                  onChange={e => setForm(f => ({ ...f, Distancia_KM: e.target.value }))}
                  className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-violet-500 font-medium"
                />
                <input
                  type="number"
                  placeholder="Tiempo estimado (h)"
                  value={form.Tiempo_Estimado_Horas}
                  onChange={e => setForm(f => ({ ...f, Tiempo_Estimado_Horas: e.target.value }))}
                  className="w-full bg-black/5 dark:bg-white/5 rounded-xl px-4 py-3.5 outline-none focus:ring-2 ring-violet-500 font-medium"
                />
              </div>

              {form.Origen && form.Destino && (
                <div className="text-[10px] font-black uppercase tracking-widest text-green-500 opacity-70 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Coordenadas GPS se guardarán automáticamente al registrar.
                </div>
              )}
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-violet-500 hover:brightness-110 text-white font-black uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.3)] active:scale-95 transition-all disabled:opacity-50"
            >
              <Save className="w-5 h-5" /> {loading ? 'Guardando...' : (editing ? 'Actualizar Ruta' : 'Registrar Ruta')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
