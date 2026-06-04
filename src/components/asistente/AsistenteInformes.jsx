import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart2, FileText, Users, Clock, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/lib/useUserRole';

const INFORMES_CONFIG = [
  {
    id: 'resumen_ejecutivo',
    titulo: 'Resumen Ejecutivo',
    descripcion: 'Estado general: obras, horas, gastos y partes',
    icon: BarChart2,
    roles: ['admin', 'gerencia'],
    tool: 'generar_resumen_ejecutivo',
    periodos: ['hoy', 'semana', 'mes'],
  },
  {
    id: 'operarios_sin_fichar',
    titulo: 'Operarios sin fichar hoy',
    descripcion: 'Lista de operarios activos que no han fichado entrada',
    icon: Users,
    roles: ['admin', 'gerencia', 'jefe_obra', 'control_horario'],
    tool: 'get_operarios_sin_fichar_hoy',
  },
  {
    id: 'partes_sin_firmar',
    titulo: 'Partes sin firma',
    descripcion: 'WorkOrders pendientes de firma del cliente',
    icon: FileText,
    roles: ['admin', 'gerencia', 'jefe_obra'],
    tool: 'get_partes_sin_firmar',
  },
  {
    id: 'obras_sin_presupuesto',
    titulo: 'Obras sin presupuesto',
    descripcion: 'Obras activas con presupuesto a 0 o vacío',
    icon: BarChart2,
    roles: ['admin', 'gerencia'],
    tool: 'get_obras_sin_presupuesto',
  },
  {
    id: 'kpis_mes',
    titulo: 'KPIs del mes',
    descripcion: 'Horas, gastos, obras y partes del mes actual',
    icon: Clock,
    roles: ['admin', 'gerencia', 'director_comercial'],
    tool: 'get_kpis_mes',
  },
];

function ResultadoKV({ datos }) {
  if (!datos || typeof datos !== 'object') return <pre className="text-xs text-muted-foreground">{JSON.stringify(datos, null, 2)}</pre>;

  const renderValue = (val) => {
    if (Array.isArray(val)) {
      return (
        <div className="space-y-1 mt-1">
          {val.slice(0, 5).map((item, i) => (
            <div key={i} className="bg-muted/50 rounded px-2 py-1 text-xs">
              {typeof item === 'object' ? Object.entries(item).map(([k, v]) => v && `${k}: ${v}`).filter(Boolean).join(' · ') : String(item)}
            </div>
          ))}
          {val.length > 5 && <p className="text-xs text-muted-foreground">...y {val.length - 5} más</p>}
        </div>
      );
    }
    if (typeof val === 'object') return <ResultadoKV datos={val} />;
    return <span className="font-semibold">{String(val)}</span>;
  };

  return (
    <div className="space-y-1.5">
      {Object.entries(datos).map(([k, v]) => (
        <div key={k}>
          <p className="text-[11px] text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</p>
          <div className="text-sm">{renderValue(v)}</div>
        </div>
      ))}
    </div>
  );
}

export default function AsistenteInformes({ currentUser }) {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [expanded, setExpanded] = useState({});
  const [periodos, setPeriodos] = useState({});
  const { role } = useUserRole();

  const informesFiltrados = INFORMES_CONFIG.filter(inf => inf.roles.includes(role));

  const generarInforme = async (informe) => {
    setLoading(prev => ({ ...prev, [informe.id]: true }));
    try {
      const toolInput = informe.tool === 'generar_resumen_ejecutivo'
        ? { periodo: periodos[informe.id] || 'mes' }
        : {};
      const resp = await base44.functions.invoke('asistenteHerramientas', {
        tool_name: informe.tool,
        tool_input: toolInput,
      });
      setResults(prev => ({ ...prev, [informe.id]: resp?.data?.result || resp?.data }));
      setExpanded(prev => ({ ...prev, [informe.id]: true }));
    } catch (err) {
      setResults(prev => ({ ...prev, [informe.id]: { error: err.message } }));
    } finally {
      setLoading(prev => ({ ...prev, [informe.id]: false }));
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {informesFiltrados.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">No hay informes disponibles para tu rol</p>
      )}

      {informesFiltrados.map(informe => {
        const Icon = informe.icon;
        const isLoading = loading[informe.id];
        const result = results[informe.id];
        const isExpanded = expanded[informe.id];

        return (
          <div key={informe.id} className="rounded-xl border bg-card overflow-hidden">
            <div className="p-3 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{informe.titulo}</p>
                <p className="text-xs text-muted-foreground">{informe.descripcion}</p>

                {/* Selector de período si aplica */}
                {informe.periodos && (
                  <div className="flex gap-1 mt-1.5">
                    {informe.periodos.map(p => (
                      <button
                        key={p}
                        onClick={() => setPeriodos(prev => ({ ...prev, [informe.id]: p }))}
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] capitalize transition-colors',
                          (periodos[informe.id] || 'mes') === p
                            ? 'bg-blue-600 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button
                size="sm"
                variant={result ? 'outline' : 'default'}
                className="h-7 text-xs shrink-0"
                onClick={() => generarInforme(informe)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Generar'}
              </Button>
            </div>

            {result && (
              <>
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [informe.id]: !isExpanded }))}
                  className="w-full flex items-center justify-between px-3 py-1.5 border-t border-border text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  <span>Ver resultados</span>
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-border">
                    <ResultadoKV datos={result} />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}