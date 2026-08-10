import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Aprende (o refuerza) un patrón de gasto: asociación comercio → categoría,
// jugando a favor de cada operario. Recibe la categoría confirmada y (opcionalmente)
// la categoría sugerida por un patrón previo, para distinguir confirmación de corrección.
//
// Se invoca desde el frontend tras crear un RegistroGasto exitosamente.
// No es admin-only; el RLS de PatronGasto admite que cada operario gestione sus patrones.

function normalizar(texto) {
  return (texto || '')
    .toString()
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // quitar acentos
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const operarioId = body?.operario_id || user.id;
    const operarioEmail = body?.operario_email || user.email;
    const nombreComercio = body?.nombre_comercio || '';
    const nifComercio = body?.nif_comercio || '';
    const categoriaConfirmada = body?.categoria_confirmada || '';
    const categoriaSugerida = body?.categoria_sugerida || null; // puede venir null si no había patrón previo

    const nombreNorm = normalizar(nombreComercio);
    if (!nombreNorm) {
      return Response.json({ success: false, error: 'nombre_comercio vacío' }, { status: 400 });
    }
    if (!categoriaConfirmada) {
      return Response.json({ success: false, error: 'categoria_confirmada vacía' }, { status: 400 });
    }

    const hoyISO = new Date().toISOString().slice(0, 10);

    // Buscar patrón existente para este operario + comercio normalizado
    const existentes = await base44.entities.PatronGasto.filter({
      operario_id: operarioId,
      nombre_comercio_normalizado: nombreNorm,
    });

    if (existentes && existentes.length > 0) {
      const p = existentes[0];
      let vecesConfirmado = p.veces_confirmado || 0;
      let vecesCorregido = p.veces_corregido || 0;
      let categoriaSugeridaNueva = p.categoria_sugerida;
      let categoriaMasCorregida = p.categoria_mas_corregida;

      const huboSugerenciaPrevia = !!categoriaSugerida;

      if (huboSugerenciaPrevia && categoriaSugerida === categoriaConfirmada) {
        // Confirmación: la sugerencia anterior fue aceptada
        vecesConfirmado += 1;
      } else if (huboSugerenciaPrevia && categoriaSugerida !== categoriaConfirmada) {
        // Corrección: la sugerencia anterior fue cambiada por otra
        vecesCorregido += 1;
        categoriaSugeridaNueva = categoriaConfirmada; // reorientar sugerencia
        categoriaMasCorregida = categoriaConfirmada;
      } else {
        // No había sugerencia previa: el usuario escogió una categoría libremente.
        // Si coincide con la sugerencia actual del patrón, counts como confirmación; si no, corrección.
        if (categoriaConfirmada === p.categoria_sugerida) {
          vecesConfirmado += 1;
        } else {
          vecesCorregido += 1;
          categoriaSugeridaNueva = categoriaConfirmada;
          categoriaMasCorregida = categoriaConfirmada;
        }
      }

      const total = vecesConfirmado + vecesCorregido;
      const confianza = total > 0 ? Math.round((vecesConfirmado / total) * 100) / 100 : 0;

      const updatePayload = {
        veces_confirmado: vecesConfirmado,
        veces_corregido: vecesCorregido,
        categoria_sugerida: categoriaSugeridaNueva,
        categoria_mas_corregida: categoriaMasCorregida,
        confianza,
        ultima_aplicacion: hoyISO,
        activo: true,
      };
      if (nifComercio && !p.nif_comercio) updatePayload.nif_comercio = nifComercio;

      await base44.entities.PatronGasto.update(p.id, updatePayload);

      return Response.json({
        success: true,
        accion: 'actualizado',
        patron_id: p.id,
        veces_confirmado: vecesConfirmado,
        veces_corregido: vecesCorregido,
        confianza,
      });
    }

    // Crear patrón nuevo (primera vez que se registra este comercio para el operario)
    const nuevo = await base44.entities.PatronGasto.create({
      operario_id: operarioId,
      operario_email: operarioEmail,
      nombre_comercio_normalizado: nombreNorm,
      nombre_comercio_display: nombreComercio.trim(),
      nif_comercio: nifComercio || '',
      categoria_sugerida: categoriaConfirmada,
      veces_confirmado: 1,
      veces_corregido: 0,
      categoria_mas_corregida: '',
      confianza: 1,
      ultima_aplicacion: hoyISO,
      activo: true,
    });

    return Response.json({
      success: true,
      accion: 'creado',
      patron_id: nuevo.id || nuevo._id,
      categoria_sugerida: categoriaConfirmada,
      confianza: 1,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}