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

export default function ParteDiarioForm({ onSuccess, onCancel }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [obra, setObra] = useState({ obra_id: null, obra_name: '', obra_tipo: 'otro' });
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [trabajosRealizados, setTrabajosRealizados] = useState('');
  const [materialesNecesarios, setMaterialesNecesarios] = useState('');
  const [trabajosPendientes, setTrabajosPendientes] = useState('');
  const [fotos, setFotos] = useState([]);
  const [tecnicosAdicionales, setTecnicosAdicionales] = useState([]);

  const mutation = useMutation({
    mutationFn: () => base44.entities.ParteDiarioObra.create({
      obra_id: obra.obra_id,
      obra_name: obra.obra_name,
      obra_tipo: obra.obra_tipo,
      fecha,
      tecnico_id: user?.id,
      tecnico_name: user?.full_name || user?.email,
      tecnicos_adicionales: tecnicosAdicionales,
      trabajos_realizados: trabajosRealizados,
      materiales_necesarios: materialesNecesarios,
      trabajos_pendientes: trabajosPendientes,
      fotos,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partes-diarios'] });
      onSuccess?.();
    },
  });

  const puedeGuardar = obra.obra_name && trabajosRealizados.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Obra *</Label>
        <ObraSelectorObras value={obra} onChange={setObra} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Fecha</Label>
        <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">¿Otros técnicos en la jornada?</Label>
        <ParteTecnicosAdicionales
          tecnicoActualId={user?.id}
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
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
        <Button onClick={() => mutation.mutate()} disabled={!puedeGuardar || mutation.isPending} className="flex-1 gap-2">
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar parte'}
        </Button>
      </div>
    </div>
  );
}