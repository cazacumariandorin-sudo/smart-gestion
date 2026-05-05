import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Shield, UserCheck, Hammer, Clock, Mail, UserPlus, Loader2, Pencil, Trash2 } from 'lucide-react';
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
  admin: { label: 'Administrador', icon: Shield, className: 'bg-red-100 text-red-700 border-red-200' },
  jefe_obra: { label: 'Jefe de Obra', icon: UserCheck, className: 'bg-blue-100 text-blue-700 border-blue-200' },
  operario: { label: 'Usuario', icon: Hammer, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  control_horario: { label: 'Control Horario', icon: Clock, className: 'bg-amber-100 text-amber-700 border-amber-200' },
  cliente_obra: { label: 'Cliente Obra', icon: Shield, className: 'bg-violet-100 text-violet-700 border-violet-200' },
};

export default function Users() {
  const queryClient = useQueryClient();
  const { isAdmin } = useUserRole();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('operario');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('full_name', 100),
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
      setInviteError(e.response?.data?.error || e.message || 'Error');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} usuarios</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" /> Invitar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground">No hay usuarios.</p>
      ) : (
        <div className="space-y-2">
          {users.map(user => {
            const role = user.role || 'operario';
            const cfg = roleConfig[role];
            const Icon = cfg?.icon || Mail;
            return (
              <Card key={user.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${cfg?.className}`}>
                    {(user.full_name || user.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{user.full_name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <Badge variant="outline" className={cfg?.className}>{cfg?.label}</Badge>
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
                {Object.entries(roleConfig).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviting} className="gap-2">
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}