# Pedidos — Formato corporativo + “Ver documento original vs. líneas extraídas”

**Proyecto:** Smart Gestión (Base44, appId 69de8e23b1cd7ac050397c82) — Simantec S.L.
**Fecha:** 2026-09-15
**Estado:** Análisis + propuesta técnica (PENDIENTE DE IMPLEMENTACIÓN)

---

## 0. Resumen ejecutivo

Hoy el módulo Pedidos ya extrae líneas de artículos por OCR+IA (`extraerDatosPedido`) y las
guarda **normalizadas** en `Order.items[]`, pero **no conserva nada del documento crudo** y la
vista de detalle es un formulario funcional sin presentación corporativa.

Propuesta (dos piezas, independientes):

1. **Vista de detalle corporativa** — rediseño sólo visual de la presentación del pedido
   (cabecera con identidad Simantec, datos jerarquizados, tabla de líneas cuidada, badges de
   estado), sin tocar la lógica de edición/OCR. Reutiliza `SimantecLogo` y `drawSimantecLogoPdf`.
2. **“Ver documento original vs. líneas extraídas”** — panel embebido que muestra el `file_url`
   (foto/PDF original) **al lado** de las `items[]` ya extraídas, para contraste visual directo
   en obra. Opción simple y fiel; **no** reconstruye texto. Solo aparece si existe `file_url`.

---

## A. ¿Qué conserva hoy `extraerDatosPedido` además de `items[]`?

**Hallazgo (confirmado en `src/lib/ocrPedidos.js`):** la función devuelve un objeto `datos` con
`{ order_number, supplier, date, notes, items[], confianza }`. Toda la extracción es
**normalizada** (campos interpretados). **No se guarda ningún campo `ocr_raw`** con el
texto/estructura literal del documento.

**Esquema `Order` (confirmado en `base44/entities/Order.jsonc`):** los campos son
`title, obra_id, obra_name, proveedor, fecha_pedido, fecha_entrega, importe, estado, items[],
notas, file_url`. **No existe `ocr_raw`** (a diferencia de `RegistroGasto`, que sí lo tiene).

**Implicación:** para mostrar las líneas “tal como constan en el documento de origen” **no
tenemos texto crudo guardado**. Dos caminos:

- (A1) Reconstruir una tabla textual a partir de un nuevo `ocr_raw` que habría que empezar a
  guardar → cambio de esquema + re-extracción de históricos; y aun así la reconstrucción
  textual **no es 100% fiel** al layout real (la IA reordenaría/interpretaría).
- (A2) Mostrar el propio `file_url` embebido (la imagen/PDF original) junto a `items[]` →
  **fiel al 100%**, sin tocar la extracción, sin reconstruir nada.

**Decisión → ver punto B.**

---

## B. Formato de “vista tal como en el documento de origen”

**Recomendación: Opción A2 (lado a lado con `file_url`).** Es la más simple y la más fiel al
caso de uso real (“comprobar con el cliente en obra qué se pidió y cómo estaba expresado”).

**Por qué no reconstruir texto desde `ocr_raw`:**
- Requiere añadir `ocr_raw` al esquema `Order` y volver a extraer los pedidos históricos.
- La reconstrucción textual (incluso cruda) puede reordenar líneas, perder columnas, romper
  tablas de peajes/albaranes con layouts complejos → genera **falsa confianza**.
- El cliente en obra quiere ver **el papel real**, no una transcripción.

**Mecanismo concreto:**
- Panel/pestaña “Ver documento original” visible **solo si `Order.file_url` existe**.
- Si es imagen (jpg/png): `<img>` responsiva, con zoom tap-to-zoom (doble tap) en móvil.
- Si es PDF: `<iframe>` / `<object>` embebido con fallback a “Abrir en pestaña nueva”.
- Layout: en **desktop**, dos columnas (documento a la izquierda, `items[]` extraídas a la
  derecha, sincronizadas visualmente por orden). En **móvil**, un *toggle* “Original /
  Extraídas” o apilado deslizable (documento arriba, líneas debajo) para no sacrificar legibilidad.
- Encima de cada bloque, una etiqueta clarificadora: “Documento original (tal como se pidió)”
  vs. “Líneas extraídas por IA (normalizadas)”.

**No se descarta A2+ocr_raw como futuro opcional:** si más adelante se quiere un histórico
buscable por texto, se añade `ocr_raw` en una tarea aparte. Esta tarea **no lo necesita**.

---

## C. ¿Existe ya un mecanismo de discrepancias reutilizable?

**Hallazgo (confirmado):**
- `evaluarPrecisionPedido(datos)` existe y devuelve `{ precisa, motivo }` (umbral: confianza
  < 0.6, o faltan `supplier`/`date`/`items`). Es un **umbral de confianza**, no un diff
  línea a línea.
- `reprocesarPrecisionPedido(file_url)` refuerza con `gemini_3_flash` cuando la primera pasada
  es incompleta.
- **No existe un panel visual de discrepancias por línea** para pedidos (sí existe
  `src/components/gastos/PrecisionPanel.jsx`, pero es de gastos, no pedidos).

**Reutilización:** en la vista corporativa podemos reutilizar `evaluarPrecisionPedido` para
mostrar un **badge “Precisión pendiente / Revisar”** cuando `precisa === true`, con el `motivo`
en tooltip. Pero el **contraste visual línea a línea no existe** y es justo lo que aporta esta
nueva vista lado a lado: el propio usuario compara el original con la lista extraída. **No hace
falta construir un diff automático** — la comparación humana sobre el papel real es el
mecanismo.

---

## D. Elementos del “formato corporativo”

Reutilizable ya existente en el proyecto:

| Elemento | Reutilizar | Dónde está |
|---|---|---|
| Logo Simantec on-screen | `SimantecLogo` (componente React) | `src/components/SimantecLogo.jsx` |
| Logo Simantec en PDF | `drawSimantecLogoPdf(doc, x, y, sz)` | `src/lib/simantecLogoPdf.js` |
| Badges de estado | `statusCfg` (pendiente/en_curso/entregado/cancelado) | ya en `Orders.jsx` |
| Estilo de PDFs corporativos | patrón de `exportarCicloContabilidad` / `exportarNotasGastosPDF` | `base44/functions/*` |

**Composición de la vista corporativa (pantalla):**

1. **Cabecera** con `SimantecLogo` + tagline; a la derecha, `statusCfg[estado]` como badge grande
   y el código de pedido (`title`, ej. `PED-26-00005`) en monoespaciada destacado.
2. **Bloque “Datos del pedido”** jerarquizado en dos columnas (responsive a una en móvil):
   - Obra (`obra_name`) destacada como titular.
   - Proveedor, Fecha pedido, Fecha entrega prevista, Importe total.
3. **Tabla de líneas** (`items[]`) con estilo cuidado: cabecera con fondo brand, filas
   alternas, columnas Descripción / Cantidad / Unidad / Precio (precio sólo si `showPrices` =
   admin, igual que hoy), subtotal por línea y total al pie. No una tabla de edición cruda:
   la edición sigue en el diálogo existente; esta es **vista de presentación**.
4. **Notas** como bloque diferenciado si existen.
5. **Acciones rápidas** (sin abrir diálogo): cambio de estado (Select existente), editar,
   adjuntar/reemplazar documento, **imprimir** (ver más abajo).
6. **“Ver documento original”** (solo si `file_url`): panel descrito en B.

**Vista de presentación vs. edición:** el diseño propuesto es una **vista de presentación**
(el pedido “de cara al cliente”), no reemplaza el diálogo de edición. El botón “Editar”
abre el diálogo actual (sin regresión). Esto separa “presentar” de “editar” y evita tocar
la lógica de guardado.

**¿PDF descargable/imprimible?** — dos opciones, **pendiente de confirmar al usuario**:
- **(D-pantalla)** Solo mejora de pantalla + botón “Imprimir” nativo del navegador con una
  hoja de estilos `@media print` que aísle la vista corporativa (logo, tabla, totales).
  Mínimo coste, cero funciones backend nuevas, suficiente para “mostrar en obra”.
- **(D-pdf)** PDF generado server-side (`exportarPedidoPDF`) reutilizando
  `drawSimantecLogoPdf` + el patrón de `exportarCicloContabilidad`, con el documento original
  embebido como página anexa. Más coste, pero entrega un PDF archivable/reenviable.

**Recomendación:** empezar por **D-pantalla** (imprimible con CSS) y, si el cliente quiere
archivarlo/reenviarlo como PDF, añadir **D-pdf** como tarea continuación. No mezclar ambas
en esta tarea.

---

## E. Pedidos dados de alta manualmente (sin `file_url`)

**Regla:** la sección “Ver documento original” **solo se renderiza si `Order.file_url`
existe**. Para pedidos manuales sin documento, la sección simplemente **no aparece** y la
vista corporativa muestra sólo cabecera + datos + tabla de líneas + notas. Sin aviso ni
estado “sin documento” ruidoso (no aporta nada en obra).

Para pedidos con `file_url` añadido después (edición), la sección aparece automáticamente al
recargar.

---

## Arquitectura propuesta de la implementación (para la siguiente tarea)

**Sin tocar el flujo de extracción.** Cambios mínimos y focados:

1. **Nuevo componente** `src/components/pedidos/PedidoVistaCorporativa.jsx`
   - Recibe `order` + handlers (onEdit, onStatusChange, onAttach).
   - Renderiza cabecera Simantec + datos + tabla de líneas + notas + acciones.
   - Renderiza `<PedidoDocumentoOriginal file_url={order.file_url} items={order.items} />`
     sólo si `file_url`.
   - Badge “Precisión pendiente” usando `evaluarPrecisionPedido` sobre una reconstrucción
     mínima de `datos` (confianza aproximada / campos faltantes) — **opcional, no bloqueante**.
2. **Nuevo componente** `src/components/pedidos/PedidoDocumentoOriginal.jsx`
   - Embebido de imagen/PDF + bloque de `items[]` extraídas.
   - Layout lado a lado en desktop, apilado/toggle en móvil.
3. **Edición mínima de `src/pages/Orders.jsx`**
   - En el bloque expandido (`isExpanded`), sustituir la lista plana actual por
     `<PedidoVistaCorporativa order={order} ... />`. El diálogo de edición queda intacto.
   - O, si se prefiere una vista propia: nueva ruta `/pedidos/:id` con
     `PedidoVistaCorporativa` y el botón “Ver” del card lleva allí. **Recomendado:** empezar
     incrustando en el card expandido (sin nueva ruta) para minimizar cambios.
4. **(Opcional D-pantalla)** `@media print` en `src/index.css` que oculte sidebar/header y
   deje solo `.pedido-print-area`.
5. **(Opcional D-pdf, tarea continuación)** función `exportarPedidoPDF` en
   `base44/functions/` reutilizando `drawSimantecLogoPdf`.

**No se modifica:** `ocrPedidos.js`, esquema `Order` (salvo que se elija A2+ocr_raw, descartado
aquí), ni los flujos de `evaluarPrecisionPedido`/`reprocesarPrecisionPedido`.

---

## Decisiones pendientes que requieren confirmación del usuario

1. **¿PDF descargable (D-pdf) o sólo vista de pantalla imprimible (D-pantalla)?**
   Recomendado: **D-pantalla** primero; D-pdf como continuación si hace falta archivar/reenviar.
2. **¿Vista incrustada en el card expandido o ruta propia `/pedidos/:id`?**
   Recomendado: **incrustada** (mínimo cambio, el “Ver” del card ya expande).
3. **¿Mostrar precios siempre o mantener `showPrices` (sólo admin)?**
   Recomendado: **mantener** `showPrices` actual (no cambiar lógica de permisos en esta tarea).

Una vez confirmadas estas tres, la implementación es directa y de bajo riesgo.