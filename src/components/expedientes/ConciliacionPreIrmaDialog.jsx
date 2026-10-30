import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SignatureCanvas from '@/components/workorders/SignatureCanvas';
import { FileDown, Loader2, ShieldCheck, Info } from 'lucide-react';
import {
  ACUERDOS_POR_DEFECTO, calcularFechasExpediente, textoManifiestanExpediente,
} from '@/lib/expedientesCatalogo';
import { descargarActaExpediente, generarPdfActaExpediente, nombrePdfActa } from '@/lib/expedienteActaPdf';

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Protocolo de Conciliación Interna (Pre-IRMA): redacta el acta, recoge la firma
 * de empresa y trabajador y, al firmarse ambas, archiva el expediente como
 * 'archivado_conciliado' bloqueando la reincidencia y arrancando la caducidad.
 */
export default function ConciliacionPreIrmaDialog({ open, onOpenChange, expediente, onArchivado }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lugar, setLugar] = useState('Las Rozas de Madrid');
  const [fecha, setFecha] = useState(hoy());
  const [manifiestan, setManifiestan] = useState('');
  const [acuerdos, setAcuerdos] = useState(ACUERDOS_POR_DEFECTO);
  const [nombreEmpresa, setNombreEmpresa] = useState('');
  const [nombreTrabajador, setNombreTrabajador] = useState('');
  const [firmaEmpresa, setFirmaEmpresa] = useState('');
  const [firmaTrabajador, setFirmaTrabajador] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);

  useEffect(() => {
    if (!open || !expediente) return;
    setLugar(expediente.acta_lugar || 'Las Rozas de Madrid');
    setFecha(expediente.acta_fecha || hoy());
    setManifiestan(expediente.acta_manifiestan || textoManifiestanExpediente(expediente));
    setAcuerdos(expediente.acta_acuerdos?.length ? expediente.acta_acuerdos : ACUERDOS_POR_DEFECTO);
    setNombreEmpresa(expediente.firma_empresa_nombre || user?.full_name || '');
    setNombreTrabajador(expediente.firma_trabajador_nombre || expediente.operario_name || '');
    setFirmaEmpresa(expediente.firma_empresa || '');
    setFirmaTrabajador(expediente.firma_trabajador || '');
  }, [open, expediente, user]);

  const borrador = {
    ...expediente,
    acta_lugar: lugar,
    acta_fecha: fecha,
    acta_manifiestan: manifiestan,
    acta_acuerdos: acuerdos,
    firma_empresa_nombre: nombreEmpresa,
    firma_trabajador_nombre: nombreTrabajador,
    firma_empresa: firmaEmpresa,
    firma_trabajador: firmaTrabajador,
    firma_empresa_fecha: new Date().toISOString(),
    firma_trabajador_fecha: new Date().toISOString(),
  };

  const verActa = async () => {
    setGenerando(true);
    try { await descargarActaExpediente(borrador); } finally { setGenerando(false); }
  };

  const firmarYArchivar = async () => {
    if (!expediente || !firmaEmpresa || !firmaTrabajador || !nombreEmpresa || !nombreTrabajador) return;
    setGuardando(true);
    try {
      const ahora = new Date().toISOString();
      const plazos = calcularFechasExpediente({ tipo_falta: expediente.tipo_falta, fecha_archivo: ahora });
      const doc = await generarPdfActaExpediente(borrador);
      let pdfUri = '';
      try {
        const file = new File([doc.output('blob')], nombrePdfActa(expediente), { type: 'application/pdf' });
        const subido = await base44.integrations.Core.UploadPrivateFile({ file });
        pdfUri = subido?.file_uri || '';
      } catch {
        pdfUri = '';
      }

      const historial = [
        ...(expediente.historial || []),
        {
          fecha: ahora,
          usuario_email: user?.email || '',
          accion: 'Acta de conciliación firmada por ambas partes',
          estado_anterior: expediente.estado,
          estado_nuevo: 'archivado_conciliado',
          nota: `Caducidad del antecedente: ${plazos.fecha_caducidad}`,
        },
      ];

      await base44.entities.Expediente.update(expediente.id, {
        estado: 'archivado_conciliado',
        acta_lugar: lugar,
        acta_fecha: fecha,
        acta_manifiestan: manifiestan,
        acta_acuerdos: acuerdos,
        acta_pdf_url: pdfUri,
        firma_empresa: firmaEmpresa,
        firma_empresa_nombre: nombreEmpresa,
        firma_empresa_email: user?.email || '',
        firma_empresa_fecha: ahora,
        firma_trabajador: firmaTrabajador,
        firma_trabajador_nombre: nombreTrabajador,
        firma_trabajador_fecha: ahora,
        fecha_archivo: ahora,
        caducidad_meses: plazos.caducidad_meses,
        fecha_caducidad: plazos.fecha_caducidad,
        bloquea_reincidencia: true,
        archivado_por: user?.email || '',
        historial,
      });

      doc.save(nombrePdfActa(expediente));
      queryClient.invalidateQueries({ queryKey: ['expedientes'] });
      queryClient.invalidateQueries({ queryKey: ['expedientes-kpi'] });
      onArchivado?.();
      onOpenChange(false);
    } finally {
      setGuardando(false);
    }
  };

  const completo = !!firmaEmpresa && !!firmaTrabajador && !!nombreEmpresa && !!nombreTrabajador;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conciliación interna Pre-IRMA</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-900 p-3 text-xs text-indigo-800 dark:text-indigo-300 flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Al firmar ambas partes, el expediente {expediente?.codigo} pasa a <strong>Archivado conciliado</strong>:
              deja de contar para la reincidencia y el antecedente se anonimiza al cumplirse el plazo de conservación.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Lugar</Label>
              <Input value={lugar} onChange={(e) => setLugar(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Fecha del acta</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">MANIFESTAN</Label>
            <Textarea rows={3} value={manifiestan} onChange={(e) => setManifiestan(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">ACUERDAN</Label>
            <div className="space-y-2">
              {acuerdos.map((texto, i) => (
                <Textarea
                  key={i}
                  rows={2}
                  value={texto}
                  onChange={(e) => {
                    const copia = [...acuerdos];
                    copia[i] = e.target.value;
                    setAcuerdos(copia);
                  }}
                  placeholder={`Acuerdo ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Por la empresa</Label>
              <Input
                value={nombreEmpresa}
                onChange={(e) => setNombreEmpresa(e.target.value)}
                placeholder="Nombre y cargo"
              />
              <SignatureCanvas label="Firma empresa" value={firmaEmpresa} onChange={setFirmaEmpresa} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Trabajador</Label>
              <Input
                value={nombreTrabajador}
                onChange={(e) => setNombreTrabajador(e.target.value)}
                placeholder="Nombre del trabajador"
              />
              <SignatureCanvas label="Firma trabajador" value={firmaTrabajador} onChange={setFirmaTrabajador} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={verActa} disabled={generando}>
            {generando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Ver acta
          </Button>
          <Button onClick={firmarYArchivar} disabled={!completo || guardando}>
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Firmar y archivar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}