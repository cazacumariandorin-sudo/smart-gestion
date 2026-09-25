import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Card } from '@/components/ui/card';
import { Download, FileSpreadsheet, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, format } from 'date-fns';
import * as XLSX from 'xlsx';
import { calcularCiclo } from '@/components/gastos/BannerCicloActivo';

export default function InformeGastos({ operario, notas = [], tecnicos = [], isAdmin, isGerencia, ciclosDisponibles = [], cicloSeleccionado, operarioSeleccionado }) {
  const [periodo, setPeriodo] = useState('mes');
  const [fechaRef, setFechaRef] = useState(format(new Date(), 'yyyy-MM'));
  const [cicloRef, setCicloRef] = useState(ciclosDisponibles[0] || '');
  const [operarioSel, setOperarioSel] = useState('todos');
  const [loadingPdf, setLoadingPdf] = useState(false);

  const puedeSeleccionarOperario = isAdmin || isGerencia;

  // Sincroniza el ciclo seleccionado en la página con el filtro del informe:
  // al cambiar el ciclo arriba, el informe pasa a modo "ciclo" y usa ese ciclo.
  useEffect(() => {
    if (cicloSeleccionado && cicloSeleccionado !== 'todos') {
      setCicloRef(cicloSeleccionado);
      setPeriodo('ciclo');
    }
  }, [cicloSeleccionado]);

  // Sincroniza el operario seleccionado en la página (chips de técnico)
  useEffect(() => {
    if (operarioSeleccionado !== undefined && operarioSeleccionado !== null) {
      setOperarioSel(operarioSeleccionado);
    }
  }, [operarioSeleccionado]);

  // Garantiza cicloRef válido al cambiar disponibilidad
  useEffect(() => {
    if (periodo === 'ciclo' && !ciclosDisponibles.includes(cicloRef)) {
      setCicloRef(ciclosDisponibles[0] || '');
    }
  }, [ciclosDisponibles, cicloRef, periodo]);

  const calcularRango = () => {
    const hoy = new Date();
    if (periodo === 'mes') {
      const [y, m] = fechaRef.split('-').map(Number);
      const base = new Date(y, m - 1, 1);
      return { inicio: format(startOfMonth(base), 'yyyy-MM-dd'), fin: format(endOfMonth(base), 'yyyy-MM-dd'), label: `Mes ${fechaRef}`, ciclo_mes: null };
    }
    if (periodo === 'semana') {
      return { inicio: format(startOfWeek(hoy, { weekStartsOn: 1 }), 'yyyy-MM-dd'), fin: format(endOfWeek(hoy, { weekStartsOn: 1 }), 'yyyy-MM-dd'), label: 'Semana actual', ciclo_mes: null };
    }
    if (periodo === 'anual') {
      return { inicio: format(startOfYear(hoy), 'yyyy-MM-dd'), fin: format(endOfYear(hoy), 'yyyy-MM-dd'), label: `Año ${hoy.getFullYear()}`, ciclo_mes: null };
    }
    if (periodo === 'ciclo' && cicloRef) {
      const { apertura, cierre } = calcularCiclo(new Date(cicloRef + '-15'));
      return { inicio: format(apertura, 'yyyy-MM-dd'), fin: format(cierre, 'yyyy-MM-dd'), label: `Ciclo ${cicloRef}`, ciclo_mes: cicloRef };
    }
    return { inicio: '', fin: '', label: '', ciclo_mes: null };
  };

  const { inicio, fin, label, ciclo_mes } = calcularRango();

  // Adelantos del periodo/operario seleccionado
  const { data: adelantosRaw = [] } = useQuery({
    queryKey: ['adelantos_informe', operarioSel, inicio, fin, ciclo_mes],
    queryFn: () => base44.entities.Adelanto.list('-created_date', 500),
  });

  const cicloDeFecha = (r) => {
    const ref = r.fecha_entrega || r.created_date || '';
    if (!ref) return null;
    const d = new Date(ref);
    if (isNaN(d.getTime())) return null;
    return calcularCiclo(d).cicloMes;
  };

  const adelantosFiltrados = useMemo(() => {
    return adelantosRaw.filter(a => {
      if (a.tipo !== 'gastos') return false;
      if (['anulado', 'pendiente_entrega'].includes(a.estado)) return false;
      if (operarioSel !== 'todos' && a.operario_id !== operarioSel) return false;
      if (ciclo_mes) {
        return (a.ciclo_mes || cicloDeFecha(a)) === ciclo_mes;
      }
      // por rango de fechas (fecha_entrega)
      const f = a.fecha_entrega || '';
      return f >= inicio && f <= fin;
    });
  }, [adelantosRaw, operarioSel, ciclo_mes, inicio, fin]);

  const totalAdelantos = adelantosFiltrados.reduce((s, a) => s + (a.importe || 0), 0);

  // Notas filtradas por operario + periodo/ciclo
  const notasFiltradas = useMemo(() => {
    return notas.filter(n => {
      if (operarioSel !== 'todos' && n.operario_id !== operarioSel) return false;
      if (ciclo_mes) {
        return (n.ciclo_mes || (() => {
          const ref = n.fecha_documento || n.fecha_creacion_real || '';
          if (!ref) return null;
          const d = new Date(ref);
          if (isNaN(d.getTime())) return null;
          return calcularCiclo(d).cicloMes;
        })()) === ciclo_mes;
      }
      const f = n.fecha_documento || n.fecha_creacion_real || '';
      return f >= inicio && f <= fin;
    });
  }, [notas, operarioSel, ciclo_mes, inicio, fin]);

  const totalGeneral = notasFiltradas.reduce((s, n) => s + (n.importe || 0), 0);
  const netoLiquidar = totalGeneral - totalAdelantos;

  const totalesCat = ['material', 'combustible', 'peaje', 'parking', 'otros'].map(cat => ({
    cat,
    total: notasFiltradas.filter(n => n.categoria === cat).reduce((s, n) => s + (n.importe || 0), 0),
    count: notasFiltradas.filter(n => n.categoria === cat).length,
  }));

  const nombreOperario = operarioSel === 'todos'
    ? 'Todos'
    : (tecnicos.find(t => t.id === operarioSel)?.name || 'Operario');

  const handleDescargarPDF = async () => {
    setLoadingPdf(true);
    try {
      const response = await base44.functions.invoke('exportarNotasGastosPDF', {
        operario_id: operarioSel === 'todos' ? null : operarioSel,
        operario_name: nombreOperario,
        periodo: label,
        fecha_inicio: inicio,
        fecha_fin: fin,
        ciclo_mes: ciclo_mes,
        total_adelantos: totalAdelantos,
        importe_neto: netoLiquidar,
        adelantos_detalle: adelantosFiltrados.map(a => ({
          fecha: a.fecha_entrega || '',
          concepto: a.concepto || '',
          importe: a.importe || 0,
          estado: a.estado || '',
        })),
      }, { responseType: 'arraybuffer' });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gastos-${nombreOperario}-${label.replace(/\s/g, '-')}.pdf`;
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
      'Nº Factura': n.numero_factura || '',
      'Localidad': n.localidad || '',
      'Forma de Pago': n.forma_pago_documento || '',
      'Importe (€)': n.importe || 0,
      'Obra': n.obra_name || '',
      'Estado': n.estado || '',
      'Tardío': n.es_gasto_tardio ? 'Sí' : 'No',
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros de Gasto');

    // Hoja resumen con adelantos (trazabilidad contable)
    const resumen = [
      ['Período', label],
      ['Operario', nombreOperario],
      [],
      ['Total registros', notasFiltradas.length],
      ['TOTAL GASTOS', totalGeneral.toFixed(2) + ' €'],
      ['Adelantos de gastos', totalAdelantos.toFixed(2) + ' €'],
      ['NETO A LIQUIDAR', netoLiquidar.toFixed(2) + ' €'],
      [],
      ['Categoría', 'Total €', 'Nº Registros'],
      ...totalesCat.map(t => [t.cat, t.total.toFixed(2), t.count]),
      [],
      ['Adelantos — trazabilidad contable'],
      ['Fecha', 'Concepto', 'Importe €', 'Estado'],
      ...adelantosFiltrados.map(a => [a.fecha_entrega || '', a.concepto || '', (a.importe || 0).toFixed(2), a.estado || '']),
    ];
    const wsR = XLSX.utils.aoa_to_sheet(resumen);
    XLSX.utils.book_append_sheet(wb, wsR, 'Resumen');

    XLSX.writeFile(wb, `gastos-${nombreOperario}-${label.replace(/\s/g, '-')}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        {puedeSeleccionarOperario && (
          <div className="space-y-1">
            <Label className="text-xs">Operario</Label>
            <MobileSelect value={operarioSel} onValueChange={setOperarioSel} placeholder="Operario" triggerClassName="w-48">
              <MobileSelectItem value="todos">Todos los operarios</MobileSelectItem>
              {tecnicos.filter(op => op.active !== false).map(op => (
                <MobileSelectItem key={op.id} value={op.id}>{op.name}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Período</Label>
          <MobileSelect value={periodo} onValueChange={setPeriodo} placeholder="Período" triggerClassName="w-36">
            <MobileSelectItem value="semana">Semana actual</MobileSelectItem>
            <MobileSelectItem value="mes">Por mes</MobileSelectItem>
            <MobileSelectItem value="ciclo">Por ciclo</MobileSelectItem>
            <MobileSelectItem value="anual">Anual</MobileSelectItem>
          </MobileSelect>
        </div>
        {periodo === 'mes' && (
          <div className="space-y-1">
            <Label className="text-xs">Mes</Label>
            <Input type="month" value={fechaRef} onChange={e => setFechaRef(e.target.value)} className="w-40" />
          </div>
        )}
        {periodo === 'ciclo' && (
          <div className="space-y-1">
            <Label className="text-xs">Ciclo</Label>
            <MobileSelect value={cicloRef} onValueChange={setCicloRef} placeholder="Ciclo" triggerClassName="w-40">
              {ciclosDisponibles.map(c => (
                <MobileSelectItem key={c} value={c}>{c}</MobileSelectItem>
              ))}
            </MobileSelect>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={handleDescargarExcel} className="gap-1.5" disabled={notasFiltradas.length === 0 && adelantosFiltrados.length === 0}>
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
            <p className="text-xs text-muted-foreground">{t.count} reg.</p>
          </Card>
        ))}
        {totalAdelantos > 0 && (
          <Card className="p-3 border-amber-300/60 bg-amber-50/50">
            <p className="text-xs text-amber-700 font-semibold flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" /> Adelantos
            </p>
            <p className="font-bold text-base text-amber-700">{totalAdelantos.toFixed(2)} €</p>
            <p className="text-xs text-muted-foreground">{adelantosFiltrados.length} adelanto{adelantosFiltrados.length !== 1 ? 's' : ''}</p>
          </Card>
        )}
        <Card className="p-3 border-primary/30 bg-primary/5">
          <p className="text-xs font-semibold text-primary">TOTAL {label}</p>
          <p className="font-bold text-xl text-primary">{totalGeneral.toFixed(2)} €</p>
          <p className="text-xs text-muted-foreground">{notasFiltradas.length} registros</p>
          {totalAdelantos > 0 && (
            <p className="text-xs font-semibold text-amber-700 mt-1">
              Neto a liquidar: {netoLiquidar.toFixed(2)} €
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}