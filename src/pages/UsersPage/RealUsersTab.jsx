import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, AlertTriangle, Pause, Play, Building2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  gerencia: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  director_comercial: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  jefe_obra: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
  operario: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  control_horario: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  cliente_obra: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100',
  'técnico': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
};

const ESTADO_CUENTA = {
  activo: { label: 'Activo', class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' },
  pendiente_activacion: { label: 'Pendiente activación', class: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100' },
  inactivo: { label: 'Inactivo', class: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  suspendido: { label: 'Suspendido', class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
};

export default function RealUsersTab({ users, isLoading }) {
  const queryClient = useQueryClient();

  // Cargar operarios para verificar vinculación
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios-all'],
    queryFn: () => base44.entities.Operario.list(),
    enabled: !isLoading,
  });

  const cambiarEstado = async (user, nuevoEstado) => {
    try {
      const patch = {
        estado_cuenta: nuevoEstado,
        ...(nuevoEstado === 'suspendido'
          ? { suspendido_por: (await base44.auth.me()).email, fecha_suspension: new Date().toISOString() }
          : { suspendido_por: null, fecha_suspension: null })
      };
      await base44.entities.User.update(user.id, patch);
      toast.success(`Estado actualizado: ${ESTADO_CUENTA[nuevoEstado].label}`);
      queryClient.invalidateQueries({ queryKey: ['users-real'] });
    } catch (err) {
      toast.error(err.message || 'No se pudo cambiar el estado');
    }
  };

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
    <TooltipProvider>
      <div className="space-y-3">
        {users.map((user) => {
          const necesitaOperario = user.role === 'operario' || user.role === 'control_horario';
          const tieneOperarioVinculado = necesitaOperario && operarios.some(op => op.user_email === user.email);
          const mostrarAviso = necesitaOperario && !tieneOperarioVinculado;
          const estado = ESTADO_CUENTA[user.estado_cuenta] || ESTADO_CUENTA.pendiente_activacion;

          return (
            <Card key={user.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{user.full_name || 'Sin nombre'}</p>
                      <Badge variant="outline" className={ROLE_COLORS[user.role] || ROLE_COLORS.operario}>
                        {user.role?.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className={estado.class}>
                        {estado.label}
                      </Badge>
                      {mostrarAviso && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span><AlertTriangle className="w-4 h-4 text-amber-500" /></span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs max-w-xs">No tiene operario vinculado — no podrá autorellenar sus fichajes</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    {(user.cargo || user.empresa_nombre) && (
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        {user.cargo && <span>Cargo: {user.cargo}</span>}
                        {user.empresa_nombre && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {user.empresa_nombre}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {user.acceso_hasta && (
                      <p className="text-xs text-muted-foreground">
                        Acceso hasta: {format(new Date(user.acceso_hasta), 'dd/MM/yyyy', { locale: es })}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {user.tipo_cuenta === 'real' || !user.tipo_cuenta ? 'Cuenta real' : 'Cuenta demo'}
                    </p>

                    {user.estado_cuenta === 'activo' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cambiarEstado(user, 'suspendido')}
                            className="h-8 px-2 text-xs gap-1 min-w-0"
                          >
                            <Pause className="w-3 h-3" /> Suspender
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Suspender acceso a la cuenta</TooltipContent>
                      </Tooltip>
                    )}
                    {user.estado_cuenta === 'suspendido' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cambiarEstado(user, 'activo')}
                            className="h-8 px-2 text-xs gap-1 min-w-0"
                          >
                            <Play className="w-3 h-3" /> Reactivar
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Volver a activar la cuenta</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </TooltipProvider>
  );
}