import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, UserCheck, Hammer, Mail, UserPlus, Loader2, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const roleConfig = {
  admin: { label: 'Administrador', icon: Shield, className: 'bg-red-100 text-red-700 border-red-200' },
  encargado: { label: 'Encargado', icon: UserCheck, className: 'bg-blue-100 text-blue-700 border-blue-200' },
  operario: { label: 'Operario', icon: Hammer, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function Users() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operario');
  const [editRole, setEditRole] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('full_name', 100),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, role }) => base44.entities.User.update(id, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditUser(null);
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setInviteError('');
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole === 'admin' ? 'admin' : 'user');
      // Save role info
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('operario');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (e) {
      setInviteError(e.message || 'Error al invitar al usuario');
    }
    setInviting(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de accesos y privilegios</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2 shadow-sm">
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Invitar usuario</span>
        </Button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {Object.entries(roleConfig).map(([key, cfg]) => (
          <Card key={key} className="p-3 flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.className.replace('text-', 'text-').replace('border-', '')}`}>
              <cfg.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold">{cfg.label}</p>
              <p className="text-[10px] text-muted-foreground">
                {key === 'admin' ? 'Acceso total' : key === 'encargado' ? 'Gestión de partes' : 'Solo lectura'}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <p className="text-sm text-muted-foreground">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(user => {
            const role = user.role || 'operario';
            const cfg = roleConfig[role] || roleConfig.operario;
            const isEditing = editUser?.id === user.id;
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
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <Select value={editRole} onValueChange={setEditRole}>
                        <SelectTrigger className="w-36 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="encargado">Encargado</SelectItem>
                          <SelectItem value="operario">Operario</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-8 w-8"
                        onClick={() => updateMutation.mutate({ id: user.id, role: editRole })}>
                        <Save className="w-3.5 h-3.5 text-primary" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8"
                        onClick={() => setEditUser(null)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${cfg.className} text-xs`}>
                        {cfg.label}
                      </Badge>
                      <Button size="icon" variant="ghost" className="h-8 w-8"
                        onClick={() => { setEditUser(user); setEditRole(role); }}>
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

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Email *</Label>
              <Input
                type="email"
                placeholder="email@ejemplo.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rol</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="encargado">Encargado</SelectItem>
                  <SelectItem value="operario">Operario</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviting} className="gap-2 min-w-28">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Invitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}