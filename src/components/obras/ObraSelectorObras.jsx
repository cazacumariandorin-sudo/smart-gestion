/**
 * ObraSelectorObras — Selector unificado de obras civiles + solar + opciones fijas.
 * Props:
 *   value: { obra_id, obra_name, obra_tipo } | string (project legacy)
 *   onChange({ obra_id, obra_name, obra_tipo, project }): callback
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';

const FIXED = [
  { id: '__oficina', name: '🏢 Oficina', tipo: 'oficina' },
  { id: '__almacen', name: '📦 Almacén', tipo: 'almacen' },
  { id: '__otro', name: '📍 Otro', tipo: 'otro' },
];

export default function ObraSelectorObras({ value, onChange, placeholder = 'Seleccionar obra...', triggerClassName, clientFilter, onClientDetected }) {
  const { data: obrasCivilesRaw = [] } = useQuery({
    queryKey: ['obras-selector'],
    queryFn: async () => {
      const all = await base44.entities.Obra.list('name', 300);
      return all.filter(o => o.status !== 'finalizada');
    },
    staleTime: 5 * 60 * 1000,
  });
  const { data: obrasSolarRaw = [] } = useQuery({
    queryKey: ['solar-obras-selector'],
    queryFn: async () => {
      const all = await base44.entities.SolarObra.list('name', 300);
      return all.filter(o => o.status !== 'finalizada');
    },
    staleTime: 5 * 60 * 1000,
  });

  // Filtrado por cliente cuando se proporciona clientFilter (vínculo cliente↔obra)
  const obrasCiviles = clientFilter
    ? obrasCivilesRaw.filter(o => o.client_id === clientFilter)
    : obrasCivilesRaw;
  const obrasSolar = clientFilter
    ? obrasSolarRaw.filter(o => o.client_id === clientFilter)
    : obrasSolarRaw;

  const handleChange = (val) => {
    if (!val) { onChange({ obra_id: null, obra_name: '', obra_tipo: 'otro', project: '' }); return; }
    const civil = obrasCiviles.find(o => o.id === val);
    if (civil) {
      onClientDetected?.({ client_id: civil.client_id || '', client_name: civil.client_name || '' });
      onChange({ obra_id: civil.id, obra_name: civil.name, obra_tipo: 'obra_civil', project: civil.name });
      return;
    }
    const solar = obrasSolar.find(o => o.id === val);
    if (solar) {
      onClientDetected?.({ client_id: solar.client_id || '', client_name: solar.client_name || '' });
      onChange({ obra_id: solar.id, obra_name: solar.name, obra_tipo: 'solar', project: solar.name });
      return;
    }
    const fixed = FIXED.find(f => f.id === val);
    if (fixed) { onChange({ obra_id: null, obra_name: fixed.name.replace(/^[^ ]+ /, ''), obra_tipo: fixed.tipo, project: fixed.name.replace(/^[^ ]+ /, '') }); return; }
  };

  // Compute current select value (id) from obra_id or legacy project
  const currentVal = value?.obra_id
    || (FIXED.find(f => f.tipo === value?.obra_tipo)?.id)
    || '';

  return (
    <MobileSelect value={currentVal} onValueChange={handleChange} placeholder={placeholder} triggerClassName={triggerClassName}>
      {obrasCiviles.length > 0 &&
        <MobileSelectItem value="__header_civil" disabled className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-1 pointer-events-none select-none">OBRAS CIVILES</MobileSelectItem>
      }
      {obrasCiviles.map(o => (
        <MobileSelectItem key={o.id} value={o.id}>🏗 {o.name}{o.status === 'pausada' ? ' (pausada)' : ''}</MobileSelectItem>
      ))}
      {obrasSolar.length > 0 &&
        <MobileSelectItem value="__header_solar" disabled className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider py-1 pointer-events-none select-none">OBRAS SOLARES</MobileSelectItem>
      }
      {obrasSolar.map(o => (
        <MobileSelectItem key={o.id} value={o.id}>☀️ {o.name}{o.status === 'pausada' ? ' (pausada)' : ''}</MobileSelectItem>
      ))}
      {FIXED.map(f => (
        <MobileSelectItem key={f.id} value={f.id}>{f.name}</MobileSelectItem>
      ))}
    </MobileSelect>
  );
}