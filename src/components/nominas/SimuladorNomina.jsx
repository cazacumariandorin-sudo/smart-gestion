import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Calculator, Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import ConceptosNominaForm from './simulador/ConceptosNominaForm';
import TablaNominaSimulada from './simulador/TablaNominaSimulada';
import { eur, sgn } from '@/lib/nominaFormato';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function SimuladorNomina() {
  const hoy = new Date();
  const [operarios, setOperarios] = useState([]);
  const [form, setForm] = useState({
    operario_id: '',
    mes: hoy.getMonth() + 1,
    anio: hoy.getFullYear(),
    regimen: 'general',
    cuota_reta: '',
    empresa_asume_reta: false,
  });
  const [devengos, setDevengos] = useState(null);
  const [base, setBase] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [cargandoBase, setCargandoBase] = useState(false);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    base44.entities.Operario.filter({ active: true }, { sort: 'name', limit: 300 })
      .then((r) => setOperarios(r.items || r || []))
      .catch(() => setOperarios([]));
  }, []);

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  // La plantilla de conceptos se recarga al cambiar de trabajador, periodo o régimen:
  // es el punto de partida real sobre el que se edita.
  useEffect(() => {
    let activo = true;
    setResultado(null);
    setBase(null);
    setDevengos(null);
    setError('');
    if (!form.operario_id) return undefined;

    setCargandoBase(true);
    base44.functions
      .invoke('simularNomina', {
        accion: 'plantilla',
        operario_id: form.operario_id,
        operario_name: operarios.find((o) => o.id === form.operario_id)?.name || '',
        mes: Number(form.mes),
        anio: Number(form.anio),
        regimen: form.regimen,
      })
      .then((res) => {
        const data = res.data || {};
        if (data.ok === false) throw new Error(data.error || 'No se pudo cargar la nómina de referencia.');
        if (!activo) return;
        setBase(data);
        setDevengos(data.devengos);
      })
      .catch((e) => {
        if (activo) setError(e?.response?.data?.error || e.message || 'No se pudo cargar la nómina de referencia.');
      })
      .finally(() => {
        if (activo) setCargandoBase(false);
      });

    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.operario_id, form.mes, form.anio, form.regimen]);

  const simular = async () => {
    setError('');
    if (!form.operario_id) { setError('Selecciona un trabajador.'); return; }
    if (!devengos) return;
    setCalculando(true);
    try {
      const res = await base44.functions.invoke('simularNomina', {
        accion: 'calcular',
        operario_id: form.operario_id,
        operario_name: operarios.find((o) => o.id === form.operario_id)?.name || '',
        mes: Number(form.mes),
        anio: Number(form.anio),
        regimen: form.regimen,
        cuota_reta: Number(form.cuota_reta) || 0,
        empresa_asume_reta: form.empresa_asume_reta,
        devengos,
      });
      const data = res.data || {};
      if (data.ok === false) throw new Error(data.error || 'No se ha podido calcular la simulación.');
      setResultado(data);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'No se ha podido calcular la simulación.');
    } finally {
      setCalculando(false);
    }
  };

  const esReta = form.regimen === 'autonomo_societario';
  const IconoImpacto =
    resultado?.coste?.impacto > 0 ? TrendingUp : resultado?.coste?.impacto < 0 ? TrendingDown : Minus;

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
            onValueChange={(v) => set('operario_id', v)}
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

        {cargandoBase && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando la nómina de referencia…
          </div>
        )}

        {devengos && base && (
          <div className="space-y-3 border-t border-border pt-4">
            <div>
              <h3 className="font-semibold text-sm">Conceptos de la nómina</h3>
              <p className="text-xs text-muted-foreground">
                Precargados de la nómina de {base.origen}. Edita los importes que quieras simular.
              </p>
            </div>
            <ConceptosNominaForm
              devengos={devengos}
              onChange={(campo, valor) => setDevengos((d) => ({ ...d, [campo]: valor }))}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
        )}

        <Button onClick={simular} disabled={calculando || !devengos} className="w-full">
          {calculando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
          {calculando ? 'Calculando…' : 'Calcular nómina simulada'}
        </Button>
      </div>

      {resultado && (
        <div className="space-y-4 border-t border-border pt-4">
          <div>
            <h3 className="font-semibold text-base">{resultado.empleado}</h3>
            <p className="text-xs text-muted-foreground">
              Período simulado: {resultado.periodo} · {resultado.regimen === 'autonomo_societario' ? 'Autónomo societario' : 'Régimen General'}
            </p>
          </div>

          <TablaNominaSimulada filas={resultado.filas} origen={resultado.real?.origen} />

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