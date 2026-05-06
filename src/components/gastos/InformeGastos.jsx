import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Card } from '@/components/ui/card';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, format } from 'date-fns';
import * as XLSX from 'xlsx';

export default function InformeGastos({ operario, notas = [], isAdmin }) {
  const [periodo, setPeriodo] = useState('mes');
  const [fechaRef, setFechaRef] = useState(format(new Date(), 'yyyy-MM'));
  const [loadingPdf, setLoadingPdf] = useState(false);

  const calcularRango = () => {
    const hoy = new Date();
    if (periodo === 'mes') {
      const [y, m] = fechaRef.split('-').map(Number);
      const base = new Date(y, m - 1, 1);
      return { inicio: format(startOfMonth(base), 'yyyy-MM-dd'), fin: format(endOfMonth(base), 'yyyy-MM-dd'), label: `Mes ${fechaRef}` };
    }
    if (periodo === 'semana') {
      return { inicio: format(startOfWeek(hoy, { weekStartsOn: 1 }), 'yyyy-MM-dd'), fin: format(endOfWeek(hoy, { weekStartsOn: 1 }), 'yyyy-MM-dd'), label: 'Semana actual' };
    }
    if (periodo === 'anual') {
      return { inicio: format(startOfYear(hoy), 'yyyy-MM-dd'), fin: format(endOfYear(hoy), 'yyyy-MM-dd'), label: `Año ${hoy.getFullYear()}` };
    }
    return { inicio: '', fin: '', label: '' };
  };

  const { inicio, fin, label } = calcularRango();

  const notasFiltradas = notas.filter(n => {
    const f = n.fecha_documento || n.fecha_creacion_real || '';
    return f >= inicio && f <= fin;
  });

  const totalGeneral = notasFiltradas.reduce((s, n) => s + (n.importe || 0), 0);

  const totalesCat = ['material', 'combustible', 'peaje', 'parking', 'otros'].map(cat => ({
    cat,
    total: notasFiltradas.filter(n => n.categoria === cat).reduce((s, n) => s + (n.importe || 0), 0),
    count: notasFiltradas.filter(n => n.categoria === cat).length,
  }));

  const handleDescargarPDF = async () => {
    setLoadingPdf(true);
    try {
      const response = await base44.functions.invoke('exportarNotasGastosPDF', {
        operario_id: operario?.id,
        operario_name: operario?.name || operario?.full_name,
        periodo: label,
        fecha_inicio: inicio,
        fecha_fin: fin,
      }, { responseType: 'arraybuffer' });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gastos-${operario?.name || 'todos'}-${label.replace(/\s/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('Error al generar PDF: ' + e.message);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleDescargarExcel = () => {
    const datos = notasFiltradas.map(n => ({
      'Número Nota': n.numero_nota || '',
      'Operario': n.operario_name || '',
      'Fecha Documento': n.fecha_documento || '',
      'Fecha Creación': n.fecha_creacion_real || '',
      'Categoría': n.categoria || '',
      'Concepto': n.concepto || '',
      'Comercio': n.nombre_comercio || '',
      'NIF/CIF': n.nif_comercio || '',
      'Importe (€)': n.importe || 0,
      'Obra': n.obra_name || '',
      'Estado': n.estado || '',
      'Tardío': n.es_gasto_tardio ? 'Sí' : 'No',
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Notas de Gastos');

    // Hoja resumen
    const resumen = [
      ['Período', label],
      ['Operario', operario?.name || operario?.full_name || 'Todos'],
      ['Total registros', notasFiltradas.length],
      ['TOTAL', totalGeneral.toFixed(2) + ' €'],
      [],
      ['Categoría', 'Total €', 'Nº Registros'],
      ...totalesCat.map(t => [t.cat, t.total.toFixed(2), t.count]),
    ];
    const wsR = XLSX.utils.aoa_to_sheet(resumen);
    XLSX.utils.book_append_sheet(wb, wsR, 'Resumen');

    XLSX.writeFile(wb, `gastos-${operario?.name || 'todos'}-${label.replace(/\s/g, '-')}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Período</Label>
          <MobileSelect value={periodo} onValueChange={setPeriodo} placeholder="Período" triggerClassName="w-36">
            <MobileSelectItem value="semana">Semana actual</MobileSelectItem>
            <MobileSelectItem value="mes">Por mes</MobileSelectItem>
            <MobileSelectItem value="anual">Anual</MobileSelectItem>
          </MobileSelect>
        </div>
        {periodo === 'mes' && (
          <div className="space-y-1">
            <Label className="text-xs">Mes</Label>
            <Input type="month" value={fechaRef} onChange={e => setFechaRef(e.target.value)} className="w-40" />
          </div>
        )}
        <Button variant="outline" size="sm" onClick={handleDescargarExcel} className="gap-1.5">
          <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handleDescargarPDF} disabled={loadingPdf} className="gap-1.5">
          {loadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-red-600" />} PDF
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {totalesCat.filter(t => t.total > 0).map(t => (
          <Card key={t.cat} className="p-3">
            <p className="text-xs text-muted-foreground capitalize">{t.cat}</p>
            <p className="font-bold text-base">{t.total.toFixed(2)} €</p>
            <p className="text-xs text-muted-foreground">{t.count} nota{t.count !== 1 ? 's' : ''}</p>
          </Card>
        ))}
        <Card className="p-3 border-primary/30 bg-primary/5">
          <p className="text-xs font-semibold text-primary">TOTAL {label}</p>
          <p className="font-bold text-xl text-primary">{totalGeneral.toFixed(2)} €</p>
          <p className="text-xs text-muted-foreground">{notasFiltradas.length} notas</p>
        </Card>
      </div>
    </div>
  );
}