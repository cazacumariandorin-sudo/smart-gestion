import { useCallback, useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Calculator, Loader2, AlertTriangle, Info } from 'lucide-react';
import PanelConceptos from './simulador/PanelConceptos';
import TablaComparativa from './simulador/TablaComparativa';
import ResumenResultado from './simulador/ResumenResultado';
import ParametrosBloqueados from './simulador/ParametrosBloqueados';
import { eur, pct } from '@/lib/nominaFormato';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const AVISO_LEGAL = 'Simulación informativa. Los importes definitivos los calcula la gestoría.';

export default function SimuladorNomina() {
  const hoy = new Date();
  const [operarios, setOperarios] = useState([]);
  const [form, setForm] = useState({
    operario_id: '',
    mes: hoy.getMonth() + 1,
    anio: hoy.getFullYear(),
    regimen: 'general',
  });
  const [base, setBase] = useState(null);
  const [entradas, setEntradas] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [absorcion, setAbsorcion] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    base44.entities.Operario.list('name', 400)
      .then((r) => setOperarios(Array.isArray(r) ? r : r?.items || []))
      .catch(() => setOperarios([]));
  }, []);

  const operario = useMemo(
    () => operarios.find((o) => o.id === form.operario_id) || null,
    [operarios, form.operario_id]
  );

  const invocar = useCallback(
    (accion, datos, extra = {}) =>
      base44.functions.invoke('simularNomina', {
        accion,
        operario_id: form.operario_id,
        operario_name: operario?.name || '',
        mes: Number(form.mes),
        anio: Number(form.anio),
        regimen: form.regimen,
        ...(datos ? { entradas: datos } : {}),
        ...extra,
      }),
    [form, operario]
  );

  const calcular = useCallback(
    async (datos, absorbe, activo = true) => {
      setCalculando(true);
      setError('');
      try {
        const res = await invocar('calcular', { ...datos, absorcion: !!absorbe });
        const d = res.data || {};
        if (d.ok === false) throw new Error(d.error || 'No se pudo calcular la simulación.');
        if (activo) {
          setResultado(d);
          setDirty(false);
        }
      } catch (e) {
        if (activo) setError(e?.response?.data?.error || e.message || 'No se pudo calcular la simulación.');
      } finally {
        if (activo) setCalculando(false);
      }
    },
    [invocar]
  );

  // Precarga: al cambiar trabajador, periodo o régimen se relee el histórico real.
  useEffect(() => {
    let activo = true;
    setBase(null);
    setEntradas(null);
    setResultado(null);
    setError('');
    setAbsorcion(false);
    setDirty(false);
    if (!form.operario_id) return () => { activo = false; };

    setCargando(true);
    invocar('plantilla', null)
      .then(async (res) => {
        const d = res.data || {};
        if (!activo) return;
        if (d.ok === false) throw new Error(d.error || 'No se pudo cargar la nómina de referencia.');
        setBase(d);
        setEntradas(d.entradas);
        setCargando(false);
        await calcular(d.entradas, false, activo);
      })
      .catch((e) => {
        if (!activo) return;
        setError(e?.response?.data?.error || e.message || 'No se pudo cargar la nómina de referencia.');
        setCargando(false);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.operario_id, form.mes, form.anio, form.regimen]);

  const cambiar = (campo, valor) => {
    setEntradas((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [campo]: valor };
      if (campo === 'dietas_con_pernocta') next.dietas_con_pernocta = valor;
      if (campo === 'precio_dia') {
        next.salario_base = Math.round((Number(next.dias) || 0) * (Number(valor) || 0) * 100) / 100;
      }
      if (campo === 'dias') {
        next.salario_base = Math.round((Number(valor) || 0) * (Number(prev.precio_dia) || 0) * 100) / 100;
      }
      if (campo === 'salario_base') {
        next.precio_dia = Number(next.dias) > 0
          ? Math.round((Number(valor) / Number(next.dias)) * 10000) / 10000
          : 0;
      }
      return next;
    });
    setDirty(true);
  };

  const restablecer = () => {
    if (!base) return;
    setEntradas(base.entradas);
    setAbsorcion(false);
    calcular(base.entradas, false);
  };

  const reta = form.regimen === 'autonomo_societario';
  const actualLabel = base?.referencia?.periodo ? `Actual · ${base.referencia.periodo}` : 'Actual';

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Simulador informativo: no guarda nada ni modifica nóminas reales, contabilidad ni el dashboard. Calcula
          de abajo arriba (días × precio/día → devengos → deducciones → líquido y coste de empresa) y no recalcula el IRPF.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Trabajador</Label>
            <MobileSelect
              value={form.operario_id}
              onValueChange={(v) => setForm((f) => ({ ...f, operario_id: v }))}
              placeholder="Seleccionar trabajador"
            >
              {operarios.map((o) => (
                <MobileSelectItem key={o.id} value={o.id}>
                  {o.name}
                  {o.active === false ? ' (inactivo)' : ''}
                </MobileSelectItem>
              ))}
            </MobileSelect>
          </div>
          <div>
            <Label className="text-xs">Régimen</Label>
            <MobileSelect
              value={form.regimen}
              onValueChange={(v) => setForm((f) => ({ ...f, regimen: v }))}
              placeholder="Régimen"
            >
              <MobileSelectItem value="general">Régimen General</MobileSelectItem>
              <MobileSelectItem value="autonomo_societario">Autónomo societario (RETA)</MobileSelectItem>
            </MobileSelect>
          </div>
          <div>
            <Label className="text-xs">Mes</Label>
            <MobileSelect
              value={String(form.mes)}
              onValueChange={(v) => setForm((f) => ({ ...f, mes: Number(v) }))}
              placeholder="Mes"
            >
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
              min={2000}
              max={2100}
              onChange={(e) => setForm((f) => ({ ...f, anio: Number(e.target.value) }))}
            />
          </div>
        </div>

        {base && (
          <div className="space-y-0.5 rounded-lg bg-muted/40 p-2 text-[11px] text-muted-foreground">
            <p className="flex items-center gap-1">
              <Info className="h-3 w-3" /> {base.referencia.metodo}.
            </p>
            {base.referencia.media && (
              <p>
                Media de {base.referencia.media.meses} mes(es) ({base.referencia.meses.join(', ')}): devengado{' '}
                {eur(base.referencia.media.devengado)} · líquido {eur(base.referencia.media.liquido)}.
              </p>
            )}
            <p>
              Retención constante: {pct(base.tipo_irpf)} de {base.origen_irpf}. Nómina registrada: devengado{' '}
              {eur(base.registrado.devengado)} · líquido {eur(base.registrado.liquido)} · coste {eur(base.registrado.coste)}.
            </p>
          </div>
        )}
      </div>

      {cargando && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando el histórico del trabajador…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {entradas && base && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Conceptos de la simulación</h3>
              <p className="text-[11px] text-muted-foreground">
                Cada campo muestra el importe histórico al lado; en ámbar, lo que has cambiado.
              </p>
            </div>
            <Button onClick={() => calcular(entradas, absorcion)} disabled={calculando} size="sm" className="gap-1">
              {calculando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
              {calculando ? 'Calculando…' : dirty ? 'Calcular cambios' : 'Recalcular'}
            </Button>
          </div>

          <PanelConceptos
            entradas={entradas}
            seed={base.entradas}
            regimen={form.regimen}
            onChange={cambiar}
          />

          {!reta && (
            <label className="flex items-start gap-2 rounded-lg border border-border p-2 text-[11px]">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={absorcion}
                onChange={(e) => {
                  setAbsorcion(e.target.checked);
                  calcular(entradas, e.target.checked);
                }}
              />
              <span>
                Absorber el aumento del precio/día con el complemento absorbible (neto constante). Debajo verás
                siempre las dos variantes: absorber o sumar.
              </span>
            </label>
          )}
        </div>
      )}

      {resultado && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">
              {resultado.trabajador.nombre} · {resultado.periodo.label}
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {resultado.regimen === 'autonomo_societario' ? 'Autónomo societario (RETA)' : 'Régimen General'}
              {resultado.trabajador.categoria_label ? ` · ${resultado.trabajador.categoria_label}` : ''}
            </span>
          </div>

          <ResumenResultado
            resultado={resultado}
            onRestablecer={restablecer}
            deshabilitado={!dirty && !absorcion && !calculando}
          />

          <TablaComparativa filas={resultado.filas} actualLabel={actualLabel} />
        </div>
      )}

      {base && <ParametrosBloqueados parametros={base.parametros} />}

      <p className="rounded-lg border border-dashed border-border p-2 text-[11px] text-muted-foreground">
        {AVISO_LEGAL}
      </p>
    </div>
  );
}