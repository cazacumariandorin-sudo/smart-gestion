/**
 * FullScreenLoader — spinner a pantalla completa usado durante el arranque
 * de auth y mientras ProtectedRoute decide acceso. Fuente única de estilo
 * para evitar pantallas blancas silenciosas (P1).
 */
export default function FullScreenLoader({ label }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : null}
      <span className="sr-only">Cargando…</span>
    </div>
  );
}