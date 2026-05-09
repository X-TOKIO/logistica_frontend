import api from './api';

export const inventoryApi = {
  getIngresos: async () => (await api.get('/inventory/ingresos')).data,
  createIngreso: async (data: any) => (await api.post('/inventory/ingresos', data)).data,
  
  getEgresos: async () => (await api.get('/inventory/egresos')).data,
  createEgreso: async (data: any) => (await api.post('/inventory/egresos', data)).data,

  getMermas: async () => (await api.get('/inventory/mermas')).data,
  createMerma: async (data: any) => (await api.post('/inventory/mermas', data)).data,
};
