/**
 * HistorialVersionesPresupuesto — historial interno de versiones de un presupuesto.
 * Muestra la versión vigente y, por cada modificación, el motivo, el usuario, la
 * fecha y la comparativa completa (cabecera, líneas y precios).
 * Es documentación interna: el cliente recibe solo la versión vigente, sin numeración.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, Loader2, ChevronDown, ChevronUp, Plus, Minus, Pencil, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const num = (n) => (Number(n) || 0).toLocaleString('es-ES', { maximumFractionDigits: 3 });

const ETIQUETAS = {
  descripcion: 'Descripción',
  detalle: 'Detalle',
  cantidad: 'Cantidad',
  unidad: 'Unidad',
  precio_unitario: 'Precio unitario',
  iva_pct: 'IVA',
  total: 'Importe de la línea',
};

const valor = (campo, v) => {
  if (v === undefined || v === null || v === '') return '—';
  if (campo === 'precio_unitario' || campo === 'total') return eur(v);
  if (campo === 'iva_pct') return `${num(v)} %`;
  if (campo === 'cantidad') return num(v);
  return String(v);
};

const TIPO_ESTILO = {
  anadida: { badge: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200', icon: Plus, label: 'Añadida' },
  eliminada: { badge: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200', icon: Minus, label: 'Eliminada' },
  modificada: { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200', icon: Pencil, label: 'Modificada' },
};

function VersionItem({ version, abierta, onToggle }) {
  return (
    <div className="rounded-xl border overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-[10px]">v{version.numero}</Badge>
              {version.fecha_modificacion
                ? format(new Date(version.fecha_modificacion), "dd MMM yyyy · HH:mm", { locale: es })
                : '—'}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {version.modificado_por_nombre || version.modificado_por || '—'}
              {version.estado_presupuesto ? ` · ${version.estado_presupuesto}` : ''}
            </p>
          </div>
          {abierta ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
        </div>
        {version.motivo && <p className="text-xs mt-1.5"><span className="text-muted-foreground">Motivo: </span>{version.motivo}</p>}
        {(version.resumen_cambios || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {version.resumen_cambios.slice(0, 4).map((r, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r}</span>
            ))}
          </div>
        )}
      </button>

      {abierta && (
        <div className="border-t px-3 py-3 space-y-3 bg-muted/10">
          {/* Totales */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border bg-card p-2">
              <p className="text-[10px] text-muted-foreground">Base antes</p>
              <p className="text-xs font-semibold">{eur(version.totales_antes?.base_imponible)}</p>
              <p className="text-[10px] text-muted-foreground">después</p>
              <p className="text-xs font-semibold">{eur(version.totales_despues?.base_imponible)}</p>
            </div>
            <div className="rounded-lg border bg-card p-2">
              <p className="text-[10px] text-muted-foreground">IVA antes</p>
              <p className="text-xs font-semibold">{eur(version.totales_antes?.iva_total)}</p>
              <p className="text-[10px] text-muted-foreground">después</p>
              <p className="text-xs font-semibold">{eur(version.totales_despues?.iva_total)}</p>
            </div>
            <div className="rounded-lg border bg-card p-2">
              <p className="text-[10px] text-muted-foreground">Total antes</p>
              <p className="text-xs font-semibold">{eur(version.totales_antes?.total_con_iva)}</p>
              <p className="text-[10px] text-muted-foreground">después</p>
              <p className="text-xs font-semibold">{eur(version.totales_despues?.total_con_iva)}</p>
            </div>
          </div>

          {/* Cabecera */}
          {(version.campos_modificados || []).length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Datos del presupuesto</p>
              {version.campos_modificados.map((c, i) => (
                <div key={i} className="text-xs flex flex-wrap gap-1">
                  <span className="font-medium">{c.etiqueta}:</span>
                  <span className="text-red-600 dark:text-red-400 line-through">{c.antes || '—'}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-green-700 dark:text-green-400">{c.despues || '—'}</span>
                </div>
              ))}
            </div>
          )}

          {/* Líneas */}
          {(version.lineas_modificadas || []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Líneas</p>
              {version.lineas_modificadas.map((l, i) => {
                const estilo = TIPO_ESTILO[l.tipo] || TIPO_ESTILO.modificada;
                const Icono = estilo.icon;
                return (
                  <div key={i} className="rounded-lg border bg-card p-2 text-xs space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium flex-1 min-w-0 break-words">{l.descripcion || '(sin descripción)'}</span>
                      <Badge className={`${estilo.badge} border-0 text-[10px] gap-0.5 shrink-0`}>
                        <Icono className="w-2.5 h-2.5" /> {estilo.label}
                      </Badge>
                    </div>
                    {(l.campos || []).map((campo) => (
                      <div key={campo} className="text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">{ETIQUETAS[campo] || campo}:</span>{' '}
                        <span className="line-through">{valor(campo, l.antes?.[campo])}</span>{' → '}
                        <span className="text-foreground">{valor(campo, l.despues?.[campo])}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> Copia inmutable del estado anterior a la modificación.
          </p>
        </div>
      )}
    </div>
  );
}

export default function HistorialVersionesPresupuesto({ open, onClose, presupuesto }) {
  const [abierta, setAbierta] = useState(null);

  const { data: versiones = [], isLoading } = useQuery({
    queryKey: ['presupuesto_versiones', presupuesto?.id],
    queryFn: async () => {
      const res = await base44.entities.PresupuestoVersion.filter({ presupuesto_id: presupuesto.id });
      const lista = Array.isArray(res) ? res : (res?.items || []);
      return [...lista].sort((a, b) => Number(b.numero || 0) - Number(a.numero || 0));
    },
    enabled: open && !!presupuesto?.id,
  });

  const vigente = Number(presupuesto?.version_actual || 1);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Historial de versiones
          </DialogTitle>
          <DialogDescription>
            {presupuesto?.codigo_registro || presupuesto?.titulo}
            {' · '}Uso interno: al cliente solo se le envía la versión vigente, sin numeración.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold">Versión vigente · v{vigente}</p>
            <p className="text-[11px] text-muted-foreground">
              {presupuesto?.modificado_en
                ? `Última modificación: ${format(new Date(presupuesto.modificado_en), "dd MMM yyyy · HH:mm", { locale: es })}${presupuesto?.modificado_por ? ` · ${presupuesto.modificado_por}` : ''}`
                : 'Sin modificaciones desde su creación'}
            </p>
            {presupuesto?.motivo_ultima_modificacion && (
              <p className="text-[11px] text-muted-foreground">Motivo: {presupuesto.motivo_ultima_modificacion}</p>
            )}
          </div>
          <Badge className="bg-primary text-primary-foreground border-0 shrink-0">En uso</Badge>
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : versiones.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Todavía no hay versiones anteriores: este presupuesto no se ha modificado.
            </div>
          ) : (
            versiones.map((v) => (
              <VersionItem
                key={v.id}
                version={v}
                abierta={abierta === v.id}
                onToggle={() => setAbierta(abierta === v.id ? null : v.id)}
              />
            ))
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}