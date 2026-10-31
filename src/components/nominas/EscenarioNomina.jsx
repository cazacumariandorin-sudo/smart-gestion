import { useEffect, useState } from 'react';
import { Calculator, Loader2, RotateCcw, Users, TrendingUp, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import EscenarioTrabajadorCard from './EscenarioTrabajadorCard';
import EscenarioResultado from './EscenarioResultado';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const proximoMes = () => {
  const d = new Date();
  const siguiente = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { mes: siguiente.getMonth() + 1, anio: siguiente.getFullYear() };
};

const lineaVacia = (t) => ({
  operario_id: t.operario_id,
  operario_name: t.operario_name,
  real: t,
  incluido: true,
  salario_base: t.salario_base,
  salario_original: t.salario_base,
  prorrata_extras: t.prorrata_extras,
  incentivo: 0,
  bonus: 0,
  otros_devengos: 0,
  dietas_importe: 0,
  dietas_dias: 0,
  dietas_con_pernocta: true,
  regimen: 'general',
  cuota_reta: 0,
  empresa_asume_reta: false,
});

export default function EscenarioNomina() {
  const inicial = proximoMes();
  const [mes, setMes] = useState(inicial.mes);
  const [anio, setAnio] = useState(inicial.anio);
  const [lineas, setLineas] = useState([]);
  const [incremento, setIncremento] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('simularEscenarioNomina', { accion: 'plantilla' });
        const data = res.data || {};
        if (data.ok === false) throw new Error(data.error || 'No se pudo cargar la plantilla.');
        if (!activo) return;
        setLineas((data.trabajadores || []).map(lineaVacia));
      } catch (e) {
        if (activo) setError(e.message || 'No se pudo cargar la plantilla de trabajadores.');
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, []);

  const actualizar = (clave, cambios) =>
    setLineas((prev) =>
      prev.map((l) => ((l.operario_id || l.operario_name) === clave ? { ...l, ...cambios } : l))
    );

  const aplicarIncremento = (valor) => {
    const pct = Number(valor) || 0;
    setIncremento(pct);
    setLineas((prev) =>
      prev.map((l) => ({
        ...l,
        salario_base: Math.round(l.salario_original * (1 + pct / 100) * 100) / 100,
      }))
    );
  };

  const restablecer = () => {
    setIncremento(0);
    setResultado(null);
    setError('');
    setLineas((prev) => prev.map((l) => ({ ...lineaVacia(l.real), incluido: l.incluido })));
  };

  const busqueda = filtro.trim().toLowerCase();
  const visibles = busqueda
    ? lineas.filter((l) => (l.operario_name || '').toLowerCase().includes(busqueda))
    : lineas;

  const calcular = async () => {
    const incluidas = lineas.filter((l) => l.incluido);
    if (!incluidas.length) {
      setError('Marca al menos un trabajador para calcular el escenario.');
      return;
    }

    setCalculando(true);
    setError('');
    try {
      const res = await base44.functions.invoke('simularEscenarioNomina', {
        accion: 'simular',
        mes,
        anio,
        lineas: incluidas.map((l) => ({
          operario_id: l.operario_id,
          operario_name: l.operario_name,
          salario_base: Number(l.salario_base) || 0,
          prorrata_extras: Number(l.prorrata_extras) || 0,
          incentivo: Number(l.incentivo) || 0,
          bonus: Number(l.bonus) || 0,
          otros_devengos: Number(l.otros_devengos) || 0,
          dietas_importe: Number(l.dietas_importe) || 0,
          dietas_dias: Number(l.dietas_dias) || 0,
          dietas_con_pernocta: l.dietas_con_pernocta,
          regimen: l.regimen,
          cuota_reta: Number(l.cuota_reta) || 0,
          empresa_asume_reta: l.empresa_asume_reta,
        })),
      });
      const data = res.data || {};
      if (data.ok === false) throw new Error(data.error || 'No se pudo calcular el escenario.');
      setResultado(data);
    } catch (e) {
      setError(e.message || 'No se pudo calcular el escenario.');
    } finally {
      setCalculando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <TrendingUp className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-base">Escenario de nóminas</h2>
          <p className="text-xs text-muted-foreground">
            Parte de las nóminas reales y añade incentivos, pagas extra o dietas para ver el coste de empresa del próximo mes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Mes a estimar</Label>
          <MobileSelect value={String(mes)} onValueChange={(v) => setMes(Number(v))} placeholder="Mes">
            {MESES.map((m, i) => (
              <MobileSelectItem key={m} value={String(i + 1)}>{m}</MobileSelectItem>
            ))}
          </MobileSelect>
        </div>
        <div>
          <Label className="text-xs">Año</Label>
          <Input type="number" inputMode="numeric" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 items-end">
        <div>
          <Label className="text-xs">Subida general (%)</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={incremento}
            onChange={(e) => aplicarIncremento(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={restablecer}>
          <RotateCcw className="w-4 h-4" /> Limpiar
        </Button>
      </div>

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          {error}
        </div>
      )}

      {cargando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando plantilla…
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Filtrar por trabajador"
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-4 h-4" />
            {lineas.length} trabajadores con nómina registrada · {lineas.filter((l) => l.incluido).length} en el escenario
            {busqueda ? ` · ${visibles.length} mostrados` : ''}
          </div>

          <div className="space-y-2">
            {visibles.map((l) => (
              <EscenarioTrabajadorCard
                key={l.operario_id || l.operario_name}
                linea={l}
                onChange={(cambios) => actualizar(l.operario_id || l.operario_name, cambios)}
              />
            ))}
            {!lineas.length && (
              <p className="text-sm text-muted-foreground">
                No hay nóminas individuales cargadas. Sube nóminas para poder estimar el escenario.
              </p>
            )}
            {!!lineas.length && !visibles.length && (
              <p className="text-sm text-muted-foreground">
                Ningún trabajador coincide con «{filtro}».
              </p>
            )}
          </div>
        </>
      )}

      <Button onClick={calcular} disabled={calculando || !lineas.length} className="w-full">
        {calculando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
        {calculando ? 'Calculando…' : 'Calcular escenario'}
      </Button>

      {resultado && <EscenarioResultado resultado={resultado} />}
    </div>
  );
}