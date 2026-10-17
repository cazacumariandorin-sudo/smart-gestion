import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { prepararComprasApp } from '../../shared/ivaCompras.ts';

/**
 * calcularIVAPeriodo
 * ════════════════════════════════════════════════════════════════
 * Estimación INTERNA del modelo 303 (IVA) de un trimestre.
 * NO es una autoliquidación: es un control para comparar con lo que
 * presenta la gestoría. Solo lectura (no escribe nada).
 *
 * Fuentes:
 *   - FacturaIVA (libro interno): emitidas = repercutido, recibidas = soportado
 *   - FacturaAutonomo: se cuentan como recibidas (IVA soportado) sin copiarlas
 *   - RegistroGasto (compras registradas en la app): IVA ESTIMADO por categoría, porque la
 *     app solo guarda el importe con IVA. Opciones del body: incluir_gastos_app (true),
 *     estados_gasto[], tipos_iva_categoria{}, deducible_categoria{}
 *
 * Criterio de periodo: fecha de expedición (fecha_factura), NO fecha de pago
 * (a diferencia del modelo 111, que se rige por el pago).
 *
 * Casillas orientativas (régimen general, validadas contra el formulario AEAT):
 *   01/02/03 base-tipo-cuota 4% · 04/05/06 10% · 07/08/09 21%
 *   12/13 otras operaciones con inversión del sujeto pasivo (base, cuota)
 *   27 total cuota devengada · 28/29 IVA deducible operaciones interiores corrientes
 *   45 total a deducir · 46 resultado régimen general (27 - 45)
 * Quedan fuera de este MVP: bienes de inversión, intracomunitarias, importaciones,
 * recargo de equivalencia, prorrata, compensaciones y criterio de caja.
 *
 * Acceso: admin, propietario, gerencia, administracion, contabilidad
 * POST body: { trimestre: "2026-T3" }
 */

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Lista TODOS los registros paginando (evita cortes silenciosos de list(sort, N)).
async function listarTodos(entidad: any, orden: string): Promise<any[]> {
  const PAGINA = 500;
  const MAX_PAGINAS = 20;
  const todos: any[] = [];
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const lote = await entidad.list(orden, PAGINA, p * PAGINA).catch(() => []);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todos.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return todos;
}

// Lista con filtro paginando. NO silencia errores: un fallo aquí daría compras a 0 sin avisar.
async function filtrarTodos(entidad: any, query: any, orden: string, campos?: string[]): Promise<any[]> {
  const PAGINA = 500;
  const MAX_PAGINAS = 20;
  const todos: any[] = [];
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const lote = await entidad.filter(query, orden, PAGINA, p * PAGINA, campos);
    if (!Array.isArray(lote) || lote.length === 0) break;
    todos.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return todos;
}

type Fila = {
  origen: 'libro' | 'autonomo' | 'gasto';
  id: string;
  tipo: 'recibida' | 'emitida';
  numero: string;
  fecha: string;
  nif: string;
  nombre: string;
  base: number;
  tipoIva: number;
  cuota: number;
  total: number | null;
  isp: boolean;
  deduciblePct: number;
  justificante: string;
  estado: string;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const rolesPermitidos = ['admin', 'propietario', 'gerencia', 'administracion', 'contabilidad'];
    if (!user || !rolesPermitidos.includes(user.role)) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const trimestre = String(body?.trimestre || '');
    const m = trimestre.match(/^(\d{4})-T([1-4])$/);
    if (!m) return Response.json({ error: 'trimestre requerido (ej: 2026-T3)' }, { status: 400 });

    const incluirGastos = body?.incluir_gastos_app !== false;
    const anio = parseInt(m[1]);
    const q = parseInt(m[2]);
    const mesIni = (q - 1) * 3 + 1;
    const ultimoDia = new Date(Date.UTC(anio, mesIni + 2, 0)).getUTCDate();
    const inicio = `${anio}-${String(mesIni).padStart(2, '0')}-01`;
    const fin = `${anio}-${String(mesIni + 2).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    const enRango = (f: string) => !!f && f.slice(0, 10) >= inicio && f.slice(0, 10) <= fin;

    const db = base44.asServiceRole.entities;
    const [libro, autonomos] = await Promise.all([
      listarTodos(db.FacturaIVA, 'fecha_factura'),
      listarTodos(db.FacturaAutonomo, 'fecha_factura'),
    ]);

    // ── Normalización de filas ──────────────────────────────────────────
    const filas: Fila[] = [];
    for (const f of libro) {
      if (f.estado === 'anulada' || !enRango(f.fecha_factura)) continue;
      const base = Number(f.base_imponible) || 0;
      const tipoIva = Number(f.tipo_iva) || 0;
      const cuota = f.cuota_iva != null ? Number(f.cuota_iva) : r2((base * tipoIva) / 100);
      filas.push({
        origen: 'libro',
        id: f.id,
        tipo: f.tipo === 'emitida' ? 'emitida' : 'recibida',
        numero: String(f.numero_factura || ''),
        fecha: String(f.fecha_factura || '').slice(0, 10),
        nif: String(f.nif_contraparte || '').trim().toUpperCase(),
        nombre: String(f.nombre_contraparte || ''),
        base,
        tipoIva,
        cuota,
        total: f.total_factura != null ? Number(f.total_factura) : null,
        isp: !!f.inversion_sujeto_pasivo,
        deduciblePct: f.deducible_pct != null ? Number(f.deducible_pct) : 100,
        justificante: f.tipo_justificante || 'completa',
        estado: f.estado || 'borrador',
      });
    }
    let autonomosSinIva = 0;
    for (const f of autonomos) {
      if (f.estado === 'anulada' || !enRango(f.fecha_factura)) continue;
      const base = Number(f.base_imponible) || 0;
      if (f.tipo_iva == null && f.importe_iva == null) autonomosSinIva++;
      const tipoIva = Number(f.tipo_iva) || 0;
      const cuota = f.importe_iva != null ? Number(f.importe_iva) : r2((base * tipoIva) / 100);
      filas.push({
        origen: 'autonomo',
        id: f.id,
        tipo: 'recibida',
        numero: String(f.numero_factura || ''),
        fecha: String(f.fecha_factura || '').slice(0, 10),
        nif: String(f.nif_autonomo || '').trim().toUpperCase(),
        nombre: String(f.nombre_autonomo || ''),
        base,
        tipoIva,
        cuota,
        total: f.total_factura != null ? Number(f.total_factura) : null,
        isp: false,
        deduciblePct: 100,
        justificante: 'completa',
        estado: f.estado === 'borrador' ? 'borrador' : 'revisada',
      });
    }

    // ── Compras registradas en la app (RegistroGasto) ───────────────────
    let comprasApp: any = null;
    if (incluirGastos) {
      const gastos = await filtrarTodos(
        db.RegistroGasto,
        { fecha_documento: { $gte: inicio, $lte: fin } },
        'fecha_documento',
        ['categoria', 'importe', 'estado', 'fecha_documento', 'proveedor_nif', 'nif_comercio', 'nombre_comercio', 'numero_factura'],
      );
      const empresas = await db.Empresa.list('-created_date', 50).catch(() => []);
      const rc = prepararComprasApp(gastos, {
        inicio,
        fin,
        estados: Array.isArray(body?.estados_gasto) ? body.estados_gasto : undefined,
        tiposIva: body?.tipos_iva_categoria,
        deducible: body?.deducible_categoria,
        nifsPropios: (empresas || []).map((e: any) => e.cif).filter(Boolean),
      });
      for (const f of rc.filas) filas.push(f as unknown as Fila);
      comprasApp = { ...rc.resumen, registros_leidos: gastos.length };
    }

    // ── Devengado (emitidas) ────────────────────────────────────────────
    const emitidas = filas.filter((f) => f.tipo === 'emitida');
    const recibidas = filas.filter((f) => f.tipo === 'recibida');
    const baseTipo = (arr: Fila[], t: number) => arr.filter((f) => f.tipoIva === t).reduce((s, f) => s + f.base, 0);
    const cuotaTipo = (arr: Fila[], t: number) => arr.filter((f) => f.tipoIva === t).reduce((s, f) => s + f.cuota, 0);

    const emitidasNoIsp = emitidas; // las emitidas con ISP las declara el receptor
    const c01 = r2(baseTipo(emitidasNoIsp, 4));
    const c03 = r2(cuotaTipo(emitidasNoIsp, 4));
    const c04 = r2(baseTipo(emitidasNoIsp, 10));
    const c06 = r2(cuotaTipo(emitidasNoIsp, 10));
    const c07 = r2(baseTipo(emitidasNoIsp, 21));
    const c09 = r2(cuotaTipo(emitidasNoIsp, 21));
    const emitidasExentas = r2(baseTipo(emitidasNoIsp, 0));

    const recibidasIsp = recibidas.filter((f) => f.isp);
    const recibidasNormales = recibidas.filter((f) => !f.isp);
    const c12 = r2(recibidasIsp.reduce((s, f) => s + f.base, 0));
    const c13 = r2(recibidasIsp.reduce((s, f) => s + f.cuota, 0));
    const c27 = r2(c03 + c06 + c09 + c13);

    // ── Deducible (recibidas, incl. ISP autorrepercutido) ───────────────
    const deducibles = recibidas.filter((f) => f.deduciblePct > 0);
    const c28 = r2(deducibles.reduce((s, f) => s + f.base, 0));
    const c29 = r2(deducibles.reduce((s, f) => s + (f.cuota * f.deduciblePct) / 100, 0));
    const c45 = c29;
    const c46 = r2(c27 - c45);

    // ── Alertas de calidad de datos ─────────────────────────────────────
    const alertas: { nivel: 'error' | 'aviso' | 'info'; texto: string; ids?: string[] }[] = [];
    const idsDe = (arr: Fila[]) => arr.map((f) => f.id).slice(0, 25);
    const tiposValidos = [0, 4, 10, 21];

    const sinNif = filas.filter((f) => !f.nif && f.justificante !== 'simplificada');
    if (sinNif.length) alertas.push({ nivel: 'aviso', texto: `${sinNif.length} factura(s) sin NIF de la contraparte.`, ids: idsDe(sinNif) });

    const tipoRaro = filas.filter((f) => !tiposValidos.includes(f.tipoIva));
    if (tipoRaro.length) alertas.push({ nivel: 'error', texto: `${tipoRaro.length} factura(s) con tipo de IVA distinto de 0, 4, 10 o 21.`, ids: idsDe(tipoRaro) });

    const cuotaNoCuadra = filas.filter((f) => Math.abs(r2((f.base * f.tipoIva) / 100) - f.cuota) > 0.05);
    if (cuotaNoCuadra.length) alertas.push({ nivel: 'aviso', texto: `${cuotaNoCuadra.length} factura(s) donde la cuota no coincide con base × tipo.`, ids: idsDe(cuotaNoCuadra) });

    const totalNoCuadra = filas.filter((f) => f.total != null && !f.isp && Math.abs(r2(f.base + f.cuota) - f.total!) > 0.02);
    if (totalNoCuadra.length) alertas.push({ nivel: 'aviso', texto: `${totalNoCuadra.length} factura(s) donde base + cuota no coincide con el total.`, ids: idsDe(totalNoCuadra) });

    const ispSinTipo = recibidasIsp.filter((f) => f.tipoIva <= 0 || f.cuota <= 0);
    if (ispSinTipo.length) alertas.push({ nivel: 'error', texto: `${ispSinTipo.length} factura(s) con inversión del sujeto pasivo sin tipo ni cuota (no se autorrepercutiría IVA).`, ids: idsDe(ispSinTipo) });

    const simplificadasConIva = recibidas.filter((f) => f.justificante === 'simplificada' && f.cuota > 0 && f.deduciblePct > 0);
    if (simplificadasConIva.length) alertas.push({ nivel: 'aviso', texto: `${simplificadasConIva.length} justificante(s) simplificado(s) con IVA deducido: comprobar con la gestoría que cumplen los requisitos.`, ids: idsDe(simplificadasConIva) });

    // Duplicados dentro del conjunto (mismo sentido + NIF + número + tipo IVA)
    const vistos = new Map<string, Fila[]>();
    for (const f of filas) {
      if (!f.numero) continue;
      const k = `${f.tipo}|${f.nif}|${f.numero.toLowerCase()}|${f.tipoIva}`;
      vistos.set(k, [...(vistos.get(k) || []), f]);
    }
    const dups = [...vistos.values()].filter((v) => v.length > 1);
    if (dups.length) {
      const hayDobleComputo = dups.some((v) => new Set(v.map((f) => f.origen)).size > 1);
      alertas.push({
        nivel: 'error',
        texto: `${dups.length} posible(s) factura(s) duplicada(s) (mismo NIF, número y tipo).${hayDobleComputo ? ' Alguna aparece en más de una fuente (libro, autónomos o gastos): se estaría contando dos veces.' : ''}`,
        ids: dups.flat().map((f) => f.id).slice(0, 25),
      });
    }

    if (comprasApp) {
      const ca = comprasApp;
      const e2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
      alertas.push({ nivel: 'info', texto: `Compras de la app: ${ca.incluidos} gasto(s) por ${e2(ca.importe_total)} € (de ${ca.registros_leidos} leídos). IVA ESTIMADO ${e2(ca.cuota_estimada)} € aplicando un tipo por categoría (la app guarda solo el importe con IVA); deducible estimado ${e2(ca.cuota_deducible)} €.` });
      const exc = Object.entries(ca.excluidos_por_estado as Record<string, { n: number; importe: number }>);
      if (exc.length) alertas.push({ nivel: 'info', texto: `Gastos no contados por su estado: ${exc.map(([k, v]) => `${v.n} ${k} (${e2(v.importe)} €)`).join(', ')}. Solo cuentan: ${ca.estados_incluidos.join(', ')}.` });
      if (ca.duplicados_eliminados.n) alertas.push({ nivel: 'aviso', texto: `${ca.duplicados_eliminados.n} gasto(s) duplicado(s) descartados del cálculo (mismo nº de factura, fecha e importe; ${e2(ca.duplicados_eliminados.importe)} €). Conviene resolverlos en la app.` });
      if (ca.mismo_numero_importe_distinto) alertas.push({ nivel: 'aviso', texto: `${ca.mismo_numero_importe_distinto} factura(s) con el mismo número y fecha pero importes distintos (posible error de lectura del OCR). Se cuentan todas.` });
      if (ca.nif.sin_nif.n) alertas.push({ nivel: 'aviso', texto: `${ca.nif.sin_nif.n} gasto(s) sin NIF legible (IVA ${e2(ca.nif.sin_nif.cuota)} €): sin datos del proveedor no es seguro poder deducirlo.` });
      if (ca.nif.invalido.n) alertas.push({ nivel: 'aviso', texto: `${ca.nif.invalido.n} gasto(s) con NIF que no supera la validación (IVA ${e2(ca.nif.invalido.cuota)} €): probable error del OCR; revisar el proveedor.` });
      if (ca.nif.propio.n) alertas.push({ nivel: 'aviso', texto: `${ca.nif.propio.n} gasto(s) con el CIF de la propia empresa como proveedor (IVA ${e2(ca.nif.propio.cuota)} €): el OCR leyó al cliente en vez del proveedor.` });
      if (ca.sin_importe) alertas.push({ nivel: 'info', texto: `${ca.sin_importe} gasto(s) con importe 0 ignorados.` });
    }

    const borradores = filas.filter((f) => f.estado === 'borrador');
    if (borradores.length) alertas.push({ nivel: 'info', texto: `${borradores.length} factura(s) en borrador incluidas en el cálculo (sin revisar).`, ids: idsDe(borradores) });
    if (autonomosSinIva) alertas.push({ nivel: 'info', texto: `${autonomosSinIva} factura(s) de autónomos sin dato de IVA: se contaron con IVA 0.` });
    if (emitidas.length === 0) alertas.push({ nivel: 'aviso', texto: 'No hay facturas emitidas en el periodo: el IVA repercutido sale a 0.' });

    return Response.json({
      ok: true,
      aviso_legal: 'Estimación interna de control. No sustituye a la autoliquidación ni debe usarse para presentar.',
      trimestre,
      rango: { inicio, fin },
      resultado: {
        importe: c46,
        tipo: c46 > 0 ? 'a_ingresar' : c46 < 0 ? 'a_compensar' : 'cero',
      },
      casillas: {
        '01_base_4': c01, '03_cuota_4': c03,
        '04_base_10': c04, '06_cuota_10': c06,
        '07_base_21': c07, '09_cuota_21': c09,
        '12_base_isp': c12, '13_cuota_isp': c13,
        '27_total_devengado': c27,
        '28_base_deducible': c28, '29_cuota_deducible': c29,
        '45_total_a_deducir': c45,
        '46_resultado_regimen_general': c46,
      },
      otros: { emitidas_exentas_base: emitidasExentas },
      compras_app: comprasApp,
      conteo: {
        emitidas: emitidas.length,
        recibidas: recibidas.length,
        recibidas_libro: recibidas.filter((f) => f.origen === 'libro').length,
        recibidas_autonomos: recibidas.filter((f) => f.origen === 'autonomo').length,
        recibidas_gastos: recibidas.filter((f) => f.origen === 'gasto').length,
        con_isp: recibidasIsp.length,
        borradores: borradores.length,
      },
      alertas,
      fuera_de_alcance: [
        'bienes de inversión', 'adquisiciones intracomunitarias', 'importaciones',
        'recargo de equivalencia', 'prorrata', 'compensaciones de periodos anteriores', 'criterio de caja',
      ],
    });
  } catch (error) {
    console.error('calcularIVAPeriodo error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
