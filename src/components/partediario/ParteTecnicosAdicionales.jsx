import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

export default function ParteTecnicosAdicionales({ tecnicoActualId, seleccionados, onChange }) {
  const { data: operarios = [] } = useQuery({
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

  if (disponibles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {disponibles.map(op => {
        const activo = seleccionados.some(s => s.operario_id === op.id);
        return (
          <button
            key={op.id}
            type="button"
            onClick={() => toggle(op)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
              activo ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
            )}
          >
            {op.name}
          </button>
        );
      })}
    </div>
  );
}