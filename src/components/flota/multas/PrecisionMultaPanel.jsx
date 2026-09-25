/**
 * PrecisionMultaPanel — Ciclo de precisión para multas de vehículo.
 *
 * Réplica de PrecisionCicloPanel (Económico/Contabilidad) adaptada a
 * MultaVehiculo. Permite a gerencia/administración re-analizar los volantes
 * de multas existentes en un periodo, re-ejecutando el OCR sobre el archivo
 * guardado para extraer campos que no se obtuvieron en la primera lectura
 * (hora, lugar, NIF autoridad, expediente, matrícula...). Devuelve propuestas
 * que el usuario revisa y aplica selectivamente.
 *
 * Acceso: gerencia, administracion, admin, propietario.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, SearchCheck, AlertTriangle, CheckCircle2, RefreshCw, Sparkles, ScanLine, Clock, MapPin, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { MOTIVO_AUTORIDAD, estadoLabel, estadoColor } from './multaConstants';

export default function PrecisionMultaPanel({ vehiculos = [] }) {
  const { isGerencia, isAdministracion, isAdmin } = useUserRole();
  const qc = useQueryClient();
  const puede = isGerencia || isAdministracion || isAdmin;

  const hoy = new Date().toISOString().slice(0, 10);
  const hace90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [inicio, setInicio] = useState(hace90);
  const [fin, setFin] = useState(hoy);
  const [vehiculoFiltro, setVehiculoFiltro] = useState('');
  const [analizando, setAnalizando] = useState(false);
  const [candidatos, setCandidatos] = useState([]);
  const [seleccion, setSeleccion] = useState({});
  const [aplicando, setAplicando] = useState(false);
  const [resumen, setResumen] = useState(null);

  const analizar = async () => {
    if (!puede) { toast.error('Sin permiso'); return; }
    if (!inicio || !fin) { toast.error('Indica el periodo'); return; }
    setAnalizando(true);
    setCandidatos([]);
    setSeleccion({});
    setResumen(null);
    try {
      const res = await base44.functions.invoke('precisionMulta', {
        inicio,
        fin,
        vehiculo_id: vehiculoFiltro || undefined,
      });
      const data = res?.data || res;
      if (data?.success === false) throw new Error(data?.error || 'Error');
      setCandidatos(data.candidatos || []);
      const sel = {};
      (data.candidatos || []).forEach(c => { if (c.estado === 'discrepancia') sel[c.id] = true; });
      setSeleccion(sel);
      setResumen({ discrepancias: data.discrepancias, confirmados: data.confirmados, total: data.total_candidatos, has_more: data.has_more });
      if (!data.candidatos?.length) toast.info(data.mensaje || 'Sin candidatos');
      else toast.success(`${data.discrepancias} con propuestas, ${data.confirmados} confirmados`);
    } catch (e) {
      toast.error(`Error: ${e?.message || 'No se pudo analizar'}`);
    } finally {
      setAnalizando(false);
    }
  };

  const toggle = (id) => setSeleccion(s => ({ ...s, [id]: !s[id] }));

  const aplicarSeleccionados = async () => {
    const seleccionados = candidatos.filter(c => c.estado === 'discrepancia' && seleccion[c.id] && c.datos_propuestos);
    if (!seleccionados.length) { toast.error('Selecciona al menos un candidato con propuestas'); return; }
    setAplicando(true);
    try {
      const now = new Date().toISOString();
      const updates = seleccionados.map(c => {
        const d = c.datos_propuestos;
        const fields = {};
        c.diffs.forEach(diff => {
          if (diff.campo === 'importe') fields.importe = Number(d.importe);
          else if (diff.campo === 'fecha_multa') fields.fecha_multa = d.fecha_multa;
          else fields[diff.campo] = d[diff.campo];
        });
        // Actualizar también los datos OCR crudos y la confianza
        fields.volante_ocr_datos = d;
        if (typeof d.confianza === 'number') fields.volante_ocr_confianza = d.confianza;
        fields.volante_ocr_procesado = true;
        fields.volante_precision_fecha = now;
        fields.volante_precision_revisado_por = 'precision_ciclo';
        return { id: c.id, ...fields };
      });
      await base44.entities.MultaVehiculo.bulkUpdate(updates);
      const appliedIds = new Set(seleccionados.map(c => c.id));
      setCandidatos(cs => cs.map(c => appliedIds.has(c.id) ? { ...c, estado: 'aplicado' } : c));
      setSeleccion({});
      qc.invalidateQueries({ queryKey: ['multas-vehiculo'] });
      toast.success(`${updates.length} multa(s) actualizadas`);
    } catch (e) {
      toast.error(`Error al aplicar: ${e?.message || 'fallo'}`);
    } finally {
      setAplicando(false);
    }
  };

  if (!puede) {
    return <Card className="p-8 text-center text-muted-foreground text-sm">Solo gerencia, administración o admin pueden ejecutar la precisión de multas.</Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <SearchCheck className="w-4 h-4 text-primary" />
          <span className="font-medium">Precisión OCR de multas — re-análisis de volantes</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Re-examina las multas del periodo con campos clave faltantes (hora, lugar, NIF autoridad, expediente, matrícula...) ejecutando el OCR de nuevo sobre el volante guardado. Devuelve propuestas de relleno/corrección; tú decides cuáles aplicar. Cada multa analizada queda marcada como revisada, aunque el volante no tenga esos datos, para no repetirla en el próximo análisis.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Desde</Label>
            <Input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Hasta</Label>
            <Input type="date" value={fin} onChange={e => setFin(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vehículo (opcional)</Label>
            <MobileSelect value={vehiculoFiltro} onValueChange={setVehiculoFiltro} placeholder="Todos" triggerClassName="w-48">
              <MobileSelectItem value="">Todos</MobileSelectItem>
              {vehiculos.map(v => (
                <MobileSelectItem key={v.id} value={v.id}>{v.matricula} — {v.modelo}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>
          <Button onClick={analizar} disabled={analizando} className="gap-2">
            {analizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analizando ? 'Analizando…' : 'Analizar multas'}
          </Button>
        </div>
      </Card>

      {resumen && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-muted-foreground">{resumen.total} multas analizadas</span>
          <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {resumen.discrepancias} con propuestas</span>
          <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {resumen.confirmados} confirmados</span>
          {resumen.has_more && <span className="text-xs text-muted-foreground">· quedan más (límite 20 por ejecución — vuelve a analizar)</span>}
        </div>
      )}

      {candidatos.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Marca los candidatos cuyas propuestas quieras aplicar. Los confirmados/sin-dato no se aplican.</p>
            <Button onClick={aplicarSeleccionados} disabled={aplicando || !Object.values(seleccion).some(Boolean)} size="sm" className="gap-2">
              {aplicando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {aplicando ? 'Aplicando…' : 'Aplicar seleccionados'}
            </Button>
          </div>
          <div className="space-y-2">
            {candidatos.map(c => (
              <Card key={c.id} className="p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {c.estado === 'discrepancia' && (
                    <Checkbox checked={!!seleccion[c.id]} onCheckedChange={() => toggle(c.id)} />
                  )}
                  <span className="font-mono text-xs font-bold text-primary tracking-widest">{c.vehiculo_matricula || '—'}</span>
                  <span className="text-sm font-medium">{c.autoridad || '—'}</span>
                  <span className="text-xs text-muted-foreground">{c.fecha_multa} · {(c.importe || 0).toFixed(2)} €</span>
                  {c.estado === 'discrepancia' && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200"><AlertTriangle className="w-3 h-3 mr-1" />Propuestas</Badge>}
                  {c.estado === 'confirmado' && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />Confirmado</Badge>}
                  {c.estado === 'error' && <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">Error OCR</Badge>}
                  {c.estado === 'aplicado' && <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200"><CheckCircle2 className="w-3 h-3 mr-1" />Aplicado</Badge>}
                </div>
                {c.estado === 'discrepancia' && c.diffs?.length > 0 && (
                  <div className="pl-7 space-y-1">
                    {c.diffs.map((d, i) => (
                      <div key={i} className="text-xs flex items-center gap-2">
                        <span className="font-medium text-muted-foreground w-36 shrink-0">{d.campo}</span>
                        <span className="line-through text-muted-foreground">{d.actual}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-primary font-medium">{d.propuesto}</span>
                      </div>
                    ))}
                  </div>
                )}
                {c.estado === 'error' && <p className="pl-7 text-xs text-red-600">{c.error}</p>}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}