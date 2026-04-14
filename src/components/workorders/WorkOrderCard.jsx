import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusConfig = {
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_curso: { label: 'En curso', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  completado: { label: 'Completado', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function WorkOrderCard({ order }) {
  const status = statusConfig[order.status] || statusConfig.pendiente;
  const workerCount = order.workers?.length || 0;
  const materialCount = order.materials?.length || 0;

  return (
    <Link to={`/work-orders/${order.id}`}>
      <Card className="p-5 hover:shadow-md transition-all hover:border-primary/20 cursor-pointer group">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {order.project}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{order.client}</p>
          </div>
          <Badge variant="outline" className={`${status.className} text-[10px] font-medium ml-2 shrink-0`}>
            {status.label}
          </Badge>
        </div>

        {order.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{order.description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {order.date ? format(new Date(order.date), 'd MMM yyyy', { locale: es }) : '—'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {order.total_hours || 0}h
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {workerCount}
          </span>
          <span className="flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            {materialCount}
          </span>
        </div>
      </Card>
    </Link>
  );
}