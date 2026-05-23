import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Users, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function NuevaConversacionDialog({ open, onClose, user, onSuccess }) {
  const [operarios, setOperarios] = useState([]);
  const [selectedOperarios, setSelectedOperarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [modo, setModo] = useState('directo'); // 'directo' o 'grupo'

  // Cargar operarios al abrir el dialog
  useEffect(() => {
    if (open && user) {
      cargarOperarios();
    }
  }, [open, user]);

  const cargarOperarios = async () => {
    if (!user) return;
    setCargando(true);
    try {
      const todosUsuarios = await base44.entities.User.list();
      const filtrados = todosUsuarios
        .filter(u => u.email && u.email !== user.email && u.role !== 'usuario_demo')
        .map(u => ({
          id: u.id,
          data: {
            name: u.full_name || u.email,
            email: u.email,
            role: u.role,
            user_id: u.id
          }
        }));
      setOperarios(filtrados);
    } catch (error) {
      toast.error('Error al cargar usuarios: ' + error.message);
    } finally {
      setCargando(false);
    }
  };

  // Si user es null/undefined, no renderizar
  if (!user) {
    return null;
  }

  const toggleOperario = (operario) => {
    if (modo === 'directo') {
      setSelectedOperarios([operario]);
    } else {
      setSelectedOperarios(prev => 
        prev.find(o => o.id === operario.id)
          ? prev.filter(o => o.id !== operario.id)
          : [...prev, operario]
      );
    }
  };

  const handleCrear = async () => {
    if (selectedOperarios.length === 0) {
      toast.error('Selecciona al menos un operario');
      return;
    }

    if (modo === 'directo' && selectedOperarios.length > 1) {
      toast.error('Para chat directo, selecciona solo un operario');
      return;
    }

    try {
      if (modo === 'directo') {
        // Crear conversación directa
        const operario = selectedOperarios[0];
        
        // Verificar si ya existe una conversación con este operario
        const conversaciones = await base44.entities.ChatConversacion.list();
        const existente = conversaciones.find(conv => 
          conv.tipo === 'directo' &&
          conv.participantes?.some(p => p.user_email === operario.data.email) &&
          conv.participantes?.some(p => p.user_email === user.email)
        );

        if (existente) {
          onSuccess(existente.id);
          onClose();
          toast.success('Conversación existente abierta');
          return;
        }

        const nuevaConv = await base44.entities.ChatConversacion.create({
          nombre: `${user.full_name || user.email} ↔ ${operario.data.name}`,
          tipo: 'directo',
          participantes: [
            { 
              user_email: user.email, 
              user_id: user.id,
              nombre_display: user.full_name || user.email,
              rol: user.role,
              fecha_union: new Date().toISOString()
            },
            { 
              user_email: operario.data.email, 
              user_id: operario.data.user_id || null,
              nombre_display: operario.data.name,
              rol: operario.data.role || 'operario',
              fecha_union: new Date().toISOString()
            }
          ],
          cifrado_activo: true,
        });

        onSuccess(nuevaConv.id);
        toast.success('Conversación creada');
      } else {
        // Crear grupo (solo admin)
        if (user.role !== 'admin') {
          toast.error('Solo administradores pueden crear grupos');
          return;
        }

        if (!nombreGrupo.trim()) {
          toast.error('Introduce un nombre para el grupo');
          return;
        }

        const nuevaConv = await base44.entities.ChatConversacion.create({
          nombre: nombreGrupo.trim(),
          tipo: 'grupo',
          participantes: [
            { 
              user_email: user.email, 
              user_id: user.id,
              nombre_display: user.full_name || user.email,
              rol: user.role,
              fecha_union: new Date().toISOString()
            },
            ...selectedOperarios.map(op => ({
              user_email: op.data.email,
              user_id: op.data.user_id || null,
              nombre_display: op.data.name,
              rol: op.data.role || 'operario',
              fecha_union: new Date().toISOString()
            }))
          ],
          cifrado_activo: false,
        });

        onSuccess(nuevaConv.id);
        toast.success('Grupo creado');
      }

      onClose();
      setOperarios([]);
      setSelectedOperarios([]);
      setNombreGrupo('');
    } catch (error) {
      toast.error('Error al crear: ' + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Nueva Conversación
          </DialogTitle>
          <DialogDescription>
            {user.role === 'admin' 
              ? 'Busca operarios para iniciar un chat directo o crear un grupo' 
              : 'Busca operarios para iniciar un chat directo'}
          </DialogDescription>
        </DialogHeader>

        {/* Selector de modo */}
        {user.role === 'admin' && (
          <div className="flex gap-2 mb-4">
            <Button
              variant={modo === 'directo' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setModo('directo')}
            >
              <User className="w-4 h-4 mr-2" />
              Chat Directo
            </Button>
            <Button
              variant={modo === 'grupo' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setModo('grupo')}
            >
              <Users className="w-4 h-4 mr-2" />
              Crear Grupo
            </Button>
          </div>
        )}

        {/* Input nombre grupo */}
        {modo === 'grupo' && (
          <Input
            placeholder="Nombre del grupo..."
            value={nombreGrupo}
            onChange={e => setNombreGrupo(e.target.value)}
            className="mb-3"
          />
        )}

        {/* Selector desplegable para chat directo */}
        {modo === 'directo' && (
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Seleccionar operario:</label>
            <Select
              value={selectedOperarios[0]?.id || ''}
              onValueChange={(value) => {
                const operario = operarios.find(op => op.id === value);
                if (operario) toggleOperario(operario);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Elige un operario..." />
              </SelectTrigger>
              <SelectContent>
                {operarios.map(op => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.data.name} ({op.data.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Selector múltiple para grupo */}
        {modo === 'grupo' && (
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Seleccionar operarios (múltiple):</label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2">
              {operarios.map(op => {
                const isSelected = selectedOperarios.some(o => o.id === op.id);
                return (
                  <button
                    key={op.id}
                    onClick={() => toggleOperario(op)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded-md transition-all text-left',
                      isSelected 
                        ? 'bg-primary/10 border-primary border' 
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border-2 shrink-0',
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{op.data.name}</p>
                      <p className="text-xs text-muted-foreground">{op.data.email}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Operarios seleccionados */}
        {selectedOperarios.length > 0 && (
          <div className="border-t pt-3 mt-3">
            <p className="text-xs font-medium mb-2">
              Seleccionados ({selectedOperarios.length}):
            </p>
            <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
              {selectedOperarios.map(op => (
                <Badge key={op.id} variant="secondary" className="gap-1">
                  {op.data.name}
                  <button
                    onClick={() => toggleOperario(op)}
                    className="hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCrear}
            disabled={selectedOperarios.length === 0}
          >
            {modo === 'directo' ? 'Iniciar Chat' : 'Crear Grupo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}