/**
 * ImportadorFacturasIVA — importación de facturas (export de facturación o CSV) al libro
 * de IVA (entidad FacturaIVA). Componente COMPARTIDO por IVA 303 y Facturación emitida:
 * ambos leen la misma entidad, así que importar desde cualquiera de los dos rellena los dos
 * sin copiar nada.
 *
 * Anti-duplicados:
 *  - Detecta duplicados contra TODO el libro y dentro del archivo (tipo + NIF + nº + tipo IVA).
 *  - Al confirmar vuelve a leer el libro y repite el análisis, por si otra persona importó
 *    lo mismo mientras tanto.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { decodificar, analizarImportacion } from '@/lib/ivaImport';

const fmt = (n) => (n ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

async function cargarLibroCompleto() {
  const todas = [];
  for (let p = 0; p < 20; p++) {
    const lote = await base44.entities.FacturaIVA.list('fecha_factura', 500, p * 500);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todas.push(...lote);
    if (lote.length < 500) break;
  }
  return todas;
}

export default function ImportadorFacturasIVA({ onImportado, etiqueta = 'Importar facturas' }) {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [preview, setPreview] = useState(null);
  const [incluirRec, setIncluirRec] = useState(false);
  const [importando, setImportando] = useState(false);

  const preparar = async (contenido, nombre, recibidas = incluirRec) => {
    try {
      const existentes = await cargarLibroCompleto();
      const p = analizarImportacion(contenido, { incluirRecibidas: recibidas }, existentes);
      setPreview({ ...p, texto: contenido, nombre });
    } catch (e) {
      toast.error(e.message || 'No se pudo leer el archivo');
    }
  };

  const onArchivo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      await preparar(decodificar(await f.arrayBuffer()), f.name);
    } catch (err) {
      toast.error(err.message || 'No se pudo leer el archivo');
    }
  };

  const cambiarRecibidas = (v) => {
    setIncluirRec(v);
    if (preview) preparar(preview.texto, preview.nombre, v);
  };

  const confirmar = async () => {
    if (!preview?.filas?.length || importando) return;
    setImportando(true);
    try {
      // Re-análisis contra el libro ACTUAL justo antes de guardar (evita carreras y dobles clics)
      const existentes = await cargarLibroCompleto();
      const fresco = analizarImportacion(preview.texto, { incluirRecibidas: incluirRec }, existentes);
      if (!fresco.filas.length) {
        toast.info('Todas las facturas del archivo ya estaban en el libro: no se ha importado nada.');
      } else {
        for (let i = 0; i < fresco.filas.length; i += 50) await base44.entities.FacturaIVA.bulkCreate(fresco.filas.slice(i, i + 50));
        toast.success(`${fresco.filas.length} fila(s) importadas en borrador; ${fresco.duplicadasLibro.length + fresco.duplicadasArchivo.length} duplicada(s) omitidas`);
      }
      setPreview(null);
      setTexto('');
      setAbierto(false);
      qc.invalidateQueries({ queryKey: ['facturaIVA'] });
      onImportado?.();
    } catch (e) {
      toast.error(e.message || 'Error al importar');
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" className="gap-1" onClick={() => setAbierto((v) => !v)}>
        <Upload className="w-3.5 h-3.5" /> {etiqueta}
      </Button>

      {abierto && (
        <div className="space-y-2 rounded-md border p-2">
          <p className="text-xs text-muted-foreground">
            Sube el export de facturación o un CSV (separado por comas, punto y coma o tabuladores; UTF-8 o UTF-16). Lo importado se ve a la vez en <b>IVA 303</b> y en <b>Facturación emitida</b>, sin duplicar nada. Se detectan los duplicados contra el libro y dentro del archivo. Todo entra en borrador.
            Formato genérico: <code>tipo,fecha_factura,numero_factura,nif_contraparte,nombre_contraparte,base_imponible,tipo_iva</code> (opcionales: cuota_iva, total_factura, inversion_sujeto_pasivo, deducible_pct, tipo_justificante, estado_cobro, fecha_vencimiento).
          </p>
          <input type="file" accept=".csv,.tsv,.txt" onChange={onArchivo} className="text-xs" />
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">…o pega el contenido</summary>
            <textarea className="w-full h-28 mt-1 rounded-md border bg-background p-2 text-xs font-mono" value={texto} onChange={(e) => setTexto(e.target.value)} />
            <Button size="sm" variant="outline" className="mt-1" onClick={() => preparar(texto, 'texto pegado')} disabled={!texto.trim()}>Analizar</Button>
          </details>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={incluirRec} onChange={(e) => cambiarRecibidas(e.target.checked)} />
            Incluir también las facturas recibidas del export (por defecto se omiten: las compras se toman de la app)
          </label>

          {preview && (
            <div className="rounded-md bg-muted/40 p-2 space-y-1 text-xs">
              <p className="font-medium">{preview.nombre} · {preview.formato === 'export_facturacion' ? 'export de facturación' : preview.formato === 'generico' ? 'CSV genérico' : 'formato no reconocido'} · separador: {preview.separador}</p>
              {preview.resumen && (
                <>
                  <p>Nuevas emitidas: {preview.resumen.emitidas.n} factura(s) · base {fmt(preview.resumen.emitidas.base)} · IVA {fmt(preview.resumen.emitidas.cuota)}</p>
                  {preview.resumen.recibidas.n > 0 && <p>Nuevas recibidas: {preview.resumen.recibidas.n} factura(s) · base {fmt(preview.resumen.recibidas.base)} · IVA {fmt(preview.resumen.recibidas.cuota)}</p>}
                  {preview.resumen.fechaMin && <p className="text-muted-foreground">Fechas: {preview.resumen.fechaMin} a {preview.resumen.fechaMax}</p>}
                </>
              )}
              {(preview.duplicadasLibro.length > 0 || preview.duplicadasArchivo.length > 0) && (
                <p className="text-amber-700">Duplicadas omitidas: {preview.duplicadasLibro.length} ya estaban en el libro, {preview.duplicadasArchivo.length} repetidas en el archivo.</p>
              )}
              {Object.entries(preview.omitidas || {}).map(([k, v]) => <p key={k} className="text-muted-foreground">Omitido: {k}{v > 1 ? ` (${v})` : ''}</p>)}
              {preview.errores.length > 0 && (
                <div className="text-red-700">
                  {preview.errores.slice(0, 5).map((m, i) => <p key={i}>{m}</p>)}
                  {preview.errores.length > 5 && <p>…y {preview.errores.length - 5} más.</p>}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={confirmar} disabled={importando || !preview.filas.length}>
                  {importando ? 'Importando…' : `Importar ${preview.filas.length} fila(s)`}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>Descartar</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
