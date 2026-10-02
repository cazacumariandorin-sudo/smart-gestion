import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useUserRole } from '@/lib/useUserRole';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import ImageLightbox from '@/components/ui/ImageLightbox';
import { useQuery } from '@tanstack/react-query';
import {
  Edit3, Download, Lock, Unlock, Archive, Power, Trash2, X, Camera, Package, Clock, FileSignature, ChevronLeft, Sparkles
} from 'lucide-react';
import ParteDiarioForm from './ParteDiarioForm';
import SimantecLogo from '@/components/SimantecLogo';
import { drawSimantecLogoPdf } from '@/lib/simantecLogoPdf';

export default function ParteDiarioDetail({ parte, onClose }) {
  const { user } = useAuth();
  const { isGerencia, isAdmin } = useUserRole();
  const qc = useQueryClient();
  const [mode, setMode] = useState('view');
  const [viewerImg, setViewerImg] = useState(null);

  const esGerente = isGerencia || isAdmin;
  const cerrado = parte.estado === 'cerrado';

  const { data: extrasDelParte = [] } = useQuery({
    queryKey: ['trabajos-extras-parte', parte.id],
    queryFn: () => base44.entities.TrabajoExtraObra.filter({ parte_id: parte.id }, '-fecha_solicitud', 50),
    enabled: !!parte.id,
  });
  const { data: materialDelParte = [] } = useQuery({
    queryKey: ['material-pendiente-parte', parte.id],
    queryFn: () => base44.entities.MaterialPendiente.filter({ parte_id: parte.id }, '-fecha_solicitud', 10),
    enabled: !!parte.id,
  });
  const inactivo = parte.activo === false;
  const isOwner = parte.tecnico_id === user?.id || parte.created_by_id === user?.id;
  const podeEditar = !cerrado && (esGerente || isOwner);

  const done = () => {
    qc.invalidateQueries({ queryKey: ['partes-diarios'] });
    onClose();
  };

  const cerrarM = useMutation({
    mutationFn: () => base44.entities.ParteDiarioObra.update(parte.id, {
      estado: 'cerrado', cerrado_por: user?.email, fecha_cierre: new Date().toISOString(),
    }),
    onSuccess: done,
  });
  const reabrirM = useMutation({
    mutationFn: () => base44.entities.ParteDiarioObra.update(parte.id, {
      estado: 'borrador', cerrado_por: null, fecha_cierre: null,
    }),
    onSuccess: done,
  });
  const archivarM = useMutation({
    mutationFn: () => base44.entities.ParteDiarioObra.update(parte.id, { activo: false }),
    onSuccess: done,
  });
  const reactivarM = useMutation({
    mutationFn: () => base44.entities.ParteDiarioObra.update(parte.id, { activo: true }),
    onSuccess: done,
  });
  const borrarM = useMutation({
    mutationFn: () => base44.entities.ParteDiarioObra.delete(parte.id),
    onSuccess: done,
  });

  const exportarPDF = () => {
    const doc = new jsPDF();
    const margin = 14;
    let y = 12;
    // Logotipo corporativo SIMANTEC
    const logoH = drawSimantecLogoPdf(doc, margin, y, 16);
    y = 12 + logoH + 2;
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text('PARTE DIARIO DE OBRA', margin, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${parte.fecha || '-'}`, margin, y); y += 6;
    doc.text(`Obra: ${parte.obra_name || '-'}`, margin, y); y += 6;
    doc.text(`Tecnico: ${parte.tecnico_name || '-'}`, margin, y); y += 6;
    if (parte.tecnicos_adicionales?.length) {
      const ad = doc.splitTextToSize(`Adicionales: ${parte.tecnicos_adicionales.map(t => t.operario_name).join(', ')}`, 180);
      ad.forEach(l => { doc.text(l, margin, y); y += 5; });
    }
    doc.text(`Estado: ${parte.estado || 'borrador'}${cerrado && parte.cerrado_por ? ` (cerrado por ${parte.cerrado_por})` : ''}`, margin, y); y += 10;

    const section = (title, body) => {
      if (!body) return;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(title, margin, y); y += 6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const lines = doc.splitTextToSize(body, 180);
      lines.forEach(l => { doc.text(l, margin, y); y += 5; });
      y += 4;
    };
    section('Trabajos realizados', parte.trabajos_realizados);
    section('Materiales', parte.materiales_necesarios);
    section('Pendientes', parte.trabajos_pendientes);

    if (parte.fotos?.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(`Fotos (${parte.fotos.length})`, margin, y); y += 6;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      parte.fotos.forEach((f, i) => {
        const lines = doc.splitTextToSize(`${i + 1}. ${f.url}`, 180);
        lines.forEach(l => { doc.text(l, margin, y); y += 5; });
      });
      y += 4;
    }

    if (parte.firma_url) {
      try {
        doc.addImage(parte.firma_url, 'PNG', margin, y, 60, 24);
        y += 28;
        doc.setFontSize(9);
        doc.text(`Firmado por: ${parte.firmado_por || ''}${parte.fecha_firma ? ' · ' + format(new Date(parte.fecha_firma), 'dd/MM/yyyy HH:mm') : ''}`, margin, y);
      } catch { /* noop */ }
    }

    doc.save(`parte-${parte.fecha || parte.id}.pdf`);
  };

  if (mode === 'edit') {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4 cursor-pointer" onClick={() => setMode('view')} />
              Editar Parte Diario
            </DialogTitle>
          </DialogHeader>
          <ParteDiarioForm editing={parte} onSuccess={done} onCancel={() => setMode('view')} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center flex-wrap gap-2 pr-8">
            <SimantecLogo variant="icon" size={26} />
            <span className="truncate">Parte Diario — {parte.obra_name}</span>
            {cerrado && <Badge className="bg-blue-100 text-blue-700 border-blue-200">Cerrado</Badge>}
            {inactivo && <Badge className="bg-amber-100 text-amber-700 border-amber-200">Inactivo</Badge>}
            {parte.firma_url && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                <FileSignature className="w-3 h-3" />Firmado
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>📅 {format(new Date(parte.fecha), 'dd MMM yyyy', { locale: es })}</span>
            <span>👤 {parte.tecnico_name}</span>
            {parte.tecnicos_adicionales?.length > 0 && (
              <span>👥 +{parte.tecnicos_adicionales.map(t => t.operario_name).join(', ')}</span>
            )}
          </div>

          <div>
            <p className="font-medium mb-0.5">Trabajos realizados</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{parte.trabajos_realizados || '—'}</p>
          </div>

          {parte.materiales_necesarios && (
            <div>
              <p className="font-medium mb-0.5 flex items-center gap-1"><Package className="w-3.5 h-3.5" />Materiales</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{parte.materiales_necesarios}</p>
            </div>
          )}

          {parte.trabajos_pendientes && (
            <div>
              <p className="font-medium mb-0.5 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Pendientes</p>
              <p className="text-amber-600 whitespace-pre-wrap">{parte.trabajos_pendientes}</p>
            </div>
          )}

          {extrasDelParte.length > 0 && (
            <div>
              <p className="font-medium mb-0.5 flex items-center gap-1 text-amber-700"><Sparkles className="w-3.5 h-3.5" />Trabajos extras ({extrasDelParte.length})</p>
              <ul className="space-y-0.5">
                {extrasDelParte.map((e) => (
                  <li key={e.id} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="whitespace-pre-wrap flex-1">{e.descripcion}</span>
                    <Badge variant={e.estado === 'facturado' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                      {e.estado}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {materialDelParte.length > 0 && (
            <div>
              <p className="font-medium mb-0.5 flex items-center gap-1"><Package className="w-3.5 h-3.5" />Material pendiente</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground whitespace-pre-wrap flex-1 min-w-0">{materialDelParte[0].descripcion}</span>
                <Badge variant="secondary" className="text-[10px] shrink-0">{materialDelParte[0].estado}</Badge>
              </div>
            </div>
          )}

          {parte.fotos?.length > 0 && (
            <div>
              <p className="font-medium mb-1 flex items-center gap-1"><Camera className="w-3.5 h-3.5" />Fotos ({parte.fotos.length})</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {parte.fotos.map((f, i) => (
                  <button key={i} onClick={() => setViewerImg(f.url)} className="aspect-square rounded-lg overflow-hidden bg-muted">
                    <img src={f.url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {parte.firma_url && (
            <div>
              <p className="font-medium mb-1 flex items-center gap-1"><FileSignature className="w-3.5 h-3.5" />Firma</p>
              <img src={parte.firma_url} alt="Firma" className="border border-border rounded-lg bg-white max-h-24" />
              {parte.firmado_por && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Firmado por {parte.firmado_por}
                  {parte.fecha_firma && ` · ${format(new Date(parte.fecha_firma), 'dd/MM/yyyy HH:mm')}`}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-3 border-t">
          <Button variant="outline" size="sm" onClick={exportarPDF} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>
          {podeEditar && (
            <Button variant="outline" size="sm" onClick={() => setMode('edit')} className="gap-1.5">
              <Edit3 className="w-3.5 h-3.5" /> Editar
            </Button>
          )}
          {!cerrado && podeEditar && (
            <Button variant="outline" size="sm" onClick={() => cerrarM.mutate()} disabled={cerrarM.isPending} className="gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Cerrar
            </Button>
          )}
          {cerrado && esGerente && (
            <Button variant="outline" size="sm" onClick={() => reabrirM.mutate()} disabled={reabrirM.isPending} className="gap-1.5 text-amber-600">
              <Unlock className="w-3.5 h-3.5" /> Reabrir
            </Button>
          )}
          {esGerente && !inactivo && (
            <Button variant="outline" size="sm" onClick={() => archivarM.mutate()} disabled={archivarM.isPending} className="gap-1.5 text-amber-600">
              <Archive className="w-3.5 h-3.5" /> Archivar
            </Button>
          )}
          {esGerente && inactivo && (
            <Button variant="outline" size="sm" onClick={() => reactivarM.mutate()} disabled={reactivarM.isPending} className="gap-1.5 text-emerald-600">
              <Power className="w-3.5 h-3.5" /> Reactivar
            </Button>
          )}
          {esGerente && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive ml-auto">
                  <Trash2 className="w-3.5 h-3.5" /> Borrar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Borrar parte definitivamente?</AlertDialogTitle>
                  <AlertDialogDescription>Esta acción no se puede deshacer. El parte y sus metadatos se eliminarán permanentemente.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => borrarM.mutate()} className="bg-destructive text-destructive-foreground">Borrar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {viewerImg && (
          <ImageLightbox url={viewerImg} nombre="Foto del parte" onClose={() => setViewerImg(null)} />
        )}
      </DialogContent>
    </Dialog>
  );
}