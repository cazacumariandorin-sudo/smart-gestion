import { useState, useMemo } from 'react';
import { useUserRole } from '@/lib/useUserRole';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { groupByWeek, groupByMonth } from '@/lib/horasUtils';
import { Download, BarChart3, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

// Simple table helper for jsPDF (no plugin needed)
function drawTable(doc, headers, rows, startY, margin = 14) {
  const colW = (196 - margin) / headers.length;
  const rowH = 7;
  let y = startY;

  // Header row
  doc.setFillColor(249, 115, 22);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  headers.forEach((h, i) => {
    doc.rect(margin + i * colW, y, colW, rowH, 'F');
    doc.text(String(h), margin + i * colW + 2, y + 4.5);
  });
  y += rowH;

  // Data rows
  doc.setFont(undefined, 'normal');
  doc.setTextColor(20, 20, 20);
  rows.forEach((row, ri) => {
    if (y > 275) { doc.addPage(); y = 20; }
    const bg = ri % 2 === 0 ? [255, 255, 255] : [250, 250, 252];
    doc.setFillColor(...bg);
    row.forEach((cell, i) => {
      doc.rect(margin + i * colW, y, colW, rowH, 'F');
      doc.setTextColor(20, 20, 20);
      doc.text(String(cell ?? '—').substring(0, 22), margin + i * colW + 2, y + 4.5);
    });
    y += rowH;
  });

  // Border
  doc.setDrawColor(180, 180, 180);
  doc.rect(margin, startY, colW * headers.length, y - startY, 'S');

  return y + 4;
}

export default function InformesTab() {
  const [mode, setMode] = useState('mes');
  const [opFilter, setOpFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));

  const { isAdmin, isJefeObra, isControlHorarioOnly, user } = useUserRole();
  const canSeeAll = isAdmin || isJefeObra;

  const { data: fichajes = [] } = useQuery({ queryKey: ['fichajes'], queryFn: () => base44.entities.Fichaje.list('-date', 1000) });
  const { data: operarios = [] } = useQuery({ queryKey: ['operarios'], queryFn: () => base44.entities.Operario.list('name', 200) });
  const myOperario = isControlHorarioOnly ? operarios.find(o => o.email === user?.email) : null;

  const filtered = useMemo(() => fichajes.filter(f => {
    // control_horario only sees their own records
    if (isControlHorarioOnly) {
      if (!myOperario || f.operario_id !== myOperario.id) return false;
    }
    const mOp = opFilter === 'all' || f.operario_id === opFilter;
    const mMonth = !monthFilter || f.date?.startsWith(monthFilter);
    return mOp && mMonth;
  }), [fichajes, opFilter, monthFilter, isControlHorarioOnly, myOperario]);

  const byOperario = useMemo(() => {
    const map = {};
    filtered.forEach(f => {
      if (!map[f.operario_id]) map[f.operario_id] = { name: f.operario_name, fichajes: [], total: 0 };
      map[f.operario_id].fichajes.push(f);
      map[f.operario_id].total += f.horas_trabajadas || 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const byWeek = useMemo(() => groupByWeek(filtered), [filtered]);
  const byMonth = useMemo(() => groupByMonth(filtered), [filtered]);
  const totalHoras = filtered.reduce((s, f) => s + (f.horas_trabajadas || 0), 0);

  const generatePDF = () => {
    const doc = new jsPDF();
    const title = mode === 'operario' ? 'Informe por Operario' : mode === 'semana' ? 'Informe Semanal' : 'Informe Mensual';
    const subtitle = monthFilter ? format(parseISO(monthFilter + '-01'), 'MMMM yyyy', { locale: es }) : 'Todos los períodos';

    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('Control Horario', 14, 18);
    doc.setFontSize(13);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(title, 14, 27);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(subtitle.charAt(0).toUpperCase() + subtitle.slice(1), 14, 34);
    doc.setDrawColor(180, 180, 180);
    doc.line(14, 38, 196, 38);

    let y = 46;

    if (mode === 'operario') {
      byOperario.forEach(op => {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.setFont(undefined, 'bold');
        doc.text(`${op.name} — ${op.total.toFixed(2)} h`, 14, y);
        doc.setFont(undefined, 'normal');
        y += 6;
        const rows = op.fichajes.map(f => [
          f.date ? format(parseISO(f.date), 'dd/MM/yyyy') : '',
          f.hora_entrada || '',
          f.hora_salida || '',
          (f.pausa_inicio && f.pausa_fin) ? `${f.pausa_inicio}-${f.pausa_fin}` : '—',
          f.project || '—',
          (f.horas_trabajadas || 0).toFixed(2) + 'h',
        ]);
        y = drawTable(doc, ['Fecha', 'Entrada', 'Salida', 'Pausa', 'Obra', 'Horas'], rows, y);
      });
    } else if (mode === 'semana') {
      Object.entries(byWeek).sort().forEach(([week, wf]) => {
        if (y > 250) { doc.addPage(); y = 20; }
        const wTotal = wf.reduce((s, f) => s + (f.horas_trabajadas || 0), 0);
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.setFont(undefined, 'bold');
        doc.text(`${week} — ${wTotal.toFixed(2)} h`, 14, y);
        doc.setFont(undefined, 'normal');
        y += 6;
        const rows = wf.sort((a, b) => a.date > b.date ? 1 : -1).map(f => [
          f.date ? format(parseISO(f.date), 'dd/MM EEE', { locale: es }) : '',
          f.operario_name,
          f.hora_entrada || '',
          f.hora_salida || '',
          f.project || '—',
          (f.horas_trabajadas || 0).toFixed(2) + 'h',
        ]);
        y = drawTable(doc, ['Fecha', 'Operario', 'Entrada', 'Salida', 'Obra', 'Horas'], rows, y);
      });
    } else {
      const rows = filtered.sort((a, b) => a.date > b.date ? 1 : -1).map(f => [
        f.date ? format(parseISO(f.date), 'dd/MM/yyyy') : '',
        f.operario_name,
        f.hora_entrada || '',
        f.hora_salida || '',
        (f.pausa_inicio && f.pausa_fin) ? `${f.pausa_inicio}-${f.pausa_fin}` : '—',
        f.project || '—',
        (f.horas_trabajadas || 0).toFixed(2) + 'h',
      ]);
      y = drawTable(doc, ['Fecha', 'Operario', 'Entrada', 'Salida', 'Pausa', 'Obra', 'Horas'], rows, y);

      if (y < 260) {
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Resumen por operario:', 14, y + 4);
        doc.setFont(undefined, 'normal');
        const sumRows = byOperario.map(op => [op.name, op.fichajes.length + ' días', op.total.toFixed(2) + ' h']);
        drawTable(doc, ['Operario', 'Días', 'Total Horas'], sumRows, y + 10);
      }
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Total: ${totalHoras.toFixed(2)} h | Generado ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Pág ${i}/${pageCount}`, 14, 290);
    }

    doc.save(`informe-horario-${monthFilter || 'todos'}-${mode}.pdf`);
  };

  const generateExcel = () => {
    const rows = filtered
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .map(f => ({
        Fecha: f.date ? format(parseISO(f.date), 'dd/MM/yyyy') : '',
        Operario: f.operario_name || '',
        Entrada: f.hora_entrada || '',
        Salida: f.hora_salida || '',
        'Pausa inicio': f.pausa_inicio || '',
        'Pausa fin': f.pausa_fin || '',
        Obra: f.project || '',
        'Horas trabajadas': f.horas_trabajadas || 0,
        Notas: f.notas || '',
      }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fichajes');
    XLSX.writeFile(wb, `control-horario-${monthFilter || 'todos'}.xlsx`);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <MobileSelect value={mode} onValueChange={setMode} placeholder="Vista" triggerClassName="w-full sm:w-44">
          <MobileSelectItem value="mes">Por Mes</MobileSelectItem>
          <MobileSelectItem value="semana">Por Semana</MobileSelectItem>
          <MobileSelectItem value="operario">Por Operario</MobileSelectItem>
        </MobileSelect>
        <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-full sm:w-40" />
        {canSeeAll && (
          <MobileSelect value={opFilter} onValueChange={setOpFilter} placeholder="Operario" triggerClassName="w-full sm:w-44">
            <MobileSelectItem value="all">Todos los operarios</MobileSelectItem>
            {operarios.map(op => <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>)}
          </MobileSelect>
        )}
        <Button onClick={generatePDF} className="gap-2 shrink-0">
          <Download className="w-4 h-4" /> PDF
        </Button>
        <Button onClick={generateExcel} variant="outline" className="gap-2 shrink-0">
          <Download className="w-4 h-4" /> Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Total Horas</p>
          <p className="text-2xl font-bold text-primary">{totalHoras.toFixed(1)}h</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Fichajes</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </Card>
        <Card className="p-4 text-center col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground mb-1">Operarios</p>
          <p className="text-2xl font-bold">{byOperario.length}</p>
        </Card>
      </div>

      {mode === 'operario' && (
        <div className="space-y-4">
          {byOperario.map(op => (
            <Card key={op.name} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-semibold">{op.name}</span>
                  <Badge variant="outline" className="text-[10px]">{op.fichajes.length} días</Badge>
                </div>
                <span className="text-lg font-bold text-primary">{op.total.toFixed(2)} h</span>
              </div>
              <div className="space-y-1">
                {op.fichajes.sort((a, b) => a.date > b.date ? 1 : -1).map(f => (
                  <div key={f.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                    <span className="text-muted-foreground capitalize w-20">{f.date ? format(parseISO(f.date), 'EEE dd/MM', { locale: es }) : '--'}</span>
                    <span>{f.hora_entrada} → {f.hora_salida || '--'}</span>
                    <span className="text-muted-foreground truncate max-w-24">{f.project || '—'}</span>
                    <span className="font-semibold">{(f.horas_trabajadas || 0).toFixed(1)}h</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {mode === 'semana' && (
        <div className="space-y-4">
          {Object.entries(byWeek).sort().reverse().map(([week, wf]) => {
            const wTotal = wf.reduce((s, f) => s + (f.horas_trabajadas || 0), 0);
            return (
              <Card key={week} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-semibold">{week}</span>
                    <Badge variant="outline" className="text-[10px]">{wf.length} días</Badge>
                  </div>
                  <span className="text-lg font-bold text-primary">{wTotal.toFixed(2)} h</span>
                </div>
                <div className="space-y-1">
                  {wf.sort((a, b) => a.date > b.date ? 1 : -1).map(f => (
                    <div key={f.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                      <span className="text-muted-foreground capitalize w-20">{f.date ? format(parseISO(f.date), 'EEE dd/MM', { locale: es }) : '--'}</span>
                      <span className="font-medium w-24 truncate">{f.operario_name}</span>
                      <span>{f.hora_entrada} → {f.hora_salida || '--'}</span>
                      <span className="font-semibold">{(f.horas_trabajadas || 0).toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {mode === 'mes' && (
        <div className="space-y-4">
          {Object.entries(byMonth).sort().reverse().map(([month, mf]) => {
            const mTotal = mf.reduce((s, f) => s + (f.horas_trabajadas || 0), 0);
            const label = format(parseISO(month + '-01'), 'MMMM yyyy', { locale: es });
            return (
              <Card key={month} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold capitalize">{label}</span>
                  <span className="text-lg font-bold text-primary">{mTotal.toFixed(2)} h</span>
                </div>
                <div className="space-y-1">
                  {mf.sort((a, b) => a.date > b.date ? 1 : -1).map(f => (
                    <div key={f.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                      <span className="text-muted-foreground capitalize w-20">{f.date ? format(parseISO(f.date), 'EEE dd', { locale: es }) : '--'}</span>
                      <span className="font-medium w-24 truncate">{f.operario_name}</span>
                      <span>{f.hora_entrada} → {f.hora_salida || '--'}</span>
                      <span className="text-muted-foreground truncate hidden sm:block max-w-20">{f.project || '—'}</span>
                      <span className="font-semibold">{(f.horas_trabajadas || 0).toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
          {Object.keys(byMonth).length === 0 && (
            <div className="text-center py-12 border border-dashed rounded-xl">
              <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No hay datos para el período seleccionado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}