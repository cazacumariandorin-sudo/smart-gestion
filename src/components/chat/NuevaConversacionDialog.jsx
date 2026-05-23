import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, User, Users, X, Check, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function NuevaConversacionDialog({ open, onClose, user, onSuccess }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [operarios, setOperarios] = useState([]);
  const [selectedOperarios, setSelectedOperarios] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [modo, setModo] = useState('directo'); // 'directo' o 'grupo'

  // Si user es null/undefined, no renderizar
  if (!user) {
    return null;
  }

  const buscarOperarios = async () => {
    if (!searchTerm.trim()) return;
    
    setBuscando(true);
    try {
      // Buscar en usuarios en lugar de operarios para mejor acceso a datos
      const todosUsuarios = await base44.entities.User.list();
      const filtrados = todosUsuarios
        .filter(u => u.email && u.email !== user.email && u.role !== 'usuario_demo') // Excluir demo users
        .map(u => ({
          id: u.id,
          data: {
            name: u.full_name || u.email,
            email: u.email,
            role: u.role,
            user_id: u.id
          }
        }))
        .filter(u => {
          const match = u.data.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       u.data.email?.toLowerCase().includes(searchTerm.toLowerCase());
          return match;
        });
      setOperarios(filtrados);
    } catch (error) {
      toast.error('Error al buscar usuarios: ' + error.message);
    } finally {
      setBuscando(false);
    }
  };

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
      setSearchTerm('');
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

        {/* Búsqueda */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Buscar por nombre, email o DNI..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscarOperarios()}
          />
          <Button onClick={buscarOperarios} disabled={buscando}>
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
          {operarios.length === 0 && buscando && (
            <p className="text-sm text-muted-foreground text-center py-4">Buscando...</p>
          )}
          {operarios.length === 0 && !buscando && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Introduce un término de búsqueda
            </p>
          )}
          {operarios.map(op => {
            const isSelected = selectedOperarios.some(o => o.id === op.id);
            return (
              <button
                key={op.id}
                onClick={() => toggleOperario(op)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
                  isSelected 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-card hover:bg-muted'
                )}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-sm">{op.data.name}</p>
                  <p className="text-xs text-muted-foreground">{op.data.email}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {op.data.role || 'Operario'}
                    </Badge>
                    {op.data.phone && (
                      <Badge variant="secondary" className="text-xs">
                        {op.data.phone}
                      </Badge>
                    )}
                  </div>
                </div>
                {isSelected ? (
                  <Check className="w-5 h-5 text-primary shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

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