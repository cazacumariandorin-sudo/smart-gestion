import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, UserMinus, UserPlus, Shield, X } from 'lucide-react';
import { toast } from 'sonner';

export default function GestionarGrupoDialog({ open, onClose, conversacion, user, onSuccess }) {
  const [nombreGrupo, setNombreGrupo] = useState(conversacion?.nombre || '');

  if (!conversacion) return null;

  const participantes = conversacion.participantes || [];
  const esAdmin = user.role === 'admin';

  const handleActualizarNombre = async () => {
    if (!nombreGrupo.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    try {
      await base44.entities.ChatConversacion.update(conversacion.id, {
        nombre: nombreGrupo.trim(),
      });
      toast.success('Nombre actualizado');
      onSuccess();
    } catch (error) {
      toast.error('Error: ' + error.message);
    }
  };

  const handleEliminarParticipante = async (participante) => {
    if (!confirm(`¿Eliminar a ${participante.nombre_display} del grupo?`)) return;

    try {
      const nuevosParticipantes = participantes.filter(
        p => p.user_email !== participante.user_email
      );

      if (nuevosParticipantes.length < 2) {
        toast.error('El grupo debe tener al menos 2 participantes');
        return;
      }

      await base44.entities.ChatConversacion.update(conversacion.id, {
        participantes: nuevosParticipantes,
      });
      toast.success('Participante eliminado');
      onSuccess();
    } catch (error) {
      toast.error('Error: ' + error.message);
    }
  };

  const handleSalirGrupo = async () => {
    if (!confirm('¿Seguro que quieres salir del grupo?')) return;

    try {
      const nuevosParticipantes = participantes.filter(
        p => p.user_email !== user.email
      );

      if (nuevosParticipantes.length < 1) {
        toast.error('No puedes ser el último en salir. Elimina el grupo en su lugar.');
        return;
      }

      await base44.entities.ChatConversacion.update(conversacion.id, {
        participantes: nuevosParticipantes,
      });
      toast.success('Has salido del grupo');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Error: ' + error.message);
    }
  };

  const handleEliminarGrupo = async () => {
    if (!confirm('¿Eliminar grupo permanentemente? Esta acción no se puede deshacer.')) return;

    try {
      await base44.entities.ChatConversacion.delete(conversacion.id);
      toast.success('Grupo eliminado');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Error: ' + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Gestionar Grupo
          </DialogTitle>
          <DialogDescription>
            Administra los participantes y configuración del grupo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nombre del grupo */}
          {esAdmin && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre del grupo</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nombreGrupo}
                  onChange={e => setNombreGrupo(e.target.value)}
                  className="flex-1 px-3 py-2 border border-input rounded-md text-sm"
                />
                <Button size="sm" onClick={handleActualizarNombre}>
                  Guardar
                </Button>
              </div>
            </div>
          )}

          {!esAdmin && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{conversacion.nombre}</p>
            </div>
          )}

          {/* Participantes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4" />
                Participantes ({participantes.length})
              </label>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {participantes.map((participante, idx) => {
                const esUsuarioActual = participante.user_email === user.email;
                const esCreador = participante.user_email === conversacion.creado_por_email;
                
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">
                          {participante.nombre_display?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {participante.nombre_display || participante.user_email}
                          {esCreador && <Shield className="w-3 h-3 inline ml-1 text-primary" />}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {participante.rol || 'Participante'}
                          {participante.user_email === user.email && ' (tú)'}
                        </p>
                      </div>
                    </div>

                    {esAdmin && participante.user_email !== user.email && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleEliminarParticipante(participante)}
                      >
                        <UserMinus className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Acciones */}
          <div className="border-t pt-4 space-y-2">
            {participantes.some(p => p.user_email === user.email) && (
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={handleSalirGrupo}
              >
                <X className="w-4 h-4 mr-2" />
                Salir del grupo
              </Button>
            )}

            {esAdmin && (
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleEliminarGrupo}
              >
                <X className="w-4 h-4 mr-2" />
                Eliminar grupo permanentemente
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}