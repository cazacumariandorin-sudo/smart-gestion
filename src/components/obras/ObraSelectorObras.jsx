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

export default function ObraSelectorObras({ value, onChange, placeholder = 'Seleccionar obra...', triggerClassName, clientFilter, onClientDetected, incluirFinalizadas = false }) {
  // Sin caché: cada vez que se abre el selector se vuelve a pedir la lista completa,
  // de modo que una obra recién creada aparece inmediatamente.
  const { data: obrasCivilesRaw = [] } = useQuery({
    queryKey: ['obras-selector'],
    queryFn: () => base44.entities.Obra.list('name', 500),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const { data: obrasSolarRaw = [] } = useQuery({
    queryKey: ['solar-obras-selector'],
    queryFn: () => base44.entities.SolarObra.list('name', 500),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Filtrado por cliente cuando se proporciona clientFilter (vínculo cliente↔obra)
  const porCliente = (lista) => (clientFilter ? lista.filter(o => o.client_id === clientFilter) : lista);

  const obrasCivilesTodas = porCliente(obrasCivilesRaw);
  const obrasSolar = porCliente(obrasSolarRaw.filter(o => o.status !== 'finalizada'));
  const obrasCiviles = obrasCivilesTodas.filter(o => o.status !== 'finalizada');
  const obrasFinalizadas = incluirFinalizadas
    ? obrasCivilesTodas.filter(o => o.status === 'finalizada')
    : [];

  const handleChange = (val) => {
    if (!val) { onChange({ obra_id: null, obra_name: '', obra_tipo: 'otro', project: '' }); return; }
    const civil = obrasCivilesTodas.find(o => o.id === val);
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

  // Si el fichaje apunta a una obra que ya no está en la lista (p. ej. obra eliminada),
  // se añade igualmente para no perder el valor guardado.
  const idActual = value?.obra_id || '';
  const obraActualHuerfana = idActual
    && !obrasCivilesTodas.some(o => o.id === idActual)
    && !obrasSolar.some(o => o.id === idActual)
    ? { id: idActual, name: value?.obra_name || 'Obra actual' }
    : null;

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
      {obrasFinalizadas.map(o => (
        <MobileSelectItem key={o.id} value={o.id}>🏗 {o.name} (finalizada)</MobileSelectItem>
      ))}
      {obraActualHuerfana && (
        <MobileSelectItem value={obraActualHuerfana.id}>🏗 {obraActualHuerfana.name}</MobileSelectItem>
      )}
      {FIXED.map(f => (
        <MobileSelectItem key={f.id} value={f.id}>{f.name}</MobileSelectItem>
      ))}
    </MobileSelect>
  );
}