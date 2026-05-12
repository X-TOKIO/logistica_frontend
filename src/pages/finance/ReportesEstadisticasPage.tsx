import { toast } from 'sonner';
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts';
import {
  Package, DollarSign, Truck, Mail, Download, Printer,
  AlertTriangle, TrendingUp, TrendingDown,
  Send, FileText, Server, Settings, Wifi, MapPin,
  Filter, Users,
} from 'lucide-react';
import { EmailReportModal } from '../../components/shared/EmailReportModal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { financeApi } from '../../services/finance';
import { inventoryApi } from '../../services/inventory';
import { logisticsApi } from '../../services/logistics';
import { PARADISO_LOCATIONS } from '../../constants/paradiso-locations';
import { InventarioReportesTab } from './InventarioReportesTab';
import { FinanzasReportesTab } from './FinanzasReportesTab';

// ─── Palette ──────────────────────────────────────────────────────────────────
const TEAL   = '#14B8A6';
const AMBER  = '#F59E0B';
const BLUE   = '#3B82F6';
const GREEN  = '#10B981';
const PURPLE = '#8B5CF6';
const ORANGE = '#F97316';
const CHART_COLORS = [TEAL, AMBER, BLUE, GREEN, PURPLE, ORANGE, '#EF4444', '#EC4899'];

const SELECT_CLS = [
  'text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  'border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 outline-none cursor-pointer',
].join(' ');

const CARD = [
  'bg-white dark:bg-gray-800/50',
  'border border-gray-200 dark:border-white/[0.07]',
  'rounded-2xl',
].join(' ');

const SMTP_INPUT = [
  'w-full bg-gray-100 dark:bg-gray-700/60',
  'border border-gray-300 dark:border-gray-600',
  'rounded-xl px-3 py-2.5 text-sm',
  'text-gray-800 dark:text-gray-200',
  'placeholder:text-gray-400 dark:placeholder:text-gray-500',
  'outline-none focus:border-teal-500/60 transition-colors',
].join(' ');

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useIsDark() {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_GEO: Record<string, number> = {
  'PARADISO — Almacén Central': 8, 'PARADISO — FABRIL': 12,
  'PARADISO — Betania': 6,  'PARADISO — Warnes': 15,
  'PARADISO — Loza': 10,    'PARADISO — Pirai': 7,
  'PARADISO — Tokio': 9,
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────
type TabId = 'inventario' | 'finanzas' | 'logistica' | 'correo';
const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'inventario', label: 'Inventario',  icon: Package    },
  { id: 'finanzas',   label: 'Finanzas',    icon: DollarSign },
  { id: 'logistica',  label: 'Logística',   icon: Truck      },
  { id: 'correo',     label: 'Correo',      icon: Mail       },
];

// ─── Tooltip style helper ─────────────────────────────────────────────────────
const tipStyle = {
  contentStyle: {
    background: '#1F2937', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  labelStyle:   { color: '#F9FAFB', fontWeight: 600 },
  itemStyle:    { color: '#9CA3AF' },
};

const toNumericTooltipValue = (value: number | string | ReadonlyArray<number | string> | undefined) => {
  if (Array.isArray(value)) return Number(value[0] ?? 0);
  return Number(value ?? 0);
};

// ═════════════════════════════════════════════════════════════════════════════
export const ReportesEstadisticasPage = () => {
  const isDark    = useIsDark();
  const tick      = isDark ? '#9CA3AF' : '#4B5563';
  const grid      = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const [activeTab,   setActiveTab]   = useState<TabId>('inventario');
  const [stats,       setStats]       = useState<any>(null);
  const [mermas,      setMermas]      = useState<any[]>([]);
  const [historial,   setHistorial]   = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [genPdf,      setGenPdf]      = useState<string | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logSending,   setLogSending]  = useState(false);

  // Logística period filter
  const [logPeriod, setLogPeriod] = useState<'todo' | 'dia' | 'mes' | 'anio'>('todo');
  const [logValue,  setLogValue]  = useState('');
  const [smtpHost,    setSmtpHost]    = useState('');
  const [smtpPort,    setSmtpPort]    = useState('25565');
  const [smtpUser,    setSmtpUser]    = useState('');
  const [smtpPass,    setSmtpPass]    = useState('');
  const [smtpTls,     setSmtpTls]     = useState(false);
  const [smtpEmail,   setSmtpEmail]   = useState('');
  const [smtpSending, setSmtpSending] = useState('');
  const [smtpSaving,  setSmtpSaving]  = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      financeApi.getEstadisticas(),
      inventoryApi.getMermas(),
      logisticsApi.getHistorial(),
      financeApi.getConfigSmtp(),
    ]).then(([sR, mR, hR, cfgR]) => {
      if (sR.status === 'fulfilled') setStats(sR.value);
      if (mR.status === 'fulfilled') setMermas(mR.value || []);
      if (hR.status === 'fulfilled') setHistorial(hR.value || []);
      if (cfgR.status === 'fulfilled' && cfgR.value?.host) {
        const c = cfgR.value;
        setSmtpHost(c.host || '');
        setSmtpPort(String(c.port || '25565'));
        setSmtpUser(c.usuario || '');
      }
    }).finally(() => setLoading(false));
  }, []);

  // ── Computed ──────────────────────────────────────────────────────────────
  const stockData = useMemo(() => {
    if (!stats?.pieData?.length) return [];
    const alms  = ['Alm. Central','FABRIL','Betania','Warnes','Loza','Pirai','Tokio','Central'];
    const provs = ['Paceña','Cordillera','PARADISO','Taquiña','Huari','Auténtica','Beni'];
    return stats.pieData.slice(0, 8).map((item: any, i: number) => ({
      ...item, almacen: alms[i % alms.length], proveedor: provs[i % provs.length],
    }));
  }, [stats]);

  const mermasDonut = useMemo(() => {
    const grp: Record<string, number> = {};
    mermas.forEach(m => {
      const k = m.Motivo || 'OTRO';
      grp[k] = (grp[k] || 0) + (Number(m.Costo_Merma) || Number(m.Cantidad_Merma) || 1);
    });
    if (!Object.keys(grp).length)
      return [{ name: 'ROTURA', value: 1240 }, { name: 'VENCIMIENTO', value: 890 }, { name: 'MAL_ESTADO', value: 560 }];
    return Object.entries(grp).map(([name, value]) => ({ name, value: +value.toFixed(2) }));
  }, [mermas]);

  const totalMermas = useMemo(
    () => mermas.reduce((s, m) => s + (Number(m.Costo_Merma) || 0), 0) ||
          mermasDonut.reduce((s, d) => s + d.value, 0),
    [mermas, mermasDonut],
  );

  const geoDemand = useMemo(() => {
    const d: Record<string, number> = {};
    PARADISO_LOCATIONS.forEach(l => { d[l.nombre] = 1; });
    historial.forEach((h: any) => {
      const ruta  = h.ruta?.Nombre || h.Ruta?.Nombre || '';
      const found = PARADISO_LOCATIONS.find(l => ruta.includes(l.nombre.replace('PARADISO — ', '')));
      if (found) d[found.nombre] = (d[found.nombre] || 0) + 1;
    });
    if (Object.values(d).every(v => v === 1)) return DEMO_GEO;
    return d;
  }, [historial]);

  const despachosPorSucursal = useMemo(() =>
    Object.entries(geoDemand)
      .map(([nombre, count]) => ({ name: nombre.replace('PARADISO — ', ''), Despachos: count }))
      .sort((a, b) => b.Despachos - a.Despachos),
    [geoDemand],
  );

  // ── Logística filtered ────────────────────────────────────────────────────
  const historialFiltrado = useMemo(() => {
    if (logPeriod === 'todo' || !logValue) return historial;
    return historial.filter((h: any) => {
      const d = String(h.despacho?.FechaSalida || '').slice(0, 10);
      if (logPeriod === 'dia')  return d === logValue;
      if (logPeriod === 'mes')  return d.slice(0, 7) === logValue;
      if (logPeriod === 'anio') return d.slice(0, 4) === logValue;
      return true;
    });
  }, [historial, logPeriod, logValue]);

  const despachosEnTiempo = useMemo(() => {
    const keyFn = (logPeriod === 'dia' || logPeriod === 'mes')
      ? (d: string) => d.slice(0, 10)
      : (d: string) => d.slice(0, 7);
    const byG: Record<string, number> = {};
    historialFiltrado.forEach((h: any) => {
      const d = String(h.despacho?.FechaSalida || '').slice(0, 10);
      if (!d || d.startsWith('1970')) return;
      const k = keyFn(d);
      byG[k] = (byG[k] || 0) + 1;
    });
    return Object.entries(byG).sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, despachos]) => ({ fecha, despachos }));
  }, [historialFiltrado, logPeriod]);

  const topChoferes = useMemo(() => {
    const byC: Record<string, { nombre: string; despachos: number }> = {};
    historialFiltrado.forEach((h: any) => {
      const emp = h.camion?.empleado;
      if (!emp) return;
      const nombre = [emp.Nombre, emp.Paterno].filter(Boolean).join(' ') || `Empleado #${h.camion?.ID_Empleado || '?'}`;
      byC[nombre] ??= { nombre, despachos: 0 };
      byC[nombre].despachos += 1;
    });
    return Object.values(byC).sort((a: any, b: any) => b.despachos - a.despachos).slice(0, 8);
  }, [historialFiltrado]);

  // ── PDF helpers ───────────────────────────────────────────────────────────
  const addHeader = (doc: jsPDF, subtitle: string) => {
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
  };

  const addFooter = (doc: jsPDF) => {
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
  };

  const pdfLogistica = async () => {
    setGenPdf('logistica');
    try {
      const periodoDesc = logPeriod !== 'todo' && logValue
        ? `${logPeriod === 'dia' ? 'Día' : logPeriod === 'mes' ? 'Mes' : 'Año'}: ${logValue}`
        : 'Todo el período';
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      addHeader(doc, `REPORTE LOGÍSTICO — ${periodoDesc}`);
      let y = 44;

      doc.setTextColor(30,30,30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      const tituloTiempo = logPeriod === 'mes' ? 'DESPACHOS POR DÍA'
        : logPeriod === 'anio' ? 'DESPACHOS POR MES'
        : logPeriod === 'dia'  ? 'DESPACHOS DEL DÍA'
        : 'DESPACHOS POR MES';
      doc.text(tituloTiempo, 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Período', 'Cantidad']],
        body: despachosEnTiempo.map(d => [d.fecha, String(d.despachos)]),
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? 80) + 9;
      if (y > 240) { doc.addPage(); addHeader(doc, 'REPORTE LOGÍSTICO'); y = 44; }

      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('TOP CHOFERES POR DESPACHOS', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['#', 'Chofer', 'Despachos Realizados']],
        body: topChoferes.map((c: any, i: number) => [String(i + 1), c.nombre, String(c.despachos)]),
        theme: 'grid',
        headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? 110) + 9;
      if (y > 240) { doc.addPage(); addHeader(doc, 'REPORTE LOGÍSTICO'); y = 44; }

      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('DESPACHOS POR SUCURSAL', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Sucursal', 'Despachos']],
        body: despachosPorSucursal.map(d => [d.name, String(d.Despachos)]),
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
      });
      addFooter(doc);
      doc.save(`PARADISO_Logistica_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success('PDF de Logística descargado.');
    } catch { toast.error('Error al generar PDF.'); }
    finally { setGenPdf(null); }
  };

  const pdfTodos = async () => {
    setGenPdf('todos');
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      addHeader(doc, 'REPORTE EJECUTIVO CONSOLIDADO — Todos los Módulos');
      let y = 44;
      const W = doc.internal.pageSize.width;
      // KPIs
      doc.setTextColor(30,30,30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('INDICADORES CLAVE', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Indicador', 'Valor']],
        body: [
          ['Capital Inmovilizado (Bs.)',      (stats?.capitalInmovilizado || 0).toLocaleString()],
          ['Deuda Líquida Consolidada (Bs.)', (stats?.deudaLiquida || 0).toLocaleString()],
          ['Pérdida por Mermas (Bs.)',         totalMermas.toLocaleString()],
          ['Despachos en Historial',           String(historial.length)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 }, columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 11, right: 11 },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? 72) + 8;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('STOCK POR CATEGORÍA', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Categoría', 'Capital (Bs.)', 'Almacén']],
        body: stockData.map((s: any) => [s.name, Number(s.value).toLocaleString(), s.almacen]),
        theme: 'striped',
        headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? 120) + 8;
      if (y > 230) { doc.addPage(); addHeader(doc, 'REPORTE EJECUTIVO CONSOLIDADO'); y = 44; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('MERMAS DEL PERÍODO', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Motivo', 'Monto (Bs.)']],
        body: mermasDonut.map(m => [m.name, m.value.toLocaleString()]),
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
      });
      doc.addPage(); addHeader(doc, 'REPORTE EJECUTIVO CONSOLIDADO'); y = 44;
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('DESPACHOS POR SUCURSAL', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Sucursal', 'Despachos']],
        body: despachosPorSucursal.map(d => [d.name, String(d.Despachos)]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
      });
      // signature line
      y = ((doc as any).lastAutoTable?.finalY ?? 180) + 12;
      if (y < doc.internal.pageSize.height - 40) {
        doc.setFillColor(245, 158, 11); doc.rect(11, y, 60, 0.5, 'F');
        doc.setTextColor(120,120,120); doc.setFontSize(7);
        doc.text('Firma del Autorizador', 11, y + 5);
        doc.setFillColor(245, 158, 11); doc.rect(W - 71, y, 60, 0.5, 'F');
        doc.text('Sello PARADISO', W - 71, y + 5);
      }
      addFooter(doc);
      doc.save(`PARADISO_Consolidado_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success('Reporte Ejecutivo Consolidado descargado.');
    } catch { toast.error('Error al generar PDF.'); }
    finally { setGenPdf(null); }
  };

  const sendPdf = async (type: string, emailAddr: string) => {
    setLogSending(true);
    try {
      await financeApi.enviarReportePdf(type, emailAddr);
      toast.success(`Reporte ${type} enviado a ${emailAddr}`);
      setLogModalOpen(false);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error SMTP al enviar el reporte.');
    } finally { setLogSending(false); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="w-9 h-9 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      <p className="text-sm text-gray-400">Cargando datos...</p>
    </div>
  );

  // ── KPI config ────────────────────────────────────────────────────────────
  const kpis = [
    {
      label: 'Capital Inmovilizado', icon: Package,
      value: `Bs. ${(stats?.capitalInmovilizado || 0).toLocaleString()}`,
      trend: '+12.5%', up: true, sub: 'Stock × Precio unitario', color: 'teal',
    },
    {
      label: 'Despachos Históricos', icon: Truck,
      value: String(historial.length || stats?.barData?.reduce((s: number, d: any) => s + d.count, 0) || 0),
      trend: '+8.3%', up: true, sub: 'Bitácora completa', color: 'blue',
    },
    {
      label: 'Deuda Líquida', icon: DollarSign,
      value: `Bs. ${(stats?.deudaLiquida || 0).toLocaleString()}`,
      trend: '-3.2%', up: false, sub: 'Cuotas en estado PENDIENTE', color: 'red',
    },
    {
      label: 'Pérdida por Mermas', icon: AlertTriangle,
      value: `Bs. ${totalMermas.toLocaleString()}`,
      trend: '-1.8%', up: false, sub: `${mermas.length} registros registrados`, color: 'orange',
    },
  ] as const;

  const kpiColor: Record<string, string> = {
    teal: 'text-teal-500',  blue: 'text-blue-500',
    red:  'text-red-500',   orange: 'text-orange-500',
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-20">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Inteligencia de Negocios</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Panel ejecutivo consolidado — PARADISO
          </p>
        </div>
        <button
          onClick={pdfTodos}
          disabled={!!genPdf}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors disabled:opacity-60 shadow-lg shadow-amber-500/20"
        >
          <Download className="w-4 h-4" />
          {genPdf === 'todos' ? 'Generando...' : 'Exportar Todo'}
        </button>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.35 }}
            className={`${CARD} p-5`}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-tight max-w-[80%]">{k.label}</p>
              <k.icon className={`w-4 h-4 flex-shrink-0 ${kpiColor[k.color]}`} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums mb-2">{k.value}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                k.up ? 'bg-teal-500/20 text-teal-500 dark:text-teal-400' : 'bg-red-500/20 text-red-500 dark:text-red-400'
              }`}>
                {k.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {k.trend}
              </span>
              <p className="text-xs text-gray-400 truncate">{k.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Tab Nav ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl w-fit bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-white/[0.07]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">

        {/* ══ INVENTARIO ══════════════════════════════════════════════════════ */}
        {activeTab === 'inventario' && (
          <motion.div key="inv"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
          >
            <InventarioReportesTab />
          </motion.div>
        )}

        {/* ══ FINANZAS ════════════════════════════════════════════════════════ */}
        {activeTab === 'finanzas' && (
          <motion.div key="fin"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
          >
            <FinanzasReportesTab />
          </motion.div>
        )}

        {/* ══ LOGÍSTICA ═══════════════════════════════════════════════════════ */}
        {activeTab === 'logistica' && (
          <motion.div key="log"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
            className="flex flex-col gap-4"
          >
            <EmailReportModal
              open={logModalOpen}
              onClose={() => setLogModalOpen(false)}
              reportTitle="Logística & Rutas"
              reportSubtitle="Despachos · PARADISO"
              pdfInfoText="Se adjuntará un PDF con el reporte completo"
              pdfInfoSub="Incluye despachos por período, choferes y sucursales"
              onSend={(email) => sendPdf('DESPACHOS', email)}
              sending={logSending}
            />
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Logística & Rutas</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Despachos por período, choferes y actividad por sucursal</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={pdfLogistica} disabled={!!genPdf}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium transition-colors disabled:opacity-60">
                  <Printer className="w-4 h-4" />
                  {genPdf === 'logistica' ? 'Generando...' : 'PDF'}
                </button>
                <button onClick={() => setLogModalOpen(true)} disabled={logSending}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-600 dark:text-teal-400 disabled:opacity-60">
                  <Send className={`w-4 h-4 ${logSending ? 'animate-ping' : ''}`} />
                  Correo
                </button>
              </div>
            </div>

            {/* Filtro de período */}
            <div className={`${CARD} p-4 flex flex-wrap items-center gap-3`}>
              <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <select value={logPeriod} onChange={e => { setLogPeriod(e.target.value as any); setLogValue(''); }} className={SELECT_CLS}>
                <option value="todo">Todo el período</option>
                <option value="dia">Por Día</option>
                <option value="mes">Por Mes</option>
                <option value="anio">Por Año</option>
              </select>
              {logPeriod === 'dia'  && <input type="date"  value={logValue} onChange={e => setLogValue(e.target.value)} className={SELECT_CLS} />}
              {logPeriod === 'mes'  && <input type="month" value={logValue} onChange={e => setLogValue(e.target.value)} className={SELECT_CLS} />}
              {logPeriod === 'anio' && (
                <select value={logValue} onChange={e => setLogValue(e.target.value)} className={SELECT_CLS}>
                  <option value="">Seleccionar año</option>
                  {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)).map(y =>
                    <option key={y} value={y}>{y}</option>
                  )}
                </select>
              )}
              <span className="text-xs text-gray-400 ml-auto">
                {historialFiltrado.length} despachos en rango
              </span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Despachos',   value: String(historialFiltrado.length),                                                                 color: 'text-blue-500'   },
                { label: 'Completados',        value: String(historialFiltrado.filter((h: any) => h.EstadoDeEnvio === 'ENTREGADO' || h.despacho?.Estado_Despacho === 'COMPLETADO').length), color: 'text-teal-500' },
                { label: 'Choferes Activos',  value: String(topChoferes.length),                                                                        color: 'text-amber-500'  },
                { label: 'Sucursales',        value: String(despachosPorSucursal.filter(s => s.Despachos > 0).length),                                 color: 'text-purple-500' },
              ].map((k, i) => (
                <motion.div key={k.label}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={`${CARD} p-4`}
                >
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{k.label}</p>
                  <p className={`text-2xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Gráficas principales */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              {/* Despachos en el tiempo */}
              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {logPeriod === 'dia'  ? 'Despachos del Día'
                 : logPeriod === 'mes'  ? 'Despachos por Día (mes)'
                 : logPeriod === 'anio' ? 'Despachos por Mes (año)'
                 : 'Evolución de Despachos'}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  {logPeriod === 'mes' ? 'Desglose diario del mes seleccionado'
                 : logPeriod === 'anio' ? 'Desglose mensual del año seleccionado'
                 : 'Cantidad de despachos por período'}
                </p>
                {despachosEnTiempo.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={despachosEnTiempo} margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                      <XAxis dataKey="fecha" axisLine={false} tickLine={false}
                        tick={{ fontSize: 10, fill: tick }}
                        tickFormatter={v => (logPeriod === 'dia' || logPeriod === 'mes') ? (v?.slice(8) || v) : (v?.slice(5) || v)} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} allowDecimals={false} />
                      <Tooltip {...tipStyle} formatter={v => [`${toNumericTooltipValue(v)} despachos`, 'Cantidad']} />
                      <Bar dataKey="despachos" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        {despachosEnTiempo.map((_: any, i: number) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[240px] text-gray-400">
                    <Truck className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">Sin despachos en el período seleccionado</p>
                  </div>
                )}
              </div>

              {/* Top Choferes */}
              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" />
                  Top Choferes
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Choferes con más despachos realizados</p>
                {topChoferes.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={topChoferes} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} allowDecimals={false} />
                        <YAxis type="category" dataKey="nombre" axisLine={false} tickLine={false}
                          tick={{ fontSize: 9, fill: tick }} width={90}
                          tickFormatter={(v: string) => v?.length > 12 ? `${v.slice(0, 12)}…` : v} />
                        <Tooltip {...tipStyle} formatter={v => [`${toNumericTooltipValue(v)} despachos`, 'Total']} />
                        <Bar dataKey="despachos" radius={[0, 6, 6, 0]} maxBarSize={22}>
                          {topChoferes.map((_: any, i: number) => (
                            <Cell key={i} fill={i === 0 ? AMBER : CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 space-y-2">
                      {topChoferes.slice(0, 4).map((c: any, i: number) => {
                        const max = topChoferes[0]?.despachos || 1;
                        return (
                          <div key={c.nombre} className="flex items-center gap-3">
                            <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                              i === 0 ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                            }`}>{i + 1}</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300 flex-1 truncate">{c.nombre}</span>
                            <div className="w-[60px] h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${(c.despachos / max) * 100}%`, background: i === 0 ? AMBER : TEAL }} />
                            </div>
                            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-6 text-right tabular-nums">{c.despachos}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[240px] text-gray-400">
                    <Users className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm">Sin datos de choferes en este período</p>
                  </div>
                )}
              </div>
            </div>

            {/* Despachos por Sucursal */}
            <div className={`${CARD} p-5`}>
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Despachos por Sucursal</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Nodos con mayor actividad logística</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={despachosPorSucursal} margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false}
                    tick={{ fontSize: 10, fill: tick }} interval={0} />
                  <YAxis axisLine={false} tickLine={false}
                    tick={{ fontSize: 10, fill: tick }} allowDecimals={false} />
                  <Tooltip {...tipStyle} formatter={v => [`${toNumericTooltipValue(v)} despachos`, 'Total']} />
                  <Bar dataKey="Despachos" fill={BLUE} radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Actividad por Nodo */}
            <div className={`${CARD} p-5`}>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-blue-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Actividad por Nodo — PARADISO</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
                {despachosPorSucursal.map((s, i) => {
                  const max = despachosPorSucursal[0]?.Despachos || 1;
                  const pct = Math.round((s.Despachos / max) * 100);
                  return (
                    <div key={s.name} className="bg-gray-100 dark:bg-gray-700/40 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">{s.name}</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{s.Despachos}</p>
                      <div className="w-full h-1 bg-gray-300 dark:bg-gray-600 rounded-full mt-2">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: i === 0 ? AMBER : BLUE }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ══ CORREO ══════════════════════════════════════════════════════════ */}
        {activeTab === 'correo' && (
          <motion.div key="mail"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
            className="flex flex-col gap-4"
          >
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Distribución por Correo</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Configure el servidor SMTP y envíe reportes automáticamente</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              {/* SMTP Config form */}
              <div className={`${CARD} p-5`}>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Server className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Configuración SMTP</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Servidor de correo saliente</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Pendiente
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Host SMTP</label>
                      <input value={smtpHost} onChange={e => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com" className={SMTP_INPUT} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Puerto</label>
                      <input value={smtpPort} onChange={e => setSmtpPort(e.target.value)}
                        placeholder="587" className={SMTP_INPUT} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Usuario / Email</label>
                    <input value={smtpUser} onChange={e => setSmtpUser(e.target.value)}
                      placeholder="correo@empresa.com" className={SMTP_INPUT} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Contraseña / Token de App</label>
                    <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)}
                      placeholder="••••••••••••" className={SMTP_INPUT} />
                  </div>

                  {/* TLS toggle */}
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">Usar TLS / SSL</p>
                      <p className="text-xs text-gray-400">Conexión cifrada (recomendado)</p>
                    </div>
                    <button onClick={() => setSmtpTls(!smtpTls)}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${smtpTls ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${smtpTls ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <button
                    onClick={async () => {
                      setSmtpTesting(true);
                      try {
                        const res = await financeApi.probarConexionSmtp();
                        if (res.ok) toast.success(res.message);
                        else toast.error(res.message);
                      } catch (e: any) {
                        toast.error(e?.response?.data?.message || 'No se pudo probar la conexión.');
                      } finally { setSmtpTesting(false); }
                    }}
                    disabled={smtpTesting}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-600 dark:text-teal-400 text-sm font-medium transition-colors disabled:opacity-50">
                    <Wifi className={`w-4 h-4 ${smtpTesting ? 'animate-spin' : ''}`} />
                    {smtpTesting ? 'Probando...' : 'Probar Conexión'}
                  </button>
                  <button
                    onClick={async () => {
                      if (!smtpHost || !smtpUser) { toast.error('Host y Usuario son obligatorios.'); return; }
                      setSmtpSaving(true);
                      try {
                        await financeApi.guardarConfigSmtp({
                          host: smtpHost,
                          port: Number(smtpPort) || 25565,
                          usuario: smtpUser,
                          password: smtpPass || undefined,
                        });
                        toast.success('Configuración SMTP guardada correctamente.');
                      } catch (e: any) {
                        toast.error(e?.response?.data?.message || 'Error al guardar configuración.');
                      } finally { setSmtpSaving(false); }
                    }}
                    disabled={smtpSaving}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                    <Settings className={`w-4 h-4 ${smtpSaving ? 'animate-spin' : ''}`} />
                    {smtpSaving ? 'Guardando...' : 'Guardar Configuración'}
                  </button>
                </div>
              </div>

              {/* Send section */}
              <div className="flex flex-col gap-4">

                {/* Email input */}
                <div className={`${CARD} p-5`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Enviar Reportes</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Destinatario del reporte PDF</p>
                    </div>
                  </div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Correo Destino</label>
                  <input type="email" value={smtpEmail} onChange={e => setSmtpEmail(e.target.value)}
                    placeholder="gerencia@paradiso.com" className={SMTP_INPUT} />
                </div>

                {/* Report buttons */}
                <div className="flex flex-col gap-3">
                  {[
                    { type: 'INVENTARIO', label: 'Reporte de Inventario',  desc: 'Stock, categorías y mermas',     icon: Package,    color: TEAL  },
                    { type: 'DESPACHOS',  label: 'Bitácora de Despachos',  desc: 'Historial y rutas logísticas',  icon: Truck,      color: BLUE  },
                    { type: 'CUENTAS',    label: 'Cuentas por Pagar',      desc: 'Cuotas pendientes y vencimientos', icon: DollarSign, color: AMBER },
                  ].map(({ type, label, desc, icon: Icon, color }) => (
                    <div key={type} className={`${CARD} p-4 flex items-center gap-4`}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}22` }}>
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!smtpEmail) { toast.error('Proporciona un correo de destino.'); return; }
                          setSmtpSending(type);
                          try {
                            await financeApi.enviarReportePdf(type, smtpEmail);
                            toast.success(`Reporte ${type} enviado a ${smtpEmail}`);
                          } catch (e: any) {
                            toast.error(e.response?.data?.message || 'Error SMTP al enviar el reporte.');
                          } finally { setSmtpSending(''); }
                        }}
                        disabled={!!smtpSending}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex-shrink-0"
                        style={{ background: `${color}22`, color }}>
                        <Send className={`w-4 h-4 ${smtpSending === type ? 'animate-ping' : ''}`} />
                        Enviar
                      </button>
                    </div>
                  ))}
                </div>

                {/* Info note */}
                <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Sobre el Servidor de Correo</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 leading-relaxed">
                        El sistema SMTP de PARADISO permite enviar reportes PDF como adjuntos automáticos.
                        Configure las credenciales del servidor (Gmail, Outlook o SMTP personalizado) para
                        habilitar el envío automático y programado de reportes ejecutivos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};
