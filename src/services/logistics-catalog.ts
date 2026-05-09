import api from './api';

export const logisticsCatalogApi = {
  // Proveedores
  getProveedores: async () => (await api.get('/logistics-catalog/proveedores')).data,
  createProveedor: async (data: any) => (await api.post('/logistics-catalog/proveedores', data)).data,
  updateProveedor: async (id: number, data: any) => (await api.put(`/logistics-catalog/proveedores/${id}`, data)).data,
  removeProveedor: async (id: number) => (await api.delete(`/logistics-catalog/proveedores/${id}`)).data,

  // Vehículos
  getVehiculos: async () => (await api.get('/logistics-catalog/vehiculos')).data,
  createVehiculo: async (data: any) => (await api.post('/logistics-catalog/vehiculos', data)).data,
  updateVehiculo: async (id: number, data: any) => (await api.put(`/logistics-catalog/vehiculos/${id}`, data)).data,
  removeVehiculo: async (id: number) => (await api.delete(`/logistics-catalog/vehiculos/${id}`)).data,

  // Rutas
  getRutas: async () => (await api.get('/logistics-catalog/rutas')).data,
  createRuta: async (data: any) => (await api.post('/logistics-catalog/rutas', data)).data,
  updateRuta: async (id: number, data: any) => (await api.put(`/logistics-catalog/rutas/${id}`, data)).data,
  removeRuta: async (id: number) => (await api.delete(`/logistics-catalog/rutas/${id}`)).data,
};
