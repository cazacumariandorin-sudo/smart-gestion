import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useUserRole } from '@/lib/useUserRole';
import PageHeader from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import { Loader2, Building2, ClipboardCheck, Search, FileText, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import ConciliacionBadge from '@/components/conciliacion/ConciliacionBadge';
import ConciliarDialog from '@/components/conciliacion/ConciliarDialog';

const ESTADOS_VALIDOS_GASTO = ['aprobado_gerencia', 'en_administracion', 'pagada'];

export default function Conciliacion() {
  const { isContabilidad } = useUserRole();
  const qc = useQueryClient();
  const [granularidad, setGranularidad] = useState('mes');
  const [mesValor, setMesValor] = useState(() => new Date().toISOString().slice(0, 7));
  const [trimestreAnio, setTrimestreAnio] = useState(() => String(new Date().getFullYear()));
  const [trimestreQ, setTrimestreQ] = useState(() => String(Math.floor(new Date().getMonth() / 3) + 1));
  const [anioValor, setAnioValor] = useState(() => String(new Date().getFullYear()));
  const [tipoDoc, setTipoDoc] = useState('registro');
  const [filtroEstadoConc, setFiltroEstadoConc] = useState('pendientes');
  const [busqueda, setBusqueda] = useState('');
  const [conciliar, setConciliar] = useState(null);

  // Calcula el rango de fechas (inicio/fin) según la granularidad elegida
  const rango = useMemo(() => {
    if (granularidad === 'mes') {
      const [y, m] = mesValor.split('-');
      return { inicio: `${y}-${m}-01`, fin: `${y}-${m}-31`, etiqueta: `${m}/${y}` };
    }
    if (granularidad === 'trimestre') {
      const q = parseInt(trimestreQ, 10);
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      return {
        inicio: `${trimestreAnio}-${String(startMonth).padStart(2, '0')}-01`,
        fin: `${trimestreAnio}-${String(endMonth).padStart(2, '0')}-31`,
        etiqueta: `T${q} ${trimestreAnio}`,
      };
    }
    // anio
    return { inicio: `${anioValor}-01-01`, fin: `${anioValor}-12-31`, etiqueta: anioValor };
  }, [granularidad, mesValor, trimestreAnio, trimestreQ, anioValor]);

  // Clave de cache combinada (cambia al variar cualquier selector de periodo)
  const periodoKey = `${granularidad}:${rango.inicio}:${rango.fin}`;

  // Empresa principal (CIF Simantec)
  const { data: empresa } = useQuery({
    queryKey: ['empresa-principal'],
    queryFn: async () => {
      const list = await base44.entities.Empresa.filter({ es_principal: true });
      return list[0] || null;
    },
  });

  // Gastos conciliables del periodo
  const { data: gastos = [], isLoading: loadingGastos } = useQuery({
    queryKey: ['conciliacion-gastos', periodoKey],
    queryFn: async () => {
      const list = await base44.entities.RegistroGasto.filter({
        estado: { $in: ESTADOS_VALIDOS_GASTO },
        fecha_documento: { $gte: rango.inicio, $lte: rango.fin },
      }, '-fecha_documento', 200);
      return list;
    },
    enabled: tipoDoc === 'registro',
  });

  // Documentos de materiales del periodo
  const { data: documentos = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['conciliacion-docs', periodoKey],
    queryFn: async () => {
      const list = await base44.entities.MaterialDocumentoOrigen.filter({
        estado: 'procesado',
        fecha_documento: { $gte: rango.inicio, $lte: rango.fin },
      }, '-fecha_documento', 200);
      return list;
    },
    enabled: tipoDoc === 'documento',
  });

  const lista = tipoDoc === 'registro' ? gastos : documentos;
  const isLoading = tipoDoc === 'registro' ? loadingGastos : loadingDocs;

  const filtrados = useMemo(() => {
    let res = lista;
    if (filtroEstadoConc === 'pendientes') {
      res = res.filter(d => !d.estado_conciliacion || d.estado_conciliacion === 'no_conciliado');
    } else if (filtroEstadoConc === 'conciliados') {
      res = res.filter(d => d.estado_conciliacion === 'conciliado');
    } else if (filtroEstadoConc === 'discrepancia') {
      res = res.filter(d => d.estado_conciliacion === 'conciliado_con_discrepancia');
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      res = res.filter(d =>
        (d.nombre_comercio || d.proveedor_nombre || '').toLowerCase().includes(q) ||
        (d.nif_comercio || d.proveedor_nif || '').toLowerCase().includes(q) ||
        (d.obra_name || '').toLowerCase().includes(q) ||
        (d.numero_nota || d.numero_documento || '').toLowerCase().includes(q)
      );
    }
    return res;
  }, [lista, filtroEstadoConc, busqueda]);

  const totalConciliables = lista.length;
  const totalConciliados = lista.filter(d => d.estado_conciliacion === 'conciliado' || d.estado_conciliacion === 'conciliado_con_discrepancia').length;

  return (
    <div className="space-y-4 pb-8">
      <PageHeader title="Conciliación contable" subtitle="Gestoría externa — validación de gastos y documentos" />

      {/* Cabecera: CIF Simantec + periodo */}
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Empresa emisora</p>
            <p className="text-sm font-semibold">{empresa?.nombre || 'SIMANTEC S.L.'}</p>
            <p className="text-xs text-muted-foreground">CIF: {empresa?.cif || '—'}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Vista por</label>
            <MobileSelect value={granularidad} onValueChange={setGranularidad} placeholder="Granularidad" triggerClassName="w-32">
              <MobileSelectItem value="mes">Mes</MobileSelectItem>
              <MobileSelectItem value="trimestre">Trimestre</MobileSelectItem>
              <MobileSelectItem value="anio">Año</MobileSelectItem>
            </MobileSelect>
          </div>
          <div className="flex items-center gap-2">
            {granularidad === 'mes' && (
              <Input type="month" value={mesValor} onChange={e => setMesValor(e.target.value)} className="w-40" />
            )}
            {granularidad === 'trimestre' && (
              <>
                <Input
                  type="number"
                  min="2000"
                  max="2100"
                  value={trimestreAnio}
                  onChange={e => setTrimestreAnio(e.target.value)}
                  className="w-24"
                  aria-label="Año del trimestre"
                />
                <MobileSelect value={trimestreQ} onValueChange={setTrimestreQ} placeholder="Trim." triggerClassName="w-28">
                  <MobileSelectItem value="1">T1 (Ene–Mar)</MobileSelectItem>
                  <MobileSelectItem value="2">T2 (Abr–Jun)</MobileSelectItem>
                  <MobileSelectItem value="3">T3 (Jul–Sep)</MobileSelectItem>
                  <MobileSelectItem value="4">T4 (Oct–Dic)</MobileSelectItem>
                </MobileSelect>
              </>
            )}
            {granularidad === 'anio' && (
              <Input
                type="number"
                min="2000"
                max="2100"
                value={anioValor}
                onChange={e => setAnioValor(e.target.value)}
                className="w-28"
                aria-label="Año"
              />
            )}
          </div>
        </div>
      </Card>

      {/* Contador global */}
      <div className="flex items-center gap-2 text-sm">
        <ClipboardCheck className="w-4 h-4 text-primary" />
        <span className="font-medium">{totalConciliados} de {totalConciliables}</span>
        <span className="text-muted-foreground">conciliados · periodo {rango.etiqueta}</span>
      </div>

      {/* Selector tipo documento */}
      <div className="flex gap-2">
        <Button
          variant={tipoDoc === 'registro' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTipoDoc('registro')}
          className="gap-1.5"
        >
          <FileText className="w-4 h-4" /> Gastos
        </Button>
        <Button
          variant={tipoDoc === 'documento' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTipoDoc('documento')}
          className="gap-1.5"
        >
          <Package className="w-4 h-4" /> Documentos materiales
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[180px] relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por proveedor, NIF, obra, nº..."
            className="pl-8"
          />
        </div>
        <MobileSelect value={filtroEstadoConc} onValueChange={setFiltroEstadoConc} placeholder="Estado conciliación" triggerClassName="w-44">
          <MobileSelectItem value="pendientes">Pendientes</MobileSelectItem>
          <MobileSelectItem value="conciliados">Conciliados</MobileSelectItem>
          <MobileSelectItem value="discrepancia">Con discrepancia</MobileSelectItem>
          <MobileSelectItem value="todos">Todos</MobileSelectItem>
        </MobileSelect>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtrados.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          No hay documentos para conciliar con estos filtros.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtrados.map(doc => (
            <Card key={doc.id} className="p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-mono text-xs font-bold text-primary">
                    {doc.numero_nota || doc.numero_documento || '—'}
                  </span>
                  <Badge className="text-[10px] bg-slate-100 text-slate-600 border-slate-200">
                    {doc.estado}
                  </Badge>
                  <ConciliacionBadge nota={doc} />
                </div>
                <p className="text-sm font-medium truncate">
                  {doc.nombre_comercio || doc.proveedor_nombre || '—'}
                  {(doc.nif_comercio || doc.proveedor_nif) && (
                    <span className="text-xs text-muted-foreground ml-1.5">· {doc.nif_comercio || doc.proveedor_nif}</span>
                  )}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {doc.fecha_documento && <span>📅 {doc.fecha_documento}</span>}
                  {doc.obra_name && <span>🏗️ {doc.obra_name}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-base font-bold">{(doc.importe || 0).toFixed(2)} €</span>
                {doc.fecha_conciliacion && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(doc.fecha_conciliacion).toLocaleDateString('es-ES')}
                  </span>
                )}
              </div>
              {isContabilidad && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConciliar(doc)}
                  className="gap-1"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" /> Conciliar
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {conciliar && (
        <ConciliarDialog
          open={!!conciliar}
          onOpenChange={v => !v && setConciliar(null)}
          documento={conciliar}
          tipo={tipoDoc}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['conciliacion-gastos'] });
            qc.invalidateQueries({ queryKey: ['conciliacion-docs'] });
          }}
        />
      )}

      {!isContabilidad && (
        <p className="text-xs text-muted-foreground text-center pt-4">
          Modo solo lectura. Solo el rol contabilidad puede marcar conciliaciones.
        </p>
      )}
    </div>
  );
}