import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { HardHat, ChevronLeft } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import ProyectoSelector, { useIngenieriaProyectos } from '@/components/ingenieria/ProyectoSelector';
import ImplementacionResumen from '@/components/ingenieria/implementacion/ImplementacionResumen';
import ImplementacionAvance from '@/components/ingenieria/implementacion/ImplementacionAvance';
import ImplementacionMateriales from '@/components/ingenieria/implementacion/ImplementacionMateriales';
import ImplementacionInformes from '@/components/ingenieria/implementacion/ImplementacionInformes';
import ImplementacionFotos from '@/components/ingenieria/implementacion/ImplementacionFotos';
import ImplementacionHoras from '@/components/ingenieria/implementacion/ImplementacionHoras';
import ImplementacionDiscrepancias from '@/components/ingenieria/implementacion/ImplementacionDiscrepancias';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'avance', label: 'Avance y actividad' },
  { id: 'materiales', label: 'Materiales pendientes' },
  { id: 'informes', label: 'Informes y documentos' },
  { id: 'fotos', label: 'Fotos y verificaciones' },
  { id: 'horas', label: 'Horas y actividad' },
  { id: 'discrepancias', label: 'Discrepancias' },
];

export default function IngenieriaImplementacion() {
  const [params, setParams] = useSearchParams();
  const obraId = params.get('obra_id') || '';
  const [tab, setTab] = useState('resumen');
  const { obras, isLoading: cargandoObras } = useIngenieriaProyectos();

  const obra = obras.find((o) => o.id === obraId) || null;

  const { data: materiales = [] } = useQuery({
    queryKey: ['impl-materiales', obraId],
    queryFn: () => base44.entities.MaterialPendiente.filter({ obra_id: obraId }, '-fecha_solicitud', 500),
    enabled: !!obraId,
  });
  const { data: partes = [] } = useQuery({
    queryKey: ['impl-partes', obraId],
    queryFn: () => base44.entities.ParteDiarioObra.filter({ obra_id: obraId }, '-fecha', 300),
    enabled: !!obraId,
  });
  const { data: fotosRaw = [] } = useQuery({
    queryKey: ['impl-fotos', obraId],
    queryFn: () => base44.entities.FotoProyecto.filter({ proyecto_id: obraId }, '-fecha_foto', 300),
    enabled: !!obraId,
  });
  const { data: fichajes = [] } = useQuery({
    queryKey: ['impl-fichajes', obraId],
    queryFn: () => base44.entities.Fichaje.filter({ obra_id: obraId }, '-date', 500),
    enabled: !!obraId,
  });
  const { data: previsiones = [] } = useQuery({
    queryKey: ['impl-previsiones', obraId],
    queryFn: () => base44.entities.PrevisionObra.filter({ obra_id: obraId }, '-fecha_inicio', 100),
    enabled: !!obraId,
  });
  const { data: presupuestos = [] } = useQuery({
    queryKey: ['impl-presupuestos', obraId],
    queryFn: () => base44.entities.Presupuesto.filter({ obra_id: obraId }, '-fecha', 100),
    enabled: !!obraId,
  });
  const { data: discrepancias = [] } = useQuery({
    queryKey: ['impl-discrepancias', obraId],
    queryFn: () => base44.entities.Discrepancia.filter({ obra_id: obraId }, '-created_date', 300),
    enabled: !!obraId,
  });
  const { data: documentos = [] } = useQuery({
    queryKey: ['impl-documentos', obraId],
    queryFn: () => base44.entities.MaterialDocumentoOrigen.filter({ proyecto_ingenieria_id: obraId }, '-created_date', 200),
    enabled: !!obraId,
  });

  const fotos = useMemo(() => fotosRaw.filter((f) => !f.eliminada), [fotosRaw]);

  return (
    <div>
      <PageHeader
        title="Implementación proyectos"
        subtitle="Seguimiento operativo del proyecto por obra"
        icon={HardHat}
      />

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <ProyectoSelector value={obraId} onChange={(id) => setParams(id ? { obra_id: id } : {})} />
          <Link to="/ingenieria" className="inline-flex items-center gap-1 text-xs text-primary">
            <ChevronLeft className="w-3 h-3" /> Volver a ObraCheck
          </Link>
          {obra && (
            <span className="text-xs text-muted-foreground ml-auto">
              {obra._tipo === 'solar' ? '☀ Solar' : '🏗 Civil'} · {obra.numero_proyecto || obra.code || 's/n'}
            </span>
          )}
        </div>

        {cargandoObras ? (
          <div className="p-8 text-center text-muted-foreground">Cargando proyectos…</div>
        ) : !obra ? (
          <div className="p-8 text-center bg-card border border-border rounded-xl">
            <HardHat className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Selecciona un proyecto</p>
            <p className="text-xs text-muted-foreground mt-1">
              El seguimiento reúne los datos de cada módulo usando el proyecto como vínculo.
            </p>
          </div>
        ) : (
          <>
            <div className="border-b border-border -mx-1 px-1 overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-2 text-sm rounded-t-lg border-b-2 transition-colors ${
                      tab === t.id
                        ? 'border-teal-600 text-teal-700 dark:text-teal-400 font-medium'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'resumen' && (
              <ImplementacionResumen
                obra={obra}
                materiales={materiales}
                partes={partes}
                fotos={fotos}
                fichajes={fichajes}
                previsiones={previsiones}
                presupuestos={presupuestos}
                discrepancias={discrepancias}
              />
            )}
            {tab === 'avance' && <ImplementacionAvance partes={partes} previsiones={previsiones} fichajes={fichajes} />}
            {tab === 'materiales' && <ImplementacionMateriales materiales={materiales} presupuestos={presupuestos} />}
            {tab === 'informes' && <ImplementacionInformes partes={partes} documentos={documentos} />}
            {tab === 'fotos' && <ImplementacionFotos fotos={fotos} />}
            {tab === 'horas' && <ImplementacionHoras fichajes={fichajes} previsiones={previsiones} />}
            {tab === 'discrepancias' && <ImplementacionDiscrepancias discrepancias={discrepancias} obra={obra} />}
          </>
        )}
      </div>
    </div>
  );
}