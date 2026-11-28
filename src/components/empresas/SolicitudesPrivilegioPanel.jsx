import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import SolicitudPrivilegioDialog from './SolicitudPrivilegioDialog';
import { ESTADOS_SOLICITUD, etiquetaRol } from '@/lib/multiempresa';
import { ArrowRight, Check, CheckCheck, Inbox, Loader2, Plus, ShieldCheck, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

/**
 * Bandeja de solicitudes de privilegios: la empresa pide, el propietario decide.
 * La aprobación autoriza el cambio; el rol se aplica en el espacio de esa empresa
 * y solo allí, y queda registrado aquí.
 */
export default function SolicitudesPrivilegioPanel() {
  const { isAdmin, isGerencia, user } = useUserRole();
  const qc = useQueryClient();
  const [nueva, setNueva] = useState(false);
  const [decision, setDecision] = useState(null);
  const [comentario, setComentario] = useState('');
  const [procesando, setProcesando] = useState(false);

  const { data: solicitudes = [] } = useQuery({
    queryKey: ['solicitudes-privilegio'],
    queryFn: () => base44.entities.SolicitudPrivilegio.list('-created_date', 200),
  });

  if (!isGerencia) return null;

  const ordenadas = [...solicitudes].sort((a, b) => {
    const pa = a.estado === 'pendiente' ? 0 : 1;
    const pb = b.estado === 'pendiente' ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_date || 0) - new Date(a.created_date || 0);
  });
  const pendientes = solicitudes.filter((s) => s.estado === 'pendiente').length;

  const registrar = async (solicitud, cambios, entrada) => {
    setProcesando(true);
    try {
      await base44.entities.SolicitudPrivilegio.update(solicitud.id, {
        ...cambios,
        historial: [...(solicitud.historial || []), {
          fecha: new Date().toISOString(),
          usuario_email: user?.email || '',
          estado_anterior: solicitud.estado,
          ...entrada,
        }],
      });
      qc.invalidateQueries({ queryKey: ['solicitudes-privilegio'] });
      toast({ title: entrada.accion });
    } catch (e) {
      toast({ title: 'No se pudo actualizar la solicitud', description: e?.message, variant: 'destructive' });
    } finally {
      setProcesando(false);
      setDecision(null);
      setComentario('');
    }
  };

  const confirmarDecision = () => {
    if (!decision) return;
    const aprobada = decision.tipo === 'aprobada';
    registrar(decision.solicitud, {
      estado: decision.tipo,
      decidido_por: user?.email || '',
      decidido_en: new Date().toISOString(),
      comentario_decision: comentario,
    }, {
      accion: aprobada ? 'Solicitud aprobada por el propietario' : 'Solicitud rechazada por el propietario',
      estado_nuevo: decision.tipo,
      nota: comentario,
    });
  };

  const marcarAplicada = (solicitud) => registrar(solicitud, {
    estado: 'aplicada',
    aplicado_por: user?.email || '',
    aplicado_en: new Date().toISOString(),
  }, {
    accion: 'Rol aplicado en el espacio de la empresa',
    estado_nuevo: 'aplicada',
    nota: '',
  });

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Inbox className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Solicitudes de privilegios</div>
            <div className="text-xs text-muted-foreground">
              Cada empresa gestiona a su plantilla; los privilegios extra los autoriza el propietario.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendientes > 0 && (
            <span className="text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              {pendientes} pendiente{pendientes === 1 ? '' : 's'}
            </span>
          )}
          <Button size="sm" onClick={() => setNueva(true)}><Plus className="h-4 w-4" /> Nueva</Button>
        </div>
      </div>

      {ordenadas.length === 0 ? (
        <div className="text-sm text-muted-foreground">No hay solicitudes registradas.</div>
      ) : (
        <div className="space-y-2">
          {ordenadas.map((solicitud) => {
            const estado = ESTADOS_SOLICITUD[solicitud.estado] || ESTADOS_SOLICITUD.pendiente;
            return (
              <div key={solicitud.id} className="border rounded-lg p-3 bg-background space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{solicitud.empresa_nombre}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {solicitud.usuario_nombre || solicitud.usuario_email} · {solicitud.usuario_email}
                    </div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded border shrink-0 ${estado.className}`}>{estado.label}</span>
                </div>

                <div className="text-xs flex items-center gap-1.5 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded bg-muted">{etiquetaRol(solicitud.rol_actual)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{etiquetaRol(solicitud.rol_solicitado)}</span>
                </div>

                {solicitud.motivo && <p className="text-xs text-muted-foreground line-clamp-2">{solicitud.motivo}</p>}
                {solicitud.solicitante_email && (
                  <p className="text-[11px] text-muted-foreground">Solicita: {solicitud.solicitante_email}</p>
                )}
                {solicitud.decidido_en && (
                  <p className="text-[11px] text-muted-foreground">
                    Decidido: {new Date(solicitud.decidido_en).toLocaleString('es-ES')} · {solicitud.decidido_por}
                    {solicitud.comentario_decision ? ` · ${solicitud.comentario_decision}` : ''}
                  </p>
                )}

                {isAdmin && solicitud.estado === 'pendiente' && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => { setDecision({ solicitud, tipo: 'aprobada' }); setComentario(''); }}>
                      <Check className="h-3.5 w-3.5" /> Aprobar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setDecision({ solicitud, tipo: 'rechazada' }); setComentario(''); }}>
                      <X className="h-3.5 w-3.5" /> Rechazar
                    </Button>
                  </div>
                )}
                {isAdmin && solicitud.estado === 'aprobada' && (
                  <div className="pt-1">
                    <Button size="sm" variant="outline" onClick={() => marcarAplicada(solicitud)} disabled={procesando}>
                      <CheckCheck className="h-3.5 w-3.5" /> Marcar como aplicada
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Aprobar autoriza el cambio, pero no lo ejecuta en otro espacio: el rol se cambia en el espacio de la empresa solicitante y aquí se marca como aplicado.
      </p>

      {nueva && <SolicitudPrivilegioDialog onClose={() => setNueva(false)} />}

      {decision && (
        <Dialog open onOpenChange={(abierto) => { if (!abierto) { setDecision(null); setComentario(''); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {decision.tipo === 'aprobada' ? 'Aprobar solicitud' : 'Rechazar solicitud'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">{decision.solicitud.usuario_email}</span> en{' '}
                <span className="font-medium">{decision.solicitud.empresa_nombre}</span>:{' '}
                {etiquetaRol(decision.solicitud.rol_actual)} → {etiquetaRol(decision.solicitud.rol_solicitado)}
              </div>
              <div>
                <Label>Comentario</Label>
                <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3}
                  placeholder={decision.tipo === 'aprobada' ? 'Condiciones o alcance de la autorización' : 'Motivo del rechazo'} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDecision(null); setComentario(''); }}>Cancelar</Button>
              <Button onClick={confirmarDecision} disabled={procesando}>
                {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {decision.tipo === 'aprobada' ? 'Aprobar' : 'Rechazar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}