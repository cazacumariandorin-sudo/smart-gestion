import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { groupByWeek, groupByMonth } from '@/lib/horasUtils';
import { Download, FileText, BarChart3, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export default function InformesTab() {
  const [mode, setMode] = useState('mes'); // mes | semana | operario
  const [opFilter, setOpFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().slice(0, 7));

  const { data: fichajes = [] } = useQuery({ queryKey: ['fichajes'], queryFn: () => base44.entities.Fichaje.list('-date', 1000) });
  const { data: operarios = [] } = useQuery({ queryKey: ['operarios'], queryFn: () => base44.entities.Operario.list('name', 200) });

  const filtered = useMemo(() => fichajes.filter(f => {
    const mOp = opFilter === 'all' || f.operario_id === opFilter;
    const mMonth = !monthFilter || f.date?.startsWith(monthFilter);
    return mOp && mMonth;
  }), [fichajes, opFilter, monthFilter]);

  // Group by operario
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

  // --- PDF Generation ---
  const generatePDF = () => {
    const doc = new jsPDF();
    const title = mode === 'operario' ? `Informe por Operario` : mode === 'semana' ? 'Informe Semanal' : 'Informe Mensual';
    const subtitle = monthFilter ? format(parseISO(monthFilter + '-01'), 'MMMM yyyy', { locale: es }) : 'Todos los períodos';

    // Header
    doc.setFontSize(18);
    doc.setTextColor(40, 40, 40);
    doc.text('Control Horario', 14, 18);
    doc.setFontSize(13);
    doc.setTextColor(100, 100, 100);
    doc.text(title, 14, 26);
    doc.setFontSize(10);
    doc.text(subtitle.charAt(0).toUpperCase() + subtitle.slice(1), 14, 33);
    doc.setDrawColor(220, 220, 220);
    doc.line(14, 37, 196, 37);

    let y = 44;

    if (mode === 'operario') {
      byOperario.forEach(op => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text(`${op.name} — ${op.total.toFixed(2)} h`, 14, y);
        y += 6;

        const rows = op.fichajes.map(f => [
          f.date ? format(parseISO(f.date), 'dd/MM/yyyy') : '',
          f.hora_entrada || '',
          f.hora_salida || '',
          (f.pausa_inicio && f.pausa_fin) ? `${f.pausa_inicio}-${f.pausa_fin}` : '—',
          f.project || '—',
          (f.horas_trabajadas || 0).toFixed(2) + ' h',
        ]);

        doc.autoTable({
          head: [['Fecha', 'Entrada', 'Salida', 'Pausa', 'Obra', 'Horas']],
          body: rows,
          startY: y,
          theme: 'striped',
          headStyles: { fillColor: [249, 115, 22], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 10;
      });
    } else if (mode === 'semana') {
      Object.entries(byWeek).sort().forEach(([week, wf]) => {
        if (y > 250) { doc.addPage(); y = 20; }
        const wTotal = wf.reduce((s, f) => s + (f.horas_trabajadas || 0), 0);
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text(`${week} — ${wTotal.toFixed(2)} h`, 14, y);
        y += 6;

        const rows = wf.sort((a, b) => a.date > b.date ? 1 : -1).map(f => [
          f.date ? format(parseISO(f.date), 'dd/MM/yyyy EEE', { locale: es }) : '',
          f.operario_name,
          f.hora_entrada || '',
          f.hora_salida || '',
          f.project || '—',
          (f.horas_trabajadas || 0).toFixed(2) + ' h',
        ]);
        doc.autoTable({
          head: [['Fecha', 'Operario', 'Entrada', 'Salida', 'Obra', 'Horas']],
          body: rows,
          startY: y,
          theme: 'striped',
          headStyles: { fillColor: [249, 115, 22], fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 10;
      });
    } else {
      // Monthly
      const rows = filtered
        .sort((a, b) => a.date > b.date ? 1 : -1)
        .map(f => [
          f.date ? format(parseISO(f.date), 'dd/MM/yyyy') : '',
          f.operario_name,
          f.hora_entrada || '',
          f.hora_salida || '',
          (f.pausa_inicio && f.pausa_fin) ? `${f.pausa_inicio}-${f.pausa_fin}` : '—',
          f.project || '—',
          (f.horas_trabajadas || 0).toFixed(2) + ' h',
        ]);

      doc.autoTable({
        head: [['Fecha', 'Operario', 'Entrada', 'Salida', 'Pausa', 'Obra', 'Horas']],
        body: rows,
        startY: y,
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 6;

      // Totals by operario
      doc.setFontSize(10);
      doc.text('Resumen por operario:', 14, y + 4);
      y += 10;
      const sumRows = byOperario.map(op => [op.name, op.fichajes.length + ' días', op.total.toFixed(2) + ' h']);
      doc.autoTable({
        head: [['Operario', 'Días', 'Total Horas']],
        body: sumRows,
        startY: y,
        theme: 'grid',
        headStyles: { fillColor: [100, 100, 100], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer total
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Total: ${totalHoras.toFixed(2)} h | Generado ${format(new Date(), 'dd/MM/yyyy HH:mm')} | Página ${i}/${pageCount}`, 14, 290);
    }

    const fname = `informe-horario-${monthFilter || 'todos'}-${mode}.pdf`;
    doc.save(fname);
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Por Mes</SelectItem>
            <SelectItem value="semana">Por Semana</SelectItem>
            <SelectItem value="operario">Por Operario</SelectItem>
          </SelectContent>
        </Select>
        <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="w-full sm:w-40" />
        <Select value={opFilter} onValueChange={setOpFilter}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Operario" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los operarios</SelectItem>
            {operarios.map(op => <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={generatePDF} className="gap-2 shrink-0 bg-primary">
          <Download className="w-4 h-4" /> Descargar PDF
        </Button>
      </div>

      {/* Summary cards */}
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

      {/* By Operario view */}
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
                    <span className="text-muted-foreground capitalize">{f.date ? format(parseISO(f.date), 'EEE dd/MM', { locale: es }) : '--'}</span>
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

      {/* By Week view */}
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

      {/* By Month view */}
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