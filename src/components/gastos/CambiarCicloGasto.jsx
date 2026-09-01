import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { toast } from 'sonner';
import { CalendarRange, Loader2, ArrowRight } from 'lucide-react';

/**
 * Permite a gerencia/admin reasignar un RegistroGasto a otro ciclo mensual
 * (NotaMensualGasto) del mismo operario. Recalcula totales y registros_ids
 * de los ciclos afectados (origen y destino). No usa backend.
 */
export default function CambiarCicloGasto({ nota }) {
  const qc = useQueryClient();
  const [nuevoCicloId, setNuevoCicloId] = useState('');
  const [guardando, setGuardando] = useState(false);

  const { data: ciclos = [] } = useQuery({
    queryKey: ['cambiar_ciclo_opciones', nota?.operario_id],
    queryFn: () => base44.entities.NotaMensualGasto.filter({ operario_id: nota.operario_id }),
    enabled: !!nota?.operario_id,
  });

  const ciclosOrden = [...ciclos].sort((a, b) => (b.ciclo_mes || '').localeCompare(a.ciclo_mes || ''));
  const cicloActual = ciclosOrden.find(c => c.id === nota.nota_mensual_id)
    || ciclosOrden.find(c => c.ciclo_mes === nota.ciclo_mes);

  const recalcCiclo = async (cicloId) => {
    if (!cicloId) return;
    const regs = await base44.entities.RegistroGasto.filter({ nota_mensual_id: cicloId });
    const ids = regs.map(r => r.id);
    const totalImporte = regs.reduce((s, r) => s + (r.importe || 0), 0);
    const ciclo = ciclosOrden.find(c => c.id === cicloId) || await base44.entities.NotaMensualGasto.get(cicloId);
    const adelantoPagado = await (async () => {
      const adels = await base44.entities.AdelantoParcialCiclo.filter({ nota_mensual_id: cicloId });
      return adels.filter(a => a.estado === 'pagada').reduce((s, a) => s + (a.importe || 0), 0);
    })();
    await base44.entities.NotaMensualGasto.update(cicloId, {
      registros_ids: ids,
      total_registros: ids.length,
      total_importe: Number(totalImporte.toFixed(2)),
      importe_adelanto: Number(adelantoPagado.toFixed(2)),
      saldo_pendiente: Number((totalImporte - adelantoPagado).toFixed(2)),
    });
  };

  const guardar = async () => {
    if (!nuevoCicloId) { toast.error('Selecciona un ciclo de destino'); return; }
    if (nuevoCicloId === (cicloActual?.id || nota.nota_mensual_id)) {
      toast.error('El registro ya pertenece a ese ciclo');
      return;
    }
    const destino = ciclosOrden.find(c => c.id === nuevoCicloId);
    if (!destino) { toast.error('Ciclo de destino no válido'); return; }
    setGuardando(true);
    try {
      await base44.entities.RegistroGasto.update(nota.id, {
        nota_mensual_id: destino.id,
        ciclo_mes: destino.ciclo_mes,
      });
      // Recalcular ciclo origen y destino
      const afectados = new Set();
      if (nota.nota_mensual_id) afectados.add(nota.nota_mensual_id);
      afectados.add(destino.id);
      for (const id of afectados) {
        await recalcCiclo(id);
      }
      toast.success(`Registro movido al ciclo ${destino.ciclo_mes}`);
      qc.invalidateQueries({ queryKey: ['notas_gasto'] });
      qc.invalidateQueries({ queryKey: ['nota_mensual_gasto'] });
      qc.invalidateQueries({ queryKey: ['adelantos_parciales'] });
    } catch (e) {
      toast.error(e.message || 'No se pudo cambiar el ciclo');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 space-y-2">
      <div className="flex items-center gap-1.5">
        <CalendarRange className="w-3.5 h-3.5 text-blue-600" />
        <Label className="text-xs font-semibold text-blue-700 dark:text-blue-300">Ciclo mensual</Label>
        {nota.ciclo_mes && (
          <Badge variant="outline" className="text-[10px] font-mono ml-auto">
            {cicloActual?.numero_ciclo || nota.ciclo_mes}
          </Badge>
        )}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label className="text-[10px] text-muted-foreground">Mover a otro ciclo</Label>
          <MobileSelect value={nuevoCicloId} onValueChange={setNuevoCicloId} placeholder="Seleccionar ciclo destino">
            {ciclosOrden
              .filter(c => c.id !== (cicloActual?.id || nota.nota_mensual_id))
              .map(c => (
                <MobileSelectItem key={c.id} value={c.id}>
                  {c.numero_ciclo || c.ciclo_mes} — {c.estado || 'borrador'}
                </MobileSelectItem>
              ))}
          </MobileSelect>
        </div>
        <Button size="sm" onClick={guardar} disabled={guardando || !nuevoCicloId} className="gap-1 shrink-0">
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
          Mover
        </Button>
      </div>
    </div>
  );
}