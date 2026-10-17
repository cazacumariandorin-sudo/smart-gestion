import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, ExternalLink, TrendingUp, CheckCircle2, XCircle, Clock } from 'lucide-react';
import SemaforoTrazabilidadBadge from '@/components/contabilidad/SemaforoTrazabilidadBadge';
import ImportadorFacturasIVA from '@/components/contabilidad/ImportadorFacturasIVA';
import { useUserRole } from '@/lib/useUserRole';

const ESTADO_CFG = {
  borrador:  { label: 'Borrador',  color: 'bg-slate-100 text-slate-700 border-slate-200',    icon: Clock },
  enviado:   { label: 'Enviado',   color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: Clock },
  aceptado:  { label: 'Aceptado',  color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-700 border-red-200',           icon: XCircle },
};

/**
 * Sección de PRESUPUESTOS del periodo (previsión comercial). NO son facturas y NO se suman
 * a la facturación emitida real, que sale del libro de IVA (FacturaIVA).
 */
function PresupuestosSeccion({ rango, periodoKey }) {
  const { data: presupuestos = [], isLoading } = useQuery({
    queryKey: ['contabilidad-facturacion', periodoKey],
    queryFn: async () => {
      const list = await base44.entities.Presupuesto.filter({
        fecha: { $gte: rango.inicio, $lte: rango.fin },
      }, '-fecha', 200);
      return list;
    },
  });

  const totals = useMemo(() => {
    const total = presupuestos.reduce((s, p) => s + (p.importe || 0), 0);
    const aceptado = presupuestos.filter(p => p.estado === 'aceptado').reduce((s, p) => s + (p.importe || 0), 0);
    const pendiente = presupuestos.filter(p => p.estado === 'enviado').reduce((s, p) => s + (p.importe || 0), 0);
    return { total, aceptado, pendiente, count: presupuestos.length };
  }, [presupuestos]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Presupuestado</p>
          <p className="text-lg font-bold">{totals.total.toFixed(2)} €</p>
          <p className="text-[10px] text-muted-foreground">{totals.count} presupuesto(s)</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Presupuestos aceptados</p>
          <p className="text-lg font-bold text-emerald-600">{totals.aceptado.toFixed(2)} €</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Presupuestos enviados</p>
          <p className="text-lg font-bold text-blue-600">{totals.pendiente.toFixed(2)} €</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Periodo</p>
          <p className="text-lg font-bold">{rango.etiqueta}</p>
        </Card>
      </div>

      {presupuestos.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">No hay presupuestos en este periodo.</Card>
      ) : (
        <div className="space-y-2">
          {presupuestos.map(p => {
            const cfg = ESTADO_CFG[p.estado] || ESTADO_CFG.borrador;
            const Icon = cfg.icon;
            return (
              <Card key={p.id} className="p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="font-mono text-xs font-bold text-primary">{p.codigo_registro || '—'}</span>
                    <Badge className={`text-[10px] border ${cfg.color}`}><Icon className="w-3 h-3 mr-1" />{cfg.label}</Badge>
                    {/* Semáforo reutilizado: para Presupuesto, la "conciliación" = aceptado */}
                    <SemaforoTrazabilidadBadge doc={{ estado_conciliacion: p.estado === 'aceptado' ? 'conciliado' : 'no_conciliado', estado: p.estado === 'enviado' ? 'pendiente' : p.estado }} showLabel={false} />
                  </div>
                  <p className="text-sm font-medium truncate">
                    {p.titulo || p.cliente_name || 'Sin cliente'}
                    {p.cliente_name && p.titulo && <span className="text-xs text-muted-foreground ml-1.5">· {p.cliente_name}</span>}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {p.fecha && <span>📅 {p.fecha}</span>}
                    {p.conceptos?.length > 0 && <span>📋 {p.conceptos.length} líneas</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-base font-bold flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    {(p.importe || 0).toFixed(2)} €
                  </span>
                  {p.file_url && (
                    <a href={p.file_url} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> PDF
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const fmtEur = (n) => (n ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Facturas emitidas REALES del periodo. Fuente única: FacturaIVA (tipo 'emitida'),
 * la misma entidad que usa el cálculo del 303. Importar aquí o en IVA 303 rellena ambos:
 * no hay copias ni doble cómputo.
 */
function FacturasEmitidasSeccion({ rango, periodoKey }) {
  const { isContabilidad, isAdministracion, isGerencia, isAdmin } = useUserRole();
  const puedeImportar = isContabilidad || isAdministracion || isGerencia || isAdmin;

  const { data: filas = [], isLoading, error } = useQuery({
    queryKey: ['facturaIVA', 'emitidas', periodoKey],
    retry: false,
    queryFn: async () => {
      const todas = [];
      for (let p = 0; p < 20; p++) {
        const lote = await base44.entities.FacturaIVA.list('fecha_factura', 500, p * 500);
        if (!Array.isArray(lote) || lote.length === 0) break;
        todas.push(...lote);
        if (lote.length < 500) break;
      }
      return todas.filter((f) => f.tipo === 'emitida' && f.estado !== 'anulada'
        && (f.fecha_factura || '').slice(0, 10) >= rango.inicio && (f.fecha_factura || '').slice(0, 10) <= rango.fin);
    },
  });

  const { facturas, t } = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    // Una factura puede tener varias filas (una por tipo de IVA): se unen SOLO para mostrarlas
    const mapa = new Map();
    for (const f of filas) {
      const k = `${f.numero_factura || f.id}|${(f.nif_contraparte || '').toUpperCase()}`;
      const g = mapa.get(k) || { key: k, numero: f.numero_factura || 's/n', fecha: (f.fecha_factura || '').slice(0, 10), nombre: f.nombre_contraparte || f.nif_contraparte || '—', base: 0, cuota: 0, total: 0, cobro: f.estado_cobro || '', venc: f.fecha_vencimiento || '', borrador: false };
      g.base += f.base_imponible || 0; g.cuota += f.cuota_iva || 0; g.total += f.total_factura ?? ((f.base_imponible || 0) + (f.cuota_iva || 0));
      if (f.estado === 'borrador') g.borrador = true;
      if (f.estado_cobro === 'pendiente') g.cobro = 'pendiente';
      mapa.set(k, g);
    }
    const lista = [...mapa.values()].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    const suma = (arr) => r2(arr.reduce((s, g) => s + g.total, 0));
    const pend = lista.filter((g) => g.cobro === 'pendiente');
    const venc = pend.filter((g) => g.venc && g.venc < hoy);
    return {
      facturas: lista.map((g) => ({ ...g, vencida: g.cobro === 'pendiente' && !!g.venc && g.venc < hoy })),
      t: {
        n: lista.length,
        base: r2(lista.reduce((s, g) => s + g.base, 0)),
        iva: r2(lista.reduce((s, g) => s + g.cuota, 0)),
        total: suma(lista),
        cobrado: suma(lista.filter((g) => g.cobro === 'pagado')),
        pendiente: suma(pend), nPend: pend.length,
        vencido: suma(venc), nVenc: venc.length,
        sinEstado: lista.filter((g) => !g.cobro).length,
        borradores: lista.filter((g) => g.borrador).length,
      },
    };
  }, [filas]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold">Facturas emitidas · {rango.etiqueta}</h3>
        {puedeImportar && <ImportadorFacturasIVA etiqueta="Importar facturas" />}
      </div>

      {error ? (
        <Card className="p-4 text-sm text-muted-foreground">No tienes permiso para ver el libro de facturas emitidas.</Card>
      ) : isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Facturado (con IVA)</p>
              <p className="text-lg font-bold">{fmtEur(t.total)}</p>
              <p className="text-[10px] text-muted-foreground">{t.n} factura(s) · base {fmtEur(t.base)} · IVA {fmtEur(t.iva)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Cobrado</p>
              <p className="text-lg font-bold text-emerald-600">{fmtEur(t.cobrado)}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Pendiente de cobro</p>
              <p className="text-lg font-bold text-blue-600">{fmtEur(t.pendiente)}</p>
              <p className="text-[10px] text-muted-foreground">{t.nPend} factura(s)</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">Vencido sin cobrar</p>
              <p className={`text-lg font-bold ${t.nVenc ? 'text-red-600' : ''}`}>{fmtEur(t.vencido)}</p>
              <p className="text-[10px] text-muted-foreground">{t.nVenc} factura(s)</p>
            </Card>
          </div>

          {(t.sinEstado > 0 || t.borradores > 0) && (
            <p className="text-[11px] text-muted-foreground">
              {t.sinEstado > 0 && <>{t.sinEstado} factura(s) sin estado de cobro (no entran en cobrado ni pendiente). </>}
              {t.borradores > 0 && <>{t.borradores} en borrador, pendientes de revisar en IVA 303.</>}
            </p>
          )}

          {facturas.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground text-sm">No hay facturas emitidas en este periodo. Impórtalas con el botón de arriba o desde IVA 303.</Card>
          ) : (
            <div className="space-y-1.5">
              {facturas.map((g) => (
                <Card key={g.key} className="p-2.5 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-primary">{g.numero}</span>
                      {g.cobro === 'pagado' && <Badge className="text-[10px] border bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />Cobrada</Badge>}
                      {g.cobro === 'pendiente' && !g.vencida && <Badge className="text-[10px] border bg-blue-100 text-blue-700 border-blue-200"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>}
                      {g.vencida && <Badge className="text-[10px] border bg-red-100 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Vencida</Badge>}
                      {g.borrador && <span className="text-[10px] text-muted-foreground">borrador</span>}
                    </div>
                    <p className="text-sm truncate">{g.nombre}</p>
                    <p className="text-xs text-muted-foreground">📅 {g.fecha}{g.venc ? ` · vence ${g.venc}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold">{fmtEur(r2(g.total))}</p>
                    <p className="text-[10px] text-muted-foreground">base {fmtEur(r2(g.base))} · IVA {fmtEur(r2(g.cuota))}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Facturación emitida = facturas reales (libro de IVA) + presupuestos del periodo como previsión.
 * Las dos secciones son independientes: los presupuestos no se suman a lo facturado.
 */
export default function FacturacionEmitidaPanel({ rango, periodoKey }) {
  return (
    <div className="space-y-8">
      <FacturasEmitidasSeccion rango={rango} periodoKey={periodoKey} />
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Presupuestos del periodo <span className="font-normal text-muted-foreground">(previsión, no suma a lo facturado)</span></h3>
        <PresupuestosSeccion rango={rango} periodoKey={periodoKey} />
      </div>
    </div>
  );
}
