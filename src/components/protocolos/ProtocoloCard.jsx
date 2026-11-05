import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FileText, ExternalLink, Pencil, Trash2, Archive, Clock, ShieldAlert } from 'lucide-react';
import { AREAS, CARACTERES, CONFIDENCIALIDADES, VIGENCIAS, buscar } from '@/lib/protocolosCatalogo';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const fecha = (v) => {
  if (!v) return '';
  try { return format(parseISO(v), 'd MMM yyyy', { locale: es }); } catch { return v; }
};

export default function ProtocoloCard({ protocolo, puedeGestionar, onEdit, onDelete }) {
  const area = buscar(AREAS, protocolo.area);
  const caracter = buscar(CARACTERES, protocolo.caracter);
  const conf = buscar(CONFIDENCIALIDADES, protocolo.confidencialidad);
  const vig = buscar(VIGENCIAS, protocolo.vigencia);
  const archivado = protocolo.activo === false;

  return (
    <Card className={`p-4 ${archivado ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm leading-tight">{protocolo.titulo}</h3>
            <div className="flex gap-1 shrink-0">
              {protocolo.file_url && (
                <a href={protocolo.file_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Abrir documento">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              )}
              {puedeGestionar && (
                <>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(protocolo)} title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(protocolo)} title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {(protocolo.descripcion || protocolo.resumen) && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {protocolo.descripcion || protocolo.resumen}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="outline" className={`text-[10px] ${area.badge}`}>{area.label}</Badge>
            <Badge variant="outline" className={`text-[10px] ${caracter.badge}`}>{caracter.label}</Badge>
            <Badge variant="outline" className={`text-[10px] ${conf.badge}`}>{conf.label}</Badge>
            <Badge variant="outline" className={`text-[10px] ${vig.badge}`}>{vig.label}</Badge>
            {archivado && (
              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground gap-1">
                <Archive className="w-2.5 h-2.5" /> Archivado
              </Badge>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {protocolo.version && <span>v. {protocolo.version}</span>}
            {protocolo.fecha_documento && <span>· {fecha(protocolo.fecha_documento)}</span>}
            {protocolo.fecha_revision && (
              <span className="inline-flex items-center gap-1">· <Clock className="w-3 h-3" /> Revisión {fecha(protocolo.fecha_revision)}</span>
            )}
            {protocolo.subido_por_nombre && <span>· {protocolo.subido_por_nombre}</span>}
          </p>

          {protocolo.notas_internas && puedeGestionar && (
            <p className="text-[11px] text-amber-700 mt-1 flex items-start gap-1">
              <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" /> {protocolo.notas_internas}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}