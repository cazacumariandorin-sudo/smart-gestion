import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Loader2, X, Maximize2, Minimize2 } from 'lucide-react';
import InformeTecnicoResumen from './InformeTecnicoResumen';
import { useUserRole } from '@/lib/useUserRole';

// Mismos roles que la RLS de lectura de InformeTecnicoPresupuesto (el informe lleva costes y márgenes)
export const ROLES_INFORMES_INTERNOS = ['admin', 'propietario', 'gerencia', 'director_comercial', 'administracion'];
const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

/**
 * Lista y abre los informes técnicos internos archivados.
 *  - presupuestoId → informes de ese presupuesto (modal de análisis, lista de Presupuestos)
 *  - obraId        → informes de todos los presupuestos de la obra (Ingeniería → Documentos)
 * Devuelve null para roles sin permiso (p. ej. ingeniero): no ven costes ni márgenes.
 */
export default function InformesTecnicosPresupuesto({ presupuestoId, obraId }) {
  const { role } = useUserRole();
  const autorizado = ROLES_INFORMES_INTERNOS.includes(role);
  const [abierto, setAbierto] = useState(null);
  const [maximizado, setMaximizado] = useState(false);

  const { data: informes = [], isLoading } = useQuery({
    queryKey: ['informes_tecnicos', presupuestoId || null, obraId || null],
    enabled: autorizado && !!(presupuestoId || obraId),
    retry: false,
    queryFn: () => base44.entities.InformeTecnicoPresupuesto.filter(
      presupuestoId ? { presupuesto_id: presupuestoId } : { obra_id: obraId }, '-generado_en', 100),
  });

  if (!autorizado) return null;
  if (isLoading) return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando informes internos…</div>;
  if (!informes.length) return <p className="text-xs text-muted-foreground">Sin informes internos archivados.</p>;

  return (
    <div className="space-y-2">
      {informes.map((i) => (
        <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-xs">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-medium">{i.presupuesto_codigo || 'Presupuesto'}</span>
          <Badge variant="outline" className="text-[10px]">v{i.version || 1}</Badge>
          <span className="text-muted-foreground">{new Date(i.generado_en || i.created_date).toLocaleString('es-ES')}</span>
          <span className="ml-auto font-medium">{eur(i.totales?.precio_propuesto)}</span>
          <Button type="button" size="sm" variant="outline" className="h-7 gap-1" onClick={() => setAbierto(i)}>
            <Eye className="h-3 w-3" />Abrir
          </Button>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">Documento interno: no se incluye en el PDF ni en el envío al cliente.</p>

      {abierto && (
        <div className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/50 ${maximizado ? 'p-0' : 'p-2 sm:p-4'}`}>
          <div className={`flex flex-col overflow-hidden border bg-card shadow-xl ${maximizado ? 'h-screen w-screen rounded-none' : 'h-[92vh] w-[96vw] max-w-[1400px] rounded-xl'}`}>
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-bold">Informe técnico interno · v{abierto.version || 1}{abierto.presupuesto_codigo ? ` · ${abierto.presupuesto_codigo}` : ''}</p>
              <div className="flex items-center gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => setMaximizado((v) => !v)} title={maximizado ? 'Reducir ventana' : 'Ampliar a pantalla completa'}>
                  {maximizado ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAbierto(null)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4"><InformeTecnicoResumen informe={abierto} /></div>
          </div>
        </div>
      )}
    </div>
  );
}