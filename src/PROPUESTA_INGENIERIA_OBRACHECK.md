# Propuesta técnica — Módulo "Ingeniería" (ObraCheck) integrado en Smart Gestión

**Proyecto:** Smart Gestión (Base44, appId `69de8e23b1cd7ac050397c82`) — SIMANTEC S.L.
**Estado:** Borrador para aprobación de Gerencia / Administración. **No se ha tocado código.**
**Fecha:** 2026-09-22
**Fuente original:** documento `PROMPT_UNIFICADO_OBRA_CHECK_INTEGRADO` (modelo de datos completo, 13 páginas/módulos, 8 reglas de discrepancia).

---

## 0. Resumen ejecutivo

ObraCheck encaja con Smart Gestión reutilizando **4 entidades existentes** (`Obra`/`SolarObra` como Proyecto, `MaterialDocumentoOrigen` como Documento, `MaterialPrecioHistorico` como TarifaReferencia, `Drawing` como PlanoPlanta, `Fabricante`) y creando **9 entidades nuevas** para el núcleo genuinamente ingenieril: `ItemLista`, `PartidaPedido`, `LineaFactura`, `BaseDePrecio`, `UbicacionEquipo`, `TrazadoEstimado`, `MedicionReal`, `AnalisisCoste`, `FichaTecnicaEquipo`, `Certificacion`, `Discrepancia`.

Se da acceso a **dos roles** (`gerencia` + nuevo `ingeniero`), aplicando el checklist de 5 puntos en el mismo commit para no repetir los 13 bugs de `administracion`. La extracción IA reutiliza `aiOrchestrator.ts` (InvokeLLM primario + Claude fallback) con **4 prompts nuevos** por tipo de documento (P&ID, esquema eléctrico, ficha técnica de equipo, listado de puntos/pedido), sin duplicar el orquestador.

**Superficie estimada:** 9 entidades nuevas + 3 extensiones de entidad existente + 4 funciones backend (OCR por tipo + conciliación) + 13 páginas + 1 hub + 1 rol nuevo. Aprox. 4-6 días de implementación tras aprobación.

---

## A. Fusión `Proyecto` (ObraCheck) ↔ `Obra`/`SolarObra`

**Decisión A: FUSIÓN PARCIAL — extender `Obra`, no crear entidad nueva.**

`Obra` ya es la unidad de proyecto de Smart Gestión (Obras Civiles, Solar via `SolarObra`, Partes de obra, Presupuestos, Apuntes horarios, Previsiones). Los proyectos de ingeniería de instalaciones (BMS, refrigeración) son un tipo más de obra, no un concepto distinto. Crear `Proyecto` paralelo duplicaría el enlace cliente↔obra↔parte↔presupuesto que ya funciona.

### A.1 Campos a añadir a `Obra` (todos opcionales, sin romper el uso actual)

| Campo | Tipo | Descripción | Riesgo de regresión |
|---|---|---|---|
| `es_proyecto_ingenieria` | boolean (default false) | Flag que activa el módulo ObraCheck sobre esta obra. Las páginas de Ingeniería filtran por `obras WHERE es_proyecto_ingenieria=true`. | Ninguno — default false, obras existentes invisibles al módulo. |
| `cliente_contratante_id` | string | ID del cliente que **contrata** la instalación (puede diferir del `client_id` = cliente final / propietario de la obra). En los ejemplos de la propuesta, el mismo proveedor factura distinto según quién contrata. | Ninguno — campo nuevo, vacío en obras existentes. |
| `cliente_contratante_name` | string | Denormalizado para listados. | Ninguno. |
| `cliente_final_id` | string | Alias explícito del `client_id` existente cuando hay distinción. Si `cliente_contratante_id` está vacío, el contratante = el cliente existente (retrocompatibilidad). | Ninguno — se rellena solo si el flujo lo requiere. |
| `disciplina_ingenieria` | enum: `bms`, `refrigeracion_industrial`, `climatizacion`, `electricidad`, `otro` | Filtra qué prompts de extracción y qué fichas técnicas aplicar. | Ninguno. |
| `ingeniero_responsable_id` | string | User.id del ingeniero asignado (para RLS por ingeniero y filtros). | Ninguno. |
| `ingeniero_responsable_name` | string | Denormalizado. | Ninguno. |

### A.2 Por qué no rompe el uso actual de `Obra`

- Todos los campos nuevos son **opcionales** y con defaults seguros (`false`/vacío).
- `ObrasCiviles.jsx`, `Solar.jsx`, `ParteDiario.jsx`, `Presupuestos.jsx`, `ApuntesHorario.jsx`, `PrevisionObras.jsx` **no leen** ninguno de los campos nuevos → su render es idéntico.
- `es_proyecto_ingenieria=false` por defecto → el hub Ingeniería (punto G) no pinta obras existentes.
- `SolarObra` se trata igual: si un proyecto solar necesita ObraCheck, se activa el flag sobre el `SolarObra` correspondiente y se reutilizan los mismos campos. La unificación RLS `Obra`↔`SolarObra` ya decidida en el proyecto simplifica el acceso del módulo a ambos tipos.

### A.3 RLS de `Obra` — añadir `ingeniero`

A `Obra.read`/`Obra.update` se añade `ingeniero` para que el ingeniero responsable vea y edite SU proyecto. No se añade a `create`/`delete` (eso queda en gerencia/admin/administracion). Para ingenieros que deban crear proyectos, gerencia lo hace o se amplía puntualmente con `user_condition.role=ingeniero` en `create` — decisión pendiente (§L).

---

## B. `TarifaReferencia` ↔ `MaterialPrecioHistorico`

**Decisión B: FUSIÓN TOTAL — `MaterialPrecioHistorico` ES `TarifaReferencia`.**

`MaterialPrecioHistorico` ya hace exactamente lo que ObraCheck llama "tarifa de referencia entre proyectos": guarda `precio_neto`, `pvp`, `descuento_empresa`, `iva`, `proveedor_nombre`, `proveedor_nif`, `obra_id`, `documento_origen_id`, `fecha_documento`, `variacion_pct`, `origen_cambio`. La lógica de detección de inconsistancia de precio (regla 1 de las 8 del documento original) ya es reutilizable tal cual: comparar el `precio_neto` de una `LineaFactura`/`PartidaPedido` contra el `MaterialPrecioHistorico` más reciente del mismo `material_id` (o mismo `material_referencia`+`fabricante_id`).

### B.1 Campos a añadir a `MaterialPrecioHistorico`

| Campo | Tipo | Descripción |
|---|---|---|
| `cliente_contratante_id` | string | Permite tarifas diferenciadas por contratante (el caso de la propuesta: mismo proveedor, distinto precio según quién contrata). Vacío = tarifa general. |
| `cliente_contratante_name` | string | Denormalizado. |
| `proyecto_ingenieria_id` | string | Alias de `obra_id` cuando el documento pertenece a un proyecto de ingeniería. Se rellena con el mismo `obra_id` (no se duplica). |

No se añade `tipo_tarifa` (base/campo/obra) — ese matiz vive en `BaseDePrecio` (§ nuevo), no en el histórico.

### B.2 Lógica de detección reutilizable

La función backend de conciliación (§ nuevo) compara:
```
LineaFactura.precio_neto  vs  MaterialPrecioHistorico(MAX fecha_documento WHERE material_id=X AND (cliente_contratante_id=Y OR cliente_contratante_id IS NULL))
```
Si `|LineaFactura.precio_neto - tarifa.precio_neto| / tarifa.precio_neto > umbral` (p.ej. 5%) → `Discrepancia` tipo `precio_fuera_tarifa`. Esta lógica es nueva (función de conciliación), pero el **dato** ya vive en `MaterialPrecioHistorico`.

---

## C. `Documento` (ObraCheck) ↔ `MaterialDocumentoOrigen`

**Decisión C: FUSIÓN TOTAL — `MaterialDocumentoOrigen` se generaliza a más tipos de documento.**

`MaterialDocumentoOrigen` ya es "el documento que originó una extracción IA". Hoy su `tipo` enum es `factura|albaran|ticket|proforma`. ObraCheck añade: `pedido`, `presupuesto`, `esquema_conexion`, `pid_proceso`, `plano_planta`, `ficha_tecnica_equipo`, `listado_puntos`. Se amplía el enum, no se crea entidad nueva.

### C.1 Campos a añadir a `MaterialDocumentoOrigen`

| Campo | Tipo | Descripción |
|---|---|---|
| `tipo` (enum ampliado) | añadir: `pedido`, `presupuesto`, `esquema_conexion`, `pid_proceso`, `plano_planta`, `ficha_tecnica_equipo`, `listado_puntos` | El enum pasa de 4 a 11 valores. Retrocompatible: los 4 existentes siguen válidos. |
| `proyecto_ingenieria_id` | string | `obra_id` cuando es proyecto de ingeniería. Se rellena con el mismo `obra_id` (no se duplica). |
| `ingeniero_subido_por` | string | Email del ingeniero que subió el documento (para RLS y filtros). Ya existe `operario_id` pero semánticamente es técnico de campo, no ingeniero. |
| `version_documento` | string | Versión del plano/esquema (P&ID v1, v2...). Vacío en facturas/pedidos. |
| `fecha_revision_documento` | date | Fecha de revisión impresa en planos/esquemas. Vacío en documentos comerciales. |

### C.2 Por qué no entidad nueva

`MaterialDocumentoOrigen` ya tiene: `archivo_url_mejorado` (CDN), `archivo_url_original`, `obra_id`, `proveedor_nombre/nif`, `estado` (`pendiente_revision|procesado|descartado`), `lineas_count`, conciliación contable, descarga en bloque. Toda la infra de subida con fallback (Drive+CDN), sincronización pendiente y trazabilidad semafórica ya funciona sobre esta entidad. Duplicarla para ObraCheck rompería el semáforo unificado de contabilidad.

### C.3 RLS

Tras la Fase 3 (cierre de brecha materiales-ocr), `MaterialDocumentoOrigen.create/update/read` está en `admin+gerencia`. ObraCheck requiere que **`ingeniero`** también pueda crear/leer SUS documentos. Se añade `ingeniero` a `create`/`read`/`update` (no a `delete`). Para evitar que un ingeniero lea documentos de otro proyecto, se añade cláusula `$and` por `obra_id` donde el ingeniero es responsable — o se gestiona por filtro en la UI (ver §RLS ingeniero).

---

## D. `PlanoPlanta`/`UbicacionEquipo`/calibración ↔ `Drawing`

**Decisión D: CAPA NUEVA sobre `Drawing`, no entidad de plano independiente.**

`Drawing` ya es el plano del proyecto (`title`, `reference`, `client_id`, `obra_id`, `category`, `file_url`, `version`, `date`, `notes`). Lo que ObraCheck añade sobre el plano — **calibración (escala px→metro), puntos de referencia, marcado de equipos, trazado estimado** — son capas de datos georreferenciados sobre el mismo archivo, no un documento distinto.

### D.1 Modelo

- `Drawing` se reutiliza tal cual: un `Drawing` con `category='plano_planta'` es el "PlanoPlanta" de ObraCheck. No se añaden campos a `Drawing` (la calibración es un dato de la capa, no del archivo).
- **NUEVA entidad `PlanoCalibracion`** (en lugar de "PlanoPlanta"): vincula 1 `drawing_id` con sus puntos de referencia y escala.
  - `drawing_id` (FK), `obra_id`, `punto_ref_1_px` {x,y}, `punto_ref_1_metros` {x,y}, `punto_ref_2_px` {x,y}, `punto_ref_2_metro` {x,y}, `escala_px_por_metro` (calculada), `fecha_calibracion`, `calibrado_por` (email ingeniero), `confianza_calibracion`.
  - Esto es lo que el documento original llama "PlanoPlanta" — pero al separarlo de `Drawing` permitimos recalibrar sin tocar el archivo.
- **NUEVA entidad `UbicacionEquipo`**: marca un equipo sobre el plano calibrado.
  - `plano_calibracion_id` (FK), `obra_id`, `equipo_referencia` (MaterialCatalog.referencia o texto libre), `x_px`, `y_px`, `x_metros`, `y_metros` (derivados de la calibración), `rotacion_grados`, `etiqueta`, `ficha_tecnica_id` (FK opcional a `FichaTecnicaEquipo`), `marcado_por`, `fecha_marcado`.
- **NUEVA entidad `TrazadoEstimado`**: polilínea sobre el plano (ruta de tubería/cable estimada).
  - `plano_calibracion_id`, `obra_id`, `puntos_px` (array de {x,y}), `puntos_metros` (array derivado), `longitud_metros` (calculada), `tipo_trazado` (canal, tuberia, cable), `material_id` (FK opcional), `estimado_por`, `fecha`.
- **NUEVA entidad `MedicionReal`**: medición real contrastada contra el trazado estimado.
  - `trazado_estimado_id` (FK), `obra_id`, `longitud_real_metros`, `fecha_medicion`, `medido_por`, `metodo` (cinta, laser, plano_asbuilt), `foto_url`, `discrepancia_metros` (calculado), `discrepancia_pct` (calculado).

### D.2 Por qué capa nueva y no entidad independiente

- El archivo del plano ya vive en `Drawing.file_url`; duplicarlo en `PlanoPlanta.file_url` rompería la galería de planos unificada (`Drawings.jsx`) y el cross-link obra↔plano.
- La calibración es un **dato que cambia** (se recalibra), el archivo no. Separarlos sigue el principio de no almacenar estado mutable en el documento.
- `UbicacionEquipo` y `TrazadoEstimado` referencian al plano calibrado, no al `Drawing` crudo, porque necesitan la escala para dar metros.

---

## E. Extracción IA — prompts nuevos reutilizando `aiOrchestrator.ts`

**Decisión E: 4 prompts nuevos, mismo orquestador, sin duplicar `aiOrchestrator.ts`.**

`ocrDocumento(base44, { file_url, file_tipo, prompt, response_json_schema })` ya soporta cualquier prompt. Los 4 prompts existentes (factura, pedido via `procesarOcrNota`, presupuesto via `procesarOcrPresupuesto`, materiales via `procesarFacturaMateriales`) son funciones backend que llaman al orquestador. ObraCheck añade **4 funciones backend nuevas**, una por tipo de documento ingenieril, cada una con su prompt y su `response_json_schema`:

### E.1 `procesarEsquemaConexion` (esquema eléctrico / P&ID simplificado)

**Prompt núcleo:**
```
Eres un sistema OCR especializado en esquemas eléctricos y diagramas de conexión de instalaciones técnicas (BMS, refrigeración, climatización).
Analiza el esquema (probablemente pre-procesado tipo CamScanner).
Extrae TODOS los componentes y sus conexiones.

Devuelve SOLO un JSON:
{
  "tipo_diagrama": "esquema_electrico|pid_proceso|unifilar|otro",
  "componentes": [
    {
      "etiqueta": "texto impreso junto al símbolo (Q1, KM1, F1...)",
      "tipo_componente": "motor|variador|contactor|protector|rele|sensor|valvula|otro",
      "referencia": "referencia comercial si aparece",
      "fabricante": "si aparece",
      "parametros": { "potencia_kw": null|number, "tension_v": null|number, "intensidad_a": null|number },
      "posicion_aprox": { "zona": "texto descriptivo de la zona del esquema" }
    }
  ],
  "conexiones": [
    { "origen": "etiqueta componente", "destino": "etiqueta componente", "tipo_cable": "potencia|control|senal", "seccion_mm2": null|number }
  ],
  "anotaciones_manuscritas": [
    { "texto": "transcripción literal", "color_aprox": "rojo|azul|negro|otro", "zona": "descripción" }
  ],
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible"
}

Instrucciones estrictas:
- Las anotaciones manuscritas en color NO se interpretan como cambios incorporados: se transcriben literalmente en "anotaciones_manuscritas" con su color, sin asumir que modifican el esquema base.
- Si un parámetro no aparece, usa null.
- "posicion_aprox.zona" es descriptivo (esquina superior, centro), NO coordenadas.
```

### E.2 `procesarPidProceso` (P&ID de proceso)

**Prompt núcleo:** variante del anterior orientada a instrumentación (tags ISA: `TT-101`, `FV-202`), con `tipo_componente` ampliado a `transmisor|controlador|actuador|valvula_regulacion|intercambiador` y `bucle_control` (array de `{ tag, instrumentos: [tags] }`). Mismo patrón de anotaciones manuscritas literal.

### E.3 `procesarFichaTecnicaEquipo` (ficha técnica de motor/variador/equipo)

**Prompt núcleo:**
```
Eres un sistema OCR especializado en fichas técnicas de equipos electomecánicos (motores, variadores de frecuencia, bombas, ventiladores).
Extrae TODOS los datos nominales de la placa/características.

Devuelve SOLO un JSON:
{
  "equipo_tipo": "motor|variador|bomba|ventilador|compresor|otro",
  "fabricante": "",
  "modelo": "",
  "referencia": "",
  "potencia_kw": null|number,
  "potencia_cv": null|number,
  "tension_v": null|number|string (ej "400V 3~"),
  "intensidad_nominal_a": null|number,
  "rpm": null|number,
  "factor_potencia": null|number,
  "rendimiento_pct": null|number,
  "ip_proteccion": "IP54|IP55|...",
  "clase_aislamiento": "F|H|...",
  "servicio": "S1|S2|...",
  "masa_kg": null|number,
  "normas": ["array de normas citadas"],
  "numero_serie": "",
  "datos_adicionales": {},
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA"
}

Instrucciones:
- Si un dato no aparece, usa null (numéricos) o "" (textos).
- "tension_v" puede ser string compuesto ("400V 50Hz 3~") si la placa lo muestra así.
- Los datos de la placa son los NOMINALES del fabricante; no interpretar condiciones de instalación.
```

### E.4 `procesarListadoPuntos` (listado de puntos / pedido ingenieril)

**Prompt núcleo:** como `procesarFacturaMateriales` pero con campos `punto_id` (PT-01, PT-02), `descripcion_tecnica`, `ubicacion_zona`, `referencia_equipo`, y sin campos comerciales (pvp/descuento/iva — esos van en la factura, no en el listado de puntos). Estructura: `{ puntos: [{ punto_id, descripcion, referencia, fabricante, ubicacion, cantidad, unidad }] }`.

### E.5 Patrón de las 4 funciones

Cada función backend nueva sigue el patrón exacto de `procesarFacturaMateriales`:
1. `auth.me()` + role-check (`admin|propietario|gerencia|ingeniero` — más abierto que materiales-ocr porque el ingeniero operativo lo necesita).
2. `ocrDocumento(base44, { file_url, file_tipo, prompt, response_json_schema })`.
3. Devolver `{ success, datos, modelo, fallback }`.
4. **No escribe en DB** — la persistencia va en una función `guardar*` separada, tras revisión humana en `PrecisionPanel` (igual que `guardarMaterialesOcr`).

### E.6 Reutilización del orquestador

`aiOrchestrator.ts` no se toca. Las 4 funciones nuevas lo importan igual que las existentes. El fallback Anthropic (Claude Haiku vision) ya maneja PDF e imagen. Si los P&ID son muy densos, se puede pasar `model: 'claude-sonnet-5'` en el `InvokeLLM` primario para esos tipos (más créditos) — decisión de gerencia (§L).

---

## F. Notas de diseño del documento original — salvaguardas

**Decisión F: se mantienen íntegras, son las mismas de Smart Gestión.**

| Salvaguarda del documento original | Cómo se cumple en la implementación |
|---|---|
| **Fuente y confianza de cada cifra** | Toda extracción IA guarda `confianza` (alta/media/baja) y `ocr_raw` en la entidad destino. El `PrecisionPanel` ya muestra confianza baja → marcado `precisa_precision`. |
| **Partida a tanto alzado nunca conciliada solo por tener total** | La regla de conciliación backend (§ nuevo) genera `Discrepancia` tipo `tanto_alzado_sin_desglose` si una `PartidaPedido` tiene `importe_total` pero `lineas=null` o vacío. No se marca "conciliada" por cuadrar el total. |
| **Anotación manuscrita nunca interpretada como cambio incorporado** | Los prompts E.1/E.2 transcriben manuscritas a `anotaciones_manuscritas[]` con `color_aprox` y `zona`, **sin** aplicarlas a `componentes`/`conexiones`. El ingeniero decide en `PrecisionPanel` si promueve una anotación a modificación. |
| **Revisión humana antes de confirmar** | Toda extracción IA nace en estado `pendiente_revision` (en `MaterialDocumentoOrigen` o la entidad destino) y pasa por `PrecisionPanel` antes de consolidar. Igual que el flujo actual de `MaterialesOcr`. |

Estas son las mismas salvaguardas ya aplicadas en `procesarFacturaMateriales`/`guardarMaterialesOcr`/`PrecisionPanel` → no son nuevas, son reutilización.

---

## G. Punto de entrada en navegación — nuevo hub "Ingeniería"

**Decisión G: nuevo hub `ingenieria` en `hubs.js`, visible solo para `gerencia` e `ingeniero`.**

### G.1 Definición del hub (añadir a `HUBS` en `src/lib/hubs.js`)

```js
{
  id: 'ingenieria',
  label: 'Ingeniería',
  icon: Cpu, // o Wrench, CircuitBoard
  color: 'text-teal-600 bg-teal-50',
  order: 6,
  roleRestricted: ['admin', 'propietario', 'gerencia', 'ingeniero'], // hub entero oculto al resto
  items: [
    { label: 'Dashboard Proyecto',  path: '/ingenieria',              icon: LayoutDashboard, module: 'ingenieria' },
    { label: 'Carga Documentos',     path: '/ingenieria/documentos',   icon: Upload,          module: 'ingenieria' },
    { label: 'Listado de Ítems',     path: '/ingenieria/items',        icon: ListChecks,      module: 'ingenieria' },
    { label: 'Conciliación Pd/Pr',   path: '/ingenieria/conciliacion',  icon: GitCompare,      module: 'ingenieria' },
    { label: 'Tarifario Proyectos',  path: '/ingenieria/tarifario',    icon: Tags,            module: 'ingenieria' },
    { label: 'Calibración Planos',   path: '/ingenieria/planos',       icon: Maximize,        module: 'ingenieria' },
    { label: 'Marcado de Equipos',    path: '/ingenieria/equipos',     icon: MapPin,          module: 'ingenieria' },
    { label: 'Trazado Estimado',      path: '/ingenieria/trazado',     icon: Spline,          module: 'ingenieria' },
    { label: 'Conciliación Fac/Pd',  path: '/ingenieria/facturas',     icon: Receipt,         module: 'ingenieria' },
    { label: 'Certificaciones',       path: '/ingenieria/certificacion', icon: BadgeCheck,    module: 'ingenieria' },
    { label: 'Fichas Técnicas',       path: '/ingenieria/fichas',      icon: FileCog,         module: 'ingenieria' },
    { label: 'Coste y Riesgo',        path: '/ingenieria/coste',       icon: TrendingDown,    module: 'ingenieria' },
    { label: 'Discrepancias',         path: '/ingenieria/discrepancias', icon: AlertTriangle, module: 'ingenieria' },
  ],
}
```

### G.2 Módulo nuevo en `permissions.js`

Se añade `'ingenieria'` a `ALL_MODULES` y a las listas de `gerencia` y `ingeniero` (ver §H). No se añade a ningún otro rol.

### G.3 `App.jsx` — 13 rutas nuevas

Bajo `ProtectedRoute module="ingenieria"`, lazy-load de 13 páginas `src/pages/ingenieria/*.jsx`. Siguen el patrón de las rutas existentes (Suspense + PageLoader).

---

## H. Entidades nuevas — modelo de datos completo

### H.1 Resumen de fusiones vs nuevas

| Entidad ObraCheck original | Decisión | Entidad Smart Gestión |
|---|---|---|
| Proyecto | **FUSIONAR** | `Obra` (+ campos A.1) |
| Documento | **FUSIONAR** | `MaterialDocumentoOrigen` (+ enum C.1 + campos C.1) |
| TarifaReferencia | **FUSIONAR** | `MaterialPrecioHistorico` (+ campos B.1) |
| PlanoPlanta | **CAPA SOBRE Drawing** | `Drawing` (reutilizado) + NUEVA `PlanoCalibracion` |
| ItemLista | **NUEVA** | `ItemLista` |
| PartidaPedido | **NUEVA** | `PartidaPedido` |
| LineaFactura | **NUEVA** | `LineaFactura` |
| BaseDePrecio | **NUEVA** | `BaseDePrecio` |
| UbicacionEquipo | **NUEVA** | `UbicacionEquipo` |
| TrazadoEstimado | **NUEVA** | `TrazadoEstimado` |
| MedicionReal | **NUEVA** | `MedicionReal` |
| AnalisisCoste | **NUEVA** | `AnalisisCoste` |
| FichaTecnicaEquipo | **NUEVA** | `FichaTecnicaEquipo` |
| Certificacion | **NUEVA** | `Certificacion` |
| Discrepancia | **NUEVA** | `Discrepancia` |

**Total: 4 fusiones (extensiones) + 1 reutilización (Drawing) + 9 entidades nuevas.**

### H.2 Esquemas de las 9 nuevas (resumen de campos clave)

Cada una incluye los built-in (`id`, `created_date`, `updated_date`, `created_by_id`) y RLS con `admin|propietario|gerencia|ingeniero` (§I).

- **`ItemLista`**: `obra_id`, `punto_id` (PT-01), `descripcion`, `referencia_equipo`, `fabricante_id`, `cantidad`, `unidad`, `ubicacion_zona`, `documento_origen_id`, `confianza`, `precisa_precision`, `estado` (`pendiente_revision|confirmado|descartado`).
- **`PartidaPedido`**: `obra_id`, `documento_origen_id` (pedido), `numero_pedido`, `partida_id` (PD-01), `descripcion`, `referencia`, `fabricante_id`, `cantidad_pedida`, `unidad`, `precio_unitario`, `importe_total`, `lineas` (array de `ItemLista` ids, null si tanto alzado), `estado`.
- **`LineaFactura`**: `obra_id`, `documento_origen_id` (factura), `numero_factura`, `linea_id`, `referencia`, `fabricante_id`, `cantidad_facturada`, `precio_unitario_neto`, `importe_neto`, `partida_pedido_id` (FK conciliación), `estado`.
- **`BaseDePrecio`**: `obra_id`, `material_id` (FK MaterialCatalog), `precio_base_neto`, `fecha_base`, `documento_origen_id`, `tipo_base` (`catalogo|presupuesto|pedido_anterior`), `confianza`.
- **`PlanoCalibracion`**: (ver D.1).
- **`UbicacionEquipo`**: (ver D.1).
- **`TrazadoEstimado`**: (ver D.1).
- **`MedicionReal`**: (ver D.1).
- **`AnalisisCoste`**: `obra_id`, `coste_presupuestado`, `coste_pedido`, `coste_facturado`, `coste_certificado`, `desviacion_pct`, `riesgo_nivel` (`verde|amarillo|rojo`), `fecha_calculo`, `calculado_por` (función backend).
- **`FichaTecnicaEquipo`**: `obra_id`, `equipo_referencia`, `datos_placa` (JSON de E.3), `motor_ficha_id` (auto-comparación), `variador_ficha_id`, `compatibilidad_motor_variador` (`ok|incompatible|revisar` + `motivo`), `documento_origen_id`.
- **`Certificacion`**: `obra_id`, `numero_cert`, `fecha`, `partidas` (array `[{ partida_pedido_id, cantidad_certificada, importe_certificado }]`), `importe_total_cert`, `estado` (`borrador|emitida|abonada`), `firma_cliente_url`.
- **`Discrepancia`**: `obra_id`, `tipo` (8 enum del doc original: `precio_fuera_tarifa`, `cantidad_distinta`, `spec_tecnica_incompatible`, `tanto_alzado_sin_desglose`, `ficha_motor_variador_incompatible`, `trazado_vs_medicion`, `certificacion_excede_pedido`, `documento_sin_origen`), `entidad_origen` (`partida_pedido|linea_factura|item_lista|ficha_tecnica|trazado|certificacion`), `entidad_id`, `severidad` (`alta|media|baja`), `descripcion`, `valor_esperado`, `valor_real`, `estado` (`abierta|en_revision|resuelta|falsa_alarma`), `resuelta_por`, `fecha_resolucion`, `notas_resolucion`.

---

## I. Plan de alta del rol `ingeniero` + ampliación de `gerencia` — checklist de 5 puntos

Aplicar los 5 puntos **en el mismo commit**, no por partes (lección de `administracion`).

### Punto 1 — Mapa de permisos de interfaz (`permissions.js`)

El refactor de unificación **ya está implementado** (Fase 2 del proyecto, commit actual). Se edita `src/lib/permissions.js`:

- Añadir `'ingenieria'` a `ALL_MODULES`.
- Añadir `'ingenieria'` a la lista de `gerencia`.
- Crear entrada `ingeniero`:
  ```js
  ingeniero: [
    'dashboard', 'ingenieria', 'work-orders', 'clients', 'obras', 'obras-civiles',
    'solar', 'materials', 'drawings', 'manuales', 'informe-obras', 'operarios',
    'notas-gastos', 'vehiculos', 'chat', 'flota', 'galeria-fotos', 'apuntes-horario',
    'photos', 'parte-diario',
  ],
  ```
  (Alcance operativo de campo + el módulo Ingeniería completo; sin `users`, `datos-sensibles`, `admin-backup`, `nominas`, `presupuestos`, `economico-dashboard`, `contabilidad` — esos son de dirección/administración.)

### Punto 2 — `User.jsonc` enum + `roleLabels.js`

- Añadir `"ingeniero"` al enum `role` de `User.jsonc` (entre `administracion` y el cierre).
- Añadir a `roleLabels.js`:
  ```js
  ingeniero: { label: 'Ingeniero', className: 'bg-teal-100 text-teal-700 border-teal-200' },
  ```

### Punto 3 — RLS de las 9 entidades nuevas + 3 extensiones

Cada entidad nueva lleva RLS explícita con `admin|propietario|gerencia|ingeniero` en `create|read|update` y `admin|propietario` en `delete`. Para `read`/`update` se añade cláusula opcional `$and` por `obra_id` donde el ingeniero es `ingeniero_responsable_id` si se quiere aislar por proyecto (decisión §L). Las 3 extensiones (`Obra`, `MaterialDocumentoOrigen`, `MaterialPrecioHistorico`) añaden `ingeniero` a `read`/`update` (y `create` en `MaterialDocumentoOrigen`).

### Punto 4 — Sin comprobaciones hardcodeadas en componentes nuevos

Los 13 componentes de Ingeniería NO deben usar `isAdmin || isGerencia` para habilitar acciones. Usan `canAccess('ingenieria')` (ya cubre ambos roles vía `permissions.js`) y, si necesitan distinguir capacidad de dirección vs operativa, consultan `role === 'gerencia' || isAdmin` solo para acciones de aprobación (no para ver/editar lo operativo). Documentar en cada componente: "este botón usa `canAccess`, no `isAdmin`".

### Punto 5 — Verificación de Reglas de Oro (`verificarReglasDeOro`)

Si `verificarSincronizacionRoles`/`verificarReglasDeOro` existe a la fecha de implementación, ejecutar sobre las 9 entidades nuevas antes de cerrar el módulo. Confirma que la RLS declarada no deja lockout (ingeniero sin acceso a su propia entidad) ni fuga (ingeniero viendo entidades de otros proyectos si se añade la cláusula `obra_id`).

---

## J. Funciones backend nuevas

| Función | Propósito | Role-check |
|---|---|---|
| `procesarEsquemaConexion` | OCR esquema/P&ID (E.1) | `admin|propietario|gerencia|ingeniero` |
| `procesarPidProceso` | OCR P&ID proceso (E.2) | idem |
| `procesarFichaTecnicaEquipo` | OCR ficha técnica (E.3) | idem |
| `procesarListadoPuntos` | OCR listado/pedido ingenieril (E.4) | idem |
| `guardarExtraccionIngenieria` | Persiste tras revisión (como `guardarMaterialesOcr`) | idem |
| `conciliarProyectoIngenieria` | Ejecuta las 8 reglas de discrepancia sobre un `obra_id` | `admin|propietario|gerencia|ingeniero` |
| `calcularAnalisisCosteProyecto` | Recalcula `AnalisisCoste` de un proyecto | `admin|propietario|gerencia|ingeniero` |

Las 4 de OCR reutilizan `aiOrchestrator.ts`. `conciliarProyectoIngenieria` es la lógica nueva (8 reglas) — lee `PartidaPedido`, `LineaFactura`, `ItemLista`, `MaterialPrecioHistorico`, `FichaTecnicaEquipo`, `TrazadoEstimado`, `MedicionReal`, `Certificacion` y produce `Discrepancia` registros. `calcularAnalisisCosteProyecto` agrega costes y calcula `desviacion_pct`/`riesgo_nivel`.

---

## K. Posibles regresiones detectadas

1. **`Obra.read` ya es muy abierta** (todos los roles leen). Añadir `ingeniero` a `read` no rompe nada. Añadir `ingeniero` a `update` sí le da capacidad de editar la obra — confirmar que el ingeniero solo debe editar campos de ingeniería (no `budget`, no `client_id`). Mitigación: la UI de Ingeniería solo edita los campos A.1; el resto del formulario de obra sigue en `ObrasCiviles.jsx` que el ingeniero puede leer pero no editar (su `permissions` no incluye edición de campos fuera de ingeniería — se controla en el componente, no en RLS, porque RLS es por entidad no por campo).
2. **`MaterialDocumentoOrigen` enum ampliado** — los filtros existentes (`/materiales-ocr`, contabilidad) usan `tipo` en `['factura','albaran','ticket','proforma']`. Al añadir 7 valores, esos filtros siguen funcionando (no incluyen los nuevos) pero hay que revisar que ningún `filter({ tipo: 'factura' })` se rompa — no se rompe, los nuevos valores son distintos. Las páginas de contabilidad no verán los documentos ingenieriles a menos que se les dé acceso RLS (se les puede negar añadiendo `$and tipo nin [esquema_conexion,...]` o simplemente no dando `read` a `contabilidad` sobre los documentos de proyectos de ingeniería — decisión §L).
3. **`MaterialPrecioHistorico.cliente_contratante_id`** — la función `guardarMaterialesOcr` existente no rellena este campo (vacío = tarifa general). No rompe el flujo actual.
4. **`Drawing` reutilizado** — `Drawings.jsx` ya filtra por `obra_id`. Los planos de Ingeniería aparecen en la galería general. Si gerencia quiere aislarlos, filtrar `category='plano_planta'` con `es_proyecto_ingenieria=true` — decisión §L.
5. **Simulador de roles** — al simular `ingeniero`, un admin reproduce el rol con fidelidad (ve el hub Ingeniería, no ve users/datos-sensibles). OK.

---

## L. Decisiones pendientes de Gerencia / Administración

- [ ] Aprobar la **fusión Proyecto↔Obra** (campos A.1) y confirmar que el ingeniero puede editar campos de ingeniería de la obra sin editar `budget`/`client_id`.
- [ ] Aprobar la **fusión TarifaReferencia↔MaterialPrecioHistorico** (campo `cliente_contratante_id` B.1).
- [ ] Aprobar la **fusión Documento↔MaterialDocumentoOrigen** (enum + campos C.1) y decidir si contabilidad ve o no los documentos ingenieriles.
- [ ] Aprobar la **capa PlanoCalibracion sobre Drawing** (D) vs entidad de plano independiente.
- [ ] Aprobar los **4 prompts de extracción IA** (E) y decidir si P&ID densos usan `claude-sonnet-5` (más créditos) o `gemini_3_flash` (web search, no aplica a P&ID) o queda en modelo por defecto.
- [ ] Aprobar el **hub Ingeniería** con sus 13 rutas (G) y el módulo `'ingenieria'` en `permissions.js`.
- [ ] Aprobar el **alcance del rol `ingeniero`** (lista H.1 punto 1) — confirmar que no necesita `presupuestos` ni `economico-dashboard`.
- [ ] Aprobar la **RLS por `obra_id`** para que un ingeniero solo vea SUS proyectos (cláusula `$and data.ingeniero_responsable_id == {{user.vinculo_id}}` o similar) o si todo ingeniero ve todos los proyectos de ingeniería.
- [ ] Aprobar el **rol-check de las 4 funciones OCR nuevas** (`admin|propietario|gerencia|ingeniero`, más abierto que `procesarFacturaMateriales` que es solo admin+gerencia).
- [ ] Confirmar si `ingeniero` puede **crear** `Obra` (proyecto de ingeniería) o si gerencia lo crea y se lo asigna.
- [ ] Aislar planos de Ingeniería en la galería general (`Drawings.jsx`) o mostrarlos mezclados.

---

## M. Plan de implementación, tras aprobación

1. **Fase 1 — Permisos + rol** · 0.5 día
   - `permissions.js`: añadir `ingenieria` + entrada `ingeniero`.
   - `User.jsonc`: añadir `ingeniero` al enum.
   - `roleLabels.js`: añadir etiqueta.
   - `hubs.js`: añadir hub `ingenieria`.
   - `App.jsx`: 13 rutas lazy-load (páginas vacías inicialmente).
   - Smoke test: login como gerencia ve hub, login como ingeniero (crear usuario demo) ve hub, técnico no lo ve.

2. **Fase 2 — Entidades + extensiones** · 1 día
   - Escribir 9 `base44/entities/*.jsonc` nuevos con RLS completa (punto 3 checklist).
   - Extender `Obra`, `MaterialDocumentoOrigen`, `MaterialPrecioHistorico` (campos A.1/C.1/B.1).
   - Ejecutar `verificarReglasDeOro` (punto 5) sobre las 9 nuevas.

3. **Fase 3 — Funciones backend OCR** · 1.5 días
   - 4 funciones `procesar*` (E.1-E.4) reutilizando `aiOrchestrator.ts`.
   - `guardarExtraccionIngenieria` (persistencia tras revisión).
   - Test cada función con documento real de ejemplo.

4. **Fase 4 — Conciliación + análisis** · 1 día
   - `conciliarProyectoIngenieria` (8 reglas).
   - `calcularAnalisisCosteProyecto`.
   - Test con proyecto de ejemplo completo.

5. **Fase 5 — 13 páginas** · 2 días
   - `src/pages/ingenieria/*.jsx` (13 archivos, uno por módulo).
   - Reutilizar `PrecisionPanel`, `DocumentScanner`, `ObraSelector`, patrones de `MaterialesOcr` y `Contabilidad`.
   - Sin checks hardcodeados `isAdmin` (punto 4).

6. **Fase 6 — Calibración de planos + trazado** · 1 día
   - Componente de canvas para calibrar (`PlanoCalibracion`) y marcar equipos (`UbicacionEquipo`).
   - Polilínea para `TrazadoEstimado`.
   - Reutilizar `react-leaflet` si se quiere mapa, o canvas puro sobre la imagen del plano.

**Total estimado: ~7 días.** Reducible si se reutilizan masivamente componentes de `MaterialesOcr`/`Contabilidad` para las páginas de carga y conciliación.