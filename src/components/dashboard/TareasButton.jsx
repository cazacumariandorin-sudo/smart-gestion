import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function TareasButton({ onClick }) {
  const { data: tareas = [], isLoading } = useQuery({
    queryKey: ['tareas_admin_count'],
    queryFn: () => base44.entities.AsistenteTarea.filter({ estado: 'pendiente' }, '-created_date', 50),
    staleTime: 30000,
  });

  const pendientes = tareas.filter(t => t.estado === 'pendiente').length;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isLoading}
      className="gap-2 h-9 px-3 relative"
      title={`${pendientes} tarea${pendientes !== 1 ? 's' : ''} pendiente${pendientes !== 1 ? 's' : ''}`}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <CheckSquare className="w-4 h-4" />
      )}
      <span className="hidden sm:inline text-xs font-semibold">Tareas</span>
      {pendientes > 0 && (
        <Badge variant="destructive" className="absolute -top-2 -right-2 w-5 h-5 p-0 flex items-center justify-center text-[10px]">
          {pendientes}
        </Badge>
      )}
    </Button>
  );
}