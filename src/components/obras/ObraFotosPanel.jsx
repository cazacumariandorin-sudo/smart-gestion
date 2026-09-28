import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, X, ZoomIn, Download, Trash2, Loader2, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { subirImagen } from '@/lib/uploadPhoto';
import { imagenNoVacia } from '@/lib/fotoValidacion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import FotoGestionDialog, { puedeGestionarFoto } from '@/components/fotos/FotoGestionDialog';

export default function ObraFotosPanel({ obra }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [selectedFoto, setSelectedFoto] = useState(null);
  const [borrarFoto, setBorrarFoto] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [batchProgress, setBatchProgress] = useState(null);

  const { data: fotos = [], isLoading } = useQuery({
    queryKey: ['fotos-obra', obra.id],
    queryFn: () => base44.entities.FotoProyecto.filter({ proyecto_id: obra.id }, '-fecha_hora_subida', 100),
  });
  const fotosVisibles = fotos.filter(f => !f.eliminada);

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['fotos-obra', obra.id] });
    qc.invalidateQueries({ queryKey: ['fotos-proyecto'] });
    setSelectedFoto(null);
    setBorrarFoto(null);
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    // Un solo archivo → flujo con formulario (título/descripción)
    if (files.length === 1) {
      const file = files[0];
      // Validar que la captura no esté en blanco / archivo vacío
      if (!(await imagenNoVacia(file))) {
        toast({
          title: 'Foto en blanco',
          description: 'La imagen no tiene contenido (tal vez la cámara no terminó de capturar). Inténtalo de nuevo.',
          variant: 'destructive',
        });
        return;
      }
      setPendingFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setTitulo('');
      setDescripcion('');
      setShowForm(true);
      return;
    }
    // Varios archivos → subida por lote (título = nombre del archivo)
    await subirLote(files);
  };

  const subirLote = async (files) => {
    setUploading(true);
    setBatchProgress({ total: files.length, actual: 0, ok: 0, errores: 0 });
    let ok = 0, errores = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBatchProgress({ total: files.length, actual: i, ok, errores });
      try {
        if (!(await imagenNoVacia(file))) { errores++; continue; }
        const { file_url } = await subirImagen(file);
        const now = new Date();
        await base44.entities.FotoProyecto.create({
          foto_url: file_url,
          categoria: 'obra',
          proyecto_id: obra.id,
          proyecto_name: obra.name,
          proyecto_tipo: 'obra',
          referencia_id: obra.id,
          referencia_tipo: 'Obra',
          referencia_nombre: obra.name,
          operario_id: user?.id || user?.email || '',
          operario_name: user?.full_name || user?.email || '',
          fecha_foto: format(now, 'yyyy-MM-dd'),
          hora_foto: format(now, 'HH:mm'),
          fecha_hora_subida: now.toISOString(),
          titulo: file.name,
          descripcion: '',
        });
        ok++;
      } catch {
        errores++;
      }
    }
    setBatchProgress({ total: files.length, actual: files.length, ok, errores });
    qc.invalidateQueries({ queryKey: ['fotos-obra', obra.id] });
    qc.invalidateQueries({ queryKey: ['fotos-proyecto'] });
    setUploading(false);
    toast({
      title: `Subida completada: ${ok} foto(s)${errores ? ` · ${errores} error(es)` : ''}`,
    });
    setTimeout(() => setBatchProgress(null), 1500);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const { file_url } = await subirImagen(pendingFile);
      const now = new Date();
      await base44.entities.FotoProyecto.create({
        foto_url: file_url,
        categoria: 'obra',
        proyecto_id: obra.id,
        proyecto_name: obra.name,
        proyecto_tipo: 'obra',
        referencia_id: obra.id,
        referencia_tipo: 'Obra',
        referencia_nombre: obra.name,
        operario_id: user?.id || user?.email || '',
        operario_name: user?.full_name || user?.email || '',
        fecha_foto: format(now, 'yyyy-MM-dd'),
        hora_foto: format(now, 'HH:mm'),
        fecha_hora_subida: now.toISOString(),
        titulo: titulo || pendingFile.name,
        descripcion,
      });
      qc.invalidateQueries({ queryKey: ['fotos-obra', obra.id] });
      qc.invalidateQueries({ queryKey: ['fotos-proyecto'] });
      setShowForm(false);
      setPendingFile(null);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (foto) => {
    const a = document.createElement('a');
    a.href = foto.foto_url;
    a.download = foto.titulo || 'foto-obra';
    a.target = '_blank';
    a.click();
  };

  if (showForm) {
    return (
      <div className="space-y-4">
        {previewUrl && (
          <div className="rounded-xl overflow-hidden max-h-64 bg-muted">
            <img src={previewUrl} alt="preview" className="w-full h-64 object-contain" />
          </div>
        )}
        <div className="space-y-2">
          <Input
            placeholder="Título (opcional)"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
          />
          <Input
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setShowForm(false); setPendingFile(null); setPreviewUrl(null); }} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={uploading} className="flex-1 gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Subir foto
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progreso de subida por lote */}
      {batchProgress && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="font-medium">
              {batchProgress.actual >= batchProgress.total
                ? 'Finalizando…'
                : `Subiendo foto ${batchProgress.actual + 1} de ${batchProgress.total}`}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              ✓ {batchProgress.ok} · ✕ {batchProgress.errores}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${batchProgress.total ? (batchProgress.actual / batchProgress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
      {/* Upload button */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="gap-2 flex-1"
          onClick={() => fileRef.current?.click()}
        >
          <Camera className="w-4 h-4" /> Añadir foto
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => { fileRef.current?.removeAttribute('capture'); fileRef.current?.click(); }}
        >
          <Upload className="w-4 h-4" /> Galería
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Cargando fotos...</div>
      ) : fotosVisibles.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-xl">
          <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">No hay fotos en esta obra</p>
          <p className="text-xs text-muted-foreground mt-1">Pulsa "Añadir foto" para subir la primera</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{fotosVisibles.length} foto{fotosVisibles.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {fotosVisibles.map(foto => (
              <div
                key={foto.id}
                className="group relative aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer hover:shadow-md transition-all"
                onClick={() => setSelectedFoto(foto)}
              >
                <img
                  src={foto.foto_url}
                  alt={foto.titulo || 'Foto'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {foto.titulo && (
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-white text-[10px] truncate">{foto.titulo}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Visor compartido: zoom (rueda/pellizco/doble clic) + arrastre + descarga */}
      {selectedFoto && (
        <ImageLightbox
          url={selectedFoto.foto_url}
          nombre={selectedFoto.titulo || 'Sin título'}
          subtitulo={[
            selectedFoto.operario_name && `👤 ${selectedFoto.operario_name}`,
            selectedFoto.fecha_foto && `📅 ${format(new Date(selectedFoto.fecha_foto), 'dd MMMM yyyy', { locale: es })}`,
            selectedFoto.descripcion,
          ].filter(Boolean).join(' · ')}
          onClose={() => setSelectedFoto(null)}
          extra={puedeGestionarFoto(selectedFoto, user) ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-400 hover:bg-white/10 hover:text-red-300"
              title="Eliminar"
              onClick={() => { setBorrarFoto(selectedFoto); setSelectedFoto(null); }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          ) : null}
        />
      )}

      {borrarFoto && (
        <FotoGestionDialog
          foto={borrarFoto}
          open={!!borrarFoto}
          onOpenChange={(o) => !o && setBorrarFoto(null)}
          onDone={refrescar}
        />
      )}
    </div>
  );
}