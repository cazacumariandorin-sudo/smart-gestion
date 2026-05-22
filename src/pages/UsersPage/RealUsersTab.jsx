import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  gerencia: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  director_comercial: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  jefe_obra: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
  operario: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  control_horario: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  cliente_obra: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100',
};

export default function RealUsersTab({ users, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No hay usuarios reales registrados
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <Card key={user.id}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{user.full_name || 'Sin nombre'}</p>
                  <Badge variant="outline" className={ROLE_COLORS[user.role] || ROLE_COLORS.operario}>
                    {user.role?.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{user.email}</p>
                {user.cargo && (
                  <p className="text-xs text-muted-foreground">Cargo: {user.cargo}</p>
                )}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {user.acceso_hasta && (
                  <p>Acceso hasta: {format(new Date(user.acceso_hasta), 'dd/MM/yyyy', { locale: es })}</p>
                )}
                <p className="text-xs">
                  {user.tipo_cuenta === 'real' || !user.tipo_cuenta ? 'Cuenta real' : 'Cuenta demo'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}