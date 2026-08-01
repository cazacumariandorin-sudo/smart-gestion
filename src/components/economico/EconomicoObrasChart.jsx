import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function EconomicoObrasChart({ data }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Sin datos de gastos aprobados todavía</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => `${v.toLocaleString('es-ES')} €`} />
        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}