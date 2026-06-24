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
import { Lock, CheckCircle2, XCircle, Edit2, Trash2, FileText, Image, ExternalLink, Loader2, Save, UserCheck, CreditCard, Send } from 'lucide-react';
import VoiceInputButton from '@/components/ui/VoiceInputButton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/lib/useUserRole';
import { useAuth } from '@/lib/AuthContext';

const CATEGORIAS = ['material', 'combustible', 'peaje', 'parking', 'otros'];

const ESTADO_COLORS = {
  borrador: 'bg-slate-100 text-slate-600 border-slate-200',
  pendiente: 'bg-blue-50 text-blue-700 border-blue-200',
  aprobado_gerencia: 'bg-amber-50 text-amber-700 border-amber-200',
  en_administracion: 'bg-purple-50 text-purple-700 border-purple-200',
  pagada: 'bg-green-50 text-green-700 border-green-200',
  rechazada: 'bg-red-50 text-red-700 border-red-200',
  // legacy
  validada: 'bg-green-50 text-green-700 border-green-200',
  cerrada: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ESTADO_LABELS = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  aprobado_gerencia: 'Aprobado por gerencia',
  en_administracion: 'En administración',
  pagada: 'Pagada',
  rechazada: 'Rechazada',
  validada: 'Validada',
  cerrada: 'Cerrada',
};

export default function NotaGastoDetalle({ nota, isAdmin, open, onClose, operarios = [] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isAdmin: roleAdmin, isGerencia, isDirComercial } = useUserRole();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  // Estado para formulario de pago
  const [metodoPago, setMetodoPago] = useState('transferencia');
  const [importePago, setImportePago] = useState('');

  const canManage = roleAdmin || isGerencia || isDirComercial;
  const esPropioCreador = nota?.created_by === user?.email;

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['notas_gasto'] });
    qc.invalidateQueries({ queryKey: ['notas_gasto_check'] });
  };

  const cambiarEstado = async (nuevoEstado, extraData = {}) => {
    setLoading(true);
    try {
      await base44.entities.RegistroGasto.update(nota.id, { estado: nuevoEstado, ...extraData });
      toast.success(`Registro actualizado: ${ESTADO_LABELS[nuevoEstado] || nuevoEstado}`);
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
        const parts = nota.numero_nota?.split('-') || [];
        if (parts.length === 4) {
          const xx = String(datos.numero_secuencia).padStart(2, '0');
          datos.numero_nota = `NOT-${parts[1]}-${xx}-${parts[3]}`;
        }
      }
      await base44.entities.RegistroGasto.update(nota.id, datos);
      toast.success('Registro actualizado');
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
      await base44.entities.RegistroGasto.delete(nota.id);
      toast.success('Registro eliminado');
      invalidar();
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleRegistrarPago = () => {
    if (!importePago || isNaN(parseFloat(importePago))) {
      toast.error('Introduce un importe válido');
      return;
    }
    cambiarEstado('pagada', {
      pagado_por: user?.email,
      fecha_pago: new Date().toISOString(),
      metodo_pago: metodoPago,
      importe_pagado_real: parseFloat(importePago),
    });
  };

  if (!nota) return null;

  const puedeEditar = esPropioCreador
    ? nota.estado === 'borrador'
    : canManage || isAdmin;

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
    setImportePago(String(nota.importe || ''));
    setEditando(true);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-primary">{nota.numero_nota}</span>
            <Badge className={cn('text-xs border', ESTADO_COLORS[nota.estado] || 'bg-slate-100 text-slate-600')}>
              {ESTADO_LABELS[nota.estado] || nota.estado}
            </Badge>
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
                <div className="flex gap-1">
                  <Input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} />
                  <VoiceInputButton onResult={txt => setForm(f => ({ ...f, concepto: txt }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Comercio</Label>
                  <div className="flex gap-1">
                    <Input value={form.nombre_comercio} onChange={e => setForm(f => ({ ...f, nombre_comercio: e.target.value }))} />
                    <VoiceInputButton onResult={txt => setForm(f => ({ ...f, nombre_comercio: txt }))} />
                  </div>
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
                <div><span className="text-muted-foreground text-xs">Estado</span><p className="font-medium">{ESTADO_LABELS[nota.estado] || nota.estado}</p></div>
                <div><span className="text-muted-foreground text-xs">Categoría</span><p className="font-medium capitalize">{nota.categoria}</p></div>
                <div><span className="text-muted-foreground text-xs">Importe</span><p className={cn('font-bold text-base', nota.es_gasto_tardio && 'text-red-600')}>{(nota.importe || 0).toFixed(2)} €</p></div>
                <div><span className="text-muted-foreground text-xs">Comercio</span><p className="font-medium">{nota.nombre_comercio || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">NIF/CIF</span><p className="font-medium">{nota.nif_comercio || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Fecha doc.</span><p className="font-medium">{nota.fecha_documento || '—'}</p></div>
                <div><span className="text-muted-foreground text-xs">Obra</span><p className="font-medium">{nota.obra_name || '—'}</p></div>
              </div>
              {nota.concepto && <div><span className="text-muted-foreground text-xs">Concepto</span><p>{nota.concepto}</p></div>}
              {nota.notas_admin && <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 border border-amber-200"><span className="text-xs text-amber-700 font-semibold">Nota admin:</span><p className="text-xs mt-0.5">{nota.notas_admin}</p></div>}
              {nota.aprobado_por && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 border border-amber-200 text-xs">
                  <span className="font-semibold text-amber-700">Aprobado por:</span> {nota.aprobado_por}
                  {nota.fecha_aprobacion && <span className="ml-2 text-amber-600">{new Date(nota.fecha_aprobacion).toLocaleDateString('es-ES')}</span>}
                </div>
              )}
              {nota.pagado_por && (
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-2 border border-green-200 text-xs">
                  <span className="font-semibold text-green-700">Pagado por:</span> {nota.pagado_por}
                  {nota.importe_pagado_real && <span className="ml-2 font-bold">{nota.importe_pagado_real.toFixed(2)} €</span>}
                  {nota.metodo_pago && <span className="ml-2 capitalize">({nota.metodo_pago.replace('_', ' ')})</span>}
                </div>
              )}
              {nota.es_gasto_tardio && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-2 border border-red-200 text-xs text-red-700">
                  ⚠ Gasto tardío — creado el {nota.fecha_creacion_real}, fecha documento: {nota.fecha_documento}
                </div>
              )}
            </div>
          )}

          {/* Formulario de pago — solo admin cuando estado es en_administracion */}
          {!editando && roleAdmin && nota.estado === 'en_administracion' && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-200 space-y-3">
              <p className="text-xs font-semibold text-purple-700">Registrar pago</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Método de pago</Label>
                  <MobileSelect value={metodoPago} onValueChange={setMetodoPago}>
                    <MobileSelectItem value="transferencia">Transferencia</MobileSelectItem>
                    <MobileSelectItem value="efectivo">Efectivo</MobileSelectItem>
                    <MobileSelectItem value="tarjeta_empresa">Tarjeta empresa</MobileSelectItem>
                    <MobileSelectItem value="sepa">SEPA</MobileSelectItem>
                  </MobileSelect>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Importe pagado (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={importePago}
                    onChange={e => setImportePago(e.target.value)}
                  />
                </div>
              </div>
              <Button size="sm" className="w-full gap-1.5 bg-green-600 hover:bg-green-700" onClick={handleRegistrarPago} disabled={loading}>
                <CreditCard className="w-3.5 h-3.5" /> Registrar pago
              </Button>
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
              {puedeEditar && (
                <Button variant="outline" size="sm" onClick={startEdit} className="gap-1">
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </Button>
              )}

              {/* Aprobar gasto — gerencia, dir_comercial, admin — solo si pendiente */}
              {canManage && nota.estado === 'pendiente' && (
                <Button size="sm" variant="outline" className="gap-1 text-amber-700 border-amber-300" onClick={() => cambiarEstado('aprobado_gerencia', { aprobado_por: user?.email, fecha_aprobacion: new Date().toISOString() })} disabled={loading}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar gasto
                </Button>
              )}

              {/* Enviar a administración — solo admin cuando ya está aprobado */}
              {roleAdmin && nota.estado === 'aprobado_gerencia' && (
                <Button size="sm" variant="outline" className="gap-1 text-purple-700 border-purple-300" onClick={() => cambiarEstado('en_administracion')} disabled={loading}>
                  <Send className="w-3.5 h-3.5" /> Enviar a Administración
                </Button>
              )}

              {/* Rechazar — gerencia, dir_comercial, admin — excepto borrador y pagada */}
              {canManage && nota.estado !== 'borrador' && nota.estado !== 'pagada' && (
                <Button size="sm" variant="outline" className="gap-1 text-red-600 border-red-300" onClick={() => cambiarEstado('rechazada')} disabled={loading}>
                  <XCircle className="w-3.5 h-3.5" /> Rechazar
                </Button>
              )}

              {(isAdmin || (esPropioCreador && nota.estado === 'borrador')) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30">
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
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