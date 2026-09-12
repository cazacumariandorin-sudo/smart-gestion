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
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2 } from 'lucide-react';

const ROLES = ['admin', 'gerencia', 'administracion', 'director_comercial', 'técnico', 'jefe_obra', 'operario', 'control_horario', 'cliente_obra', 'contabilidad'];

const ROLE_LABELS = {
  admin: 'ADMIN',
  gerencia: 'GERENCIA',
  administracion: 'ADMINISTRACIÓN',
  director_comercial: 'DIRECTOR COMERCIAL',
  técnico: 'TÉCNICO',
  jefe_obra: 'JEFE OBRA',
  operario: 'OPERARIO',
  control_horario: 'CONTROL HORARIO',
  cliente_obra: 'CLIENTE OBRA',
  contabilidad: 'CONTABILIDAD (GESTORÍA EXTERNA)',
};

const TIPO_CUENTA = ['real', 'demo'];
const VINCULO_ESTADOS = ['pendiente', 'vinculado', 'auto_vinculado', 'demo'];

// Convierte un valor ISO date-time a formato aceptado por <input type="date">
function toDateInputValue(isoString) {
  if (!isoString) return '';
  return isoString.slice(0, 10);
}

export default function EditUserRoleDialog({ open, onOpenChange, user, onSuccess }) {
  const [form, setForm] = useState({});
  const qc = useQueryClient();

  useEffect(() => {
    if (user) {
      setForm({
        role: user.role || 'operario',
        cargo: user.cargo || '',
        avatar_initials: user.avatar_initials || '',
        tipo_cuenta: user.tipo_cuenta || 'real',
        acceso_hasta: toDateInputValue(user.acceso_hasta),
        invitado_por: user.invitado_por || '',
        vinculo_estado: user.vinculo_estado || '',
        vinculo_id: user.vinculo_id || '',
        vinculo_nombre: user.vinculo_nombre || '',
        vinculo_tipo: user.vinculo_tipo || '',
        user_id_personalizado: user.user_id_personalizado || '',
        demo_expires_at: toDateInputValue(user.demo_expires_at),
      });
    }
  }, [user]);

  const setField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user selected');
      const updates = {
        ...form,
        acceso_hasta: form.acceso_hasta ? new Date(form.acceso_hasta).toISOString() : '',
        demo_expires_at: form.demo_expires_at ? new Date(form.demo_expires_at).toISOString() : '',
      };
      return base44.entities.User.update(user.id, updates);
    },
    onSuccess: () => {
      toast.success('Usuario actualizado correctamente');
      if (form.role !== user?.role) {
        setTimeout(() => {
          toast.info(
            `Notifica a ${user?.full_name || user?.email} que debe cerrar sesión y volver a entrar para que el cambio de rol sea visible en su app.`,
            { duration: 8000 }
          );
        }, 500);
      }
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['all-users-tab'] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      toast.error(`Error: ${err.message || 'No se pudo actualizar el usuario'}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Rol</Label>
            <MobileSelect value={form.role} onValueChange={(v) => setField('role', v)} placeholder="Seleccionar rol">
              {ROLES.map(role => (
                <MobileSelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </MobileSelectItem>
              ))}
            </MobileSelect>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Cargo o puesto visible</Label>
            <Input value={form.cargo || ''} onChange={(e) => setField('cargo', e.target.value)} placeholder="Ej: ELECTRICISTA" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Iniciales del avatar</Label>
            <Input value={form.avatar_initials || ''} onChange={(e) => setField('avatar_initials', e.target.value)} placeholder="Ej: AI" maxLength={3} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Tipo de cuenta</Label>
            <MobileSelect value={form.tipo_cuenta} onValueChange={(v) => setField('tipo_cuenta', v)} placeholder="Tipo de cuenta">
              {TIPO_CUENTA.map(t => (
                <MobileSelectItem key={t} value={t}>{t}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Fecha de expiración del acceso (demos)</Label>
            <Input type="date" value={form.acceso_hasta || ''} onChange={(e) => setField('acceso_hasta', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Invitado por (email)</Label>
            <Input value={form.invitado_por || ''} onChange={(e) => setField('invitado_por', e.target.value)} placeholder="email@ejemplo.com" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Estado de vinculación</Label>
            <MobileSelect value={form.vinculo_estado} onValueChange={(v) => setField('vinculo_estado', v)} placeholder="Estado de vinculación">
              {VINCULO_ESTADOS.map(v => (
                <MobileSelectItem key={v} value={v}>{v}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">ID de la ficha Operario vinculada</Label>
            <Input value={form.vinculo_id || ''} onChange={(e) => setField('vinculo_id', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Nombre del operario vinculado</Label>
            <Input value={form.vinculo_nombre || ''} onChange={(e) => setField('vinculo_nombre', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Tipo de vinculación</Label>
            <Input value={form.vinculo_tipo || ''} onChange={(e) => setField('vinculo_tipo', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">ID personalizado del usuario</Label>
            <Input value={form.user_id_personalizado || ''} onChange={(e) => setField('user_id_personalizado', e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Fecha de expiración de la cuenta demo</Label>
            <Input type="date" value={form.demo_expires_at || ''} onChange={(e) => setField('demo_expires_at', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
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