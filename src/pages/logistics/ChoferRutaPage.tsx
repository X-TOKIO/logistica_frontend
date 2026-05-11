import { toast } from 'sonner';
import { useEffect, useState, useRef, useCallback } from 'react';
import { logisticsApi } from '../../services/logistics';
import { warehouseApi } from '../../services/warehouse';
import {
  MapPin, Navigation, Truck, Activity, AlertTriangle, Play,
  SkipForward, Radio, RefreshCw, History, Clock, Package,
} from 'lucide-react';
import { MapViewer } from '../../components/map/MapViewer';

// ── Types ────────────────────────────────────────────────────────────────────

interface TruckSim {
  despId: number;
  camionId: number;
  waypoints: [number, number][];
  totalDurationMs: number;
  // effectiveStart = Date.now() at the beginning of the CURRENT running session
  // pausedMs       = total accumulated elapsed ms from ALL previous sessions
  // elapsed (while running) = pausedMs + (Date.now() - effectiveStart)
  effectiveStart: number;
  pausedMs: number;
  estado: 'idle' | 'loading' | 'running' | 'paused' | 'emergency' | 'done';
  progress: number; // 0–1
  currentPos: [number, number] | null;
  usedOsrm: boolean;
}

// ── OSRM helpers ─────────────────────────────────────────────────────────────

const fetchOsrmRoute = async (
  sLat: number, sLng: number, eLat: number, eLng: number,
): Promise<[number, number][]> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?geometries=geojson&overview=full`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.length > 0)
      return data.routes[0].geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number],
      );
  } catch { /* silently fall through */ }
  return [];
};

const linearFallback = (
  sLat: number, sLng: number, eLat: number, eLng: number, steps = 200,
): [number, number][] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [sLat + (eLat - sLat) * t, sLng + (eLng - sLng) * t];
  });

const interpolate = (wpts: [number, number][], t: number): [number, number] => {
  if (wpts.length === 0) return [0, 0];
  const clamped = Math.max(0, Math.min(1, t));
  const maxIdx  = wpts.length - 1;
  const fIdx    = clamped * maxIdx;
  const lo      = Math.floor(fIdx);
  const hi      = Math.min(lo + 1, maxIdx);
  const frac    = fIdx - lo;
  return [
    wpts[lo][0] + (wpts[hi][0] - wpts[lo][0]) * frac,
    wpts[lo][1] + (wpts[hi][1] - wpts[lo][1]) * frac,
  ];
};

const fmtPct = (p: number) => `${Math.round(p * 100)}%`;

const fmtTiempoRestante = (sim: TruckSim): string => {
  if (sim.estado === 'done') return 'Completado';
  // While running, effectiveStart is a virtual anchor: now - effectiveStart = total elapsed.
  // While paused/emergency, pausedMs stores the frozen elapsed snapshot.
  const elapsed    = sim.estado === 'running' ? Date.now() - sim.effectiveStart : sim.pausedMs;
  const remaining  = Math.max(0, sim.totalDurationMs - elapsed);
  const mins       = Math.ceil(remaining / 60000);
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m restantes`;
  return `${mins} min restantes`;
};

const labelRuta = (r: any) => {
  if (!r) return '—';
  if (r.Nombre_Ruta) return r.Nombre_Ruta;
  const origen  = r.Origen  || r.almacen?.Nombre  || 'Origen';
  const destino = r.Destino || r.sucursal?.Nombre || 'Destino';
  return `${origen} → ${destino}`;
};

// ── Component ────────────────────────────────────────────────────────────────

export const ChoferRutaPage = () => {
  const [despachos,       setDespachos]       = useState<any[]>([]);
  const [historialViajes, setHistorialViajes] = useState<any[]>([]);
  const [sims,            setSims]            = useState<Record<number, TruckSim>>({});
  const [viewingDespId,   setViewingDespId]   = useState<number | null>(null);
  const [activeTab,       setActiveTab]       = useState<'transito' | 'historial'>('transito');
  const [sucursales,      setSucursales]      = useState<any[]>([]);
  const [almacenes,       setAlmacenes]       = useState<any[]>([]);

  // doneFiredRef: prevents the "done" handler from firing more than once per trip
  const doneFiredRef     = useRef<Set<number>>(new Set());
  // trackThrottleRef: last time a GPS tracking POST was sent per despId
  const trackThrottleRef = useRef<Record<number, number>>({});
  // intervalsRef: one setInterval handle per despId — fully isolated, no shared timer
  const intervalsRef     = useRef<Record<number, ReturnType<typeof setInterval>>>({});
  // initedRef: prevents buildSimFromDB from re-initialising a dispatch that's
  //            already running in this mount session (e.g. user hits "Actualizar")
  const initedRef        = useRef<Set<number>>(new Set());

  // ── Per-dispatch interval factory ─────────────────────────────────────────
  // Each dispatch owns its own 500 ms tick. Starting dispatch A never touches
  // dispatch B's timer or state.

  const startInterval = useCallback((despId: number) => {
    // Replace any stale interval for this dispatch
    if (intervalsRef.current[despId]) clearInterval(intervalsRef.current[despId]);

    intervalsRef.current[despId] = setInterval(() => {
      setSims(prev => {
        const sim = prev[despId];
        // Guard: if the sim was stopped externally, skip and let the interval
        // be cleaned up by emergencyStop / the done branch below.
        if (!sim || sim.estado !== 'running') return prev;

        // Virtual-start model: effectiveStart encodes ALL history, no pausedMs needed.
        const elapsed    = Date.now() - sim.effectiveStart;
        const progress   = Math.min(elapsed / sim.totalDurationMs, 1);
        const currentPos = interpolate(sim.waypoints, progress);

        if (progress >= 1 && !doneFiredRef.current.has(despId)) {
          doneFiredRef.current.add(despId);
          clearInterval(intervalsRef.current[despId]);
          delete intervalsRef.current[despId];
          logisticsApi.updateDespachoProgreso(despId, 1, 'ENTREGADO').catch(() => {});
          logisticsApi.updateVehicleEstado(sim.camionId, 'DISPONIBLE').catch(() => {});
          toast.success(`Camión DSP-${String(despId).padStart(5, '0')} llegó al destino.`);
          return { ...prev, [despId]: { ...sim, estado: 'done', progress: 1, currentPos } };
        }

        // Throttled GPS tracking post (every 15 s)
        const lastTrack = trackThrottleRef.current[despId] ?? 0;
        if (Date.now() - lastTrack >= 15000 && currentPos) {
          trackThrottleRef.current[despId] = Date.now();
          logisticsApi.addTracking({
            ID_Despacho: despId, latitud: currentPos[0], longitud: currentPos[1],
          }).catch(() => {});
        }

        return { ...prev, [despId]: { ...sim, progress, currentPos } };
      });
    }, 500);
  }, []);

  // ── Cleanup: kill all intervals on unmount ────────────────────────────────

  useEffect(() => {
    return () => {
      Object.values(intervalsRef.current).forEach(clearInterval);
      intervalsRef.current = {};
    };
  }, []);

  // ── Cargar nodos PARADISO desde la DB ────────────────────────────────────

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

  // ── Route fetch + sim restoration from DB ────────────────────────────────
  // Called on mount for every EN_RUTA / DETENIDO dispatch found in the DB.
  // Key behaviour for EN_RUTA (offline progress):
  //   1. Compute tiempoFuera = Date.now() - Ultima_Actualizacion_Ms
  //   2. Add that to the accumulated elapsed → new position on the polyline
  //   3. If the trip would already be done, fire ENTREGADO immediately
  //   4. Otherwise start the interval so the truck keeps moving without user input

  const buildSimFromDB = useCallback(async (
    d: any,
    savedProgress: number,
    estadoDB: string,
    ultimaActMs: number | null,
  ) => {
    const ruta     = d.despacho?.ruta;
    const despId   = d.despacho?.ID_Despacho as number;
    const camionId = d.camion?.ID_Camion as number;

    if (!ruta) return;
    // Already initialised in this mount session — don't clobber a running sim
    if (initedRef.current.has(despId)) return;
    initedRef.current.add(despId);

    const sLat = parseFloat(ruta.LatitudOrigen);
    const sLng = parseFloat(ruta.LongitudOrigen);
    const eLat = parseFloat(ruta.LatitudDestino);
    const eLng = parseFloat(ruta.LongitudDestino);
    if (isNaN(sLat) || isNaN(eLat)) return;

    // Show loading state while OSRM is fetched
    setSims(prev => ({
      ...prev,
      [despId]: {
        ...(prev[despId] ?? {}),
        despId, camionId,
        waypoints: [], totalDurationMs: 0, effectiveStart: 0, pausedMs: 0,
        estado: 'loading', progress: savedProgress, currentPos: null, usedOsrm: false,
      } as TruckSim,
    }));

    let waypoints = await fetchOsrmRoute(sLat, sLng, eLat, eLng);
    const isOsrm  = waypoints.length > 0;
    if (!isOsrm) waypoints = linearFallback(sLat, sLng, eLat, eLng, 300);

    const tiempoHoras     = Number(ruta.Tiempo_Estimado_Horas) || 0.5;
    const totalDurationMs = tiempoHoras * 3600 * 1000;

    // Base elapsed reconstructed from the stored progress percentage
    let elapsedMs = savedProgress * totalDurationMs;

    // ── Offline progress (TAREA 2 core) ──────────────────────────────────────
    // If the truck was EN_RUTA when the user left, accumulate the dead time.
    // The backend stamps Ultima_Actualizacion_Ms on every EN_RUTA transition.
    if (estadoDB === 'EN_RUTA' && ultimaActMs) {
      elapsedMs = Math.min(elapsedMs + (Date.now() - ultimaActMs), totalDurationMs);
    }

    const progress = elapsedMs / totalDurationMs;

    // Trip already completed while user was away — mark delivered immediately
    if (progress >= 1 && !doneFiredRef.current.has(despId)) {
      doneFiredRef.current.add(despId);
      setSims(prev => ({
        ...prev,
        [despId]: {
          despId, camionId, waypoints, totalDurationMs,
          effectiveStart: 0, pausedMs: totalDurationMs,
          estado: 'done', progress: 1,
          currentPos: interpolate(waypoints, 1),
          usedOsrm: isOsrm,
        },
      }));
      logisticsApi.updateDespachoProgreso(despId, 1, 'ENTREGADO').catch(() => {});
      logisticsApi.updateVehicleEstado(camionId, 'DISPONIBLE').catch(() => {});
      toast.success(`DSP-${String(despId).padStart(5, '0')} fue entregado mientras estabas fuera.`);
      return;
    }

    const isRunning = estadoDB === 'EN_RUTA';

    setSims(prev => ({
      ...prev,
      [despId]: {
        despId, camionId, waypoints, totalDurationMs,
        // Running: virtual anchor so (now - effectiveStart) == total elapsed and grows naturally.
        // Paused:  effectiveStart unused; pausedMs holds the frozen elapsed snapshot.
        effectiveStart: isRunning ? Date.now() - elapsedMs : 0,
        pausedMs:       isRunning ? 0 : elapsedMs,
        estado: isRunning ? 'running' : 'paused',
        progress,
        currentPos: interpolate(waypoints, progress),
        usedOsrm: isOsrm,
      },
    }));

    if (isRunning) {
      // Auto-resume: no user interaction required
      startInterval(despId);
      toast.info(`Trayecto DSP-${String(despId).padStart(5, '0')} reanudado automáticamente.`);
    } else {
      toast.info(`Trayecto DSP-${String(despId).padStart(5, '0')} restaurado. Presiona Continuar.`);
    }
  }, [startInterval]);

  // ── Load despachos ────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [activosRes, histRes] = await Promise.allSettled([
        logisticsApi.getActivos(),
        logisticsApi.getHistorial(),
      ]);

      const activos = activosRes.status === 'fulfilled' ? activosRes.value : [];
      const hist    = histRes.status    === 'fulfilled' ? histRes.value    : [];

      setDespachos(activos);
      setHistorialViajes(
        (hist as any[]).filter(dc => dc.despacho?.Estado_Despacho === 'ENTREGADO'),
      );

      // Set the first dispatch as viewed only when nothing is selected yet
      if (activos.length > 0) {
        setViewingDespId(prev => prev === null ? (activos[0].despacho?.ID_Despacho ?? null) : prev);
      }

      // Restore sims for dispatches that were active when the user last left
      for (const d of activos as any[]) {
        const estadoDB      = d.despacho?.Estado_Despacho as string;
        const savedProgress = Number(d.despacho?.Progreso_Porcentaje ?? 0);
        void d.despacho?.ID_Despacho; // referenciado via buildSimFromDB(d, ...)
        // Ultima_Actualizacion_Ms is a float column → arrives as number (or null)
        const ultimaActMs   = d.despacho?.Ultima_Actualizacion_Ms != null
          ? Number(d.despacho.Ultima_Actualizacion_Ms)
          : null;

        if (estadoDB === 'EN_RUTA' || (estadoDB === 'DETENIDO' && savedProgress > 0)) {
          buildSimFromDB(d, savedProgress, estadoDB, ultimaActMs);
        }
      }
    } catch {
      toast.error('No se pudieron cargar los despachos activos.');
    }
  }, [buildSimFromDB]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const startTrip = async (d: any) => {
    const ruta     = d.despacho?.ruta;
    const despId   = d.despacho?.ID_Despacho as number;
    const camionId = d.camion?.ID_Camion as number;

    if (!ruta) return toast.error('El despacho no tiene ruta asignada.');

    const sLat = parseFloat(ruta.LatitudOrigen);
    const sLng = parseFloat(ruta.LongitudOrigen);
    const eLat = parseFloat(ruta.LatitudDestino);
    const eLng = parseFloat(ruta.LongitudDestino);

    if (isNaN(sLat) || isNaN(eLat))
      return toast.error('La ruta no tiene coordenadas GPS. Regístrala desde "Gestionar Rutas".');

    // Kill any leftover interval and mark as initialised so loadData
    // doesn't clobber this new trip if the user hits Actualizar mid-fetch
    if (intervalsRef.current[despId]) {
      clearInterval(intervalsRef.current[despId]);
      delete intervalsRef.current[despId];
    }
    doneFiredRef.current.delete(despId);
    initedRef.current.add(despId);

    setSims(prev => ({
      ...prev,
      [despId]: {
        ...(prev[despId] ?? {}),
        despId, camionId,
        waypoints: [], totalDurationMs: 0, effectiveStart: 0, pausedMs: 0,
        estado: 'loading', progress: 0, currentPos: null, usedOsrm: false,
      } as TruckSim,
    }));
    setViewingDespId(despId);

    let waypoints = await fetchOsrmRoute(sLat, sLng, eLat, eLng);
    const isOsrm  = waypoints.length > 0;

    if (!isOsrm) {
      waypoints = linearFallback(sLat, sLng, eLat, eLng, 300);
      toast.warning('OSRM sin respuesta. Usando interpolación lineal de respaldo.');
    } else {
      toast.success(`Ruta OSRM cargada: ${waypoints.length} waypoints.`);
    }

    const tiempoHoras     = Number(ruta.Tiempo_Estimado_Horas) || 0.5;
    const totalDurationMs = tiempoHoras * 3600 * 1000;

    // Stage the sim in running state with a placeholder effectiveStart.
    // We overwrite it after the PATCH so it aligns with the DB's Ultima_Actualizacion_Ms.
    setSims(prev => ({
      ...prev,
      [despId]: {
        despId, camionId,
        waypoints,
        totalDurationMs,
        effectiveStart: 0,
        pausedMs: 0,
        estado: 'running',
        progress: 0,
        currentPos: waypoints[0] ?? null,
        usedOsrm: isOsrm,
      },
    }));

    // TAREA 1: Await the PATCH so Ultima_Actualizacion_Ms is committed before the
    // interval starts. This prevents the 0%-reset race condition on remount.
    try {
      await logisticsApi.updateDespachoProgreso(despId, 0, 'EN_RUTA');
    } catch {
      toast.error('Error al registrar inicio de viaje. Reintenta.');
      return;
    }
    logisticsApi.updateVehicleEstado(camionId, 'EN_RUTA').catch(() => {});

    // Set the virtual start AFTER the PATCH response — as close as possible to
    // the server-stamped Ultima_Actualizacion_Ms, so remount hydration is accurate.
    const tripStart = Date.now();
    setSims(prev => ({ ...prev, [despId]: { ...prev[despId], effectiveStart: tripStart } }));

    // Start this dispatch's own isolated interval — does NOT affect other dispatches
    startInterval(despId);
  };

  const emergencyStop = (despId: number, camionId: number) => {
    // Clear the interval synchronously before touching state
    if (intervalsRef.current[despId]) {
      clearInterval(intervalsRef.current[despId]);
      delete intervalsRef.current[despId];
    }

    setSims(prev => {
      const sim = prev[despId];
      if (!sim || sim.estado !== 'running') return prev;
      // Virtual-start model: all elapsed history is encoded in effectiveStart.
      const totalElapsed = Date.now() - sim.effectiveStart;
      const newProgress  = Math.min(totalElapsed / sim.totalDurationMs, 1);
      logisticsApi.updateDespachoProgreso(despId, newProgress, 'DETENIDO').catch(() => {});
      return {
        ...prev,
        [despId]: { ...sim, estado: 'emergency', pausedMs: totalElapsed, progress: newProgress },
      };
    });

    logisticsApi.updateVehicleEstado(camionId, 'MANTENIMIENTO').catch(() => {});
    toast.warning('Camión detenido por emergencia. Estado → MANTENIMIENTO.');
  };

  const continueTrip = (despId: number, camionId: number) => {
    setSims(prev => {
      const sim = prev[despId];
      if (!sim || (sim.estado !== 'paused' && sim.estado !== 'emergency')) return prev;
      logisticsApi.updateDespachoProgreso(despId, sim.progress, 'EN_RUTA').catch(() => {});
      return {
        ...prev,
        [despId]: {
          ...sim,
          estado: 'running',
          // Re-anchor: (now - effectiveStart) will equal sim.pausedMs at this moment
          // and then grow naturally — no pausedMs accumulation needed.
          effectiveStart: Date.now() - sim.pausedMs,
          pausedMs: 0,
        },
      };
    });

    // Restart isolated interval for this dispatch
    startInterval(despId);
    logisticsApi.updateVehicleEstado(camionId, 'EN_RUTA').catch(() => {});
    toast.success('Trayecto reanudado. Estado → EN RUTA.');
  };

  // ── Derived data for map ──────────────────────────────────────────────────

  const viewingSim  = viewingDespId !== null ? sims[viewingDespId] : null;
  const viewingDesp = despachos.find(d => d.despacho?.ID_Despacho === viewingDespId);
  const runningCount = Object.values(sims).filter(s => s.estado === 'running').length;

  const baseMarkers = [
    ...sucursales
      .filter(s => s.Latitud && s.Longitud)
      .map(s => ({ lat: parseFloat(s.Latitud), lng: parseFloat(s.Longitud), label: s.Nombre, color: s.Color ?? '#10b981', type: (s.Tipo ?? 'sucursal') as 'almacen' | 'sucursal' })),
    ...almacenes
      .filter(a => a.Latitud && a.Longitud)
      .map(a => ({ lat: parseFloat(a.Latitud), lng: parseFloat(a.Longitud), label: a.Nombre, color: a.Color ?? '#6366f1', type: 'almacen' as const })),
  ];

  const truckMarkers = viewingSim?.currentPos
    ? [{
        lat: viewingSim.currentPos[0],
        lng: viewingSim.currentPos[1],
        isTruck: true,
        color: viewingSim.estado === 'emergency' ? '#ef4444' : '#22d3ee',
        popup: (
          <div className="font-bold text-xs p-1">
            <p className="font-black text-cyan-600">{viewingDesp?.camion?.Placa ?? 'CAMIÓN'}</p>
            <p className="opacity-60">LAT {viewingSim.currentPos[0].toFixed(5)}</p>
            <p className="opacity-60">LNG {viewingSim.currentPos[1].toFixed(5)}</p>
            <p className="text-green-600 font-black mt-1">Progreso: {fmtPct(viewingSim.progress)}</p>
          </div>
        ),
      }]
    : [];

  // ── Estado badge helper ───────────────────────────────────────────────────

  const estadoBadge = (estado: TruckSim['estado'] | undefined) => {
    switch (estado) {
      case 'running':   return { cls: 'bg-green-500/15 text-green-500',   label: '● EN RUTA' };
      case 'emergency': return { cls: 'bg-red-500/15 text-red-500',       label: '⚠ DETENIDO' };
      case 'done':      return { cls: 'bg-blue-500/15 text-blue-500',     label: '✓ LLEGÓ' };
      case 'loading':   return { cls: 'bg-yellow-500/15 text-yellow-500', label: '⋯ CARGANDO' };
      case 'paused':    return { cls: 'bg-amber-500/15 text-amber-500',   label: '‖ PAUSA' };
      default:          return { cls: 'bg-gray-500/10 text-gray-400',     label: 'EN ESPERA' };
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 w-full h-[88vh] relative z-10 transition-all duration-300">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/60 dark:bg-black/60 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-3xl px-6 py-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-60 h-60 bg-green-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div>
          <h2 className="text-2xl font-black text-primary flex items-center gap-3">
            <Truck className="w-7 h-7" /> Terminal Vehicular Multi-Tracking
          </h2>
          <p className="font-bold opacity-60 mt-0.5 text-sm flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${runningCount > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {runningCount > 0 ? `${runningCount} camión(es) en tránsito — GPS Activo` : 'Sin viajes en curso'}
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 text-xs font-black border border-black/15 dark:border-white/15 px-4 py-2 rounded-xl hover:border-primary/40 hover:text-primary transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-3 p-1.5 bg-white/60 dark:bg-black/60 rounded-2xl backdrop-blur-md w-max border border-black/10 dark:border-white/10">
        <button
          onClick={() => setActiveTab('transito')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${
            activeTab === 'transito'
              ? 'bg-primary text-white shadow-[0_0_12px_rgba(var(--color-primary),0.35)]'
              : 'text-text hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <Navigation className="w-4 h-4" /> En Tránsito
          {despachos.length > 0 && (
            <span className="bg-current/20 text-[10px] font-black px-1.5 py-0.5 rounded-full">{despachos.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${
            activeTab === 'historial'
              ? 'bg-primary text-white shadow-[0_0_12px_rgba(var(--color-primary),0.35)]'
              : 'text-text hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <History className="w-4 h-4" /> Historial de Viajes
          {historialViajes.length > 0 && (
            <span className="bg-current/20 text-[10px] font-black px-1.5 py-0.5 rounded-full">{historialViajes.length}</span>
          )}
        </button>
      </div>

      {/* ── EN TRÁNSITO tab ── */}
      {activeTab === 'transito' && (
        <div className="flex gap-4 flex-1 min-h-0">

          {/* Sidebar */}
          <div className="w-72 flex flex-col gap-2 overflow-y-auto pb-2">
            {despachos.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full opacity-30 gap-3 py-16">
                <Navigation className="w-12 h-12 animate-bounce" />
                <p className="font-black text-sm text-center uppercase tracking-widest">Sin Viajes Asignados</p>
              </div>
            )}

            {despachos.map(d => {
              const despId  = d.despacho?.ID_Despacho as number;
              const camId   = d.camion?.ID_Camion as number;
              const sim     = sims[despId];
              const ruta    = d.despacho?.ruta;
              const isView  = viewingDespId === despId;
              const { cls, label } = estadoBadge(sim?.estado);

              return (
                <div
                  key={despId}
                  onClick={() => setViewingDespId(despId)}
                  className={`bg-white/60 dark:bg-black/60 backdrop-blur-md border rounded-2xl p-4 flex flex-col gap-3 cursor-pointer transition-all select-none
                    ${isView ? 'border-primary shadow-lg shadow-primary/15 ring-1 ring-primary/30' : 'border-black/10 dark:border-white/10 hover:border-primary/30'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border
                      ${sim?.estado === 'running'   ? 'bg-green-500/15 border-green-500/20'
                      : sim?.estado === 'emergency' ? 'bg-red-500/15 border-red-500/20'
                      : sim?.estado === 'done'      ? 'bg-blue-500/15 border-blue-500/20'
                      : 'bg-gray-500/8 border-black/5 dark:border-white/5'}`}>
                      <Truck className={`w-5 h-5 ${
                        sim?.estado === 'running'   ? 'text-green-500'
                        : sim?.estado === 'emergency' ? 'text-red-500'
                        : sim?.estado === 'done'      ? 'text-blue-500'
                        : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm truncate">{d.camion?.Placa ?? '—'}</p>
                      <p className="text-[10px] font-bold opacity-50 truncate">{d.camion?.Modelo ?? ''}</p>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full shrink-0 ${cls}`}>
                      {label}
                    </span>
                  </div>

                  {ruta && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold opacity-55">
                      <MapPin className="w-3 h-3 shrink-0 text-primary" />
                      <span className="truncate">{ruta.Origen ?? '—'} → {ruta.Destino ?? '—'}</span>
                    </div>
                  )}

                  {sim && sim.progress > 0 && (
                    <div>
                      <div className="h-1.5 bg-black/8 dark:bg-white/8 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ${
                            sim.estado === 'done'      ? 'bg-blue-500'
                            : sim.estado === 'emergency' ? 'bg-red-500'
                            : 'bg-green-500'}`}
                          style={{ width: `${sim.progress * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-black opacity-50 mt-0.5">
                        <span>{fmtPct(sim.progress)}</span>
                        <span>{fmtTiempoRestante(sim)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                    {(!sim || sim.estado === 'idle') && (
                      <button
                        onClick={() => startTrip(d)}
                        className="flex-1 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white text-[10px] font-black uppercase rounded-xl py-2 flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-green-500/20"
                      >
                        <Play className="w-3 h-3" /> Iniciar Viaje
                      </button>
                    )}

                    {sim?.estado === 'loading' && (
                      <div className="flex-1 bg-yellow-500/10 text-yellow-500 text-[10px] font-black uppercase rounded-xl py-2 flex items-center justify-center gap-1.5 border border-yellow-500/20 animate-pulse">
                        <Activity className="w-3 h-3" /> Cargando ruta…
                      </div>
                    )}

                    {sim?.estado === 'running' && (
                      <button
                        onClick={() => emergencyStop(despId, camId)}
                        className="flex-1 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white text-[10px] font-black uppercase rounded-xl py-2 flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-red-500/20"
                      >
                        <AlertTriangle className="w-3 h-3" /> Detener (Emergencia)
                      </button>
                    )}

                    {(sim?.estado === 'emergency' || sim?.estado === 'paused') && (
                      <button
                        onClick={() => continueTrip(despId, camId)}
                        className="flex-1 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white text-[10px] font-black uppercase rounded-xl py-2 flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-green-500/20"
                      >
                        <SkipForward className="w-3 h-3" /> Continuar Trayecto
                      </button>
                    )}

                    {sim?.estado === 'done' && (
                      <div className="flex-1 bg-blue-500/10 text-blue-500 text-[10px] font-black uppercase rounded-xl py-2 flex items-center justify-center gap-1.5 border border-blue-500/20">
                        ✓ Entregado
                      </div>
                    )}

                    {isView && (
                      <div className="bg-primary/10 text-primary text-[9px] font-black uppercase rounded-xl px-2.5 py-2 flex items-center gap-1 border border-primary/20">
                        <Radio className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Map + info bar */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            {viewingDesp && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-white/40 dark:bg-black/40 backdrop-blur-md rounded-2xl px-5 py-3 border border-black/5 dark:border-white/5">
                <div>
                  <p className="text-[9px] font-black uppercase opacity-40 tracking-wider">Vehículo</p>
                  <p className="font-black text-sm text-primary">{viewingDesp.camion?.Placa} — {viewingDesp.camion?.Modelo}</p>
                </div>
                <div className="border-l border-black/10 dark:border-white/10 pl-6">
                  <p className="text-[9px] font-black uppercase opacity-40 tracking-wider">Ruta</p>
                  <p className="font-bold text-sm">{viewingDesp.despacho?.ruta?.Origen} → {viewingDesp.despacho?.ruta?.Destino}</p>
                </div>
                {viewingSim && viewingSim.progress > 0 && (
                  <div className="border-l border-black/10 dark:border-white/10 pl-6">
                    <p className="text-[9px] font-black uppercase opacity-40 tracking-wider">Progreso</p>
                    <p className="font-black text-sm text-green-500">{fmtPct(viewingSim.progress)} — {fmtTiempoRestante(viewingSim)}</p>
                  </div>
                )}
                {viewingSim?.usedOsrm && (
                  <span className="ml-auto text-[9px] font-black bg-green-500/15 text-green-500 px-2.5 py-1 rounded-full border border-green-500/20">
                    OSRM ✓ Ruta Real
                  </span>
                )}
              </div>
            )}

            <div className="flex-1 bg-black/5 dark:bg-white/5 rounded-3xl p-2 border border-black/10 relative overflow-hidden shadow-inner min-h-0">
              {despachos.length > 0 ? (
                <MapViewer
                  markers={truckMarkers}
                  center={viewingSim?.currentPos ?? [-17.764656, -63.204454]}
                  zoom={viewingSim?.currentPos ? 13 : 11}
                  polyline={viewingSim?.waypoints ?? []}
                  baseMarkers={baseMarkers}
                  recenterOnMarker={!!viewingSim?.currentPos}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center opacity-25 gap-4">
                  <Navigation className="w-20 h-20 animate-bounce" />
                  <h3 className="text-xl font-black uppercase tracking-widest text-center">
                    Esperando Despachos Activos
                  </h3>
                  <p className="text-sm font-bold opacity-60">Asigna despachos desde el módulo de Asignación</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORIAL DE VIAJES tab ── */}
      {activeTab === 'historial' && (
        <div className="flex-1 bg-white/60 dark:bg-black/60 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-[2rem] p-6 shadow-2xl overflow-auto relative">
          <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
          <h3 className="text-xl font-black mb-5 flex items-center gap-2 relative z-10">
            <History className="w-5 h-5 text-blue-500" /> Viajes Entregados
          </h3>

          {historialViajes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 opacity-30 gap-4">
              <Package className="w-16 h-16" />
              <p className="font-black uppercase tracking-widest text-sm">Sin entregas registradas aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto relative z-10">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b-2 border-black/10 dark:border-white/10">
                    {['Despacho', 'Ruta', 'Vehículo', 'Conductor', 'Salida', 'Entrega Est.', 'Estado'].map(h => (
                      <th key={h} className="py-3 px-4 text-left text-[10px] uppercase tracking-widest font-black opacity-50">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {historialViajes.map((dc, idx) => {
                    const desp = dc.despacho;
                    const ruta = desp?.ruta;
                    const cam  = dc.camion;
                    const emp  = cam?.empleado;
                    return (
                      <tr key={`${dc.ID_Despacho ?? idx}-${dc.ID_Camion ?? idx}`}
                          className="hover:bg-black/3 dark:hover:bg-white/3 transition-colors">
                        <td className="py-3 px-4 font-black text-primary text-sm">
                          DSP-{String(desp?.ID_Despacho ?? '—').padStart(5, '0')}
                        </td>
                        <td className="py-3 px-4 font-bold text-xs flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary shrink-0" />
                          {labelRuta(ruta)}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-xs">{cam?.Placa || 'N/A'}</td>
                        <td className="py-3 px-4 font-bold text-xs">
                          {emp ? `${emp.Nombre || ''} ${emp.Apellido || emp.Apellidos || ''}`.trim() : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-xs opacity-70">
                          {desp?.FechaHora_Salida
                            ? new Date(desp.FechaHora_Salida).toLocaleString('es-BO')
                            : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-xs opacity-70 flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          {desp?.FechaHora_Estimada_Entrega
                            ? new Date(desp.FechaHora_Estimada_Entrega).toLocaleString('es-BO')
                            : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black border bg-green-500/10 text-green-500 border-green-500/20">
                            ✓ ENTREGADO
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
