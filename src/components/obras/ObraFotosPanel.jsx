import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, X, ZoomIn, Download, Trash2, Loader2, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function ObraFotosPanel({ obra }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [selectedFoto, setSelectedFoto] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const { data: fotos = [], isLoading } = useQuery({
    queryKey: ['fotos-obra', obra.id],
    queryFn: () => base44.entities.FotoProyecto.filter({ proyecto_id: obra.id }, '-fecha_hora_subida', 100),
  });

  const deleteM = useMutation({
    mutationFn: id => base44.entities.FotoProyecto.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fotos-obra', obra.id] });
      qc.invalidateQueries({ queryKey: ['fotos-proyecto'] });
      setSelectedFoto(null);
    },
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setTitulo('');
    setDescripcion('');
    setShowForm(true);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: pendingFile });
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
    setUploading(false);
    setShowForm(false);
    setPendingFile(null);
    setPreviewUrl(null);
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
      ) : fotos.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-xl">
          <Image className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">No hay fotos en esta obra</p>
          <p className="text-xs text-muted-foreground mt-1">Pulsa "Añadir foto" para subir la primera</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{fotos.length} foto{fotos.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {fotos.map(foto => (
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

      {/* Lightbox */}
      {selectedFoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setSelectedFoto(null)}
        >
          <div
            className="bg-card rounded-2xl overflow-hidden max-w-xl w-full max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{selectedFoto.titulo || 'Sin título'}</h3>
                {selectedFoto.operario_name && (
                  <p className="text-xs text-muted-foreground">👤 {selectedFoto.operario_name}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(selectedFoto)}>
                  <Download className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar foto?</AlertDialogTitle>
                      <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteM.mutate(selectedFoto.id)} className="bg-destructive text-destructive-foreground">
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedFoto(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <img
              src={selectedFoto.foto_url}
              alt={selectedFoto.titulo}
              className="w-full object-contain max-h-[55vh] bg-black"
            />
            <div className="p-3 text-xs space-y-1 text-muted-foreground">
              {selectedFoto.fecha_foto && (
                <p>📅 {format(new Date(selectedFoto.fecha_foto), 'dd MMMM yyyy', { locale: es })}</p>
              )}
              {selectedFoto.descripcion && <p className="text-foreground">{selectedFoto.descripcion}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}