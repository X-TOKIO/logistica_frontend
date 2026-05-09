import { toast } from 'sonner';
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, AreaChart, Area, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  Package, DollarSign, Truck, Mail, Download, Printer,
  AlertTriangle, Bell, Calendar, TrendingUp, TrendingDown,
  Send, FileText, Server, Settings, Wifi, MapPin,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { financeApi } from '../../services/finance';
import { inventoryApi } from '../../services/inventory';
import { logisticsApi } from '../../services/logistics';
import { logisticsCatalogApi } from '../../services/logistics-catalog';
import { PARADISO_LOCATIONS } from '../../constants/paradiso-locations';

// ─── Palette ──────────────────────────────────────────────────────────────────
const TEAL   = '#14B8A6';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';
const GREEN  = '#10B981';
const BLUE   = '#3B82F6';
const PURPLE = '#8B5CF6';

const MERMA_COLORS: Record<string, string> = {
  ROTURA: RED, VENCIMIENTO: AMBER, MAL_ESTADO: PURPLE, OTRO: '#6B7280',
};

const CARD = [
  'bg-white dark:bg-gray-800/50',
  'border border-gray-200 dark:border-white/[0.07]',
  'rounded-2xl',
].join(' ');

const INPUT = [
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
const DEMO_AREA = [
  { name: 'Ene', Ingresos: 42000, Egresos: 18000 },
  { name: 'Feb', Ingresos: 35000, Egresos: 22000 },
  { name: 'Mar', Ingresos: 58000, Egresos: 31000 },
  { name: 'Abr', Ingresos: 47000, Egresos: 28000 },
  { name: 'May', Ingresos: 63000, Egresos: 35000 },
  { name: 'Jun', Ingresos: 55000, Egresos: 30000 },
];
const DEMO_ALERTAS = [
  { nombre: 'Paceña S.A.',       Fecha_Vencimiento: '2025-06-10', Monto: 12500 },
  { nombre: 'Cordillera Import.', Fecha_Vencimiento: '2025-06-18', Monto: 8300  },
  { nombre: 'PARADISO Dist.',     Fecha_Vencimiento: '2025-07-01', Monto: 25000 },
  { nombre: 'Taquiña Ltda.',      Fecha_Vencimiento: '2025-07-08', Monto: 5600  },
  { nombre: 'Huari Bolivia',      Fecha_Vencimiento: '2025-07-15', Monto: 9200  },
];
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
  const [alertas,     setAlertas]     = useState<any[]>([]);
  const [historial,   setHistorial]   = useState<any[]>([]);
  const [compras,     setCompras]     = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [genPdf,      setGenPdf]      = useState<string | null>(null);
  const [selProv,     setSelProv]     = useState('all');
  const [selMonth,    setSelMonth]    = useState('all');
  const [email,       setEmail]       = useState('');
  const [smtpHost,    setSmtpHost]    = useState('');
  const [smtpPort,    setSmtpPort]    = useState('587');
  const [smtpUser,    setSmtpUser]    = useState('');
  const [smtpPass,    setSmtpPass]    = useState('');
  const [smtpTls,     setSmtpTls]     = useState(true);
  const [sending,     setSending]     = useState('');

  useEffect(() => {
    Promise.allSettled([
      financeApi.getEstadisticas(),
      inventoryApi.getMermas(),
      financeApi.getAlertasCxP(),
      logisticsApi.getHistorial(),
      financeApi.getCompras(),
      logisticsCatalogApi.getProveedores(),
    ]).then(([sR, mR, aR, hR, cR, pR]) => {
      if (sR.status === 'fulfilled') setStats(sR.value);
      if (mR.status === 'fulfilled') setMermas(mR.value || []);
      if (aR.status === 'fulfilled') setAlertas(aR.value || []);
      if (hR.status === 'fulfilled') setHistorial(hR.value || []);
      if (cR.status === 'fulfilled') setCompras(cR.value || []);
      if (pR.status === 'fulfilled') setProveedores(pR.value || []);
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

  const months = useMemo(() => {
    const s = new Set(compras.map((c: any) => (c.Fecha_Emision || '').slice(0, 7)).filter(Boolean));
    return [...s].sort();
  }, [compras]);

  const areaData = useMemo(() => {
    let fc = compras;
    if (selProv !== 'all')
      fc = fc.filter((c: any) => String(c.ID_Proveedor) === selProv || c.proveedor?.Nombre === selProv);
    const byM: Record<string, { Ingresos: number; Egresos: number }> = {};
    fc.forEach((c: any) => {
      const m = (c.Fecha_Emision || c.createdAt || '').slice(0, 7);
      if (!m) return;
      byM[m] ??= { Ingresos: 0, Egresos: 0 };
      byM[m].Ingresos += Number(c.Total || c.Monto_Total || 0);
      byM[m].Egresos  += Number(c.Total_Pagado || c.Monto_Pagado || 0);
    });
    let entries = Object.entries(byM)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, v]) => ({ name: name.slice(5), ...v }));
    if (!entries.length) entries = DEMO_AREA;
    if (selMonth !== 'all') entries = entries.filter(e => e.name.includes(selMonth.slice(5)));
    return entries;
  }, [compras, selProv, selMonth]);

  const alertList = alertas.length ? alertas : DEMO_ALERTAS;

  const radarData = useMemo(() => {
    const total  = historial.length || 20;
    const done   = historial.filter((h: any) => h.Estado === 'COMPLETADO' || h.progreso === 100).length || 14;
    const cancel = historial.filter((h: any) => h.Estado === 'CANCELADO').length || 2;
    return [
      { subject: 'T.Entrega',    A: 78 },
      { subject: 'Combustible',  A: 65 },
      { subject: 'Cumplimiento', A: Math.round((done / total) * 100) },
      { subject: 'Vehículos',    A: 82 },
      { subject: 'Puntualidad',  A: Math.round(((total - cancel) / total) * 100) },
    ];
  }, [historial]);

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

  const pdfInventario = async () => {
    setGenPdf('inventario');
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      addHeader(doc, 'REPORTE DE INVENTARIO — Stock y Mermas');
      let y = 44;
      doc.setTextColor(30,30,30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('STOCK POR CATEGORÍA', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Categoría', 'Capital (Bs.)', 'Almacén', 'Proveedor']],
        body: stockData.map((s: any) => [s.name, Number(s.value).toLocaleString(), s.almacen, s.proveedor]),
        theme: 'grid',
        headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? 80) + 9;
      if (y > 240) { doc.addPage(); addHeader(doc, 'REPORTE DE INVENTARIO'); y = 44; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('REGISTRO DE MERMAS', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Motivo', 'Monto (Bs.)']],
        body: mermasDonut.map(m => [m.name, m.value.toLocaleString()]),
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
      });
      addFooter(doc);
      doc.save(`PARADISO_Inventario_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success('PDF de Inventario descargado.');
    } catch { toast.error('Error al generar PDF.'); }
    finally { setGenPdf(null); }
  };

  const pdfFinanzas = async () => {
    setGenPdf('finanzas');
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      addHeader(doc, 'REPORTE FINANCIERO — Ingresos, Egresos y Vencimientos');
      let y = 44;
      doc.setTextColor(30,30,30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('INGRESOS VS EGRESOS (MENSUAL)', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Período', 'Ingresos (Bs.)', 'Egresos (Bs.)', 'Diferencia (Bs.)']],
        body: areaData.map((r: any) => [
          r.name, Number(r.Ingresos).toLocaleString(), Number(r.Egresos).toLocaleString(),
          (Number(r.Ingresos) - Number(r.Egresos)).toLocaleString(),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, columnStyles: { 3: { fontStyle: 'bold' } },
        margin: { left: 11, right: 11 },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? 80) + 9;
      if (y > 240) { doc.addPage(); addHeader(doc, 'REPORTE FINANCIERO'); y = 44; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('PRÓXIMAS CUOTAS A VENCER', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Proveedor', 'Vencimiento', 'Monto (Bs.)']],
        body: alertList.slice(0, 15).map((a: any) => [
          a.nombre || a.Nombre || '—', a.Fecha_Vencimiento || '—',
          Number(a.Monto || 0).toLocaleString(),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, columnStyles: { 2: { halign: 'right' } },
        margin: { left: 11, right: 11 },
      });
      addFooter(doc);
      doc.save(`PARADISO_Finanzas_${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success('PDF de Finanzas descargado.');
    } catch { toast.error('Error al generar PDF.'); }
    finally { setGenPdf(null); }
  };

  const pdfLogistica = async () => {
    setGenPdf('logistica');
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      addHeader(doc, 'REPORTE LOGÍSTICO — Despachos y Eficiencia');
      let y = 44;
      doc.setTextColor(30,30,30); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('DESPACHOS POR SUCURSAL', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Sucursal', 'Despachos']],
        body: despachosPorSucursal.map(d => [d.name, String(d.Despachos)]),
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? 80) + 9;
      if (y > 240) { doc.addPage(); addHeader(doc, 'REPORTE LOGÍSTICO'); y = 44; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('INDICADORES DE EFICIENCIA', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Indicador', 'Puntuación']],
        body: radarData.map(r => [r.subject, `${r.A}%`]),
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
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
      doc.text('INGRESOS VS EGRESOS', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Período', 'Ingresos (Bs.)', 'Egresos (Bs.)']],
        body: areaData.map((r: any) => [r.name, Number(r.Ingresos).toLocaleString(), Number(r.Egresos).toLocaleString()]),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? 100) + 8;
      if (y > 230) { doc.addPage(); addHeader(doc, 'REPORTE EJECUTIVO CONSOLIDADO'); y = 44; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('PRÓXIMAS CUOTAS', 11, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [['Proveedor', 'Vencimiento', 'Monto (Bs.)']],
        body: alertList.slice(0, 10).map((a: any) => [
          a.nombre || '—', a.Fecha_Vencimiento || '—', Number(a.Monto || 0).toLocaleString(),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8 }, margin: { left: 11, right: 11 },
      });
      y = ((doc as any).lastAutoTable?.finalY ?? 140) + 8;
      if (y > 230) { doc.addPage(); addHeader(doc, 'REPORTE EJECUTIVO CONSOLIDADO'); y = 44; }
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

  const sendPdf = async (type: string) => {
    if (!email) return toast.error('Proporciona un correo de destino.');
    setSending(type);
    try {
      await financeApi.enviarReportePdf(type, email);
      toast.success(`Reporte ${type} enviado a ${email}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Error SMTP al enviar el reporte.');
    } finally { setSending(''); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="w-9 h-9 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      <p className="text-sm text-gray-400">Cargando datos...</p>
    </div>
  );

  const totalIngresos = areaData.reduce((s: number, d: any) => s + (Number(d.Ingresos) || 0), 0);
  const totalEgresos  = areaData.reduce((s: number, d: any) => s + (Number(d.Egresos)  || 0), 0);

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

  // ─── SELECT ───────────────────────────────────────────────────────────────
  const SELECT = [
    'text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    'border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 outline-none cursor-pointer',
  ].join(' ');

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
            className="flex flex-col gap-4"
          >
            {/* Tab header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Inventario & Stock</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Capital inmovilizado, stock crítico y mermas</p>
              </div>
              <button onClick={pdfInventario} disabled={!!genPdf}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium transition-colors disabled:opacity-60">
                <Printer className="w-4 h-4" />
                {genPdf === 'inventario' ? 'Generando...' : 'Descargar PDF'}
              </button>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

              {/* Stock bar chart */}
              <div className={`${CARD} p-5 xl:col-span-2`}>
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Stock por Categoría</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Valor estimado en Bolivianos (Bs.)</p>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stockData} layout="vertical" margin={{ left: 4, right: 24, top: 0, bottom: 0 }}>
                    <XAxis type="number" axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fill: tick }}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: tick }} width={90} />
                    <Tooltip {...tipStyle} formatter={v => [`Bs. ${toNumericTooltipValue(v).toLocaleString()}`, 'Capital']} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={20}>
                      {stockData.map((_: any, i: number) => (
                        <Cell key={i} fill={i % 2 === 0 ? TEAL : AMBER} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Mermas donut */}
              <div className={`${CARD} p-5 flex flex-col`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Mermas del Período</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Distribución por motivo</p>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 text-center">
                  <p className="text-xs text-red-400 font-medium mb-1">Pérdida Total</p>
                  <p className="text-2xl font-bold text-red-500 dark:text-red-400 tabular-nums">
                    Bs. {totalMermas.toLocaleString()}
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={mermasDonut} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={4}>
                      {mermasDonut.map(entry => (
                        <Cell key={entry.name} fill={MERMA_COLORS[entry.name] ?? '#6B7280'} />
                      ))}
                    </Pie>
                    <Tooltip {...tipStyle} formatter={v => [`Bs. ${toNumericTooltipValue(v).toLocaleString()}`, '']} />
                    <Legend iconType="circle" iconSize={7}
                      formatter={v => <span style={{ fontSize: 11, color: tick }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Mermas table */}
            {mermas.length > 0 && (
              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Últimas Mermas Registradas</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-white/[0.07]">
                        {['Motivo','Cantidad','Costo (Bs.)','Fecha'].map(h => (
                          <th key={h} className="text-left text-xs text-gray-500 dark:text-gray-400 font-medium pb-3 pr-6">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mermas.slice(0, 8).map((m: any, i: number) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 pr-6">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ background: `${MERMA_COLORS[m.Motivo] ?? '#6B7280'}22`, color: MERMA_COLORS[m.Motivo] ?? '#6B7280' }}>
                              {m.Motivo || 'OTRO'}
                            </span>
                          </td>
                          <td className="py-3 pr-6 text-gray-700 dark:text-gray-300">{m.Cantidad_Merma || '—'}</td>
                          <td className="py-3 pr-6 text-gray-700 dark:text-gray-300 tabular-nums">{Number(m.Costo_Merma || 0).toLocaleString()}</td>
                          <td className="py-3 text-gray-400 text-xs">{(m.Fecha_Merma || m.createdAt || '').slice(0, 10) || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ══ FINANZAS ════════════════════════════════════════════════════════ */}
        {activeTab === 'finanzas' && (
          <motion.div key="fin"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Finanzas & Pagos</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Ingresos vs. egresos y alertas de vencimientos</p>
              </div>
              <button onClick={pdfFinanzas} disabled={!!genPdf}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium transition-colors disabled:opacity-60">
                <Printer className="w-4 h-4" />
                {genPdf === 'finanzas' ? 'Generando...' : 'Descargar PDF'}
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

              {/* Area chart */}
              <div className={`${CARD} p-5 xl:col-span-2`}>
                <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Ingresos vs. Egresos</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Evolución mensual</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <select value={selProv} onChange={e => setSelProv(e.target.value)} className={SELECT}>
                      <option value="all">Todos los Proveedores</option>
                      {proveedores.map((p: any) => (
                        <option key={p.ID_Proveedor ?? p.id} value={String(p.ID_Proveedor ?? p.id)}>
                          {p.Nombre ?? p.nombre}
                        </option>
                      ))}
                    </select>
                    <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className={SELECT}>
                      <option value="all">Todos los Meses</option>
                      {months.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={areaData} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gIng" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={GREEN} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gEgr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={AMBER} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={AMBER} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: tick }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip {...tipStyle} formatter={(v, n) => [`Bs. ${toNumericTooltipValue(v).toLocaleString()}`, String(n ?? '')]} />
                    <Area type="monotone" dataKey="Ingresos" stroke={GREEN} strokeWidth={2}
                      fill="url(#gIng)" dot={false} activeDot={{ r: 4, fill: GREEN }} />
                    <Area type="monotone" dataKey="Egresos"  stroke={AMBER} strokeWidth={2}
                      fill="url(#gEgr)" dot={false} activeDot={{ r: 4, fill: AMBER }} />
                    <Legend iconType="circle" iconSize={7}
                      formatter={v => <span style={{ fontSize: 11, color: v === 'Ingresos' ? GREEN : AMBER }}>{v}</span>} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Period summary */}
              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Resumen del Período</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Totales acumulados</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-4 tabular-nums">
                  Bs. {totalIngresos.toLocaleString()}
                </p>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={areaData.slice(-6)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} />
                    <Tooltip {...tipStyle} formatter={v => [`Bs. ${toNumericTooltipValue(v).toLocaleString()}`, 'Ingresos']} />
                    <Bar dataKey="Ingresos" fill={TEAL} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/[0.07] grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Ingresos</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400 mt-0.5 tabular-nums">
                      Bs. {totalIngresos.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Egresos</p>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
                      Bs. {totalEgresos.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Vencimientos table */}
            <div className={`${CARD} p-5`}>
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Próximos Vencimientos</h4>
                <span className="ml-auto text-xs text-gray-400">{alertList.length} cuotas</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/[0.07]">
                      {['Proveedor / Cuenta','Vencimiento','Días','Monto (Bs.)','Estado'].map(h => (
                        <th key={h} className="text-left text-xs text-gray-500 dark:text-gray-400 font-medium pb-3 pr-5 last:pr-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {alertList.slice(0, 10).map((a: any, i: number) => {
                      const fecha  = a.Fecha_Vencimiento ?? a.fecha ?? '—';
                      const monto  = Number(a.Monto ?? a.monto ?? 0);
                      const nombre = a.nombre ?? a.Nombre ?? a.proveedor ?? '—';
                      const days   = Math.round((new Date(fecha).getTime() - Date.now()) / 86_400_000);
                      const past   = days < 0;
                      const urgent = !past && days <= 7;
                      return (
                        <tr key={i} className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 pr-5 text-gray-800 dark:text-gray-200 font-medium">{nombre}</td>
                          <td className="py-3 pr-5 text-gray-500 dark:text-gray-400 text-xs">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fecha}</span>
                          </td>
                          <td className="py-3 pr-5">
                            <span className={`text-xs font-medium ${past ? 'text-red-500' : urgent ? 'text-amber-500' : 'text-gray-400'}`}>
                              {past ? `+${Math.abs(days)}d vencida` : `${days}d`}
                            </span>
                          </td>
                          <td className="py-3 pr-5 text-gray-800 dark:text-gray-200 tabular-nums font-medium">
                            {monto.toLocaleString()}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              past   ? 'bg-red-500/20 text-red-500 dark:text-red-400' :
                              urgent ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                       'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            }`}>
                              {past ? 'Vencida' : urgent ? 'Urgente' : 'Pendiente'}
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

        {/* ══ LOGÍSTICA ═══════════════════════════════════════════════════════ */}
        {activeTab === 'logistica' && (
          <motion.div key="log"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.22 }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Logística & Rutas</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Despachos por sucursal y eficiencia operativa</p>
              </div>
              <button onClick={pdfLogistica} disabled={!!genPdf}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium transition-colors disabled:opacity-60">
                <Printer className="w-4 h-4" />
                {genPdf === 'logistica' ? 'Generando...' : 'Descargar PDF'}
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

              {/* Despachos bar chart */}
              <div className={`${CARD} p-5 xl:col-span-2`}>
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Despachos por Sucursal</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Nodos con mayor actividad logística</p>
                </div>
                <ResponsiveContainer width="100%" height={260}>
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

              {/* Efficiency radar + progress bars */}
              <div className={`${CARD} p-5`}>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Eficiencia Operativa</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Indicadores de flota y entregas</p>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
                    <PolarGrid stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'} />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: tick }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8, fill: tick }} tickCount={4} />
                    <Radar name="Eficiencia" dataKey="A" stroke={TEAL} fill={TEAL} fillOpacity={0.2} strokeWidth={2} />
                    <Tooltip {...tipStyle} formatter={v => [`${toNumericTooltipValue(v)}%`, 'Eficiencia']} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-2.5">
                  {radarData.map(r => (
                    <div key={r.subject} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-20 flex-shrink-0">{r.subject}</span>
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-teal-500 transition-all duration-700"
                          style={{ width: `${r.A}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-8 text-right">{r.A}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sucursales node cards */}
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Host SMTP</label>
                      <input value={smtpHost} onChange={e => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com" className={INPUT} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Puerto</label>
                      <input value={smtpPort} onChange={e => setSmtpPort(e.target.value)}
                        placeholder="587" className={INPUT} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Usuario / Email</label>
                    <input value={smtpUser} onChange={e => setSmtpUser(e.target.value)}
                      placeholder="correo@empresa.com" className={INPUT} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Contraseña / Token de App</label>
                    <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)}
                      placeholder="••••••••••••" className={INPUT} />
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

                  <button onClick={() => toast.info('Implementación de servidor SMTP próximamente.')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-600 dark:text-teal-400 text-sm font-medium transition-colors">
                    <Wifi className="w-4 h-4" />
                    Probar Conexión
                  </button>
                  <button onClick={() => toast.info('Configuración guardada (implementación próximamente).')}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors">
                    <Settings className="w-4 h-4" />
                    Guardar Configuración
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
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="gerencia@paradiso.com" className={INPUT} />
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
                      <button onClick={() => sendPdf(type)} disabled={!!sending}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex-shrink-0"
                        style={{ background: `${color}22`, color }}>
                        <Send className={`w-4 h-4 ${sending === type ? 'animate-ping' : ''}`} />
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
