import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import ObraSelectorObras from '@/components/obras/ObraSelectorObras';
import { Loader2 } from 'lucide-react';

const PRIORIDADES = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
];

/**
 * NuevaSolicitudDirecta — formulario para que gerencia/admin/director_comercial/jefe_obra
 * creen un TrabajoExtraObra o MaterialPendiente directamente (visita/seguimiento de obra),
 * sin necesidad de crear un parte diario.
 *
 * Props:
 *   open, onOpenChange
 *   tipo: 'trabajo_extra' | 'material_pendiente'
 */
export default function NuevaSolicitudDirecta({ open, onOpenChange, tipo }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const esTrabajo = tipo === 'trabajo_extra';

  const [obra, setObra] = useState({ obra_id: null, obra_name: '', obra_tipo: 'otro' });
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState('media');
  const [importeEstimado, setImporteEstimado] = useState('');

  const reset = () => {
    setObra({ obra_id: null, obra_name: '', obra_tipo: 'otro' });
    setFecha(new Date().toISOString().split('T')[0]);
    setDescripcion('');
    setPrioridad('media');
    setImporteEstimado('');
  };

  const resolverCliente = async () => {
    if (!obra.obra_id) return { client_id: '', client_name: '' };
    try {
      if (obra.obra_tipo === 'solar') {
        const s = await base44.entities.SolarObra.get(obra.obra_id);
        return { client_id: s.client_id || '', client_name: s.client_name || '' };
      }
      const o = await base44.entities.Obra.get(obra.obra_id);
      return { client_id: o.client_id || '', client_name: o.client_name || '' };
    } catch {
      return { client_id: '', client_name: '' };
    }
  };

  const crearMut = useMutation({
    mutationFn: async () => {
      const d = new Date(`${fecha}T00:00:00`);
      const anio = d.getFullYear();
      const mesNum = d.getMonth() + 1;
      const mesKey = `${anio}-${String(mesNum).padStart(2, '0')}`;
      const { client_id, client_name } = await resolverCliente();
      const base = {
        obra_id: obra.obra_id,
        obra_name: obra.obra_name,
        obra_tipo: obra.obra_tipo,
        client_id,
        client_name,
        parte_id: null, // Sin parte diario — registro directo de visita/seguimiento
        fecha_solicitud: fecha,
        solicitado_por_email: user?.email,
        solicitado_por_nombre: user?.full_name || user?.email,
        solicitado_por_rol: user?.role,
        descripcion: descripcion.trim(),
        prioridad,
        mes: mesKey,
        anio,
        mes_numero: mesNum,
      };
      if (esTrabajo) {
        return base44.entities.TrabajoExtraObra.create({
          ...base,
          importe_estimado: importeEstimado ? Number(importeEstimado) : null,
          estado: 'pendiente',
        });
      }
      return base44.entities.MaterialPendiente.create({
        ...base,
        estado: 'pendiente',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [esTrabajo ? 'trabajos-extras-obra' : 'materiales-pendientes'] });
      reset();
      onOpenChange(false);
    },
  });

  const puedeCrear = descripcion.trim() && obra.obra_name.trim() && fecha;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {esTrabajo ? 'Nueva solicitud de trabajo extra' : 'Nueva solicitud de material pendiente'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Obra / Lugar *</Label>
            <ObraSelectorObras
              value={obra}
              onChange={(v) => setObra(v)}
              placeholder="Seleccionar obra o lugar..."
              triggerClassName="h-10"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Fecha de la solicitud *</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{esTrabajo ? 'Descripción del trabajo extra *' : 'Detalle del material necesario *'}</Label>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              placeholder={esTrabajo ? 'Describe el trabajo extra solicitado por el cliente...' : 'Describe el material pendiente solicitado...'}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Prioridad</Label>
              <MobileSelect value={prioridad} onValueChange={setPrioridad} triggerClassName="h-10">
                {PRIORIDADES.map((p) => (
                  <MobileSelectItem key={p.value} value={p.value}>{p.label}</MobileSelectItem>
                ))}
              </MobileSelect>
            </div>
            {esTrabajo && (
              <div className="space-y-1">
                <Label className="text-xs">Importe estimado (€)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={importeEstimado}
                  onChange={(e) => setImporteEstimado(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Registro directo desde visita/seguimiento de obra — no se creará ningún parte diario asociado.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={crearMut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => crearMut.mutate()} disabled={!puedeCrear || crearMut.isPending}>
            {crearMut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear solicitud
          </Button>
        </DialogFooter>
        {crearMut.isError && (
          <p className="text-xs text-destructive">
            Error al crear: {crearMut.error?.message || 'inténtalo de nuevo'}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}