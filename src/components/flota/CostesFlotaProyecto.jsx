import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Building2, Route, Fuel } from 'lucide-react';

export default function CostesFlotaProyecto({ viajes }) {
  const porProyecto = useMemo(() => {
    const map = {};
    for (const v of viajes) {
      const key = v.proyecto_nombre || 'Sin proyecto';
      if (!map[key]) map[key] = { nombre: key, km: 0, coste: 0, viajes: 0, vehiculos: new Set() };
      map[key].km += v.distancia_km || 0;
      map[key].coste += v.coste_combustible_estimado || 0;
      map[key].viajes += 1;
      if (v.vehiculo_matricula) map[key].vehiculos.add(v.vehiculo_matricula);
    }
    return Object.values(map).sort((a, b) => b.coste - a.coste);
  }, [viajes]);

  if (porProyecto.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p>No hay viajes vinculados a proyectos</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {porProyecto.map(p => (
        <Card key={p.nombre} className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="font-semibold text-sm flex items-center gap-1.5"><Building2 className="w-4 h-4 text-primary" />{p.nombre}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Route className="w-3.5 h-3.5" />{p.km.toFixed(0)} km</span>
              <span className="flex items-center gap-1"><Fuel className="w-3.5 h-3.5" />{p.coste.toFixed(2)} €</span>
              <span>{p.viajes} viaje{p.viajes !== 1 ? 's' : ''}</span>
            </div>
          </div>
          {p.vehiculos.size > 0 && <p className="text-xs text-muted-foreground mt-1.5">🚗 {[...p.vehiculos].join(', ')}</p>}
        </Card>
      ))}
    </div>
  );
}