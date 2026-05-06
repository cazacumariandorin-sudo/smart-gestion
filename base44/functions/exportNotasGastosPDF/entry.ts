import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Solo administradores pueden exportar el informe completo' }, { status: 403 });
    }

    // Cargar todos los datos
    const [notas, gastos] = await Promise.all([
      base44.asServiceRole.entities.NotaGastos.list('-created_date', 500),
      base44.asServiceRole.entities.GastoOperario.list('-date', 2000),
    ]);

    const doc = new jsPDF();
    const margin = 14;
    const pageW = 210;

    const addPage = (y) => {
      if (y > 270) {
        doc.addPage();
        return 20;
      }
      return y;
    };

    // ── PORTADA ──────────────────────────────────────────
    doc.setFillColor(249, 115, 22);
    doc.rect(0, 0, pageW, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont(undefined, 'bold');
    doc.text('INFORME COMPLETO', margin, 22);
    doc.setFontSize(14); doc.setFont(undefined, 'normal');
    doc.text('Notas de Gastos — Todos los operarios', margin, 33);
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, margin, 43);
    doc.text(`Por: ${user.email}`, pageW - margin, 43, { align: 'right' });

    let y = 62;

    // ── RESUMEN GENERAL ──────────────────────────────────
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(13); doc.setFont(undefined, 'bold');
    doc.text('RESUMEN GENERAL', margin, y); y += 7;
    doc.setDrawColor(249, 115, 22); doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y); y += 6;

    const notasAbiertas = notas.filter(n => n.estado !== 'cerrada');
    const notasCerradas = notas.filter(n => n.estado === 'cerrada');
    const gastosNormales = gastos.filter(g => g.categoria !== 'adelanto');
    const adelantos = gastos.filter(g => g.categoria === 'adelanto');
    const totalGral = gastosNormales.reduce((s, g) => s + (g.importe || 0), 0);
    const totalAdelantos = adelantos.reduce((s, g) => s + (g.importe || 0), 0);

    // Tabla resumen
    const summaryData = [
      ['Total notas', notas.length.toString()],
      ['Notas abiertas', notasAbiertas.length.toString()],
      ['Notas cerradas', notasCerradas.length.toString()],
      ['Total gastos (líneas)', gastosNormales.length.toString()],
      ['Total adelantos (líneas)', adelantos.length.toString()],
      ['TOTAL GASTOS', `${totalGral.toFixed(2)} €`],
      ['TOTAL ADELANTOS', `${totalAdelantos.toFixed(2)} €`],
      ['SALDO NETO', `${(totalGral - totalAdelantos).toFixed(2)} €`],
    ];

    summaryData.forEach(([label, value], i) => {
      if (i >= 5) {
        doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        if (i === 7) doc.setTextColor(249, 115, 22);
        else doc.setTextColor(40, 40, 40);
      } else {
        doc.setFont(undefined, 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
      }
      doc.text(label + ':', margin + 5, y);
      doc.text(value, margin + 80, y, { align: 'left' });
      y += 6;
    });

    // ── AGRUPADO POR OPERARIO ────────────────────────────
    y += 5;
    doc.addPage();
    y = 20;

    // Agrupar notas por operario
    const byOperario = {};
    notas.forEach(n => {
      const key = n.operario_name || 'Sin operario';
      if (!byOperario[key]) byOperario[key] = [];
      byOperario[key].push(n);
    });

    const operarioNames = Object.keys(byOperario).sort();

    for (const operarioName of operarioNames) {
      const notasOp = byOperario[operarioName];
      const gastosOp = gastos.filter(g => notasOp.some(n => n.id === g.nota_id));
      const gastosNormOp = gastosOp.filter(g => g.categoria !== 'adelanto');
      const adelantosOp = gastosOp.filter(g => g.categoria === 'adelanto');
      const totalOp = gastosNormOp.reduce((s, g) => s + (g.importe || 0), 0);
      const totalAdelOp = adelantosOp.reduce((s, g) => s + (g.importe || 0), 0);

      y = addPage(y);

      // Cabecera operario
      doc.setFillColor(31, 41, 55);
      doc.rect(margin - 2, y - 5, pageW - 2 * margin + 4, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11); doc.setFont(undefined, 'bold');
      doc.text(`👷 ${operarioName}`, margin, y);
      doc.text(`${totalOp.toFixed(2)} €`, pageW - margin, y, { align: 'right' });
      y += 8;

      // Info operario
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8); doc.setFont(undefined, 'normal');
      doc.text(`${notasOp.length} nota(s) · ${gastosNormOp.length} gasto(s) · Adelantos: ${totalAdelOp.toFixed(2)} € · Saldo: ${(totalOp - totalAdelOp).toFixed(2)} €`, margin, y);
      y += 8;

      // Notas del operario
      for (const nota of notasOp) {
        y = addPage(y + 2);

        const notaGastos = gastos.filter(g => g.nota_id === nota.id && g.categoria !== 'adelanto');
        const notaAdelantos = gastos.filter(g => g.nota_id === nota.id && g.categoria === 'adelanto');
        const notaTotal = notaGastos.reduce((s, g) => s + (g.importe || 0), 0);
        const notaAdelTotal = notaAdelantos.reduce((s, g) => s + (g.importe || 0), 0);

        // Header nota
        doc.setFillColor(nota.estado === 'cerrada' ? 230 : 254, nota.estado === 'cerrada' ? 230 : 243, nota.estado === 'cerrada' ? 230 : 232);
        doc.rect(margin, y - 4, pageW - 2 * margin, 9, 'F');
        doc.setTextColor(nota.estado === 'cerrada' ? 80 : 21, nota.estado === 'cerrada' ? 80 : 128, nota.estado === 'cerrada' ? 80 : 61);
        doc.setFontSize(9); doc.setFont(undefined, 'bold');
        const estadoLabel = nota.estado === 'cerrada' ? '🔒' : '🔓';
        doc.text(`${estadoLabel} ${nota.titulo || 'Nota sin título'}`, margin + 2, y);
        doc.text(`${notaTotal.toFixed(2)} €`, pageW - margin, y, { align: 'right' });
        y += 5;

        doc.setTextColor(120, 120, 120);
        doc.setFontSize(7.5); doc.setFont(undefined, 'normal');
        const fechaStr = nota.fecha_inicio
          ? `${nota.fecha_inicio}${nota.fecha_cierre ? ' → ' + nota.fecha_cierre : ''}`
          : 'Sin fecha';
        doc.text(`Período: ${fechaStr} · ${notaGastos.length} gastos · ${notaAdelantos.length} adelantos`, margin + 2, y);
        y += 6;

        if (notaGastos.length === 0 && notaAdelantos.length === 0) {
          doc.setTextColor(160, 160, 160);
          doc.setFontSize(7.5);
          doc.text('(nota vacía)', margin + 5, y);
          y += 5;
        }

        // Gastos de la nota
        notaGastos.forEach(g => {
          y = addPage(y);
          doc.setTextColor(60, 60, 60);
          doc.setFontSize(8); doc.setFont(undefined, 'normal');
          const cat = g.categoria ? g.categoria.charAt(0).toUpperCase() + g.categoria.slice(1) : '—';
          const desc = (g.descripcion || g.proveedor || '—').substring(0, 55);
          const dateStr = g.date || '—';
          doc.text(`  • ${dateStr}`, margin, y);
          doc.text(`[${cat}]`, margin + 25, y);
          doc.text(desc, margin + 45, y);
          doc.setFont(undefined, 'bold');
          doc.text(`${(g.importe || 0).toFixed(2)} €`, pageW - margin, y, { align: 'right' });
          doc.setFont(undefined, 'normal');
          if (g.ticket_url) {
            doc.setTextColor(37, 99, 235);
            doc.setFontSize(7);
            doc.text('📎 ticket adjunto', margin + 2, y + 3.5);
            doc.setTextColor(60, 60, 60);
            doc.setFontSize(8);
            y += 3.5;
          }
          y += 5;
        });

        // Adelantos
        notaAdelantos.forEach(g => {
          y = addPage(y);
          doc.setTextColor(180, 30, 30);
          doc.setFontSize(8); doc.setFont(undefined, 'normal');
          const desc = (g.descripcion || 'Adelanto').substring(0, 60);
          doc.text(`  - ${g.date || '—'}  ADELANTO  ${desc}`, margin, y);
          doc.setFont(undefined, 'bold');
          doc.text(`- ${(g.importe || 0).toFixed(2)} €`, pageW - margin, y, { align: 'right' });
          doc.setFont(undefined, 'normal');
          y += 5;
        });

        // Totales nota
        if (notaGastos.length > 0 || notaAdelantos.length > 0) {
          y = addPage(y);
          doc.setDrawColor(200, 200, 200); doc.line(margin + 10, y, pageW - margin, y);
          y += 4;
          doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(249, 115, 22);
          doc.text('Subtotal:', pageW - margin - 35, y);
          doc.text(`${notaTotal.toFixed(2)} €`, pageW - margin, y, { align: 'right' });
          if (notaAdelantos.length > 0) {
            y += 4;
            doc.setTextColor(180, 30, 30);
            doc.text('Saldo:', pageW - margin - 35, y);
            doc.text(`${(notaTotal - notaAdelTotal).toFixed(2)} €`, pageW - margin, y, { align: 'right' });
          }
          y += 6;
        }
      }

      // Línea separadora entre operarios
      y = addPage(y + 3);
      doc.setDrawColor(249, 115, 22); doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 8;
    }

    // ── PIE DE PÁGINA en cada página ─────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setTextColor(160, 160, 160); doc.setFont(undefined, 'normal');
      doc.text(`SIMANTEC - Informe Notas de Gastos · Pág. ${p} / ${totalPages}`, pageW / 2, 290, { align: 'center' });
    }

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=notas-gastos-completo-${new Date().toISOString().split('T')[0]}.pdf`,
      },
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});