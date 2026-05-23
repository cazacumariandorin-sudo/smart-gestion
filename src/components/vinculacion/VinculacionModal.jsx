import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertTriangle, Check, User, Clock, Calendar } from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import { es } from 'date-fns/locale';

export default function VinculacionModal({ open, onClose, usuario, onSuccess }) {
  const qc = useQueryClient();
  const [operarioSeleccionado, setOperarioSeleccionado] = useState('');
  const [tipoVinculo, setTipoVinculo] = useState('operario');
  const [notas, setNotas] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState('');

  // Cargar operarios disponibles
  const { data: operarios = [], isLoading: loadingOperarios } = useQuery({
    queryKey: ['operarios-sin-vincular'],
    queryFn: async () => {
      const all = await base44.entities.Operario.list('-name', 500);
      const disponibles = all.filter(op => !op.user_id || op.user_id === '');
      console.log('Operarios totales:', all.length, '| Disponibles:', disponibles.length);
      return disponibles;
    },
    enabled: open,
  });

  // Cargar clientes (si es tipo cliente_obra)
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-activos'],
    queryFn: async () => {
      const all = await base44.entities.Client.list('-name', 200);
      return all.filter(c => c.active !== false);
    },
    enabled: open && tipoVinculo === 'cliente_obra',
  });

  // Buscar sugerencia automática por email
  const sugerenciaEmail = operarios.find(op => op.email?.toLowerCase() === usuario?.email?.toLowerCase());

  useEffect(() => {
    if (sugerenciaEmail && open) {
      setOperarioSeleccionado(sugerenciaEmail.id);
    }
  }, [sugerenciaEmail, open]);

  const handleVincular = async () => {
    try {
      const user = await base44.auth.me();
      const now = new Date().toISOString();
      
      let operarioId, operarioNombre, operarioEmail;
      
      if (tipoVinculo === 'operario') {
        if (!operarioSeleccionado) {
          toast.error('Selecciona un operario');
          return;
        }
        const operario = operarios.find(op => op.id === operarioSeleccionado);
        operarioId = operario.id;
        operarioNombre = operario.name;
        operarioEmail = operario.email || usuario.email;
        
        // Actualizar Operario
        await base44.entities.Operario.update(operarioId, {
          user_id: usuario.id,
          user_email: usuario.email,
          user_vinculado_nombre: usuario.full_name || usuario.email,
          vinculacion_tipo: 'manual',
          vinculacion_fecha: now,
        });
      } else if (tipoVinculo === 'cliente_obra') {
        if (!clienteSeleccionado) {
          toast.error('Selecciona un cliente');
          return;
        }
        const cliente = clientes.find(c => c.id === clienteSeleccionado);
        operarioId = cliente.id;
        operarioNombre = cliente.name;
        operarioEmail = cliente.email || usuario.email;
      }

      // Actualizar Usuario
      await base44.entities.User.update(usuario.id, {
        vinculo_id: operarioId,
        vinculo_nombre: operarioNombre,
        vinculo_email: operarioEmail,
        vinculo_tipo: tipoVinculo,
        vinculo_estado: 'vinculado',
        vinculo_fecha: now,
        vinculo_asignado_por: user.email,
      });

      // Crear log
      await base44.entities.VinculacionLog.create({
        usuario_id: usuario.id,
        usuario_email: usuario.email,
        usuario_nombre: usuario.full_name || usuario.email,
        accion: 'vinculo_manual',
        operario_id_nuevo: operarioId,
        operario_nombre: operarioNombre,
        tipo_vinculo: tipoVinculo,
        dias_transcurridos: usuario.fecha_registro 
          ? differenceInDays(new Date(now), new Date(usuario.fecha_registro))
          : 0,
        realizado_por_email: user.email,
        realizado_por_rol: user.role,
        timestamp: now,
        motivo: notas || null,
      });

      toast.success('Vinculación realizada correctamente');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error vinculando:', error);
      toast.error('Error: ' + error.message);
    }
  };

  const diasRestantes = usuario?.fecha_limite_vinculacion 
    ? Math.ceil((new Date(usuario.fecha_limite_vinculacion).getTime() - Date.now()) / 86400000)
    : 7;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Vincular usuario {usuario?.email}
          </DialogTitle>
          <DialogDescription>
            Asocia este usuario con un operario o cliente de la app
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info urgente */}
          {diasRestantes <= 2 && diasRestantes > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-semibold">Urgente: quedan {diasRestantes} días</span>
              </div>
            </div>
          )}

          {/* Tipo de vínculo */}
          <div className="space-y-2">
            <Label>Tipo de vínculo</Label>
            <Select value={tipoVinculo} onValueChange={setTipoVinculo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operario">Operario</SelectItem>
                <SelectItem value="cliente_obra">Cliente de Obra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selector de operario */}
          {tipoVinculo === 'operario' && (
            <div className="space-y-2">
              <Label>Seleccionar operario</Label>
              {sugerenciaEmail && (
                <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 mb-2">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-sm">
                    <Check className="w-4 h-4" />
                    <span>Sugerencia automática por email coincidente</span>
                  </div>
                </div>
              )}
              {loadingOperarios ? (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  Cargando operarios...
                </div>
              ) : operarios.length === 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-semibold">No hay operarios disponibles</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        Todos los operarios ya están vinculados o no existen. 
                        <br />
                        <strong>Ve a <a href="/operarios" className="underline font-medium">Operarios</a> para crear uno nuevo.</strong>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Select value={operarioSeleccionado} onValueChange={setOperarioSeleccionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Buscar operario..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {operarios.map(op => (
                        <SelectItem key={op.id} value={op.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{op.name}</span>
                            {op.dni && <span className="text-xs text-muted-foreground">DNI: {op.dni}</span>}
                            {op.email && <span className="text-xs text-muted-foreground">{op.email}</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {sugerenciaEmail && (
                    <Badge variant="outline" className="text-xs mt-1">
                      Email exacto ✓
                    </Badge>
                  )}
                </>
              )}
            </div>
          )}

          {/* Selector de cliente */}
          {tipoVinculo === 'cliente_obra' && (
            <div className="space-y-2">
              <Label>Seleccionar cliente</Label>
              <Select value={clienteSeleccionado} onValueChange={setClienteSeleccionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Buscar cliente..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {clientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{c.name}</span>
                        {c.nif && <span className="text-xs text-muted-foreground">NIF: {c.nif}</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea 
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Añade notas sobre esta vinculación..."
              className="h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleVincular}>
            Confirmar vinculación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}