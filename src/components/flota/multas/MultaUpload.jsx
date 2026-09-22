import { useRef, useState } from 'react';
import { Upload, Loader2, FileText, X, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Botón de subida de archivo para documentos de multa (volante / justificante).
 * Usa la integración Core.UploadPublicFile (no requiere backend function).
 */
export default function MultaUpload({ value, onChange, label = 'Subir documento', accept = 'image/*,application/pdf', disabled = false }) {
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);

  const esImagen = value && /\.(jpg|jpeg|png|webp|gif)$/i.test(value);

  const subir = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo supera los 10 MB');
      return;
    }
    setSubiendo(true);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      const url = res?.file_url || res?.data?.file_url;
      if (!url) throw new Error('No se obtuvo URL');
      onChange(url);
      toast.success('Documento subido');
    } catch (e) {
      toast.error('Error al subir el documento', e?.message);
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => subir(e.target.files?.[0])}
        disabled={disabled || subiendo}
      />
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
          {esImagen ? (
            <img src={value} alt="documento" className="w-12 h-12 object-cover rounded-md border" />
          ) : (
            <div className="w-12 h-12 flex items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{label}</p>
            <a href={value} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
              Abrir documento
            </a>
          </div>
          {!disabled && (
            <>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => inputRef.current?.click()} disabled={subiendo} title="Reemplazar">
                {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              </Button>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onChange('')} disabled={subiendo} title="Quitar">
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('w-full gap-2', disabled && 'opacity-50')}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || subiendo}
        >
          {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
          {label}
        </Button>
      )}
    </div>
  );
}