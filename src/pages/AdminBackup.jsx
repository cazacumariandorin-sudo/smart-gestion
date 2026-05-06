import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import { HardDrive, Download, Trash2, Loader2, Plus, RotateCcw, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminBackup() {
  const qc = useQueryClient();
  const { isAdmin } = useUserRole();
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const response = await base44.functions.invoke('exportNotasGastosPDF', {}, { responseType: 'arraybuffer' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notas-gastos-completo-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setExportingPDF(false);
    }
  };

  const { data: backups = [], isLoading, refetch } = useQuery({
    queryKey: ['backups'],
    queryFn: () => base44.entities.AppBackup.list('-snapshot_date', 50),
  });

  const deleteM = useMutation({
    mutationFn: id => base44.entities.AppBackup.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      await base44.functions.invoke('createAppBackup', {});
      await refetch();
    } finally {
      setCreatingBackup(false);
    }
  };

  const statusBadge = (status) => {
    const colors = {
      completado: 'bg-green-100 text-green-700 border-green-200',
      en_progreso: 'bg-amber-100 text-amber-700 border-amber-200',
      error: 'bg-red-100 text-red-700 border-red-200',
    };
    return <Badge className={colors[status]}>{status}</Badge>;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <HardDrive className="w-7 h-7 text-primary" /> Backups y Snapshots
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona copias de seguridad automáticas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportPDF} disabled={exportingPDF} variant="outline" className="gap-2 shadow-sm">
            {exportingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            <span className="hidden sm:inline">PDF Notas Gastos</span>
          </Button>
          <Button onClick={handleCreateBackup} disabled={creatingBackup} className="gap-2 shadow-sm">
            {creatingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="hidden sm:inline">Crear Backup</span>
          </Button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 p-4">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>✓ Automatización activa:</strong> Se ejecutan backups diarios a las 00:00 UTC. Los snapshots se guardan con resumen de datos y URL descargable.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : backups.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl">
          <HardDrive className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No hay backups aún</p>
          <Button variant="outline" size="sm" onClick={handleCreateBackup} className="gap-2">
            <Plus className="w-3.5 h-3.5" /> Crear primer backup
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {backups.map(backup => (
            <Card key={backup.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="font-semibold text-sm">
                      {format(parseISO(backup.snapshot_date), 'dd MMMM yyyy HH:mm', { locale: es })}
                    </span>
                    {statusBadge(backup.status)}
                    {backup.version && <Badge variant="outline" className="text-xs">v{backup.version}</Badge>}
                  </div>
                  {backup.data_summary && (
                    <p className="text-xs text-muted-foreground">
                      📊 {backup.data_summary.total_records} registros • {backup.data_summary.total_entities} entidades
                    </p>
                  )}
                  {backup.error_message && (
                    <p className="text-xs text-destructive mt-1">❌ {backup.error_message}</p>
                  )}
                  {backup.notes && (
                    <p className="text-xs text-muted-foreground mt-1">📝 {backup.notes}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {backup.backup_file_url && (
                    <a href={backup.backup_file_url} download>
                      <Button size="icon" variant="outline" className="h-8 w-8">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="outline" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar backup?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminará el backup del {format(parseISO(backup.snapshot_date), 'dd/MM/yyyy', { locale: es })}.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteM.mutate(backup.id)} className="bg-destructive text-destructive-foreground">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}