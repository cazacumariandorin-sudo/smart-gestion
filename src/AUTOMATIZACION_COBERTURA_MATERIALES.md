# Propuesta técnica — Automatización de comprobación de cobertura de notas de gastos frente a Materiales/Fabricantes

**Módulos:** `/notas-gastos` + `NotaMensualGasto`/`RegistroGasto` (y legacy `NotaGastos`/`GastoOperario`) y `/materiales-ocr` (`MaterialDocumentoOrigen` · `MaterialCatalog` · `MaterialPrecioHistorico`)
**Proyecto:** Smart Gestión (Base44, appId `69de8e23b1cd7ac050397c82`) — SIMANTEC S.L.
**Estado:** Borrador para aprobación de Gerencia / Administración. **No se ha tocado código.**
**Fecha:** 2026-08-22

---

## 0. Resumen ejecutivo

Esta propuesta define una **automatización de "cobertura de materiales"**: un proceso periódico + un botón manual que revisa **todas las notas de gastos con adjunto** (3 entidades históricas coexisten: `RegistroGasto`, `NotaGastos`, `GastoOperario`) y determina, para cada nota, si **ya fue usada para alimentar Materiales** (criterio: enlace explícito `MaterialDocumentoOrigen.nota_gasto_id` + fallback por matching de archivo URL) o si **sigue pendiente**. Para los pendientes, distingue entre **contener material nuevo** (no existe en `MaterialCatalog`) y **compra de un material ya conocido** (existe pero sin esa entrada de precio/fecha).

Cualquier paso que use IA pasa por el orquestador compartido `aiOrchestrator.ts` (Base44 InvokeLLM primero, Claude respaldo). El histórico de cada comprobación se persiste en una nueva entidad `CoberturaMaterialesSesion`. La periodicidad sugerida: **semanal (lunes 07:00)** + botón manual. **No se incluyen notificaciones en v1**; se deja como opt-in v1.1 si el usuario considera que aporta tras las primeras semanas.

**Bloqueo de plan Builder+:** el backend necesario (función de comprobación + leer `MaterialDocumentoOrigen.nota_gasto_id`) **no se puede implementar hasta que se restablezcan las funciones backend** en el plan actual. La Parte de UI (panel de últimos resultados + botón manual) sí puede prepararse leyendo resultados ya persistidos. En §10 se desglosa qué va en backend vs frontend.

---

## A. Inventario de entidades que almacenan notas de gastos con adjunto

Hay **tres entidades distintas** que conviven por migraciones históricas (la decisión de deprecar las antiguas está aplazada por riesgo de pérdida de histórico):

| Entidad | Estado | Campos clave para la comprobación | Adjunto |
|---|---|---|---|
| `RegistroGasto` | **ACTIVO** (lo usa `NotaGastoForm` hoy) | `fecha_documento`, `importe`, `nombre_comercio`, `nif_comercio`, `categoria` (`material`/`combustible`/`peaje`/`parking`/`comida`/`otros`), `numero_factura`, `codigo_validacion_fiscal`, `operario_id`, `ocr_raw` | `archivos: [{ url, nombre, tipo, fecha_subida }]` |
| `NotaGastos` | **LEGACY** (última migración hacia `RegistroGasto`, no usado en producciones nuevas pero con histórico) | `fecha`, `importe`, `proveedor`, `cif`, `concepto` (enum `gasolina`/`parking`/`material`/`peaje`/`otro`) | `archivos: [{...}]` |
| `GastoOperario` | **LEGACY** (forma parte de la estructura mensual `NotaGasto` original) | `date`, `importe`, `proveedor`, `categoria`, `descripcion`, `ocr_raw`, `obra_id` | `ticket_url`, `ticket_thumbnail_url` (campos simples, no array) |
| `NotaGasto` (mensual) | Period-wrapper | `periodo_mes`, `total_importes`, `num_registros` | **Sin adjunto** — agrupa `GastoOperario[].nota_id == NotaGasto.id` |

**Decisión A:** la comprobación se aplica a las **3 entidades con adjunto** (`RegistroGasto`, `NotaGastos`, `GastoOperario`), no a `NotaGasto` (que no tiene adjunto propio). El proceso debe definir la **fuente de cada nota** para poder enlazarla de vuelta, así que cada `MaterialDocumentoOrigen.nota_gasto_id` lleva el **ID original** y un nuevo campo `nota_origen_tipo` ("registro_gasto" / "notagastos" / "gasto_operario").

### A.1 ¿Cómo surge el histórico delante de la comprobación?

`MaterialDocumentoOrigen` ya existe con documentos creados a través de `/materiales-ocr` desde su puesta en marcha. **No tiene** `nota_gasto_id` aún — estos documentos nunca se generaron desde una nota de gastos; vienen de cargas directas. La comprobación debe, entonces:

- Considerar "cubierto" todo aquel documento de gastos del que existe un `MaterialDocumentoOrigen.nota_gasto_id` con su ID (enlace explícito, futuro).
- Para el histórico, aplicar **una ÚNICA vez, en la primera ejecución tras el deploy**, un **matching por adjunto**: si la URL del archivo adjunto de la nota coincide con `MaterialDocumentoOrigen.archivo_url_mejorado` o `archivo_url_original`, esa nota se considera ya cubierta y se persiste retroactivamente el enlace `nota_gasto_id`. De esta forma, el histórico pre-módulo de Materiales queda perfilado.

## B. Criterio de "documento ya cubierto"

### B.1 Decisión: enlace explícito `MaterialDocumentoOrigen.nota_gasto_id` + fallback retroactivo por URL

**Decisión B (recomendada):** adoptar doble criterio, en este orden de preferencia:

1. **Enlace explícito (fuente de verdad)**: existe `MaterialDocumentoOrigen` con `nota_gasto_id == nota.id` Y `nota_origen_tipo == <tipo de la entidad>`. Binario, exacto, certero. Sin IA, sin heurística.
2. **Fallback retroactivo (solo en la 1ª ejecución tras deploy)**: si no hay enlace pero la nota tiene un adjunto y su URL coincide con `archivo_url_mejorado` o `archivo_url_original` de algún `MaterialDocumentoOrigen` existente, se considera cubierta y **se persiste el enlace** automáticamente, para "enganchar" el histórico.

**Por qué no usar matching por fecha+importe+proveedor ni la IA:**
- Dos repostajes del mismo importe el mismo día en distintas estaciones generarían falsos positivos.
- El matching difuso necesita IA por cada nota histórica → coste de créditos y latencia altas.
- El enlace explícito es **gratuito y atómico**: cubierto = `∃ registro`; no cubierto = `∄ registro`. Sin ambiguedades, sin falsos negativos que dejen "notas huérfanas para siempre".

### B.2 Cambio en la entidad `MaterialDocumentoOrigen`

Se añaden dos campos (sin tocar los existentes):

```jsonc
"nota_gasto_id": {
  "type": "string",
  "description": "ID de la nota de gasto origen (RegistroGasto / NotaGastos / GastoOperario) que generó este documento. Vacío si la carga fue directa sin nota origen."
},
"nota_origen_tipo": {
  "type": "string",
  "enum": ["registro_gasto", "notagastos", "gasto_operario"],
  "description": "Tipo de entidad de la nota de gasto origen (para saber dónde buscarla)."
}
```

Sin RLS adicional: hereda la RLS existente (`MaterialDocumentoOrigen.read` ya cubre `admin/gerencia/director_comercial/jefe_obra`).

### B.3 Carga del enlace

- **Desde `/materiales-ocr` "Procesar nota pendiente"**: el diálogo de Materiales recibe `nota_origen_id` y `nota_origen_tipo` y los envía en el payload a `guardarMaterialesOcr`. **`guardarMaterialesOcr` debe ampliar su firma** para persistir estos dos campos en `MaterialDocumentoOrigen.create(...)`. Cambio de ~4 líneas en el backend.
- **Desde la 1ª pasada de la automatización**: se persiste retroactivamente el enlace en cuestión si el fallback URL cuadra.

## C. Criterio "material ya existe" vs. "material nuevo"

### C.1 Algoritmo propuesto

Para cada nota **pendiente** (no cubierta por §B), el proceso busca decidir si su contenido son **materiales nuevos** (caso a) o **compra de existentes** (caso b). Pasos:

#### C.1 Filtro barato previo (sin IA)

Antes de cualquier OCR+IA, **descartar las notas que no son materiales**:

- **Filtro 1 — por `categoria`**: si la `categoria` de la nota **no** es `material` (en `RegistroGasto`: enum `material`/`combustible`/`peaje`/`parking`/`comida`/`otros`; en `GastoOperario`: igual con `varios`; en `NotaGastos`: equivalente `concepto`) → la nota se marca como **`no_material_eliminado`** y no se analiza. Es el 80-90% de las notas (gasolina, comidas, peajes, etc.) — filtrado en segundos, sin IA.
- **Filtro 2 — sin adjunto**: si la nota no tiene `archivos[]`/`ticket_url`, se marca **`sin_adjunto`** — no se puede OCR-ear; el usuario la ve en el panel pero debe rellenar manualmente.
- **Filtro 3 — ya OCR-izada antes**: si la nota ya tiene `ocr_raw` no vacío (p.ej. fue procesada por `procesarOcrNota` al crearla), **reutilizar ese `ocr_raw` en lugar de re-invocar el OCR+IA**. Ahorro masivo de créditos: las notas existentes lizard se reutilizan.

Sólo las notas que pasan los 3 filtros (categoría `material`, con adjunto, sin `ocr_raw` o con `ocr_raw` insuficiente) se envían a una **extracción acaba por IA** reutilizando el mismo `aiOrchestrator.ocrDocumento` y el prompt actual de `procesarFacturaMateriales` (sin tocar).

#### C.2 Extracción de líneas (si aplica)

Si la nota necesita OCR, se invoca `procesarFacturaMateriales` (reusando la función existente) con el `file_url` del primer adjunto. Resultado: una lista de líneas `{ referencia, fabricante, descripcion, cantidad, precio_neto }`.

**Importante**: hoy `procesarFacturaMateriales` está pensado para facturas de proveedores con líneas; en `RegistroGasto` material-puro de obra (p. ej. sack of tornillos) lo más probable es que no tenga líneas detalladas y la IA devuelva `lineas: []`. El proceso debe **degradar con elegancia**: si la IA no devuelve líneas, la nota se marca como **`pendiente_sin_lineas`** y se muestra al usuario para que la procese manualmente en `/materiales-ocr` (no decidir contenido en silencio).

#### C.3 Cruce contra `MaterialCatalog`

Por cada línea extraída, el proceso cruza contra el catálogo:

- **Coincidencia exacta por referencia**: si la línea tiene `referencia` no vacía, se busca `MaterialCatalog.filter({ referencia, fabricante_id })` (igual que ya hace `guardarMaterialesOcr` hoy). Match → material conocido (caso b).
- **Coincidencia fuzzy descripción + fabricante** (cuando no hay referencia): se normaliza la descripción (UPPERCASE, sin acentos, sin signos) y se compara contra el campo `name` de todos los `MaterialCatalog` activos del mismo fabricante. Algoritmo concreto:
  - **Distancia de Levenshtein normalizada**: `similitud = 1 - levenshtein(a, b) / max(len(a), len(b))`.
  - **Umbral: similitud ≥ 0.85** para considerar "mismo material".
  - Si hay varios candidatos, se elige el de mayor similitud.
  - Si la mejor similitud es **< 0.85**, se considera **material nuevo** (caso a).
- Para Implementación eficiente: la normalización de Levenshtein es ligera en JS; el catálogo activo tiene típicamente < 500 materiales, así que por línea son ~500 comparaciones de strings. Aceptable si se cron-cachean los nombres normalizados en memoria de la función. Si el catálogo crece por encima de ~2k, **recomendación v1.1**: indexar por N-gramas o precalcular hashes de palabras clave.

**Decisión C:** algoakgoritmo concreto = Levenshtein normalizado con umbral 0.85 sobre descripción normalizada, dentro del mismo `fabricante_id`. Si hay referencia exacta, esa gana. Sin fabricante, se cruza contra todos los materiales (más costoso pero rarísimo en las notas).

#### C.4 Clasificación final de la nota

Tras el cruce por líneas, la nota se clasifica:
- `cubre_a` (material nuevo) si al menos una línea no tiene match.
- `cubre_b` (entradorea de materiales existentes) si todas las líneas con match.
- `cubre_mezcla` si tiene de las dos (predominante en cuantas líneas nuevas vs. existentes).
- `pendiente_sin_lineas` si la IA no devolvió líneas.
- `no_material_eliminado` (sin líneas analíticamente, no entra a Materiales).
- `sin_adjunto` (no se puede procesar).

## D. Mecanismo de periodicidad

### D.1 Decisión: tarea programada semanal + botón manual

**Decisión D (recomendada):**

- **Periodicidad:** semanal, **lunes 07:00 Europe/Madrid** (06:00 UTC en invierno / 05:00 UTC en verano; la propia conversión a UTC corre a cargo de `create_automation`).
- **Mecanismo:** `create_automation(automation_type="scheduled", repeat_unit="weeks", repeat_on_days=[1], start_time="07:00", ...)` invocando una **función backend** `comprobarCoberturaMateriales` (nueva, Builder+).
- **Botón manual "Forzar comprobación"** además, siempre disponible para admin/gerencia — lanza la misma función síncrona pero con progreso visible.

**Por qué semanal:** diaria sería excesiva (no hay tanto volumen semanal de notas `material` con adjunto entre creaciones y la 1ª revisión completa del histórico deja la cola vacía); mensual tardaría demasiado en detectar un nuevo proveedor que el técnico fotografió hace 4 semanas. Semanal es el equilibrio: lunes por la mañana, gerencia llega con el estado actualizado para la semana.

**Por qué no usar el agente `fichaje_alerts`-style para la periodicidad:** el fichaje_alerts es un agente *in-app* (config + InvokeLLM para responder a prompts en el chat); el scheduling se hace **aparte** (en `create_automation` tipo `scheduled`). El agente no es el motor del cron. Aquí no necesitamos agente conversacional — solo un proceso programado deterministic que escribe resultados a entidad,opcionalmente con un agente in-app `cobertura_materiales_agent` que responda "¿qué pendientes hay sin procesar?" — dejar v1.1.

### D.2 Parámetros del cron

| Parámetro | Valor |
|---|---|
| `automation_type` | `scheduled` |
| `schedule_mode` | `recurring` |
| `repeat_unit` | `weeks` |
| `repeat_on_days` | `[1]` (lunes) |
| `start_time` | `07:00` |
| `function_name` | `comprobarCoberturaMateriales` |
| `function_args` | `{ "modo": "incremental", "max_notas": 200 }` |
| `is_active` | `true` |

Y una **segunda automatización manual** no es necesaria — el botón invoca la función directamente desde el cliente con `base44.functions.invoke(...)`.

### D.3 Modo incremental vs completo

- **Incremental (semanal)**: solo revisa notas con `created_date > fecha_ultima_comprobacion_exitosa`. Para evitar re-procesar IA en notas ya analizadas en sesiones anteriores, se persiste `fecha_ultima_comprobacion` en `CoberturaMaterialesSesion` (ver §F). Las notas marcadas como `no_material_eliminado` quedan en caché y no se vuelven a tocar.
- **Completo (botón "Forzar comprobación"):** revisa **todo el histórico** (paginado). Solo para los casos en que gerencia quiera revalidar todo despido de cambios en el catálogo.

## E. Volumen esperado

### E.1 Estimación

Actualmente no tenemos el recuento exacto (no es trivial de inferir; el desarrollador/admin puede consultarlo con `base44.entities.RegistroGasto.list('', 0)` o admin UI). Asumiendo:

- ~6-18 meses de notas de gastos con el sistema en uso.
- ~5-20 notas por operario activo por mes.
- ~8-15 operarios activos en ese periodo.
- Filtro categoría `material` (~10-20% del total, estimación de la decisiación C).

→ Total histórico: estimación **1.000–5.000 notas** entre las 3 entidades. Tras el filtro `categoria==material` (sólo éstas se mandan a IA): **100–1.000 notas candidatas a OCR**.

### E.2 Razones por las que se puede hacer en una sola invocación

- La 1ª pasada (con fallback URL retroactivo, §B) no consume IA: solo lista `MaterialDocumentoOrigen` (típanmente < 500) y recorre las URLs del histórico (sin IA).
- Tras el filtro de categoría y reuso de `ocr_raw` ya existente, el consumidor IA real es **descrece mucho**: solo notas con categoría `material`, con adjunto, sin `ocr_raw` reciente. Estimación pesímista: **50-300 notas con IA**.
- Cada invocación `procesarFacturaMateriales` tarda **~3-8 s** por llamada → 50 llamadas = 4-7 min; 300 = 15-40 min. **Por encima de un timeout razonable de función (~30-60 s)**.

### E.3 Decisión: paginación por lotes

**Decisión E:** la función `comprobarCoberturaMateriales` se diseña **paginada por lotes** desde el día uno, con persistencia de estado:

- Cada invocación procesa **un lote de N notas** (configurable, por defecto `max_notas: 200`) y devuelve `{ procesadas, pendientes_mix, has_more: bool, next_cursor }`.
- Si el modo es **completo** o el incremento > max_notas, el cron lanza la función varias veces encadenadas en "modo chain" (la función se re-invoca con `next_cursor` desde su propio final). Alternativamente, el cron establece `max_notas` alto y el lote fácil cubre (en noche semanal suele haber pocas notas nuevas).
- El **botón manual** muestra progreso (`lote 1/N`) en la UI utilizando React Query + un websocket opcional; sin él, se muestra progreso fake con incrementos de 10%.

**No intentamos nunca procesar el histórico completo en una sola invocación** para evitar timeouts. Cada lote se ejecuta en ≤ 60 s.

## F. Entidad de registro de comprobaciones — `CoberturaMaterialesSesion`

Nueva entidad singleton batch para persistir cada ejecución:

```jsonc
{
  "name": "CoberturaMaterialesSesion",
  "type": "object",
  "properties": {
    "fecha_ejecucion": { "type": "string", "format": "date-time", "description": "ISO timestamp de la ejecución" },
    "origen": { "type": "string", "enum": ["manual", "programada"], "description": "Quién/order lanzó esto" },
    "lanzado_por": { "type": "string", "description": "Email del usuario (si manual) o 'system' (si programada)" },
    "modo": { "type": "string", "enum": ["incremental", "completo"], "description": "Alcance" },
    "total_revisadas": { "type": "number", "default": 0, "description": "Notas revisadas en esta sesión" },
    "cubiertas": { "type": "number", "default": 0, "description": "Notas con MaterialDocumentoOrigen enlazado" },
    "no_material": { "type": "number", "default": 0, "description": "Notas descartadas por categoría ≠ material (filtro barato)" },
    "sin_adjunto": { "type": "number", "default": 0 },
    "pendientes_material_nuevo": { "type": "number", "default": 0, "description": "Caso (a): materiales inexistentes" },
    "pendientes_entrada_existente": { "type": "number", "default": 0, "description": "Caso (b): compra de existente" },
    "pendientes_sin_lineas": { "type": "number", "default": 0, "description": "IA no devolvió líneas" },
    "pendientes_ids": { "type": "array", "items": { "type": "object", "properties": { "id": { "type": "string" }, "tipo": { "type": "string", "enum": ["registro_gasto", "notagastos", "gasto_operario"] }, "fecha": { "type": "string" }, "importe": { "type": "number" }, "proveedor": { "type": "string" }, "categoria": { "type": "string" }, "operario_name": { "type": "string" }, "adjunto_url": { "type": "string" }, "clasificacion": { "type": "string", "enum": ["nuevo", "existente", "sin_lineas"] } } } }, "description": "Snapshot del listado de pendientes para mostrar sin volver a consultar entidades" },
    "fecha_ultima_comprobacion": { "type": "string", "format": "date-time", "description": "Última fecha cubierta en la revisión (para incremental siguiente)" },
    "next_cursor": { "type": "string", "description": "Cursor de paginación para continuar lote por lote" },
    "duracion_ms": { "type": "number", "description": "Duración total de la ejecución (ms)" },
    "ia_usada": { "type": "boolean", "description": "True si se invocaron IA vía aiOrchestrator (para cost-control)" },
    "modelo_ia": { "type": "string", "description": "Modelo primario usado (base44/claude), o null si no hubo IA" },
    "errores": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["fecha_ejecucion", "origen"],
  "rls": {
    "create": { "$or": [ { "user_condition": { "role": "admin" } }, { "user_condition": { "role": "gerencia" } } ] },
    "read":   { "$or": [ { "user_condition": { "role": "admin" } }, { "user_condition": { "role": "gerencia" } }, { "user_condition": { "role": "director_comercial" } } ] },
    "update": { "user_condition": { "role": "admin" } },
    "delete": { "user_condition": { "role": "admin" } }
  }
}
```

**Por qué guardamos `pendientes_ids` snapshot:** las consultas a `RegistroGasto` de un listado grande sean costosas; en cambio, el snapshot ya tiene lo justo para dibujar el panel inmediatamente sin ir otra vez a las entidades. El detalle (líneas OCR, etc.) se recupera on-demand cuando el usuario abre una concreta.

## G. Función backend `comprobarCoberturaMateriales` (nueva, Builder+)

### G.1 Esquema de ejecución

```text
0. Auth (auth.me) - solo admin/gerencia (la 403 para otros).
1. Cargar última CoberturaMaterialesSesion (para fecha_ultima_comprobacion y cursor).
2. Si modo=completo, recorrer desde el principio.
3. Listar lotes de {RegistroGasto, NotaGastos, GastoOperario} desde la fecha de corte (o todo en modo completo), max N por lote.
4. Para cada notaCandidate:
   a. Cargar MaterialDocumentoOrigen con nota_gasto_id == nota.id (si existe → cubierta++, continue).
   b. Si no existe enlace y es primera pasada (habilitar fallback url):
        buscar MaterialDocumentoOrigen por archivo_url_mejorado/archivo_url_original == nota.adjuntos[0].url.
        Si match → cubierta++ AND persistir enlace nota_gasto_id retroactivamente.
   c. Si sigue no cubierta:
        - Si categoria != material → no_material++, classify "no_material_eliminado", continue.
        - Si no tiene adjunto → sin_adjunto++, classify "sin_adjunto", continue.
        - Si tiene ocr_raw no vacío → reusar (no llama IA).
        - Si no ocr_raw → invocar procesarFacturaMateriales(file_url) → lineas.
        - Para cada línea, cruzar vs MaterialCatalog (referencia exacta → Levenshtein desc+fabricante ≥0.85).
        - Clasificar la nota en cubre_a / cubre_b / cubre_mezcla / pendiente_sin_lineas.
        - Guardar pendiente en pendientes_ids snapshot.
5. Persistir CoberturaMaterialesSesion.create({...}).
6. Si has_more → devolver cursor para que la siguiente invocación (programada o manual-chain) siga.
7. Devuelve JSON: { fecha_ejecucion, total_revisadas, cubiertas, pendientes_*, pendientes_ids, has_more, next_cursor, ia_usada, modelo_ia }.
```

### G.2 Reutilización del orquestador IA

`procesarFacturaMateriales` ya usa `aiOrchestrator.ocrDocumento` (Base44 primero + Claude respaldo). **No se duplica el patrón.** Si en el futuro se quiere hacer la clasificación de "material nuevo vs existente" con IA en lugar de Levenshtein (para mejorar precisión), se añade una **nueva export en `aiOrchestrator.ts`**, por ejemplo `clasificarLineaMaterial`, con la misma arquitectura primary/fallback — nunca un archivo nuevo desconectado.

## H. UI — botón "Forzar comprobación" + panel de resultados

### H.1 Ubicación

Se añade una **tercera pestaña** dentro de `/materiales-ocr` (que ya tendrá la pestaña "Cargar" existente y — si entra la propuesta anterior — la pestaña "Pendientes"):

```
[MaterialesOcr.jsx · Tabs]
   ├─ "Cargar"               — lo que ya existe hoy.
   ├─ "Pendientes"           — definido en propuesta anterior (Notas pend postuels).
   └─ "Cobertura de materiales"  — NUEVO (esta propuesta).
```

Solo visible para admin/gerencia (`useUserRole`).

### H.2 Componente `CoberturaMaterialesPanel.jsx` (nuevo)

Layout (mobile-first, mobile == gritty today):

```
[Card · Última comprobación]
   Estado global: badge color
   Fecha: 2026-08-22 07:00 (programada) · 4m 32s de ejecución
   Model IA: base44 (o "sin IA en esta pasada")
   
   Total revisadas: 237
   └ Cubiertas:    182  (76.8%)
   └ No-material:   35  (14.8%)
   └ Pendientes:    20  (8.4%)
        ├ Material nuevo:      7
        ├ Entrada de existentes: 11
        └ Sin líneas IA:        2

[Button — primary] 🔄 Forzar comprobación completa
[Button — ghost]   Programar próxima pasada (link a automation settings)

[Filters · input text]
[Search en proveedor / num_factura / operario]

[Listado de pendientes · cards móviles]
   Para cada pendiente:
     - Badge clasificación [Material nuevo | Entrada (existente) | Sin líneas IA]
     - Tipo de operación: REG-2026-0178 · Repsol Gasóleo · 41.50 € · 2026-08-15
     - Operario: Juan Pérez
     - miniatura adjunto (si hay)
     - Botón "Procesar en Alta Materiales" → MaterialesOcrDialog(nota_origen={id, tipo}).
     - Botón "Ver nota original" → /notas-gastos?registro_id=<id> (alt 1).
```

Diferencia con la pestaña "Pendientes" (propuesta anterior): esa pestaña proponía un **listado plano de notas no migradas** (binario sí/no); esta pestaña "Cobertura de materiales" añade el **desglose de pendientes por tipo (nuevo/existente/sin líneas)** y los **totales de la última ejecución**. Son complementarias; se podrían fusionar en una sola táb "Pendientes + Cobertura" si gerencia prefiere — dejado como decisión en §1.

### H.3 Botón "Forzar comprobación" — comportamiento síncrono

- Al pulsar, setea `loading=true` y muestra spinner con contador `lote 1/N`.
- Invoca `base44.functions.invoke('comprobarCoberturaMateriales', { modo: 'completo', max_notas: 200 })`.
- Si `has_more=true`, **auto-encadena** la próxima llamada con `next_cursor` pasado como `cursor`.
- Mínima degradación: si la sesión completa consume >2 lotes, mostrar botón "Continuar en segundo plano" que sigue encadenando (backend en background, frontend deja spinner suave).
- Al finalizar, renderiza el resultado.

### H.4 Acción "Procesar en Alta Materiales"

Reutiliza la prop `nota_origen_id` y `nota_origen_tipo` de `MaterialesOcrDialog` (ya propuesta en §F del documento anterior). El diálogo precarga el adjunto y su cabecera. Al guardar, `guardarMaterialesOcr` persiste `nota_gasto_id`. Tras el guardado, **invalida la query** `CoberturaMaterialesSesion` y la nota desaparece de "pendientes".

## I. Notificaciones — valoración

El prompt pide "**considerar**" notificar; no obligatorio. **Decisión: NO en v1**, opt-in v1.1.

**Razones para posponer:**
- La 1ª pasada semanal puede dejar 50-300 pendientes; notificar de eso generaría ruido excesivo ("300 pendientes!!!") sin que gerencia pueda actuar de forma útil en una sola sesión.
- El panel `CoberturaMaterialesPanel` ya está siempre visible al usuario objetivo (gerencia/admin) en el módulo que frecuenta; no necesita empuje.
- Si tras ~4 semanas de uso estable el patrón es "normally 0-10 pendientes nuevos por semana", entonces **OK para notificar** cuando `pendientes_nuevos > 0`. Es una decisión post-data.

**Si se introduce en v1.1:** notificación es un registro en entidad `AsistenteTarea` (ya existente) para gerencia/admin con prioridad `media`, texto "Cobertura de materiales: N notas pendientes de revisión". No se envía email (patrones del proyecto: notificaciones intra-app + chat en tiempo real; los emails son opcionales).

## J. Cambios totales — superficie por archivo

| Archivo | Cambio | Tipo |
|---|---|---|
| `base44/entities/MaterialDocumentoOrigen.jsonc` | Añadir `nota_gasto_id` + `nota_origen_tipo`. | EDIT entitdad |
| `base44/entities/CoberturaMaterialesSesion.jsonc` | **NUEVO** — esquema de la entidad | entity nueva |
| `base44/functions/guardarMaterialesOcr/entry.ts` | Aceptar y persistir `documento.nota_gasto_id` + `nota_origen_tipo`. | EDIT backend |
| `base44/functions/comprobarCoberturaMateriales/entry.ts` | **NUEVO** — función de comprobación (lotes, fallback URL, filtros, IA reusada, Levenshtein). | backend nueva |
| `base44/shared/aiOrchestrator.ts` | Sin tocar (se reutiliza). | — |
| `base44/shared/textUtils.ts` | **NUEVO** (opcional) — función `normalizarTexto(s)` + `levenshtein(a, b)` para el cruce. | shared nueva |
| `src/components/materiales/CoberturaMaterialesPanel.jsx` | **NUEVO** — panel UI con totales, botón "Forzar", listado accionable. | frontend nuevo |
| `src/pages/MaterialesOcr.jsx` | EDIT — añadir pestaña "Cobertura de materiales". | EDIT frontend |
| `src/components/materiales/MaterialesOcrDialog.jsx` | EDIT (de la propuesta anterior) — aceptar `nota_origen_id`, `nota_origen_tipo`. | EDIT frontend |
| `create_automation` (CLI de infra) | **NUEVO** — automatización scheduled lunes 07:00 → `comprobarCoberturaMateriales`. | infra (config) |

**Tamaño estimado de cambios:** ~250 líneas backend + ~200 líneas frontend + ~2 esquemas Entity. **3-5 días de implementación tras aprobación**, sujeto a Builder+.

## K. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Histórico > 5000 notas con IA sufriría timeout | Paginación por lotes (§E.3) + filtro `categoria==material` (§C.1) + reuso de `ocr_raw` existente. |
| IA consumiendo créditos en notas que no son materiales | Filtro `categoria != material` antes de la IA descarta el 80-90% de las notas. |
| Falsos negativos en cruce Levenshtein (umbral 0.85 demasiado estricto) | El caso (a) "material nuevo" se muestra al usuario antes de persistir en `MaterialCatalog`; el usuario corrobora. No hay persistencia aciegada. |
| Una nota migrada vía "Procesar Alta Materiales"; el enlace no se persiste y vuelve a figurar como pendiente en la siguiente pasada | El campo `nota_gasto_id` es obligatorio en `guardarMaterialesOcr` cuando el payload proviene de nota origen. Tests cubren este caso. |
| Eliminar una `MaterialDocumentoOrigen` rompe el "cubierto" | RLS impide delete a no-admin; el admin sabe que rompe el tracking. Document pending. |
| Ruido por primeras pasadas con backlog grande | v1 sin notificaciones. Se valora post-data. |
| Plan Builder+ bloquea backend | La Parte frontend puede construirse con mocks y datos ya persistidos en `CoberturaMaterialesSesion`, simulando sesiones. |
| Bucle infinito: una nota que falte siempre a un límite de confianza determinado crea pendiente eterno | Marca `pendientes_sin_lineas` se muestra como "revisar manualmente"; el usuario la procesa a través de `MaterialesOcrDialog` con CamScanner + carga manual → `nota_gasto_id` se persiste → des-aparece de pendientes. |

## L. Decisiones pendientes de Gerencia / Administración

- [ ] Aprobar la **revisión sobre las 3 entidades con adjunto** (`RegistroGasto` + `NotaGastos` + `GastoOperario`).
- [ ] Aprobar el **enlace explícito `nota_gasto_id`** como criterio de cubierto (§B), con fallback retroactivo URL solo en la 1ª pasada.
- [ ] Aprobar el **cruce Levenshtein umbral 0.85** para diferenciar material nuevo de existente (§C).
- [ ] Aprobar el **filtro barato por categoría** que descarta gasolina/peaje/parking/comida/otros sin llamar IA (§C.1).
- [ ] Aprobar la **periodicidad semanal lunes 07:00 Madrid** + botón "Forzar comprobación" manual (§D).
- [ ] Aprobar la **entidad `CoberturaMaterialesSesion`** como store de cada ejecución, con snapshot de pendientes (§F).
- [ ] Aprobar la **ubicación en una tercera pestaña dentro de `/materiales-ocr`** (§H), o fusionar con la pestaña "Pendientes" de la propuesta anterior.
- [ ] Aprobar **no notificaciones en v1**, opt-in v1.1 post-data (§I).
- [ ] Aprobar el **encadenamiento por lotes** con cursor (§E.3) para no depender de un único timeout.

## M. Plan de implementación, tras aprobación

1. **Fase 0 — Entidades + enlace (Builder+)** (0.5 día)
   - `MaterialDocumentoOrigen` añade `nota_gasto_id` + `nota_origen_tipo`.
   - `CoberturaMaterialesSesion` nueva entidad.
   - `guardarMaterialesOcr` persiste enlace.

2. **Fase 1 — Función de comprobación (Builder+)** (1.5 días)
   - `base44/shared/textUtils.ts` (normalización + Levenshtein).
   - `comprobarCoberturaMateriales/entry.ts` con lotes, filtros, reuso de OCR, cruce, snapshot, persistencia.

3. **Fase 2 — UI del panel + botón** (1-2 días, sin backend aún, puede empezar antes con mock de sesión)
   - `CoberturaMaterialesPanel.jsx`.
   - Pestaña en `MaterialesOcr.jsx`.
   - Integración con `MaterialesOcrDialog` (prop `nota_origen_id` — ya propuesta).
   - Botón "Forzar" con progreso por lotes.

4. **Fase 3 — Programación semanal** (0.5 día)
   - `create_automation(scheduled, weeks=[1], 07:00, salario Madrid)`.
   - Smoke test con dry-run.

5. **Fase 4 — Fallback URL retroactivo +ijon 1ª pasada** (0.5 día)
   - En la 1ª invocación real tras deploy, se ejecuta el matching por URL y se persisten los enlaces cubiertos del histórico.

**Total estimado: 3-5 días tras aprobación**, sujeto a Builder+ para Fases 0, 1, 3, 4. La Fase 2 se puede arrancar ya con datos mock.

---

Una vez aprobadas las decisiones de §L, se procede a la implementación según el plan de §M.