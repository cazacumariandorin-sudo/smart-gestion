import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Calculator, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MODOS = [
  { value: 'importe', label: 'Nuevo bruto mensual (€)' },
  { value: 'porcentaje', label: 'Variación sobre el bruto (%)' },
  { value: 'mantener_neto', label: 'Mantener el líquido a percibir' },
];

const eur = (n) => `${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const sgn = (n) => `${n > 0 ? '+' : ''}${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function FilaResultado({ fila }) {
  const esDestacada = fila.tipo === 'total' || fila.tipo === 'neto';
  return (
    <tr className={fila.tipo === 'neto' ? 'bg-primary/5 font-semibold' : esDestacada ? 'bg-muted/40 font-semibold' : ''}>
      <td className="py-2 pr-2">{fila.concepto}</td>
      <td className="py-2 px-2 text-right tabular-nums">{eur(fila.real)}</td>
      <td className="py-2 px-2 text-right tabular-nums">{eur(fila.simulado)}</td>
      <td className={`py-2 pl-2 text-right tabular-nums ${fila.variacion > 0 ? 'text-emerald-600' : fila.variacion < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
        {sgn(fila.variacion)}
      </td>
    </tr>
  );
}

export default function SimuladorNomina() {
  const hoy = new Date();
  const [operarios, setOperarios] = useState([]);
  const [form, setForm] = useState({
    operario_id: '',
    mes: hoy.getMonth() + 1,
    anio: hoy.getFullYear(),
    modo: 'importe',
    valor: '',
    regimen: 'general',
    cuota_reta: '',
    empresa_asume_reta: false,
  });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    base44.entities.Operario.filter({ active: true }, { sort: 'name', limit: 300 })
      .then((r) => setOperarios(r.items || r || []))
      .catch(() => setOperarios([]));
  }, []);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const simular = async () => {
    setError('');
    setResultado(null);
    if (!form.operario_id) { setError('Selecciona un trabajador.'); return; }
    if (form.modo !== 'mantener_neto' && !(Number(form.valor) > 0)) {
      setError('Indica un importe o porcentaje mayor que cero.');
      return;
    }
    setCargando(true);
    try {
      const res = await base44.functions.invoke('simularNomina', {
        operario_id: form.operario_id,
        operario_name: operarios.find((o) => o.id === form.operario_id)?.name || '',
        mes: Number(form.mes),
        anio: Number(form.anio),
        modo: form.modo,
        valor: Number(form.valor) || 0,
        regimen: form.regimen,
        cuota_reta: Number(form.cuota_reta) || 0,
        empresa_asume_reta: form.empresa_asume_reta,
      });
      if (res.data?.ok) setResultado(res.data);
      else setError(res.data?.error || 'No se ha podido calcular la simulación.');
    } catch (e) {
      setError(e?.response?.data?.error || 'No se ha podido calcular la simulación.');
    } finally {
      setCargando(false);
    }
  };

  const esReta = form.regimen === 'autonomo_societario';
  const IconoImpacto = resultado?.coste?.impacto > 0 ? TrendingUp : resultado?.coste?.impacto < 0 ? TrendingDown : Minus;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Simulador informativo. No guarda nada ni modifica los registros reales de nóminas, contabilidad
          ni el dashboard económico.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Trabajador</Label>
          <MobileSelect
            value={form.operario_id}
            onValueChange={(v) => { set('operario_id', v); setResultado(null); }}
            placeholder="Seleccionar trabajador"
          >
            {operarios.map((o) => (
              <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>
            ))}
          </MobileSelect>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Mes</Label>
            <MobileSelect value={String(form.mes)} onValueChange={(v) => set('mes', Number(v))} placeholder="Mes">
              {MESES.map((m, i) => (
                <MobileSelectItem key={m} value={String(i + 1)}>{m}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>
          <div>
            <Label className="text-xs">Año</Label>
            <Input
              type="number"
              value={form.anio}
              onChange={(e) => set('anio', Number(e.target.value))}
              min={2000}
              max={2100}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Qué quieres simular</Label>
          <MobileSelect value={form.modo} onValueChange={(v) => set('modo', v)} placeholder="Tipo de cambio">
            {MODOS.map((m) => (
              <MobileSelectItem key={m.value} value={m.value}>{m.label}</MobileSelectItem>
            ))}
          </MobileSelect>
        </div>

        {form.modo !== 'mantener_neto' && (
          <div>
            <Label className="text-xs">
              {form.modo === 'importe' ? 'Nuevo bruto mensual (€)' : 'Variación sobre el bruto (%)'}
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              value={form.valor}
              onChange={(e) => set('valor', e.target.value)}
              placeholder={form.modo === 'importe' ? 'Ej. 2800' : 'Ej. 8 o -5'}
            />
          </div>
        )}

        <div>
          <Label className="text-xs">Régimen</Label>
          <MobileSelect value={form.regimen} onValueChange={(v) => set('regimen', v)} placeholder="Régimen">
            <MobileSelectItem value="general">Régimen General</MobileSelectItem>
            <MobileSelectItem value="autonomo_societario">Autónomo societario (RETA)</MobileSelectItem>
          </MobileSelect>
        </div>

        {esReta && (
          <div className="space-y-3 border border-border rounded-xl p-3">
            <div>
              <Label className="text-xs">Cuota RETA mensual (€)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={form.cuota_reta}
                onChange={(e) => set('cuota_reta', e.target.value)}
                placeholder="Ej. 420"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.empresa_asume_reta}
                onChange={(e) => set('empresa_asume_reta', e.target.checked)}
                className="w-4 h-4"
              />
              La empresa asume la cuota RETA (retribución en especie)
            </label>
          </div>
        )}

        <Button onClick={simular} disabled={cargando} className="w-full">
          {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
          {cargando ? 'Calculando…' : 'Simular nómina'}
        </Button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
        )}
      </div>

      {resultado && (
        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <h3 className="font-semibold text-base">{resultado.empleado}</h3>
            <p className="text-xs text-muted-foreground">
              Período simulado: {resultado.periodo} · {resultado.regimen === 'autonomo_societario' ? 'Autónomo societario' : 'Régimen General'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-2 font-medium">Concepto</th>
                  <th className="text-right py-2 px-2 font-medium">Real</th>
                  <th className="text-right py-2 px-2 font-medium">Simulado</th>
                  <th className="text-right py-2 pl-2 font-medium">Variación</th>
                </tr>
              </thead>
              <tbody>
                {resultado.filas.map((f, i) => <FilaResultado key={i} fila={f} />)}
              </tbody>
            </table>
          </div>

          <div className="bg-muted/40 rounded-xl p-3 space-y-1 text-sm">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <IconoImpacto className="w-4 h-4" /> Coste para la empresa
            </div>
            <div className="flex justify-between"><span>Coste anterior</span><span className="tabular-nums">{eur(resultado.coste.anterior)}</span></div>
            <div className="flex justify-between"><span>Coste simulado</span><span className="tabular-nums">{eur(resultado.coste.simulado)}</span></div>
            <div className="flex justify-between font-semibold">
              <span>Impacto neto</span>
              <span className={`tabular-nums ${resultado.coste.impacto > 0 ? 'text-red-600' : resultado.coste.impacto < 0 ? 'text-emerald-600' : ''}`}>
                {sgn(resultado.coste.impacto)} {resultado.coste.impacto > 0 ? '(aumento)' : resultado.coste.impacto < 0 ? '(ahorro)' : ''}
              </span>
            </div>
          </div>

          <ul className="space-y-1 text-xs text-muted-foreground list-disc pl-4">
            {resultado.notas.map((n, i) => <li key={i}>{n}</li>)}
          </ul>

          <p className="text-[11px] text-muted-foreground border border-dashed border-border rounded-lg p-2">
            {resultado.aviso}
          </p>
        </div>
      )}
    </div>
  );
}