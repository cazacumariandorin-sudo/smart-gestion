import { useState, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import {
  UserPlus, Loader2, Save, CheckCircle2, Circle,
  Users, Pencil, Trash2, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import PageHeader from '@/components/layout/PageHeader';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gerencia', label: 'Gerencia' },
  { value: 'director_comercial', label: 'Director Comercial' },
  { value: 'jefe_obra', label: 'Jefe de Obra' },
  { value: 'operario', label: 'Operario' },
  { value: 'control_horario', label: 'Control Horario' },
  { value: 'cliente_obra', label: 'Cliente Obra' },
];

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  gerencia: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  director_comercial: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  jefe_obra: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  operario: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  control_horario: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  cliente_obra: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  usuario_demo: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

function RoleBadge({ role }) {
  const label = ROLES.find(r => r.value === role)?.label || role;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[role] || 'bg-muted text-muted-foreground'}`}>
      {label}
    </span>
  );
}

function VinculacionBadge({ user, operarios }) {
  const linked = operarios.find(op => op.user_email === user.email);
  const needsLink = ['operario', 'jefe_obra', 'control_horario'].includes(user.role);

  if (linked) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 className="w-3 h-3" /> {linked.name}
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

// ── Edit dialog ────────────────────────────────────────────────────────────────
function EditUserDialog({ user, operarios, onSave, onClose }) {
  const [form, setForm] = useState({
    role: user.role || 'operario',
    cargo: user.cargo || '',
    acceso_hasta: user.acceso_hasta || '',
    operario_id: operarios.find(op => op.user_email === user.email)?.id || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(user, form);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
              {(user.full_name || user.email || '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium">{user.full_name || '—'}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Rol</Label>
              <MobileSelect value={form.role} onValueChange={v => set('role', v)} placeholder="Rol">
                {ROLES.map(r => <MobileSelectItem key={r.value} value={r.value}>{r.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cargo</Label>
              <Input value={form.cargo} onChange={e => set('cargo', e.target.value)} placeholder="Cargo..." className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Acceso hasta</Label>
            <Input type="date" value={form.acceso_hasta} onChange={e => set('acceso_hasta', e.target.value)} className="h-9 text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Vincular operario</Label>
            <MobileSelect
              value={form.operario_id || '__none__'}
              onValueChange={v => set('operario_id', v === '__none__' ? '' : v)}
              placeholder="Sin vincular"
            >
              <MobileSelectItem value="__none__">Sin vincular</MobileSelectItem>
              {operarios.map(op => (
                <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add user tab ───────────────────────────────────────────────────────────────
function AddUserTab({ users, onInvited }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('operario');
  const [cargo, setCargo] = useState('');
  const [acceso_hasta, setAccesoHasta] = useState('');
  const [estado, setEstado] = useState('activo');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleInvite = async () => {
    setErrorMsg('');
    if (!email) return;

    // Verificar duplicado
    const exists = users.find(u => u.email === email);
    if (exists) {
      setErrorMsg('Este email ya tiene una cuenta activa en la plataforma.');
      return;
    }

    setLoading(true);
    try {
      await base44.users.inviteUser(email, role);
      // Actualizar cargo, acceso_hasta y estado tras invitar
      setTimeout(async () => {
        const all = await base44.entities.User.list('full_name', 200);
        const newUser = all.find(u => u.email === email);
        if (newUser) {
          const updates = {};
          if (cargo) updates.cargo = cargo;
          if (acceso_hasta) updates.acceso_hasta = acceso_hasta;
          if (estado === 'pendiente') updates.acceso_hasta = ''; // sin fecha = pendiente
          if (Object.keys(updates).length) await base44.entities.User.update(newUser.id, updates);
        }
      }, 2000);
      toast.success(
        estado === 'activo'
          ? `Invitación enviada a ${email} — acceso activo al aceptar`
          : `Invitación enviada a ${email} — acceso pendiente de validación`
      );
      setEmail('');
      setRole('operario');
      setCargo('');
      setAccesoHasta('');
      setEstado('activo');
      onInvited();
    } catch {
      toast.error('Error al invitar usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md space-y-4 py-2">
      <p className="text-sm text-muted-foreground">
        El usuario recibirá un email de invitación para activar su cuenta.
      </p>

      <div className="space-y-1.5">
        <Label className="text-xs">Email *</Label>
        <Input
          type="email"
          placeholder="email@ejemplo.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setErrorMsg(''); }}
        />
        {errorMsg && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {errorMsg}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Rol *</Label>
          <MobileSelect value={role} onValueChange={setRole} placeholder="Rol">
            {ROLES.map(r => <MobileSelectItem key={r.value} value={r.value}>{r.label}</MobileSelectItem>)}
          </MobileSelect>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cargo</Label>
          <Input
            placeholder="Cargo (opcional)"
            value={cargo}
            onChange={e => setCargo(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Estado inicial</Label>
          <MobileSelect value={estado} onValueChange={setEstado} placeholder="Estado">
            <MobileSelectItem value="activo">✅ Activo al aceptar</MobileSelectItem>
            <MobileSelectItem value="pendiente">⏳ Pendiente de validación</MobileSelectItem>
          </MobileSelect>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Acceso hasta (opcional)</Label>
          <Input
            type="date"
            value={acceso_hasta}
            onChange={e => setAccesoHasta(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {estado === 'pendiente' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          El usuario podrá registrarse pero su acceso quedará bloqueado hasta que un administrador le asigne una fecha de acceso válida.
        </div>
      )}

      <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Permisos del rol seleccionado:</p>
        {role === 'admin' && <p>Acceso completo a todos los módulos y gestión de usuarios.</p>}
        {role === 'gerencia' && <p>Acceso a obras, clientes, informes, flota y documentación.</p>}
        {role === 'director_comercial' && <p>Acceso a todos los módulos excepto datos sensibles y backup.</p>}
        {role === 'jefe_obra' && <p>Obras, partes, clientes, operarios, materiales, notas de gasto.</p>}
        {role === 'operario' && <p>Partes de trabajo, control horario, materiales, notas de gasto.</p>}
        {role === 'control_horario' && <p>Control horario y partes de trabajo únicamente.</p>}
        {role === 'cliente_obra' && <p>Acceso solo al informe de obras y chat.</p>}
      </div>

      <Button onClick={handleInvite} disabled={!email || loading} className="gap-2 w-full sm:w-auto">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
        Enviar invitación
      </Button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const qc = useQueryClient();
  const { isAdmin, role } = useUserRole();
  const canView = isAdmin || role === 'gerencia';

  const [editingUser, setEditingUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [tab, setTab] = useState('lista');

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['users'] });
    qc.invalidateQueries({ queryKey: ['operarios'] });
  }, [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const all = await base44.entities.User.list('full_name', 200);
      return all.filter(u => u.email !== 'cazacu.mariandorin@gmail.com');
    },
    enabled: canView,
  });

  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios'],
    queryFn: () => base44.entities.Operario.list('name', 200),
    enabled: canView,
  });

  const handleSaveRow = async (user, row) => {
    await base44.entities.User.update(user.id, {
      role: row.role,
      cargo: row.cargo,
      acceso_hasta: row.acceso_hasta,
    });

    const prevLinked = operarios.find(op => op.user_email === user.email);
    const newOp = operarios.find(op => op.id === row.operario_id);

    if (prevLinked && prevLinked.id !== row.operario_id) {
      await base44.entities.Operario.update(prevLinked.id, { user_email: '', user_id: '' });
    }
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

  const realUsers = users.filter(u => u.role !== 'usuario_demo');
  const demoUsers = users.filter(u => u.role === 'usuario_demo');

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Gestión de Usuarios"
        subtitle={`${users.length} usuarios registrados`}
        hideBack={true}
      />
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />

      <div className="p-4 sm:p-6 lg:p-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="lista" className="gap-2">
              <Users className="w-4 h-4" />
              Usuarios ({users.length})
            </TabsTrigger>
            <TabsTrigger value="añadir" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Añadir usuario
            </TabsTrigger>
          </TabsList>

          {/* ── Tab Lista ── */}
          <TabsContent value="lista">
            {usersLoading ? (
              <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : (
              <div className="space-y-6">
                {/* Usuarios reales */}
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Usuarios reales ({realUsers.length})
                  </h2>
                  <div className="rounded-xl border border-border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-xs text-muted-foreground">
                          <th className="text-left py-3 px-3 font-medium">Nombre</th>
                          <th className="text-left py-3 px-3 font-medium">Email</th>
                          <th className="text-left py-3 px-3 font-medium">Rol</th>
                          <th className="text-left py-3 px-3 font-medium">Cargo</th>
                          <th className="text-left py-3 px-3 font-medium">Vinculado</th>
                          <th className="text-left py-3 px-3 font-medium">Acceso hasta</th>
                          <th className="py-3 px-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {realUsers.map(u => (
                          <tr key={u.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                  {(u.full_name || u.email || '?')[0].toUpperCase()}
                                </div>
                                <span className="font-medium truncate max-w-[120px]">{u.full_name || '—'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-xs text-muted-foreground">
                              <span className="truncate block max-w-[160px]">{u.email}</span>
                            </td>
                            <td className="py-3 px-3"><RoleBadge role={u.role} /></td>
                            <td className="py-3 px-3 text-xs text-muted-foreground">{u.cargo || '—'}</td>
                            <td className="py-3 px-3"><VinculacionBadge user={u} operarios={operarios} /></td>
                            <td className="py-3 px-3 text-xs text-muted-foreground">{u.acceso_hasta || '—'}</td>
                            <td className="py-3 px-3">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => setEditingUser(u)}
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                        {realUsers.length === 0 && (
                          <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Sin usuarios reales.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Usuarios demo */}
                {demoUsers.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Usuarios demo ({demoUsers.length})
                    </h2>
                    <div className="rounded-xl border border-border overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 text-xs text-muted-foreground">
                            <th className="text-left py-3 px-3 font-medium">Nombre</th>
                            <th className="text-left py-3 px-3 font-medium">Email</th>
                            <th className="text-left py-3 px-3 font-medium">Expira</th>
                            <th className="text-left py-3 px-3 font-medium">Invitado por</th>
                            <th className="py-3 px-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {demoUsers.map(u => {
                            const expired = u.demo_expires_at && new Date(u.demo_expires_at) < new Date();
                            return (
                              <tr key={u.id} className="border-t border-border hover:bg-muted/30">
                                <td className="py-3 px-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold shrink-0">
                                      {(u.full_name || u.email || '?')[0].toUpperCase()}
                                    </div>
                                    <span className="font-medium truncate max-w-[120px]">{u.full_name || '—'}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-xs text-muted-foreground">{u.email}</td>
                                <td className="py-3 px-3">
                                  <Badge variant={expired ? 'destructive' : 'outline'} className="text-xs">
                                    {u.demo_expires_at ? new Date(u.demo_expires_at).toLocaleDateString('es-ES') : '—'}
                                  </Badge>
                                </td>
                                <td className="py-3 px-3 text-xs text-muted-foreground">{u.invitado_por || '—'}</td>
                                <td className="py-3 px-3">
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingUser(u)} title="Editar">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Tab Añadir ── */}
          <TabsContent value="añadir">
            <AddUserTab
              users={users}
              onInvited={() => {
                qc.invalidateQueries({ queryKey: ['users'] });
                setTab('lista');
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit dialog */}
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          operarios={operarios}
          onSave={handleSaveRow}
          onClose={() => setEditingUser(null)}
        />
      )}
    </div>
  );
}