import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ScrollText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { toast } from 'sonner';
import { MOTIVO_AUTORIDAD } from './multaConstants';
import MultaUpload from './MultaUpload';

const EMPTY = {
  vehiculo_id: '', fecha_multa: '', fecha_notificacion: '',
  importe: '', autoridad: '', numero_expediente: '',
  motivo_autoridad: 'no_exhibir_tique', motivo_autoridad_detalle: '',
  volante_url: '',
};

export default function MultaFormDialog({ open, onOpenChange, vehiculos = [], vehiculoPreseleccionado = null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const setF = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const crearMutation = useMutation({
    mutationFn: async (data) => {
      const veh = vehiculos.find(v => v.id === data.vehiculo_id);
      const payload = {
        vehiculo_id: data.vehiculo_id,
        vehiculo_matricula: veh?.matricula || '',
        vehiculo_modelo: veh?.modelo || '',
        fecha_multa: data.fecha_multa,
        fecha_notificacion: data.fecha_notificacion || undefined,
        importe: Number(data.importe),
        autoridad: data.autoridad,
        numero_expediente: data.numero_expediente || undefined,
        motivo_autoridad: data.motivo_autoridad,
        motivo_autoridad_detalle: data.motivo_autoridad_detalle || undefined,
        volante_url: data.volante_url || undefined,
        volante_subido_por: user?.email || '',
        volante_fecha_subida: new Date().toISOString(),
        estado: 'pendiente_revision',
        historial: [{
          fecha: new Date().toISOString(),
          usuario_email: user?.email || '',
          accion: 'creacion',
          estado_nuevo: 'pendiente_revision',
          nota: 'Multa registrada',
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
        <div className="space-y-3 py-1">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Fecha de la infracción *</Label>
              <Input type="date" value={form.fecha_multa} onChange={e => setF('fecha_multa')(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Fecha notificación</Label>
              <Input type="date" value={form.fecha_notificacion} onChange={e => setF('fecha_notificacion')(e.target.value)} />
            </div>
          </div>

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

          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Nº expediente / referencia</Label>
            <Input value={form.numero_expediente} onChange={e => setF('numero_expediente')(e.target.value)} placeholder="Referencia impresa en el volante" />
          </div>

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

          <div>
            <Label className="text-xs font-semibold mb-1.5 block">Volante oficial (foto o PDF)</Label>
            <MultaUpload
              value={form.volante_url}
              onChange={setF('volante_url')}
              label="Subir volante oficial"
            />
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