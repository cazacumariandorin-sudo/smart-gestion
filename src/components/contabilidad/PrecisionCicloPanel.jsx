import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, SearchCheck, AlertTriangle, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ReconstruirMultiTicketTool from '@/components/contabilidad/ReconstruirMultiTicketTool';
// Normaliza para comparar lo esperado con lo guardado (ignora formato)
const normVerif = (campo, v) => {
  const s = v == null ? '' : String(v).trim();
  if (campo === 'importe') return Number.isFinite(Number(s)) && s !== '' ? Number(s).toFixed(2) : s;
  return s.toUpperCase().replace(/[\s\-_.:]/g, '');
};

// Vuelve a leer los registros y comprueba campo a campo que lo aplicado quedó guardado
async function verificarGuardado(updates) {
  const omitir = ['id', 'precision_revisado_por', 'precision_fecha', 'precision_modelo_usado'];
  try {
    const guardados = await base44.entities.RegistroGasto.filter({ id: { $in: updates.map((u) => u.id) } });
    const porId = new Map(guardados.map((r) => [r.id, r]));
    const fallos = [];
    for (const u of updates) {
      const r = porId.get(u.id);
      if (!r) { fallos.push({ id: u.id, campo: '(registro no encontrado)' }); continue; }
      for (const [campo, esperado] of Object.entries(u)) {
        if (omitir.includes(campo)) continue;
        if (normVerif(campo, r[campo]) !== normVerif(campo, esperado)) {
          fallos.push({ id: u.id, nota: r.numero_nota, campo, esperado, guardado: r[campo] ?? '' });
        }
      }
    }
    return { ok: fallos.length === 0, total: updates.length, fallos };
  } catch (error) {
    console.error('[Precisión] No se pudo verificar', error);
    return { ok: null, total: updates.length, fallos: [] };
  }
}

const MESES = [
  ['1', 'Enero'], ['2', 'Febrero'], ['3', 'Marzo'], ['4', 'Abril'], ['5', 'Mayo'], ['6', 'Junio'],
  ['7', 'Julio'], ['8', 'Agosto'], ['9', 'Septiembre'], ['10', 'Octubre'], ['11', 'Noviembre'], ['12', 'Diciembre'],
];

/**
 * Precisión de ciclo — re-examina TODOS los RegistroGasto del periodo (no solo
 * los marcados precisa_precision). Identifica candidatos con campos clave
 * faltantes, re-ejecuta OCR y devuelve propuestas. Gerencia/administración
 * revisa y aplica las correcciones seleccionadas.
 *
 * Componente único reutilizado en Contabilidad ("Precisión de ciclo", recibe
 * `rango` ya calculado por el selector compartido de esa página) y en Gestión
 * Gastos ("Precisión", sin `rango`: aquí el propio panel monta su selector
 * de mes/año) — antes eran dos implementaciones distintas con criterios
 * distintos; ahora es el mismo código y el mismo backend en los dos sitios.
 *
 * Acceso: gerencia, administracion, admin, propietario.
 */
export default function PrecisionCicloPanel({ rango: rangoProp }) {
  const { isGerencia, isAdministracion, isAdmin } = useUserRole();
  const qc = useQueryClient();
  const puede = isGerencia || isAdministracion || isAdmin;

  // Selector de mes/año propio, solo quando no se recibe `rango` por prop
  // (uso desde Gestión Gastos). Contabilidad sigue pasando su propio rango.
  const [selAnio, setSelAnio] = useState(() => String(new Date().getFullYear()));
  const [selMes, setSelMes] = useState(() => String(new Date().getMonth() + 1));
  const rangoPropio = useMemo(() => {
    const m = String(selMes).padStart(2, '0');
    return { inicio: `${selAnio}-${m}-01`, fin: `${selAnio}-${m}-31`, etiqueta: `${m}/${selAnio}` };
  }, [selAnio, selMes]);
  const rango = rangoProp || rangoPropio;

  const [categoria, setCategoria] = useState('');
  const [operarioId, setOperarioId] = useState('todos');
  const [operarios, setOperarios] = useState([]);
  const [analizando, setAnalizando] = useState(false);
  const [candidatos, setCandidatos] = useState([]);
  const [seleccion, setSeleccion] = useState({}); // { [id]: true }
  const [aplicando, setAplicando] = useState(false);
  const [verificacion, setVerificacion] = useState(null); // resultado de comprobar lo guardado
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    base44.entities.Operario.filter({ active: true }, 'name', 200).then(setOperarios).catch(() => setOperarios([]));
  }, []);

  const analizar = async () => {
    if (!puede) { toast.error('Sin permiso'); return; }
    setAnalizando(true);
    setCandidatos([]);
    setSeleccion({});
    setResumen(null);
    try {
      const res = await base44.functions.invoke('precisionCiclo', {
        inicio: rango.inicio,
        fin: rango.fin,
        categoria: categoria || undefined,
        operario_id: operarioId !== 'todos' ? operarioId : undefined,
      });
      const data = res?.data || res;
      if (data?.success === false) throw new Error(data?.error || 'Error');
      setCandidatos(data.candidatos || []);
      // Pre-seleccionar todos los de discrepancia
      const sel = {};
      (data.candidatos || []).forEach(c => { if (c.estado === 'discrepancia') sel[c.id] = true; });
      setSeleccion(sel);
      setResumen({ discrepancias: data.discrepancias, confirmados: data.confirmados, total: data.total_candidatos, has_more: data.has_more });
      if (data.aviso) toast.warning(data.aviso, { duration: 12000 });
      if (!data.candidatos?.length) toast.info(data.mensaje || 'Sin candidatos');
      else toast.success(`${data.discrepancias} con propuestas, ${data.confirmados} confirmados`);
    } catch (e) {
      toast.error(`Error: ${e?.response?.data?.error || e?.message || 'No se pudo analizar'}${e?.response?.data?.detalle ? ' — ' + e.response.data.detalle : ''}`, { duration: 12000 });
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
          // importe y fecha_documento como tipos nativos
          if (diff.campo === 'importe') fields.importe = Number(d.importe);
          else if (diff.campo === 'fecha_documento') fields.fecha_documento = d.fecha_documento;
                    else fields[diff.campo] = diff.propuesto; // el valor ya normalizado que se mostró al usuario
        });
        fields.precisa_precision = false;
        fields.precision_revisado_por = 'precisión_ciclo';
        fields.precision_fecha = now;
        fields.precision_modelo_usado = 'automatic';
        return { id: c.id, ...fields };
      });
      await base44.entities.RegistroGasto.bulkUpdate(updates);
      // Verificación: se vuelven a leer los registros y se comprueba que los valores quedaron guardados
      const verif = await verificarGuardado(updates);
      setVerificacion(verif);
      // Marcar en la UI como aplicados
      const appliedIds = new Set(seleccionados.map(c => c.id));
      setCandidatos(cs => cs.map(c => appliedIds.has(c.id) ? { ...c, estado: 'aplicado' } : c));
      setSeleccion({});
            // Refrescar TODAS las listas de gastos (la clave real es 'notas_gasto', con guion bajo:
      // antes se invalidaban claves que no existían y el formulario seguía mostrando datos antiguos)
      qc.invalidateQueries({
        predicate: (q) => /gasto|notas|conciliacion|fotos/i.test(String(q.queryKey?.[0] ?? '')),
      });
      if (verif.ok === false) toast.error(`Se guardó, pero ${verif.fallos.length} campo(s) no coinciden al releerlos. Revisa el aviso.`, { duration: 9000 });
      else toast.success(`${updates.length} registro(s) actualizados${verif.ok ? ' y verificados' : ''}`);
    } catch (e) {
      toast.error(`Error al aplicar: ${e?.response?.data?.error || e?.message || 'fallo'}`, { duration: 9000 });
    } finally {
      setAplicando(false);
    }
  };

  if (!puede) {
    return <Card className="p-8 text-center text-muted-foreground text-sm">Solo gerencia, administración o admin pueden ejecutar la precisión de ciclo.</Card>;
  }

  return (
    <div className="space-y-4">
      <ReconstruirMultiTicketTool />
            {verificacion && (
        <Card className={`p-3 text-xs ${verificacion.ok === false ? 'border-red-300 bg-red-50 text-red-800' : 'border-green-300 bg-green-50 text-green-800'}`}>
          {verificacion.ok === true && <>✔ Verificado en base de datos: {verificacion.total} registro(s) con los valores guardados.</>}
          {verificacion.ok === null && <>No se pudo releer para verificar. Abre un registro y comprueba los campos.</>}
          {verificacion.ok === false && (
            <>
              ✘ Hay {verificacion.fallos.length} campo(s) que no coinciden tras guardar:
              <ul className="mt-1 list-disc pl-4">
                {verificacion.fallos.slice(0, 8).map((f, i) => (
                  <li key={i}>{f.nota || f.id}: {f.campo} — esperado «{String(f.esperado ?? '')}», guardado «{String(f.guardado ?? '')}»</li>
                ))}
              </ul>
            </>
          )}
        </Card>
      )}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <SearchCheck className="w-4 h-4 text-primary" />
          <span className="font-medium">Precisión de ciclo — periodo {rango.etiqueta}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Re-examina los gastos del periodo con campos clave faltantes (numero de factura, NIF, localidad, código fiscal...) ejecutando el OCR de nuevo sobre el archivo guardado. Devuelve propuestas de relleno/corrección; tú decides cuáles aplicar. No toca los registros que ya están completos. Cada registro analizado queda marcado como revisado, aunque el documento no tenga esos datos, para no repetirlo en el próximo análisis.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          {!rangoProp && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Año</label>
                <Input type="number" min="2000" max="2100" value={selAnio} onChange={e => setSelAnio(e.target.value)} className="w-24" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Mes</label>
                <MobileSelect value={selMes} onValueChange={setSelMes} placeholder="Mes" triggerClassName="w-36">
                  {MESES.map(([v, l]) => <MobileSelectItem key={v} value={v}>{l}</MobileSelectItem>)}
                </MobileSelect>
              </div>
            </>
          )}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Técnico (opcional)</label>
            <MobileSelect value={operarioId} onValueChange={setOperarioId} placeholder="Todos" triggerClassName="w-48">
              <MobileSelectItem value="todos">Todos los técnicos</MobileSelectItem>
              {operarios.map(op => (
                <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Categoría (opcional)</label>
            <MobileSelect value={categoria} onValueChange={setCategoria} placeholder="Todas" triggerClassName="w-44">
              <MobileSelectItem value="">Todas</MobileSelectItem>
              <MobileSelectItem value="material">Material</MobileSelectItem>
              <MobileSelectItem value="combustible">Combustible</MobileSelectItem>
              <MobileSelectItem value="peaje">Peaje</MobileSelectItem>
              <MobileSelectItem value="parking">Parking</MobileSelectItem>
              <MobileSelectItem value="comida">Comida</MobileSelectItem>
              <MobileSelectItem value="otros">Otros</MobileSelectItem>
            </MobileSelect>
          </div>
          <Button onClick={analizar} disabled={analizando} className="gap-2">
            {analizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {analizando ? 'Analizando…' : 'Analizar ciclo'}
          </Button>
        </div>
      </Card>

      {resumen && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="text-muted-foreground">{resumen.total} candidatos analizados</span>
          <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {resumen.discrepancias} con propuestas</span>
          <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> {resumen.confirmados} confirmados</span>
          {resumen.has_more && <span className="text-xs text-muted-foreground">· quedan más (límite por ejecución: 20 — vuelve a analizar)</span>}
        </div>
      )}

      {candidatos.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Marca los candidatos cuyas propuestas quieras aplicar. Los confirmados/sin-dato no se aplican (no aportan cambios).</p>
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
                  <span className="font-mono text-xs font-bold text-primary">{c.numero_nota || '—'}</span>
                  <span className="text-sm font-medium">{c.nombre_comercio || '—'}</span>
                  {c.operario_name && <span className="text-[10px] text-muted-foreground">· {c.operario_name}</span>}
                  <span className="text-xs text-muted-foreground">{c.fecha_documento} · {(c.importe || 0).toFixed(2)} €</span>
                  {c.categoria && <Badge className="text-[10px] bg-slate-100 text-slate-600">{c.categoria}</Badge>}
                  {c.estado === 'discrepancia' && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200"><AlertTriangle className="w-3 h-3 mr-1" />Propuestas</Badge>}
                  {c.estado === 'confirmado' && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />Confirmado</Badge>}
                  {c.estado === 'error' && <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">Error OCR</Badge>}
                  {c.estado === 'aplicado' && <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200"><CheckCircle2 className="w-3 h-3 mr-1" />Aplicado</Badge>}
                </div>
                {c.estado === 'discrepancia' && c.diffs?.length > 0 && (
                  <div className="pl-7 space-y-1">
                    {c.diffs.map((d, i) => (
                      <div key={i} className="text-xs flex items-center gap-2">
                        <span className="font-medium text-muted-foreground w-40 shrink-0">{d.campo}</span>
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
