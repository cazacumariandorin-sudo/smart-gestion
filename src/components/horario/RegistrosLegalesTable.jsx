import { Checkbox } from '@/components/ui/checkbox';
import { ESTADO_LEGAL_META, ORIGEN_META } from '@/lib/registroLegalConstantes';

function EstadoBadge({ estado }) {
  const meta = ESTADO_LEGAL_META[estado] || ESTADO_LEGAL_META.provisional;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export default function RegistrosLegalesTable({ registros, selectable, selected, onToggle, onToggleAll }) {
  const todosSeleccionados = selectable && registros.length > 0 && selected.size === registros.length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-[10px] uppercase text-muted-foreground">
            <tr>
              {selectable && (
                <th className="px-3 py-2 w-10">
                  <Checkbox checked={todosSeleccionados} onCheckedChange={() => onToggleAll()} />
                </th>
              )}
              <th className="text-left font-semibold px-3 py-2">Trabajador</th>
              <th className="text-left font-semibold px-3 py-2">Fecha</th>
              <th className="text-right font-semibold px-3 py-2">Horas</th>
              <th className="text-left font-semibold px-3 py-2 hidden md:table-cell">Origen</th>
              <th className="text-left font-semibold px-3 py-2">Estado</th>
              <th className="text-left font-semibold px-3 py-2 hidden lg:table-cell">Validado por</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {registros.map((r) => (
              <tr key={r.id} className="hover:bg-primary/5 transition-colors">
                {selectable && (
                  <td className="px-3 py-2.5">
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => onToggle(r.id)} />
                  </td>
                )}
                <td className="px-3 py-2.5">
                  <p className="font-semibold truncate max-w-[180px]">{r.operario_name || '—'}</p>
                  <p className="text-[10px] text-muted-foreground">v{r.version_legal || 1}{r.dia_semana ? ` · ${r.dia_semana}` : ''}</p>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{r.fecha}</td>
                <td className="px-3 py-2.5 text-right font-bold text-primary whitespace-nowrap">
                  {Number(r.horas_trabajadas || 0).toFixed(1)} h
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground text-xs">
                  {ORIGEN_META[r.origen] || r.origen || '—'}
                </td>
                <td className="px-3 py-2.5"><EstadoBadge estado={r.estado_legal} /></td>
                <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground text-xs truncate max-w-[180px]">
                  {r.validado_por || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}