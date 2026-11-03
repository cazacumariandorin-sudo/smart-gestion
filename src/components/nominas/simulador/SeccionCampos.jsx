/** Bloque de conceptos del simulador: título, ayuda y rejilla de campos. */
export default function SeccionCampos({ titulo, descripcion, children }) {
  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h4>
        {descripcion && <p className="text-[11px] text-muted-foreground">{descripcion}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{children}</div>
    </div>
  );
}