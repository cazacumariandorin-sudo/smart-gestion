import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function UsersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('operario');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const result = await base44.entities.User.list('full_name', 100);
      return result || [];
    },
  });

  const handleInvite = async () => {
    if (!email || loading) return;
    setLoading(true);
    setError('');
    try {
      await base44.functions.invoke('inviteUserFunction', { email, role });
      setOpen(false);
      setEmail('');
      setRole('operario');
      await qc.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      setError(err?.message || 'Error al invitar usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Usuarios ({users.length})</h1>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" /> Invitar
        </Button>
      </div>

      {isLoading && <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>}

      {!isLoading && users.length === 0 && <p className="text-center py-10 text-muted-foreground">No hay usuarios.</p>}

      {!isLoading && users.length > 0 && (
        <div className="space-y-2">
          {users.map(user => (
            <Card key={user.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold bg-primary/10 text-primary">
                  {(user.full_name || user.email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{user.full_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <Badge variant="outline">{user.role || 'operario'}</Badge>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" placeholder="email@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rol</Label>
              <MobileSelect value={role} onValueChange={setRole} placeholder="Rol">
                <MobileSelectItem value="admin">Administrador</MobileSelectItem>
                <MobileSelectItem value="jefe_obra">Jefe de Obra</MobileSelectItem>
                <MobileSelectItem value="operario">Usuario</MobileSelectItem>
                <MobileSelectItem value="control_horario">Control Horario</MobileSelectItem>
                <MobileSelectItem value="cliente_obra">Cliente Obra</MobileSelectItem>
              </MobileSelect>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
           <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
           <Button onClick={handleInvite} disabled={!email || loading} className="gap-2">
             {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invitar
           </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}