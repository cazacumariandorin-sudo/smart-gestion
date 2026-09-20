import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CalendarClock, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

/**
 * Botón "Consolidar ciclo" — invoca `cerrarCicloGastosMensual` bajo demanda.
 *
 * Modos:
 *  - Definitivo (mes completo): consolida TODOS los gastos reembolsables del ciclo
 *    en la NotaMensualGasto (aditivo, nunca sobrescribe). Acotable a un operario.
 *  - Parcial (fecha de corte): crea un AdelantoParcialCiclo con los gastos reclamables
 *    hasta la fecha de corte, para adelantar liquidez. Requiere operario, fecha y motivo.
 *
 * Visible para admin/propietario/gerencia/administracion/director_comercial.
 */
export default function ConsolidarCicloButton({ ciclosDisponibles = [], operarios = [] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const [mesSel, setMesSel] = useState('');
  const [operarioSel, setOperarioSel] = useState('todos');
  const [tipoCierre, setTipoCierre] = useState('definitivo');
  const [fechaCorte, setFechaCorte] = useState('');
  const [motivo, setMotivo] = useState('');

  const mesEnCurso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const mesesOptions = useMemo(() => {
    const set = new Set([mesEnCurso, ...ciclosDisponibles]);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [mesEnCurso, ciclosDisponibles]);

  const mesAConsolidar = mesSel || mesEnCurso;
  const esMesEnCurso = mesAConsolidar === mesEnCurso;
  const esParcial = tipoCierre === 'parcial';

  const puedeEjecutar = useMemo(() => {
    if (esParcial) {
      return !!fechaCorte && !!motivo.trim() && operarioSel !== 'todos';
    }
    return true;
  }, [esParcial, fechaCorte, motivo, operarioSel]);

  const ejecutar = async () => {
    setEjecutando(true);
    setResultado(null);
    try {
      const payload = { ciclo_mes: mesAConsolidar, tipo_cierre: tipoCierre };
      if (operarioSel !== 'todos') payload.operario_id = operarioSel;
      if (esParcial) {
        payload.fecha_corte = fechaCorte;
        payload.motivo = motivo.trim();
      }
      const res = await base44.functions.invoke('cerrarCicloGastosMensual', payload);
      const data = res?.data?.success !== undefined ? res.data : res;
      if (!data || data.success === false) throw new Error(data?.error || 'Cierre fallido');
      setResultado(data);
      qc.invalidateQueries({ queryKey: ['nota_mensual_gasto'] });
      qc.invalidateQueries({ queryKey: ['notas_gasto'] });
      qc.invalidateQueries({ queryKey: ['adelanto_parcial_ciclo'] });
    } catch (e) {
      toast({
        title: 'No se pudo consolidar el ciclo',
        description: e?.message || 'Error desconocido',
        variant: 'destructive',
      });
      setOpen(false);
      setResultado(null);
    } finally {
      setEjecutando(false);
    }
  };

  const cerrar = () => {
    setOpen(false);
    setResultado(null);
    setMesSel('');
    setOperarioSel('todos');
    setTipoCierre('definitivo');
    setFechaCorte('');
    setMotivo('');
    if (resultado) {
      toast({
        title: resultado.tipoCierre === 'parcial' ? 'Cierre parcial creado' : 'Ciclo consolidado',
        description: resultado.message
          ? `${resultado.cicloMes}: ${resultado.message.toLowerCase()}`
          : `${resultado.cicloMes}: ${resultado.notas_creadas || 0} nota(s), ${(resultado.detalle || []).reduce((s, d) => s + d.registros, 0)} registro(s).`,
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!ejecutando) { setOpen(o); if (!o) cerrar(); } }}>
      <AlertDialogTrigger asChild>
        <Button variant="default" size="sm" className="gap-1.5">
          <CalendarClock className="w-4 h-4" />
          <span className="hidden sm:inline">Consolidar ciclo</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Consolidar ciclo de gastos</AlertDialogTitle>
          <AlertDialogDescription>
            Cierra el ciclo del mes seleccionado. El modo <strong>definitivo</strong> consolida todos los
            gastos reembolsables del mes (aditivo, no sobrescribe). El modo <strong>parcial</strong> crea
            un adelanto con los gastos hasta la fecha de corte, para adelantar liquidez.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-1 space-y-3">
          {/* Tipo de cierre */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block">Tipo de cierre</label>
            <MobileSelect value={tipoCierre} onValueChange={setTipoCierre} triggerClassName="w-full">
              <MobileSelectItem value="definitivo">Cierre definitivo (mes completo)</MobileSelectItem>
              <MobileSelectItem value="parcial">Cierre parcial (fecha de corte)</MobileSelectItem>
            </MobileSelect>
          </div>

          {/* Mes */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block">Mes a consolidar</label>
            <MobileSelect value={mesAConsolidar} onValueChange={setMesSel} triggerClassName="w-full">
              {mesesOptions.map(m => <MobileSelectItem key={m} value={m}>{m}</MobileSelectItem>)}
            </MobileSelect>
          </div>

          {/* Operario */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block">
              Operario {esParcial && <span className="text-destructive">*</span>}
            </label>
            <MobileSelect
              value={operarioSel}
              onValueChange={setOperarioSel}
              triggerClassName="w-full"
              disabled={esParcial && operarios.length === 0}
            >
              <MobileSelectItem value="todos">Todos los operarios{esParcial ? ' (no permitido en parcial)' : ''}</MobileSelectItem>
              {operarios.map(op => (
                <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>

          {/* Fecha de corte (sólo parcial) */}
          {esParcial && (
            <div>
              <label className="text-xs font-semibold mb-1.5 block">
                Fecha de corte <span className="text-destructive">*</span>
              </label>
              <Input
                type="date"
                value={fechaCorte}
                onChange={e => setFechaCorte(e.target.value)}
                className="w-full"
              />
            </div>
          )}

          {/* Motivo (sólo parcial) */}
          {esParcial && (
            <div>
              <label className="text-xs font-semibold mb-1.5 block">
                Motivo <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Motivo del adelanto de liquidez (ej. acumulación importante que el operario no puede sostener)"
                rows={2}
                className="w-full"
              />
            </div>
          )}

          {/* Aviso mes en curso */}
          {esMesEnCurso && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                El mes <strong>{mesAConsolidar}</strong> todavía está abierto. Es un cierre
                {esParcial ? ' parcial' : ' anticipado'}, distinto del cierre normal de fin de mes.
                {!esParcial && ' Confirma que quieres cerrar el mes completo antes de tiempo.'}
              </span>
            </div>
          )}
        </div>

        {resultado && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-green-800 mb-1">
              <CheckCircle2 className="w-4 h-4" />
              {resultado.message
                ? (resultado.tipoCierre === 'parcial' ? 'Cierre parcial' : 'Sin cambios')
                : `Consolidado · ${resultado.cicloMes}`}
            </div>
            {resultado.message ? (
              <p className="text-green-700">{resultado.message}{resultado.esMesEnCurso ? ' (mes en curso).' : '.'}</p>
            ) : resultado.tipoCierre === 'parcial' ? (
              <p className="text-green-700">
                {resultado.registros} registro(s) · {Number(resultado.importe).toFixed(2)} € hasta {resultado.fechaCorte}.
              </p>
            ) : (
              <div className="text-green-700 space-y-0.5">
                <p>{resultado.notas_creadas || 0} nota(s) creada(s)/actualizada(s).</p>
                {(resultado.detalle || []).map((d, i) => (
                  <p key={i} className="pl-2">
                    · {d.registros} registro(s) — total {Number(d.total).toFixed(2)} €
                    {d.adelantos > 0 && ` · adelantos ${Number(d.adelantos).toFixed(2)} €`}
                    {` · neto ${Number(d.neto).toFixed(2)} €`}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={ejecutando}>{resultado ? 'Cerrar' : 'Cancelar'}</AlertDialogCancel>
          {!resultado && (
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); ejecutar(); }}
              disabled={ejecutando || !puedeEjecutar}
            >
              {ejecutando
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Consolidando…</>
                : esParcial ? 'Crear cierre parcial' : 'Consolidar'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}