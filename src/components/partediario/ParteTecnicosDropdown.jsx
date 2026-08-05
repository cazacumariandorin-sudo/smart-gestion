import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronDown, Loader2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * ParteTecnicosDropdown — Menú desplegable multiselección de técnicos
 * que comparten la jornada del parte diario.
 * El trigger muestra el resumen (avatar grupo + Nombres abreviados);
 * el popover lista todos los operarios activos como pills toggle.
 */
export default function ParteTecnicosDropdown({ tecnicoActualId, seleccionados = [], onChange }) {
  const [open, setOpen] = useState(false);

  const { data: operarios = [], isLoading } = useQuery({
    queryKey: ['operarios-activos-parte'],
    queryFn: () => base44.entities.Operario.filter({ active: true }, 'name', 200),
  });

  const disponibles = operarios.filter(o => o.id !== tecnicoActualId);

  const toggle = (op) => {
    const existe = seleccionados.some(s => s.operario_id === op.id);
    onChange(existe
      ? seleccionados.filter(s => s.operario_id !== op.id)
      : [...seleccionados, { operario_id: op.id, operario_name: op.name }]);
  };

  const remover = (id) => {
    onChange(seleccionados.filter(s => s.operario_id !== id));
  };

  const resumen = seleccionados.length === 0
    ? 'Sin otros técnicos'
    : seleccionados.length === 1
      ? seleccionados[0].operario_name
      : `${seleccionados.length} técnicos`;

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal h-auto min-h-[44px] py-2"
          >
            <span className="flex items-center gap-2 truncate min-w-0">
              <Users className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="truncate text-sm">{resumen}</span>
            </span>
            <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform', open && 'rotate-180')} />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-3" align="start">
          <div className="flex flex-wrap gap-1.5">
            {isLoading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground w-full justify-center">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando técnicos...
              </div>
            ) : disponibles.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2 w-full">
                No hay otros técnicos disponibles
              </p>
            ) : (
              disponibles.map(op => {
                const activo = seleccionados.some(s => s.operario_id === op.id);
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => toggle(op)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                      activo
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted text-foreground border-border hover:bg-muted/70'
                    )}
                  >
                    {op.name}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {seleccionados.map(s => (
            <span
              key={s.operario_id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary text-primary-foreground"
            >
              {s.operario_name}
              <button
                type="button"
                onClick={() => remover(s.operario_id)}
                className="ml-0.5 hover:bg-primary-foreground/20 rounded-full p-0.5"
                aria-label={`Quitar ${s.operario_name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}