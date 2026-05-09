import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { logisticsApi } from '../../services/logistics';
import { warehouseApi } from '../../services/warehouse';
import { Truck, Satellite, MapPin } from 'lucide-react';
import { MapViewer } from '../../components/map/MapViewer';

export const MonitorGPSPage = () => {
  const [trackings,  setTrackings]  = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [almacenes,  setAlmacenes]  = useState<any[]>([]);
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q');

  const fetchLive = async () => {
    try { setTrackings(await logisticsApi.getTrackingLive()); } catch { /* silencioso */ }
  };

  useEffect(() => {
    fetchLive();
    const interval = setInterval(fetchLive, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadNodes = async () => {
      try {
        const [sucs, alms] = await Promise.all([warehouseApi.getSucursales(), warehouseApi.getAlmacenes()]);
        setSucursales(sucs);
        setAlmacenes(alms);
      } catch { /* silencioso */ }
    };
    loadNodes();
  }, []);

  const filteredTrackings = q
    ? trackings.filter(t =>
        t.despacho?.ID_Despacho?.toString() === q.replace('DSP-', '') ||
        q.includes(t.despacho?.ID_Egreso?.toString()))
    : trackings;

  // Marcadores de camiones en tránsito (icono camión rojo animado)
  const truckMarkers = filteredTrackings.map(t => ({
    lat: parseFloat(t.Latitud),
    lng: parseFloat(t.Longitud),
    isTruck: true,
    color: '#ef4444',
    popup: (
      <div className="font-bold p-1">
        <h4 className="text-red-600 font-black uppercase text-[10px] tracking-widest mb-1 border-b pb-1">
          <Satellite className="w-3 h-3 inline mr-1" /> DESP-{t.despacho?.ID_Despacho} — ACTIVO
        </h4>
        <p className="text-xs mt-1">Lat: {parseFloat(t.Latitud).toFixed(5)}</p>
        <p className="text-xs">Lng: {parseFloat(t.Longitud).toFixed(5)}</p>
        <div className="mt-2 bg-black/5 rounded-md px-2 py-1 text-[9px] uppercase font-bold text-blue-600">
          Última señal: {new Date(t.FechaHora).toLocaleTimeString()}
        </div>
      </div>
    ),
  }));

  // Marcadores dinámicos desde la DB
  const baseMarkers = [
    ...sucursales
      .filter(s => s.Latitud && s.Longitud)
      .map(s => ({ lat: parseFloat(s.Latitud), lng: parseFloat(s.Longitud), label: s.Nombre, color: s.Color ?? '#10b981', type: (s.Tipo ?? 'sucursal') as 'almacen' | 'sucursal' })),
    ...almacenes
      .filter(a => a.Latitud && a.Longitud)
      .map(a => ({ lat: parseFloat(a.Latitud), lng: parseFloat(a.Longitud), label: a.Nombre, color: a.Color ?? '#6366f1', type: 'almacen' as const })),
  ];

  const center = filteredTrackings.length > 0
    ? [parseFloat(filteredTrackings[0].Latitud), parseFloat(filteredTrackings[0].Longitud)] as [number, number]
    : [-17.764656, -63.204454] as [number, number];

  return (
    <div className="flex flex-col gap-5 w-full h-[88vh] relative z-10 transition-all duration-300">

      {/* Header */}
      <div className="flex justify-between items-center bg-white/60 dark:bg-black/60 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div>
          <h2 className="text-3xl font-black text-primary flex items-center gap-3">
            <Satellite className="w-8 h-8 text-secondary" /> Monitor Satelital PARADISO
          </h2>
          <p className="font-bold opacity-70 mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Tracking en Vivo — Refresh 3s
            {q && <span className="ml-2 text-primary text-xs">(Filtro: {q})</span>}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-primary/10 text-primary px-6 py-4 rounded-xl font-black shadow-inner border border-primary/20 flex flex-col items-center">
            <span className="text-xs uppercase tracking-widest opacity-60">Unidades Activas</span>
            <span className="text-2xl">{filteredTrackings.length}</span>
          </div>
          <div className="bg-indigo-500/10 text-indigo-500 px-6 py-4 rounded-xl font-black shadow-inner border border-indigo-500/20 flex flex-col items-center">
            <span className="text-xs uppercase tracking-widest opacity-60">Nodos PARADISO</span>
            <span className="text-2xl">{baseMarkers.length}</span>
          </div>
        </div>
      </div>

      {/* Mapa + Overlay */}
      <div className="flex-1 bg-black/5 dark:bg-white/5 rounded-3xl p-2 border border-black/10 relative shadow-inner overflow-hidden flex">

        {/* Panel lateral flotante */}
        <div className="absolute top-6 left-6 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-2xl z-10 overflow-y-auto max-h-[90%] flex flex-col gap-3">

          {/* Unidades en tránsito */}
          <div>
            <h3 className="font-black text-xs uppercase tracking-widest mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <Truck className="w-4 h-4 text-red-500" /> Unidades en Tránsito
            </h3>
            {filteredTrackings.length === 0
              ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Satellite className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold leading-snug">
                    No hay despachos activos<br />en este momento.
                  </p>
                </div>
              )
              : filteredTrackings.map(t => (
                  <div key={t.ID_Tracking} className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 mb-2 border-l-4 border-l-red-500 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-black text-red-500">DSP-{t.ID_Despacho}</p>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Egreso FK: #{t.despacho?.ID_Egreso}</p>
                    <div className="flex justify-between text-[10px] font-black text-blue-600 dark:text-blue-400 mt-1">
                      <span>{parseFloat(t.Latitud).toFixed(4)}</span>
                      <span>{parseFloat(t.Longitud).toFixed(4)}</span>
                    </div>
                  </div>
                ))}
          </div>

          {/* Nodos PARADISO */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
            <h3 className="font-black text-xs uppercase tracking-widest mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-200">
              <MapPin className="w-4 h-4 text-indigo-500" /> Nodos PARADISO
            </h3>
            {baseMarkers.map(bm => (
              <div key={bm.label} className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full shrink-0 border border-white/50 shadow-sm" style={{ background: bm.color }} />
                <span className="text-[10px] font-bold leading-tight text-slate-700 dark:text-slate-300">
                  {bm.type === 'almacen' ? '🏭' : '🏪'} {bm.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <MapViewer
          markers={truckMarkers}
          center={center}
          zoom={10}
          baseMarkers={baseMarkers}
          recenterOnMarker={filteredTrackings.length > 0}
        />
      </div>
    </div>
  );
};
