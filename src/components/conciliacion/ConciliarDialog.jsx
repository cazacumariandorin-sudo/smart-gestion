import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * ConciliarDialog — abre un diálogo para que el rol contabilidad marque la conciliación.
 * Solo visible para contabilidad. Llama a la función marcarConciliacionContable.
 */
export default function ConciliarDialog({ open, onOpenChange, documento, tipo, onSuccess }) {
  const [estado, setEstado] = useState('conciliado');
  const [nota, setNota] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        estado_conciliacion: estado,
        nota: nota || undefined,
      };
      if (tipo === 'registro') payload.registro_id = documento.id;
      else payload.material_doc_id = documento.id;
      const res = await base44.functions.invoke('marcarConciliacionContable', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success(
        estado === 'conciliado_con_discrepancia'
          ? 'Discrepancia registrada — se ha avisado a gerencia'
          : 'Conciliación registrada'
      );
      onOpenChange(false);
      setNota('');
      setEstado('conciliado');
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || err.message || 'Error al conciliar');
    },
  });

  if (!documento) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Conciliar documento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <p className="font-medium">
              {tipo === 'registro'
                ? `Gasto ${documento.numero_nota || ''}`
                : `Documento ${documento.numero_documento || documento.id}`}
            </p>
            <p className="text-muted-foreground">
              {documento.nombre_comercio || documento.proveedor_nombre || '—'} ·
              {' '}{(documento.importe || 0).toFixed(2)} €
            </p>
            <p className="text-xs text-muted-foreground">
              Estado: {documento.estado}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Estado de conciliación</Label>
            <MobileSelect value={estado} onValueChange={setEstado} placeholder="Seleccionar estado">
              <MobileSelectItem value="conciliado">Conciliado (limpio)</MobileSelectItem>
              <MobileSelectItem value="conciliado_con_discrepancia">Con discrepancia (avisa a gerencia)</MobileSelectItem>
            </MobileSelect>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Nota de conciliación (opcional)</Label>
            <Textarea
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Referencia contable, discrepancia detectada, etc."
              rows={3}
            />
          </div>

          {estado === 'conciliado_con_discrepancia' && (
            <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2 border border-amber-200">
              Se creará automáticamente una tarea de alta prioridad para gerencia. La gestoría no resuelve la discrepancia.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="gap-1.5">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar conciliación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}