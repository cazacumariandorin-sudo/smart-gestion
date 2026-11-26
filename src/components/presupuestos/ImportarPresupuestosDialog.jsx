import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, X, Loader2, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import PropuestaImportada from './PropuestaImportada';
import DocumentoOrigenViewer from './DocumentoOrigenViewer';
import { analizarPresupuestoExterno, normalizarPropuesta, NUEVO_CLIENTE } from '@/lib/importarPresupuestoExterno';

const hoy = () => new Date().toISOString().slice(0, 10);

const aPayload = (p, cliente_id) => ({
  cliente_id,
  cliente_name: p.cliente_nombre || '',
  fecha: p.fecha || hoy(),
  titulo: p.titulo || p.archivo?.nombre || 'Presupuesto importado',
  referencia_cliente: p.numero_documento || '',
  notas: p.notas || '',
  conceptos: (p.lineas || [])
    .filter((l) => String(l.descripcion || '').trim())
    .map((l) => ({
      tipo: l.tipo === 'texto' ? 'texto' : 'linea',
      descripcion: String(l.descripcion).trim(),
      cantidad: l.tipo === 'texto' ? undefined : Number(l.cantidad) || 0,
      unidad: l.unidad || 'ud',
      precio_unitario: l.tipo === 'texto' ? undefined : Number(l.precio_unitario) || 0,
      iva_pct: l.tipo === 'texto' ? undefined : Number(l.iva_pct) || 0,
    })),
  documentos_origen: p.archivo?.url ? [{
    nombre: p.archivo.nombre,
    url: p.archivo.url,
    tipo: p.archivo.tipo,
    fecha_subida: p.archivo.fecha_subida,
    partidas_detectadas: (p.lineas || []).length,
    resumen: p.resumen || '',
  }] : [],
});

/**
 * Importar presupuestos y facturas externas (Excel o PDF):
 * se leen, se revisan y se crean como presupuestos en borrador.
 */
export default function ImportarPresupuestosDialog({ open, onClose, onImported }) {
  const [propuestas, setPropuestas] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [docAbierto, setDocAbierto] = useState(null);
  const inputRef = useRef(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes_presupuesto'],
    queryFn: () => base44.entities.Client.list('name', 500),
    enabled: open,
  });

  if (!open) return null;

  const listas = propuestas.filter((p) => p.estado === 'lista');

  const cerrar = () => {
    if (importando) return;
    setPropuestas([]);
    setResultado(null);
    setProcesando(false);
    onClose();
  };

  const agregarArchivos = async (files) => {
    const lista = Array.from(files || []);
    if (!lista.length) return;
    setProcesando(true);
    for (const file of lista) {
      const tempId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setPropuestas((prev) => [...prev, { tempId, estado: 'procesando', archivo: { nombre: file.name, tipo: file.type } }]);
      try {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        const archivo = { nombre: file.name, url: file_uri, tipo: file.type, fecha_subida: new Date().toISOString() };
        const { datos, error } = await analizarPresupuestoExterno({ file_url: file_uri, file_name: file.name });
        if (error || !datos) throw new Error(error || 'No se pudo leer el documento');
        const propuesta = normalizarPropuesta(datos, archivo, clientes);
        setPropuestas((prev) => prev.map((p) => (p.tempId === tempId ? { ...p, ...propuesta, tempId, estado: 'lista' } : p)));
      } catch (e) {
        setPropuestas((prev) => prev.map((p) => (p.tempId === tempId
          ? { ...p, estado: 'error', error: e?.message || 'No se pudo procesar el documento' }
          : p)));
      }
    }
    setProcesando(false);
  };

  const importar = async () => {
    setImportando(true);
    const creados = [];
    const errores = [];
    for (const p of listas) {
      try {
        let cliente_id = p.cliente_id;
        if (cliente_id === NUEVO_CLIENTE) {
          const nuevo = await base44.entities.Client.create({
            name: p.cliente_nombre,
            nif: p.cliente_nif || undefined,
          });
          cliente_id = nuevo.id;
        }
        if (!cliente_id) throw new Error('Falta indicar el cliente');

        const payload = aPayload(p, cliente_id);
        if (payload.conceptos.length === 0) throw new Error('El presupuesto no tiene líneas');

        const res = await base44.functions.invoke('guardarPresupuesto', payload);
        creados.push({
          archivo: p.archivo?.nombre,
          codigo: res.data?.codigo_registro,
          titulo: res.data?.data?.titulo || p.titulo,
        });
      } catch (e) {
        errores.push({
          archivo: p.archivo?.nombre,
          mensaje: e?.response?.data?.error || e?.message || 'No se pudo crear el presupuesto',
        });
      }
    }
    setResultado({ creados, errores });
    setImportando(false);
    onImported?.();
    if (creados.length) toast.success(`${creados.length} presupuesto(s) importado(s)`);
    if (errores.length) toast.error(`${errores.length} documento(s) no se pudieron importar`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-3 overflow-y-auto">
      <Card className="w-full max-w-3xl my-4">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Importar presupuestos externos</CardTitle>
            <p className="text-xs text-muted-foreground">Excel o PDF creados con otros programas</p>
          </div>
          <Button variant="ghost" size="icon" onClick={cerrar} disabled={importando}><X className="w-4 h-4" /></Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {resultado ? (
            <div className="space-y-3">
              {resultado.creados.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold flex items-center gap-1.5 text-green-700">
                    <CheckCircle2 className="w-4 h-4" /> {resultado.creados.length} importado(s)
                  </p>
                  {resultado.creados.map((c, i) => (
                    <div key={i} className="text-xs rounded-md bg-muted/40 px-2 py-1.5 flex justify-between gap-2">
                      <span className="truncate">{c.titulo || c.archivo}</span>
                      {c.codigo && <span className="font-mono shrink-0">{c.codigo}</span>}
                    </div>
                  ))}
                </div>
              )}
              {resultado.errores.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold flex items-center gap-1.5 text-destructive">
                    <AlertCircle className="w-4 h-4" /> No se pudieron importar
                  </p>
                  {resultado.errores.map((e, i) => (
                    <div key={i} className="text-xs rounded-md border border-destructive/30 px-2 py-1.5">
                      <p className="font-medium truncate">{e.archivo}</p>
                      <p className="text-muted-foreground">{e.mensaje}</p>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={cerrar}>Cerrar</Button>
            </div>
          ) : (
            <>
              {/* Subida */}
              <div>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept=".pdf,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => { agregarArchivos(e.target.files); e.target.value = ''; }}
                />
                <div
                  className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-primary hover:bg-accent/30 transition-colors"
                  onClick={() => !procesando && !importando && inputRef.current?.click()}
                >
                  {procesando ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      <p className="text-sm font-medium text-primary">Leyendo los documentos…</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <p className="text-sm font-semibold">Subir Excel o PDF</p>
                      <p className="text-xs text-muted-foreground">Puedes seleccionar varios documentos a la vez</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Documentos en proceso o con error */}
              {propuestas.filter((p) => p.estado !== 'lista').length > 0 && (
                <div className="space-y-1.5">
                  {propuestas.filter((p) => p.estado !== 'lista').map((p) => (
                    <div key={p.tempId} className="flex items-center gap-2 text-xs rounded-md border px-2 py-1.5">
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate flex-1">{p.archivo?.nombre}</span>
                      {p.estado === 'procesando'
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        : <span className="text-destructive truncate max-w-[55%]">{p.error}</span>}
                      {p.estado === 'error' && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                          onClick={() => setPropuestas((prev) => prev.filter((x) => x.tempId !== p.tempId))}>
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Revisión */}
              {listas.length > 0 && (
                <div className="space-y-3">
                  {listas.map((p) => (
                    <PropuestaImportada
                      key={p.tempId}
                      propuesta={p}
                      clientes={clientes}
                      onChange={(patch) => setPropuestas((prev) => prev.map((x) => (x.tempId === p.tempId ? { ...x, ...patch } : x)))}
                      onRemove={() => setPropuestas((prev) => prev.filter((x) => x.tempId !== p.tempId))}
                      onVerDocumento={() => setDocAbierto(p.archivo)}
                    />
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={cerrar} disabled={importando}>Cancelar</Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={importar}
                  disabled={importando || procesando || listas.length === 0}
                >
                  {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importando ? 'Importando…' : `Importar ${listas.length || ''} presupuesto(s)`}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Los documentos se guardan como presupuestos en borrador y conservan el archivo original para su comprobación.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {docAbierto && <DocumentoOrigenViewer doc={docAbierto} onClose={() => setDocAbierto(null)} />}
    </div>
  );
}