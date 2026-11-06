import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function minutosATexto(mins) {
  if (!mins || mins <= 0) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Botón "+N" dentro de la celda del día: abre la lista completa de personas
 * fichadas ese día sin disparar el detalle del día.
 */
export default function PersonasDiaPopover({ personas, ocultas, dateLabel }) {
  return (
    <span onClick={e => e.stopPropagation()} className="inline-block">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-[8px] font-bold text-primary underline decoration-dotted underline-offset-2 hover:no-underline"
            title="Ver todas las personas del día"
          >
            +{ocultas} más
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Personas del día{dateLabel ? ` · ${dateLabel}` : ''}
          </p>
          <div className="max-h-64 overflow-y-auto">
            {personas.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-[11px] py-0.5">
                <span className="truncate">{p.name}</span>
                <span className="font-mono text-muted-foreground shrink-0">{p.mins > 0 ? minutosATexto(p.mins) : '—'}</span>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}