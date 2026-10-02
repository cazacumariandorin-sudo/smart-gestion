import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subirImagen } from '@/lib/uploadPhoto';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Upload, Trash2, Loader2, ImageIcon, X } from 'lucide-react';
import ImageLightbox from '@/components/ui/ImageLightbox';

export default function PhotoUploader({ workOrderId, clientId, clientName, project, date }) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [captions, setCaptions] = useState({});
  const [lightbox, setLightbox] = useState(null);

  const { data: photos = [] } = useQuery({
    queryKey: ['photos', workOrderId],
    queryFn: () => base44.entities.WorkPhoto.filter({ work_order_id: workOrderId }),
    enabled: !!workOrderId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkPhoto.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photos', workOrderId] }),
  });

  const handleFiles = async (files) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { file_url } = await subirImagen(file);
        await base44.entities.WorkPhoto.create({
          work_order_id: workOrderId,
          client_id: clientId,
          client_name: clientName,
          project,
          date,
          photo_url: file_url,
          caption: '',
          storage: 'cdn',
          drive_file_id: null,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['photos', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['all_photos'] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          Fotos ({photos.length})
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? 'Subiendo...' : 'Subir fotos'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {photos.length === 0 ? (
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Haz clic o arrastra fotos aquí</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
              <img
                src={photo.photo_url}
                alt={photo.caption || 'Foto'}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setLightbox(photo)}
              />
              <button
                type="button"
                onClick={() => deleteMutation.mutate(photo.id)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div
            className="aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <ImageLightbox
          url={lightbox.photo_url}
          nombre={lightbox.caption || 'Foto'}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}