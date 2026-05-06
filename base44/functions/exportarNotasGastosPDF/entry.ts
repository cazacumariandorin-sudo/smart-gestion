import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { operario_id, operario_name, periodo, fecha_inicio, fecha_fin } = await req.json();

    // Admin puede ver todos, usuario solo los suyos
    let notas;
    if (user.role === 'admin') {
      notas = operario_id
        ? await base44.asServiceRole.entities.NotaGasto.filter({ operario_id })
        : await base44.asServiceRole.entities.NotaGasto.list('-fecha_documento', 500);
    } else {
      notas = await base44.entities.NotaGasto.filter({ operario_id: user.id });
    }

    // Filtrar por fechas si se proporcionan
    if (fecha_inicio && fecha_fin) {
      notas = notas.filter(n => {
        const fecha = n.fecha_documento || n.fecha_creacion_real || n.created_date?.split('T')[0];
        return fecha >= fecha_inicio && fecha <= fecha_fin;
      });
    }

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(234, 88, 12);
    doc.rect(0, 0, pageW, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SIMANTEC - Notas de Gastos', 14, 15);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Operario: ${operario_name || 'Todos'}`, 14, 24);
    doc.text(`Período: ${periodo || `${fecha_inicio} - ${fecha_fin}`}`, 14, 30);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, pageW - 60, 24);

    doc.setTextColor(0, 0, 0);

    // Totales por categoría
    const categorias = ['material', 'combustible', 'peaje', 'parking', 'otros'];
    const totalesCat = {};
    categorias.forEach(c => { totalesCat[c] = notas.filter(n => n.categoria === c).reduce((s, n) => s + (n.importe || 0), 0); });
    const totalGeneral = notas.reduce((s, n) => s + (n.importe || 0), 0);

    let y = 45;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen por categoría', 14, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setFillColor(248, 248, 248);
    doc.rect(14, y, pageW - 28, 8 * categorias.length + 10, 'F');
    y += 5;
    categorias.forEach(cat => {
      doc.text(cat.charAt(0).toUpperCase() + cat.slice(1), 20, y);
      doc.text(`${totalesCat[cat].toFixed(2)} €`, pageW - 30, y, { align: 'right' });
      y += 8;
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL', 20, y + 3);
    doc.text(`${totalGeneral.toFixed(2)} €`, pageW - 30, y + 3, { align: 'right' });
    y += 15;

    // Tabla de notas
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Detalle de notas (${notas.length})`, 14, y);
    y += 8;

    // Cabecera tabla
    doc.setFillColor(234, 88, 12);
    doc.setTextColor(255, 255, 255);
    doc.rect(14, y - 5, pageW - 28, 8, 'F');
    doc.setFontSize(8);
    doc.text('Número', 16, y);
    doc.text('Fecha', 52, y);
    doc.text('Comercio', 72, y);
    doc.text('Categoría', 120, y);
    doc.text('Estado', 152, y);
    doc.text('Importe', pageW - 20, y, { align: 'right' });
    y += 6;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    notas.forEach((nota, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) {
        doc.setFillColor(249, 249, 249);
        doc.rect(14, y - 4, pageW - 28, 7, 'F');
      }
      if (nota.es_gasto_tardio) doc.setTextColor(200, 0, 0);
      doc.text(nota.numero_nota || '-', 16, y);
      doc.text(nota.fecha_documento || '-', 52, y);
      doc.text((nota.nombre_comercio || '-').substring(0, 22), 72, y);
      doc.text(nota.categoria || '-', 120, y);
      doc.text(nota.estado || '-', 152, y);
      doc.setTextColor(0, 0, 0);
      doc.text(`${(nota.importe || 0).toFixed(2)} €`, pageW - 20, y, { align: 'right' });
      y += 7;
    });

    // Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i} de ${totalPages} - SIMANTEC Gestión Empresarial`, pageW / 2, 290, { align: 'center' });
    }

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=notas-gastos-${operario_name || 'todos'}-${new Date().toISOString().split('T')[0]}.pdf`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});