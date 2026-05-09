/**
 * permission.util.ts
 * Utilidad centralizada para normalización y comparación de permisos RBAC.
 * Usada por AuthContext, RoleGuard y cualquier lógica de visibilidad futura.
 */

/**
 * Normaliza cualquier string de permiso a un formato canónico: 'modulo.accion'
 *
 * Ejemplos de entrada → salida:
 *   'ACCESO_PRODUCTO_VER'          → 'producto.ver'
 *   'productos.ver'                → 'producto.ver'  (strip trailing 's')
 *   'ACCESO_MONITOREO_GPS_VER'     → 'monitoreogps.ver'
 *   'monitoreo.ver'                → 'monitoreo.ver'
 *   'ACCESO_GESTION_RRHH_VER'      → 'gestionrrhh.ver'
 *   'ACCESO_TERMINAL_VEHICULAR_VER'→ 'terminalvehicular.ver'
 */
export function normalizePermission(perm: string): string {
  return perm
    .toLowerCase()
    .replace(/^acceso[_.\-]/, '')   // strip ACCESO_ / acceso. prefix
    .replace(/[_\-\s]+/g, '.')      // unify separators to dots
    .replace(/s\.(?=ver|editar|crear|eliminar|imprimir)/g, '.') // strip plural 's' before action
    .replace(/\.+/g, '.');          // collapse double dots
}

/**
 * Compara el permiso requerido contra el array de permisos del usuario.
 * Soporta coincidencia exacta normalizada y coincidencia por subconjunto de módulo.
 *
 * Permite que 'monitoreo.ver' coincida con 'monitoreogps.ver' y viceversa.
 */
export function checkPermission(userPerms: string[], requiredPerm: string): boolean {
  if (!userPerms?.length) return false;

  const normReq = normalizePermission(requiredPerm);

  return userPerms.some(p => {
    const normP = normalizePermission(p);

    // Exact match
    if (normP === normReq) return true;

    // Split into [module, action] — action is always the last segment
    const pParts  = normP.split('.');
    const rParts  = normReq.split('.');
    const pAction = pParts.at(-1);
    const rAction = rParts.at(-1);

    if (pAction !== rAction) return false;

    // Concat module segments for substring matching
    // handles singular/plural and extra words (monitoreo vs monitoreogps)
    const pMod = pParts.slice(0, -1).join('');
    const rMod = rParts.slice(0, -1).join('');

    return pMod.includes(rMod) || rMod.includes(pMod);
  });
}
