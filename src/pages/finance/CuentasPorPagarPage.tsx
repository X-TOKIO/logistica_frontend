import { useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, Clock, Receipt, RefreshCw, CreditCard, Eye, History,
  X, AlertTriangle, ChevronDown, ChevronUp, Layers,
} from 'lucide-react';
import { toast } from 'sonner';
import { financeApi } from '../../services/finance';
import { useTheme } from '../../context/ThemeContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Proveedor {
  ID_Proveedor: number;
  NIT: string;
  Nombre_RazonSocial: string;
}

interface NotaCompra {
  ID_Compra: number;
  Fecha_Emision: string;
  Monto_Total: number;
  proveedor: Proveedor;
}

interface CuotaCxP {
  ID_CuotaCxP: number;
  Numero_Cuota: number;
  Fecha_Vencimiento: string;
  Monto: number;
  Estado: string;
}

interface CuentaPorPagar {
  ID_Cuenta: number;
  Saldo_Pendiente: number;
  Fecha_Vencimiento: string;
  Estado_Pago: string;
  notaCompra: NotaCompra;
  cuotas?: CuotaCxP[];
}

interface AlertasCxP {
  vencidas: CuentaPorPagar[];
  proximas: CuentaPorPagar[];
  cuotasVencidas?: { ID_CuotaCxP: number; Monto: number; Fecha_Vencimiento: string; Estado: string }[];
  cuotasProximas?: { ID_CuotaCxP: number; Monto: number; Fecha_Vencimiento: string; Estado: string }[];
}

interface RegistroPago {
  ID_Pago: number;
  Monto_Pagado: number;
  Fecha_Pago: string;
  Metodo_Pago: 'EFECTIVO' | 'QR';
  Referencia_Comprobante: string | null;
  Observaciones: string | null;
  empleado?: { Nombre: string; Paterno?: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  `Bs. ${new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  const utc = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  return utc.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const diasRestantes = (fechaVencimiento: string): number => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fv = new Date(fechaVencimiento);
  fv.setHours(0, 0, 0, 0);
  return Math.floor((fv.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
};

const isVencida = (fechaVencimiento: string): boolean => diasRestantes(fechaVencimiento) < 0;

// ── Nivel de urgencia para proximas ──────────────────────────────────────────

type UrgencyLevel = 'normal' | 'warning' | 'danger' | 'expired';

const getUrgency = (proximas: CuentaPorPagar[]): UrgencyLevel => {
  if (!proximas.length) return 'normal';
  const minDias = Math.min(...proximas.map(c => diasRestantes(c.Fecha_Vencimiento)));
  if (minDias < 0) return 'expired';
  if (minDias <= 3) return 'danger';
  if (minDias <= 5) return 'warning';
  return 'normal';
};


// ── Modal Historial ───────────────────────────────────────────────────────────

interface ModalHistorialProps {
  cuenta: CuentaPorPagar;
  onClose: () => void;
}

const ModalHistorial = ({ cuenta, onClose }: ModalHistorialProps) => {
  const [historial, setHistorial] = useState<RegistroPago[]>([]);
  const [loading, setLoading] = useState(true);
  const proveedor = cuenta.notaCompra?.proveedor?.Nombre_RazonSocial ?? '—';

  useEffect(() => {
    financeApi.getHistorialPagosCuenta(cuenta.ID_Cuenta)
      .then(data => setHistorial(data))
      .catch(() => toast.error('Error al cargar el historial de pagos'))
      .finally(() => setLoading(false));
  }, [cuenta.ID_Cuenta]);

  const totalAbonado = historial.reduce((acc, p) => acc + Number(p.Monto_Pagado), 0);

  const metodoBadge = (m: RegistroPago['Metodo_Pago']) =>
    m === 'EFECTIVO' ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-gray-200 dark:bg-[#13151f] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-200 dark:border-white/10">
          <div>
            <h2 className="font-black text-slate-900 dark:text-white text-base leading-tight flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400 dark:text-white/40" /> Historial de Pagos
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-white/40 mt-1 font-medium">
              CxP #{cuenta.ID_Cuenta} &mdash; {proveedor}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-colors mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-10 text-slate-400 dark:text-white/30">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Cargando historial...</span>
            </div>
          ) : historial.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-300 dark:text-white/20">
              <History className="w-9 h-9" />
              <p className="text-sm font-bold">Sin abonos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10">
                    {['Fecha', 'Método', 'Referencia', 'Registrado por', 'Monto'].map(col => (
                      <th key={col} className="pb-2.5 text-left font-black text-[10px] uppercase tracking-widest text-slate-400 dark:text-white/25 pr-4 last:text-right last:pr-0">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {historial.map(p => (
                    <tr key={p.ID_Pago} className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 pr-4 text-slate-600 dark:text-white/60 whitespace-nowrap font-medium text-[13px]">
                        {fmtDate(p.Fecha_Pago)}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${metodoBadge(p.Metodo_Pago)}`}>
                          {p.Metodo_Pago}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-500 dark:text-white/40 text-[12px] font-medium max-w-[120px] truncate">
                        {p.Referencia_Comprobante || '—'}
                      </td>
                      <td className="py-3 pr-4 text-slate-500 dark:text-white/40 text-[12px] font-medium whitespace-nowrap">
                        {p.empleado ? `${p.empleado.Nombre}${p.empleado.Paterno ? ' ' + p.empleado.Paterno : ''}` : '—'}
                      </td>
                      <td className="py-3 text-right font-black text-green-400 whitespace-nowrap">
                        {fmtMoney(Number(p.Monto_Pagado))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-white/10">
                    <td colSpan={4} className="pt-3.5 text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-white/25">Total abonado</td>
                    <td className="pt-3.5 text-right font-black text-slate-900 dark:text-white">{fmtMoney(totalAbonado)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Plan de Pagos (fila expandible) ──────────────────────────────────────────

const PlanPagoRow = ({ cuenta, colSpan }: { cuenta: CuentaPorPagar; colSpan: number }) => {
  const cuotas = cuenta.cuotas ?? [];
  if (cuotas.length === 0) return null;

  const total = cuotas.length;

  return (
    <tr className="bg-black/5 dark:bg-white/[0.02]">
      <td colSpan={colSpan} className="px-6 pb-4 pt-1">
        <div className="ml-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-text/30 mb-2 flex items-center gap-1.5">
            <Layers className="w-3 h-3" /> Plan de Pagos
          </p>
          <div className="flex flex-col gap-1.5">
            {cuotas.map(cuota => {
              const cuotaDias = diasRestantes(cuota.Fecha_Vencimiento.toString());
              const cuotaVencida = cuotaDias < 0 && cuota.Estado === 'PENDIENTE';
              const cuotaUrgente = cuotaDias >= 0 && cuotaDias <= 3 && cuota.Estado === 'PENDIENTE';
              const cuotaPagada = cuota.Estado === 'PAGADO';

              return (
                <div
                  key={cuota.ID_CuotaCxP}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm border ${cuotaPagada
                    ? 'bg-green-500/10 border-green-500/20'
                    : cuotaVencida
                      ? 'bg-red-500/20 border-red-500/30'
                      : cuotaUrgente
                        ? 'bg-yellow-400/15 border-yellow-400/30'
                        : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10'
                    }`}
                >
                  <span className="font-black text-text/50 text-xs whitespace-nowrap">
                    Cuota {cuota.Numero_Cuota}/{total}
                  </span>
                  <span className="font-bold text-text text-sm">
                    {fmtMoney(Number(cuota.Monto))}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${cuotaPagada
                    ? 'bg-green-500/20 text-green-500'
                    : cuotaVencida
                      ? 'bg-red-500/20 text-red-400 animate-pulse'
                      : cuotaUrgente
                        ? 'bg-yellow-400/20 text-yellow-500'
                        : 'bg-amber-500/15 text-amber-500'
                    }`}>
                    {cuotaVencida && <AlertCircle className="w-3 h-3 flex-shrink-0" />}
                    {cuotaUrgente && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                    {cuota.Estado}
                  </span>
                  <span className="text-text/40 text-xs whitespace-nowrap">
                    {fmtDate(cuota.Fecha_Vencimiento.toString())}
                  </span>
                  {cuotaDias >= 0 && !cuotaPagada && (
                    <span className={`text-[10px] font-bold whitespace-nowrap ${cuotaUrgente ? 'text-yellow-500' : 'text-text/30'
                      }`}>
                      {cuotaDias === 0 ? '¡Hoy!' : `${cuotaDias}d`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </td>
    </tr>
  );
};

// ── Count-Up Hook ─────────────────────────────────────────────────────────────

const useCountUp = (target: number, duration = 950) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (target === 0) { setDisplay(0); return; }
    let raf: number;
    let startTime: number | null = null;
    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      setDisplay(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(animate);
      else setDisplay(target);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard = ({
  title, icon, amount, count, unit, variant, subtitle, jl,
}: {
  title: string; icon: ReactNode; amount: number;
  count: number; unit: string; variant: 'red' | 'amber';
  subtitle?: string; jl?: boolean;
}) => {
  const animated = useCountUp(amount);
  const fmtAnimated = `Bs. ${new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(animated)}`;
  const s = {
    red: {
      bar: 'border-l-red-500',
      text: 'text-red-500',
      badge: 'bg-red-100 dark:bg-red-900/10 text-red-600 dark:text-red-400',
      sub: 'text-red-400/80',
    },
    amber: {
      bar: 'border-l-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-100 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400',
      sub: 'text-amber-500/80',
    },
  }[variant];

  const cardBg = jl ? 'bg-gray-200' : 'bg-gray-200 dark:bg-[#1e1e1e]';
  const cardBorder = jl ? 'border-[#d4d4d4]' : 'border-gray-200 dark:border-white/10';

  return (
    <div
      className={`border-l-4 ${s.bar} ${cardBg} border ${cardBorder} p-5 shadow-sm`}
      style={jl ? { opacity: 0, animation: 'fadeInKpi 0.45s ease forwards' } : undefined}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className={s.text}>{icon}</span>
          <span className="text-[11px] font-black uppercase tracking-widest text-text/50">{title}</span>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 whitespace-nowrap ${s.badge}`}>
          {count} {unit}
        </span>
      </div>
      <p className={`text-3xl font-black leading-none tabular-nums ${s.text}`}>{fmtAnimated}</p>
      {subtitle && <p className={`text-xs font-medium mt-2 ${s.sub}`}>{subtitle}</p>}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const CuentasPorPagarPage = () => {
  const navigate = useNavigate();
  const [cuentas, setCuentas] = useState<CuentaPorPagar[]>([]);
  const [alertas, setAlertas] = useState<AlertasCxP>({ vencidas: [], proximas: [] });
  const [loading, setLoading] = useState(true);
  const [modalHistorial, setModalHistorial] = useState<CuentaPorPagar | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [dataCuentas, dataAlertas] = await Promise.all([
        financeApi.getCuentasPorPagar(),
        financeApi.getAlertasCxP(),
      ]);
      setCuentas(dataCuentas);
      setAlertas(dataAlertas);
    } catch {
      toast.error('Error al cargar cuentas por pagar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Tema: jovenes light ───────────────────────────────────────────────────
  const { theme, mode } = useTheme();
  const _hr = new Date().getHours();
  const _dark = mode === 'dark' || (mode === 'auto' && (_hr >= 18 || _hr < 6));
  const jl = theme === 'jovenes' && !_dark;

  // ── KPI — filtrado de cuotas en tiempo real (frontend) ───────────────────
  const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
  const en5 = new Date(hoy0); en5.setDate(en5.getDate() + 5);
  const todasCuotas = cuentas.flatMap(c => c.cuotas ?? []);
  const hasCuotasEmbed = todasCuotas.length > 0;

  const cuotasVenc = todasCuotas.filter(q => {
    const fv = new Date(q.Fecha_Vencimiento); fv.setHours(0, 0, 0, 0);
    return fv < hoy0 && q.Estado === 'PENDIENTE';
  });
  const cuotasPrx = todasCuotas.filter(q => {
    const fv = new Date(q.Fecha_Vencimiento); fv.setHours(0, 0, 0, 0);
    return fv >= hoy0 && fv <= en5 && q.Estado === 'PENDIENTE';
  });

  const totalVencido = hasCuotasEmbed
    ? cuotasVenc.reduce((acc, q) => acc + Number(q.Monto), 0)
    : (alertas.cuotasVencidas?.reduce((acc, c) => acc + Number(c.Monto), 0)
      ?? alertas.vencidas.reduce((acc, c) => acc + Number(c.Saldo_Pendiente), 0));
  const totalProximo = hasCuotasEmbed
    ? cuotasPrx.reduce((acc, q) => acc + Number(q.Monto), 0)
    : (alertas.cuotasProximas?.reduce((acc, c) => acc + Number(c.Monto), 0)
      ?? alertas.proximas.reduce((acc, c) => acc + Number(c.Saldo_Pendiente), 0));

  const countVenc = hasCuotasEmbed
    ? cuotasVenc.length
    : (alertas.cuotasVencidas ?? alertas.vencidas).length;
  const countPrx = hasCuotasEmbed
    ? cuotasPrx.length
    : (alertas.cuotasProximas ?? alertas.proximas).length;

  const minDiasProximo = hasCuotasEmbed
    ? (cuotasPrx.length > 0 ? Math.min(...cuotasPrx.map(q => diasRestantes(q.Fecha_Vencimiento))) : null)
    : (alertas.proximas.length ? Math.min(...alertas.proximas.map(c => diasRestantes(c.Fecha_Vencimiento))) : null);

  const urgency: UrgencyLevel = hasCuotasEmbed
    ? (cuotasPrx.length === 0 ? 'normal'
      : minDiasProximo! <= 1 ? 'danger'
        : minDiasProximo! <= 3 ? 'warning'
          : 'normal')
    : getUrgency(alertas.proximas);

  const TABLE_COLS = 8;

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-text tracking-wide">Cuentas por Pagar</h1>
          <p className="text-sm text-text/50 mt-0.5">Control de obligaciones financieras pendientes</p>
        </div>
        <button
          onClick={cargarDatos}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors font-bold text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <KpiCard
          title="Deudas Vencidas"
          icon={<AlertCircle className="w-4 h-4" />}
          amount={totalVencido}
          count={countVenc}
          unit={`cuota${countVenc !== 1 ? 's' : ''} vencida${countVenc !== 1 ? 's' : ''}`}
          variant="red"
          jl={jl}
        />
        <KpiCard
          title="Próximas a Vencer (≤ 5 días)"
          icon={
            urgency === 'danger' ? <AlertCircle className="w-4 h-4" />
              : urgency === 'warning' ? <AlertTriangle className="w-4 h-4" />
                : <Clock className="w-4 h-4" />
          }
          amount={totalProximo}
          count={countPrx}
          unit={`cuota${countPrx !== 1 ? 's' : ''} por vencer`}
          variant={urgency === 'danger' ? 'red' : 'amber'}
          jl={jl}
          subtitle={
            minDiasProximo !== null
              ? minDiasProximo === 0 ? '¡Vence HOY!'
                : `Más urgente: ${minDiasProximo} día${minDiasProximo !== 1 ? 's' : ''}`
              : undefined
          }
        />
      </div>

      {/* Main Table */}
      <div className={`${jl ? 'bg-gray-200' : 'bg-gray-200 dark:bg-[#1e1e1e]'} border ${jl ? 'border-[#d4d4d4]' : 'border-gray-200 dark:border-white/10'} shadow-sm overflow-hidden`}>
        <div className="px-5 py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="font-black text-base text-text">Listado de Deudas</h2>
            <p className="text-[11px] text-text/40 mt-0.5 font-medium">
              {loading ? 'Cargando...' : `${cuentas.length} registro(s) encontrado(s)`}
            </p>
          </div>
          <Receipt className="w-5 h-5 text-text/20" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-text/40">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Cargando datos...</span>
          </div>
        ) : cuentas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-text/30">
            <Receipt className="w-10 h-10" />
            <p className="text-sm font-medium">No hay cuentas pendientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="bg-black/5 dark:bg-white/5">
                  {['ID CxP', 'Proveedor', 'Fecha Emisión', 'Fecha Vencimiento', 'Deuda Original', 'Saldo Pendiente', 'Estado', 'Acciones'].map(col => (
                    <th key={col} className="px-4 py-3 text-left font-black text-[11px] uppercase tracking-widest text-text/40 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {cuentas.map(c => {
                  const vencida = isVencida(c.Fecha_Vencimiento);
                  const pagada = c.Estado_Pago === 'PAGADO';
                  const dias = diasRestantes(c.Fecha_Vencimiento);
                  const rowUrgency: UrgencyLevel = pagada ? 'normal'
                    : dias < 0 ? 'expired'
                      : dias <= 3 ? 'danger'
                        : dias <= 5 ? 'warning'
                          : 'normal';

                  const hasCuotas = (c.cuotas ?? []).length > 0;
                  const isExpanded = expandedRows.has(c.ID_Cuenta);

                  return (
                    <>
                      <tr
                        key={c.ID_Cuenta}
                        className={`transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${vencida && !pagada ? 'bg-red-500/5' : ''
                          }`}
                      >
                        <td className="px-4 py-3 font-medium text-text/60 whitespace-nowrap">#{c.ID_Cuenta}</td>
                        <td className="px-4 py-3 font-medium text-text">{c.notaCompra?.proveedor?.Nombre_RazonSocial ?? '—'}</td>
                        <td className="px-4 py-3 text-text/60 whitespace-nowrap">
                          {c.notaCompra?.Fecha_Emision ? fmtDate(c.notaCompra.Fecha_Emision) : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className={`flex items-center gap-1.5 font-semibold ${rowUrgency === 'expired' || rowUrgency === 'danger'
                              ? 'text-red-500'
                              : rowUrgency === 'warning'
                                ? 'text-orange-400'
                                : 'text-text/70'
                              }`}>
                              {(rowUrgency === 'expired' || rowUrgency === 'danger') && !pagada && (
                                <AlertCircle className={`w-3.5 h-3.5 flex-shrink-0 ${rowUrgency === 'danger' ? 'animate-pulse' : ''}`} />
                              )}
                              {fmtDate(c.Fecha_Vencimiento)}
                            </span>
                            {!pagada && dias <= 5 && (
                              <span className={`text-[10px] font-bold ${rowUrgency === 'expired' ? 'text-red-400'
                                : rowUrgency === 'danger' ? 'text-red-400 animate-pulse'
                                  : 'text-orange-400'
                                }`}>
                                {dias < 0 ? `Venció hace ${Math.abs(dias)}d` : dias === 0 ? 'Hoy' : `${dias}d restantes`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-text/60 whitespace-nowrap">
                          {fmtMoney(Number(c.notaCompra?.Monto_Total ?? 0))}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-text whitespace-nowrap">
                          {fmtMoney(Number(c.Saldo_Pendiente))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider whitespace-nowrap ${pagada
                            ? 'bg-green-500/15 text-green-500'
                            : rowUrgency === 'expired'
                              ? 'bg-red-500/20 text-red-400 animate-pulse'
                              : rowUrgency === 'danger'
                                ? 'bg-red-500/15 text-red-400 animate-pulse'
                                : rowUrgency === 'warning'
                                  ? 'bg-yellow-400/20 text-yellow-500'
                                  : c.Estado_Pago === 'PARCIAL'
                                    ? 'bg-blue-500/15 text-blue-500'
                                    : 'bg-amber-500/15 text-amber-500'
                            }`}>
                            {(rowUrgency === 'expired' || rowUrgency === 'danger') && !pagada && (
                              <AlertCircle className="w-3 h-3 flex-shrink-0" />
                            )}
                            {rowUrgency === 'warning' && !pagada && (
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            )}
                            {c.Estado_Pago}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-row items-center justify-end gap-x-2 whitespace-nowrap">
                            {!pagada && (
                              <button
                                onClick={() => navigate(`/finanzas/procesar-pago/${c.ID_Cuenta}`)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${c.Estado_Pago === 'PARCIAL'
                                  ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500 hover:text-white'
                                  : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                                  }`}
                              >
                                <CreditCard className="w-3.5 h-3.5" /> Abonar
                              </button>
                            )}
                            <button
                              onClick={() => setModalHistorial(c)}
                              className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-text/40 hover:bg-black/10 dark:hover:bg-white/10 hover:text-text transition-colors"
                              title="Ver historial de pagos"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {hasCuotas && (
                              <button
                                onClick={() => toggleRow(c.ID_Cuenta)}
                                className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${isExpanded
                                  ? 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30'
                                  : 'bg-black/5 dark:bg-white/5 text-text/40 hover:bg-black/10 dark:hover:bg-white/10 hover:text-text'
                                  }`}
                                title="Ver plan de pagos"
                              >
                                {isExpanded
                                  ? <ChevronUp className="w-4 h-4" />
                                  : <ChevronDown className="w-4 h-4" />
                                }
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <PlanPagoRow cuenta={c} colSpan={TABLE_COLS} />
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Historial */}
      {modalHistorial && (
        <ModalHistorial
          cuenta={modalHistorial}
          onClose={() => setModalHistorial(null)}
        />
      )}
    </div>
  );
};
