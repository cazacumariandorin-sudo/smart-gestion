/** Estados de una solicitud de alta de empresa. */
export const ESTADOS_SOLICITUD_EMPRESA = {
  pendiente: { label: 'Pendiente de aprobación', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  aprobada: { label: 'Aprobada · espera confirmación', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  confirmada: { label: 'Acceso confirmado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rechazada: { label: 'Rechazada', className: 'bg-red-50 text-red-700 border-red-200' },
  anulada: { label: 'Anulada', className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export const estadoSolicitudEmpresa = (estado) =>
  ESTADOS_SOLICITUD_EMPRESA[estado] || ESTADOS_SOLICITUD_EMPRESA.pendiente;

export const TIPOS_INVITACION = {
  administrador_local: 'Administrador de la empresa',
  empleado: 'Empleado de la empresa',
};