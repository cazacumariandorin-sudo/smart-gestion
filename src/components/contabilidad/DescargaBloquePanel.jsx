import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, Download, FileSpreadsheet, Package, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const CATEGORIAS = ['material', 'combustible', 'peaje', 'parking', 'comida', 'otros'];

/**
 * Pestaña "Descarga en bloque para gestoría" — invoca la función backend
 * descargarJustificantesPeriodo que genera ZIP(s) con subcarpetas
 * (facturas/, tickets/, fotos/) + Excel índice con hoja "Fotos".
 * Acceso: contabilidad, administracion, gerencia, admin.
 */
export default function DescargaBloquePanel({ rango }) {
  const { isContabilidad, isAdministracion, isGerencia, isAdmin } = useUserRole();
  const puede = isContabilidad || isAdministracion || isGerencia || isAdmin;
  const [tipoDoc, setTipoDoc] = useState('ambos');
  const [tipoArchivo, setTipoArchivo] = useState('todos');
  const [categoria, setCategoria] = useState('todas');
  const [operarioFiltro, setOperarioFiltro] = useState('');
  const [incluirDescargados, setIncluirDescargados] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState(null);

  // Operarios únicos con registros en el periodo (para rellenar el dropdown)
  const { data: operariosPeriodo = [] } = useQuery({
    queryKey: ['operarios_descarga_bloque', rango.inicio, rango.fin],
    queryFn: async () => {
      const gastos = await base44.entities.RegistroGasto.filter(
        { fecha_documento: { $gte: rango.inicio, $lte: rango.fin } },
        '-fecha_documento',
        500,
      );
      const map = new Map();
      for (const g of gastos || []) {
        if (g.operario_id) map.set(g.operario_id, g.operario_name || 'Operario');
      }
      return Array.from(map.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: puede && !!rango.inicio && !!rango.fin,
  });

  const handleDescargar = async () => {
    if (!puede) { toast.error('No tienes permiso para generar descargas en bloque'); return; }
    setGenerando(true);
    setResultado(null);
    try {
      const res = await base44.functions.invoke('descargarJustificantesPeriodo', {
        inicio: rango.inicio,
        fin: rango.fin,
        etiqueta: rango.etiqueta,
        tipo_doc: tipoDoc,
        tipo_archivo: tipoArchivo,
        categoria: categoria === 'todas' ? undefined : categoria,
        operario_id: operarioFiltro || undefined,
        incluir_descargados: incluirDescargados,
      });
      const data = res?.data || res;
      if (data?.success === false) throw new Error(data?.error || 'Error desconocido');
      setResultado(data);
      if (data?.zips?.length) toast.success(`${data.zips.length} ZIP(s) generados`);
      else toast.info(data?.mensaje || 'No había archivos para descargar');
    } catch (e) {
      toast.error(`Error: ${e?.message || 'No se pudo generar la descarga'}`);
    } finally {
      setGenerando(false);
    }
  };

  if (!puede) {
    return <Card className="p-8 text-center text-muted-foreground text-sm">Solo contabilidad, administración, gerencia o admin pueden generar descargas en bloque.</Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Package className="w-4 h-4 text-primary" />
          <span className="font-medium">Descarga en bloque — periodo {rango.etiqueta}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Recopila los justificantes del periodo, genera un ZIP con subcarpetas (facturas/, tickets/, fotos/) troceado por operario si supera 200 documentos, y un Excel índice con hoja "Fotos" que vincula cada justificante a su registro.
        </p>
        <p className="text-[10px] text-muted-foreground bg-blue-50 dark:bg-blue-950/30 rounded-md px-2 py-1.5">
          Esto es el paquete con los <b>archivos reales</b> (fotos/PDFs de cada ticket). El botón <b>"Informe"</b> de un ciclo concreto genera en cambio un PDF resumen con enlaces a cada ticket — útil para mirar de un vistazo, pero no sustituye descargar este ZIP si la gestoría necesita los archivos en sí.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de documento</Label>
            <MobileSelect value={tipoDoc} onValueChange={setTipoDoc} placeholder="Tipo">
              <MobileSelectItem value="ambos">Gastos + Documentos materiales</MobileSelectItem>
              <MobileSelectItem value="registro">Solo gastos</MobileSelectItem>
              <MobileSelectItem value="documento">Solo documentos materiales</MobileSelectItem>
            </MobileSelect>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de archivo (factura/ticket)</Label>
            <MobileSelect value={tipoArchivo} onValueChange={setTipoArchivo} placeholder="Todos">
              <MobileSelectItem value="todos">Todos</MobileSelectItem>
              <MobileSelectItem value="factura">Solo facturas (con nº factura)</MobileSelectItem>
              <MobileSelectItem value="ticket">Solo tickets (sin nº factura)</MobileSelectItem>
            </MobileSelect>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoría</Label>
            <MobileSelect value={categoria} onValueChange={setCategoria} placeholder="Todas">
              <MobileSelectItem value="todas">Todas</MobileSelectItem>
              {CATEGORIAS.map(c => (
                <MobileSelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label className="text-xs">Operario (opcional — vacío = todos)</Label>
            <MobileSelect value={operarioFiltro} onValueChange={setOperarioFiltro} placeholder="Todos los operarios">
              <MobileSelectItem value="">Todos los operarios</MobileSelectItem>
              {operariosPeriodo.map(op => (
                <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>
              ))}
            </MobileSelect>
            <p className="text-[10px] text-muted-foreground">Se rellena automáticamente con los operarios que tienen gastos en el periodo. El troceo automático agrupa por operario cuando el volumen supera 200 documentos.</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/40">
          <div>
            <Label className="text-xs">Incluir ya descargados</Label>
            <p className="text-[10px] text-muted-foreground">Por defecto se excluyen los documentos ya entregados a contabilidad (marcados como descargados). Actívalo solo para reenviar un lote (la gestoría perdió el archivo, etc.).</p>
          </div>
          <Switch checked={incluirDescargados} onCheckedChange={setIncluirDescargados} />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleDescargar} disabled={generando} className="gap-2">
            {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generando ? 'Generando ZIP(s)…' : 'Generar descarga'}
          </Button>
        </div>
      </Card>

      {resultado && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {resultado.zips?.length ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
            <span className="font-medium">
              {resultado.zips?.length || 0} ZIP(s) · {resultado.total_docs || 0} documentos · {resultado.con_archivo || 0} con archivo
              {resultado.troceado && ' · troceado por operario'}
            </span>
          </div>

          {resultado.zips?.map((z, i) => (
            <a key={i} href={z.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm py-2 px-3 rounded-md border border-border hover:bg-muted/50 transition-colors">
              <Package className="w-4 h-4 text-primary shrink-0" />
              <span className="font-medium flex-1">ZIP {i + 1} — {z.operario_name}</span>
              <span className="text-xs text-muted-foreground">{z.count} archivos</span>
              {z.errores > 0 && <span className="text-xs text-amber-600">{z.errores} fallos</span>}
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          ))}

          {resultado.indice_excel_url && (
            <a href={resultado.indice_excel_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm py-2 px-3 rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 transition-colors">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium flex-1">Excel índice (Gastos · Documentos · Fotos · Resumen)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}

          {resultado.mensaje && !resultado.zips?.length && (
            <p className="text-xs text-muted-foreground">{resultado.mensaje}</p>
          )}
        </Card>
      )}
    </div>
  );
}