import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { warehouseApi } from '../../services/warehouse';
import { Tags, Ruler, Plus, Pencil, Trash2, X, Scale } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

type Categoria = { ID_Categoria: number; NombreC: string; Descripcion?: string };
type UMedida   = { ID_Medida: number; Nombre: string; Abreviatura: string; Unidades_Bulto: string };

const INPUT = 'bg-black/5 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary border border-transparent dark:border-slate-700 font-bold dark:text-gray-200 w-full';

// ── Edit Modals ────────────────────────────────────────────────────────────

const EditCatModal = ({ cat, onClose, onSaved }: { cat: Categoria; onClose: () => void; onSaved: () => void }) => {
  const [nombre, setNombre] = useState(cat.NombreC);
  const [desc,   setDesc]   = useState(cat.Descripcion ?? '');

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await warehouseApi.updateCategoria(cat.ID_Categoria, { NombreC: nombre, Descripcion: desc || undefined });
      toast.success('Categoría actualizada.');
      onSaved(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error al actualizar.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-background dark:bg-[#0B0D14] rounded-3xl w-full max-w-md shadow-2xl border border-black/10 dark:border-slate-700 p-4 sm:p-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-blue-500 flex items-center gap-2"><Pencil className="w-5 h-5" /> Editar Categoría</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/8 dark:hover:bg-white/8 opacity-40 hover:opacity-80 transition-all"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre de categoría" className={INPUT} />
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (opcional)" className={INPUT} />
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="w-1/3 bg-black/8 dark:bg-slate-800 font-black py-3 rounded-xl hover:bg-black/15 dark:hover:bg-slate-700 dark:text-gray-200 transition-all text-sm">CANCELAR</button>
            <button type="submit" className="w-2/3 bg-blue-500 text-white font-black py-3 rounded-xl active:scale-95 hover:brightness-110 transition-all text-sm">GUARDAR →</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditMedModal = ({ med, onClose, onSaved }: { med: UMedida; onClose: () => void; onSaved: () => void }) => {
  const [nombre,         setNombre]         = useState(med.Nombre);
  const [abrev,          setAbrev]          = useState(med.Abreviatura);
  const [unidadesBulto,  setUnidadesBulto]  = useState(String(med.Unidades_Bulto ?? 1));

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await warehouseApi.updateMedida(med.ID_Medida, { Nombre: nombre, Abreviatura: abrev, Unidades_Bulto: unidadesBulto });
      toast.success('Unidad de medida actualizada.');
      onSaved(); onClose();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error al actualizar.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-background dark:bg-[#0B0D14] rounded-3xl w-full max-w-md shadow-2xl border border-black/10 dark:border-slate-700 p-4 sm:p-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-blue-500 flex items-center gap-2"><Pencil className="w-5 h-5" /> Editar Unidad</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/8 dark:hover:bg-white/8 opacity-40 hover:opacity-80 transition-all"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre (Ej. Caja)" className={INPUT} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required value={abrev} onChange={e => setAbrev(e.target.value)} placeholder="Abrev. (Ej. Cja)" className={INPUT} />
            <input required type="text" value={unidadesBulto} onChange={e => setUnidadesBulto(e.target.value)} placeholder="Uds/Bulto (ej: 1x12)" className={INPUT} />
          </div>
          <p className="text-[10px] font-bold opacity-40 -mt-2 px-1">Unidades que contiene un bulto/empaque (ej: 1x12, 1x6).</p>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="w-1/3 bg-black/8 dark:bg-slate-800 font-black py-3 rounded-xl hover:bg-black/15 dark:hover:bg-slate-700 dark:text-gray-200 transition-all text-sm">CANCELAR</button>
            <button type="submit" className="w-2/3 bg-blue-500 text-white font-black py-3 rounded-xl active:scale-95 hover:brightness-110 transition-all text-sm">GUARDAR →</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────

export const CategoriasPage = () => {
  const [tab,        setTab]       = useState<'categorias' | 'medidas'>('categorias');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [medidas,    setMedidas]   = useState<UMedida[]>([]);
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [editingMed, setEditingMed] = useState<UMedida | null>(null);

  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [medName,         setMedName]         = useState('');
  const [medAbrev,        setMedAbrev]        = useState('');
  const [medUnidadesBulto, setMedUnidadesBulto] = useState('1');

  const loadCats = async () => { try { setCategorias(await warehouseApi.getCategorias()); } catch { /* silent */ } };
  const loadMeds = async () => { try { setMedidas(await warehouseApi.getMedidas()); } catch { /* silent */ } };

  useEffect(() => { loadCats(); loadMeds(); }, []);

  const handleCreateCat = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await warehouseApi.createCategoria({ NombreC: catName, Descripcion: catDesc || undefined });
      toast.success(`Categoría "${catName}" creada.`);
      setCatName(''); setCatDesc(''); loadCats();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error al crear categoría.'); }
  };

  const handleDeleteCat = (cat: Categoria) => {
    toast.warning(`¿Eliminar "${cat.NombreC}"?`, {
      action: { label: 'Confirmar', onClick: async () => {
        try { await warehouseApi.deleteCategoria(cat.ID_Categoria); toast.success('Eliminada.'); loadCats(); }
        catch (err: any) { toast.error(err.response?.data?.message || 'No se pudo eliminar.'); }
      }},
    });
  };

  const handleCreateMed = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await warehouseApi.createMedida({ Nombre: medName, Abreviatura: medAbrev, Unidades_Bulto: medUnidadesBulto });
      toast.success(`Unidad "${medName}" creada.`);
      setMedName(''); setMedAbrev(''); setMedUnidadesBulto('1'); loadMeds();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error al crear unidad.'); }
  };

  const handleDeleteMed = (med: UMedida) => {
    toast.warning(`¿Eliminar "${med.Nombre}"?`, {
      action: { label: 'Confirmar', onClick: async () => {
        try { await warehouseApi.deleteMedida(med.ID_Medida); toast.success('Eliminada.'); loadMeds(); }
        catch (err: any) { toast.error(err.response?.data?.message || 'No se pudo eliminar.'); }
      }},
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full relative z-10 transition-all duration-300">

      <div>
        <h2 className="text-2xl sm:text-4xl font-black text-primary drop-shadow-sm flex items-center gap-3">
          <Tags className="w-10 h-10" /> Maestros del Catálogo
        </h2>
        <p className="mt-2 text-lg font-bold text-text opacity-70">Categorías y unidades de medida del inventario.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 p-2 bg-white/60 dark:bg-black/60 rounded-[1.5rem] backdrop-blur-md w-max border border-black/10 dark:border-slate-700 shadow-lg">
        {(['categorias', 'medidas'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${tab === t ? 'bg-primary text-white shadow-[0_0_15px_rgba(var(--color-primary),0.4)]' : 'text-text dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5'}`}>
            {t === 'categorias' ? <><Tags className="w-4 h-4" /> Categorías</> : <><Ruler className="w-4 h-4" /> Unidades de Medida</>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-2">

        {/* Form panel */}
        <div className="lg:col-span-1 bg-white/60 dark:bg-black/60 backdrop-blur-3xl border border-black/10 dark:border-slate-700 rounded-[2rem] p-4 sm:p-8 shadow-2xl relative overflow-hidden h-max">
          <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/20 blur-[60px] rounded-full pointer-events-none" />
          <h3 className="text-xl font-black text-text dark:text-gray-100 mb-6">
            {tab === 'categorias' ? 'Nueva Categoría' : 'Nueva Unidad'}
          </h3>

          {tab === 'categorias' ? (
            <form onSubmit={handleCreateCat} className="flex flex-col gap-4 relative z-10">
              <input required value={catName} onChange={e => setCatName(e.target.value)} placeholder="Nombre (Ej. Lácteos)" className={INPUT} />
              <input value={catDesc} onChange={e => setCatDesc(e.target.value)} placeholder="Descripción opcional" className={INPUT} />
              <button type="submit" className="bg-primary hover:brightness-110 text-white font-black uppercase tracking-wider py-3.5 rounded-xl flex items-center justify-center gap-2 mt-2 shadow-[0_0_20px_rgba(var(--color-primary),0.3)] active:scale-95 transition-all">
                <Plus className="w-4 h-4" /> Crear Categoría
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreateMed} className="flex flex-col gap-4 relative z-10">
              <input required value={medName} onChange={e => setMedName(e.target.value)} placeholder="Nombre (Ej. Caja, Chipa)" className={INPUT} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input required value={medAbrev} onChange={e => setMedAbrev(e.target.value)} placeholder="Abrev. (Ej. Cja)" className={INPUT} />
                <input required type="text" value={medUnidadesBulto} onChange={e => setMedUnidadesBulto(e.target.value)} placeholder="Uds/Bulto (ej: 1x12)" className={INPUT} />
              </div>
              <p className="text-[10px] font-bold opacity-40 -mt-2 px-1">Ej: Caja 1×12 → 12 · Chipa 1×6 → 6 · Unidad → 1.</p>
              <button type="submit" className="bg-primary hover:brightness-110 text-white font-black uppercase tracking-wider py-3.5 rounded-xl flex items-center justify-center gap-2 mt-2 shadow-[0_0_20px_rgba(var(--color-primary),0.3)] active:scale-95 transition-all">
                <Plus className="w-4 h-4" /> Crear Unidad
              </button>
            </form>
          )}
        </div>

        {/* Table */}
        <div className="lg:col-span-2 bg-white/40 dark:bg-black/40 backdrop-blur-3xl border border-black/10 dark:border-slate-700 rounded-[2rem] shadow-2xl overflow-hidden">
          {tab === 'categorias' ? (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-black/5 dark:bg-slate-800 border-b border-black/10 dark:border-slate-700">
                <tr>
                  <th className="p-4 font-black text-xs tracking-wider uppercase text-text dark:text-gray-200">ID</th>
                  <th className="p-4 font-black text-xs tracking-wider uppercase text-text dark:text-gray-200">Nombre</th>
                  <th className="p-4 font-black text-xs tracking-wider uppercase text-text dark:text-gray-200">Descripción</th>
                  <th className="p-4 font-black text-xs tracking-wider uppercase text-text dark:text-gray-200 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-slate-700/50">
                {categorias.map(c => (
                  <tr key={c.ID_Categoria} className="hover:bg-primary/4 dark:hover:bg-primary/6 transition-colors group">
                    <td className="p-4 font-mono text-xs font-bold text-secondary">CAT-{String(c.ID_Categoria).padStart(3, '0')}</td>
                    <td className="p-4 font-black text-text dark:text-gray-200">{c.NombreC}</td>
                    <td className="p-4 text-sm font-bold opacity-50 dark:text-gray-400">{c.Descripcion || '—'}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingCat(c)} className="p-2 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all active:scale-95"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteCat(c)} className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="bg-black/5 dark:bg-slate-800 border-b border-black/10 dark:border-slate-700">
                <tr>
                  <th className="p-4 font-black text-xs tracking-wider uppercase text-text dark:text-gray-200">ID</th>
                  <th className="p-4 font-black text-xs tracking-wider uppercase text-text dark:text-gray-200">Nombre</th>
                  <th className="p-4 font-black text-xs tracking-wider uppercase text-text dark:text-gray-200">Abreviatura</th>
                  <th className="p-4 font-black text-xs tracking-wider uppercase text-text dark:text-gray-200"><div className="flex items-center gap-1"><Scale className="w-3.5 h-3.5" /> Uds. por Bulto</div></th>
                  <th className="p-4 font-black text-xs tracking-wider uppercase text-text dark:text-gray-200 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-slate-700/50">
                {medidas.map(m => (
                  <tr key={m.ID_Medida} className="hover:bg-primary/4 dark:hover:bg-primary/6 transition-colors group">
                    <td className="p-4 font-mono text-xs font-bold text-secondary">UMD-{String(m.ID_Medida).padStart(3, '0')}</td>
                    <td className="p-4 font-black text-text dark:text-gray-200">{m.Nombre}</td>
                    <td className="p-4"><span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-black bg-primary/10 text-primary border border-primary/20">{m.Abreviatura}</span></td>
                    <td className="p-4 font-bold font-mono text-sm dark:text-gray-300">{m.Unidades_Bulto ?? '1'}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingMed(m)} className="p-2 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all active:scale-95"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteMed(m)} className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}

          {((tab === 'categorias' && categorias.length === 0) || (tab === 'medidas' && medidas.length === 0)) && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-25">
              {tab === 'categorias' ? <Tags className="w-12 h-12" /> : <Ruler className="w-12 h-12" />}
              <p className="font-black text-sm">No hay registros. Crea el primero.</p>
            </div>
          )}
        </div>
      </div>

      {editingCat && <EditCatModal cat={editingCat} onClose={() => setEditingCat(null)} onSaved={loadCats} />}
      {editingMed && <EditMedModal med={editingMed} onClose={() => setEditingMed(null)} onSaved={loadMeds} />}
    </div>
  );
};
