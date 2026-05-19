import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, AreaChart, Area, CartesianGrid,
} from 'recharts';
import {
  Package, AlertTriangle, ArrowDownCircle, ArrowUpCircle,
  Download, Mail, Calendar, TrendingUp, TrendingDown,
  Filter, BarChart2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { inventoryApi } from '../../services/inventory';
import { warehouseApi } from '../../services/warehouse';
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

const MERMA_COLORS: Record<string, string> = {
  ROTURA: RED, VENCIMIENTO: AMBER, MAL_ESTADO: PURPLE, OTRO: '#6B7280',
};

const CHART_COLORS = [TEAL, AMBER, BLUE, GREEN, PURPLE, ORANGE, RED, '#EC4899', '#06B6D4', '#84CC16'];

const CARD = [
  'bg-white dark:bg-gray-800/50',
  'border border-gray-200 dark:border-white/[0.07]',
  'rounded-2xl',
].join(' ');

const SELECT = [
  'text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  'border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 outline-none cursor-pointer',
].join(' ');

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

const tipStyle = {
  contentStyle: {
    background: '#1F2937', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  labelStyle:  { color: '#F9FAFB', fontWeight: 600 },
  itemStyle:   { color: '#9CA3AF' },
};

const fmtBs = (v: number) => `Bs. ${v.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fmtN  = (v: number | string | ReadonlyArray<number | string> | undefined) => Number(Array.isArray(v) ? v[0] : v ?? 0);

const labelPeriod = (p: string) => ({ dia: 'Día', mes: 'Mes', anio: 'Año' }[p] ?? '');

function filterByPeriod(fecha: string, period: string, value: string): boolean {
  if (!fecha || !value) return true;
  const d = (fecha || '').slice(0, 10);
  if (period === 'dia')  return d === value;
  if (period === 'mes')  return d.slice(0, 7) === value;
  if (period === 'anio') return d.slice(0, 4) === value;
  return true;
}

// ─── PDF header/footer ────────────────────────────────────────────────────────
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiProps {
  label: string; value: string; sub: string;
  icon: React.ElementType; color: string; up?: boolean; trend?: string;
}
function KpiCard({ label, value, sub, icon: Icon, color, up, trend }: KpiProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`${CARD} p-4`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-tight max-w-[80%]">{label}</p>
        <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums mb-1">{value}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {trend !== undefined && (
          <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
            up ? 'bg-teal-500/20 text-teal-500' : 'bg-red-500/20 text-red-500'
          }`}>
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend}
          </span>
        )}
        <p className="text-xs text-gray-400 truncate">{sub}</p>
      </div>
    </motion.div>
  );
}

// ─── Action buttons (PDF + Email) ─────────────────────────────────────────────
interface ActionBarProps {
  onPdf: () => void; onEmail: () => void;
  pdfLoading: boolean; emailLoading: boolean;
}
function ActionBar({ onPdf, onEmail, pdfLoading, emailLoading }: ActionBarProps) {
  return (
    <div className="flex gap-2 flex-shrink-0">
      <button
        onClick={onPdf}
        disabled={pdfLoading}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium transition-colors disabled:opacity-60"
      >
        <Download className="w-4 h-4" />
        {pdfLoading ? 'Generando…' : 'PDF'}
      </button>
      <button
        onClick={onEmail}
        disabled={emailLoading}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-sm font-medium transition-colors disabled:opacity-60"
      >
        <Mail className="w-4 h-4" />
        {emailLoading ? 'Enviando…' : 'Correo'}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-TAB: STOCK
// ══════════════════════════════════════════════════════════════════════════════
function StockTab() {
  const isDark = useIsDark();
  const tick   = isDark ? '#9CA3AF' : '#4B5563';
  const grid   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const [stock,       setStock]       = useState<any[]>([]);
  const [almacenes,   setAlmacenes]   = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selAlm,      setSelAlm]      = useState('all');
  const [selCat,      setSelCat]      = useState('all');
  const [pdfLoad,     setPdfLoad]     = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      inventoryApi.getStockReport(),
      warehouseApi.getAlmacenes(),
    ]).then(([sR, aR]) => {
      if (sR.status === 'fulfilled') setStock(sR.value || []);
      if (aR.status === 'fulfilled') setAlmacenes(aR.value || []);
    }).finally(() => setLoading(false));
  }, []);

  const categorias = useMemo(() => [...new Set(stock.map((s: any) => s.producto.categoria).filter(Boolean))], [stock]);

  const filtered = useMemo(() => {
    let f = stock;
    if (selAlm !== 'all') f = f.filter((s: any) => String(s.ID_Almacen) === selAlm);
    if (selCat !== 'all') f = f.filter((s: any) => s.producto.categoria === selCat);
    return f;
  }, [stock, selAlm, selCat]);

  const topProductos = useMemo(() =>
    [...filtered]
      .sort((a, b) => b.Stock_Actual - a.Stock_Actual)
      .slice(0, 10)
      .map((s: any) => ({ name: s.producto.Nombre.slice(0, 18), stock: s.Stock_Actual, valor: s.valorTotal })),
    [filtered]
  );

  const porAlmacen = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((s: any) => {
      const n = s.almacen.Nombre.replace('PARADISO — ', '');
      m[n] = (m[n] || 0) + s.Stock_Actual;
    });
    return Object.entries(m).map(([name, stock]) => ({ name, stock })).sort((a, b) => b.stock - a.stock);
  }, [filtered]);

  const porCategoria = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((s: any) => {
      const c = s.producto.categoria || 'Sin categoría';
      m[c] = (m[c] || 0) + s.valorTotal;
    });
    return Object.entries(m).map(([name, valor]) => ({ name, valor: +valor.toFixed(2) }));
  }, [filtered]);

  const totalStock   = useMemo(() => filtered.reduce((s, r: any) => s + r.Stock_Actual, 0), [filtered]);
  const totalValor   = useMemo(() => filtered.reduce((s, r: any) => s + r.valorTotal, 0), [filtered]);
  const numProductos = useMemo(() => new Set(filtered.map((r: any) => r.ID_Producto)).size, [filtered]);
  const numAlmacenes = useMemo(() => new Set(filtered.map((r: any) => r.ID_Almacen)).size, [filtered]);

  const buildPdfDoc = () => {
    const almNombre = selAlm === 'all'
      ? 'Todos los Almacenes'
      : (almacenes.find((a: any) => String(a.ID_Almacen) === selAlm)?.Nombre || selAlm).replace('PARADISO — ', '');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    addPdfHeader(doc, `REPORTE DE STOCK — Almacén: ${almNombre} | Categoría: ${selCat === 'all' ? 'Todas' : selCat}`);
    let y = 44;
    doc.setTextColor(30, 30, 30); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(`Productos: ${numProductos}   Almacenes: ${numAlmacenes}   Total Unidades: ${totalStock.toLocaleString()}   Capital: ${fmtBs(totalValor)}`, 11, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Producto', 'Categoría', 'Almacén', 'Stock', 'Precio Unit.', 'Valor (Bs.)']],
      body: filtered.map((s: any) => [
        s.producto.Nombre, s.producto.categoria, s.almacen.Nombre.replace('PARADISO — ', ''),
        s.Stock_Actual.toLocaleString(),
        fmtBs(s.producto.PrecioUnitario),
        fmtBs(s.valorTotal),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [20, 184, 166], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 }, margin: { left: 11, right: 11 },
    });
    addPdfFooter(doc);
    return doc;
  };

  const handlePdf = async () => {
    setPdfLoad(true);
    try {
      buildPdfDoc().save(`PARADISO_Stock_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF de Stock descargado.');
    } catch { toast.error('Error al generar PDF.'); }
    finally { setPdfLoad(false); }
  };

  const handleSendEmail = async (emailAddr: string, msg?: string) => {
    setEmailSending(true);
    try {
      const doc   = buildPdfDoc();
      const today = new Date().toISOString().slice(0, 10);
      await financeApi.enviarPdfDirecto({
        email:   emailAddr,
        pdfBase64: doc.output('base64'),
        filename:  `PARADISO_Stock_${today}.pdf`,
        asunto:    'Reporte de Stock Actual - PARADISO',
        mensajePersonalizado: msg,
        reportType: 'INVENTARIO',
      });
      toast.success(`Reporte de Stock enviado a ${emailAddr}`);
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al enviar correo.');
    } finally { setEmailSending(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <EmailReportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        reportTitle="Stock Actual por Producto"
        reportSubtitle="Inventario · PARADISO"
        pdfInfoText="Se generará un PDF con los filtros activos aplicados"
        pdfInfoSub="Incluye tabla de stock por producto y almacén"
        filters={[
          { label: 'Almacén',   value: selAlm === 'all' ? 'Todos' : (almacenes.find((a: any) => String(a.ID_Almacen) === selAlm)?.Nombre || selAlm).replace('PARADISO — ', '') },
          { label: 'Categoría', value: selCat === 'all' ? 'Todas' : selCat },
        ]}
        onSend={(email, msg) => handleSendEmail(email, msg)}
        sending={emailSending}
      />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Stock Actual por Producto</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">Capital inmovilizado y distribución por almacén</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select value={selAlm} onChange={e => setSelAlm(e.target.value)} className={SELECT}>
            <option value="all">Todos los Almacenes</option>
            {almacenes.map((a: any) => (
              <option key={a.ID_Almacen} value={String(a.ID_Almacen)}>{a.Nombre.replace('PARADISO — ', '')}</option>
            ))}
          </select>
          <select value={selCat} onChange={e => setSelCat(e.target.value)} className={SELECT}>
            <option value="all">Todas las Categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ActionBar onPdf={handlePdf} onEmail={() => setModalOpen(true)} pdfLoading={pdfLoad} emailLoading={emailSending} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Productos en Stock" value={String(numProductos)} sub="Referencias únicas" icon={Package} color={TEAL} />
        <KpiCard label="Almacenes Activos" value={String(numAlmacenes)} sub="Con stock disponible" icon={BarChart2} color={BLUE} />
        <KpiCard label="Total Unidades" value={totalStock.toLocaleString()} sub="Cantidad acumulada" icon={ArrowDownCircle} color={GREEN} up />
        <KpiCard label="Capital Inmovilizado" value={fmtBs(totalValor)} sub="Stock × Precio unitario" icon={TrendingUp} color={AMBER} up />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Top 10 productos */}
        <div className={`${CARD} p-5 xl:col-span-2`}>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Top 10 Productos por Stock</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Unidades disponibles</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topProductos} layout="vertical" margin={{ left: 4, right: 24, top: 0, bottom: 0 }}>
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} width={120} />
              <Tooltip {...tipStyle} formatter={(v, n) => [n === 'stock' ? Number(v).toLocaleString() : fmtBs(fmtN(v)), n === 'stock' ? 'Unidades' : 'Valor']} />
              <Bar dataKey="stock" radius={[0, 6, 6, 0]} maxBarSize={18}>
                {topProductos.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} opacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Por categoría donut */}
        <div className={`${CARD} p-5 flex flex-col`}>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Capital por Categoría</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Distribución de valor (Bs.)</p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={porCategoria} dataKey="valor" nameKey="name" cx="50%" cy="45%"
                innerRadius={50} outerRadius={80} paddingAngle={3}>
                {porCategoria.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip {...tipStyle} formatter={v => [fmtBs(fmtN(v)), 'Capital']} />
              <Legend iconType="circle" iconSize={7}
                formatter={v => <span style={{ fontSize: 10, color: tick }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2: por almacén */}
      <div className={`${CARD} p-5`}>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Stock Total por Almacén</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Unidades totales en cada nodo</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={porAlmacen} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} allowDecimals={false} />
            <Tooltip {...tipStyle} formatter={v => [Number(v).toLocaleString(), 'Unidades']} />
            <Bar dataKey="stock" fill={TEAL} radius={[6, 6, 0, 0]} maxBarSize={48}>
              {porAlmacen.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla detalle */}
      <div className={`${CARD} p-5`}>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Detalle de Stock ({filtered.length} registros)</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.07]">
                {['Producto', 'Categoría', 'Almacén', 'Stock', 'Precio Unit.', 'Valor Total'].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 dark:text-gray-400 font-medium pb-3 pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 20).map((s: any, i: number) => (
                <tr key={i} className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 pr-5 text-gray-800 dark:text-gray-200 font-medium">{s.producto.Nombre}</td>
                  <td className="py-2.5 pr-5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400">{s.producto.categoria}</span>
                  </td>
                  <td className="py-2.5 pr-5 text-gray-500 dark:text-gray-400 text-xs">{s.almacen.Nombre.replace('PARADISO — ', '')}</td>
                  <td className="py-2.5 pr-5 font-bold text-gray-900 dark:text-white tabular-nums">{s.Stock_Actual.toLocaleString()}</td>
                  <td className="py-2.5 pr-5 text-gray-600 dark:text-gray-300 tabular-nums text-xs">{fmtBs(s.producto.PrecioUnitario)}</td>
                  <td className="py-2.5 text-green-600 dark:text-green-400 tabular-nums font-semibold text-xs">{fmtBs(s.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 20 && (
            <p className="text-xs text-gray-400 mt-3 text-center">Mostrando 20 de {filtered.length} — descarga el PDF para ver todos</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-TAB: MERMAS
// ══════════════════════════════════════════════════════════════════════════════
function MermasTab() {
  const isDark = useIsDark();
  const tick   = isDark ? '#9CA3AF' : '#4B5563';
  const grid   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const [mermas,      setMermas]      = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [period,      setPeriod]      = useState<'dia' | 'mes' | 'anio'>('mes');
  const [selValue,    setSelValue]    = useState('');
  const [selMotivo,   setSelMotivo]   = useState('all');
  const [pdfLoad,     setPdfLoad]     = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    inventoryApi.getMermas()
      .then(d => setMermas(d || []))
      .finally(() => setLoading(false));
  }, []);

  // Flatten: cada detalle se convierte en una fila con fecha y motivo del padre
  const rows = useMemo(() => {
    const out: any[] = [];
    mermas.forEach((m: any) => {
      (m.detalles || []).forEach((d: any) => {
        out.push({
          fecha:    (m.Fecha || '').slice(0, 10),
          motivo:   m.MotivoPerdida || 'OTRO',
          producto: d.producto?.Nombre || '—',
          cantidad: Number(d.Cantidad || 0),
          costo:    Number(d.Cantidad || 0) * Number(d.producto?.PrecioUnitario || 0),
          empleado: m.empleado?.usuario?.username || '—',
        });
      });
    });
    return out;
  }, [mermas]);

  const periodValues = useMemo(() => {
    const s = new Set(rows.map(r => {
      if (period === 'dia')  return r.fecha;
      if (period === 'mes')  return r.fecha.slice(0, 7);
      return r.fecha.slice(0, 4);
    }).filter(Boolean));
    return [...s].sort().reverse();
  }, [rows, period]);

  const filtered = useMemo(() => {
    let f = rows;
    if (selValue) f = f.filter(r => filterByPeriod(r.fecha, period, selValue));
    if (selMotivo !== 'all') f = f.filter(r => r.motivo === selMotivo);
    return f;
  }, [rows, period, selValue, selMotivo]);

  const totalPerdida = useMemo(() => filtered.reduce((s, r) => s + r.costo, 0), [filtered]);
  const totalItems   = useMemo(() => filtered.reduce((s, r) => s + r.cantidad, 0), [filtered]);
  const topMotivo    = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => { m[r.motivo] = (m[r.motivo] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  }, [filtered]);
  const topProducto = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => { m[r.producto] = (m[r.producto] || 0) + r.cantidad; });
    return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  }, [filtered]);

  const porMotivo = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => { m[r.motivo] = (m[r.motivo] || 0) + r.costo; });
    return Object.entries(m).map(([name, value]) => ({ name, value: +value.toFixed(2) }));
  }, [filtered]);

  const porProducto = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => { m[r.producto] = (m[r.producto] || 0) + r.cantidad; });
    return Object.entries(m)
      .map(([name, cant]) => ({ name: name.slice(0, 16), cant }))
      .sort((a, b) => b.cant - a.cant).slice(0, 8);
  }, [filtered]);

  const evolucion = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => {
      const k = period === 'dia' ? r.fecha : period === 'mes' ? r.fecha.slice(0, 7) : r.fecha.slice(0, 4);
      m[k] = (m[k] || 0) + r.costo;
    });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b))
      .map(([name, perdida]) => ({ name: name.slice(-5), perdida: +perdida.toFixed(2) }));
  }, [filtered, period]);

  const buildPdfDoc = () => {
    const periodoDesc = selValue ? `${labelPeriod(period)}: ${selValue}` : 'Todos los períodos';
    const motivoDesc  = selMotivo === 'all' ? 'Todos los motivos' : selMotivo;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    addPdfHeader(doc, `REPORTE DE MERMAS — Período: ${periodoDesc} | Motivo: ${motivoDesc}`);
    let y = 44;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
    doc.text(`Registros: ${filtered.length}   Pérdida Total: ${fmtBs(totalPerdida)}   Motivo Principal: ${topMotivo}`, 11, y); y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Motivo', 'Producto', 'Cantidad', 'Pérdida (Bs.)', 'Operador']],
      body: filtered.map(r => [r.fecha, r.motivo, r.producto, r.cantidad.toLocaleString(), fmtBs(r.costo), r.empleado]),
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 }, margin: { left: 11, right: 11 },
    });
    addPdfFooter(doc);
    return doc;
  };

  const handlePdf = async () => {
    setPdfLoad(true);
    try {
      buildPdfDoc().save(`PARADISO_Mermas_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF de Mermas descargado.');
    } catch { toast.error('Error al generar PDF.'); }
    finally { setPdfLoad(false); }
  };

  const handleSendEmail = async (emailAddr: string, msg?: string) => {
    setEmailSending(true);
    try {
      const doc   = buildPdfDoc();
      const today = new Date().toISOString().slice(0, 10);
      await financeApi.enviarPdfDirecto({
        email:   emailAddr,
        pdfBase64: doc.output('base64'),
        filename:  `PARADISO_Mermas_${today}.pdf`,
        asunto:    'Reporte de Mermas y Pérdidas - PARADISO',
        mensajePersonalizado: msg,
        reportType: 'MERMAS',
      });
      toast.success(`Reporte de Mermas enviado a ${emailAddr}`);
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al enviar correo.');
    } finally { setEmailSending(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <EmailReportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        reportTitle="Reporte de Mermas"
        reportSubtitle="Inventario · PARADISO"
        pdfInfoText="Se generará un PDF con los filtros activos aplicados"
        pdfInfoSub="Incluye pérdidas por motivo, producto y período"
        filters={[
          { label: 'Período', value: selValue ? `${labelPeriod(period)}: ${selValue}` : 'Todos' },
          { label: 'Motivo',  value: selMotivo === 'all' ? 'Todos' : selMotivo },
        ]}
        onSend={(email, msg) => handleSendEmail(email, msg)}
        sending={emailSending}
      />
      {/* Header + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Reporte de Mermas</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">Pérdidas por motivo, producto y período</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select value={period} onChange={e => { setPeriod(e.target.value as any); setSelValue(''); }} className={SELECT}>
            <option value="dia">Por Día</option>
            <option value="mes">Por Mes</option>
            <option value="anio">Por Año</option>
          </select>
          <select value={selValue} onChange={e => setSelValue(e.target.value)} className={SELECT}>
            <option value="">Todos los {labelPeriod(period)}s</option>
            {periodValues.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={selMotivo} onChange={e => setSelMotivo(e.target.value)} className={SELECT}>
            <option value="all">Todos los Motivos</option>
            {['ROTURA', 'VENCIMIENTO', 'MAL_ESTADO', 'OTRO'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <ActionBar onPdf={handlePdf} onEmail={() => setModalOpen(true)} pdfLoading={pdfLoad} emailLoading={emailSending} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Pérdida Total" value={fmtBs(totalPerdida)} sub="Valor acumulado" icon={AlertTriangle} color={RED} />
        <KpiCard label="Unidades Perdidas" value={totalItems.toLocaleString()} sub="Cantidad de ítems" icon={Package} color={ORANGE} />
        <KpiCard label="Motivo Principal" value={topMotivo} sub="Más frecuente" icon={Filter} color={PURPLE} />
        <KpiCard label="Producto más Afectado" value={topProducto.slice(0, 14)} sub="Por cantidad" icon={AlertTriangle} color={AMBER} />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Evolución */}
        <div className={`${CARD} p-5 xl:col-span-2`}>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Evolución de Pérdidas</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Valor en Bolivianos (Bs.)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={evolucion} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gMerma" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={RED} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={RED} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tipStyle} formatter={v => [fmtBs(fmtN(v)), 'Pérdida']} />
              <Area type="monotone" dataKey="perdida" stroke={RED} strokeWidth={2} fill="url(#gMerma)" dot={false} activeDot={{ r: 4, fill: RED }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Por motivo donut */}
        <div className={`${CARD} p-5`}>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Por Motivo</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Distribución de pérdida (Bs.)</p>
          {porMotivo.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={porMotivo} dataKey="value" nameKey="name" cx="50%" cy="45%"
                  innerRadius={48} outerRadius={74} paddingAngle={4}>
                  {porMotivo.map(e => <Cell key={e.name} fill={MERMA_COLORS[e.name] ?? '#6B7280'} />)}
                </Pie>
                <Tooltip {...tipStyle} formatter={v => [fmtBs(fmtN(v)), 'Pérdida']} />
                <Legend iconType="circle" iconSize={7} formatter={v => <span style={{ fontSize: 10, color: tick }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top productos */}
      <div className={`${CARD} p-5`}>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Productos con Más Mermas</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Top 8 por cantidad</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={porProducto} layout="vertical" margin={{ left: 4, right: 24, top: 0, bottom: 0 }}>
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} width={110} />
            <Tooltip {...tipStyle} formatter={v => [Number(v).toLocaleString(), 'Unidades']} />
            <Bar dataKey="cant" radius={[0, 6, 6, 0]} maxBarSize={16}>
              {porProducto.map((_, i) => <Cell key={i} fill={Object.values(MERMA_COLORS)[i % 4]} opacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabla */}
      <div className={`${CARD} p-5`}>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Detalle de Mermas ({filtered.length} registros)</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.07]">
                {['Fecha', 'Motivo', 'Producto', 'Cantidad', 'Pérdida (Bs.)', 'Operador'].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 dark:text-gray-400 font-medium pb-3 pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 15).map((r, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-5 text-xs text-gray-400">{r.fecha}</td>
                  <td className="py-2.5 pr-5">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${MERMA_COLORS[r.motivo] ?? '#6B7280'}22`, color: MERMA_COLORS[r.motivo] ?? '#6B7280' }}>
                      {r.motivo}
                    </span>
                  </td>
                  <td className="py-2.5 pr-5 text-gray-700 dark:text-gray-300">{r.producto}</td>
                  <td className="py-2.5 pr-5 tabular-nums text-gray-700 dark:text-gray-300">{r.cantidad.toLocaleString()}</td>
                  <td className="py-2.5 pr-5 tabular-nums text-red-500 font-semibold text-xs">{fmtBs(r.costo)}</td>
                  <td className="py-2.5 text-gray-400 text-xs">{r.empleado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-TAB: INGRESOS
// ══════════════════════════════════════════════════════════════════════════════
function IngresosTab() {
  const isDark = useIsDark();
  const tick   = isDark ? '#9CA3AF' : '#4B5563';
  const grid   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const [ingresos,    setIngresos]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [period,      setPeriod]      = useState<'dia' | 'mes' | 'anio'>('mes');
  const [selValue,    setSelValue]    = useState('');
  const [pdfLoad,     setPdfLoad]     = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    inventoryApi.getIngresos()
      .then(d => setIngresos(d || []))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const out: any[] = [];
    ingresos.forEach((n: any) => {
      (n.detalles || []).forEach((d: any) => {
        out.push({
          fecha:    (n.Fecha || '').slice(0, 10),
          producto: d.producto?.Nombre || '—',
          cantidad: Number(d.Cantidad || 0),
          precio:   Number(d.producto?.PrecioUnitario || 0),
          valor:    Number(d.Cantidad || 0) * Number(d.producto?.PrecioUnitario || 0),
          almacen:  d.productoAlmacen?.almacen?.Nombre || d.almacen?.Nombre || '—',
          nota:     `INC-${String(n.ID_Ingreso).padStart(5, '0')}`,
          proveedor: n.compra?.proveedor?.Nombre || '—',
        });
      });
    });
    return out;
  }, [ingresos]);

  const periodValues = useMemo(() => {
    const s = new Set(rows.map(r => {
      if (period === 'dia')  return r.fecha;
      if (period === 'mes')  return r.fecha.slice(0, 7);
      return r.fecha.slice(0, 4);
    }).filter(Boolean));
    return [...s].sort().reverse();
  }, [rows, period]);

  const filtered = useMemo(() => {
    if (!selValue) return rows;
    return rows.filter(r => filterByPeriod(r.fecha, period, selValue));
  }, [rows, period, selValue]);

  const totalValor  = useMemo(() => filtered.reduce((s, r) => s + r.valor, 0), [filtered]);
  const totalItems  = useMemo(() => filtered.reduce((s, r) => s + r.cantidad, 0), [filtered]);
  const topProducto = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => { m[r.producto] = (m[r.producto] || 0) + r.cantidad; });
    return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  }, [filtered]);

  const porProducto = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => { m[r.producto] = (m[r.producto] || 0) + r.cantidad; });
    return Object.entries(m).map(([name, cant]) => ({ name: name.slice(0, 16), cant }))
      .sort((a, b) => b.cant - a.cant).slice(0, 8);
  }, [filtered]);

  const evolucion = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => {
      const k = period === 'dia' ? r.fecha : period === 'mes' ? r.fecha.slice(0, 7) : r.fecha.slice(0, 4);
      m[k] = (m[k] || 0) + r.valor;
    });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b))
      .map(([name, valor]) => ({ name: name.slice(-5), valor: +valor.toFixed(2) }));
  }, [filtered, period]);

  const porAlmacen = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => { const n = r.almacen.replace('PARADISO — ', ''); m[n] = (m[n] || 0) + r.cantidad; });
    return Object.entries(m).map(([name, cant]) => ({ name, cant })).sort((a, b) => b.cant - a.cant);
  }, [filtered]);

  const buildPdfDoc = () => {
    const periodoDesc = selValue ? `${labelPeriod(period)}: ${selValue}` : 'Todos los períodos';
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    addPdfHeader(doc, `REPORTE DE INGRESOS — Período: ${periodoDesc}`);
    let y = 44;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
    doc.text(`Registros: ${filtered.length}   Unidades: ${totalItems.toLocaleString()}   Valor Total: ${fmtBs(totalValor)}`, 11, y); y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Nota', 'Fecha', 'Proveedor', 'Producto', 'Almacén Destino', 'Cantidad', 'Valor (Bs.)']],
      body: filtered.map(r => [r.nota, r.fecha, r.proveedor, r.producto, r.almacen.replace('PARADISO — ', ''), r.cantidad.toLocaleString(), fmtBs(r.valor)]),
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 }, margin: { left: 11, right: 11 },
    });
    addPdfFooter(doc);
    return doc;
  };

  const handlePdf = async () => {
    setPdfLoad(true);
    try {
      buildPdfDoc().save(`PARADISO_Ingresos_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF de Ingresos descargado.');
    } catch { toast.error('Error al generar PDF.'); }
    finally { setPdfLoad(false); }
  };

  const handleSendEmail = async (emailAddr: string, msg?: string) => {
    setEmailSending(true);
    try {
      const doc   = buildPdfDoc();
      const today = new Date().toISOString().slice(0, 10);
      await financeApi.enviarPdfDirecto({
        email:   emailAddr,
        pdfBase64: doc.output('base64'),
        filename:  `PARADISO_Ingresos_${today}.pdf`,
        asunto:    'Reporte de Ingresos de Inventario - PARADISO',
        mensajePersonalizado: msg,
        reportType: 'INGRESOS',
      });
      toast.success(`Reporte de Ingresos enviado a ${emailAddr}`);
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al enviar correo.');
    } finally { setEmailSending(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <EmailReportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        reportTitle="Reporte de Ingresos"
        reportSubtitle="Inventario · PARADISO"
        pdfInfoText="Se generará un PDF con los filtros activos aplicados"
        pdfInfoSub="Incluye productos recibidos, proveedor, almacén y valor"
        filters={[
          { label: 'Período', value: selValue ? `${labelPeriod(period)}: ${selValue}` : 'Todos' },
        ]}
        onSend={(email, msg) => handleSendEmail(email, msg)}
        sending={emailSending}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Reporte de Ingresos</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">Productos recibidos, valor y evolución</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <select value={period} onChange={e => { setPeriod(e.target.value as any); setSelValue(''); }} className={SELECT}>
            <option value="dia">Por Día</option>
            <option value="mes">Por Mes</option>
            <option value="anio">Por Año</option>
          </select>
          <select value={selValue} onChange={e => setSelValue(e.target.value)} className={SELECT}>
            <option value="">Todos los {labelPeriod(period)}s</option>
            {periodValues.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <ActionBar onPdf={handlePdf} onEmail={() => setModalOpen(true)} pdfLoading={pdfLoad} emailLoading={emailSending} />
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Valor Total Ingresado" value={fmtBs(totalValor)} sub="Stock × precio" icon={TrendingUp} color={GREEN} up trend="+valor" />
        <KpiCard label="Unidades Ingresadas" value={totalItems.toLocaleString()} sub="Cantidad total" icon={ArrowDownCircle} color={TEAL} up />
        <KpiCard label="Nota de Ingresos" value={String(new Set(filtered.map(r => r.nota)).size)} sub="Recepciones" icon={BarChart2} color={BLUE} />
        <KpiCard label="Producto Líder" value={topProducto.slice(0, 14)} sub="Más ingresado" icon={Package} color={AMBER} up />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={`${CARD} p-5 xl:col-span-2`}>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Valor de Ingresos por Período</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Bolivianos (Bs.)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={evolucion} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gIng2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={GREEN} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tipStyle} formatter={v => [fmtBs(fmtN(v)), 'Valor']} />
              <Area type="monotone" dataKey="valor" stroke={GREEN} strokeWidth={2} fill="url(#gIng2)" dot={false} activeDot={{ r: 4, fill: GREEN }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={`${CARD} p-5`}>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Por Almacén Destino</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Unidades recibidas</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={porAlmacen} dataKey="cant" nameKey="name" cx="50%" cy="45%"
                innerRadius={48} outerRadius={74} paddingAngle={3}>
                {porAlmacen.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip {...tipStyle} formatter={v => [Number(v).toLocaleString(), 'Unidades']} />
              <Legend iconType="circle" iconSize={7} formatter={v => <span style={{ fontSize: 10, color: tick }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`${CARD} p-5`}>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Top Productos Ingresados</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Por cantidad</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={porProducto} layout="vertical" margin={{ left: 4, right: 24, top: 0, bottom: 0 }}>
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} width={115} />
            <Tooltip {...tipStyle} formatter={v => [Number(v).toLocaleString(), 'Unidades']} />
            <Bar dataKey="cant" radius={[0, 6, 6, 0]} maxBarSize={16}>
              {porProducto.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={`${CARD} p-5`}>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Detalle de Ingresos ({filtered.length} líneas)</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.07]">
                {['Nota', 'Fecha', 'Proveedor', 'Producto', 'Cantidad', 'Valor (Bs.)'].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 dark:text-gray-400 font-medium pb-3 pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 15).map((r, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-5 text-xs text-teal-600 dark:text-teal-400 font-mono">{r.nota}</td>
                  <td className="py-2.5 pr-5 text-xs text-gray-400">{r.fecha}</td>
                  <td className="py-2.5 pr-5 text-gray-600 dark:text-gray-300 text-xs">{r.proveedor}</td>
                  <td className="py-2.5 pr-5 text-gray-700 dark:text-gray-200">{r.producto}</td>
                  <td className="py-2.5 pr-5 tabular-nums font-bold text-gray-900 dark:text-white">{r.cantidad.toLocaleString()}</td>
                  <td className="py-2.5 text-green-600 dark:text-green-400 tabular-nums font-semibold text-xs">{fmtBs(r.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-TAB: EGRESOS
// ══════════════════════════════════════════════════════════════════════════════
function EgresosTab() {
  const isDark = useIsDark();
  const tick   = isDark ? '#9CA3AF' : '#4B5563';
  const grid   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  const [egresos,     setEgresos]     = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [period,      setPeriod]      = useState<'dia' | 'mes' | 'anio'>('mes');
  const [selValue,    setSelValue]    = useState('');
  const [pdfLoad,     setPdfLoad]     = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  useEffect(() => {
    inventoryApi.getEgresos()
      .then(d => setEgresos(d || []))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const out: any[] = [];
    egresos.forEach((n: any) => {
      (n.detalles || []).forEach((d: any) => {
        out.push({
          fecha:    (n.Fecha || '').slice(0, 10),
          producto: d.producto?.Nombre || '—',
          cantidad: Number(d.Cantidad || 0),
          precio:   Number(d.producto?.PrecioUnitario || 0),
          valor:    Number(d.Cantidad || 0) * Number(d.producto?.PrecioUnitario || 0),
          sucursal: d.sucursal?.Nombre?.replace('PARADISO — ', '') || '—',
          nota:     `EGR-${String(n.ID_Egreso).padStart(5, '0')}`,
          montoTotal: Number(n.MontoTotal || 0),
        });
      });
    });
    return out;
  }, [egresos]);

  const periodValues = useMemo(() => {
    const s = new Set(rows.map(r => {
      if (period === 'dia')  return r.fecha;
      if (period === 'mes')  return r.fecha.slice(0, 7);
      return r.fecha.slice(0, 4);
    }).filter(Boolean));
    return [...s].sort().reverse();
  }, [rows, period]);

  const filtered = useMemo(() => {
    if (!selValue) return rows;
    return rows.filter(r => filterByPeriod(r.fecha, period, selValue));
  }, [rows, period, selValue]);

  const totalValor  = useMemo(() => filtered.reduce((s, r) => s + r.valor, 0), [filtered]);
  const totalItems  = useMemo(() => filtered.reduce((s, r) => s + r.cantidad, 0), [filtered]);
  const topProducto = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => { m[r.producto] = (m[r.producto] || 0) + r.cantidad; });
    return Object.entries(m).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
  }, [filtered]);

  const porProducto = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => { m[r.producto] = (m[r.producto] || 0) + r.cantidad; });
    return Object.entries(m).map(([name, cant]) => ({ name: name.slice(0, 16), cant }))
      .sort((a, b) => b.cant - a.cant).slice(0, 8);
  }, [filtered]);

  const evolucion = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => {
      const k = period === 'dia' ? r.fecha : period === 'mes' ? r.fecha.slice(0, 7) : r.fecha.slice(0, 4);
      m[k] = (m[k] || 0) + r.valor;
    });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b))
      .map(([name, valor]) => ({ name: name.slice(-5), valor: +valor.toFixed(2) }));
  }, [filtered, period]);

  const porSucursal = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => { m[r.sucursal] = (m[r.sucursal] || 0) + r.cantidad; });
    return Object.entries(m).map(([name, cant]) => ({ name, cant })).sort((a, b) => b.cant - a.cant);
  }, [filtered]);

  const buildPdfDoc = () => {
    const periodoDesc = selValue ? `${labelPeriod(period)}: ${selValue}` : 'Todos los períodos';
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    addPdfHeader(doc, `REPORTE DE EGRESOS — Período: ${periodoDesc}`);
    let y = 44;
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
    doc.text(`Registros: ${filtered.length}   Unidades: ${totalItems.toLocaleString()}   Valor Total: ${fmtBs(totalValor)}`, 11, y); y += 6;
    autoTable(doc, {
      startY: y,
      head: [['Nota', 'Fecha', 'Producto', 'Cantidad', 'Sucursal Destino', 'Valor (Bs.)']],
      body: filtered.map(r => [r.nota, r.fecha, r.producto, r.cantidad.toLocaleString(), r.sucursal, fmtBs(r.valor)]),
      theme: 'grid',
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 }, margin: { left: 11, right: 11 },
    });
    addPdfFooter(doc);
    return doc;
  };

  const handlePdf = async () => {
    setPdfLoad(true);
    try {
      buildPdfDoc().save(`PARADISO_Egresos_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF de Egresos descargado.');
    } catch { toast.error('Error al generar PDF.'); }
    finally { setPdfLoad(false); }
  };

  const handleSendEmail = async (emailAddr: string, msg?: string) => {
    setEmailSending(true);
    try {
      const doc   = buildPdfDoc();
      const today = new Date().toISOString().slice(0, 10);
      await financeApi.enviarPdfDirecto({
        email:   emailAddr,
        pdfBase64: doc.output('base64'),
        filename:  `PARADISO_Egresos_${today}.pdf`,
        asunto:    'Reporte de Egresos de Inventario - PARADISO',
        mensajePersonalizado: msg,
        reportType: 'EGRESOS',
      });
      toast.success(`Reporte de Egresos enviado a ${emailAddr}`);
      setModalOpen(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al enviar correo.');
    } finally { setEmailSending(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <EmailReportModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        reportTitle="Reporte de Egresos"
        reportSubtitle="Inventario · PARADISO"
        pdfInfoText="Se generará un PDF con los filtros activos aplicados"
        pdfInfoSub="Incluye productos despachados, sucursal destino y valor"
        filters={[
          { label: 'Período', value: selValue ? `${labelPeriod(period)}: ${selValue}` : 'Todos' },
        ]}
        onSend={(email, msg) => handleSendEmail(email, msg)}
        sending={emailSending}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Reporte de Egresos</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">Productos despachados, valor y sucursal destino</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <select value={period} onChange={e => { setPeriod(e.target.value as any); setSelValue(''); }} className={SELECT}>
            <option value="dia">Por Día</option>
            <option value="mes">Por Mes</option>
            <option value="anio">Por Año</option>
          </select>
          <select value={selValue} onChange={e => setSelValue(e.target.value)} className={SELECT}>
            <option value="">Todos los {labelPeriod(period)}s</option>
            {periodValues.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <ActionBar onPdf={handlePdf} onEmail={() => setModalOpen(true)} pdfLoading={pdfLoad} emailLoading={emailSending} />
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard label="Valor Total Despachado" value={fmtBs(totalValor)} sub="Cantidad × precio" icon={TrendingDown} color={AMBER} />
        <KpiCard label="Unidades Egresadas" value={totalItems.toLocaleString()} sub="Cantidad total" icon={ArrowUpCircle} color={ORANGE} />
        <KpiCard label="Notas de Egreso" value={String(new Set(filtered.map(r => r.nota)).size)} sub="Despachos" icon={BarChart2} color={PURPLE} />
        <KpiCard label="Producto Líder" value={topProducto.slice(0, 14)} sub="Más egresado" icon={Package} color={BLUE} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={`${CARD} p-5 xl:col-span-2`}>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Valor de Egresos por Período</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Bolivianos (Bs.)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={evolucion} margin={{ top: 5, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gEgr2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={AMBER} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={AMBER} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tipStyle} formatter={v => [fmtBs(fmtN(v)), 'Valor']} />
              <Area type="monotone" dataKey="valor" stroke={AMBER} strokeWidth={2} fill="url(#gEgr2)" dot={false} activeDot={{ r: 4, fill: AMBER }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={`${CARD} p-5`}>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Por Sucursal Destino</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Unidades despachadas</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={porSucursal} dataKey="cant" nameKey="name" cx="50%" cy="45%"
                innerRadius={48} outerRadius={74} paddingAngle={3}>
                {porSucursal.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip {...tipStyle} formatter={v => [Number(v).toLocaleString(), 'Unidades']} />
              <Legend iconType="circle" iconSize={7} formatter={v => <span style={{ fontSize: 10, color: tick }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={`${CARD} p-5`}>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Top Productos Egresados</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Por cantidad despachada</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={porProducto} layout="vertical" margin={{ left: 4, right: 24, top: 0, bottom: 0 }}>
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} />
            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} width={115} />
            <Tooltip {...tipStyle} formatter={v => [Number(v).toLocaleString(), 'Unidades']} />
            <Bar dataKey="cant" radius={[0, 6, 6, 0]} maxBarSize={16}>
              {porProducto.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className={`${CARD} p-5`}>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Detalle de Egresos ({filtered.length} líneas)</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/[0.07]">
                {['Nota', 'Fecha', 'Producto', 'Cantidad', 'Sucursal', 'Valor (Bs.)'].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 dark:text-gray-400 font-medium pb-3 pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 15).map((r, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-5 text-xs text-amber-600 dark:text-amber-400 font-mono">{r.nota}</td>
                  <td className="py-2.5 pr-5 text-xs text-gray-400">{r.fecha}</td>
                  <td className="py-2.5 pr-5 text-gray-700 dark:text-gray-200">{r.producto}</td>
                  <td className="py-2.5 pr-5 tabular-nums font-bold text-gray-900 dark:text-white">{r.cantidad.toLocaleString()}</td>
                  <td className="py-2.5 pr-5 text-gray-500 dark:text-gray-400 text-xs">{r.sucursal}</td>
                  <td className="py-2.5 text-amber-600 dark:text-amber-400 tabular-nums font-semibold text-xs">{fmtBs(r.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════════════════════
type SubTab = 'stock' | 'mermas' | 'ingresos' | 'egresos';

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'stock',    label: 'Stock',    icon: Package,         color: TEAL   },
  { id: 'mermas',   label: 'Mermas',   icon: AlertTriangle,   color: RED    },
  { id: 'ingresos', label: 'Ingresos', icon: ArrowDownCircle, color: GREEN  },
  { id: 'egresos',  label: 'Egresos',  icon: ArrowUpCircle,   color: AMBER  },
];

export function InventarioReportesTab() {
  const [active, setActive] = useState<SubTab>('stock');

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tab nav */}
      <div className="flex gap-1 p-1 rounded-xl w-fit bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-white/[0.07]">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              active === t.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <t.icon className="w-4 h-4" style={{ color: active === t.id ? t.color : undefined }} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {active === 'stock'    && <StockTab />}
          {active === 'mermas'   && <MermasTab />}
          {active === 'ingresos' && <IngresosTab />}
          {active === 'egresos'  && <EgresosTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
