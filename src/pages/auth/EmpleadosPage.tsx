import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { authAdminApi } from '../../services/auth.admin';
import { useNavigate } from 'react-router-dom';
import {
  Users, PlusCircle, UserPlus, CheckCircle, Search,
  ShieldAlert, ShieldCheck, Pencil, Trash2, Eye, X,
  Phone, MapPin, Calendar, CreditCard, Briefcase,
} from 'lucide-react';

type Rol = { ID_Rol: number; Nombre: string; permisos?: { ID_Permiso: number }[] };

const INPUT = 'bg-black/5 dark:bg-slate-800 rounded-xl px-4 py-3 outline-none focus:ring-2 ring-primary border border-transparent dark:border-slate-700 font-bold dark:text-gray-200 w-full';

// ── Empleado Detail Modal ─────────────────────────────────────────────────

type EmpDetailProps = { emp: any; onClose: () => void; onEdit: (emp: any) => void };

const EmpDetailModal = ({ emp, onClose, onEdit }: EmpDetailProps) => {
  const fullName = [emp.Paterno, emp.Materno, emp.Nombre].filter(Boolean).join(' ');
  const initials = [emp.Paterno, emp.Nombre].map((s: string) => s?.[0] ?? '').join('').toUpperCase();
  const contrato = emp.FechaContratacion
    ? new Date(emp.FechaContratacion).toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const Field = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
    <div className="flex flex-col gap-1">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 flex items-center gap-1.5">
        {icon} {label}
      </p>
      <p className="text-sm font-black text-text dark:text-gray-100 pl-0.5">{value || '—'}</p>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-3xl w-full max-w-md shadow-2xl border border-divider overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-4 sm:px-8 pt-4 sm:pt-8 pb-4 sm:pb-6 border-b border-black/8 dark:border-slate-700 bg-black/2 dark:bg-white/2">
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-primary/8 blur-[60px] rounded-full pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-xl font-black shadow-lg flex-shrink-0">
              {initials || '??'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-30 mb-1">Expediente Personal</p>
              <h3 className="text-xl font-black text-text dark:text-gray-100 leading-tight">{fullName}</h3>
              <span className="inline-block mt-1.5 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-primary/15">
                {emp.Cargo || 'SIN CARGO'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-xl hover:bg-black/8 dark:hover:bg-white/8 text-text opacity-40 hover:opacity-80 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-8 py-4 sm:py-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="col-span-2">
            <Field icon={<CreditCard className="w-3 h-3 inline" />} label="CI / Documento" value={emp.CI} />
          </div>
          <Field icon={<Phone className="w-3 h-3 inline" />} label="Teléfono" value={emp.Telefono} />
          <Field icon={<Calendar className="w-3 h-3 inline" />} label="Fecha Contrato" value={contrato} />
          <div className="col-span-2">
            <Field icon={<MapPin className="w-3 h-3 inline" />} label="Dirección" value={emp.Direccion} />
          </div>
          <div className="col-span-2">
            <Field icon={<Briefcase className="w-3 h-3 inline" />} label="Cargo / Rol" value={emp.Cargo} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-8 py-4 sm:py-5 border-t border-black/8 dark:border-slate-700 flex items-center gap-3 bg-black/2 dark:bg-white/2">
          <button
            onClick={() => { onClose(); onEdit(emp); }}
            className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
          <button
            onClick={onClose}
            className="ml-auto px-5 py-2.5 bg-black/6 dark:bg-slate-800 hover:bg-black/12 dark:hover:bg-slate-700 text-text dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────

export const EmpleadosPage = () => {
    const navigate = useNavigate();
    const [empleados, setEmpleados] = useState<any[]>([]);
    const [roles, setRoles]         = useState<Rol[]>([]);
    const [searchQ, setSearchQ]     = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
    const [step, setStep] = useState(1);

    // Detail view
    const [viewingEmp, setViewingEmp] = useState<any | null>(null);

    // Step 1 – ficha física
    const [fNombre,    setfNombre]    = useState('');
    const [fPaterno,   setfPaterno]   = useState('');
    const [fMaterno,   setfMaterno]   = useState('');
    const [fCI,        setfCI]        = useState('');
    const [fTelefono,  setfTelefono]  = useState('');
    const [fDireccion, setfDireccion] = useState('');
    const [fFecha,     setfFecha]     = useState(new Date().toISOString().split('T')[0]);

    // Role selector
    const [fRolId, setfRolId] = useState('');

    // Step 2 – credenciales
    const [createdEmpId, setCreatedEmpId] = useState<number | null>(null);
    const [fUsername, setfUsername] = useState('');
    const [fPassword, setfPassword] = useState('');
    const [fEmail,    setfEmail]    = useState('');

    // Step 3 – resultado
    const [autoAssigned, setAutoAssigned] = useState(false);

    // ── Data loading ──────────────────────────────────────────────────────

    const loadData = async () => {
        try { setEmpleados(await authAdminApi.getEmpleados()); } catch { /* silent */ }
    };

    useEffect(() => {
        loadData();
        authAdminApi.getRoles()
            .then(r => setRoles(r))
            .catch(() => toast.error('No se pudieron cargar los roles disponibles.'));
    }, []);

    // ── Helpers ───────────────────────────────────────────────────────────

    const selectedRolName = roles.find(r => r.ID_Rol === Number(fRolId))?.Nombre ?? '';

    const resetForm = () => {
        setfNombre(''); setfPaterno(''); setfMaterno(''); setfCI('');
        setfTelefono(''); setfDireccion(''); setfFecha(new Date().toISOString().split('T')[0]);
        setfRolId(''); setfUsername(''); setfPassword(''); setfEmail('');
    };

    const closeAll = () => {
        setShowModal(false);
        setIsEditing(false);
        setEditingEmpId(null);
        setStep(1);
        setCreatedEmpId(null);
        setAutoAssigned(false);
        resetForm();
    };

    const openEdit = (emp: any) => {
        setfNombre(emp.Nombre ?? '');
        setfPaterno(emp.Paterno ?? '');
        setfMaterno(emp.Materno ?? '');
        setfCI(emp.CI ?? '');
        setfTelefono(emp.Telefono ?? '');
        setfDireccion(emp.Direccion ?? '');
        setfFecha(emp.FechaContratacion ? emp.FechaContratacion.split('T')[0] : new Date().toISOString().split('T')[0]);
        setfRolId('');
        setEditingEmpId(emp.ID_Empleado);
        setIsEditing(true);
        setShowModal(true);
    };

    // ── Submits ───────────────────────────────────────────────────────────

    const submitEmpleado = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            const res = await authAdminApi.createEmpleado({
                Nombre: fNombre, Paterno: fPaterno, Materno: fMaterno,
                CI: fCI, Telefono: fTelefono, Direccion: fDireccion,
                Cargo: selectedRolName || 'SIN ASIGNAR',
                FechaContratacion: fFecha,
            });
            setCreatedEmpId(res.ID_Empleado);
            setStep(2);
            loadData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error guardando empleado físico.');
        }
    };

    const submitUpdateEmpleado = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingEmpId) return;
        try {
            await authAdminApi.updateEmpleado(editingEmpId, {
                Nombre: fNombre, Paterno: fPaterno, Materno: fMaterno,
                CI: fCI, Telefono: fTelefono, Direccion: fDireccion,
                FechaContratacion: fFecha,
            });
            toast.success('Expediente actualizado correctamente.');
            closeAll();
            loadData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error actualizando expediente.');
        }
    };

    const handleDelete = (emp: any) => {
        toast.warning(`¿Eliminar a ${emp.Paterno} ${emp.Nombre}?`, {
            description: 'El registro quedará inactivo en el sistema.',
            action: {
                label: 'Confirmar',
                onClick: async () => {
                    try {
                        await authAdminApi.deleteEmpleado(emp.ID_Empleado);
                        toast.success('Empleado eliminado del registro.');
                        loadData();
                    } catch (err: any) {
                        toast.error(err.response?.data?.message || 'No se pudo eliminar el empleado.');
                    }
                },
            },
        });
    };

    const submitAuth = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            const userRes = await authAdminApi.createUsuario({
                UserName: fUsername, Password: fPassword, Email: fEmail,
                ID_Empleado: createdEmpId,
                ...(fRolId ? { ID_Rol: Number(fRolId) } : {}),
            });

            if (fRolId) {
                const newUserId: number = userRes?.ID_Usuario ?? userRes?.id;
                if (newUserId) {
                    try {
                        const rolData = await authAdminApi.getRolById(Number(fRolId));
                        const permIds: number[] =
                            rolData?.permisos?.map((p: any) => p.ID_Permiso ?? p.id) ?? [];
                        if (permIds.length > 0) {
                            await authAdminApi.assignMultiple({
                                ID_Usuario: newUserId,
                                ID_Rol: Number(fRolId),
                                ID_Permisos: permIds,
                            });
                        }
                    } catch { /* best-effort */ }
                }
                setAutoAssigned(true);
            }

            setStep(3);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error creando credenciales.');
        }
    };

    // ── Table filter ──────────────────────────────────────────────────────

    const displayEmp = empleados.filter(e =>
        e.CI.includes(searchQ) ||
        e.Nombre.toLowerCase().includes(searchQ.toLowerCase()) ||
        e.Paterno?.toLowerCase().includes(searchQ.toLowerCase())
    );

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col gap-6 w-full relative z-10 transition-all duration-300">

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-2xl sm:text-4xl font-black text-primary drop-shadow-sm flex items-center gap-3">
                        <Users className="w-10 h-10" /> Recursos Humanos
                    </h2>
                    <p className="mt-2 text-lg font-bold text-text opacity-70">
                        Control de legajos y creación de perfiles operativos.
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsEditing(false); setShowModal(true); }}
                    className="bg-primary text-white font-black uppercase tracking-wider px-6 py-3.5 rounded-xl gap-2 flex items-center shadow-[0_0_20px_rgba(var(--color-primary),0.3)] hover:-translate-y-1 transition-all active:scale-95 border-b-[3px] border-black/20"
                >
                    <UserPlus className="w-5 h-5" /> Registrar Personal
                </button>
            </div>

            {/* Employee table */}
            <div className="bg-white/40 dark:bg-black/40 backdrop-blur-3xl border border-black/10 dark:border-slate-700 rounded-[2rem] p-4 sm:p-8 shadow-2xl mt-4">
                <div className="flex items-center bg-surface border border-divider rounded-xl px-4 py-3 mb-6 focus-within:border-primary transition-all">
                    <Search className="w-5 h-5 text-primary opacity-60 mr-2" />
                    <input
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        placeholder="Buscar por CI o Nombre..."
                        className="bg-transparent border-none outline-none w-full font-bold text-text"
                    />
                </div>

                <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm mt-4">
                    <thead className="bg-card border-b border-divider">
                        <tr>
                            <th className="p-4 font-black text-xs tracking-wider uppercase text-muted">Identidad (CI)</th>
                            <th className="p-4 font-black text-xs tracking-wider uppercase text-muted">Filiación</th>
                            <th className="p-4 font-black text-xs tracking-wider uppercase text-muted">Cargo / Rol</th>
                            <th className="p-4 font-black text-xs tracking-wider uppercase text-muted">Contrato</th>
                            <th className="p-4 font-black text-xs tracking-wider uppercase text-muted text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-slate-700/50">
                        {displayEmp.map((e, i) => (
                            <tr key={i} className="hover:bg-primary/4 dark:hover:bg-primary/6 transition-colors duration-150 group">
                                <td className="p-4 font-bold font-mono tracking-widest text-primary dark:text-gray-300">{e.CI}</td>
                                <td className="p-4 font-bold text-lg dark:text-gray-200">{e.Paterno} {e.Materno}, {e.Nombre}</td>
                                <td className="p-4 uppercase tracking-widest text-xs font-black dark:text-gray-400">
                                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-lg border border-primary/10">
                                        {e.Cargo || 'SIN ASIGNAR'}
                                    </span>
                                </td>
                                <td className="p-4 uppercase tracking-widest font-mono text-xs dark:text-gray-300">
                                    {new Date(e.FechaContratacion).toISOString().split('T')[0]}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                        <button
                                            onClick={() => setViewingEmp(e)}
                                            title="Ver detalle"
                                            className="p-2 rounded-xl bg-slate-500/10 text-slate-500 dark:text-slate-400 hover:bg-slate-500 hover:text-white transition-all active:scale-95"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => openEdit(e)}
                                            title="Editar expediente"
                                            className="p-2 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all active:scale-95"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(e)}
                                            title="Eliminar empleado"
                                            className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                </div>
                {displayEmp.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-25">
                        <Users className="w-12 h-12" />
                        <p className="font-black text-sm">No hay personal registrado.</p>
                    </div>
                )}
            </div>

            {/* ── Employee Detail Modal ── */}
            {viewingEmp && (
                <EmpDetailModal
                    emp={viewingEmp}
                    onClose={() => setViewingEmp(null)}
                    onEdit={emp => { setViewingEmp(null); openEdit(emp); }}
                />
            )}

            {/* ── Create / Edit Modal Stepper ── */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-card rounded-3xl p-4 sm:p-8 max-w-2xl w-full shadow-2xl relative border border-divider">

                        {/* ── Edit mode: single-step ── */}
                        {isEditing ? (
                            <form onSubmit={submitUpdateEmpleado} className="flex flex-col gap-5">
                                <div>
                                    <h3 className="text-2xl font-black mb-1 text-blue-500 flex items-center gap-2">
                                        <Pencil className="w-6 h-6" /> Editar Expediente
                                    </h3>
                                    <p className="opacity-50 font-bold text-sm dark:text-gray-400">Modifica los datos físicos del empleado</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <input required placeholder="Nombres" value={fNombre} onChange={e => setfNombre(e.target.value)} className={INPUT} />
                                    <input required placeholder="CI Documento" value={fCI} onChange={e => setfCI(e.target.value)} className={`${INPUT} font-mono`} />
                                    <input required placeholder="Paterno" value={fPaterno} onChange={e => setfPaterno(e.target.value)} className={INPUT} />
                                    <input placeholder="Materno" value={fMaterno} onChange={e => setfMaterno(e.target.value)} className={INPUT} />
                                    <input placeholder="Teléfono" value={fTelefono} onChange={e => setfTelefono(e.target.value)} className={INPUT} />
                                    <input required type="date" value={fFecha} onChange={e => setfFecha(e.target.value)} className={INPUT} />
                                </div>
                                <input placeholder="Dirección de Domicilio" value={fDireccion} onChange={e => setfDireccion(e.target.value)} className={INPUT} />

                                <div className="flex gap-4 mt-2">
                                    <button type="button" onClick={closeAll} className="w-1/3 bg-black/10 dark:bg-slate-800 font-black py-4 rounded-xl hover:bg-black/20 dark:hover:bg-slate-700 dark:text-gray-200 transition-all">
                                        CANCELAR
                                    </button>
                                    <button type="submit" className="w-2/3 bg-blue-500 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 hover:brightness-110 transition-all">
                                        GUARDAR CAMBIOS →
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <>
                                {/* Step indicator */}
                                <div className="flex items-center gap-2 mb-6">
                                    {[1, 2, 3].map(s => (
                                        <React.Fragment key={s}>
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                                                step > s  ? 'bg-green-500 text-white' :
                                                step === s ? 'bg-primary text-white' :
                                                'bg-black/10 dark:bg-slate-700 text-text opacity-40'
                                            }`}>
                                                {step > s ? '✓' : s}
                                            </div>
                                            {s < 3 && <div className={`flex-1 h-0.5 transition-all ${step > s ? 'bg-green-500' : 'bg-black/10 dark:bg-slate-700'}`} />}
                                        </React.Fragment>
                                    ))}
                                </div>

                                {/* Step 1: Ficha física */}
                                {step === 1 && (
                                    <form onSubmit={submitEmpleado} className="flex flex-col gap-5">
                                        <div>
                                            <h3 className="text-2xl font-black mb-1 text-primary flex items-center gap-2">
                                                <PlusCircle className="w-6 h-6" /> Nuevo Expediente
                                            </h3>
                                            <p className="opacity-50 font-bold text-sm dark:text-gray-400">Paso 1 — Ficha Operativa</p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <input required placeholder="Nombres" value={fNombre} onChange={e => setfNombre(e.target.value)} className={INPUT} />
                                            <input required placeholder="CI Documento" value={fCI} onChange={e => setfCI(e.target.value)} className={`${INPUT} font-mono`} />
                                            <input required placeholder="Paterno" value={fPaterno} onChange={e => setfPaterno(e.target.value)} className={INPUT} />
                                            <input required placeholder="Materno" value={fMaterno} onChange={e => setfMaterno(e.target.value)} className={INPUT} />
                                            <input placeholder="Teléfono" value={fTelefono} onChange={e => setfTelefono(e.target.value)} className={INPUT} />
                                            <input required type="date" value={fFecha} onChange={e => setfFecha(e.target.value)} className={INPUT} />
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[11px] font-black uppercase tracking-widest opacity-50 px-1">
                                                Cargo / Rol del Sistema
                                            </label>
                                            <select value={fRolId} onChange={e => setfRolId(e.target.value)} className={INPUT}>
                                                <option value="">— Sin rol asignado (asignar luego) —</option>
                                                {roles.map(r => (
                                                    <option key={r.ID_Rol} value={r.ID_Rol}>{r.Nombre}</option>
                                                ))}
                                            </select>
                                            {fRolId && (
                                                <p className="text-xs font-bold text-primary opacity-70 px-1 flex items-center gap-1">
                                                    <ShieldCheck className="w-3.5 h-3.5" />
                                                    Al crear el usuario se heredarán automáticamente los permisos de <strong>{selectedRolName}</strong>
                                                </p>
                                            )}
                                        </div>

                                        <input placeholder="Dirección de Domicilio" value={fDireccion} onChange={e => setfDireccion(e.target.value)} className={INPUT} />

                                        <div className="flex gap-4 mt-2">
                                            <button type="button" onClick={closeAll} className="w-1/3 bg-black/10 dark:bg-slate-800 font-black py-4 rounded-xl hover:bg-black/20 dark:hover:bg-slate-700 dark:text-gray-200 transition-all">
                                                DESCARTAR
                                            </button>
                                            <button type="submit" className="w-2/3 bg-primary text-white font-black py-4 rounded-xl shadow-lg active:scale-95 hover:brightness-110 transition-all">
                                                REGISTRAR PERSONAL →
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* Step 2: Credenciales */}
                                {step === 2 && (
                                    <form onSubmit={submitAuth} className="flex flex-col gap-5">
                                        <div className="text-center mb-2">
                                            <div className="w-14 h-14 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <CheckCircle className="w-7 h-7" />
                                            </div>
                                            <h3 className="text-2xl font-black text-text dark:text-gray-200">Personal Registrado (EMP-{createdEmpId})</h3>
                                            <p className="opacity-50 font-bold text-sm mt-1 dark:text-gray-400">Paso 2 — Credenciales de Sistema</p>
                                        </div>

                                        {fRolId && (
                                            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
                                                <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0" />
                                                <p className="text-xs font-black text-primary">
                                                    Rol <strong>{selectedRolName}</strong> — los permisos se asignarán automáticamente.
                                                </p>
                                            </div>
                                        )}

                                        <input required placeholder="Username (ej. jsmith)" value={fUsername} onChange={e => setfUsername(e.target.value)} className={INPUT} />
                                        <input required type="email" placeholder="Email Laboral" value={fEmail} onChange={e => setfEmail(e.target.value)} className={INPUT} />
                                        <input required type="password" placeholder="Contraseña Inicial" value={fPassword} onChange={e => setfPassword(e.target.value)} className={INPUT} />

                                        <div className="flex gap-4 mt-2">
                                            <button type="button" onClick={closeAll} className="w-1/2 bg-black/10 dark:bg-slate-800 font-black py-4 rounded-xl hover:bg-black/20 dark:hover:bg-slate-700 dark:text-gray-200 transition-all">
                                                OMITIR (SOLO FÍSICO)
                                            </button>
                                            <button type="submit" className="w-1/2 bg-secondary text-background font-black py-4 rounded-xl shadow-lg active:scale-95 hover:brightness-110 transition-all">
                                                INSCRIBIR CREDENCIALES →
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* Step 3: Confirmación */}
                                {step === 3 && (
                                    <div className="flex flex-col gap-5 text-center items-center py-8">
                                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-2 ${autoAssigned ? 'bg-green-500/20 text-green-500' : 'bg-secondary/20 text-secondary'}`}>
                                            {autoAssigned ? <ShieldCheck className="w-10 h-10" /> : <ShieldAlert className="w-10 h-10" />}
                                        </div>
                                        <h3 className="text-3xl font-black text-text dark:text-gray-200">Cuenta Activada</h3>

                                        {autoAssigned ? (
                                            <p className="opacity-60 font-bold max-w-sm dark:text-gray-400">
                                                Los permisos del rol <strong className="text-primary">{selectedRolName}</strong> fueron heredados automáticamente. El usuario puede ingresar al sistema de inmediato.
                                            </p>
                                        ) : (
                                            <p className="opacity-60 font-bold max-w-sm dark:text-gray-400">
                                                El usuario fue creado sin rol. Dirígete a la Matriz de Permisos para asignarle acceso manualmente.
                                            </p>
                                        )}

                                        <div className="flex gap-4 w-full max-w-sm mt-4">
                                            <button onClick={closeAll} className="flex-1 bg-black/10 dark:bg-slate-800 font-black py-4 rounded-xl hover:bg-black/20 dark:hover:bg-slate-700 dark:text-gray-200 transition-all text-sm">
                                                CERRAR
                                            </button>
                                            {!autoAssigned && (
                                                <button onClick={() => { closeAll(); navigate('/accesos'); }} className="flex-1 bg-primary text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all text-sm">
                                                    IR A PERMISOS
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
