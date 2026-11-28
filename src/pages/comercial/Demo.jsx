import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicShell from '@/components/comercial/PublicShell';
import DemoGuiada from '@/components/comercial/DemoGuiada';
import { Button } from '@/components/ui/button';
import { cargarInfoComercial, INFO_DEFECTO } from '@/lib/infoComercial';

export default function Demo() {
  const [info, setInfo] = useState(INFO_DEFECTO);
  const navigate = useNavigate();

  useEffect(() => {
    cargarInfoComercial().then(setInfo);
  }, []);

  return (
    <PublicShell marca={info.marca} logo={info.logo_url}>
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Demo guiada</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Cinco pasos para ver cómo se trabaja de verdad. Al terminar puedes entrar al espacio de prueba
          y moverte por la app con datos ficticios.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-10">
        <DemoGuiada onFinish={() => navigate('/demo/espacio')} />
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-12">
        <div className="rounded-2xl border bg-muted/30 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h2 className="font-semibold">¿Prefieres verlo con tus datos?</h2>
            <p className="text-sm text-muted-foreground mt-1">{info.cta_texto}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/presentacion">Ver planes</Link>
            </Button>
            <Button asChild>
              <Link to="/solicitar-version?origen=demo">{info.cta_boton || 'Solicitar versión comercial'}</Link>
            </Button>
          </div>
        </div>
        {info.nota_legal && <p className="mt-3 text-[11px] text-muted-foreground">{info.nota_legal}</p>}
      </section>
    </PublicShell>
  );
}