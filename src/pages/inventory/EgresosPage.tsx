import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../context/AuthContext';
import { inventoryApi } from '../../services/inventory';
import { warehouseApi } from '../../services/warehouse';
import { Plus, Search, Trash2, Save, Activity, Printer } from 'lucide-react';

const parseBulto = (ub?: string): number => {
  const m = ub?.match(/[xX×*](\d+)/);
  if (m) return Math.max(1, parseInt(m[1], 10));
  const n = parseInt(ub ?? '1', 10);
  return isNaN(n) ? 1 : Math.max(1, n);
};

export const EgresosPage = () => {
  const { user } = useAuth();
  const [egresos, setEgresos] = useState<any[]>([]);
  const [almacenes, setAlmacenes] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]); // Nuevo estado para Sucursales

  const [almacenGlobal, setAlmacenGlobal] = useState('');
  const [sucursalGlobal, setSucursalGlobal] = useState('');

  // Atributos fieles a la BD
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

  // Función para obtener la hora actual en formato HH:mm
  const getCurrentTime = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  };
  const [hora, setHora] = useState(getCurrentTime());

  const [detalles, setDetalles] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const load = async () => {
    try {
      setEgresos(await inventoryApi.getEgresos());
      setAlmacenes(await warehouseApi.getAlmacenes());
      // Cargar Sucursales. Asumimos que warehouseApi tiene getSucursales()
      // Si no es así, deberás crearla o ajustar esto según tu API.
      setSucursales(await warehouseApi.getSucursales());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const delay = setTimeout(async () => {
      if (searchTerm.trim().length > 1) {
        const results = await warehouseApi.getProductos(searchTerm);
        setSearchResults(results);
      }
      else setSearchResults([]);
    }, 400);
    return () => clearTimeout(delay);
  }, [searchTerm]);

  // Cuando el usuario cambia el almacén global, todas las filas ya agregadas
  // actualizan su ID_Almacen, stock físico y paquetes disponibles en tiempo real.
  useEffect(() => {
    setDetalles(prev => {
      if (prev.length === 0) return prev;
      const almId = almacenGlobal ? Number(almacenGlobal) : null;
      return prev.map(det => {
        const pas: any[] = det._productoAlmacenes || [];
        let newAlmacenId: number;
        let newStock: number;
        if (almId !== null) {
          newAlmacenId = almId;
          const pa = pas.find((p: any) => Number(p.ID_Almacen) === almId);
          newStock = pa ? Number(pa.Stock_Actual) : 0;
        } else if (pas.length > 0) {
          const best = pas.reduce((a: any, b: any) =>
            Number(a.Stock_Actual) >= Number(b.Stock_Actual) ? a : b
          );
          newAlmacenId = Number(best.ID_Almacen);
          newStock = Number(best.Stock_Actual);
        } else {
          return det;
        }
        const factor = det._factor || 1;
        return {
          ...det,
          ID_Almacen: newAlmacenId,
          _stockFisico: newStock,
          _stockPaquetes: Math.floor(newStock / factor),
        };
      });
    });
  }, [almacenGlobal]);

  const addDetalle = (prod: any) => {
    const idReal = prod.ID_Producto || prod.id;
    const nombreReal = prod.Nombre || prod.nombre;
    const codigoReal = prod.CodigoBarra || prod.codigo || 'S/N';
    const precioReal = prod.PrecioUnitario || prod.precio || 0;
    const fcRaw = Math.max(1, Number(prod.medida?.factor_conversion ?? 1));
    const factorReal = fcRaw > 1 ? fcRaw : parseBulto(prod.medida?.Unidades_Bulto);

    const productoAlmacenes: any[] = prod.productoAlmacenes || [];

    // Determinar el almacén correcto y el stock real de ese almacén.
    // Si el usuario eligió un almacén global, se respeta; si no, se elige el
    // almacén donde el producto tiene MÁS stock disponible para evitar enviar
    // un ID_Almacen donde el stock es 0 o no existe el registro.
    let targetAlmacenId: number;
    let stockReal = 0;

    if (almacenGlobal) {
      targetAlmacenId = Number(almacenGlobal);
      const pa = productoAlmacenes.find((pa: any) => Number(pa.ID_Almacen) === targetAlmacenId);
      stockReal = pa ? Number(pa.Stock_Actual) : 0;
    } else if (productoAlmacenes.length > 0) {
      // Sin selección global: usar el almacén con mayor stock
      const best = productoAlmacenes.reduce((a: any, b: any) =>
        Number(a.Stock_Actual) >= Number(b.Stock_Actual) ? a : b
      );
      targetAlmacenId = Number(best.ID_Almacen);
      stockReal = Number(best.Stock_Actual);
    } else {
      targetAlmacenId = Number(almacenes[0]?.ID_Almacen) || 0;
      stockReal = Number(prod.Stock_Actual ?? prod.stock ?? prod.Stock ?? 0);
    }

    const stockPaqReal = Math.floor(stockReal / factorReal);

    const exists = detalles.find(
      d => Number(d.ID_Producto) === Number(idReal) && Number(d.ID_Almacen) === targetAlmacenId,
    );
    if (!exists) {
      setDetalles([...detalles, {
        ID_Producto: idReal,
        ID_Almacen: targetAlmacenId,
        ID_Sucursal: sucursalGlobal || (sucursales[0]?.ID_Sucursal || ''),
        Cantidad: factorReal,
        CantPaquetes: 1,
        _nombre: nombreReal,
        _codigo: codigoReal,
        _precio: precioReal,
        _stockFisico: stockReal,
        _stockPaquetes: stockPaqReal,
        _factor: factorReal,
        _productoAlmacenes: productoAlmacenes,
      }]);
    } else {
      toast.info('El producto ya está en la lista. Ajusta la cantidad.');
    }
    setSearchTerm('');
    setSearchResults([]);
  };

  const removeRow = (index: number) => setDetalles(detalles.filter((_, i) => i !== index));

  const updateRow = (index: number, field: string, value: any) => {
    const arr = [...detalles];
    arr[index] = { ...arr[index], [field]: value };
    setDetalles(arr);
  };

  const updatePaquetes = (index: number, paquetes: number) => {
    const arr = [...detalles];
    const factor = arr[index]._factor || 1;
    arr[index] = { ...arr[index], CantPaquetes: paquetes, Cantidad: paquetes * factor };
    setDetalles(arr);
  };

  const updateUnidades = (index: number, unidades: number) => {
    const arr = [...detalles];
    const factor = arr[index]._factor || 1;
    arr[index] = { ...arr[index], Cantidad: unidades, CantPaquetes: Math.floor(unidades / factor) };
    setDetalles(arr);
  };

  // Al cambiar almacén en una fila, recalcula el stock disponible para ese almacén
  const updateAlmacen = (index: number, newAlmacenId: string) => {
    const arr = [...detalles];
    const det = arr[index];
    const almId = Number(newAlmacenId);
    const pa = (det._productoAlmacenes || []).find((p: any) => Number(p.ID_Almacen) === almId);
    const newStock = pa ? Number(pa.Stock_Actual) : 0;
    const factor = det._factor || 1;
    arr[index] = {
      ...det,
      ID_Almacen: almId,
      _stockFisico: newStock,
      _stockPaquetes: Math.floor(newStock / factor),
    };
    setDetalles(arr);
  };

  const handleSave = async () => {
    if (detalles.length === 0) return toast.error('La nota debe tener al menos un registro.');

    // Validación de stock en bultos
    for (const d of detalles) {
      if (Number(d.CantPaquetes) > 0 && Number(d.CantPaquetes) > Number(d._stockPaquetes)) {
        toast.error(
          `Stock Insuficiente en Bultos — "${d._nombre}". Disponibles: ${d._stockPaquetes} paq. / Solicitados: ${d.CantPaquetes} paq.`,
          { duration: 6000 }
        );
        return;
      }
    }

    // Limpiar el payload para enviar SOLO lo que el DTO espera
    const detallesLimpios = detalles.map(d => {
      const idSucursal = Number(d.ID_Sucursal);
      return {
        ID_Producto: Number(d.ID_Producto),
        ID_Almacen:  Number(d.ID_Almacen),
        Cantidad:    Number(d.Cantidad),
        ...(idSucursal > 0 ? { ID_Sucursal: idSucursal } : {}),
      };
    });

    try {
      const payload = {
        Descripcion: descripcion,
        Fecha: fecha,
        Hora: hora + ':00', // Formatear a HH:mm:ss si es necesario
        detalles: detallesLimpios,
      };

      const res = await inventoryApi.createEgreso(payload);

      setDescripcion('');
      setDetalles([]);
      // Opcional: reiniciar fecha y hora
      setFecha(new Date().toISOString().split('T')[0]);
      setHora(getCurrentTime());

      toast.success(`Despacho Registrado con Éxito!\nValor Total: Bs. ${res.MontoTotal || 0}`);
      load();
    } catch (e: any) {
      console.error("Error completo:", e.response?.data);
      toast.error(e.response?.data?.message || 'Error al guardar el egreso. Verifica los datos.');
    }
  };

  const resolveImg = (imgPath: string | undefined) => {
    if (!imgPath) return null;
    if (imgPath.startsWith('http')) return imgPath;
    return `http://localhost:3000${imgPath.startsWith('/') ? '' : '/'}${imgPath}`;
  };

  const exportPDFGlobal = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Membrete Corporativo
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("PARADISO", 15, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Logística y Distribución", 15, 26);

    // Título del Documento
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE GLOBAL DE EGRESOS", pageWidth / 2, 40, { align: "center" });

    // Metadatos
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de Emisión: ${new Date().toLocaleString()}`, 15, 50);

    const tableData = egresos.map((e: any, index: number) => {
      const emp = e.empleado;
      const usr = emp?.usuario;
      const username = usr?.Username || usr?.username || emp?.Username || emp?.username || '';
      const nombreEmp = emp ? `${emp.Nombre || emp.nombre || ''} ${emp.Apellido || emp.apellido || ''}`.trim() : '';
      const operadorGlobal = emp ? `${nombreEmp} (${username})`.trim() : 'Sistema';

      return [
        index + 1,
        `OUT-${e.ID_Egreso.toString().padStart(5, '0')}`,
        new Date(e.Fecha).toLocaleDateString() + ' ' + e.Hora,
        operadorGlobal,
        e.Descripcion || 'Sin detalle',
        `Bs. ${e.MontoTotal || 0}`
      ];
    });

    autoTable(doc, {
      startY: 55,
      head: [['N°', 'Comprobante', 'Fecha / Hora', 'Operador', 'Concepto', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40] }
    });

    doc.save(`Reporte_Global_Egresos_${new Date().getTime()}.pdf`);
  };

  const exportPDFIndividual = (nota: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Membrete Corporativo
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("PARADISO", 15, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Logística y Distribución", 15, 26);

    // Título del Documento
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`COMPROBANTE DE EGRESO N° ${nota.ID_Egreso.toString().padStart(5, '0')}`, pageWidth / 2, 40, { align: "center" });

    // Bloque de Metadatos (Auditoría)
    doc.setFontSize(10);
    const fechaFormat = new Date(nota.Fecha).toLocaleDateString();
    doc.text(`Fecha y Hora: ${fechaFormat} - ${nota.Hora}`, 15, 50);

    // Operador
    const emp = nota.empleado;
    const nombreCompleto = emp ? `${emp.Nombre || emp.nombre || ''} ${emp.Apellidos || emp.Apellido || emp.apellido || emp.apellidos || ''}`.trim() : 'Operador';
    const ciEmp = emp ? (emp.CI || emp.ci || '') : '';
    const operadorTexto = emp
      ? `${nombreCompleto} (CI: ${ciEmp})`
      : `${user?.username || 'Sistema'} (Sesión Actual)`;

    doc.text(`Responsable/Operador: ${operadorTexto}`, 15, 57);

    // Destino
    const sucursalDestino = nota.detalles?.[0]?.sucursal?.Nombre || nota.detalles?.[0]?.ID_Sucursal || 'Almacén/Sucursal No Especificada';
    doc.text(`Destino (Sucursal): ${sucursalDestino}`, 15, 64);

    const maxDescWidth = pageWidth - 30;
    const descLines = doc.splitTextToSize(`Concepto/Motivo: ${nota.Descripcion || 'Sin descripción'}`, maxDescWidth);
    doc.text(descLines, 15, 71);

    let currentY = 71 + (descLines.length * 5);

    // Tabla Principal
    const filas = nota.detalles?.map((d: any, index: number) => [
      index + 1,
      d.producto?.CodigoBarra || d.producto?.codigo || 'S/N',
      d.producto?.Nombre || d.producto?.nombre || 'Artículo',
      Number(d.Cantidad || d.cantidad).toFixed(2),
      d.producto?.medida?.Nombre || d.producto?.medida?.nombre || 'Uds',
      `Bs. ${Number(d.producto?.PrecioUnitario || d.producto?.precio || 0).toFixed(2)}`,
      d.ID_Almacen || d.idAlmacen || '1'
    ]) || [];

    autoTable(doc, {
      startY: currentY + 5,
      head: [['N°', 'Código', 'Descripción del Artículo', 'Cantidad', 'Unidad', 'Precio U.', 'Almacén']],
      body: filas,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40] } // Oscuro contable
    });

    const finalY = (doc as any).lastAutoTable.finalY || currentY + 10;

    // Pie de Página (Firmas)
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const signatureY = finalY + 30;
    doc.line(20, signatureY, 80, signatureY);
    doc.text(`Entregué Conforme (${nombreCompleto})`, 50, signatureY + 5, { align: 'center' });

    doc.line(pageWidth - 80, signatureY, pageWidth - 20, signatureY);
    doc.text('Recibí Conforme (Encargado/a de Sucursal)', pageWidth - 50, signatureY + 5, { align: 'center' });

    doc.save(`Comprobante-Egreso-${nota.ID_Egreso.toString().padStart(5, '0')}.pdf`);
  };

  return (
    <div className="flex flex-col gap-6 w-full relative z-10 transition-all duration-300">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl sm:text-3xl font-semibold text-[#BC2F32] dark:text-[#BC2F32] flex items-center gap-2">
          Operación: Egreso / Despacho
        </h2>
        <button onClick={exportPDFGlobal} className="bg-primary/10 text-primary px-3 sm:px-4 py-2 sm:py-2.5 rounded-md hover:bg-primary hover:text-white transition-colors flex items-center gap-2 font-semibold border border-primary/20 text-sm">
          <Printer className="w-4 h-4" /> Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-2">
        <div className="bg-card border border-divider rounded-md p-4 sm:p-8 relative overflow-hidden h-max">
          <h3 className="text-2xl font-semibold text-text mb-4">Nueva Boleta de Salida</h3>

          {/* Inputs de Fecha, Hora y Selectores */}
          <div className="flex flex-col gap-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select value={almacenGlobal} onChange={e => setAlmacenGlobal(e.target.value)} className="w-full bg-surface rounded-md px-4 py-3 outline-none focus:ring-1 ring-primary border border-divider font-normal">
                <option value="" className="bg-[#080808] text-white">-- Almacén Origen --</option>
                {almacenes.length === 0
                  ? <option disabled className="bg-[#080808] text-[#888888]">Sin registros</option>
                  : almacenes.map(a => <option key={a.ID_Almacen} value={a.ID_Almacen} className="bg-[#080808] text-white">{a.Nombre}</option>)}
              </select>
              <select value={sucursalGlobal} onChange={e => setSucursalGlobal(e.target.value)} className="w-full bg-surface rounded-md px-4 py-3 outline-none focus:ring-1 ring-primary border border-divider font-normal">
                <option value="" className="bg-[#080808] text-white">-- Sucursal Destino --</option>
                {sucursales.length === 0
                  ? <option disabled className="bg-[#080808] text-[#888888]">Sin registros</option>
                  : sucursales.map(s => <option key={s.ID_Sucursal} value={s.ID_Sucursal} className="bg-[#080808] text-white">{s.Nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} className="w-full bg-surface rounded-md px-4 py-3 outline-none focus:ring-1 ring-primary border border-divider font-normal" />
              <input type="time" required value={hora} onChange={e => setHora(e.target.value)} className="w-full bg-surface rounded-md px-4 py-3 outline-none focus:ring-1 ring-primary border border-divider font-normal" />
            </div>
          </div>

          <input
            placeholder="Motivo del despacho / descripción..."
            value={descripcion} onChange={e => setDescripcion(e.target.value)}
            className="w-full mb-6 bg-surface rounded-md px-4 py-4 outline-none focus:ring-1 ring-primary border border-divider font-normal"
          />

          <div className="mb-6 relative z-30">
            <label className="text-[10px] tracking-widest font-semibold uppercase text-[#BC2F32] opacity-70 mb-2 block">Extracción de Ítem</label>
            <div className="flex items-center bg-surface rounded-md px-4 py-3 border border-divider focus-within:border-primary transition-all">
              <Search className="w-5 h-5 opacity-50 mr-2 text-[#BC2F32]" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Busca en Catálogo Global (Código o Nombre)..." className="bg-transparent border-none outline-none w-full font-normal" />
            </div>

            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 w-full bg-background border border-divider rounded-md mt-2 overflow-hidden z-40 max-h-[300px] overflow-y-auto">
                {searchResults.map((p, index) => {
                  const idReal = p.ID_Producto || p.id || index;
                  const nombreReal = p.Nombre || p.nombre;
                  const codigoReal = p.CodigoBarra || p.codigo || 'S/N';
                  const imgUrl = p.Image ? resolveImg(p.Image) : null;
                  const pas: any[] = p.productoAlmacenes || [];
                  // Mostrar stock del almacén seleccionado; si no hay selección, mostrar total
                  let stockReal: number;
                  if (almacenGlobal && pas.length > 0) {
                    const paTarget = pas.find((pa: any) => Number(pa.ID_Almacen) === Number(almacenGlobal));
                    stockReal = paTarget ? Number(paTarget.Stock_Actual) : 0;
                  } else {
                    stockReal = pas.length > 0
                      ? pas.reduce((acc: number, pa: any) => acc + Number(pa.Stock_Actual), 0)
                      : Number(p.Stock_Actual ?? p.stock ?? 0);
                  }
                  const fcRaw2 = Math.max(1, Number(p.medida?.factor_conversion ?? 1));
                  const factorProd = fcRaw2 > 1 ? fcRaw2 : parseBulto(p.medida?.Unidades_Bulto);
                  const stockPaq = Math.floor(stockReal / factorProd);

                  return (
                    <div key={idReal} onClick={() => addDetalle(p)} className="flex items-center gap-4 p-3 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer border-b border-black/5">
                      <div className="w-10 h-10 bg-[#BC2F32]/10 rounded overflow-hidden flex items-center justify-center text-[#BC2F32] font-semibold text-xs shrink-0">
                        {imgUrl ? <img src={imgUrl} className="w-full h-full object-cover" /> : 'IMG'}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm leading-tight text-text">{nombreReal}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#CC7A00]/15 text-[#CC7A00] border border-[#CC7A00]/20">
                            {stockPaq} Paq.
                          </span>
                          <span className="opacity-30 text-[9px]">|</span>
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${stockReal > 0 ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-[#BC2F32]/10 text-[#BC2F32] border-[#BC2F32]/20'}`}>
                            {stockReal} Uds.
                          </span>
                          <span className="text-[9px] opacity-40 font-mono">{codigoReal}</span>
                        </div>
                      </div>
                      <Plus className="w-5 h-5 text-red-500" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {detalles.length > 0 && (
            <div className="border border-primary/20 rounded-md overflow-hidden mb-6 relative z-10 bg-card">
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[500px]">
                <thead className="bg-[#BC2F32]/5 border-b border-[#BC2F32]/15 text-[#BC2F32]">
                  <tr>
                    <th className="p-3 text-xs uppercase tracking-wider font-semibold">Merceología</th>
                    <th className="p-3 w-36 text-xs uppercase tracking-wider font-semibold text-center">Despacho</th>
                    <th className="p-3 w-32 text-xs uppercase tracking-wider font-semibold">Origen M.</th>
                    <th className="p-3 w-32 text-xs uppercase tracking-wider font-semibold">Sucursal Destino</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1A1A]">
                  {detalles.map((d, i) => {
                    const isOverStock = Number(d.Cantidad) > Number(d._stockFisico) || (Number(d.CantPaquetes) > 0 && Number(d.CantPaquetes) > Number(d._stockPaquetes));
                    return (
                    <tr key={i} className={`hover:bg-red-500/5 transition-colors ${isOverStock ? 'bg-red-500/20' : ''}`}>
                      <td className="p-3">
                        <p className="font-semibold text-xs">{d._nombre}</p>
                        {d._stockPaquetes !== undefined && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[9px] font-semibold text-[#CC7A00] bg-[#CC7A00]/10 px-1.5 py-0.5 rounded border border-[#CC7A00]/20">
                              {d._stockPaquetes} paq. disp.
                            </span>
                            <span className="text-[9px] opacity-40 font-mono">| {d._stockFisico} uds.</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-semibold text-[#CC7A00] w-8 flex-shrink-0">Paq.</span>
                            <input
                              type="number" min="0" step="1"
                              value={d.CantPaquetes ?? 0}
                              onChange={e => updatePaquetes(i, Number(e.target.value))}
                              className="w-full bg-surface border border-[#CC7A00]/30 rounded px-2 py-1 outline-none focus:ring-1 ring-[#CC7A00] font-mono font-normal text-center text-[#CC7A00] text-xs"
                              placeholder="0"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-semibold text-[#BC2F32] w-8 flex-shrink-0">Uds.</span>
                            <input
                              type="number" min="0" step="1"
                              value={d.Cantidad}
                              onChange={e => updateUnidades(i, Number(e.target.value))}
                              className="w-full bg-surface border border-primary/20 rounded px-2 py-1 outline-none focus:ring-1 ring-primary font-mono font-normal text-center text-primary text-xs"
                              placeholder="1"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <select value={d.ID_Almacen} onChange={e => updateAlmacen(i, e.target.value)} className="w-full bg-surface border border-primary/15 rounded px-1 py-1 outline-none text-[10px] font-semibold uppercase">
                          {almacenes.length === 0
                            ? <option disabled>Sin registros</option>
                            : almacenes.map(a => <option key={a.ID_Almacen} value={a.ID_Almacen} className="bg-[#080808] text-white">{a.Nombre}</option>)}
                        </select>
                      </td>
                      <td className="p-3">
                        <select value={d.ID_Sucursal} onChange={e => updateRow(i, 'ID_Sucursal', e.target.value)} className="w-full bg-surface border border-primary/15 rounded px-1 py-1 outline-none text-[10px] font-semibold uppercase">
                          {sucursales.length === 0
                            ? <option disabled>Sin registros</option>
                            : sucursales.map(s => <option key={s.ID_Sucursal} value={s.ID_Sucursal} className="bg-[#080808] text-white">{s.Nombre}</option>)}
                        </select>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => removeRow(i)} className="text-red-500 hover:text-white hover:bg-red-500 bg-red-500/10 p-1.5 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
              </div>
            </div>
          )}

          <button onClick={handleSave} className="w-full bg-primary hover:brightness-110 text-white font-semibold uppercase tracking-wider py-4 rounded-md flex items-center justify-center gap-2 border border-primary/40 active:scale-95 transition-all">
            <Save className="w-5 h-5" /> Registrar Despacho de Inventario
          </button>
        </div>

        <div className="bg-card border border-divider rounded-md p-6 flex flex-col gap-4 overflow-y-auto max-h-[800px]">
          <h3 className="text-lg font-semibold text-text mb-2 sticky top-0 bg-card/95 p-2 rounded-md z-20 border border-divider">Histórico de Egresos</h3>
          {egresos.map(nota => (
            <div key={nota.ID_Egreso} className="bg-card rounded-md p-5 border border-divider flex flex-col gap-3 relative hover:-translate-y-0.5 transition-transform border-l-4 border-l-primary">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-[#BC2F32] text-lg tracking-widest">OUT-{nota.ID_Egreso.toString().padStart(5, '0')}</h4>
                  <p className="text-[10px] font-normal uppercase opacity-50">{new Date(nota.Fecha).toLocaleDateString()} - <span className="text-secondary">{nota.Hora}</span></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => exportPDFIndividual(nota)} className="bg-surface text-muted border border-divider px-3 py-1 rounded hover:bg-card hover:text-text transition-colors flex items-center gap-1.5 font-semibold text-[10px]">
                    <Printer className="w-3.5 h-3.5" /> IMPRIMIR COMPROBANTE
                  </button>
                  <div className="bg-[#2a1215] text-[#a61d24] px-3 py-1 rounded text-[10px] font-semibold border border-[#a61d24] flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Bs. {nota.MontoTotal} AutoCálculo</div>
                </div>
              </div>
              <p className="text-sm font-medium leading-relaxed">{nota.Descripcion}</p>
              <div className="mt-2 pt-3 border-t border-black/5 dark:border-white/5 flex justify-end items-center opacity-70">
                <div className="text-[10px] font-normal uppercase tracking-widest text-right opacity-50">Firma Digital (Token): OP-{nota.empleado?.CI || 'SISTEMA'}</div>
              </div>
            </div>
          ))}
          {egresos.length === 0 && <span className="opacity-50 font-bold p-10 text-center">Cero actividad de sustracción registrada.</span>}
        </div>
      </div>
    </div>
  );
};