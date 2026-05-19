import api from './api';

export type SearchResultItem = {
  id:    number;
  label: string;
  sub:   string;
  tipo:  'producto' | 'proveedor' | 'empleado' | 'despacho' | 'compra';
  url:   string;
};

export type GlobalSearchResult = {
  productos:   SearchResultItem[];
  proveedores: SearchResultItem[];
  empleados:   SearchResultItem[];
  despachos:   SearchResultItem[];
  compras:     SearchResultItem[];
};

export const searchApi = {
  global: async (q: string): Promise<GlobalSearchResult> =>
    (await api.get('/search', { params: { q } })).data,
};
