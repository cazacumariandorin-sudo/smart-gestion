# Mejoras Arquitectónicas: Optimistic Updates & Tab Management

## Visión General

Se ha implementado un sistema coherente de **optimistic updates** y **tab-state persistence** en todos los módulos CRUD para mejorar la experiencia del usuario eliminando delays en operaciones frecuentes y persistiendo la navegación entre tabs.

---

## 1. Optimistic Updates

### Hook: `useOptimisticMutation`

**Ubicación:** `hooks/useOptimisticMutation.js`

**Propósito:** Centraliza la lógica de actualizaciones optimistas con revert automático en errores.

**API:**
```javascript
const mutation = useOptimisticMutation(
  mutationFn,           // función que ejecuta la API
  queryKey,             // clave de React Query
  optimisticUpdater,    // función que calcula el nuevo estado
  onSuccess,            // callback opcional
  onError               // callback opcional
);
```

**Ejemplo de uso:**
```javascript
const createM = useOptimisticMutation(
  d => base44.entities.Order.create(d),
  'orders',
  (prev, newOrder) => [...prev, { ...newOrder, id: `temp_${Date.now()}` }],
  () => close_()
);
```

**Flujo:**
1. Usuario dispara mutación
2. Cache se actualiza inmediatamente (optimista)
3. API se ejecuta en background
4. Si éxito → UI ya refleja cambios
5. Si error → cache revierte automáticamente

**Beneficios:**
- ✅ UX instantáneo (sin esperar servidor)
- ✅ Revert automático en error (sin try-catch manual)
- ✅ Reutilizable en todos los módulos
- ✅ Reducción de boilerplate

---

## 2. Tab State Persistence

### Hook: `useTabState`

**Ubicación:** `hooks/useTabState.js`

**Propósito:** Persiste el tab activo por página en sessionStorage.

**API:**
```javascript
const [tab, setTab] = useTabState(pageKey, defaultTab);
```

**Ejemplo:**
```javascript
// En ControlHorario
const [tab, setTab] = useTabState('control-horario', 'fichajes');

// En GastosOperarios (si se quisiera)
const [tab, setTab] = useTabState('gastos-operarios', 'notas');
```

**Comportamiento:**
- Cuando user navega entre tabs → se guarda en sessionStorage
- Si user sale y vuelve a la página → restaura el tab anterior
- Especifico por página (diferentes pageKey = diferentes tabs)

**Beneficios:**
- ✅ Continuidad de navegación
- ✅ UX más natural
- ✅ No pierden el estado al navegar

---

## 3. Módulos Mejorados

### Aplicados optimistic updates:

| Módulo | Mutations | Estado |
|--------|-----------|--------|
| **GastosOperarios** | create nota | ✅ optimistic |
| **NotaGastosCard** | create/delete gasto | ✅ optimistic |
| **FichajesTab** | create/update fichaje | ✅ optimistic |
| **Orders** | create/update/delete | ✅ optimistic |

### Aplicados tab persistence:

| Página | Tabs | pageKey |
|--------|------|---------|
| **ControlHorario** | Fichajes, Informes, Apuntes, Alarmas | `control-horario` |

---

## 4. Patrones de Implementación

### Pattern 1: Crear con Optimistic

```javascript
const createM = useOptimisticMutation(
  mutationFn: async (data) => {
    const result = await api.create(data);
    // Logic adicional si es needed
    return result;
  },
  queryKey: 'items',
  optimisticUpdater: (prev, newItem) => [
    ...prev,
    { ...newItem, id: `temp_${Date.now()}` } // temp ID hasta que server responda
  ],
  onSuccess: () => {
    // Close dialogs, etc.
  }
);
```

### Pattern 2: Actualizar con Optimistic

```javascript
const updateM = useOptimisticMutation(
  ({ id, data }) => api.update(id, data),
  queryKey: 'items',
  optimisticUpdater: (prev, { id, data }) =>
    prev.map(item => item.id === id ? { ...item, ...data } : item),
  onSuccess: () => closeDialog()
);
```

### Pattern 3: Eliminar con Optimistic

```javascript
const deleteM = useOptimisticMutation(
  id => api.delete(id),
  queryKey: 'items',
  optimisticUpdater: (prev, id) => prev.filter(item => item.id !== id)
);
```

---

## 5. Migración de Módulos Existentes

Para aplicar estas mejoras a otros módulos (Obras, Materiales, Clientes, etc.):

**Paso 1:** Reemplazar mutations manuales
```javascript
// Antes
const createM = useMutation({
  mutationFn: d => api.create(d),
  onSuccess: () => { qc.invalidateQueries(...); }
});

// Después
const createM = useOptimisticMutation(
  d => api.create(d),
  'queryKey',
  (prev, newItem) => [...prev, newItem],
  () => { /* onSuccess */ }
);
```

**Paso 2:** Integrar tab persistence (si módulo tiene tabs)
```javascript
import { useTabState } from '@/hooks/useTabState';

// En componente
const [tab, setTab] = useTabState('page-key', 'default-tab');

// En JSX
<Tabs value={tab} onValueChange={setTab}>
  {/* contents */}
</Tabs>
```

---

## 6. Consideraciones Técnicas

### Cuándo usar optimistic updates:
- ✅ CRUDs donde latencia es perceptible
- ✅ Operaciones que el user espera sean "instant"
- ✅ No hay validación server-side compleja

### Cuándo NO usar:
- ❌ Operaciones con validaciones complejas (mostrar errores primero)
- ❌ Datos que dependen de side-effects server
- ❌ Actualizaciones que requieren confirmación

### Performance:
- Optimistic updates NO aumentan tráfico (mismos requests)
- Reducen percepción de latencia (~200-500ms menos)
- Cache invalidation se optimiza automáticamente

---

## 7. Próximas Mejoras

- [ ] Aplicar optimistic updates a Obras, Materiales, Clientes, Drawings, etc.
- [ ] Tab persistence en más módulos multi-tab (Inventario, etc.)
- [ ] Undo/Redo stack para optimistic updates
- [ ] Network-aware optimistic updates (backoff si offline)
- [ ] Telemetría de optimistic update success/revert rates

---

## Referencias

- `hooks/useOptimisticMutation.js` — Hook reutilizable
- `hooks/useTabState.js` — Hook para tab persistence
- `components/layout/TabPersistence.jsx` — Wrapper helper
- Ejemplo en `pages/Orders.jsx` — Referencia completa
- Ejemplo en `pages/ControlHorario.jsx` — Tab persistence