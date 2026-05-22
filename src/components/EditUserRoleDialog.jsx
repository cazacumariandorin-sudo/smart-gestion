import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2 } from 'lucide-react';

const ROLES = ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'operario', 'control_horario', 'cliente_obra'];

const ROLE_LABELS = {
  admin: 'ADMIN',
  gerencia: 'GERENCIA',
  director_comercial: 'DIRECTOR COMERCIAL',
  jefe_obra: 'JEFE OBRA',
  operario: 'OPERARIO',
  control_horario: 'CONTROL HORARIO',
  cliente_obra: 'CLIENTE OBRA',
};

export default function EditUserRoleDialog({ open, onOpenChange, user, onSuccess }) {
  const [newRole, setNewRole] = useState(user?.role || 'operario');
  const qc = useQueryClient();

  useEffect(() => {
    if (user) {
      setNewRole(user.role || 'operario');
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user selected');
      console.log('Updating user', user.id, 'role to', newRole);
      const result = await base44.entities.User.update(user.id, { role: newRole });
      console.log('Update result:', result);
      return result;
    },
    onSuccess: () => {
      toast.success(`Rol actualizado a ${ROLE_LABELS[newRole]}`);
      qc.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      console.error('Error updating user role:', err);
      toast.error(`Error: ${err.message || 'No se pudo actualizar el rol'}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar rol de usuario</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Nuevo rol</Label>
            <MobileSelect value={newRole} onValueChange={setNewRole} placeholder="Seleccionar rol">
              {ROLES.map(role => (
                <MobileSelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </MobileSelectItem>
              ))}
            </MobileSelect>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => updateMutation.mutate()} 
            disabled={updateMutation.isPending || newRole === user?.role} 
            className="gap-2"
          >
            {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}