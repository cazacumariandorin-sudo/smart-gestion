import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/** Cabecera y pie de las páginas comerciales públicas (sin sesión). */
export default function PublicShell({ marca, logo, children }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur safe-top">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/presentacion" className="flex items-center gap-2 min-w-0">
            {logo ? <img src={logo} alt={marca} className="h-7 w-7 object-contain" /> : null}
            <span className="font-semibold tracking-tight truncate">{marca}</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1 text-sm">
            <Link to="/presentacion" className="px-2 py-1.5 rounded-md hover:bg-muted hidden sm:inline-block">Producto</Link>
            <Link to="/demo" className="px-2 py-1.5 rounded-md hover:bg-muted">Demo</Link>
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground inline-flex items-center gap-1"
            >
              Acceder <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-xs text-muted-foreground flex flex-wrap gap-4 justify-between">
          <span>{marca} · Gestión de obra, personal y económico</span>
          <div className="flex gap-4">
            <Link to="/presentacion" className="hover:text-foreground">Producto</Link>
            <Link to="/demo" className="hover:text-foreground">Demo</Link>
            <Link to="/solicitar-version" className="hover:text-foreground">Solicitar versión</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}