import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, Search, FileText, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import ProtocoloCard from './ProtocoloCard';
import ProtocoloFormDialog from './ProtocoloFormDialog';
import { AREAS, CARACTERES, CONFIDENCIALIDADES, VIGENCIAS, opciones } from '@/lib/protocolosCatalogo';
import { useUserRole } from '@/lib/useUserRole';

const TODOS = 'todos';

export default function ProtocolosInternos() {
  const qc = useQueryClient();
  const { isAdmin, isGerencia, isAdministracion } = useUserRole();
  const puedeGestionar = isAdmin || isGerencia || isAdministracion;

  const [search, setSearch] = useState('');
  const [area, setArea] = useState(TODOS);
  const [caracter, setCaracter] = useState(TODOS);
  const [confidencialidad, setConfidencialidad] = useState(TODOS);
  const [vigencia, setVigencia] = useState(TODOS);
  const [verArchivados, setVerArchivados] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [borrando, setBorrando] = useState(null);

  const { data: protocolos = [], isLoading } = useQuery({
    queryKey: ['protocolos_internos'],
    queryFn: () => base44.entities.ProtocoloInterno.list('-created_date', 300),
  });

  const lista = useMemo(() => {
    const q = search.trim().toLowerCase();
    return protocolos.filter(p => {
      if (!verArchivados && p.activo === false) return false;
      if (area !== TODOS && p.area !== area) return false;
      if (caracter !== TODOS && p.caracter !== caracter) return false;
      if (confidencialidad !== TODOS && p.confidencialidad !== confidencialidad) return false;
      if (vigencia !== TODOS && p.vigencia !== vigencia) return false;
      if (!q) return true;
      const texto = [p.titulo, p.descripcion, p.resumen, p.nombre_archivo, ...(p.etiquetas || [])]
        .filter(Boolean).join(' ').toLowerCase();
      return texto.includes(q);
    });
  }, [protocolos, search, area, caracter, confidencialidad, vigencia, verArchivados]);

  const abrirNuevo = () => { setEditando(null); setDialogOpen(true); };
  const abrirEditar = (p) => { setEditando(p); setDialogOpen(true); };
  const refrescar = () => qc.invalidateQueries({ queryKey: ['protocolos_internos'] });

  const eliminar = async () => {
    if (!borrando) return;
    try {
      await base44.entities.ProtocoloInterno.delete(borrando.id);
      toast.success('Documento eliminado');
      setBorrando(null);
      refrescar();
    } catch (e) {
      toast.error('No se pudo eliminar: ' + (e.message || 'sin permisos'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Protocolos internos</h3>
          <p className="text-xs text-muted-foreground">
            Documentación interna de la empresa para conocimiento de toda la plantilla, clasificada por área,
            carácter normativo, confidencialidad y vigencia.
          </p>
        </div>
        {puedeGestionar && (
          <Button onClick={abrirNuevo} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" /> Subir documento
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar documento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <MobileSelect value={area} onValueChange={setArea} placeholder="Área" triggerClassName="w-44">
          <MobileSelectItem value={TODOS}>Todas las áreas</MobileSelectItem>
          {opciones(AREAS).map(o => <MobileSelectItem key={o.value} value={o.value}>{o.label}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={caracter} onValueChange={setCaracter} placeholder="Carácter" triggerClassName="w-40">
          <MobileSelectItem value={TODOS}>Todo carácter</MobileSelectItem>
          {opciones(CARACTERES).map(o => <MobileSelectItem key={o.value} value={o.value}>{o.label}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={confidencialidad} onValueChange={setConfidencialidad} placeholder="Acceso" triggerClassName="w-40">
          <MobileSelectItem value={TODOS}>Todo acceso</MobileSelectItem>
          {opciones(CONFIDENCIALIDADES).map(o => <MobileSelectItem key={o.value} value={o.value}>{o.label}</MobileSelectItem>)}
        </MobileSelect>
        <MobileSelect value={vigencia} onValueChange={setVigencia} placeholder="Vigencia" triggerClassName="w-40">
          <MobileSelectItem value={TODOS}>Toda vigencia</MobileSelectItem>
          {opciones(VIGENCIAS).map(o => <MobileSelectItem key={o.value} value={o.value}>{o.label}</MobileSelectItem>)}
        </MobileSelect>
        {puedeGestionar && (
          <Button
            variant={verArchivados ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setVerArchivados(v => !v)}
            title="Mostrar documentos archivados"
          >
            <Archive className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{verArchivados ? 'Ver activos' : 'Ver archivados'}</span>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : lista.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-xl">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {protocolos.length === 0 ? 'Todavía no hay protocolos internos publicados' : 'Ningún documento coincide con los filtros'}
          </p>
          {puedeGestionar && protocolos.length === 0 && (
            <Button variant="outline" size="sm" onClick={abrirNuevo} className="gap-1.5 mt-3">
              <Plus className="w-3.5 h-3.5" /> Subir el primer documento
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lista.map(p => (
            <ProtocoloCard
              key={p.id}
              protocolo={p}
              puedeGestionar={puedeGestionar}
              onEdit={abrirEditar}
              onDelete={setBorrando}
            />
          ))}
        </div>
      )}

      <ProtocoloFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        protocolo={editando}
        onSaved={refrescar}
      />

      <AlertDialog open={!!borrando} onOpenChange={v => { if (!v) setBorrando(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              "{borrando?.titulo}" se eliminará del archivo interno y dejará de estar disponible para la plantilla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminar} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}