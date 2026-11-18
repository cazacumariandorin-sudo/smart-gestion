import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, AlertCircle, FileText, ExternalLink, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { analizarPartidasDocumento } from '@/lib/partidasDesdeDocumento';
import RevisionPartidasPropuestas from './RevisionPartidasPropuestas';
import DocumentoOrigenViewer from './DocumentoOrigenViewer';

/**
 * Fase 1 — Partidas desde documentación de obra.
 * Sube Word/Excel/PDF, analiza el contenido y propone partidas editables.
 * El documento original queda asociado al presupuesto y, si hay obra,
 * también en la documentación de Ingeniería.
 */
export default function ImportarPartidasDocumento({
  documentos = [], onDocumentosChange, onIncorporar,
  clienteName, obraId, obraName, presupuestoCodigo,
}) {
  const [estado, setEstado] = useState('idle'); // idle | subiendo | analizando | revisando | error
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null); // { archivo, datos }
  const [docAbierto, setDocAbierto] = useState(null); // documento que se está viendo
  const inputRef = useRef(null);

  const vincularDocumento = async (archivo, datos) => {
    onDocumentosChange([...(documentos || []), {
      nombre: archivo.nombre,
      url: archivo.url,
      tipo: archivo.tipo,
      fecha_subida: archivo.fecha_subida,
      partidas_detectadas: datos.partidas?.length || 0,
      resumen: datos.resumen || '',
    }]);

    if (!obraId) return;
    try {
      await base44.entities.MaterialDocumentoOrigen.create({
        tipo: 'presupuesto',
        obra_id: obraId,
        obra_name: obraName || '',
        proyecto_ingenieria_id: obraId,
        archivo_url_original: archivo.url,
        archivo_url_mejorado: archivo.url,
        numero_documento: presupuestoCodigo || undefined,
        fecha_documento: new Date().toISOString().slice(0, 10),
        estado: 'pendiente_revision',
        datos_extraidos: datos,
        lineas_count: datos.partidas?.length || 0,
      });
    } catch (e) {
      // El vínculo con Ingeniería es secundario: el documento ya queda en el presupuesto
      console.warn('No se pudo vincular el documento en Ingeniería:', e?.message);
    }
  };

  const procesar = async (file) => {
    setError('');
    setResultado(null);
    setEstado('subiendo');
    setMensaje('Subiendo documento…');
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const archivo = { nombre: file.name, url: file_url, tipo: file.type, fecha_subida: new Date().toISOString() };

      setEstado('analizando');
      setMensaje('Analizando el documento…');
      const { datos, error: err } = await analizarPartidasDocumento({
        file_url, file_name: file.name, cliente_name: clienteName, obra_name: obraName,
      });
      if (err || !datos) throw new Error(err || 'No se pudo analizar el documento');

      await vincularDocumento(archivo, datos);
      setResultado({ archivo, datos });
      setEstado('revisando');
    } catch (e) {
      setError(e?.message || 'No se pudo procesar el documento');
      setEstado('error');
    }
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) procesar(file);
    e.target.value = '';
  };

  const ocupado = estado === 'subiendo' || estado === 'analizando';

  return (
    <div className="space-y-2">
      {estado === 'revisando' && resultado ? (
        <RevisionPartidasPropuestas
          datos={resultado.datos}
          archivo={resultado.archivo}
          onIncorporar={(lineas) => { onIncorporar(lineas); setEstado('idle'); setResultado(null); }}
          onDescartar={() => { setEstado('idle'); setResultado(null); }}
        />
      ) : (
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all',
            estado === 'error' ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : 'border-border hover:border-primary hover:bg-accent/30'
          )}
          onClick={() => !ocupado && inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={handleChange} />
          {ocupado ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-sm font-medium text-primary">{mensaje}</p>
            </div>
          ) : estado === 'error' ? (
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <p className="text-sm font-medium text-red-600">{error}</p>
              <p className="text-xs text-muted-foreground">Toca para reintentar</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-6 h-6 text-muted-foreground" />
              <p className="text-sm font-semibold">Subir documentación de obra (Word, Excel o PDF)</p>
              <p className="text-xs text-muted-foreground">Se proponen las partidas del documento para que las revises antes de incorporarlas</p>
            </div>
          )}
        </div>
      )}

      {documentos.length > 0 && (
        <div className="space-y-1">
          {documentos.map((d, i) => (
            <div key={`${d.url}-${i}`} className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded-md px-2 py-1">
              <FileText className="w-3 h-3 shrink-0" />
              <span className="truncate flex-1">{d.nombre}</span>
              {d.partidas_detectadas > 0 && <span>{d.partidas_detectadas} partidas</span>}
              {d.url && (
                <button type="button" onClick={() => setDocAbierto(d)} className="text-primary hover:underline shrink-0 inline-flex items-center gap-1" title="Abrir documento original">
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground flex items-start gap-1">
            <Info className="w-3 h-3 shrink-0 mt-0.5" />
            El documento original se guarda con el presupuesto y, si hay obra asignada, también en la documentación de Ingeniería.
          </p>
        </div>
      )}

      {docAbierto && <DocumentoOrigenViewer doc={docAbierto} onClose={() => setDocAbierto(null)} />}
    </div>
  );
}