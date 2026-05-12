import api from './api';

export const financeApi = {
  // ── Compras (nuevo sistema) ─────────────────────────────────────────────
  getCompras: async () => (await api.get('/payments/compras')).data,
  getCompraById: async (id: number) => (await api.get(`/payments/compras/${id}`)).data,
  getCompraStatus: async (id: number): Promise<{ Estado_Documento: string }> =>
    (await api.get(`/payments/compras/${id}/status`)).data,
  createCompra: async (dto: {
    Fecha_Emision: string;
    Hora_Emision?: string;
    ID_Almacen?: number;
    Costo_Envio?: number;
    ID_Proveedor: number;
    Condicion_Pago: 'CONTADO' | 'CREDITO';
    Nro_Factura?: string;
    Metodo_Pago?: 'EFECTIVO' | 'QR';
    cuotas?: { Fecha_Vencimiento: string }[];
    detalles: {
      ID_Producto: number;
      Cantidad: number;
      Precio_Unitario: number;
      Fecha_Elaboracion?: string;
      Fecha_Vencimiento?: string;
    }[];
  }) => (await api.post('/payments/compras', dto)).data,
  anularCompra: async (id: number) => (await api.patch(`/payments/compras/${id}/anular`)).data,

  // ── Pasarela QR (Libélula) ───────────────────────────────────────────────
  generarQR: async (dto: { monto: number; glosa: string; idCompra?: number }): Promise<{ qrData?: string; qrUrl?: string }> =>
    (await api.post('/payments/generar-qr', dto)).data,
  verificarPago: async (idCompra: number): Promise<{ confirmado: boolean; mensaje: string }> =>
    (await api.get(`/payments/compras/${idCompra}/verificar-pago`)).data,

  // ── Pasarela QR Sandbox ──────────────────────────────────────────────────
  generateQR: async (id: number): Promise<{ qrUrl: string }> =>
    (await api.get(`/payments/qr/generate/${id}`)).data,
  confirmarPagoQR: async (id: number) =>
    (await api.post(`/payments/webhook/qr-confirm/${id}`)).data,

  generateQRPaymentRef: async (idCuenta: number): Promise<{ externalRef: string }> =>
    (await api.get(`/payments/qr/payment-ref/${idCuenta}`)).data,

  webhookQRConfirm: async (dto: { externalRef: string; transactionToken: string; montoPagado: number }) =>
    (await api.post('/payments/webhook/cxp-confirm', dto)).data,

  // ── Cuentas por Pagar ────────────────────────────────────────────────────
  getCuentasPorPagar: async () => (await api.get('/payments/cuentas-por-pagar')).data,
  getAlertasCxP: async () => (await api.get('/payments/cuentas-por-pagar/alertas')).data,
  marcarCuentaPagada: async (id: number) => (await api.patch(`/payments/cuentas-por-pagar/${id}/pagar`)).data,

  // ── Registro de Pagos (Fase 3) ───────────────────────────────────────────
  registrarPago: async (dto: {
    ID_Cuenta: number;
    Monto_Pagado: number;
    Fecha_Pago: string;
    Metodo_Pago: 'EFECTIVO' | 'QR';
    Referencia_Comprobante?: string;
    Observaciones?: string;
    ID_CuotaCxP?: number;
  }) => (await api.post('/payments/pagos', dto)).data,

  getHistorialPagosCuenta: async (id: number) =>
    (await api.get(`/payments/cuentas-por-pagar/${id}/pagos`)).data,

  getCuentaPorPagarById: async (id: number) =>
    (await api.get(`/payments/cuentas-por-pagar/${id}`)).data,

  getCuotasCuenta: async (id: number) =>
    (await api.get(`/payments/cuentas-por-pagar/${id}/cuotas`)).data,

  pollCxP: async (id: number): Promise<{ Saldo_Pendiente: number; Estado_Pago: string }> =>
    (await api.get(`/payments/cuentas-por-pagar/${id}/polling`)).data,

  webhookSimulate: async (dto: { idCuenta: number; montoPagado: number; referencia: string }) =>
    (await api.post('/payments/webhook/macrodroid-qr', dto)).data,

  // ── Legado (PlanPago) ────────────────────────────────────────────────────
  getCuentas: async () => (await api.get('/payments/cuentas')).data,
  pagarCuota: async (idPago: number, idCuota: number) =>
    (await api.post(`/payments/pagar/${idPago}/${idCuota}`)).data,

  // ── Proveedores / Estadísticas ───────────────────────────────────────────
  getProveedores: async () => (await api.get('/payments/proveedores')).data,
  getEstadisticas: async () => (await api.get('/payments/estadisticas')).data,
  getEstadisticasFinanzas: async () => (await api.get('/payments/estadisticas/finanzas')).data,
  enviarReportePdf: async (reportType: string, email: string, mensajePersonalizado?: string) =>
    (await api.post('/mail/reportes/enviar', { reportType, email, mensajePersonalizado })).data,

  // ── Config SMTP ──────────────────────────────────────────────────────────────
  getConfigSmtp: async (): Promise<{ host: string; port: number; usuario: string; passwordSet: boolean }> =>
    (await api.get('/mail/config')).data,

  guardarConfigSmtp: async (cfg: { host: string; port: number; usuario: string; password?: string }) =>
    (await api.post('/mail/config', cfg)).data,

  probarConexionSmtp: async (): Promise<{ ok: boolean; message: string }> =>
    (await api.post('/mail/config/test')).data,
};
