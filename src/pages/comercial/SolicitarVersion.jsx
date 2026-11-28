import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import PublicShell from '@/components/comercial/PublicShell';
import SolicitudComercialForm from '@/components/comercial/SolicitudComercialForm';
import { cargarInfoComercial, INFO_DEFECTO } from '@/lib/infoComercial';

export default function SolicitarVersion() {
  const [info, setInfo] = useState(INFO_DEFECTO);
  const params = new URLSearchParams(window.location.search);
  const planInicial = params.get('plan') || '';
  const origen = params.get('origen') === 'demo' ? 'demo' : 'presentacion';

  useEffect(() => {
    cargarInfoComercial().then(setInfo);
  }, []);

  return (
    <PublicShell marca={info.marca} logo={info.logo_url}>
      <section className="max-w-5xl mx-auto px-4 pt-8 pb-12">
        <Link to="/presentacion" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a la presentación
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Solicitar versión comercial</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Cuéntanos cómo trabaja tu empresa y te preparamos una propuesta con el plan que encaje. No se
              crea ninguna cuenta ni se asigna ningún acceso hasta que tú lo confirmes.
            </p>
            <ul className="mt-5 space-y-2 text-sm">
              {[
                'Propuesta con el plan y los módulos que necesitas',
                'Espacio propio de tu empresa, aislado del resto',
                'Alta guiada de tu equipo con permisos por persona',
              ].map((linea) => (
                <li key={linea} className="flex gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{linea}</span>
                </li>
              ))}
            </ul>
            {(info.contacto_email || info.contacto_telefono) && (
              <p className="mt-5 text-xs text-muted-foreground">
                {info.contacto_email}{info.contacto_email && info.contacto_telefono ? ' · ' : ''}{info.contacto_telefono}
              </p>
            )}
          </div>

          <SolicitudComercialForm planes={info.planes} planInicial={planInicial} origen={origen} />
        </div>
      </section>
    </PublicShell>
  );
}