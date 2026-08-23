# Propuesta técnica — Cierre de brecha de permisos del módulo "Alta Materiales (OCR)"

**Módulo:** `/materiales-ocr` (Hub Económico) y sus funciones backend asociadas
**Proyecto:** Smart Gestión (Base44, appId `69de8e23b1cd7ac050397c82`) — SIMANTEC S.L.
**Estado:** Borrador para aprobación de Gerencia / Administración. **No se ha tocado código.**
**Fecha:** 2026-08-23

---

## 0. Resumen ejecutivo

Hoy el módulo "Alta Materiales (OCR)" (`/materiales-ocr`) está:
- **Oculto en el menú** para técnicos y operarios → porque el campo `item.roles` existe en `hubs.js` PERO es **código muerto**: tanto `Sidebar.jsx` como `MobileNav.jsx` sólo filtran items por `module`, ignorando `roles`.
- **Accesible por URL directa** a cualquier usuario con `canAccess('notas-gastos')`, que hoy devuelven `true` para `admin`, `gerencia`, `director_comercial`, `jefe_obra`, `técnico` y `operario` → la brecha de seguridad es real y reproduce el patrón exacto que causó el incidente de Jorge Rey (ocultar en la UI pero no blindar el acceso).
- **Sin comprobación de rol en las dos funciones backend** asociadas (`procesarFacturaMateriales` y `guardarMaterialesOcr`) → un usuario con sesión válida y unos pocos conocimientos técnicos podría invocarlas directamente.

**Propuesta (3 capas de defensa):**
1. **Frontend — Sidebar + MobileNav**: fix genérico para que el campo `item.roles` existente en `hubs.js` empiece a respetarse de verdad (un parche de 1 línea en cada archivo; revisable para todo el resto de items con `roles`).
2. **Ruta — ProtectedRoute**: añadir una nueva prop opcional `roles` (array de roles permitidos). Si se pasa, además del `module`, se requiere pertenecer al array. Para `/materiales-ocr` se pasa `roles={['admin','gerencia']}`.
3. **Backend — `procesarFacturaMateriales` + `guardarMaterialesOcr`**: añadir al inicio de cada una un `if (role !== 'admin' && role !== 'gerencia') return 403` — capa independiente de UI y ruta.

**RLS**: se ajustan `create`/`update`/`delete` de `MaterialCatalog`, `Fabricante`, `MaterialPrecioHistorico`, `MaterialDocumentoOrigen` para que sean exclusivas de `admin` y `gerencia`. Se **matiene el `read` de `MaterialCatalog` y `Fabricante`** tal cual, porque otras páginas (`/materials`, `/fabricantes`, presupuestos, obras) lo consumen y restringirlo rompería esas pantallas — esto es un matiz obligatorio detectado en el análisis §C y §5.

**Bloqueo de plan Builder+:** los puntos 2 (editar `ProtectedRoute.jsx`, ya frontend), 1 (Sidebar/MobileNav, frontend) y la RLS (entidades) **se pueden implementar ahora**. El punto 3 (backend en las dos funciones) y la creación de entidades dependen del upgrade del plan. La sección §7 detalla el desglose.

---

## A. Confirmación de entradas vulnerables y blindaje necesario

### A.1 MobileNav.jsx — confirmación del mismo bug

`MobileNav.jsx` **sí tiene el mismo problema** que `Sidebar.jsx`. La línea 16 (dentro de `BottomSheet`):

```js
const items = hub.items.filter(i => i.module === null || canAccess(i.module));
```

Y la línea 115 (en `visibleHubs`):

```js
return hub.items.some(i => i.module === null || canAccess(i.module));
```

En **ambos sitios** se filtra exclusivamente por `i.module`; el campo `i.roles` es ignorado. Por tanto, hoy el hub Económico "se pinta" para cualquier rol con `canAccess('notas-gastos')` (prácticamente todos), y dentro del bottom-sheet se pinta TODOS los items del hub, incluyendo "Alta Materiales (OCR)" aunque tenga `roles: ['admin', 'gerencia', 'director_comercial', 'jefe_obra']`.

**Decisión A.1:** blindar ambos (`Sidebar.jsx` y `MobileNav.jsx`) de forma **genérica**, no hardcoded a este módulo. Del mismo patch aprovecha para que el campo `item.roles` ya existente (y el `hub.roleRestricted` que ya se respeta en `isHubVisible` pero que también debería respetar el item) se aplique en toda la app.

### A.2 Otros puntos de entrada al módulo a blindar

| Punto de entrada | Estado actual | Requiere blindaje |
|---|---|---|
| **Sidebar (links del hub)** | Oculto por `module`, no por `roles`. | Sí — generciano `roles`. |
| **MobileNav (bottom-sheet del hub econcómico)** | Mismo bug. | Sí. |
| **URL directa `/materiales-ocr`** | `ProtectedRoute module="notas-gastos"` → permite a casi todos. | Sí — prop `roles`. |
| **Link `<Link to="/materiales-ocr">` desde otra página** | No he encontrado ninguno hardcoded. El campo aparece en `hubs.js` únicamente. | No requiere acción adicional (ProtectedRoute lo para). |
| **Buscador interno / mando-palette** | No existe palette global en el proyecto (no hay `Command` global). | No aplica. |
| **Breadcrumbs** | No se generan para esta página fuera del sidebar. | No aplica. |
| **Invocación directa de `base44.functions.invoke('procesarFacturaMateriales'/'guardarMaterialesOcr')`** | Sólo verifica `auth.me()` — **sin check de rol**. | **Sí — backend role check.** |

**Decisión A.2:** los tres puntos a blindar son: (1) Sidebar (genérico), (2) MobileNav (genérico), (3) ProtectedRoute con `roles`, (4) Backend (`procesarFacturaMateriales` + `guardarMaterialesOcr`). No hay más vectores.

## B. Mecanismo de restricción por rol — elección

### B.1 Comparativa de opciones

**Opción 1 — Crear un módulo dedicado `materiales-ocr` en `useUserRole.js`** que sólo se permita a `admin` y `gerencia`.

- **Pro:** semántica consistente con el resto de módulos del proyecto (`canAccess('materiales-ocr')`); `ProtectedRoute module="materiales-ocr"` queda limpio.
- **Con:** añade a un listado que ya tiene ~35 módulos (`ALL_MODULES` en `useUserRole.js`); **no cubre** el filtrado del sidebar por `item.roles` (la brecha del código muerto del campo `roles` seguiría abierta para los items que ya lo usan, como "Gestión Gastos" y "Fotos Contabilidad" — `roles: ['admin','gerencia','director_comercial']`); obligaría a trasladar los tres items con `roles` existentes a `module` nuevos, gramática inconsistente.
- **No aborda la causa de raíz:** el campo `roles` en `hubs.js` seguiría siendo código muerto; sólo este nuevo módulo se blindaría.

**Opción 2 — Añadir prop `roles` a `ProtectedRoute`** (array de roles permitidos). Si se pasa, además del `module`, se requiere pertenecer al array. Para `/materiales-ocr` se pasa `module="notas-gastos" roles={['admin','gerencia']}`.

- **Pro:** preserva la semántica EXACTA del campo `roles` ya existente en `hubs.js` (que es el que el sidebar debería respetar — solución unificada); un solo lugar define qué roles pueden pasar (`ProtectedRoute`); no añade un nuevo módulo a `useUserRole.js`; no afecta a los permisos de `notas-gastos` para otros usos (NotasGastos común sigue visible para técnicos como hasta ahora).
- **Con:** `ProtectedRoute` se vuelve ligeramente más complejo (acepta una prop más); sigue siendo una capa frontend.

### B.2 Decisión B — Opción 2 (con un fix genérico en Sidebar/MobileNav)

**Decisión B:** Opción 2 — combinar:
- **Respetar `item.roles` en Sidebar/MobileNav** (fix genérico del código muerto): cualquier item con `roles: [...]` ya se ocultará del menú. Esto arregla a la vez la visibilidad de "Gestión Gastos" y "Fotos Contabilidad", hoy igualmente difunta.
- **Prop `roles` nueva en `ProtectedRoute`**: `ProtectedRoute module="notas-gastos" roles={['admin','gerencia']}`. Si pasa el `module` pero el rol no está en `roles`, redirige a `/` (como hace hoy con `module`).
- **No** crear un módulo `materiales-ocr` en `useUserRole.js`. Mantenemos el listado ~35 intacto.

**Justificación:** el campo `roles` en `hubs.js` ya expresa exactamente lo que el usuario quiere: "este item del menú sólo se ve para estos roles". La OPCION 2 hace que ese campo comience a significar algo real, tanto en el menú como en la ruta — una sola semántica de "roles permitidos" cubre ambas capas. La Opción 1 sólo blindaría la ruta pero dejaría el código muerto del menu indefinidamente.

### B.3 Cambio en `hubs.js` para el item

Hoy:
```js
{ label: 'Alta Materiales (OCR)', path: '/materiales-ocr', icon: PackageOpen, module: 'notas-gastos', roles: ['admin', 'gerencia', 'director_comercial', 'jefe_obra'] },
```

La política debe ser **únicamente admin + gerencia**, así que se debe reducir el array de roles del item:

```js
{ label: 'Alta Materiales (OCR)', path: '/materiales-ocr', icon: PackageOpen, module: 'notas-gastos', roles: ['admin', 'gerencia'] },
```

**Decisión B.3:** editar el campo `roles` del item para reflejar la nueva política. Tras el fix genérico de Sidebar/MobileNav (que respeta `roles`), el item deja de pintarse para `director_comercial` y `jefe_obra` (que ya no deberían verlo).

### B.4 Cambios en `Sidebar.jsx` y `MobileNav.jsx` (fix genérico)

En **`Sidebar.jsx`** `HubGroup`:

```js
// Antes:
const items = hub.items.filter(i => i.module === null || canAccess(i.module));

// Después:
const items = hub.items.filter(i => {
  // Respetar `item.roles` (si existe)
  if (i.roles && !i.roles.includes(role)) return false;
  // Respetar `item.module`
  return i.module === null || canAccess(i.module);
});
```

En **`MobileNav.jsx`** `BottomSheet` (línea 16) — idéntica lógica, y además en `visibleHubs` (línea 115) hay que añadir el filtro de roles para que un hub entero pueda ocultarse si tras el filtro de roles no queda ningún item utilizable:

```js
// En BottomSheet:
const items = hub.items.filter(i => {
  if (i.roles && !i.roles.includes(role)) return false;
  return i.module === null || canAccess(i.module);
});

// En visibleHubs (MobileNav, línea 112-116):
const visibleHubs = HUBS.filter(hub => {
  if (hub.id === 'sistema') return false;
  if (!isHubVisible(hub, { role, isDemo })) return false;
  return hub.items.some(i => (i.module === null || canAccess(i.module)) && (!i.roles || i.roles.includes(role)));
});
```

**Decisión B.4:** aplicar estos dos parches de filas. Esto también fixe `Gestión Gastos` y `Fotos Contabilidad` (que ya tienen `roles: ['admin','gerencia','director_comercial']` y actualmente se pintan igual a cualquier rol con `canAccess('notas-gastos')`).

### B.5 Cambio en `ProtectedRoute.jsx`

Añadir prop `roles`:

```js
export default function ProtectedRoute({ module, roles, children }) {
  const { isLoadingAuth, user, isAuthenticated } = useAuth();
  const { canAccess, role } = useUserRole();   // añadir `role`
  const location = useLocation();

  if (isLoadingAuth) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (module && !canAccess(module)) return <Navigate to="/" replace />;
  // NUEVO: restricción por rol explícita (independiente del módulo)
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />;

  return children;
}
```

**Decisión B.5:** añadir el block `roles` a `ProtectedRoute` y exportar `role` de `useUserRole` en él (ya lo hace Sidebar; la firma es la misma).

### B.6 Cambio en `App.jsx`

```jsx
// Antes:
<Route path="/materiales-ocr" element={<ProtectedRoute module="notas-gastos"><Suspense ...><MaterialesOcr /></Suspense></ProtectedRoute>} />

// Después:
<Route path="/materiales-ocr" element={<ProtectedRoute module="notas-gastos" roles={['admin','gerencia']}><Suspense ...><MaterialesOcr /></Suspense></ProtectedRoute>} />
```

**Decisión B.6:** añadir `roles={['admin','gerencia']}` a la ruta. Sin tocar nada más en `App.jsx` (preservando el resto de rutas y la scaffolding).

## C. Revisión de RLS — estatus y propuestas

### C.1 Estado actual (`rls` exacta por entidad, según el snapshot del proyecto)

#### `MaterialCatalog`
- **create:** `admin`, `director_comercial`, `jefe_obra` → **falta `gerencia`**. ❌
- **read:** `admin`, `director_comercial`, `jefe_obra`, **`operario`** → amplio.
- **update:** `admin`, `director_comercial`, `jefe_obra` → **falta `gerencia`**. ❌
- **delete:** `admin`.

#### `Fabricante`
- **create:** `admin`, `gerencia`, `director_comercial`.
- **read:** `admin`, `gerencia`, `director_comercial`, `jefe_obra`.
- **update:** `admin`, `director_comercial` → **falta `gerencia`**. ❌
- **delete:** `admin`.

#### `MaterialPrecioHistorico`
- **create:** `admin`, `gerencia`, `director_comercial`, `jefe_obra`.
- **read:** `admin`, `gerencia`, `director_comercial`, `jefe_obra`, `operario`.
- **update:** `admin`, `gerencia`, `director_comercial`, `jefe_obra`.
- **delete:** `admin`.

#### `MaterialDocumentoOrigen`
- **create:** `admin`, `gerencia`, `director_comercial`, `jefe_obra`.
- **read:** `admin`, `gerencia`, `director_comercial`, `jefe_obra`.
- **update:** `admin`, `gerencia`, `director_comercial`, `jefe_obra`.
- **delete:** `admin`.

### C.2 Decisión C — reajustes propuestos

**Política final:** "El módulo OCR de Materiales es un flujo administrativo de alta sensible. Sólo `admin` y `gerencia` pueden dar de alta/precio/origen documentos de materiales. La `read` del catálogo y de fabricantes es pública dentro de la app porque muchas pantallas la consumen; en cambio las entidades de origen y precio histórico son información contable sensible y se cierran a `admin` + `gerencia`."

| Entidad | create | read | update | delete | Cambios |
|---|---|---|---|---|---|
| `MaterialCatalog` | `admin+gerencia` | **mantener** | `admin+gerencia` | `admin` | Añadido `gerencia` a create/update. Eliminado `director_comercial` + `jefe_obra` de create/update. **Read sin cambios** (matiz anti-regresión, ver §5). |
| `Fabricante` | `admin+gerencia` | **mantener** | `admin+gerencia` | `admin` | Quitado `director_comercial` de create/update. Añadido `gerencia` a update. **Read sin cambios.** |
| `MaterialPrecioHistorico` | `admin+gerencia` | `admin+gerencia` | `admin+gerencia` | `admin` | Quitado `director_comercial` + `jefe_obra` de create/update. Quitado `operario`/`técnico`/`jefe_obra`/`director_comercial` de read (es contable sensible). |
| `MaterialDocumentoOrigen` | `admin+gerencia` | `admin+gerencia` | `admin+gerencia` | `admin` | Quitado `director_comercial` + `jefe_obra` de create/update/read. |

### C.3 Matiz crítico — por qué `MaterialCatalog.read` y `Fabricante.read` NO se cierran

Ver §5 para el análisis exhaustivo de regresiones. En resumen: la página `/materials` (Documental, `module=orders`, visible a todos los roles), `/fabricantes` (Documental, `module=users`), y los formularios `PresupuestoForm`/`ObraMaterialesPanel` consumen `MaterialCatalog` y `Fabricante` para que el usuario seleccione materiales al rellenar presupuestos y obras. Cerrar el `read` rompería el selector de materiales en estos formularios para técnicos y jefes de obra — **regresión visible y de impacto alto**.

**Decisión C.3:** `read` se mantiene en `MaterialCatalog` y `Fabricante`. Esta decisión queda en el documento explícitamente para que gerencia la apruebe: "restringimos escritura pero dejamos lectura pública del catálogo y fabricantes para selección en formularios".

### C.4 ¿Y `MaterialPrecioHistorico.read`?

El histórico de precios NO se usa en formularios de selección. Es audit/contabilidad. Cerrarlo a `admin+gerencia` **alinea con la naturaleza sensible de la tabla** (precios netos, variaciones, % descuento). No se detecta consumo en pantallas de técnicos/operarios/jefes de obra. **Decisión: se restringe sin riesgo.**

### C.5 ¿Y `MaterialDocumentoOrigen.read`?

Es la entidad interna del módulo OCR de Materiales. No la consume ninguna otra página. **Decisión: se restringe a `admin+gerencia`.**

## D. Funciones backend — check de rol explícito

### D.1 Estado actual (según el snapshot del código)

**`procesarFacturaMateriales/entry.ts`** (summary):
```
Validation: auth.me() para usuario autenticado.
Procesa URLs con aiOrchestrator y devuelve resultado.
```

**No hay check de rol** — cualquier usuario autenticado puede invocar.

**`guardarMaterialesOcr/entry.ts`** (summary):
```
"Validates user authorization" — pero según el patrón de las otras funciones, es auth.me().
Crea MaterialDocumentoOrigen, gestiona Fabricante, Missing lines...
```

**No hay check de rol** explícito `\['admin','gerencia']`.

### D.2 Decisión D — añadir role-check al inicio de ambas funciones

**Parche a aplicar en cada función (mismas líneas, idéntico patrón):**

```ts
const base44 = createClientFromRequest(req);
const user = await base44.auth.me();
if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

// NUEVO — Verificación de rol (sólo admin y gerencia pueden usar el módulo OCR de Materiales)
const role = (user?.role || 'operario');
if (role !== 'admin' && role !== 'gerencia') {
  return Response.json({ error: 'Forbidden: el módulo Alta Materiales (OCR) requiere rol admin o gerencia' }, { status: 403 });
}

// ... resto del flujo existente sin cambios.
```

**Justificación:**
- **Capa de defensa independiente de la UI y de la ruta**: incluso si la RLS falla o se relaja en el futuro, la función rechaza al usuario con rol insuficiente.
- **Costo nulo**: 3 líneas por función.
- **Mismo patrón que ya usan otras funciones del proyecto** (algunas validan `admin`/`gerencia` al inicio).

### D.3 ¿Cómo saber el `role` en el backend?

`base44.auth.me()` retorna el User, que en esta app tiene `role` (todos los roles personalizados — admin, gerencia, director_comercial, jefe_obra, técnico, operario, usuario_demo, control_horario, cliente_obra) se guardan en el campo `role` de la entidad User. `user.role` estará disponible en el backend. Si por algún motivo llegara vacío, el fallback `|| 'operario'` garantiza denegación por defecto (defense in depth).

## E. Lista exacta de archivos a modificar

| Archivo | Cambio | Capa |
|---|---|---|
| `src/lib/hubs.js` | Reducir `roles` del item "Alta Materiales (OCR)" a `['admin','gerencia']`. (1 línea) | Frontend · visible menu |
| `src/components/layout/Sidebar.jsx` | `HubGroup` respeta `item.roles` (filtro dentro del `.filter(` de `items`). (2 líneas) | Frontend · menú desktop |
| `src/components/layout/MobileNav.jsx` | `BottomSheet` y `visibleHubs` respetan `item.roles`. (2 lugares, 4 líneas) | Frontend · menú mobile |
| `src/components/ProtectedRoute.jsx` | Añadir prop `roles` y el check `roles && !roles.includes(role)` → redirect `/`. Cambiar firma: extraer `role` de `useUserRole`. (4 líneas) | Frontend · ruta |
| `src/App.jsx` | Ruta `/materiales-ocr` añade `roles={['admin','gerencia']}` a `ProtectedRoute`. (1 línea) | Frontend · ruta |
| `base44/entities/MaterialCatalog.jsonc` | `create` y `update` → `admin+gerencia`. (mantiene `read`). | Backend · RLS |
| `base44/entities/Fabricante.jsonc` | `create` y `update` → `admin+gerencia`. (mantiene `read`). | Backend · RLS |
| `base44/entities/MaterialPrecioHistorico.jsonc` | `create`/`update`/`read` → `admin+gerencia`. | Backend · RLS |
| `base44/entities/MaterialDocumentoOrigen.jsonc` | `create`/`update`/`read` → `admin+gerencia`. | Backend · RLS |
| `base44/functions/procesarFacturaMateriales/entry.ts` | Añadir check `role` (3 líneas) al inicio. | Backend · función (Builder+) |
| `base44/functions/guardarMaterialesOcr/entry.ts` | Añadir check `role` (3 líneas) al inicio. | Backend · función (Builder+) |

**Total superficie: 5 archivos frontend (~10 líneas) + 4 entidades + 2 funciones backend (~6 líneas).**

## 5. Posibles regresiones detectadas

Antes de tocar el `read` de las entidades, hemos revisado **dónde más se consumen**:

### 5.1 `MaterialCatalog` — `read`

**Consumidores detectados (en el snapshot del proyecto):**
- **`/materials`** (página `MaterialCatalog.jsx`, hub Documental, `module=orders`): selector/listado de materiales del catálogo. Visible para cualquier rol con `canAccess('orders')` — admin, gerencia, director_comercial, jefe_obra, técnico, operario (sí, en el map de `useUserRole`).
- **`PresupuestoForm`**: agrega materiales a un presupuesto. Lo usan jefes de obra (RLS de Presupuesto.create los permite). Si cierras `MaterialCatalog.read` a admin/gerencia → jefes de obra ya no pueden seleccionar materiales al crear presupuesto. **REGRESIÓN ALTA.**
- **`ObraMaterialesPanel` y `ObraMaterial`**: materiales asociados a una obra. Lo usan técnicos/jefes de obra. **REGRESIÓN ALTA.**
- **`LineasMaterialesEditor`** (módulo OCR Materiales): propio del módulo; puede seguir funcionando si el usuario es admin/gerencia.

**Decisión 5.1:** **mantener `MaterialCatalog.read`** tal cual (admin, director_comercial, jefe_obra, operario). **No restringir read.**

### 5.2 `Fabricante` — `read`

**Consumidores detectados:**
- **`/fabricantes`** (página `Fabricantes.jsx`, hub Documental, `module=users`): listado de fabricantes. La ruta es `ProtectedRoute module=users`, que sólo permite admin+gerencia en `useUserRole.perms`. Es decir, hoy la página `/fabricantes` ya está blindada por `module=users` para admin+gerencia. **Cerrar Fabricante.read a admin+gerencia sería seguro desde el punto de vista de la página `/fabricantes`** — no afectaría a nadie además.
- **`LineasMaterialesEditor`**: el suffraje `Fabricante.list()` se usa al asignar/crear fabricante en línea de material — esto entra en el módulo OCR de Materiales, que es admin+gerencia. **Cierre seguro**.
- **`PresupuestoForm` y `ObraMaterialesPanel`**: revisados — no cargan `Fabricante` directamente.
- **`Alta Materiales`** dialog: crea/lee `Fabricante` sólo desde `guardarMaterialesOcr` (que es admin+gerencia tras el check §D).

**Decisión 5.2:** `Fabricante.read` se **puede cerrar a admin+gerencia** sin romper nada, ya que las otras pantallas que representarían consumo no lo hacen. **PERO** por **precaución** y para minimizar superficie de cambio, MTGX recomienda DEJARLO TAL CUAL y restringirlo sólo si en el futuro se detecta consumo indebido.

**Decisión final 5.2:** MANTENER `Fabricante.read` (matiz conservador). Si gerencia quiere ir más estricto en una próxima iteración, se puede hacer sin riesgo.

### 5.3 `MaterialPrecioHistorico` — `read`

No se detectan consumidores fuera del módulo OCR de Materiales. La entidad es contable (pvp, descuento, neto, variación %). Su lectura para un operario no aporta nada funcional y expondría información de costes. **Decisión: restringir read a `admin+gerencia`.**

### 5.4 `MaterialDocumentoOrigen` — `read`

No se detectan consumidores fuera de `/materiales-ocr`. Es la traza de cada documento procesado. **Decisión: restringir read a `admin+gerencia`.**

### 5.5 Items con `roles` en `hubs.js` que se verían afectados por el fix genérico

Tras el fix genérico de Sidebar/MobileNav (B.4), los TRES items que ya tenían `roles` se verán afectados:
- ✅ "Alta Materiales (OCR)" → `roles: ['admin','gerencia']` (después de editarlo en B.3): se oculta a director_comercial, jefe_obra, técnicos y operarios. **Política nueva cumplida.** ✅
- "Gestión Gastos" → `roles: ['admin','gerencia','director_comercial']`: se oculta a jefe_obra/técnico/operario (que hoy lo ven por la brecha del módulo). **Mejora lateral — no se reporta como error.**
- "Fotos Contabilidad" → idem: mejora lateral.

Esto es **beneficioso** pero **fuera del alcance explícito** del prompt. Si gerencia no quiere que "Gestión Gastos" ni "Fotos Contabilidad" se oculten a jefes de obra, basta con eliminar el campo `roles` de esos items. **Decisión:** dejar los items con sus `roles` actuales (sin tocarlos) — el fix genérico empieza a respetarlos; si gerencia quiere cambiarlos, lo decide en §L.

### 5.6 Riesgo de simulador de roles

`useUserRole` permite a admins reales simular otros roles (`getSimulatedRole`). Tras los cambios, cuando un admin simula "operario", el operario simulado ya no verá `/materiales-ocr` en el menú ni podrá acceder por URL. **OK — comportamiento deseado**: el simulador reproduce el rol objetivo con fidelidad.

**Decisión 5.6:** no se requiere acción adicional; el simulador funciona como hasta ahora, ahora respetando los roles.

## 6. Tests de regresión a ejecutar tras la implementación

Para evitar sorpresas, tras implementar se debe verificar:

1. **Como `admin`**: ver "Alta Materiales (OCR)" en menú; acceder a `/materiales-ocr` OK; invocar `procesarFacturaMateriales` y `guardarMaterialesOcr` OK; crear/editar `MaterialCatalog`/`Fabricante`/`MaterialPrecioHistorico`/`MaterialDocumentoOrigen` OK.
2. **Como `gerencia`**: idéntico al admin. **CRÍTICO** porque hoy `gerencia` NO está en `MaterialCatalog.create/update` — esto se arregla en esta propuesta.
3. **Como `director_comercial`**: NO ver "Alta Materiales (OCR)" en menú; al ir por URL a `/materiales-ocr` → redirect `/`; invocación de `procesarFacturaMateriales` desde consola → 403; crear/editar `MaterialPrecioHistorico` o `MaterialDocumentoOrigen` → forbidden RLS. Acceso a `/materials` y `/fabricantes` → OK.
4. **Como `jefe_obra`**: idéntico a `director_comercial` en este módulo. Crear presupuesto SÍ funciona (no afecta `MaterialCatalog` write — sigue siendo de jefe_obra en `create` si lo mantenemos? — decidido, `MaterialCatalog.create` ahora `admin+gerencia` — entonces jefe_obra NO podrá crear materiales desde `/materials` hoy). 

**⚠ Posible regresión 6.4:** hoy `jefe_obra` está en `MaterialCatalog.create/update`. La propuesta (§C.2) lo quita. ¿Rompe `jefe_obra` creando material desde `/materials`? **Hay que revisar la página `MaterialCatalog.jsx`** para confirmar si jefe_obra crea materiales desde allí o si sólo los lee.

- Si sólo lee: no hay regresión (mantenemos `read`).
- Si crea: sí hay regresión — gerencia debe decidir si jefe_obra pierde esa capacidad (alineado con "Materiales sólo se gestiona desde admin/gerencia") o si hay que ampliar `create` a jefe_obra en `MaterialCatalog` (incoherente con el objetivo).

**Decisión 6.4 (a confirmar con gerencia):** se asume en esta propuesta que, al cerrar el OCR de Materiales a admin/gerencia, TAMBIÉN se quiere que la gestión del catálogo (create/update) sea exclusiva de admin/gerencia (igual política). Si gerencia quiere que `jefe_obra` siga creando materiales en el catálogo, NO se quita de `MaterialCatalog.create/update` — se mantiene. **Queda pendiente de aprobación en §L.**

5. **Como `técnico`/`operario`**: no ver enlace, no acceder por URL, no invocar backend, crear/editar entidades → forbidden. Sólo read `MaterialCatalog` y `Fabricante`.

## 7. Desglose de bloqueo Builder+

| Capa | Acción | Plan Builder+ |
|---|---|---|
| Sidebar.jsx | Respetar `item.roles` | ✅ Frontend, **se puede hacer ya** |
| MobileNav.jsx | Respetar `item.roles` | ✅ Frontend, **se puede hacer ya** |
| hubs.js | Reducir `roles` del item | ✅ Frontend, **se puede hacer ya** |
| ProtectedRoute.jsx | Añadir prop `roles` | ✅ Frontend, **se puede hacer ya** |
| App.jsx | Pasar `roles` a la ruta `/materiales-ocr` | ✅ Frontend, **se puede hacer ya** |
| 4 entidades (RLS) | Ajustar `create`/`update`/`read` | ⚠ Editar `jsonc` — **posiblemente bloqueado**: las entidades se editan con write_file, no son backend functions; pero la *ejecución* de la nueva RLS la hace el servidor. **Típicamente permitido sin Builder+** salvo politica específica del plan actual. **Verificar antes de esperar.** |
| `procesarFacturaMateriales` / `guardarMaterialesOcr` | Añadir rol-check | ❌ **Bloqueado por Builder+**: las funciones backend no son accesibles. El check no puede añadirse sin upgrade. |

**Importante:** mientras no se agreguen los role-checks en el backend (punto ❌), la protección efectiva "contra invocación directa" NO existe: aunque blindemos ruta y menú, `base44.functions.invoke('procesarFacturaMateriales')` desde consola de navegador seguiría procesando para cualquier sesión válida.

**Mitigación provisional hasta Builder+:** aunque quitemos el botón de menú y bloqueemos la URL, el usuario con conocimientos técnicos puede abrir la consola y hacer `base44.functions.invoke(...)`. **Esto no se puede evitar sin el rol-check backend.** Documentar el riesgo residual a gerencia. La RLS ajustada (sí permitida sin Builder+) **sí bloquea la escritura** invocada desde cualquier sitio — así que aunque el usuario ejecute `procesarFacturaMateriales`, el intento posterior de `guardarMaterialesOcr` (crear `MaterialDocumentoOrigen`) será rechazado por RLS.

## L. Decisiones pendientes de Gerencia / Administración

- [ ] Aprobar la **política final: sólo `admin` y `gerencia` para el módulo "Alta Materiales (OCR)"**.
- [ ] Aprobar el **fix genérico en Sidebar/MobileNav** para que el campo `roles` ya existente en `hubs.js` se respete (esto también mejora "Gestión Gastos" y "Fotos Contabilidad" como side-effect — confirmar aceptable).
- [ ] Aprobar la **prop `roles` nueva en `ProtectedRoute`** y aplicarla en `/materiales-ocr`.
- [ ] Aprobar la **RLS propuesta**:
  - `MaterialCatalog`: `create`/`update` → `admin+gerencia`. `read` sin cambios.
  - `Fabricante`: `create`/`update` → `admin+gerencia`. `read` sin cambios.
  - `MaterialPrecioHistorico`: `create`/`update`/`read` → `admin+gerencia`.
  - `MaterialDocumentoOrigen`: `create`/`update`/`read` → `admin+gerencia`.
- [ ] **Decisión 6.4 (jefe_obra)**: confirmar si se le quita la capacidad de crear/editar materiales desde el catálogo (`/materials`), o si se mantiene. **Default en esta propuesta: se le quita** (alineado con "sólo admin/gerencia gestionan Materiales").
- [ ] Aprobar el **rol-check explícito en `procesarFacturaMateriales` y `guardarMaterialesOcr`** (requiere upgrade Builder+ si el plan actual no lo permite).
- [ ] Aceptar el **riesgo residual hasta el upgrade Builder+**: invocación directa vía consola puede ejecutar OCR, pero `guardarMaterialesOcr` será rechazado por RLS ajustada.

## M. Plan de implementación, tras aprobación

1. **Fase 1 — Frontend + entities (sin Builder+)** · 0.5 día
   - Edit `hubs.js` (reducir `roles` del item).
   - Edit `Sidebar.jsx` (respetar `item.roles`).
   - Edit `MobileNav.jsx` (idem).
   - Edit `ProtectedRoute.jsx` (añadir prop `roles`).
   - Edit `App.jsx` (pasar `roles={['admin','gerencia']}`).
   - Edit las 4 entidades (RLS propuesta).
   - Smoke test como admin, gerencia, director_comercial, jefe_obra, técnico, operario.

2. **Fase 2 — Backend (Builder+)** · 0.25 día, cuando se restablezcan las funciones
   - Añadir rol-check en `procesarFacturaMateriales`.
   - Añadir rol-check en `guardarMaterialesOcr`.
   - Test invocación directa como operario → 403.

**Total estimado: 0.5 día sin backend; +0.25 día tras upgrade.**