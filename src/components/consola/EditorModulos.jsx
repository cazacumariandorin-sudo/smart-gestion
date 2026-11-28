import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const ICONOS = [
  ['obras', 'Obras'], ['solar', 'Solar'], ['horario', 'Horario'], ['nominas', 'Nóminas'],
  ['presupuestos', 'Presupuestos'], ['materiales', 'Materiales'], ['flota', 'Flota'], ['chat', 'Chat'],
];

export default function EditorModulos({ modulos = [], onChange }) {
  const [abierto, setAbierto] = useState(false);
  const actualizar = (i, campo, valor) => {
    onChange(modulos.map((m, j) => (j === i ? { ...m, [campo]: valor } : m)));
  };
  const mover = (i, dir) => {
    const destino = i + dir;
    if (destino < 0 || destino >= modulos.length) return;
    const copia = [...modulos];
    [copia[i], copia[destino]] = [copia[destino], copia[i]];
    onChange(copia);
  };

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium"
      >
        Módulos que se presentan · {modulos.length}
        {abierto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {abierto && (
        <div className="border-t p-3 space-y-2">
          {modulos.map((m, i) => (
            <div key={i} className="rounded-md border p-2 space-y-2">
              <div className="flex gap-2">
                <select
                  value={m.icono || 'obras'}
                  onChange={(e) => actualizar(i, 'icono', e.target.value)}
                  className="h-9 rounded-md border bg-background px-2 text-xs"
                >
                  {ICONOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <Input value={m.titulo || ''} onChange={(e) => actualizar(i, 'titulo', e.target.value)} placeholder="Título" />
                <Button type="button" variant="ghost" size="icon" onClick={() => mover(i, -1)} aria-label="Subir">
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => mover(i, 1)} aria-label="Bajar">
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button" variant="ghost" size="icon" aria-label="Quitar"
                  onClick={() => onChange(modulos.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                value={m.descripcion || ''}
                onChange={(e) => actualizar(i, 'descripcion', e.target.value)}
                rows={2}
                placeholder="Qué resuelve"
              />
            </div>
          ))}
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => onChange([...modulos, { icono: 'obras', titulo: '', descripcion: '' }])}
          >
            <Plus className="h-4 w-4" /> Añadir módulo
          </Button>
        </div>
      )}
    </div>
  );
}