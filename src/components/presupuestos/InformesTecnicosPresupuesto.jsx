import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Loader2 } from 'lucide-react';

export function InformeTecnicoCard({ informe, onAbrir }) {
  if (!informe) return null;
  return (
    <div className="rounded-lg border border-border p-3 text-xs space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-primary" />
        <strong>Informe técnico interno</strong>
        <Badge variant="outline" className="text-[10px]">v{informe.version || 1}</Badge>
        <Button type="button" size="sm" variant="outline" className="ml-auto h-7 gap-1" onClick={() => onAbrir?.(informe)}>
          <Eye className="w-3 h-3" /> Abrir
        </Button>
      </div>
      <p className="text-muted-foreground">No se incluye en presupuestos PDF o envíos al cliente.</p>
    </div>
  );
}

export default function InformesTecnicosPresupuesto({ presupuestoId, obraId }) {
  const [informes, setInformes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      setCargando(true);
      try {
        let rows = [];
        if (presupuestoId) rows = await base44.entities.InformeTecnicoPresupuesto.filter({ presupuesto_id: presupuestoId }, '-generado_en', 20);
        else if (obraId) rows = await base44.entities.InformeTecnicoPresupuesto.filter({ obra_id: obraId }, '-generado_en', 100);
        if (activo) setInformes(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (activo) setInformes([]);
      } finally {
        if (activo) setCargando(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, [presupuestoId, obraId]);

  if (cargando) return <div class="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 class="w-3.5 h-3.5 animate-spin" /> Cargando informes internos…</div>;
  if (!informes.length) return <p className="text-xs text-muted-foreground">Sin informes internos archivados.</p>;

  return (
    <div className="space-y-2">
      {informes.map((informe) => <InformeTecnicoCard key={informe.id} informe={informe} onAbrir={() => window.dispatchEvent(new CustomEvent('smart-gestion:abrir-informe-tecnico', { detail: informe }))} />)}
    </div>
  );
}
