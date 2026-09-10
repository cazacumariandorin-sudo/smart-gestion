import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      operario_id, operario_name, periodo, fecha_inicio, fecha_fin, ciclo_mes,
      total_adelantos = 0, importe_neto = null, adelantos_detalle = [],
    } = await req.json();

    const esGestor = user.role === 'admin' || user.role === 'propietario' || user.role === 'gerencia';

    // Lectura: gestores ven todo (asServiceRole); el resto solo lo suyo (RLS).
    let notas;
    if (esGestor) {
      notas = await base44.asServiceRole.entities.RegistroGasto.list('-created_date', 1000);
    } else {
      notas = await base44.entities.RegistroGasto.list('-created_date', 1000);
    }

    // Filtro por operario
    if (operario_id) {
      notas = notas.filter(n => n.operario_id === operario_id);
    } else if (!esGestor) {
      // No gestor sin operario_id: limitar a los suyos
      notas = notas.filter(n => n.operario_email === user.email || n.created_by === user.email);
    }

    // Filtro por ciclo o por rango de fechas
    if (ciclo_mes) {
      notas = notas.filter(n => (n.ciclo_mes || '') === ciclo_mes);
    } else if (fecha_inicio && fecha_fin) {
      notas = notas.filter(n => {
        const fecha = n.fecha_documento || n.fecha_creacion_real || (n.created_date || '').split('T')[0];
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
    doc.text(`Período: ${periodo || (ciclo_mes ? `Ciclo ${ciclo_mes}` : `${fecha_inicio} - ${fecha_fin}`)}`, 14, 30);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')}`, pageW - 60, 24);

    doc.setTextColor(0, 0, 0);

    // Totales por categoría
    const categorias = ['material', 'combustible', 'peaje', 'parking', 'otros'];
    const totalesCat = {};
    categorias.forEach(c => { totalesCat[c] = notas.filter(n => n.categoria === c).reduce((s, n) => s + (n.importe || 0), 0); });
    const totalGeneral = notas.reduce((s, n) => s + (n.importe || 0), 0);
    const neto = importe_neto != null ? Number(importe_neto) : (totalGeneral - Number(total_adelantos));

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
    doc.text('TOTAL GASTOS', 20, y + 3);
    doc.text(`${totalGeneral.toFixed(2)} €`, pageW - 30, y + 3, { align: 'right' });
    y += 8;

    // Adelantos + neto (trazabilidad contable)
    if (Number(total_adelantos) > 0 || (adelantos_detalle && adelantos_detalle.length > 0)) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text(`Adelantos de gastos`, 20, y + 3);
      doc.text(`${Number(total_adelantos).toFixed(2)} €`, pageW - 30, y + 3, { align: 'right' });
      y += 7;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      if (adelantos_detalle && adelantos_detalle.length) {
        adelantos_detalle.forEach(a => {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(`  ${a.fecha || '-'}  ${String(a.concepto || '').substring(0, 50)}`, 22, y);
          doc.text(`[${a.estado || ''}]`, pageW - 70, y);
          doc.text(`${(a.importe || 0).toFixed(2)} €`, pageW - 30, y, { align: 'right' });
          y += 5;
        });
      }
      y += 2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('NETO A LIQUIDAR', 20, y + 3);
      doc.text(`${neto.toFixed(2)} €`, pageW - 30, y + 3, { align: 'right' });
      y += 10;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
    } else {
      y += 7;
    }

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
    doc.text('Fecha', 40, y);
    doc.text('Comercio', 58, y);
    doc.text('Localidad', 92, y);
    doc.text('NIF', 120, y);
    doc.text('Nº Fact.', 138, y);
    doc.text('F. Pago', 156, y);
    doc.text('Categoría', 176, y);
    doc.text('Importe', pageW - 18, y, { align: 'right' });
    y += 6;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    notas.forEach((nota, idx) => {
      if (y > 272) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) {
        doc.setFillColor(249, 249, 249);
        doc.rect(14, y - 4, pageW - 28, 7, 'F');
      }
      if (nota.es_gasto_tardio) doc.setTextColor(200, 0, 0);
      doc.text((nota.numero_nota || '-').substring(0, 12), 16, y);
      doc.text(nota.fecha_documento || '-', 40, y);
      doc.text((nota.nombre_comercio || '-').substring(0, 14), 58, y);
      doc.text((nota.localidad || '-').substring(0, 12), 92, y);
      doc.text((nota.nif_comercio || '-').substring(0, 10), 120, y);
      doc.text((nota.numero_factura || '-').substring(0, 10), 138, y);
      doc.text((nota.forma_pago_documento || '-').substring(0, 9), 156, y);
      doc.text((nota.categoria || '-').substring(0, 8), 176, y);
      doc.setTextColor(0, 0, 0);
      doc.text(`${(nota.importe || 0).toFixed(2)} €`, pageW - 18, y, { align: 'right' });
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