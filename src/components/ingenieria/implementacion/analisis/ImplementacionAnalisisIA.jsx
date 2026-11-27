import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Sparkles, Loader2, FileText, TrendingUp, AlertTriangle, PlusCircle, Info, History } from 'lucide-react';
import HallazgoCard from './HallazgoCard';
import InformeAnalisisDialog from './InformeAnalisisDialog';
import { fechaHoraES } from '@/lib/fechaES';

const SECCIONES = [
  { id: 'avance', label: 'Avance observado', icon: TrendingUp, color: 'text-teal-700 dark:text-teal-400' },
  { id: 'incidencia', label: 'Posibles incidencias', icon: AlertTriangle, color: 'text-amber-700 dark:text-amber-400' },
  { id: 'trabajo_extra', label: 'Posibles trabajos extra', icon: PlusCircle, color: 'text-blue-700 dark:text-blue-400' },
];

/**
 * Análisis IA de respaldo al seguimiento de la obra.
 * Reúne las fuentes del proyecto, propone observaciones con evidencia y
 * permite revisarlas y generar un informe descargable.
 */
export default function ImplementacionAnalisisIA({ obra, onIrA }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const [informeAbierto, setInformeAbierto] = useState(false);

  const { data: analisis = [], isLoading } = useQuery({
    queryKey: ['impl-analisis', obra?.id],
    queryFn: () => base44.entities.AnalisisSeguimientoObra.filter({ obra_id: obra.id }, '-generado_en', 20),
    enabled: !!obra?.id,
  });

  const actual = analisis.find((a) => a.id === seleccionadoId) || analisis[0] || null;

  const analizar = useMutation({
    mutationFn: () =>
      base44.functions.invoke('analizarSeguimientoObra', { obra_id: obra.id, obra_tipo: obra._tipo === 'solar' ? 'solar' : 'obra_civil' }),
    onSuccess: (res) => {
      const nuevo = res?.data?.analisis;
      qc.invalidateQueries({ queryKey: ['impl-analisis', obra.id] });
      if (nuevo?.id) setSeleccionadoId(nuevo.id);
      toast({
        title: 'Análisis generado',
        description: nuevo ? `${(nuevo.hallazgos || []).length} observaciones para revisar.` : '',
      });
    },
    onError: (e) =>
      toast({
        variant: 'destructive',
        title: 'No se pudo analizar el seguimiento',
        description: e?.response?.data?.error || e?.message || 'Inténtalo de nuevo',
      }),
  });

  const revisar = useMutation({
    mutationFn: (hallazgos) => {
      const pendientes = hallazgos.filter((h) => (h.estado_revision || 'pendiente') === 'pendiente').length;
      const datos = { hallazgos };
      if (pendientes === 0) {
        datos.estado = 'revisado';
        datos.revisado_por = user?.email || '';
        datos.revisado_en = new Date().toISOString();
      }
      return base44.entities.AnalisisSeguimientoObra.update(actual.id, datos);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['impl-analisis', obra.id] }),
  });

  const revisarHallazgo = (hallazgoId, cambios) => {
    const hallazgos = (actual.hallazgos || []).map((h) =>
      h.id === hallazgoId ? { ...h, ...cambios, revisado_por: user?.email || '', revisado_en: new Date().toISOString() } : h
    );
    revisar.mutate(hallazgos);
  };

  const pendientes = (actual?.hallazgos || []).filter((h) => (h.estado_revision || 'pendiente') === 'pendiente').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => analizar.mutate()} disabled={analizar.isPending} className="gap-2">
          {analizar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analizar.isPending ? 'Analizando seguimiento…' : 'Analizar seguimiento'}
        </Button>
        <Button variant="outline" onClick={() => setInformeAbierto(true)} disabled={!actual} className="gap-2">
          <FileText className="w-4 h-4" /> Generar informe
        </Button>
        {actual && (
          <span className="text-xs text-muted-foreground ml-auto">
            {pendientes > 0 ? `${pendientes} observación(es) sin revisar` : 'Todas las observaciones revisadas'}
          </span>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>
          El análisis relee las fotos, partes, documentos, materiales, fichajes, previsiones, presupuestos y discrepancias
          de esta obra en el momento de lanzarlo. Cada observación indica su clasificación y los registros que la
          respaldan; ninguna se considera confirmada hasta que la revisas.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando análisis…</p>
      ) : !actual ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Sparkles className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Sin análisis de seguimiento</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Lanza el primer análisis para obtener un resumen del avance, posibles incidencias y posibles trabajos extra,
            con la evidencia de cada observación.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{actual.obra_name || obra.name}</span>
              <span>{fechaHoraES(actual.generado_en)}</span>
              {actual.generado_por_nombre && <span>· {actual.generado_por_nombre}</span>}
              <span
                className={`px-2 py-0.5 rounded border ${
                  actual.estado === 'revisado'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                }`}
              >
                {actual.estado === 'revisado' ? 'Revisado' : 'Borrador'}
              </span>
              <span>Confianza {Math.round((Number(actual.confianza) || 0) * 100)} %</span>
              <span>{Number(actual.fotos_analizadas) || 0} foto(s) analizada(s)</span>
            </div>

            <p className="text-sm whitespace-pre-line">{actual.resumen}</p>

            {(actual.fuentes || []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {actual.fuentes.map((f) => (
                  <span
                    key={f.entidad}
                    className={`text-[11px] px-2 py-0.5 rounded border ${
                      Number(f.registros) > 0
                        ? 'border-border bg-background text-muted-foreground'
                        : 'border-dashed border-border text-muted-foreground/70'
                    }`}
                  >
                    {f.etiqueta || f.entidad}: {Number(f.registros) || 0}
                  </span>
                ))}
              </div>
            )}
          </div>

          {SECCIONES.map((s) => {
            const items = (actual.hallazgos || []).filter((h) => h.seccion === s.id);
            if (!items.length) return null;
            const Icono = s.icon;
            return (
              <div key={s.id} className="space-y-2">
                <p className={`text-sm font-semibold flex items-center gap-1.5 ${s.color}`}>
                  <Icono className="w-4 h-4" /> {s.label}
                </p>
                {items.map((h) => (
                  <HallazgoCard
                    key={h.id}
                    hallazgo={h}
                    onRevisar={(cambios) => revisarHallazgo(h.id, cambios)}
                    onIrA={onIrA}
                    guardando={revisar.isPending}
                  />
                ))}
              </div>
            );
          })}

          {(actual.datos_no_disponibles || []).length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-semibold mb-1">Datos no disponibles</p>
              <ul className="space-y-0.5">
                {actual.datos_no_disponibles.map((d, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    • {d}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(actual.recomendaciones || []).length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-semibold mb-1">Comprobaciones recomendadas</p>
              <ul className="space-y-0.5">
                {actual.recomendaciones.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    • {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analisis.length > 1 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <History className="w-4 h-4" /> Análisis anteriores
              </p>
              <div className="space-y-1">
                {analisis.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSeleccionadoId(a.id)}
                    className={`w-full flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                      a.id === actual.id ? 'border-teal-300 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <span>{fechaHoraES(a.generado_en)}</span>
                    <span className="text-muted-foreground">
                      {(a.hallazgos || []).length} obs. · {a.estado === 'revisado' ? 'revisado' : 'borrador'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <InformeAnalisisDialog
        open={informeAbierto}
        onOpenChange={setInformeAbierto}
        analisis={actual}
        obra={obra}
      />
    </div>
  );
}