import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Download, Trash2, FileText, Image, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const conceptoConfig = {
  gasolina: { label: '⛽ Gasolina', color: 'bg-orange-100 text-orange-700' },
  parking: { label: '🅿️ Parking', color: 'bg-blue-100 text-blue-700' },
  material: { label: '📦 Material', color: 'bg-purple-100 text-purple-700' },
  peaje: { label: '🛣️ Peaje', color: 'bg-cyan-100 text-cyan-700' },
  otro: { label: '📌 Otro', color: 'bg-gray-100 text-gray-700' },
};

const estadoConfig = {
  pendiente: { label: 'Pendiente', icon: Clock, color: 'text-amber-600' },
  aprobado: { label: 'Aprobado', icon: CheckCircle2, color: 'text-emerald-600' },
  rechazado: { label: 'Rechazado', icon: AlertCircle, color: 'text-red-600' },
};

export default function ListaNotasGastos({ notas, isLoading, onRefresh }) {
  const qc = useQueryClient();
  const [preview, setPreview] = useState(null);

  const deleteM = useMutation({
    mutationFn: id => base44.entities.NotaGastos.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas_gastos'] });
      toast.success('Nota eliminada');
    },
    onError: () => toast.error('Error al eliminar'),
  });

  if (isLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>;
  }

  if (notas.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed rounded-xl">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-3">No hay notas de gastos</p>
        <p className="text-xs text-muted-foreground">Crea una nueva nota para comenzar</p>
      </div>
    );
  }

  const total = notas.reduce((s, n) => s + (n.importe || 0), 0);

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total gastos</p>
            <p className="text-2xl font-bold text-primary">{total.toFixed(2)} €</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">{notas.length} notas</p>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {notas.map(nota => {
          const cfg = conceptoConfig[nota.concepto] || conceptoConfig.otro;
          const estado = estadoConfig[nota.estado] || estadoConfig.pendiente;
          const EstadoIcon = estado.icon;

          return (
            <Card key={nota.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="font-semibold text-sm">{nota.titulo}</h3>
                    <Badge className={cfg.color}>{cfg.label}</Badge>
                    <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                      <EstadoIcon className={`w-3 h-3 ${estado.color}`} />
                      {estado.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-2">
                    {nota.fecha && <span>{format(parseISO(nota.fecha), 'd MMM yyyy', { locale: es })}</span>}
                    {nota.proveedor && <span>📍 {nota.proveedor}</span>}
                    {nota.cif && <span>CIF: {nota.cif}</span>}
                  </div>

                  {nota.descripcion && <p className="text-xs text-muted-foreground mb-2">{nota.descripcion}</p>}

                  {nota.archivos && nota.archivos.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-muted-foreground">Archivos:</span>
                      <div className="flex gap-1">
                        {nota.archivos.map((a, i) => (
                          <button
                            key={i}
                            onClick={() => setPreview(a)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 hover:bg-muted text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {a.tipo === 'foto' ? <Image className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                            {a.nombre}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="text-lg font-bold text-primary">{nota.importe.toFixed(2)} €</p>
                  <div className="flex gap-1">
                    {nota.archivos?.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => {
                          const url = nota.archivos[0].url;
                          window.open(url, '_blank');
                        }}
                      >
                        <Download className="w-3 h-3" /> Ver
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar nota?</AlertDialogTitle>
                          <AlertDialogDescription>Se eliminará "{nota.titulo}" y todos sus archivos.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteM.mutate(nota.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Visor de archivos */}
      {preview && (
        <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{preview.nombre}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center max-h-[70vh] overflow-auto bg-muted rounded-lg">
              {preview.tipo === 'foto' ? (
                <img src={preview.url} alt={preview.nombre} className="max-w-full max-h-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-4 p-8">
                  <FileText className="w-16 h-16 text-muted-foreground" />
                  <a href={preview.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Descargar documento
                  </a>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}