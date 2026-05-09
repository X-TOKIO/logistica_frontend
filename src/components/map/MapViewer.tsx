import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix React-Leaflet default icon path issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// ── Inject CSS for smooth truck movement (runs once) ─────────────────────────

const ensureSmoothTruckCSS = () => {
  if (typeof document === 'undefined' || document.getElementById('leaflet-truck-smooth-css')) return;
  const style = document.createElement('style');
  style.id = 'leaflet-truck-smooth-css';
  style.textContent = `.leaflet-truck-smooth { transition: transform 1000ms linear !important; }`;
  document.head.appendChild(style);
};

// ── Icon Factories ─────────────────────────────────────────────────────────

// Almacén — warehouse/factory SVG (indigo)
const createAlmacenIcon = (color = '#6366f1', size = 36) =>
  L.divIcon({
    html: `
      <div style="width:${size}px;height:${size}px;background:${color};border:3px solid white;border-radius:10px;box-shadow:0 3px 12px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/>
          <path d="M6 18h12"/><rect x="8" y="14" width="8" height="8"/>
        </svg>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: '',
  });

// Sucursal — storefront SVG (uses location color)
const createSucursalIcon = (color = '#10b981', size = 32) =>
  L.divIcon({
    html: `
      <div style="width:${size}px;height:${size}px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 3px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
          <path d="M2 7h20"/>
        </svg>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: '',
  });

// Truck — animated smooth marker
const createTruckIcon = (color = '#3b82f6') => {
  ensureSmoothTruckCSS();
  return L.divIcon({
    html: `
      <div style="position:relative;width:40px;height:40px;">
        <div style="width:40px;height:40px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 3px 14px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          </svg>
        </div>
        <div style="position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:10px;height:10px;background:${color};border-radius:50%;opacity:0.4;animation:truck-ping 1.5s ease-in-out infinite;"></div>
      </div>
      <style>
        @keyframes truck-ping {
          0%,100% { transform: translateX(-50%) scale(1); opacity:0.4; }
          50% { transform: translateX(-50%) scale(2.2); opacity:0; }
        }
      </style>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    className: 'leaflet-truck-smooth',
  });
};

// ── Auto-recenter ──────────────────────────────────────────────────────────────

const Recenter = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng]); }, [lat, lng, map]);
  return null;
};

// ── Props ──────────────────────────────────────────────────────────────────────

export interface MapBaseMarker {
  lat: number;
  lng: number;
  label: string;
  color?: string;
  type?: 'almacen' | 'sucursal';
}

export interface MapMarker {
  lat: number;
  lng: number;
  popup?: React.ReactNode;
  isTruck?: boolean;
  color?: string;
}

interface MapViewerProps {
  markers?: MapMarker[];
  center?: [number, number];
  zoom?: number;
  polyline?: [number, number][];
  baseMarkers?: MapBaseMarker[];
  recenterOnMarker?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const MapViewer = ({
  markers = [],
  center = [-17.7833, -63.1821],
  zoom = 12,
  polyline,
  baseMarkers,
  recenterOnMarker = true,
}: MapViewerProps) => {
  const recenterTarget = markers.find(m => m.isTruck) ?? markers[0];

  return (
    <div className="w-full h-full min-h-[400px] border border-black/10 dark:border-white/10 rounded-[2rem] overflow-hidden shadow-2xl relative z-0">
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', zIndex: 0 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Marcadores base fijos PARADISO — íconos por tipo */}
        {baseMarkers?.map((bm, i) => (
          <Marker
            key={`base-${i}`}
            position={[bm.lat, bm.lng]}
            icon={
              bm.type === 'almacen'
                ? createAlmacenIcon(bm.color ?? '#6366f1')
                : createSucursalIcon(bm.color ?? '#10b981')
            }
          >
            <Popup>
              <div className="font-bold text-xs p-1">
                <p className="font-black mb-0.5" style={{ color: bm.type === 'almacen' ? '#6366f1' : '#10b981' }}>
                  {bm.type === 'almacen' ? '🏭' : '🏪'} {bm.label}
                </p>
                <p className="opacity-60">{bm.lat.toFixed(5)}, {bm.lng.toFixed(5)}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Polyline de ruta OSRM */}
        {polyline && polyline.length > 1 && (
          <Polyline positions={polyline} color="#3b82f6" weight={5} opacity={0.75} dashArray="8,4" />
        )}

        {/* Marcadores de tracking / camiones */}
        {markers.map((m, i) => (
          <Marker
            key={`mk-${i}`}
            position={[m.lat, m.lng]}
            icon={m.isTruck ? createTruckIcon(m.color) : createSucursalIcon(m.color ?? '#ef4444', 28)}
          >
            {m.popup && <Popup>{m.popup}</Popup>}
          </Marker>
        ))}

        {/* Re-centrar en camión activo */}
        {recenterOnMarker && recenterTarget && (
          <Recenter lat={recenterTarget.lat} lng={recenterTarget.lng} />
        )}
      </MapContainer>
    </div>
  );
};
