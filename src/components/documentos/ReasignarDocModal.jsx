import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ReasignarDocModal({ doc, entityName, open, onClose }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [obraId, setObraId] = useState('');
  const [obraName, setObraName] = useState('');

  // Reinicializar cada vez que se abre con un nuevo doc
  useEffect(() => {
    if (doc && open) {
      setClientId(doc.client_id || '');
      setClientName(doc.client_name || '');
      setObraId(doc.obra_id || '');
      setObraName(doc.obra_name || (entityName === 'Drawing' ? doc.project || '' : ''));
    }
  }, [doc?.id, open]);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('name', 200),
    enabled: open,
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras_reasignar'],
    queryFn: () => base44.entities.Obra.list('name', 200),
    enabled: open,
  });
  const { data: solarObras = [] } = useQuery({
    queryKey: ['solar_obras_reasignar'],
    queryFn: () => base44.entities.SolarObra.list('name', 200),
    enabled: open,
  });

  const todasObras = useMemo(() => [
    ...obras.map(o => ({ id: o.id, name: o.name, client_id: o.client_id, client_name: o.client_name })),
    ...solarObras.map(o => ({ id: o.id, name: o.name, client_id: o.client_id, client_name: o.client_name }))
  ].sort((a, b) => a.name.localeCompare(b.name)), [obras, solarObras]);

  // Filtrar obras por cliente seleccionado (si hay cliente)
  const obrasFiltradas = useMemo(() => {
    if (!clientId) return todasObras;
    return todasObras.filter(o => o.client_id === clientId);
  }, [todasObras, clientId]);

  const updateM = useMutation({
    mutationFn: (data) => base44.entities[entityName].update(doc.id, data),
    onSuccess: () => {
      const queryKey = entityName === 'Drawing' ? 'drawings' : 'manuales';
      qc.invalidateQueries({ queryKey: [queryKey] });
      toast({ title: 'Documento reasignado', description: `Vinculado a "${obraName || clientName || 'Sin obra'}"` });
      onClose();
    },
  });

  const handleClientChange = (id) => {
    const c = clients.find(c => c.id === id);
    setClientId(id);
    setClientName(c?.name || '');
    // Limpiar obra si ya no pertenece a este cliente
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
    if (entityName === 'Drawing') {
      data.project = obraName;
    }
    updateM.mutate(data);
  };

  const isOrphan = !doc?.client_id && !doc?.obra_id && !(entityName === 'Drawing' && doc?.project);

  if (!doc) return null;

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
              <p className="text-xs">Sin obra ni cliente asignado. Asígnalo para que sea visible en el contexto correcto.</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground font-medium truncate">{doc.title}</p>

          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            <MobileSelect value={clientId} onValueChange={handleClientChange} placeholder="Seleccionar cliente...">
              {clients.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
            </MobileSelect>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Obra {clientId ? `(${obrasFiltradas.length} disponibles)` : `(${todasObras.length} disponibles)`}
            </Label>
            <MobileSelect value={obraId} onValueChange={handleObraChange} placeholder="Seleccionar obra...">
              {obrasFiltradas.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
            </MobileSelect>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} size="sm">Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={updateM.isPending || (!clientId && !obraId)}
            size="sm"
            className="gap-1.5 min-w-24"
          >
            {updateM.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Reasignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}