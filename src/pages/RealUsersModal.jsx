import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const ROLES = ['admin', 'gerencia', 'director_comercial', 'jefe_obra', 'operario', 'control_horario', 'cliente_obra'];

export default function RealUsersModal({ open, onOpenChange, users, onSuccess }) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('operario');
  const [cargo, setCargo] = useState('');
  const [accesoHasta, setAccesoHasta] = useState('');
  const [error, setError] = useState('');

  const inviteMutation = useMutation({
    mutationFn: async () => {
      // Validación 1: Campos requeridos
      if (!email || !nombre || !cargo) {
        throw new Error('Completa todos los campos obligatorios (email, nombre, cargo)');
      }

      // Validación 2: Email ya existe
      const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        throw new Error('Este email ya tiene una cuenta registrada');
      }

      // Usar función backend que genera ID personalizado automáticamente y
      // aplica el rol personalizado tras el registro.
      const response = await base44.functions.invoke('inviteUserFunction', {
        email,
        role: rol
      });

      const estado = response.data?.estado;
      const userId = response.data?.user_id_personalizado;

      // Si el usuario ya estaba registrado (aceptó la invitación antes), aplicamos los
      // datos adicionales inmediatamente. Si está pendiente, dejamos que el flujo de
      // invitación complete el alta y el admin rellenará el resto tras el registro.
      if (estado === 'registrado') {
        const createdUsers = await base44.entities.User.filter({ email });
        if (createdUsers.length > 0) {
          await base44.entities.User.update(createdUsers[0].id, {
            full_name: nombre,
            cargo,
            acceso_hasta: accesoHasta || null,
            tipo_cuenta: 'real',
          });
        }
      }

      return { email, nombre, user_id_personalizado: userId, estado };
    },
    onSuccess: (data) => {
      let mensaje;
      if (data.estado === 'pendiente_aceptacion') {
        mensaje = `Invitación enviada a ${data.email}. El usuario aparecerá en la lista tras aceptar el email de invitación.`;
        toast.message(mensaje, { duration: 8000 });
      } else {
        mensaje = `✓ Usuario ${data.nombre} añadido correctamente`;
        if (data.user_id_personalizado) {
          mensaje += ` (ID: ${data.user_id_personalizado})`;
        }
        toast.success(mensaje);
      }
      onOpenChange(false);
      onSuccess();
      // Reset form
      setEmail('');
      setNombre('');
      setRol('operario');
      setCargo('');
      setAccesoHasta('');
      setError('');
    },
    onError: (err) => {
      setError(err.message || 'Error al invitar usuario');
    },
  });

  const handleSubmit = () => {
    setError('');
    inviteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Añadir usuario real</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-xs">Email *</Label>
            <Input
              type="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Nombre completo *</Label>
            <Input
              placeholder="Nombre del usuario"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Rol *</Label>
            <MobileSelect value={rol} onValueChange={setRol} placeholder="Seleccionar rol">
              <MobileSelectItem value="admin">ADMIN</MobileSelectItem>
              <MobileSelectItem value="gerencia">GERENCIA</MobileSelectItem>
              <MobileSelectItem value="director_comercial">DIRECTOR COMERCIAL</MobileSelectItem>
              <MobileSelectItem value="jefe_obra">JEFE OBRA</MobileSelectItem>
              <MobileSelectItem value="técnico">TÉCNICO</MobileSelectItem>
              <MobileSelectItem value="operario">OPERARIO</MobileSelectItem>
              <MobileSelectItem value="control_horario">CONTROL HORARIO</MobileSelectItem>
              <MobileSelectItem value="cliente_obra">CLIENTE OBRA</MobileSelectItem>
            </MobileSelect>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Cargo *</Label>
            <Input
              placeholder="Ej: Jefe de equipo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Acceso hasta</Label>
            <Input
              type="date"
              value={accesoHasta}
              onChange={(e) => setAccesoHasta(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={inviteMutation.isPending} className="gap-2">
            {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}