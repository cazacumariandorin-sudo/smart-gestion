import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RotateCcw, FlaskConical } from 'lucide-react';
import PublicShell from '@/components/comercial/PublicShell';
import { Button } from '@/components/ui/button';
import { INFO_DEFECTO } from '@/lib/infoComercial';

const OBRAS = [
  { id: 'o1', nombre: 'Residencial Los Olmos', cliente: 'Inmobiliaria Delta', estado: 'activa', avance: 62 },
  { id: 'o2', nombre: 'Cubierta FV Nave 4', cliente: 'Logística Sur', estado: 'activa', avance: 35 },
  { id: 'o3', nombre: 'Reforma oficinas Centro', cliente: 'Grupo Arenal', estado: 'pausada', avance: 18 },
];

const FICHAJES_INICIALES = [
  { id: 'f1', operario: 'A. Ramírez', obra: 'Residencial Los Olmos', entrada: '07:55', salida: '', estado: 'abierto' },
  { id: 'f2', operario: 'J. Molina', obra: 'Cubierta FV Nave 4', entrada: '08:02', salida: '', estado: 'abierto' },
  { id: 'f3', operario: 'L. Ferrer', obra: 'Reforma oficinas Centro', entrada: '08:10', salida: '13:00', estado: 'cerrado' },
];

const PRESUPUESTOS = [
  { codigo: 'PRE-2026-00012', cliente: 'Inmobiliaria Delta', importe: '18.420,00 €', estado: 'enviado' },
  { codigo: 'PRE-2026-00013', cliente: 'Logística Sur', importe: '7.980,00 €', estado: 'borrador' },
];

const GASTOS = [
  { concepto: 'Repostaje furgoneta 4821', importe: '86,40 €', tipo: 'Vehículo' },
  { concepto: 'Material obra Los Olmos', importe: '412,15 €', tipo: 'Material' },
  { concepto: 'Dietas equipo', importe: '95,00 €', tipo: 'Personal' },
];

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'obras', label: 'Obras' },
  { key: 'fichajes', label: 'Fichajes' },
  { key: 'presupuestos', label: 'Presupuestos' },
  { key: 'gastos', label: 'Gastos' },
];

export default function DemoEspacio() {
  const [tab, setTab] = useState('resumen');
  const [fichajes, setFichajes] = useState(FICHAJES_INICIALES);
  const [filtro, setFiltro] = useState('todas');

  const obrasFiltradas = useMemo(
    () => (filtro === 'todas' ? OBRAS : OBRAS.filter((o) => o.estado === filtro)),
    [filtro],
  );

  const abiertos = fichajes.filter((f) => f.estado === 'abierto').length;

  const cerrarFichaje = (id) => {
    setFichajes((lista) => lista.map((f) => (f.id === id ? { ...f, salida: '17:05', estado: 'cerrado' } : f)));
  };

  const reiniciar = () => {
    setFichajes(FICHAJES_INICIALES);
    setFiltro('todas');
    setTab('resumen');
  };

  return (
    <PublicShell marca={INFO_DEFECTO.marca} logo={INFO_DEFECTO.logo_url}>
      <section className="max-w-5xl mx-auto px-4 pt-8 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200 px-3 py-1 text-[11px]">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" /> Espacio de prueba · datos ficticios
          </span>
          <Button variant="ghost" size="sm" onClick={reiniciar} className="ml-auto">
            <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
          </Button>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Prueba la app</h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Puedes moverte y actuar sobre estos datos de ejemplo. Nada se guarda ni toca información real de
          ninguna empresa.
        </p>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-10">
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex gap-1 overflow-x-auto border-b bg-muted/40 px-2 py-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${
                  tab === t.key ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:bg-background/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === 'resumen' && (
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Obras activas', OBRAS.filter((o) => o.estado === 'activa').length],
                  ['Fichajes abiertos', abiertos],
                  ['Presupuestos', PRESUPUESTOS.length],
                ].map(([label, valor]) => (
                  <div key={label} className="rounded-lg border bg-background p-3">
                    <div className="text-2xl font-semibold leading-none">{valor}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
                  </div>
                ))}
                <div className="sm:col-span-3 rounded-lg border bg-background p-3">
                  <div className="text-xs font-medium mb-2">Últimos movimientos</div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>08:10 · L. Ferrer fichó salida en Reforma oficinas Centro</li>
                    <li>07:55 · A. Ramírez fichó entrada en Residencial Los Olmos</li>
                    <li>Ayer · Presupuesto PRE-2026-00012 enviado a Inmobiliaria Delta</li>
                  </ul>
                </div>
              </div>
            )}

            {tab === 'obras' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Estado</span>
                  <select
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="todas">Todas</option>
                    <option value="activa">Activas</option>
                    <option value="pausada">Pausadas</option>
                  </select>
                </div>
                {obrasFiltradas.map((o) => (
                  <div key={o.id} className="rounded-lg border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{o.nombre}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{o.estado}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{o.cliente}</div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${o.avance}%` }} />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{o.avance} % ejecutado</div>
                  </div>
                ))}
                {obrasFiltradas.length === 0 && <p className="text-xs text-muted-foreground py-4">Sin obras en este estado.</p>}
              </div>
            )}

            {tab === 'fichajes' && (
              <div className="space-y-2">
                {fichajes.map((f) => (
                  <div key={f.id} className="rounded-lg border bg-background p-3 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{f.operario}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {f.obra} · {f.entrada}{f.salida ? ` – ${f.salida}` : ''}
                      </div>
                    </div>
                    {f.estado === 'abierto' ? (
                      <Button size="sm" variant="outline" onClick={() => cerrarFichaje(f.id)}>Fichar salida</Button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">cerrado</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'presupuestos' && (
              <div className="space-y-2">
                {PRESUPUESTOS.map((p) => (
                  <div key={p.codigo} className="rounded-lg border bg-background p-3 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{p.codigo}</div>
                      <div className="text-[11px] text-muted-foreground">{p.cliente}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">{p.importe}</div>
                      <div className="text-[10px] text-muted-foreground">{p.estado}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'gastos' && (
              <div className="space-y-2">
                {GASTOS.map((g) => (
                  <div key={g.concepto} className="rounded-lg border bg-background p-3 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{g.concepto}</div>
                      <div className="text-[11px] text-muted-foreground">{g.tipo}</div>
                    </div>
                    <div className="text-sm shrink-0">{g.importe}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">{INFO_DEFECTO.nota_legal}</p>

        <div className="mt-6 rounded-2xl border bg-muted/30 p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h2 className="font-semibold text-sm">¿Te encaja?</h2>
            <p className="text-xs text-muted-foreground mt-1">Pide tu versión comercial y te preparamos el espacio de tu empresa.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/demo">Volver a la demo</Link></Button>
            <Button asChild>
              <Link to="/solicitar-version?origen=demo">Solicitar versión <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}