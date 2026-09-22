import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';

/**
 * conciliarProyectoIngenieria
 * Motor de conciliación de un proyecto de ingeniería (ObraCheck).
 * Implementa las 8 reglas de detección del documento original y produce
 * Discrepancia + AnalisisCoste. Idempotente: deduplica por (tipo + tag_afectado).
 *
 * Acceso: admin, propietario, gerencia e ingeniero.
 * Input:  { obra_id }
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const role = user?.role || 'operario';
    if (role !== 'admin' && role !== 'propietario' && role !== 'gerencia' && role !== 'ingeniero') {
      return Response.json({ error: 'Forbidden: requiere rol admin, gerencia o ingeniero' }, { status: 403 });
    }

    const { obra_id } = await req.json();
    if (!obra_id) return Response.json({ error: 'obra_id requerido' }, { status: 400 });

    const LIMIT = 500;
    const [items, partidas, lineasFactura, mediciones, trazados, fichas, documentos, basePrecios, existingDiscreps] = await Promise.all([
      base44.entities.ItemLista.filter({ obra_id }, '-created_date', LIMIT),
      base44.entities.PartidaPedido.filter({ obra_id }, '-created_date', LIMIT),
      base44.entities.LineaFactura.filter({ obra_id }, '-created_date', LIMIT),
      base44.entities.MedicionReal.filter({ obra_id }, '-created_date', LIMIT),
      base44.entities.TrazadoEstimado.filter({ obra_id }, '-created_date', LIMIT),
      base44.entities.FichaTecnicaEquipo.filter({ obra_id }, '-created_date', LIMIT),
      base44.entities.MaterialDocumentoOrigen.filter({ proyecto_ingenieria_id: obra_id }, '-created_date', LIMIT),
      base44.entities.BaseDePrecio.filter({ obra_id }, '-created_date', LIMIT),
      base44.entities.Discrepancia.filter({ obra_id }, '-created_date', LIMIT),
    ]);
    // Todas las tarifas (cross-proyecto) para la regla 3
    const allTarifas = await base44.entities.MaterialPrecioHistorico.list('-created_date', LIMIT);

    const now = new Date().toISOString();
    const newDiscreps = [];
    const dedupKey = (tipo, tag) => `${tipo}|${tag || ''}`;
    const existsKeys = new Set(existingDiscreps.map(d => dedupKey(d.tipo, d.tag_afectado)));
    const addDiscrep = (d) => {
      const k = dedupKey(d.tipo, d.tag_afectado);
      if (existsKeys.has(k)) return;
      existsKeys.add(k);
      newDiscreps.push({ obra_id, fecha_deteccion: now, estado: 'abierta', ...d });
    };
    const docIds = (arr) => arr.map(d => d.id);

    // Mapa revision → fecha (para ordenar revisiones)
    const revFecha = {};
    documentos.forEach(d => { if (d.revision) revFecha[d.revision] = d.fecha_documento || d.created_date; });

    // ── Regla 1: diff de ItemLista por tag entre revisiones → punto_añadido / punto_eliminado
    const byRev = {};
    items.forEach(it => { (byRev[it.revision] = byRev[it.revision] || {})[it.tag] = true; });
    const revs = Object.keys(byRev).sort((a, b) => (revFecha[a] || '').localeCompare(revFecha[b] || ''));
    if (revs.length >= 2) {
      const oldR = revs[revs.length - 2], newR = revs[revs.length - 1];
      const oldTags = new Set(Object.keys(byRev[oldR]));
      const newTags = new Set(Object.keys(byRev[newR]));
      const added = [...newTags].filter(t => !oldTags.has(t));
      const removed = [...oldTags].filter(t => !newTags.has(t));
      const docsR = documentos.filter(d => d.revision === newR || d.revision === oldR);
      if (added.length) addDiscrep({ tipo: 'punto_añadido', severidad: added.length > 10 ? 'media' : 'baja', descripcion: `Revisión ${newR} añade ${added.length} punto(s) no presentes en ${oldR}: ${added.join(', ')}.`, tag_afectado: added.join(','), documentos_implicados: docIds(docsR), valor_esperado: `no presentes en ${oldR}`, valor_real: `${added.length} nuevos en ${newR}` });
      if (removed.length) addDiscrep({ tipo: 'punto_eliminado', severidad: 'media', descripcion: `Revisión ${newR} elimina ${removed.length} punto(s) presentes en ${oldR}: ${removed.join(', ')}.`, tag_afectado: removed.join(','), documentos_implicados: docIds(docsR), valor_esperado: `presentes en ${oldR}`, valor_real: 'ausentes en ' + newR });
    }

    // Tarifa por referencia_concepto (del proyecto y global) para reglas 2 y 3
    const tarifaByConcepto = {};
    allTarifas.forEach(t => { if (t.referencia_concepto) (tarifaByConcepto[t.referencia_concepto] = tarifaByConcepto[t.referencia_concepto] || []).push(t); });

    // Cuenta de ítems de la última revisión (para por_punto)
    const lastRev = revs[revs.length - 1];
    const itemCountLast = lastRev ? Object.keys(byRev[lastRev] || {}).length : 0;

    // ── Regla 2: partidas bulto (cantidad=1) → cantidad_puntos_pedido_vs_listado
    partidas.forEach(p => {
      const esBulto = p.es_tanto_alzado || p.cantidad === 1;
      if (!esBulto) return;
      const concepto = p.referencia || p.posicion;
      const tarifas = tarifaByConcepto[concepto] || [];
      const porPunto = tarifas.some(t => t.unidad_tarifa === 'por_punto');
      if (porPunto && itemCountLast > 0) {
        const implicito = p.precio_unitario_implicito || (p.total && itemCountLast ? p.total / itemCountLast : null);
        const desviacion = Math.abs(itemCountLast - (p.cantidad_real_ultima_revision || itemCountLast));
        addDiscrep({
          tipo: 'cantidad_puntos_pedido_vs_listado',
          severidad: desviacion > 0 ? 'media' : 'baja',
          descripcion: `Partida ${concepto} a tanto alzado ${p.total}€${implicito ? ` (~${implicito.toFixed(2)}€/punto implícito)` : ''}. Recuento real última revisión (${lastRev}): ${itemCountLast} puntos.`,
          tag_afectado: '',
          documentos_implicados: p.documento_origen_id ? [p.documento_origen_id] : [],
          valor_esperado: 'recuento listado técnico',
          valor_real: `${itemCountLast} puntos`,
          importe_no_facturado: implicito ? Math.round(implicito * Math.abs(desviacion) * 100) / 100 : null,
        });
      }
    });

    // ── Regla 3: precio_unitario_inconsistente_entre_proyectos
    Object.entries(tarifaByConcepto).forEach(([concepto, ts]) => {
      // Agrupa por proveedor + contratante; compara con otros proyectos del mismo proveedor+concepto
      const porPar = {};
      ts.forEach(t => { const k = `${t.proveedor_nombre}|${t.cliente_contratante_id}`; (porPar[k] = porPar[k] || []).push(t); });
      Object.values(porPar).forEach(arr => {
        if (arr.length < 2) return;
        arr.forEach((t, i) => {
          for (let j = i + 1; j < arr.length; j++) {
            const o = arr[j];
            if (t.obra_id === o.obra_id) continue;
            const base = o.precio_neto || t.precio_neto;
            if (base && Math.abs(t.precio_neto - o.precio_neto) / base > 0.05) {
              addDiscrep({
                tipo: 'precio_unitario_inconsistente_entre_proyectos',
                severidad: 'media',
                descripcion: `Tarifa ${concepto} ${t.precio_neto}€ en un proyecto vs ${o.precio_neto}€ en otro (mismo proveedor ${t.proveedor_nombre}, contratante ${t.cliente_contratante_name}). Desviación >5%.`,
                tag_afectado: concepto,
                documentos_implicados: [t.documento_origen_id, o.documento_origen_id].filter(Boolean),
                valor_esperado: `${o.precio_neto}€`, valor_real: `${t.precio_neto}€`,
              });
            }
          }
        });
      });
    });

    // ── Regla 4: cruce LineaFactura ↔ PartidaPedido
    const partidasByRef = {};
    partidas.forEach(p => { if (p.referencia) (partidasByRef[p.referencia] = partidasByRef[p.referencia] || []).push(p); });
    const facturadasRefs = new Set();
    lineasFactura.forEach(f => {
      const ps = partidasByRef[f.referencia] || [];
      facturadasRefs.add(f.referencia);
      if (!ps.length) {
        addDiscrep({ tipo: 'material_no_especificado', severidad: 'media', descripcion: `Línea de factura ${f.referencia || f.descripcion} sin contrapartida en pedido/presupuesto.`, tag_afectado: f.referencia || '', documentos_implicados: f.documento_origen_id ? [f.documento_origen_id] : [] });
        return;
      }
      ps.forEach(p => {
        if (f.cantidad_facturada != null && p.cantidad != null && Math.abs(f.cantidad_facturada - p.cantidad) > 0.001) {
          addDiscrep({ tipo: 'cantidad_no_coincide', severidad: 'media', descripcion: `Factura ${f.referencia}: ${f.cantidad_facturada} vs pedido ${p.cantidad}.`, tag_afectado: f.referencia, documentos_implicados: [f.documento_origen_id, p.documento_origen_id].filter(Boolean), valor_esperado: `${p.cantidad}`, valor_real: `${f.cantidad_facturada}` });
        }
        if (f.precio_unitario_neto != null && p.precio_unitario != null && Math.abs(f.precio_unitario_neto - p.precio_unitario) > 0.01) {
          addDiscrep({ tipo: 'precio_no_coincide', severidad: 'media', descripcion: `Factura ${f.referencia}: ${f.precio_unitario_neto}€/ud vs pedido ${p.precio_unitario}€/ud.`, tag_afectado: f.referencia, documentos_implicados: [f.documento_origen_id, p.documento_origen_id].filter(Boolean), valor_esperado: `${p.precio_unitario}€`, valor_real: `${f.precio_unitario_neto}€` });
        }
      });
    });
    // material_no_facturado: partidas sin línea de factura (solo si hay facturas en el proyecto)
    if (lineasFactura.length) {
      partidas.forEach(p => {
        if (p.referencia && !facturadasRefs.has(p.referencia)) {
          addDiscrep({ tipo: 'material_no_facturado', severidad: 'media', descripcion: `Partida ${p.referencia} (${p.descripcion}) del pedido sin línea de factura asociada.`, tag_afectado: p.referencia, documentos_implicados: p.documento_origen_id ? [p.documento_origen_id] : [] });
        }
      });
    }

    // ── Regla 5: por_metro_lineal — AnalisisCoste + riesgo_precio_distancia / distancia_plano_vs_pedido
    const analisis = [];
    const analisisByPartida = {};
    basePrecios.forEach(bp => { analisisByPartida[bp.partida_pedido_id] = bp; });
    partidas.forEach(p => {
      const bp = analisisByPartida[p.id];
      if (!bp || bp.tipo_medicion !== 'por_metro_lineal') return;
      const medicion = mediciones.find(m => m.tag_o_circuito === p.referencia || m.tag_o_circuito === p.posicion);
      const trazado = trazados.find(t => t.tag_circuito_asociado === p.referencia || t.tag_circuito_asociado === p.posicion);
      const distanciaReal = medicion?.distancia_real_m ?? trazado?.distancia_estimada_m ?? null;
      const cantidadContratada = p.cantidad;
      const costeContratado = p.total;
      if (distanciaReal == null) {
        analisis.push({ obra_id, partida_pedido_id: p.id, cantidad_contratada: cantidadContratada, cantidad_real_ultima_revision: null, coste_contratado: costeContratado, coste_recalculado_con_cantidad_real: null, desviacion: null, estado_riesgo: 'sin_datos', puntos_sin_medicion: 1, fuente_principal_dato: 'contratado', fecha_calculo: now, calculado_por: user.email });
        return;
      }
      const costeRecalc = distanciaReal * (bp.precio_unitario_pactado || 0);
      const desv = costeRecalc - costeContratado;
      let estado = 'dentro_de_rango';
      const sobreMax = bp.distancia_maxima_asumida_m != null && distanciaReal > bp.distancia_maxima_asumida_m;
      if (sobreMax) estado = desv > 0 ? 'sobrecoste_confirmado' : 'infrafacturado_confirmado';
      else if (Math.abs(desv) / (costeContratado || 1) > 0.05) estado = 'fuera_de_rango_revisar';
      analisis.push({ obra_id, partida_pedido_id: p.id, cantidad_contratada: cantidadContratada, cantidad_real_ultima_revision: distanciaReal, coste_contratado: costeContratado, coste_recalculado_con_cantidad_real: costeRecalc, desviacion: desv, estado_riesgo: estado, puntos_sin_medicion: 0, fuente_principal_dato: medicion ? 'medicion_campo' : 'plano_calibrado_circuito_conocido', fecha_calculo: now, calculado_por: user.email });
      if (sobreMax) {
        addDiscrep({ tipo: 'riesgo_precio_distancia', severidad: desv > 0 ? 'alta' : 'media', descripcion: `Partida ${p.posicion} ${p.referencia}: distancia real ${distanciaReal}m supera el máximo asumido ${bp.distancia_maxima_asumida_m}m. Sobrecoste potencial ${desv.toFixed(2)}€.`, tag_afectado: p.referencia || p.posicion, documentos_implicados: [p.documento_origen_id, bp.documento_origen_id].filter(Boolean), valor_esperado: `${bp.distancia_maxima_asumida_m}m`, valor_real: `${distanciaReal}m` });
      } else if (bp.distancia_minima_asumida_m != null && distanciaReal < bp.distancia_minima_asumida_m) {
        addDiscrep({ tipo: 'distancia_plano_vs_pedido', severidad: 'baja', descripcion: `Partida ${p.posicion}: distancia real ${distanciaReal}m menor al mínimo asumido ${bp.distancia_minima_asumida_m}m.`, tag_afectado: p.referencia || p.posicion, documentos_implicados: [p.documento_origen_id, bp.documento_origen_id].filter(Boolean), valor_esperado: `${bp.distancia_minima_asumida_m}m`, valor_real: `${distanciaReal}m` });
      }
    });

    // ── Regla 6: FichaTecnicaEquipo con equipo_asociado → especificacion_tecnica_inconsistente
    const num = (s) => { const m = String(s).match(/(\d+(?:[.,]\d+)?)\s*kw/i); return m ? parseFloat(m[1].replace(',', '.')) : null; };
    fichas.forEach(f => {
      if (!f.especificacion_clave || !f.equipo_asociado) return;
      const potMotor = f.especificacion_clave.potencia_kw;
      const potAsoc = num(f.equipo_asociado);
      if (potMotor && potAsoc) {
        const ratio = potAsoc / potMotor;
        if (Math.abs(ratio - 1) > 0.15) {
          addDiscrep({ tipo: 'especificacion_tecnica_inconsistente', severidad: 'baja', descripcion: `Ficha ${f.tag_equipo} (${potMotor}kW) vs ${f.equipo_asociado}. Diferencia ${Math.round((ratio - 1) * 100)}% — puede ser margen de diseño; requiere verificación.`, tag_afectado: f.tag_equipo, documentos_implicados: f.documento_origen_id ? [f.documento_origen_id] : [], valor_esperado: `${potMotor}kW`, valor_real: `${potAsoc}kW` });
        }
      }
    });

    // ── Regla 7: anotaciones manuscritas → diseño_pendiente
    documentos.forEach(d => {
      const anot = d.datos_extraidos?.anotaciones_manuscritas;
      if (Array.isArray(anot) && anot.length) {
        const patrones = ['duplicar', 'faltan', 'en principio', 'solo 1', 'pendiente'];
        const match = anot.filter(a => patrones.some(p => String(a).toLowerCase().includes(p)));
        if (match.length) {
          addDiscrep({ tipo: 'diseño_pendiente', severidad: 'media', descripcion: `Documento ${d.revision || d.tipo} contiene anotaciones manuscritas de decisiones sin cerrar: ${match.map(a => `'${a}'`).join(', ')}.`, tag_afectado: '', documentos_implicados: [d.id], valor_esperado: 'decisión cerrada', valor_real: 'decisión abierta' });
        }
      }
    });

    // ── Regla 8: presupuesto referencia previos → superseded
    const superseded = [];
    documentos.forEach(d => {
      if (d.tipo === 'presupuesto' && d.presupuestos_previos_referenciados) {
        const refs = d.presupuestos_previos_referenciados.split(/[,;+\s]+/).map(s => s.trim()).filter(Boolean);
        documentos.forEach(o => {
          if (o.id === d.id || o.tipo !== 'presupuesto' || o.estado === 'superseded') return;
          if (refs.some(r => (o.revision || '').includes(r) || (o.numero_documento || '').includes(r))) {
            superseded.push(base44.entities.MaterialDocumentoOrigen.update(o.id, { estado: 'superseded' }));
          }
        });
      }
    });

    // Persistir
    let createdDiscreps = [];
    if (newDiscreps.length) createdDiscreps = await base44.entities.Discrepancia.bulkCreate(newDiscreps);
    if (analisis.length) await base44.entities.AnalisisCoste.bulkCreate(analisis);
    if (superseded.length) await Promise.all(superseded);

    return Response.json({
      success: true,
      obra_id,
      discrepancias_creadas: createdDiscreps.length,
      analisis_creados: analisis.length,
      documentos_superseded: superseded.length,
      resumen: {
        items, partidas: partidas.length, lineas_factura: lineasFactura.length,
        mediciones: mediciones.length, trazados: trazados.length, fichas: fichas.length,
        documentos: documentos.length, base_precios: basePrecios.length,
      },
    });
  } catch (error) {
    return Response.json({ error: String(error?.message || error).slice(0, 400), success: false }, { status: 500 });
  }
}