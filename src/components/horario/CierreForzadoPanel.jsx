/**
 * CierreForzadoPanel — herramienta para gerencia/admin.
 * Permite ver y cerrar en bloque todos los fichajes sin hora de salida
 * de cualquier fecha, aplicando el horario estándar (18:04, pausa 14:07-15:02).
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Clock, CheckCircle2, AlertTriangle, Search, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CierreForzadoPanel() {
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [preview, setPreview] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const buscar = async () => {
    setCargando(true);
    setPreview(null);
    setResultado(null);
    try {
      const res = await base44.functions.invoke('forzarCierreFichajes', { fecha, modo: 'preview' });
      setPreview(res.data);
    } catch (e) {
      toast.error('Error al consultar: ' + e.message);
    } finally {
      setCargando(false);
    }
  };

  const ejecutar = async () => {
    setShowConfirm(false);
    setEjecutando(true);
    try {
      const res = await base44.functions.invoke('forzarCierreFichajes', { fecha, modo: 'ejecutar' });
      setResultado(res.data);
      setPreview(null);
      // Invalidar fichajes en todas las vistas
      qc.invalidateQueries({ queryKey: ['fichajes_shared'] });
      qc.invalidateQueries({ queryKey: ['fichajes'] });
      toast.success(`${res.data?.completados || 0} fichajes cerrados`, {
        description: `Fecha: ${fecha} · Hora asignada: 18:04`,
        duration: 5000,
      });
    } catch (e) {
      toast.error('Error al ejecutar: ' + e.message);
    } finally {
      setEjecutando(false);
    }
  };

  const fechaLabel = fecha
    ? format(new Date(fecha + 'T12:00:00'), "EEEE, d 'de' MMMM yyyy", { locale: es })
    : '';

  return (
    <div className="space-y-5 p-1">
      {/* Cabecera */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
        <Zap className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">Cierre forzado de fichajes</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
            Cierra todos los fichajes sin hora de salida de la fecha seleccionada.
            Se asigna <strong>18:04</strong> como hora de salida y pausa <strong>14:07–15:02</strong>.
            Queda registrado quién realizó el cierre.
          </p>
        </div>
      </div>

      {/* Selector de fecha + botón buscar */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Fecha a revisar</label>
          <Input type="date" value={fecha} onChange={e => { setFecha(e.target.value); setPreview(null); setResultado(null); }} className="h-9" />
        </div>
        <Button onClick={buscar} disabled={cargando || !fecha} className="h-9 gap-2 shrink-0">
          {cargando ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Buscando…</> : <><Search className="w-3.5 h-3.5" /> Buscar abiertos</>}
        </Button>
      </div>

      {fechaLabel && <p className="text-xs text-muted-foreground capitalize -mt-3">{fechaLabel}</p>}

      {/* Preview — lista de fichajes a cerrar */}
      {preview && !resultado && (
        <div className="space-y-3">
          {preview.pendientes?.length === 0 ? (
            <div className="flex items-center gap-2.5 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Sin fichajes abiertos</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">Todos los fichajes de esta fecha tienen hora de salida registrada.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {preview.total} fichaje{preview.total !== 1 ? 's' : ''} sin cerrar
                </p>
                <Badge variant="outline" className="border-amber-300 text-amber-700 gap-1">
                  <AlertTriangle className="w-3 h-3" /> Se asignará 18:04
                </Badge>
              </div>

              <div className="rounded-xl border overflow-hidden divide-y divide-border/50">
                {preview.pendientes.map((f, i) => (
                  <div key={f.id} className={cn('flex items-center gap-3 px-4 py-2.5 text-sm', i % 2 === 0 ? 'bg-background' : 'bg-muted/30')}>
                    <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                      <Clock className="w-3 h-3 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{f.operario_name}</p>
                      {f.obra && <p className="text-[11px] text-muted-foreground truncate">{f.obra}</p>}
                    </div>
                    <div className="text-right shrink-0 text-xs text-muted-foreground">
                      <span className="font-mono">{f.hora_entrada}</span>
                      <span className="mx-1 opacity-50">→</span>
                      <span className="font-mono font-semibold text-amber-600">{f.hora_salida_propuesta}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={() => setShowConfirm(true)}
                disabled={ejecutando}
                className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Zap className="w-4 h-4" />
                Cerrar {preview.total} fichaje{preview.total !== 1 ? 's' : ''} ahora
              </Button>
            </>
          )}
        </div>
      )}

      {/* Resultado tras ejecutar */}
      {resultado && (
        <div className="space-y-3">
          <div className="flex items-center gap-2.5 p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {resultado.completados} fichaje{resultado.completados !== 1 ? 's' : ''} cerrado{resultado.completados !== 1 ? 's' : ''} correctamente
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-0.5">
                Hora asignada: 18:04 · Pausa: 14:07–15:02 · Por: {resultado.ejecutado_por}
              </p>
            </div>
          </div>

          {resultado.resultados?.length > 0 && (
            <div className="rounded-xl border overflow-hidden divide-y divide-border/50">
              {resultado.resultados.map((r, i) => (
                <div key={i} className={cn('flex items-center gap-3 px-4 py-2.5 text-sm', i % 2 === 0 ? 'bg-background' : 'bg-muted/30')}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="flex-1 font-medium">{r.operario_name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{r.hora_entrada} → {r.hora_salida}</span>
                  <span className="text-xs font-semibold text-primary">{r.horas}h</span>
                </div>
              ))}
            </div>
          )}

          {resultado.errores > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">{resultado.errores} error{resultado.errores !== 1 ? 'es' : ''} al cerrar</p>
              {resultado.errores_detalle?.map((e, i) => (
                <p key={i} className="text-[11px] text-red-600 mt-0.5">{e.operario}: {e.error}</p>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={() => { setResultado(null); setPreview(null); }} className="w-full">
            Nueva búsqueda
          </Button>
        </div>
      )}

      {/* Diálogo de confirmación */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Confirmar cierre forzado
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se van a cerrar <strong>{preview?.total}</strong> fichaje{preview?.total !== 1 ? 's' : ''} del día <strong>{fechaLabel}</strong> asignando:
              <ul className="list-disc list-inside mt-2 space-y-0.5 text-sm">
                <li>Hora de salida: <strong>18:04</strong></li>
                <li>Pausa: <strong>14:07 – 15:02</strong></li>
                <li>Nota: cierre forzado con tu email y timestamp</li>
              </ul>
              <br />Esta acción no se puede deshacer automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={ejecutar} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Sí, cerrar fichajes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}