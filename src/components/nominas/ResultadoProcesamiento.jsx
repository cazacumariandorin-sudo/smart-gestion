import { CheckCircle2, AlertTriangle, User, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ResultadoProcesamiento({ resultado, onCerrar }) {
  if (!resultado) return null;

  if (resultado.error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4">
        <div className="flex items-center gap-2 text-destructive mb-1">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-semibold text-sm">Error al procesar</span>
        </div>
        <p className="text-xs text-muted-foreground">{resultado.error}</p>
      </div>
    );
  }

  const pctAsignadas = resultado.total_procesadas > 0
    ? Math.round((resultado.asignadas_automaticamente / resultado.total_procesadas) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-semibold text-sm">Procesamiento completado — {resultado.periodo}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{resultado.total_procesadas}</p>
            <p className="text-xs text-muted-foreground">Nóminas totales</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{resultado.asignadas_automaticamente}</p>
            <p className="text-xs text-muted-foreground">Asignadas auto</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${resultado.sin_asignar > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {resultado.sin_asignar}
            </p>
            <p className="text-xs text-muted-foreground">Sin asignar</p>
          </div>
        </div>
        <div className="mt-3 bg-white/60 dark:bg-black/20 rounded-lg h-2 overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-700"
            style={{ width: `${pctAsignadas}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-right">{pctAsignadas}% asignado automáticamente</p>
      </div>

      {/* Lista de nóminas */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {(resultado.nominas || []).map((nom, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border text-sm
            ${nom.asignada ? 'bg-card border-border' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0
              ${nom.asignada ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
              {nom.asignada ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{nom.operario_name}</p>
              <p className="text-xs text-muted-foreground">DNI: {nom.operario_dni || '—'} · Pág. {nom.pagina}</p>
            </div>
            <div className="text-right shrink-0">
              {nom.liquido_percibir && (
                <p className="font-semibold text-sm text-green-700">{nom.liquido_percibir.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
              )}
              {nom.coste_empresa && (
                <p className="text-xs text-muted-foreground">Coste: {nom.coste_empresa.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
              )}
              <Badge variant={nom.asignada ? 'default' : 'outline'} className="text-[10px] mt-0.5">
                {nom.asignada ? 'Asignada' : 'Sin asignar'}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      {resultado.sin_asignar > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Se ha creado una tarea de revisión manual en el panel de tareas del gerente.
          </p>
        </div>
      )}
    </div>
  );
}