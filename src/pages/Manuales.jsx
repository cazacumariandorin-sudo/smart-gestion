import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Plus, Search, Trash2, BookOpen, Save, Loader2, Upload, FileText, Table, File, Languages, Eye, Download, Link2 } from 'lucide-react';
import ReasignarDocModal from '@/components/documentos/ReasignarDocModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const getEmptyForm = () => ({ title: '', client_id: '', client_name: '', obra_id: '', obra_name: '', fabricante_id: '', fabricante_name: '', categoria: '', file_url: '', file_type: '', version: '', date: new Date().toISOString().split('T')[0], notes: '' });

function fileIcon(fileType) {
  if (!fileType) return <File className="w-5 h-5 text-muted-foreground" />;
  if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
  if (fileType.includes('xls') || fileType.includes('sheet')) return <Table className="w-5 h-5 text-green-600" />;
  if (fileType.includes('doc')) return <FileText className="w-5 h-5 text-blue-600" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
}

export default function Manuales() {
  const qc = useQueryClient();
  const { isAdmin, isJefeObra, isOperario, isGerencia, isTecnico, role, user } = useUserRole();
  // Admin, jefe_obra, director_comercial, técnicos y operarios pueden crear manuales
  // (los técnicos también pueden subir manuales/actualizaciones a la obra donde trabajan)
  const canCreate = isAdmin || isJefeObra || role === 'director_comercial' || isOperario || isTecnico;
  // Un usuario puede eliminar sus propias subidas
  const isOwnDoc = (m) => !!m?.created_by && m.created_by === user?.email;
  const canDelete = (m) => isAdmin || isJefeObra || isOwnDoc(m);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [obraFilter, setObraFilter] = useState('all');
  const [fabricanteFilter, setFabricanteFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(getEmptyForm());
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState(null);
  const [reasignarDoc, setReasignarDoc] = useState(null);

  const { data: manuales = [], isLoading, refetch: refetchManuales } = useQuery({ queryKey: ['manuales'], queryFn: () => base44.entities.Manual.list('-date', 300) });

  const onRefresh = useCallback(async () => { await refetchManuales(); }, [refetchManuales]);
  const { pullDistance, refreshing } = usePullToRefresh(onRefresh);
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list('name', 200) });
  const { data: obras = [] } = useQuery({ queryKey: ['obras'], queryFn: () => base44.entities.Obra.list('name', 300) });
  const { data: solarObras = [] } = useQuery({ queryKey: ['solar_obras_manuales'], queryFn: () => base44.entities.SolarObra.list('name', 300) });
  const todasObras = useMemo(() => [
    ...obras.map(o => ({ id: o.id, name: o.name, client_id: o.client_id, client_name: o.client_name })),
    ...solarObras.map(o => ({ id: o.id, name: o.name, client_id: o.client_id, client_name: o.client_name }))
  ].sort((a, b) => a.name.localeCompare(b.name)), [obras, solarObras]);
  const { data: fabricantes = [] } = useQuery({ queryKey: ['fabricantes'], queryFn: () => base44.entities.Fabricante.list('name', 300) });

  const createM = useMutation({ mutationFn: d => base44.entities.Manual.create(d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['manuales'] }); close_(); } });
  const deleteM = useMutation({ mutationFn: id => base44.entities.Manual.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['manuales'] }) });

  const close_ = () => { setDialogOpen(false); setForm(getEmptyForm()); };
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleClientChange = (id) => {
    const c = clients.find(cl => cl.id === id);
    setForm(p => ({ ...p, client_id: id, client_name: c?.name || '' }));
  };
  const handleObraChange = (id) => {
    const o = todasObras.find(ob => ob.id === id);
    setForm(p => ({
      ...p,
      obra_id: id,
      obra_name: o?.name || '',
      ...(o?.client_id && !p.client_id ? { client_id: o.client_id, client_name: o.client_name || '' } : {}),
    }));
  };

  const handleFileUpload = async (file) => {
    try {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const ext = file.name.split('.').pop()?.toLowerCase();
      setForm(p => ({ ...p, file_url, file_type: ext }));
    } finally {
      setUploading(false);
    }
  };

  const translateDoc = async (manual) => {
    try {
      setTranslating(manual.id);
      if (!manual.file_url) return;
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Traduce el siguiente documento al español. Mantén el formato original lo máximo posible. El archivo está en: ${manual.file_url}. Devuelve el texto traducido completo.`,
        file_urls: [manual.file_url],
      });
      const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${manual.title}_ES.txt`;
      a.click();
    } finally {
      setTranslating(null);
    }
  };

  const filtered = useMemo(() => manuales.filter(m => {
    const q = search.toLowerCase();
    const matchQ = !search || m.title?.toLowerCase().includes(q) || m.client_name?.toLowerCase().includes(q) || m.obra_name?.toLowerCase().includes(q) || m.categoria?.toLowerCase().includes(q);
    const matchC = clientFilter === 'all' || m.client_id === clientFilter;
    const matchO = obraFilter === 'all' || m.obra_id === obraFilter;
    const matchF = fabricanteFilter === 'all' || m.fabricante_id === fabricanteFilter;
    return matchQ && matchC && matchO && matchF;
  }), [manuales, search, clientFilter, obraFilter, fabricanteFilter]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(m => {
      const ck = m.client_id || '_sin_cliente';
      const cn = m.client_name || 'Sin cliente';
      if (!map[ck]) map[ck] = { client_name: cn, obras: {} };
      const ok = m.obra_id || '_sin_obra';
      const on = m.obra_name || 'Sin obra';
      if (!map[ck].obras[ok]) map[ck].obras[ok] = { obra_name: on, items: [] };
      map[ck].obras[ok].items.push(m);
    });
    return Object.values(map);
  }, [filtered]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PullToRefreshIndicator pullDistance={pullDistance} refreshing={refreshing} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" /> Manuales y Documentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} documentos</p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)} className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo Manual</span>
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar manual..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <MobileSelect value={clientFilter} onValueChange={setClientFilter} placeholder="Cliente" triggerClassName="w-full sm:w-44">
          <MobileSelectItem value="all">Todos los clientes</MobileSelectItem>
          {clients.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={obraFilter} onValueChange={setObraFilter} placeholder="Obra" triggerClassName="w-full sm:w-44">
          <MobileSelectItem value="all">Todas las obras</MobileSelectItem>
          {todasObras.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={fabricanteFilter} onValueChange={setFabricanteFilter} placeholder="Fabricante" triggerClassName="w-full sm:w-44">
          <MobileSelectItem value="all">Todos los fabricantes</MobileSelectItem>
          {fabricantes.map(f => <MobileSelectItem key={f.id} value={f.id}>{f.name}</MobileSelectItem>)}
        </MobileSelect>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl">
          <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay manuales registrados</p>
          {canCreate && <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} className="gap-2"><Plus className="w-3.5 h-3.5" /> Añadir manual</Button>}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.client_name}>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" />{group.client_name}
              </h2>
              <div className="space-y-4 ml-4">
                {Object.values(group.obras).map(obra => (
                  <div key={obra.obra_name}>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{obra.obra_name}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {obra.items.map(m => (
                        <Card key={m.id} className="p-4 flex items-center gap-3">
                          <div className="shrink-0">{fileIcon(m.file_type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug break-words">{m.title}</p>
                            <div className="flex items-center gap-2 flex-wrap mt-1">
                              {m.categoria && <Badge variant="outline" className="text-[10px]">{m.categoria}</Badge>}
                              {m.version && <span className="text-[10px] text-muted-foreground">v{m.version}</span>}
                              {m.date && <span className="text-[10px] text-muted-foreground">{format(parseISO(m.date), 'd MMM yyyy', { locale: es })}</span>}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {m.file_url && (
                              <>
                                <a href={m.file_url} target="_blank" rel="noopener noreferrer" title="Ver documento">
                                  <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                                </a>
                                <a href={m.file_url} download={m.title || 'documento'} title="Descargar">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><Download className="w-3.5 h-3.5" /></Button>
                                </a>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" title="Traducir al español" onClick={() => translateDoc(m)} disabled={translating === m.id}>
                                  {translating === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
                                </Button>
                              </>
                            )}
                            {(isAdmin || isGerencia) && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600" title="Reasignar obra/cliente" onClick={() => setReasignarDoc(m)}>
                                <Link2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {canDelete && <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>¿Eliminar manual?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteM.mutate(m.id)} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reasignar Modal */}
      {reasignarDoc && (
        <ReasignarDocModal
          doc={reasignarDoc}
          entityName="Manual"
          open={!!reasignarDoc}
          onClose={() => setReasignarDoc(null)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nuevo Manual / Documento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Nombre del manual..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente *</Label>
                <MobileSelect value={form.client_id} onValueChange={handleClientChange} placeholder="Seleccionar... (obligatorio)">
                  {clients.map(c => <MobileSelectItem key={c.id} value={c.id}>{c.name}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Obra *</Label>
                <MobileSelect value={form.obra_id} onValueChange={handleObraChange} placeholder="Seleccionar... (obligatorio)">
                  {todasObras.map(o => <MobileSelectItem key={o.id} value={o.id}>{o.name}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Categoría</Label>
                <Input value={form.categoria} onChange={e => set('categoria', e.target.value)} placeholder="Instalación, mantenimiento..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fabricante</Label>
                <MobileSelect value={form.fabricante_id} onValueChange={id => { const f = fabricantes.find(x => x.id === id); set('fabricante_id', id); set('fabricante_name', f?.name || ''); }} placeholder="Seleccionar...">
                  {fabricantes.map(f => <MobileSelectItem key={f.id} value={f.id}>{f.name}</MobileSelectItem>)}
                </MobileSelect>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Versión</Label>
                <Input value={form.version} onChange={e => set('version', e.target.value)} placeholder="1.0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Archivo (PDF, Excel, Word...)</Label>
              {form.file_url ? (
                <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                  {fileIcon(form.file_type)}
                  <span className="text-xs flex-1 truncate">{form.file_type?.toUpperCase()} subido</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => set('file_url', '')}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ) : (
                <label className="block border-2 border-dashed rounded-lg h-20 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-muted/30 transition-colors">
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : <Upload className="w-6 h-6 text-muted-foreground" />}
                  <p className="text-xs text-muted-foreground">{uploading ? 'Subiendo...' : 'Subir PDF, Excel, Word...'}</p>
                  <input type="file" accept=".pdf,.xls,.xlsx,.doc,.docx" className="hidden" onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])} />
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Observaciones</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close_}>Cancelar</Button>
            <Button onClick={() => createM.mutate(form)} disabled={!form.title || !form.client_id || !form.obra_id || createM.isPending} className="gap-2 min-w-28">
              {createM.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}