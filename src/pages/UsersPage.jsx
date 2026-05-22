import { useState, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { UserPlus, Loader2, Save, CheckCircle2, Circle, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gerencia', label: 'Gerencia' },
  { value: 'jefe_obra', label: 'Jefe de Obra' },
  { value: 'operario', label: 'Operario' },
  { value: 'control_horario', label: 'Control Horario' },
  { value: 'cliente_obra', label: 'Cliente Obra' },
];

const ROLE_LABEL = Object.fromEntries(ROLES.map(r => [r.value, r.label]));

// Badge visual: verde si vinculado, naranja si debería, gris si admin/gerencia
function VinculacionBadge({ user, operarios }) {
  const linked = operarios.find(op => op.user_email === user.email);
  const needsLink = ['operario', 'jefe_obra', 'control_horario'].includes(user.role);
  const isAdminish = ['admin', 'gerencia'].includes(user.role);

  if (linked) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 className="w-3 h-3" /> {linked.name}
      </span>
    );
  }
  if (isAdminish) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <Circle className="w-3 h-3" /> Sin vincular
      </span>
    );
  }
  if (needsLink) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        <Circle className="w-3 h-3" /> Sin vincular
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400">
      <Circle className="w-3 h-3" /> —
    </span>
  );
}

// Row inline-editable
function UserRow({ user, operarios, onSave }) {
  const [row, setRow] = useState({
    role: user.role || 'operario',
    cargo: user.cargo || '',
    acceso_hasta: user.acceso_hasta || '',
    operario_id: operarios.find(op => op.user_email === user.email)?.id || '',
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => { setRow(p => ({ ...p, [k]: v })); setDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    await onSave(user, row);
    setSaving(false);
    setDirty(false);
  };

  const linkedOp = operarios.find(op => op.user_email === user.email);
  const selectedOp = operarios.find(op => op.id === row.operario_id);

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      {/* Nombre */}
      <td className="py-3 px-3 text-sm font-medium">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
            {(user.full_name || user.email || '?')[0].toUpperCase()}
          </div>
          <span className="truncate max-w-[120px]">{user.full_name || '—'}</span>
        </div>
      </td>
      {/* Email */}
      <td className="py-3 px-3 text-xs text-muted-foreground max-w-[150px]">
        <span className="truncate block">{user.email}</span>
      </td>
      {/* Rol */}
      <td className="py-3 px-3">
        <MobileSelect value={row.role} onValueChange={v => set('role', v)} placeholder="Rol">
          {ROLES.map(r => <MobileSelectItem key={r.value} value={r.value}>{r.label}</MobileSelectItem>)}
        </MobileSelect>
      </td>
      {/* Operario vinculado */}
      <td className="py-3 px-3">
        <div className="space-y-1">
          <MobileSelect
            value={row.operario_id}
            onValueChange={v => set('operario_id', v)}
            placeholder="Sin vincular"
          >
            <MobileSelectItem value="">Sin vincular</MobileSelectItem>
            {operarios.map(op => (
              <MobileSelectItem key={op.id} value={op.id}>
                {op.name}
              </MobileSelectItem>
            ))}
          </MobileSelect>
          <VinculacionBadge user={{ ...user, role: row.role }} operarios={operarios} />
        </div>
      </td>
      {/* Cargo */}
      <td className="py-3 px-3">
        <Input
          value={row.cargo}
          onChange={e => set('cargo', e.target.value)}
          placeholder="Cargo..."
          className="h-8 text-xs min-h-0 w-32"
        />
      </td>
      {/* Acceso hasta */}
      <td className="py-3 px-3">
        <Input
          type="date"
          value={row.acceso_hasta}
          onChange={e => set('acceso_hasta', e.target.value)}
          className="h-8 text-xs min-h-0 w-36"
        />
      </td>
      {/* Guardar */}
      <td className="py-3 px-3">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="h-8 gap-1.5 text-xs"
          variant={dirty ? 'default' : 'outline'}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Guardar
        </Button>
      </td>
    </tr>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const { isAdmin, role } = useUserRole();
  const canView = isAdmin || role === 'gerencia';

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['operarios'] });
  }, [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const [openInvite, setOpenInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operario');

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('full_name', 200),
    enabled: canView,
  });

  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200),
    enabled: canView,
  });

  const inviteMutation = useMutation({
    mutationFn: () => base44.users.inviteUser(inviteEmail, inviteRole),
    onSuccess: () => {
      setOpenInvite(false);
      setInviteEmail('');
      setInviteRole('operario');
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario invitado correctamente');
    },
    onError: () => toast.error('Error al invitar usuario'),
  });

  const handleSaveRow = async (user, row) => {
    // 1. Actualizar rol y campos extra del usuario
    await base44.entities.User.update(user.id, {
      role: row.role,
      cargo: row.cargo,
      acceso_hasta: row.acceso_hasta,
    });

    // 2. Gestionar vinculación con operario
    const prevLinked = operarios.find(op => op.user_email === user.email);
    const newOp = operarios.find(op => op.id === row.operario_id);

    // Desvincular operario anterior si cambió
    if (prevLinked && prevLinked.id !== row.operario_id) {
      await base44.entities.Operario.update(prevLinked.id, { user_email: '', user_id: '' });
    }
    // Vincular nuevo operario
    if (newOp && newOp.user_email !== user.email) {
      await base44.entities.Operario.update(newOp.id, { user_email: user.email, user_id: user.id });
    }

    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['operarios'] });
    toast.success(`Usuario ${user.full_name || user.email} actualizado`);
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No tienes permisos para ver esta página.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Gestión de Usuarios"
        subtitle={`${users.length} usuarios registrados`}
        hideBack={true}
        actions={
          <Button onClick={() => setOpenInvite(true)} className="gap-2 shadow-sm" size="sm">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Invitar usuario</span>
          </Button>
        }
      />
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      <div className="p-4 sm:p-6 lg:p-8">
        {usersLoading ? (
          <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground">
                  <th className="text-left py-3 px-3 font-medium">Nombre</th>
                  <th className="text-left py-3 px-3 font-medium">Email</th>
                  <th className="text-left py-3 px-3 font-medium">Rol</th>
                  <th className="text-left py-3 px-3 font-medium">Operario vinculado</th>
                  <th className="text-left py-3 px-3 font-medium">Cargo</th>
                  <th className="text-left py-3 px-3 font-medium">Acceso hasta</th>
                  <th className="py-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <UserRow
                    key={user.id}
                    user={user}
                    operarios={operarios}
                    onSave={handleSaveRow}
                  />
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">No hay usuarios registrados.</div>
            )}
          </div>
        )}
      </div>

      {/* Dialog invitar */}
      <Dialog open={openInvite} onOpenChange={setOpenInvite}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                placeholder="email@ejemplo.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rol</Label>
              <MobileSelect value={inviteRole} onValueChange={setInviteRole} placeholder="Rol">
                {ROLES.map(r => <MobileSelectItem key={r.value} value={r.value}>{r.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenInvite(false)}>Cancelar</Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail || inviteMutation.isPending}
              className="gap-2"
            >
              {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Invitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}