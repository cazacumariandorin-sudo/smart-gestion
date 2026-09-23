import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Image, Search, X, ZoomIn, Filter, Plus, Upload, Loader2, Download, Share2, Eye, EyeOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { subirImagen } from '@/lib/uploadPhoto';
import { imagenNoVacia } from '@/lib/fotoValidacion';
import FotoGestionDialog, { puedeGestionarFoto } from '@/components/fotos/FotoGestionDialog';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUserRole } from '@/lib/useUserRole';
import { useAuth } from '@/lib/AuthContext';
import ClientObraTree from '@/components/documentos/ClientObraTree';
import { useObrasActivasMap, esItemVisible } from '@/hooks/useObrasActivasMap';
import ObraPickerInput from '@/components/fotos/ObraPickerInput';

const CATEGORIAS = ['parte_trabajo', 'obra', 'nota_gastos', 'presupuesto', 'averia'];
const CAT_LABELS = {
  parte_trabajo: 'Parte trabajo',
  obra: 'Obra',
  nota_gastos: 'Nota gastos',
  presupuesto: 'Presupuesto',
  averia: 'Avería',
};
const CAT_COLORS = {
  parte_trabajo: 'bg-blue-100 text-blue-700',
  obra: 'bg-green-100 text-green-700',
  nota_gastos: 'bg-orange-100 text-orange-700',
  presupuesto: 'bg-purple-100 text-purple-700',
  averia: 'bg-red-100 text-red-700',
};

export default function GaleriaFotos() {
  const qc = useQueryClient();
  const { isOperario, isAdmin, isGerencia } = useUserRole();
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterOperario, setFilterOperario] = useState('');
  const [filterObra, setFilterObra] = useState('');
  const [selectedFoto, setSelectedFoto] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [mostrarInactivas, setMostrarInactivas] = useState(false);
  const [borrarFoto, setBorrarFoto] = useState(null);

  const obrasMap = useObrasActivasMap();
  const puedeVerInactivas = isAdmin || isGerencia;

  const handleDescargar = async (foto) => {
    setDescargando(true);
    try {
      const response = await fetch(foto.foto_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (foto.titulo || 'foto') + '.jpg';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Si fetch falla (CORS), abrir en nueva pestaña como fallback
      window.open(foto.foto_url, '_blank');
    } finally {
      setDescargando(false);
    }
  };

  const handleCompartir = async (foto) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: foto.titulo || 'Foto de proyecto',
          text: [foto.proyecto_name, foto.descripcion].filter(Boolean).join(' — '),
          url: foto.foto_url,
        });
      } catch { /* usuario canceló */ }
    } else {
      // Fallback: copiar URL al portapapeles
      await navigator.clipboard.writeText(foto.foto_url);
      alert('Enlace copiado al portapapeles');
    }
  };
  const [uploading, setUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    titulo: '',
    descripcion: '',
    categoria: 'obra',
    proyecto_id: '',
    proyecto_name: '',
    foto_url: '',
    storage: '',
    drive_file_id: '',
  });

  const { data: fotos = [], isLoading } = useQuery({
    queryKey: ['fotos-proyecto'],
    queryFn: () => base44.entities.FotoProyecto.list('-fecha_foto', 200),
  });

  const fotosVisibles = fotos.filter(f => !f.eliminada);

  const operarios = [...new Set(fotosVisibles.map(f => f.operario_name).filter(Boolean))];
  const proyectos = [...new Set(fotosVisibles.map(f => f.proyecto_name).filter(Boolean))];

  const obras = [...new Set(fotosVisibles.map(f => f.proyecto_name).filter(Boolean))].sort();

  const filtradas = fotosVisibles.filter(f => {
    const matchSearch = !search || 
      f.titulo?.toLowerCase().includes(search.toLowerCase()) ||
      f.proyecto_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.operario_name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || f.categoria === filterCat;
    const matchOp = !filterOperario || f.operario_name === filterOperario;
    const matchObra = !filterObra || f.proyecto_name === filterObra;
    const matchActiva = esItemVisible({ proyecto_id: f.proyecto_id }, obrasMap, mostrarInactivas);
    return matchSearch && matchCat && matchOp && matchObra && matchActiva;
  });

  // Group by client → project. Las fotos usan `proyecto_id`/`proyecto_name`.
  const groupedFotos = (() => {
    const map = {};
    // Cross-reference: para foto.proyecto_id encuéntrala en obrasMap para obtener client_id/client_name
    filtradas.forEach(f => {
      const obr = f.proyecto_id ? obrasMap[f.proyecto_id] : null;
      const cKey = obr?.client_id || '__no_client__';
      const cName = obr?.client_name || 'Sin cliente';
      if (!map[cKey]) map[cKey] = { name: cName, projects: {} };
      const pKey = f.proyecto_id || f.proyecto_name || '__no_project__';
      const pName = f.proyecto_name || 'Sin obra';
      if (!map[cKey].projects[pKey]) map[cKey].projects[pKey] = { name: pName, items: [], activo: f.proyecto_id ? obrasMap[f.proyecto_id]?.activo : undefined };
      map[cKey].projects[pKey].items.push(f);
    });
    return map;
  })();

  const uploadMutation = useMutation({
    mutationFn: async (data) => {
      const now = new Date();
      return base44.entities.FotoProyecto.create({
        titulo: data.titulo,
        descripcion: data.descripcion,
        categoria: data.categoria,
        proyecto_id: data.proyecto_id || data.proyecto_name || 'sin_proyecto',
        proyecto_name: data.proyecto_name,
        proyecto_tipo: 'obra',
        operario_id: user?.id || 'desconocido',
        operario_name: user?.full_name || user?.email || 'Desconocido',
        foto_url: data.foto_url,
        fecha_foto: now.toISOString().split('T')[0],
        hora_foto: now.toTimeString().slice(0, 5),
        storage: data.storage,
        drive_file_id: data.drive_file_id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fotos-proyecto'] });
      setUploadDialogOpen(false);
      setUploadForm({ titulo: '', descripcion: '', categoria: 'obra', proyecto_id: '', proyecto_name: '', foto_url: '', storage: '', drive_file_id: '' });
    },
  });

  const handleFileUpload = async (file) => {
    setUploading(true);
    try {
      if (!(await imagenNoVacia(file))) {
        toast({
          title: 'Foto en blanco',
          description: 'La imagen no tiene contenido. Inténtalo de nuevo.',
          variant: 'destructive',
        });
        return;
      }
      const { file_url, storage, drive_file_id } = await subirImagen(file);
      setUploadForm(p => ({ ...p, foto_url: file_url, storage, drive_file_id }));
    } finally {
      setUploading(false);
    }
  };

  const handleFileUploadMultiple = (files) => {
    if (!files.length) return;
    if (files.length === 1) { handleFileUpload(files[0]); return; }
    if (!uploadForm.proyecto_id && !uploadForm.proyecto_name) {
      toast({
        title: 'Selecciona la obra',
        description: 'Para subir varias fotos a la vez, elige primero el proyecto/obra de destino.',
        variant: 'destructive',
      });
      return;
    }
    subirLoteGaleria(files);
  };

  const subirLoteGaleria = async (files) => {
    setUploading(true);
    setBatchProgress({ total: files.length, actual: 0, ok: 0, errores: 0 });
    let ok = 0, errores = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBatchProgress({ total: files.length, actual: i, ok, errores });
      try {
        if (!(await imagenNoVacia(file))) { errores++; continue; }
        const { file_url, storage, drive_file_id } = await subirImagen(file);
        const now = new Date();
        await base44.entities.FotoProyecto.create({
          titulo: file.name,
          descripcion: '',
          categoria: uploadForm.categoria,
          proyecto_id: uploadForm.proyecto_id || uploadForm.proyecto_name || 'sin_proyecto',
          proyecto_name: uploadForm.proyecto_name,
          proyecto_tipo: 'obra',
          operario_id: user?.id || 'desconocido',
          operario_name: user?.full_name || user?.email || 'Desconocido',
          foto_url: file_url,
          fecha_foto: now.toISOString().split('T')[0],
          hora_foto: now.toTimeString().slice(0, 5),
          storage,
          drive_file_id,
        });
        ok++;
      } catch { errores++; }
    }
    setBatchProgress({ total: files.length, actual: files.length, ok, errores });
    qc.invalidateQueries({ queryKey: ['fotos-proyecto'] });
    setUploading(false);
    toast({ title: `Subidas ${ok} foto(s)${errores ? ` · ${errores} error(es)` : ''}` });
    setTimeout(() => {
      setBatchProgress(null);
      setUploadDialogOpen(false);
      setUploadForm({ titulo: '', descripcion: '', categoria: 'obra', proyecto_id: '', proyecto_name: '', foto_url: '', storage: '', drive_file_id: '' });
    }, 1200);
  };

  const handleSave = () => {
    if (!uploadForm.titulo || !uploadForm.foto_url) return;
    uploadMutation.mutate({ ...uploadForm, file: null });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Image className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Galería de Fotos</h1>
          <Badge variant="outline" className="text-xs">{filtradas.length} fotos</Badge>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Subir Foto</span>
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por proyecto, operario..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIAS.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(filterCat === cat ? '' : cat)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                filterCat === cat ? CAT_COLORS[cat] + ' border-transparent' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {CAT_LABELS[cat]}
            </button>
          ))}
        </div>
        {operarios.length > 0 && (
          <MobileSelect value={filterOperario} onValueChange={setFilterOperario} placeholder="Todos los operarios" triggerClassName="min-w-[160px]">
            <MobileSelectItem value="">Todos los operarios</MobileSelectItem>
            {operarios.map(op => <MobileSelectItem key={op} value={op}>{op}</MobileSelectItem>)}
          </MobileSelect>
        )}
        {obras.length > 0 && (
          <MobileSelect value={filterObra} onValueChange={setFilterObra} placeholder="Todas las obras" triggerClassName="min-w-[140px]">
            <MobileSelectItem value="">Todas las obras</MobileSelectItem>
            {obras.map(ob => <MobileSelectItem key={ob} value={ob}>{ob}</MobileSelectItem>)}
          </MobileSelect>
        )}
        {puedeVerInactivas && (
          <Button
            type="button"
            variant={mostrarInactivas ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMostrarInactivas(v => !v)}
            className="gap-1.5 shrink-0"
            title="Mostrar/ocultar fotos de obras inactivas"
          >
            {mostrarInactivas ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{mostrarInactivas ? 'Inactivas visibles' : 'Inactivas ocultas'}</span>
          </Button>
        )}
        {(filterCat || filterOperario || filterObra || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterCat(''); setFilterOperario(''); setFilterObra(''); setSearch(''); }}>
            <X className="w-3.5 h-3.5 mr-1" /> Limpiar
          </Button>
        )}
      </div>

      {/* Grid agrupado por cliente → obra (colapsable) */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Cargando fotos...</div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Image className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>No hay fotos que coincidan con los filtros{mostrarInactivas ? '' : ' (o están en obras inactivas)'}</p>
        </div>
      ) : (
        <ClientObraTree
          grouped={groupedFotos}
          defaultExpanded={!!search}
          renderProjectBadge={(pKey, p) => (
            <span className="text-[10px] text-muted-foreground hidden sm:inline">· foto{p.items.length !== 1 ? 's' : ''}</span>
          )}
          renderGroup={(items) => (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {items.map(foto => (
                <div
                  key={foto.id}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer hover:shadow-lg transition-all"
                  onClick={() => setSelectedFoto(foto)}
                >
                  <img
                    src={foto.foto_url}
                    alt={foto.titulo || 'Foto'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                    {foto.categoria && (
                      <Badge className={cn('text-[9px] px-1 py-0', CAT_COLORS[foto.categoria])}>{CAT_LABELS[foto.categoria]}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        />
      )}

      {/* Modal detalle */}
      {selectedFoto && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedFoto(null)}>
          <div className="bg-card rounded-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h3 className="font-semibold">{selectedFoto.titulo || 'Sin título'}</h3>
                <p className="text-xs text-muted-foreground">{selectedFoto.proyecto_name}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleDescargar(selectedFoto)} disabled={descargando} title="Descargar">
                  {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleCompartir(selectedFoto)} title="Compartir">
                  <Share2 className="w-4 h-4" />
                </Button>
                {puedeGestionarFoto(selectedFoto, user) && (
                  <Button variant="ghost" size="icon" onClick={() => setBorrarFoto(selectedFoto)} title="Eliminar" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setSelectedFoto(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <img src={selectedFoto.foto_url} alt={selectedFoto.titulo} className="w-full h-full object-contain max-h-[60vh]" />
            </div>
            <div className="p-4 text-sm space-y-1">
              {selectedFoto.operario_name && <p className="text-muted-foreground">👤 {selectedFoto.operario_name}</p>}
              {selectedFoto.fecha_foto && <p className="text-muted-foreground">📅 {format(new Date(selectedFoto.fecha_foto), 'dd MMMM yyyy', { locale: es })}</p>}
              {selectedFoto.descripcion && <p>{selectedFoto.descripcion}</p>}
              {selectedFoto.categoria && <Badge className={cn('text-xs', CAT_COLORS[selectedFoto.categoria])}>{CAT_LABELS[selectedFoto.categoria]}</Badge>}
            </div>
          </div>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Subir Foto(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {batchProgress && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="font-medium">
                    {batchProgress.actual >= batchProgress.total ? 'Finalizando…' : `Subiendo foto ${batchProgress.actual + 1} de ${batchProgress.total}`}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">✓ {batchProgress.ok} · ✕ {batchProgress.errores}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${batchProgress.total ? (batchProgress.actual / batchProgress.total) * 100 : 0}%` }} />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Título *</Label>
              <Input 
                value={uploadForm.titulo} 
                onChange={e => setUploadForm(p => ({ ...p, titulo: e.target.value }))} 
                placeholder="Nombre descriptivo..." 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoría</Label>
              <MobileSelect 
                value={uploadForm.categoria} 
                onValueChange={v => setUploadForm(p => ({ ...p, categoria: v }))}
              >
                {CATEGORIAS.map(cat => (
                  <MobileSelectItem key={cat} value={cat}>{CAT_LABELS[cat]}</MobileSelectItem>
                ))}
              </MobileSelect>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Proyecto / Obra</Label>
              <ObraPickerInput
                obrasMap={obrasMap}
                value={{ proyecto_id: uploadForm.proyecto_id, proyecto_name: uploadForm.proyecto_name }}
                onChange={(v) => setUploadForm(p => ({ ...p, proyecto_id: v.proyecto_id, proyecto_name: v.proyecto_name }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descripción</Label>
              <Textarea 
                value={uploadForm.descripcion} 
                onChange={e => setUploadForm(p => ({ ...p, descripcion: e.target.value }))} 
                rows={2} 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Archivo *</Label>
              {uploadForm.foto_url ? (
                <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                  <img src={uploadForm.foto_url} alt="Preview" className="w-16 h-16 object-cover rounded" />
                  <span className="text-xs flex-1 truncate">Foto subida</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    onClick={() => setUploadForm(p => ({ ...p, foto_url: '' }))}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <label className="block border-2 border-dashed rounded-lg h-24 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-muted/30 transition-colors">
                  {uploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {uploading ? 'Subiendo...' : 'Seleccionar fotos (puedes elegir varias)'}
                  </p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    className="hidden" 
                    onChange={e => handleFileUploadMultiple(Array.from(e.target.files || []))} 
                  />
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleSave} 
              disabled={!uploadForm.titulo || !uploadForm.foto_url || uploadMutation.isPending} 
              className="gap-2 min-w-28"
            >
              {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {borrarFoto && (
        <FotoGestionDialog
          foto={borrarFoto}
          open={!!borrarFoto}
          onOpenChange={(o) => !o && setBorrarFoto(null)}
          onDone={() => { setBorrarFoto(null); setSelectedFoto(null); }}
        />
      )}
    </div>
  );
}