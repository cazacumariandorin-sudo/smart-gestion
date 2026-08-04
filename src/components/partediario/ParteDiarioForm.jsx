import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import ObraSelectorObras from '@/components/obras/ObraSelectorObras';
import VoiceInputButton from '@/components/ui/VoiceInputButton';
import ParteFotosInput from './ParteFotosInput';
import ParteTecnicosAdicionales from './ParteTecnicosAdicionales';
import SignatureCanvas from '@/components/workorders/SignatureCanvas';

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
      return creado;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partes-diarios'] });
      qc.invalidateQueries({ queryKey: ['fotos-proyecto'] });
      qc.invalidateQueries({ queryKey: ['fotos'] });
      onSuccess?.();
    },
  });

  const puedeGuardar = obra.obra_name && trabajosRealizados.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Obra *</Label>
        <ObraSelectorObras value={obra} onChange={setObra} disabled={!!editing} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Fecha</Label>
        <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">¿Otros técnicos en la jornada?</Label>
        <ParteTecnicosAdicionales
          tecnicoActualId={editing?.tecnico_id || user?.id}
          seleccionados={tecnicosAdicionales}
          onChange={setTecnicosAdicionales}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Trabajos realizados *</Label>
        <div className="flex gap-2 items-start">
          <Textarea value={trabajosRealizados} onChange={e => setTrabajosRealizados(e.target.value)} rows={3} placeholder="Describe el trabajo y el progreso de hoy..." className="flex-1" />
          <VoiceInputButton onResult={t => setTrabajosRealizados(p => (p ? p + ' ' : '') + t)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Materiales necesarios / utilizados</Label>
        <div className="flex gap-2 items-start">
          <Textarea value={materialesNecesarios} onChange={e => setMaterialesNecesarios(e.target.value)} rows={2} placeholder="Ej: 40m3 arena, 10 sacos cemento..." className="flex-1" />
          <VoiceInputButton onResult={t => setMaterialesNecesarios(p => (p ? p + ' ' : '') + t)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Trabajos pendientes</Label>
        <div className="flex gap-2 items-start">
          <Textarea value={trabajosPendientes} onChange={e => setTrabajosPendientes(e.target.value)} rows={2} placeholder="Qué queda por hacer..." className="flex-1" />
          <VoiceInputButton onResult={t => setTrabajosPendientes(p => (p ? p + ' ' : '') + t)} />
        </div>
      </div>

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