import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AccessDenied } from './AccessDenied';

interface RoleGuardProps {
  allowedRoles?: string[];
  allowedPermissions?: string[];
}

export const RoleGuard = ({ allowedRoles = [], allowedPermissions = [] }: RoleGuardProps) => {
  const { user, hasPermission, isLoading } = useAuth();

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return <Navigate to="/login" replace />;

  // El permiso tiene prioridad. Si tiene el permiso requerido, entra sin importar el rol.
  // Si no hay permisos requeridos, se valida por rol. Sin restricciones → libre.
  const hasAccess =
    (allowedPermissions.length === 0 || allowedPermissions.some(p => hasPermission(p))) ||
    (allowedRoles.length > 0 && allowedRoles.some(r => user?.roles?.includes(r)));

  if (!hasAccess) return <AccessDenied />;

  return <Outlet />;
};
