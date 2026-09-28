import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, Loader2, AlertTriangle, CheckCircle2, XCircle, Filter } from 'lucide-react';
import DuplicadoGrupoCard from './DuplicadoGrupoCard';

const ENTIDADES = [
  { value: 'registro_gasto', label: 'Gastos técnicos' },
  { value: 'factura_autonomo', label: 'Facturas autónomos' },
  { value: 'nomina', label: 'Nóminas' },
  { value: 'presupuesto', label: 'Presupuestos' },
];

const UMBRALES = [
  { value: 'critico', label: 'Solo críticos' },
  { value: 'alto', label: 'Críticos + altos' },
  { value: 'medio', label: 'Críticos + altos + medios' },
  { value: 'bajo', label: 'Todos (incluye bajos)' },
];

function eur(n) {
  return (n == null ? 0 : n).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

export default function DetectorDuplicadosPanel({ rango, periodoKey }) {
  const { isGerencia, isAdministracion, isAdmin, isPropietario } = useUserRole();
  const puedeUsar = isGerencia || isAdministracion || isAdmin || isPropietario;
  const qc = useQueryClient();

  const [entidadSel, setEntidadSel] = useState('registro_gasto');
  const [umbral, setUmbral] = useState('medio');
  const [operarioId, setOperarioId] = useState('');
  const [categoria, setCategoria] = useState('');
  const [soloNoConsolidados, setSoloNoConsolidados] = useState(true);
  const [analizando, setAnalizando] = useState(false);
  const [grupos, setGrupos] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [procesandoGrupo, setProcesandoGrupo] = useState(null);

  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios-ded'],
    queryFn: () => base44.entities.Operario.list('name', 500),
    enabled: puedeUsar,
  });

  if (!puedeUsar) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        Solo gerencia, administración o admin pueden usar el detector de duplicados.
      </div>
    );
  }

  const analizar = async () => {
    setAnalizando(true);
    setGrupos(null);
    setResumen(null);
    try {
      const res = await base44.functions.invoke('detectarDuplicadosEconomico', {
        entidades: [entidadSel],
        inicio: rango?.inicio,
        fin: rango?.fin,
        umbral,
        operario_id: operarioId || undefined,
        categoria: categoria || undefined,
        solo_no_consolidados: soloNoConsolidados,
      });
      const data = res?.data || res;
      if (data?.success) {
        setGrupos(data.grupos || []);
        setResumen(data.resumen || null);
        if ((data.grupos || []).length === 0) toast.success('No se detectaron duplicados con ese umbral.');
        else toast.info(`${(data.grupos || []).length} grupos de duplicados detectados.`);
      } else {
        toast.error(data?.error || 'Error al analizar duplicados');
      }
    } catch (e) {
      toast.error(e?.message || 'Error al analizar duplicados');
    } finally {
      setAnalizando(false);
    }
  };

  const consolidar = async (grupo, conservarId, fusionar) => {
    setProcesandoGrupo(grupo.conservar_id);
    const descartar = grupo.miembros.filter(m => m.id !== conservarId).map(m => ({ id: m.id, entidad: m.entidad }));
    try {
      const res = await base44.functions.invoke('consolidarDuplicado', {
        conservar_id: conservarId,
        entidad_conservar: grupo.miembros[0].entidad,
        descartar,
        fusionar,
        motivo: 'Consolidación manual desde detector',
      });
      const data = res?.data || res;
      if (data?.success) {
        toast.success(`${descartar.length} registro(s) ${fusionar ? 'fusionados y ' : ''}anulados.`);
        // Quitar el grupo de la lista y refrescar
        setGrupos(prev => (prev || []).filter(g => g.conservar_id !== grupo.conservar_id && !g.miembros.some(m => descartar.some(d => d.id === m.id))));
        setResumen(prev => prev ? { ...prev, total_grupos: Math.max(0, (prev.total_grupos || 0) - 1) } : prev);
        qc.invalidateQueries({ queryKey: ['eco-registros'] });
      } else {
        toast.error(data?.error || 'Error al consolidar');
      }
    } catch (e) {
      toast.error(e?.message || 'Error al consolidar');
    } finally {
      setProcesandoGrupo(null);
    }
  };

  const falsoPositivo = (grupo) => {
    setGrupos(prev => (prev || []).filter(g => g.conservar_id !== grupo.conservar_id));
    toast.success('Marcado como falso positivo y retirado de la lista.');
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">Detector de duplicados</p>
            <p className="text-xs text-muted-foreground">
              Escanea todo el módulo económico por CIF, nombre, fecha, hora, importe, localidad y nº factura. Propone conservar el mejor y anular el resto.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Entidad</label>
            <MobileSelect value={entidadSel} onValueChange={setEntidadSel} triggerClassName="w-48">
              {ENTIDADES.map(e => <MobileSelectItem key={e.value} value={e.value}>{e.label}</MobileSelectItem>)}
            </MobileSelect>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Severidad mínima</label>
            <MobileSelect value={umbral} onValueChange={setUmbral} triggerClassName="w-52">
              {UMBRALES.map(u => <MobileSelectItem key={u.value} value={u.value}>{u.label}</MobileSelectItem>)}
            </MobileSelect>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Técnico</label>
            <MobileSelect value={operarioId} onValueChange={setOperarioId} placeholder="Todos" triggerClassName="w-44">
              <MobileSelectItem value="">Todos</MobileSelectItem>
              {operarios.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
            </MobileSelect>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Categoría (gastos)</label>
            <MobileSelect value={categoria} onValueChange={setCategoria} placeholder="Todas" triggerClassName="w-40">
              <MobileSelectItem value="">Todas</MobileSelectItem>
              <MobileSelectItem value="combustible">Combustible</MobileSelectItem>
              <MobileSelectItem value="comida">Comida</MobileSelectItem>
              <MobileSelectItem value="material">Material</MobileSelectItem>
              <MobileSelectItem value="peaje">Peaje</MobileSelectItem>
              <MobileSelectItem value="parking">Parking</MobileSelectItem>
              <MobileSelectItem value="otros">Otros</MobileSelectItem>
            </MobileSelect>
          </div>
          <Button onClick={analizar} disabled={analizando}>
            {analizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Analizar duplicados
          </Button>
        </div>
      </div>

      {resumen && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-card border rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Documentos analizados</p>
            <p className="text-lg font-bold">{resumen.total_docs}</p>
          </div>
          <div className="bg-card border rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Grupos duplicados</p>
            <p className="text-lg font-bold">{resumen.total_grupos}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-xs text-red-700 dark:text-red-400">Críticos</p>
            <p className="text-lg font-bold text-red-700 dark:text-red-400">{resumen.criticos}</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">Altos + Medios</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{resumen.altos + resumen.medios}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
            <p className="text-xs text-emerald-700 dark:text-emerald-400">Importe a anular</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{eur(resumen.importe_duplicado)}</p>
          </div>
        </div>
      )}

      {analizando && !grupos && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Comparando registros…</span>
        </div>
      )}

      {grupos && grupos.length === 0 && !analizando && (
        <div className="text-center py-10">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
          <p className="text-sm font-medium">Sin duplicados detectados con el umbral actual.</p>
          <p className="text-xs text-muted-foreground">Prueba a bajar el umbral o ampliar el periodo.</p>
        </div>
      )}

      {grupos && grupos.length > 0 && (
        <div className="space-y-3">
          {grupos.map((g, i) => (
            <DuplicadoGrupoCard
              key={g.conservar_id}
              grupo={g}
              idx={i}
              onConsolidar={consolidar}
              onFalsoPositivo={falsoPositivo}
              procesando={procesandoGrupo === g.conservar_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}