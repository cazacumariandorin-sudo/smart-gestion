# Propuesta técnica — Rol `contabilidad` (gestoría externa, solo conciliación)

**App:** Smart Gestión · Simantec S.L. · appId `69de8e23b1cd7ac050397c82`
**Fecha:** 2026-09-08 · **Estado:** Análisis — pendiente de aprobación de gerencia/administración
**Principio rector:** el flujo de aprobación/pago actual (RegistroGasto → aprobación → NotaMensualGasto → pago) **no se modifica**. El rol `contabilidad` se añade **en paralelo**, de solo lectura económica + marca de conciliación, sin capacidad de aprobar, pagar ni editar importes.

---

## 1. Respuestas a las preguntas A–G

### A. Mapa de roles y permisos actual — dónde añadir `contabilidad`

El control de acceso se compone de tres capas encadenadas:

1. **`src/lib/useUserRole.js`** → `canAccess(module)` usa un mapa plano `perms[role] = [listaDeMódulos]`. No hay herencia entre roles; cada rol lista explícitamente sus módulos. **No existe riesgo de heredar permisos de admin/gerencia** siempre que `contabilidad` se añada como clave nueva con su propia lista, sin caer en las ramas `isAdmin`/`isGerencia` (que hoy son `role === 'admin'|'gerencia' || isAdmin`). Conclusión: punto de inserción seguro = nueva entrada `contabilidad: [...]` en `perms`.
2. **`src/lib/hubs.js`** → define los hubs del sidebar. El hub **Económico** (`id:'economico'`, `module:'notas-gastos'`) ya usa restricción por item (`roles: ['admin','gerencia','director_comercial','propietario']` en *Gestión Gastos*, *Fotos Contabilidad*, *Alta Materiales*). Aquí se añadirá el item **Conciliación** con `roles: ['contabilidad','admin','gerencia']`.
3. **`src/components/ProtectedRoute.jsx`** → veta la ruta si `!canAccess(module)`. Es el **bloqueo real a nivel de ruta** (no solo menú): un `contabilidad` que teclee `/obras-civiles` rebota a `/`. Refuerza el blindaje exigido en el punto 3 del enunciado.

> **Hallazgo A:** el sistema ya está diseñado para añadir roles limpios. No hay acoplamiento oculto. `contabilidad` vivirá únicamente en el módulo Económico.

### B. Entidades y operaciones que `contabilidad` puede ver/tocar

| Entidad | Lectura | Escritura (conciliación) | Sin acceso a |
|---|---|---|---|
| `RegistroGasto` | ✅ todos los campos | solo 4 campos nuevos (D) | `importe`, `estado`, `aprobado_por`, `pagado_por`, `fecha_aprobacion`, `fecha_pago`, `metodo_pago` |
| `MaterialDocumentoOrigen` | ✅ | solo 4 campos nuevos (D) | `estado`, `lineas_count`, datos de obra/operario |
| `MaterialPrecioHistorico` | ✅ (cuadre de costes de material) | ❌ | — |
| `NotaMensualGasto` | ✅ | ❌ (ni siquiera marcar) | `estado`, `importe_*`, `aprobado_por`, `pagado_por` |
| `Presupuesto` | ✅ (facturación emitida) | ❌ | todo |
| `Fabricante` / `MaterialCatalog` | ✅ (solo lectura, para cuadre de referencias) | ❌ | — |
| `Empresa` | ✅ (CIF propio de Simantec, punto F) | ❌ | — |
| `Obra` / `SolarObra` | ✅ **solo si** aporta al cuadre (nombre, cliente, budget) | ❌ | documentos/fotos |
| `Nomina` | ⚠️ **Pendiente de decisión (ver abajo)** | ❌ | — |

**Nóminas (sensibilidad RRHH):** hoy `Nomina.read` permite a admin/propietario/gerencia/director_comercial y al propio empleado (`operario_user_email`). Añadir `contabilidad` daría a la gestoría acceso a las nóminas **de todos los empleados** (líquido, IRPF, coste empresa). **Recomendación:** **excluir nóminas del alcance inicial** del rol `contabilidad`. Si la gestoría necesita cuadrar coste laboral, exponerle solo un agregado (total coste empresa por mes) vía una vista/función, no el detalle nominal. Gerencia decide.

**Sin acceso (lista negra explícita):** Obras (salvo lectura mínima de cuadre), Fichajes, ApunteHorario, Vacaciones, Vehículos, AlertaVehiculo, FotoProyecto, WorkOrder, ParteDiarioObra, Chat, Adelanto, AdelantoParcialCiclo, TrabajoExtraObra, MaterialPendiente, Drawing, Manual, Vigilancia*, DiagnosticoSesion, DatosSensibles*, PerformanceMetrics, y **todas las funciones backend de aprobación/pago/cierre** (`cerrarCicloGastosMensual`, `exportarCicloContabilidad`, `aprenderPatronGasto`, `procesarOcr*`, etc.).

### C. Asignable a un usuario externo sin `Operario`

**Sí.** El flujo de invitación es `base44.users.inviteUser(email, role)`; no exige vinculación a `Operario` (roles como `control_horario`, `cliente_obra`, `director_comercial` ya funcionan sin Operario). La asignación/cambio de rol se hace en `EditUserRoleDialog.jsx` (array `ROLES` + `ROLE_LABELS`), donde se añadirá `'contabilidad'`. La gestoría entra con su email corporativo, sin ficha de empleado. **No requiere `Operario`, ni empresa_id, ni user_email de operario.**

### D. Campos nuevos de conciliación (a nivel de documento individual)

**Añadir a `RegistroGasto`** (y reforzar en `MaterialDocumentoOrigen`, donde `proveedor_nif` ya existe):

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `proveedor_nif` | string | — | NIF/CIF del proveedor (ya existe en `MaterialDocumentoOrigen`; **se añade a `RegistroGasto`** para cuadrar por NIF) |
| `conciliado_contabilidad` | boolean | `false` | Marca de conciliado por la gestoría |
| `fecha_conciliacion` | string date-time | — | Timestamp de la marca |
| `conciliado_por` | string | — | Email del usuario `contabilidad` que marcó |
| `nota_conciliacion` | string | — | Anotación libre de la gestoría (discrepancias, referencias contables) |
| `estado_conciliacion` | enum `["no_conciliado","conciliado","conciliado_con_discrepancia"]` | `"no_conciliado"` | Estado derivado de la conciliación (punto G) |

> **Nota crítica sobre RLS por campo (limitación de plataforma):** Base44 aplica RLS **por operación** (create/read/update/delete), **no por campo individual**. La guía oficial lo confirma: *"it gates who may edit the record, not which fields they may touch"*. Por tanto, **no es posible bloquear vía RLS que `gerencia`/`admin` escriban `conciliado_contabilidad`** una vez que tienen `update` sobre el registro (y lo necesitan para el flujo de aprobación/pago). Esto se resuelve con la **función backend de confianza** (sección 3) como **única vía de escritura** de los campos de conciliación, más control de UI. Ver sección 4 (alternativa estricta).

### E. Conciliación solo sobre documentos ya aprobados/pagados internamente

La marca de conciliación se **valida en el backend**, no solo en la UI:
- `RegistroGasto`: solo si `estado ∈ {aprobado_gerencia, en_administracion, pagada}`.
- `MaterialDocumentoOrigen`: solo si el documento está `procesado` **y** sus `RegistroGasto`/`NotaMensualGasto` asociados están aprobados/pagados.
- `NotaMensualGasto`: no se concilia documento a documento; su `estado='en_contabilidad'/'pagada'` ya cumple la precondición.

La función rechaza con error explícito si el documento no cumple (impide conciliar algo que la empresa aún no ha aprobado/pagado → preserva el orden del flujo).

### F. CIF de Simantec y de obras — ya disponible

- **CIF de Simantec S.L.:** ya en `Empresa.cif` (con `es_principal:true`). **No hace falta crear nada.** La vista de conciliación lo mostrará como dato de cabecera.
- **Obras:** `Obra` **no lleva CIF** (correcto: una obra es un proyecto, no una persona jurídica). El emisor de facturas emitidas es siempre Simantec (`Empresa.cif`); el receptor es el `Client`. **Acción:** verificar si `Client` tiene campo CIF/NIF (si no, añadirlo — menor, fuera de este alcance si ya existe).
- **Proveedores:** `proveedor_nif` se toma del documento (OCR) y/o de `Fabricante` si está vinculado.

### G. Criterio de discrepancias — solo anotar, nunca modificar

Cuando contabilidad detecte un importe que no cuadra con su sistema:
1. **No puede** editar `importe` ni `estado` de aprobación/pago (RLS `update` no incluye a `contabilidad`; la función solo toca los 4 campos de conciliación).
2. Deja constancia en `nota_conciliacion` y marca `estado_conciliacion = "conciliado_con_discrepancia"`.
3. La discrepancia aparece como **aviso de alta prioridad** en `AsistenteTarea` para gerencia (reutilizando el patrón ya usado para conflictos de previsión de obra), de modo que gerencia/administración la **resuelven** (corregir importe, pedir abono, etc.). La gestoría **nunca** resuelve la discrepancia en la app.

---

## 2. Propuesta — Mapeo de permisos del rol `contabilidad`

### 2.1 `useUserRole.js` — nueva entrada `perms`

```js
contabilidad: ['economico-dashboard', 'notas-gastos', 'orders', 'conciliacion'],
```
Solo 4 módulos, todos del hub Económico. **Ningún** módulo de Obras, Personas, Flota, Chat, Sistema, Documental.

Añadir además el flag derivado:
```js
const isContabilidad = role === 'contabilidad';
```
(y **no** engancharlo a `isAdmin`/`isGerencia` para que un admin simulando `contabilidad` no herede poderes).

### 2.2 `hubs.js` — item "Conciliación" y restricción del resto del hub

- Nuevo item en el hub `economico`:
  ```js
  { label: 'Conciliación', path: '/conciliacion', icon: ClipboardCheck, module: 'conciliacion', roles: ['contabilidad','admin','gerencia'] }
  ```
- Los items sensibles del hub ya tienen `roles` restrictivo; **confirmar** que `contabilidad` NO aparece en `Gestión Gastos`, `Fotos Contabilidad`, `Alta Materiales (OCR)`, `Datos sensibles` (correcto: no está en sus arrays `roles`). `Pedidos`, `Nóminas`, `Presupuestos`, `Mis Gastos`, `Dashboard` quedarán **visibles pero de solo lectura** para `contabilidad` (la RLS de escritura lo garantiza).

### 2.3 Ruta nueva en `App.jsx`
```jsx
<Route path="/conciliacion" element={<ProtectedRoute module="conciliacion"><Suspense fallback={<PageLoader/>}><Conciliacion/></Suspense></ProtectedRoute>} />
```
`ProtectedRoute` ya bloquea por módulo → un `contabilidad` que intente `/obras-civiles` rebota a `/`.

### 2.4 `EditUserRoleDialog.jsx`
Añadir `'contabilidad'` a `ROLES` y `contabilidad: 'CONTABILIDAD (GESTORÍA EXTERNA)'` a `ROLE_LABELS`.

---

## 3. RLS por entidad + función backend de confianza

### 3.1 Lectura — añadir `contabilidad` a las entidades de lectura económica

Para **cada** entidad de la lista B, añadir a la rama `$or` de `read`:
```jsonc
{ "user_condition": { "role": "contabilidad" } }
```
Aplicar a: `RegistroGasto`, `MaterialDocumentoOrigen`, `MaterialPrecioHistorico`, `NotaMensualGasto`, `Presupuesto`, `Fabricante`, `MaterialCatalog`, `Empresa`, `Obra`, `SolarObra`.
**No** añadir a: `Nomina` (pendiente decisión RRHH), `Adelanto`, `AdelantoParcialCiclo`, `Fichaje`, `ApunteHorario`, `Vehiculo`, `ChatMensaje`, `DatosSensibles*`, `Vigilancia*`.

### 3.2 Escritura — `contabilidad` **NO** tiene `update` directo

En **ninguna** entidad se añade `contabilidad` a `update`/`create`/`delete`. Así, por RLS, la gestoría **no puede** editar ningún campo de `RegistroGasto`/`MaterialDocumentoOrigen` vía SDK directo.

### 3.3 Función backend `marcarConciliacionContable` (única vía de escritura)

```
POST /functions/marcarConciliacionContable
{ registro_id?: string, material_doc_id?: string,
  conciliado: true|false, nota?: string, estado_conciliacion?: "conciliado"|"conciliado_con_discrepancia" }
```
Lógica (service role, **bypassa RLS** pero se auto-valida):
1. `me = await base44.auth.me()`; si `me.role !== 'contabilidad'` → 403. (admin no usa esta función; admin no concilia.)
2. Carga el documento; verifica precondición de estado (punto E). Si no cumple → 400 con mensaje.
3. `update(id, { conciliado_contabilidad, fecha_conciliacion: now, conciliado_por: me.email, nota_conciliacion, estado_conciliacion })` — **solo esos campos**, nunca `importe`/`estado`.
4. Si `estado_conciliacion==='conciliado_con_discrepancia'` → crea `AsistenteTarea` de alta prioridad para gerencia (aviso de discrepancia).
5. Devuelve `{ok:true, ...}`.

**Garantía:** aunque la UI expusiera otros campos, el SDK directo está vetado por RLS (3.2) y la función solo escribe los 4 campos. La **marca es fiable**: quien aprueba/paga (gerencia/admin) no puede auto-marcar conciliado porque (a) la función rechaza su rol y (b) no la invocan desde su UI.

> **Caveat honesto (RLS por campo):** `admin` (y `gerencia`/`director_comercial`/`jefe_obra` que ya tienen `update` en `RegistroGasto`) **técnicamente** podrían escribir `conciliado_contabilidad` con un SDK `update` directo, porque la RLS no filtra por campo. La función de confianza + UI evita el caso normal; para una **garantía criptográfica** de que ni admin puede auto-mearcar, ver la **alternativa estricta** en sección 4. La propuesta por defecto asume que admin es de confianza (ya lo es en todo el sistema).

---

## 4. Alternativa estricta (si gerencia exige que ni admin/gerencia puedan auto-mearcar)

Crear entidad **`ConciliacionContable`** independiente:
```jsonc
{
  "name":"ConciliacionContable",
  "properties":{
    "documento_tipo": { "enum":["RegistroGasto","MaterialDocumentoOrigen"] },
    "documento_id": { "type":"string" },
    "conciliado": { "type":"boolean","default":false },
    "fecha_conciliacion": { "type":"string","format":"date-time" },
    "conciliado_por": { "type":"string" },
    "nota_conciliacion": { "type":"string" },
    "estado_conciliacion": { "enum":["no_conciliado","conciliado","conciliado_con_discrepancia"],"default":"no_conciliado" }
  },
  "rls":{
    "create":  { "user_condition": { "role": "contabilidad" } },
    "read":    { "$or":[ { "user_condition": { "role": "contabilidad" } }, { "user_condition": { "role": "admin" } }, { "user_condition": { "role": "gerencia" } } ] },
    "update":  { "user_condition": { "role": "contabilidad" } },
    "delete":  { "user_condition": { "role": "admin" } }
  }
}
```
Aquí **solo `contabilidad`** crea/edita la marca (RLS real por entidad, no por campo). El "conciliado" se lee por join (`documento_id`). **Pros:** garantía dura de que ni admin auto-mearca (salvo borrado). **Contras:** duplica el dato, requiere join en lecturas, la marca no vive "en" el documento (el enunciado pedía campos *en* el documento). **Recomendación:** adoptar la **opción por defecto (campos en documento + función de confianza, sección 3)** salvo que gerencia exija formalmente el blindaje contra admin.

---

## 5. Diseño de la vista de Conciliación

**Ruta:** `/conciliacion` · **Acceso:** `contabilidad` (escritura), `admin`/`gerencia` (solo lectura, para ver qué validó la gestoría).

**Estructura:**
1. **Cabecera:** CIF de Simantec (`Empresa` con `es_principal`), periodo seleccionado.
2. **Selector de periodo:** reutilizar el patrón de `VigilanciaInformePeriodoDialog` (selector mensual YYYY-MM) ya existente, para consistencia de UI.
3. **Pestañas/tipo de documento:** `RegistroGasto` | `MaterialDocumentoOrigen`.
4. **Tabla de documentos conciliables:** solo los que cumplen precondición (E). Columnas:
   - Fecha doc · Proveedor (nombre + NIF) · Obra · Importe · Estado (aprobación/pago) · **Estado conciliación** (badge: No / Conciliado / Con discrepancia) · Fecha conciliación · Acciones.
5. **Acción "Marcar como conciliado"** (botón por fila, **solo visible si `role==='contabilidad'`**): abre diálogo con campo `nota_conciliacion` opcional + selector `estado_conciliacion` (conciliado / con discrepancia). Llama a `marcarConciliacionContable`. Admin/gerencia ven el estado pero **no** el botón.
6. **Filtros:** por estado de conciliación (pendientes / conciliados / con discrepancia), por proveedor/NIF, por obra. Por defecto muestra "pendientes de conciliar".
7. **Indicador global:** contador "X de Y conciliados este periodo".

**Indicador en las vistas existentes (NotasGastos, FotosContabilidad):** añadir un mini-badge `✓ Conciliado` / `⚠ Discrepancia` en `NotaGastoCard` y `NotaGastoDetalle`, visible para todos los roles que ya ven gastos, para que gerencia sepa de un vistazo qué validó la gestoría. **Sin botón** de acción (es informativo).

---

## 6. Plan de implementación (fases, tras aprobación)

| Fase | Alcance | Archivos |
|---|---|---|
| F1 | Rol + permisos + ruta + diálogo de edición | `useUserRole.js`, `hubs.js`, `App.jsx`, `EditUserRoleDialog.jsx` |
| F2 | Esquema: campos de conciliación en `RegistroGasto` (+`proveedor_nif`); `MaterialDocumentoOrigen` (reforzar) | `base44/entities/RegistroGasto.jsonc`, `MaterialDocumentoOrigen.jsonc` |
| F3 | RLS `read` añadiendo `contabilidad` a entidades de la lista B | ~10 entidades |
| F4 | Función `marcarConciliacionContable` + test | `base44/functions/marcarConciliacionContable/entry.ts` |
| F5 | Vista `/conciliacion` + componentes | `src/pages/Conciliacion.jsx`, `src/components/conciliacion/*` |
| F6 | Indicadores en vistas de gastos existentes | `NotaGastoCard.jsx`, `NotaGastoDetalle.jsx`, `FotosContabilidad` |
| F7 | Invitar usuario gestoría y validar flujo E2E | dashboard → Users → invitar con rol `contabilidad` |

---

## 7. Decisiones pendientes para gerencia/administración

1. **Nóminas:** ¿entra `contabilidad` al detalle nominal (sensible RRHH) o solo a un agregado de coste laboral? → **Recomendación: excluir detalle.**
2. **Blindaje del marcado:** ¿suficiente la opción por defecto (campos en documento + función de confianza, asumiendo admin de confianza) o se exige la **alternativa estricta** (entidad `ConciliacionContable` separada, blindaje real contra admin)?
3. **Obra/SolarObra de lectura:** ¿`contabilidad` ve nombre+cliente+budget de obras para cuadrar, o ni eso? → **Recomendación: sí, solo lectura mínima.**
4. **Vencimiento del acceso:** ¿caducidad temporal del usuario gestoría (campo `acceso_hasta` ya existe en User)? → Recomendable para contratos por temporada fiscal.
5. **Auditoría:** ¿se registra quién concilió qué en un log aparte, además de `conciliado_por`? `conciliado_por`+`fecha_conciliacion` cubren trazabilidad básica; ampliar solo si se exige.

---

*Documento listo para revisión. Sin cambios de código aplicados.*