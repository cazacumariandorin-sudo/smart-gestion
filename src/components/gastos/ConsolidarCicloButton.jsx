import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CalendarClock, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

/**
 * Botón "Consolidar ciclo" — invoca `cerrarCicloGastosMensual` bajo demanda para
 * un mes concreto (por defecto el mes en curso), desbloqueando los registros en
 * borrador/pendiente hacia la nota mensual (estado enviada). Idempotente.
 *
 * Visible para admin/propietario/gerencia/administracion/director_comercial.
 */
export default function ConsolidarCicloButton({ ciclosDisponibles }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [mesSel, setMesSel] = useState('');

  // Mes en curso por defecto (calendario natural)
  const mesEnCurso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const mesesOptions = useMemo(() => {
    const set = new Set([mesEnCurso, ...ciclosDisponibles]);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [mesEnCurso, ciclosDisponibles]);

  const mesAConsolidar = mesSel || mesEnCurso;

  const ejecutar = async () => {
    setEjecutando(true);
    setResultado(null);
    try {
      const res = await base44.functions.invoke('cerrarCicloGastosMensual', { ciclo_mes: mesAConsolidar });
      const data = res?.data?.success !== undefined ? res.data : res;
      if (!data || data.success === false) throw new Error(data?.error || 'Cierre fallido');
      setResultado(data);
      qc.invalidateQueries({ queryKey: ['nota_mensual_gasto'] });
      qc.invalidateQueries({ queryKey: ['notas_gasto'] });
    } catch (e) {
      toast({
        title: 'No se pudo consolidar el ciclo',
        description: e?.message || 'Error desconocido',
        variant: 'destructive',
      });
      setOpen(false);
      setResultado(null);
    } finally {
      setEjecutando(false);
    }
  };

  const cerrar = () => {
    setOpen(false);
    setResultado(null);
    setMesSel('');
    if (resultado) {
      toast({
        title: 'Ciclo consolidado',
        description: resultado.message
          ? `Mes ${resultado.cicloMes}: ${resultado.message.toLowerCase()}`
          : `Mes ${resultado.cicloMes}: ${resultado.notas_creadas || 0} nota(s), ${resultado.detalle?.reduce((s, d) => s + d.registros, 0) || 0} registro(s) consolidados.`,
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!ejecutando) { setOpen(o); if (!o) cerrar(); } }}>
      <AlertDialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-1.5">
          <CalendarClock className="w-4 h-4" />
          <span className="hidden sm:inline">Consolidar ciclo</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Consolidar ciclo de gastos</AlertDialogTitle>
          <AlertDialogDescription>
            Cierra el ciclo del mes seleccionado: los registros en borrador/pendiente se consolidan
            en la nota mensual (pasan a <strong>pendiente</strong>) y la nota avanza a <strong>enviada</strong>.
            Es idempotente: puedes repetirlo sin riesgo. El cierre de pago final se hace luego desde cada nota.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2">
          <label className="text-xs font-semibold mb-1.5 block">Mes a consolidar</label>
          <MobileSelect value={mesAConsolidar} onValueChange={setMesSel} triggerClassName="w-full">
            {mesesOptions.map(m => <MobileSelectItem key={m} value={m}>{m}</MobileSelectItem>)}
          </MobileSelect>
        </div>

        {resultado && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-green-800 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              {resultado.message ? 'Sin cambios' : `Consolidado · ${resultado.cicloMes}`}
            </div>
            {resultado.message ? (
              <p className="text-green-700">{resultado.message} (mes {resultado.cicloMes}).</p>
            ) : (
              <div className="text-green-700 space-y-0.5">
                <p>{resultado.notas_creadas || 0} nota(s) creada(s)/actualizada(s).</p>
                {(resultado.detalle || []).map((d, i) => (
                  <p key={i} className="pl-2">
                    · {d.registros} registro(s) — {Number(d.total).toFixed(2)} €
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={ejecutando}>{resultado ? 'Cerrar' : 'Cancelar'}</AlertDialogCancel>
          {!resultado && (
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); ejecutar(); }}
              disabled={ejecutando}
            >
              {ejecutando ? <><Loader2 className="w-4 h-4 animate-spin" /> Consolidando…</> : 'Consolidar'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}