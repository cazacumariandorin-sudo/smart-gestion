import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, FolderTree } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

/**
 * Árbol colapsable de 2 niveles: Cliente → Obra → Items.
 * Ambos niveles son plegables. Las obras inactivas muestran badge ámbar.
 *
 * Props:
 *  - grouped: { [clientKey]: { name, projects: { [projectKey]: { name, activo, items: [] } } } }
 *  - renderItem: (item, ctx) => ReactNode
 *  - defaultExpanded: bool (por defecto colapsado=false)
 */
export default function ClientObraTree({ grouped, renderItem, renderGroup, defaultExpanded = false, renderProjectBadge }) {
  const entries = useMemo(() => {
    return Object.entries(grouped).map(([cKey, cData]) => {
      let projects = [];
      if (cData.projects) {
        projects = Object.entries(cData.projects).map(([pKey, pData]) => ({
          key: pKey,
          name: pData.name || 'Sin obra',
          activo: pData.activo,
          items: pData.items || pData.drawings || pData.manuales || pData.fotos || pData.partes || [],
        }));
      } else if (cData.obras) {
        projects = Object.entries(cData.obras).map(([pKey, pData]) => ({
          key: pKey,
          name: pData.obra_name || pData.name || 'Sin obra',
          activo: pData.activo,
          items: pData.items || [],
        }));
      }
      const totalItems = projects.reduce((s, p) => s + p.items.length, 0);
      return { key: cKey, name: cData.name || cData.client_name || 'Sin cliente', projects, totalItems };
    });
  }, [grouped]);

  const [expandedClients, setExpandedClients] = useState({});
  const [expandedProjects, setExpandedProjects] = useState({});

  const toggleC = (k) => setExpandedClients(p => ({ ...p, [k]: !(p[k] ?? defaultExpanded) }));
  const toggleP = (k) => setExpandedProjects(p => ({ ...p, [k]: !(p[k] ?? defaultExpanded) }));

  const isClientOpen = (k) => expandedClients[k] ?? defaultExpanded;
  const isProjectOpen = (k) => expandedProjects[k] ?? defaultExpanded;

  if (entries.length === 0) return null;

  return (
    <div className="space-y-3">
      {entries.map(c => {
        const openC = isClientOpen(c.key);
        return (
          <Card key={c.key} className="overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors text-left"
              onClick={() => toggleC(c.key)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {openC ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                <span className="font-semibold text-sm truncate">{c.name}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{c.totalItems} doc{c.totalItems !== 1 ? 's' : ''}</Badge>
                {c.projects.length > 1 && <span className="text-[10px] text-muted-foreground hidden sm:inline">· {c.projects.length} obras</span>}
              </div>
            </button>

            {openC && (
              <div className="border-t border-border">
                {c.projects.map(p => {
                  const openP = isProjectOpen(p.key);
                  const inactiva = p.activo === false;
                  return (
                    <div key={p.key} className="border-b border-border/40 last:border-0">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/30 transition-colors text-left"
                        onClick={() => toggleP(p.key)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {openP ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          <FolderTree className={`w-3.5 h-3.5 shrink-0 ${inactiva ? 'text-amber-500' : 'text-primary/70'}`} />
                          <span className="text-xs font-semibold uppercase tracking-wider truncate">{p.name}</span>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${inactiva ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-muted/50 text-muted-foreground'}`}>
                            {inactiva ? 'Inactiva' : 'Activa'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] shrink-0">{p.items.length}</Badge>
                          {renderProjectBadge && renderProjectBadge(p.key, p)}
                        </div>
                      </button>
                      {openP && (
                        <div className="px-4 pb-3 pt-1">
                          {p.items.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground italic py-1.5">Sin documentos</p>
                          ) : renderGroup ? (
                            renderGroup(p.items, p)
                          ) : (
                            <div className="space-y-1.5">
                              {p.items.map(item => renderItem(item, { projectKey: p.key, project: p }))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}