import api from './api';

export const logisticsApi = {
  getPendientes: async () => (await api.get('/logistics/pendientes')).data,
  getAuxiliares: async () => (await api.get('/logistics/auxiliares')).data,
  createDespacho: async (data: any) => (await api.post('/logistics/despacho', data)).data,
  getActivos: async () => (await api.get('/logistics/activos')).data,
  getHistorial: async () => (await api.get('/logistics/historial')).data,
  addTracking: async (data: any) => (await api.post('/logistics/tracking', data)).data,
  getTrackingLive: async () => (await api.get('/logistics/tracking-live')).data,
  updateVehicleEstado: async (id: number, estado: string) =>
    (await api.patch(`/logistics/vehiculos/${id}/estado`, { estado })).data,
  updateDespachoProgreso: async (id: number, progreso: number, estado: string) =>
    (await api.patch(`/logistics/despacho/${id}/progreso`, { progreso, estado })).data,
};
