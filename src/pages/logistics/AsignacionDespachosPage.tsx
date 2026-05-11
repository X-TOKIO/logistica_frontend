import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import { useAuth } from '../../context/AuthContext';
import { logisticsApi } from '../../services/logistics';
import { logisticsCatalogApi } from '../../services/logistics-catalog';
import {
  Truck, Map, Save, AlertCircle, Calendar, Clock, MapPin,
  Gauge, Info, History, FileText, Printer, Package, X,
} from 'lucide-react';

const toLocalDatetimeValue = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// ── PDF Generator ────────────────────────────────────────────────────────────

const generateBoletaPDF = (dc: any) => {
  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const desp = dc.despacho || dc;
  const ruta = desp?.ruta;
  const camion = dc.camion;
  const emp = camion?.empleado;
  const chofer = emp ? `${emp.Nombre || ''} ${emp.Apellido || emp.Apellidos || ''}`.trim() : 'N/A';

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 48, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text('PARADISO', 14, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Logística y Distribución', 14, 30);

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('BOLETA DE DESPACHO', W / 2, 40, { align: 'center' });

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  const despId = desp?.ID_Despacho ?? dc.ID_Despacho ?? '—';
  doc.text(`DSP-${String(despId).padStart(5, '0')}`, W / 2, 64, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado: ${new Date().toLocaleString('es-BO')}`, W / 2, 72, { align: 'center' });

  let y = 82;
  const drawBox = (title: string, rows: [string, string][]) => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text(title.toUpperCase(), 14, y);

    const bH = rows.length * 11 + 10;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y + 3, W - 28, bH, 3, 3, 'FD');

    rows.forEach(([label, value], i) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text(label, 20, y + 12 + i * 11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(value || 'N/A', 80, y + 12 + i * 11);
    });

    y += bH + 16;
  };

  const egresoId = desp?.ID_Egreso ?? '—';
  const estado   = dc.EstadoDeEnvio || 'EN TRÁNSITO';
  const origen   = ruta?.Origen   || ruta?.almacen?.Nombre  || 'N/A';
  const destino  = ruta?.Destino  || ruta?.sucursal?.Nombre || 'N/A';
  const distKm   = ruta?.Distancia_KM ? `${Number(ruta.Distancia_KM).toFixed(1)} km` : 'N/A';
  const tEst     = ruta?.Tiempo_Estimado_Horas ? `${Number(ruta.Tiempo_Estimado_Horas).toFixed(1)} h` : 'N/A';
  const fSalida  = desp?.FechaHora_Salida            ? new Date(desp.FechaHora_Salida).toLocaleString('es-BO')           : 'N/A';
  const fEntrega = desp?.FechaHora_Estimada_Entrega  ? new Date(desp.FechaHora_Estimada_Entrega).toLocaleString('es-BO') : 'N/A';

  drawBox('Datos del Despacho', [
    ['Código Despacho:', `DSP-${String(despId).padStart(5, '0')}`],
    ['Egreso Referencia:', `OUT-${String(egresoId).padStart(5, '0')}`],
    ['Estado:', estado],
  ]);

  drawBox('Vehículo y Conductor', [
    ['Placa:', camion?.Placa || 'N/A'],
    ['Modelo:', camion?.Modelo || 'N/A'],
    ['Conductor:', chofer],
  ]);

  drawBox('Ruta de Distribución', [
    ['Origen:', origen],
    ['Destino:', destino],
    ['Distancia:', distKm],
    ['Tiempo Estimado:', tEst],
  ]);

  drawBox('Programación Logística', [
    ['Fecha de Salida:', fSalida],
    ['Entrega Estimada:', fEntrega],
  ]);

  y += 6;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y, W / 2 - 8, y);
  doc.line(W / 2 + 8, y, W - 14, y);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Responsable de Logística', W / 4, y + 6, { align: 'center' });
  doc.text('Confirmación de Recepción', W * 3 / 4, y + 6, { align: 'center' });

  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.04 }));
  doc.setFontSize(55);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('PARADISO', W / 2, 160, { align: 'center', angle: 45 });
  doc.restoreGraphicsState();

  doc.save(`Boleta-Despacho-DSP-${String(despId).padStart(5, '0')}.pdf`);
};

// ── Main Component ────────────────────────────────────────────────────────────

export const AsignacionDespachosPage = () => {
  const { user } = useAuth();
  const [view,          setView]          = useState<'pendientes' | 'historial'>('pendientes');
  const [pendientes,    setPendientes]    = useState<any[]>([]);
  const [historial,     setHistorial]     = useState<any[]>([]);
  const [rutas,         setRutas]         = useState<any[]>([]);
  const [camiones,      setCamiones]      = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [assigningEgreso, setAssigningEgreso] = useState<any | null>(null);

  const defaultSalida  = toLocalDatetimeValue(new Date());
  const defaultEntrega = defaultSalida;

  const [selections, setSelections] = useState<{
    [key: number]: { idRuta: number; idCamion: number; fechaSalida: string; fechaEntrega: string };
  }>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [pendRes, auxRes, vehiculosRes, histRes] = await Promise.allSettled([
        logisticsApi.getPendientes(),
        logisticsApi.getAuxiliares(),
        logisticsCatalogApi.getVehiculos(),
        logisticsApi.getHistorial(),
      ]);

      const pend        = pendRes.status     === 'fulfilled' ? pendRes.value                          : [];
      const aux         = auxRes.status      === 'fulfilled' ? auxRes.value                           : { rutas: [], camiones: [] };
      const vehiculosCat = vehiculosRes.status === 'fulfilled' ? vehiculosRes.value                   : [];
      const hist        = histRes.status     === 'fulfilled' ? histRes.value                          : [];

      setPendientes(pend);
      setHistorial(hist);

      const rutasData = (aux as any).rutas || [];
      setRutas(rutasData);

      const legacyCamiones: any[] = (aux as any).camiones || [];
      const legacyPlacas = new Set(legacyCamiones.map((c: any) => c.Placa));
      const newVehiculos = (vehiculosCat || [])
        .filter((v: any) => !legacyPlacas.has(v.Placa))
        .map((v: any) => ({
          ID_Camion: v.ID_Vehiculo,
          Placa: v.Placa,
          Modelo: [v.Marca, v.Modelo].filter(Boolean).join(' '),
          Estado: v.Estado,
          empleado: v.empleado,
          _catalog: true,
        }));
      setCamiones([...legacyCamiones, ...newVehiculos]);
    } catch (e) {
      toast.error('Error al cargar datos de logística.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const getSel = (idEgreso: number) => selections[idEgreso] || {
    idRuta: 0, idCamion: 0, fechaSalida: defaultSalida, fechaEntrega: defaultEntrega,
  };

  const updateSel = (idEgreso: number, field: string, val: string | number) => {
    setSelections(prev => {
      const current = prev[idEgreso] ?? { idRuta: 0, idCamion: 0, fechaSalida: defaultSalida, fechaEntrega: defaultSalida };
      const updated = {
        ...current,
        [field]: typeof val === 'string' && field.startsWith('id') ? Number(val) : val,
      };

      const rutaId    = field === 'idRuta'      ? Number(val)  : updated.idRuta;
      const salidaStr = field === 'fechaSalida' ? String(val)  : updated.fechaSalida;
      const ruta = rutas.find(r => r.ID_Ruta === rutaId);
      if (ruta?.Tiempo_Estimado_Horas && salidaStr) {
        const salidaDate = new Date(salidaStr);
        if (!isNaN(salidaDate.getTime())) {
          updated.fechaEntrega = toLocalDatetimeValue(
            new Date(salidaDate.getTime() + Number(ruta.Tiempo_Estimado_Horas) * 3_600_000),
          );
        }
      }

      return { ...prev, [idEgreso]: updated };
    });
  };

  const getRutaInfo = (idRuta: number) => rutas.find(r => r.ID_Ruta === idRuta) || null;

  const labelRuta = (r: any) => {
    if (!r) return '—';
    if (r.Nombre_Ruta) return r.Nombre_Ruta;
    const origen  = r.Origen  || r.almacen?.Nombre  || 'Origen';
    const destino = r.Destino || r.sucursal?.Nombre || 'Destino';
    return `${origen} → ${destino}`;
  };

  const handleAssign = async (egreso: any, onSuccess?: () => void) => {
    const sel = getSel(egreso.ID_Egreso);
    if (!sel.idRuta || !sel.idCamion) {
      return toast.error('Selecciona Ruta y Vehículo antes de confirmar el despacho.');
    }
    try {
      await logisticsApi.createDespacho({
        ID_Egreso: egreso.ID_Egreso,
        ID_Ruta: sel.idRuta,
        ID_Camion: sel.idCamion,
        FechaHora_Salida: sel.fechaSalida,
        FechaHora_Estimada_Entrega: sel.fechaEntrega,
        emp_userId: user?.id,
      });
      toast.success(`Despacho OUT-${String(egreso.ID_Egreso).padStart(5,'0')} programado correctamente.`);
      loadData();
      onSuccess?.();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error al guardar el despacho.');
    }
  };

  const estadoBadge = (estado: string) => {
    if (!estado) return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    if (estado === 'ENTREGADO' || estado.includes('ENTREGADO')) return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (estado === 'EN_RUTA' || estado.includes('TRÁNSITO') || estado.includes('TRANSITO')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (estado === 'DETENIDO') return 'bg-red-500/10 text-red-500 border-red-500/20';
    return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
  };

  const estadoLabel = (desp: any, fallback: string) => {
    const s = desp?.Estado_Despacho;
    if (!s || s === 'PENDIENTE') return fallback || 'PENDIENTE';
    if (s === 'EN_RUTA') return 'EN RUTA';
    return s;
  };

  // ── Inputs reutilizables para el modal ──
  const selectCls = 'bg-transparent text-text border-none outline-none w-full font-bold text-sm';
  const inputDateCls = 'bg-surface border border-divider rounded-xl px-3 py-2.5 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 text-xs font-medium text-text transition-all w-full';

  return (
    <div className="flex flex-col gap-6 w-full relative z-10 transition-all duration-300">
      <h2 className="text-2xl sm:text-4xl font-black text-primary drop-shadow-sm flex items-center gap-3">
        <Truck className="w-9 h-9" /> Centro de Asignación de Despacho
      </h2>

      {/* Tab switcher */}
      <div className="flex gap-3 p-2 bg-surface border border-divider rounded-[1.5rem] w-max shadow-lg">
        <button
          onClick={() => setView('pendientes')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
            view === 'pendientes'
              ? 'bg-primary text-white shadow-[0_0_15px_rgba(var(--color-primary),0.4)]'
              : 'text-text hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Package className="w-4 h-4" /> Pendientes
          {pendientes.length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{pendientes.length}</span>
          )}
        </button>
        <button
          onClick={() => setView('historial')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
            view === 'historial'
              ? 'bg-primary text-white shadow-[0_0_15px_rgba(var(--color-primary),0.4)]'
              : 'text-text hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <History className="w-4 h-4" /> Historial
          <span className="ml-1 text-xs font-black px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10">{historial.length}</span>
        </button>
      </div>

      {/* ── PENDIENTES ── */}
      {view === 'pendientes' && (
        <div className="bg-card border border-divider rounded-[2rem] p-4 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
          <h3 className="text-2xl font-black text-text mb-6">Egresos Pendientes de Transporte</h3>

          {loading ? (
            <div className="p-10 text-center font-bold animate-pulse text-primary opacity-50">
              Localizando despachos pendientes...
            </div>
          ) : pendientes.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center opacity-40">
              <AlertCircle className="w-20 h-20 mb-4" />
              <h4 className="text-xl font-black uppercase tracking-widest">Todo Despachado</h4>
              <p>No existen egresos esperando asignación de transporte.</p>
            </div>
          ) : (
            <div className="overflow-x-auto relative z-10">
              <table className="w-full min-w-[500px] text-sm">
                <thead className="bg-card border-b border-divider">
                  <tr>
                    <th className="p-4 text-left text-muted uppercase text-xs font-black tracking-wider">Egreso</th>
                    <th className="p-4 text-left text-muted uppercase text-xs font-black tracking-wider">Fecha</th>
                    <th className="p-4 text-left text-muted uppercase text-xs font-black tracking-wider">Motivo</th>
                    <th className="p-4 text-right text-muted uppercase text-xs font-black tracking-wider">Monto</th>
                    <th className="p-4 text-center text-muted uppercase text-xs font-black tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {pendientes.map(nota => (
                    <tr key={nota.ID_Egreso} className="hover:bg-primary/4 transition-colors group">
                      <td className="p-4">
                        <span className="font-black text-primary tracking-widest font-mono">
                          OUT-{String(nota.ID_Egreso).padStart(5, '0')}
                        </span>
                      </td>
                      <td className="p-4 text-muted text-xs font-medium">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(nota.Fecha).toLocaleDateString('es-BO')}
                        </span>
                      </td>
                      <td className="p-4 text-text font-medium max-w-xs truncate">
                        {nota.Descripcion || '—'}
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-black text-secondary">Bs. {nota.MontoTotal}</span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => setAssigningEgreso(nota)}
                          className="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95 border border-primary/20 hover:border-transparent"
                        >
                          Asignar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── HISTORIAL ── */}
      {view === 'historial' && (
        <div className="bg-card border border-divider rounded-[2rem] p-4 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-secondary/10 blur-[100px] rounded-full pointer-events-none" />
          <h3 className="text-2xl font-black text-text mb-6 flex items-center gap-3">
            <History className="w-6 h-6 text-secondary" /> Historial de Despachos Asignados
          </h3>

          {loading ? (
            <div className="p-10 text-center font-bold animate-pulse text-primary opacity-50">
              Cargando historial...
            </div>
          ) : historial.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center opacity-40">
              <FileText className="w-20 h-20 mb-4" />
              <h4 className="text-xl font-black uppercase tracking-widest">Sin Registros</h4>
              <p>No hay despachos asignados en el historial aún.</p>
            </div>
          ) : (
            <div className="overflow-x-auto relative z-10">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-card border-b border-divider">
                  <tr>
                    <th className="py-3 px-4 text-left text-muted uppercase text-xs font-black tracking-wider">Despacho</th>
                    <th className="py-3 px-4 text-left text-muted uppercase text-xs font-black tracking-wider">Egreso Ref.</th>
                    <th className="py-3 px-4 text-left text-muted uppercase text-xs font-black tracking-wider">Ruta</th>
                    <th className="py-3 px-4 text-left text-muted uppercase text-xs font-black tracking-wider">Vehículo</th>
                    <th className="py-3 px-4 text-left text-muted uppercase text-xs font-black tracking-wider">Conductor</th>
                    <th className="py-3 px-4 text-left text-muted uppercase text-xs font-black tracking-wider">Salida</th>
                    <th className="py-3 px-4 text-left text-muted uppercase text-xs font-black tracking-wider">Estado</th>
                    <th className="py-3 px-4 text-center text-muted uppercase text-xs font-black tracking-wider">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {historial.map((dc, idx) => {
                    const desp = dc.despacho;
                    const ruta = desp?.ruta;
                    const cam  = dc.camion;
                    const emp  = cam?.empleado;
                    const key  = `${dc.ID_Despacho ?? idx}-${dc.ID_Camion ?? idx}`;
                    return (
                      <tr key={key} className="hover:bg-black/3 dark:hover:bg-white/3 transition-colors group">
                        <td className="py-4 px-4">
                          <span className="font-black text-primary text-sm">
                            DSP-{String(desp?.ID_Despacho ?? '—').padStart(5, '0')}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-bold text-secondary text-xs">
                            OUT-{String(desp?.ID_Egreso ?? '—').padStart(5, '0')}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-bold text-xs flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-primary shrink-0" />
                            {labelRuta(ruta)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-mono font-bold text-xs text-text">
                            {cam?.Placa || 'N/A'}
                            <span className="text-[10px] font-normal text-muted ml-1">({cam?.Modelo || '—'})</span>
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-bold text-xs text-text">
                            {emp ? `${emp.Nombre || ''} ${emp.Apellido || emp.Apellidos || ''}`.trim() : 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-xs font-medium text-muted">
                            {desp?.FechaHora_Salida
                              ? new Date(desp.FechaHora_Salida).toLocaleDateString('es-BO')
                              : 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${estadoBadge(desp?.Estado_Despacho || dc.EstadoDeEnvio)}`}>
                            {estadoLabel(desp, dc.EstadoDeEnvio)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => generateBoletaPDF(dc)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 opacity-0 group-hover:opacity-100"
                          >
                            <Printer className="w-3.5 h-3.5" /> PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: Asignar Despacho ── */}
      {assigningEgreso && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onClick={() => setAssigningEgreso(null)}
        >
          <div
            className="bg-card border border-divider rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 sm:px-8 pt-7 pb-5 border-b border-divider flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted mb-0.5">Asignar Transporte</p>
                <h3 className="text-lg font-black text-text font-mono">
                  OUT-{String(assigningEgreso.ID_Egreso).padStart(5, '0')}
                </h3>
                {assigningEgreso.Descripcion && (
                  <p className="text-xs text-muted font-medium mt-0.5 truncate max-w-xs">{assigningEgreso.Descripcion}</p>
                )}
              </div>
              <button
                onClick={() => setAssigningEgreso(null)}
                className="p-2 rounded-xl hover:bg-black/8 dark:hover:bg-white/8 text-text opacity-40 hover:opacity-80 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="px-4 sm:px-8 py-4 sm:py-6 flex flex-col gap-4">

              {/* Ruta */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Ruta</label>
                <div className="flex items-center bg-surface border border-divider rounded-xl px-4 py-2.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <Map className="w-4 h-4 text-primary opacity-60 mr-3 shrink-0" />
                  <select
                    value={getSel(assigningEgreso.ID_Egreso).idRuta || ''}
                    onChange={e => updateSel(assigningEgreso.ID_Egreso, 'idRuta', e.target.value)}
                    className={selectCls}
                  >
                    <option value="" disabled>-- Seleccione Ruta --</option>
                    {rutas.map(r => (
                      <option key={r.ID_Ruta} value={r.ID_Ruta}>{labelRuta(r)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Info de Ruta */}
              {getRutaInfo(getSel(assigningEgreso.ID_Egreso).idRuta) && (() => {
                const rutaInfo = getRutaInfo(getSel(assigningEgreso.ID_Egreso).idRuta)!;
                return (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary opacity-60 flex items-center gap-1">
                      <Info className="w-3 h-3" /> Info de Ruta Seleccionada
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-bold">
                      <span className="text-muted">Origen:</span>
                      <span className="flex items-center gap-1 text-primary">
                        <MapPin className="w-3 h-3" />
                        {rutaInfo.Origen || rutaInfo.almacen?.Nombre || '—'}
                      </span>
                      <span className="text-muted">Destino:</span>
                      <span className="flex items-center gap-1 text-secondary">
                        <MapPin className="w-3 h-3" />
                        {rutaInfo.Destino || rutaInfo.sucursal?.Nombre || '—'}
                      </span>
                      {rutaInfo.Distancia_KM && (
                        <>
                          <span className="text-muted">Distancia:</span>
                          <span className="flex items-center gap-1 text-green-500">
                            <Gauge className="w-3 h-3" />
                            {Number(rutaInfo.Distancia_KM).toFixed(1)} km
                          </span>
                        </>
                      )}
                      {rutaInfo.Tiempo_Estimado_Horas && (
                        <>
                          <span className="text-muted">T. Estimado:</span>
                          <span className="flex items-center gap-1 text-orange-500">
                            <Clock className="w-3 h-3" />
                            {Number(rutaInfo.Tiempo_Estimado_Horas).toFixed(1)} h
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Vehículo */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Vehículo</label>
                <div className="flex items-center bg-surface border border-divider rounded-xl px-4 py-2.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                  <Truck className="w-4 h-4 text-primary opacity-60 mr-3 shrink-0" />
                  <select
                    value={getSel(assigningEgreso.ID_Egreso).idCamion || ''}
                    onChange={e => updateSel(assigningEgreso.ID_Egreso, 'idCamion', e.target.value)}
                    className={selectCls}
                  >
                    <option value="" disabled>-- Seleccione Vehículo --</option>
                    {camiones.filter(c => c.Estado === 'DISPONIBLE').map(c => (
                      <option key={c.ID_Camion} value={c.ID_Camion}>
                        {c.Placa} ({c.Modelo}) — OP-{c.empleado?.Nombre || c.ID_Empleado}
                        {c._catalog ? ' ✦' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Salida
                  </label>
                  <input
                    type="datetime-local"
                    value={getSel(assigningEgreso.ID_Egreso).fechaSalida}
                    onChange={e => updateSel(assigningEgreso.ID_Egreso, 'fechaSalida', e.target.value)}
                    className={inputDateCls}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Entrega Est.
                  </label>
                  <input
                    type="datetime-local"
                    value={getSel(assigningEgreso.ID_Egreso).fechaEntrega}
                    onChange={e => updateSel(assigningEgreso.ID_Egreso, 'fechaEntrega', e.target.value)}
                    className={inputDateCls}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-4 sm:px-8 py-5 border-t border-divider flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAssigningEgreso(null)}
                className="px-5 py-2.5 bg-black/6 dark:bg-white/6 hover:bg-black/10 dark:hover:bg-white/10 text-text rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleAssign(assigningEgreso, () => setAssigningEgreso(null))}
                className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-primary/90 active:scale-95 transition-all"
              >
                <Save className="w-3.5 h-3.5" /> Confirmar Despacho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
