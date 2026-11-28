import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PlayCircle, ShieldCheck, Check } from 'lucide-react';
import PublicShell from '@/components/comercial/PublicShell';
import ModulosComerciales from '@/components/comercial/ModulosComerciales';
import PlanesComerciales from '@/components/comercial/PlanesComerciales';
import { Button } from '@/components/ui/button';
import { cargarInfoComercial, INFO_DEFECTO } from '@/lib/infoComercial';

export default function Presentacion() {
  const [info, setInfo] = useState(INFO_DEFECTO);

  useEffect(() => {
    cargarInfoComercial().then(setInfo);
  }, []);

  return (
    <PublicShell marca={info.marca} logo={info.logo_url}>
      <section className="max-w-6xl mx-auto px-4 pt-12 pb-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Un espacio aislado por empresa
          </span>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.1]">
            {info.titular}
          </h1>
          <p className="mt-4 text-base text-muted-foreground leading-relaxed max-w-xl">{info.subtitulo}</p>

          {(info.propuesta_valor || []).length > 0 && (
            <ul className="mt-6 space-y-2">
              {info.propuesta_valor.map((linea, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{linea}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-7 flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link to="/solicitar-version">
                {info.cta_boton || 'Solicitar versión comercial'} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/demo">
                <PlayCircle className="h-4 w-4" /> Ver la demo
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-2 shadow-sm overflow-hidden">
          {info.hero_url ? (
            <img src={info.hero_url} alt={info.marca} className="w-full rounded-xl object-cover" />
          ) : (
            <div className="rounded-xl bg-gradient-to-br from-slate-900 to-blue-800 p-5 text-white">
              <div className="text-[11px] uppercase tracking-widest text-white/60">Hoy en obra</div>
              <div className="mt-3 space-y-2 text-sm">
                {[
                  ['Residencial Los Olmos', '62 % ejecutado'],
                  ['Cubierta FV Nave 4', '35 % ejecutado'],
                  ['Reforma oficinas Centro', 'pausada'],
                ].map(([obra, estado]) => (
                  <div key={obra} className="flex items-center justify-between gap-3 rounded-lg bg-white/10 px-3 py-2">
                    <span className="truncate">{obra}</span>
                    <span className="text-[11px] text-white/70 shrink-0">{estado}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[['12', 'fichajes hoy'], ['4', 'partes'], ['2', 'presupuestos']].map(([n, l]) => (
                  <div key={l} className="rounded-lg bg-white/10 py-2">
                    <div className="text-lg font-semibold leading-none">{n}</div>
                    <div className="text-[10px] text-white/60 mt-1">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-xl font-semibold tracking-tight">Todo lo que hace tu empresa, en un módulo</h2>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{info.descripcion}</p>
        <div className="mt-6">
          <ModulosComerciales modulos={info.modulos} />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-xl font-semibold tracking-tight">Planes</h2>
        <p className="mt-1 text-sm text-muted-foreground">El plan recorta qué módulos ve la plantilla. Los permisos por persona no cambian.</p>
        <div className="mt-6">
          <PlanesComerciales planes={info.planes} ctaBoton="Solicitar información" />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-10">
        <div className="rounded-2xl border bg-muted/30 p-6 sm:p-8 flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="flex-1">
            <h2 className="text-lg font-semibold tracking-tight">{info.cta_titulo}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{info.cta_texto}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/demo/espacio">Espacio de prueba</Link>
            </Button>
            <Button asChild>
              <Link to="/solicitar-version">{info.cta_boton || 'Solicitar versión comercial'}</Link>
            </Button>
          </div>
        </div>
        {(info.contacto_email || info.contacto_telefono) && (
          <p className="mt-4 text-xs text-muted-foreground">
            {info.contacto_email}
            {info.contacto_email && info.contacto_telefono ? ' · ' : ''}
            {info.contacto_telefono}
          </p>
        )}
      </section>
    </PublicShell>
  );
}