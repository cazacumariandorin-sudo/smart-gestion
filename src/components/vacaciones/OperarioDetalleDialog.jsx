import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Calendar, User, Clock, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const TIPOS = [
  { key: 'vacaciones', label: 'Vacaciones', color: 'bg-blue-500', light: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'baja_medica', label: 'Baja médica', color: 'bg-red-500', light: 'bg-red-100 text-red-700 border-red-200' },
  { key: 'dia_asunto_personal', label: 'Asunto personal', color: 'bg-purple-500', light: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'fiesta', label: 'Fiesta / festivo', color: 'bg-yellow-500', light: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { key: 'vacaciones_convenio', label: 'Vacaciones convenio', color: 'bg-emerald-500', light: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

const tipoCfg = Object.fromEntries(TIPOS.map(t => [t.key, t]));

export default function OperarioDetalleDialog({ open, onOpenChange, events }) {
  if (!events || events.length === 0) return null;

  const totalDias = events.reduce((sum, e) => sum + (e.dias || 1), 0);
  const firstEvent = events[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Detalle del Operario
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Header con nombre */}
          <Card className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
                {firstEvent.operario_name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-lg">{firstEvent.operario_name}</h3>
                <p className="text-sm text-muted-foreground">{events.length} registro(s) · {totalDias} día(s) total</p>
              </div>
            </div>
          </Card>

          {/* Lista de ausencias */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Ausencias registradas</h4>
            {events.map((ev, idx) => {
              const cfg = tipoCfg[ev.tipo];
              const dias = ev.dias || 1;
              return (
                <Card key={idx} className="p-3 border-l-4" style={{ borderLeftColor: cfg?.color?.replace('bg-', 'var(--') || '#000' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Badge className={cn('text-xs', cfg?.light)}>{cfg?.label || ev.tipo}</Badge>
                        {ev.aprobado && (
                          <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Aprobado
                          </Badge>
                        )}
                        {ev.aprobado === false && (
                          <Badge className="text-xs bg-red-100 text-red-700 border-red-200">
                            <XCircle className="w-3 h-3 mr-1" /> Pendiente
                          </Badge>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {format(parseISO(ev.fecha_inicio), 'd MMM yyyy', { locale: es })}
                            {ev.fecha_fin && ev.fecha_fin !== ev.fecha_inicio && (
                              <span> → {format(parseISO(ev.fecha_fin), 'd MMM yyyy', { locale: es })}</span>
                            )}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{dias} día(s)</span>
                        </div>

                        {ev.notas && (
                          <div className="flex items-start gap-2 text-muted-foreground mt-2">
                            <FileText className="w-3.5 h-3.5 mt-0.5" />
                            <span className="text-xs italic">{ev.notas}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}