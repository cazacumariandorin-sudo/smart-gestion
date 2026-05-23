import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, UserCheck, Search, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500',
];

function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

export default function VincularOperarioDialog({ open, onOpenChange, user, onSuccess }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOperario, setSelectedOperario] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSelectedOperario(null);
    }
  }, [open]);

  const { data: operarios = [], isLoading: operariosLoading } = useQuery({
    queryKey: ['operarios-vincular', searchTerm],
    queryFn: () => base44.entities.Operario.list('name', 200),
    enabled: open,
  });

  const filteredOperarios = operarios.filter(op => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      op.name?.toLowerCase().includes(term) ||
      op.email?.toLowerCase().includes(term) ||
      op.dni?.toLowerCase().includes(term)
    );
  });

  const vincularMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedOperario) throw new Error('Datos incompletos');
      
      // Actualizar usuario con vinculación
      await base44.entities.User.update(user.id, {
        vinculo_id: selectedOperario.id,
        vinculo_tipo: 'operario',
        vinculo_nombre: selectedOperario.name,
        vinculo_email: selectedOperario.email || '',
        vinculo_estado: 'vinculado',
        vinculo_fecha: new Date().toISOString(),
        vinculo_asignado_por: (await base44.auth.me())?.email || 'admin',
      });

      // Actualizar operario con vinculación al usuario
      await base44.entities.Operario.update(selectedOperario.id, {
        user_id: user.id,
        user_email: user.email,
        user_vinculado_nombre: user.full_name || user.email,
        vinculacion_fecha: new Date().toISOString(),
        vinculacion_tipo: 'manual',
        es_temporal: false,
        active: true,
      });

      return { success: true };
    },
    onSuccess: () => {
      toast.success(`Usuario vinculado con ${selectedOperario.name}`);
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['operarios'] });
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      console.error('Error al vincular:', err);
      toast.error(`Error: ${err.message || 'No se pudo vincular el operario'}`);
    },
  });

  const currentUser = user;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            Vincular con Operario Existente
          </DialogTitle>
          <DialogDescription>
            Asocia este usuario con un operario de la base de datos
          </DialogDescription>
        </DialogHeader>

        {/* Información del usuario */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          <Avatar className={`w-10 h-10 ${getAvatarColor(currentUser?.full_name || '')}`}>
            <AvatarFallback className="text-white text-sm font-semibold">
              {getInitials(currentUser?.full_name || currentUser?.email || '?')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium text-sm">{currentUser?.full_name || '—'}</p>
            <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {currentUser?.role || 'Sin rol'}
              </Badge>
              {currentUser?.vinculo_estado && (
                <Badge variant={currentUser.vinculo_estado === 'vinculado' ? 'default' : 'outline'} className="text-xs">
                  {currentUser.vinculo_estado === 'vinculado' ? '✓ Vinculado' : 'Pendiente'}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Selector de operarios */}
        <div className="space-y-3 flex-1 min-h-0 flex flex-col">
          <Label className="text-sm font-medium">Operarios disponibles</Label>
          
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por nombre, email o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {operariosLoading ? (
            <div className="flex items-center justify-center py-8 flex-1">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOperarios.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed rounded-lg flex-1 flex items-center justify-center">
              {operarios.length === 0 ? 'No hay operarios en la base de datos' : 'No se encontraron operarios'}
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-4">
                {filteredOperarios.map((op) => {
                  const isSelected = selectedOperario?.id === op.id;
                  const isAlreadyLinked = !!op.user_id;
                  
                  return (
                    <button
                      key={op.id}
                      onClick={() => !isAlreadyLinked && setSelectedOperario(op)}
                      disabled={isAlreadyLinked}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        isSelected
                          ? 'bg-primary/15 border-primary/60 ring-2 ring-primary/40'
                          : isAlreadyLinked
                          ? 'bg-muted/40 border-muted opacity-50 cursor-not-allowed'
                          : 'bg-background hover:bg-muted/40 border-border'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className={`w-9 h-9 ${getAvatarColor(op.name)} shrink-0`}>
                          <AvatarFallback className="text-white text-xs font-semibold">
                            {getInitials(op.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">{op.name}</p>
                            {isAlreadyLinked && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                Vinculado
                              </Badge>
                            )}
                            {isSelected && (
                              <Badge className="text-xs shrink-0 bg-primary">
                                ✓ Seleccionado
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {op.email || 'Sin email'}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {op.role || 'Sin rol'}
                            </Badge>
                            {op.dni && (
                              <span className="text-xs text-muted-foreground">
                                {op.dni}
                              </span>
                            )}
                            {op.phone && (
                              <span className="text-xs text-muted-foreground">
                                {op.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => vincularMutation.mutate()}
            disabled={!selectedOperario || vincularMutation.isPending}
            className="gap-2"
          >
            {vincularMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {selectedOperario ? 'Vincular operario' : 'Selecciona un operario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}