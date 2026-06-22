import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Shield, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';

const CATEGORIA_LABELS = {
  acceso: 'Acceso', vacaciones: 'Vacaciones', fichajes: 'Fichajes',
  obras: 'Obras', economico: 'Económico', seguridad: 'Seguridad',
  datos: 'Datos', general: 'General'
};

const TIPO_COLORS = {
  obligatoria: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300',
  interna: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300',
  recomendada: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300',
};

const ESTADO_CONFIG = {
  cumplida: { label: 'Cumplida', icon: CheckCircle, color: 'text-green-600' },
  incumplida: { label: 'Incumplida', icon: XCircle, color: 'text-red-600' },
  no_verificada: { label: 'No verificada', icon: Clock, color: 'text-muted-foreground' },
  pendiente_decision: { label: 'Decisión pendiente', icon: AlertTriangle, color: 'text-amber-600' },
};

function ReglaCard({ regla, onDecidir, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const estado = ESTADO_CONFIG[regla.estado_cumplimiento] || ESTADO_CONFIG.no_verificada;
  const EstadoIcon = estado.icon;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      regla.estado_cumplimiento === 'incumplida' ? 'border-red-200 dark:border-red-800' :
      regla.estado_cumplimiento === 'pendiente_decision' ? 'border-amber-200 dark:border-amber-800' :
      'border-border'
    }`}>
      <button
        className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start gap-3">
          <EstadoIcon className={`w-4 h-4 mt-0.5 shrink-0 ${estado.color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs text-muted-foreground">{regla.codigo}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TIPO_COLORS[regla.tipo]}`}>
                {regla.tipo}
              </span>
              <Badge variant="outline" className="text-xs">{CATEGORIA_LABELS[regla.categoria] || regla.categoria}</Badge>
            </div>
            <p className="font-medium text-sm">{regla.titulo}</p>
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border bg-muted/20">
          {regla.descripcion && (
            <p className="text-sm text-muted-foreground pt-3">{regla.descripcion}</p>
          )}
          {regla.decision_tomada && (
            <div className="text-xs p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <span className="font-semibold text-blue-700 dark:text-blue-300">Decisión:</span>{' '}
              <span className="text-blue-600 dark:text-blue-400">{regla.decision_tomada}</span>
              {regla.decision_por && <span className="text-muted-foreground ml-2">— {regla.decision_por}</span>}
            </div>
          )}
          {regla.notas && (
            <p className="text-xs text-muted-foreground italic">{regla.notas}</p>
          )}
          {regla.decision_requerida && (
            <Button size="sm" variant="outline" onClick={() => onDecidir(regla)} className="gap-2">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Registrar decisión
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReglasDeOro() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroEstado, setFiltroEstado] = useState(() => {
    const f = searchParams.get('filtro');
    return ['cumplida', 'incumplida', 'pendiente_decision', 'no_verificada'].includes(f) ? f : 'todas';
  });
  const [reglaDecision, setReglaDecision] = useState(null);
  const [textoDecision, setTextoDecision] = useState('');

  const { data: reglas = [], isLoading } = useQuery({
    queryKey: ['reglas-de-oro'],
    queryFn: () => base44.entities.ReglaDeOro.list('codigo', 200),
  });

  const registrarDecision = useMutation({
    mutationFn: async ({ regla, decision }) => {
      const me = await base44.auth.me();
      return base44.entities.ReglaDeOro.update(regla.id, {
        decision_tomada: decision,
        decision_fecha: new Date().toISOString(),
        decision_por: me.email,
        estado_cumplimiento: 'cumplida',
      });
    },
    onSuccess: () => {
      toast.success('Decisión registrada correctamente');
      qc.invalidateQueries({ queryKey: ['reglas-de-oro'] });
      setReglaDecision(null);
      setTextoDecision('');
    },
  });

  const marcarEstado = useMutation({
    mutationFn: ({ id, estado }) => base44.entities.ReglaDeOro.update(id, {
      estado_cumplimiento: estado,
      ultima_verificacion: new Date().toISOString(),
    }),
    onSuccess: () => {
      toast.success('Estado actualizado');
      qc.invalidateQueries({ queryKey: ['reglas-de-oro'] });
    },
  });

  const reglasFiltradas = reglas.filter(r => {
    if (!r.activa) return false;
    if (filtroCategoria !== 'todas' && r.categoria !== filtroCategoria) return false;
    if (filtroEstado !== 'todas' && r.estado_cumplimiento !== filtroEstado) return false;
    return true;
  });

  const contadores = {
    incumplidas: reglas.filter(r => r.activa && r.estado_cumplimiento === 'incumplida').length,
    pendientes_decision: reglas.filter(r => r.activa && r.decision_requerida && !r.decision_tomada).length,
    no_verificadas: reglas.filter(r => r.activa && r.estado_cumplimiento === 'no_verificada').length,
  };

  const categorias = [...new Set(reglas.map(r => r.categoria).filter(Boolean))];

  return (
    <div className="max-w-4xl mx-auto px-4 pb-10">
      <PageHeader
        title="Reglas de Oro"
        subtitle="Gobernanza · Cumplimiento del sistema"
      />

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className={`p-3 rounded-xl border text-center ${contadores.incumplidas > 0 ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' : 'bg-muted border-border'}`}>
          <div className={`text-2xl font-bold ${contadores.incumplidas > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{contadores.incumplidas}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Incumplidas</div>
        </div>
        <div className={`p-3 rounded-xl border text-center ${contadores.pendientes_decision > 0 ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-muted border-border'}`}>
          <div className={`text-2xl font-bold ${contadores.pendientes_decision > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{contadores.pendientes_decision}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Decisión pendiente</div>
        </div>
        <div className="p-3 rounded-xl border text-center bg-muted border-border">
          <div className="text-2xl font-bold text-muted-foreground">{contadores.no_verificadas}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Sin verificar</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1 flex-wrap">
          {['todas', ...categorias].map(cat => (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(cat)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filtroCategoria === cat
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {cat === 'todas' ? 'Todas' : CATEGORIA_LABELS[cat] || cat}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap ml-auto">
          {['todas', 'cumplida', 'incumplida', 'pendiente_decision', 'no_verificada'].map(est => (
            <button
              key={est}
              onClick={() => setFiltroEstado(est)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filtroEstado === est
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {est === 'todas' ? 'Todos los estados' : ESTADO_CONFIG[est]?.label || est}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : reglasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed rounded-xl">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {reglas.length === 0
              ? 'No hay reglas de oro cargadas aún'
              : 'No hay reglas con estos filtros'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reglasFiltradas.map(regla => (
            <ReglaCard
              key={regla.id}
              regla={regla}
              onDecidir={setReglaDecision}
              defaultExpanded={filtroEstado === 'pendiente_decision' && regla.decision_requerida && !regla.decision_tomada}
            />
          ))}
        </div>
      )}

      {/* Dialog decisión */}
      <Dialog open={!!reglaDecision} onOpenChange={() => setReglaDecision(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Registrar decisión de Dirección
            </DialogTitle>
          </DialogHeader>
          {reglaDecision && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted text-sm">
                <span className="font-mono text-xs text-muted-foreground">{reglaDecision.codigo}</span>
                <p className="font-medium mt-1">{reglaDecision.titulo}</p>
              </div>
              <Textarea
                placeholder="Describe la decisión tomada por Dirección..."
                value={textoDecision}
                onChange={e => setTextoDecision(e.target.value)}
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReglaDecision(null)}>Cancelar</Button>
            <Button
              disabled={!textoDecision.trim() || registrarDecision.isPending}
              onClick={() => registrarDecision.mutate({ regla: reglaDecision, decision: textoDecision.trim() })}
            >
              Guardar decisión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}