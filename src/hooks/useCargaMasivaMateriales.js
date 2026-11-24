/**
 * useCargaMasivaMateriales — procesa en bloque documentos de notas de gastos
 * para el alta de materiales: OCR (procesarFacturaMateriales) + guardado
 * (MaterialDocumentoOrigen, Fabricante, MaterialCatalog, MaterialPrecioHistorico).
 *
 * Secuencial y cancelable: expone el progreso mientras recorre el lote.
 */
import { useRef, useState } from 'react';
import { ocrDocumentoMateriales, guardarMaterialesOcr } from '@/lib/materialesOcrClient';

const TIPOS_DOC = ['factura', 'albaran', 'ticket', 'proforma'];

export function useCargaMasivaMateriales() {
  const [progreso, setProgreso] = useState(null);
  const cancelRef = useRef(false);

  const detener = () => { cancelRef.current = true; };

  const ejecutar = async (items, { onDone } = {}) => {
    const lista = Array.isArray(items) ? items : [];
    if (!lista.length) return null;
    cancelRef.current = false;

    const res = { total: lista.length, hechas: 0, ok: 0, sinLineas: 0, errores: [], cancelado: false };
    setProgreso({ ...res, actual: '' });

    for (const it of lista) {
      if (cancelRef.current) { res.cancelado = true; break; }
      setProgreso(p => ({ ...p, actual: it.nombre_comercio || it.nombre || 'documento' }));
      try {
        const { datos } = await ocrDocumentoMateriales(it.file_url, it.tipo_archivo || 'image/jpeg');
        const lineas = Array.isArray(datos?.lineas) ? datos.lineas : [];
        if (!lineas.length) {
          res.sinLineas++;
        } else {
          const tipo = TIPOS_DOC.includes(datos.tipo_documento_inferido) ? datos.tipo_documento_inferido : 'factura';
          await guardarMaterialesOcr({
            tipo,
            numero: datos.numero_documento || it.numero_factura || '',
            fecha: datos.fecha_documento || it.fecha_documento || new Date().toISOString().slice(0, 10),
            proveedor_nombre: datos.proveedor || it.nombre_comercio || '',
            proveedor_nif: datos.nif_proveedor || it.nif_comercio || '',
            obra_id: it.obra_id || '',
            obra_name: it.obra_name || '',
            operario_id: it.operario_id || '',
            archivo_url: it.file_url,
            archivo_url_original: it.file_url,
            nota_gasto_id: it.registro_id || '',
            nota_origen_tipo: 'nota_gasto',
          }, lineas);
          res.ok++;
        }
      } catch (e) {
        res.errores.push({
          nombre: it.nombre_comercio || it.nombre || 'documento',
          error: String(e?.message || e).slice(0, 120),
        });
      }
      res.hechas++;
      setProgreso({ ...res, actual: '' });
    }

    setProgreso(null);
    onDone?.(res);
    return res;
  };

  return { progreso, ejecutar, detener };
}