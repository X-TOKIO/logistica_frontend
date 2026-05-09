import api from './api';

export const warehouseApi = {
  // ─── Categorías ───
  getCategorias:    async ()                         => (await api.get('/warehouse/categorias')).data,
  createCategoria:  async (data: any)                => (await api.post('/warehouse/categorias', data)).data,
  updateCategoria:  async (id: number, data: any)    => (await api.put(`/warehouse/categorias/${id}`, data)).data,
  deleteCategoria:  async (id: number)               => (await api.delete(`/warehouse/categorias/${id}`)).data,

  // ─── Medidas ───
  getMedidas:       async ()                         => (await api.get('/warehouse/medidas')).data,
  createMedida:     async (data: any)                => (await api.post('/warehouse/medidas', data)).data,
  updateMedida:     async (id: number, data: any)    => (await api.put(`/warehouse/medidas/${id}`, data)).data,
  deleteMedida:     async (id: number)               => (await api.delete(`/warehouse/medidas/${id}`)).data,

  // ─── Almacenes ───
  getAlmacenes:     async ()                         => (await api.get('/warehouse/almacenes')).data,
  createAlmacen:    async (data: any)                => (await api.post('/warehouse/almacenes', data)).data,
  updateAlmacen:    async (id: number, data: any)    => (await api.put(`/warehouse/almacenes/${id}`, data)).data,
  deleteAlmacen:    async (id: number)               => (await api.delete(`/warehouse/almacenes/${id}`)).data,

  // ─── Sucursales ───
  getSucursales:    async ()                         => (await api.get('/warehouse/sucursales')).data,
  createSucursal:   async (data: any)                => (await api.post('/warehouse/sucursales', data)).data,
  updateSucursal:   async (id: number, data: any)    => (await api.put(`/warehouse/sucursales/${id}`, data)).data,
  deleteSucursal:   async (id: number)               => (await api.delete(`/warehouse/sucursales/${id}`)).data,

  // ─── Imagen ───
  uploadProductImage: async (file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('image', file);
    return (await api.post('/warehouse/upload-image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
  },

  // ─── Productos ───
  getProductos: async (search?: string, categoria?: number | string, almacen?: number | string) => {
    const p = new URLSearchParams();
    if (search)    p.set('search',    search);
    if (categoria) p.set('categoria', String(categoria));
    if (almacen)   p.set('almacen',   String(almacen));
    return (await api.get(`/warehouse/productos?${p.toString()}`)).data;
  },
  getProductoById:  async (id: number)               => (await api.get(`/warehouse/productos/${id}`)).data,
  createProducto:   async (data: any)                => (await api.post('/warehouse/productos', data)).data,
  updateProducto:   async (id: number, data: any)    => (await api.put(`/warehouse/productos/${id}`, data)).data,
  deleteProducto:   async (id: number)               => (await api.delete(`/warehouse/productos/${id}`)).data,

  // ─── Export PDF ───
  exportProductosPdf: async (search?: string, categoria?: number | string, almacen?: number | string): Promise<Blob> => {
    const p = new URLSearchParams();
    if (search)    p.set('search',    search);
    if (categoria) p.set('categoria', String(categoria));
    if (almacen)   p.set('almacen',   String(almacen));
    const res = await api.get(`/warehouse/productos/export-pdf?${p.toString()}`, { responseType: 'blob' });
    return res.data as Blob;
  },
};
