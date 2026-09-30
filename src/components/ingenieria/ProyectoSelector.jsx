import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2 } from 'lucide-react';

export function useIngenieriaProyectos() {
  const { data: obrasCiviles = [], isLoading: loadingObras } = useQuery({
    queryKey: ['ing-obras-todas'],
    queryFn: async () => base44.entities.Obra.filter({}, '-updated_date', 500),
  });
  const { data: obrasSolares = [], isLoading: loadingSolares } = useQuery({
    queryKey: ['ing-obras-solares'],
    queryFn: async () => base44.entities.SolarObra.filter({}, '-updated_date', 500),
  });
  // Fusiona civiles y solares. Ingeniería revisa/trabaja cualquier obra asignada,
  // no solo las marcadas como es_proyecto_ingenieria. Marca el origen para etiquetar.
  const obras = [
    ...obrasCiviles.map(o => ({ ...o, _tipo: 'obra_civil', _sourceEntity: 'Obra' })),
    ...obrasSolares.map(o => ({ ...o, _tipo: 'solar', _sourceEntity: 'SolarObra' })),
  ].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const isLoading = loadingObras || loadingSolares;
  return { obras, isLoading };
}

export default function ProyectoSelector({ value, onChange, className = '' }) {
  const { obras, isLoading } = useIngenieriaProyectos();
  if (isLoading) return <div className="text-sm text-muted-foreground">Cargando proyectos…</div>;
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      className={`h-10 rounded-md border border-input bg-background px-3 text-sm min-h-[40px] ${className}`}
      aria-label="Proyecto de ingeniería"
    >
      <option value="">— Selecciona proyecto —</option>
      {obras.map(o => {
        const etiqueta = o._tipo === 'solar' ? '☀ Solar' : '🏗 Civil';
        return (
          <option key={`${o._sourceEntity}:${o.id}`} value={o.id}>
            {etiqueta} · {o.name?.trim()} {o.numero_proyecto ? `(${o.numero_proyecto})` : o.code ? `(${o.code})` : ''}
          </option>
        );
      })}
    </select>
  );
}

export function ProyectoBadge({ obra }) {
  if (!obra) return null;
  return (
    <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Building2 className="w-4 h-4 text-teal-600" />
      <span className="font-medium text-foreground">{obra.name?.trim()}</span>
      {obra.numero_proyecto && <span className="text-xs">· {obra.numero_proyecto}</span>}
    </div>
  );
}