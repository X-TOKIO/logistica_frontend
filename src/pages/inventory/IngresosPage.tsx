import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../context/AuthContext';
import { inventoryApi } from '../../services/inventory';
import { warehouseApi } from '../../services/warehouse';
import { financeApi } from '../../services/finance';
import {
  ShieldCheck, Search, Trash2, Save, ShoppingCart, Printer,
  PackageCheck, AlertCircle, X, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

const INPUT = 'bg-surface border border-divider rounded-md px-4 py-3 outline-none focus:ring-2 ring-primary font-bold text-text w-full';

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('es-BO', { dateStyle: 'short' }) : '—';

// ── Tipos ──────────────────────────────────────────────────────────────────

type Compra = {
  ID_Compra: number;
  Nro_Factura?: string;
  Fecha_Emision: string;
  Estado_Documento: string;
  Monto_Total: number;
  proveedor?: { Nombre_RazonSocial?: string };
  detalles?: DetalleCompra[];
};

type DetalleCompra = {
  ID_Detalle: number;
  ID_Producto: number;
  Cantidad: number;
  Precio_Unitario: number;
  Fecha_Elaboracion?: string;
  Fecha_Vencimiento?: string;
  producto?: { Nombre: string; CodigoBarra?: string; medida?: { Abreviatura: string } };
};

type FilaRecepcion = {
  ID_Producto: number;
  ID_Almacen: number | string;
  Cantidad: number;
  _nombre: string;
  _codigo: string;
  _precio: number;
  _cantidadCompra: number;
};

// ── Componente Principal ───────────────────────────────────────────────────

export const IngresosPage = () => {
  const { user } = useAuth();

  // Datos base
  const [ingresos,  setIngresos]  = useState<any[]>([]);
  const [almacenes, setAlmacenes] = useState<any[]>([]);
  const [compras,   setCompras]   = useState<Compra[]>([]);

  // Formulario de cabecera
  const [descripcion, setDescripcion] = useState('');
  const [fecha,       setFecha]       = useState(new Date().toISOString().split('T')[0]);
  const [hora,        setHora]        = useState(() => new Date().toTimeString().slice(0, 5));

  // Búsqueda de compra
  const [searchTerm,      setSearchTerm]      = useState('');
  const [searchResults,   setSearchResults]   = useState<Compra[]>([]);
  const [compraSeleccionada, setCompraSeleccionada] = useState<Compra | null>(null);
  const [loadingCompra,   setLoadingCompra]   = useState(false);

  // Tabla de recepción
  const [detalles, setDetalles] = useState<FilaRecepcion[]>([]);

  // Paginación del histórico
  const [page,    setPage]    = useState(1);
  const PER_PAGE = 8;

  const totalPages   = Math.max(1, Math.ceil(ingresos.length / PER_PAGE));
  const ingresosPag  = ingresos.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // ── Carga inicial ────────────────────────────────────────────────────────

  const load = async () => {
    const [ingRes, almRes, cmpRes] = await Promise.allSettled([
      inventoryApi.getIngresos(),
      warehouseApi.getAlmacenes(),
      financeApi.getCompras(),
    ]);
    if (ingRes.status === 'fulfilled') setIngresos(ingRes.value);
    if (almRes.status === 'fulfilled') setAlmacenes(almRes.value);
    if (cmpRes.status === 'fulfilled') setCompras(cmpRes.value);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [ingresos.length]);

  // ── Filtro de compras por ID o Nro_Factura ───────────────────────────────

  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();
    if (term.length < 1) { setSearchResults([]); return; }
    const filtered = compras.filter(c => {
      const idMatch  = String(c.ID_Compra).includes(term);
      const facMatch = (c.Nro_Factura ?? '').toLowerCase().includes(term);
      return idMatch || facMatch;
    });
    setSearchResults(filtered.slice(0, 8));
  }, [searchTerm, compras]);

  // ── Seleccionar compra y cargar detalles ─────────────────────────────────

  const seleccionarCompra = async (compra: Compra) => {
    setSearchTerm('');
    setSearchResults([]);
    setLoadingCompra(true);
    try {
      const full: Compra = await financeApi.getCompraById(compra.ID_Compra);
      setCompraSeleccionada(full);

      const defaultAlmacen = almacenes[0]?.ID_Almacen ?? '';
      const filas: FilaRecepcion[] = (full.detalles ?? []).map(d => ({
        ID_Producto:     d.ID_Producto,
        ID_Almacen:      defaultAlmacen,
        Cantidad:        d.Cantidad,
        _nombre:         d.producto?.Nombre ?? `Producto ${d.ID_Producto}`,
        _codigo:         d.producto?.CodigoBarra ?? 'S/N',
        _precio:         d.Precio_Unitario,
        _cantidadCompra: d.Cantidad,
      }));
      setDetalles(filas);
      setDescripcion(`Recepción Compra #${full.ID_Compra}${full.Nro_Factura ? ` · Factura ${full.Nro_Factura}` : ''}`);
    } catch {
      toast.error('No se pudo cargar la compra. Verifica el ID.');
    } finally {
      setLoadingCompra(false);
    }
  };

  const limpiarCompra = () => {
    setCompraSeleccionada(null);
    setDetalles([]);
    setDescripcion('');
    setSearchTerm('');
  };

  // ── Editar filas ─────────────────────────────────────────────────────────

  const updateRow = (index: number, field: keyof FilaRecepcion, value: any) => {
    const arr = [...detalles];
    arr[index] = { ...arr[index], [field]: value };
    setDetalles(arr);
  };

  const removeRow = (index: number) => {
    setDetalles(detalles.filter((_, i) => i !== index));
  };

  // ── Guardar ingreso ───────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!compraSeleccionada) return toast.error('Selecciona una compra pendiente primero.');
    if (detalles.length === 0) return toast.error('La tabla de recepción está vacía.');

    const detallesLimpios = detalles.map(d => ({
      ID_Producto: Number(d.ID_Producto),
      ID_Almacen:  Number(d.ID_Almacen),
      Cantidad:    Number(d.Cantidad),
    }));

    try {
      await inventoryApi.createIngreso({
        ID_Compra:   compraSeleccionada.ID_Compra,
        Descripcion: descripcion,
        Fecha:       fecha,
        Hora:        hora + ':00',
        detalles:    detallesLimpios,
      });
      toast.success(`¡Ingreso adjudicado! Stock actualizado en BD para Compra #${compraSeleccionada.ID_Compra}.`);
      limpiarCompra();
      load();
    } catch (e: any) {
      console.error('Error ingreso:', e.response?.data);
      const data   = e.response?.data ?? {};
      const msg    = data.message || 'Error al guardar. Verifica las cantidades.';
      const status = e.response?.status as number | undefined;
      toast.error(msg, {
        duration: status === 400 || status === 409 ? 7000 : 4000,
        description: status === 400 || status === 409
          ? 'No se realizó ningún cambio en el stock.'
          : undefined,
      });
    }
  };

  // ── PDF Global ────────────────────────────────────────────────────────────

  const exportPDFGlobal = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(24); doc.setFont('helvetica', 'bold');
    doc.text('PARADISO', 15, 20);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Logística y Distribución', 15, 26);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('REPORTE GLOBAL DE INGRESOS', pageWidth / 2, 40, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de Emisión: ${new Date().toLocaleString()}`, 15, 50);

    const tableData = ingresos.map((e: any, index: number) => {
      const emp = e.empleado;
      const usr = emp?.usuario;
      const username = usr?.Username || usr?.username || '';
      const nombreEmp = emp ? `${emp.Nombre || ''} ${emp.Apellido || ''}`.trim() : '';
      const operador = nombreEmp || username || 'Sistema';
      return [
        index + 1,
        `INC-${e.ID_Ingreso.toString().padStart(5, '0')}`,
        fmtDate(e.Fecha) + ' ' + e.Hora,
        operador,
        e.compra?.proveedor?.Nombre_RazonSocial || e.compra?.proveedor?.RazonSocial || 'N/A',
        e.Descripcion || 'Sin detalle',
      ];
    });

    autoTable(doc, {
      startY: 55,
      head: [['N°', 'Comprobante', 'Fecha / Hora', 'Operador', 'Proveedor', 'Concepto']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40] },
    });
    doc.save(`Reporte_Global_Ingresos_${Date.now()}.pdf`);
  };

  const exportPDFIndividual = (nota: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(24); doc.setFont('helvetica', 'bold');
    doc.text('PARADISO', 15, 20);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text('Logística y Distribución', 15, 26);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`COMPROBANTE DE INGRESO N° ${nota.ID_Ingreso.toString().padStart(5, '0')}`, pageWidth / 2, 40, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Fecha y Hora: ${fmtDate(nota.Fecha)} - ${nota.Hora}`, 15, 50);

    const emp = nota.empleado;
    const usr = emp?.usuario;
    const username = usr?.Username || usr?.username || '';
    const nombreEmp = emp ? `${emp.Nombre || ''} ${emp.Apellido || ''}`.trim() : '';
    const ciEmp = emp?.CI || '';
    const operadorTexto = nombreEmp
      ? `${nombreEmp}${ciEmp ? ` (CI: ${ciEmp})` : ''}${username ? ` [${username}]` : ''}`
      : (user?.username || 'Sistema');

    doc.text(`Responsable: ${operadorTexto}`, 15, 57);
    const proveedor = nota.compra?.proveedor?.Nombre_RazonSocial || nota.compra?.proveedor?.RazonSocial || 'N/A';
    doc.text(`Proveedor: ${proveedor}`, 15, 64);
    const descLines = doc.splitTextToSize(`Concepto: ${nota.Descripcion || 'Sin descripción'}`, pageWidth - 30);
    doc.text(descLines, 15, 71);
    let currentY = 71 + (descLines.length * 5);

    const filas = nota.detalles?.map((d: any, index: number) => [
      index + 1,
      d.producto?.CodigoBarra || 'S/N',
      d.producto?.Nombre || 'Artículo',
      Number(d.Cantidad || 0).toFixed(2),
      d.producto?.medida?.Abreviatura || 'Uds',
      `Bs. ${Number(d.producto?.PrecioUnitario || 0).toFixed(2)}`,
      d.ID_Almacen || '1',
    ]) || [];

    autoTable(doc, {
      startY: currentY + 5,
      head: [['N°', 'Cód. Lote', 'Descripción del Artículo', 'Cantidad', 'Unidad', 'Precio U.', 'Almacén']],
      body: filas,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || currentY + 10;
    const signatureY = finalY + 30;
    doc.line(20, signatureY, 80, signatureY);
    doc.text(`Entregué Conforme (${operadorTexto})`, 50, signatureY + 5, { align: 'center' });
    doc.line(pageWidth - 80, signatureY, pageWidth - 20, signatureY);
    doc.text('Recibí / Revisado Por', pageWidth - 50, signatureY + 5, { align: 'center' });

    doc.save(`Comprobante-Ingreso-${nota.ID_Ingreso.toString().padStart(5, '0')}.pdf`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 w-full relative z-10 transition-all duration-300">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl sm:text-4xl font-black text-primary drop-shadow-sm flex items-center gap-2 sm:gap-3">
          <PackageCheck className="w-7 h-7 sm:w-10 sm:h-10" /> Recepción de Mercancía
        </h2>
        <button onClick={exportPDFGlobal}
          className="bg-primary/10 text-primary px-3 sm:px-4 py-2 sm:py-2.5 rounded-md hover:bg-primary hover:text-white transition-colors flex items-center gap-2 font-bold shadow-sm border border-primary/20 text-sm">
          <Printer className="w-4 h-4" /> Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-2">

        {/* ── Panel Izquierdo: Formulario ── */}
        <div className="bg-card border border-divider rounded-md p-4 sm:p-8 relative overflow-hidden h-max">
          <h3 className="text-2xl font-black text-text mb-1">Nueva Recepción</h3>
          <p className="text-xs font-bold text-muted mb-6">
            Busca la compra por ID o N° de Factura para cargar los productos automáticamente.
          </p>

          {/* Buscador de Compra */}
          <div className="mb-5 relative z-30">
            <label className="text-[10px] tracking-widest font-black uppercase text-secondary mb-2 block">
              Buscador de Compra (ID o Nro. Factura)
            </label>

            {compraSeleccionada ? (
              /* Compra seleccionada — badge con info */
              <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-4 py-3">
                <ShieldCheck className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    Compra #{compraSeleccionada.ID_Compra}
                    {compraSeleccionada.Nro_Factura && ` · Factura ${compraSeleccionada.Nro_Factura}`}
                  </p>
                  <p className="text-[10px] font-bold opacity-60 text-muted">
                    {compraSeleccionada.proveedor?.Nombre_RazonSocial ?? 'Sin proveedor'} ·{' '}
                    {fmtDate(compraSeleccionada.Fecha_Emision)} ·{' '}
                    Bs. {Number(compraSeleccionada.Monto_Total).toFixed(2)}
                  </p>
                </div>
                <button onClick={limpiarCompra}
                  className="p-1.5 rounded-md hover:bg-red-500/10 text-muted hover:text-red-500 transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Campo de búsqueda */
              <div className="relative">
                <div className="flex items-center bg-surface rounded-md px-4 py-3 border border-divider focus-within:border-primary transition-all">
                  {loadingCompra
                    ? <RefreshCw className="w-5 h-5 text-primary mr-2 animate-spin" />
                    : <Search className="w-5 h-5 text-primary mr-2" />}
                  <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Ej: 42  o  FAC-2024-001..."
                    className="bg-transparent border-none outline-none w-full font-bold text-text"
                  />
                </div>

                {/* Dropdown resultados */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 w-full bg-card border border-divider rounded-md mt-2 overflow-hidden z-40 max-h-[280px] overflow-y-auto">
                    {searchResults.map(c => {
                      const badgeColor =
                        c.Estado_Documento === 'ACTIVO'    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                        c.Estado_Documento === 'ANULADO'   ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                        'bg-amber-500/10 text-amber-500 border-amber-500/20';
                      return (
                        <div key={c.ID_Compra}
                          onClick={() => seleccionarCompra(c)}
                          className="flex items-center gap-3 p-4 hover:bg-surface cursor-pointer border-b border-divider last:border-0">
                          <ShoppingCart className="w-5 h-5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm text-text leading-tight">
                              Compra #{c.ID_Compra}
                              {c.Nro_Factura && <span className="ml-2 font-mono text-xs text-secondary">{c.Nro_Factura}</span>}
                            </p>
                            <p className="text-[10px] font-bold opacity-60 text-muted">
                              {c.proveedor?.Nombre_RazonSocial ?? 'Sin proveedor'} · {fmtDate(c.Fecha_Emision)} · Bs. {Number(c.Monto_Total).toFixed(2)}
                            </p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black border ${badgeColor}`}>
                            {c.Estado_Documento}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {searchTerm.trim().length > 0 && searchResults.length === 0 && !loadingCompra && (
                  <div className="absolute top-full left-0 w-full bg-card border border-divider rounded-md mt-2 p-4 z-40 flex items-center gap-2 text-sm font-bold opacity-60">
                    <AlertCircle className="w-4 h-4" /> Sin resultados para "{searchTerm}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cabecera de la nota */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={INPUT} />
            <input type="time" value={hora}  onChange={e => setHora(e.target.value)}  className={INPUT} />
          </div>
          <input
            placeholder="Razón / descripción del ingreso..."
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            className={`${INPUT} mb-6`}
          />

          {/* Tabla de recepción */}
          {detalles.length > 0 && (
            <div className="border border-divider rounded-xl overflow-hidden mb-6 relative z-10 bg-card">
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[450px]">
                <thead className="bg-surface border-b border-divider">
                  <tr>
                    <th className="p-3 text-xs uppercase tracking-wider font-black text-text">Producto</th>
                    <th className="p-3 w-24 text-xs uppercase tracking-wider font-black text-text">Recibido</th>
                    <th className="p-3 w-36 text-xs uppercase tracking-wider font-black text-text">Almacén Destino</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider">
                  {detalles.map((d, i) => (
                    <tr key={i} className="hover:bg-surface transition-colors">
                      <td className="p-3">
                        <p className="font-black text-xs text-text leading-tight">{d._nombre}</p>
                        <p className="font-mono text-[9px] text-muted mt-0.5">
                          {d._codigo} · Cmp: {d._cantidadCompra}
                        </p>
                      </td>
                      <td className="p-3">
                        <input
                          type="number" min="0.01" step="0.01"
                          value={d.Cantidad}
                          onChange={e => updateRow(i, 'Cantidad', e.target.value)}
                          className="w-full bg-surface border border-divider rounded-md px-2 py-1.5 outline-none focus:ring-1 ring-primary font-mono font-bold text-text text-sm"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={d.ID_Almacen}
                          onChange={e => updateRow(i, 'ID_Almacen', e.target.value)}
                          className="w-full bg-surface border border-divider rounded-md px-2 py-1.5 outline-none text-[10px] font-black uppercase text-text">
                          {almacenes.map(a => (
                            <option key={a.ID_Almacen} value={a.ID_Almacen}>{a.Nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => removeRow(i)}
                          className="text-red-500 hover:text-red-700 bg-red-500/10 p-1.5 rounded-md transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Botón de acción */}
          <button
            onClick={handleSave}
            disabled={!compraSeleccionada || detalles.length === 0}
            className="w-full bg-primary text-white font-black uppercase tracking-wider py-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(var(--color-primary),0.3)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100">
            <Save className="w-5 h-5" /> Autorizar y Adjudicar Stock
          </button>
        </div>

        {/* ── Panel Derecho: Histórico ── */}
        <div className="bg-card border border-divider rounded-xl p-6 flex flex-col gap-4 overflow-y-auto max-h-[800px]">
          <h3 className="text-lg font-black text-text mb-2 sticky top-0 bg-card/95 p-2 rounded-xl z-20 border border-divider">
            Histórico de Transacciones de Ingreso
          </h3>

          {ingresosPag.map(nota => {
            const emp = nota.empleado;
            const usr = emp?.usuario;
            const username = usr?.Username || usr?.username || '';
            const nombreEmp = emp ? `${emp.Nombre || ''} ${emp.Apellido || ''}`.trim() : '';
            const autorizador = nombreEmp || username || user?.username || 'Sistema';

            return (
              <div key={nota.ID_Ingreso}
                className="bg-card rounded-xl p-5 border border-divider flex flex-col gap-3 relative border-l-4 border-l-primary">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-primary text-lg tracking-widest">
                      INC-{nota.ID_Ingreso.toString().padStart(5, '0')}
                    </h4>
                    <p className="text-[10px] font-black uppercase opacity-50 text-muted">
                      {fmtDate(nota.Fecha)} · <span className="text-secondary">{nota.Hora}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => exportPDFIndividual(nota)}
                      className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full hover:bg-blue-500 hover:text-white transition-colors flex items-center gap-1.5 font-bold text-[10px]">
                      <Printer className="w-3.5 h-3.5" /> Imprimir
                    </button>
                    <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[10px] font-black border border-emerald-500/20 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" /> VALIDADO
                    </div>
                  </div>
                </div>

                {nota.Descripcion && (
                  <p className="text-sm font-medium leading-relaxed text-text">{nota.Descripcion}</p>
                )}

                <div className="mt-2 pt-3 border-t border-divider flex justify-between items-center opacity-70">
                  <div className="flex items-center gap-2 text-xs font-bold font-mono text-muted">
                    <ShoppingCart className="w-4 h-4" />
                    FK Compra: #{nota.ID_Compra ?? nota.compra?.ID_Compra ?? 'N/A'}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-right text-muted">
                    Autorizador: {autorizador}
                  </div>
                </div>
              </div>
            );
          })}

          {ingresos.length === 0 && (
            <span className="opacity-50 font-bold p-10 text-center text-muted">
              Registro histórico vacío.
            </span>
          )}

          {/* Footer de paginación */}
          {ingresos.length > 0 && (
            <div className="sticky bottom-0 bg-card/95 backdrop-blur-md border-t border-divider rounded-b-xl px-4 py-3 flex items-center justify-between gap-2 z-20">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, ingresos.length)} de {ingresos.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-primary/10 text-muted hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-7 h-7 rounded-lg text-[11px] font-black transition-colors ${
                      n === page
                        ? 'bg-primary text-white'
                        : 'hover:bg-primary/10 text-muted hover:text-primary'
                    }`}>
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-primary/10 text-muted hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
