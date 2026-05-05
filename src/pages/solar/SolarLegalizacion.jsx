import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, Search, Pencil, Trash2, FileCheck, Loader2, Save, Upload, ExternalLink, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const statusCfg = {
  pendiente:   { label: 'Pendiente',   className: 'bg-amber-100 text-amber-700 border-amber-200' },
  en_tramite:  { label: 'En trámite',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
  aprobado:    { label: 'Aprobado',    className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rechazado:   { label: 'Rechazado',   className: 'bg-red-100 text-red-700 border-red-200' },
};

const tramiteCfg = {
  proyecto_tecnico:    'Proyecto técnico',
  licencia_obra:       'Licencia de obra',
  boletin_instalacion: 'Boletín instalación',
  tramite_red:         'Trámite red eléctrica',
  certificado_final:   'Certificado final',
  subvencion:          'Subvención',
  otros:               'Otros',
};

const emptyForm = {
  obra_id: '', obra_name: '', client_name: '', tipo_tramite: 'proyecto_tecnico',
  descripcion: '', status: 'pendiente', fecha_solicitud: new Date().toISOString().split('T')[0],
  fecha_resolucion: '', organismo: '', referencia: '', file_url: '', notas: '',
};

export default function SolarLegalizacion() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const { data: tramites = [], isLoading } = useQuery({
    queryKey: ['solar_legalizacion'],
    queryFn: () => base44.entities.SolarLegalizacion.list('-created_date', 300),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['solar_obras'],
    queryFn: () => base44.entities.SolarObra.list('name', 300),
  });

  const createM = useMutation({
    mutationFn: d => base44.entities.SolarLegalizacion.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_legalizacion'] }); toast.success('Trámite creado'); close_(); },
    onError: () => toast.error('Error al crear el trámite'),
  });
  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.SolarLegalizacion.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_legalizacion'] }); toast.success('Trámite actualizado'); close_(); },
    onError: () => toast.error('Error al guardar'),
  });
  const deleteM = useMutation({
    mutationFn: id => base44.entities.SolarLegalizacion.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solar_legalizacion'] }); toast.success('Trámite eliminado'); },
  });

  const open_ = (t = null) => { setEditing(t); setForm(t ? { ...t } : emptyForm); setDialogOpen(true); };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleObraChange = id => {
    const o = obras.find(o => o.id === id);
    setForm(p => ({ ...p, obra_id: id, obra_name: o?.name || '', client_name: o?.client_name || '' }));
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('file_url', file_url);
    setUploading(false);
    toast.success('Documento subido');
  };

  const handleSave = () => {
    if (editing) updateM.mutate({ id: editing.id, d: form });
    else createM.mutate(form);
  };

  const filtered = tramites.filter(t => {
    const q = search.toLowerCase();
    const matchQ = !search || t.obra_name?.toLowerCase().includes(q) || t.client_name?.toLowerCase().includes(q) || t.referencia?.toLowerCase().includes(q) || t.organismo?.toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || t.status === statusFilter;
    return matchQ && matchS;
  });

  const isPending = createM.isPending || updateM.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} trámites</p>
        <Button onClick={() => open_()} className="gap-2 shadow-sm" size="sm">
          <Plus className="w-4 h-4" /> Nuevo trámite
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar trámite..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <MobileSelect value={statusFilter} onValueChange={setStatusFilter} placeholder="Estado" triggerClassName="w-full sm:w-40">
          <MobileSelectItem value="all">Todos</MobileSelectItem>
          {Object.entries(statusCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      {/* Summary */}
      <div className="flex gap-2 flex-wrap">
        {Object.entries(statusCfg).map(([k, v]) => {
          const count = tramites.filter(t => t.status === k).length;
          if (!count) return null;
          return <Badge key={k} variant="outline" className={`${v.className} text-xs`}>{v.label}: {count}</Badge>;
        })}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <FileCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">No hay trámites de legalización</p>
          <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2"><Plus className="w-3.5 h-3.5" /> Nuevo trámite</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => {
            const cfg = statusCfg[t.status] || statusCfg.pendiente;
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{tramiteCfg[t.tipo_tramite] || t.tipo_tramite}</h3>
                      <Badge variant="outline" className={`${cfg.className} text-[10px]`}>{cfg.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {t.obra_name && <span>{t.obra_name}</span>}
                      {t.client_name && <span>· {t.client_name}</span>}
                      {t.organismo && <span>· {t.organismo}</span>}
                      {t.referencia && <span className="font-mono">· Ref: {t.referencia}</span>}
                      {t.fecha_solicitud && <span>· {format(parseISO(t.fecha_solicitud), 'd MMM yyyy', { locale: es })}</span>}
                    </div>
                    {t.descripcion && <p className="text-xs text-muted-foreground mt-0.5 italic">{t.descripcion}</p>}
                    {t.file_url && (
                      <a href={t.file_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                        <ExternalLink className="w-3 h-3" /> Ver documento
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(t)}><Pencil className="w-3 h-3" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar trámite?</AlertDialogTitle><AlertDialogDescription>Se eliminará permanentemente.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteM.mutate(t.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar trámite' : 'Nuevo trámite de legalización'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Obra solar *</Label>
                <MobileSelect value={form.obra_id} onValueChange={handleObraChange} placeholder="Seleccionar obra...">
                  {obras.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de trámite *</Label>
                <MobileSelect value={form.tipo_tramite} onValueChange={v => set('tipo_tramite', v)} placeholder="Tipo">
                  {Object.entries(tramiteCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <MobileSelect value={form.status} onValueChange={v => set('status', v)} placeholder="Estado">
                  {Object.entries(statusCfg).map(([k, v]) => <MobileSelectItem key={k} value={k}>{v.label}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Organismo</Label>
                <Input value={form.organismo} onChange={e => set('organismo', e.target.value)} placeholder="Distribuidora, Ayuntamiento..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Referencia / Expediente</Label>
                <Input value={form.referencia} onChange={e => set('referencia', e.target.value)} placeholder="EXP-2024-001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha solicitud</Label>
                <Input type="date" value={form.fecha_solicitud} onChange={e => set('fecha_solicitud', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha resolución</Label>
                <Input type="date" value={form.fecha_resolucion} onChange={e => set('fecha_resolucion', e.target.value)} />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Descripción</Label>
                <Textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2} placeholder="Descripción del trámite..." />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Documento adjunto</Label>
                {form.file_url ? (
                  <div className="flex items-center gap-2 p-2.5 border rounded-lg bg-muted/30">
                    <FileCheck className="w-4 h-4 text-primary shrink-0" />
                    <a href={form.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex-1 truncate">Ver documento</a>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => set('file_url', '')}><X className="w-3 h-3" /></Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">{uploading ? 'Subiendo...' : 'Subir PDF / documento'}</span>
                    <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
                      onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
                  </label>
                )}
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Observaciones</Label>
                <Textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Notas..." />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.obra_id || !form.tipo_tramite || isPending} className="gap-2 min-w-24">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}