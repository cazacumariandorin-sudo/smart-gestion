# Propuesta técnica — Soporte multi-página y multi-factura en "Alta Materiales (OCR+IA)"

**Módulo:** `/materiales-ocr` · `MaterialesOcrDialog` · `DocumentScanner` · `procesarFacturaMateriales` · `guardarMaterialesOcr`
**Proyecto:** Smart Gestión (Base44, appId `69de8e23b1cd7ac050397c82`) — SIMANTEC S.L.
**Estado:** Borrador para aprobación de Gerencia / Administración. **No se ha tocado código.**
**Fecha:** 2026-08-22

---

## 0. Resumen ejecutivo

Hoy el flujo **asume 1 documento = 1 foto/archivo = 1 factura**. Esta propuesta añade tres capacidades sin romper el caso simple (1 foto → 1 factura, que debe seguir siendo igual de rápido):

1. **Capturar/adjuntar N páginas** en una sola carga (cámara CamScanner con botón "Añadir página" + subida de PDF multi-página + subida de varias fotos sueltas).
2. **IA que agrupa páginas en facturas** (Base44 InvokeLLM primero, Claude de respaldo, vía `aiOrchestrator.ts` ya existente). Decide si el lote es una sola factura de varias hojas o varias facturas distintas.
3. **Revisión manual obligatoria de la agrupación** antes de guardar; si la IA la da con confianza baja, el "Guardar todo" se bloquea hasta que el usuario la revise.

Cada factura resultante genera su propio `MaterialDocumentoOrigen` y su propio histórico de precios — **sin mezclar precios ni fabricantes entre facturas distintas del mismo lote**.

**Cambio de paradigma clave:** la unidad de trabajo deja de ser "el archivo subido" y pasa a ser **"el lote de páginas"**, que la IA descompone en **N documentos** que se procesan y guardan de forma independiente.

---

## A. Análisis de `DocumentScanner.jsx` + `MaterialesOcrDialog.jsx` — cambio mínimo para N páginas

### A.1 Estado actual (lo que hay)

`DocumentScanner.jsx` (289 líneas) gestiona **una sola imagen**:
- `estado`: `idle → ready → processing` (una sola imagen en flight).
- `img` (un solo `HTMLImageElement`), `srcCanvasRef` (un solo canvas fuente), `cornersDisplay` (4 esquinas de UNA imagen).
- El output es **un único objeto** `{ archivo, file, preview, ocr_ok }` devuelto por `onDone`. El padre (`MaterialesOcrDialog`) lo recibe y lo trata como un documento único: `setScanResult({ file, preview })`, sube **un** archivo, llama a `procesarFacturaMateriales` con **un** `file_url`.

`MaterialesOcrDialog.jsx` (257 líneas) tiene el flujo `captura → ocr → revision → guardando` y **asume un solo `scanResult`** en todo su estado (`scanResult`, `ocrData`, `metaDoc`, `lineas` son escalares). El `guardar` envía un único `documento` + un único array `lineas` a `guardarMaterialesOcr`.

### A.2 Cambio mínimo propuesto — refactor de UNIDAD

No hace falta reescribir `DocumentScanner` desde cero. Hay que **separar dos responsabilidades** que hoy están fusionadas en `DocumentScanner`:

1. **Captura de UNA página** (lo que ya hace bien: recorte, enderezado, contraste, output `File`). Esto se queda como está.
2. **Acumulación de N páginas** (nueva responsabilidad que sube al padre `MaterialesOcrDialog`).

#### A.2.1 `DocumentScanner` (cambio mínimo)

`DocumentScanner` hoy termina con un botón **"Procesar y extraer"** que llama a `procesarYEnviar()` → `onDone({...})` y termina. Cambio mínimo:

- Renombrar la callback `onDone` a **`onPageReady`** (semántica: "ya tienes UNA página lista, ¿qué hago?").
- Añadir dos botones en el estado `ready`:
  - **"Añadir otra página"** → tras procesar esa página (mismo `warpToCanvas` + `canvasToFile`), llama a `onPageReady(page)` y **vuelve a `estado=idle`** para capturar la siguiente (no termina el flujo).
  - **"Finalizar páginas"** (antes "Procesar y extraer") → procesa la última página, la manda con `onPageReady(page, { ultima: true })`, y el padre sabe que el lote de captura está cerrado.

Es decir, `DocumentScanner` pasa de "procesa y cierra" a "procesa y pregunta si hay más". Su superficie interna cambia en ~10 líneas (un segundo botón y un flag `ultima`).

#### A.2.2 `MaterialesOcrDialog` (cambio mayor, pero contenida)

Aquí sí hay cambio estructural, porque el estado del diálogo pasa de **escalar** a **array de lotes**. Propuesta:

```
Estado actual (escalar):
  scanResult, ocrData, metaDoc, lineas

Estado propuesto (array de lotes, 1 lote = 1 carga del usuario):
  paginas: Page[]              // tras captura, antes de agrupar
  agrupacion: GrupoIA | null   // resultado del paso de IA de agrupación
  documentos: DocumentoReview[] // tras agrupar, antes de guardar (1..N)
```

Tipos:

```ts
type Page = { id: string; file: File; preview: string; file_url: string; orden: number; origen: 'camara'|'upload-pdf'|'upload-img' };
type DocumentoReview = {
  id: string;                       // id temporal del cliente (uuid)
  paginas_ids: string[];            // qué páginas del lote belongecen a este documento
  meta: { tipo, numero, fecha, proveedor_nombre, proveedor_nif, obra_id, obra_name, obra_tipo };
  lineas: Linea[];
  ocr_ok: boolean;
  confianza_ia: 'alta'|'media'|'baja';
  revisado_por_usuario: boolean;    // false mientras el usuario no haya tocado la agrupación
};
type AgrupacionIA = {
  grupos: { paginas_ids: string[]; confianza: 'alta'|'media'|'baja' }[];
  confianza_global: 'alta'|'media'|'baja';
  motivo: string;                   // explicación de la IA (para el panel de revisión)
};
```

El flujo del diálogo pasa de 4 pasos a **5**:

```
captura (N páginas, con botón "Añadir página")
  → pre_ocr (subir todas las páginas al CDN → pasar a IA de agrupación)
  → agrupacion (mostrar propuesta de IA, revisar/unir/dividir grupos)
  → revision (por cada grupo: extracción de líneas OCR+IA + editor de líneas — como hoy)
  → guardando
```

**Caso de atajo (1 sola página):** si el usuario carga 1 sola página, el paso `pre_ocr` aún sube y agrupa, pero la IA devolverá "1 grupo, confianza alta" y el diálogo puede saltar `agrupacion` automáticamente y mostrar directamente `revision` (mismo UX que hoy). Este atajo es lo que preserva la simplicidad del caso más común.

### A.3 Soporte de PDF multi-página

Hoy `DocumentScanner.handleFile` acepta PDF en el `input` HTML (`accept="image/*,.pdf"`) pero `loadImgFromFile` usa `new Image()` que **NO puede leer PDF** — hoy el PDF solo llega al flujo por `handleSkipScanner`, que sube el PDF entero a `procesarFacturaMateriales`, y ahí el `aiOrchestrator` lo manda como PDF (no como imágenes).

Para **N páginas de un PDF** hay dos opciones, y recomiendo la **B**:

- **Opción A — Extraer páginas del PDF en el cliente**: requires `pdf.js` (Mozilla) que **NO está en el listado de paquetes instalados**. Añadirlo sería una dependencia pesada (~1 MB) solo para este flujo. **Descartada** salvo que se pida explícitamente.
- **Opción B (recomendada) — Extraer páginas del PDF en el backend**: `procesarFacturaMateriales` (o un nuevo helper `extraerPaginasPdf`) recibe el `file_url` del PDF, lo descarga, y usa **`base44.integrations.Core.ExtractDataFromUploadedFile`** con un schema que devuelve la lista de páginas como imágenes, **O** (más simple) usa la misma IA de agrupación con el PDF completo, ya que Claude e InvokeLLM soportan PDFs nativamente (`aiOrchestrator` ya lo hace con `document` source). Es decir: **el PDF se manda entero a la IA de agrupación, y es la IA quien dice "este PDF son 3 facturas de 1-2 páginas cada una"** sin necesidad de rasterizar en cliente.

**Implicación del esquema B:** el paso de IA de agrupación debe ser capaz de aceptar como entrada **una mezcla de imágenes sueltas + PDFs enteros**, y devolver referencias a "página X del PDF Y" o "imagen Z suelta". La propuesta concreta de identificación está en el §B.

### A.4 Reordenar/eliminar páginas antes de procesar

Tras `captura`, el diálogo muestra una tira horizontal de miniaturas (`preview` ya está disponible como `dataURL` para los escaneados; para los PDFs subidos se puede usar un placeholder con icono PDF + número de páginas). Cada miniatura tiene:
- Botón **⟰** reordenar (drag-and-drop con `@hello-pangea/dnd`, que **sí** está instalado).
- Botón **🗑** eliminar.
- Etiqueta de origen (`📷` / `📄 PDF` / `🖼`).

Solo cuando el usuario pulsa **"Analizar agrupación"** se suben todas las páginas al CDN (en paralelo con `Promise.all` de `UploadFile`) y se llama a la IA de agrupación. Antes de eso, todo es local en el cliente (sin coste de subida si el usuario se arrepiente).

---

## B. Diseño del paso de IA de "agrupación de páginas en facturas"

### B.1 Qué se le manda a la IA

Una **única llamada de IA** que recibe **todas las páginas del lote de una tacada, en orden**. La IA tiene que verlas todas a la vez para detectar continuidad/ruptura entre páginas.

Estructura de la llamada (envuelta en `aiOrchestrator.ocrDocumento` reutilizado, o en una nueva función `agruparPaginasDocumento` del mismo orquestador — ver §E):

```json
{
  "paginas": [
    { "indice": 1, "tipo": "image", "url": "https://cdn.../scan_1.jpg" },
    { "indice": 2, "tipo": "image", "url": "https://cdn.../scan_2.jpg" },
    { "indice": 3, "tipo": "pdf",  "url": "https://cdn.../lote_b.pdf" },
    { "indice": 4, "tipo": "image", "url": "https://cdn.../scan_4.jpg" }
  ]
}
```

Para InvokeLLM (primary): `file_urls = [todas las urls]` + `prompt` que enumera el orden. InvokeLLM soporta múltiples `file_urls`, así que esta parte ya está lista.

Para Claude (fallback): el content block del mensaje lleva **varios bloques `image` o `document` en orden**, uno por cada página.

### B.2 Qué debe devolver

```json
{
  "grupos": [
    {
      "paginas_indices": [1, 2],
      "tipo_documento_inferido": "factura",
      "numero_documento": "FAC-2026-117839",
      "proveedor": "SALTOKI S.L.",
      "nif_proveedor": "B12345678",
      "fecha_documento": "2026-08-15",
      "es_continuacion": false,
      "confianza": "alta",
      "razon": "Páginas 1-2 comparten número de factura FAC-2026-117839, proveedor SALTOKI y mismo CIF; la página 2 empieza con 'Página 2 de 2' y no repite cabecera de proveedor."
    },
    {
      "paginas_indices": [3],
      "tipo_documento_inferido": "ticket",
      "numero_documento": "",
      "proveedor": "LERoy MERLIN",
      "nif_proveedor": "",
      "fecha_documento": "2026-08-16",
      "es_continuacion": false,
      "confianza": "alta",
      "razon": "El PDF es un ticket de una sola página con cabecera LEROY MERLIN distinta del documento anterior."
    },
    {
      "paginas_indices": [4],
      "tipo_documento_inferido": "albaran",
      "numero_documento": "ALB-9981",
      "proveedor": "SALTOKI S.L.",
      "nif_proveedor": "B12345678",
      "confianza": "media",
      "razon": "No aparece número de factura visible, pero la cabecera de proveedor coincide con el grupo 1. Se marca 'media' porque el número es inferido."
    }
  ],
  "confianza_global": "alta",
  "advertencias": []
}
```

`confianza_global` = la mínima confianza de los grupos. Si algún grupo está en `baja`, `confianza_global = baja` y el diálogo **bloquea el "Guardar todo"** y obliga a revisar ese grupo antes.

### B.3 Reglas que la prompt debe codificar (señales de ruptura/continuación)

La prompt se le da a la IA con estas reglas explícitas (seudo-código, el texto final va en §B.5):

- **Mismo número de factura** entre páginas consecutivas → continuar el grupo.
- **Cabecera de proveedor repetida** entre páginas consecutivas (mismo NIF) → indicios de continuación del documento, **salvo** que aparezca un nuevo número de factura distinto o un "Total" cerrado en la página anterior (en cuyo caso → factura nueva).
- **"Total"/"Base imponible"/"Importe total"** que cierra en una página → esa página cierra un documento; la siguiente, si tiene cabecera nueva → factura nueva.
- **Falta de líneas de producto en una página** (solo cabecera/totales o solo continuación de líneas) → paging continúa pero NO abre factura nueva.
- **Página marcada como "Página 2 de N" / "Continúa en página..."** → seguir el grupo sin crear factura nueva.
- **Cambio de proveedor entre páginas consecutivas** → factura nueva (rotura segura).
- **Cambio de tipo de documento** entre páginas sucesivas (factura → ticket) → factura nueva (rotura segura).
- **Duplicar números de factura en dos grupos distintos** → marcar `advertencias` con "posible duplicado entre grupos" para que el usuario lo revise.

### B.4 Respuesta de "no estoy seguro"

La IA **NUNCA debe dividir silenciosamente** si confía poco. Reglas:

- Si tras analizar no tiene indicios sólidos (no número de factura, no NIF, no cabecera visible) → debe devolver **1 grupo con todas las páginas y `confianza_global = baja`** + `razón: "No se pudo determinar si las páginas pertenecen a facturas distintas o a una sola factura multi-página"`.
- El diálogo, al recibir `confianza_global == 'baja'`, **pone todos los grupos en `revisado_por_usuario = false` y bloquea el guardado** hasta que el usuario marque cada grupo como revisado (checkbox "He revisado este grupo") o reagrupe a mano.
- No hay "decidir en silencio": la opción por defecto cuando hay dudas es **no separar** (1 grupo) y forzar revisión — así nunca se mezclan dos facturas por error de la IA, que es el peor caso operativo.

### B.5 Prompt propuesto (texto final para el orquestador)

```
Eres un sistema experto en clasificar páginas de documentos de proveedor en España
(facturas, albaranes, proformas, tickets).

Recibirás un conjunto ORDENADO de páginas (imágenes o PDFs) que el usuario
ha cargado en un único lote. Tu único objetivo es decidir si pertenecen a
UNA sola factura/albarán/ticket (multi-página) o si contienen VARIAS
facturas distintas (cada una de 1 o más páginas).

NO extraigas líneas de producto (eso lo hace otro paso). Solo agrupas.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "grupos": [
    {
      "paginas_indices": [índices enteros, 1-based, en el orden en que se enviaron],
      "tipo_documento_inferido": "factura|albaran|ticket|proforma",
      "numero_documento": "nº impreso o '' si no aparece",
      "proveedor": "nombre del emisor o '' si no aparece",
      "nif_proveedor": "CIF/NIF del emisor o ''",
      "fecha_documento": "YYYY-MM-DD o '' si no aparece",
      "es_continuacion": true|false,
      "confianza": "alta|media|baja",
      "razon": "explicación breve (máx 200 chars) de por qué agrupaste estas páginas"
    }
  ],
  "confianza_global": "alta|media|baja",
  "advertencias": ["posibles problemas (duplicados, ambigüedad, etc.)"]
}

Reglas estrictas:
1. Las páginas de un grupo DEBEN ser consecutivas en el orden enviado.
   Los índices de cada grupo + los de todos los grupos deben cubrir EXACTAMENTE
   todas las páginas recibidas, sin solapamientos ni saltos.
2. Misma factura (mismo nº y proveedor) en varias páginas → 1 grupo, es_continuacion=true
   para las páginas que no tienen cabecera.
3. "Total" / "Importe total" en una página → esa página cierra el documento.
   La siguiente con cabecera distinta abre factura nueva.
4. Cambio de proveedor (NIF distinto) o de tipo de documento entre páginas
   consecutivas → factura nueva (rotura segura).
5. Si NO puedes determinar con seguridad si las páginas son de la misma factura
   o de varias, devuelve 1 único grupo con TODAS las páginas y
   confianza_global = "baja". NUNCA dividas silenciosamente con poca confianza.
6. confianza por grupo: "alta" si hay nº de factura + NIF + fecha legibles;
   "media" si falta alguno (p.ej. solo proveedor); "baja" si solo hay líneas
   de producto sin cabecera.
7. advertencias: incluye "posible duplicado" si dos grupos comparten el mismo
   numero_documento, y "página sin cabecera ni continuación clara" si una
   página queda en un grupo por defecto sin evidencia sólida.

No incluyas texto fuera del JSON.
```

`response_json_schema` equivalente se adjunta a la llamada (igual que ya hace `procesarFacturaMateriales` con su schema).

### B.6 Reutilización del orquestador `aiOrchestrator.ts`

El orquestador ya existe y hace exactamente lo que necesitamos: primary InvokeLLM → fallback Anthropic. **No se duplica**. Solo hay que añadir (§E) una nueva función `agruparPaginas(base44, { paginas })` dentro del propio `aiOrchestrator.ts` que llame a `ocrDocumento` con un `prompt` distinto y `file_urls = [todas las urls]`.

Nota técnica: `primaryInvokeLLM` ya acepta `file_urls` como array, así que **la llamada multi-imagen ya funciona sin tocar el orquestador**. Solo hay que pasar el array de URLs; lo único a confirmar es que `InvokeLLM` pasa todas las imágenes al modelo y no solo la última. En caso de duda, la prompt enumera "Página 1: <url1>, Página 2: <url2>…" para forzar el contexto.

---

## C. Revisión manual de la agrupación (UI)

### C.1 Pantalla de revisión de agrupación (nuevo paso `agrupacion`)

Se renderiza tras la IA de agrupación, antes de la extracción de líneas. Contiene:

1. **Cabecera de estado global**: badge con `confianza_global` (verde=alta, ámbar=media, rojo=baja) + texto `motivo` de la IA.
2. **Lista de grupos propuestos**, cada uno como una tarjeta:
   - Título: `Documento 1 · Factura · SALTOKI S.L. · FAC-2026-117839 · 2026-08-15 · páginas 1-2`
   - Miniaturas de las páginas asignadas (mismas que en A.4).
   - `confianza` del grupo (badge).
   - `razón` de la IA (texto gris, 1 línea expandible).
   - Checkbox **"He revisado este grupo"** — obligatorio si `confianza == 'baja'`.
   - Acciones: **Mover página → otro grupo** (drag-and-drop entre tarjetas), **Dividir grupo** (saca la última página a un grupo nuevo), **Unir con el siguiente** (merge de dos grupos consecutivos).
3. **Botón "Guardar todo (N documentos)"** — solo se habilita cuando todos los grupos están `revisado_por_usuario = true`. Para `confianza_global = alta`, se auto-saltan los checkboxes (pero las acciones de reorganizar siguen disponibles).

### C.2 Acciones manuales sin IA

- **Mover página**: arrastra una miniatura de una tarjeta a otra; al soltar, se reasigna `paginas_ids` y el grupo destino se marca `revisado_por_usuario = true` automáticamente (ya lo ha tocado el humano).
- **Dividir**: el usuario parte un grupo por una página → se crean dos grupos. El que recibe la página escindida se marca `revisado_por_usuario = true`.
- **Unir**: el usuario mezcla dos grupos → el resultante hereda `meta` del primero y `lineas` vacías (se re-extraen al pasar a `revision`).
- **Re-etiquetar**: el usuario puede cambiar `tipo`/`numero`/`fecha`/`proveedor`/`nif` directamente en la tarjeta (igual que en `revision` hoy). Útil cuando la IA los dejó en blanco (`confianza=media`).

### C.3 Comportamiento ante confianza baja

```
Si confianza_global == 'baja':
  - Banner rojo arriba: "La IA no ha podido agrupar las páginas con seguridad. Revisa cada grupo antes de continuar."
  - Botón "Guardar todo" deshabilitado (gris, no clicable).
  - Cada tarjeta de grupo muestra el checkbox "He revisar este grupo" SIN marcar.
  - El usuario debe mover páginas entre grupos (o confirmar la agrupación propuesta)
    y marcar TODOS los grupos. Solo entonces se habilita "Guardar todo".
```

Esto es **exactamente** lo que pide el requisito C: "marcar claramente para revisión manual obligatoria antes de continuar, nunca decidir en silencio".

### C.4 Transición a `revision` (extracción de líneas)

Cuando el usuario confirma la agrupación (botón "Guardar todo" habilitado y pulsado), el diálogo por cada grupo:
1. Manda las páginas de ese grupo a `procesarFacturaMateriales` (ver §E para la adaptación del backend a N páginas por documento).
2. Rellena `meta` del grupo con la cabecera extraída y `lineas` con las líneas OCR.
3. Mantiene el grupo como una tarjeta editable con `LineasMaterialesEditor` (el mismo componente de hoy).

El paso `revision` pasa de "1 tarjeta de líneas" a "**N tarjetas, una por grupo/documento**, cada una con su `LineasMaterialesEditor` y su `meta`".

---

## D. Límite de páginas por carga

### D.1 Análisis de rendimiento

- **Subida de imágenes**: cada página escaneada tipo CamScanner sale a ~80-150 KB JPEG (ya recortado a 1400 px). Subir N páginas en paralelo con `Promise.all(UploadFile)` tarda ~1s por página en 4G. Hasta 10 páginas es razonable.
- **IA de agrupación**: ver N páginas a la vez. Claude `claude-haiku-4-5` soporta múltiples imágenes pero:
  - Tiempo de inferencia crece linealmente con el nº de páginas.
  - Hasta ~**15 imágenes** o ~**30 páginas de PDF totales** por llamada es viable con `haiku-4-5` (modelo de respaldo actual del orquestador).
  - Más de eso → latencia > 30s y riesgo de timeout del backend (Deno.serve suele tener ~30-60s).
- **IA de extracción por grupo**: cada grupo se procesa por separado; el cuello es el grupo más grande. Un grupo de 5-6 páginas es el límite cómodo.

### D.2 Límite recomendado

- **Límite blando: 10 páginas por carga** (imágenes + páginas de PDF). Explicar al usuario: "Para cargas más grandes, repártelas en varios procesos".
- **Límite duro: 15 páginas**. Si el usuario supera el blando, banner avisando; si supera el duro, **no dejar añadir más** (botón "Añadir página" se deshabilita). Los PDFs que excedan 15 páginas: el backend los rechaza con `{ error: 'PDF demasiado grande (X páginas). Máximo 15 por carga.' }` antes de consumir IA.

Estos números se dejan como constantes en `MaterialesOcrDialog` y en el backend; se ajustan una vez veamos la latencia real.

### D.3 Manejo de exceso de páginas

Si el usuario intenta exceder:
- En el cliente: el botón "Añadir página" muestra un tooltip "Máx. 15 páginas por carga". Llegado a 15, el botón se oculta/deshabilita.
- En el backend (`agruparPaginas` y `procesarFacturaMateriales`): si `paginas.length > 15` (o el PDF tiene >15 páginas detectadas por la IA), respuesta `{ success: false, error: '...demasiado grande...' }` sin llamar a la IA, para no consumir créditos en una llamada vetada a timeout.

---

## E. Impacto en `procesarFacturaMateriales` y `guardarMaterialesOcr`

### E.1 `procesarFacturaMateriales` (hoy: 1 archivo = 1 factura)

**Cambio: aceptar `paginas` (array de URLs, una por página) en vez de un único `file_url`.** Mantener `file_url` como back-compat para el caso simple (1 página).

Firma actual:
```ts
{ file_url: string, file_tipo: string }
```

Firma propuesta (back-compat):
```ts
// Caso simple (1 página) — sin cambios
{ file_url: string, file_tipo: string }

// Caso multi-página (1 factura con N páginas)
{ paginas: [{ url: string, tipo: string }], file_url?: string, file_tipo?: string }
```

Internamente:
- Si llega `paginas`, el prompt lista las páginas en orden ("Página 1: <img1>, Página 2: <img2>…") y **concatena las líneas de todas las páginas** en una sola `lineas` array (sin duplicar cabeceras).
- `archivo_url_mejorado` del documento resultante = la **primera página** (o un array si se amplía la entidad).
- Mantener `file_url` simple = "1 página = 1 factura" sigue funcionando idéntico a hoy.

**No crea el `MaterialDocumentoOrigen`** — eso sigue en `guardarMaterialesOcr`, sin cambios.

### E.2 `guardarMaterialesOcr` (hoy: 1 `documento` + 1 array `lineas`)

**Cambio: aceptar `documentos` (array de documentos, cada uno con sus líneas) además de `documento` + `lineas` para back-compat.**

Firma propuesta:
```ts
// Caso simple — sin cambios
{ documento: {...}, lineas: [{...}] }

// Caso multi-factura (resultado de agrupar N páginas en M facturas)
{ documentos: [{ documento: {...}, lineas: [{...}] }, ...] }
```

Internamente: recorre `documentos` y por cada uno crea su propio `MaterialDocumentoOrigen` y aplica la lógica de `Fabricante`/`MaterialCatalog`/`MaterialPrecioHistorico` **actual** (sin cambios — es un bucle). Cada documento queda aislado: no comparten caché de fabricante entre documentos distintos (¡importante! hoy `fabricanteCache` es a nivel de función; hay que moverla a nivel de documento para no mezclar precios entre facturas del mismo lote).

**Esta es la única corrección relevante**: hoy `fabricanteCache` está fuera del bucle de líneas y es compartida por todo el documento. Con multi-documento hay que **reinicializar `fabricanteCache` para cada documento** del array, para mantener el aislamiento (aunque, en la práctica, el caché es por nombre normalizado y compartirlo no causaría datos erróneos — solo reusaría el mismo `fabricante_id`. Aun así, dejarlo por documento es más limpio y previsible).

### E.3 Impacto en `MaterialDocumentoOrigen` (entidad)

**Cambio mínimo recomendado** (no necesario para la v1, pero útil):
- Añadir `paginas_count: number` (para mostrar en la lista de documentos procesados).
- Añadir `paginas_urls: string[]` (array de URLs de mejora, opcional — si no se añade, se guarda solo la primera en `archivo_url_mejorado`).

**Sin tocar la entidad**: la v1 puede vivir solo con `archivo_url_mejorado = urls[0]` y perder el resto. Es aceptable porque el `MaterialPrecioHistorico.documento_url` también apunta a esa misma URL. La trazabilidad entre páginas se pierde, pero la trazabilidad documento→líneas se mantiene.

Recomendación: **v1 sin tocar la entidad**; v1.1 con `paginas_urls` si se ve que necesitamos abrir la 2ª página de un documento.

### E.4 Nueva función backend `agruparPaginasDocumento`

No hay función backend nueva estrictamente necesaria — la agrupación se puede hacer invocando `procesarFacturaMateriales` con `paginas` y un prompt distinto. Pero para limpiar el flujo recomiendo **una nueva función** `agruparPaginasDocumento` (Entry.ts) que:
- Recibe `{ paginas: [{ url, tipo }] }`.
- Valida `paginas.length <= 15`.
- Llama a `agruparPaginas` del orquestador (nueva export, ver §B.6).
- Devuelve `{ success, grupos, confianza_global, advertencias, modelo, fallback }`.

El cliente (`MaterialesOcrDialog`) la llama tras subir todas las páginas, y con el resultado construye el estado `documentos` para el paso `agrupacion`.

Esta función respeta el plan **Builder+** actual del usuario; pero como el usuario está en un plan sin backend functions habilitadas (`backend_functions_upgrade_required`), **esta propuesta no se puede implementar ahora mismo** — queda como diseño aprobado para cuando se restablezcan las funciones. El frontend (UI de captura N-páginas, tira de miniaturas, panel de revisión) sí podría prepararse como rama separada con mocks, pero el flujo completo requiere la mejora del backend.

### E.5 Resumen de cambios por archivo

| Archivo | Cambios |
|---|---|
| `src/components/materiales/DocumentScanner.jsx` | Renombrar `onDone→onPageReady`; 2 botones en `ready` ("Añadir página"+"Finalizar"); flag `ultima`. ~10 líneas. |
| `src/components/materiales/MaterialesOcrDialog.jsx` | Estado de escalar → arrays de `paginas`/`agrupacion`/`documentos`. Nuevo paso `agrupacion` con panel de revisión. Bucle de `procesarFacturaMateriales` por grupo. ~150 líneas nuevas. |
| `src/components/materiales/AgrupacionReviewPanel.jsx` | **NUEVO** — panel de revisión de grupos (drag-drop entre tarjetas, dividir/unir, checkbox de revisión). ~120 líneas. |
| `src/components/materiales/PaginasTira.jsx` | **NUEVO** — tira de miniaturas reordenable con `@hello-pangea/dnd`. ~80 líneas. |
| `base44/shared/aiOrchestrator.ts` | Exportar `agruparPaginas(base44, { paginas })` con prompt de §B.5. ~40 líneas. |
| `base44/functions/procesarFacturaMateriales/entry.ts` | Aceptar `paginas: [{url,tipo}]` además de `file_url`. Concatenar líneas de N páginas. ~20 líneas. |
| `base44/functions/guardarMaterialesOcr/entry.ts` | Aceptar `documentos: [{documento,lineas}]`; `fabricanteCache` por documento. ~30 líneas. |
| `base44/functions/agruparPaginasDocumento/entry.ts` | **NUEVO** — orquesta la IA de agrupación. ~40 líneas. |
| `base44/entities/MaterialDocumentoOrigen.jsonc` | (Opcional v1.1) `paginas_count`, `paginas_urls`. |
| `src/pages/MaterialesOcr.jsx` | Sin cambios (el diálogo se encarga). |

### E.6 Preservación del caso simple (1 foto → 1 factura)

El caso más común (el 90% real de hoy) sigue siendo: el técnico hace 1 foto, ajusta esquinas, "Procesar y extraer" → 1 página en el array → IA de agrupación devuelve `grupos: [{ paginas_indices: [1], confianza: 'alta' }]` → **el diálogo salta el paso `agrupacion`** y va directo a `revision` (igual que hoy). Después `guardarMaterialesOcr` recibe `documentos: [{ documento, lineas }]` con un solo elemento → bucle de 1 iteración → idéntico al flujo actual.

**El usuario que hoy carga una factura de una página no nota ningún cambio.**

---

## F. Plan de implementación sugerido (fases, tras aprobación)

1. **Fase 1 — Backend (requiere Builder+)** · 1-2 días
   - `agruparPaginas` en `aiOrchestrator.ts`.
   - `procesarFacturaMateriales` acepta `paginas`.
   - `guardarMaterialesOcr` acepta `documentos`.
   - Función nueva `agruparPaginasDocumento`.
   - Tests con 1, 2 y 3 facturas mixtas.

2. **Fase 2 — Frontend captura N-páginas** · 1 día
   - `DocumentScanner` con "Añadir página" / "Finalizar páginas".
   - `MaterialesOcrDialog` con estado de arrays y `PaginasTira`.
   - Atajo: 1 página → salta `agrupacion`.

3. **Fase 3 — Panel de revisión de agrupación** · 1-2 días
   - `AgrupacionReviewPanel` con drag-drop, dividir/unir, checkbox de revisión obligatoria.
   - Bloqueo de "Guardar todo" cuando `confianza_global == 'baja'`.

4. **Fase 4 — Revisión por grupo + guardado** · 1 día
   - `LineasMaterialesEditor` por grupo (ya existe el componente, solo se replica).
   - `guardarMaterialesOcr` con `documentos[]`.

5. **Fase 5 — PDF multi-página + límites** · 0.5 días
   - Backend valida nº de páginas del PDF antes de consumir IA.
   - Cliente limita a 15 páginas.

**Total estimado: 4-6 días de desarrollo, tras aprobación del diseño.**

---

## G. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| La IA mezcla dos facturas por error (worst case) | Siempre revisión manual bloqueante cuando `confianza_global == 'baja'`; default = 1 grupo (no separar en duda). |
| La IA divide una factura multi-página en dos grupos | El usuario puede "Unir" con un clic; la razón del error queda visible. |
| Latencia alta con muchas páginas | Límite duro 15 páginas; subida paralela de imágenes. |
| InvokeLLM no pasa todas las `file_urls` al modelo | Prompt enumera "Página 1: <url>…" + fallback Anthropic (que sí las pasa). |
| PDF muy grande enviado al backend | Validar nº páginas antes de llamar a la IA; rechazar >15. |
| Créditos de IA consumidos en cargas fallidas | El límite de páginas se valida ANTES de la llamada. |
| Plan actual sin backend functions habilitadas | El diseño queda aprobado; la implementación espera a la mejora del plan. |

---

## H. Decisión pendiente de Gerencia / Administración

- [ ] Aprobar el cambio de paradigma **"lote de páginas" en lugar de "un archivo"**.
- [ ] Aprobar el **límite de 15 páginas por carga** (blando 10).
- [ ] Aprobar que la IA de agrupación **NUNCA divida en silencio** (default = 1 grupo con confianza baja + revisión obligatoria).
- [ ] Aprobar la **v1 sin tocar la entidad** `MaterialDocumentoOrigen` (solo se guarda la primera página como `archivo_url_mejorado`).
- [ ] Aprobar la creación de la **nueva función backend `agruparPaginasDocumento`** (requiere Builder+).
- [ ] Aprobar el **orden de fases** y el plazo de 4-6 días.

Una vez aprobadas estas decisiones, se procede a la implementación según el plan del §F.