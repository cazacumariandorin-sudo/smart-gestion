import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { useI18n } from '@/lib/i18n';
import { Plus, Search, Pencil, Trash2, FileImage, Upload, Loader2, Save, ExternalLink, ChevronRight, ChevronDown, File, FileText } from 'lucide-react';
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

const empty = { title: '', reference: '', client_id: '', client_name: '', project: '', date: new Date().toISOString().split('T')[0], version: '', file_url: '', notes: '' };

const getFileType = (url) => {
  if (!url) return null;
  if (/\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url)) return 'image';
  if (/\.pdf$/i.test(url)) return 'pdf';
  if (/\.(xlsx|xls)$/i.test(url)) return 'excel';
  if (/\.(docx|doc)$/i.test(url)) return 'word';
  if (/\.(dxf|dwg)$/i.test(url)) return 'cad';
  return 'file';
};

const fileTypeLabel = { image: 'Imagen', pdf: 'PDF', excel: 'Excel', word: 'Word', cad: 'CAD/DXF', file: 'Archivo' };
const fileTypeColor = { image: 'bg-blue-100 text-blue-700', pdf: 'bg-red-100 text-red-700', excel: 'bg-green-100 text-green-700', word: 'bg-blue-100 text-blue-700', cad: 'bg-purple-100 text-purple-700', file: 'bg-gray-100 text-gray-700' };

function FileViewer({ url, title }) {
  const type = getFileType(url);
  if (!url) return null;

  if (type === 'image') {
    return <img src={url} alt={title} className="w-full max-h-[70vh] object-contain rounded" />;
  }
  if (type === 'pdf') {
    return <iframe src={url} title={title} className="w-full h-[70vh] rounded border" />;
  }
  if (type === 'excel' || type === 'word') {
    const viewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    return <iframe src={viewer} title={title} className="w-full h-[70vh] rounded border" />;
  }
  if (type === 'cad') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <File className="w-16 h-16 text-purple-400" />
        <p className="text-sm">Archivo DXF/DWG — no hay visor en línea disponible.</p>
        <a href={url} download className="text-primary text-sm hover:underline flex items-center gap-1"><ExternalLink className="w-4 h-4" /> Descargar archivo</a>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center h-40 gap-3">
      <FileText className="w-12 h-12 text-muted-foreground" />
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline flex items-center gap-1"><ExternalLink className="w-4 h-4" /> Abrir archivo</a>
    </div>
  );
}

export default function Drawings() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { isAdmin, isJefeObra, isGerencia, isOperario, role } = useUserRole();
  // Admin, jefe_obra, gerencia, director_comercial y operario pueden crear/editar planos
  const canCreate = isAdmin || isJefeObra || isGerencia || role === 'director_comercial' || isOperario;
  const canDelete = isAdmin || isJefeObra;

  const onRefresh = useCallback(() => qc.invalidateQueries({ queryKey: ['drawings'] }), [qc]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);
  const [viewerDoc, setViewerDoc] = useState(null);
  const [expandedClients, setExpandedClients] = useState({});

  const { data: drawings = [], isLoading } = useQuery({ queryKey: ['drawings'], queryFn: () => base44.entities.Drawing.list('-date', 500) });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list('name', 200) });
  const { data: obras = [] } = useQuery({ queryKey: ['obras_drawings'], queryFn: () => base44.entities.Obra.list('name', 200) });
  const { data: solarObras = [] } = useQuery({ queryKey: ['solar_obras_drawings'], queryFn: () => base44.entities.SolarObra.list('name', 200) });
  const todasObras = useMemo(() => [...obras.map(o => ({ id: o.id, name: o.name, client_id: o.client_id, client_name: o.client_name })), ...solarObras.map(o => ({ id: o.id, name: o.name, client_id: o.client_id, client_name: o.client_name }))].sort((a,b) => a.name.localeCompare(b.name)), [obras, solarObras]);

  const createM = useMutation({ mutationFn: d => base44.entities.Drawing.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['drawings'] }); close_(); } });
  const updateM = useMutation({ mutationFn: ({ id, d }) => base44.entities.Drawing.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['drawings'] }); close_(); } });
  const deleteM = useMutation({ mutationFn: id => base44.entities.Drawing.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['drawings'] }) });

  const open_ = (d = null) => { setEditing(d); setForm(d ? { ...d } : empty); setDialogOpen(true); };
  const close_ = () => { setDialogOpen(false); setEditing(null); setForm(empty); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleClientChange = (id) => {
    const c = clients.find(c => c.id === id);
    setForm(p => ({ ...p, client_id: id, client_name: c?.name || '' }));
  };

  const handleObraChange = (obraName) => {
    const obra = todasObras.find(o => o.name === obraName);
    setForm(p => ({
      ...p,
      project: obraName,
      // Auto-rellenar cliente si la obra lo tiene y el cliente no está seleccionado aún
      ...(obra?.client_id && !p.client_id ? { client_id: obra.client_id, client_name: obra.client_name || '' } : {}),
    }));
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    set('file_url', file_url);
    setUploading(false);
  };

  const handleSave = () => {
    if (editing) updateM.mutate({ id: editing.id, d: form });
    else createM.mutate(form);
  };

  const filtered = drawings.filter(d => {
    const q = search.toLowerCase();
    const matchQ = !search || d.title?.toLowerCase().includes(q) || d.reference?.toLowerCase().includes(q) || d.project?.toLowerCase().includes(q);
    const matchC = clientFilter === 'all' || d.client_id === clientFilter;
    return matchQ && matchC;
  });

  // Group by client → project
  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(d => {
      const cKey = d.client_id || '__no_client__';
      const cName = d.client_name || 'Sin cliente';
      if (!map[cKey]) map[cKey] = { name: cName, projects: {} };
      const pKey = d.project || '__no_project__';
      const pName = d.project || 'Sin obra';
      if (!map[cKey].projects[pKey]) map[cKey].projects[pKey] = { name: pName, drawings: [] };
      map[cKey].projects[pKey].drawings.push(d);
    });
    return map;
  }, [filtered]);

  const toggleClient = (k) => setExpandedClients(p => ({ ...p, [k]: !p[k] }));
  const isPending = createM.isPending || updateM.isPending;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileImage className="w-7 h-7 text-primary" /> Planos y Documentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} documentos</p>
        </div>
        {canCreate && (
          <Button onClick={() => open_()} className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo Documento</span>
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar plano, referencia, obra..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <MobileSelect value={clientFilter} onValueChange={setClientFilter} placeholder="Cliente" triggerClassName="w-full sm:w-48">
          <MobileSelectItem value="all">Todos los clientes</MobileSelectItem>
          {clients.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <FileImage className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay documentos</p>
          {canCreate && <Button variant="outline" size="sm" onClick={() => open_()} className="gap-2"><Plus className="w-3.5 h-3.5" /> Nuevo Documento</Button>}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cKey, cData]) => {
            const isExpanded = expandedClients[cKey] !== false; // expanded by default
            return (
              <Card key={cKey} className="overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors"
                  onClick={() => toggleClient(cKey)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <span className="font-semibold text-sm">{cData.name}</span>
                    <Badge variant="outline" className="text-[10px]">{Object.values(cData.projects).reduce((s, p) => s + p.drawings.length, 0)} docs</Badge>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    {Object.entries(cData.projects).map(([pKey, pData]) => (
                      <div key={pKey} className="px-5 py-3 border-b border-border/50 last:border-0">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{pData.name}</p>
                        <div className="space-y-1.5">
                          {pData.drawings.map(d => {
                            const ft = getFileType(d.file_url);
                            return (
                              <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40 group">
                                <div className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${ft ? fileTypeColor[ft] : 'bg-gray-100 text-gray-600'}`}>
                                  {ft ? fileTypeLabel[ft] : '—'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{d.title}</p>
                                  <div className="flex items-center gap-2">
                                    {d.reference && <span className="text-[10px] font-mono text-muted-foreground">{d.reference}</span>}
                                    {d.version && <span className="text-[10px] text-muted-foreground">v{d.version}</span>}
                                    {d.date && <span className="text-[10px] text-muted-foreground">{format(parseISO(d.date), 'd MMM yyyy', { locale: es })}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {d.file_url && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setViewerDoc(d)}>
                                      <ExternalLink className="w-3 h-3" /> Ver
                                    </Button>
                                  )}
                                  {canCreate && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => open_(d)}><Pencil className="w-3 h-3" /></Button>}
                                  {canDelete && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3 h-3" /></Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle><AlertDialogDescription>"{d.title}" será eliminado.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteM.mutate(d.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction></AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Document Viewer Dialog */}
      {viewerDoc && (
        <Dialog open={!!viewerDoc} onOpenChange={() => setViewerDoc(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {viewerDoc.title}
                {viewerDoc.reference && <Badge variant="outline" className="text-[10px]">{viewerDoc.reference}</Badge>}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              <FileViewer url={viewerDoc.file_url} title={viewerDoc.title} />
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <p className="text-xs text-muted-foreground">{viewerDoc.client_name} — {viewerDoc.project}</p>
              <a href={viewerDoc.file_url} target="_blank" rel="noopener noreferrer" download>
                <Button variant="outline" size="sm" className="gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Abrir / Descargar</Button>
              </a>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Documento' : 'Nuevo Documento'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Planta baja, Fachada norte, Manual..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Referencia</Label>
                <Input value={form.reference} onChange={e => set('reference', e.target.value)} placeholder="PL-001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Versión</Label>
                <Input value={form.version} onChange={e => set('version', e.target.value)} placeholder="1.0" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente *</Label>
              <MobileSelect value={form.client_id} onValueChange={handleClientChange} placeholder="Seleccionar cliente...">
                {clients.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
              </MobileSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Obra</Label>
                <MobileSelect value={form.project || ''} onValueChange={handleObraChange} placeholder="Seleccionar obra...">
                  {todasObras.map(o => <MobileSelectItem key={o.id} value={o.name}>{o.name}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Archivo (PDF, Excel, Word, DXF, imagen)</Label>
              <div className="flex gap-2">
                <Input value={form.file_url} onChange={e => set('file_url', e.target.value)} placeholder="https://... o subir" className="flex-1" />
                <label className="cursor-pointer">
                  <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={uploading} asChild>
                    <span>{uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}</span>
                  </Button>
                  <input type="file" accept=".pdf,.xlsx,.xls,.docx,.doc,.dxf,.dwg,image/*" className="hidden" onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
                </label>
              </div>
              {form.file_url && (
                <p className="text-[10px] text-muted-foreground">
                  Tipo detectado: <span className="font-semibold">{fileTypeLabel[getFileType(form.file_url)] || 'Archivo'}</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observaciones</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.client_id || isPending} className="gap-2 min-w-28">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}