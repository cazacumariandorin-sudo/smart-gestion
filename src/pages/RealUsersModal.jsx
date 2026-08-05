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
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Loader2, Building2 } from 'lucide-react';

export default function RealUsersModal({ open, onOpenChange, users, onSuccess }) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('operario');
  const [cargo, setCargo] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [accesoHasta, setAccesoHasta] = useState('');
  const [error, setError] = useState('');

  // Cargar empresas para vincular al empleado
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-select-inv'],
    queryFn: () => base44.entities.Empresa.list(),
    enabled: open,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      // Validaciones básicas
      if (!email || !nombre || !cargo) {
        throw new Error('Completa todos los campos obligatorios (email, nombre, cargo)');
      }

      const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        throw new Error('Este email ya tiene una cuenta registrada');
      }

      const empresa = empresas.find(e => e.id === empresaId);

      // Llamar a la nueva función que crea la InvitacionUsuario + envía el email.
      const response = await base44.functions.invoke('crearInvitacionUsuario', {
        email,
        role: rol,
        full_name: nombre,
        cargo,
        empresa_id: empresaId || null,
        empresa_nombre: empresa?.nombre || null,
        acceso_hasta: accesoHasta ? new Date(accesoHasta).toISOString() : null
      });

      return { email, nombre, estado: response.data?.estado };
    },
    onSuccess: (data) => {
      const mensaje =
        data.estado === 'pendiente_activacion'
          ? `Invitación enviada a ${data.email}. La cuenta se activará automáticamente cuando el usuario acepte el email de invitación.`
          : `✓ Usuario ${data.nombre} añadido correctamente`;
      toast.message(mensaje, { duration: 8000 });
      onOpenChange(false);
      onSuccess();
      // Reset form
      setEmail('');
      setNombre('');
      setRol('operario');
      setCargo('');
      setEmpresaId('');
      setAccesoHasta('');
      setError('');
    },
    onError: (err) => {
      setError(err.message || 'Error al crear la invitación');
    },
  });

  const handleSubmit = () => {
    setError('');
    inviteMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo usuario / empleado</DialogTitle>
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
              placeholder="Nombre del empleado"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1"><Building2 className="w-3 h-3" /> Empresa (empleado de)</Label>
            <MobileSelect value={empresaId} onValueChange={setEmpresaId} placeholder="Sin empresa asignada">
              {empresas.map(e => (
                <MobileSelectItem key={e.id} value={e.id}>{e.nombre}{e.es_principal ? ' (Principal)' : ''}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Rol de acceso *</Label>
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
            <Label className="text-xs">Acceso hasta (opcional)</Label>
            <Input
              type="date"
              value={accesoHasta}
              onChange={(e) => setAccesoHasta(e.target.value)}
            />
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-800 dark:text-blue-200">
            Se enviará un email de invitación. La cuenta nacerá en estado
            <b> «Pendiente de activación»</b> y pasará a <b>«Activo»</b> automáticamente cuando el usuario acepte el email.
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
            Enviar invitación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}