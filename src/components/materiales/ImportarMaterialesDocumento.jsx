import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, AlertCircle, FileText, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { analizarMaterialesDocumento } from '@/lib/materialesDesdeDocumento';
import ListaMaterialesDetectados from './ListaMaterialesDetectados';

/**
 * Importa un documento y propone los materiales pendientes que contiene,
 * para asignarlos a la obra seleccionada en el formulario.
 *
 * Props: obra, onCrear(items), creando
 */
export default function ImportarMaterialesDocumento({ obra, onCrear, creando }) {
  const [estado, setEstado] = useState('idle'); // idle | subiendo | analizando | revisando | error
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [documento, setDocumento] = useState(null);
  const [datos, setDatos] = useState(null);
  const [items, setItems] = useState([]);
  const inputRef = useRef(null);

  const procesar = async (file) => {
    setError('');
    setEstado('subiendo');
    setMensaje('Subiendo documento…');
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 3600 });

      setEstado('analizando');
      setMensaje('Analizando el documento…');
      const { datos: d, error: err } = await analizarMaterialesDocumento({
        file_url: signed_url,
        file_name: file.name,
        obra_name: obra?.obra_name || '',
      });
      if (err || !d) throw new Error(err || 'No se pudo analizar el documento');

      const lista = (d.materiales || []).map((m, i) => ({
        id: `m-${i}`,
        descripcion: m.descripcion || '',
        referencia: m.referencia || '',
        observaciones: m.observaciones || '',
        cantidad: m.cantidad ?? 1,
        unidad: m.unidad || 'ud',
        prioridad: m.prioridad || 'media',
        incluido: true,
      }));
      setDocumento({ nombre: file.name, file_uri });
      setDatos(d);
      setItems(lista);
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

  const seleccionados = items.filter((it) => it.incluido && it.descripcion.trim());
  const ocupado = estado === 'subiendo' || estado === 'analizando';

  if (estado === 'revisando') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs bg-muted/40 rounded-md px-2 py-1.5">
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate flex-1">{documento?.nombre}</span>
          <span className="shrink-0 text-muted-foreground">{items.length} materiales</span>
        </div>

        {datos?.resumen && (
          <p className="text-[11px] text-muted-foreground">{datos.resumen}</p>
        )}

        {items.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            El documento no parece contener materiales pendientes.
            <Button variant="link" size="sm" className="h-auto p-0 ml-1" onClick={() => { setEstado('idle'); setItems([]); }}>
              Probar otro
            </Button>
          </div>
        ) : (
          <>
            <ListaMaterialesDetectados items={items} onChange={setItems} />
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => { setEstado('idle'); setItems([]); setDatos(null); }} disabled={creando}>
                Descartar
              </Button>
              <Button
                size="sm"
                onClick={() => onCrear(seleccionados)}
                disabled={creando || seleccionados.length === 0 || !obra?.obra_id}
              >
                {creando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Crear {seleccionados.length} solicitud{seleccionados.length === 1 ? '' : 'es'}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all',
          estado === 'error' ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : 'border-border hover:border-primary hover:bg-accent/30'
        )}
        onClick={() => !ocupado && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={handleChange} />
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
            <p className="text-sm font-semibold">Subir documento (PDF, Word o Excel)</p>
            <p className="text-xs text-muted-foreground">Se extraen los materiales pendientes para revisarlos antes de crearlos</p>
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground flex items-start gap-1">
        <Info className="w-3 h-3 shrink-0 mt-0.5" />
        Los materiales se asignan a la obra seleccionada. El documento se guarda de forma privada y solo se usa para el análisis.
      </p>
    </div>
  );
}