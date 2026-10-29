import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Calendar, Clock, FileText, Pencil, Trash2, Save, Check, X, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  TIPOS_VACACION, TIPOS_FALTA, ESTADOS_FALTA, cfgRegistro, cfgEstadoFalta, diasEntre,
} from '@/lib/ausenciasCatalogo';

const fmt = (f) => (f ? format(parseISO(f), 'd MMM yyyy', { locale: es }) : '—');

/** Detalle editable de las ausencias y faltas de un día del calendario. */
export default function OperarioDetalleDialog({
  open, onOpenChange, fecha, registros = [], isOperario = false,
  onEditVacacion, onDeleteVacacion, onApproveVacacion, onEditFalta, onDeleteFalta,
}) {
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const startEdit = (reg) => {
    setEditId(`${reg.source}_${reg.id}`);
    setEditForm({
      tipo: reg.tipo || '',
      fecha_inicio: reg.fecha_inicio || '',
      fecha_fin: reg.fecha_fin || reg.fecha_inicio || '',
      texto: (reg.source === 'falta' ? reg.observaciones : reg.notas) || '',
      estado: reg.estado || 'pendiente_revision',
    });
  };

  const cancelEdit = () => { setEditId(null); setEditForm(null); };

  const saveEdit = (reg) => {
    const fin = editForm.fecha_fin && editForm.fecha_fin >= editForm.fecha_inicio
      ? editForm.fecha_fin : editForm.fecha_inicio;
    const dias = diasEntre(editForm.fecha_inicio, fin);

    if (reg.source === 'falta') {
      onEditFalta?.(reg.id, {
        tipo: editForm.tipo, fecha_inicio: editForm.fecha_inicio, fecha_fin: fin,
        dias, observaciones: editForm.texto, estado: editForm.estado,
      });
    } else {
      onEditVacacion?.(reg.id, {
        tipo: editForm.tipo, fecha_inicio: editForm.fecha_inicio, fecha_fin: fin,
        dias, notas: editForm.texto,
      });
    }
    cancelEdit();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) cancelEdit(); onOpenChange?.(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {fecha ? format(parseISO(fecha), "EEEE d 'de' MMMM yyyy", { locale: es }) : 'Detalle del día'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {registros.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Sin registros para este día</p>
          )}

          {registros.map((reg) => {
            const key = `${reg.source}_${reg.id}`;
            const cfg = cfgRegistro(reg);
            const editing = editId === key;
            const tipos = reg.source === 'falta' ? TIPOS_FALTA : TIPOS_VACACION;
            const dias = reg.dias || diasEntre(reg.fecha_inicio, reg.fecha_fin);

            if (editing) {
              return (
                <Card key={key} className="p-3 border-2 border-primary space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold truncate">{reg.operario_name}</p>
                    <Badge variant="outline" className={cn('text-[10px]', cfg.light)}>
                      {reg.source === 'falta' ? 'Falta' : 'Ausencia'}
                    </Badge>
                  </div>

                  <MobileSelect value={editForm.tipo} onValueChange={v => setEditForm(p => ({ ...p, tipo: v }))}>
                    {tipos.map(t => <MobileSelectItem key={t.key} value={t.key}>{t.label}</MobileSelectItem>)}
                  </MobileSelect>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Fecha inicio</Label>
                      <Input type="date" value={editForm.fecha_inicio} onChange={e => setEditForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Fecha fin</Label>
                      <Input type="date" value={editForm.fecha_fin} min={editForm.fecha_inicio} onChange={e => setEditForm(p => ({ ...p, fecha_fin: e.target.value }))} />
                    </div>
                  </div>

                  {reg.source === 'falta' && (
                    <div className="space-y-1">
                      <Label className="text-[11px]">Estado</Label>
                      <MobileSelect value={editForm.estado} onValueChange={v => setEditForm(p => ({ ...p, estado: v }))}>
                        {ESTADOS_FALTA.map(e => <MobileSelectItem key={e.key} value={e.key}>{e.label}</MobileSelectItem>)}
                      </MobileSelect>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-[11px]">{reg.source === 'falta' ? 'Observaciones' : 'Notas'}</Label>
                    <Textarea rows={2} value={editForm.texto} onChange={e => setEditForm(p => ({ ...p, texto: e.target.value }))} />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={cancelEdit} className="gap-1">
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </Button>
                    <Button size="sm" onClick={() => saveEdit(reg)} disabled={!editForm.fecha_inicio} className="gap-1">
                      <Save className="w-3.5 h-3.5" /> Guardar
                    </Button>
                  </div>
                </Card>
              );
            }

            return (
              <Card key={key} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', cfg.color)} />
                      <span className="font-semibold text-sm truncate">{reg.operario_name}</span>
                      <Badge variant="outline" className={cn('text-[10px]', cfg.light)}>{cfg.label}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{reg.source === 'falta' ? 'Falta' : 'Ausencia'}</Badge>
                      {reg.source === 'vacacion' && reg.aprobado && (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Aprobado</Badge>
                      )}
                      {reg.source === 'vacacion' && reg.aprobado === false && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">Pendiente</Badge>
                      )}
                      {reg.source === 'falta' && reg.estado && (
                        <Badge variant="outline" className="text-[10px]">{cfgEstadoFalta[reg.estado]?.label || reg.estado}</Badge>
                      )}
                      {reg.source === 'falta' && reg.tipo === 'ausencia_injustificada' && reg.gravedad && (
                        <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">
                          <AlertTriangle className="w-3 h-3 mr-1" /> {reg.gravedad}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {fmt(reg.fecha_inicio)}
                      {reg.fecha_fin && reg.fecha_fin !== reg.fecha_inicio && <span>→ {fmt(reg.fecha_fin)}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {dias} día(s)
                    </p>
                    {(reg.source === 'falta' ? reg.observaciones : reg.notas) && (
                      <p className="text-xs text-muted-foreground italic flex items-start gap-1 mt-1">
                        <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                        {reg.source === 'falta' ? reg.observaciones : reg.notas}
                      </p>
                    )}
                    {reg.source === 'falta' && reg.motivo_permiso && (
                      <p className="text-xs text-muted-foreground mt-1">Motivo: {reg.motivo_permiso}</p>
                    )}
                  </div>

                  {!isOperario && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(reg)} title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {reg.source === 'vacacion' && (
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-emerald-600"
                          onClick={() => onApproveVacacion?.(reg.id, !reg.aprobado)}
                          title={reg.aprobado ? 'Marcar pendiente' : 'Aprobar'}
                        >
                          {reg.aprobado ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Eliminar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará el registro de {reg.operario_name}. Esta acción no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground"
                              onClick={() => (reg.source === 'falta' ? onDeleteFalta?.(reg.id) : onDeleteVacacion?.(reg.id))}
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}