import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AutoCorrectTextarea from '@/components/ui/AutoCorrectTextarea';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import ObraSelectorObras from '@/components/obras/ObraSelectorObras';
import VoiceInputButton from '@/components/ui/VoiceInputButton';
import SimantecLogo from '@/components/SimantecLogo';
import CorrectorOrtograficoButton from '@/components/CorrectorOrtograficoButton';
import ParteFotosInput from './ParteFotosInput';
import ParteTecnicosDropdown from './ParteTecnicosDropdown';
import ParteTrabajosExtras from './ParteTrabajosExtras';
import SignatureCanvas from '@/components/workorders/SignatureCanvas';
import DesplazamientoFields from '@/components/partes/DesplazamientoFields';

export default function ParteDiarioForm({ editing, onSuccess, onCancel }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [obra, setObra] = useState(
    editing
      ? { obra_id: editing.obra_id, obra_name: editing.obra_name, obra_tipo: editing.obra_tipo || 'otro' }
      : { obra_id: null, obra_name: '', obra_tipo: 'otro' }
  );
  const [fecha, setFecha] = useState(editing?.fecha || new Date().toISOString().split('T')[0]);
  const [trabajosRealizados, setTrabajosRealizados] = useState(editing?.trabajos_realizados || '');
  const [materialesNecesarios, setMaterialesNecesarios] = useState(editing?.materiales_necesarios || '');
  const [trabajosPendientes, setTrabajosPendientes] = useState(editing?.trabajos_pendientes || '');
  const [fotos, setFotos] = useState(editing?.fotos || []);
  const [tecnicosAdicionales, setTecnicosAdicionales] = useState(editing?.tecnicos_adicionales || []);
  const [firmaUrl, setFirmaUrl] = useState(editing?.firma_url || '');
  const [trabajosExtras, setTrabajosExtras] = useState([]);
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [desplazamiento, setDesplazamiento] = useState({
    vehiculo_id: editing?.vehiculo_id || '',
    vehiculo_matricula: editing?.vehiculo_matricula || '',
    desplazamiento_tipo: editing?.desplazamiento_tipo || '',
    desplazamiento_valor: editing?.desplazamiento_valor ?? '',
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-parte-diario'],
    queryFn: () => base44.entities.Client.list('name', 200),
    staleTime: 5 * 60 * 1000,
  });

  const claveMensual = () => {
    const d = new Date(`${fecha}T00:00:00`);
    const anio = d.getFullYear();
    const mesNum = d.getMonth() + 1;
    const mesKey = `${anio}-${String(mesNum).padStart(2, '0')}`;
    return { anio, mesNum, mesKey };
  };

  const obtenerClienteDeObra = async () => {
    if (!obra.obra_id) return { client_id: '', client_name: '' };
    try {
      if (obra.obra_tipo === 'solar') {
        const s = await base44.entities.SolarObra.get(obra.obra_id);
        return { client_id: s.client_id || '', client_name: s.client_name || '' };
      }
      const o = await base44.entities.Obra.get(obra.obra_id);
      return { client_id: o.client_id || '', client_name: o.client_name || '' };
    } catch {
      return { client_id: '', client_name: '' };
    }
  };

  const persistCentralizados = async (parteId) => {
    const { anio, mesNum, mesKey } = claveMensual();
    const { client_id, client_name } = await obtenerClienteDeObra();
    const baseSolicitante = {
      obra_id: obra.obra_id, obra_name: obra.obra_name, obra_tipo: obra.obra_tipo,
      client_id, client_name,
      parte_id: parteId,
      fecha_solicitud: fecha,
      solicitado_por_email: user?.email,
      solicitado_por_nombre: user?.full_name || user?.email,
      solicitado_por_rol: user?.role,
      mes: mesKey, anio, mes_numero: mesNum,
    };

    const extrasValidos = trabajosExtras.filter((e) => e.descripcion?.trim());
    if (extrasValidos.length) {
      const payloadExtras = extrasValidos.map((e) => ({
        ...baseSolicitante,
        descripcion: e.descripcion.trim(),
        importe_estimado: e.importe ? Number(e.importe) : null,
        prioridad: e.prioridad || 'media',
        estado: 'pendiente',
      }));
      await base44.entities.TrabajoExtraObra.bulkCreate(payloadExtras);
    }

    if (materialesNecesarios.trim()) {
      await base44.entities.MaterialPendiente.create({
        ...baseSolicitante,
        descripcion: materialesNecesarios.trim(),
        prioridad: 'media',
        estado: 'pendiente',
      });
    }
  };

  const buildPayload = () => {
    const firmaNueva = !!firmaUrl && firmaUrl !== (editing?.firma_url || '');
    return {
      obra_id: obra.obra_id,
      obra_name: obra.obra_name,
      obra_tipo: obra.obra_tipo,
      fecha,
      tecnico_id: editing?.tecnico_id || user?.id,
      tecnico_name: editing?.tecnico_name || user?.full_name || user?.email,
      tecnicos_adicionales: tecnicosAdicionales,
      trabajos_realizados: trabajosRealizados,
      materiales_necesarios: materialesNecesarios,
      trabajos_pendientes: trabajosPendientes,
      fotos,
      firma_url: firmaUrl,
      vehiculo_id: desplazamiento.vehiculo_id || undefined,
      vehiculo_matricula: desplazamiento.vehiculo_matricula || undefined,
      desplazamiento_tipo: desplazamiento.desplazamiento_tipo || undefined,
      desplazamiento_valor: desplazamiento.desplazamiento_valor === '' ? undefined : Number(desplazamiento.desplazamiento_valor),
      ...(firmaNueva ? { firmado_por: user?.email, fecha_firma: new Date().toISOString() } : {}),
    };
  };

  const replicateFotosToGallery = (parteId) => {
    const hora = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    fotos.forEach(f => {
      if (!f?.url) return;
      base44.entities.FotoProyecto.create({
        foto_url: f.url,
        categoria: 'parte_trabajo',
        proyecto_id: obra.obra_id,
        proyecto_name: obra.obra_name,
        proyecto_tipo: obra.obra_tipo === 'solar' ? 'solar' : 'obra',
        referencia_id: parteId,
        referencia_nombre: `Parte Diario ${fecha}`,
        operario_id: user?.id,
        operario_name: user?.full_name || user?.email,
        fecha_foto: fecha,
        hora_foto: hora,
        fecha_hora_subida: new Date().toISOString(),
        titulo: `Parte ${obra.obra_name || ''} ${fecha}`,
      }).catch(() => {});
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload();
      if (editing) {
        return base44.entities.ParteDiarioObra.update(editing.id, payload);
      }
      const creado = await base44.entities.ParteDiarioObra.create(payload);
      // Replicar fotos del nuevo parte a la Galería de Fotos (clasificadas por obra/cliente)
      replicateFotosToGallery(creado.id);
      // Migrar trabajos extras y material pendiente a sus entidades centralizadas
      try { await persistCentralizados(creado.id); } catch (e) { console.warn('Persist centralizados falló:', e); }
      return creado;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partes-diarios'] });
      qc.invalidateQueries({ queryKey: ['trabajos-extras-obra'] });
      qc.invalidateQueries({ queryKey: ['materiales-pendientes'] });
      qc.invalidateQueries({ queryKey: ['fotos-proyecto'] });
      qc.invalidateQueries({ queryKey: ['fotos'] });
      onSuccess?.();
    },
  });

  const puedeGuardar = obra.obra_name && trabajosRealizados.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-center pb-1">
        <SimantecLogo size={36} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Cliente <span className="text-muted-foreground font-normal">(filtra las obras)</span></Label>
        <select
          value={clienteFiltro}
          onChange={e => setClienteFiltro(e.target.value)}
          disabled={!!editing}
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm min-h-[44px] disabled:opacity-50"
        >
          <option value="">Todos los clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Obra *</Label>
        <ObraSelectorObras
          value={obra}
          onChange={setObra}
          disabled={!!editing}
          clientFilter={clienteFiltro || undefined}
          onClientDetected={({ client_id }) => { if (client_id) setClienteFiltro(client_id); }}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Fecha</Label>
        <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">¿Otros técnicos en la jornada?</Label>
        <ParteTecnicosDropdown
          tecnicoActualId={editing?.tecnico_id || user?.id}
          seleccionados={tecnicosAdicionales}
          onChange={setTecnicosAdicionales}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Trabajos realizados *</Label>
          <CorrectorOrtograficoButton text={trabajosRealizados} onCorrected={setTrabajosRealizados} />
        </div>
        <div className="flex gap-2 items-start">
          <AutoCorrectTextarea value={trabajosRealizados} onChange={e => setTrabajosRealizados(e.target.value)} rows={3} placeholder="Describe el trabajo y el progreso de hoy..." spellCheck lang="es" />
          <VoiceInputButton onResult={t => setTrabajosRealizados(p => (p ? p + ' ' : '') + t)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Materiales necesarios / utilizados</Label>
          <CorrectorOrtograficoButton text={materialesNecesarios} onCorrected={setMaterialesNecesarios} />
        </div>
        <div className="flex gap-2 items-start">
          <AutoCorrectTextarea value={materialesNecesarios} onChange={e => setMaterialesNecesarios(e.target.value)} rows={2} placeholder="Ej: 40m3 arena, 10 sacos cemento..." spellCheck lang="es" />
          <VoiceInputButton onResult={t => setMaterialesNecesarios(p => (p ? p + ' ' : '') + t)} />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Al guardar el parte, este material se envía automáticamente como <b>Material Pendiente</b> a Gerencia/Administración, centralizado por obra.
        </p>
      </div>

      {!editing && (
        <ParteTrabajosExtras extras={trabajosExtras} onChange={setTrabajosExtras} />
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Trabajos pendientes</Label>
          <CorrectorOrtograficoButton text={trabajosPendientes} onCorrected={setTrabajosPendientes} />
        </div>
        <div className="flex gap-2 items-start">
          <AutoCorrectTextarea value={trabajosPendientes} onChange={e => setTrabajosPendientes(e.target.value)} rows={2} placeholder="Qué queda por hacer..." spellCheck lang="es" />
          <VoiceInputButton onResult={t => setTrabajosPendientes(p => (p ? p + ' ' : '') + t)} />
        </div>
      </div>

      <DesplazamientoFields value={desplazamiento} onChange={setDesplazamiento} />

      <div className="space-y-1.5">
        <Label className="text-xs">Fotos</Label>
        <ParteFotosInput fotos={fotos} onChange={setFotos} />
        <p className="text-[10px] text-muted-foreground">Las fotos también se replican en la Galería de Fotos (clasificadas por obra/cliente).</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Firma del técnico</Label>
        <SignatureCanvas label="Firma" value={firmaUrl} onChange={setFirmaUrl} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button onClick={() => mutation.mutate()} disabled={!puedeGuardar || mutation.isPending} className="flex-1 gap-2">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? 'Guardar cambios' : 'Guardar parte'}
        </Button>
      </div>
    </div>
  );
}