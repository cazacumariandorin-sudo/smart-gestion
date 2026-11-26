import React from 'react';
import { ChevronRight } from 'lucide-react';

const TONOS = {
  default: 'text-foreground',
  alerta: 'text-amber-600',
  ok: 'text-emerald-600',
  vacio: 'text-muted-foreground',
};

export default function KpiCard({ icon: Icon, label, value, hint, tone = 'default', onClick }) {
  const contenido = (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {Icon && <Icon className="w-4 h-4" />}
        <span className="flex-1 text-left">{label}</span>
        {onClick && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
      </div>
      <div className={`text-xl font-semibold ${TONOS[tone] || TONOS.default}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight text-left">{hint}</div>}
    </>
  );

  if (!onClick) {
    return <div className="bg-card border border-border rounded-xl p-3">{contenido}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-3 text-left transition-colors hover:border-teal-500 hover:bg-teal-50/50 dark:hover:bg-teal-950/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
    >
      {contenido}
    </button>
  );
}