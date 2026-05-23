import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { User, Link as LinkIcon, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export default function WidgetVinculaciones() {
  const { data: users = [] } = useQuery({
    queryKey: ['usuarios-vinculacion-stats'],
    queryFn: async () => {
      const all = await base44.entities.User.list('-fecha_registro', 500);
      return all.filter(u => u.tipo_cuenta !== 'demo' && u.role !== 'usuario_demo');
    },
  });

  const stats = {
    vinculados: users.filter(u => u.vinculo_estado === 'vinculado').length,
    auto_vinculados: users.filter(u => u.vinculo_estado === 'auto_vinculado').length,
    temporales: users.filter(u => u.vinculo_tipo === 'operario_temporal').length,
    pendientes: users.filter(u => u.vinculo_estado === 'pendiente').length,
    demo: users.filter(u => u.vinculo_estado === 'demo' || u.tipo_cuenta === 'demo').length,
  };

  const urgentes = users.filter(u => {
    if (!u.fecha_limite_vinculacion || u.vinculo_estado !== 'pendiente') return false;
    const dias = Math.ceil((new Date(u.fecha_limite_vinculacion).getTime() - Date.now()) / 86400000);
    return dias <= 2;
  }).length;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-primary" />
          Estado de vinculaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <CheckCircle className="w-3 h-3 text-green-600" />
            Vinculados manual
          </span>
          <Badge variant="outline" className="text-xs">{stats.vinculados}</Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3 text-orange-600" />
            Auto-vinculados (7d)
          </span>
          <Badge variant="outline" className="text-xs">{stats.auto_vinculados}</Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            Temporales
          </span>
          <Badge variant="outline" className="text-xs">{stats.temporales}</Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <User className="w-3 h-3 text-yellow-600" />
            Pendientes
          </span>
          <Badge variant={urgentes > 0 ? 'destructive' : 'outline'} className="text-xs">
            {stats.pendientes} {urgentes > 0 && `(${urgentes} 🔴)`}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <User className="w-3 h-3 text-gray-500" />
            Usuarios demo
          </span>
          <Badge variant="secondary" className="text-xs">{stats.demo}</Badge>
        </div>

        <div className="pt-3 mt-3 border-t border-border">
          <Button asChild size="sm" className="w-full">
            <Link to="/vinculacion">Gestionar</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}