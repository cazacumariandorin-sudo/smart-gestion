import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PLANES } from '@/lib/planes';

export default function EditorPlanes({ planes = [], onChange }) {
  const [abierto, setAbierto] = useState(false);
  const actualizar = (i, campo, valor) => {
    onChange(planes.map((p, j) => (j === i ? { ...p, [campo]: valor } : p)));
  };

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
      >
        Planes que se ofrecen · {planes.length}
        {abierto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {abierto && (
        <div className="border-t p-3 space-y-3">
          {planes.map((p, i) => (
            <div key={i} className="rounded-md border p-2 space-y-2">
              <div className="flex gap-2">
                <select
                  value={p.clave || 'completo'}
                  onChange={(e) => actualizar(i, 'clave', e.target.value)}
                  className="h-9 rounded-md border bg-background px-2 text-xs"
                >
                  {PLANES.map((pl) => <option key={pl.key} value={pl.key}>{pl.label}</option>)}
                </select>
                <Input value={p.nombre || ''} onChange={(e) => actualizar(i, 'nombre', e.target.value)} placeholder="Nombre comercial" />
                <Button
                  type="button" variant="ghost" size="icon" aria-label="Quitar"
                  onClick={() => onChange(planes.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[11px]">Precio</Label>
                  <Input value={p.precio || ''} onChange={(e) => actualizar(i, 'precio', e.target.value)} placeholder="A consultar" />
                </div>
                <div>
                  <Label className="text-[11px]">Periodo</Label>
                  <Input value={p.periodo || ''} onChange={(e) => actualizar(i, 'periodo', e.target.value)} placeholder="mes / año" />
                </div>
              </div>
              <Textarea
                value={p.resumen || ''}
                onChange={(e) => actualizar(i, 'resumen', e.target.value)}
                rows={2}
                placeholder="Resumen del plan"
              />
              <Textarea
                value={(p.incluye || []).join('\n')}
                onChange={(e) => actualizar(i, 'incluye', e.target.value.split('\n').filter(Boolean))}
                rows={3}
                placeholder="Una línea por concepto incluido"
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={p.destacado === true}
                  onChange={(e) => actualizar(i, 'destacado', e.target.checked)}
                />
                Destacar este plan
              </label>
            </div>
          ))}
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => onChange([...planes, { clave: 'completo', nombre: '', precio: 'A consultar', periodo: '', resumen: '', incluye: [], destacado: false }])}
          >
            <Plus className="h-4 w-4" /> Añadir plan
          </Button>
        </div>
      )}
    </div>
  );
}