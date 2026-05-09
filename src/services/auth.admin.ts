import api from './api';

export const authAdminApi = {
  // --- Access ---
  getUsers:      async ()                            => (await api.get('/access/users')).data,
  getMatrix:     async ()                            => (await api.get('/access/matrix')).data,
  getUserMatrix: async (id: number)                  => (await api.get(`/access/user-matrix/${id}`)).data,
  assignRole:    async (data: { ID_Usuario: number, ID_Rol: number, ID_Permiso: number })            => (await api.post('/access/assign', data)).data,
  assignMultiple:async (data: { ID_Usuario: number, ID_Rol: number, ID_Permisos: number[] })         => (await api.post('/access/assign-multiple', data)).data,
  syncPermisos:  async (data: { ID_Usuario: number, ID_Rol: number, ID_Permisos: number[] })         => (await api.post('/access/sync', data)).data,
  revokeRole:    async (data: { ID_Usuario: number, ID_Rol: number, ID_Permiso: number })            => (await api.post('/access/revoke', data)).data,

  // --- Roles CRUD ---
  getRoles:    async ()                                                                              => (await api.get('/roles')).data,
  getRolById:  async (id: number)                                                                   => (await api.get(`/roles/${id}`)).data,
  getRolPermisos: async (id: number)                                                                => (await api.get(`/roles/${id}/permisos`)).data,
  createRol:   async (data: { nombre: string; descripcion?: string; permisos?: number[] })          => (await api.post('/roles', data)).data,
  updateRol:   async (id: number, data: { nombre: string; descripcion?: string; permisos?: number[] }) => (await api.put(`/roles/${id}`, data)).data,
  deleteRol:   async (id: number)                                                                   => (await api.delete(`/roles/${id}`)).data,

  // --- Permisos (lectura) ---
  getPermisos: async ()                                                                             => (await api.get('/permisos')).data,

  // --- Usuarios ---
  getUsuarios:          async ()                         => (await api.get('/usuarios')).data,
  desbloquearUsuario:   async (id: number)               => (await api.patch(`/usuarios/${id}/desbloquear`)).data,
  updateEstadoUsuario:  async (id: number, estado: string) => (await api.patch(`/usuarios/${id}/estado`, { estado })).data,
  updateUsuario:        async (id: number, data: { Nombre?: string; Paterno?: string; Email?: string; ID_Rol?: number; NewPassword?: string }) =>
    (await api.patch(`/usuarios/${id}`, data)).data,
  updateSelfProfile:    async (data: { Nombre?: string; Paterno?: string; Email?: string; NewPassword?: string }) =>
    (await api.patch('/auth/me', data)).data,

  // --- Empleados ---
  getEmpleados:   async ()                    => (await api.get('/empleados')).data,
  createEmpleado: async (data: any)           => (await api.post('/empleados', data)).data,
  updateEmpleado: async (id: number, data: any) => (await api.put(`/empleados/${id}`, data)).data,
  deleteEmpleado: async (id: number)          => (await api.delete(`/empleados/${id}`)).data,
  createUsuario:  async (data: any)           => (await api.post('/auth/register', data)).data,
};
