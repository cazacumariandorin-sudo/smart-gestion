import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ScrollText, FileText, Image as ImageIcon, Gavel, History } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useUserRole } from '@/lib/useUserRole';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ESTADO_MULTA, MOTIVO_DESCARGO, ESTADOS_ABIERTOS_TECNICO, estadoLabel, estadoColor } from './multaConstants';
import MultaUpload from './MultaUpload';

const ESTADOS_RESOLUCION = [
  { value: 'recurrida', label: 'Marcar recurrida' },
  { value: 'recurso_aceptado', label: 'Recurso aceptado' },
  { value: 'recurso_rechazado', label: 'Recurso rechazado' },
  { value: 'pagada', label: 'Marcar pagada' },
  { value: 'anulada', label: 'Anular' },
];

export default function MultaDetalleDialog({ multa, open, onOpenChange }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isGerencia, isAdministracion } = useUserRole();
  const puedeResolver = isAdmin || isGerencia || isAdministracion;
  const esMulta = multa;

  const [descargo, setDescargo] = useState({
    justificante_url: '', explicacion: '', motivo_correspondiente: '',
  });
  const [estadoResolucion, setEstadoResolucion] = useState('');
  const [notasResolucion, setNotasResolucion] = useState('');

  const estado = esMulta?.estado;
  const abiertoParaTecnico = estado && ESTADOS_ABIERTOS_TECNICO.includes(estado);

  const subirDescargoMutation = useMutation({
    mutationFn: async () => {
      const nuevoHistorial = [
        ...(esMulta.historial || []),
        {
          fecha: new Date().toISOString(),
          usuario_email: user?.email || '',
          accion: 'descargo_subido',
          estado_anterior: estado,
          estado_nuevo: 'en_disputa',
          nota: 'Técnico presenta justificante de descargo',
        },
      ];
      return base44.entities.MultaVehiculo.update(esMulta.id, {
        descargo_presenta: true,
        descargo_tecnico_id: undefined,
        descargo_tecnico_name: user?.full_name || user?.email || '',
        descargo_tecnico_email: user?.email || '',
        descargo_fecha_subida: new Date().toISOString(),
        descargo_justificante_url: descargo.justificante_url,
        descargo_explicacion: descargo.explicacion || undefined,
        descargo_motivo_correspondiente: descargo.motivo_correspondiente || undefined,
        estado: 'en_disputa',
        historial: nuevoHistorial,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multas-vehiculo'] });
      toast.success('Descargo presentado');
      onOpenChange(false);
      setDescargo({ justificante_url: '', explicacion: '', motivo_correspondiente: '' });
    },
    onError: (e) => toast.error('Error al subir el descargo', e?.message),
  });

  const resolverMutation = useMutation({
    mutationFn: async () => {
      const nuevoHistorial = [
        ...(esMulta.historial || []),
        {
          fecha: new Date().toISOString(),
          usuario_email: user?.email || '',
          accion: 'resolucion',
          estado_anterior: estado,
          estado_nuevo: estadoResolucion,
          nota: notasResolucion || '',
        },
      ];
      return base44.entities.MultaVehiculo.update(esMulta.id, {
        estado: estadoResolucion,
        notas_resolucion: notasResolucion || undefined,
        resuelto_por: user?.email || '',
        fecha_resolucion: new Date().toISOString(),
        historial: nuevoHistorial,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multas-vehiculo'] });
      toast.success('Multa resuelta');
      onOpenChange(false);
      setEstadoResolucion('');
      setNotasResolucion('');
    },
    onError: (e) => toast.error('Error al resolver la multa', e?.message),
  });

  const volanteEsImagen = esMulta?.volante_url && /\.(jpg|jpeg|png|webp|gif)$/i.test(esMulta.volante_url);
  const descargoEsImagen = esMulta?.descargo_justificante_url && /\.(jpg|jpeg|png|webp|gif)$/i.test(esMulta.descargo_justificante_url);

  if (!esMulta) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); else onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <ScrollText className="w-5 h-5 text-primary" />
            <span>Multa — {esMulta.vehiculo_matricula}</span>
            <Badge className={cn('text-xs', estadoColor(estado))}>{estadoLabel(estado)}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Datos oficiales */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Datos oficiales</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <Dato label="Fecha" valor={esMulta.fecha_multa} />
              <Dato label="Importe" valor={esMulta.importe != null ? `${Number(esMulta.importe).toFixed(2)} €` : '—'} />
              <Dato label="Autoridad" valor={esMulta.autoridad} />
              <Dato label="Expediente" valor={esMulta.numero_expediente || '—'} />
              <Dato label="Motivo" valor={esMulta.motivo_autoridad_detalle || MOTIVO_DESCARGO[esMulta.motivo_autoridad] || esMulta.motivo_autoridad || '—'} />
              <Dato label="Notificación" valor={esMulta.fecha_notificacion || '—'} />
            </div>
          </section>

          {/* Documentos enfrentados: volante + descargo */}
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Documentos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DocumentoBox
                titulo="Volante oficial"
                url={esMulta.volante_url}
                esImagen={volanteEsImagen}
                subidoPor={esMulta.volante_subido_por}
                fecha={esMulta.volante_fecha_subida}
              />
              <DocumentoBox
                titulo="Descargo técnico"
                url={esMulta.descargo_justificante_url}
                esImagen={descargoEsImagen}
                subidoPor={esMulta.descargo_tecnico_email}
                fecha={esMulta.descargo_fecha_subida}
                pendiente={!esMulta.descargo_presenta}
              />
            </div>
            {esMulta.descargo_explicacion && (
              <div className="mt-2 rounded-lg border border-border bg-muted/40 p-2.5">
                <p className="text-xs font-semibold mb-0.5">Explicación del técnico</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{esMulta.descargo_explicacion}</p>
              </div>
            )}
          </section>

          {/* Acción del técnico: subir/corregir descargo */}
          {abiertoParaTecnico && (
            <section className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Presentar descargo</p>
              <MultaUpload
                value={descargo.justificante_url}
                onChange={(v) => setDescargo(d => ({ ...d, justificante_url: v }))}
                label="Justificante / tique del técnico"
              />
              <div>
                <Label className="text-xs font-semibold mb-1 block">Infracción que aplicaría en su lugar</Label>
                <MobileSelect
                  value={descargo.motivo_correspondiente}
                  onValueChange={(v) => setDescargo(d => ({ ...d, motivo_correspondiente: v }))}
                  triggerClassName="w-full"
                >
                  <MobileSelectItem value="">Sin especificar</MobileSelectItem>
                  {Object.entries(MOTIVO_DESCARGO).map(([k, label]) => (
                    <MobileSelectItem key={k} value={k}>{label}</MobileSelectItem>
                  ))}
                </MobileSelect>
              </div>
              <Textarea
                value={descargo.explicacion}
                onChange={e => setDescargo(d => ({ ...d, explicacion: e.target.value }))}
                placeholder="Explica por qué no corresponde o qué infracción aplicaría"
                rows={2}
              />
              <Button
                size="sm"
                className="w-full gap-2"
                disabled={!descargo.justificante_url || subirDescargoMutation.isPending}
                onClick={() => subirDescargoMutation.mutate()}
              >
                {subirDescargoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                Presentar descargo
              </Button>
            </section>
          )}

          {/* Acción gerencia/admin: resolver */}
          {puedeResolver && !ESTADO_MULTA[estado]?.label?.includes('resuelto') && estado !== 'anulada' && (
            <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Resolver la multa</p>
              <div>
                <Label className="text-xs font-semibold mb-1 block">Estado final</Label>
                <MobileSelect value={estadoResolucion} onValueChange={setEstadoResolucion} triggerClassName="w-full">
                  <MobileSelectItem value="">Seleccionar resolución…</MobileSelectItem>
                  {ESTADOS_RESOLUCION.map(o => <MobileSelectItem key={o.value} value={o.value}>{o.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <Textarea
                value={notasResolucion}
                onChange={e => setNotasResolucion(e.target.value)}
                placeholder="Notas internas de la resolución"
                rows={2}
              />
              <Button
                size="sm"
                variant="default"
                className="w-full gap-2"
                disabled={!estadoResolucion || resolverMutation.isPending}
                onClick={() => resolverMutation.mutate()}
              >
                {resolverMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                Aplicar resolución
              </Button>
            </section>
          )}

          {/* Historial */}
          {esMulta.historial && esMulta.historial.length > 0 && (
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> Historial
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {[...esMulta.historial].reverse().map((h, i) => (
                  <div key={i} className="text-xs border-l-2 border-border pl-2 py-0.5">
                    <span className="font-medium">{h.fecha ? new Date(h.fecha).toLocaleString('es-ES') : ''}</span>
                    {' · '}
                    <span className="text-muted-foreground">{h.usuario_email}</span>
                    {h.estado_anterior && h.estado_nuevo && (
                      <span className="text-muted-foreground"> · {estadoLabel(h.estado_anterior)} → {estadoLabel(h.estado_nuevo)}</span>
                    )}
                    {h.nota && <p className="text-muted-foreground">{h.nota}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Dato({ label, valor }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{valor || '—'}</p>
    </div>
  );
}

function DocumentoBox({ titulo, url, esImagen, subidoPor, fecha, pendiente }) {
  return (
    <div className={cn('rounded-lg border p-2.5', pendiente ? 'border-dashed border-amber-300 bg-amber-50/30' : 'border-border bg-muted/30')}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold">{titulo}</p>
        {pendiente && <Badge className="bg-amber-100 text-amber-700 text-[10px]">Pendiente</Badge>}
      </div>
      {url ? (
        <div className="flex items-center gap-2">
          {esImagen ? (
            <img src={url} alt={titulo} className="w-16 h-16 object-cover rounded-md border" />
          ) : (
            <div className="w-16 h-16 flex items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileText className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1 min-w-0 text-xs">
            <a href={url} target="_blank" rel="noreferrer" className="text-primary underline block truncate">Abrir</a>
            {subidoPor && <p className="text-muted-foreground truncate">por {subidoPor}</p>}
            {fecha && <p className="text-muted-foreground">{new Date(fecha).toLocaleDateString('es-ES')}</p>}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-16 text-xs text-muted-foreground gap-1">
          <ImageIcon className="w-4 h-4" /> Sin documento
        </div>
      )}
    </div>
  );
}