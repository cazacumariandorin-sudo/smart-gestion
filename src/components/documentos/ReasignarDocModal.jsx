import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Modal de reasignación de plano o manual a otra obra/cliente.
 * Props:
 *   doc       — el documento actual (Drawing o Manual)
 *   entityName — 'Drawing' | 'Manual'
 *   open       — boolean
 *   onClose    — fn
 */
export default function ReasignarDocModal({ doc, entityName, open, onClose }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [clientId, setClientId] = useState(doc?.client_id || '');
  const [clientName, setClientName] = useState(doc?.client_name || '');
  const [obraId, setObraId] = useState(doc?.obra_id || (entityName === 'Drawing' ? doc?.project : '') || '');
  const [obraName, setObraName] = useState(doc?.obra_name || (entityName === 'Drawing' ? doc?.project : '') || '');

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list('name', 200), enabled: open });
  const { data: obras = [] } = useQuery({ queryKey: ['obras_reasignar'], queryFn: () => base44.entities.Obra.list('name', 200), enabled: open });
  const { data: solarObras = [] } = useQuery({ queryKey: ['solar_obras_reasignar'], queryFn: () => base44.entities.SolarObra.list('name', 200), enabled: open });

  const todasObras = useMemo(() => [
    ...obras.map(o => ({ id: o.id, name: o.name, client_id: o.client_id, client_name: o.client_name })),
    ...solarObras.map(o => ({ id: o.id, name: o.name, client_id: o.client_id, client_name: o.client_name }))
  ].sort((a, b) => a.name.localeCompare(b.name)), [obras, solarObras]);

  // Filtrar obras por cliente seleccionado
  const obrasFiltradas = useMemo(() => {
    if (!clientId) return todasObras;
    return todasObras.filter(o => o.client_id === clientId);
  }, [todasObras, clientId]);

  const updateM = useMutation({
    mutationFn: (data) => base44.entities[entityName].update(doc.id, data),
    onSuccess: () => {
      const queryKey = entityName === 'Drawing' ? 'drawings' : 'manuales';
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: 'Documento reasignado', description: `Ahora vinculado a "${obraName || clientName || 'Sin obra'}"` });
      onClose();
    },
  });

  const handleClientChange = (id) => {
    const c = clients.find(c => c.id === id);
    setClientId(id);
    setClientName(c?.name || '');
    // Limpiar obra si no es de este cliente
    const obraValida = todasObras.find(o => o.id === obraId && o.client_id === id);
    if (!obraValida) { setObraId(''); setObraName(''); }
  };

  const handleObraChange = (id) => {
    const o = todasObras.find(o => o.id === id);
    setObraId(id);
    setObraName(o?.name || '');
    // Autocompletar cliente si está vacío
    if (!clientId && o?.client_id) {
      setClientId(o.client_id);
      setClientName(o.client_name || '');
    }
  };

  const handleSave = () => {
    const data = {
      client_id: clientId,
      client_name: clientName,
      obra_id: obraId,
      obra_name: obraName,
    };
    // Drawing usa también el campo "project"
    if (entityName === 'Drawing') {
      data.project = obraName;
    }
    updateM.mutate(data);
  };

  const hasChanges = clientId !== (doc?.client_id || '') || obraId !== (doc?.obra_id || (entityName === 'Drawing' ? '' : ''));

  if (!doc) return null;

  const isOrphan = !doc.client_id && !doc.obra_id && !(entityName === 'Drawing' && doc.project);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Reasignar documento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {isOrphan && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs">Este documento no tiene obra ni cliente asignado. Asígnalo para que sea visible en el contexto correcto.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium truncate">{doc.title}</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            <MobileSelect value={clientId} onValueChange={handleClientChange} placeholder="Seleccionar cliente...">
              <MobileSelectItem value="">Sin cliente</MobileSelectItem>
              {clients.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
            </MobileSelect>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Obra {clientId ? `(${obrasFiltradas.length} disponibles)` : ''}</Label>
            <MobileSelect value={obraId} onValueChange={handleObraChange} placeholder="Seleccionar obra...">
              <MobileSelectItem value="">Sin obra</MobileSelectItem>
              {obrasFiltradas.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
            </MobileSelect>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} size="sm">Cancelar</Button>
          <Button onClick={handleSave} disabled={updateM.isPending || !hasChanges} size="sm" className="gap-1.5 min-w-24">
            {updateM.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Reasignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}