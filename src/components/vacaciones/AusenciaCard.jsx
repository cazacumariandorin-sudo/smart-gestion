import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Calendar, Check, X, Pencil, Trash2, Loader2, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
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

export default function AusenciaCard({ v, onApprove, onDelete, onEdit }) {
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ ...v });

  const cfg = tipoCfg[v.tipo];

  const handleEditSave = () => {
    onEdit(v.id, editForm);
    setEditMode(false);
  };

  if (editMode) {
    return (
      <Card className="p-4 border-2 border-primary">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <MobileSelect value={editForm.tipo} onValueChange={val => setEditForm(p => ({ ...p, tipo: val }))}>
              {TIPOS.map(t => <MobileSelectItem key={t.key} value={t.key}>{t.label}</MobileSelectItem>)}
            </MobileSelect>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha inicio</Label>
              <Input type="date" value={editForm.fecha_inicio} onChange={e => setEditForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha fin</Label>
              <Input type="date" value={editForm.fecha_fin} min={editForm.fecha_inicio} onChange={e => setEditForm(p => ({ ...p, fecha_fin: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observaciones</Label>
            <Textarea value={editForm.notas} onChange={e => setEditForm(p => ({ ...p, notas: e.target.value }))} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditMode(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleEditSave} className="gap-1">
              <Save className="w-3.5 h-3.5" /> Guardar
            </Button>
          </DialogFooter>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 flex items-center gap-4">
      <div className={cn('w-3 h-3 rounded-full shrink-0', cfg?.color || 'bg-primary')} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{v.operario_name}</span>
          <Badge variant="outline" className={cn('text-[10px]', cfg?.light)}>{cfg?.label || v.tipo}</Badge>
          {v.aprobado && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">Aprobado</Badge>}
          {v.aprobado === false && <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">Pendiente</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          <Calendar className="w-3 h-3 inline mr-1" />
          {v.fecha_inicio} {v.fecha_fin && v.fecha_fin !== v.fecha_inicio ? `→ ${v.fecha_fin}` : ''} · {v.dias || 1} día(s)
        </p>
        {v.notas && <p className="text-xs text-muted-foreground truncate">{v.notas}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditMode(true)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => onApprove(v.id, !v.aprobado)}>
          {v.aprobado ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(v.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}