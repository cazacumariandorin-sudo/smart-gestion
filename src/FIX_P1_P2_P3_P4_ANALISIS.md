# Fix P1 + P2 + P3 + P4 — Análisis y Propuesta Técnica

**Proyecto:** Smart Gestión (appId `69de8e23b1cd7ac050397c82`) — Simantec S.L.
**Alcance:** Bloque A (P1 + P3: race condition Auth / ProtectedRoute sin loader) · Bloque B (P2 + P4: cola offline sin validación ni gestión de cuota).
**Estado:** Documento de análisis — **no implementa código todavía**. Pendiente de aprobación de gerencia/administración.

---

## Resumen ejecutivo

| ID | Problema | Causa raíz | Severidad | Bloque |
|----|----------|------------|-----------|--------|
| P1 | Ventana de pantalla blanca silenciosa al arrancar sesión | `ProtectedRoute` devuelve `null` mientras `isLoadingAuth` es `true`; dos estados de carga independientes (`isLoadingAuth`, `isLoadingPublicSettings`) que pueden desincronizarse | Alta | A |
| P3 | Loader puede girar indefinidamente si `auth.me()` cuelga | Timeout existente (8s) redirige a `/login` en silencio en vez de fallar de forma observable | Media | A |
| P2 | Item de cola offline corrupto agota reintentos y cae en dead letter sin motivo claro | `processOfflineQueue` ejecuta `api.update(id, …)` / `api.delete(id)` sin validar que `payload.id` exista | Media | B |
| P4 | `QuotaExceededError` en `localStorage` falla en silencio | `saveQueue`/`saveQueueMeta`/`saveDeadLetter` solo hacen `console.error` | Media | B |

---

## Bloque A — P1 + P3: Sincronización del estado de carga en el arranque

### (A) Flujo real de `isLoadingAuth` / `isLoadingPublicSettings` en `AuthContext.jsx`

Lectura línea por línea de `src/lib/AuthContext.jsx`:

- **Líneas 11-12:** dos `useState` independientes, ambos `true` al arrancar.
- **Líneas 22-23 (`checkAppState`):** se ponen los dos a `true` a la vez (síncrono).
- **Líneas 29-36 (timeout de seguridad):** a los 8s, si `userLoadedRef.current` sigue `false`, pone **ambos** a `false` y setea `authError = { type: 'auth_required' }`.
- **Líneas 98-101 (`finally`):** se ponen **ambos** a `false` a la vez (síncrono).

**Hallazgo clave:** en el código *actual*, los dos setters se voltean siempre en el mismo bloque síncrono (el `finally` o el timeout). **Hoy no hay una ventana real** donde uno sea `false` y el otro `true`. La race condition descrita en el diagnóstico externo es **latente**: existe porque son dos estados independientes que *podrían* desincronizarse ante cualquier refactor futuro que toque solo uno de los dos, no porque hoy estén desincronizados.

El bug real que sí se manifiesta hoy es **P1-bis**: `ProtectedRoute` (línea 15) comprueba **solo `isLoadingAuth`**, mientras que `AuthenticatedApp` (línea 319 de `App.jsx`) comprueba `isLoadingPublicSettings || isLoadingAuth`. Si en el futuro alguien introdujera un camino que baje `isLoadingPublicSettings` antes que `isLoadingAuth`, `AuthenticatedApp` renderizaría `<AnimatedRoutes>` mientras `ProtectedRoute` sigue devolviendo `null` → pantalla blanca silenciosa. Esa es exactamente la misma familia de causa raíz ya diagnosticada para el bug de pantalla blanca del Chat.

#### Opciones evaluadas

| Opción | Descripción | Pros | Contras | Veredicto |
|--------|-------------|------|--------|-----------|
| **A1. Estado combinado en un solo `useState`** | Sustituir los dos `useState` por uno: `const [isLoading, setIsLoading] = useState(true)`. Exponer `isLoading` ( único ) en el contexto + `isLoadingAuth`/`isLoadingPublicSettings` como getters derivados para no romper consumidores. | Invariante garantizada por construcción. Mínimo código. | Requiere mantener getters de compatibilidad para no romper los ~consumidores que leen `isLoadingAuth`/`isLoadingPublicSettings`. | ✅ **Elegida** |
| A2. `Promise.all` | Envolver las dos cargas en un `Promise.all` y voltear un solo flag al resolver ambas. | Expresivo. | `isLoadingPublicSettings` hoy no es una promesa real (se setea sincrónicamente en `checkAppState`); habría que inventar una promesa artificial. Más invasivo. | Descartada |
| A3. `useTransition` / `Suspense` | Mover la carga a `Suspense` con `fallback`. | Idiomático React 18. | Reescribe el arranque entero; `auth.me()` no es unaresource compatible con Suspense sin wrappers. Riesgo de regresión alto. | Descartada |

**Decisión:** Opción **A1** — reemplazar los dos `useState` por un único `isLoading` y exponer `isLoadingAuth`/`isLoadingPublicSettings` como alias (getter) del mismo valor durante la transición. Así la invariante «ambos se voltean a la vez» deja de depender de la disciplina del programador y pasa a ser estructural. Los consumidores existentes (`App.jsx`, `ProtectedRoute.jsx`, y cualquier `useAuth()` que lea esos campos) siguen funcionando sin tocarlos en esta fase.

### (B) Coherencia visual del loader entre `ProtectedRoute` y `AuthenticatedApp`

`AuthenticatedApp` (`App.jsx` ~línea 313) usa:

```jsx
<div className="fixed inset-0 flex items-center justify-center">
  <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
</div>
```

`ProtectedRoute` hoy devuelve `null` (sin loader).

**Propuesta:** extraer ese snippet a un componente mínimo reutilizable `src/components/FullScreenLoader.jsx` (≈10 líneas) y usarlo **en los dos sitios**:
- En `AuthenticatedApp` (sustituye el inline actual, mismo look).
- En `ProtectedRoute` (sustituye `return null` por `<FullScreenLoader />`).

Resultado: (i) nunca más pantalla blanca silenciosa durante la carga de auth; (ii) un solo estilo de carga en toda la app; (iii) sin introducir un segundo spinner distinto.

### (C) Timeout de seguridad para el estado combinado

**Hallazgo:** `AuthContext` **ya tiene** un timeout de 8s (líneas 29-36) que, al dispararse, pone `isLoading=false` y `authError = { type: 'auth_required' }`. En `AuthenticatedApp`, ese `authError` de tipo `auth_required` se interpreta como «lo gestiona `ProtectedRoute` / `AnimatedRoutes`» → acabará redirigiendo a `/login`.

**El problema actual** no es un loader infinito, sino que el fallo se manifiesta como **redirección silenciosa a `/login`** aunque la causa real haya sido un cuelgue de red de `auth.me()`. El usuario no distingue «no estaba logueado» de «la red colgó».

**Opciones para P3:**

| Opción | Comportamiento tras timeout | Pros | Contras |
|--------|-----------------------------|------|--------|
| **P3-x. Mantener redirección a `/login` (estado actual)** | `authError.type = 'auth_required'` → `ProtectedRoute` redirige. | Mínimo cambio (ya existe). Consistente con sesión caducada. | No distingue cuelgue de red de sesión expirada. |
| **P3-y. Lanzar error al `GlobalErrorBoundary` (lo que pide el prompt)** | Tras 10s, `throw new AuthLoadTimeoutError(...)`. | El boundary ya existente lo captura y muestra «Recargar». | Un cuelgue transitorio obliga a recargar en vez de ofrecer re-login; peor UX si la sesión realmente caducó. |
| **P3-z. Híbrido (recomendado)** | Timeout a **10s**. Si hay token de sesión previo (`appParams.token` o SDK session) → lanzar `AuthLoadTimeoutError` al boundary (probable cuelgue de red → Recargar). Si **no** hay sesión → mantener `auth_required` → `/login` (flujo normal de invitado). | Distingue «tenía sesión y la red colgó» de «no había sesión». | Lógica un poco más fina. |

**Decisión propuesta:** **P3-z (híbrido)**, con umbral **10s** (alinea con el rango 8-10s del prompt y deja margen sobre el 8s actual para redes muy lentas). Se expone un `AuthLoadTimeoutError` con `name` distinguible para que el `GlobalErrorBoundary` pueda, si se desea, mostrar un mensaje específico («La conexión tardó demasiado») en vez del mensaje genérico. El boundary **no se modifica**: ya captura cualquier error lanzado.

### Resumen de cambios del Bloque A (mínimos)

1. `src/lib/AuthContext.jsx`:
   - Sustituir `useState(true)` x2 por `const [isLoading, setIsLoading] = useState(true)`.
   - Exponer en el contexto: `isLoading` + alias `isLoadingAuth: isLoading` y `isLoadingPublicSettings: isLoading` (compatibilidad).
   - Ajustar el timeout a 10s y, al dispararse, bifurcar por presencia de sesión (P3-z): lanzar `AuthLoadTimeoutError` si había sesión, si no, `auth_required` como hoy.
   - `finally` y el setters de inicio usan ahora el único `setIsLoading`.
2. `src/components/FullScreenLoader.jsx` (nuevo, ~10 lín.): el spinner actual extraído.
3. `src/components/ProtectedRoute.jsx`: `if (isLoadingAuth) return <FullScreenLoader />;` en vez de `return null;`. **No se toca** la lógica de redirect a `/login` ni `canAccess(module)`.
4. `src/App.jsx`: sustituir el spinner inline de `AuthenticatedApp` por `<FullScreenLoader />` (mismo look, fuente única).

**No se rompe** el flujo de login/logout: `logout()` y `navigateToLogin()` no dependen de los flags de loading.

---

## Bloque B — P2 + P4: Robustez de `offlineQueue.js`

### (C) Revisión de llamadores de `processOfflineQueue` / `saveQueue` / `saveQueueMeta`

Inventario de llamadores (verificado en el sandbox):

- **`processOfflineQueue(entityApis)`** — llamado desde:
  - `src/App.jsx` → `OfflineQueueProcessor` (evento `online`).
  - `src/utils/offlineQueue.js` → `useSyncOfflineQueue` (hook, eventos `online`/`app:online`).
  - Firma actual: `(entityApis) => { synced, failed, remaining }`. **Se mantiene idéntica**; solo se añade una rama de validación previa. Ningún llamador se rompe.
- **`saveQueue(queue)`** — llamado desde:
  - `saveWithOfflineFallback`, `updateQueue`, `removeFromQueue`, `processOfflineQueue` (todos internos del módulo).
  - No se observa llamador externo que dependa del valor de retorno (hoy devuelve `undefined`).
- **`saveQueueMeta(meta)`** — llamado solo desde `updateQueueStats` (interno).
- **`saveDeadLetter(item, error)`** — interno, llamado desde `processOfflineQueue`.

**Conclusión (C):** los cambios de comportamiento (validación previa, gestión de cuota) son **internos**. Ningún llamador externo asume que `saveQueue` «nunca falla» porque ninguno lee su retorno. La firma de `processOfflineQueue` no cambia. **No hay regresión en llamadores.**

### (D) `maxRetries`, `calculateNextRetry` y la separación validación vs. red

- **`maxRetries`** por defecto = **3** (línea 64 de `saveWithOfflineFallback`). Cada item lo guarda en `item.maxRetries`.
- **`calculateNextRetry(intentos)`** (línea 143): backoff exponencial 1s→2s→4s→8s→16s, cap 60s.
- **Camino de dead letter actual** (líneas 192-195): se alcanza cuando `item.intentos >= item.maxRetries` tras un error de la API. Es decir, **solo errores de red/real** llegan ahí, tras 3 reintentos con backoff.

**Requisito del prompt:** «error de validación = dead letter inmediato; error de red = reintento con backoff». La distinción debe ser clara.

**Diseño propuesto (P2):**

1. Definir una clase `QueueValidationError` (en el propio módulo, sin dependencias):
   ```js
   class QueueValidationError extends Error {
     constructor(message, item) {
       super(message);
       this.name = 'QueueValidationError';
       this.entityName = item?.entityName;
       this.action = item?.action;
       this.queueItemId = item?.id;
     }
   }
   ```
2. Antes de ejecutar la acción en `processOfflineQueue`, validar:
   - `CREATE`: `item.payload && typeof item.payload === 'object' && Object.keys(item.payload).length > 0`.
   - `UPDATE` / `DELETE`: `item.payload && item.payload.id != null && item.payload.id !== ''`.
3. Si la validación falla → `saveDeadLetter(item, new QueueValidationError(motivo, item))` **sin incrementar `intentos`** y **sin meter el item en `remaining`** (no consume reintentos). Se registra en el resultado como `rejected` para telemetría.
4. Si la validación pasa → flujo actual intacto (backoff exponencial en error de red).

**Separación garantizada:** la rama de validación es **anterior** al `try` de la API y **no toca** `intentos` ni `nextRetryAt`. La rama de red sigue dentro del `catch` existente. Cero interferencia con el backoff.

**Resultado de `processOfflineQueue` ampliado** (retrocompatible):
```js
return { synced, failed, rejected, remaining: remaining.length };
```
`rejected` es nuevo; los llamadores que solo leen `synced`/`failed`/`remaining` no se rompen.

### (D-bis) Diseño de gestión de cuota (P4)

**Problema:** los tres `localStorage.setItem` (`saveQueue`, `saveQueueMeta`, `saveDeadLetter`) solo hacen `console.error` ante `QuotaExceededError`.

**Diseño propuesto:**

1. **Helper `safeSetItem(key, value)`** centraliza los tres puntos:
   - `try { localStorage.setItem(key, value); return true; }`
   - `catch (e) { if (!esQuotaError(e)) { console.error(...); return false; } }`
   - Si es `QuotaExceededError`:
     - **Intento de liberación:** purgar dead letters con `failedAt` > 30 días (`sg_dead_letters`). Reintento único.
     - Si sigue fallando → **notificación visible al usuario**.
2. **Notificación visible:** `offlineQueue.js` es un módulo plano (no React). Opciones:
   - **`window.dispatchEvent(new CustomEvent('offlineQueue:quota-exceeded', { detail: {...} }))`** y un listener React (en `OfflineQueueManager` ya existente) que lo convierta en toast. **Recomendado**: desacoplado, sin acoplar el módulo a `sonner`/`use-toast`.
   - Alternativa: `import { toast } from 'sonner'` directo (sonner está instalado y funciona standalone). Más simple pero acopla el módulo de utilidades a una librería de UI.
   - **Decisión:** evento `CustomEvent` + listener React → toast. Mantiene `offlineQueue.js` libre de dependencias UI (coherente con su rol actual de módulo plano).
3. **Helper `esQuotaError(e)`**: detecta `e.name === 'QuotaExceededError'` (estándar) + fallback por mensaje (`/quota/i.test(e.message)`) para Safari/WebView antiguos.
4. **`getDeadLetters`** ya existe; añadir `purgeOldDeadLetters(dias=30)` usada en el intento de liberación.

**No regresión:** el camino feliz (sin error de cuota) es idéntico: `safeSetItem` solo añade rutas defensivas bajo `catch`.

### Resumen de cambios del Bloque B (mínimos)

1. `src/utils/offlineQueue.js`:
   - Añadir `class QueueValidationError`.
   - Añadir `safeSetItem(key, value)` con detección de cuota, purga de dead letters >30d, reintento único, y `window.dispatchEvent('offlineQueue:quota-exceeded', …)`.
   - `saveQueue`, `saveQueueMeta`, `saveDeadLetter` delegan en `safeSetItem`.
   - `processOfflineQueue`: bloque de validación previa antes del `try` de la API; items inválidos → dead letter inmediato con `QueueValidationError` (no incrementa `intentos`, no entra en `remaining`); añadir `rejected` al resultado.
   - Añadir `purgeOldDeadLetters(dias)` y exponerlo.
2. `src/components/offline/OfflineQueueManager.jsx` (ya existe): añadir listener de `offlineQueue:quota-exceeded` → toast visible («No se pudo guardar el dato localmente: almacenamiento lleno»).

**No se altera** el flujo feliz ni el backoff exponencial de reintentos por red.

---

## Verificación de no-regresión

| Escenario | Antes | Después | ¿Cambio? |
|-----------|-------|---------|----------|
| Arranque con sesión válida, red OK | spinner → app | spinner (FullScreenLoader) → app | Mismo look, fuente única |
| Arranque sin sesión, red OK | spinner → /login | spinner → /login | Idéntico |
| `auth.me()` cuelga, había sesión | a 8s → /login silencioso | a 10s → `AuthLoadTimeoutError` → GlobalErrorBoundary «Recargar» | Mejor observabilidad |
| `auth.me()` cuelga, no había sesión | a 8s → /login | a 10s → /login | Idéntico (P3-z) |
| Cola con item UPDATE sin `id` | 3 reintentos → dead letter (error genérico) | dead letter inmediato (QueueValidationError) | Más claro, sin gastar reintentos |
| Cola con item válido, red OK | sincroniza | sincroniza | Idéntico |
| Cola con item válido, red cae | backoff 1s→2s→4s → dead letter | idéntico | Idéntico |
| `localStorage` lleno (incógnito) | `console.error` silencioso | purga dead letters >30d → reintento → toast si falla | Visible para el usuario |

---

## Estimación y orden de implementación (tras aprobación)

1. **Bloque A** (P1+P3): ~30 min. Archivos: `AuthContext.jsx`, `FullScreenLoader.jsx` (nuevo), `ProtectedRoute.jsx`, `App.jsx`.
2. **Bloque B** (P2+P4): ~30 min. Archivos: `offlineQueue.js`, `OfflineQueueManager.jsx`.
3. **Verificación:** arrancar sesión con red, simular cuelgue de `auth.me()` (DevTools offline), meter item corrupto en cola, llenar `localStorage`.

**Total estimado:** ~1h de implementación, ejecutable en una sola pasada una vez aprobado este documento.

---

## Auditoría de consumidores (grep realizado 2026-09-08)

Grep de `isLoadingAuth` / `isLoadingPublicSettings` y del `isLoading` derivado de `useUserRole` en todo `src/`:

| Consumidor | Campo leído | Uso | ¿Depende de desincronización? |
|------------|------------|-----|-------------------------------|
| `App.jsx:318,325` | ambos | `isLoadingPublicSettings \|\| isLoadingAuth` → spinner global | No (OR; con alias = `isLoading \|\| isLoading` = `isLoading`) |
| `ProtectedRoute.jsx:10,15` | `isLoadingAuth` | `if (isLoadingAuth) return null` | No (puerta única "auth no listo") |
| `useUserRole.js:10,64` | `isLoadingAuth` | re-exporta como `isLoading` | No (pasa-through) |
| `UserRoleDiagnostic.jsx:13,22` | `isLoading` (de useUserRole) | `if (isLoading \|\| closed)` → estado carga | No (puerta única) |
| `Dashboard.jsx:110,232` | `isLoading: roleLoading` (de useUserRole) | `!roleLoading && visibleHubs.length === 0` | No (puerta única; más seguro con combinado) |
| `DiagnosticoApp.jsx:21,76` | `isLoading` (de useUserRole) | `if (isLoading \|\| loadingAcceso)` → loader | No (puerta única) |

**Conclusión:** 6 consumidores, **ninguno depende de que `isLoadingAuth` e `isLoadingPublicSettings` puedan estar desincronizados**. Todos tratan el flag como una única puerta "auth no listo". El alias combinado satisface los 6 de forma idéntica (y en `Dashboard.jsx` ligeramente más seguro: no mostrará el diagnóstico prematuramente si las settings públicas tardaran). **El diseño A1 se confirma seguro.**

`useUserRole.js` no necesita cambios: como re-exporta `isLoadingAuth` como `isLoading`, y `isLoadingAuth` pasa a ser alias del combinado, el `isLoading` derivado se actualiza solo.

---

## Pendiente de decisión (gerencia/administración)

- [x] Aprobar Opción **A1** (estado combinado único con alias de compatibilidad). — **Verificado vía auditoría de consumidores.**
- [ ] Aprobar **P3-z** (timeout 10s híbrido: boundary si había sesión, /login si no).
- [ ] Aprobar notificación de cuota vía **CustomEvent + toast** (frente a `sonner` directo).
- [ ] Confirmar umbral de purga de dead letters en **30 días**.