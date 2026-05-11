import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ShoppingBag, Search, Plus, Trash2, ReceiptText,
  Building2, CalendarDays, Wallet, Package, CheckCircle,
  AlertCircle, ChevronRight, X, QrCode, Banknote, CreditCard,
  Clock, Warehouse, Truck, FileText, Printer, History,
} from 'lucide-react';
import { logisticsCatalogApi } from '../../services/logistics-catalog';
import { warehouseApi } from '../../services/warehouse';
import { financeApi } from '../../services/finance';
import { useAuth } from '../../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Proveedor {
  ID_Proveedor: number;
  Nombre_RazonSocial: string;
  NIT: string;
}

interface Almacen {
  ID_Almacen: number;
  Nombre: string;
  Direccion: string;
}

interface Producto {
  ID_Producto: number;
  Nombre: string;
  CodigoBarra: string | null;
  PrecioUnitario: number;
  medida?: { Abreviatura: string; factor_conversion?: number; Unidades_Bulto?: string };
  categoria?: { NombreC: string };
}

interface LineaCarrito {
  producto: Producto;
  Cantidad: number;
  CantPaquetes: number;
  Precio_Unitario: number;
  Fecha_Elaboracion?: string;
  Fecha_Vencimiento?: string;
}

interface Cuota {
  Fecha_Vencimiento: string;
}

interface DetalleCompraFull {
  ID_Detalle: number;
  Cantidad: number;
  Precio_Unitario: number;
  Subtotal: number;
  producto?: {
    Nombre: string;
    CodigoBarra?: string | null;
    medida?: { Abreviatura: string; Unidades_Bulto?: string };
  };
}

interface CuotaFull {
  ID_CuotaCxP: number;
  Numero_Cuota: number;
  Fecha_Vencimiento: string;
  Monto: number;
  Estado: string;
}

interface CuentaPorPagarFull {
  ID_Cuenta: number;
  Saldo_Pendiente: number;
  Fecha_Vencimiento: string;
  Estado_Pago: string;
  cuotas?: CuotaFull[];
}

interface CompraHistorial {
  ID_Compra: number;
  Fecha_Emision: string;
  Hora_Emision?: string;
  Monto_Total: number;
  Estado_Documento: string;
  Condicion_Pago: string;
  Nro_Factura?: string;
  Costo_Envio?: number;
  Codigo_Recaudacion?: string | null;
  proveedor?: { Nombre_RazonSocial: string; NIT?: string };
  almacen?: { Nombre: string };
  empleado?: { Nombre: string; Paterno?: string };
  detalles?: DetalleCompraFull[];
  cuentasPorPagar?: CuentaPorPagarFull[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const parseBulto = (ub?: string): number => {
  const m = ub?.match(/[xX×*](\d+)/);
  if (m) return Math.max(1, parseInt(m[1], 10));
  const n = parseInt(ub ?? '1', 10);
  return isNaN(n) ? 1 : Math.max(1, n);
};

const fmt = (n: number) =>
  new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const today = () => new Date().toISOString().split('T')[0];

const currentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const calcCostoEnvio = (fechaStr: string): number => {
  if (!fechaStr) return 100;
  const date = new Date(fechaStr + 'T00:00:00');
  const dow = date.getDay(); // 0=Dom, 2=Mar, 5=Vie
  return dow === 2 || dow === 5 ? 0 : 100;
};

// ── PDF ───────────────────────────────────────────────────────────────────────

const buildPdfCompra = (compra: CompraHistorial, username?: string, logoBase64?: string): jsPDF => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const PW = 210, PH = 297, M = 12, TW = PW - M * 2;
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

  const setDark  = () => doc.setTextColor(15, 23, 42);
  const setGray  = () => doc.setTextColor(100, 116, 139);
  const setLGray = () => doc.setTextColor(148, 163, 184);
  const hline    = (y: number) => {
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.line(M, y, M + TW, y);
  };

  // ── Header ────────────────────────────────────────────────────────────────
  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', M, 4, 18, 18); } catch {}
  }
  setDark(); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('NOTA DE COMPRA', PW - M, 9, { align: 'right' });
  setGray(); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text(`COMP-${String(compra.ID_Compra).padStart(5, '0')}`, PW - M, 15, { align: 'right' });
  doc.text(`Fecha de Emisión: ${dateStr}  ${timeStr}`, PW - M, 20, { align: 'right' });
  doc.text(`Generado por: ${username ?? 'Sistema'}`, PW - M, 25, { align: 'right' });
  hline(28);

  // ── Título ────────────────────────────────────────────────────────────────
  setDark(); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('Nota de Compra', PW / 2, 36, { align: 'center' });
  setGray(); doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  doc.text('Registro de Compra y Adquisición de Inventario', PW / 2, 41, { align: 'center' });
  hline(44);

  // ── Info boxes ────────────────────────────────────────────────────────────
  const boxY = 47, boxH = 30, boxW = 85;

  // Proveedor (izquierda)
  doc.setFillColor(240, 253, 244); doc.setDrawColor(134, 239, 172); doc.setLineWidth(0.3);
  doc.roundedRect(M, boxY, boxW, boxH, 2, 2, 'FD');
  doc.setTextColor(22, 101, 52); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
  doc.text('PROVEEDOR', M + 4, boxY + 6);
  setDark(); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(compra.proveedor?.Nombre_RazonSocial ?? '—', M + 4, boxY + 13, { maxWidth: boxW - 8 });
  setGray(); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text(`NIT: ${compra.proveedor?.NIT ?? '—'}`, M + 4, boxY + 21);

  // Almacén destino (derecha)
  const rightX = PW - M - boxW;
  doc.setFillColor(240, 253, 244); doc.setDrawColor(134, 239, 172); doc.setLineWidth(0.3);
  doc.roundedRect(rightX, boxY, boxW, boxH, 2, 2, 'FD');
  doc.setTextColor(22, 101, 52); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
  doc.text('ALMACÉN DESTINO', rightX + 4, boxY + 6);
  setDark(); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(compra.almacen?.Nombre ?? '—', rightX + 4, boxY + 13, { maxWidth: boxW - 8 });
  setGray(); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text(`Condición: ${compra.Condicion_Pago}`, rightX + 4, boxY + 21);
  if (compra.Nro_Factura) doc.text(`Factura: ${compra.Nro_Factura}`, rightX + 4, boxY + 27);

  // ── Info strip ────────────────────────────────────────────────────────────
  const stripY = boxY + boxH + 5;
  setGray(); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  const fechaDoc = compra.Fecha_Emision
    ? new Date(compra.Fecha_Emision + 'T00:00:00').toLocaleDateString('es-BO') : '—';
  doc.text(`Fecha: ${fechaDoc}${compra.Hora_Emision ? '  ' + compra.Hora_Emision : ''}`, M, stripY);
  doc.text(`Estado: ${compra.Estado_Documento}`, PW / 2, stripY, { align: 'center' });
  doc.text(`Costo Envío: Bs. ${fmt(Number(compra.Costo_Envio ?? 0))}`, PW - M, stripY, { align: 'right' });

  // Segunda línea del strip: operador que realizó la compra
  const stripY2 = stripY + 5;
  const empleadoNombre = compra.empleado
    ? `${compra.empleado.Nombre}${compra.empleado.Paterno ? ' ' + compra.empleado.Paterno : ''}`
    : '—';
  doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Realizado por:', M, stripY2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(empleadoNombre, M + 24, stripY2);

  // ── Tabla de productos ────────────────────────────────────────────────────
  const detalles = compra.detalles ?? [];
  const tableBody = detalles.map(d => {
    const nombre   = d.producto?.Nombre ?? '—';
    const codigo   = d.producto?.CodigoBarra ?? '—';
    const bulto    = parseBulto(d.producto?.medida?.Unidades_Bulto);
    const paquetes = bulto > 1 ? Math.floor(d.Cantidad / bulto) : 0;
    const cantText = bulto > 1
      ? `${d.Cantidad} und\n${paquetes} paq`
      : `${d.Cantidad} und`;
    return [nombre, codigo, cantText, `Bs. ${fmt(Number(d.Precio_Unitario))}`, `Bs. ${fmt(Number(d.Subtotal))}`];
  });

  const subtotalProductos = detalles.reduce((s, d) => s + Number(d.Subtotal), 0)
    || (Number(compra.Monto_Total) - Number(compra.Costo_Envio ?? 0));

  autoTable(doc, {
    startY: stripY2 + 6,
    head: [['PRODUCTO', 'CÓDIGO', 'CANTIDAD', 'PRECIO UNIT. (Bs.)', 'SUBTOTAL (Bs.)']],
    body: tableBody,
    foot: [
      [{ content: 'Subtotal Productos', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
       { content: `Bs. ${fmt(subtotalProductos)}`, styles: { halign: 'right' } }],
      [{ content: 'Costo de Envío', colSpan: 4, styles: { halign: 'right' } },
       { content: `Bs. ${fmt(Number(compra.Costo_Envio ?? 0))}`, styles: { halign: 'right' } }],
      [{ content: 'MONTO TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fontSize: 10 } },
       { content: `Bs. ${fmt(Number(compra.Monto_Total))}`, styles: { halign: 'right', fontStyle: 'bold', fontSize: 10, textColor: [5, 150, 105] as [number, number, number] } }],
    ],
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8.5, textColor: [30, 41, 59], cellPadding: 3.5 },
    headStyles: { fillColor: [30, 41, 59] as [number, number, number], textColor: [226, 232, 240] as [number, number, number], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    footStyles: { fillColor: [248, 250, 252] as [number, number, number], textColor: [30, 41, 59] as [number, number, number] },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    bodyStyles: { fillColor: [255, 255, 255] as [number, number, number] },
    tableLineColor: [226, 232, 240] as [number, number, number],
    tableLineWidth: 0.2,
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 38, halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold' },
    },
  });

  // ── Sección crédito: plan de cuotas ──────────────────────────────────────
  if (compra.Condicion_Pago === 'CREDITO') {
    const cuenta = compra.cuentasPorPagar?.[0];
    if (cuenta) {
      let cy = (doc as any).lastAutoTable.finalY + 8;

      // Si queda poco espacio, nueva página
      if (cy > PH - 60) { doc.addPage(); cy = 20; }

      hline(cy);
      cy += 6;

      setDark(); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text('PLAN DE PAGOS A CRÉDITO', M, cy);
      setGray(); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      doc.text(
        `Saldo pendiente: Bs. ${fmt(Number(cuenta.Saldo_Pendiente))}  ·  Estado cuenta: ${cuenta.Estado_Pago}`,
        PW - M, cy, { align: 'right' },
      );
      cy += 6;

      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const cuotaRows = (cuenta.cuotas ?? [])
        .sort((a, b) => a.Numero_Cuota - b.Numero_Cuota)
        .map(q => {
          const fv = q.Fecha_Vencimiento
            ? new Date(String(q.Fecha_Vencimiento).split('T')[0] + 'T00:00:00')
            : null;
          const fechaStr = fv ? fv.toLocaleDateString('es-BO') : '—';
          const vencida = fv && fv < hoy && q.Estado !== 'PAGADO';
          const estadoLabel = vencida ? 'VENCIDA' : q.Estado;
          return [`Cuota ${q.Numero_Cuota}`, fechaStr, `Bs. ${fmt(Number(q.Monto))}`, estadoLabel];
        });

      autoTable(doc, {
        startY: cy,
        head: [['CUOTA', 'FECHA VENCIMIENTO', 'MONTO', 'ESTADO']],
        body: cuotaRows,
        theme: 'striped',
        styles: { font: 'helvetica', fontSize: 8.5, textColor: [30, 41, 59], cellPadding: 3.5 },
        headStyles: { fillColor: [30, 41, 59] as [number, number, number], textColor: [226, 232, 240] as [number, number, number], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
        alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
        bodyStyles: { fillColor: [255, 255, 255] as [number, number, number] },
        tableLineColor: [226, 232, 240] as [number, number, number],
        tableLineWidth: 0.2,
        columnStyles: {
          0: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 50, halign: 'center' },
          2: { cellWidth: 45, halign: 'right' },
          3: { halign: 'center', fontStyle: 'bold' },
        },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 3) {
            const estado = data.cell.raw as string;
            if (estado === 'PAGADO')       data.cell.styles.textColor = [5, 150, 105];
            else if (estado === 'VENCIDA') data.cell.styles.textColor = [220, 38, 38];
            else                           data.cell.styles.textColor = [217, 119, 6];
          }
        },
      });
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footY = PH - 12;
  hline(footY - 3);
  setLGray(); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text(`PARADISO Logistics © ${now.getFullYear()}`, PW / 2, footY + 1, { align: 'center' });

  return doc;
};

const exportarPdfGlobal = (compras: CompraHistorial[], username?: string, logoBase64?: string) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = 297, PH = 210, M = 12, TW = PW - M * 2;
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  const totalBs = compras.reduce((s, c) => s + Number(c.Monto_Total), 0);
  const activos  = compras.filter(c => c.Estado_Documento === 'ACTIVO').length;

  const setDark  = () => doc.setTextColor(15, 23, 42);
  const setGray  = () => doc.setTextColor(100, 116, 139);
  const setLGray = () => doc.setTextColor(148, 163, 184);
  const hline    = (y: number) => {
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.line(M, y, M + TW, y);
  };

  // ── Header ────────────────────────────────────────────────────────────────
  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', M, 4, 16, 16); } catch {}
  }
  setDark(); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('REPORTE GLOBAL DE COMPRAS', PW - M, 9, { align: 'right' });
  setGray(); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text(`Fecha de Emisión: ${dateStr}  ${timeStr}`, PW - M, 14.5, { align: 'right' });
  doc.text(`Generado por: ${username ?? 'Sistema de Productos'}`, PW - M, 19, { align: 'right' });
  hline(22);

  // ── Título ────────────────────────────────────────────────────────────────
  setDark(); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('Reporte Global de Compras', PW / 2, 29, { align: 'center' });
  setGray(); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text('Listado Histórico de Todas las Adquisiciones Registradas', PW / 2, 34, { align: 'center' });
  hline(37);

  setLGray(); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
  doc.text(`Total de registros: ${compras.length}`, M, 42);
  doc.text(`Monto Total: Bs. ${fmt(totalBs)}  |  Activos: ${activos}`, PW - M, 42, { align: 'right' });

  // ── Tabla ─────────────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: 46,
    head: [['COMP-#', 'FECHA', 'PROVEEDOR', 'ALMACÉN', 'NRO. FACTURA', 'CONDICIÓN', 'COSTO ENVÍO', 'TOTAL (Bs.)', 'ESTADO']],
    body: compras.map(c => [
      `COMP-${String(c.ID_Compra).padStart(5, '0')}`,
      c.Fecha_Emision ? new Date(c.Fecha_Emision + 'T00:00:00').toLocaleDateString('es-BO') : '—',
      c.proveedor?.Nombre_RazonSocial ?? '—',
      c.almacen?.Nombre ?? '—',
      c.Nro_Factura ?? '—',
      c.Condicion_Pago,
      `Bs. ${fmt(Number(c.Costo_Envio ?? 0))}`,
      `Bs. ${fmt(Number(c.Monto_Total))}`,
      c.Estado_Documento,
    ]),
    foot: [[
      { content: `TOTAL GENERAL — ${compras.length} compras`, colSpan: 7, styles: { halign: 'right', fontStyle: 'bold', fontSize: 9 } },
      { content: `Bs. ${fmt(totalBs)}`, styles: { fontStyle: 'bold', fontSize: 9, textColor: [5, 150, 105] as [number, number, number] } },
      '',
    ]],
    theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8, textColor: [30, 41, 59], cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59] as [number, number, number], textColor: [226, 232, 240] as [number, number, number], fontStyle: 'bold', fontSize: 7 },
    footStyles: { fillColor: [248, 250, 252] as [number, number, number], textColor: [30, 41, 59] as [number, number, number] },
    alternateRowStyles: { fillColor: [248, 250, 252] as [number, number, number] },
    bodyStyles: { fillColor: [255, 255, 255] as [number, number, number] },
    tableLineColor: [226, 232, 240] as [number, number, number],
    tableLineWidth: 0.2,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 22 },
      1: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' },
      8: { halign: 'center' },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 8) {
        const e = data.cell.raw as string;
        if (e === 'ACTIVO')          data.cell.styles.textColor = [5, 150, 105];
        else if (e === 'ANULADO')    data.cell.styles.textColor = [220, 38, 38];
        else if (e.includes('ESPER')) data.cell.styles.textColor = [217, 119, 6];
      }
    },
  });

  // ── Footer ────────────────────────────────────────────────────────────────
  const footY = PH - 8;
  hline(footY - 3);
  setLGray(); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.text(`PARADISO Logistics © ${now.getFullYear()}  ·  Documento de uso interno`, PW / 2, footY + 1, { align: 'center' });

  doc.save(`paradiso-compras-${now.toISOString().slice(0, 10)}.pdf`);
};

// ── Sub-components ────────────────────────────────────────────────────────────

const SectionCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl p-6 ${className}`}>
    {children}
  </div>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1.5">{children}</p>
);

const inputCls =
  'w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-slate-400 dark:placeholder:text-white/30';

const selectCls =
  'w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all cursor-pointer';

// ── Modal QR ──────────────────────────────────────────────────────────────────

const SUCCESS_KEYFRAMES = `
  @keyframes popIn {
    0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
    70%  { transform: scale(1.08) rotate(2deg); opacity: 1; }
    100% { transform: scale(1) rotate(0deg);   opacity: 1; }
  }
  @keyframes fadeUp {
    from { transform: translateY(14px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes strokeCheck {
    from { stroke-dashoffset: 60; }
    to   { stroke-dashoffset: 0;  }
  }
  @keyframes ringPulse {
    0%, 100% { transform: scale(1);   opacity: 0.35; }
    50%       { transform: scale(1.4); opacity: 0;    }
  }
`;

const ModalQRPayment = ({
  idCompra,
  montoTotal,
  onClose,
  onSuccess,
  username,
  logoBase64,
}: {
  idCompra: number;
  montoTotal: number;
  onClose: () => void;
  onSuccess: () => void;
  username?: string;
  logoBase64?: string;
}) => {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [pasarelaUrl, setPasarelaUrl] = useState<string | null>(null);
  const [loadingQr, setLoadingQr] = useState(true);
  const [errorQr, setErrorQr] = useState(false);
  const [paid, setPaid] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [compraData, setCompraData] = useState<CompraHistorial | null>(null);

  const onSuccessRef = useRef(onSuccess);
  useEffect(() => { onSuccessRef.current = onSuccess; });
  const pdfDocRef = useRef<jsPDF | null>(null);

  const resolveQrSrc = (data: { qrUrl?: string; qrData?: string; pasarelaUrl?: string }) => {
    if (data.qrUrl) return { src: data.qrUrl, pasarela: null };
    if (data.qrData) {
      const raw = data.qrData;
      const src = raw.startsWith('data:') || raw.startsWith('http') ? raw : `data:image/png;base64,${raw}`;
      return { src, pasarela: null };
    }
    if (data.pasarelaUrl) return { src: null, pasarela: data.pasarelaUrl };
    return { src: null, pasarela: null };
  };

  const triggerSuccess = useCallback(async () => {
    setPaid(true);
    try {
      const data: CompraHistorial = await financeApi.getCompraById(idCompra);
      setCompraData(data);
      pdfDocRef.current = buildPdfCompra(data, username, logoBase64);
      setPdfReady(true);
    } catch { /* no bloquea la vista de éxito */ }
  }, [idCompra]);

  // onSuccess deliberadamente excluido de deps — se accede vía onSuccessRef
  // para evitar el re-disparo del effect (causa del doble QR)
  useEffect(() => {
    let cancelled = false;

    setLoadingQr(true);
    setErrorQr(false);

    financeApi.generarQR({ monto: montoTotal, glosa: `Pago Compra #${idCompra}`, idCompra })
      .then(data => {
        if (cancelled) return;
        const { src, pasarela } = resolveQrSrc(data as any);
        if (src) { setQrSrc(src); setPasarelaUrl(null); }
        else if (pasarela) { setPasarelaUrl(pasarela); setQrSrc(null); }
        else setErrorQr(true);
      })
      .catch(() => { if (!cancelled) setErrorQr(true); })
      .finally(() => { if (!cancelled) setLoadingQr(false); });

    // Poll rápido (DB) — reacciona al instante cuando llega el webhook de Libélula
    const fastPoll = setInterval(async () => {
      if (cancelled) return;
      try {
        const { Estado_Documento } = await financeApi.getCompraStatus(idCompra);
        if (Estado_Documento === 'ACTIVO' && !cancelled) {
          clearInterval(fastPoll);
          clearInterval(slowPoll);
          triggerSuccess();
        }
      } catch { /* seguimos intentando */ }
    }, 2000);

    // Poll de respaldo contra Libélula — actúa si el webhook no llegó
    const slowPoll = setInterval(async () => {
      if (cancelled) return;
      try {
        const { confirmado } = await financeApi.verificarPago(idCompra);
        if (confirmado && !cancelled) {
          clearInterval(fastPoll);
          clearInterval(slowPoll);
          triggerSuccess();
        }
      } catch { /* seguimos intentando */ }
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(fastPoll);
      clearInterval(slowPoll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCompra, montoTotal]);

  // ── Vista de éxito ─────────────────────────────────────────────────────────
  if (paid) {
    const compra = compraData ?? ({ ID_Compra: idCompra, Monto_Total: montoTotal } as CompraHistorial);
    const fechaStr = compraData?.Fecha_Emision
      ? new Date(compraData.Fecha_Emision + 'T00:00:00').toLocaleDateString('es-BO')
      : new Date().toLocaleDateString('es-BO');

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
        <style>{SUCCESS_KEYFRAMES}</style>
        <div
          className="bg-[#0f1420] border border-emerald-500/20 rounded-3xl p-8 w-full max-w-sm relative shadow-2xl shadow-black/70 overflow-hidden"
          style={{ fontFamily: '"Public Sans", sans-serif', animation: 'fadeUp 0.3s ease forwards' }}
        >
          {/* Glow de fondo */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-48 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-600/5 rounded-full blur-2xl pointer-events-none" />

          <div className="relative flex flex-col items-center gap-5">

            {/* Check animado */}
            <div
              className="relative mt-1"
              style={{ animation: 'popIn 0.55s cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}
            >
              <div
                className="absolute inset-[-8px] rounded-full border-2 border-emerald-500/30"
                style={{ animation: 'ringPulse 2s ease-in-out 0.6s infinite' }}
              />
              <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
                <svg viewBox="0 0 52 52" className="w-12 h-12" fill="none">
                  <circle cx="26" cy="26" r="23" stroke="#10b981" strokeWidth="1.5" />
                  <path
                    d="M15 26.5L22.5 34L37 18"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="60"
                    style={{ animation: 'strokeCheck 0.45s ease 0.45s forwards', strokeDashoffset: 60 }}
                  />
                </svg>
              </div>
            </div>

            {/* Título */}
            <div className="text-center" style={{ animation: 'fadeUp 0.4s ease 0.2s both' }}>
              <h3 className="text-2xl font-black text-white leading-tight tracking-tight">
                ¡Pago Procesado<br />con Éxito!
              </h3>
              <p className="text-xs text-emerald-400/70 mt-1.5 font-semibold tracking-wide">
                Transacción verificada y confirmada
              </p>
            </div>

            {/* Resumen del pago */}
            <div
              className="w-full rounded-2xl overflow-hidden border border-white/8"
              style={{ animation: 'fadeUp 0.4s ease 0.35s both' }}
            >
              <div className="bg-white/5 px-4 py-2 border-b border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
                  Resumen del Pago
                </p>
              </div>
              <div className="bg-white/3 divide-y divide-white/5">
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-[11px] text-white/40 font-bold uppercase tracking-wider">Comprobante</span>
                  <span className="text-white/70 text-xs font-black font-mono">COMP-{compra.ID_Compra}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-[11px] text-white/40 font-bold uppercase tracking-wider">Monto Pagado</span>
                  <span className="text-emerald-400 font-black text-lg">Bs. {fmt(montoTotal)}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2.5">
                  <span className="text-[11px] text-white/40 font-bold uppercase tracking-wider">Fecha</span>
                  <span className="text-white/70 text-xs font-bold">{fechaStr}</span>
                </div>
                {compraData?.Codigo_Recaudacion && (
                  <div className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-[11px] text-white/40 font-bold uppercase tracking-wider">Cód. Recaudación</span>
                    <span className="text-white/80 text-xs font-mono font-black tracking-widest">
                      {compraData.Codigo_Recaudacion}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Botones */}
            <div
              className="flex flex-col gap-2.5 w-full"
              style={{ animation: 'fadeUp 0.4s ease 0.5s both' }}
            >
              <button
                onClick={() => {
                  const doc = pdfDocRef.current ?? buildPdfCompra(compra, username, logoBase64);
                  doc.save(`paradiso-nota-COMP${compra.ID_Compra}.pdf`);
                }}
                className={`w-full flex items-center justify-center gap-2.5 py-3.5 text-white font-black rounded-2xl transition-all text-sm tracking-wide active:scale-[0.98] ${pdfReady
                  ? 'bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-400/50 ring-2 ring-emerald-400/60'
                  : 'bg-emerald-600/70 shadow-lg shadow-emerald-500/20'
                  }`}
              >
                <Printer className="w-4 h-4" />
                {pdfReady ? 'Imprimir Nota de Pago' : 'Preparando PDF…'}
              </button>
              <button
                onClick={() => onSuccessRef.current()}
                className="w-full py-3 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 text-white/45 hover:text-white/75 font-bold rounded-2xl transition-all text-sm"
              >
                Volver al Historial
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── Vista QR ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="bg-[#151922] border-4 border-white/10 rounded-2xl p-8 w-full max-w-sm relative shadow-2xl shadow-black/60"
        style={{ fontFamily: '"Public Sans", sans-serif' }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 opacity-30 hover:opacity-80 transition-opacity">
          <X className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="inline-flex p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-4">
            <QrCode className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="font-black text-xl text-white mb-1">Escanear para Pagar</h3>
          <p className="text-sm opacity-50 mb-1 text-white">Usa tu app bancaria para escanear el QR</p>
          <p className="text-lg font-black text-emerald-400 mb-5">Bs. {fmt(montoTotal)}</p>

          <div className="bg-white rounded-xl p-4 mb-5 flex items-center justify-center" style={{ minHeight: 220 }}>
            {loadingQr ? (
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin w-10 h-10 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full" />
                <p className="text-gray-400 text-xs">Generando QR…</p>
              </div>
            ) : errorQr ? (
              <div className="flex flex-col items-center gap-2 px-2">
                <p className="text-red-500 text-sm font-semibold text-center">
                  No se pudo generar el QR en este momento. Intente nuevamente.
                </p>
                <button
                  onClick={() => {
                    setErrorQr(false);
                    setLoadingQr(true);
                    financeApi.generarQR({ monto: montoTotal, glosa: `Pago Compra #${idCompra}`, idCompra })
                      .then(data => {
                        const { src, pasarela } = resolveQrSrc(data as any);
                        if (src) { setQrSrc(src); setPasarelaUrl(null); }
                        else if (pasarela) { setPasarelaUrl(pasarela); setQrSrc(null); }
                        else setErrorQr(true);
                      })
                      .catch(() => setErrorQr(true))
                      .finally(() => setLoadingQr(false));
                  }}
                  className="mt-1 text-xs text-emerald-600 underline underline-offset-2 hover:text-emerald-800 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            ) : qrSrc ? (
              <img src={qrSrc} alt="Código QR de pago PARADISO" className="w-48 h-48 object-contain" />
            ) : pasarelaUrl ? (
              <div className="flex flex-col items-center gap-3 px-2">
                <QrCode className="w-10 h-10 text-emerald-500 opacity-60" />
                <p className="text-gray-500 text-xs text-center leading-relaxed">
                  QR no disponible.<br />Usa la pasarela de pago para completar la transacción.
                </p>
                <a
                  href={pasarelaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black rounded-xl transition-colors"
                >
                  Ir a pasarela de pago →
                </a>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-3 mb-4">
            <div className="flex items-center justify-center gap-2 text-amber-400 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Esperando confirmación bancaria...
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const GestionarComprasPage = () => {
  const { user } = useAuth();
  const [logoBase64, setLogoBase64] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

  // ── Cabecera ──────────────────────────────────────────────────────────────
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [idProveedor, setIdProveedor] = useState<number | ''>('');
  const [fechaEmision, setFechaEmision] = useState(today());
  const [horaEmision, setHoraEmision] = useState(currentTime());
  const [idAlmacen, setIdAlmacen] = useState<number | ''>('');
  const [condicionPago, setCondicionPago] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [nroFactura, setNroFactura] = useState('');

  // ── CONTADO: método de pago ───────────────────────────────────────────────
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'QR'>('EFECTIVO');

  // ── CREDITO: cuotas ───────────────────────────────────────────────────────
  const [numCuotas, setNumCuotas] = useState<1 | 2 | 3>(1);
  const [cuotas, setCuotas] = useState<Cuota[]>([{ Fecha_Vencimiento: '' }]);

  // ── Búsqueda de productos ─────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [buscando, setBuscando] = useState(false);

  // ── Carrito ───────────────────────────────────────────────────────────────
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [compras, setCompras] = useState<CompraHistorial[]>([]);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const [qrModalCompraId, setQrModalCompraId] = useState<number | null>(null);
  const [qrMontoTotal, setQrMontoTotal] = useState(0);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);

  // ── Costo de envío dinámico ───────────────────────────────────────────────
  const costoEnvio = calcCostoEnvio(fechaEmision);
  const subTotal = carrito.reduce((acc, l) => acc + l.Cantidad * l.Precio_Unitario, 0);
  const montoTotal = subTotal + costoEnvio;

  // ── Carga inicial ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/logo-paradiso.png')
      .then(r => r.blob())
      .then(b => new Promise<string>(res => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(b);
      }))
      .then(setLogoBase64)
      .catch(() => { /* sin logo */ });
  }, []);

  useEffect(() => {
    logisticsCatalogApi.getProveedores().then(setProveedores).catch(() => null);
    warehouseApi.getAlmacenes().then(setAlmacenes).catch(() => null);
    cargarHistorial();
  }, []);

  const cargarHistorial = async () => {
    try { setCompras(await financeApi.getCompras()); } catch { null; }
  };

  // ── Búsqueda de productos (debounced) ─────────────────────────────────────

  useEffect(() => {
    if (busqueda.trim().length < 2) { setResultados([]); return; }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await warehouseApi.getProductos(busqueda);
        setResultados(Array.isArray(res) ? res : res.data ?? []);
      } catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  // ── Condición de pago ─────────────────────────────────────────────────────

  const handleCondicionChange = (op: 'CONTADO' | 'CREDITO') => {
    setCondicionPago(op);
    if (op === 'CONTADO') {
      setMetodoPago('EFECTIVO');
    } else {
      setNumCuotas(1);
      setCuotas([{ Fecha_Vencimiento: '' }]);
    }
  };

  const handleNumCuotasChange = (n: 1 | 2 | 3) => {
    setNumCuotas(n);
    setCuotas(prev => Array.from({ length: n }, (_, i) => prev[i] ?? { Fecha_Vencimiento: '' }));
  };

  // ── Carrito ───────────────────────────────────────────────────────────────

  const agregarProducto = (prod: Producto) => {
    if (carrito.find(l => l.producto.ID_Producto === prod.ID_Producto)) {
      toast.info(`${prod.Nombre} ya está en el carrito.`);
      return;
    }
    setCarrito(prev => [...prev, { producto: prod, Cantidad: 1, CantPaquetes: 0, Precio_Unitario: prod.PrecioUnitario }]);
    setBusqueda('');
    setResultados([]);
  };

  const actualizarLinea = (
    idx: number,
    campo: keyof Omit<LineaCarrito, 'producto'>,
    valor: string | number,
  ) => {
    setCarrito(prev => prev.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  };

  const getFactorLinea = (idx: number): number => {
    const prod = carrito[idx].producto;
    const fc = Math.max(1, prod.medida?.factor_conversion ?? 1);
    return fc > 1 ? fc : parseBulto(prod.medida?.Unidades_Bulto);
  };

  const actualizarPaquetes = (idx: number, paquetes: number) => {
    const factor = getFactorLinea(idx);
    setCarrito(prev => prev.map((l, i) =>
      i === idx ? { ...l, CantPaquetes: paquetes, Cantidad: Math.max(1, paquetes * factor) } : l,
    ));
  };

  const actualizarUnidades = (idx: number, unidades: number) => {
    const factor = getFactorLinea(idx);
    setCarrito(prev => prev.map((l, i) =>
      i === idx ? { ...l, Cantidad: Math.max(1, unidades), CantPaquetes: Math.floor(unidades / factor) } : l,
    ));
  };

  const eliminarLinea = (idx: number) => {
    setCarrito(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Reset formulario ──────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setIdProveedor('');
    setFechaEmision(today());
    setHoraEmision(currentTime());
    setIdAlmacen('');
    setCondicionPago('CONTADO');
    setNroFactura('');
    setMetodoPago('EFECTIVO');
    setNumCuotas(1);
    setCuotas([{ Fecha_Vencimiento: '' }]);
    setCarrito([]);
  }, []);

  // ── Enviar compra ─────────────────────────────────────────────────────────

  const registrarCompra = useCallback(async () => {
    if (!idProveedor) { toast.error('Selecciona un proveedor.'); return; }
    if (!nroFactura.trim()) { toast.error('El número de factura del proveedor es obligatorio.'); return; }
    if (!fechaEmision) { toast.error('Indica la fecha de emisión.'); return; }
    if (carrito.length === 0) { toast.error('Agrega al menos un producto al carrito.'); return; }

    const invalidas = carrito.filter(l => l.Cantidad <= 0 || l.Precio_Unitario <= 0);
    if (invalidas.length > 0) {
      toast.error('Todas las líneas deben tener cantidad y precio mayor a cero.');
      return;
    }

    if (condicionPago === 'CREDITO') {
      const cuotasVacias = cuotas.filter(c => !c.Fecha_Vencimiento);
      if (cuotasVacias.length > 0) {
        toast.error('Completa las fechas de vencimiento de todas las cuotas.');
        return;
      }
    }

    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const cuotasPayload = condicionPago === 'CREDITO' ? cuotas : undefined;

      const compraCreada = await financeApi.createCompra({
        Fecha_Emision: fechaEmision,
        Hora_Emision: horaEmision || undefined,
        ID_Almacen: idAlmacen !== '' ? Number(idAlmacen) : undefined,
        Costo_Envio: costoEnvio,
        ID_Proveedor: Number(idProveedor),
        Condicion_Pago: condicionPago,
        Nro_Factura: nroFactura.trim(),
        Metodo_Pago: condicionPago === 'CONTADO' ? metodoPago : undefined,
        cuotas: cuotasPayload,
        detalles: carrito.map(l => ({
          ID_Producto: l.producto.ID_Producto,
          Cantidad: l.Cantidad,
          Precio_Unitario: l.Precio_Unitario,
          Fecha_Elaboracion: l.Fecha_Elaboracion || undefined,
          Fecha_Vencimiento: l.Fecha_Vencimiento || undefined,
        })),
      });

      if (condicionPago === 'CONTADO' && metodoPago === 'QR') {
        setQrMontoTotal(montoTotal);
        setQrModalCompraId(compraCreada.ID_Compra);
      } else if (condicionPago === 'CREDITO') {
        const cuotaMsg = numCuotas > 1
          ? ` Se generaron ${numCuotas} cuotas.`
          : ' Se generó Cuenta por Pagar (30 días).';
        toast.success(`Compra a crédito registrada.${cuotaMsg}`);
        resetForm();
        cargarHistorial();
      } else {
        toast.success('Compra al contado registrada exitosamente.');
        resetForm();
        cargarHistorial();
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Error al registrar la compra.');
    } finally {
      setEnviando(false);
      enviandoRef.current = false;
    }
  }, [idProveedor, fechaEmision, horaEmision, idAlmacen, condicionPago, carrito, nroFactura, metodoPago, numCuotas, cuotas, costoEnvio, montoTotal, resetForm]);

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabCls = (tab: 'new' | 'history') =>
    `px-6 py-3 rounded-xl text-sm font-semibold uppercase tracking-wide border transition-all flex items-center gap-2 ${
      activeTab === tab ? 'btn-toggle-emerald' : 'btn-toggle-inactive'
    }`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 w-full relative z-10">

      {/* Título */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
          <ShoppingBag className="w-7 h-7 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl sm:text-3xl font-black text-text">Gestionar Compras</h2>
          <p className="text-sm opacity-50 font-medium">Módulo de Compra y Pago — Registro Maestro-Detalle</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex flex-wrap gap-3">
        <button className={tabCls('new')} onClick={() => setActiveTab('new')}>
          <Plus className="w-4 h-4" /> Nueva Compra
        </button>
        <button className={tabCls('history')} onClick={() => setActiveTab('history')}>
          <History className="w-4 h-4" /> Historial de Compras
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: NUEVA COMPRA
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'new' && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">

          {/* Panel izquierdo — Cabecera de compra */}
          <div className="xl:col-span-2 flex flex-col gap-4">

            <SectionCard>
              <h3 className="font-black text-sm uppercase tracking-widest text-emerald-500 flex items-center gap-2 mb-5">
                <ReceiptText className="w-4 h-4" /> Datos de la Compra
              </h3>

              <div className="flex flex-col gap-4">

                {/* Proveedor */}
                <div>
                  <Label><span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> Proveedor *</span></Label>
                  <select
                    className={selectCls}
                    value={idProveedor}
                    onChange={e => setIdProveedor(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <option value="">— Seleccionar proveedor —</option>
                    {proveedores.map(p => (
                      <option key={p.ID_Proveedor} value={p.ID_Proveedor}>
                        {p.Nombre_RazonSocial} · NIT {p.NIT}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Almacén destino */}
                <div>
                  <Label><span className="flex items-center gap-1"><Warehouse className="w-3 h-3" /> Almacén Destino</span></Label>
                  <select
                    className={selectCls}
                    value={idAlmacen}
                    onChange={e => setIdAlmacen(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <option value="">— Sin especificar —</option>
                    {almacenes.map(a => (
                      <option key={a.ID_Almacen} value={a.ID_Almacen}>
                        {a.Nombre} — {a.Direccion}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nro. Factura */}
                <div>
                  <Label><span className="flex items-center gap-1"><ReceiptText className="w-3 h-3" /> Nro. Factura Proveedor *</span></Label>
                  <input
                    type="text"
                    placeholder="ej. F-001-00023456"
                    className={inputCls}
                    value={nroFactura}
                    onChange={e => setNroFactura(e.target.value)}
                  />
                </div>

                {/* Fecha y Hora en fila */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label><span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Fecha de Emisión *</span></Label>
                    <input
                      type="date"
                      className={inputCls}
                      value={fechaEmision}
                      onChange={e => setFechaEmision(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label><span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Hora de Emisión</span></Label>
                    <input
                      type="time"
                      className={inputCls}
                      value={horaEmision}
                      onChange={e => setHoraEmision(e.target.value)}
                    />
                  </div>
                </div>

                {/* Costo de Envío (solo lectura) */}
                <div>
                  <Label><span className="flex items-center gap-1"><Truck className="w-3 h-3" /> Costo de Envío (Servicio)</span></Label>
                  <div className={`${inputCls} flex items-center justify-between cursor-not-allowed opacity-70`}>
                    <span className={costoEnvio === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      Bs. {fmt(costoEnvio)}
                    </span>
                    <span className="text-[10px] opacity-60">
                      {costoEnvio === 0 ? 'Gratis (Mar/Vie)' : 'Día normal — Bs. 100'}
                    </span>
                  </div>
                </div>

                {/* Condición de pago */}
                <div>
                  <Label><span className="flex items-center gap-1"><Wallet className="w-3 h-3" /> Condición de Pago *</span></Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['CONTADO', 'CREDITO'] as const).map(op => (
                      <button
                        key={op}
                        onClick={() => handleCondicionChange(op)}
                        className={`py-3 rounded-xl text-sm font-semibold uppercase tracking-wide border transition-all ${condicionPago === op
                          ? op === 'CONTADO'
                            ? 'btn-toggle-emerald'
                            : 'btn-toggle-amber'
                          : 'btn-toggle-inactive'
                          }`}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CONTADO: método de pago */}
                {condicionPago === 'CONTADO' && (
                  <div>
                    <Label>Método de Pago</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { key: 'EFECTIVO', icon: <Banknote className="w-4 h-4" /> },
                        { key: 'QR', icon: <QrCode className="w-4 h-4" /> },
                      ] as const).map(({ key, icon }) => (
                        <button
                          key={key}
                          onClick={() => setMetodoPago(key as 'EFECTIVO' | 'QR')}
                          className={`py-3 rounded-xl text-sm font-semibold uppercase tracking-wide border transition-all flex items-center justify-center gap-2 ${
                            metodoPago === key ? 'btn-toggle-emerald' : 'btn-toggle-inactive'
                          }`}
                        >
                          {icon} {key}
                        </button>
                      ))}
                    </div>
                    {metodoPago === 'QR' && (
                      <p className="mt-2 text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5" />
                        Se generará un código QR para confirmar el pago.
                      </p>
                    )}
                  </div>
                )}

                {/* CREDITO: cuotas */}
                {condicionPago === 'CREDITO' && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <Label><span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> Número de Cuotas</span></Label>
                      <div className="grid grid-cols-3 gap-2">
                        {([1, 2, 3] as const).map(n => (
                          <button
                            key={n}
                            onClick={() => handleNumCuotasChange(n)}
                            className={`py-3 rounded-xl text-sm font-semibold border transition-all ${
                              numCuotas === n ? 'btn-toggle-amber' : 'btn-toggle-inactive'
                            }`}
                          >
                            {n === 1 ? '1 cuota' : `${n} cuotas`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {cuotas.map((cuota, i) => (
                        <div key={i}>
                          <Label>Vencimiento Cuota {i + 1} *</Label>
                          <input
                            type="date"
                            className={inputCls}
                            value={cuota.Fecha_Vencimiento}
                            onChange={e => {
                              const next = [...cuotas];
                              next[i] = { Fecha_Vencimiento: e.target.value };
                              setCuotas(next);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {numCuotas === 1
                        ? 'Se generará una Cuenta por Pagar con la fecha indicada.'
                        : `El monto total se dividirá en ${numCuotas} cuotas iguales.`}
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Resumen totales */}
            <SectionCard>
              <h3 className="font-black text-sm uppercase tracking-widest opacity-50 mb-4">Resumen</h3>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm opacity-60 font-semibold">Líneas en carrito</span>
                <span className="font-black text-lg">{carrito.length}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm opacity-60 font-semibold">Subtotal productos</span>
                <span className="font-black text-base">Bs. {fmt(subTotal)}</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm opacity-60 font-semibold flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" /> Costo Envío
                </span>
                <span className={`font-black text-base ${costoEnvio === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  + Bs. {fmt(costoEnvio)}
                </span>
              </div>
              <div className="border-t border-emerald-500/30 pt-3 flex justify-between items-center mb-5">
                <span className="text-sm opacity-60 font-semibold">Monto Total (Bs.)</span>
                <span className="font-black text-2xl text-emerald-400">{fmt(montoTotal)}</span>
              </div>

              <button
                onClick={registrarCompra}
                disabled={enviando || carrito.length === 0 || qrModalCompraId !== null}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                {enviando ? (
                  <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                ) : qrModalCompraId !== null ? (
                  <Clock className="w-5 h-5" />
                ) : metodoPago === 'QR' && condicionPago === 'CONTADO' ? (
                  <QrCode className="w-5 h-5" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                {enviando
                  ? 'Registrando...'
                  : qrModalCompraId !== null
                    ? 'Esperando pago QR...'
                    : metodoPago === 'QR' && condicionPago === 'CONTADO'
                      ? 'Pagar con QR'
                      : 'Registrar Compra'}
              </button>
            </SectionCard>
          </div>

          {/* Panel derecho — Carrito */}
          <div className="xl:col-span-3 flex flex-col gap-4">
            <SectionCard>
              <h3 className="font-black text-sm uppercase tracking-widest text-emerald-500 flex items-center gap-2 mb-4">
                <Package className="w-4 h-4" /> Carrito de Productos
              </h3>

              {/* Buscador */}
              <div className="relative mb-4">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text opacity-40">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar producto por nombre o código..."
                  className={`${inputCls} pl-10`}
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                />
                {busqueda && (
                  <button
                    onClick={() => { setBusqueda(''); setResultados([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {(buscando || resultados.length > 0) && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#1a1f2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                    {buscando && (
                      <div className="py-4 text-center text-sm opacity-50 font-semibold">Buscando...</div>
                    )}
                    {!buscando && resultados.length === 0 && busqueda.length >= 2 && (
                      <div className="py-4 text-center text-sm opacity-50 font-semibold">Sin resultados</div>
                    )}
                    {resultados.map(prod => (
                      <button
                        key={prod.ID_Producto}
                        onClick={() => agregarProducto(prod)}
                        className="flex items-center justify-between w-full px-4 py-3 hover:bg-emerald-500/10 transition-colors text-left border-b border-white/5 last:border-0"
                      >
                        <div>
                          <p className="font-bold text-sm">{prod.Nombre}</p>
                          <p className="text-[10px] opacity-50">
                            {prod.categoria?.NombreC ?? '—'} · {prod.CodigoBarra ?? 'Sin código'}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <span className="text-xs font-black text-emerald-400">Bs. {fmt(prod.PrecioUnitario)}</span>
                          <Plus className="w-4 h-4 text-emerald-500" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabla carrito */}
              {carrito.length === 0 ? (
                <div className="py-12 text-center opacity-30">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm font-bold">El carrito está vacío.</p>
                  <p className="text-xs">Busca un producto arriba para agregarlo.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left pb-3 font-black text-[10px] uppercase tracking-widest opacity-40">Producto</th>
                        <th className="text-center pb-3 font-black text-[10px] uppercase tracking-widest opacity-40 w-32">Cantidad</th>
                        <th className="text-center pb-3 font-black text-[10px] uppercase tracking-widest opacity-40 w-28">P. Unit.</th>
                        <th className="text-right pb-3 font-black text-[10px] uppercase tracking-widest opacity-40 w-24">Subtotal</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {carrito.map((linea, idx) => {
                        const subtotal = linea.Cantidad * linea.Precio_Unitario;
                        return (
                          <tr key={linea.producto.ID_Producto} className="group">
                            <td className="py-3 pr-2">
                              <p className="font-bold">{linea.producto.Nombre}</p>
                              <p className="text-[10px] opacity-40">
                                {linea.producto.medida?.Abreviatura ?? ''} · {linea.producto.categoria?.NombreC ?? ''}
                              </p>
                            </td>
                            <td className="py-3 px-1">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-black text-amber-500 dark:text-amber-400 w-8 flex-shrink-0">Paq.</span>
                                  <input
                                    type="number" min={0} step={1}
                                    value={linea.CantPaquetes}
                                    onChange={e => actualizarPaquetes(idx, Math.max(0, Number(e.target.value)))}
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-amber-400/40 rounded-lg px-1.5 py-1 text-center text-xs font-bold text-amber-600 dark:text-amber-400 focus:outline-none focus:border-amber-500 slate-900"
                                    placeholder="0"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-black text-emerald-500 dark:text-emerald-400 w-8 flex-shrink-0">Uds.</span>
                                  <input
                                    type="number" min={1} step={1}
                                    value={linea.Cantidad}
                                    onChange={e => actualizarUnidades(idx, Number(e.target.value))}
                                    className="w-full bg-slate-50 dark:bg-black/20 border border-emerald-400/40 rounded-lg px-1.5 py-1 text-center text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                                    placeholder="1"
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-1">
                              <input
                                type="number" min={0.01} step={0.01} value={linea.Precio_Unitario}
                                onChange={e => actualizarLinea(idx, 'Precio_Unitario', Math.max(0, Number(e.target.value)))}
                                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-center text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                              />
                            </td>
                            <td className="py-3 pl-2 text-right font-black text-emerald-400">{fmt(subtotal)}</td>
                            <td className="py-3 pl-1">
                              <button
                                onClick={() => eliminarLinea(idx)}
                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="pt-2 text-right text-[10px] font-black uppercase tracking-widest opacity-50">
                          Subtotal productos
                        </td>
                        <td className="pt-2 text-right font-black text-base">Bs. {fmt(subTotal)}</td>
                        <td />
                      </tr>
                      <tr>
                        <td colSpan={3} className="py-1 text-right text-[10px] font-black uppercase tracking-widest opacity-50">
                          Costo Envío
                        </td>
                        <td className={`py-1 text-right font-black text-base ${costoEnvio === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          + Bs. {fmt(costoEnvio)}
                        </td>
                        <td />
                      </tr>
                      <tr className="border-t-2 border-emerald-500/30">
                        <td colSpan={3} className="pt-3 text-right font-black text-xs uppercase tracking-widest opacity-50">
                          MONTO TOTAL
                        </td>
                        <td className="pt-3 text-right font-black text-xl text-emerald-400">
                          Bs. {fmt(montoTotal)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: HISTORIAL
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h3 className="font-black text-sm uppercase tracking-widest opacity-50 flex items-center gap-2">
              <ChevronRight className="w-4 h-4" /> Historial de Compras Registradas
            </h3>
            <button
              onClick={() => exportarPdfGlobal(compras, user?.username, logoBase64)}
              disabled={compras.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white text-xs font-black uppercase tracking-wider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4" /> Exportar PDF Global
            </button>
          </div>

          {compras.length === 0 ? (
            <p className="text-center opacity-30 py-6 text-sm font-bold">No hay compras registradas aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    {['#', 'Nro. Factura', 'Fecha', 'Proveedor', 'Almacén', 'Condición', 'Envío', 'Monto Total', 'Estado', 'PDF'].map(h => (
                      <th key={h} className="text-left pb-3 font-black text-[10px] uppercase tracking-widest opacity-40 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {compras.map(c => (
                    <tr key={c.ID_Compra} className="hover:bg-white/3 transition-colors">
                      <td className="py-3 font-black text-emerald-400 pr-3">COMP-{c.ID_Compra}</td>
                      <td className="py-3 opacity-60 text-xs font-mono pr-3">{c.Nro_Factura ?? '—'}</td>
                      <td className="py-3 opacity-70 pr-3">
                        {c.Fecha_Emision ? new Date(c.Fecha_Emision + 'T00:00:00').toLocaleDateString('es-BO') : '—'}
                        {c.Hora_Emision && <span className="text-[10px] opacity-50 ml-1">{c.Hora_Emision}</span>}
                      </td>
                      <td className="py-3 font-semibold pr-3">{c.proveedor?.Nombre_RazonSocial ?? '—'}</td>
                      <td className="py-3 opacity-60 text-xs pr-3">{c.almacen?.Nombre ?? '—'}</td>
                      <td className="py-3 pr-3">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${c.Condicion_Pago === 'CREDITO'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                          {c.Condicion_Pago}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`text-xs font-bold ${Number(c.Costo_Envio ?? 0) === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          Bs. {fmt(Number(c.Costo_Envio ?? 0))}
                        </span>
                      </td>
                      <td className="py-3 font-black pr-3">Bs. {fmt(Number(c.Monto_Total))}</td>
                      <td className="py-3 pr-3">
                        {c.Estado_Documento === 'ESPERANDO_PAGO' ? (
                          <button
                            onClick={() => {
                              setQrMontoTotal(Number(c.Monto_Total));
                              setQrModalCompraId(c.ID_Compra);
                            }}
                            title="Abrir modal de pago QR"
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/40 hover:border-amber-400 text-amber-400 text-[10px] font-black uppercase tracking-wider transition-all"
                          >
                            <QrCode className="w-3 h-3" />
                            ESPERANDO QR
                          </button>
                        ) : (
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${c.Estado_Documento === 'ANULADO'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-green-500/20 text-green-400'
                            }`}>
                            {c.Estado_Documento}
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <button
                          disabled={pdfLoadingId === c.ID_Compra}
                          onClick={async () => {
                            setPdfLoadingId(c.ID_Compra);
                            try {
                              const fullCompra = await financeApi.getCompraById(c.ID_Compra);
                              const doc = buildPdfCompra(fullCompra ?? c, user?.username, logoBase64);
                              doc.save(`paradiso-compra-${c.ID_Compra}.pdf`);
                            } catch {
                              toast.error('No se pudo generar el PDF');
                            } finally {
                              setPdfLoadingId(null);
                            }
                          }}
                          title="Exportar PDF individual"
                          className="p-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-white/40 hover:text-emerald-400 transition-all disabled:opacity-40 disabled:cursor-wait"
                        >
                          {pdfLoadingId === c.ID_Compra
                            ? <div className="w-4 h-4 border-2 border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />
                            : <Printer className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* Modal QR / Vista de éxito */}
      {qrModalCompraId !== null && (
        <ModalQRPayment
          idCompra={qrModalCompraId}
          montoTotal={qrMontoTotal}
          onClose={() => setQrModalCompraId(null)}
          onSuccess={() => {
            setQrModalCompraId(null);
            resetForm();
            cargarHistorial();
            setActiveTab('history');
          }}
          username={user?.username}
          logoBase64={logoBase64}
        />
      )}
    </div>
  );
};
