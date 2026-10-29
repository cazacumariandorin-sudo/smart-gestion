import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { ShieldCheck, RefreshCw, Download, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { useUserRole } from '@/lib/useUserRole';
import { rangoPeriodo, MESES_OPCIONES } from '@/lib/registroLegalConstantes';
import RegistrosLegalesTable from './RegistrosLegalesTable';

function descargarBase64(base64, filename) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function RegistroLegalTab() {
  const { isAdmin, isAdministracion } = useUserRole();
  const canManage = isAdmin || isAdministracion;
  const { toast } = useToast();

  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [trabajadorId, setTrabajadorId] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState('');

  const { desde, hasta } = rangoPeriodo(anio, mes);

  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios-legal'],
    queryFn: () => base44.entities.Operario.list('name', 500),
    enabled: canManage,
  });

  const { data: registros = [], isLoading, refetch } = useQuery({
    queryKey: ['registro-legal', desde, hasta, trabajadorId],
    queryFn: async () => {
      const q = { fecha: { $gte: desde, $lte: hasta } };
      if (trabajadorId) q.operario_id = trabajadorId;
      const page = await base44.entities.RegistroHorarioLegal.filter(q, { sort: '-fecha', limit: 500 });
      return page?.items || [];
    },
  });

  const resetFiltro = (setter, value) => { setter(value); setSelected(new Set()); setMotivo(''); };

  const toggle = (id) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleAll = () => setSelected((prev) => (
    prev.size === registros.length ? new Set() : new Set(registros.map((r) => r.id))
  ));

  const gestionar = async (action) => {
    setBusy(action);
    try {
      const res = await base44.functions.invoke('gestionRegistroHorarioLegal', { action, desde, hasta, trabajadorId: trabajadorId || undefined });
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      toast({ title: 'Registro provisional generado', description: `${d.creados || 0} nuevos · ${d.actualizados || 0} actualizados · ${d.omitidos || 0} omitidos` });
      setSelected(new Set());
      setMotivo('');
      await refetch();
    } catch (e) {
      toast({ title: 'No se pudo generar', description: e.message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const cambiarEstado = async (action) => {
    if (!selected.size) {
      toast({ title: 'Selecciona registros', variant: 'destructive' });
      return;
    }
    if (action !== 'validar' && !motivo.trim()) {
      toast({ title: 'Indica un motivo', description: 'El rechazo debe justificarse.', variant: 'destructive' });
      return;
    }
    setBusy(action);
    try {
      const res = await base44.functions.invoke('gestionRegistroHorarioLegal', { action, ids: [...selected], motivo });
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      toast({ title: action === 'validar' ? 'Validados como oficiales' : 'Registros rechazados', description: `${d.procesados || 0} procesados` });
      setSelected(new Set());
      setMotivo('');
      await refetch();
    } catch (e) {
      toast({ title: 'No se pudo actualizar', description: e.message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const exportar = async () => {
    setBusy('exportar');
    try {
      const res = await base44.functions.invoke('exportarRegistroLegal', { desde, hasta, trabajadorId: trabajadorId || undefined });
      const d = res.data || {};
      if (d.error) throw new Error(d.error);
      descargarBase64(d.base64, d.filename);
      toast({ title: 'Exportación legal generada', description: `${d.registros || 0} registros · ${d.historico || 0} meses de histórico · ${d.auditoria || 0} eventos` });
    } catch (e) {
      toast({ title: 'No se pudo exportar', description: e.message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const oficiales = registros.filter((r) => r.estado_legal === 'oficial' || r.estado_legal === 'validado_admin').length;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground">Registro legal oficial</p>
          {canManage ? (
            <p>Valida aquí la versión oficial. La exportación legal solo incluye registros <strong>oficiales</strong> en el detalle y los resúmenes, junto con la portada corporativa (datos de empresa y logo) y el <strong>histórico completo</strong> de todos los periodos. Un cierre forzado o automático llega como <em>provisional</em> y nunca es prueba legal hasta que administración lo valida.</p>
          ) : (
            <p className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Consulta de tus propios registros legales (solo lectura).</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <select
          value={anio}
          onChange={(e) => resetFiltro(setAnio, Number(e.target.value))}
          className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {[anioActual - 1, anioActual, anioActual + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={mes}
          onChange={(e) => resetFiltro(setMes, e.target.value === '' ? '' : Number(e.target.value))}
          className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Año completo</option>
          {MESES_OPCIONES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {canManage && (
          <select
            value={trabajadorId}
            onChange={(e) => resetFiltro(setTrabajadorId, e.target.value)}
            className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-sm col-span-2 sm:col-span-1"
          >
            <option value="">Todos los trabajadores</option>
            {operarios.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => gestionar('generar')} disabled={!!busy} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${busy === 'generar' ? 'animate-spin' : ''}`} /> Generar provisional
          </Button>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (obligatorio para rechazar)"
            className="h-9 max-w-[240px] text-xs"
          />
          <Button size="sm" onClick={() => cambiarEstado('validar')} disabled={!!busy || !selected.size} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" /> Validar ({selected.size})
          </Button>
          <Button size="sm" variant="outline" onClick={() => cambiarEstado('rechazar')} disabled={!!busy || !selected.size} className="gap-1.5 text-red-600 border-red-200">
            <XCircle className="w-3.5 h-3.5" /> Rechazar
          </Button>
          <Button size="sm" variant="secondary" onClick={exportar} disabled={!!busy || !oficiales} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Exportar legal
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{registros.length} registro{registros.length !== 1 ? 's' : ''} en el periodo</span>
        <span>{oficiales} oficial{oficiales !== 1 ? 'es' : ''}</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Cargando…</div>
      ) : registros.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <p className="text-sm font-medium">Sin registros legales en el periodo</p>
          <p className="text-xs text-muted-foreground mt-1">
            {canManage ? 'Pulsa «Generar provisional» para crear la versión legal desde los fichajes.' : 'Aún no hay registros para este periodo.'}
          </p>
        </div>
      ) : (
        <RegistrosLegalesTable
          registros={registros}
          selectable={canManage}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
        />
      )}
    </div>
  );
}