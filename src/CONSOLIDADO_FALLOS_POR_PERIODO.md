# Consolidado de fallos por periodo — Análisis + Propuesta técnica

> Estado: **Aprobación pendiente de Gerencia**. Este documento no implementa nada;
> solo responde A–E, propone el algoritmo de deduplicación, el esquema de datos y el
> diseño del documento final, listo para revisión antes de pasar a código.
>
> Proyecto: Smart Gestión (Simantec) · Base44 · appId `69de8e23b1cd7ac050397c82`

---

## Contexto y motivación

Hoy cada fallo queda registrado de forma aislada:

- **Vigilancia** (`VigilanciaEvento`, `tipo_evento ∈ {error, promise_rejection}`) —
  solo existe si había una vigilancia activa apuntando al usuario en ese instante;
  de lo contrario el error no se captura por esta vía.
- **Diagnóstico** (`DiagnosticoSesion` con `tipo ∈ {crash_js, rechazo_promesa,
  pantalla_blanca, timeout_red, error_auto}`) — captura global vía `errorHandler.js`
  (`window.error` + `unhandledrejection` + detector de pantalla blanca); existe
  siempre, sin vigilancia activa.
- Otras fuentes menores con semántica de fallo (ver apartado A).

El gerente, cuando bloquea tiempo para "arreglar fallos de este mes/semana",
necesita **un único documento** con los fallos reales del periodo, ya
deduplicados, contados y agrupados — en vez de ir registro a registro por
`DiagnosticoSesion` o `VigilanciaEvento`. El informe de periodo actual de
Vigilancia **no sirve para esto**: junta TODOS los eventos (nav, click, red,
render…), no funciona en ausencia de vigilancia activa, y no deduplica.

---

## A. Inventario de fuentes de fallos

Tras revisar entidades y código, las fuentes válidas para el consolidado son:

| Fuente / Entidad | Campo que marca el fallo | Siempre captura | Comentario |
|---|---|---|---|
| **`DiagnosticoSesion`** | `tipo ∈ {crash_js, rechazo_promesa, pantalla_blanca, timeout_red, error_auto}` + `severidad ∈ {error, critico}` | ✅ Sí | **Fuente primaria.** Captura global de `errorHandler.js`. `ruta` + `mensaje_error` + `stack_trace` disponibles. |
| **`VigilanciaEvento`** | `tipo_evento ∈ {error, promise_rejection}` | ⚠️ Solo con vigilancia activa | Complementa a Diagnóstico cuando hay vigilancia. `datos.mensaje`/`datos.stack` en `datos` (JSON). |
| **`NetworkTelemetry`** | `success=false` **o** `error_type ∈ {timeout, network, parse, rls}` | ✅ Sí | Fallos de query a la API. `module_accessed`, `operation`, `query_duration_ms`, `error_type`, `retry_count`. Sin email (hash anónimo) → se reporta como "usuario anónimo". |
| **`SystemHealthCheck`** (si registra fallos) | estado distinto a "ok" / `error_type` | según cron diario | Revisar su schema; si solo guarda checks OK no se incluye. |
| **`ArchivoSyncPendiente`** | existencia de registros con estado `pendiente` reintentado N veces | ✅ Sí | Fallos de subida a Drive (trazabilidad de las fotos). Incluir como **fuente de fallo de sincronización**. |

**Excluidas (no son fallos):** `PerformanceMetrics` (agregado de rendimiento,
no fallos), `DuplicadoLog` (auditoría de detección de duplicados, no errores),
`VinculacionLog` (auditoría de vinculación), `DatosSensiblesAccessLog`
(auditoría de accesos a datos sensibles — son SIEMPRE intencionales, no fallos),
`NotificacionFichaje`/`AlarmaHorario` (alertas de negocio, no fallos de app).

> **Decisión A:** el consolidado bebe de `DiagnosticoSesion` (primaria,
> siempre) + `VigilanciaEvento` (cuando haya) + `NetworkTelemetry` (fallos de
> API) + `ArchivoSyncPendiente` (fallos de sync). `SystemHealthCheck` queda
> condicional a revisión de su contenido.

---

## B. Criterio de "mismo fallo" (deduplicación)

No se puede exigir coincidencia exacta del `mensaje_error`: el mismo bug genera
mensajes con IDs, timestamps y rutas distintas ("Cannot read property 'x' of
undefined @ ObraFotosPanel.jsx:54", "… :88", "… :61"). Hay que agrupar por una
**firma estable**.

### Definición de firma (`fallo_id`)

```
firma = SHA1( tipo_normalizado + "│" + componente_o_ruta_normalizado + "│" + mensaje_canonico )
```

Donde:

1. **`tipo_normalizado`** — un código corto que abstrae el subtipo:
   - `crash_js`, `rechazo_promesa`, `pantalla_blanca`,
   - `timeout_red` (engloba `timeout_red` de Diagnóstico y `error_type=timeout/network/parse` de NetworkTelemetry),
   - `rls` (de NetworkTelemetry, `error_type=rls`),
   - `sync_drive` (de ArchivoSyncPendiente).
   - Mapeo явный porque Diagnóstico ya distingue `timeout_red` de `crash_js`; presente para no mezclar.

2. **`componente_o_ruta_normalizado`** — el componente/ruta donde ocurre:
   - De `DiagnosticoSesion.ruta`: solo el **path sin query**, sin IDs (`/obras-civiles/1234` → `/obras-civiles/:id`). Regla: sustituir segmentos numéricos largos (≥6 dígitos) por `:id`, y UUIDs por `:id`.
   - Si `ruta` está vacío, intentar extraerlo del `stack_trace` (primera línea con `@ /src/...`). Si tampoco, marcar `?`.
   - De `VigilanciaEvento.ruta` (mismo normalizado).
   - De `NetworkTelemetry.module_accessed` (campo libre; usar tal cual, ya es nombre de módulo).
   - De `ArchivoSyncPendiente`: usar `entidad_tipo` (p. ej. `FotoProyecto`) como componente.

3. **`mensaje_canonico`** — el `mensaje_error` normalizado para eliminar detalles variables:
   - Lowercase.
   - Quitar URLs, UUIDs, números hexadecimales largos, timestamps ISO, IDs numéricos largos → se reemplazan por `«X»`.
   - Quitar sufijo ` @ fichero:línea:col` (la línea cambia con refactor).
   - Truncar a **las primeras 80 caracteres** tras la normalización.
   - Eliminar espacios múltiples.

### Por qué este algoritmo

- Es **estable ante refactor**:Hola  la línea del `@ fichero:línea` se ignora, así que el mismo bug reportado en `:54` y (tras mover código) en `:88` cae en el mismo grupo.
- Es **estable ante IDs**: el `:id` en la ruta evita que un error en `/obras-civiles/1234` y `/obras-civiles/5678` se vean como dos fallos distintos cuando el bug es del componente `ObraFotosPanel`.
- Es **rápido**: el hash permite agrupar con un `Map<firma, agregado>` en una sola pasada O(n).
- El límite de 80 caracteres del mensaje canonizado evita que errores con tail variable enorme (p. ej. un JSON gigante de conexión de red) generen miles de firmas.

### Pseudocódigo del agrupador

```js
function firmaFallo(item) {
  const tipo = normalizarTipo(item);            // 'crash_js' | 'rechazo_promesa' | ...
  const comp = normalizarComponente(item);      // '/obras-civiles/:id' | 'FotoProyecto' | '?' | ...
  const msg  = canonizarMensaje(item.mensaje);  // 'cannot read property «x» of undefined'
  return sha1([tipo, comp, msg].join('│'));
}

// Una pasada:
const grupos = new Map();
items.forEach(it => {
  const f = firmaFallo(it);
  if (!grupos.has(f)) grupos.set(f, { firma:f, tipo, componente:comp,
    mensaje_canonico:msg, muestra_original:it.mensaje,
    ocurrencias:0, primera:null, ultima:null, usuarios:new Set(), rutas:new Set() });
  const g = grupos.get(f);
  g.ocurrencias++;
  g.primera = g.primera ? min(g.primera, it.fecha) : it.fecha;
  g.ultima  = max(g.ultima, it.fecha);
  g.usuarios.add(it.user_email || 'anónimo');
  g.rutas.add(it.ruta || comp);
});
// Orden final: ocurrencias DESC, luego ultima DESC.
```

---

## C. ¿Al vuelo, guardado en BD, o ambos?

### Opciones

1. **Al vuelo** (como `informe_periodo` de Vigilancia): en cada "Generar" se
   consultan las fuentes, se agrupa, se muestra y se descarta. Sin nada
   persistido.
2. **Guardado**: cada consolidado se persiste como entidad; el gerente puede
   reabrirlo, marcar fallos como resueltos, y que consolidados futuros del
   mismo tipo no repitan lo ya resuelto.

### Recomendación — opción 2 (guardado) con borrado suave

La opción 1 cumple los puntos 1–4 del objetivo, pero **no el 5** ("tachar
fallos ya arreglados"). Como el objetivo explícito del gerente es "ir
arreglando", sin persistencia no podemos saber qué ya se trató; el próximo
consolidado del mismo periodo volvería a listar el mismo fallo.

**Persistir cada consolidado generado** y **marcar cada fallo agrupado como
resuelto/no** resuelve el caso de uso completo.

**Coste adicional mínimo**: una entidad `ConsolidadoFallo` (cabecera) y
`ConsolidadoFalloItem` (una fila por firma agrupada con su estado). El cálculo
sigue siendo bajo demanda; no es programado.

---

## D. Esquema mínimo para marcar fallos como resueltos

### Entidad `ConsolidadoFallos` (cabecera del consolidado)

```jsonc
{
  "name": "ConsolidadoFallos",
  "type": "object",
  "properties": {
    "periodo_tipo":  { "type": "string", "enum": ["semanal", "mensual", "personalizado"] },
    "fecha_desde":   { "type": "string", "format": "date-time" },
    "fecha_hasta":   { "type": "string", "format": "date-time" },
    "etiqueta_periodo": { "type": "string" },
    "total_fallos_unicos":  { "type": "integer", "default": 0 },
    "total_ocurrencias":   { "type": "integer", "default": 0 },
    "fallos_resueltos":    { "type": "integer", "default": 0 },
    "fallos_pendientes":   { "type": "integer", "default": 0 },
    "generado_por":        { "type": "string", "description": "email" },
    "fecha_generacion":    { "type": "string", "format": "date-time" },
    "archivo_txt_url":     { "type": "string", "description": "TXT guardado en CDN (opcional)" },
    "notas_gerencia":      { "type": "string" }
  },
  "required": ["periodo_tipo", "fecha_desde", "fecha_hasta", "generado_por"],
  "rls": {
    "create": { "$or": [ { "user_condition": { "role": "admin" } },
                        { "user_condition": { "role": "gerencia" } } ] },
    "read":   { "$or": [ { "user_condition": { "role": "admin" } },
                        { "user_condition": { "role": "gerencia" } } ] },
    "update": { "$or": [ { "user_condition": { "role": "admin" } },
                        { "user_condition": { "role": "gerencia" } } ] },
    "delete": { "user_condition": { "role": "admin" } }
  }
}
```

### Entidad `ConsolidadoFalloItem` (un fallo agrupado dentro de un consolidado)

```jsonc
{
  "name": "ConsolidadoFalloItem",
  "type": "object",
  "properties": {
    "consolidado_id":    { "type": "string", "description": "ID del ConsolidadoFallos padre" },
    "firma":             { "type": "string", "description": "SHA1 de deduplicación (permite cruzar consolidados)" },
    "tipo":              { "type": "string" },
    "componente":        { "type": "string", "description": "ruta/módulo normalizado" },
    "mensaje_canonico":  { "type": "string" },
    "mensaje_ejemplo":   { "type": "string", "description": "un mensaje original representativo" },
    "ocurrencias":       { "type": "integer", "default": 1 },
    "primera_ocurrencia":{ "type": "string", "format": "date-time" },
    "ultima_ocurrencia": { "type": "string", "format": "date-time" },
    "usuarios_afectados": { "type": "array", "items": { "type": "string" } },
    "rutas_afectadas":   { "type": "array", "items": { "type": "string" } },
    "fuentes":           { "type": "array", "items": { "type": "string" } },
                          "description": "De qué entidades viene:_DIAGNOSTICO, VIGILANCIA, NETWORK_TELEMETRY, ARCHIVO_SYNC",
    "estado":           { "type": "string", "enum": ["pendiente", "resuelto", "ignorado"], "default": "pendiente" },
    "resuelto_por":     { "type": "string" },
    "fecha_resolucion": { "type": "string", "format": "date-time" },
    "notas":            { "type": "string" }
  },
  "required": ["consolidado_id", "firma", "tipo", "mensaje_canonico", "ocurrencias"],
  "rls": {
    "create": { "$or": [ { "user_condition": { "role": "admin" } },
                        { "user_condition": { "role": "gerencia" } } ] },
    "read":   { "$or": [ { "user_condition": { "role": "admin" } },
                        { "user_condition": { "role": "gerencia" } } ] },
    "update": { "$or": [ { "user_condition": { "role": "admin" } },
                        { "user_condition": { "role": "gerencia" } } ] },
    "delete": { "user_condition": { "role": "admin" } }
  }
}
```

### Cómo se "tacha" un fallo para consolidados futuros

Al generar un nuevo consolidado del mismo tipo de periodo (p. ej. mensual del
mes siguiente), el flujo es:

1. Recoger y agrupar los fallos del nuevo periodo ( Apartado B ).
2. **Cruzar cada firma nueva contra `ConsolidadoFalloItem.firma` con
   `estado='resuelto'` en consolidados anteriores**: si ya fue marcado
   resuelto, ese item se **excluye por defecto** del nuevo consolidado (o se
   muestra marcado como "previamente resuelto", a elección de Gerencia).
3. El gerente que vuelve a encontrarlo lo puede reabrir pasándolo a `pendiente`.

> **Decisión D:** dos entidades (`ConsolidadoFallos` + `ConsolidadoFalloItem`),
> estado por ítem (`pendiente`/`resuelto`/`ignorado`), y cruce por `firma` para
> no re-listar lo ya arreglado en consolidados posteriores.

---

## E. Acceso y ubicación en navegación

- **Acceso:** `admin` y `gerencia`, idéntico al resto de herramientas de
  Diagnóstico/Vigilancia (RLS lo refuerza). El bot no es accesible para otros
  roles.
- **Ubicación:** dentro del módulo **Diagnóstico de la app** (`/diagnostico-app`),
  como **una cuarta pestaña** "Consolidado de fallos" junto a "Incidentes",
  "Accesos IT" y "Vigilancia". Motivos:
  - Evita crear una ruta/sidebar nueva.
  - Reutiliza el guardián que ya existe (`ProtectedRoute` + `check_access` de `getDiagnosticoData`).
  - El gerente ya entra en Diagnóstico cuando quiere "ver fallos"; tener ahí
    la herramienta de "consolidar y tachar" es coherente.
- El flujo de la pestaña:
  1. Botón "Generar consolidado" → abre diálogo reutilizando el patrón
     `VigilanciaInformePeriodoDialog` (Semanal / Mensual / Rango personalizado).
  2. Tras generar, se persiste `ConsolidadoFallos` + items, y se muestra la
     vista previa con un botón de "resuelto/ignorar" por ítem.
  3. Copiar / Descargar `.txt` (mismo patrón que el informe de Vigilancia).
  4. Histórico de consolidados en una lista para reabrirlos.

> **Decisión E:** nueva pestaña dentro de `/diagnostico-app`, no ruta
> independiente. Misma guardia de acceso que el módulo actual.

---

## Diseño del documento de texto final

Reutiliza el estilo de `vigilanciaLog.js` (cabecera con `#`, secciones con
`=`). Formato propuesto:

```
################################################################
CONSOLIDADO DE FALLOS — SMART GESTIÓN (Simantec)
Periodo: Mensual (último mes) (01/08/2026 — 24/08/2026)
Generado por: gerencia@simantec.es
Generado: 24/08/2026 20:23
Fallos únicos: 12     Ocurrencias totales: 87
Resueltos de periodos anteriores (excluidos): 4
Pendientes en este consolidado: 12
################################################################

RESUMEN POR TIPO
----------------
  crash_js         5 fallos únicos, 41 ocurrencias
  timeout_red      3 fallos únicos, 28 ocurrencias
  rechazo_promesa  2 fallos únicos, 12 ocurrencias
  sync_drive       2 fallos únicos,  6 ocurrencias

DETALLE (ordenado por nº de ocurrencias)
========================================

[1] 18 ocurrencias  ·  crash_js  ·  /obras-civiles/:id
    Mensaje:  cannot read properties of null (reading «x»)
    Ejemplo:  Cannot read properties of null (reading 'obra') @ ObraFotosPanel.jsx:54
    Primera: 02/08/2026 11:04    Última: 24/08/2026 18:55
    Usuarios: 3  (tecnico1@, tecnico2@, operario3@)
    Rutas:    /obras-civiles/:id, /obras-civiles
    Fuentes:  DIAGNOSTICO (15), VIGILANCIA (3)

[2] 11 ocurrencias  ·  timeout_red  ·  /materiales-ocr
    ...
----------------------------------------------------------------
(... resto de fallos ...)
################################################################
FIN DEL CONSOLIDADO
################################################################
```

- Copiable al portapapeles (mismo `navigator.clipboard.writeText`) y
  descargable como `.txt` (mismo patrón Blob que el informe de Vigilancia).
- Opcional: subir el `.txt` al CDN (`Core.UploadFile`) y guardar su `file_url`
  en `ConsolidadoFallos.archivo_txt_url` para reabrirlo sin recalcular.

---

## Algoritmo completo (resumen ejecutable)

```
INPUT:  fecha_desde, fecha_hasta, generado_por, periodo_tipo
OUTPUT: ConsolidadoFallos + sus ConsolidadoFalloItem位的, texto final

1. Para cada fuente f en [DiagnosticoSesion, VigilanciaEvento,
   NetworkTelemetry, ArchivoSyncPendiente]:
   - filtrar registros en [fecha_desde, fecha_hasta] que cumplan su
     predicado de "es fallo" (Apartado A),
   - normalizar cada registro a un ITEM {fecha, tipo, componente, mensaje,
     user_email, ruta, fuente}.

2. Aplicar firmaFallo(item) a cada ITEM; agrupar en Map<firma, grupo>
   acumulando ocurrencias/primera/ultima/usuarios/rutas/fuentes.

3. Recuperar conjunto de firmas ya resueltas:
   SELECT firma FROM ConsolidadoFalloItem WHERE estado='resuelto'
   → exclusiones.

4. Para cada grupo: si firma ∈ exclusiones → marcar como
   "previamente_resuelto" (excluir por defecto de la salida, salvo
   override del gerente). Resto → estado='pendiente'.

5. Ordenar grupos: ocurrencias DESC, ultima DESC.

6. Crear ConsolidadoFallos (cabecera con totales).
   BulkCreate ConsolidadoFalloItem (uno por grupo).

7. Generar texto (vigilanciaLog.js extendido). Devolver al cliente.
8. Vista previa permite marcar estado por item → update
   ConsolidadoFalloItem.estado (+resuelto_por, +fecha_resolucion).
```

---

## Riesgos y notas

- **Backend functions en este plan:** la recolección multi-entidad con cruce
  y firma-con-hash conviene hacerla en una **función backend**
  (`consolidadoFallosService`, acción `generar`, análoga a
  `gestionVigilanciaDiagnostico`). Si el plan no incluye backend functions,
  el consolidado degrada a **sólo `DiagnosticoSesion`** (consulta directa del
  cliente) y se aplaza el cruce multi-fuente y el "tachado" hasta reactivar
  el plan. Es lo mismo que ya ocurre con el resto del módulo Diagnóstico.
- **Volumen:** `DiagnosticoSesion` puede crecer grande; conviene paginar
  el `filter` por `created_date` entre las fechas del periodo y un límite
  alto (p. ej. 2000) más loop; o un `list('-created_date', N)` con corte por
  fecha en el cliente.
- **Mensaje canonizado agresivo:** el riesgo es juntar fallos distintos que
  casualmente tienen mismo prefijo. Mitigación: mantener el
  `mensaje_ejemplo` original en el ítem para que el gerente vea de qué fallo
  real se trata, y poder desagregar manualmente si lo necesita.
- **GDPR:** `NetworkTelemetry.user_id` es un hash, no email; mostrarlo como
  "anónimo" en la lista de usuarios afectados. El resto ya es RLS-gerencia-only.

---

## Recomendación final

Aprobar el diseño completo (Apartados A–E):

- **A**: 4 fuentes (`DiagnosticoSesion` + `VigilanciaEvento` +
  `NetworkTelemetry` + `ArchivoSyncPendiente`).
- **B**: firma = SHA1(tipo │ componente-normalizado │ mensaje-canonizado<80c).
- **C+D**: guardado en BD con dos entidades (`ConsolidadoFallos` +
  `ConsolidadoFalloItem`); estado por ítem; cruce por firma para no repetir
  resueltos.
- **E**: pestaña nueva dentro de `/diagnostico-app`, acceso admin+gerencia.
- **Texto**: mismo estilo que `vigilanciaLog.js`, copiable + descargable.

Una vez aprobado, la implementación pasa en dos fases:

1. **Fase 1 (sin backend functions / plan actual):** entidad +
   generación al vuelo **sólo desde `DiagnosticoSesion`** (cliente), vista
   previa + copiar/descargar, sin persistencia ni "tachado".
2. **Fase 2 (con backend functions):** función `consolidadoFallosService`
   con las 4 fuentes, persistencia + estado resuelto, cruce de firmas y
   histórico reabrible.