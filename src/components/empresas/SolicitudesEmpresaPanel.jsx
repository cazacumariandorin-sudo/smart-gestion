import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { estadoSolicitudEmpresa } from '@/lib/accesoEmpresa';
import { toast } from '@/components/ui/use-toast';
import {
  Building2, Check, Clock, Inbox, Loader2, Mail, RotateCw, ShieldCheck, X,
} from 'lucide-react';

const fecha = (valor) => (valor ? new Date(valor).toLocaleString('es-ES') : '—');

/**
 * Bandeja del propietario: solicitudes de alta de empresa e invitaciones
 * pendientes. Aprobar crea la empresa e invita a su administrador; el acceso
 * no se abre hasta que esa persona confirma la invitación.
 */
export default function SolicitudesEmpresaPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogo, setDialogo] = useState(null); // { solicitud, decision }
  const [comentario, setComentario] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [altaDirecta, setAltaDirecta] = useState(null);

  const esPropietario = user?.es_propietario_global === true || user?.role === 'propietario';

  const { data: solicitudes = [] } = useQuery({
    queryKey: ['solicitudes-empresa'],
    queryFn: () => base44.entities.SolicitudEmpresa.list('-created_date', 100),
    enabled: esPropietario,
  });
  const { data: invitaciones = [] } = useQuery({
    queryKey: ['invitaciones-pendientes'],
    queryFn: () => base44.entities.InvitacionUsuario.filter(
      { estado: 'pendiente_activacion' },
      { sort: '-created_date', limit: 100 }
    ).then((p) => p?.items || []),
    enabled: esPropietario,
  });

  if (!esPropietario) return null;

  const pendientes = solicitudes.filter((s) => s.estado === 'pendiente');
  const resto = solicitudes.filter((s) => s.estado !== 'pendiente');
  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['solicitudes-empresa'] });
    qc.invalidateQueries({ queryKey: ['invitaciones-pendientes'] });
    qc.invalidateQueries({ queryKey: ['empresas'] });
    qc.invalidateQueries({ queryKey: ['espacios-empresa'] });
  };

  const abrir = (solicitud, decision) => {
    setDialogo({ solicitud, decision });
    setComentario('');
    setAdminEmail(solicitud.admin_local_email || solicitud.solicitante_email || '');
    setAdminNombre(solicitud.admin_local_nombre || solicitud.solicitante_nombre || '');
  };

  const decidir = async () => {
    if (!dialogo) return;
    setOcupado('decidir');
    try {
      const res = await base44.functions.invoke('decidirSolicitudEmpresa', {
        solicitud_id: dialogo.solicitud.id,
        decision: dialogo.decision,
        comentario,
        admin_local_email: adminEmail,
        admin_local_nombre: adminNombre,
      });
      const datos = res?.data || {};
      if (datos.error) throw new Error(datos.error);
      toast({
        title: dialogo.decision === 'aprobar' ? 'Empresa aprobada' : 'Solicitud rechazada',
        description: dialogo.decision === 'aprobar'
          ? `Invitación enviada a ${datos.admin_local_email}. El acceso se abre cuando la confirme.`
          : 'Se ha avisado al solicitante.',
      });
      setDialogo(null);
      refrescar();
    } catch (e) {
      toast({ title: 'No se pudo completar', description: e?.message, variant: 'destructive' });
    } finally {
      setOcupado('');
    }
  };

  const crearAltaDirecta = async () => {
    if (!altaDirecta) return;
    setOcupado('alta');
    try {
      const res = await base44.functions.invoke('decidirSolicitudEmpresa', {
        decision: 'aprobar',
        empresa: {
          nombre_empresa: altaDirecta.nombre_empresa,
          cif: altaDirecta.cif,
          actividad_principal: altaDirecta.actividad_principal,
        },
        admin_local_email: altaDirecta.admin_local_email,
        admin_local_nombre: altaDirecta.admin_local_nombre,
        comentario: 'Alta registrada por el propietario',
      });
      const datos = res?.data || {};
      if (datos.error) throw new Error(datos.error);
      toast({
        title: `Empresa ${altaDirecta.nombre_empresa} creada`,
        description: `Invitación enviada a ${datos.admin_local_email}. El acceso se abre cuando la confirme.`,
      });
      setAltaDirecta(null);
      refrescar();
    } catch (e) {
      toast({ title: 'No se pudo crear', description: e?.message, variant: 'destructive' });
    } finally {
      setOcupado('');
    }
  };

  const accionInvitacion = async (invitacion, accion) => {
    setOcupado(`${accion}-${invitacion.id}`);
    try {
      const res = await base44.functions.invoke('gestionarInvitacionAcceso', {
        accion,
        invitacion_id: invitacion.id,
      });
      const datos = res?.data || {};
      if (datos.error) throw new Error(datos.error);
      toast({ title: accion === 'reenviar' ? 'Invitación reenviada' : 'Invitación revocada' });
      refrescar();
    } catch (e) {
      toast({ title: 'No se pudo completar', description: e?.message, variant: 'destructive' });
    } finally {
      setOcupado('');
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Inbox className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Altas de empresa</div>
            <div className="text-xs text-muted-foreground">
              Solicitudes por revisar e invitaciones sin confirmar. Ninguna concede acceso hasta que su administrador la confirme.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">
            {pendientes.length} pendiente(s)
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAltaDirecta({ nombre_empresa: '', cif: '', actividad_principal: '', admin_local_email: '', admin_local_nombre: '' })}
          >
            <Building2 className="h-3.5 w-3.5" /> Alta directa
          </Button>
        </div>
      </div>

      {pendientes.length === 0 ? (
        <div className="text-sm text-muted-foreground">No hay solicitudes pendientes.</div>
      ) : (
        <div className="space-y-2">
          {pendientes.map((s) => (
            <div key={s.id} className="border rounded-lg p-3 bg-background space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium leading-tight flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {s.nombre_empresa}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {s.cif} · {s.actividad_principal || 'sin actividad indicada'}
                  </div>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded border shrink-0 ${estadoSolicitudEmpresa(s.estado).className}`}>
                  {estadoSolicitudEmpresa(s.estado).label}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Solicita {s.solicitante_nombre} ({s.solicitante_email}){s.cargo ? ` · ${s.cargo}` : ''}
                <br />Alta pedida el {fecha(s.created_date)} · origen: {s.origen === 'propietario' ? 'propietario' : 'registro'}
              </div>
              {s.notas && <p className="text-xs bg-muted/40 rounded p-2">{s.notas}</p>}
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => abrir(s, 'aprobar')}>
                  <Check className="h-3.5 w-3.5" /> Aprobar
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => abrir(s, 'rechazar')}>
                  <X className="h-3.5 w-3.5" /> Rechazar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 pt-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Invitaciones sin confirmar ({invitaciones.length})
        </div>
        {invitaciones.length === 0 ? (
          <div className="text-xs text-muted-foreground">Ninguna invitación esperando confirmación.</div>
        ) : (
          invitaciones.map((inv) => (
            <div key={inv.id} className="border rounded-lg p-2.5 bg-background flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {inv.email}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {inv.empresa_nombre || 'sin empresa'} · {inv.rol || '—'}
                  {inv.registrado_en ? ' · cuenta detectada, falta su confirmación' : ' · cuenta aún no registrada'}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm" variant="ghost"
                  disabled={ocupado === `reenviar-${inv.id}`}
                  onClick={() => accionInvitacion(inv, 'reenviar')}
                >
                  {ocupado === `reenviar-${inv.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                  Reenviar
                </Button>
                <Button
                  size="sm" variant="ghost" className="text-destructive"
                  disabled={ocupado === `revocar-${inv.id}`}
                  onClick={() => accionInvitacion(inv, 'revocar')}
                >
                  {ocupado === `revocar-${inv.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Revocar
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {resto.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer py-1">Historial de solicitudes ({resto.length})</summary>
          <div className="space-y-1 pt-1">
            {resto.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{s.nombre_empresa} · {s.solicitante_email}</span>
                <span className="shrink-0">{estadoSolicitudEmpresa(s.estado).label}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Aprobar crea la empresa y su espacio, pero no da acceso: el administrador debe confirmar la
        invitación desde su propia cuenta. Ninguna solicitud muestra datos de otras empresas.
      </p>

      {altaDirecta && (
        <Dialog open onOpenChange={(abierto) => { if (!abierto) setAltaDirecta(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Alta directa de empresa</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nombre o razón social *</Label>
                <Input
                  value={altaDirecta.nombre_empresa}
                  onChange={(e) => setAltaDirecta({ ...altaDirecta, nombre_empresa: e.target.value })}
                />
              </div>
              <div>
                <Label>CIF / NIF *</Label>
                <Input
                  value={altaDirecta.cif}
                  onChange={(e) => setAltaDirecta({ ...altaDirecta, cif: e.target.value })}
                />
              </div>
              <div>
                <Label>Actividad principal</Label>
                <Input
                  value={altaDirecta.actividad_principal}
                  onChange={(e) => setAltaDirecta({ ...altaDirecta, actividad_principal: e.target.value })}
                />
              </div>
              <div>
                <Label>Email del administrador local *</Label>
                <Input
                  type="email"
                  value={altaDirecta.admin_local_email}
                  onChange={(e) => setAltaDirecta({ ...altaDirecta, admin_local_email: e.target.value })}
                />
              </div>
              <div>
                <Label>Nombre del administrador</Label>
                <Input
                  value={altaDirecta.admin_local_nombre}
                  onChange={(e) => setAltaDirecta({ ...altaDirecta, admin_local_nombre: e.target.value })}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Se crea la empresa y su espacio, y se envía la invitación. Nadie obtiene acceso hasta
                que esa persona la confirme desde su cuenta.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAltaDirecta(null)}>Cancelar</Button>
              <Button
                onClick={crearAltaDirecta}
                disabled={
                  ocupado === 'alta'
                  || !altaDirecta.nombre_empresa
                  || !altaDirecta.cif
                  || !altaDirecta.admin_local_email
                }
              >
                {ocupado === 'alta' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Crear e invitar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {dialogo && (
        <Dialog open onOpenChange={(abierto) => { if (!abierto) setDialogo(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {dialogo.decision === 'aprobar' ? 'Aprobar alta' : 'Rechazar solicitud'} · {dialogo.solicitud.nombre_empresa}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {dialogo.decision === 'aprobar' && (
                <>
                  <div>
                    <Label>Administrador local (email)</Label>
                    <Input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Recibirá la invitación para confirmar su acceso a esta empresa.
                    </p>
                  </div>
                  <div>
                    <Label>Nombre del administrador</Label>
                    <Input value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} />
                  </div>
                </>
              )}
              <div>
                <Label>{dialogo.decision === 'aprobar' ? 'Nota de aprobación' : 'Motivo del rechazo'}</Label>
                <Textarea rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogo(null)}>Cancelar</Button>
              <Button onClick={decidir} disabled={ocupado === 'decidir' || (dialogo.decision === 'aprobar' && !adminEmail)}>
                {ocupado === 'decidir' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {dialogo.decision === 'aprobar' ? 'Aprobar e invitar' : 'Rechazar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}