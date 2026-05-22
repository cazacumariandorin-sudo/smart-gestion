import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { FlaskConical, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';

export default function DemoUsersTab({ users, invitaciones }) {
  const getStatusBadge = (invitacion) => {
    if (!invitacion.activa) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          Revocada
        </Badge>
      );
    }
    if (invitacion.usada) {
      return (
        <Badge className="bg-green-500 gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Usada
        </Badge>
      );
    }
    if (isPast(new Date(invitacion.fecha_expiracion))) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          Expirada
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="w-3 h-3" />
        Pendiente
      </Badge>
    );
  };

  if (invitaciones.length === 0 && users.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No hay invitaciones demo generadas ni usuarios demo
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Invitaciones generadas */}
      {invitaciones.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Invitaciones generadas</h3>
          <div className="space-y-2">
            {invitaciones.map((inv) => (
              <Card key={inv.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-4 h-4 text-primary" />
                        <p className="font-medium text-sm">
                          {inv.email_destino || 'Link genérico'}
                        </p>
                        {getStatusBadge(inv)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>Generada por: {inv.generada_por_nombre} ({inv.generada_por_email})</p>
                        <p>
                          Creada: {format(new Date(inv.fecha_generacion), 'dd/MM/yyyy', { locale: es })}
                          {' • '}
                          Expira: {format(new Date(inv.fecha_expiracion), 'dd/MM/yyyy', { locale: es })}
                        </p>
                        {inv.usada && inv.fecha_uso && (
                          <p>Usada: {format(new Date(inv.fecha_uso), 'dd/MM/yyyy', { locale: es })}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Usuarios demo activos */}
      {users.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Usuarios demo activos</h3>
          <div className="space-y-2">
            {users.map((user) => (
              <Card key={user.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{user.full_name || 'Sin nombre'}</p>
                        <Badge variant="secondary" className="gap-1">
                          <FlaskConical className="w-3 h-3" />
                          Demo
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.demo_expires_at && (
                        <p className="text-xs">
                          {isPast(new Date(user.demo_expires_at)) ? (
                            <span className="text-red-500 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Expirado: {format(new Date(user.demo_expires_at), 'dd/MM/yyyy', { locale: es })}
                            </span>
                          ) : (
                            <span className="text-green-600">
                              Expira: {format(new Date(user.demo_expires_at), 'dd/MM/yyyy', { locale: es })}
                            </span>
                          )}
                        </p>
                      )}
                      {user.invitado_por && (
                        <p className="text-xs text-muted-foreground">
                          Invitado por: {user.invitado_por}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}