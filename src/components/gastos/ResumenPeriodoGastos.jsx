import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Calendar, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ResumenPeriodoGastos({ 
  operario, 
  notas = [], 
  isAdmin = false,
  onPeriodosCerrados = null 
}) {
  const qc = useQueryClient();
  const [showCierreDialog, setShowCierreDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const hoy = new Date();
  const diaActual = hoy.getDate();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  const notasDelMes = useMemo(() => {
    return notas.filter(n => {
      if (!n.fecha_documento) return false;
      const fechaNota = format(new Date(n.fecha_documento), 'yyyy-MM');
      if (fechaNota !== mesActual) return false;
      if (!isAdmin && n.operario_id !== operario?.id) return false;
      if (n.estado === 'rechazada') return false;
      return true;
    });
  }, [notas, mesActual, operario?.id, isAdmin]);

  const totalGastos = notasDelMes.reduce((sum, n) => sum + (n.importe || 0), 0);
  const registrosCount = notasDelMes.length;

  const [adelanto, setAdelanto] = useState(0);
  const [periodoActual, setPeriodoActual] = useState(null);

  useEffect(() => {
    const cargarAdelanto = async () => {
      try {
        const periodos = await base44.entities.NotaMensualGasto.filter({
          ciclo_mes: mesActual,
          operario_id: operario?.id
        });
        if (periodos.length > 0) {
          setAdelanto(periodos[0].importe_adelanto || 0);
          setPeriodoActual(periodos[0]);
        }
      } catch (err) {
        console.error('Error cargando adelanto:', err);
      }
    };
    if (operario?.id) cargarAdelanto();
  }, [mesActual, operario?.id]);

  const saldoARecuperar = Math.max(0, totalGastos - adelanto);
  const puedeCerrar = diaActual >= 25;

  const handleCerrarPeriodo = async () => {
    if (!operario?.id) {
      toast.error('No se puede identificar al operario');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ciclo_mes: mesActual,
        operario_id: operario.id,
        operario_name: operario.name,
        total_importe: totalGastos,
        importe_adelanto: adelanto,
        saldo_pendiente: saldoARecuperar,
        total_registros: registrosCount,
        registros_ids: notasDelMes.map(n => n.id),
        estado: 'enviada',
        fecha_cierre: format(new Date(), 'yyyy-MM-dd'),
      };

      if (periodoActual?.id) {
        await base44.entities.NotaMensualGasto.update(periodoActual.id, payload);
        toast.success('Período cerrado correctamente', {
          description: `Saldo a recuperar: ${saldoARecuperar.toFixed(2)} €`
        });
      } else {
        await base44.entities.NotaMensualGasto.create(payload);
        toast.success('Período registrado correctamente', {
          description: `Saldo a recuperar: ${saldoARecuperar.toFixed(2)} €`
        });
      }

      setShowCierreDialog(false);
      qc.invalidateQueries({ queryKey: ['notas_gasto'] });
      qc.invalidateQueries({ queryKey: ['periodos_gasto'] });
      onPeriodosCerrados?.();
    } catch (err) {
      toast.error('Error al cerrar período: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (registrosCount === 0 && adelanto === 0) {
    return null;
  }

  return (
    <>
      <Card className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="w-4 h-4" />
            Resumen del Período ({mesActual})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Gastos</p>
              <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                {totalGastos.toFixed(2)}€
              </p>
              <p className="text-xs text-slate-500 mt-1">{registrosCount} registros</p>
            </div>

            {adelanto > 0 && (
              <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Adelanto</p>
                <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">
                  {adelanto.toFixed(2)}€
                </p>
                <p className="text-xs text-slate-500 mt-1">Recibido</p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-green-200 dark:border-green-800">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">A Recuperar</p>
              <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                {saldoARecuperar.toFixed(2)}€
              </p>
              <p className="text-xs text-slate-500 mt-1">Por reembolsar</p>
            </div>

            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Estado</p>
              <Badge variant={puedeCerrar ? 'default' : 'secondary'} className="text-xs">
                {puedeCerrar ? '✓ Listo' : 'Esperar'}
              </Badge>
              <p className="text-xs text-slate-500 mt-1">Día {diaActual}/31</p>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm text-slate-700 dark:text-slate-300">
                {adelanto > 0 ? (
                  <>
                    <p className="font-semibold mb-1">Adelanto recibido el mes</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Gastaste {totalGastos.toFixed(2)}€ de tu bolsillo. Con el adelanto de {adelanto.toFixed(2)}€, 
                      la empresa te reembolsará <strong>{saldoARecuperar.toFixed(2)}€</strong>.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold mb-1">Registra tus gastos</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Desde el día 25 podrás cerrar el período y recuperar tus gastos.
                    </p>
                  </>
                )}
              </div>
            </div>

            {puedeCerrar && totalGastos > 0 && (
              <Button
                onClick={() => setShowCierreDialog(true)}
                className="mt-4 w-full gap-2"
                disabled={loading}
              >
                <CheckCircle2 className="w-4 h-4" />
                {periodoActual ? 'Actualizar' : 'Cerrar'} Período
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCierreDialog} onOpenChange={setShowCierreDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Cerrar Período {mesActual}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Total de gastos:</span>
                <span className="font-semibold">{totalGastos.toFixed(2)} €</span>
              </div>
              {adelanto > 0 && (
                <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-700 pt-2">
                  <span className="text-slate-600 dark:text-slate-400">Menos adelanto:</span>
                  <span className="font-semibold text-amber-600">- {adelanto.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold border-t border-slate-200 dark:border-slate-700 pt-2 text-green-700 dark:text-green-400">
                <span>A recuperar:</span>
                <span>{saldoARecuperar.toFixed(2)} €</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Se registrarán {registrosCount} gasto{registrosCount !== 1 ? 's' : ''} en este período.
              La empresa recibirá tu solicitud de reembolso.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCierreDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCerrarPeriodo}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <>Guardando...</>
              ) : (
                <>Confirmar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}