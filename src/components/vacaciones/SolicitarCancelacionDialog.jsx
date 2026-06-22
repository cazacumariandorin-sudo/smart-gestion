import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function SolicitarCancelacionDialog({ open, onOpenChange, vacacion, currentUser }) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState('');

  const mutation = useMutation({
    mutationFn: () => base44.entities.SolicitudCancelacionVacacion.create({
      vacacion_id: vacacion.id,
      operario_id: vacacion.operario_id,
      operario_name: vacacion.operario_name,
      fecha_inicio_vac: vacacion.fecha_inicio,
      fecha_fin_vac: vacacion.fecha_fin || vacacion.fecha_inicio,
      tipo_vac: vacacion.tipo,
      motivo,
      estado: 'pendiente',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitudes_cancelacion'] });
      setMotivo('');
      onOpenChange(false);
    },
  });

  if (!vacacion) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" /> Solicitar cancelación
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <p><span className="font-medium">Período:</span> {vacacion.fecha_inicio}{vacacion.fecha_fin && vacacion.fecha_fin !== vacacion.fecha_inicio ? ` → ${vacacion.fecha_fin}` : ''}</p>
            <p><span className="font-medium">Días:</span> {vacacion.dias || 1}</p>
            <p><span className="font-medium">Tipo:</span> {vacacion.tipo}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo de la cancelación *</Label>
            <Textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              placeholder="Explica el motivo por el que necesitas cancelar esta ausencia..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!motivo.trim() || mutation.isPending}
            className="gap-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Enviar solicitud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}