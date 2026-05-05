import { useState, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Loader2, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function UsersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [openInvite, setOpenInvite] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('operario');
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (me && me.role !== 'admin') {
      navigate('/');
    } else if (me?.role === 'admin') {
      setIsAdmin(true);
    }
  }, [me, navigate]);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const result = await base44.entities.User.list('full_name', 100);
      return result || [];
    },
    enabled: isAdmin,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      await base44.functions.invoke('inviteUserFunction', { email, role });
    },
    onSuccess: () => {
      setOpenInvite(false);
      setEmail('');
      setRole('operario');
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario invitado');
    },
    onError: (err) => {
      setError(err?.message || 'Error al invitar usuario');
      toast.error('Error al invitar usuario');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }) => {
      await base44.entities.User.update(userId, { role: newRole });
    },
    onSuccess: () => {
      setOpenEdit(false);
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Rol actualizado');
    },
    onError: () => {
      toast.error('Error al actualizar rol');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      await base44.entities.User.delete(userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario eliminado');
    },
    onError: () => {
      toast.error('Error al eliminar usuario');
    },
  });

  const handleInvite = async () => {
    if (!email) return;
    inviteMutation.mutate();
  };

  const handleEditRole = (user) => {
    setEditingUser(user);
    setRole(user.role || 'operario');
    setOpenEdit(true);
  };

  const handleSaveRole = () => {
    if (editingUser && role !== editingUser.role) {
      updateRoleMutation.mutate({ userId: editingUser.id, newRole: role });
    }
  };

  if (meLoading || !isAdmin) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto flex items-center justify-center py-10">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Gestión de Usuarios ({users.length})</h1>
        <Button onClick={() => setOpenInvite(true)} className="gap-2">
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
              <div className="flex items-center gap-2">
                <Badge variant="outline">{user.role || 'operario'}</Badge>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => handleEditRole(user)}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminará {user.full_name || user.email}. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => deleteUserMutation.mutate(user.id)}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Invitar */}
      <Dialog open={openInvite} onOpenChange={setOpenInvite}>
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
           <Button variant="outline" onClick={() => setOpenInvite(false)}>Cancelar</Button>
           <Button onClick={handleInvite} disabled={!email || inviteMutation.isPending} className="gap-2">
             {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invitar
           </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Rol */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar rol: {editingUser?.full_name || editingUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
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
          </div>
          <DialogFooter>
           <Button variant="outline" onClick={() => setOpenEdit(false)}>Cancelar</Button>
           <Button onClick={handleSaveRole} disabled={role === editingUser?.role || updateRoleMutation.isPending} className="gap-2">
             {updateRoleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit2 className="w-4 h-4" />} Guardar
           </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}