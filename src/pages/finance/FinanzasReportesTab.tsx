import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, CartesianGrid,
} from 'recharts';
import {
  ShoppingCart, CreditCard, Users, Calendar,
  TrendingUp, AlertTriangle, Clock, Filter, Printer, Send,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { financeApi } from '../../services/finance';
import { EmailReportModal } from '../../components/shared/EmailReportModal';

// ─── Palette ─────────────────────────────────────────────────────────────────
const TEAL   = '#14B8A6';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';
const GREEN  = '#10B981';
const BLUE   = '#3B82F6';
const PURPLE = '#8B5CF6';
const ORANGE = '#F97316';
const PINK   = '#EC4899';

const CHART_COLORS = [TEAL, AMBER, BLUE, GREEN, PURPLE, ORANGE, RED, PINK, '#06B6D4', '#84CC16'];

const CARD = [
  'bg-white dark:bg-gray-800/50',
  'border border-gray-200 dark:border-white/[0.07]',
  'rounded-2xl',
].join(' ');

const SELECT = [
  'text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  'border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 outline-none cursor-pointer',
].join(' ');

const BTN_PDF = [
  'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
  'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600',
  'text-gray-700 dark:text-gray-200 disabled:opacity-60',
].join(' ');

const BTN_MAIL = [
  'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
  'bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30',
  'text-teal-600 dark:text-teal-400 disabled:opacity-60',
].join(' ');

// ─── Helpers ─────────────────────────────────────────────────────────────────
function useIsDark() {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark')),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

const tipStyle = {
  contentStyle: {
    background: '#1F2937', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  labelStyle: { color: '#F9FAFB', fontWeight: 600 },
  itemStyle:  { color: '#9CA3AF' },
};

const fmtBs = (v: number) =>
  `Bs. ${v.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fmtN = (v: number | string | ReadonlyArray<number | string> | undefined) =>
  Number(Array.isArray(v) ? v[0] : (v ?? 0));

type Period = 'todo' | 'dia' | 'mes' | 'anio';
type SubTab = 'compras' | 'cxp' | 'proveedores';

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: 'compras',     label: 'Gestionar Compras',   icon: ShoppingCart },
  { id: 'cxp',        label: 'Cuentas por Pagar',   icon: CreditCard   },
  { id: 'proveedores', label: 'Proveedores',          icon: Users        },
];

// ─── PDF helpers ──────────────────────────────────────────────────────────────
function addPdfHeader(doc: jsPDF, subtitle: string) {
  const W = doc.internal.pageSize.width;
  const d = new Date().toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFillColor(17, 24, 39);  doc.rect(0, 0, W, 34, 'F');
  doc.setFillColor(245, 158, 11); doc.rect(0, 0, 4, 34, 'F');
  doc.setTextColor(245, 158, 11); doc.setFontSize(15); doc.setFont('helvetica', 'bold');
  doc.text('PARADISO', 11, 13);
  doc.setTextColor(200, 200, 200); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 11, 21);
  doc.setTextColor(120, 120, 120); doc.setFontSize(7);
  doc.text(`Generado: ${d}`, 11, 28);
  doc.setTextColor(245, 158, 11);
  doc.text('CONFIDENCIAL', W - 11, 28, { align: 'right' });
}

function addPdfFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const W = doc.internal.pageSize.width;
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const pH = doc.internal.pageSize.height;
    doc.setFillColor(17, 24, 39); doc.rect(0, pH - 16, W, 16, 'F');
    doc.setFillColor(245, 158, 11); doc.rect(0, pH - 16, W, 0.5, 'F');
    doc.setTextColor(120, 120, 120); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
    doc.text('Sistema PARADISO — Uso exclusivo interno', 11, pH - 6);
    doc.text(`Página ${p} de ${pages}`, W - 11, pH - 6, { align: 'right' });
  }
}

// ─── Filtro de período ────────────────────────────────────────────────────────
function filterPeriod(rows: any[], dateKey: string, period: Period, value: string): any[] {
  if (period === 'todo' || !value) return rows;
  return rows.filter(r => {
    const d = (r[dateKey] || '').slice(0, 10);
    if (period === 'dia')  return d === value;
    if (period === 'mes')  return d.slice(0, 7) === value;
    if (period === 'anio') return d.slice(0, 4) === value;
    return true;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
export const FinanzasReportesTab = () => {
  const isDark = useIsDark();
  const tick   = isDark ? '#9CA3AF' : '#4B5563';
  const grid   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const [subTab,    setSubTab]   = useState<SubTab>('compras');
  const [stats,     setStats]    = useState<any>(null);
  const [compras,   setCompras]  = useState<any[]>([]);
  const [cuentas,   setCuentas]  = useState<any[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [genPdf,    setGenPdf]   = useState<string | null>(null);
  const [sending,   setSending]  = useState('');
  const [modalType, setModalType] = useState<string | null>(null);

  // Filtros Compras
  const [cpPeriod,  setCpPeriod]  = useState<Period>('todo');
  const [cpValue,   setCpValue]   = useState('');
  const [cpProv,    setCpProv]    = useState('all');

  // Filtros CxP
  const [cxpPeriod, setCxpPeriod] = useState<Period>('todo');
  const [cxpValue,  setCxpValue]  = useState('');

  // Filtros Proveedores
  const [provPeriod, setProvPeriod] = useState<Period>('todo');
  const [provValue,  setProvValue]  = useState('');

  useEffect(() => {
    Promise.allSettled([
      financeApi.getEstadisticasFinanzas(),
      financeApi.getCompras(),
      financeApi.getCuentasPorPagar(),
    ]).then(([sR, cR, cxpR]) => {
      if (sR.status === 'fulfilled') setStats(sR.value);
      if (cR.status === 'fulfilled') setCompras(cR.value || []);
      if (cxpR.status === 'fulfilled') setCuentas(cxpR.value || []);
    }).finally(() => setLoading(false));
  }, []);

  // ── Computed: Compras ──────────────────────────────────────────────────────
  const comprasFiltradas = useMemo(() => {
    let fc = filterPeriod(compras, 'Fecha_Emision', cpPeriod, cpValue);
    if (cpProv !== 'all') fc = fc.filter((c: any) =>
      String(c.ID_Proveedor) === cpProv || c.proveedor?.Nombre_RazonSocial === cpProv,
    );
    return fc;
  }, [compras, cpPeriod, cpValue, cpProv]);

  // group key: por día cuando el período es 'dia' o 'mes'; por mes en los demás casos
  const comprasPorMes = useMemo(() => {
    const keyFn = (cpPeriod === 'dia' || cpPeriod === 'mes')
      ? (d: string) => d.slice(0, 10)
      : (d: string) => d.slice(0, 7);
    const byG: Record<string, { cantidad: number; total: number }> = {};
    comprasFiltradas.forEach((c: any) => {
      const d = (c.Fecha_Emision || '').slice(0, 10);
      if (!d) return;
      const k = keyFn(d);
      byG[k] ??= { cantidad: 0, total: 0 };
      byG[k].cantidad += 1;
      byG[k].total    += Number(c.Monto_Total || 0);
    });
    return Object.entries(byG).sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes, ...v }));
  }, [comprasFiltradas, cpPeriod]);

  const topProductosFiltrados = useMemo(() => {
    const byP: Record<string, { nombre: string; cantidad: number; total: number }> = {};
    comprasFiltradas.forEach((c: any) => {
      (c.detalles || []).forEach((d: any) => {
        const nombre = d.producto?.Nombre || `Producto #${d.ID_Producto}`;
        byP[nombre] ??= { nombre, cantidad: 0, total: 0 };
        byP[nombre].cantidad += Number(d.Cantidad || 0);
        byP[nombre].total    += Number(d.Subtotal || 0);
      });
    });
    return Object.values(byP).sort((a, b) => b.cantidad - a.cantidad).slice(0, 8);
  }, [comprasFiltradas]);

  const topProveedoresFiltrados = useMemo(() => {
    const byP: Record<string, { nombre: string; cantidad: number; total: number }> = {};
    comprasFiltradas.forEach((c: any) => {
      const nombre = c.proveedor?.Nombre_RazonSocial || `Proveedor #${c.ID_Proveedor}`;
      byP[nombre] ??= { nombre, cantidad: 0, total: 0 };
      byP[nombre].cantidad += 1;
      byP[nombre].total    += Number(c.Monto_Total || 0);
    });
    return Object.values(byP).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [comprasFiltradas]);

  const condicionPago = useMemo(() => {
    const byC: Record<string, { condicion: string; cantidad: number; total: number }> = {};
    comprasFiltradas.forEach((c: any) => {
      const cond = c.Condicion_Pago || 'DESCONOCIDO';
      byC[cond] ??= { condicion: cond, cantidad: 0, total: 0 };
      byC[cond].cantidad += 1;
      byC[cond].total    += Number(c.Monto_Total || 0);
    });
    return Object.values(byC);
  }, [comprasFiltradas]);

  const metodosPago = useMemo(() => stats?.metodosPago || [], [stats]);

  const totalCompras = useMemo(() => comprasFiltradas.length, [comprasFiltradas]);
  const totalMonto   = useMemo(() => comprasFiltradas.reduce((s: number, c: any) => s + Number(c.Monto_Total || 0), 0), [comprasFiltradas]);

  // ── Computed: CxP ─────────────────────────────────────────────────────────
  const cuentasFiltradas = useMemo(() =>
    filterPeriod(cuentas, 'Fecha_Vencimiento', cxpPeriod, cxpValue),
    [cuentas, cxpPeriod, cxpValue],
  );

  const deudaPorProv = useMemo(() => {
    const byP: Record<string, { nombre: string; cuentas: number; deuda: number }> = {};
    cuentasFiltradas.filter((c: any) => c.Estado_Pago !== 'PAGADO').forEach((c: any) => {
      const nombre = c.notaCompra?.proveedor?.Nombre_RazonSocial || '—';
      byP[nombre] ??= { nombre, cuentas: 0, deuda: 0 };
      byP[nombre].cuentas += 1;
      byP[nombre].deuda   += Number(c.Saldo_Pendiente || 0);
    });
    return Object.values(byP).sort((a, b) => b.deuda - a.deuda).slice(0, 8);
  }, [cuentasFiltradas]);

  const estadoCxP = useMemo(() => {
    const byE: Record<string, { estado: string; cantidad: number; total: number }> = {};
    cuentasFiltradas.forEach((c: any) => {
      const estado = c.Estado_Pago || 'DESCONOCIDO';
      byE[estado] ??= { estado, cantidad: 0, total: 0 };
      byE[estado].cantidad += 1;
      byE[estado].total    += Number(c.Saldo_Pendiente || 0);
    });
    return Object.values(byE);
  }, [cuentasFiltradas]);

  const { cuotasVencidas, cuotasProximas } = useMemo(() => {
    const hoy     = new Date().toISOString().slice(0, 10);
    const en30d   = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const allQ    = cuentasFiltradas.flatMap((c: any) => c.cuotas || []);
    const venc    = allQ.filter((q: any) => q.Estado === 'PENDIENTE' && (q.Fecha_Vencimiento || '').slice(0, 10) < hoy);
    const prox    = allQ.filter((q: any) => q.Estado === 'PENDIENTE' && (q.Fecha_Vencimiento || '').slice(0, 10) >= hoy && (q.Fecha_Vencimiento || '').slice(0, 10) <= en30d);
    return {
      cuotasVencidas: { cantidad: venc.length, total: venc.reduce((s: number, q: any) => s + Number(q.Monto || 0), 0) },
      cuotasProximas: { cantidad: prox.length, total: prox.reduce((s: number, q: any) => s + Number(q.Monto || 0), 0) },
    };
  }, [cuentasFiltradas]);

  const totalDeuda = useMemo(() =>
    cuentasFiltradas.filter((c: any) => c.Estado_Pago !== 'PAGADO')
      .reduce((s: number, c: any) => s + Number(c.Saldo_Pendiente || 0), 0),
    [cuentasFiltradas]);

  // ── Computed: Proveedores ─────────────────────────────────────────────────
  const topProveedoresFull = useMemo(() => {
    const fc = filterPeriod(compras, 'Fecha_Emision', provPeriod, provValue);
    const byP: Record<string, { nombre: string; cantidad: number; total: number }> = {};
    fc.forEach((c: any) => {
      const nombre = c.proveedor?.Nombre_RazonSocial || `Proveedor #${c.ID_Proveedor}`;
      byP[nombre] ??= { nombre, cantidad: 0, total: 0 };
      byP[nombre].cantidad += 1;
      byP[nombre].total    += Number(c.Monto_Total || 0);
    });
    return Object.values(byP).sort((a, b) => b.total - a.total);
  }, [compras, provPeriod, provValue]);

  // ── Proveedores únicos para selector ──────────────────────────────────────
  const proveedoresUnicos = useMemo(() => {
    const seen = new Set<string>();
    return compras.reduce((acc: any[], c: any) => {
      const id   = String(c.ID_Proveedor);
      const name = c.proveedor?.Nombre_RazonSocial || id;
      if (!seen.has(id)) { seen.add(id); acc.push({ id, name }); }
      return acc;
    }, []);
  }, [compras]);

  // ── PDF: Compras ──────────────────────────────────────────────────────────
  const buildComprasDoc = () => {
    const filtroDesc = [
      cpPeriod !== 'todo' && cpValue ? `${cpPeriod === 'dia' ? 'Día' : cpPeriod === 'mes' ? 'Mes' : 'Año'}: ${cpValue}` : 'Todo el período',
      cpProv !== 'all' ? `Proveedor: ${proveedoresUnicos.find((p: any) => p.id === cpProv)?.name || cpProv}` : 'Todos los proveedores',
    ].join(' | ');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    addPdfHeader(doc, `REPORTE DE COMPRAS — ${filtroDesc}`);
    let y = 44;

    const pdfPeriodLabel = cpPeriod === 'dia' ? 'COMPRAS DEL DÍA'
      : cpPeriod === 'mes'  ? 'COMPRAS POR DÍA (MES)'
      : cpPeriod === 'anio' ? 'COMPRAS POR MES (AÑO)'
      : 'COMPRAS POR MES';
    doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(pdfPeriodLabel, 11, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Período', 'Cantidad', 'Monto Total (Bs.)']],
      body: comprasPorMes.map((r: any) => [r.mes, String(r.cantidad), Number(r.total).toLocaleString()]),
      theme: 'grid',
      headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? 80) + 9;
    if (y > 230) { doc.addPage(); addPdfHeader(doc, 'REPORTE DE COMPRAS'); y = 44; }

    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('TOP PROVEEDORES', 11, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Proveedor', 'Compras', 'Total (Bs.)']],
      body: topProveedoresFiltrados.map((r: any) => [r.nombre, String(r.cantidad), r.total.toLocaleString()]),
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? 110) + 9;
    if (y > 230) { doc.addPage(); addPdfHeader(doc, 'REPORTE DE COMPRAS'); y = 44; }

    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('TOP PRODUCTOS COMPRADOS', 11, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Producto', 'Unidades', 'Subtotal (Bs.)']],
      body: topProductosFiltrados.map((r: any) => [r.nombre, String(r.cantidad), r.total.toLocaleString()]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? 140) + 9;
    if (y > 230) { doc.addPage(); addPdfHeader(doc, 'REPORTE DE COMPRAS'); y = 44; }

    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('MÉTODOS Y CONDICIÓN DE PAGO', 11, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Tipo', 'Cantidad', 'Total (Bs.)']],
      body: [
        ...condicionPago.map((r: any) => [r.condicion, String(r.cantidad), r.total.toLocaleString()]),
        ...metodosPago.map((r: any) => [`Pago: ${r.metodo}`, String(r.cantidad), r.total.toLocaleString()]),
      ],
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
    });
    addPdfFooter(doc);
    return doc;
  };

  const pdfCompras = async () => {
    setGenPdf('compras');
    try {
      buildComprasDoc().save(`PARADISO_Compras_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF de Compras descargado.');
    } catch { toast.error('Error al generar PDF.'); }
    finally { setGenPdf(null); }
  };

  // ── PDF: CxP ─────────────────────────────────────────────────────────────
  const buildCxPDoc = () => {
    const filtroDescCxP = cxpPeriod !== 'todo' && cxpValue
      ? `${cxpPeriod === 'dia' ? 'Día' : cxpPeriod === 'mes' ? 'Mes' : 'Año'}: ${cxpValue}`
      : 'Todo el período';
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    addPdfHeader(doc, `REPORTE CUENTAS POR PAGAR — Vencimiento: ${filtroDescCxP}`);
    let y = 44;

    doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('DEUDA POR PROVEEDOR', 11, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Proveedor', 'Cuentas', 'Saldo Pendiente (Bs.)']],
      body: deudaPorProv.map((r: any) => [r.nombre, String(r.cuentas), r.deuda.toLocaleString()]),
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? 80) + 9;
    if (y > 230) { doc.addPage(); addPdfHeader(doc, 'CUENTAS POR PAGAR'); y = 44; }

    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('ESTADO DE CUENTAS', 11, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Estado', 'Cantidad', 'Total (Bs.)']],
      body: estadoCxP.map((r: any) => [r.estado, String(r.cantidad), r.total.toLocaleString()]),
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? 110) + 9;
    if (y > 230) { doc.addPage(); addPdfHeader(doc, 'CUENTAS POR PAGAR'); y = 44; }

    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN DE CUOTAS', 11, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Categoría', 'Cantidad', 'Monto Total (Bs.)']],
      body: [
        ['Cuotas Vencidas (sin pagar)',  String(cuotasVencidas.cantidad), cuotasVencidas.total.toLocaleString()],
        ['Cuotas Próximas (≤ 30 días)', String(cuotasProximas.cantidad), cuotasProximas.total.toLocaleString()],
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
    });
    addPdfFooter(doc);
    return doc;
  };

  const pdfCxP = async () => {
    setGenPdf('cxp');
    try {
      buildCxPDoc().save(`PARADISO_CxP_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF de Cuentas por Pagar descargado.');
    } catch { toast.error('Error al generar PDF.'); }
    finally { setGenPdf(null); }
  };

  // ── PDF: Proveedores ──────────────────────────────────────────────────────
  const buildProveedoresDoc = () => {
    const filtroDescProv = provPeriod !== 'todo' && provValue
      ? `${provPeriod === 'dia' ? 'Día' : provPeriod === 'mes' ? 'Mes' : 'Año'}: ${provValue}`
      : 'Todo el período';
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    addPdfHeader(doc, `REPORTE DE PROVEEDORES — Período: ${filtroDescProv}`);
    let y = 44;

    doc.setTextColor(30, 30, 30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('RANKING DE PROVEEDORES', 11, y); y += 4;
    autoTable(doc, {
      startY: y,
      head: [['#', 'Proveedor', 'Compras', 'Total Comprado (Bs.)', '% del Total']],
      body: topProveedoresFull.map((r: any, i: number) => {
        const grandTotal = topProveedoresFull.reduce((s: number, x: any) => s + x.total, 0) || 1;
        return [String(i + 1), r.nombre, String(r.cantidad), r.total.toLocaleString(), `${((r.total / grandTotal) * 100).toFixed(1)}%`];
      }),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
    });
    addPdfFooter(doc);
    return doc;
  };

  const pdfProveedores = async () => {
    setGenPdf('proveedores');
    try {
      buildProveedoresDoc().save(`PARADISO_Proveedores_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF de Proveedores descargado.');
    } catch { toast.error('Error al generar PDF.'); }
    finally { setGenPdf(null); }
  };

  // ── Enviar correo ─────────────────────────────────────────────────────────
  const sendEmail = async (type: string, emailAddr: string, msg?: string) => {
    setSending(type);
    try {
      const today = new Date().toISOString().slice(0, 10);
      let doc: jsPDF; let filename: string; let asunto: string;
      if (type === 'COMPRAS') {
        doc = buildComprasDoc();
        filename = `PARADISO_Compras_${today}.pdf`;
        asunto   = 'Reporte de Compras - PARADISO';
      } else if (type === 'CUENTAS') {
        doc = buildCxPDoc();
        filename = `PARADISO_CxP_${today}.pdf`;
        asunto   = 'Reporte de Cuentas por Pagar - PARADISO';
      } else {
        doc = buildProveedoresDoc();
        filename = `PARADISO_Proveedores_${today}.pdf`;
        asunto   = 'Ranking de Proveedores - PARADISO';
      }
      await financeApi.enviarPdfDirecto({
        email:   emailAddr,
        pdfBase64: doc.output('datauristring').split(',')[1],
        filename,
        asunto,
        mensajePersonalizado: msg,
        reportType: type,
      });
      toast.success(`Reporte ${type} enviado a ${emailAddr}`);
      setModalType(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al enviar correo.');
    } finally { setSending(''); }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <div className="w-9 h-9 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      <p className="text-sm text-gray-400">Cargando reportes financieros...</p>
    </div>
  );

  const modalMeta: Record<string, { title: string; sub: string; pdfSub: string }> = {
    COMPRAS:     { title: 'Gestionar Compras',  sub: 'Finanzas · PARADISO', pdfSub: 'Incluye análisis de compras, proveedores y productos' },
    CUENTAS:     { title: 'Cuentas por Pagar',  sub: 'Finanzas · PARADISO', pdfSub: 'Incluye deuda por proveedor, vencimientos y estado de cuentas' },
    PROVEEDORES: { title: 'Proveedores',         sub: 'Finanzas · PARADISO', pdfSub: 'Incluye ranking de proveedores por volumen de compras' },
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">

      <EmailReportModal
        open={!!modalType}
        onClose={() => setModalType(null)}
        reportTitle={modalType ? modalMeta[modalType]?.title ?? modalType : ''}
        reportSubtitle={modalType ? modalMeta[modalType]?.sub ?? '' : ''}
        pdfInfoText="Se generará un PDF con los filtros activos aplicados"
        pdfInfoSub={modalType ? modalMeta[modalType]?.pdfSub ?? '' : ''}
        filters={
          modalType === 'COMPRAS' ? [
            { label: 'Período',    value: cpPeriod !== 'todo' && cpValue ? `${cpPeriod === 'dia' ? 'Día' : cpPeriod === 'mes' ? 'Mes' : 'Año'}: ${cpValue}` : 'Todo' },
            { label: 'Proveedor', value: cpProv !== 'all' ? proveedoresUnicos.find((p: any) => p.id === cpProv)?.name || cpProv : 'Todos' },
          ] : modalType === 'CUENTAS' ? [
            { label: 'Vencimiento', value: cxpPeriod !== 'todo' && cxpValue ? `${cxpPeriod === 'dia' ? 'Día' : cxpPeriod === 'mes' ? 'Mes' : 'Año'}: ${cxpValue}` : 'Todo' },
          ] : modalType === 'PROVEEDORES' ? [
            { label: 'Período', value: provPeriod !== 'todo' && provValue ? `${provPeriod === 'dia' ? 'Día' : provPeriod === 'mes' ? 'Mes' : 'Año'}: ${provValue}` : 'Todo' },
          ] : []
        }
        onSend={(email, msg) => { if (modalType) sendEmail(modalType, email, msg); }}
        sending={!!sending}
      />

      {/* ── Sub-tab nav ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl w-fit bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-white/[0.07]">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              subTab === t.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ═══════════════════════════════════════════════════════════════════
            SUB-TAB: COMPRAS
        ════════════════════════════════════════════════════════════════════ */}
        {subTab === 'compras' && (
          <motion.div key="compras"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
            className="flex flex-col gap-4"
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-teal-500" />
                  Gestionar Compras
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Análisis de compras, proveedores, productos y pagos
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={pdfCompras} disabled={!!genPdf} className={BTN_PDF}>
                  <Printer className="w-4 h-4" />
                  {genPdf === 'compras' ? 'Generando...' : 'PDF'}
                </button>
                <button onClick={() => setModalType('COMPRAS')} disabled={!!sending} className={BTN_MAIL}>
                  <Send className={`w-4 h-4 ${sending === 'COMPRAS' ? 'animate-ping' : ''}`} />
                  Correo
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className={`${CARD} p-4 flex flex-wrap items-center gap-3`}>
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select value={cpPeriod} onChange={e => { setCpPeriod(e.target.value as Period); setCpValue(''); }} className={SELECT}>
                <option value="todo">Todo el período</option>
                <option value="dia">Por Día</option>
                <option value="mes">Por Mes</option>
                <option value="anio">Por Año</option>
              </select>
              {cpPeriod === 'dia'  && <input type="date"  value={cpValue} onChange={e => setCpValue(e.target.value)} className={SELECT} />}
              {cpPeriod === 'mes'  && <input type="month" value={cpValue} onChange={e => setCpValue(e.target.value)} className={SELECT} />}
              {cpPeriod === 'anio' && (
                <select value={cpValue} onChange={e => setCpValue(e.target.value)} className={SELECT}>
                  <option value="">Seleccionar año</option>
                  {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)).map(y =>
                    <option key={y} value={y}>{y}</option>,
                  )}
                </select>
              )}
              <select value={cpProv} onChange={e => setCpProv(e.target.value)} className={SELECT}>
                <option value="all">Todos los Proveedores</option>
                {proveedoresUnicos.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Compras',   value: String(totalCompras),          icon: ShoppingCart, color: 'teal'   },
                { label: 'Monto Total',     value: fmtBs(totalMonto),             icon: TrendingUp,   color: 'green'  },
                { label: 'Proveedores',     value: String(topProveedoresFiltrados.length), icon: Users, color: 'blue' },
                { label: 'Productos Únicos', value: String(topProductosFiltrados.length), icon: ShoppingCart, color: 'purple' },
              ].map((k, i) => (
                <motion.div key={k.label}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`${CARD} p-4`}
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{k.label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{k.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Gráfica 1: Compras por período */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {cpPeriod === 'dia'  ? 'Compras del Día'
                 : cpPeriod === 'mes'  ? 'Compras por Día (mes)'
                 : cpPeriod === 'anio' ? 'Compras por Mes (año)'
                 : 'Compras por Mes'}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {cpPeriod === 'mes' ? 'Desglose diario del mes seleccionado'
                 : cpPeriod === 'anio' ? 'Desglose mensual del año seleccionado'
                 : 'Cantidad y monto por período'}
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={comprasPorMes} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                    <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }}
                      tickFormatter={v => (cpPeriod === 'dia' || cpPeriod === 'mes') ? (v?.slice(8) || v) : (v?.slice(5) || v)} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`} yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: tick }} />
                    <Tooltip {...tipStyle} formatter={(v, n) =>
                      [n === 'total' ? fmtBs(fmtN(v)) : `${fmtN(v)} compras`, n === 'total' ? 'Monto' : 'Cantidad']} />
                    <Bar yAxisId="left"  dataKey="total"    fill={TEAL}  radius={[4, 4, 0, 0]} maxBarSize={36} name="total" />
                    <Bar yAxisId="right" dataKey="cantidad" fill={AMBER} radius={[4, 4, 0, 0]} maxBarSize={20} name="cantidad" />
                    <Legend iconType="circle" iconSize={7}
                      formatter={v => <span style={{ fontSize: 11, color: v === 'total' ? TEAL : AMBER }}>
                        {v === 'total' ? 'Monto (Bs.)' : 'Cantidad'}
                      </span>} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Gráfica 2: Top Proveedores donut */}
              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Top Proveedores</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Por monto total comprado</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={topProveedoresFiltrados} dataKey="total" nameKey="nombre"
                      cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                      {topProveedoresFiltrados.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tipStyle} formatter={v => [fmtBs(fmtN(v)), 'Total']} />
                    <Legend iconType="circle" iconSize={7}
                      formatter={v => <span style={{ fontSize: 10, color: tick }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Top list */}
                <div className="mt-2 space-y-2">
                  {topProveedoresFiltrados.slice(0, 4).map((p: any, i: number) => {
                    const max = topProveedoresFiltrados[0]?.total || 1;
                    return (
                      <div key={p.nombre} className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-xs text-gray-600 dark:text-gray-300 flex-1 truncate">{p.nombre}</span>
                        <div className="flex-1 max-w-[80px] h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${(p.total / max) * 100}%`,
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-16 text-right tabular-nums">
                          {fmtBs(p.total)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Gráfica 3: Top Productos + métodos de pago */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Top Productos Comprados</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Por cantidad de unidades</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={topProductosFiltrados} layout="vertical"
                    margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }}
                      tickFormatter={v => `${v}`} />
                    <YAxis type="category" dataKey="nombre" axisLine={false} tickLine={false}
                      tick={{ fontSize: 9, fill: tick }} width={90}
                      tickFormatter={v => v?.length > 12 ? `${v.slice(0, 12)}…` : v} />
                    <Tooltip {...tipStyle} formatter={v => [`${fmtN(v)} uds.`, 'Cantidad']} />
                    <Bar dataKey="cantidad" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {topProductosFiltrados.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Condición y Método de Pago</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">CONTADO vs CRÉDITO y EFECTIVO vs QR</p>
                <div className="grid grid-cols-2 gap-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={condicionPago} dataKey="cantidad" nameKey="condicion"
                        cx="50%" cy="50%" outerRadius={60} innerRadius={28} paddingAngle={3}>
                        {condicionPago.map((_: any, i: number) => (
                          <Cell key={i} fill={[TEAL, AMBER][i % 2]} />
                        ))}
                      </Pie>
                      <Tooltip {...tipStyle} formatter={v => [`${fmtN(v)} compras`, '']} />
                      <Legend iconType="circle" iconSize={6}
                        formatter={v => <span style={{ fontSize: 9, color: tick }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={metodosPago.length ? metodosPago : [{ metodo: 'Sin datos', cantidad: 1 }]}
                        dataKey="cantidad" nameKey="metodo"
                        cx="50%" cy="50%" outerRadius={60} innerRadius={28} paddingAngle={3}>
                        {(metodosPago.length ? metodosPago : [{}]).map((_: any, i: number) => (
                          <Cell key={i} fill={[GREEN, BLUE][i % 2]} />
                        ))}
                      </Pie>
                      <Tooltip {...tipStyle} formatter={v => [`${fmtN(v)} pagos`, '']} />
                      <Legend iconType="circle" iconSize={6}
                        formatter={v => <span style={{ fontSize: 9, color: tick }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {condicionPago.map((r: any, i: number) => (
                    <div key={r.condicion} className="bg-gray-100 dark:bg-gray-700/40 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{r.condicion}</p>
                      <p className="text-lg font-bold tabular-nums mt-1"
                        style={{ color: [TEAL, AMBER][i % 2] }}>{r.cantidad}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{fmtBs(r.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabla de compras recientes */}
            <div className={`${CARD} p-5`}>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Compras Recientes
                <span className="ml-2 text-xs text-gray-400 font-normal">{comprasFiltradas.length} registros</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/[0.07]">
                      {['#', 'Fecha', 'Proveedor', 'Condición', 'Monto (Bs.)', 'Estado'].map(h => (
                        <th key={h} className="text-left text-xs text-gray-500 dark:text-gray-400 font-medium pb-3 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comprasFiltradas.slice(0, 10).map((c: any) => (
                      <tr key={c.ID_Compra} className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-4 text-xs text-gray-500">#{c.ID_Compra}</td>
                        <td className="py-2.5 pr-4 text-xs text-gray-600 dark:text-gray-400">
                          {c.Fecha_Emision ? String(c.Fecha_Emision).slice(0, 10) : '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-sm text-gray-800 dark:text-gray-200 font-medium">
                          {c.proveedor?.Nombre_RazonSocial || '—'}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            c.Condicion_Pago === 'CONTADO'
                              ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400'
                              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          }`}>{c.Condicion_Pago}</span>
                        </td>
                        <td className="py-2.5 pr-4 text-sm font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                          {Number(c.Monto_Total || 0).toLocaleString()}
                        </td>
                        <td className="py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            c.Estado_Documento === 'ACTIVO'
                              ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                              : c.Estado_Documento === 'ESPERANDO_PAGO'
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              : 'bg-red-500/20 text-red-500'
                          }`}>{c.Estado_Documento}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SUB-TAB: CUENTAS POR PAGAR
        ════════════════════════════════════════════════════════════════════ */}
        {subTab === 'cxp' && (
          <motion.div key="cxp"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
            className="flex flex-col gap-4"
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-red-500" />
                  Cuentas por Pagar
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Deudas por proveedor, vencimientos y estado de cuentas
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={pdfCxP} disabled={!!genPdf} className={BTN_PDF}>
                  <Printer className="w-4 h-4" />
                  {genPdf === 'cxp' ? 'Generando...' : 'PDF'}
                </button>
                <button onClick={() => setModalType('CUENTAS')} disabled={!!sending} className={BTN_MAIL}>
                  <Send className={`w-4 h-4 ${sending === 'CUENTAS' ? 'animate-ping' : ''}`} />
                  Correo
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className={`${CARD} p-4 flex flex-wrap items-center gap-3`}>
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select value={cxpPeriod} onChange={e => { setCxpPeriod(e.target.value as Period); setCxpValue(''); }} className={SELECT}>
                <option value="todo">Todo el período</option>
                <option value="dia">Por Día</option>
                <option value="mes">Por Mes</option>
                <option value="anio">Por Año</option>
              </select>
              {cxpPeriod === 'dia'  && <input type="date"  value={cxpValue} onChange={e => setCxpValue(e.target.value)} className={SELECT} />}
              {cxpPeriod === 'mes'  && <input type="month" value={cxpValue} onChange={e => setCxpValue(e.target.value)} className={SELECT} />}
              {cxpPeriod === 'anio' && (
                <select value={cxpValue} onChange={e => setCxpValue(e.target.value)} className={SELECT}>
                  <option value="">Seleccionar año</option>
                  {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)).map(y =>
                    <option key={y} value={y}>{y}</option>,
                  )}
                </select>
              )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Deuda Total',     value: fmtBs(totalDeuda),              icon: CreditCard,   bg: 'bg-red-500/10',    text: 'text-red-500'    },
                { label: 'Cuotas Vencidas', value: String(cuotasVencidas.cantidad), icon: AlertTriangle, bg: 'bg-red-500/10',   text: 'text-red-500'    },
                { label: 'Cuotas Próximas', value: String(cuotasProximas.cantidad), icon: Clock,        bg: 'bg-amber-500/10',  text: 'text-amber-500'  },
                { label: 'Proveedores',     value: String(deudaPorProv.length),     icon: Users,        bg: 'bg-teal-500/10',   text: 'text-teal-500'   },
              ].map((k, i) => (
                <motion.div key={k.label}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`${CARD} p-4`}
                >
                  <div className={`w-8 h-8 rounded-xl ${k.bg} flex items-center justify-center mb-3`}>
                    <k.icon className={`w-4 h-4 ${k.text}`} />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{k.label}</p>
                  <p className={`text-xl font-bold tabular-nums ${k.text}`}>{k.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Gráficas */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              {/* Deuda por proveedor */}
              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Deuda por Proveedor</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Saldo pendiente activo</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={deudaPorProv} layout="vertical"
                    margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nombre" axisLine={false} tickLine={false}
                      tick={{ fontSize: 9, fill: tick }} width={90}
                      tickFormatter={v => v?.length > 12 ? `${v.slice(0, 12)}…` : v} />
                    <Tooltip {...tipStyle} formatter={v => [fmtBs(fmtN(v)), 'Deuda']} />
                    <Bar dataKey="deuda" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {deudaPorProv.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Estado CxP donut */}
              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Estado de Cuentas</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Distribución por estado de pago</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={estadoCxP} dataKey="cantidad" nameKey="estado"
                      cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}>
                      {estadoCxP.map((_: any, i: number) => (
                        <Cell key={i} fill={[RED, AMBER, GREEN][i % 3]} />
                      ))}
                    </Pie>
                    <Tooltip {...tipStyle} formatter={(v, n) => [`${fmtN(v)} cuentas — ${fmtBs(estadoCxP.find((r: any) => r.estado === n)?.total || 0)}`, '']} />
                    <Legend iconType="circle" iconSize={7}
                      formatter={v => <span style={{ fontSize: 10, color: tick }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Estado cards */}
                <div className="mt-3 flex gap-3 flex-wrap">
                  {estadoCxP.map((r: any, i: number) => (
                    <div key={r.estado} className="flex-1 min-w-[80px] bg-gray-100 dark:bg-gray-700/40 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{r.estado}</p>
                      <p className="text-lg font-bold tabular-nums mt-1" style={{ color: [RED, AMBER, GREEN][i % 3] }}>{r.cantidad}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{fmtBs(r.total)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alertas de cuotas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`${CARD} p-5 flex items-center gap-4`}>
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cuotas Vencidas (sin pagar)</p>
                  <p className="text-2xl font-bold text-red-500 tabular-nums mt-0.5">{cuotasVencidas.cantidad}</p>
                  <p className="text-xs text-gray-400 mt-1">{fmtBs(cuotasVencidas.total)} pendiente</p>
                </div>
              </div>
              <div className={`${CARD} p-5 flex items-center gap-4`}>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Próximas a vencer (≤ 30 días)</p>
                  <p className="text-2xl font-bold text-amber-500 tabular-nums mt-0.5">{cuotasProximas.cantidad}</p>
                  <p className="text-xs text-gray-400 mt-1">{fmtBs(cuotasProximas.total)} por pagar</p>
                </div>
              </div>
            </div>

            {/* Tabla cuentas */}
            <div className={`${CARD} p-5`}>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Cuentas por Pagar
                <span className="ml-2 text-xs text-gray-400 font-normal">{cuentasFiltradas.length} registros</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/[0.07]">
                      {['#', 'Proveedor', 'Vencimiento', 'Saldo (Bs.)', 'Estado'].map(h => (
                        <th key={h} className="text-left text-xs text-gray-500 dark:text-gray-400 font-medium pb-3 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cuentasFiltradas.slice(0, 10).map((c: any) => {
                      const days = Math.round((new Date(c.Fecha_Vencimiento).getTime() - Date.now()) / 86_400_000);
                      const past = days < 0;
                      return (
                        <tr key={c.ID_Cuenta} className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                          <td className="py-2.5 pr-4 text-xs text-gray-500">#{c.ID_Cuenta}</td>
                          <td className="py-2.5 pr-4 text-sm font-medium text-gray-800 dark:text-gray-200">
                            {c.notaCompra?.proveedor?.Nombre_RazonSocial || '—'}
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {String(c.Fecha_Vencimiento).slice(0, 10)}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                            {Number(c.Saldo_Pendiente || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              c.Estado_Pago === 'PAGADO'   ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                              c.Estado_Pago === 'PARCIAL'  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                              past ? 'bg-red-500/20 text-red-500' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                            }`}>
                              {c.Estado_Pago === 'PAGADO' ? 'Pagado' :
                               c.Estado_Pago === 'PARCIAL' ? 'Parcial' :
                               past ? 'Vencida' : 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SUB-TAB: PROVEEDORES
        ════════════════════════════════════════════════════════════════════ */}
        {subTab === 'proveedores' && (
          <motion.div key="proveedores"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
            className="flex flex-col gap-4"
          >
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  Proveedores
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Ranking de proveedores por volumen de compras
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={pdfProveedores} disabled={!!genPdf} className={BTN_PDF}>
                  <Printer className="w-4 h-4" />
                  {genPdf === 'proveedores' ? 'Generando...' : 'PDF'}
                </button>
                <button onClick={() => setModalType('PROVEEDORES')} disabled={!!sending} className={BTN_MAIL}>
                  <Send className={`w-4 h-4 ${sending === 'PROVEEDORES' ? 'animate-ping' : ''}`} />
                  Correo
                </button>
              </div>
            </div>

            {/* Filtros por período */}
            <div className={`${CARD} p-4 flex flex-wrap items-center gap-3`}>
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select value={provPeriod} onChange={e => { setProvPeriod(e.target.value as Period); setProvValue(''); }} className={SELECT}>
                <option value="todo">Todo el período</option>
                <option value="dia">Por Día</option>
                <option value="mes">Por Mes</option>
                <option value="anio">Por Año</option>
              </select>
              {provPeriod === 'dia'  && <input type="date"  value={provValue} onChange={e => setProvValue(e.target.value)} className={SELECT} />}
              {provPeriod === 'mes'  && <input type="month" value={provValue} onChange={e => setProvValue(e.target.value)} className={SELECT} />}
              {provPeriod === 'anio' && (
                <select value={provValue} onChange={e => setProvValue(e.target.value)} className={SELECT}>
                  <option value="">Seleccionar año</option>
                  {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)).map(y =>
                    <option key={y} value={y}>{y}</option>,
                  )}
                </select>
              )}
            </div>

            {/* KPI de primer proveedor */}
            {topProveedoresFull.length > 0 && (
              <div className={`${CARD} p-5 flex items-center gap-5`}>
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-7 h-7 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Proveedor Principal</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                    {topProveedoresFull[0]?.nombre || '—'}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-teal-500 font-semibold">{fmtBs(topProveedoresFull[0]?.total || 0)}</span>
                    <span className="text-xs text-gray-400">{topProveedoresFull[0]?.cantidad || 0} compras</span>
                  </div>
                </div>
              </div>
            )}

            {/* Gráficas: Bar + Área */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Ranking por Monto</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Total comprado a cada proveedor</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topProveedoresFull.slice(0, 8)} layout="vertical"
                    margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nombre" axisLine={false} tickLine={false}
                      tick={{ fontSize: 9, fill: tick }} width={90}
                      tickFormatter={v => v?.length > 12 ? `${v.slice(0, 12)}…` : v} />
                    <Tooltip {...tipStyle} formatter={v => [fmtBs(fmtN(v)), 'Total comprado']} />
                    <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={24}>
                      {topProveedoresFull.slice(0, 8).map((_: any, i: number) => (
                        <Cell key={i} fill={i === 0 ? AMBER : CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Ranking por Frecuencia</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Número de compras realizadas</p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={[...topProveedoresFull.slice(0, 8)].sort((a: any, b: any) => b.cantidad - a.cantidad)}
                    margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                    <XAxis dataKey="nombre" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: tick }}
                      tickFormatter={v => v?.length > 8 ? `${v.slice(0, 8)}…` : v} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} allowDecimals={false} />
                    <Tooltip {...tipStyle} formatter={v => [`${fmtN(v)} compras`, 'Frecuencia']} />
                    <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} maxBarSize={36}>
                      {topProveedoresFull.slice(0, 8).map((_: any, i: number) => (
                        <Cell key={i} fill={i === 0 ? TEAL : CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabla detallada de proveedores */}
            <div className={`${CARD} p-5`}>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Detalle de Proveedores
                <span className="ml-2 text-xs text-gray-400 font-normal">{topProveedoresFull.length} proveedores</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/[0.07]">
                      {['#', 'Proveedor', 'Compras', 'Total Comprado', '% del Total'].map(h => (
                        <th key={h} className="text-left text-xs text-gray-500 dark:text-gray-400 font-medium pb-3 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topProveedoresFull.map((p: any, i: number) => {
                      const grandTotal = topProveedoresFull.reduce((s: number, r: any) => s + r.total, 0) || 1;
                      const pct = ((p.total / grandTotal) * 100).toFixed(1);
                      return (
                        <tr key={p.nombre} className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                          <td className="py-2.5 pr-4">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              i === 0 ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                            }`}>{i + 1}</span>
                          </td>
                          <td className="py-2.5 pr-4 text-sm font-medium text-gray-800 dark:text-gray-200">{p.nombre}</td>
                          <td className="py-2.5 pr-4 text-sm text-gray-600 dark:text-gray-400 tabular-nums">{p.cantidad}</td>
                          <td className="py-2.5 pr-4 text-sm font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                            {fmtBs(p.total)}
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[60px]">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: i === 0 ? AMBER : TEAL }} />
                              </div>
                              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};
