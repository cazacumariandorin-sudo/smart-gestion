import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Lock, CheckCircle2, XCircle, Edit2, Trash2, FileText, Image, ExternalLink, Loader2, Save, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIAS = ['material', 'combustible', 'peaje', 'parking', 'otros'];

export default function NotaGastoDetalle({ nota, isAdmin, open, onClose, operarios = [] }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);

  const cerrada = nota?.estado === 'cerrada';

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['notas_gasto'] });
    qc.invalidateQueries({ queryKey: ['notas_gasto_check'] });
  };

  const cambiarEstado = async (estado) => {
    setLoading(true);
    try {
      const extra = estado === 'cerrada' || estado === 'validada'
        ? { validado_por: (await base44.auth.me()).email, fecha_validacion: new Date().toISOString().split('T')[0] }
        : {};
      await base44.entities.NotaGasto.update(nota.id, { estado, ...extra });
      toast.success(`Nota ${estado}`);
      invalidar();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardar = async () => {
    setLoading(true);
    try {
      const datos = { ...form };
      if (isAdmin && datos.numero_secuencia !== undefined) {
        // Reconstruir numero_nota con nueva secuencia
        const parts = nota.numero_nota?.split('-') || [];
        if (parts.length === 4) {
          const xx = String(datos.numero_secuencia).padStart(2, '0');
          datos.numero_nota = `NOT-${parts[1]}-${xx}-${parts[3]}`;
        }
      }
      await base44.entities.NotaGasto.update(nota.id, datos);
      toast.success('Nota actualizada');
      invalidar();
      setEditando(false);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminar = async () => {
    try {
      await base44.entities.NotaGasto.delete(nota.id);
      toast.success('Nota eliminada');
      invalidar();
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!nota) return null;

  const startEdit = () => {
    setForm({
      concepto: nota.concepto || '',
      importe: nota.importe || '',
      nif_comercio: nota.nif_comercio || '',
      nombre_comercio: nota.nombre_comercio || '',
      fecha_documento: nota.fecha_documento || '',
      categoria: nota.categoria || '',
      notas_admin: nota.notas_admin || '',
      numero_secuencia: nota.numero_secuencia || '',
      operario_id: nota.operario_id || '',
      operario_name: nota.operario_name || '',
    });
    setEditando(true);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-primary">{nota.numero_nota}</span>
            {cerrada && <Lock className="w-4 h-4 text-blue-500" />}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info básica */}
          {editando ? (
            <div className="space-y-3">
              {isAdmin && operarios.length > 0 && (
                <div className="space-y-1 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Label className="text-xs flex items-center gap-1.5 text-blue-700 dark:text-blue-300">
                    <UserCheck className="w-3.5 h-3.5" /> Operario asignado
                  </Label>
                  <MobileSelect
                    value={form.operario_id}
                    onValueChange={v => {
                      const op = operarios.find(o => o.id === v);
                      setForm(f => ({ ...f, operario_id: v, operario_name: op?.name || f.operario_name }));
                    }}
                    placeholder="Seleccionar operario"
                  >
                    {operarios.filter(op => op.active !== false).map(op => (
                      <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>
                    ))}
                  </MobileSelect>
                </div>
              )}
              {isAdmin && (
                <div className="space-y-1">
                  <Label className="text-xs">Nº Secuencia (XX) — Solo admin</Label>
                  <Input type="number" value={form.numero_secuencia} onChange={e => setForm(f => ({ ...f, numero_secuencia: e.target.value }))} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Categoría</Label>
                  <MobileSelect value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))} placeholder="Categoría">
                    {CATEGORIAS.map(c => <MobileSelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MobileSelectItem>)}
                  </MobileSelect>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Importe (€)</Label>
                  <Input type="number" step="0.01" value={form.importe} onChange={e => setForm(f => ({ ...f, importe: parseFloat(e.target.value) }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Concepto</Label>
                <Input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Comercio</Label>
                  <Input value={form.nombre_comercio} onChange={e => setForm(f => ({ ...f, nombre_comercio: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">NIF/CIF</Label>
                  <Input value={form.nif_comercio} onChange={e => setForm(f => ({ ...f, nif_comercio: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha documento</Label>
                <Input type="date" value={form.fecha_documento} onChange={e => setForm(f => ({ ...f, fecha_documento: e.target.value }))} />
              </div>
              {isAdmin && (
                <div className="space-y-1">
                  <Label className="text-xs">Notas admin</Label>
                  <Input value={form.notas_admin} onChange={e => setForm(f => ({ ...f, notas_admin: e.target.value }))} />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div><span className="text-muted-foreground text-xs">Operario</span><p className="font-medium">{nota.operario_name}</p></div>
                <div><span className="text-muted-foreground text-xs">Estado</span><p className="font-medium capitalize">{nota.estado}</p></div>
                <div><span className="text-muted-foreground text-xs">Categoría</span><p className="font-medium capitalize">{nota.categoria}</p></div>
                <div><span className="text-muted-foreground text-xs">Importe</span><p className={cn('font-bold text-base', nota.es_gasto_tardio && 'text-red-600')}>{(nota.importe || 0).toFixed(2)} €</p></div>
                <div><span className="text-muted-foreground text-xs">Comercio</span><p className="font-medium">{nota.nombre_comercio || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">NIF/CIF</span><p className="font-medium">{nota.nif_comercio || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Fecha doc.</span><p className="font-medium">{nota.fecha_documento || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Obra</span><p className="font-medium">{nota.obra_name || '—'}</p></div>
              </div>
              {nota.concepto && <div><span className="text-muted-foreground text-xs">Concepto</span><p>{nota.concepto}</p></div>}
              {nota.notas_admin && <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 border border-amber-200"><span className="text-xs text-amber-700 font-semibold">Nota admin:</span><p className="text-xs mt-0.5">{nota.notas_admin}</p></div>}
              {nota.es_gasto_tardio && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-2 border border-red-200 text-xs text-red-700">
                  ⚠ Gasto tardío — creado el {nota.fecha_creacion_real}, fecha documento: {nota.fecha_documento}
                </div>
              )}
            </div>
          )}

          {/* Archivos */}
          {nota.archivos?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">ARCHIVOS ADJUNTOS ({nota.archivos.length})</p>
              <div className="space-y-1.5">
                {nota.archivos.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg border hover:bg-accent transition-colors text-sm"
                  >
                    {a.tipo?.startsWith('image/') ? <Image className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-slate-500" />}
                    <span className="flex-1 truncate">{a.nombre}</span>
                    <ExternalLink className="w-3 h-3 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {editando ? (
            <>
              <Button variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>
              <Button onClick={handleGuardar} disabled={loading} className="gap-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
              </Button>
            </>
          ) : (
            <>
              {!cerrada && (
                <Button variant="outline" size="sm" onClick={startEdit} className="gap-1">
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </Button>
              )}
              {isAdmin && nota.estado === 'pendiente' && (
                <>
                  <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-300" onClick={() => cambiarEstado('validada')} disabled={loading}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Validar
                  </Button>
                  <Button size="sm" className="gap-1 bg-blue-600 hover:bg-blue-700" onClick={() => cambiarEstado('cerrada')} disabled={loading}>
                    <Lock className="w-3.5 h-3.5" /> Cerrar
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-red-600 border-red-300" onClick={() => cambiarEstado('rechazada')} disabled={loading}>
                    <XCircle className="w-3.5 h-3.5" /> Rechazar
                  </Button>
                </>
              )}
              {(isAdmin || nota.estado === 'borrador') && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30">
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar nota?</AlertDialogTitle>
                      <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleEliminar} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}