import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { numeroParteVisible, asignarNumeroParte } from '@/lib/numeroParte';

/**
 * Primera línea de la ficha del parte: número único centrado.
 * Si el parte aún no tiene número (p. ej. falló la red al crearlo) permite asignarlo.
 */
export default function NumeroParteBanner({ order, puedeAsignar = true }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const numero = numeroParteVisible(order);

  const asignar = async () => {
    setBusy(true);
    try {
      const n = await asignarNumeroParte(order.id);
      await queryClient.invalidateQueries({ queryKey: ['workorder', order.id] });
      await queryClient.invalidateQueries({ queryKey: ['workorders'] });
      toast.success(`Número asignado: ${n}`);
    } catch (err) {
      console.error('[Parte] asignar número', err);
      toast.error('No se pudo asignar el número. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-center py-2 px-4 border-b bg-muted/30">
      {numero ? (
        <p className="font-mono font-bold text-sm tracking-wide text-foreground">Parte {numero}</p>
      ) : (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Parte sin número</span>
          {puedeAsignar && (
            <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={asignar} disabled={busy}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Hash className="w-3 h-3" />}
              Asignar número
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
