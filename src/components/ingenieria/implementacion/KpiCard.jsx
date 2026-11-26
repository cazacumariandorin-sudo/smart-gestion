import React from 'react';

export default function KpiCard({ icon: Icon, label, value, hint, tone = 'default' }) {
  const tonos = {
    default: 'text-foreground',
    alerta: 'text-amber-600',
    ok: 'text-emerald-600',
    vacio: 'text-muted-foreground',
  };
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {Icon && <Icon className="w-4 h-4" />}
        {label}
      </div>
      <div className={`text-xl font-semibold ${tonos[tone] || tonos.default}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{hint}</div>}
    </div>
  );
}