import React, { useCallback, useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import InvitacionPendienteCard from './InvitacionPendienteCard';
import SolicitudEmpresaForm from './SolicitudEmpresaForm';
import { estadoSolicitudEmpresa } from '@/lib/accesoEmpresa';
import { Building2, Clock, Loader2, ShieldAlert } from 'lucide-react';

/**
 * Puerta de entrada de quien todavía no tiene empresa: muestra la invitación
 * pendiente (si la hay) o la solicitud en curso, y nunca datos de otra empresa.
 */
export default function PanelAccesoPendiente({ onAccesoConfirmado }) {
  const { user, checkAppState, logout } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [invitacion, setInvitacion] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);

  const cargar = useCallback(async () => {
    if (!user?.email) return;
    setCargando(true);
    try {
      const [res, mis] = await Promise.all([
        base44.functions.invoke('gestionarInvitacionAcceso', { accion: 'miPendiente' }).catch(() => null),
        base44.entities.SolicitudEmpresa
          .filter({ solicitante_email: user.email }, { sort: '-created_date', limit: 10 })
          .then((p) => (Array.isArray(p) ? p : p?.items || []))
          .catch(() => []),
      ]);
      setInvitacion(res?.data?.invitacion || null);
      setSolicitudes(Array.isArray(mis) ? mis : []);
    } finally {
      setCargando(false);
    }
  }, [user?.email]);

  useEffect(() => { cargar(); }, [cargar]);

  const alConfirmar = async (accion) => {
    if (accion !== 'confirmar') {
      await cargar();
      return;
    }
    await checkAppState();
    onAccesoConfirmado?.();
  };

  const pendiente = solicitudes.find((s) => ['pendiente', 'aprobada'].includes(s.estado));

  return (
    <div className="p-4 sm:p-6 flex justify-center">
      <div className="w-full max-w-2xl space-y-4">
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="font-semibold text-lg">Tu acceso todavía no está activo</h2>
          <p className="text-sm text-muted-foreground">
            {user?.email} no pertenece a ninguna empresa. Confirma la invitación que te hayan
            enviado o solicita el alta de tu empresa. Hasta entonces no se muestra ningún dato.
          </p>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Comprobando tu acceso…
          </div>
        ) : (
          <>
            {invitacion && (
              <InvitacionPendienteCard invitacion={invitacion} onResuelta={alConfirmar} />
            )}

            {pendiente && (
              <div className="border rounded-xl p-4 bg-card space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Clock className="h-4 w-4 text-amber-600" /> Solicitud en curso
                </div>
                <div className="text-sm flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {pendiente.nombre_empresa}
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded border w-fit ${estadoSolicitudEmpresa(pendiente.estado).className}`}>
                  {estadoSolicitudEmpresa(pendiente.estado).label}
                </span>
                <p className="text-xs text-muted-foreground pt-1">
                  {pendiente.estado === 'pendiente'
                    ? 'El propietario revisará tu solicitud. Cuando la apruebe recibirás una invitación para confirmar tu acceso.'
                    : 'Solicitud aprobada. Confirma la invitación de arriba para entrar en tu empresa.'}
                </p>
              </div>
            )}

            {!invitacion && !pendiente && (
              <SolicitudEmpresaForm onEnviada={() => cargar()} />
            )}

            {solicitudes.length > 0 && (
              <div className="border rounded-xl p-4 bg-card space-y-2">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Mis solicitudes</div>
                {solicitudes.map((s) => {
                  const estado = estadoSolicitudEmpresa(s.estado);
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{s.nombre_empresa}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded border shrink-0 ${estado.className}`}>
                        {estado.label}
                      </span>
                    </div>
                  );
                })}
                {solicitudes.some((s) => s.estado === 'rechazada' || s.estado === 'anulada') && (
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Si una solicitud fue rechazada, revisa los datos con el propietario antes de volver a enviarla.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={() => logout()}>Cerrar sesión</Button>
        </div>
      </div>
    </div>
  );
}