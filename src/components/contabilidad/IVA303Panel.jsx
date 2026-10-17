/**
 * IVA303Panel — control INTERNO del modelo 303 (IVA trimestral).
 * Estimación para comparar con lo que presenta la gestoría; no sirve para presentar.
 *  1. Calcula el trimestre (función calcularIVAPeriodo, solo lectura).
 *  2. Libro de facturas emitidas/recibidas (entidad FacturaIVA): alta manual e importación CSV.
 *  3. Conciliación con la gestoría (entidad DeclaracionPeriodo, modelo '303').
 * Las facturas de autónomos NO se copian al libro: el cálculo las lee de FacturaAutonomo.
 */
import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { parseNum, parseFecha } from '@/lib/ivaImport';
import ImportadorFacturasIVA from '@/components/contabilidad/ImportadorFacturasIVA';
import { Calculator, Plus, Trash2, Save, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

const fmt = (n) => (n ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const selectCls = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';

// ── Periodos ────────────────────────────────────────────────────────────
function opcionesTrimestre() {
  const hoy = new Date();
  let a = hoy.getFullYear();
  let q = Math.floor(hoy.getMonth() / 3) + 1;
  const out = [];
  for (let i = 0; i < 8; i++) {
    out.push(`${a}-T${q}`);
    q -= 1;
    if (q === 0) { q = 4; a -= 1; }
  }
  return out;
}
function rangoTrimestre(tri) {
  const [a, q] = tri.split('-T');
  const m0 = (parseInt(q) - 1) * 3 + 1;
  const ultimo = new Date(Date.UTC(parseInt(a), m0 + 2, 0)).getUTCDate();
  return {
    inicio: `${a}-${String(m0).padStart(2, '0')}-01`,
    fin: `${a}-${String(m0 + 2).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`,
  };
}

const FORM_VACIO = {
  tipo: 'recibida', fecha_factura: '', numero_factura: '', nif_contraparte: '', nombre_contraparte: '',
  base_imponible: '', tipo_iva: '21', inversion_sujeto_pasivo: false, deducible_pct: '100', tipo_justificante: 'completa',
};

export default function IVA303Panel() {
  const { isContabilidad, isAdministracion, isGerencia, isAdmin } = useUserRole();
  const puedeEditar = isContabilidad || isAdministracion || isGerencia || isAdmin;
  const puedeBorrar = isAdministracion || isGerencia || isAdmin;
  const qc = useQueryClient();

  const opciones = useMemo(opcionesTrimestre, []);
  const [trimestre, setTrimestre] = useState(opciones[1] || opciones[0]); // trimestre ya cerrado
  const [calculo, setCalculo] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [form, setForm] = useState(null);
  const [presentado, setPresentado] = useState('');
  const [notas, setNotas] = useState('');

  const { inicio, fin } = rangoTrimestre(trimestre);

  // Libro del periodo (paginado + filtro de fechas en cliente)
  const { data: libro = [], isLoading } = useQuery({
    queryKey: ['facturaIVA', trimestre],
    queryFn: async () => {
      const todas = [];
      for (let p = 0; p < 20; p++) {
        const lote = await base44.entities.FacturaIVA.list('fecha_factura', 500, p * 500);
        if (!Array.isArray(lote) || lote.length === 0) break;
        todas.push(...lote);
        if (lote.length < 500) break;
      }
      return todas.filter((f) => (f.fecha_factura || '').slice(0, 10) >= inicio && (f.fecha_factura || '').slice(0, 10) <= fin);
    },
  });

  // Conciliación guardada del periodo
  const { data: guardada } = useQuery({
    queryKey: ['declaracionPeriodo', '303', trimestre],
    queryFn: async () => {
      const r = await base44.entities.DeclaracionPeriodo.filter({ modelo: '303', periodo: trimestre }, '-created_date', 1);
      return r?.[0] || null;
    },
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['facturaIVA'] });
    setCalculo(null);
  };

  const calcular = async () => {
    setCalculando(true);
    try {
      const res = await base44.functions.invoke('calcularIVAPeriodo', { trimestre });
      const data = res?.data || res;
      if (!data?.ok) throw new Error(data?.error || 'Error al calcular');
      setCalculo(data);
    } catch (e) {
      toast.error(e.message || 'No se pudo calcular el 303');
    } finally {
      setCalculando(false);
    }
  };

  const guardarFactura = async () => {
    const base = parseNum(form.base_imponible);
    const fecha = parseFecha(form.fecha_factura);
    if (base == null || !fecha) { toast.error('Fecha y base imponible son obligatorias'); return; }
    const tipoIva = parseNum(form.tipo_iva) ?? 0;
    const cuota = r2((base * tipoIva) / 100);
    try {
      await base44.entities.FacturaIVA.create({
        tipo: form.tipo, fecha_factura: fecha, numero_factura: form.numero_factura,
        nif_contraparte: form.nif_contraparte.trim().toUpperCase(), nombre_contraparte: form.nombre_contraparte,
        base_imponible: base, tipo_iva: tipoIva, cuota_iva: cuota, total_factura: r2(base + cuota),
        inversion_sujeto_pasivo: form.inversion_sujeto_pasivo,
        deducible_pct: parseNum(form.deducible_pct) ?? 100,
        tipo_justificante: form.tipo_justificante, estado: 'borrador', origen: 'manual',
      });
      toast.success('Factura añadida al libro');
      setForm(null);
      refrescar();
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar');
    }
  };

  const revisarTodo = async () => {
    const pend = libro.filter((f) => f.estado === 'borrador');
    if (!pend.length || !window.confirm(`¿Marcar ${pend.length} fila(s) en borrador como revisadas?`)) return;
    try {
      for (let i = 0; i < pend.length; i += 10) await Promise.all(pend.slice(i, i + 10).map((f) => base44.entities.FacturaIVA.update(f.id, { estado: 'revisada' })));
      toast.success(`${pend.length} fila(s) marcadas como revisadas`);
      refrescar();
    } catch (e) {
      toast.error(e.message || 'No se pudieron actualizar todas');
    }
  };

  const cambiarEstado = async (f, estado) => {
    try { await base44.entities.FacturaIVA.update(f.id, { estado }); refrescar(); }
    catch (e) { toast.error(e.message || 'No se pudo actualizar'); }
  };
  const eliminar = async (f) => {
    if (!window.confirm('¿Eliminar esta fila del libro de IVA?')) return;
    try { await base44.entities.FacturaIVA.delete(f.id); refrescar(); }
    catch (e) { toast.error(e.message || 'No se pudo eliminar'); }
  };

  const guardarConciliacion = async () => {
    if (!calculo) { toast.error('Calcula primero el periodo'); return; }
    const pres = parseNum(presentado);
    const calculado = calculo.resultado.importe;
    const dif = pres == null ? null : r2(pres - calculado);
    const registro = {
      modelo: '303', periodo: trimestre, anio: parseInt(trimestre.slice(0, 4)),
      trimestre: parseInt(trimestre.slice(-1)),
      importe_calculado: calculado, importe_presentado: pres ?? undefined, diferencia: dif ?? undefined,
      estado: pres == null ? 'borrador' : Math.abs(dif) <= 1 ? 'conciliado' : 'con_diferencias',
      fecha_calculo: new Date().toISOString(), notas,
      detalle_json: JSON.stringify({ casillas: calculo.casillas, conteo: calculo.conteo, alertas: calculo.alertas.length }),
    };
    try {
      if (guardada?.id) await base44.entities.DeclaracionPeriodo.update(guardada.id, registro);
      else await base44.entities.DeclaracionPeriodo.create(registro);
      toast.success('Conciliación guardada');
      qc.invalidateQueries({ queryKey: ['declaracionPeriodo', '303', trimestre] });
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar');
    }
  };

  const c = calculo?.casillas;
  const filasCasillas = c ? [
    ['[01] Base 4%', c['01_base_4']], ['[03] Cuota 4%', c['03_cuota_4']],
    ['[04] Base 10%', c['04_base_10']], ['[06] Cuota 10%', c['06_cuota_10']],
    ['[07] Base 21%', c['07_base_21']], ['[09] Cuota 21%', c['09_cuota_21']],
    ['[12] Base inversión sujeto pasivo', c['12_base_isp']], ['[13] Cuota inversión sujeto pasivo', c['13_cuota_isp']],
    ['[27] TOTAL IVA DEVENGADO', c['27_total_devengado']],
    ['[28] Base IVA deducible', c['28_base_deducible']], ['[29] Cuota IVA deducible', c['29_cuota_deducible']],
    ['[45] TOTAL A DEDUCIR', c['45_total_a_deducir']],
    ['[46] RESULTADO (27 − 45)', c['46_resultado_regimen_general']],
  ] : [];

  return (
    <div className="space-y-4 pt-3">
      <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Estimación interna del 303 para control. No es una autoliquidación ni debe usarse para presentar. No incluye bienes de inversión, intracomunitarias, importaciones, recargo de equivalencia, prorrata ni compensaciones.</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <Label className="text-xs">Trimestre</Label>
          <select className={selectCls} value={trimestre} onChange={(e) => { setTrimestre(e.target.value); setCalculo(null); }}>
            {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <Button onClick={calcular} disabled={calculando} className="gap-1.5">
          <Calculator className="w-4 h-4" /> {calculando ? 'Calculando…' : 'Calcular 303'}
        </Button>
      </div>

      {calculo && (
        <>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Resultado estimado {trimestre}</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${calculo.resultado.tipo === 'a_ingresar' ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmt(Math.abs(calculo.resultado.importe))}
                <span className="text-sm font-normal ml-2 text-muted-foreground">
                  {calculo.resultado.tipo === 'a_ingresar' ? 'a ingresar' : calculo.resultado.tipo === 'a_compensar' ? 'a compensar' : ''}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {calculo.conteo.emitidas} emitidas · {calculo.conteo.recibidas} recibidas ({calculo.conteo.recibidas_libro} libro, {calculo.conteo.recibidas_autonomos} autónomos, {calculo.conteo.recibidas_gastos ?? 0} gastos de la app) · {calculo.conteo.con_isp} con inversión sujeto pasivo
              </p>
              <div className="mt-3 divide-y text-sm">
                {filasCasillas.map(([l, v]) => (
                  <div key={l} className={`flex justify-between py-1 ${l.includes('TOTAL') || l.includes('RESULTADO') ? 'font-semibold' : ''}`}>
                    <span>{l}</span><span>{fmt(v)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {calculo.alertas.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Alertas de datos ({calculo.alertas.length})</CardTitle></CardHeader>
              <CardContent className="space-y-1.5">
                {calculo.alertas.map((a, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    {a.nivel === 'error' ? <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      : a.nivel === 'aviso' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      : <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    <span>{a.texto}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {calculo.compras_app && calculo.compras_app.incluidos > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Compras de la app (IVA estimado)</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">La app guarda solo el importe con IVA, así que se aplica un tipo por categoría. Cuentan los gastos en estado: {calculo.compras_app.estados_incluidos.join(', ')}.</p>
                <div className="divide-y text-xs">
                  <div className="grid grid-cols-5 gap-1 py-1 font-medium text-muted-foreground">
                    <span>Categoría</span><span className="text-right">Nº</span><span className="text-right">Importe</span><span className="text-right">IVA est.</span><span className="text-right">Deducible</span>
                  </div>
                  {Object.entries(calculo.compras_app.por_categoria).map(([cat, v]) => (
                    <div key={cat} className="grid grid-cols-5 gap-1 py-1">
                      <span className="capitalize">{cat} <span className="text-muted-foreground">({v.tipoIva}%{v.deduciblePct < 100 ? `, ${v.deduciblePct}% ded.` : ''})</span></span>
                      <span className="text-right">{v.n}</span><span className="text-right">{fmt(v.importe)}</span><span className="text-right">{fmt(v.cuota)}</span><span className="text-right">{fmt(v.deducible)}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-5 gap-1 py-1 font-semibold">
                    <span>Total</span><span className="text-right">{calculo.compras_app.incluidos}</span><span className="text-right">{fmt(calculo.compras_app.importe_total)}</span><span className="text-right">{fmt(calculo.compras_app.cuota_estimada)}</span><span className="text-right">{fmt(calculo.compras_app.cuota_deducible)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Conciliación con la gestoría</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {guardada && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Guardado: presentado {guardada.importe_presentado != null ? fmt(guardada.importe_presentado) : '—'}
                  {guardada.diferencia != null ? ` · diferencia ${fmt(guardada.diferencia)}` : ''} · {guardada.estado}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Importe presentado por la gestoría (€)</Label>
                  <Input value={presentado} onChange={(e) => setPresentado(e.target.value)} placeholder="ej: 1234,56 (negativo si a compensar)" />
                </div>
                <div>
                  <Label className="text-xs">Notas / motivo de diferencias</Label>
                  <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
                </div>
              </div>
              {puedeEditar && <Button size="sm" onClick={guardarConciliacion} className="gap-1.5"><Save className="w-3.5 h-3.5" /> Guardar conciliación</Button>}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Libro de IVA {trimestre} ({libro.length})</CardTitle>
          {puedeEditar && (
            <div className="flex gap-1.5">
              {libro.some((f) => f.estado === 'borrador') && <Button size="sm" variant="outline" className="gap-1" onClick={revisarTodo}><CheckCircle2 className="w-3.5 h-3.5" /> Revisar todo</Button>}
              <Button size="sm" className="gap-1" onClick={() => setForm({ ...FORM_VACIO })}><Plus className="w-3.5 h-3.5" /> Factura</Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {puedeEditar && <ImportadorFacturasIVA onImportado={() => setCalculo(null)} />}

          {form && (
            <div className="space-y-2 rounded-md border p-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><Label className="text-xs">Tipo</Label>
                  <select className={selectCls} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    <option value="recibida">Recibida (compra)</option><option value="emitida">Emitida (venta)</option>
                  </select></div>
                <div><Label className="text-xs">Fecha</Label><Input type="date" value={form.fecha_factura} onChange={(e) => setForm({ ...form, fecha_factura: e.target.value })} /></div>
                <div><Label className="text-xs">Nº factura</Label><Input value={form.numero_factura} onChange={(e) => setForm({ ...form, numero_factura: e.target.value })} /></div>
                <div><Label className="text-xs">NIF</Label><Input value={form.nif_contraparte} onChange={(e) => setForm({ ...form, nif_contraparte: e.target.value })} /></div>
                <div className="col-span-2"><Label className="text-xs">Cliente / proveedor</Label><Input value={form.nombre_contraparte} onChange={(e) => setForm({ ...form, nombre_contraparte: e.target.value })} /></div>
                <div><Label className="text-xs">Base imponible</Label><Input value={form.base_imponible} onChange={(e) => setForm({ ...form, base_imponible: e.target.value })} /></div>
                <div><Label className="text-xs">Tipo IVA %</Label>
                  <select className={selectCls} value={form.tipo_iva} onChange={(e) => setForm({ ...form, tipo_iva: e.target.value })}>
                    {['21', '10', '4', '0'].map((t) => <option key={t} value={t}>{t}%</option>)}
                  </select></div>
                {form.tipo === 'recibida' && (
                  <>
                    <div><Label className="text-xs">Justificante</Label>
                      <select className={selectCls} value={form.tipo_justificante} onChange={(e) => setForm({ ...form, tipo_justificante: e.target.value })}>
                        <option value="completa">Factura completa</option><option value="simplificada">Simplificada</option><option value="otro">Otro</option>
                      </select></div>
                    <div><Label className="text-xs">% deducible</Label><Input value={form.deducible_pct} onChange={(e) => setForm({ ...form, deducible_pct: e.target.value })} /></div>
                    <label className="flex items-center gap-2 text-xs col-span-2 pt-5">
                      <input type="checkbox" checked={form.inversion_sujeto_pasivo} onChange={(e) => setForm({ ...form, inversion_sujeto_pasivo: e.target.checked })} />
                      Inversión del sujeto pasivo (subcontrata de obra)
                    </label>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={guardarFactura}>Guardar</Button>
                <Button size="sm" variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
              </div>
            </div>
          )}

          {isLoading ? <p className="text-xs text-muted-foreground">Cargando…</p>
            : libro.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Sin facturas en el libro para este trimestre. Las facturas de autónomos se incluyen automáticamente en el cálculo.</p>
            : (
              <div className="divide-y text-xs">
                {libro.map((f) => (
                  <div key={f.id} className={`flex items-center gap-2 py-1.5 ${f.estado === 'anulada' ? 'opacity-50 line-through' : ''}`}>
                    <span className={`px-1.5 rounded text-[10px] ${f.tipo === 'emitida' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>{f.tipo === 'emitida' ? 'EMI' : 'REC'}</span>
                    <span className="w-20 shrink-0">{(f.fecha_factura || '').slice(0, 10)}</span>
                    <span className="flex-1 truncate">{f.numero_factura || 's/n'} · {f.nombre_contraparte || f.nif_contraparte || '—'}{f.inversion_sujeto_pasivo ? ' · ISP' : ''}</span>
                    <span className="text-right shrink-0">{fmt(f.base_imponible)} + {f.tipo_iva}%</span>
                    <span className="text-[10px] text-muted-foreground w-14 text-right">{f.estado}</span>
                    {puedeEditar && f.estado === 'borrador' && <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => cambiarEstado(f, 'revisada')}>Revisar</Button>}
                    {puedeEditar && f.estado !== 'anulada' && <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => cambiarEstado(f, 'anulada')}>Anular</Button>}
                    {puedeBorrar && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => eliminar(f)}><Trash2 className="w-3 h-3" /></Button>}
                  </div>
                ))}
              </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
