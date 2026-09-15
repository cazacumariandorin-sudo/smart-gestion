import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, Download, FileSpreadsheet, Package, AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

/**
 * Pestaña "Descarga en bloque para gestoría" — invoca la función backend
 * descargarJustificantesPeriodo que genera ZIP(s) + Excel índice.
 * Acceso: contabilidad, administracion, gerencia, admin.
 */
export default function DescargaBloquePanel({ rango }) {
  const { isContabilidad, isAdministracion, isGerencia, isAdmin } = useUserRole();
  const puede = isContabilidad || isAdministracion || isGerencia || isAdmin;
  const [tipoDoc, setTipoDoc] = useState('ambos');
  const [operarioFiltro, setOperarioFiltro] = useState('');
  const [incluirDescargados, setIncluirDescargados] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState(null);

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
          Recopila todos los justificantes del periodo, genera un ZIP (troceado por operario si supera 200 documentos) y un Excel índice con todas las columnas para que la gestoría cruce los archivos físicos contra el listado.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de documento</Label>
            <MobileSelect value={tipoDoc} onValueChange={setTipoDoc} placeholder="Tipo">
              <MobileSelectItem value="ambos">Gastos + Documentos materiales</MobileSelectItem>
              <MobileSelectItem value="registro">Solo gastos</MobileSelectItem>
              <MobileSelectItem value="documento">Solo documentos materiales</MobileSelectItem>
            </MobileSelect>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Operario (opcional — vacío = todos)</Label>
            <MobileSelect value={operarioFiltro} onValueChange={setOperarioFiltro} placeholder="Todos los operarios">
              <MobileSelectItem value="">Todos los operarios</MobileSelectItem>
            </MobileSelect>
            <p className="text-[10px] text-muted-foreground">Si necesitas filtrar por un operario concreto, usa la pestaña Conciliación para identificarlo; el troceo automático agrupa por operario cuando el volumen es alto.</p>
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
              <span className="font-medium flex-1">Excel índice (todas las columnas)</span>
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