import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, UserCheck, Hammer, Clock, Mail, UserPlus, Loader2, Pencil, Save, X, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const roleConfig = {
  admin:           { label: 'Administrador',    icon: Shield,    className: 'bg-red-100 text-red-700 border-red-200',       desc: 'Acceso completo a todos los módulos' },
  jefe_obra:       { label: 'Jefe de Obra',     icon: UserCheck, className: 'bg-blue-100 text-blue-700 border-blue-200',    desc: 'Partes, clientes, pedidos, informes, fotos' },
  operario:        { label: 'Operario',         icon: Hammer,    className: 'bg-emerald-100 text-emerald-700 border-emerald-200', desc: 'Control horario, partes, gastos, vacaciones' },
  control_horario: { label: 'Control Horario',  icon: Clock,     className: 'bg-amber-100 text-amber-700 border-amber-200', desc: 'Solo control horario, partes y pedidos' },
};

const ACCESS_RANGES = ['1 semana', '2 semanas', '1 mes', '3 meses'];

export default function Users() {
  const queryClient = useQueryClient();
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); setEditUser(null); },
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

  const grantTempAccess = (userId, range) => {
    const days = range === '1 semana' ? 7 : range === '2 semanas' ? 14 : range === '1 mes' ? 30 : 90;
    const until = new Date(); until.setDate(until.getDate() + days);
    updateMutation.mutate({ id: userId, data: { acceso_total_hasta: until.toISOString().split('T')[0] } });
  };

  const filtered = users.filter(u => filterRole === 'all' || (u.role || 'operario') === filterRole);

  // Group by role
  const byRole = Object.keys(roleConfig).reduce((acc, r) => {
    acc[r] = users.filter(u => (u.role || 'operario') === r);
    return acc;
  }, {});

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

      {/* Role cards summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.entries(roleConfig).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <Card key={key} className={`p-3 cursor-pointer border-2 transition-all ${filterRole === key ? 'border-primary' : 'border-transparent'}`} onClick={() => setFilterRole(filterRole === key ? 'all' : key)}>
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
      ) : (
        <div className="space-y-2">
          {filtered.map(user => {
            const role = user.role || 'operario';
            const cfg = roleConfig[role] || roleConfig.operario;
            const Icon = cfg.icon;
            const isEditing = editUser?.id === user.id;
            const today = new Date().toISOString().split('T')[0];
            const hasTempAccess = user.acceso_total_hasta && user.acceso_total_hasta >= today;
            return (
              <Card key={user.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${cfg.className}`}>
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{user.full_name || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {user.email}
                      </p>
                      {hasTempAccess && <p className="text-[10px] text-primary font-medium">Acceso completo hasta {user.acceso_total_hasta}</p>}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Select value={editForm.role || role} onValueChange={v => setEditForm(p => ({ ...p, role: v }))}>
                        <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(roleConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select onValueChange={v => grantTempAccess(user.id, v)}>
                        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Acceso temporal..." /></SelectTrigger>
                        <SelectContent>
                          {ACCESS_RANGES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => updateMutation.mutate({ id: user.id, data: editForm })}>
                        <Save className="w-3.5 h-3.5 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditUser(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${cfg.className} text-xs flex items-center gap-1`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </Badge>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditUser(user); setEditForm({ role }); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invitar usuario</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input type="email" placeholder="email@ejemplo.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
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