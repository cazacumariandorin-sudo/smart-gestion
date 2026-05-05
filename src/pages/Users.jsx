// Force rebuild
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, UserCheck, Hammer, Clock, Mail, UserPlus, Loader2, Pencil, Save, Trash2, Eye } from 'lucide-react';
import { setSimulatedRole, getSimulatedRole } from '@/lib/roleSimulator';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/lib/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const roleConfig = {
  admin: { label: 'Administrador', icon: Shield, className: 'bg-red-100 text-red-700 border-red-200', desc: 'Acceso completo' },
  jefe_obra: { label: 'Jefe de Obra', icon: UserCheck, className: 'bg-blue-100 text-blue-700 border-blue-200', desc: 'Gestión de obras' },
  operario: { label: 'Usuario', icon: Hammer, className: 'bg-emerald-100 text-emerald-700 border-emerald-200', desc: 'Operario' },
  control_horario: { label: 'Control Horario', icon: Clock, className: 'bg-amber-100 text-amber-700 border-amber-200', desc: 'Control de horas' },
  cliente_obra: { label: 'Cliente Obra', icon: Shield, className: 'bg-violet-100 text-violet-700 border-violet-200', desc: 'Cliente' },
};

const ACCESS_RANGES = ['1 semana', '2 semanas', '1 mes', '3 meses'];
const ROLES_TO_SIMULATE = [
  { value: 'admin', label: 'Administrador' },
  { value: 'jefe_obra', label: 'Jefe de Obra' },
  { value: 'operario', label: 'Operario' },
  { value: 'control_horario', label: 'Control Horario' },
  { value: 'cliente_obra', label: 'Cliente Obra' },
];

export default function Users() {
  const queryClient = useQueryClient();
  const { isAdmin: currentUserIsAdmin } = useUserRole();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operario');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('full_name', 100),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const prev = queryClient.getQueryData(['users']);
      queryClient.setQueryData(['users'], old =>
        (old || []).map(u => u.id === id ? { ...u, ...data } : u)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(['users'], ctx.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onSuccess: () => setEditUser(null),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.User.delete(id),
    onMutate: async id => {
      await queryClient.cancelQueries({ queryKey: ['users'] });
      const prev = queryClient.getQueryData(['users']);
      queryClient.setQueryData(['users'], old => (old || []).filter(u => u.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => queryClient.setQueryData(['users'], ctx.prev),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError('');
    try {
      await base44.functions.invoke('inviteUserFunction', { email: inviteEmail, role: inviteRole });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('operario');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (e) {
      setInviteError(e.response?.data?.error || e.message || 'Error al invitar');
    } finally {
      setInviting(false);
    }
  };

  const grantTempAccess = (range) => {
    const days = range === '1 semana' ? 7 : range === '2 semanas' ? 14 : range === '1 mes' ? 30 : 90;
    const until = new Date();
    until.setDate(until.getDate() + days);
    setEditForm(p => ({ ...p, acceso_total_hasta: until.toISOString().split('T')[0] }));
  };

  const openEdit = (user) => {
    setEditUser(user);
    const today = new Date().toISOString().split('T')[0];
    const hasProvisional = user.acceso_total_hasta && user.acceso_total_hasta >= today;
    setEditForm({
      role: user.role || 'operario',
      acceso_total_hasta: user.acceso_total_hasta || '',
      _tipoAcceso: hasProvisional ? 'provisional' : 'completo',
    });
  };

  const saveEdit = () => {
    if (!editUser) return;
    updateMutation.mutate({ id: editUser.id, data: editForm });
  };

  const filtered = users.filter(u => filterRole === 'all' || (u.role || 'operario') === filterRole);
  const byRole = Object.keys(roleConfig).reduce((acc, r) => {
    acc[r] = users.filter(u => (u.role || 'operario') === r);
    return acc;
  }, {});
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de accesos y permisos</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2 shadow-sm">
          <UserPlus className="w-4 h-4" /><span className="hidden sm:inline">Invitar usuario</span>
        </Button>
      </div>

      {currentUserIsAdmin && <RoleSimulator />}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.entries(roleConfig).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Card
              key={key}
              className={`p-3 cursor-pointer border-2 transition-all ${filterRole === key ? 'border-primary' : 'border-transparent'}`}
              onClick={() => setFilterRole(filterRole === key ? 'all' : key)}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${cfg.className}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold">{cfg.label}</p>
              <p className="text-lg font-bold text-primary">{byRole[key]?.length || 0}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{cfg.desc}</p>
            </Card>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No hay usuarios.</p>
      ) : filterRole !== 'all' ? (
        <div className="space-y-2">
          {filtered.map(user => <UserRow key={user.id} user={user} today={today} openEdit={openEdit} deleteMutation={deleteMutation} />)}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(roleConfig).map(([roleKey, cfg]) => {
            const group = byRole[roleKey] || [];
            if (!group.length) return null;
            const Icon = cfg.icon;
            return (
              <div key={roleKey}>
                <div className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg border ${cfg.className}`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-bold">{cfg.label}</span>
                  <span className="text-xs opacity-70">({group.length})</span>
                  <span className="text-[10px] ml-auto hidden sm:block opacity-70">{cfg.desc}</span>
                </div>
                <div className="space-y-2">
                  {group.map(user => <UserRow key={user.id} user={user} today={today} openEdit={openEdit} deleteMutation={deleteMutation} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editUser} onOpenChange={open => { if (!open) setEditUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${roleConfig[editForm.role || 'operario']?.className}`}>
                {(editUser?.full_name || editUser?.email || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold">{editUser?.full_name || '—'}</p>
                <p className="text-xs text-muted-foreground">{editUser?.email}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Rol</Label>
              <MobileSelect value={editForm.role || 'operario'} onValueChange={v => setEditForm(p => ({ ...p, role: v }))} placeholder="Rol">
                {Object.entries(roleConfig).map(([k, v]) => (
                  <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>
                ))}
              </MobileSelect>
              {editForm.role && <p className="text-[10px] text-muted-foreground">{roleConfig[editForm.role]?.desc}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de acceso</Label>
              <MobileSelect
                value={editForm.acceso_total_hasta && editForm.acceso_total_hasta >= new Date().toISOString().split('T')[0] ? 'provisional' : 'completo'}
                onValueChange={v => {
                  if (v === 'completo') setEditForm(p => ({ ...p, acceso_total_hasta: '' }));
                  else setEditForm(p => ({ ...p, _tipoAcceso: 'provisional' }));
                }}
                placeholder="Tipo de acceso"
              >
                <MobileSelectItem value="completo">Acceso completo</MobileSelectItem>
                <MobileSelectItem value="provisional">Acceso provisional</MobileSelectItem>
              </MobileSelect>
            </div>

            {(editForm._tipoAcceso === 'provisional' || (editForm.acceso_total_hasta && editForm.acceso_total_hasta >= new Date().toISOString().split('T')[0])) && (
              <div className="space-y-1.5">
                <Label className="text-xs">Duración acceso provisional</Label>
                <MobileSelect value="" onValueChange={grantTempAccess} placeholder="Seleccionar...">
                  {ACCESS_RANGES.map(r => <MobileSelectItem key={r} value={r}>{r}</MobileSelectItem>)}
                </MobileSelect>
                {editForm.acceso_total_hasta && (
                  <p className="text-[10px] text-primary font-medium">Hasta: {editForm.acceso_total_hasta}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending} className="gap-2 min-w-24">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invitar usuario</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                placeholder="email@ejemplo.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de usuario</Label>
              <MobileSelect value={inviteRole} onValueChange={setInviteRole} placeholder="Tipo de usuario">
                {Object.entries(roleConfig).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
              </MobileSelect>
              {inviteRole && <p className="text-[10px] text-muted-foreground">{roleConfig[inviteRole]?.desc}</p>}
            </div>
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviting} className="gap-2 min-w-28">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoleSimulator() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(getSimulatedRole());

  return (
    <div className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-amber-600" />
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Simulador de rol</p>
        <span className="text-xs text-amber-600 dark:text-amber-400">— previsualiza sin cambiar datos</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {ROLES_TO_SIMULATE.map(r => (
          <button
            key={r.value}
            onClick={() => {
              setSimulatedRole(r.value);
              setCurrent(r.value);
              navigate('/', { replace: true });
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              current === r.value
                ? 'bg-amber-500 text-white border-amber-500 shadow'
                : 'bg-white dark:bg-card border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-100'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserRow({ user, today, openEdit, deleteMutation }) {
  const role = user.role || 'operario';
  const cfg = roleConfig[role] || roleConfig.operario;
  const Icon = cfg.icon;
  const hasTempAccess = user.acceso_total_hasta && user.acceso_total_hasta >= today;
  const isDeleting = deleteMutation.isPending && deleteMutation.variables === user.id;

  return (
    <Card className={`p-4 transition-opacity ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${cfg.className}`}>
            {(user.full_name || user.email || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{user.full_name || '—'}</p>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              <Mail className="w-3 h-3 shrink-0" /> {user.email}
            </p>
            {hasTempAccess && (
              <p className="text-[10px] text-primary font-medium">Acceso hasta {user.acceso_total_hasta}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className={`${cfg.className} text-xs items-center gap-1 hidden sm:flex`}>
            <Icon className="w-3 h-3" /> {cfg.label}
          </Badge>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(user)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará a <strong>{user.full_name || user.email}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate(user.id)} className="bg-destructive text-destructive-foreground">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
}