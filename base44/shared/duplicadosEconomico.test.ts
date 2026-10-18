/**
 * Pruebas del criterio de duplicados económicos (base44/shared/duplicadosEconomico.ts).
 * Ejecutar:  deno test --allow-read base44/shared/duplicadosEconomico.test.ts
 *
 * Casos de tres orígenes:
 *  - Sintéticos que fijan las reglas (señal fuerte, tolerancia relativa, peajes con hora).
 *  - Leídos del vídeo del 11/10/2026 (usuario gerencia): grupos 7, 8, 9 (duplicados reales)
 *    y 10, 11 (falsos positivos).
 *  - 11 tickets reales de Telpark: solo t01 y t05 son el mismo recibo.
 */
import { agruparDuplicados, compararPar, mapRegistroGasto } from './duplicadosEconomico.ts';

const doc = (o: any): any => ({
  entidad: 'registro_gasto', entidad_label: 'Gasto', archivos: [], tiene_hora: !!o.hora, calidad: 1, raw: {},
  cif: 'A28000001', nombre: 'TELPARK', localidad: 'MADRID', ...o,
});
const gasto = (r: any) => mapRegistroGasto({ archivos: [], estado: 'registrado', categoria: 'otros', ...r });

function comprobar(nombre: string, a: any, b: any, esperado: boolean) {
  Deno.test(nombre, () => {
    const r = compararPar(a, b);
    if (r.es_duplicado !== esperado) {
      throw new Error(`${nombre}: esperado ${esperado ? 'DUPLICADO' : 'NO duplicado'} pero salió ${r.es_duplicado ? 'duplicado' : 'no duplicado'} (${r.severidad}, ${r.score.toFixed(2)}; ${r.motivos.join(' | ')})`);
    }
  });
}

// ── Reglas (sintéticos) ──────────────────────────────────────────────────────
comprobar('importes distintos el mismo día, nº consecutivos → no', doc({ fecha: '2026-09-10', importe: 5.2, numero_factura: 'TP100001' }), doc({ fecha: '2026-09-10', importe: 9.85, numero_factura: 'TP100002' }), false);
comprobar('importes distintos el mismo día, sin nº → no', doc({ fecha: '2026-09-10', importe: 5.2 }), doc({ fecha: '2026-09-10', importe: 9.85 }), false);
comprobar('tarifa fija 9,85 € en días consecutivos → no', doc({ fecha: '2026-09-10', importe: 9.85 }), doc({ fecha: '2026-09-11', importe: 9.85 }), false);
comprobar('céntimos (0,56 y 0,90) el mismo día → no', doc({ fecha: '2026-09-16', importe: 0.56 }), doc({ fecha: '2026-09-16', importe: 0.9 }), false);
comprobar('peajes mismo día e importe, horas distintas → no', doc({ fecha: '2026-09-10', importe: 5.2, hora: '08:10' }), doc({ fecha: '2026-09-10', importe: 5.2, hora: '18:40' }), false);
comprobar('mismo nº, fecha e importe → sí', doc({ fecha: '2026-09-10', importe: 148.68, numero_factura: 'FA652704403' }), doc({ fecha: '2026-09-10', importe: 148.68, numero_factura: 'FA652704403' }), true);
comprobar('misma foto con importe leído distinto → sí', doc({ fecha: '2026-09-10', importe: 148.68, dhash: 'ffff0000ffff0000' }), doc({ fecha: '2026-09-10', importe: 14.68, dhash: 'ffff0000ffff0001' }), true);
comprobar('OCR 148,68 / 148,88 sin nº, mismo día → sí', doc({ fecha: '2026-09-10', importe: 148.68 }), doc({ fecha: '2026-09-10', importe: 148.88 }), true);
comprobar('OCR 148,68 / 146,68 (1,3 %) sin nº, mismo día → sí', doc({ fecha: '2026-09-10', importe: 148.68 }), doc({ fecha: '2026-09-10', importe: 146.68 }), true);
comprobar('mismo nº con importes leídos distintos → sí', doc({ fecha: '2026-09-10', importe: 204.42, numero_factura: 'FA027000806022' }), doc({ fecha: '2026-09-10', importe: 182.25, numero_factura: 'FA027000806022' }), true);
comprobar('mismo día e importe, sin nº → sí', doc({ fecha: '2026-09-10', importe: 33.5 }), doc({ fecha: '2026-09-10', importe: 33.5 }), true);
comprobar('nº casi idéntico por OCR, mismo importe y día → sí', doc({ fecha: '2026-09-10', importe: 148.68, numero_factura: 'FA652704403' }), doc({ fecha: '2026-09-10', importe: 148.68, numero_factura: 'FA652704408' }), true);

// ── Casos reales del vídeo (11/10/2026) ──────────────────────────────────────
comprobar('vídeo G7: SER 7,40 € días 13 y 14, mismo nº → duplicado', gasto({ nombre_comercio: 'SER Madrid', importe: 7.4, fecha_documento: '2026-08-14', hora_documento: '13:00', numero_factura: '4160JUT', localidad: 'Madrid' }), gasto({ nombre_comercio: 'SER', importe: 7.4, fecha_documento: '2026-08-13', hora_documento: '13:00', numero_factura: '4160JUT', localidad: 'Madrid' }), true);
comprobar('vídeo G8: Euro Depot 77,81 € mismo nº, NIF leído distinto → duplicado', gasto({ nombre_comercio: 'EURO DEPOT ESPANA S.A.U.', nif_comercio: 'A82018064', importe: 77.81, fecha_documento: '2026-08-14', numero_factura: 'FT202616532000006266', localidad: 'MAJADAHONDA' }), gasto({ nombre_comercio: 'EURO DEPOT ESPAÑA S.A.U.', nif_comercio: 'A62018064', importe: 77.81, fecha_documento: '2026-08-14', numero_factura: 'FT202616532000006266', localidad: 'MAJADAHONDA' }), true);
comprobar('vídeo G9: BigMat 44,81 € mismo nº y hora, NIF distinto → duplicado', gasto({ nombre_comercio: 'BigMat Ferretería Tarancón', nif_comercio: 'B16312530', importe: 44.81, fecha_documento: '2026-08-04', hora_documento: '12:26', numero_factura: '2605596', localidad: 'Tarancón' }), gasto({ nombre_comercio: 'BigMat Ferretería Tarancón', nif_comercio: 'B16223847', importe: 44.81, fecha_documento: '2026-08-04', hora_documento: '12:26', numero_factura: '2605596', localidad: 'Tarancón' }), true);
comprobar('vídeo G10: Castellana 10,45 € días 17 y 28 (peaje recurrente) → NO duplicado', gasto({ nombre_comercio: 'CASTELLANA, S.A.C.E.', nif_comercio: 'A82492729', importe: 10.45, fecha_documento: '2026-08-28', hora_documento: '13:19', numero_factura: '339841', localidad: 'S.Rafael' }), gasto({ nombre_comercio: 'CASTELLANA, S.A.C.E.', nif_comercio: 'A82492729', importe: 10.45, fecha_documento: '2026-08-17', hora_documento: '09:20', localidad: 'S. Rafael - Segovia' }), false);
comprobar('vídeo G11: Family Energy 90 € días 19 y 25, facturas distintas → NO duplicado', gasto({ nombre_comercio: 'FAMILY ENERGY S.L.', nif_comercio: 'B98997826', importe: 90, fecha_documento: '2026-08-25', hora_documento: '14:57', numero_factura: 'F131128539', localidad: "L'OLLERIA" }), gasto({ nombre_comercio: 'FAMILY ENERGY S.L.', nif_comercio: 'B98997826', importe: 90, fecha_documento: '2026-08-19', hora_documento: '14:41', numero_factura: 'F131128181', localidad: "L'OLLERIA VALENCIA" }), false);

// ── Tickets reales de Telpark: solo t01 y t05 son el mismo recibo ────────────
Deno.test('Telpark real (11 tickets): un único grupo con el recibo duplicado t01 + t05', () => {
  const R = [
    { id: 't01', nombre_comercio: 'Telpark', nif_comercio: 'B86389541', importe: 3.7, fecha_documento: '2026-09-16', numero_factura: 'RC EOS ES2026/26837202', localidad: 'Madrid' },
    { id: 't02', nombre_comercio: 'Telpark', nif_comercio: 'B86389541', importe: 1.67, fecha_documento: '2026-09-15', numero_factura: 'FT EOS ES2026/1416622', localidad: 'Madrid' },
    { id: 't03', nombre_comercio: 'Telpark', nif_comercio: 'B88389541', importe: 11.1, fecha_documento: '2026-09-15', numero_factura: 'RC EOS ES2026/26647184', localidad: 'Madrid' },
    { id: 't04', nombre_comercio: 'Telpark (Maksu España, S.L.)', nif_comercio: 'B86389541', importe: 0.56, fecha_documento: '2026-09-16', hora_documento: '11:58', numero_factura: 'FT EOS ES2026/1427128', localidad: 'Madrid' },
    { id: 't05', nombre_comercio: 'telpark', nif_comercio: 'B86389541', importe: 3.7, fecha_documento: '2026-09-16', numero_factura: 'RC EOS ES2026/26837202', localidad: 'Madrid' },
    { id: 't06', nombre_comercio: 'Telpark (Maksu España, S.L.)', nif_comercio: 'B86389541', importe: 1.11, fecha_documento: '2026-09-17', numero_factura: 'FT EOS ES2026/1431887', localidad: 'Madrid' },
    { id: 't07', nombre_comercio: 'telpark', nif_comercio: 'B86389541', importe: 7.4, fecha_documento: '2026-09-17', numero_factura: 'RC EOS ES2026/26930481', localidad: 'Madrid' },
    { id: 't08', nombre_comercio: 'Telpark', nif_comercio: 'B86389541', importe: 0.14, fecha_documento: '2026-09-22', hora_documento: '11:24', numero_factura: 'FT EOS ES2026/1460669', localidad: 'Madrid' },
    { id: 't09', nombre_comercio: 'telpark', nif_comercio: 'B86389541', importe: 0.9, fecha_documento: '2026-09-22', numero_factura: 'RC EOS ES2026/27447019', localidad: 'Madrid' },
    { id: 't10', nombre_comercio: 'Telpark', nif_comercio: 'B86389541', importe: 0.1, fecha_documento: '2026-09-24', numero_factura: 'FT EOS ES2026/1474217', localidad: 'Madrid' },
    { id: 't11', nombre_comercio: 'Telpark (Maksu España, S.L.)', nif_comercio: 'B86389541', importe: 0.65, fecha_documento: '2026-09-24', numero_factura: 'RC EOS ES2026/27698452', localidad: 'Madrid' },
  ].map(gasto);
  const grupos = agruparDuplicados(R, 'medio');
  const ids = grupos.map((g) => g.miembros.map((m: any) => m.id).sort().join('+'));
  if (ids.length !== 1 || ids[0] !== 't01+t05') throw new Error(`esperado un único grupo t01+t05, salió: ${JSON.stringify(ids)}`);
});
