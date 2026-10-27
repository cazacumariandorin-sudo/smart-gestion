import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Euro, Tag, Hash, Building2, Package, FileText, Ruler, ShieldCheck, Boxes } from 'lucide-react';

const eur = (v) => (typeof v === 'number' && !isNaN(v)) ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v) : '—';

function Field({ icon: Icon, label, value }) {
  const display = value === null || value === undefined || value === '' ? '—' : String(value);
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="flex items-start gap-2 py-1.5">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-sm break-words ${empty ? 'text-muted-foreground/60 italic' : 'font-medium'}`}>{display}</p>
      </div>
    </div>
  );
}

export default function MaterialLineaDetalleDialog({ open, onClose, line, doc }) {
  if (!line) return null;
  const esComercial = doc && ['factura', 'albaran', 'ticket', 'proforma', 'pedido', 'presupuesto'].includes(doc.tipo);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-primary" />
            <span className="font-mono">{line.referencia || line.referencia_equipo || line.tag || 'Línea'}</span>
            {doc?.tipo && <Badge variant="outline" className="text-[10px]">{doc.tipo}</Badge>}
          </DialogTitle>
          <DialogDescription>
            {line.descripcion || 'Detalle completo del material registrado'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {esComercial ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Field icon={Tag} label="Referencia" value={line.referencia} />
              <Field icon={Building2} label="Fabricante" value={line.fabricante_name} />
              <Field icon={Hash} label="Cantidad facturada" value={line.cantidad_facturada} />
              <Field icon={Ruler} label="Unidad" value={line.unidad} />
              <Field icon={Euro} label="Precio unitario (neto)" value={eur(line.precio_unitario_neto)} />
              <Field icon={Euro} label="Importe neto" value={eur(line.importe_neto)} />
              <Field icon={FileText} label="Nº factura" value={line.numero_factura} />
              <Field icon={Building2} label="Proveedor NIF" value={line.proveedor_nif} />
              <Field icon={FileText} label="Fecha documento" value={line.fecha_documento} />
              <Field icon={Boxes} label="Material ID" value={line.material_id} />
              <Field icon={Building2} label="Fabricante ID" value={line.fabricante_id} />
              <Field icon={ShieldCheck} label="Estado" value={line.estado} />
              <Field icon={ShieldCheck} label="Confianza OCR" value={line.confianza} />
              <Field icon={Boxes} label="Partida pedido ID" value={line.partida_pedido_id} />
              <Field icon={Hash} label="Línea ID" value={line.linea_id} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Field icon={Tag} label="TAG" value={line.tag} />
              <Field icon={Package} label="Descripción" value={line.descripcion} />
              <Field icon={Tag} label="Referencia equipo" value={line.referencia_equipo} />
              <Field icon={Building2} label="Fabricante" value={line.fabricante_name} />
              <Field icon={Building2} label="Fabricante ID" value={line.fabricante_id} />
              <Field icon={Boxes} label="Material ID" value={line.material_id} />
              <Field icon={Hash} label="Cantidad" value={line.cantidad} />
              <Field icon={Ruler} label="Unidad" value={line.unidad} />
              <Field icon={FileText} label="Dominio" value={line.dominio} />
              <Field icon={FileText} label="Tipo de señal" value={line.tipo_señal} />
              <Field icon={FileText} label="Zona" value={line.zona} />
              <Field icon={Ruler} label="Superficie zona (m²)" value={line.superficie_zona_m2} />
              <Field icon={FileText} label="Periférico" value={line.periferico} />
              <Field icon={FileText} label="Cableado" value={line.cableado} />
              <Field icon={FileText} label="Módulo físico" value={line.modulo_fisico} />
              <Field icon={FileText} label="Revisión" value={line.revision} />
              <Field icon={ShieldCheck} label="Estado" value={line.estado} />
              <Field icon={ShieldCheck} label="Confianza OCR" value={line.confianza} />
              <Field icon={ShieldCheck} label="Precisa precisión" value={line.precisa_precision ? 'Sí' : 'No'} />
              <Field icon={ShieldCheck} label="Confirmado por" value={line.confirmado_por} />
              <Field icon={FileText} label="Fecha confirmación" value={line.fecha_confirmacion} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}