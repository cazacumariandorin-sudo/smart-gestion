import { useState, useCallback, useEffect, useMemo } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Plus, Search, FileBarChart2, Receipt, ChevronDown, ChevronRight, Building2, CalendarRange, Sparkles, Wallet, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import NotaGastoForm from '@/components/gastos/NotaGastoForm';
import NotaGastoCard from '@/components/gastos/NotaGastoCard';
import NotaGastoDetalle from '@/components/gastos/NotaGastoDetalle';
import InformeGastos from '@/components/gastos/InformeGastos';
import ResumenPeriodoGastos from '@/components/gastos/ResumenPeriodoGastos';
import CiclosMensualesPanel from '@/components/gastos/CiclosMensualesPanel';
import BannerCicloActivo, { calcularCiclo } from '@/components/gastos/BannerCicloActivo';
import PrecisionPanel from '@/components/gastos/PrecisionPanel';
import MisAdelantosTab from '@/components/adelantos/MisAdelantosTab';
import { useAuth } from '@/lib/AuthContext';
import { useTecnicoName } from '@/hooks/useTecnicoName';

const ESTADOS = ['todos', 'borrador', 'pendiente', 'aprobado_gerencia', 'en_administracion', 'pagada', 'rechazada'];

const ESTADO_LABELS = {
  todos: 'Todos',
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  aprobado_gerencia: 'Aprobado por gerencia',
  en_administracion: 'En administración',
  pagada: 'Pagada',
  rechazada: 'Rechazada',
};

const ESTADO_COLORS = {
  borrador: 'bg-slate-100 text-slate-600 border-slate-200',
  pendiente: 'bg-blue-50 text-blue-700 border-blue-200',
  aprobado_gerencia: 'bg-amber-50 text-amber-700 border-amber-200',
  en_administracion: 'bg-purple-50 text-purple-700 border-purple-200',
  pagada: 'bg-green-50 text-green-700 border-green-200',
  rechazada: 'bg-red-50 text-red-700 border-red-200',
};
const CATEGORIAS = ['todas', 'material', 'combustible', 'peaje', 'parking', 'otros'];

function OperarioGroup({ operario, notas, onVerNota, isOpen, onToggle }) {
  const total = notas.reduce((s, n) => s + (n.importe || 0), 0);
  const pendientes = notas.filter(n => n.estado === 'pendiente').length;
  
  return (
    <Card className="mb-3">
      <button
        onClick={onToggle}
        className="w-full"
      >
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {isOpen ? <ChevronDown className="w-5 h-5 text-muted-foreground" /> : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-base">{operario.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {notas.length} registro{notas.length !== 1 ? 's' : ''} • {total.toFixed(2)} €
                  {pendientes > 0 && <span className="ml-2 text-amber-600">• {pendientes} pendiente{pendientes > 1 ? 's' : ''}</span>}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              {notas.length} notas
            </Badge>
          </div>
        </CardHeader>
      </button>
      
      {isOpen && (
        <CardContent className="px-4 pb-4 pt-0">
          <div className="space-y-2 mt-2">
            {notas.map(nota => (
              <NotaGastoCard key={nota.id} nota={nota} onVer={onVerNota} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function NotasGastos() {
  const { user } = useAuth();
  const { isAdmin, isOperario, isGerencia, isDirComercial, isJefeObra, isAdministracion, role } = useUserRole();
  const isTecnico = role === 'técnico';
  const [searchParams] = useSearchParams();
  const vistaAdmin = searchParams.get('vista') === 'admin' && (isAdmin || isGerencia || isDirComercial || isAdministracion);
  const { getTecnicoName, tecnicos } = useTecnicoName();
  const qc = useQueryClient();

  const onRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['notas_gasto'] });
  }, [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);

  // Buscar técnico por email o usar el usuario actual si es operario
  const miTecnico = tecnicos.find(op => op.user_email === user?.email);
  const miNombre = miTecnico?.name || user?.full_name || user?.email || '';
  
  // Para técnicos, usar su ID de usuario si no tienen registro en Operario
  const operarioId = miTecnico?.id || (isOperario ? user?.id : null);

  const [showForm, setShowForm] = useState(false);
  const [notaSeleccionada, setNotaSeleccionada] = useState(null);
  // tab: 'notas' (registros) | 'ciclos' (ciclos mensuales 26→25) | 'informe'
  const [tab, setTab] = useState('notas');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroOperario, setFiltroOperario] = useState('todos');
  const [filtroObra, setFiltroObra] = useState('todas');
  const [filtroSinObra, setFiltroSinObra] = useState(false);
  const [operarioAbierto, setOperarioAbierto] = useState(null);

  // Ciclo activo por defecto; gerencia/admin puede cambiar a ciclos históricos
  const cicloActivoMes = useMemo(() => calcularCiclo(new Date()).cicloMes, []);
  const [filtroCiclo, setFiltroCiclo] = useState(cicloActivoMes);

  // Calcula el ciclo de un registro a partir de ciclo_mes (denormalizado) o de su fecha
  const cicloDeRegistro = useCallback((n) => {
    if (n.ciclo_mes) return n.ciclo_mes;
    const ref = n.fecha_documento || n.fecha_creacion_real || n.created_date;
    if (!ref) return null;
    const fecha = new Date(ref);
    if (isNaN(fecha.getTime())) return null;
    return calcularCiclo(fecha).cicloMes;
  }, []);

  const { data: notasRaw = [], isLoading } = useQuery({
    queryKey: ['notas_gasto'],
    queryFn: () => base44.entities.RegistroGasto.list('-created_date', 1000),
  });

  const { data: obrasRaw = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list(),
  });
  const { data: solarObrasRaw = [] } = useQuery({
    queryKey: ['solar_obras_gastos'],
    queryFn: () => base44.entities.SolarObra.list('name', 200),
    enabled: isAdmin || isGerencia || isDirComercial || isJefeObra || isAdministracion,
  });
  const todasObras = [...obrasRaw, ...solarObrasRaw.map(o => ({ ...o, _tipo: 'solar' }))];

  // Lista de ciclos disponibles (activo + todos los que aparecen en los registros)
  const ciclosDisponibles = useMemo(() => {
    const set = new Set([cicloActivoMes]);
    notasRaw.forEach(n => {
      const c = cicloDeRegistro(n);
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [notasRaw, cicloActivoMes, cicloDeRegistro]);

  const operarioActual = {
    id: operarioId || user?.id,
    name: miTecnico?.name || user?.full_name || user?.email?.split('@')[0],
    user_email: user?.email,
  };
  
  // Verificar si puede crear: técnicos siempre pueden, admins/gerencia también
  const puedeCrearRegistro = isOperario || isTecnico || isAdmin || isGerencia || isDirComercial || isJefeObra || isAdministracion;

  // Notas filtradas por TODO excepto operario (base para chips de conteo por operario)
  const notasBase = notasRaw.filter(n => {
    if (!vistaAdmin && !isAdmin && !isGerencia && !isDirComercial && !isTecnico) {
      if (n.created_by !== user?.email && n.operario_id !== operarioId) return false;
    }
    if (isTecnico && n.created_by !== user?.email && n.operario_id !== operarioId) return false;
    const txt = busqueda.toLowerCase();
    const matchBusq = !txt || (n.numero_nota || '').toLowerCase().includes(txt) ||
      (n.nombre_comercio || '').toLowerCase().includes(txt) ||
      (n.concepto || '').toLowerCase().includes(txt) ||
      (n.operario_name || '').toLowerCase().includes(txt);
    const matchEstado = filtroEstado === 'todos' || n.estado === filtroEstado;
    const matchCat = filtroCategoria === 'todas' || n.categoria === filtroCategoria;
    const matchObra = filtroObra === 'todas' || n.obra_id === filtroObra;
    const matchSinObra = !filtroSinObra || n.sin_obra === true;
    const matchCiclo = filtroCiclo === 'todos' || cicloDeRegistro(n) === filtroCiclo;
    return matchBusq && matchEstado && matchCat && matchObra && matchSinObra && matchCiclo;
  });

  const notas = notasBase.filter(n => filtroOperario === 'todos' || n.operario_id === filtroOperario);

  // Conteo por operario para los chips de filtro rápido
  const conteoOperarios = useMemo(() => {
    const map = {};
    notasBase.forEach(n => {
      const opId = n.operario_id || 'sin-asignar';
      if (!map[opId]) map[opId] = { id: opId, name: n.operario_name || 'Sin asignar', count: 0, total: 0 };
      map[opId].count++;
      map[opId].total += n.importe || 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [notasBase]);

  const totalFiltrado = notas.reduce((s, n) => s + (n.importe || 0), 0);
  const pendientes = notasRaw.filter(n => n.estado === 'pendiente').length;
  const pendientesPrecision = notasRaw.filter(n => n.precisa_precision && n.archivos?.length > 0).length;

  const operariosConNotas = {};
  notas.forEach(nota => {
    const opId = nota.operario_id || 'sin-asignar';
    const opName = nota.operario_name || 'Sin asignar';
    if (!operariosConNotas[opId]) {
      operariosConNotas[opId] = { id: opId, name: opName, notas: [] };
    }
    operariosConNotas[opId].notas.push(nota);
  });

  // Auto-expandir si solo hay 1 operario (p.ej. operario viendo sus propios gastos)
  useEffect(() => {
    const ids = Object.keys(operariosConNotas);
    if (ids.length === 1 && !operarioAbierto) {
      setOperarioAbierto(ids[0]);
    }
  }, [Object.keys(operariosConNotas).join(',')]);

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Registros de Gasto"
        subtitle={isAdmin && pendientes > 0 ? `${pendientes} pendiente${pendientes > 1 ? 's' : ''} de validar` : undefined}
        hideBack={true}
        actions={
          <div className="flex gap-2">
            <Button
              variant={tab === 'informe' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(tab === 'informe' ? 'notas' : 'informe')}
              className="gap-1.5"
            >
              <FileBarChart2 className="w-4 h-4" />
              <span className="hidden sm:inline">Informe</span>
            </Button>
            <Button
              variant={tab === 'ciclos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(tab === 'ciclos' ? 'notas' : 'ciclos')}
              className="gap-1.5"
            >
              <CalendarRange className="w-4 h-4" />
              <span className="hidden sm:inline">Ciclos</span>
            </Button>
            {!vistaAdmin && (
              <Button
                variant={tab === 'mis-adelantos' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTab(tab === 'mis-adelantos' ? 'notas' : 'mis-adelantos')}
                className="gap-1.5"
              >
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">Mis adelantos</span>
              </Button>
            )}
            {(isAdmin || isGerencia || isAdministracion) && (
              <Button
                variant={tab === 'precision' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTab(tab === 'precision' ? 'notas' : 'precision')}
                className={cn('gap-1.5', pendientesPrecision > 0 && tab !== 'precision' && 'border-amber-400 text-amber-700')}
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Precisión</span>
                {pendientesPrecision > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {pendientesPrecision}
                  </span>
                )}
              </Button>
            )}
            <Button
              onClick={() => setShowForm(true)}
              size="sm"
              className="gap-1.5"
              disabled={!puedeCrearRegistro}
            >
              <Plus className="w-4 h-4" /> Nuevo Registro
            </Button>
          </div>
        }
      />
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="p-4 sm:p-6 lg:p-8">

      {tab === 'mis-adelantos' ? (
        <MisAdelantosTab />
      ) : tab === 'ciclos' ? (
        <CiclosMensualesPanel />
      ) : tab === 'precision' ? (
        <PrecisionPanel notas={notasRaw} onVerNota={setNotaSeleccionada} />
      ) : (
        <>
          <div className="mb-4">
            <BannerCicloActivo
              cicloMes={filtroCiclo}
              ciclosDisponibles={ciclosDisponibles}
              onCicloChange={setFiltroCiclo}
              permitirCambiar={ciclosDisponibles.length > 1}
            />
          </div>

          {!vistaAdmin && (
            <ResumenPeriodoGastos
              operario={operarioActual}
              notas={notasRaw}
              isAdmin={isAdmin}
              onPeriodosCerrados={() => qc.invalidateQueries({ queryKey: ['notas_gasto'] })}
            />
          )}

          {tab === 'informe' && (
            <div className="mb-6">
              <InformeGastos
                operario={operarioActual}
                notas={notasRaw}
                tecnicos={tecnicos}
                isAdmin={isAdmin}
                isGerencia={isGerencia}
                ciclosDisponibles={ciclosDisponibles}
              />
            </div>
          )}

          {/* Chips de filtro rápido por operario (admin/gerencia) */}
          {(isAdmin || isGerencia || isAdministracion) && conteoOperarios.length > 0 && (
            <div className="mb-4 -mx-1 px-1 overflow-x-auto pb-1">
              <div className="flex gap-2 min-w-max">
                <button
                  onClick={() => setFiltroOperario('todos')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap',
                    filtroOperario === 'todos'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  Todos
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-black/10 text-[10px] font-bold">
                    {notasBase.length}
                  </span>
                </button>
                {conteoOperarios.map(op => (
                  <button
                    key={op.id}
                    onClick={() => setFiltroOperario(op.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors whitespace-nowrap',
                      filtroOperario === op.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    )}
                  >
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span className="max-w-28 truncate">{op.name}</span>
                    <span className="ml-0.5 inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-black/10 text-[10px] font-bold">
                      {op.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por número, comercio, concepto..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            <MobileSelect value={filtroEstado} onValueChange={setFiltroEstado} placeholder="Estado" triggerClassName="w-44">
              {ESTADOS.map(e => <MobileSelectItem key={e} value={e}>{ESTADO_LABELS[e] || e}</MobileSelectItem>)}
            </MobileSelect>
            <MobileSelect value={filtroCategoria} onValueChange={setFiltroCategoria} placeholder="Categoría" triggerClassName="w-36">
              {CATEGORIAS.map(c => <MobileSelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MobileSelectItem>)}
            </MobileSelect>
            <MobileSelect value={filtroObra} onValueChange={setFiltroObra} placeholder="Obra" triggerClassName="w-40">
              <MobileSelectItem value="todas">Todas las obras</MobileSelectItem>
              {todasObras.map(obra => (
                <MobileSelectItem key={obra.id} value={obra.id}>{obra.name}</MobileSelectItem>
              ))}
            </MobileSelect>
            {isAdmin && tecnicos.length > 0 && (
              <MobileSelect value={filtroOperario} onValueChange={setFiltroOperario} placeholder="Operario" triggerClassName="w-40">
                <MobileSelectItem value="todos">Todos los operarios</MobileSelectItem>
                {tecnicos.filter(op => op.active !== false).map(op => (
                  <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>
                ))}
              </MobileSelect>
            )}
            {isAdmin && (
              <button
                onClick={() => setFiltroSinObra(v => !v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors',
                  filtroSinObra
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-background border-border text-muted-foreground hover:border-orange-400 hover:text-orange-600'
                )}
              >
                <Building2 className="w-3.5 h-3.5" />
                Sin obra
              </button>
            )}
          </div>

          {notas.length > 0 && (
            <div className="flex items-center gap-3 mb-4 px-1 flex-wrap">
              <span className="text-sm text-muted-foreground">{Object.keys(operariosConNotas).length} operario{Object.keys(operariosConNotas).length !== 1 ? 's' : ''}</span>
              <span className="font-semibold text-sm">Total: {totalFiltrado.toFixed(2)} €</span>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : Object.keys(operariosConNotas).length === 0 ? (
            <div className="text-center py-16 border border-dashed rounded-xl">
              <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                {busqueda || filtroEstado !== 'todos' || filtroCategoria !== 'todas' || filtroOperario !== 'todos' || filtroObra !== 'todas'
                  ? 'No hay registros con estos filtros'
                  : 'No hay registros de gasto aún'}
              </p>
              <Button
                size="sm"
                onClick={() => setShowForm(true)}
                className="gap-1.5"
                disabled={!puedeCrearRegistro}
              >
                <Plus className="w-4 h-4" /> Crear primer registro
              </Button>
            </div>
          ) : (
            <div>
              {Object.values(operariosConNotas).map(operario => (
                <OperarioGroup
                  key={operario.id}
                  operario={operario}
                  notas={operario.notas}
                  onVerNota={setNotaSeleccionada}
                  isOpen={operarioAbierto === operario.id}
                  onToggle={() => setOperarioAbierto(operarioAbierto === operario.id ? null : operario.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      </div>
      <NotaGastoForm
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={(info) => {
          qc.invalidateQueries({ queryKey: ['notas_gasto'] });
          if (info?.operario_id) setOperarioAbierto(info.operario_id);
        }}
        operario={operarioActual}
        isAdmin={isAdmin}
        operarios={tecnicos}
      />

      {notaSeleccionada && (
        <NotaGastoDetalle
          nota={notaSeleccionada}
          isAdmin={isAdmin}
          operarios={tecnicos}
          open={!!notaSeleccionada}
          onClose={() => {
            setNotaSeleccionada(null);
            qc.invalidateQueries({ queryKey: ['notas_gasto'] });
          }}
        />
      )}
    </div>
  );
}