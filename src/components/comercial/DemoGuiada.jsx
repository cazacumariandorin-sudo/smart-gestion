import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PASOS = [
  {
    titulo: 'Entra y ve lo que toca hoy',
    descripcion: 'El inicio reúne obras activas, fichajes del día, partes pendientes y avisos. Cada persona ve solo lo que su rol y su empresa permiten.',
    puntos: ['Obras con avance real', 'Fichajes del día', 'Avisos y tareas'],
    panel: {
      cabecera: 'Inicio · Residencial Los Olmos',
      filas: [
        ['Obras activas', '3'],
        ['Fichajes abiertos', '2'],
        ['Partes sin firmar', '1'],
        ['Presupuestos enviados', '2'],
      ],
    },
  },
  {
    titulo: 'Ficha el tiempo desde el móvil',
    descripcion: 'El trabajador ficha entrada y salida, se le asigna la obra y el sistema completa los huecos según el calendario laboral. Todo queda en el registro legal.',
    puntos: ['Fichaje con obra', 'Cierre automático', 'Registro legal exportable'],
    panel: {
      cabecera: 'Control horario · hoy',
      filas: [
        ['A. Ramírez', '07:55 · en obra'],
        ['J. Molina', '08:02 · en obra'],
        ['L. Ferrer', 'sin fichar'],
      ],
    },
  },
  {
    titulo: 'Del parte al presupuesto',
    descripcion: 'El parte diario recoge operarios, materiales y fotos. Con esos datos se genera el presupuesto, se versiona cada cambio y sale el PDF con tu logo.',
    puntos: ['Partes con fotos', 'Partidas desde partes', 'PDF con tu marca'],
    panel: {
      cabecera: 'Presupuesto PRE-2026-00012',
      filas: [
        ['Cliente', 'Inmobiliaria Delta'],
        ['Base imponible', '18.420,00 €'],
        ['IVA', '3.868,20 €'],
        ['Total', '22.288,20 €'],
      ],
    },
  },
  {
    titulo: 'Controla gastos y flota',
    descripcion: 'Cada gasto entra con su justificante fotografiado, se clasifica por obra y se concilia con el ciclo mensual. Los vehículos llevan repostajes, multas y avisos.',
    puntos: ['Gastos con foto', 'Ciclos mensuales', 'Multas y repostajes'],
    panel: {
      cabecera: 'Gastos · noviembre',
      filas: [
        ['Repostaje furgoneta 4821', '86,40 €'],
        ['Material obra Los Olmos', '412,15 €'],
        ['Dietas equipo', '95,00 €'],
      ],
    },
  },
  {
    titulo: 'Cada empresa, en su espacio',
    descripcion: 'Los datos de una empresa no se mezclan con los de otra. El propietario supervisa todas desde su consola y entra en la que necesite.',
    puntos: ['Aislamiento por empresa', 'Administrador local', 'Consola del propietario'],
    panel: {
      cabecera: 'Consola · empresas',
      filas: [
        ['SIMANTEC S.L', 'Completo · activa'],
        ['NICUTA CAZACU', 'Control horario'],
        ['Nueva empresa', 'pendiente de alta'],
      ],
    },
  },
];

export default function DemoGuiada({ onFinish }) {
  const [paso, setPaso] = useState(0);
  const actual = PASOS[paso];
  const ultimo = paso === PASOS.length - 1;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <div>
        <ol className="space-y-1">
          {PASOS.map((p, i) => (
            <li key={p.titulo}>
              <button
                type="button"
                onClick={() => setPaso(i)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  i === paso ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                }`}
              >
                <span className={`h-5 w-5 rounded-full text-[11px] flex items-center justify-center border shrink-0 ${
                  i < paso ? 'bg-emerald-600 border-emerald-600 text-white' : i === paso ? 'border-primary text-primary' : 'border-border text-muted-foreground'
                }`}>
                  {i < paso ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                </span>
                <span className="truncate">{p.titulo}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-xl border bg-card p-4">
          <h3 className="font-semibold leading-tight">{actual.titulo}</h3>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{actual.descripcion}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {actual.puntos.map((p) => (
              <li key={p} className="text-[11px] rounded-full border bg-muted/40 px-2 py-0.5 text-muted-foreground">{p}</li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPaso((p) => Math.max(0, p - 1))} disabled={paso === 0}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            {ultimo ? (
              <Button size="sm" onClick={onFinish}>
                Probar el espacio <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setPaso((p) => Math.min(PASOS.length - 1, p + 1))}>
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">{actual.panel.cabecera}</div>
        <div className="p-4 space-y-2">
          {actual.panel.filas.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
              <span className="truncate">{etiqueta}</span>
              <span className="text-xs text-muted-foreground shrink-0">{valor}</span>
            </div>
          ))}
        </div>
        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          Datos de ejemplo · <Link to="/demo/espacio" className="underline">abrir espacio de prueba</Link>
        </div>
      </div>
    </div>
  );
}