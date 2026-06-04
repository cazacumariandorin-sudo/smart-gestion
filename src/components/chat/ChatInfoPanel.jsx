import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, LogOut, BellOff, Bell, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ROL_LABELS = {
  admin: 'Admin', gerencia: 'Gerencia', director_comercial: 'Dir. Comercial',
  jefe_obra: 'Jefe Obra', operario: 'Operario', control_horario: 'Control Horario',
};

export default function ChatInfoPanel({ open, onClose, conversacion, currentUser, messages, onSalir }) {
  if (!conversacion) return null;

  const participantes = conversacion.participantes || [];
  const adjuntosTodos = messages
    .filter(m => m.adjuntos && m.adjuntos.length > 0)
    .flatMap(m => m.adjuntos);

  const puedeSalir = ['admin', 'gerencia', 'director_comercial', 'jefe_obra'].includes(currentUser?.role);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-80 p-0 flex flex-col" side="right">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="text-base">{conversacion.nombre || 'Conversación'}</SheetTitle>
          <p className="text-xs text-muted-foreground capitalize">{conversacion.tipo} · {participantes.length} participantes</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Cifrado */}
          {conversacion.cifrado_activo && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 text-green-600">
                <Shield className="w-4 h-4" />
                <span className="text-sm font-medium">Cifrado E2E activo</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Los mensajes están protegidos con RSA-OAEP + AES-256-GCM
              </p>
            </div>
          )}

          {/* Participantes */}
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Participantes</p>
            <div className="space-y-2">
              {participantes.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                    {(p.nombre_display || p.user_email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nombre_display || p.user_email}</p>
                    <p className="text-xs text-muted-foreground">{ROL_LABELS[p.rol] || p.rol}</p>
                  </div>
                  {p.user_email === conversacion.creado_por_email && (
                    <Badge variant="outline" className="text-[10px]">Admin</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Archivos compartidos */}
          {adjuntosTodos.length > 0 && (
            <div className="p-4 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Archivos ({adjuntosTodos.length})
              </p>
              <div className="space-y-2">
                {adjuntosTodos.slice(0, 10).map((adj, i) => (
                  <a
                    key={i}
                    href={adj.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-primary hover:underline"
                  >
                    <Paperclip className="w-3 h-3 shrink-0" />
                    <span className="truncate">{adj.nombre}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="p-4 space-y-2">
            {puedeSalir && onSalir && (
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={onSalir}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Salir de la conversación
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}