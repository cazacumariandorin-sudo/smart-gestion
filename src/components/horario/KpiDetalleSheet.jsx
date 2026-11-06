import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, CalendarDays, UserX, Users, AlertTriangle, SearchX } from 'lucide-react';

function minutosATexto(mins) {
  if (!mins || mins <= 0) return '0h';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const fechaCorta = (key) => {
  try { return format(parseISO(key), 'EEE d MMM', { locale: es }); } catch { return key; }
};
const fechaLarga = (key) => {
  try { return format(parseISO(key), "EEEE d 'de' MMMM", { locale: es }); } catch { return key; }
};

const INFO = {
  horas: {
    titulo: 'Horas del mes',
    desc: 'Suma de las horas netas de todos los fichajes del mes: salida menos entrada, descontando la pausa de comida.',
    icon: Clock,
  },
  dias: {
    titulo: 'Días trabajados',
    desc: 'Días del mes con al menos un fichaje registrado, con cuántas personas y cuántas horas suman.',
    icon: CalendarDays,
  },
  ausencias: {
    titulo: 'Días con ausencia',
    desc: 'Días del mes con vacaciones, bajas, permisos o faltas registradas en el calendario laboral.',
    icon: UserX,
  },
  trabajadores: {
    titulo: 'Trabajadores',
    desc: 'Personas distintas con al menos un fichaje en el mes, con sus días y horas acumuladas.',
    icon: Users,
  },
  sinSalida: {
    titulo: 'Fichajes sin salida',
    desc: 'Registros con entrada pero sin hora de salida: la jornada quedó abierta ese día.',
    icon: AlertTriangle,
  },
};

function Fila({ principal, secundario, valor, alerta }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="font-semibold truncate capitalize">{principal}</p>
        {secundario && <p className="text-[10px] text-muted-foreground truncate">{secundario}</p>}
      </div>
      <span className={cn('font-mono font-bold shrink-0', alerta ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
        {valor}
      </span>
    </div>
  );
}

function Vacio({ texto }) {
  return (
    <div className="py-10 text-center">
      <SearchX className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-50" />
      <p className="text-xs text-muted-foreground">{texto}</p>
    </div>
  );
}

export default function KpiDetalleSheet({ tipo, open, onClose, resumen, mesLabel }) {
  if (!tipo) return null;
  const info = INFO[tipo];
  const Icon = info.icon;

  let contenido = null;

  if (tipo === 'horas') {
    const total = resumen.personas.reduce((s, p) => s + p.mins, 0);
    contenido = resumen.personas.length === 0
      ? <Vacio texto="Sin fichajes este mes" />
      : (
        <>
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground">Total del mes</span>
            <span className="font-bold text-primary">{minutosATexto(total)}</span>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            {resumen.personas.map(p => (
              <Fila key={p.id} principal={p.name} secundario={`${p.dias} día${p.dias !== 1 ? 's' : ''}`} valor={minutosATexto(p.mins)} />
            ))}
          </div>
        </>
      );
  }

  if (tipo === 'dias') {
    contenido = resumen.diasTrabajados.length === 0
      ? <Vacio texto="Sin días trabajados este mes" />
      : (
        <div className="rounded-xl border border-border overflow-hidden">
          {resumen.diasTrabajados.map(d => (
            <Fila
              key={d.key}
              principal={fechaLarga(d.key)}
              secundario={`${d.numPersonas} persona${d.numPersonas !== 1 ? 's' : ''}`}
              valor={minutosATexto(d.mins)}
              alerta={d.mins === 0}
            />
          ))}
        </div>
      );
  }

  if (tipo === 'ausencias') {
    contenido = resumen.ausenciasLista.length === 0
      ? <Vacio texto="Sin ausencias registradas este mes" />
      : (
        <div className="rounded-xl border border-border overflow-hidden">
          {resumen.ausenciasLista.map(a => (
            <div key={a.key} className="flex items-center justify-between gap-3 px-3 py-2 text-xs border-b border-border/50 last:border-0">
              <div className="min-w-0">
                <p className="font-semibold truncate">{a.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{fechaCorta(a.date)}</p>
              </div>
              <span className={cn('px-1.5 py-0.5 rounded border text-[9px] font-semibold shrink-0', a.soft)}>{a.tipoLabel}</span>
            </div>
          ))}
        </div>
      );
  }

  if (tipo === 'trabajadores') {
    contenido = resumen.personas.length === 0
      ? <Vacio texto="Sin trabajadores con fichajes este mes" />
      : (
        <div className="rounded-xl border border-border overflow-hidden">
          {resumen.personas.map(p => (
            <Fila key={p.id} principal={p.name} secundario={`${p.dias} día${p.dias !== 1 ? 's' : ''} con fichaje`} valor={minutosATexto(p.mins)} />
          ))}
        </div>
      );
  }

  if (tipo === 'sinSalida') {
    contenido = resumen.sinSalidaLista.length === 0
      ? <Vacio texto="No hay fichajes abiertos este mes" />
      : (
        <div className="rounded-xl border border-border overflow-hidden">
          {resumen.sinSalidaLista.map(s => (
            <Fila
              key={s.id}
              principal={s.name}
              secundario={`${fechaCorta(s.date)} · entrada ${s.entrada}${s.project ? ` · ${s.project}` : ''}`}
              valor="--:--"
              alerta
            />
          ))}
        </div>
      );
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-3">
          <SheetTitle className="text-base flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" /> {info.titulo}
          </SheetTitle>
          <p className="text-[11px] text-muted-foreground leading-snug mt-1">{info.desc}</p>
          {mesLabel && <p className="text-[11px] font-semibold capitalize text-foreground mt-1">{mesLabel}</p>}
        </SheetHeader>
        {contenido}
      </SheetContent>
    </Sheet>
  );
}