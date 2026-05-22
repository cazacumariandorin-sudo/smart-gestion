import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import PageHeader from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, isPast } from 'date-fns';
import { es } from 'date-fns/locale';
import { Users, FlaskConical, Plus } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import RealUsersModal from './RealUsersModal';
import DemoInvitationsModal from './DemoInvitationsModal';
import EditUserRoleDialog from '@/components/EditUserRoleDialog';
import { Edit2 } from 'lucide-react';

const ROLES = {
  admin: { label: 'ADMIN', color: 'bg-red-500/10 text-red-600 border-red-200' },
  gerencia: { label: 'GERENCIA', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
  director_comercial: { label: 'DIRECTOR', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  jefe_obra: { label: 'JEFE OBRA', color: 'bg-green-500/10 text-green-600 border-green-200' },
  operario: { label: 'OPERARIO', color: 'bg-gray-500/10 text-gray-600 border-gray-200' },
  control_horario: { label: 'CONTROL', color: 'bg-orange-500/10 text-orange-600 border-orange-200' },
  cliente_obra: { label: 'CLIENTE', color: 'bg-pink-500/10 text-pink-600 border-pink-200' },
};

function RoleBadge({ role }) {
  const config = ROLES[role] || ROLES.operario;
  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.color}`}>
      {config.label}
    </Badge>
  );
}

function RealUsersTab({ users, isLoading, onRefresh }) {
  const { isAdmin, isGerencia } = useUserRole();
  const canEditRoles = isAdmin || isGerencia;
  const realUsers = users.filter(u => (u.tipo_cuenta === 'real' || !u.tipo_cuenta) && u.role !== 'usuario_demo');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Añadir usuario real
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : realUsers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No hay usuarios reales registrados</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground">
                <th className="text-left py-3 px-4 font-medium">Nombre</th>
                <th className="text-left py-3 px-4 font-medium">Email</th>
                <th className="text-left py-3 px-4 font-medium">Rol</th>
                <th className="text-left py-3 px-4 font-medium">Cargo</th>
                <th className="text-left py-3 px-4 font-medium">Acceso hasta</th>
                <th className="text-left py-3 px-4 font-medium">Estado</th>
                {canEditRoles && <th className="text-left py-3 px-4 font-medium">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {realUsers.map(u => {
                const hasAccessLimit = u.acceso_hasta && !isPast(new Date(u.acceso_hasta));
                const isExpired = u.acceso_hasta && isPast(new Date(u.acceso_hasta));
                return (
                  <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium">{u.full_name || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                    <td className="py-3 px-4">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{u.cargo || '—'}</td>
                    <td className="py-3 px-4">
                      {u.acceso_hasta ? (
                        <Badge variant={isExpired ? 'destructive' : 'outline'} className="text-xs">
                          {format(new Date(u.acceso_hasta), 'd MMM yyyy', { locale: es })}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Ilimitado</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={isExpired ? 'destructive' : 'default'} className="text-xs">
                        {isExpired ? 'Expirado' : 'Activo'}
                      </Badge>
                    </td>
                    {canEditRoles && (
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingUser(u)}
                          className="gap-1 h-8"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span className="text-xs">Editar</span>
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <RealUsersModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
        users={users}
        onSuccess={() => {
          setIsModalOpen(false);
          onRefresh();
        }}
      />

      <EditUserRoleDialog
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        user={editingUser}
        onSuccess={onRefresh}
      />
    </div>
  );
}

function DemoUsersTab({ users, isLoading }) {
  const demoUsers = users.filter(u => u.tipo_cuenta === 'demo' || u.role === 'usuario_demo');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const qc = useQueryClient();

  const { data: invitaciones = [] } = useQuery({
    queryKey: ['invitaciones-demo'],
    queryFn: () => base44.entities.InvitacionDemo.list('-created_date', 100),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsModalOpen(true)} variant="secondary" className="gap-2">
          <Plus className="w-4 h-4" />
          Generar invitación demo
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : demoUsers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
          <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No hay usuarios demo activos</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-xs text-muted-foreground">
                <th className="text-left py-3 px-4 font-medium">Nombre</th>
                <th className="text-left py-3 px-4 font-medium">Email</th>
                <th className="text-left py-3 px-4 font-medium">Invitado por</th>
                <th className="text-left py-3 px-4 font-medium">Expira</th>
                <th className="text-left py-3 px-4 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {demoUsers.map(u => {
                const expiresAt = u.demo_expires_at ? new Date(u.demo_expires_at) : null;
                const isExpired = expiresAt ? isPast(expiresAt) : false;
                return (
                  <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium">{u.full_name || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{u.invitado_por || '—'}</td>
                    <td className="py-3 px-4">
                      {expiresAt ? (
                        <Badge variant={isExpired ? 'destructive' : 'outline'} className="text-xs">
                          {format(expiresAt, 'd MMM yyyy', { locale: es })}
                        </Badge>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={isExpired ? 'destructive' : 'default'} className="text-xs">
                        {isExpired ? 'Expirado' : 'Activo'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Subtabla: Invitaciones generadas */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold mb-2">Invitaciones generadas</h3>
        {invitaciones.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
            No hay invitaciones generadas
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground">
                  <th className="text-left py-2 px-3 font-medium">Código</th>
                  <th className="text-left py-2 px-3 font-medium">Email destino</th>
                  <th className="text-left py-2 px-3 font-medium">Duración</th>
                  <th className="text-left py-2 px-3 font-medium">Expira</th>
                  <th className="text-left py-2 px-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {invitaciones.map(inv => {
                  const expired = isPast(new Date(inv.fecha_expiracion));
                  const isActive = inv.activa && !expired && !inv.usada;
                  return (
                    <tr key={inv.id} className="border-t border-border hover:bg-muted/30">
                      <td className="py-2 px-3 font-mono text-xs">{inv.codigo?.slice(0, 18)}…</td>
                      <td className="py-2 px-3 text-xs">{inv.email_destino || '—'}</td>
                      <td className="py-2 px-3 text-xs">{inv.duracion_dias}d</td>
                      <td className="py-2 px-3 text-xs">
                        {format(new Date(inv.fecha_expiracion), 'd MMM yyyy', { locale: es })}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={isActive ? 'default' : 'secondary'} className="text-xs">
                          {inv.usada ? 'Usada' : isActive ? 'Activa' : 'Expirada/Revocada'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DemoInvitationsModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        users={users}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['invitaciones-demo'] })}
      />
    </div>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const { isAdmin, isGerencia, role, user: authUser } = useUserRole();
  const canView = isAdmin || isGerencia;
  const isOwner = authUser?.email === 'cazacu.mariandorin@gmail.com';
  const [tab, setTab] = useState('reales');

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['users'], refetchType: 'all' });
    qc.invalidateQueries({ queryKey: ['operarios'], refetchType: 'all' });
  }, [qc]);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users', isOwner],
    queryFn: async () => {
      const all = await base44.entities.User.list('full_name', 200);
      return all.filter(u => {
        if (u.email === 'cazacu.mariandorin@gmail.com') return false;
        if (u.role === 'director_comercial' && !isOwner) return false;
        return true;
      });
    },
    enabled: canView && authUser !== undefined,
  });

  // Background: mark users without tipo_cuenta as "real"
  useEffect(() => {
    if (!users.length) return;
    const toFix = users.filter(u => !u.tipo_cuenta && u.role !== 'usuario_demo');
    toFix.forEach(u => {
      base44.entities.User.update(u.id, { tipo_cuenta: 'real' }).catch(() => {});
    });
  }, [users]);

  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No tienes permisos para ver esta página.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PullToRefreshIndicator distance={pullDistance} refreshing={refreshing} />
      
      <PageHeader
        title="Gestión de Usuarios"
        subtitle="Administra usuarios reales y accesos demo"
        hideBack={true}
      />

      <div className="p-4 sm:p-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reales">Usuarios Reales</TabsTrigger>
            <TabsTrigger value="demo">Usuarios Demo</TabsTrigger>
          </TabsList>

          <TabsContent value="reales">
            <RealUsersTab users={users} isLoading={usersLoading} onRefresh={onRefresh} />
          </TabsContent>

          <TabsContent value="demo">
            <DemoUsersTab users={users} isLoading={usersLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}