# PROPUESTA DE MEJORAS — SIMANTEC GESTIÓN (v2 consolidada)
**Fecha:** 23-09-2026 · Revisión de los docs `PROPUESTA_MEJORAS_SMART_GESTION.md` + `fixes_sprint1.html` contra el código real.

---

## 1. VALIDACIÓN DE LOS PUNTOS DEL DOCUMENTO ORIGINAL

He cruzado cada tarea del documento original con el estado real del código. Resultado:

| # | Tarea original | Estado real tras revisión | Acción |
|---|---|---|---|
| T1 | `administracion` sin módulos en `permissions.js` | ✅ **YA RESUELTO** — `administracion` tiene entrada explícita completa (líneas 101-110), prácticamente igual que `gerencia`. Solo falta `ingenieria` si se considera necesario. | Cerrar. Revisar si quiere `ingenieria`. |
| T2 | Borrar gastos mal subidos (RLS + UI) | ⚠️ **VÁLIDO pero entidad errónea** — el doc cita `GastoOperario.jsonc`; la entidad real de gastos es **`RegistroGasto`**. Su RLS `delete` solo permite `admin`, `propietario` y `created_by` si `estado=borrador`. `gerencia`/`administracion` NO pueden borrar. | Corregir entidad y aplicar. |
| T3 | Filtro por operario en `PrecisionPanel` | ⚠️ **VÁLIDO** — confirmado: `pendientes = notas.filter(...)` sin filtro de operario; el lote se lanza sobre todos. | Aplicar. |
| T4 | Scroll vertical lateral | ⚠️ **PARCIAL** — `<main>` no tiene `overflow-y-auto` (scroll va por body). En móvil con muchos banners apilados puede ser incómodo. | Aplicar con cuidado. |
| T5 | Scroll horizontal (tablas anchas) | ⚠️ **VÁLIDO** — `<main>` tiene `overflow-x-hidden`; tablas anchas se cortan. | Aplicar por componente. |
| T6 | Botón ATRÁS con descripción | ⚠️ **VÁLIDO** — `PageHeader` muestra solo icono `ArrowLeft`, sin etiqueta. | Aplicar (muy bajo esfuerzo). |
| T7 | Adelantos → notas de gastos (ciclo completo) | ⚠️ **REVISAR** — el cierre de ciclo ya descuenta adelantos vía `total_adelantos_gastos` en `NotaMensualGasto` (ver schema). El hueco real es que `Adelanto.estado` no se reconcilia automáticamente con los gastos justificados. | Reducir a: reconciliar estado de adelantos. |
| T8 | Botón "Mis Adelantos" sin función | ✅ **YA RESUELTO** — la condición actual es `{!vistaAdmin && (...)}`, visible para técnicos. `MisAdelantosTab` filtra por `operario_id` del usuario. | Cerrar. |
| T9 | Filtro de ciclo en dashboard económico | ⚠️ **VÁLIDO** — `EconomicoDashboard` sigue filtrando con `mesActual`/`anioActual` hardcodeado. (Acabo de añadir el split recuperar/empresa, pero el mes sigue fijo.) | Aplicar selector de mes. |

**Conclusión:** de 9 tareas, **2 ya están resueltas** (T1, T8), **1 apunta a entidad equivocada** (T2), **1 está sobre-dimensionada** (T7) y **5 siguen vigentes** (T3, T4, T5, T6, T9).

---

## 2. PROPUESTA CONSOLIDADA — FALLOS + MEJORAS VISUALES

### Sprint A — Correcciones de fallos confirmados (1 día)

#### A1. Selector de mes/ciclo en Dashboard Económico (ex-T9)
- **Fichero:** `src/pages/EconomicoDashboard.jsx`
- **Qué:** Añadir `mesFiltro` (estado, por defecto mes en curso) + selector `‹ [mes] ›` en el header. Sustituir todos los `.startsWith(\`${anioActual}-${mesActual}\`)` por `.startsWith(mesFiltro)` y el filtro de nóminas por `\`${n.anio}-${String(n.mes).padStart(2,'0')}\` === mesFiltro`.
- **Impacto:** el dashboard refleja el ciclo/mes seleccionado, no solo el natural.
- **Esfuerzo:** ~1h.

#### A2. Permisos de borrado de gastos para gerencia/administración (ex-T2, corregido)
- **Ficheros:** `base44/entities/RegistroGasto.jsonc` (NO `GastoOperario.jsonc`) + `src/pages/NotasGastos.jsx` o un componente `DeleteGastoButton`.
- **Qué (RLS):** ampliar el `delete` de `RegistroGasto`:
  ```jsonc
  "delete": {
    "$or": [
      { "user_condition": { "role": "admin" } },
      { "user_condition": { "role": "propietario" } },
      { "user_condition": { "role": "gerencia" } },
      { "user_condition": { "role": "administracion" } },
      { "$and": [ { "created_by": "{{user.email}}" }, { "data.estado": "borrador" } ] }
    ]
  }
  ```
- **Qué (UI):** botón eliminar con confirmación en dos pasos y aviso explícito si el registro tiene fotos (`nota.archivos?.length`). Visible para `admin`, `gerencia`, `administracion`.
- **Impacto:** permite corregir el caso real de fotos mal subidas sin escalar a admin.
- **Esfuerzo:** ~2h (RLS + componente).

#### A3. Filtro por operario en panel de Precisión (ex-T3)
- **Fichero:** `src/components/gastos/PrecisionPanel.jsx`
- **Qué:** añadir `filtroOp` (estado, default `'todos'`), calcular `pendientesTotal` y filtrar por `operario_id`. Selector `MobileSelect` en el `CardHeader` antes del botón "Reprocesar", solo si hay >1 operario con pendientes.
- **Impacto:** el reprocesamiento por lotes se acota al operario elegido (menos créditos, más control).
- **Esfuerzo:** ~1h.

#### A4. Reconciliación automática de estado de adelantos (ex-T7, reducido)
- **Ficheros:** nueva función backend `reconciliarEstadoAdelantos` + invocar al cerrar ciclo (`cerrarCicloGastosMensual`).
- **Qué:** al cerrar el ciclo, para cada `Adelanto` del `ciclo_mes`+`operario` con estado `entregado`, comparar `justificacion_importe` vs `importe` y actualizar estado a `justificado` / `parcialmente_justificado` / `pendiente_devolucion`. El saldo a liquidar ya se calcula en `NotaMensualGasto`; este paso solo sincroniza el semáforo visual del adelanto.
- **Impacto:** el estado del adelanto deja de ser manual.
- **Esfuerzo:** ~3h.

---

### Sprint B — Mejoras visuales (1-2 días)

> El usuario pidió explícitamente "añadir alguna mejora visual". Propuestas nuevas, no en el doc original:

#### B1. Botón ATRÁS con etiqueta (ex-T6)
- **Fichero:** `src/components/layout/PageHeader.jsx`
- **Qué:** añadir prop opcional `backLabel`. Si llega, el botón pasa de `w-10` (solo icono) a `px-3` con `ArrowLeft` + texto (`backLabel`). Cada página puede indicar el destino ("Dashboard", "Gastos"…). En móvil sigue compacto.
- **Esfuerzo:** ~30 min.

#### B2. Sistema de KPI cards unificado
- **Fichero:** extraer `KpiCard` de `EconomicoDashboard.jsx` a `src/components/ui/KpiCard.jsx` y reutilizar en `Dashboard.jsx`, `Contabilidad.jsx`, `EconomicoDashboard`.
- **Qué:** card con icono, etiqueta, valor, y opcional `trend` (↑↓ %) y `accent` color. Consistencia visual entre todos los dashboards.
- **Esfuerzo:** ~2h.

#### B3. Semáforo de trazabilidad visual consolidado
- **Fichero:** `src/components/contabilidad/SemaforoTrazabilidadBadge.jsx` (ya existe) + aplicar en `NotasGastos` y `EconomicoDashboard`.
- **Qué:** un badge único (pendiente → aprobado → consolidado → descargado) con leyenda cromática coherente (ámbar → verde → azul → gris). Hoy los estados se pintan con clases dispersas.
- **Esfuerzo:** ~2h.

#### B4. Skeleton loaders en lugar de spinners
- **Ficheros:** `NotasGastos.jsx`, `EconomicoDashboard.jsx`, `IngenieriaDocumentos.jsx`.
- **Qué:** sustituir los `Loader2 animate-spin` por skeletons (`animate-pulse` con bloques `bg-muted`) en listas y cards mientras cargan datos. Mejor percepción de rendimiento.
- **Esfuerzo:** ~2h.

#### B5. Scroll vertical del sidebar + scroll horizontal por tabla (ex-T4/T5)
- **Ficheros:** `src/components/layout/AppLayout.jsx` (main: `overflow-y-auto`, quitar `overflow-x-hidden` global) + `src/components/layout/Sidebar.jsx` (nav: `overflow-y-auto`).
- **Qué:** envolver tablas anchas en `<div className="overflow-x-auto -mx-4 px-4 pb-2">`. El scroll horizontal vive en la tabla, no en el layout.
- **Esfuerzo:** ~1.5h.

#### B6. Empty states ilustrados
- **Ficheros:** nuevo `src/components/ui/EmptyState.jsx` + usar en listas vacías de `NotasGastos`, `EconomicoDashboard`, `IngenieriaDocumentos`.
- **Qué:** estado vacío con icono grande, mensaje y CTA ("Añadir gasto", "Subir documento") en vez del texto plano "Sin registros".
- **Esfuerzo:** ~1.5h.

---

## 3. PLAN DE EJECUCIÓN

| Sprint | Tareas | Esfuerzo | Riesgo |
|---|---|---|---|
| **A — Fallos** | A1 (filtro mes), A2 (borrado gastos), A3 (filtro operario), A4 (reconciliar adelantos) | ~7h | Bajo (RLS + UI aislada) |
| **B — Visual** | B1 (Atrás etiqueta), B2 (KpiCard), B3 (semáforo), B4 (skeletons), B5 (scrolls), B6 (empty states) | ~10h | Bajo (puramente UI) |

**Recomendación:** ejecutar Sprint A completo primero (resuelve fallos funcionales reales que afectan a gerencia/administración), luego Sprint B (mejora la percepción y usabilidad). A2 es la de mayor impacto de negocio (permite corregir el caso de fotos mal subidas sin escalar a admin).

---

## 4. NO INCLUIDO (descartado o ya hecho)

- **T1 (administración sin módulos):** ya resuelto en `permissions.js`. Reabrir solo si se quiere añadir `ingenieria` a ese rol.
- **T8 (Mis Adelantos oculto):** ya visible para técnicos (`{!vistaAdmin && ...}`).
- **Contraseña maestra de gerencia, router multi-IA con .env, deprecación de NotaGasto sin migración:** descartados por seguridad/riesgo (ver historial de dead-ends del proyecto).