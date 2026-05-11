import { toast } from 'sonner';
import { useEffect, useState, useCallback, useRef } from 'react';
import { warehouseApi } from '../../services/warehouse';
import { usePermissions, type GuardFn } from '../../hooks/usePermissions';
import {
  Package, Search, PlusCircle, Eye, Pencil, Trash2, X,
  QrCode, Tag, Ruler, Boxes, DollarSign, Store,
  ChevronDown, PackageOpen, LayoutGrid, List,
  FileDown, Upload, ImageOff, Heart,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:3000';

const INPUT = 'bg-surface rounded-md px-4 py-3 outline-none focus:ring-2 ring-primary border border-divider font-bold text-text w-full';

const CAT_COLORS = [
  'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'bg-violet-500/10 text-violet-500 border-violet-500/20',
  'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  'bg-amber-500/10 text-amber-500 border-amber-500/20',
  'bg-rose-500/10 text-rose-500 border-rose-500/20',
  'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  'bg-orange-500/10 text-orange-500 border-orange-500/20',
];

// ── Types ──────────────────────────────────────────────────────────────────

type StockEntry = {
  ID_Producto: number; ID_Almacen: number; Stock_Actual: number;
  almacen?: { ID_Almacen: number; Nombre: string; Direccion: string };
};
type Producto = {
  ID_Producto: number; CodigoBarra?: string; Nombre: string;
  Descripcion?: string; FechaVencimiento?: string; Fecha_Elaboracion?: string; Image?: string;
  Ubicacion?: string; PrecioUnitario: number; ID_Medida: number; ID_Categoria: number;
  categoria?: { ID_Categoria: number; NombreC: string };
  medida?: { ID_Medida: number; Nombre: string; Abreviatura: string; Unidades_Bulto: string; factor_conversion: number };
  stocks?: StockEntry[];
  productoAlmacenes?: StockEntry[];
};
type Categoria = { ID_Categoria: number; NombreC: string };
type Almacen   = { ID_Almacen: number; Nombre: string };
type UMedida   = { ID_Medida: number; Nombre: string; Abreviatura: string; Unidades_Bulto: string; factor_conversion: number };

// ── Helpers ────────────────────────────────────────────────────────────────

const catColor    = (id: number) => CAT_COLORS[id % CAT_COLORS.length];
const stockTotal  = (p: Producto) => {
  // Lee desde productoAlmacenes (join backend) o desde stocks (carga separada)
  const entries = p.productoAlmacenes || p.stocks || [];
  return entries.reduce((s, e) => s + Number(e.Stock_Actual), 0);
};
const fmtDate     = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-BO', { dateStyle: 'medium' }) : '—';
const resolveImg  = (url?: string | null): string => {
  if (!url) return '';
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
};
const stockBadge  = (total: number) =>
  total === 0 ? 'bg-red-500/10 text-red-500 border-red-500/20'
  : total < 10 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
const stockLabel  = (total: number) =>
  total === 0 ? 'Agotado' : total < 10 ? 'Stock Crítico' : 'En Stock';
const parseBulto  = (ub?: string): number => {
  const m = ub?.match(/[xX×*](\d+)/);
  if (m) return Math.max(1, parseInt(m[1], 10));
  const n = parseInt(ub ?? '1', 10);
  return isNaN(n) ? 1 : Math.max(1, n);
};
const factorConv  = (p: Producto): number => {
  const fc = Math.max(1, Number(p.medida?.factor_conversion ?? 1));
  return fc > 1 ? fc : parseBulto(p.medida?.Unidades_Bulto);
};
const stockPkgs   = (p: Producto) => Math.floor(stockTotal(p) / factorConv(p));

// ── Skeleton ───────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr className="animate-pulse border-b border-divider">
    {[44, 88, 180, 110, 70, 70, 80, 90].map((w, i) => (
      <td key={i} className="p-4">
        <div className="h-4 bg-surface rounded" style={{ width: w }} />
      </td>
    ))}
  </tr>
);

const SkeletonCard = () => (
  <div className="animate-pulse bg-card rounded-md overflow-hidden border border-divider">
    <div className="h-44 bg-surface" />
    <div className="p-5 flex flex-col gap-3">
      <div className="h-3 w-16 bg-surface rounded" />
      <div className="h-5 w-2/3 bg-surface rounded" />
      <div className="h-4 w-1/2 bg-surface rounded" />
    </div>
  </div>
);

// ── Detail Modal ───────────────────────────────────────────────────────────

const DetailModal = ({ producto: p, onClose, onEdit, onDelete, guardAction }: {
  producto: Producto; onClose: () => void;
  onEdit: (p: Producto) => void; onDelete: (p: Producto) => void;
  guardAction: GuardFn;
}) => {
  const total = stockTotal(p);
  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex flex-col gap-0.5">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30">{label}</p>
      <p className="text-sm font-bold text-text">{value || '—'}</p>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-2 sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-md w-full max-w-xl shadow-2xl border border-divider overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b border-divider bg-surface flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
            <div className="w-full sm:w-48 h-32 sm:h-48 rounded-md bg-surface flex-shrink-0 overflow-hidden flex items-center justify-center border border-divider">
              {p.Image ? <img src={resolveImg(p.Image)} alt={p.Nombre} className="w-full h-full object-cover" /> : <Package className="w-16 h-16 opacity-20" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 mb-1">PRD-{String(p.ID_Producto).padStart(4, '0')}</p>
              <h3 className="text-xl font-black text-text dark:text-gray-100 leading-tight">{p.Nombre}</h3>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {p.categoria && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black border ${catColor(p.ID_Categoria)}`}>
                    <Tag className="w-3 h-3" /> {p.categoria.NombreC}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-black bg-primary/10 text-primary border border-primary/20">
                  <DollarSign className="w-3 h-3" /> Bs. {Number(p.PrecioUnitario).toFixed(2)}
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-md hover:bg-surface text-text opacity-40 hover:opacity-80 transition-all flex-shrink-0"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="px-4 sm:px-8 py-4 sm:py-6 overflow-y-auto flex-1 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Código de Lote" value={<span className="font-mono">{p.CodigoBarra || '—'}</span>} />
            <Field label="Unidad de Medida" value={p.medida ? `${p.medida.Nombre} (${p.medida.Abreviatura})` : '—'} />
            <Field label="Ubicación" value={p.Ubicacion} />
            <Field label="Fecha de Elaboración" value={fmtDate(p.Fecha_Elaboracion)} />
            <Field label="Fecha de Vencimiento" value={fmtDate(p.FechaVencimiento)} />
            {p.Descripcion && <div className="col-span-2"><Field label="Descripción" value={p.Descripcion} /></div>}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-3">Existencias</p>
            {total > 0 ? (
              <div className="bg-primary/10 border border-primary/20 rounded-md p-4 flex items-center gap-4">
                <Boxes className="w-6 h-6 text-primary flex-shrink-0" />
                <div className="flex items-end gap-4 flex-wrap">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-0.5">Paquetes</span>
                    <span className="text-2xl font-black text-amber-500 dark:text-amber-400 leading-none">{stockPkgs(p)}</span>
                  </div>
                  <span className="text-2xl font-black opacity-20 mb-0.5">|</span>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-0.5">Unidades</span>
                    <span className="text-2xl font-black text-primary leading-none">{total.toFixed(0)}</span>
                  </div>
                  {p.medida?.factor_conversion && p.medida.factor_conversion > 1 && (
                    <span className="text-[10px] font-bold opacity-40 self-end mb-0.5">
                      1 paq = {p.medida.factor_conversion} uds.
                    </span>
                  )}
                </div>
              </div>
            ) : <p className="text-sm font-bold opacity-40 italic">Sin stock registrado en ningún almacén.</p>}
          </div>
        </div>
        <div className="px-4 sm:px-8 py-4 sm:py-5 border-t border-divider flex items-center gap-3 bg-surface flex-shrink-0 flex-wrap">
          <button onClick={guardAction('MODULO_CATALOGO', () => { onClose(); onEdit(p); })} className="flex items-center gap-2 bg-primary/10 hover:bg-primary text-primary hover:text-white px-5 py-2.5 rounded-md text-xs font-black uppercase tracking-wider transition-all active:scale-95"><Pencil className="w-3.5 h-3.5" /> Editar</button>
          <button onClick={guardAction('MODULO_CATALOGO', () => { onClose(); onDelete(p); })} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-5 py-2.5 rounded-md text-xs font-black uppercase tracking-wider transition-all active:scale-95"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
          <button onClick={onClose} className="ml-auto px-5 py-2.5 bg-card hover:bg-surface text-text rounded-md text-xs font-black uppercase tracking-wider transition-all">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

// ── Image Drop Zone ────────────────────────────────────────────────────────

const ImageDropZone = ({
  preview, onFile,
}: {
  preview: string;
  onFile: (file: File) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setOver(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.(jpg|jpeg|png|webp)$/i.test(file.name)) onFile(file);
    else toast.error('Solo se permiten imágenes jpg, png o webp.');
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative w-full h-44 rounded-md border-2 border-dashed cursor-pointer transition-all overflow-hidden flex items-center justify-center
        ${over ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-divider bg-surface hover:border-primary/50 hover:bg-primary/5'}`}
    >
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleChange} />
      {preview ? (
        <>
          <img src={preview} alt="preview" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
            <Upload className="w-6 h-6 text-white" />
            <span className="text-white text-xs font-black">Cambiar imagen</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <p className="text-sm font-bold opacity-50">Arrastra una imagen aquí</p>
          <p className="text-[11px] font-bold opacity-30">JPG · PNG · WEBP · máx. 5 MB</p>
        </div>
      )}
    </div>
  );
};

// ── Product Form Modal ─────────────────────────────────────────────────────

const emptyForm = () => ({
  Nombre: '', CodigoBarra: '', Descripcion: '', PrecioUnitario: '',
  FechaVencimiento: '', Fecha_Elaboracion: '', Ubicacion: '', ID_Categoria: '', ID_Medida: '',
});

const FormModal = ({ initial, categorias, medidas, onClose, onSaved }: {
  initial?: Producto | null;
  categorias: Categoria[]; medidas: UMedida[];
  onClose: () => void; onSaved: () => void;
}) => {
  const isEdit = !!initial;
  const [form, setForm] = useState(() =>
    initial ? {
      Nombre: initial.Nombre ?? '', CodigoBarra: initial.CodigoBarra ?? '',
      Descripcion: initial.Descripcion ?? '',
      PrecioUnitario: String(initial.PrecioUnitario ?? ''),
      FechaVencimiento: initial.FechaVencimiento ? initial.FechaVencimiento.split('T')[0] : '',
      Fecha_Elaboracion: initial.Fecha_Elaboracion ? initial.Fecha_Elaboracion.split('T')[0] : '',
      Ubicacion: initial.Ubicacion ?? '',
      ID_Categoria: String(initial.ID_Categoria ?? ''),
      ID_Medida: String(initial.ID_Medida ?? ''),
    } : emptyForm()
  );
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(resolveImg(initial?.Image));
  const [uploading,    setUploading]    = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleFile = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    let imageUrl = initial?.Image ?? undefined;
    if (imageFile) {
      setUploading(true);
      try {
        const res = await warehouseApi.uploadProductImage(imageFile);
        imageUrl = res.url;
      } catch {
        toast.error('Error al subir la imagen. Verifica el archivo e intenta de nuevo.');
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    const payload = {
      Nombre: form.Nombre, CodigoBarra: form.CodigoBarra || undefined,
      Descripcion: form.Descripcion || undefined,
      PrecioUnitario: parseFloat(form.PrecioUnitario),
      FechaVencimiento: form.FechaVencimiento || undefined,
      Fecha_Elaboracion: form.Fecha_Elaboracion || undefined,
      Image: imageUrl || undefined,
      Ubicacion: form.Ubicacion || undefined,
      ID_Categoria: parseInt(form.ID_Categoria),
      ID_Medida: parseInt(form.ID_Medida),
    };
    try {
      if (isEdit && initial) {
        await warehouseApi.updateProducto(initial.ID_Producto, payload);
        toast.success('Producto actualizado correctamente.');
      } else {
        await warehouseApi.createProducto(payload);
        toast.success('Producto registrado en el catálogo.');
      }
      onSaved(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al guardar el producto.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-2 sm:p-4" onClick={onClose}>
      <div className="bg-card rounded-md w-full max-w-2xl shadow-2xl border border-divider overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-5 border-b border-divider flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-2xl font-black text-primary flex items-center gap-2">
              {isEdit ? <Pencil className="w-6 h-6" /> : <PlusCircle className="w-6 h-6" />}
              {isEdit ? 'Editar Producto' : 'Registrar Producto'}
            </h3>
            <p className="text-xs font-bold opacity-40 mt-0.5 dark:text-gray-400">
              {isEdit ? 'Modifica los datos de la ficha técnica' : 'Completa la ficha técnica del artículo'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-surface opacity-40 hover:opacity-80 transition-all"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-4 sm:px-8 py-4 sm:py-6 flex flex-col gap-5">
          {/* Image Upload */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Imagen del Producto</label>
            <ImageDropZone preview={imagePreview} onFile={handleFile} />
            {imagePreview && (
              <button type="button" onClick={() => { setImageFile(null); setImagePreview(''); }}
                className="mt-2 flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-500 transition-colors">
                <ImageOff className="w-3.5 h-3.5" /> Quitar imagen
              </button>
            )}
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Nombre del Producto *</label>
            <input required value={form.Nombre} onChange={set('Nombre')} placeholder="Ej. Leche Entera 1L" className={INPUT} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Código de Lote</label>
              <input value={form.CodigoBarra} onChange={set('CodigoBarra')} placeholder="LOT-2024-001" className={`${INPUT} font-mono`} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Precio Unitario (Bs.) *</label>
              <input required type="number" step="0.01" min="0" value={form.PrecioUnitario} onChange={set('PrecioUnitario')} placeholder="0.00" className={INPUT} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Categoría *</label>
              <div className="relative">
                <select required value={form.ID_Categoria} onChange={set('ID_Categoria')} className={`${INPUT} appearance-none pr-10`}>
                  <option value="">— Seleccionar —</option>
                  {categorias.map(c => <option key={c.ID_Categoria} value={c.ID_Categoria}>{c.NombreC}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Unidad de Medida *</label>
              <div className="relative">
                <select required value={form.ID_Medida} onChange={set('ID_Medida')} className={`${INPUT} appearance-none pr-10`}>
                  <option value="">— Seleccionar —</option>
                  {medidas.map(m => <option key={m.ID_Medida} value={m.ID_Medida}>{m.Nombre} ({m.Abreviatura}) — ×{m.factor_conversion || 1}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Descripción</label>
            <textarea value={form.Descripcion} onChange={set('Descripcion') as any} rows={2} placeholder="Descripción técnica..." className={`${INPUT} resize-none`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Fecha de Elaboración</label>
              <input type="date" value={form.Fecha_Elaboracion} onChange={set('Fecha_Elaboracion')} className={INPUT} />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Fecha de Vencimiento</label>
              <input type="date" value={form.FechaVencimiento} onChange={set('FechaVencimiento')} className={INPUT} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1.5 block">Ubicación (Pasillo/Estante)</label>
            <input value={form.Ubicacion} onChange={set('Ubicacion')} placeholder="Ej. A-3 / Est-2" className={INPUT} />
          </div>

          <div className="flex gap-4 mt-2 pt-4 border-t border-divider">
            <button type="button" onClick={onClose} className="w-1/3 bg-card font-black py-4 rounded-md hover:bg-surface text-text transition-all">
              CANCELAR
            </button>
            <button type="submit" disabled={uploading}
              className="w-2/3 bg-primary text-white font-black py-4 rounded-md shadow-lg active:scale-95 hover:brightness-110 transition-all disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2">
              {uploading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Subiendo imagen...</>
                : isEdit ? 'GUARDAR CAMBIOS →' : 'REGISTRAR PRODUCTO →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Gallery Card ───────────────────────────────────────────────────────────

const ProductCard = ({ p, onView, onEdit, onDelete, guardAction }: {
  p: Producto; onView: () => void; onEdit: () => void; onDelete: () => void;
  guardAction: GuardFn;
}) => {
  const total     = stockTotal(p);
  const imgSrc    = resolveImg(p.Image);
  const [fav, setFav] = useState(false);

  return (
    <div className="group bg-card border border-divider rounded-md overflow-hidden shadow-sm hover:-translate-y-1 hover:shadow-md hover:border-primary/30 transition-all duration-300 cursor-pointer flex flex-col"
      onClick={onView}>
      {/* Image */}
      <div className="relative h-44 bg-surface flex items-center justify-center overflow-hidden flex-shrink-0">
        {imgSrc
          ? <img src={imgSrc} alt={p.Nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <Package className="w-12 h-12 opacity-15" />}
        {/* Price badge */}
        <div className="absolute top-3 left-3 bg-primary text-white px-3 py-1.5 rounded-md text-xs font-black shadow-lg">
          Bs. {Number(p.PrecioUnitario).toFixed(2)}
        </div>
        {/* Favorite */}
        <button
          onClick={e => { e.stopPropagation(); setFav(f => !f); }}
          className={`absolute top-3 right-3 p-2 rounded-md backdrop-blur-sm transition-all active:scale-90 ${fav ? 'bg-rose-500 text-white' : 'bg-black/30 text-white hover:bg-rose-500/80'}`}>
          <Heart className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} />
        </button>
        {/* Stock badge */}
        <div className={`absolute bottom-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-black border backdrop-blur-sm ${stockBadge(total)}`}>
          {stockLabel(total)}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        {p.categoria && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black border w-max ${catColor(p.ID_Categoria)}`}>
            <Tag className="w-3 h-3" /> {p.categoria.NombreC}
          </span>
        )}
        <h4 className="font-black text-text dark:text-gray-100 leading-tight line-clamp-2">{p.Nombre}</h4>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/10 text-amber-600 border border-amber-500/20">
            {stockPkgs(p)} Paq.
          </span>
          <span className="opacity-30 font-bold text-[10px]">|</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-primary/10 text-primary border border-primary/20">
            {total.toFixed(0)} Uds.
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200" onClick={e => e.stopPropagation()}>
        <button onClick={guardAction('MODULO_CATALOGO', onEdit)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95">
          <Pencil className="w-3.5 h-3.5" /> Editar
        </button>
        <button onClick={guardAction('MODULO_CATALOGO', onDelete)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95">
          <Trash2 className="w-3.5 h-3.5" /> Eliminar
        </button>
      </div>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────

export const ProductosPage = () => {
  const { guardAction } = usePermissions();

  const [productos,   setProductos]  = useState<Producto[]>([]);
  const [categorias,  setCategorias] = useState<Categoria[]>([]);
  const [medidas,     setMedidas]    = useState<UMedida[]>([]);
  const [almacenes,   setAlmacenes]  = useState<Almacen[]>([]);
  const [loading,     setLoading]    = useState(false);
  const [exporting,   setExporting]  = useState(false);

  const [searchQ,   setSearchQ]   = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterAlm, setFilterAlm] = useState('');

  const [viewMode,    setViewMode]    = useState<'gallery' | 'list'>('list');
  const [viewing,     setViewing]     = useState<Producto | null>(null);
  const [editing,     setEditing]     = useState<Producto | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────

  const loadProductos = useCallback(async () => {
    setLoading(true);
    try {
      setProductos(await warehouseApi.getProductos(
        searchQ || undefined, filterCat || undefined, filterAlm || undefined,
      ));
    } catch (e: any) { if (e?.response?.status !== 403) toast.error('Error al cargar el catálogo.'); }
    finally { setLoading(false); }
  }, [searchQ, filterCat, filterAlm]);

  useEffect(() => {
    Promise.all([warehouseApi.getCategorias(), warehouseApi.getMedidas(), warehouseApi.getAlmacenes()])
      .then(([cats, meds, alms]) => { setCategorias(cats); setMedidas(meds); setAlmacenes(alms); })
      .catch(() => toast.error('Error al cargar selectores.'));
  }, []);

  useEffect(() => {
    const t = setTimeout(loadProductos, 300);
    return () => clearTimeout(t);
  }, [loadProductos]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleDelete = (p: Producto) => {
    toast.warning(`¿Eliminar "${p.Nombre}"?`, {
      description: 'El producto quedará inactivo en el catálogo.',
      action: {
        label: 'Confirmar',
        onClick: async () => {
          try { await warehouseApi.deleteProducto(p.ID_Producto); toast.success('Producto eliminado.'); loadProductos(); }
          catch (err: any) { toast.error(err.response?.data?.message || 'No se pudo eliminar el producto.'); }
        },
      },
    });
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const blob = await warehouseApi.exportProductosPdf(
        searchQ || undefined, filterCat || undefined, filterAlm || undefined,
      );
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url; a.download = 'catalogo-productos.pdf'; a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF exportado correctamente.');
    } catch { toast.error('Error al exportar el PDF.'); }
    finally { setExporting(false); }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 w-full relative z-10 transition-all duration-300">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl sm:text-4xl font-black text-primary drop-shadow-sm flex items-center gap-2 sm:gap-3">
            <Package className="w-7 h-7 sm:w-10 sm:h-10" /> Catálogo de Productos
          </h2>
          <p className="mt-1 sm:mt-2 text-sm sm:text-lg font-bold text-text opacity-70">
            Maestro de artículos, precios y existencias por almacén.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={guardAction('MODULO_CATALOGO', handleExportPdf)} disabled={exporting}
            className="flex items-center gap-2 bg-card hover:bg-surface text-text font-black uppercase tracking-wider px-5 py-3.5 rounded-md transition-all active:scale-95 disabled:opacity-50 border border-divider text-sm">
            {exporting
              ? <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              : <FileDown className="w-4 h-4" />}
            Exportar PDF
          </button>
          <button onClick={guardAction('MODULO_CATALOGO', () => setShowCreate(true))}
            className="bg-primary text-white font-black uppercase tracking-wider px-6 py-3.5 rounded-md gap-2 flex items-center shadow-[0_0_20px_rgba(var(--color-primary),0.3)] hover:-translate-y-1 transition-all active:scale-95 border-b-[3px] border-black/20">
            <PlusCircle className="w-5 h-5" /> Registrar Producto
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-card border border-divider rounded-md p-4 flex flex-wrap gap-3 items-center shadow-sm">
        <div className="flex items-center bg-surface rounded-md px-4 py-2.5 border border-transparent focus-within:border-primary transition-all flex-1 min-w-44">
          <Search className="w-4 h-4 text-primary opacity-60 mr-2 flex-shrink-0" />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Buscar nombre o código..."
            className="bg-transparent border-none outline-none w-full font-bold text-sm text-text" />
        </div>

        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="bg-surface rounded-md pl-9 pr-7 py-2.5 border border-transparent font-bold text-sm text-text outline-none focus:border-primary appearance-none cursor-pointer">
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c.ID_Categoria} value={c.ID_Categoria}>{c.NombreC}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 pointer-events-none" />
        </div>

        <div className="relative">
          <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
          <select value={filterAlm} onChange={e => setFilterAlm(e.target.value)}
            className="bg-surface rounded-md pl-9 pr-7 py-2.5 border border-transparent font-bold text-sm text-text outline-none focus:border-primary appearance-none cursor-pointer">
            <option value="">Todos los almacenes</option>
            {almacenes.map(a => <option key={a.ID_Almacen} value={a.ID_Almacen}>{a.Nombre}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40 pointer-events-none" />
        </div>

        {(filterCat || filterAlm || searchQ) && (
          <button onClick={() => { setSearchQ(''); setFilterCat(''); setFilterAlm(''); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-black text-xs uppercase tracking-wider transition-all">
            <X className="w-3.5 h-3.5" /> Limpiar
          </button>
        )}

        <p className="text-xs font-black opacity-40 uppercase tracking-wider">
          {productos.length} resultado{productos.length !== 1 ? 's' : ''}
        </p>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-surface rounded-md p-1 border border-divider ml-auto">
          <button onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow' : 'opacity-40 hover:opacity-70'}`}
            title="Vista tabla">
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('gallery')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'gallery' ? 'bg-primary text-white shadow' : 'opacity-40 hover:opacity-70'}`}
            title="Vista galería">
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Gallery View ── */}
      {viewMode === 'gallery' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
          {loading
            ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
            : productos.map(p => (
                <ProductCard key={p.ID_Producto} p={p}
                  guardAction={guardAction}
                  onView={() => setViewing(p)}
                  onEdit={() => setEditing(p)}
                  onDelete={() => handleDelete(p)} />
              ))
          }
          {!loading && productos.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 gap-3 opacity-25">
              <PackageOpen className="w-16 h-16" />
              <p className="font-black text-sm">Catálogo vacío. Registra el primer producto.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Table View ── */}
      {viewMode === 'list' && (
        <div className="bg-card border border-divider rounded-md shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-surface border-b border-divider">
              <tr>
                <th className="p-4 font-black text-xs tracking-wider uppercase text-text w-16">Img</th>
                <th className="p-4 font-black text-xs tracking-wider uppercase text-text"><div className="flex items-center gap-1"><QrCode className="w-3.5 h-3.5" /> Código</div></th>
                <th className="p-4 font-black text-xs tracking-wider uppercase text-text">Producto</th>
                <th className="p-4 font-black text-xs tracking-wider uppercase text-text"><div className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Categoría</div></th>
                <th className="p-4 font-black text-xs tracking-wider uppercase text-text"><div className="flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> Medida</div></th>
                <th className="p-4 font-black text-xs tracking-wider uppercase text-text"><div className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Precio</div></th>
                <th className="p-4 font-black text-xs tracking-wider uppercase text-text"><div className="flex items-center gap-1"><Boxes className="w-3.5 h-3.5" /> Existencias</div></th>
                <th className="p-4 font-black text-xs tracking-wider uppercase text-text text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                : productos.map(p => {
                    const total = stockTotal(p);
                    return (
                      <tr key={p.ID_Producto} onClick={() => setViewing(p)}
                        className="hover:bg-primary/4 dark:hover:bg-primary/6 transition-colors duration-150 group cursor-pointer">
                        <td className="p-4">
                          <div className="w-11 h-11 rounded-md bg-surface overflow-hidden flex items-center justify-center border border-divider flex-shrink-0">
                            {p.Image
                              ? <img src={resolveImg(p.Image)} alt={p.Nombre} className="w-full h-full object-cover" />
                              : <Package className="w-5 h-5 opacity-20" />}
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs font-bold tracking-widest text-text opacity-70">{p.CodigoBarra || '—'}</td>
                        <td className="p-4">
                          <p className="font-black text-text line-clamp-1">{p.Nombre}</p>
                          {p.Descripcion && <p className="text-[11px] font-bold opacity-40 mt-0.5 line-clamp-1">{p.Descripcion}</p>}
                        </td>
                        <td className="p-4">
                          {p.categoria && (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-black border ${catColor(p.ID_Categoria)}`}>
                              {p.categoria.NombreC}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          {p.medida && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-black bg-surface text-text">
                              {p.medida.Abreviatura}
                            </span>
                          )}
                        </td>
                        <td className="p-4 font-black text-primary">Bs. {Number(p.PrecioUnitario).toFixed(2)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-black border bg-amber-500/10 text-amber-600 border-amber-500/20">
                              {stockPkgs(p)} Paq.
                            </span>
                            <span className="opacity-30 font-black text-[10px]">|</span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-black border ${stockBadge(total)}`}>
                              {total.toFixed(0)} Uds.
                            </span>
                          </div>
                        </td>
                        <td className="p-4" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <button onClick={() => setViewing(p)} title="Ver detalle"
                              className="p-2 rounded bg-text/8 text-muted hover:bg-text hover:text-white transition-all active:scale-95">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={guardAction('MODULO_CATALOGO', () => setEditing(p))} title="Editar"
                              className="p-2 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all active:scale-95">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={guardAction('MODULO_CATALOGO', () => handleDelete(p))} title="Eliminar"
                              className="p-2 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
          </div>
          {!loading && productos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-25">
              <PackageOpen className="w-16 h-16" />
              <p className="font-black text-sm">Catálogo vacío. Registra el primer producto.</p>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {viewing && (
        <DetailModal producto={viewing} onClose={() => setViewing(null)}
          guardAction={guardAction}
          onEdit={p => { setViewing(null); setEditing(p); }}
          onDelete={p => { setViewing(null); handleDelete(p); }} />
      )}
      {showCreate && (
        <FormModal categorias={categorias} medidas={medidas} onClose={() => setShowCreate(false)} onSaved={loadProductos} />
      )}
      {editing && (
        <FormModal initial={editing} categorias={categorias} medidas={medidas} onClose={() => setEditing(null)} onSaved={loadProductos} />
      )}
    </div>
  );
};