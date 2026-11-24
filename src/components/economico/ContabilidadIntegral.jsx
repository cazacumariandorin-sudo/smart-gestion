import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Truck, TrendingUp, Clock, AlertTriangle, Receipt, FileText, Info, Landmark,
} from 'lucide-react';

const eur = (n) => `${(Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function Bloque({ icon: Icon, titulo, sub, children }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{titulo}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Cifra({ label, value, sub, tone = 'text-foreground' }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 p-2.5">
      <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      <p className={`text-base font-bold truncate ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

/**
 * Cobertura integral del módulo Contabilidad dentro del análisis económico:
 * facturas de proveedor (libro de IVA + autónomos) separadas por estado,
 * facturas emitidas (facturado / cobrado / pendiente), borradores, documentos
 * pendientes de validar e impuestos del periodo. Cada cifra sale de su fuente
 * y nunca se suma dos veces con las notas de gasto ya contabilizadas.
 */
export default function ContabilidadIntegral({ data }) {
  const prov = data?.proveedores;
  const emitidas = data?.emitidas;

  const ranking = useMemo(() => prov?.por_proveedor || [], [prov]);

  if (!data) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
        Sin datos de Contabilidad para este periodo.
      </div>
    );
  }

  const sinDatosProveedores = !prov || (prov.contabilizadas?.n === 0 && prov.pendientes?.n === 0
    && prov.autonomos?.pagadas?.n === 0 && prov.autonomos?.pendientes?.n === 0
    && prov.documentos_empresa_pendientes?.n === 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Proveedores */}
        <Bloque
          icon={Truck}
          titulo="Coste de proveedores"
          sub="Libro de IVA (facturas recibidas) + facturas de autónomos"
        >
          {sinDatosProveedores ? (
            <p className="text-xs text-muted-foreground py-3">
              No hay facturas de proveedor en el periodo. Se cargan desde Contabilidad → IVA 303 / Retención 111.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Cifra
                  label="Contabilizado (base)"
                  value={eur(prov.total_contabilizado)}
                  sub={`${(prov.contabilizadas?.n || 0) + (prov.autonomos?.pagadas?.n || 0)} factura(s)`}
                  tone="text-emerald-600"
                />
                <Cifra
                  label="Pendiente (base)"
                  value={eur(prov.total_pendiente)}
                  sub={`${(prov.pendientes?.n || 0) + (prov.autonomos?.pendientes?.n || 0) + (prov.documentos_empresa_pendientes?.n || 0)} doc. sin cerrar`}
                  tone="text-amber-600"
                />
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Libro IVA revisadas</span>
                  <span className="font-medium">{eur(prov.contabilizadas?.base)} <span className="text-muted-foreground">· IVA {eur(prov.contabilizadas?.iva)}</span></span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Libro IVA en borrador</span>
                  <span className="font-medium text-amber-600">{eur(prov.pendientes?.base)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Autónomos pagadas</span>
                  <span className="font-medium">{eur(prov.autonomos?.pagadas?.base)} <span className="text-muted-foreground">· ret. {eur(prov.autonomos?.pagadas?.retencion)}</span></span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Autónomos pendientes</span>
                  <span className="font-medium text-amber-600">{eur(prov.autonomos?.pendientes?.base)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Justificantes de empresa sin validar</span>
                  <span className="font-medium text-amber-600">{eur(prov.documentos_empresa_pendientes?.total)}</span>
                </div>
              </div>

              {ranking.length > 0 && (
                <div className="pt-2 border-t border-border space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Principales proveedores</p>
                  {ranking.map((p) => (
                    <div key={p.nombre} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{p.nombre}</span>
                      <span className="shrink-0 font-medium">{eur(p.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Bloque>

        {/* Facturas emitidas */}
        <Bloque
          icon={TrendingUp}
          titulo="Facturas emitidas"
          sub="Libro de IVA · cobro según conciliación bancaria"
        >
          {!emitidas || emitidas.facturado?.n === 0 ? (
            <p className="text-xs text-muted-foreground py-3">No hay facturas emitidas en el periodo.</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Cifra
                  label="Facturado (con IVA)"
                  value={eur(emitidas.facturado?.total)}
                  sub={`base ${eur(emitidas.facturado?.base)} · IVA ${eur(emitidas.facturado?.iva)}`}
                />
                <Cifra
                  label="Cobrado"
                  value={eur(emitidas.cobrado?.total)}
                  sub={`${emitidas.cobrado?.n || 0} factura(s)`}
                  tone="text-emerald-600"
                />
                <Cifra
                  label="Pendiente de cobro"
                  value={eur(emitidas.pendiente?.total)}
                  sub={`${emitidas.pendiente?.n || 0} factura(s)`}
                  tone="text-blue-600"
                />
                <Cifra
                  label="Vencido sin cobrar"
                  value={eur(emitidas.vencido?.total)}
                  sub={`${emitidas.vencido?.n || 0} factura(s)`}
                  tone={emitidas.vencido?.n ? 'text-red-600' : 'text-foreground'}
                />
              </div>

              {(emitidas.sin_estado_cobro?.n > 0 || emitidas.en_borrador_libro?.n > 0) && (
                <p className="text-[11px] text-muted-foreground">
                  {emitidas.sin_estado_cobro?.n > 0 && <>{emitidas.sin_estado_cobro.n} sin estado de cobro ({eur(emitidas.sin_estado_cobro.total)}), fuera de cobrado y pendiente. </>}
                  {emitidas.en_borrador_libro?.n > 0 && <>{emitidas.en_borrador_libro.n} en borrador en el libro ({eur(emitidas.en_borrador_libro.total)}).</>}
                </p>
              )}

              {(emitidas.por_cliente || []).length > 0 && (
                <div className="pt-2 border-t border-border space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Por cliente</p>
                  {emitidas.por_cliente.map((c) => (
                    <div key={c.nombre} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{c.nombre}</span>
                      <span className="shrink-0 font-medium">
                        {eur(c.total)}
                        {c.pendiente > 0 && <span className="text-blue-600"> · {eur(c.pendiente)} pend.</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Bloque>
      </div>

      {/* Pendientes de revisión + impuestos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Bloque icon={Clock} titulo="Pendiente de revisión" sub="No suma a los importes contabilizados">
          <div className="grid grid-cols-2 gap-2">
            <Cifra
              label="Borradores de factura"
              value={String(data.borradores_factura?.n || 0)}
              sub={`${eur(data.borradores_factura?.total)} con IVA`}
              tone="text-amber-600"
            />
            <Cifra
              label="Facturas libro en borrador"
              value={String(emitidas?.en_borrador_libro?.n || 0)}
              sub="pendientes en IVA 303"
              tone="text-amber-600"
            />
            <Cifra
              label="Proveedor sin contabilizar"
              value={eur(prov?.total_pendiente)}
              sub="base imponible"
              tone="text-amber-600"
            />
            <Cifra
              label="Sin estado de cobro"
              value={eur(emitidas?.sin_estado_cobro?.total)}
              sub="facturas emitidas"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Los borradores y documentos sin validar se muestran aparte y no entran en los totales contabilizados.
          </p>
        </Bloque>

        <Bloque icon={Receipt} titulo="Impuestos del periodo" sub="Control interno de modelos 303 y 111">
          {(data.impuestos || []).length === 0 ? (
            <p className="text-xs text-muted-foreground py-3">Sin declaraciones registradas para este periodo.</p>
          ) : (
            <div className="space-y-2">
              {data.impuestos.map((imp, i) => (
                <div key={`${imp.modelo}-${imp.periodo}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <Landmark className="w-3 h-3 text-muted-foreground" />
                    Modelo {imp.modelo} · {imp.periodo}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{eur(imp.presentado || imp.calculado)}</span>
                    {Math.abs(imp.diferencia || 0) > 0.01 ? (
                      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                        <AlertTriangle className="w-3 h-3 mr-1" /> {eur(imp.diferencia)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">Cuadra</Badge>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Bloque>
      </div>

      {(data.avisos || []).length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div className="space-y-1">
            {data.avisos.map((a, i) => <p key={i}>{a}</p>)}
          </div>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <FileText className="w-3.5 h-3.5" />
        Base temporal: {data.base_temporal === 'pago' ? 'fecha de pago / cobro' : 'fecha del documento'}.
        Las notas de gasto aprobadas se contabilizan en su propio bloque y no se suman aquí.
      </p>
    </div>
  );
}