import { useCallback } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const DENIED_MSG =
  'Acceso Denegado: Su rol actual no tiene privilegios para realizar esta acción.';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GuardFn = (permission: string, action: (...args: any[]) => any) => (...args: any[]) => void;

export const usePermissions = () => {
  const { hasPermission } = useAuth();

  /**
   * Envuelve cualquier handler con validación de permiso.
   * Si el usuario no tiene el permiso se bloquea la acción y se muestra un toast.
   *
   * Uso: onClick={guardAction('ACCESO_PRODUCTO_CREAR', handleCreate)}
   */
  const guardAction: GuardFn = useCallback(
    (permission: string, action: (...args: any[]) => any) =>
      (...args: any[]) => {
        if (!hasPermission(permission)) {
          toast.error(DENIED_MSG, {
            duration: 5000,
            id: 'access-denied',
          });
          return;
        }
        action(...args);
      },
    [hasPermission],
  );

  /** Verificación booleana directa — para condicionales en JSX cuando sea necesario */
  const canDo = useCallback(
    (permission: string): boolean => hasPermission(permission),
    [hasPermission],
  );

  return { guardAction, canDo };
};
