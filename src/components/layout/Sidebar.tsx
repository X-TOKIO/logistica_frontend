import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, LayoutDashboard, Package, Truck, Tags, Store,
  ArrowDownToLine, ArrowUpFromLine, Navigation, Satellite,
  ShieldAlert, Users, ChevronDown, UserCog, FileWarning, ClipboardList,
  Building2, Car, MapPinned, ShoppingBag, Banknote, Receipt, BarChart2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';

// ── Types ──────────────────────────────────────────────────────────────────

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

type AccordionGroupProps = {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

type NavItemProps = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  hoverBg?: string;
  iconColor?: string;
  size?: 'sm' | 'md';
  active?: boolean;
  activeBg?: string;
  activeBorderColor?: string;
};

// ── Sub-components ─────────────────────────────────────────────────────────

const AccordionGroup = ({ title, icon, isOpen, onToggle, children }: AccordionGroupProps) => (
  <div>
    <button
      onClick={onToggle}
      className="flex items-center justify-between w-full px-3 py-2.5 rounded-md text-left hover:bg-black/5 dark:hover:bg-white/5 transition-all group"
    >
      <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-text opacity-50 group-hover:opacity-80 transition-opacity">
        <span className="opacity-80">{icon}</span>
        {title}
      </span>
      <motion.span
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="text-text opacity-30 group-hover:opacity-60 flex-shrink-0"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </motion.span>
    </button>

    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="accordion-content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-1 pt-1 pl-2">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

const NavItem = ({
  icon, label, onClick,
  hoverBg = 'hover:bg-primary',
  iconColor = 'text-primary',
  size = 'md',
  active = false,
  activeBg = 'bg-primary/15',
  activeBorderColor = 'bg-primary',
}: NavItemProps) => (
  <button
    onClick={onClick}
    className={`relative group flex items-center gap-3 w-full rounded-md transition-all duration-200 text-left font-bold text-text border border-transparent overflow-hidden ${size === 'sm' ? 'px-3 py-2.5 text-sm' : 'px-4 py-3.5'
      } ${active
        ? `${activeBg} border-black/5 dark:border-white/5`
        : `${hoverBg} hover:border-black/5 dark:hover:border-white/5`
      }`}
  >
    {active && (
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-r-sm ${activeBorderColor}`} />
    )}
    <span className={`${iconColor} flex-shrink-0 transition-colors ${!active ? 'group-hover:text-background' : ''}`}>
      {icon}
    </span>
    <span className={`tracking-wide transition-colors ${!active ? 'group-hover:text-background' : ''}`}>
      {label}
    </span>
  </button>
);

// ── Sidebar ────────────────────────────────────────────────────────────────

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const at = (path: string) => location.pathname === path;
  const startsWith = (prefix: string) => location.pathname.startsWith(prefix);

  // ── Permisos por módulo — completamente dinámicos desde el array del usuario ─
  const canCatalogo    = hasPermission('MODULO_CATALOGO');
  const canAlmacen     = hasPermission('MODULO_ALMACEN');
  const canInventario  = hasPermission('MODULO_INVENTARIO');
  const canDespachos   = hasPermission('MODULO_DESPACHOS');
  const canTerminal    = hasPermission('MODULO_TERMINAL');
  const canProveedores = hasPermission('MODULO_PROVEEDORES');
  const canFinanzas    = hasPermission('MODULO_FINANZAS');
  const canReportes    = hasPermission('MODULO_REPORTES');
  const canRRHH        = hasPermission('MODULO_RRHH');
  const canUsuarios    = hasPermission('MODULO_USUARIOS');
  const canSeguridad   = hasPermission('MODULO_SEGURIDAD');

  // ── Visibilidad de grupos ────────────────────────────────────────────
  const showAlmacenes = canCatalogo || canAlmacen;
  const showInventario = canInventario;
  const showLogistica = canDespachos || canTerminal;
  const showFinanzas = canFinanzas;
  const showReportes = canReportes;
  const showAdmin = canRRHH || canUsuarios || canSeguridad;

  // ── Accordion state ──────────────────────────────────────────────────
  const [openAlmacenes, setOpenAlmacenes] = useState(() => startsWith('/inventario/maestros') || startsWith('/inventario/productos') || startsWith('/inventario/almacenes'));
  const [openInventario, setOpenInventario] = useState(() => startsWith('/inventario/ingresos') || startsWith('/inventario/egresos') || startsWith('/inventario/mermas'));
  const [openLogistica, setOpenLogistica] = useState(() => startsWith('/logistica'));
  const [openFinanzas, setOpenFinanzas] = useState(() => startsWith('/finanzas'));
  const [openReportes, setOpenReportes] = useState(() => startsWith('/reportes'));
  const [openAdmin, setOpenAdmin] = useState(() => ['/accesos', '/empleados', '/usuarios'].some(p => startsWith(p)));

  const go = (path: string) => {
    navigate(path);
    onClose();
  };

  // ── Jovenes Light: sidebar oscuro professional ────────────────────────
  const { theme, setTheme, mode } = useTheme();
  const _h = new Date().getHours();
  const _dark = mode === 'dark' || (mode === 'auto' && (_h >= 18 || _h < 6));
  const jl = theme === 'jovenes' && !_dark;
  const sidebarVars = jl ? {
    '--color-sidebar': '#1E1E1E',
    '--color-text': 'rgba(255, 255, 255, 0.88)',
    '--color-divider': 'rgba(255, 255, 255, 0.10)',
  } as React.CSSProperties : {};

  return (
    <aside
      style={sidebarVars}
      className={`w-64 h-screen fixed left-0 top-0 bg-sidebar border-r border-divider flex flex-col z-20 transition-all duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
    >

      {/* Logo */}
      <div className="flex flex-col items-center justify-center py-4 px-6 border-b border-divider bg-sidebar h-28">
        <div className="flex flex-col items-center rounded-md px-3 py-2">
          <img
            src="/logo-paradiso.png"
            alt="PARADISO"
            className="w-auto max-h-14 object-contain drop-shadow-sm brightness-100 hover:brightness-110 transition-all duration-300 ease-in-out"
          />
          <span className="mt-1.5 tracking-[0.2em] text-[9px] uppercase text-yellow-700 dark:text-yellow-600/80 font-sans select-none">
            LICORERÍA PREMIUM
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-5 flex flex-col gap-1.5 px-3 overflow-y-auto custom-scrollbar">

        {/* Dashboard — siempre visible */}
        <NavItem
          icon={<LayoutDashboard className="h-5 w-5" />}
          label="Dashboard"
          onClick={() => go('/')}
          hoverBg="hover:bg-primary"
          iconColor="text-secondary"
          active={at('/')}
          activeBg="bg-secondary/15"
          activeBorderColor="bg-secondary"
        />

        {/* ── ALMACENES ── */}
        {showAlmacenes && (
          <AccordionGroup
            title="ALMACENES"
            icon={<Store className="w-3.5 h-3.5" />}
            isOpen={openAlmacenes}
            onToggle={() => setOpenAlmacenes(v => !v)}
          >
            {canCatalogo && (
              <NavItem
                size="sm"
                icon={<Tags className="h-4 w-4" />}
                label="Maestros (Cat/Med)"
                onClick={() => go('/inventario/maestros')}
                hoverBg="hover:bg-primary"
                iconColor="text-primary"
                active={at('/inventario/maestros')}
                activeBg="bg-primary/15"
                activeBorderColor="bg-primary"
              />
            )}
            {canCatalogo && (
              <NavItem
                size="sm"
                icon={<Package className="h-4 w-4" />}
                label="Catálogo Productos"
                onClick={() => go('/inventario/productos')}
                hoverBg="hover:bg-primary"
                iconColor="text-primary"
                active={at('/inventario/productos')}
                activeBg="bg-primary/15"
                activeBorderColor="bg-primary"
              />
            )}
            {canAlmacen && (
              <NavItem
                size="sm"
                icon={<Store className="h-4 w-4" />}
                label="Almacenes"
                onClick={() => go('/inventario/almacenes')}
                hoverBg="hover:bg-primary"
                iconColor="text-primary"
                active={at('/inventario/almacenes')}
                activeBg="bg-primary/15"
                activeBorderColor="bg-primary"
              />
            )}
          </AccordionGroup>
        )}

        {/* ── INVENTARIO ── */}
        {showInventario && (
          <AccordionGroup
            title="INVENTARIO"
            icon={<ClipboardList className="w-3.5 h-3.5" />}
            isOpen={openInventario}
            onToggle={() => setOpenInventario(v => !v)}
          >
            <NavItem
              size="sm"
              icon={<ArrowDownToLine className="h-4 w-4" />}
              label="Notas de Ingreso"
              onClick={() => go('/inventario/ingresos')}
              hoverBg="hover:bg-green-500"
              iconColor="text-green-500"
              active={at('/inventario/ingresos')}
              activeBg="bg-green-500/15"
              activeBorderColor="bg-green-500"
            />
            <NavItem
              size="sm"
              icon={<ArrowUpFromLine className="h-4 w-4" />}
              label="Notas de Egreso"
              onClick={() => go('/inventario/egresos')}
              hoverBg="hover:bg-red-500"
              iconColor="text-red-500"
              active={at('/inventario/egresos')}
              activeBg="bg-red-500/15"
              activeBorderColor="bg-red-500"
            />
            <NavItem
              size="sm"
              icon={<FileWarning className="h-4 w-4" />}
              label="Control de Mermas"
              onClick={() => go('/inventario/mermas')}
              hoverBg="hover:bg-orange-500"
              iconColor="text-orange-500"
              active={at('/inventario/mermas')}
              activeBg="bg-orange-500/15"
              activeBorderColor="bg-orange-500"
            />
          </AccordionGroup>
        )}

        {/* ── Logística Terrestre ── */}
        {showLogistica && (
          <AccordionGroup
            title="Logística Terrestre"
            icon={<Truck className="w-3.5 h-3.5" />}
            isOpen={openLogistica}
            onToggle={() => setOpenLogistica(v => !v)}
          >
            {canDespachos && (
              <NavItem
                size="sm"
                icon={<Truck className="h-4 w-4" />}
                label="Asignar Despacho"
                onClick={() => go('/logistica/asignacion')}
                hoverBg="hover:bg-primary"
                iconColor="text-blue-500"
                active={at('/logistica/asignacion')}
                activeBg="bg-blue-500/15"
                activeBorderColor="bg-blue-500"
              />
            )}
            {canTerminal && (
              <NavItem
                size="sm"
                icon={<Navigation className="h-4 w-4" />}
                label="Terminal Vehicular"
                onClick={() => go('/logistica/chofer')}
                hoverBg="hover:bg-green-500"
                iconColor="text-green-500"
                active={at('/logistica/chofer')}
                activeBg="bg-green-500/15"
                activeBorderColor="bg-green-500"
              />
            )}
            {(canDespachos || canTerminal) && (
              <NavItem
                size="sm"
                icon={<Satellite className="h-4 w-4" />}
                label="Monitor Satelital"
                onClick={() => go('/logistica/monitor')}
                hoverBg="hover:bg-secondary"
                iconColor="text-secondary"
                active={at('/logistica/monitor')}
                activeBg="bg-secondary/15"
                activeBorderColor="bg-secondary"
              />
            )}
            {canTerminal && (
              <NavItem
                size="sm"
                icon={<Car className="h-4 w-4" />}
                label="Gestionar Vehículos"
                onClick={() => go('/logistica/vehiculos')}
                hoverBg="hover:bg-cyan-500"
                iconColor="text-cyan-500"
                active={at('/logistica/vehiculos')}
                activeBg="bg-cyan-500/15"
                activeBorderColor="bg-cyan-500"
              />
            )}
            {canDespachos && (
              <NavItem
                size="sm"
                icon={<MapPinned className="h-4 w-4" />}
                label="Gestionar Rutas"
                onClick={() => go('/logistica/rutas')}
                hoverBg="hover:bg-violet-500"
                iconColor="text-violet-500"
                active={at('/logistica/rutas')}
                activeBg="bg-violet-500/15"
                activeBorderColor="bg-violet-500"
              />
            )}
          </AccordionGroup>
        )}

        {/* ── FINANZAS Y PAGOS ── */}
        {showFinanzas && (
          <AccordionGroup
            title="FINANZAS Y PAGOS"
            icon={<Banknote className="w-3.5 h-3.5" />}
            isOpen={openFinanzas}
            onToggle={() => setOpenFinanzas(v => !v)}
          >
            <NavItem
              size="sm"
              icon={<ShoppingBag className="h-4 w-4" />}
              label="Gestionar Compras"
              onClick={() => go('/finanzas/compras')}
              hoverBg="hover:bg-emerald-500"
              iconColor="text-emerald-500"
              active={at('/finanzas/compras')}
              activeBg="bg-emerald-500/15"
              activeBorderColor="bg-emerald-500"
            />
            <NavItem
              size="sm"
              icon={<Receipt className="h-4 w-4" />}
              label="Cuentas por Pagar"
              onClick={() => go('/finanzas/cuentas-por-pagar')}
              hoverBg="hover:bg-rose-500"
              iconColor="text-rose-500"
              active={at('/finanzas/cuentas-por-pagar')}
              activeBg="bg-rose-500/15"
              activeBorderColor="bg-rose-500"
            />
            {canProveedores && (
              <NavItem
                size="sm"
                icon={<Building2 className="h-4 w-4" />}
                label="Gestionar Proveedores"
                onClick={() => go('/logistica/proveedores')}
                hoverBg="hover:bg-amber-500"
                iconColor="text-amber-500"
                active={at('/logistica/proveedores')}
                activeBg="bg-amber-500/15"
                activeBorderColor="bg-amber-500"
              />
            )}
          </AccordionGroup>
        )}

        {/* ── REPORTES Y ESTADÍSTICAS ── */}
        {showReportes && (
          <AccordionGroup
            title="REPORTES Y ESTADÍSTICAS"
            icon={<BarChart2 className="w-3.5 h-3.5" />}
            isOpen={openReportes}
            onToggle={() => setOpenReportes(v => !v)}
          >
            <NavItem
              size="sm"
              icon={<BarChart2 className="h-4 w-4" />}
              label="Inteligencia de Negocios"
              onClick={() => go('/reportes')}
              hoverBg="hover:bg-amber-500"
              iconColor="text-amber-500"
              active={at('/reportes')}
              activeBg="bg-amber-500/15"
              activeBorderColor="bg-amber-500"
            />
          </AccordionGroup>
        )}

        {/* ── Administración ── */}
        {showAdmin && (
          <AccordionGroup
            title="Administración"
            icon={<ShieldAlert className="w-3.5 h-3.5" />}
            isOpen={openAdmin}
            onToggle={() => setOpenAdmin(v => !v)}
          >
            {canRRHH && (
              <NavItem
                size="sm"
                icon={<Users className="h-4 w-4" />}
                label="Recursos Humanos"
                onClick={() => go('/empleados')}
                hoverBg="hover:bg-green-500"
                iconColor="text-green-500"
                active={at('/empleados')}
                activeBg="bg-green-500/15"
                activeBorderColor="bg-green-500"
              />
            )}
            {canUsuarios && (
              <NavItem
                size="sm"
                icon={<UserCog className="h-4 w-4" />}
                label="Gestión Usuarios"
                onClick={() => go('/usuarios')}
                hoverBg="hover:bg-blue-500"
                iconColor="text-blue-500"
                active={at('/usuarios')}
                activeBg="bg-blue-500/15"
                activeBorderColor="bg-blue-500"
              />
            )}
            {canSeguridad && (
              <NavItem
                size="sm"
                icon={<ShieldAlert className="h-4 w-4" />}
                label="Seguridad y Roles"
                onClick={() => go('/accesos')}
                hoverBg="hover:bg-red-500"
                iconColor="text-red-500"
                active={at('/accesos')}
                activeBg="bg-red-500/15"
                activeBorderColor="bg-red-500"
              />
            )}
          </AccordionGroup>
        )}
      </nav>

      {/* Footer */}
      <div className="p-5 border-t border-divider bg-sidebar">
        {/* Selector de tema — visible en móvil (en desktop está en el header) */}
        <div className="md:hidden mb-3">
          <select
            className="w-full bg-primary/10 text-primary border-none rounded-md px-3 py-2 font-semibold outline-none cursor-pointer text-sm"
            value={theme}
            onChange={e => setTheme(e.target.value as any)}
          >
            <option value="ninos">Tema: Niños</option>
            <option value="jovenes">Tema: Jóvenes</option>
            <option value="adultos">Tema: Adultos</option>
          </select>
        </div>
        <div className="mb-4 text-center">
          <p className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">Operador Activo</p>
          <p className="text-sm font-bold truncate text-primary uppercase tracking-wider">{user?.username || 'Invitado'}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full py-3 bg-red-500/10 text-red-500 font-bold rounded-md hover:bg-red-500 hover:text-white transition-colors border border-red-500/20 active:scale-95"
        >
          <LogOut className="h-5 w-5" />
          Desconectar
        </button>
      </div>
    </aside>
  );
};
