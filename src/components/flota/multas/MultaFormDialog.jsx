import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ScrollText, Sparkles, Clock, MapPin, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MOTIVO_AUTORIDAD } from './multaConstants';
import { mapearMotivoAutoridad } from '@/lib/ocrMultas';
import MultaDocumentoOcr from './MultaDocumentoOcr';

const EMPTY = {
  vehiculo_id: '', fecha_multa: '', hora_multa: '', fecha_notificacion: '',
  importe: '', autoridad: '', autoridad_nif: '', numero_expediente: '',
  lugar_infraccion: '', matricula_impresa: '',
  motivo_autoridad: 'no_exhibir_tique', motivo_autoridad_detalle: '',
  volante_url: '',
  // Datos OCR del volante
  volante_ocr_datos: null,
  volante_ocr_confianza: null,
  volante_ocr_procesado: false,
  volante_precision_revisado: false,
  volante_precision_motivo: '',
  // Justificante del técnico (descargo presentado al crear)
  descargo_presenta: false,
  descargo_justificante_url: '',
  descargo_ocr_datos: null,
  descargo_ocr_confianza: null,
  descargo_ocr_procesado: false,
  descargo_fecha_hora: '',
  descargo_lugar: '',
};

export default function MultaFormDialog({ open, onOpenChange, vehiculos = [], vehiculoPreseleccionado = null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const setF = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  // Cuando el OCR del volante completa, autocompleta los campos del formulario
  const onVolanteOcr = (resultado) => {
    const d = resultado?.datos;
    if (!d) return;
    setForm(f => {
      const motivo = mapearMotivoAutoridad(d.motivo);
      return {
        ...f,
        volante_url: resultado.file_url,
        volante_ocr_datos: d,
        volante_ocr_confianza: resultado.confianza,
        volante_ocr_procesado: true,
        volante_precision_revisado: resultado.precisa,
        volante_precision_motivo: resultado.precision_motivo || '',
        // Autocompletar solo si el OCR trae valor (no pisar lo que el usuario ya escribió)
        fecha_multa: d.fecha_multa || f.fecha_multa,
        hora_multa: d.hora_multa || f.hora_multa,
        importe: (d.importe != null && d.importe !== '' && !Number.isNaN(Number(d.importe))) ? String(d.importe) : f.importe,
        autoridad: d.autoridad || f.autoridad,
        autoridad_nif: d.autoridad_nif || f.autoridad_nif,
        numero_expediente: d.numero_expediente || f.numero_expediente,
        lugar_infraccion: d.lugar_infraccion || f.lugar_infraccion,
        matricula_impresa: d.matricula_impresa || f.matricula_impresa,
        motivo_autoridad: f.motivo_autoridad === 'no_exhibir_tique' && d.motivo ? motivo.motivo_autoridad : f.motivo_autoridad,
        motivo_autoridad_detalle: d.motivo && motivo.motivo_autoridad === 'otro' ? motivo.detalle : (f.motivo_autoridad_detalle || ''),
      };
    });
    if (resultado.respaldo_ia) toast.info('Respaldo IA aplicado al volante');
  };

  // Cuando el OCR del justificante completa
  const onJustificanteOcr = (resultado) => {
    const d = resultado?.datos;
    if (!d) return;
    setForm(f => ({
      ...f,
      descargo_presenta: true,
      descargo_justificante_url: resultado.file_url,
      descargo_ocr_datos: d,
      descargo_ocr_confianza: resultado.confianza,
      descargo_ocr_procesado: true,
      descargo_fecha_hora: d.fecha_documento && d.hora_documento ? `${d.fecha_documento} ${d.hora_documento}` : (d.fecha_documento || f.descargo_fecha_hora),
      descargo_lugar: d.lugar || f.descargo_lugar,
    }));
    if (resultado.respaldo_ia) toast.info('Respaldo IA aplicado al justificante');
  };

  const crearMutation = useMutation({
    mutationFn: async (data) => {
      const veh = vehiculos.find(v => v.id === data.vehiculo_id);
      const payload = {
        vehiculo_id: data.vehiculo_id,
        vehiculo_matricula: veh?.matricula || '',
        vehiculo_modelo: veh?.modelo || '',
        fecha_multa: data.fecha_multa,
        hora_multa: data.hora_multa || undefined,
        fecha_notificacion: data.fecha_notificacion || undefined,
        importe: Number(data.importe),
        autoridad: data.autoridad,
        autoridad_nif: data.autoridad_nif || undefined,
        numero_expediente: data.numero_expediente || undefined,
        lugar_infraccion: data.lugar_infraccion || undefined,
        matricula_impresa: data.matricula_impresa || undefined,
        motivo_autoridad: data.motivo_autoridad,
        motivo_autoridad_detalle: data.motivo_autoridad_detalle || undefined,
        // Volante + OCR
        volante_url: data.volante_url || undefined,
        volante_subido_por: user?.email || '',
        volante_fecha_subida: new Date().toISOString(),
        volante_ocr_datos: data.volante_ocr_datos || undefined,
        volante_ocr_confianza: data.volante_ocr_confianza ?? undefined,
        volante_ocr_procesado: data.volante_ocr_procesado || false,
        volante_precision_revisado: data.volante_precision_revisado || false,
        volante_precision_motivo: data.volante_precision_motivo || undefined,
        // Descargo del técnico presentado al crear (si subió justificante)
        descargo_presenta: data.descargo_presenta,
        descargo_justificante_url: data.descargo_justificante_url || undefined,
        descargo_tecnico_name: user?.full_name || user?.email || '',
        descargo_tecnico_email: user?.email || '',
        descargo_fecha_subida: data.descargo_justificante_url ? new Date().toISOString() : undefined,
        descargo_ocr_datos: data.descargo_ocr_datos || undefined,
        descargo_ocr_confianza: data.descargo_ocr_confianza ?? undefined,
        descargo_ocr_procesado: data.descargo_ocr_procesado || false,
        descargo_fecha_hora: data.descargo_fecha_hora || undefined,
        descargo_lugar: data.descargo_lugar || undefined,
        estado: 'pendiente_revision',
        historial: [{
          fecha: new Date().toISOString(),
          usuario_email: user?.email || '',
          accion: 'creacion',
          estado_nuevo: 'pendiente_revision',
          nota: data.descargo_presenta ? 'Multa registrada con justificante del técnico' : 'Multa registrada',
        }],
      };
      return base44.entities.MultaVehiculo.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['multas-vehiculo'] });
      onOpenChange(false);
      setForm(EMPTY);
      toast.success('Multa registrada');
    },
    onError: (e) => toast.error('Error al registrar la multa', e?.message),
  });

  const guardar = () => {
    if (!form.vehiculo_id) return toast.error('Selecciona el vehículo');
    if (!form.fecha_multa) return toast.error('Indica la fecha de la infracción');
    if (!form.importe || Number(form.importe) <= 0) return toast.error('Importe obligatorio');
    if (!form.autoridad) return toast.error('Indica la autoridad');
    crearMutation.mutate(form);
  };

  const cerrar = () => { onOpenChange(false); setForm(EMPTY); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cerrar(); else onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />
            Nueva multa de vehículo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {/* Vehículo */}
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Vehículo *</Label>
            <MobileSelect
              value={form.vehiculo_id}
              onValueChange={setF('vehiculo_id')}
              triggerClassName="w-full"
            >
              {vehiculos.map(v => (
                <MobileSelectItem key={v.id} value={v.id}>
                  {v.matricula} — {v.modelo}
                </MobileSelectItem>
              ))}
            </MobileSelect>
          </div>

          {/* Volante oficial con OCR */}
          <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/20">
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-primary" />
              <Label className="text-xs font-semibold">Volante oficial — captura + OCR automático</Label>
            </div>
            {form.volante_ocr_procesado && form.volante_ocr_confianza != null && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-[10px]">
                  Confianza {Math.round(form.volante_ocr_confianza * 100)}%
                </Badge>
                {form.volante_precision_revisado && (
                  <Badge className="text-[10px] bg-purple-100 text-purple-700 border-purple-200 gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> Respaldo IA
                  </Badge>
                )}
              </div>
            )}
            <MultaDocumentoOcr
              tipo="volante"
              onComplete={onVolanteOcr}
            />
          </div>

          {/* Fecha + hora */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label className="text-xs font-semibold mb-1.5 block">Fecha infracción *</Label>
              <Input type="date" value={form.fecha_multa} onChange={e => setF('fecha_multa')(e.target.value)} />
            </div>
            <div className="col-span-1">
              <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1">
                <Clock className="w-3 h-3" /> Hora
              </Label>
              <Input type="time" value={form.hora_multa} onChange={e => setF('hora_multa')(e.target.value)} placeholder="HH:MM" />
            </div>
            <div className="col-span-1">
              <Label className="text-xs font-semibold mb-1.5 block">Notificación</Label>
              <Input type="date" value={form.fecha_notificacion} onChange={e => setF('fecha_notificacion')(e.target.value)} />
            </div>
          </div>

          {/* Importe + autoridad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Importe (€) *</Label>
              <Input type="number" step="0.01" value={form.importe} onChange={e => setF('importe')(e.target.value)} placeholder="90,00" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Autoridad *</Label>
              <Input value={form.autoridad} onChange={e => setF('autoridad')(e.target.value)} placeholder="Ayuntamiento / SER / Parking" />
            </div>
          </div>

          {/* NIF autoridad + expediente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">NIF autoridad</Label>
              <Input value={form.autoridad_nif} onChange={e => setF('autoridad_nif')(e.target.value)} placeholder="Extraído por OCR" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Nº expediente</Label>
              <Input value={form.numero_expediente} onChange={e => setF('numero_expediente')(e.target.value)} placeholder="Referencia del volante" />
            </div>
          </div>

          {/* Lugar + matrícula impresa */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Lugar infracción
              </Label>
              <Input value={form.lugar_infraccion} onChange={e => setF('lugar_infraccion')(e.target.value)} placeholder="Calle / zona" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Matrícula impresa</Label>
              <Input value={form.matricula_impresa} onChange={e => setF('matricula_impresa')(e.target.value)} placeholder="Si aparece en el documento" />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Motivo alegado por la autoridad *</Label>
            <MobileSelect value={form.motivo_autoridad} onValueChange={setF('motivo_autoridad')} triggerClassName="w-full">
              {Object.entries(MOTIVO_AUTORIDAD).map(([k, label]) => (
                <MobileSelectItem key={k} value={k}>{label}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>

          {form.motivo_autoridad === 'otro' && (
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Detalle del motivo</Label>
              <Input value={form.motivo_autoridad_detalle} onChange={e => setF('motivo_autoridad_detalle')(e.target.value)} />
            </div>
          )}

          {/* Justificante del técnico (descargo al crear) */}
          <div className="space-y-2 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/10 p-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <Label className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                Justificante del técnico (opcional, si lo tienes ahora)
              </Label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Sube el ticket de parking / parquímetro que validaría el descargo. Se extraen fecha, hora e importe por IA.
            </p>
            <MultaDocumentoOcr
              tipo="justificante"
              onComplete={onJustificanteOcr}
              label="Ticket de parking / justificante"
            />
            {form.descargo_presenta && form.descargo_fecha_hora && (
              <div className="text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Justificante: {form.descargo_fecha_hora}
                {form.descargo_lugar && <> · {form.descargo_lugar}</>}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={cerrar} disabled={crearMutation.isPending}>Cancelar</Button>
          <Button onClick={guardar} disabled={crearMutation.isPending} className="gap-2">
            {crearMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar multa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}