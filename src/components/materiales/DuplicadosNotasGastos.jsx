/**
 * DuplicadosNotasGastos — examina los documentos repetidos (misma URL de archivo
 * en varios RegistroGasto) y permite al usuario borrar los registros sobrantes.
 * Nunca borra por su cuenta: la selección y la confirmación son explícitas.
 */
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Copy, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const ESTADO_COLOR = {
  borrador: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  pendiente: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  registrado: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  rechazada: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  pagada: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
};

export default function DuplicadosNotasGastos({ grupos = [], onChanged }) {
  const [sel, setSel] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const toggle = (id) => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const eliminar = async () => {
    setBorrando(true);
    const fallos = [];
    for (const id of sel) {
      try {
        await base44.entities.RegistroGasto.delete(id);
      } catch (e) {
        fallos.push(String(e?.message || e).slice(0, 100));
      }
    }
    setBorrando(false);
    setConfirmOpen(false);
    const ok = sel.length - fallos.length;
    if (ok > 0) toast.success(`${ok} registro(s) duplicado(s) eliminado(s)`);
    if (fallos.length) toast.error(`No se pudieron borrar ${fallos.length}: ${fallos[0]}`);
    setSel([]);
    onChanged?.();
  };

  if (!grupos.length) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
        No hay documentos duplicados entre las notas de gastos.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          El mismo archivo aparece en varios registros. Marca los que quieras borrar: se elimina el registro completo
          (con sus adjuntos); el documento sigue en los que dejes sin marcar.
        </p>
        <Button
          size="sm"
          variant="destructive"
          disabled={!sel.length || borrando}
          onClick={() => setConfirmOpen(true)}
          className="gap-1.5 shrink-0"
        >
          {borrando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Eliminar ({sel.length})
        </Button>
      </div>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {grupos.map(g => (
          <div key={g.url} className="rounded-xl border overflow-hidden">
            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30 flex items-center gap-2 text-xs">
              <Copy className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="font-semibold shrink-0">Mismo archivo en {g.items.length} registros</span>
              <span className="truncate text-muted-foreground ml-auto">{String(g.url).split('/').pop()}</span>
            </div>
            <div className="divide-y">
              {g.items.map(it => {
                const checked = sel.includes(it.registro_id);
                return (
                  <label
                    key={it.key}
                    className={`flex items-start gap-3 px-3 py-2 cursor-pointer transition ${checked ? 'bg-red-50 dark:bg-red-950/20' : 'hover:bg-muted/40'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(it.registro_id)}
                      className="mt-1 w-4 h-4 accent-red-600 shrink-0"
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <p className="font-semibold truncate">
                        {it.nombre_comercio || '(sin comercio)'}
                        {it.numero_factura ? ` · ${it.numero_factura}` : ''}
                      </p>
                      <p className="text-muted-foreground truncate">
                        {it.fecha_documento || '—'} · {it.operario_name || '—'} · {it.importe ? `${Number(it.importe).toFixed(2)}€` : '—'}
                        {it.numero_nota ? ` · ${it.numero_nota}` : ''}
                      </p>
                    </div>
                    <Badge className={`${ESTADO_COLOR[it.estado] || ESTADO_COLOR.borrador} border-0 text-[10px] shrink-0`}>
                      {it.estado || '—'}
                    </Badge>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {sel.length} registro(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán definitivamente los registros de nota de gasto seleccionados y sus adjuntos.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminar} disabled={borrando} className="bg-red-600 hover:bg-red-700">
              {borrando ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}