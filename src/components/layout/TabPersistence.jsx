/**
 * TabPersistence wrapper — auto-persists tab state por módulo
 * Uso: <TabPersistence pageKey="control-horario" defaultTab="fichajes">
 *        <Tabs value={tab} onValueChange={setTab}>...</Tabs>
 *      </TabPersistence>
 */
import { Tabs } from '@/components/ui/tabs';
import { useTabState } from '@/hooks/useTabState';

export default function TabPersistence({ pageKey, defaultTab = '', children }) {
  const [tab, setTab] = useTabState(pageKey, defaultTab);

  // Clone children and inject tab/onValueChange
  return Tabs ? (
    <Tabs value={tab} onValueChange={setTab}>
      {children}
    </Tabs>
  ) : (
    children
  );
}