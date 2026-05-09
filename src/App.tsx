import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { PrivateRoute } from './components/guards/PrivateRoute';
import { RoleGuard } from './components/guards/RoleGuard';
import { CategoriasPage } from './pages/warehouse/CategoriasPage';
import { AlmacenesPage } from './pages/warehouse/AlmacenesPage';
import { ProductosPage } from './pages/warehouse/ProductosPage';
import { IngresosPage } from './pages/inventory/IngresosPage';
import { EgresosPage } from './pages/inventory/EgresosPage';
import { AsignacionDespachosPage } from './pages/logistics/AsignacionDespachosPage';
import { MonitorGPSPage } from './pages/logistics/MonitorGPSPage';
import { ChoferRutaPage } from './pages/logistics/ChoferRutaPage';
import { ProveedoresPage } from './pages/logistics/ProveedoresPage';
import { VehiculosPage } from './pages/logistics/VehiculosPage';
import { RutasPage } from './pages/logistics/RutasPage';
import { ComprasPagosPage } from './pages/finance/ComprasPagosPage';
import { ReportesEstadisticasPage } from './pages/finance/ReportesEstadisticasPage';
import { GestionarComprasPage } from './pages/finance/GestionarComprasPage';
import { CuentasPorPagarPage } from './pages/finance/CuentasPorPagarPage';
import { ProcesarPagoPage } from './pages/finance/ProcesarPagoPage';
import { SeguridadRolesPage } from './pages/auth/SeguridadRolesPage';
import { EmpleadosPage } from './pages/auth/EmpleadosPage';
import { UsuariosPage } from './pages/auth/UsuariosPage';
import api from './services/api';
import { Toaster } from 'sonner';
import { MermasPage } from './pages/inventory/MermasPage';


const RouteChangeListener = () => {
  const location = useLocation();
  useEffect(() => {
    if (!location.pathname.includes('/login')) {
      api.post('/common/visitas/incrementar', { ruta: location.pathname })
        .then(res =>
          window.dispatchEvent(
            new CustomEvent('visit-registered', {
              detail: { count: res.data.total_visitas ?? 0 },
            }),
          ),
        )
        .catch(() => null);
    }
  }, [location.pathname]);
  return null;
};

const DashboardDummy = () => (
  <div className="bg-card border border-divider rounded-2xl p-8 leading-relaxed">
    <div className="flex items-start gap-4 mb-3">
      <span className="w-[3px] h-10 rounded-full bg-primary flex-shrink-0 mt-1" />
      <div>
        <h2 className="text-3xl font-black text-text mb-2">Centro de Inteligencia PARADISO</h2>
        <p className="text-base opacity-60 font-medium">Layout protegido, Role Guards Dinámicos e inyección Axios/JWT operativas.</p>
      </div>
    </div>
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster richColors position="top-right" />
          <RouteChangeListener />
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<PrivateRoute />}>
              <Route path="/" element={<Layout />}>
                {/* Dashboard — accesible para cualquier usuario autenticado */}
                <Route index element={<DashboardDummy />} />

                {/* ── Almacenes ─────────────────────────────────────────── */}
                <Route element={<RoleGuard allowedPermissions={['MODULO_CATALOGO']} />}>
                  <Route path="/inventario/productos" element={<ProductosPage />} />
                  <Route path="/inventario/maestros" element={<CategoriasPage />} />
                </Route>

                <Route element={<RoleGuard allowedPermissions={['MODULO_ALMACEN']} />}>
                  <Route path="/inventario/almacenes" element={<AlmacenesPage />} />
                </Route>

                {/* ── Inventario ────────────────────────────────────────── */}
                <Route element={<RoleGuard allowedPermissions={['MODULO_INVENTARIO']} />}>
                  <Route path="/inventario/ingresos" element={<IngresosPage />} />
                  <Route path="/inventario/egresos" element={<EgresosPage />} />
                  <Route path="/inventario/mermas" element={<MermasPage />} />
                </Route>

                {/* ── Logística ─────────────────────────────────────────── */}
                <Route element={<RoleGuard allowedPermissions={['MODULO_DESPACHOS']} />}>
                  <Route path="/logistica/asignacion" element={<AsignacionDespachosPage />} />
                </Route>

                <Route element={<RoleGuard allowedPermissions={['MODULO_DESPACHOS', 'MODULO_TERMINAL']} />}>
                  <Route path="/logistica/monitor" element={<MonitorGPSPage />} />
                </Route>

                <Route element={<RoleGuard allowedPermissions={['MODULO_TERMINAL']} />}>
                  <Route path="/logistica/chofer" element={<ChoferRutaPage />} />
                </Route>

                <Route element={<RoleGuard allowedPermissions={['MODULO_PROVEEDORES']} />}>
                  <Route path="/logistica/proveedores" element={<ProveedoresPage />} />
                </Route>

                <Route element={<RoleGuard allowedPermissions={['MODULO_TERMINAL']} />}>
                  <Route path="/logistica/vehiculos" element={<VehiculosPage />} />
                </Route>

                <Route element={<RoleGuard allowedPermissions={['MODULO_DESPACHOS']} />}>
                  <Route path="/logistica/rutas" element={<RutasPage />} />
                </Route>

                {/* ── Finanzas y Pagos ──────────────────────────────────── */}
                <Route element={<RoleGuard allowedPermissions={['MODULO_FINANZAS']} />}>
                  <Route path="/finanzas/compras" element={<GestionarComprasPage />} />
                  <Route path="/finanzas/cuentas-por-pagar" element={<CuentasPorPagarPage />} />
                  <Route path="/finanzas/procesar-pago/:id" element={<ProcesarPagoPage />} />
                  <Route path="/pagos" element={<ComprasPagosPage />} />
                </Route>

                {/* ── Reportes ──────────────────────────────────────────── */}
                <Route element={<RoleGuard allowedPermissions={['MODULO_REPORTES']} />}>
                  <Route path="/reportes" element={<ReportesEstadisticasPage />} />
                </Route>

                {/* ── Administración ────────────────────────────────────── */}
                <Route element={<RoleGuard allowedPermissions={['MODULO_SEGURIDAD']} />}>
                  <Route path="/accesos" element={<SeguridadRolesPage />} />
                </Route>

                <Route element={<RoleGuard allowedPermissions={['MODULO_RRHH']} />}>
                  <Route path="/empleados" element={<EmpleadosPage />} />
                </Route>

                <Route element={<RoleGuard allowedPermissions={['MODULO_USUARIOS']} />}>
                  <Route path="/usuarios" element={<UsuariosPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>

          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
