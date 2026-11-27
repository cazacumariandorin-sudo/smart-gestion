/**
 * Genera el PDF del informe de análisis de seguimiento de una obra.
 * Incluye resumen, observaciones con su clasificación y evidencias,
 * datos no disponibles, recomendaciones y estado de revisión.
 */

const SECCIONES = {
  avance: 'Avance observado',
  incidencia: 'Posibles incidencias',
  trabajo_extra: 'Posibles trabajos extra',
};

const TIPOS = { hecho: 'Hecho registrado', inferencia: 'Inferencia', pendiente: 'Pendiente de verificar' };
const REVISION = { pendiente: 'Sin revisar', confirmada: 'Confirmada', descartada: 'Descartada', corregida: 'Corregida' };

const fechaHora = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export async function descargarInformeAnalisisPdf(analisis, obra) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 15;
  const ANCHO = 180;
  let y = M;

  const salto = (alto = 5) => {
    if (y + alto > 285) {
      doc.addPage();
      y = M;
    }
  };

  const parrafo = (texto, { size = 9, bold = false, color = [20, 24, 31], sangria = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lineas = doc.splitTextToSize(String(texto || ''), ANCHO - sangria);
    lineas.forEach((linea) => {
      salto(5);
      doc.text(linea, M + sangria, y);
      y += 4.6;
    });
  };

  const titulo = (texto) => {
    y += 2;
    salto(10);
    doc.setDrawColor(210, 214, 220);
    doc.line(M, y - 1.5, M + ANCHO, y - 1.5);
    parrafo(texto, { size: 11, bold: true, color: [21, 33, 249] });
    y += 1;
  };

  parrafo('INFORME DE SEGUIMIENTO ASISTIDO', { size: 14, bold: true });
  parrafo(obra?.name || analisis?.obra_name || 'Obra', { size: 11, bold: true });
  parrafo(
    [
      analisis?.codigo_obra && `Código: ${analisis.codigo_obra}`,
      `Análisis: ${fechaHora(analisis?.generado_en)}`,
      analisis?.generado_por_nombre && `Generado por: ${analisis.generado_por_nombre}`,
      `Confianza global: ${Math.round((Number(analisis?.confianza) || 0) * 100)} %`,
      `Fotos analizadas: ${Number(analisis?.fotos_analizadas) || 0}`,
    ]
      .filter(Boolean)
      .join('  ·  '),
    { size: 8.5, color: [106, 113, 129] }
  );

  if (analisis?.resumen) {
    titulo('Resumen');
    parrafo(analisis.resumen);
  }

  Object.keys(SECCIONES).forEach((seccion) => {
    const items = (analisis?.hallazgos || []).filter((h) => h.seccion === seccion);
    if (!items.length) return;
    titulo(SECCIONES[seccion]);
    items.forEach((h) => {
      salto(12);
      parrafo(h.titulo || 'Observación', { size: 9.5, bold: true });
      parrafo(
        `${TIPOS[h.tipo] || h.tipo || ''} · confianza ${Math.round((Number(h.confianza) || 0) * 100)} % · revisión: ${
          REVISION[h.estado_revision] || 'Sin revisar'
        }`,
        { size: 8, color: [106, 113, 129] }
      );
      if (h.detalle) parrafo(h.detalle, { sangria: 3 });
      (h.evidencias || []).forEach((e) => {
        const ref = [e.etiqueta || e.entidad, e.fecha && `(${String(e.fecha).slice(0, 10)})`].filter(Boolean).join(' ');
        parrafo(`• ${ref}`, { size: 8, color: [60, 66, 80], sangria: 6 });
      });
      if (!(h.evidencias || []).length) {
        parrafo('• Sin evidencia directa: requiere verificación en obra.', { size: 8, color: [160, 80, 20], sangria: 6 });
      }
      if (h.nota_revision) parrafo(`Nota de revisión: ${h.nota_revision}`, { size: 8, color: [60, 66, 80], sangria: 3 });
      y += 1;
    });
  });

  if ((analisis?.datos_no_disponibles || []).length) {
    titulo('Datos no disponibles');
    analisis.datos_no_disponibles.forEach((d) => parrafo(`• ${d}`, { sangria: 2 }));
  }

  if ((analisis?.recomendaciones || []).length) {
    titulo('Comprobaciones recomendadas');
    analisis.recomendaciones.forEach((r) => parrafo(`• ${r}`, { sangria: 2 }));
  }

  if ((analisis?.fuentes || []).length) {
    titulo('Fuentes consultadas');
    parrafo(analisis.fuentes.map((f) => `${f.etiqueta || f.entidad}: ${Number(f.registros) || 0}`).join('  ·  '), {
      size: 8.5,
      color: [106, 113, 129],
    });
  }

  y += 3;
  salto(10);
  parrafo(
    'Documento de apoyo interno. Las observaciones son propuestas asistidas por IA y no confirman por sí mismas defectos, avances ni trabajos extra: requieren validación humana.',
    { size: 7.5, color: [106, 113, 129] }
  );

  const nombre = `Informe-seguimiento-${(analisis?.codigo_obra || obra?.name || 'obra')
    .toString()
    .replace(/[^\w.-]+/g, '-')
    .slice(0, 40)}.pdf`;
  doc.save(nombre);
}