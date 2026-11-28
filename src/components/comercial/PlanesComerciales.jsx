import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PlanesComerciales({ planes = [], ctaBoton }) {
  if (!planes.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {planes.map((p, i) => (
        <div
          key={`${p.clave}-${i}`}
          className={`rounded-xl border p-5 flex flex-col gap-3 bg-card ${p.destacado ? 'border-primary shadow-sm' : ''}`}
        >
          <div>
            <h3 className="font-semibold leading-tight">{p.nombre}</h3>
            <p className="text-xs text-muted-foreground mt-1">{p.resumen}</p>
          </div>
          <div className="mt-auto">
            <div className="text-2xl font-semibold tracking-tight">{p.precio || 'A consultar'}</div>
            {p.periodo ? <div className="text-xs text-muted-foreground">{p.periodo}</div> : null}
          </div>
          {(p.incluye || []).length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {p.incluye.map((linea, j) => (
                <li key={j} className="flex gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{linea}</span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant={p.destacado ? 'default' : 'outline'} size="sm" className="mt-1">
            <Link to={`/solicitar-version?plan=${encodeURIComponent(p.clave || '')}`}>
              {ctaBoton || 'Solicitar información'} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ))}
    </div>
  );
}