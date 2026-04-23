import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, UserCheck, Hammer, Clock, Mail, UserPlus, Loader2, Pencil, Save, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const roleConfig = {
  admin:           { label: 'Administrador',   icon: Shield,    className: 'bg-red-100 text-red-700 border-red-200',            desc: 'Acceso completo a todos los módulos' },
  jefe_obra:       { label: 'Jefe de Obra',    icon: UserCheck, className: 'bg-blue-100 text-blue-700 border-blue-200',         desc: 'Partes, clientes, pedidos, informes, fotos' },
  operario:        { label: 'Operario',        icon: Hammer,    className: 'bg-emerald-100 text-emerald-700 border-emerald-200', desc: 'Control horario, partes, gastos, vacaciones' },
  control_horario: { label: 'Control Horario', icon: Clock,     className: 'bg-amber-100 text-amber-700 border-amber-200',      desc: 'Solo control horario, partes y pedidos' },
  cliente_obra:    { label: 'Cliente Obra',    icon: Shield,    className: 'bg-violet-100 text-violet-700 border-violet-200',   desc: 'Solo informe de operarios en obra' },
};

const ACCESS_RANGES = ['1 semana', '2 semanas', '1 mes', '3 meses'];

export default function Users() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);   // user being edited (modal)
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

  // Optimistic update
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

  // Optimistic delete
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
    setInviting(true); setInviteError('');
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole === 'admin' ? 'admin' : 'user');
      setInviteOpen(false); setInviteEmail(''); setInviteRole('operario');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (e) { setInviteError(e.message || 'Error al invitar'); }
    setInviting(false);
  };

  const grantTempAccess = (range) => {
    const days = range === '1 semana' ? 7 : range === '2 semanas' ? 14 : range === '1 mes' ? 30 : 90;
    const until = new Date(); until.setDate(until.getDate() + days);
    setEditForm(p => ({ ...p, acceso_total_hasta: until.toISOString().split('T')[0] }));
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({ role: user.role || 'operario', acceso_total_hasta: user.acceso_total_hasta || '' });
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de accesos y permisos</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2 shadow-sm">
          <UserPlus className="w-4 h-4" /><span className="hidden sm:inline">Invitar usuario</span>
        </Button>
      </div>

      {/* Role summary cards */}
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

      {/* User list */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">No hay usuarios en esta categoría.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => {
            const role = user.role || 'operario';
            const cfg = roleConfig[role] || roleConfig.operario;
            const Icon = cfg.icon;
            const hasTempAccess = user.acceso_total_hasta && user.acceso_total_hasta >= today;
            const isDeleting = deleteMutation.isPending && deleteMutation.variables === user.id;

            return (
              <Card key={user.id} className={`p-4 transition-opacity ${isDeleting ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                  {/* Left: avatar + info */}
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
                        <p className="text-[10px] text-primary font-medium">Acceso completo hasta {user.acceso_total_hasta}</p>
                      )}
                    </div>
                  </div>

                  {/* Right: badge + actions */}
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
                            Se eliminará permanentemente a <strong>{user.full_name || user.email}</strong>. Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(user.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit user modal */}
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
              <Select value={editForm.role || 'operario'} onValueChange={v => setEditForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(roleConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-2"><v.icon className="w-3.5 h-3.5" /> {v.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editForm.role && <p className="text-[10px] text-muted-foreground">{roleConfig[editForm.role]?.desc}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Acceso temporal completo</Label>
              <Select onValueChange={grantTempAccess}>
                <SelectTrigger><SelectValue placeholder="Seleccionar duración..." /></SelectTrigger>
                <SelectContent>
                  {ACCESS_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              {editForm.acceso_total_hasta && (
                <p className="text-[10px] text-primary font-medium">Acceso hasta: {editForm.acceso_total_hasta}</p>
              )}
            </div>
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

      {/* Invite user modal */}
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
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(roleConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
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