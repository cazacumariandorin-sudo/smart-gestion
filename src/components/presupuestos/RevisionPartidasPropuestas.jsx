import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

/**
 * Revisión de las partidas propuestas por la IA antes de incorporarlas.
 * Todo es editable: descripción, cantidad, unidad y detalle.
 */
export default function RevisionPartidasPropuestas({ datos, archivo, onIncorporar, onDescartar }) {
  const [lineas, setLineas] = useState(() => (datos?.partidas || []).map((p, i) => ({
    key: `${i}-${p.descripcion || 'partida'}`,
    incluir: true,
    capitulo: p.capitulo || '',
    descripcion: p.descripcion || '',
    cantidad: p.cantidad_detectada ? (Number(p.cantidad) || 1) : 1,
    unidad: p.unidad || 'ud',
    detalle: [p.medicion, p.detalle].filter(Boolean).join(' · '),
    cantidadDetectada: !!p.cantidad_detectada,
  })));

  const cambiar = (key, campo, valor) => setLineas(prev => prev.map(l => l.key === key ? { ...l, [campo]: valor } : l));
  const seleccionadas = lineas.filter(l => l.incluir && l.descripcion.trim());

  const incorporar = () => {
    onIncorporar(seleccionadas.map(l => ({
      tipo: 'linea',
      descripcion: l.capitulo ? `${l.capitulo} · ${l.descripcion}` : l.descripcion,
      cantidad: Number(l.cantidad) || 1,
      unidad: l.unidad || 'ud',
      detalle: l.detalle,
    })));
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">{archivo?.nombre || 'Documento'}</p>
          {datos?.resumen && <p className="text-[11px] text-muted-foreground line-clamp-2">{datos.resumen}</p>}
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onDescartar} title="Cerrar revisión">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {lineas.length === 0 ? (
        <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>El documento no describe partidas que se puedan incorporar. Puedes añadirlas a mano.</span>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Revisa y corrige antes de incorporar. Nada se añade al presupuesto hasta que lo confirmes.
          </p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {lineas.map(l => (
              <div key={l.key} className={`rounded-md border p-2 space-y-1.5 ${l.incluir ? 'bg-background' : 'bg-muted/40 opacity-60'}`}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1.5" checked={l.incluir} onChange={(e) => cambiar(l.key, 'incluir', e.target.checked)} />
                  <Input className="h-7 text-xs" value={l.descripcion} onChange={(e) => cambiar(l.key, 'descripcion', e.target.value)} placeholder="Descripción de la partida" />
                </div>
                <div className="grid grid-cols-12 gap-1.5 pl-6">
                  <Input className="col-span-3 h-7 text-xs text-center px-1" type="number" step="any" value={l.cantidad}
                    onChange={(e) => cambiar(l.key, 'cantidad', parseFloat(e.target.value) || 0)} title="Cantidad" />
                  <Input className="col-span-3 h-7 text-xs text-center px-1" value={l.unidad}
                    onChange={(e) => cambiar(l.key, 'unidad', e.target.value)} title="Unidad" />
                  <Input className="col-span-6 h-7 text-[11px]" value={l.detalle}
                    onChange={(e) => cambiar(l.key, 'detalle', e.target.value)} placeholder="Detalle / medición (opcional)" />
                </div>
                {!l.cantidadDetectada && (
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 pl-6 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> El documento no indica cantidad: revisa el valor antes de aceptar.
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {(datos?.supuestos?.length > 0 || datos?.datos_no_disponibles?.length > 0) && (
        <div className="rounded-md border border-border bg-muted/30 p-2 space-y-1">
          {datos.supuestos?.length > 0 && (
            <p className="text-[10px] text-muted-foreground"><span className="font-semibold">Supuestos:</span> {datos.supuestos.join(' · ')}</p>
          )}
          {datos.datos_no_disponibles?.length > 0 && (
            <p className="text-[10px] text-muted-foreground"><span className="font-semibold">No consta:</span> {datos.datos_no_disponibles.join(' · ')}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px]">{seleccionadas.length} de {lineas.length} seleccionadas</Badge>
        <Button type="button" size="sm" className="gap-1.5 ml-auto" onClick={incorporar} disabled={seleccionadas.length === 0}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Incorporar partidas
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDescartar}>No incorporar</Button>
      </div>
    </div>
  );
}