import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Upload, Download, Eye, Copy, Trash2, FileText, Loader2, Share2, FileCheck2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const TIPO_DOCS = [
  { value: 'permiso_circulacion', label: 'Permiso de circulación', icon: '📋' },
  { value: 'ficha_tecnica', label: 'Ficha técnica', icon: '🔧' },
  { value: 'seguro', label: 'Seguro', icon: '🛡️' },
  { value: 'itv', label: 'ITV', icon: '✅' },
  { value: 'otro', label: 'Otro', icon: '📎' },
];

export default function VehiculoDocumentos({ vehiculo, puedeGestionar }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [subiendo, setSubiendo] = useState(null);
  const inputRefs = useRef({});
  const docs = Array.isArray(vehiculo.documentos) ? vehiculo.documentos : [];

  const docPorTipo = (tipo) => docs.find(d => d.tipo === tipo);

  const subirDocumento = async (tipo, file) => {
    if (!file) return;
    setSubiendo(tipo);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const nuevoDoc = {
        tipo,
        url: file_url,
        nombre: file.name,
        fecha_subida: new Date().toISOString(),
        subido_por: user?.email || '',
      };
      const existenteIdx = docs.findIndex(d => d.tipo === tipo);
      const nuevosDocs = existenteIdx >= 0
        ? docs.map((d, i) => i === existenteIdx ? nuevoDoc : d)
        : [...docs, nuevoDoc];
      await base44.entities.Vehiculo.update(vehiculo.id, { documentos: nuevosDocs });
      qc.invalidateQueries({ queryKey: ['vehiculos'] });
      toast.success(`${TIPO_DOCS.find(t => t.value === tipo)?.label} subido correctamente`);
    } catch (e) {
      toast.error('Error al subir el documento');
    } finally {
      setSubiendo(null);
      if (inputRefs.current[tipo]) inputRefs.current[tipo].value = '';
    }
  };

  const eliminarDocumento = async (tipo) => {
    const nuevosDocs = docs.filter(d => d.tipo !== tipo);
    try {
      await base44.entities.Vehiculo.update(vehiculo.id, { documentos: nuevosDocs });
      qc.invalidateQueries({ queryKey: ['vehiculos'] });
      toast.success('Documento eliminado');
    } catch {
      toast.error('Error al eliminar el documento');
    }
  };

  const copiarEnlace = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace copiado al portapapeles — pégalo en el correo para el tercero');
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-4 h-4 text-green-600" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Documentación del vehículo
        </p>
      </div>

      {TIPO_DOCS.map(({ value, label, icon }) => {
        const doc = docPorTipo(value);
        const isSubiendo = subiendo === value;
        return (
          <div
            key={value}
            className={cn(
              'flex items-center justify-between gap-2 rounded-lg border p-2.5',
              doc ? 'border-green-200 bg-green-50/40 dark:bg-green-950/20' : 'border-border bg-muted/30'
            )}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-lg shrink-0">{icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{label}</p>
                {doc ? (
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.nombre} · {doc.fecha_subida && format(new Date(doc.fecha_subida), 'dd/MM/yyyy', { locale: es })}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin documento</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {doc ? (
                <>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-primary"
                    title="Visualizar en nueva pestaña" onClick={() => window.open(doc.url, '_blank')}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600"
                    title="Descargar" onClick={() => {
                      const a = document.createElement('a');
                      a.href = doc.url;
                      a.download = doc.nombre || label;
                      a.click();
                    }}>
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600"
                    title="Copiar enlace público para enviar a terceros" onClick={() => copiarEnlace(doc.url)}>
                    <Share2 className="w-4 h-4" />
                  </Button>
                  {puedeGestionar && (
                    <>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground"
                        title="Reemplazar" onClick={() => inputRefs.current[value]?.click()}>
                        <Upload className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                        title="Eliminar" onClick={() => eliminarDocumento(value)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </>
              ) : puedeGestionar ? (
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs"
                  disabled={isSubiendo}
                  onClick={() => inputRefs.current[value]?.click()}>
                  {isSubiendo
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Subiendo…</>
                    : <><Upload className="w-3.5 h-3.5" />Subir</>}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground italic">—</span>
              )}
              <input
                ref={el => { inputRefs.current[value] = el; }}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) subirDocumento(value, f); }}
              />
            </div>
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
        <FileCheck2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-600" />
        Los documentos se guardan con enlace público permanente: copia el enlace y envíalo a talleres, proveedores o autoridades sin necesidad de login.
      </p>
    </div>
  );
}