import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Edit2, UserX } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import EditUserRoleDialog from '@/components/EditUserRoleDialog';
import RealUsersModal from '@/pages/RealUsersModal';
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
        <Button onClick={() => setAddOpen(true)} className="gap-2" size="sm">
          <Plus className="w-4 h-4" />
          Añadir usuario
        </Button>
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
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground">
                <th className="text-left py-3 px-4 font-medium w-10"></th>
                <th className="text-left py-3 px-4 font-medium">Nombre</th>
                <th className="text-left py-3 px-4 font-medium">Email</th>
                <th className="text-left py-3 px-4 font-medium">Rol</th>
                <th className="text-left py-3 px-4 font-medium">Cargo</th>
                <th className="text-left py-3 px-4 font-medium">Tipo cuenta</th>
                <th className="text-left py-3 px-4 font-medium">Estado</th>
                <th className="text-left py-3 px-4 font-medium">Acciones</th>
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
                  <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    {/* Avatar */}
                    <td className="py-3 px-4">
                      <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-xs font-semibold shrink-0`}>
                        {initials || '?'}
                      </div>
                    </td>

                    {/* Nombre */}
                    <td className="py-3 px-4 font-medium">{u.full_name || '—'}</td>

                    {/* Email */}
                    <td className="py-3 px-4 text-muted-foreground text-xs">{u.email}</td>

                    {/* Rol */}
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={`text-xs font-medium ${roleConf.color}`}>
                        {roleConf.label}
                      </Badge>
                    </td>

                    {/* Cargo */}
                    <td className="py-3 px-4 text-muted-foreground text-xs">{u.cargo || '—'}</td>

                    {/* Tipo cuenta */}
                    <td className="py-3 px-4">
                      {isDemo ? (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Demo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Real</Badge>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="py-3 px-4">
                      <Badge
                        variant={isExpired ? 'destructive' : 'default'}
                        className="text-xs"
                      >
                        {isExpired ? 'Expirado' : 'Activo'}
                      </Badge>
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingUser(u)}
                        className="gap-1 h-8 text-xs"
                      >
                        <Edit2 className="w-3 h-3" />
                        Editar
                      </Button>
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
    </div>
  );
}