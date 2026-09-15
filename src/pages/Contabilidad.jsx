import { useState, useMemo } from 'react';
import { useUserRole } from '@/lib/useUserRole';
import PageHeader from '@/components/layout/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { MobileSelect, MobileSelectItem } from '@/components/ui/MobileSelect';
import ConciliacionPanel from '@/components/contabilidad/ConciliacionPanel';
import NotasCerradasPanel from '@/components/contabilidad/NotasCerradasPanel';
import SubidaMasivaPanel from '@/components/contabilidad/SubidaMasivaPanel';
import DescargaBloquePanel from '@/components/contabilidad/DescargaBloquePanel';
import { ClipboardCheck, FileText, UploadCloud, Download } from 'lucide-react';

/**
 * Sección Contabilidad — antes "Conciliación", ahora con 4 pestañas.
 * La ruta /conciliacion redirige aquí (alias de compatibilidad).
 */
export default function Contabilidad() {
  const { isContabilidad, isAdministracion, isGerencia, isAdmin } = useUserRole();
  const puedeSubida = isContabilidad || isAdministracion || isGerencia || isAdmin;
  const [granularidad, setGranularidad] = useState('mes');
  const [mesAnio, setMesAnio] = useState(() => String(new Date().getFullYear()));
  const [mesMes, setMesMes] = useState(() => String(new Date().getMonth() + 1));
  const [trimestreAnio, setTrimestreAnio] = useState(() => String(new Date().getFullYear()));
  const [trimestreQ, setTrimestreQ] = useState(() => String(Math.floor(new Date().getMonth() / 3) + 1));
  const [anioValor, setAnioValor] = useState(() => String(new Date().getFullYear()));
  const [tab, setTab] = useState('conciliacion');

  const rango = useMemo(() => {
    if (granularidad === 'mes') {
      const m = String(mesMes).padStart(2, '0');
      return { inicio: `${mesAnio}-${m}-01`, fin: `${mesAnio}-${m}-31`, etiqueta: `${m}/${mesAnio}` };
    }
    if (granularidad === 'trimestre') {
      const q = parseInt(trimestreQ, 10);
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      return { inicio: `${trimestreAnio}-${String(startMonth).padStart(2, '0')}-01`, fin: `${trimestreAnio}-${String(endMonth).padStart(2, '0')}-31`, etiqueta: `T${q} ${trimestreAnio}` };
    }
    return { inicio: `${anioValor}-01-01`, fin: `${anioValor}-12-31`, etiqueta: anioValor };
  }, [granularidad, mesAnio, mesMes, trimestreAnio, trimestreQ, anioValor]);

  const periodoKey = `${granularidad}:${rango.inicio}:${rango.fin}`;

  return (
    <div className="space-y-4 pb-8">
      <PageHeader title="Contabilidad" subtitle="Gestoría externa — conciliación, notas cerradas, subida masiva y descarga en bloque" />

      {/* Selector de periodo compartido */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Periodo</label>
          <MobileSelect value={granularidad} onValueChange={setGranularidad} placeholder="Granularidad" triggerClassName="w-32">
            <MobileSelectItem value="mes">Mes</MobileSelectItem>
            <MobileSelectItem value="trimestre">Trimestre</MobileSelectItem>
            <MobileSelectItem value="anio">Año</MobileSelectItem>
          </MobileSelect>
        </div>
        {granularidad === 'mes' && (
          <>
            <Input type="number" min="2000" max="2100" value={mesAnio} onChange={e => setMesAnio(e.target.value)} className="w-24" aria-label="Año del mes" />
            <MobileSelect value={mesMes} onValueChange={setMesMes} placeholder="Mes" triggerClassName="w-32">
              <MobileSelectItem value="1">Enero</MobileSelectItem><MobileSelectItem value="2">Febrero</MobileSelectItem>
              <MobileSelectItem value="3">Marzo</MobileSelectItem><MobileSelectItem value="4">Abril</MobileSelectItem>
              <MobileSelectItem value="5">Mayo</MobileSelectItem><MobileSelectItem value="6">Junio</MobileSelectItem>
              <MobileSelectItem value="7">Julio</MobileSelectItem><MobileSelectItem value="8">Agosto</MobileSelectItem>
              <MobileSelectItem value="9">Septiembre</MobileSelectItem><MobileSelectItem value="10">Octubre</MobileSelectItem>
              <MobileSelectItem value="11">Noviembre</MobileSelectItem><MobileSelectItem value="12">Diciembre</MobileSelectItem>
            </MobileSelect>
          </>
        )}
        {granularidad === 'trimestre' && (
          <>
            <Input type="number" min="2000" max="2100" value={trimestreAnio} onChange={e => setTrimestreAnio(e.target.value)} className="w-24" aria-label="Año del trimestre" />
            <MobileSelect value={trimestreQ} onValueChange={setTrimestreQ} placeholder="Trim." triggerClassName="w-28">
              <MobileSelectItem value="1">T1 (Ene–Mar)</MobileSelectItem>
              <MobileSelectItem value="2">T2 (Abr–Jun)</MobileSelectItem>
              <MobileSelectItem value="3">T3 (Jul–Sep)</MobileSelectItem>
              <MobileSelectItem value="4">T4 (Oct–Dic)</MobileSelectItem>
            </MobileSelect>
          </>
        )}
        {granularidad === 'anio' && (
          <Input type="number" min="2000" max="2100" value={anioValor} onChange={e => setAnioValor(e.target.value)} className="w-28" aria-label="Año" />
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="conciliacion" className="gap-1.5"><ClipboardCheck className="w-3.5 h-3.5" /> Conciliación</TabsTrigger>
          <TabsTrigger value="notas" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Notas cerradas</TabsTrigger>
          <TabsTrigger value="subida" className="gap-1.5"><UploadCloud className="w-3.5 h-3.5" /> Subida masiva</TabsTrigger>
          <TabsTrigger value="descarga" className="gap-1.5"><Download className="w-3.5 h-3.5" /> Descarga en bloque</TabsTrigger>
        </TabsList>

        <TabsContent value="conciliacion"><ConciliacionPanel rango={rango} periodoKey={periodoKey} /></TabsContent>
        <TabsContent value="notas"><NotasCerradasPanel rango={rango} periodoKey={periodoKey} /></TabsContent>
        <TabsContent value="subida">{puedeSubida ? <SubidaMasivaPanel /> : <p className="text-xs text-muted-foreground text-center py-8">Solo contabilidad/administración/gerencia/admin pueden subir justificantes en bloque.</p>}</TabsContent>
        <TabsContent value="descarga"><DescargaBloquePanel rango={rango} /></TabsContent>
      </Tabs>
    </div>
  );
}