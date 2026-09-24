import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, ExternalLink, Loader2, FileText, CheckCircle2, FileClock, Lock, Unlock, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useUserRole } from '@/lib/useUserRole';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import AdelantoParcialDialog from '@/components/gastos/AdelantoParcialDialog';
import CicloDetalleDialog from '@/components/gastos/CicloDetalleDialog';
import { aplicarConciliacionCierre } from '@/lib/adelantosConciliacion';

const ESTADO_LABELS = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aprobada: 'Aprobada',
  en_contabilidad: 'En contabilidad',
  pagada: 'Pagada',
  rechazada: 'Rechazada',
};

const ESTADO_COLORS = {
  borrador: 'bg-slate-100 text-slate-700 border-slate-200',
  enviada: 'bg-blue-50 text-blue-700 border-blue-200',
  aprobada: 'bg-amber-50 text-amber-700 border-amber-200',
  en_contabilidad: 'bg-purple-50 text-purple-700 border-purple-200',
  pagada: 'bg-green-50 text-green-700 border-green-200',
  rechazada: 'bg-red-50 text-red-700 border-red-200',
};

export default function CicloCard({ nota, onExported }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { isAdmin, isGerencia, isAdministracion, role } = useUserRole();
  // Pago (cerrar/reabrir ciclo): admin, gerencia, administración
  const canManage = isAdmin || isGerencia || isAdministracion;
  // Exportación a contabilidad: amplía a administración, director_comercial y contabilidad
  const canExport = isAdmin || isGerencia || isAdministracion || role === 'director_comercial' || role === 'contabilidad';
  const [exporting, setExporting] = useState(false);
  const [showAdelanto, setShowAdelanto] = useState(false);
  const [showDetalle, setShowDetalle] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);

  const yaExportada = nota.estado === 'en_contabilidad' && !!nota.export_contabilidad_url;
  const sinRegistros = (nota.total_registros || 0) === 0;
  const estaCerrada = nota.estado === 'pagada';

  const recalcYCerrar = async () => {
    setCerrando(true);
    try {
      const c = await aplicarConciliacionCierre(nota, user, { estado: 'pagada' });
      toast({
        title: 'Ciclo cerrado',
        description: `${nota.numero_ciclo || nota.ciclo_mes} · Gastos ${c.total_gastos.toFixed(2)} € − Adelantos ${c.total_adelantos_gastos.toFixed(2)} € = Neto ${c.importe_neto_liquidar.toFixed(2)} €${c.es_historico_adelanto ? ' (histórico, no recalculado)' : ''}`,
      });
      qc.invalidateQueries({ queryKey: ['nota_mensual_gasto'] });
      qc.invalidateQueries({ queryKey: ['adelantos'] });
    } catch (e) {
      toast({ title: 'No se pudo cerrar el ciclo', description: e.message, variant: 'destructive' });
    } finally {
      setCerrando(false);
    }
  };

  const reabrirCiclo = async () => {
    setReabriendo(true);
    try {
      await base44.entities.NotaMensualGasto.update(nota.id, {
        estado: 'en_contabilidad',
        fecha_cierre: null,
        pagado_por: null,
        fecha_pago: null,
      });
      toast({
        title: 'Ciclo reabierto',
        description: 'Ahora puedes añadir el justificante tardío y volver a cerrarlo.',
      });
      qc.invalidateQueries({ queryKey: ['nota_mensual_gasto'] });
    } catch (e) {
      toast({ title: 'No se pudo reabrir el ciclo', description: e.message, variant: 'destructive' });
    } finally {
      setReabriendo(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('exportarCicloContabilidad', { nota_mensual_id: nota.id });
      const data = res?.data?.success ? res.data : res?.data;
      if (!data || data.success === false) {
        throw new Error(data?.error || 'Exportación fallida');
      }
      toast({
        title: 'Ciclo exportado a contabilidad',
        description: `PDF + índice subido a Drive (${data.registros || 0} registros, ${((data.total || 0)).toFixed(2)} €).`,
      });
      if (typeof onExported === 'function') onExported(nota.id, data);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Error al exportar el ciclo';
      toast({ title: 'No se pudo exportar el ciclo', description: msg, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const abrirExport = () => {
    if (nota.export_contabilidad_url) window.open(nota.export_contabilidad_url, '_blank', 'noopener');
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {nota.ciclo_mes}
              </span>
              <Badge variant="outline" className={`text-xs ${ESTADO_COLORS[nota.estado] || ESTADO_COLORS.borrador}`}>
                {ESTADO_LABELS[nota.estado] || nota.estado || 'Borrador'}
              </Badge>
              {yaExportada && (
                <span className="flex items-center gap-1 text-xs text-purple-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Exportado
                </span>
              )}
            </div>
            <div className="font-semibold text-sm truncate flex items-center gap-2 flex-wrap">
              {nota.operario_name || '—'}
              {nota.numero_ciclo && (
                <span className="font-mono text-xs font-semibold text-primary border border-primary/20 bg-primary/5 rounded px-1.5 py-0.5">
                  {nota.numero_ciclo}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
              <span>{nota.total_registros || 0} registro{(nota.total_registros || 0) === 1 ? '' : 's'}</span>
              <span className="font-semibold text-foreground">{(nota.total_importe || 0).toFixed(2)} €</span>
              {(nota.importe_adelanto || 0) > 0 && (
                <span>Adelanto {(nota.importe_adelanto || 0).toFixed(2)} €</span>
              )}
              <span className={nota.saldo_pendiente > 0 ? 'text-amber-700 font-semibold' : ''}>
                Saldo {(nota.saldo_pendiente || 0).toFixed(2)} €
              </span>
            </div>
            {sinRegistros && (
              <div className="text-xs text-muted-foreground mt-1 italic">
                Aún sin registros en este ciclo
              </div>
            )}
            {nota.fecha_apertura || nota.fecha_cierre ? (
              <div className="text-xs text-muted-foreground mt-1">
                {nota.fecha_apertura ? `Apertura ${nota.fecha_apertura}` : ''}
                {nota.fecha_cierre ? ` · Cierre ${nota.fecha_cierre}` : ''}
                {nota.fecha_export_contabilidad
                  ? ` · Exportado ${new Date(nota.fecha_export_contabilidad).toLocaleDateString('es-ES')}`
                  : ''}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowDetalle(true)}>
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Ver detalle</span>
            </Button>
            {yaExportada && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={abrirExport}>
                <ExternalLink className="w-4 h-4" /> Abrir PDF
              </Button>
            )}
            {canExport && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAdelanto(true)}>
                <FileClock className="w-4 h-4" />
                <span className="hidden sm:inline">Informe parcial</span>
              </Button>
            )}
            {canManage && !estaCerrada && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={cerrando}>
                    {cerrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    <span className="hidden sm:inline">Cerrar ciclo</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Cerrar el ciclo {nota.numero_ciclo || nota.ciclo_mes}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se procesará y cerrará el ciclo (estado: pagada) con la fecha de cierre de hoy. El operario ya no podrá añadir gastos a este ciclo salvo que gerencia/admin lo reabra.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={recalcYCerrar}>Cerrar ciclo</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canManage && estaCerrada && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 border-amber-300 text-amber-700" disabled={reabriendo}>
                    {reabriendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                    <span className="hidden sm:inline">Reabrir</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Reabrir el ciclo {nota.numero_ciclo || nota.ciclo_mes}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      El ciclo vuelve a contabilidad para añadir justificantes tardíos olvidados por el operario. Tras regularizarlo, vuelve a cerrarlo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={reabrirCiclo}>Reabrir ciclo</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canExport && (
              <Button
                variant={yaExportada ? 'secondary' : 'default'}
                size="sm"
                className="gap-1.5"
                onClick={handleExport}
                disabled={exporting || sinRegistros}
              >
                {exporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : yaExportada ? (
                  <FileText className="w-4 h-4" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4" />
                )}
                {exporting
                  ? 'Generando…'
                  : yaExportada
                    ? 'Re-exportar'
                    : 'Exportar a contabilidad'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      {showAdelanto && (
        <AdelantoParcialDialog nota={nota} open={showAdelanto} onClose={() => setShowAdelanto(false)} />
      )}

      {showDetalle && (
        <CicloDetalleDialog nota={nota} open={showDetalle} onClose={() => setShowDetalle(false)} />
      )}
    </Card>
  );
}