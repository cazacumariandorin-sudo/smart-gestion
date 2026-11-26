import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PackageOpen, ClipboardList, Images, Clock, FileText, AlertTriangle, ChevronRight, ArrowRight } from 'lucide-react';
import KpiCard from './KpiCard';
import { fechaCorta, euros, horas } from '@/lib/fechaCorta';

export default function ImplementacionResumen({ obra, materiales, partes, fotos, fichajes, previsiones, presupuestos, discrepancias, onIrA }) {
  const navigate = useNavigate();
  const abiertos = materiales.filter((m) => m.estado !== 'recibido');
  const totalHoras = fichajes.reduce((s, f) => s + (Number(f.horas_trabajadas) || 0), 0);
  const importePresupuesto = presupuestos.reduce((s, p) => s + (Number(p.importe) || 0), 0);
  const abiertas = discrepancias.filter((d) => d.estado === 'abierta');
  const ultimoParte = partes[0];

  // Si el proyecto ya tiene datos se abre su pestaña; si no, el módulo donde se añaden
  const irA = (hayDatos, tab, modulo) => {
    if (hayDatos && onIrA) return onIrA(tab);
    navigate(modulo);
  };

  const faltantes = [
    !presupuestos.length && { label: 'Presupuesto de la obra', to: '/presupuestos' },
    !partes.length && { label: 'Partes diarios', to: '/parte-diario' },
    !fotos.length && { label: 'Fotos de obra', to: '/galeria-fotos' },
    !fichajes.length && { label: 'Fichajes', to: '/control-horario' },
    !previsiones.length && { label: 'Previsión de obra', to: '/prevision-obras' },
    !materiales.length && { label: 'Material pendiente', to: '/material-pendiente' },
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          icon={PackageOpen}
          label="Material abierto"
          value={abiertos.length}
          hint={`${materiales.length} registrados`}
          tone={abiertos.length ? 'alerta' : 'vacio'}
          onClick={() => irA(materiales.length, 'materiales', '/material-pendiente')}
        />
        <KpiCard
          icon={ClipboardList}
          label="Partes diarios"
          value={partes.length}
          hint={ultimoParte ? `Último: ${fechaCorta(ultimoParte.fecha)}` : 'Sin partes'}
          onClick={() => irA(partes.length, 'informes', '/parte-diario')}
        />
        <KpiCard
          icon={Images}
          label="Fotos"
          value={fotos.length}
          hint={`${fotos.filter((f) => f.validada).length} validadas`}
          onClick={() => irA(fotos.length, 'fotos', '/galeria-fotos')}
        />
        <KpiCard
          icon={Clock}
          label="Horas fichadas"
          value={horas(totalHoras)}
          hint={`${fichajes.length} fichajes`}
          onClick={() => irA(fichajes.length, 'horas', '/control-horario')}
        />
        <KpiCard
          icon={FileText}
          label="Presupuesto"
          value={presupuestos.length ? euros(importePresupuesto) : '—'}
          hint={presupuestos.length ? `${presupuestos.length} documento(s)` : 'No cargado · ir a Presupuestos'}
          tone={presupuestos.length ? 'default' : 'vacio'}
          onClick={() => navigate(presupuestos.length ? `/presupuestos?obra_id=${obra.id}` : '/presupuestos')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">Ficha del proyecto</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Dato label="Proyecto" value={obra.name?.trim()} />
            <Dato label="Nº proyecto" value={obra.numero_proyecto || obra.code} />
            <Dato label="Cliente / contratante" value={obra.cliente_contratante_name || obra.client_name} />
            <Dato label="Proveedor instalador" value={obra.proveedor_instalador} />
            <Dato label="Inicio" value={fechaCorta(previsiones[0]?.fecha_inicio || obra.start_date) || '—'} />
            <Dato label="Fin" value={fechaCorta(previsiones[0]?.fecha_fin || obra.end_date) || '—'} />
          </dl>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-2">Información no disponible en la app</h3>
          {faltantes.length === 0 ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">Todos los módulos tienen datos para esta obra.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Estos bloques aparecen vacíos porque no hay registros vinculados, no porque el trabajo no exista. Toca uno para abrir su módulo y añadir los datos:
              </p>
              <div className="flex flex-wrap gap-2">
                {faltantes.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => navigate(f.to)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 text-slate-600 hover:border-teal-500 hover:text-teal-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-teal-400 transition-colors"
                  >
                    {f.label}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" /> Discrepancias abiertas
          </h3>
          <Link to={`/ingenieria/discrepancias?obra_id=${obra.id}`} className="text-xs text-primary inline-flex items-center">
            Ver todas <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {abiertas.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">Sin discrepancias abiertas registradas para esta obra.</div>
        ) : (
          <div className="divide-y divide-border">
            {abiertas.slice(0, 6).map((d) => (
              <div key={d.id} className="p-3">
                <div className="text-xs font-medium text-muted-foreground uppercase mb-0.5">{(d.tipo || '').replace(/_/g, ' ')} · {d.severidad}</div>
                <p className="text-sm line-clamp-2">{d.descripcion}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Dato({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium break-words">{value || '—'}</dd>
    </div>
  );
}