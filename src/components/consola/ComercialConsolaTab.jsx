import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ImagePlus, Loader2, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { cargarInfoComercial, guardarInfoComercial } from '@/lib/infoComercial';
import EditorModulos from './EditorModulos';
import EditorPlanes from './EditorPlanes';

/** Editor de la información comercial y publicitaria que ve el cliente. */
export default function ComercialConsolaTab() {
  const { user } = useAuth();
  const [info, setInfo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState('');

  useEffect(() => {
    cargarInfoComercial().then(setInfo);
  }, []);

  const set = (campo, valor) => setInfo((i) => ({ ...i, [campo]: valor }));

  const subirImagen = async (file, campo) => {
    if (!file) return;
    setSubiendo(campo);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      set(campo, res.file_url);
    } catch (e) {
      toast({ title: 'No se pudo subir la imagen', description: e?.message, variant: 'destructive' });
    } finally {
      setSubiendo('');
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const guardado = await guardarInfoComercial(info, user?.email);
      setInfo((i) => ({ ...i, _registro: guardado }));
      toast({ title: 'Información comercial guardada' });
    } catch (e) {
      toast({ title: 'No se pudo guardar', description: e?.message, variant: 'destructive' });
    } finally {
      setGuardando(false);
    }
  };

  if (!info) {
    return <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const subirBoton = (campo, etiqueta) => (
    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-accent">
      {subiendo === campo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
      {subiendo === campo ? 'Subiendo…' : etiqueta}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => subirImagen(e.target.files?.[0], campo)}
        disabled={subiendo === campo}
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground flex-1">
          Esto es lo que ve un posible cliente en la presentación y en la demo.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/presentacion" target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> Ver presentación
          </Link>
        </Button>
        <Button size="sm" onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Marca</Label>
          <Input value={info.marca || ''} onChange={(e) => set('marca', e.target.value)} />
        </div>
        <div>
          <Label>Botón principal</Label>
          <Input value={info.cta_boton || ''} onChange={(e) => set('cta_boton', e.target.value)} />
        </div>
        <div>
          <Label>Logotipo</Label>
          <div className="flex items-center gap-3 mt-1">
            {info.logo_url ? <img src={info.logo_url} alt="Logo" className="h-12 w-12 object-contain bg-white border rounded-lg" /> : null}
            {subirBoton('logo_url', 'Subir logo')}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Imagen pública: cualquiera con el enlace puede abrirla.</p>
        </div>
        <div>
          <Label>Imagen de cabecera</Label>
          <div className="flex items-center gap-3 mt-1">
            {info.hero_url ? <img src={info.hero_url} alt="Cabecera" className="h-12 w-20 object-cover bg-white border rounded-lg" /> : null}
            {subirBoton('hero_url', 'Subir imagen')}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Imagen pública: cualquiera con el enlace puede abrirla.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label>Titular</Label>
          <Input value={info.titular || ''} onChange={(e) => set('titular', e.target.value)} />
        </div>
        <div>
          <Label>Subtítulo</Label>
          <Textarea value={info.subtitulo || ''} onChange={(e) => set('subtitulo', e.target.value)} rows={2} />
        </div>
        <div>
          <Label>Descripción</Label>
          <Textarea value={info.descripcion || ''} onChange={(e) => set('descripcion', e.target.value)} rows={3} />
        </div>
        <div>
          <Label>Ventajas (una por línea)</Label>
          <Textarea
            value={(info.propuesta_valor || []).join('\n')}
            onChange={(e) => set('propuesta_valor', e.target.value.split('\n').filter(Boolean))}
            rows={4}
          />
        </div>
      </div>

      <EditorModulos modulos={info.modulos || []} onChange={(v) => set('modulos', v)} />
      <EditorPlanes planes={info.planes || []} onChange={(v) => set('planes', v)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Título del cierre</Label>
          <Input value={info.cta_titulo || ''} onChange={(e) => set('cta_titulo', e.target.value)} />
        </div>
        <div>
          <Label>Texto del cierre</Label>
          <Input value={info.cta_texto || ''} onChange={(e) => set('cta_texto', e.target.value)} />
        </div>
        <div>
          <Label>Email de contacto</Label>
          <Input type="email" value={info.contacto_email || ''} onChange={(e) => set('contacto_email', e.target.value)} />
        </div>
        <div>
          <Label>Teléfono de contacto</Label>
          <Input value={info.contacto_telefono || ''} onChange={(e) => set('contacto_telefono', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Aviso legal de la demo</Label>
          <Textarea value={info.nota_legal || ''} onChange={(e) => set('nota_legal', e.target.value)} rows={2} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}