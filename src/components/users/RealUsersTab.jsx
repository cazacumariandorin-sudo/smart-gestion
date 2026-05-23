import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Edit2, UserX, UserCheck } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import EditUserRoleDialog from '@/components/EditUserRoleDialog';
import RealUsersModal from '@/pages/RealUsersModal';
import VincularOperarioDialog from '@/components/users/VincularOperarioDialog';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

const ROLE_CONFIG = {
  admin:              { label: 'ADMIN',           color: 'bg-red-500/10 text-red-600 border-red-200' },
  gerencia:           { label: 'GERENCIA',        color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
  director_comercial: { label: 'DIRECTOR',        color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  jefe_obra:          { label: 'JEFE OBRA',       color: 'bg-green-500/10 text-green-600 border-green-200' },
  operario:           { label: 'OPERARIO',        color: 'bg-gray-500/10 text-gray-600 border-gray-200' },
  control_horario:    { label: 'CONTROL',         color: 'bg-orange-500/10 text-orange-600 border-orange-200' },
  cliente_obra:       { label: 'CLIENTE',         color: 'bg-pink-500/10 text-pink-600 border-pink-200' },
  usuario_demo:       { label: 'DEMO',            color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500',
];

function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

export default function RealUsersTab() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [vinculandoUser, setVinculandoUser] = useState(null);

  // ── LOAD ALL USERS — no filters, no conditions ──────────────────────────
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['all-users-tab'],
    queryFn: () => base44.entities.User.list('full_name', 500),
    staleTime: 0,          // always consider stale
    refetchOnMount: true,  // always refetch on mount
  });

  const handleRefresh = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ['users'], refetchType: 'all' });
  };

  const handleAsignarIdsPendientes = async () => {
    try {
      const response = await base44.functions.invoke('asignarIdsPersonalizadosExistentes', {});
      if (response.data.success) {
        toast.success(`IDs asignados: ${response.data.resultados.actualizados} usuarios actualizados`);
        handleRefresh();
      }
    } catch (error) {
      toast.error('Error al asignar IDs: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          <Button 
            onClick={handleAsignarIdsPendientes} 
            variant="outline" 
            size="sm"
            className="gap-2"
            title="Asignar ID personalizado a usuarios sin ID"
          >
            Asignar IDs pendientes
          </Button>
          <Button onClick={() => setAddOpen(true)} className="gap-2" size="sm">
            <Plus className="w-4 h-4" />
            Añadir usuario
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {users.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium mb-4">No hay usuarios registrados</p>
          <Button onClick={() => setAddOpen(true)} variant="outline" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Añadir usuario
          </Button>
        </div>
      ) : (
        /* Table — scrollable on mobile */
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-xs min-w-[1000px]">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground border-b">
                <th className="text-left py-2.5 px-3 font-medium w-8"></th>
                <th className="text-left py-2.5 px-3 font-medium whitespace-nowrap">ID Personalizado</th>
                <th className="text-left py-2.5 px-3 font-medium whitespace-nowrap">Nombre</th>
                <th className="text-left py-2.5 px-3 font-medium whitespace-nowrap">Email</th>
                <th className="text-left py-2.5 px-3 font-medium whitespace-nowrap">Rol</th>
                <th className="text-left py-2.5 px-3 font-medium whitespace-nowrap">Cargo</th>
                <th className="text-center py-2.5 px-2 font-medium whitespace-nowrap">Tipo</th>
                <th className="text-left py-2.5 px-3 font-medium whitespace-nowrap">Vinculación</th>
                <th className="text-center py-2.5 px-2 font-medium whitespace-nowrap">Estado</th>
                <th className="text-center py-2.5 px-2 font-medium whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const roleConf = ROLE_CONFIG[u.role] || ROLE_CONFIG.operario;
                const isDemo = u.tipo_cuenta === 'demo' || u.role === 'usuario_demo';
                const isExpired = u.acceso_hasta && isPast(new Date(u.acceso_hasta));
                const initials = getInitials(u.full_name || u.email || '?');
                const avatarColor = getAvatarColor(u.full_name || u.email || '');

                return (
                  <tr key={u.id} className="border-t border-border hover:bg-muted/40 transition-colors">
                    {/* Avatar */}
                    <td className="py-2.5 px-3">
                      <div className={`w-7 h-7 rounded-full ${avatarColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                        {initials || '?'}
                      </div>
                    </td>

                    {/* ID Personalizado */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {u.user_id_personalizado ? (
                        <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200 px-2 py-0.5">
                          {u.user_id_personalizado}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Nombre */}
                    <td className="py-2.5 px-3 font-medium truncate max-w-[120px]">{u.full_name || '—'}</td>

                    {/* Email */}
                    <td className="py-2.5 px-3 text-muted-foreground text-xs truncate max-w-[140px]">{u.email}</td>

                    {/* Rol */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <Badge variant="outline" className={`text-[10px] font-medium px-2 py-0.5 ${roleConf.color}`}>
                        {roleConf.label}
                      </Badge>
                    </td>

                    {/* Cargo */}
                    <td className="py-2.5 px-3 text-muted-foreground text-xs truncate max-w-[90px]">{u.cargo || '—'}</td>

                    {/* Tipo cuenta */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      {isDemo ? (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 px-1.5 py-0">Demo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 px-1.5 py-0">Real</Badge>
                      )}
                    </td>

                    {/* Vinculación */}
                    <td className="py-2.5 px-3">
                      {u.vinculo_estado === 'pendiente' ? (
                        <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200 px-2 py-0.5">
                          <span className="w-1 h-1 rounded-full bg-yellow-500 animate-pulse inline-block mr-1" />
                          Pendiente
                        </Badge>
                      ) : u.vinculo_estado === 'auto_vinculado' ? (
                        <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 px-2 py-0.5">
                          Auto 7d
                        </Badge>
                      ) : u.vinculo_estado === 'demo' ? (
                        <Badge variant="outline" className="text-[10px] bg-gray-50 text-gray-700 border-gray-200 px-2 py-0.5">
                          Demo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 px-2 py-0.5">
                          {u.vinculo_tipo === 'operario_temporal' ? '⚠ Temp' : '✓'}
                        </Badge>
                      )}
                      {u.vinculo_nombre && (
                        <div className="text-[9px] text-muted-foreground mt-0.5 truncate max-w-[110px]">
                          {u.vinculo_nombre}
                        </div>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      <Badge
                        variant={isExpired ? 'destructive' : 'default'}
                        className="text-[10px] px-2 py-0.5"
                      >
                        {isExpired ? '✗' : '✓'}
                      </Badge>
                    </td>

                    {/* Acciones */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap">
                      <div className="flex gap-0.5 justify-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingUser(u)}
                          className="h-6 w-6 p-0"
                          title="Editar rol"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setVinculandoUser(u)}
                          className={`h-6 w-6 p-0 ${
                            u.vinculo_estado === 'vinculado' ? 'text-green-600' : ''
                          }`}
                          title={u.vinculo_estado === 'vinculado' ? 'Vinculado' : 'Vincular'}
                        >
                          <UserCheck className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add user modal */}
      <RealUsersModal
        open={addOpen}
        onOpenChange={setAddOpen}
        users={users}
        onSuccess={() => {
          setAddOpen(false);
          handleRefresh();
        }}
      />

      {/* Edit role dialog */}
      <EditUserRoleDialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        user={editingUser}
        onSuccess={handleRefresh}
      />

      {/* Vincular operario dialog */}
      <VincularOperarioDialog
        open={!!vinculandoUser}
        onOpenChange={(open) => !open && setVinculandoUser(null)}
        user={vinculandoUser}
        onSuccess={handleRefresh}
      />
    </div>
  );
}