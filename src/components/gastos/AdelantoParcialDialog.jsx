import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { useAuth } from '@/lib/AuthContext';
import { useUserRole } from '@/lib/useUserRole';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Loader2, FileSpreadsheet, Send, CreditCard, CheckCircle2, XCircle,
  Plus, AlertTriangle, Receipt, ArrowRight, Wallet,
} from 'lucide-react';

const ESTADO_LABELS = {
  borrador: 'Borrador',
  enviada: 'En contabilidad',
  pagada: 'Pagada',
  rechazada: 'Rechazada',
};

const ESTADO_COLORS = {
  borrador: 'bg-slate-100 text-slate-700 border-slate-200',
  enviada: 'bg-purple-50 text-purple-700 border-purple-200',
  pagada: 'bg-green-50 text-green-700 border-green-200',
  rechazada: 'bg-red-50 text-red-700 border-red-200',
};

// Registros aptos: aprobados / en administración (no pagados ni rechazados)
const APTOS_ESTADOS = ['aprobado_gerencia', 'en_administracion'];

export default function AdelantoParcialDialog({ nota, open, onClose }) {
  const { user } = useAuth();
  const { isAdmin, isGerencia, isDirComercial } = useUserRole();
  const qc = useQueryClient();
  const canManage = isAdmin || isGerencia || isDirComercial;

  const [seleccion, setSeleccion] = useState({});
  const [motivo, setMotivo] = useState('');
  const [notas, setNotas] = useState('');
  const [metodoPago, setMetodoPago] = useState('transferencia');
  const [creando, setCreando] = useState(false);
  const [actualizandoId, setActualizandoId] = useState(null);
  // Adelanto de liquidez (entrega de dinero al operario, no atada a gastos)
  const [liqImporte, setLiqImporte] = useState('');
  const [liqMotivo, setLiqMotivo] = useState('');
  const [liqFecha, setLiqFecha] = useState(new Date().toISOString().slice(0, 10));
  const [liqMetodo, setLiqMetodo] = useState('efectivo');
  const [creandoLiq, setCreandoLiq] = useState(false);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['adelantos_parciales', nota?.id] });
    qc.invalidateQueries({ queryKey: ['nota_mensual_gasto'] });
    qc.invalidateQueries({ queryKey: ['notas_gasto'] });
  };

  // Registros del ciclo (por nota_mensual_id o por ciclo_mes+operario_id)
  const { data: registrosCiclo = [], isLoading: loadingReg } = useQuery({
    queryKey: ['adelanto_registros', nota?.id],
    queryFn: async () => {
      let regs;
      if (nota?.id) {
        regs = await base44.entities.RegistroGasto.filter({ nota_mensual_id: nota.id });
      }
      if (!regs?.length && nota?.ciclo_mes && nota?.operario_id) {
        regs = await base44.entities.RegistroGasto.filter({
          ciclo_mes: nota.ciclo_mes,
          operario_id: nota.operario_id,
        });
      }
      return regs || [];
    },
    enabled: !!open && !!nota,
  });

  // Adelantos parciales existentes del ciclo (entidad AdelantoParcialCiclo)
  const { data: adelantos = [], isLoading: loadingAdel } = useQuery({
    queryKey: ['adelantos_parciales', nota?.id],
    queryFn: () => base44.entities.AdelantoParcialCiclo.filter({ nota_mensual_id: nota.id }),
    enabled: !!open && !!nota?.id,
  });

  // Adelantos reales del ciclo (entidad Adelanto, tipo=gastos, estados activos)
  // Estos son los adelantos entregados al técnico que se descuentan del neto a liquidar.
  const { data: adelantosReales = [] } = useQuery({
    queryKey: ['adelantos_reales_ciclo', nota?.ciclo_mes, nota?.operario_id],
    queryFn: () => base44.entities.Adelanto.filter({
      ciclo_mes: nota.ciclo_mes,
      operario_id: nota.operario_id,
    }),
    enabled: !!open && !!nota?.ciclo_mes && !!nota?.operario_id,
  });

  const adelantosRealesActivos = useMemo(() =>
    (adelantosReales || []).filter(a => a.tipo === 'gastos' &&
      ['entregado', 'justificado', 'parcialmente_justificado'].includes(a.estado)),
    [adelantosReales]);

  // IDs ya comprometidos en adelantos no rechazados (para no duplicar)
  const idsComprometidos = useMemo(() => {
    const set = new Set();
    for (const a of adelantos) {
      if (a.estado === 'rechazada') continue;
      for (const id of a.registros_ids || []) set.add(id);
    }
    return set;
  }, [adelantos]);

  const registrosAptos = useMemo(
    () => registrosCiclo
      .filter(r => APTOS_ESTADOS.includes(r.estado) && !idsComprometidos.has(r.id))
      .sort((a, b) => (a.fecha_documento || '').localeCompare(b.fecha_documento || '')),
    [registrosCiclo, idsComprometidos]
  );

  const importeSeleccionado = useMemo(
    () => Object.keys(seleccion)
      .filter(id => seleccion[id])
      .reduce((s, id) => s + (registrosAptos.find(r => r.id === id)?.importe || 0), 0),
    [seleccion, registrosAptos]
  );

  const seleccionCount = Object.values(seleccion).filter(Boolean).length;

  const toggle = (id) => setSeleccion(s => ({ ...s, [id]: !s[id] }));
  const toggleTodos = () => {
    const allSelected = registrosAptos.every(r => seleccion[r.id]);
    const next = {};
    if (!allSelected) registrosAptos.forEach(r => { next[r.id] = true; });
    setSeleccion(next);
  };

  const recalcAdelantoPadre = async () => {
    if (!nota?.id) return;
    // Recargar adelantos y sumar los pagados
    const todos = await base44.entities.AdelantoParcialCiclo.filter({ nota_mensual_id: nota.id });
    const adelantoPagado = todos
      .filter(a => a.estado === 'pagada')
      .reduce((s, a) => s + (a.importe || 0), 0);
    await base44.entities.NotaMensualGasto.update(nota.id, {
      importe_adelanto: Number(adelantoPagado.toFixed(2)),
      saldo_pendiente: Number(((nota.total_importe || 0) - adelantoPagado).toFixed(2)),
    });
  };

  const crearAdelanto = async () => {
    const ids = Object.keys(seleccion).filter(id => seleccion[id]);
    if (!ids.length) { toast.error('Selecciona al menos un registro aprobado'); return; }
    if (!motivo.trim()) { toast.error('Indica el motivo del adelanto parcial'); return; }
    setCreando(true);
    try {
      await base44.entities.AdelantoParcialCiclo.create({
        nota_mensual_id: nota.id,
        ciclo_mes: nota.ciclo_mes,
        numero_ciclo: nota.numero_ciclo,
        operario_id: nota.operario_id,
        operario_name: nota.operario_name,
        operario_email: nota.operario_email,
        registros_ids: ids,
        total_registros: ids.length,
        importe: Number(importeSeleccionado.toFixed(2)),
        fecha_creacion_real: new Date().toISOString().slice(0, 10),
        estado: 'borrador',
        motivo: motivo.trim(),
        notas: notas.trim() || undefined,
      });
      toast.success('Informe parcial creado');
      setSeleccion({});
      setMotivo('');
      setNotas('');
      invalidar();
    } catch (e) {
      toast.error(e.message || 'No se pudo crear el informe parcial');
    } finally {
      setCreando(false);
    }
  };

  const crearAdelantoLiquidez = async () => {
    const importe = parseFloat(liqImporte);
    if (!importe || isNaN(importe) || importe <= 0) { toast.error('Introduce un importe válido'); return; }
    if (!liqMotivo.trim()) { toast.error('Indica el motivo del adelanto de liquidez'); return; }
    setCreandoLiq(true);
    try {
      await base44.entities.AdelantoParcialCiclo.create({
        nota_mensual_id: nota.id,
        ciclo_mes: nota.ciclo_mes,
        numero_ciclo: nota.numero_ciclo,
        operario_id: nota.operario_id,
        operario_name: nota.operario_name,
        operario_email: nota.operario_email,
        registros_ids: [],
        total_registros: 0,
        importe: Number(importe.toFixed(2)),
        fecha_creacion_real: liqFecha,
        estado: 'pagada',
        motivo: liqMotivo.trim(),
        metodo_pago: liqMetodo,
        pagada_por: user?.email,
        fecha_pago: new Date().toISOString(),
        notas: 'Adelanto de liquidez entregado al operario antes del cierre del ciclo.',
      });
      toast.success('Adelanto de liquidez registrado');
      setLiqImporte('');
      setLiqMotivo('');
      setLiqFecha(new Date().toISOString().slice(0, 10));
      invalidar();
      await recalcAdelantoPadre();
      invalidar();
    } catch (e) {
      toast.error(e.message || 'No se pudo registrar el adelanto de liquidez');
    } finally {
      setCreandoLiq(false);
    }
  };

  const cambiarEstado = async (adelanto, nuevoEstado, extra = {}) => {
    setActualizandoId(adelanto.id);
    try {
      const patch = { estado: nuevoEstado, ...extra };
      if (nuevoEstado === 'enviada') {
        patch.enviada_por = user?.email;
        patch.fecha_envio = new Date().toISOString();
      } else if (nuevoEstado === 'pagada') {
        patch.pagada_por = user?.email;
        patch.fecha_pago = new Date().toISOString();
        patch.metodo_pago = extra.metodo_pago || metodoPago;
      }
      await base44.entities.AdelantoParcialCiclo.update(adelanto.id, patch);
      toast.success(`Adelanto marcado como ${ESTADO_LABELS[nuevoEstado]}`);
      invalidar();
      if (nuevoEstado === 'pagada') {
        await recalcAdelantoPadre();
        invalidar();
      }
    } catch (e) {
      toast.error(e.message || 'Error al actualizar el adelanto');
    } finally {
      setActualizandoId(null);
    }
  };

  if (!nota) return null;

  const totalAdelantosReales = adelantosRealesActivos.reduce((s, a) => s + (a.importe || 0), 0);
  const totalAdelantadoPagado = adelantos
    .filter(a => a.estado === 'pagada')
    .reduce((s, a) => s + (a.importe || 0), 0);
  const totalAdelantado = totalAdelantosReales + totalAdelantadoPagado;
  const totalCiclo = nota.total_importe || 0;
  const saldoCalculado = Math.max(0, totalCiclo - totalAdelantado);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Informe parcial de ciclo
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {nota.ciclo_mes}
            </span>
            <span className="font-medium text-sm">{nota.operario_name || '—'}</span>
          </DialogTitle>
          {nota.numero_ciclo && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <span className="font-semibold text-primary">ID nota:</span>
              <span className="font-mono font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {nota.numero_ciclo}
              </span>
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumen del ciclo — valores en vivo */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border p-2">
              <p className="text-[10px] uppercase text-muted-foreground">Total ciclo</p>
              <p className="font-bold text-sm">{totalCiclo.toFixed(2)} €</p>
            </div>
            <div className="rounded-lg border p-2 bg-green-50 dark:bg-green-950/20">
              <p className="text-[10px] uppercase text-muted-foreground">Adelantado</p>
              <p className="font-bold text-sm text-green-700">{totalAdelantado.toFixed(2)} €</p>
            </div>
            <div className="rounded-lg border p-2 bg-amber-50 dark:bg-amber-950/20">
              <p className="text-[10px] uppercase text-muted-foreground">Saldo</p>
              <p className="font-bold text-sm text-amber-700">{saldoCalculado.toFixed(2)} €</p>
            </div>
          </div>

          {/* Adelantos reales entregados al técnico (entidad Adelanto, tipo=gastos) */}
          {adelantosRealesActivos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-amber-700 uppercase flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Adelantos del ciclo ({adelantosRealesActivos.length})
              </p>
              {adelantosRealesActivos.map(a => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.concepto || 'Adelanto'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {a.fecha_entrega || '—'} · {a.estado}
                    </p>
                  </div>
                  <span className="font-semibold text-amber-700 shrink-0">{(a.importe || 0).toFixed(2)} €</span>
                </div>
              ))}
            </div>
          )}

          {/* Adelantos existentes */}
          {adelantos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Informes parciales existentes</p>
              {adelantos.map(a => (
                <div key={a.id} className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn('text-xs', ESTADO_COLORS[a.estado])}>
                          {ESTADO_LABELS[a.estado]}
                        </Badge>
                        {(a.total_registros || 0) === 0 && (
                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 gap-1">
                            <Wallet className="w-3 h-3" /> Liquidez
                          </Badge>
                        )}
                        <span className="text-sm font-semibold">{(a.importe || 0).toFixed(2)} €</span>
                        {(a.total_registros || 0) > 0 && <span className="text-xs text-muted-foreground">{a.total_registros} reg.</span>}
                      </div>
                      {a.motivo && <p className="text-xs text-muted-foreground mt-0.5 truncate">{a.motivo}</p>}
                    </div>
                    {canManage && a.estado !== 'pagada' && a.estado !== 'rechazada' && (
                      <div className="flex gap-1.5 shrink-0">
                        {a.estado === 'borrador' && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={actualizandoId === a.id}
                            onClick={() => cambiarEstado(a, 'enviada')}>
                            {actualizandoId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                            Enviar
                          </Button>
                        )}
                        {a.estado === 'enviada' && (
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-green-300 text-green-700" disabled={actualizandoId === a.id}
                            onClick={() => cambiarEstado(a, 'pagada')}>
                            {actualizandoId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
                            Pagar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" disabled={actualizandoId === a.id}
                          onClick={() => cambiarEstado(a, 'rechazada')}>
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {canManage && (
            <>
              {/* Adelanto de liquidez — entrega de dinero al operario, no atada a gastos */}
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-blue-600" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Adelanto de liquidez</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Registra una entrega de dinero al operario antes del cierre del ciclo. Se descuenta del saldo para saber si la empresa debe al trabajador o el trabajador a la empresa.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <Label className="text-[10px]">Importe (€) *</Label>
                    <Input type="number" step="0.01" value={liqImporte} onChange={e => setLiqImporte(e.target.value)} placeholder="0.00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Fecha</Label>
                    <Input type="date" value={liqFecha} onChange={e => setLiqFecha(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px]">Método</Label>
                    <MobileSelect value={liqMetodo} onValueChange={setLiqMetodo}>
                      <MobileSelectItem value="efectivo">Efectivo</MobileSelectItem>
                      <MobileSelectItem value="transferencia">Transferencia</MobileSelectItem>
                      <MobileSelectItem value="tarjeta_empresa">Tarjeta empresa</MobileSelectItem>
                      <MobileSelectItem value="sepa">SEPA</MobileSelectItem>
                    </MobileSelect>
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <Label className="text-[10px]">Motivo *</Label>
                    <Input value={liqMotivo} onChange={e => setLiqMotivo(e.target.value)} placeholder="Ej: anticipo de liquidez" />
                  </div>
                </div>
                <Button onClick={crearAdelantoLiquidez} disabled={creandoLiq || !liqImporte || !liqMotivo.trim()} className="gap-1.5 w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                  {creandoLiq ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                  Registrar adelanto de liquidez
                </Button>
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Crear nuevo informe parcial
                  </p>
                  {registrosAptos.length > 0 && (
                    <button onClick={toggleTodos} className="text-xs text-primary font-medium hover:underline">
                      {registrosAptos.every(r => seleccion[r.id]) ? 'Quitar todos' : 'Seleccionar todos'}
                    </button>
                  )}
                </div>

                {loadingReg || loadingAdel ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando registros del ciclo…
                  </div>
                ) : registrosAptos.length === 0 ? (
                  <div className="text-center py-6 border border-dashed rounded-xl text-sm text-muted-foreground">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No hay registros aprobados pendientes de adelanto en este ciclo.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {registrosAptos.map(r => (
                      <label key={r.id} className={cn(
                        'flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors',
                        seleccion[r.id] ? 'bg-primary/5 border-primary/40' : 'hover:bg-accent/40'
                      )}>
                        <input type="checkbox" checked={!!seleccion[r.id]} onChange={() => toggle(r.id)} className="w-4 h-4 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {r.numero_nota || r.nombre_comercio || 'Registro'} · {r.nombre_comercio || '—'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {r.fecha_documento || '—'} · {r.categoria || '—'} · {r.obra_name || '—'}
                          </p>
                        </div>
                        <span className="text-sm font-semibold shrink-0">{(r.importe || 0).toFixed(2)} €</span>
                      </label>
                    ))}
                  </div>
                )}

                {seleccionCount > 0 && (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                    <span className="text-xs font-medium text-primary">{seleccionCount} registro{seleccionCount !== 1 ? 's' : ''} seleccionado{seleccionCount !== 1 ? 's' : ''}</span>
                    <span className="text-sm font-bold">{importeSeleccionado.toFixed(2)} €</span>
                  </div>
                )}

                <div className="grid gap-2 mt-3">
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" /> Motivo del adelanto (fortuito) *
                    </Label>
                    <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: necesidad de liquidez del operario antes del cierre" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notas (opcional)</Label>
                    <Textarea rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones internas…" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {canManage && (
            <Button onClick={crearAdelanto} disabled={creando || seleccionCount === 0 || !motivo.trim()} className="gap-1.5">
              {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Crear informe parcial ({importeSeleccionado.toFixed(2)} €)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}