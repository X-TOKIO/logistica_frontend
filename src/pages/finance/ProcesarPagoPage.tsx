import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CreditCard, Banknote, QrCode, CheckCircle2, CircleDot,
  RefreshCw, Download, Building2, Calendar, Hash, User,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { financeApi } from '../../services/finance';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Proveedor { ID_Proveedor: number; NIT: string; Nombre_RazonSocial: string; }
interface NotaCompra { ID_Compra: number; Fecha_Emision: string; Monto_Total: number; proveedor: Proveedor; }
interface CuentaPorPagar {
  ID_Cuenta: number; Saldo_Pendiente: number; Fecha_Vencimiento: string;
  Estado_Pago: string; notaCompra: NotaCompra;
}
interface RegistroPago {
  ID_Pago: number; Monto_Pagado: number; Fecha_Pago: string;
  Metodo_Pago: 'EFECTIVO' | 'QR'; Referencia_Comprobante: string | null;
  empleado?: { Nombre: string; Paterno?: string };
}
interface CuotaCxP { ID_CuotaCxP: number; Numero_Cuota: number; Monto: number; Estado: string; Fecha_Vencimiento: string; }
interface SuccessData {
  monto: number; metodo: string; saldoRestante: number; fecha: string;
  numeroCuota?: number; totalCuotas?: number;
}
interface CuotaInfo { numero: number; total: number; }

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

const todayISO = () => new Date().toISOString().split('T')[0];

// ── PDF Recibo / Boleta ───────────────────────────────────────────────────────

const generarBoletaPdf = (
  cuenta: CuentaPorPagar,
  monto: number,
  metodo: string,
  saldoRestante: number,
  fecha: string,
  cuotaInfo?: CuotaInfo,
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [105, 148] });
  const DARK: [number, number, number] = [15, 20, 30];
  const MID: [number, number, number]  = [30, 38, 55];
  const ACC: [number, number, number]  = [16, 185, 129];
  const AMB: [number, number, number]  = [245, 158, 11];
  const LITE: [number, number, number] = [200, 210, 220];

  doc.setFillColor(...DARK); doc.rect(0, 0, 105, 148, 'F');
  doc.setFillColor(...MID);  doc.rect(0, 0, 105, 28, 'F');
  doc.setFillColor(cuotaInfo ? AMB[0] : ACC[0], cuotaInfo ? AMB[1] : ACC[1], cuotaInfo ? AMB[2] : ACC[2]);
  doc.rect(0, 0, 3, 28, 'F');

  doc.setTextColor(cuotaInfo ? AMB[0] : ACC[0], cuotaInfo ? AMB[1] : ACC[1], cuotaInfo ? AMB[2] : ACC[2]);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('PARADISO', 8, 12);
  doc.setTextColor(255, 255, 255); doc.setFontSize(9);
  doc.text(cuotaInfo ? 'RECIBO DE ABONO' : 'BOLETA DE PAGO', 97, 12, { align: 'right' });
  doc.setTextColor(...LITE); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${fmtDate(fecha)}  ${new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}`, 97, 20, { align: 'right' });
  doc.text('Distribuidora & Logística PARADISO', 8, 20);

  if (cuotaInfo) {
    doc.setFillColor(60, 50, 20); doc.roundedRect(5, 28, 95, 6, 1, 1, 'F');
    doc.setTextColor(...AMB); doc.setFontSize(6); doc.setFont('helvetica', 'bold');
    doc.text(`CUOTA #${cuotaInfo.numero} DE ${cuotaInfo.total}`, 52.5, 32.5, { align: 'center' });
  }

  const topOffset = cuotaInfo ? 38 : 34;
  doc.setFillColor(...MID); doc.roundedRect(5, topOffset, 95, 22, 2, 2, 'F');
  doc.setTextColor(cuotaInfo ? AMB[0] : ACC[0], cuotaInfo ? AMB[1] : ACC[1], cuotaInfo ? AMB[2] : ACC[2]);
  doc.setFontSize(6); doc.setFont('helvetica', 'bold');
  doc.text('PROVEEDOR', 9, topOffset + 7);
  doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text(cuenta.notaCompra?.proveedor?.Nombre_RazonSocial ?? '—', 9, topOffset + 14, { maxWidth: 87 });
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...LITE); doc.setFontSize(7);
  doc.text(`NIT: ${cuenta.notaCompra?.proveedor?.NIT ?? '—'}  ·  CxP #${cuenta.ID_Cuenta}`, 9, topOffset + 20);

  const rows: [string, string][] = [
    ['Monto Abonado', fmtMoney(monto)],
    ['Método', metodo],
    ['Deuda Original', fmtMoney(Number(cuenta.notaCompra?.Monto_Total ?? 0))],
    ['Saldo Restante', fmtMoney(saldoRestante)],
  ];
  let y = topOffset + 26;
  rows.forEach(([label, value], i) => {
    doc.setFillColor(i % 2 === 0 ? 25 : 32, i % 2 === 0 ? 32 : 40, i % 2 === 0 ? 45 : 55);
    doc.rect(5, y, 95, 10, 'F');
    doc.setTextColor(...LITE); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(label, 9, y + 6.5);
    doc.setFont('helvetica', 'bold');
    const isAmt = label === 'Monto Abonado';
    doc.setTextColor(isAmt ? (cuotaInfo ? AMB[0] : ACC[0]) : 255, isAmt ? (cuotaInfo ? AMB[1] : ACC[1]) : 255, isAmt ? (cuotaInfo ? AMB[2] : ACC[2]) : 255);
    doc.text(value, 97, y + 6.5, { align: 'right' });
    y += 10;
  });
  if (saldoRestante <= 0) {
    doc.setFillColor(...ACC); doc.roundedRect(5, y + 6, 95, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('DEUDA CANCELADA COMPLETAMENTE', 52.5, y + 14, { align: 'center' });
  }
  doc.setFillColor(...MID); doc.rect(0, 136, 105, 12, 'F');
  doc.setFillColor(cuotaInfo ? AMB[0] : ACC[0], cuotaInfo ? AMB[1] : ACC[1], cuotaInfo ? AMB[2] : ACC[2]);
  doc.rect(0, 136, 3, 12, 'F');
  doc.setTextColor(...LITE); doc.setFontSize(6); doc.setFont('helvetica', 'normal');
  doc.text('Documento generado automáticamente por el Sistema PARADISO', 52.5, 143, { align: 'center' });
  const filename = cuotaInfo
    ? `recibo-abono-cuota${cuotaInfo.numero}-cxp${cuenta.ID_Cuenta}-${Date.now()}.pdf`
    : `boleta-pago-cxp${cuenta.ID_Cuenta}-${Date.now()}.pdf`;
  doc.save(filename);
};

// ── API Status Dot ────────────────────────────────────────────────────────────

const ApiStatusDot = () => (
  <div className="flex items-center gap-1.5">
    <div className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </div>
    <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
      En línea
    </span>
  </div>
);

// ── Pantalla de Éxito ─────────────────────────────────────────────────────────

const SuccessScreen = ({
  data, onBack, onDownloadPdf,
}: { data: SuccessData; onBack: () => void; onDownloadPdf: () => void }) => {
  const esCuota = !!data.numeroCuota;
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-6 py-10 px-8">
      <div className={`w-20 h-20 border-2 flex items-center justify-center ${
        esCuota
          ? 'bg-amber-500/15 border-amber-500'
          : 'bg-emerald-500/15 border-emerald-500'
      }`}>
        <CheckCircle2 className={`w-10 h-10 ${esCuota ? 'text-amber-400' : 'text-emerald-500'}`} />
      </div>

      {esCuota && (
        <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-4 py-1.5">
          Cuota #{data.numeroCuota} de {data.totalCuotas} — Liquidada
        </span>
      )}

      <div>
        <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {esCuota ? '¡CUOTA LIQUIDADA!' : '¡PAGO RECIBIDO!'}
        </h2>
        <p className={`font-black text-2xl mt-2 ${esCuota ? 'text-amber-400' : 'text-emerald-400'}`}>
          {fmtMoney(data.monto)}
        </p>
      </div>

      <div className="w-full max-w-sm bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-2xl p-5 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-white/40 font-medium">Método</span>
          <span className="text-slate-900 dark:text-white font-bold">{data.metodo}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-white/40 font-medium">Fecha</span>
          <span className="text-slate-900 dark:text-white font-bold">{fmtDate(data.fecha)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 dark:border-[#2a2a2a] pt-3">
          <span className="text-slate-500 dark:text-white/40 font-medium">Saldo restante</span>
          <span className={`font-black ${data.saldoRestante <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {data.saldoRestante <= 0 ? '✓ DEUDA SALDADA' : fmtMoney(data.saldoRestante)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={onDownloadPdf}
          className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl text-white font-black text-sm transition-colors ${
            esCuota
              ? 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-900/20'
              : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20'
          }`}
        >
          <Download className="w-4 h-4" />
          {esCuota ? 'Descargar Recibo de Abono' : 'Descargar Boleta PDF'}
        </button>
        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-slate-200 dark:border-[#2a2a2a] text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 font-bold text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Cuentas por Pagar
        </button>
      </div>
    </div>
  );
};

// ── Historial de Abonos ───────────────────────────────────────────────────────

const Timeline = ({ historial }: { historial: RegistroPago[] }) => {
  if (historial.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-slate-300 dark:text-white/20">
        <CircleDot className="w-8 h-8" />
        <p className="text-sm font-medium">Sin abonos previos</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {historial.map((p) => (
        <div
          key={p.ID_Pago}
          className="bg-slate-50 dark:bg-[#1a1a1a] border-l-4 border-emerald-500 rounded-r-xl p-4 mb-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-2xl font-bold text-emerald-400 tabular-nums leading-none block mb-1.5">
                {fmtMoney(Number(p.Monto_Pagado))}
              </span>
              <p className="text-xs text-slate-400 dark:text-white/30 font-medium">
                {fmtDate(p.Fecha_Pago)}
              </p>
              {p.empleado && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <User className="w-3 h-3 text-slate-300 dark:text-white/20 flex-shrink-0" />
                  <p className="text-xs text-slate-400 dark:text-white/30">
                    {p.empleado.Nombre}{p.empleado.Paterno ? ` ${p.empleado.Paterno}` : ''}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className={`text-[9px] px-2 py-0.5 font-black uppercase tracking-wider ${
                p.Metodo_Pago === 'EFECTIVO'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}>
                {p.Metodo_Pago}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Página Principal ──────────────────────────────────────────────────────────

export const ProcesarPagoPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const idNum = Number(id);

  const [cuenta, setCuenta] = useState<CuentaPorPagar | null>(null);
  const [historial, setHistorial] = useState<RegistroPago[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<'EFECTIVO' | 'QR'>('EFECTIVO');
  const [referencia, setReferencia] = useState('');
  const [fecha, setFecha] = useState(todayISO());
  const [submitting, setSubmitting] = useState(false);

  // QR / polling / external ref
  const [pollingActive, setPollingActive] = useState(false);
  const [externalRef, setExternalRef] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const saldoSnapshotRef = useRef<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cuentaRef = useRef<CuentaPorPagar | null>(null);
  const cuotaInfoRef = useRef<CuotaInfo | null>(null);

  // Resultado
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [cuotas, setCuotas] = useState<CuotaCxP[]>([]);

  const cuotaActiva = cuotas.filter(c => c.Estado === 'PENDIENTE').sort((a, b) => a.Numero_Cuota - b.Numero_Cuota)[0] ?? null;
  const modoStrictCuota = cuotaActiva !== null;
  const totalCuotas = cuotas.length;

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    setPollingActive(false);
  }, []);

  useEffect(() => {
    Promise.all([
      financeApi.getCuentaPorPagarById(idNum),
      financeApi.getHistorialPagosCuenta(idNum),
      financeApi.getCuotasCuenta(idNum),
    ])
      .then(([cuentaData, histData, cuotasData]) => {
        setCuenta(cuentaData);
        cuentaRef.current = cuentaData;
        setHistorial(histData);
        setCuotas(cuotasData ?? []);
      })
      .catch(() => { toast.error('Error al cargar la cuenta'); navigate('/finanzas/cuentas-por-pagar'); })
      .finally(() => setLoading(false));
  }, [idNum, navigate]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    const primera = cuotas.filter(c => c.Estado === 'PENDIENTE').sort((a, b) => a.Numero_Cuota - b.Numero_Cuota)[0];
    if (primera) setMonto(parseFloat(String(primera.Monto)).toFixed(2));
  }, [cuotas]);

  // Mantiene la referencia de cuota activa actualizada para el polling
  useEffect(() => {
    if (cuotaActiva) {
      cuotaInfoRef.current = { numero: cuotaActiva.Numero_Cuota, total: totalCuotas };
    } else {
      cuotaInfoRef.current = null;
    }
  }, [cuotaActiva, totalCuotas]);

  // ── Polling Dual ──────────────────────────────────────────────────────────

  const startPolling = useCallback((initialSaldo: number) => {
    saldoSnapshotRef.current = initialSaldo;
    setPollingActive(true);
    pollingRef.current = setInterval(async () => {
      try {
        const result = await financeApi.pollCxP(idNum);
        const nuevoSaldo = parseFloat(String(result.Saldo_Pendiente));
        if (nuevoSaldo < saldoSnapshotRef.current || result.Estado_Pago === 'PAGADO') {
          stopPolling();
          const montoAbonado = Math.round((saldoSnapshotRef.current - nuevoSaldo) * 100) / 100;
          const hoy = todayISO();
          const ci = cuotaInfoRef.current;
          const sd: SuccessData = {
            monto: montoAbonado,
            metodo: 'QR',
            saldoRestante: nuevoSaldo,
            fecha: hoy,
            ...(ci ? { numeroCuota: ci.numero, totalCuotas: ci.total } : {}),
          };
          setSuccessData(sd);

          financeApi.getCuentaPorPagarById(idNum).then(c => {
            setCuenta(c);
            cuentaRef.current = c;
            if (cuentaRef.current) {
              generarBoletaPdf(cuentaRef.current, sd.monto, sd.metodo, sd.saldoRestante, sd.fecha, ci ?? undefined);
            }
          }).catch(() => null);
        }
      } catch { /* silencioso */ }
    }, 2000);
  }, [idNum, stopPolling]);

  // ── Cambio de método ──────────────────────────────────────────────────────

  const handleMetodoChange = async (m: 'EFECTIVO' | 'QR') => {
    if (m === metodo) return;
    stopPolling();
    setQrVisible(false);
    setExternalRef(null);
    setQrUrl(null);
    setMetodo(m);

    if (m === 'QR' && cuenta) {
      const montoNum = parseFloat(monto) || parseFloat(String(cuenta.Saldo_Pendiente));
      const numCuota = cuotaActiva?.Numero_Cuota;
      const idCompra = cuenta.notaCompra?.ID_Compra;

      if (numCuota && idCompra) {
        console.log(`Generando QR dinámico para Cuota #${numCuota} de la Compra #${idCompra}`);
      } else {
        console.log(`Generando QR dinámico para CxP #${idNum}`);
      }

      setQrLoading(true);
      try {
        const glosa = numCuota
          ? `Abono Cuota #${numCuota} - CxP #${idNum}`
          : `Pago CxP #${idNum}`;

        const [refResult, qrResult] = await Promise.allSettled([
          financeApi.generateQRPaymentRef(idNum),
          financeApi.generarQR({ monto: montoNum, glosa }),
        ]);

        if (refResult.status === 'fulfilled') setExternalRef(refResult.value.externalRef);
        if (qrResult.status === 'fulfilled' && qrResult.value?.qrUrl) {
          setQrUrl(qrResult.value.qrUrl);
        }
      } catch { /* continúa sin QR */ }
      finally {
        setQrLoading(false);
      }

      startPolling(parseFloat(String(cuenta.Saldo_Pendiente)));
      setTimeout(() => setQrVisible(true), 80);
    }
  };

  // ── Confirmación QR (doble-click en la imagen QR) ────────────────────────

  const handleConfirmQRPayment = async () => {
    const montoNum = parseFloat(monto);
    if (!montoNum || montoNum <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (!externalRef) { toast.error('Referencia no disponible — vuelve a seleccionar QR'); return; }
    const transactionToken = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    try {
      await financeApi.webhookQRConfirm({ externalRef, transactionToken, montoPagado: montoNum });
    } catch { /* el polling detectará el cambio */ }
  };

  // ── Pago en Efectivo ──────────────────────────────────────────────────────

  const handleEfectivoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuenta) return;
    const montoNum = parseFloat(monto);
    const saldoPendiente = parseFloat(String(cuenta.Saldo_Pendiente));
    if (!montoNum || montoNum <= 0) { toast.error('Ingresa un monto válido'); return; }
    if (montoNum > saldoPendiente + 0.001) { toast.error(`Monto supera el saldo (${fmtMoney(saldoPendiente)})`); return; }
    if (modoStrictCuota && cuotaActiva && Math.abs(montoNum - parseFloat(String(cuotaActiva.Monto))) > 0.005) {
      toast.error(`El monto debe ser exactamente ${fmtMoney(parseFloat(String(cuotaActiva.Monto)))}`);
      return;
    }

    setSubmitting(true);
    try {
      await financeApi.registrarPago({
        ID_Cuenta: idNum, Monto_Pagado: montoNum, Fecha_Pago: fecha,
        Metodo_Pago: 'EFECTIVO', Referencia_Comprobante: referencia || undefined,
        ...(cuotaActiva ? { ID_CuotaCxP: cuotaActiva.ID_CuotaCxP } : {}),
      });
      const saldoRestante = Math.max(0, Math.round((saldoPendiente - montoNum) * 100) / 100);
      const ci: CuotaInfo | undefined = cuotaActiva ? { numero: cuotaActiva.Numero_Cuota, total: totalCuotas } : undefined;
      const sd: SuccessData = {
        monto: montoNum, metodo: 'EFECTIVO', saldoRestante, fecha,
        ...(ci ? { numeroCuota: ci.numero, totalCuotas: ci.total } : {}),
      };
      setSuccessData(sd);
      financeApi.getCuentaPorPagarById(idNum).then(c => {
        setCuenta(c);
        cuentaRef.current = c;
        generarBoletaPdf(c, sd.monto, sd.metodo, sd.saldoRestante, sd.fecha, ci);
      }).catch(() => null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Error al registrar el pago');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!cuenta || !successData) return;
    const ci: CuotaInfo | undefined = successData.numeroCuota
      ? { numero: successData.numeroCuota, total: successData.totalCuotas! }
      : undefined;
    generarBoletaPdf(cuenta, successData.monto, successData.metodo, successData.saldoRestante, successData.fecha, ci);
  };

  const handleBack = () => { stopPolling(); navigate('/finanzas/cuentas-por-pagar'); };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="-m-8 min-h-[calc(100vh-6rem)] bg-slate-100 dark:bg-[#0f0f0f] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400 dark:text-white/30">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-lg font-medium">Cargando terminal de pago...</span>
        </div>
      </div>
    );
  }

  if (!cuenta) return null;

  const saldoPendiente = parseFloat(String(cuenta.Saldo_Pendiente));
  const deudaTotal = parseFloat(String(cuenta.notaCompra?.Monto_Total ?? 0));
  const totalAbonado = historial.reduce((acc, p) => acc + parseFloat(String(p.Monto_Pagado)), 0);
  const pct = deudaTotal > 0 ? Math.min((totalAbonado / deudaTotal) * 100, 100) : 0;
  const montoNum = parseFloat(monto) || 0;
  const saldoDespues = Math.max(0, saldoPendiente - montoNum);
  const saldoMostrado = successData ? successData.saldoRestante : saldoPendiente;
  const ledValue = modoStrictCuota && cuotaActiva
    ? parseFloat(String(cuotaActiva.Monto)).toFixed(2)
    : montoNum > 0 ? montoNum.toFixed(2) : saldoPendiente.toFixed(2);
  const canSubmit = modoStrictCuota && cuotaActiva
    ? Math.abs(montoNum - parseFloat(String(cuotaActiva.Monto))) < 0.005
    : montoNum > 0;

  const estadoPago = successData
    ? (successData.saldoRestante <= 0 ? 'PAGADO' : 'PARCIAL')
    : cuenta.Estado_Pago;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="-m-8 min-h-[calc(100vh-6rem)] bg-slate-100 dark:bg-[#0f0f0f] text-slate-900 dark:text-white flex flex-col">

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-200 dark:border-[#2a2a2a] bg-white dark:bg-[#171717] flex-shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-bold hidden sm:inline">Cuentas por Pagar</span>
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-[#2a2a2a]" />

        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-500" />
          <span className="font-black text-base">Terminal de Pago</span>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <ApiStatusDot />
          <span className="text-xs text-slate-400 dark:text-white/30 font-medium hidden sm:block">
            CxP #{cuenta.ID_Cuenta}
          </span>
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
            estadoPago === 'PAGADO'
              ? 'bg-emerald-500/15 text-emerald-400'
              : estadoPago === 'PARCIAL'
              ? 'bg-amber-500/15 text-amber-400'
              : 'bg-amber-500/15 text-amber-500'
          }`}>
            {estadoPago}
          </span>
        </div>
      </div>

      {/* ── Contenido Principal ────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Columna Izquierda — Resumen + Historial ──────────────────────── */}
        <div className="w-[40%] border-r border-slate-200 dark:border-[#2a2a2a] flex flex-col overflow-y-auto">

          {/* Tarjeta de deuda */}
          <div className="m-5 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] p-5">

            {/* Proveedor */}
            <div className="flex items-start gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-slate-400 dark:text-white/40" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-0.5">
                  Proveedor
                </p>
                <p className="text-slate-900 dark:text-white font-black text-sm leading-snug truncate">
                  {cuenta.notaCompra?.proveedor?.Nombre_RazonSocial ?? '—'}
                </p>
                <p className="text-[10px] text-emerald-400 font-medium mt-0.5">
                  NIT: {cuenta.notaCompra?.proveedor?.NIT ?? '—'}
                </p>
              </div>
            </div>

            {/* Montos */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#2a2a2a] rounded-xl p-3">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-1">
                  Deuda Original
                </p>
                <p className="text-sm font-black text-slate-500 dark:text-white/60">
                  {fmtMoney(deudaTotal)}
                </p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400 mb-1">
                  Total Abonado
                </p>
                <p className="text-sm font-black text-emerald-400">
                  {fmtMoney(totalAbonado)}
                </p>
              </div>
            </div>

            {/* Saldo pendiente */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center mb-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">
                Saldo Pendiente
              </p>
              <p className="text-3xl font-black text-amber-400 tabular-nums">
                {fmtMoney(saldoMostrado)}
              </p>
            </div>

            {/* Barra de progreso */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30">
                  Progreso
                </span>
                <span className="text-[8px] font-black text-slate-300 dark:text-white/20">
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-[#111111] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Fechas */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-white/25">
                <Calendar className="w-3 h-3" />
                <span>Emisión: {fmtDate(cuenta.notaCompra?.Fecha_Emision)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-white/25">
                <Hash className="w-3 h-3" />
                <span>Compra #{cuenta.notaCompra?.ID_Compra}</span>
              </div>
            </div>
          </div>

          {/* Historial */}
          <div className="px-5 pb-5 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-4">
              Historial de Abonos
            </p>
            <Timeline historial={historial} />
          </div>
        </div>

        {/* ── Columna Derecha — Terminal POS ──────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {successData ? (
            <SuccessScreen data={successData} onBack={handleBack} onDownloadPdf={handleDownloadPdf} />
          ) : (
            <div className="p-6 space-y-5 max-w-xl">

              {/* ── Display LED Neón + Input de Monto ───────────────────────── */}
              <div>
                {modoStrictCuota && cuotaActiva && (
                  <div className="flex items-center justify-center mb-3">
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-4 py-1.5">
                      Liquidando Cuota #{cuotaActiva.Numero_Cuota} de {totalCuotas}
                    </span>
                  </div>
                )}
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-2">
                  Monto a Pagar
                </label>
                <div className="w-full bg-slate-900 dark:bg-black rounded-3xl p-8 flex items-center justify-center border border-slate-700 dark:border-[#2a2a2a]">
                  <span className={`text-6xl font-mono font-bold tracking-wider ${
                    modoStrictCuota ? 'text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]' : 'text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]'
                  }`}>
                    Bs. {ledValue}
                  </span>
                </div>
                <input
                  type="number"
                  min="0.01"
                  max={saldoPendiente}
                  step="0.01"
                  value={monto}
                  readOnly={modoStrictCuota}
                  onChange={modoStrictCuota ? undefined : e => setMonto(e.target.value)}
                  placeholder={saldoPendiente.toFixed(2)}
                  className={`w-full mt-3 rounded-xl p-4 outline-none transition-all ${
                    modoStrictCuota
                      ? 'bg-slate-50 dark:bg-[#111111] border border-slate-200 dark:border-[#2a2a2a] text-slate-400 dark:text-white/30 cursor-not-allowed select-none'
                      : 'bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#2a2a2a] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-300 dark:placeholder:text-white/20'
                  }`}
                />
                {modoStrictCuota && (
                  <p className="mt-1.5 text-[10px] font-semibold text-slate-400 dark:text-white/30 flex items-center gap-1">
                    🔒 Monto fijo de cuota — no modificable
                  </p>
                )}
                {montoNum > 0 && (
                  <p className="mt-2 text-xs font-medium text-slate-400 dark:text-white/30">
                    Saldo después:{' '}
                    <span className={
                      saldoDespues === 0
                        ? 'text-emerald-400 font-black'
                        : 'text-amber-400 font-semibold'
                    }>
                      {saldoDespues === 0 ? '🎉 Deuda completamente saldada' : fmtMoney(saldoDespues)}
                    </span>
                  </p>
                )}
              </div>

              {/* ── Selector de Método ───────────────────────────────────── */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-3">
                  Método de Pago
                </label>
                <div className="grid grid-cols-2 gap-3">

                  <button
                    type="button"
                    onClick={() => handleMetodoChange('EFECTIVO')}
                    className={`group relative flex flex-col items-center justify-center gap-2.5 py-6 rounded-2xl border-2 font-black text-sm uppercase tracking-wider transition-all duration-300 ${
                      metodo === 'EFECTIVO'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500'
                        : 'bg-slate-50 dark:bg-[#1a1a1a] text-slate-400 dark:text-white/30 border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-600 dark:hover:text-white/60'
                    }`}
                  >
                    {metodo === 'EFECTIVO' && (
                      <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                    <Banknote className={`w-8 h-8 transition-transform duration-300 ${
                      metodo === 'EFECTIVO' ? 'scale-110' : 'group-hover:scale-105'
                    }`} />
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMetodoChange('QR')}
                    className={`group relative flex flex-col items-center justify-center gap-2.5 py-6 rounded-2xl border-2 font-black text-sm uppercase tracking-wider transition-all duration-300 ${
                      metodo === 'QR'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500'
                        : 'bg-slate-50 dark:bg-[#1a1a1a] text-slate-400 dark:text-white/30 border-slate-200 dark:border-[#2a2a2a] hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-600 dark:hover:text-white/60'
                    }`}
                  >
                    {metodo === 'QR' && (
                      <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    )}
                    <QrCode className={`w-8 h-8 transition-transform duration-300 ${
                      metodo === 'QR' ? 'scale-110' : 'group-hover:scale-105'
                    }`} />
                    <span>Código QR</span>
                  </button>
                </div>
              </div>

              {/* ── Panel EFECTIVO ───────────────────────────────────────── */}
              {metodo === 'EFECTIVO' && (
                <form onSubmit={handleEfectivoSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-2">
                        Fecha de Pago
                      </label>
                      <input
                        type="date"
                        value={fecha}
                        onChange={e => setFecha(e.target.value)}
                        required
                        className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#2a2a2a] text-slate-900 dark:text-white rounded-xl p-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30 mb-2">
                        Referencia{' '}
                        <span className="normal-case tracking-normal font-normal text-slate-300 dark:text-white/20">
                          (opc.)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={referencia}
                        onChange={e => setReferencia(e.target.value)}
                        placeholder="Nro. comprobante"
                        className="w-full bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#2a2a2a] text-slate-900 dark:text-white rounded-xl p-4 outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-300 dark:placeholder:text-white/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !canSubmit}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-base transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-900/20 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {submitting
                      ? <RefreshCw className="w-5 h-5 animate-spin" />
                      : <Banknote className="w-5 h-5" />
                    }
                    {modoStrictCuota ? 'Confirmar Abono de Cuota' : 'Confirmar Pago en Efectivo'}
                  </button>
                </form>
              )}

              {/* ── Panel QR ─────────────────────────────────────────────── */}
              {metodo === 'QR' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#2a2a2a] rounded-2xl overflow-hidden">
                    <div className="flex flex-col items-center justify-center p-6 gap-5">

                      {/* QR dinámico de Libélula */}
                      {qrLoading ? (
                        <div className="w-[280px] h-[280px] flex items-center justify-center bg-slate-100 dark:bg-[#111111] rounded-xl border border-slate-200 dark:border-[#2a2a2a]">
                          <div className="flex flex-col items-center gap-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
                            <p className="text-xs text-slate-500 dark:text-white/30 font-semibold">
                              Generando QR Libélula...
                            </p>
                          </div>
                        </div>
                      ) : qrUrl ? (
                        <div
                          className="relative"
                          style={{
                            opacity: qrVisible ? 1 : 0,
                            transform: qrVisible ? 'scale(1)' : 'scale(0.93)',
                            transition: 'opacity 0.5s ease, transform 0.5s ease',
                          }}
                        >
                          <img
                            src={qrUrl}
                            alt="QR Libélula"
                            className="mx-auto w-full max-w-[280px] rounded-xl shadow-lg object-contain transition-transform hover:scale-105 duration-300"
                            onDoubleClick={handleConfirmQRPayment}
                            draggable={false}
                          />
                          {pollingActive && (
                            <div className="absolute inset-0 rounded-xl border-4 border-emerald-500/50 animate-pulse pointer-events-none" />
                          )}
                        </div>
                      ) : (
                        <div className="w-[280px] h-[280px] flex items-center justify-center bg-slate-100 dark:bg-[#111111] rounded-xl border border-slate-200 dark:border-[#2a2a2a]">
                          <div className="flex flex-col items-center gap-3">
                            <QrCode className="w-12 h-12 text-slate-300 dark:text-white/10" />
                            <p className="text-xs text-slate-400 dark:text-white/20 font-semibold text-center">
                              QR no disponible
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Indicador de conexión */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex h-2 w-2 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </div>
                        <p className="text-emerald-400 text-sm font-semibold">
                          {modoStrictCuota
                            ? `Procesando pago de Cuota #${cuotaActiva?.Numero_Cuota}...`
                            : 'Procesando comunicación con el banco...'
                          }
                        </p>
                      </div>

                      {/* Monto a transferir */}
                      {montoNum > 0 && (
                        <div className="text-center bg-slate-100 dark:bg-[#111111] rounded-xl px-5 py-4 border border-slate-200 dark:border-[#2a2a2a] w-full">
                          <p className="text-[10px] text-slate-400 dark:text-white/30 font-bold uppercase tracking-widest mb-1.5">
                            Transferir exactamente
                          </p>
                          <p className={`text-2xl font-black tabular-nums ${modoStrictCuota ? 'text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                            {fmtMoney(montoNum)}
                          </p>
                          {modoStrictCuota && cuotaActiva && (
                            <p className="text-[10px] text-amber-500/70 font-semibold mt-1">
                              Cuota #{cuotaActiva.Numero_Cuota} de {totalCuotas}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
