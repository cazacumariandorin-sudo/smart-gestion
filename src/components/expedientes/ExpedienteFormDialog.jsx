import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, Save } from 'lucide-react';
import {
  ARTICULOS_EXPEDIENTE, ORIGEN_EXPEDIENTE, TIPO_FALTA_META,
  calcularFechasExpediente, siguienteCodigoExpediente,
} from '@/lib/expedientesCatalogo';

const hoy = () => new Date().toISOString().slice(0, 10);

const formVacio = {
  operario_id: '', operario_name: '',
  tipo_falta: 'leve', articulo: 'Art. 55.a', origen: 'manual',
  fecha_apertura: hoy(), fecha_conocimiento: hoy(), fecha_notificacion: '',
  descripcion_hechos: '', reincidencia: false, expediente_origen_id: '', notas_internas: '',
};

/**
 * Apertura de un expediente sancionador. Calcula el código EXP-AAAA-NNN y los
 * plazos de prescripción (desde el conocimiento) y caducidad (desde el archivo).
 */
export default function ExpedienteFormDialog({ open, onOpenChange, operarios = [], expedientes = [] }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(formVacio);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) setForm(formVacio);
  }, [open]);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const elegirOperario = (id) => {
    const op = operarios.find((o) => o.id === id);
    setForm((f) => ({ ...f, operario_id: id, operario_name: op?.name || '', operario_email: op?.email || '', operario_dni: op?.dni || '' }));
  };

  const anteriores = expedientes.filter((e) => e.operario_id === form.operario_id && e.id);

  const guardar = async () => {
    if (!form.operario_id) return;
    setGuardando(true);
    try {
      const codigo = siguienteCodigoExpediente(expedientes, form.fecha_apertura.slice(0, 4));
      const plazos = calcularFechasExpediente({
        tipo_falta: form.tipo_falta,
        fecha_conocimiento: form.fecha_conocimiento,
      });
      const ahora = new Date().toISOString();
      await base44.entities.Expediente.create({
        ...form,
        codigo,
        ...plazos,
        estado: 'abierto',
        abierto_por: user?.email || '',
        historial: [{
          fecha: ahora,
          usuario_email: user?.email || '',
          accion: 'Expediente abierto',
          estado_nuevo: 'abierto',
          nota: form.descripcion_hechos?.slice(0, 180),
        }],
      });
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes-kpi'] });
      onOpenChange(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abrir expediente</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Trabajador</Label>
            <MobileSelect value={form.operario_id} onValueChange={elegirOperario} placeholder="Seleccionar trabajador">
              {operarios.map((o) => (
                <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Calificación</Label>
              <MobileSelect value={form.tipo_falta} onValueChange={(v) => set('tipo_falta', v)} placeholder="Tipo">
                {Object.entries(TIPO_FALTA_META).map(([value, meta]) => (
                  <MobileSelectItem key={value} value={value}>{meta.label}</MobileSelectItem>
                ))}
              </MobileSelect>
            </div>
            <div>
              <Label className="text-xs">Origen</Label>
              <MobileSelect value={form.origen} onValueChange={(v) => set('origen', v)} placeholder="Origen">
                {ORIGEN_EXPEDIENTE.map((o) => (
                  <MobileSelectItem key={o.value} value={o.value}>{o.label}</MobileSelectItem>
                ))}
              </MobileSelect>
            </div>
          </div>

          <div>
            <Label className="text-xs">Artículo del convenio</Label>
            <MobileSelect value={form.articulo} onValueChange={(v) => set('articulo', v)} placeholder="Artículo">
              {ARTICULOS_EXPEDIENTE.map((a) => (
                <MobileSelectItem key={a.value} value={a.value}>{a.label}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Fecha de apertura</Label>
              <Input type="date" value={form.fecha_apertura} onChange={(e) => set('fecha_apertura', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Fecha de conocimiento</Label>
              <Input type="date" value={form.fecha_conocimiento} onChange={(e) => set('fecha_conocimiento', e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Fecha de notificación (si ya se notificó)</Label>
            <Input type="date" value={form.fecha_notificacion} onChange={(e) => set('fecha_notificacion', e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Hechos</Label>
            <Textarea
              rows={3}
              value={form.descripcion_hechos}
              onChange={(e) => set('descripcion_hechos', e.target.value)}
              placeholder="Relación de hechos que motivan el expediente"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.reincidencia} onCheckedChange={(v) => set('reincidencia', !!v)} />
            Se abre por reincidencia
          </label>

          {form.reincidencia && anteriores.length > 0 && (
            <div>
              <Label className="text-xs">Expediente anterior</Label>
              <MobileSelect
                value={form.expediente_origen_id}
                onValueChange={(v) => set('expediente_origen_id', v)}
                placeholder="Seleccionar antecedente"
              >
                {anteriores.map((e) => (
                  <MobileSelectItem key={e.id} value={e.id}>{e.codigo} · {e.fecha_apertura}</MobileSelectItem>
                ))}
              </MobileSelect>
            </div>
          )}

          <div>
            <Label className="text-xs">Notas internas</Label>
            <Textarea rows={2} value={form.notas_internas} onChange={(e) => set('notas_internas', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={!form.operario_id || guardando}>
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Abrir expediente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}