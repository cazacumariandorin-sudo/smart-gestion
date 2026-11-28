import { Building2, Sun, Clock, Wallet, FileText, Package, Car, MessageSquare } from 'lucide-react';

const ICONOS = {
  obras: Building2,
  solar: Sun,
  horario: Clock,
  nominas: Wallet,
  presupuestos: FileText,
  materiales: Package,
  flota: Car,
  chat: MessageSquare,
};

export default function ModulosComerciales({ modulos = [] }) {
  if (!modulos.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {modulos.map((m, i) => {
        const Icono = ICONOS[m.icono] || Building2;
        return (
          <div key={`${m.titulo}-${i}`} className="rounded-xl border bg-card p-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icono className="h-4 w-4" aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-sm font-semibold leading-tight">{m.titulo}</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{m.descripcion}</p>
          </div>
        );
      })}
    </div>
  );
}