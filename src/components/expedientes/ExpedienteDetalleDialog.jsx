import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  BellRing, ShieldCheck, Gavel, Ban, FileDown, Loader2, History, Loader,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { estadoMeta, tipoFaltaMeta } from '@/lib/expedientesCatalogo';
import { descargarActaExpediente } from '@/lib/expedienteActaPdf';
import ConciliacionPreIrmaDialog from './ConciliacionPreIrmaDialog';

const formatFecha = (v) => (v ? String(v).slice(0, 10) : '—');

export default function ExpedienteDetalleDialog({ open, onOpenChange, expediente }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [conciliacionOpen, setConciliacionOpen] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [descargando, setDescargando] = useState(false);

  if (!expediente) return null;

  const estado = estadoMeta(expediente.estado);
  const tipo = tipoFaltaMeta(expediente.tipo_falta);
  const puedeGestionar = ['admin', 'propietario', 'gerencia', 'administracion'].includes(user?.role);
  const cerrado = ['archivado_conciliado', 'anulado', 'caducado', 'prescrito', 'sancionado'].includes(expediente.estado);

  const actualizar = async (cambios, accion, nota) => {
    setOcupado(true);
    try {
      const ahora = new Date().toISOString();
      const historial = [
        ...(expediente.historial || []),
        {
          fecha: ahora,
          usuario_email: user?.email || '',
          accion,
          estado_anterior: expediente.estado,
          estado_nuevo: cambios.estado || expediente.estado,
          nota: nota || '',
        },
      ];
      await base44.entities.Expediente.update(expediente.id, { ...cambios, historial });
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes-kpi'] });
    } finally {
      setOcupado(false);
    }
  };

  const notificar = () => actualizar({
    estado: 'notificado',
    fecha_notificacion: new Date().toISOString().slice(0, 10),
    notificado_por: user?.email || '',
  }, 'Carta notificada al trabajador');

  const iniciarConciliacion = async () => {
    if (expediente.estado !== 'en_conciliacion') {
      await actualizar({ estado: 'en_conciliacion' }, 'Protocolo de conciliación Pre-IRMA iniciado');
    }
    setConciliacionOpen(true);
  };

  const descargarActa = async () => {
    setDescargando(true);
    try { await descargarActaExpediente(expediente); } finally { setDescargando(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">{expediente.codigo}</span>
              <Badge variant="outline" className={cn('text-[10px]', tipo.className)}>{tipo.label}</Badge>
              <Badge variant="outline" className={cn('text-[10px]', estado.className)}>{estado.label}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">{expediente.operario_name}</p>
              <p className="text-xs text-muted-foreground">
                {expediente.articulo || 'Sin artículo'} · {expediente.origen || 'manual'}
                {expediente.reincidencia ? ' · reincidencia' : ''}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-muted-foreground">Apertura</p>
                <p className="font-medium">{formatFecha(expediente.fecha_apertura)}</p>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-muted-foreground">Prescribe</p>
                <p className="font-medium">{formatFecha(expediente.fecha_prescripcion)}</p>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-muted-foreground">Notificación</p>
                <p className="font-medium">{formatFecha(expediente.fecha_notificacion)}</p>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-muted-foreground">Caduca el antecedente</p>
                <p className="font-medium">{formatFecha(expediente.fecha_caducidad)}</p>
              </div>
            </div>

            {expediente.descripcion_hechos && (
              <div>
                <p className="text-xs font-semibold mb-1">Hechos</p>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{expediente.descripcion_hechos}</p>
              </div>
            )}

            {expediente.notas_internas && (
              <div>
                <p className="text-xs font-semibold mb-1">Notas internas</p>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{expediente.notas_internas}</p>
              </div>
            )}

            {expediente.fecha_archivo && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                <p className="font-semibold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Archivado conciliado</p>
                <p>Firmado por {expediente.firma_empresa_nombre} y {expediente.firma_trabajador_nombre}.</p>
                <p>Bloquea la reincidencia de este caso desde {formatFecha(expediente.fecha_archivo)}.</p>
              </div>
            )}

            {puedeGestionar && !cerrado && (
              <div className="flex flex-wrap gap-2">
                {expediente.estado === 'abierto' && (
                  <Button size="sm" variant="outline" onClick={notificar} disabled={ocupado}>
                    <BellRing className="w-4 h-4" /> Notificar carta
                  </Button>
                )}
                <Button size="sm" onClick={iniciarConciliacion} disabled={ocupado}>
                  <ShieldCheck className="w-4 h-4" /> Conciliación Pre-IRMA
                </Button>
                {['notificado', 'en_conciliacion'].includes(expediente.estado) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Gavel className="w-4 h-4" /> Marcar sancionado
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Marcar el expediente como sancionado?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se cierra sin acuerdo: el antecedente cuenta para la reincidencia.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => actualizar({ estado: 'sancionado' }, 'Expediente sancionado')}>
                          Confirmar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive">
                      <Ban className="w-4 h-4" /> Anular
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Anular el expediente?</AlertDialogTitle>
                      <AlertDialogDescription>Queda sin efectos y no cuenta para la reincidencia.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => actualizar({ estado: 'anulado', bloquea_reincidencia: true }, 'Expediente anulado')}
                      >
                        Anular
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {expediente.acta_fecha && (
              <Button size="sm" variant="outline" onClick={descargarActa} disabled={descargando}>
                {descargando ? <Loader className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Descargar acta
              </Button>
            )}

            <Separator />

            <div>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> Historial
              </p>
              <div className="space-y-2">
                {(expediente.historial || []).slice().reverse().map((h, i) => (
                  <div key={i} className="text-xs border-l-2 border-border pl-2">
                    <p className="font-medium">{h.accion}</p>
                    <p className="text-muted-foreground">
                      {formatFecha(h.fecha)} · {h.usuario_email || 'sistema'}
                      {h.nota ? ` · ${h.nota}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConciliacionPreIrmaDialog
        open={conciliacionOpen}
        onOpenChange={setConciliacionOpen}
        expediente={expediente}
      />
    </>
  );
}