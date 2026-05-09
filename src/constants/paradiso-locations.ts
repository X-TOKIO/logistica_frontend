export interface ParadisoLocation {
  nombre: string;
  lat: number;
  lng: number;
  color: string;
  type: 'almacen' | 'sucursal';
}

export const PARADISO_LOCATIONS: ParadisoLocation[] = [
  { nombre: 'PARADISO — Almacén Central', lat: -17.764656, lng: -63.204454, color: '#6366f1', type: 'almacen' },
  { nombre: 'PARADISO — FABRIL',           lat: -17.330885, lng: -63.248443, color: '#f59e0b', type: 'almacen' },
  { nombre: 'PARADISO — Betania',          lat: -17.348671, lng: -63.232710, color: '#10b981', type: 'sucursal' },
  { nombre: 'PARADISO — Warnes',           lat: -17.511309, lng: -63.167547, color: '#3b82f6', type: 'sucursal' },
  { nombre: 'PARADISO — Loza',             lat: -17.749364, lng: -63.178861, color: '#ec4899', type: 'sucursal' },
  { nombre: 'PARADISO — Pirai',            lat: -17.792079, lng: -63.198675, color: '#f97316', type: 'sucursal' },
  { nombre: 'PARADISO — Tokio',            lat: -17.717678, lng: -63.162393, color: '#14b8a6', type: 'sucursal' },
];

export const getLocationByName = (name: string): ParadisoLocation | undefined =>
  PARADISO_LOCATIONS.find(l => l.nombre === name);
