# Propuesta técnica — CamScanner en Notas de Gastos + módulo de comprobación manual de migración en Alta Materiales

**Módulos:** `/notas-gastos` (NotaGastoForm · TicketCapture · procesarOcrNota) y `/materiales-ocr` (MaterialesOcrDialog · DocumentScanner · procesarFacturaMateriales · guardarMaterialesOcr)
**Proyecto:** Smart Gestión (Base44, appId `69de8e23b1cd7ac050397c82`) — SIMANTEC S.L.
**Estado:** Borrador para aprobación de Gerencia / Administración. **No se ha tocado código.**
**Fecha:** 2026-08-22

---

## 0. Resumen ejecutivo

**Parte 1.** El módulo Notas de Gastos hoy sube la foto tal cual (solo la comprime a 800 px / JPEG 0.60 en `TicketCapture.jsx`) antes de invocar `procesarOcrNota`. Existe en `materiales/` un componente `DocumentScanner.jsx` que hace mejora tipo CamScanner (recorte de 4 esquinas arrastrables, corrección de perspectiva/warp, escala de grises y auto-contraste p2/p98). Esta propuesta extrae esa lógica a un **componente/hook compartido** para reutilizarlo en Notas de Gastos sin duplicar, dejando el flujo de **PDF** como está (la mejora CamScanner no aplica a PDF).

**Parte 2.** El módulo `/materiales-ocr` se amplía con una nueva sección **"Notas de Gastos pendientes de migrar a Materiales"**: listado navegable del histórico completo de notas de todos los usuarios, con enlace directo a cada nota pendiente para abrirla y procesarla desde Alta Materiales. El criterio de "ya migrada" se define por un **enlace explícito** `MaterialDocumentoOrigen ↔ nota_gasto_id` (campo nuevo), **no** por matching difuso fecha/importe/proveedor.

Todo paso de IA (OCR de Notas, OCR de Materiales, **y** cualquier asistencia IA para detección de bordes/validación de calidad que se añada al CamScanner) sigue el patrón ya establecido en `aiOrchestrator.ts`: **Base44 InvokeLLM primero, Claude de respaldo**, sin duplicar el patrón en archivos nuevos.

---

# PARTE 1 — Extender la mejora CamScanner a Notas de Gastos

## A. Análisis: ¿componente compartido o importar el actual?

`DocumentScanner.jsx` vive en `src/components/materiales/DocumentScanner.jsx` (289 líneas). Dentro contiene **tres responsabilidades**:

1. **Lógica de mejora pura** (sin estado de UI, sin JSX): `loadImgFromFile`, `warpToCanvas`, `canvasToFile`. Funciones puras, ~85 líneas, sin dependencias de React/Tailwind. Son el "corazón CamScanner".
2. **Lógica de interacción de captura de UNA página** (esquinas arrastrables, recorte, preview): estado React + JSX de `ready`.
3. **Lógica de elección de entrada** (cámara vs. subir archivo, móvil vs. desktop): JSX de `idle`.

**Problema de importar el actual directamente desde `materiales/` en el flujo de Notas de Gastos**: el componente acopla texto y títulos ("Factura / albarán / ticket de proveedor", "Antes del OCR tipo CamScanner") al dominio Materiales. Si se importa tal cual, Notas de Gastos heredaría textos de "factura/proveedor" que no aplican a un ticket de gasolina o un peaje. **Por eso se recomienda extraer** y no solo importar.

### A.1 Estructura propuesta (3 piezas)

```
src/lib/documentScan.js          (NUEVO)  — funciones puras: loadImgFromFile, warpToCanvas,
                                            canvasToFile, MAX_SRC, MAX_OUT. Sin JSX. (80 líneas)
src/components/shared/CamScannerStep.jsx  (NUEVO)  — componente reutilizable de captura+mejora
                                            UNA página, con props de personalización de textos.
                                            Importa documentScan.js. (180 líneas)
src/components/materiales/DocumentScanner.jsx  (REFÁCTOR)  — wrapper mínimo que re-rendera
                                            CamScannerStep con los textos actuales de Materiales.
                                            Mantiene la API onDone/onSkip existente (sin cambios
                                            para MaterialesOcrDialog). (30 líneas)
src/components/gastos/TicketCapture.jsx       (REFÁCTOR)  — sustituye la lógica propia de
                                            compresión 800px/0.60 por CamScannerStep cuando el
                                            adjunto es imagen; mantiene la rama PDF tal cual.
```

**Decisión A: extracción parcial.** No se duplica la lógica de mejora (`documentScan.js` es único y compartido); el componente UI de captura sí se compone en `CamScannerStep`, y cada módulo lo usa con sus propios textos. Esto evita tanto la duplicación (miedo del prompt) como el acoplamiento textual que tendríamos si solo importáramos el actual.

### A.2 Migración del módulo Materiales (sin tocar su flujo)

El `DocumentScanner.jsx` refactorizado queda como un **wrapper**: recibe `onDone/onSkip` y reexporta el resultado de `CamScannerStep` con la misma forma `{ archivo, file, preview, ocr_ok }` que hoy usa `MaterialesOcrDialog.handleScannerDone`. **`MaterialesOcrDialog` no se toca en esta Parte 1.**

## B. Punto exacto del flujo de Notas de Gastos donde insertar la mejora

### B.1 Flujo actual de creación de una nota

```
NotasGastos.jsx  →  <NotaGastoForm open>
                       paso 1 'captura':   <TicketCapture onDone=handleDone onSkip=…>
                       paso 2 'formulario': rellena campos + crear RegistroGasto
                    </NotaGastoForm>
```

`TicketCapture.jsx` hoy: recibe el `File`, lo comprime (`comprimirImagen` → 800px / JPEG 0.60), lo sube con `UploadFile`, invoca `procesarOcrNota`, y devuelve `{ archivo, preview, ocr_raw, datos, ocr_ok }` al `handleDone` de `NotaGastoForm`.

### B.2 Inserción de CamScanner

**Cambios mínimos en `TicketCapture.jsx`** (sin tocar `NotaGastoForm` ni `procesarOcrNota`):

1. Detectar `file.type`:
   - **Imagen** (`image/jpeg|png|webp|gif`) →routing hacia `CamScannerStep` (camino nuevo). Al acabar, `CamScannerStep` devuelve `{ file: FileEscaneado, preview }` (igual que en Materiales) y `TicketCapture` continúa su flujo existente: `UploadFile` → `procesarOcrNota` → `onDone({...})`.
   - **PDF** (`application/pdf`) → **sin CamScanner**; el flujo actual se mantiene: sube el PDF y manda a `procesarOcrNota`.
   - **Otros** (Word, Excel — caso marginal que hoy acepta `OcrUploader`) → sin CamScanner, igual que PDF.

2. Antes de invocar el OCR, si la imagen ha sido mejorada, **se sube el File mejorado** (recortado, enderezado, contraste), no el original. Esto mejora significativamente el OCR de `procesarOcrNota` (sin tocar su prompt ni su lógica), porque recibe una imagen más limpia.

**`procesarOcrNota` no se toca**: ya espera un `file_url` y llama a `aiOrchestrator.ocrDocumento`. La mejora de imagen es puramente cliente; el OCR recibe una imagen mejor y la extracción mejora de forma natural.

### B.3 Ruta fallback "Saltar mejora — subir directa"

Como ya existe en `DocumentScanner` (`onSkip` → sube el archivo sin mejorar), `TicketCapture` conserva el mismo atajo: si el usuario no quiere ajustar esquinas, sube la foto original. Útil para capturas ya nítidas.

### B.4 ¿Dónde aplicar CamScanner? Decisión

**Decisión B:** la mejora se aplica en `TicketCapture.jsx` (paso 1) **antes** de la subida + OCR. `NotaGastoForm` (paso 2) y `procesarOcrNota` no se modifican. La superficie de cambio es **1 archivo editado + 2 nuevos + 1 refactor ligero**.

## C. Patrón de IA — si se añade asistencia de IA para la mejora

El prompt-marco obliga: si en algún momento se introduce IA para la mejora (p. ej. detección automática de los 4 bordes del documento en vez del arrastre manual, o validación de calidad de captura), **debe reutilizarse `aiOrchestrator.ts`**.

### C.1 Decisión recomendada: **no introducir IA en la mejora en esta Parte 1**

Razones:
- El arrastre manual de las 4 esquinas ya es fiable y cero coste (sin créditos de IA).
- La mejora determinista (recorte/warp/grises/contraste) cubre el 95% de los casos de captura móvil sin necesidad de IA.
- Cada llamada IA adicional por foto sería más créditos de InvokeLLM/Claude para una ganancia marginal.

**Decisión C:** la Parte 1 implementa la mejora determinista vía `documentScan.js` (canvas). Si en el futuro se quiere detección automática de bordes por visión IA, se añadirá una **nueva función** `detectarBordesDocumento` dentro de `aiOrchestrator.ts` (mismo patrón: InvokeLLM con `file_urls` primero, fallback Anthropic), sin alterar la firma de CamScanner ni duplicar el orquestador. Pero en esta Parte 1, **no se crea esa función**: se deja el ajuste manual de esquinas.

### C.2 Si más adelante se valida calidad de imagen

Si se valida con IA (p.ej. "la foto está borrosa / poca luz / recorta parte del ticket") antes de aceptar:
- **Mismo patrón**: nueva función en `aiOrchestrator.ts` que recibe `{ file_url }` y devuelve `{ calidad: 'alta'|'media'|'baja', motivos: [] }`.
- **Decisión de UX**: si `calidad == 'baja'`, el botón "Procesar y extraer" avisa al usuario "captura de calidad baja; recomendamos reintentar o aceptar bajo tu responsabilidad" — nunca bloquea. La decisión sigue siendo del usuario.

De nuevo, **esta Parte 1 no introduce esa validación IA** — se deja como iteración futura, descrita aquí solo para fijar el patrón de antemano.

## D. Cambios concretos (Parte 1) — superficie total

| Archivo | Cambio |
|---|---|
| `src/lib/documentScan.js` | **NUEVO** — funciones `loadImgFromFile`, `warpToCanvas`, `canvasToFile`, constantes. ~80 líneas. Extraído de `materiales/DocumentScanner.jsx`. |
| `src/components/shared/CamScannerStep.jsx` | **NUEVO** — componente React de captura+mejora UNA página, props: `onDone({file, preview})`, `onSkip`, `textoAyuda`, `textoBotones`, `textoBotonFinalizar`. ~180 líneas. |
| `src/components/materiales/DocumentScanner.jsx` | **REFÁCTOR** — wrapper de `CamScannerStep` con los textos actuales y la API `onDone({archivo,file,preview,ocr_ok})` existente. ~30 líneas. |
| `src/components/gastos/TicketCapture.jsx` | **EDIT** — ramifica por `file.type`: imagen → `CamScannerStep` antes de UploadFile; PDF/otros → sin cambios. La parte post-subida/OCR se reorganiza sin cambios de contrato. ~30 líneas editadas. |
| `base44/functions/procesarOcrNota/entry.ts` | **Sin cambios.** |
| `src/components/gastos/NotaGastoForm.jsx` | **Sin cambios** (el contrato `handleDone` se respeta). |

**El usuario que crea una nota de gastos con foto** nota, tras esta Parte 1: que tras elegir "Hacer foto", aparece la pantalla "ajusta las 4 esquinas" (CamScanner) en lugar del envío directo. Para PDFs, todo sigue igual.

---

# PARTE 2 — `/materiales-ocr` como módulo de comprobación manual de migración

## C. Criterio de "nota de gasto ya migrada a Materiales"

### C.1 Estado de la entidad `MaterialDocumentoOrigen`

El esquema actual (snapshot del proyecto) **no tiene** ningún campo que enlace con `RegistroGasto`. Las propiedades son: `tipo, numero_documento, fecha_documento, proveedor_nombre, proveedor_nif, archivo_url_mejorado, archivo_url_original, obra_id, obra_name, operario_id, estado, lineas_count`. **No existe `nota_gasto_id`.**

### C.2 Decisión: enlace explícito, no matching difuso

**Decisión C (Parte 2):** Añadir un campo **`nota_gasto_id`** (string, opcional) a `MaterialDocumentoOrigen`. Cuando una nota de gastos se usa para alimentar Materiales, se persiste el ID del `RegistroGasto` original en ese campo. "Ya migrada" = existe al menos un `MaterialDocumentoOrigen` con ese `nota_gasto_id` no vacío.

**Por qué no matching difuso (fecha + importe + proveedor):**
- Tickets con el mismo importe y fecha en comercios distintos crearían falsos positivos (p.ej. dos repostajes de 20 € en gasolineras distintas el mismo día).
- Una nota podría haberse procesado varias veces contra Materiales en distintas cargas; con matching se contarían todas como migradas.
- El enlace explícito es atómico: 1 nota → 0 o N `MaterialDocumentoOrigen`, sin ambigüedad.

**Compatibilidad con el histórico:** las notas creadas *antes* de esta mejora no tendrán `nota_gasto_id` en sus documentos asociados (porque ninguno existe). Por eso, en la fase de detección, una nota se considera **pendiente** si no existe ningún `MaterialDocumentoOrigen` con `nota_gasto_id == nota.id`. Para notas históricas — que nunca pasaron por Materiales — esa condición es trivialmente cierta y las marca como pendientes, que es justo el comportamiento deseado (son las que queremos "descubrir" y procesar).

### C.3 ¿Cómo se rellena `nota_gasto_id` al migrar?

Cuando el usuario abre una nota desde la vista "pendientes" y la procesa con Alta Materiales, hay dos puntos donde puede rellenarse:

- **Opción 1 (recomendada): en `guardarMaterialesOcr`** — el payload del diálogo lleva `documento.nota_gasto_id` y la función lo persiste en `MaterialDocumentoOrigen.create(...)`. El diálogo, al ser abierto "desde la lista de pendientes con ID concreto", ya conoce ese ID.
- **Opción 2: en el cliente** — rellenado implícito al invocar el diálogo con un parámetro `nota_origen_id`.

Se decanta **Opción 1**: persistedencia en backend, dato de auditoría fiable. Requiere ampliar la firma de `guardarMaterialesOcr` para aceptar `documento.nota_gasto_id` → añadir al `create({...})`. **Cambio mínimo en el backend** (~2 líneas).

### C.4 ¿Qué pasa con la nota original tras migrar?

La nota `RegistroGasto` **no se modifica** (sigue siendo la nota de gasto del operario, con su estado, ciclo, etc.). Solo queda enlazada desde `MaterialDocumentoOrigen.nota_gasto_id`. La nota pasa automáticamente de "pendiente" a "migrada" porque la consulta de pendientes se hace por ausencia de enlace. **No se añaden estados ni campos redundantes** a `RegistroGasto`.

## D. Diseño de la vista "Notas de gastos pendientes de migrar"

### D.1 Ubicación dentro de `/materiales-ocr`

`MaterialesOcr.jsx` hoy tiene un único botón "Cargar factura / albarán (OCR+IA)" y un listado de `MaterialDocumentoOrigen` ya procesados. Se añade una **segunda pestaña/sheet**:

```
[MaterialesOcr.jsx]
   ├─ Pestaña "Cargar"      (lo que ya existe hoy: botón de carga + listado de documentos)
   └─ Pestaña "Pendientes"  (NUEVO: listado de notas de gastos pendientes de migrar)
```

Usando el componente `Tabs` de shadcn (ya importado en otros puntos del proyecto), el usuario alterna entre "cargar una factura nueva" y "revisar qué notas ya creadas no se han migrado".

### D.2 Datos por nota (columnas/cards)

Cada nota pendiente se muestra como una card (en móvil, móvil sea el viewport que se está usando hoy) con:
- `numero_nota` (en monoespaciado, destacado).
- `fecha_documento` · `proveedor (nombre_comercio)` · `importe` (con €).
- `categoria` (badge de color, igual que en NotasGastos).
- `operario_name` (quién la creó) — visible porque la vista es solo gerencia/admin (ver §E).
- `obra_name` si aplica.
- Indicador `Pendiente de migrar` (badge ámbar).
- Botón **"Procesar en Alta Materiales"** → abre `MaterialesOcrDialog` con `nota_origen_id` precargado.

### D.3 Paginación/filtrado del histórico

- **Carga inicial**: `RegistroGasto.list('-created_date', 50)` más recientes.
- **Filtro**: por `categoria`, por operario (selector), por rango de fechas, por "ya migrada / pendiente" (por defecto: pendientes).
- **Búsqueda de texto**: `numero_nota`, `nombre_comercio`, `numero_factura`.
- **"Cargar más"**: botón al final del listado que pagina con `skip`.

### D.4 Cómo se "abre" cada nota

**Dos alternativas** analizadas, decisión final:

**Alt 1 — Enlace a `/notas-gastos` con query param de preselección** (`/notas-gastos?registro_id=<id>`). La página `NotasGastos.jsx` debería modificar su carga para leer el query param y abrir directamente el detalle `NotaGastoDetalle` de esa nota. Pros: mantiene la nota de gasto en su contexto natural. Contras: requiere tocar `NotasGastos.jsx` y `NotaGastoDetalle.jsx` para soportar deep-link — está fuera del alcance "mínimo" de esta Parte 2.

**Alt 2 (recomendada) — Botón "Procesar en Alta Materiales"** dentro de la propia vista `/materiales-ocr`. Abre el `MaterialesOcrDialog` (el que ya existe) con un parámetro `nota_origen_id` (nueva prop). El diálogo precarga la cabecera del documento con los datos de la nota (fecha, proveedor, importe, NIF, número de factura, categoría como tipo) y deja al usuario hacer la revisión CamScanner + OCR + líneas como ya hace hoy. Al guardar, `guardarMaterialesOcr` recibe `documento.nota_gasto_id` y persiste el enlace — la nota queda automáticamente "migrada".

**Decisión D:** Alt 2. No abre pestaña nueva a `/notas-gastos`; procesa la nota **en el propio módulo de Alta Materiales**, que es el propósito del prompt ("punto de trabajo manual desde el que se fuerza y navega la comprobación de migración"). El botón "Ver nota original" en la card de pendientes ofrece además el deep-link Alt 1 como **extra opcional v1.1**, abrir en nueva pestaña.

### D.5 ¿Cómo obtiene la imagen para procesar la nota?

`RegistroGasto` lleva el campo `archivos: [{url, nombre, tipo, fecha_subida}]` (snapshot del proyecto). Si la nota tiene *al menos un adjunto imagen*, `MaterialesOcrDialog` abre con la primera imagen ya cargada (CamScanner no es necesario porque la imagen ya exists; el usuario podría **re-corre** la mejora si quiere, o directamente "extraer líneas" → OCR). Si la nota solo tiene PDF, se pasa directamente a OCR. Si no tiene adjuntos (nota creada manualmente sin foto), se muestra un aviso "esta nota no tiene adjunto; crea el documento de materiales manualmente" y un fallback a un formulario CamScanner vacío (modo manual).

### D.6 Estados y confianza para "ya migrada sustancialmente"

**No se hace matching parcial**: una nota está migrada si existe `MaterialDocumentoOrigen.nota_gasto_id == nota.id` (sí/no, binario). No se considera "parcialmente migrada" aunque solo se hayan guardado 2 de 5 líneas — el operario/gerencia reeve que confirme. Esto simplifica el criterio y lo hace robusto.

## E. Permisos

### E.1 Situación actual

`/materiales-ocr` está (según el snapshot) declarada en el sidebar dentro del módulo "users" — i.e. restringido a `gerencia / admin`. La nueva pestaña "Pendientes" que lista **todas** las notas de gastos de todos los usuarios hereda ese acceso restringido:

- **Crear `MaterialDocumentoOrigen`** (RLS en la entidad): `admin / gerencia / director_comercial / jefe_obra`. Eso cubre.
- **Leer `RegistroGasto`** (RLS en la entidad — ver snapshot): `admin / gerencia / director_comercial / jefe_obra / created_by`. Los roles no-admin solo ven sus propias notas hoy, lo que rompería el objetivo de "histórico completo de todos los usuarios".

**Gap detectado:** hoy, un `jefe_obra` que ahorra acceso a `/materiales-ocr` vería la pestaña de Pendientes, pero el backend le devolvería solo sus propias notas (RLS por `created_by`), no el histórico completo. Es decir, la RLS actual no basta para garantizar "todas las notas de todos los usuarios" ni siquiera a `jefe_obra`.

### E.2 Decisión

Para preservar el requisito "no abrir una vía alternativa para ver todas las notas de todos los usuarios a roles que no deberían tenerla":

- **La vista "Pendientes de migrar" solo se muestra a `admin` y `gerencia`** (roles con el rol completo de auditoría). La pestaña se oculta para `director_comercial`, `jefe_obra`, técnicos y operarios.
- Esto ya está cubierto por la RLS actual de `RegistroGasto` (admin/gerencia ven todo). No hay que relajar RLS.
- A nivel de UI, en `MaterialesOcr.jsx` se valida el rol del usuario (con `useUserRole` como ya hace hoy) y solo se renderiza la pestaña "Pendientes" para `isAdmin || isGerencia`.

**Decisión E:** No se aflojan permisos. Se reduce la visibilidad de la nueva pestaña a los roles que ya tienen lectura global de `RegistroGasto`. Cumple el requisito del prompt:

### E.3 Verificación del plan Builder+ y backend

El plan actual del usuario **no permite modificar backend functions** (nota de sistema: `backend_functions_upgrade_required`). La Parte 2 requiere:

- Editar `guardarMaterialesOcr` (backend) para aceptar y persistir `documento.nota_gasto_id`. **Cambio menor**, pero backend.
- No hay nuevas funciones backend segén necesarias para esta Parte 2 (la consulta de pendientes se hace desde el cliente con `base44.entities.RegistroGasto.list / filter` cruzado contra `MaterialDocumentoOrigen.filter` por `nota_gasto_id` que tengan esos registros — eso se puede hacer en cliente).

**Consecuencia:** La Parte 1 (CamScanner) es puramente frontend y se puede implementar ya. La Parte 2 requiere el ajuste backend en `guardarMaterialesOcr` y sufre el bloqueo del plan. Hasta entonces, se puede implementar parcialmente: la pestaña "Pendientes" se puede crear en el cliente, y la condición de "pendientes" se basa en un **join cliente**: traer los primeros 50 `MaterialDocumentoOrigen` y los primeros 50 `RegistroGasto` y filtra en cliente. Pero a partir de ~200 notasگونهe escalaría mal. Por tanto, **la propose Parte 2 completa queda pendiente del upgrade**; puede empezar la Parte 1 sin esperarlo.

---

## F. Cómo se crea el enlace módulo-a-módulo

Estado del flujo tras implementar Parte 2:

```
[MaterialesOcr · pestaña "Pendientes"]
   1. El usuario (gerencia/admin) entra y ve la lista de notas pendientes de todos.
   2. Filtra/encuentra una nota concreta.
   3. Pulse "Procesar en Alta Materiales":
      → MaterialesOcrDialog abre con prop `nota_origen_id=<registro.id>` y `nota_origen` predefnido
        (cabecera + adjuntos[0].url).
      → El usuario puede usar CamScanner (si es imagen) o saltar a OCR directo (si PDF).
      → LineasMaterialesEditor revisa líneas.
   4. Pulse "Guardar":
      → guardarMaterialesOcr recibe documento.nota_gasto_id
      → MaterialDocumentoOrigen.create({..., nota_gasto_id: registro.id})
      → La nota queda enlazada; automáticamente ya no aparece en "Pendientes".
   5. El usuario vuelve a la pestaña "Pendientes" y la nota ya no está.
```

El proceso se repite nota a nota, exactamente el "trabajo manual" que pide el prompt.

### F.1 Actuaciones sobre la entidad `MaterialDocumentoOrigen`

**Decisión F:** Añadir el campo `nota_gasto_id` (`type: "string"`, sin `required`, opcional, sin RLS específica) a la entidad. No se requiere RLS adicional: propaga la RLS existente (admin/gerencia/director_comercial/jefe_obra para lectura).

```jsonc
"nota_gasto_id": {
  "type": "string",
  "description": "ID del RegistroGasto que originó este documento (enlace explícito para marcar notas de gasto ya migradas a Materiales). Vacío si el documento no viene de una nota de gasto."
}
```

---

## G. ¿Y si se quiere verificación IA de la migración?

El prompt contempla "clasicación de si ya contiene materiales conocidos". **Decisión: no se introduce IA en la clasificación "ya migrada/sí"** — el enlace explícito lo resuelve de forma atómica y certera sin IA.

Para una posible v1.2 (no en esta propuesta): al abrir una nota pendiente, se podría invocar a IA para predecir "esta nota parece contener N materiales relacionados (por numero_factura y adjunto de tipo factura)" y ayudar al usuario a decidir; pero el binario pendiente/migrada seguiría siendo el enlace explícito. No se incluye IA en la Parte 2.

## H. Resumen de cambios por archivo (Parte 1 + Parte 2)

| Archivo | Cambio | Parte | Comentario |
|---|---|---|---|
| `src/lib/documentScan.js` | **NUEVO** | 1 | Funciones puras extraídas. ~80 líneas. |
| `src/components/shared/CamScannerStep.jsx` | **NUEVO** | 1 | Componente reutilizable con props de textos. ~180 líneas. |
| `src/components/materiales/DocumentScanner.jsx` | **REFÁCTOR** | 1 | Wrapper de CamScannerStep con textos de Materiales. ~30 líneas. |
| `src/components/gastos/TicketCapture.jsx` | **EDIT** | 1 | Ramifica imagen→CamScannerStep; PDF sin cambios. ~30 líneas. |
| `src/components/gastos/OcrUploader.jsx` | **Sin tocar** | 1 | Alternativa antigua, fuera del flujo de NotaGastoForm. |
| `base44/functions/procesarOcrNota/entry.ts` | **Sin cambios** | 1 | El OCR recibe una imagen mejor limpa, nutrs probaria mejorar pero no se necesita prompt nuevo. |
| `base44/entities/MaterialDocumentoOrigen.jsonc` | **EDIT** | 2 | Añadir `nota_gasto_id`. |
| `base44/functions/guardarMaterialesOcr/entry.ts` | **EDIT (Builder+)** | 2 | Aceptar y persistir `documento.nota_gasto_id`. ~2 líneas. |
| `src/pages/MaterialesOcr.jsx` | **EDIT** | 2 | Pestaña "Pendientes" (visible solo admin/gerencia). ~120 líneas nuevas. |
| `src/components/materiales/PendientesMigrarPanel.jsx` | **NUEVO** | 2 | Listado navegable de notas pendientes. ~150 líneas. |
| `src/components/materiales/MaterialesOcrDialog.jsx` | **EDIT** | 2 | Aceptar prop `nota_origen_id`, pre-cargar cabecera desde la nota. ~30 líneas. |
| `src/components/gastos/NotaGastoForm.jsx` | **Sin tocar** | 1+2 | Contrato respetado. |
| `src/components/gastos/NotaGastoCard.jsx` / `NotaGastoDetalle.jsx` | **Sin tocar** | 2 | La nota original vive en NotasGastos; aquí no se toca. |

## I. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El usuario confunde el paso CamScanner con un paso nuevo y abandona | Texto claro "Ajusta las 4 esquinas para mejorar el OCR"; botón "Saltar mejora" visible. |
| CamScanner no se porta bien en pantallas pequeñas (390 px) | El `DocumentScanner` ya está probado en móvil en Materiales. Se reutiliza tal cual. |
| Para PDFs de tickets, sin CamScanner, el OCR empeora | No hay daño: el PDF ya es vector y en general más legible que una foto de cámara. |
| False "pendientes" por notas no migradas que en realidad no tienen materiales | El listado muestra *todas* las pendientes; el usuario decide cuáles procesar. No hay automatización. |
| Acumulación de `MaterialDocumentoOrigen` huérfanos sin `nota_gasto_id` | No es problema: los documentos creados manualmente (sin nota origen) simplemente quedan sin enlace. |
| RLS no permite a gerencia/admin leer todas las notas | Ya lo permite (RLS actual de `RegistroGasto`). No hay que aflojar. |
| Plan sin backend → Parte 2 incompleta | Se avisa al usuario; Parte 1 se puede implementar ya. |

---

## J. Decisiones pendientes de Gerencia / Administración

- [ ] Aprobar la **extracción de `documentScan.js`** a un módulo compartido.
- [ ] Aprobar que **la mejora CamScanner NO aplique a PDFs** (flujo actual conservado).
- [ ] Aprobar **no introducir IA en la mejora de imagen** en esta Parte 1 (ajuste manual de esquinas).
- [ ] Aprobar el **enlace explícito `MaterialDocumentoOrigen.nota_gasto_id`** como criterio de "migrada".
- [ ] Aprobar que la **vista "Pendientes" solo la vean admin/gerencia**.
- [ ] Aprobar que el **procesado de una nota pendiente se haga dentro de `/materiales-ocr`** (Alt 2) y no abriendo la pestaña a `/notas-gastos`.
- [ ] Aprobar el **pequeño cambio en `guardarMaterialesOcr`** para persistir `nota_gasto_id` (requiere Builder+).
- [ ] Aprobar el **orden de implementación**: Parte 1 (frontend, ya) → Parte 2 (frontend + backend pequeño, tras upgrade).

---

## K. Plan de implementación (fases, tras aprobación)

1. **Fase 1 — Parte 1 frontend (sin backend)** · 1 día
   - Extraer `documentScan.js`.
   - Crear `shared/CamScannerStep.jsx`.
   - Refactorizar `materiales/DocumentScanner.jsx` como wrapper.
   - Editar `gastos/TicketCapture.jsx` para usar CamScannerStep en imágenes.
   - Smoke test: crear nota con foto, ver CamScanner; con PDF, flujo anterior.

2. **Fase 2 — Parte 2 frontend (sin backend aún)** · 1-2 días
   - Añadir pestaña "Pendientes" en `MaterialesOcr.jsx` (gated admin/gerencia).
   - `PendientesMigrarPanel.jsx` con listado, filtros y búsqueda.
   - Estado "migrada" preliminar: el panel hace el join en el cliente (primeros N `MaterialDocumentoOrigen` + N `RegistroGasto`) hasta que se mueva la lógica al backend.
   - `MaterialesOcrDialog` acepta `nota_origen_id` y pre-carga cabecera.
   - El botón "Guardar" ya envía `documento.nota_gasto_id` en el payload (aunque el backend aún no lo persista).

3. **Fase 3 — Parte 2 backend (requiere Builder+)** · 0.5 días, cuando se restablezcan las funciones
   - Añadir `nota_gasto_id` a la entidad `MaterialDocumentoOrigen`.
   - `guardarMaterialesOcr` persiste ese campo.
   - (Opcional v1.1) Backend que devuelva el listado de notas pendientes ya filtrado.

**Total estimado: 2-3 días sin backend; +0.5 días tras upgrade.**

---

Una vez aprobadas las decisiones de §J, se procede a la implementación según el plan de §K.