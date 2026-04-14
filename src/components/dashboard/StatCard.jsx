import { Card } from '@/components/ui/card';

export default function StatCard({ title, value, subtitle, icon: Icon }) {
  return (
    <Card className="p-5 relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold mt-1.5 tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <Icon className="w-5 h-5 text-accent-foreground" />
        </div>
      </div>
    </Card>
  );
}