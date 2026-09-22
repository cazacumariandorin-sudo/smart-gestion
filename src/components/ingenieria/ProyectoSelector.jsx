import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Building2 } from 'lucide-react';

export function useIngenieriaProyectos() {
  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['ing-obras'],
    queryFn: async () => base44.entities.Obra.filter({ es_proyecto_ingenieria: true }, '-updated_date', 100),
  });
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
      {obras.map(o => (
        <option key={o.id} value={o.id}>{o.name?.trim()} {o.numero_proyecto ? `(${o.numero_proyecto})` : ''}</option>
      ))}
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