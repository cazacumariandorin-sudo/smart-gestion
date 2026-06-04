import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Save, Lock, ShieldCheck, Loader2, Edit3, Eye } from 'lucide-react';
import { toast } from 'sonner';

const CLAVE = 'normas_globales';

const CAMPOS = [
  {
    key: 'empresa_nombre',
    label: 'Nombre de la empresa',
    placeholder: 'Ej: SIMANTEC S.L.',
    tipo: 'input',
  },
  {
    key: 'empresa_sector',
    label: 'Sector / Actividad',
    placeholder: 'Ej: Construcción civil, instalaciones solares, obra pública...',
    tipo: 'input',
  },
  {
    key: 'entorno_descripcion',
    label: 'Entorno de trabajo',
    placeholder: 'Describe la estructura de la empresa, tipos de proyectos habituales, terminología interna...',
    tipo: 'textarea',
    rows: 4,
  },
  {
    key: 'normas_internas',
    label: 'Normas internas',
    placeholder: 'Ej: No compartir datos de salarios con operarios. La jornada laboral es de 8h. Solo gerencia puede aprobar gastos superiores a 500€...',
    tipo: 'textarea',
    rows: 5,
  },
  {
    key: 'directrices_comportamiento',
    label: 'Directrices de comportamiento del asistente',
    placeholder: 'Ej: Responde siempre en español formal. Sé conciso. Prioriza alertas de seguridad. No hagas suposiciones sin datos...',
    tipo: 'textarea',
    rows: 4,
  },
  {
    key: 'informacion_adicional',
    label: 'Información adicional',
    placeholder: 'Cualquier otro dato relevante que el asistente deba conocer siempre...',
    tipo: 'textarea',
    rows: 3,
  },
];

export default function AsistenteConfigPanel({ currentUser }) {
  const [config, setConfig] = useState(null);
  const [configId, setConfigId] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const isGerencia = currentUser?.role === 'gerencia';

  useEffect(() => {
    cargarConfig();
  }, []);

  const cargarConfig = async () => {
    setLoading(true);
    try {
      const configs = await base44.entities.AsistenteConfig.filter({ clave: CLAVE });
      if (configs && configs.length > 0) {
        const c = configs[0];
        setConfig(c);
        setConfigId(c.id);
        setForm({
          empresa_nombre: c.empresa_nombre || '',
          empresa_sector: c.empresa_sector || '',
          entorno_descripcion: c.entorno_descripcion || '',
          normas_internas: c.normas_internas || '',
          directrices_comportamiento: c.directrices_comportamiento || '',
          informacion_adicional: c.informacion_adicional || '',
        });
      } else {
        setForm({
          empresa_nombre: '',
          empresa_sector: '',
          entorno_descripcion: '',
          normas_internas: '',
          directrices_comportamiento: '',
          informacion_adicional: '',
        });
      }
    } catch (e) {
      toast.error('Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const datos = {
        ...form,
        clave: CLAVE,
        ultima_modificacion_por: currentUser?.email,
        ultima_modificacion_nombre: currentUser?.full_name,
      };

      if (configId) {
        await base44.entities.AsistenteConfig.update(configId, datos);
      } else {
        const nueva = await base44.entities.AsistenteConfig.create(datos);
        setConfigId(nueva.id);
      }

      setConfig({ ...datos, id: configId });
      setEditMode(false);
      toast.success('Configuración guardada correctamente');
    } catch (e) {
      toast.error('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelar = () => {
    if (config) {
      setForm({
        empresa_nombre: config.empresa_nombre || '',
        empresa_sector: config.empresa_sector || '',
        entorno_descripcion: config.entorno_descripcion || '',
        normas_internas: config.normas_internas || '',
        directrices_comportamiento: config.directrices_comportamiento || '',
        informacion_adicional: config.informacion_adicional || '',
      });
    }
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold">Normas y Directrices</span>
          </div>
          {isGerencia && !editMode && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => setEditMode(true)}
            >
              <Edit3 className="w-3 h-3" />
              Editar
            </Button>
          )}
          {!isGerencia && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              Solo lectura
            </div>
          )}
        </div>

        {config?.ultima_modificacion_nombre && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Última modificación por {config.ultima_modificacion_nombre}
          </p>
        )}

        {!isGerencia && (
          <div className="mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
            Estas normas son establecidas por gerencia y el asistente las aplica en todas las conversaciones.
          </div>
        )}
      </div>

      {/* Campos */}
      <div className="flex-1 p-4 space-y-4">
        {CAMPOS.map(campo => (
          <div key={campo.key}>
            <label className="text-xs font-medium text-foreground mb-1 block">
              {campo.label}
            </label>
            {editMode && isGerencia ? (
              campo.tipo === 'textarea' ? (
                <textarea
                  value={form[campo.key] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [campo.key]: e.target.value }))}
                  placeholder={campo.placeholder}
                  rows={campo.rows || 3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground resize-none"
                />
              ) : (
                <input
                  value={form[campo.key] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [campo.key]: e.target.value }))}
                  placeholder={campo.placeholder}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                />
              )
            ) : (
              <div className={`rounded-md border border-border bg-muted/30 px-3 py-2 text-sm min-h-[38px] ${!form[campo.key] ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                {form[campo.key]
                  ? campo.tipo === 'textarea'
                    ? <pre className="whitespace-pre-wrap font-sans text-sm">{form[campo.key]}</pre>
                    : form[campo.key]
                  : 'Sin configurar'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Botones guardar (solo gerencia en modo edición) */}
      {isGerencia && editMode && (
        <div className="p-4 border-t border-border flex gap-2 shrink-0">
          <Button variant="outline" className="flex-1 h-9 text-sm" onClick={cancelar} disabled={saving}>
            Cancelar
          </Button>
          <Button className="flex-1 h-9 text-sm bg-blue-600 hover:bg-blue-700 gap-1" onClick={guardar} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar
          </Button>
        </div>
      )}
    </div>
  );
}