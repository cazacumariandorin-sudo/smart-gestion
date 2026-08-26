# Gestión de Fotos — Análisis + Propuesta técnica (borrado + fix captura en blanco)

> Estado: **APROBACIÓN PENDIENTE de Gerencia**. No implementa nada;
> responde A–H con los hallazgos del código real y propone el diseño.
>
> Alcance: fotos de **obra** (civil y solar). Las fotos de "Partes de Trabajo"
> (`WorkPhoto`) y las fotos de "Mis Gastos"/"Fotos Contabilidad"
> (`RegistroGasto.archivos`) son entidades distintas y **no** se ven.

---

## Punto de partida (auditoría real del código)

Tras leer las fuentes, los cuatro posibles puntos de acceso a "fotos de obra"
 quedan así:

| # | Punto de acceso en la app | Componente React | Entidad que lee/escribe | ¿Tiene botón de borrado hoy? | ¿Tiene captura de cámara hoy? | Subida |
|---|---|---|---|---|---|---|
| 1 | **Documental → Galería** `/galeria-fotos` | `src/pages/GaleriaFotos.jsx` | `FotoProyecto` (`list(-fecha_foto, 200)`) | **NO** — el lightbox solo trae Descargar y Compartir | NO — `<input type=file accept="image/*">` sin `capture` (sube archivo, no dispara cámara) | ❌ **ROTO**: aún llama a `base44.functions.invoke('subirArchivoConFallback')` (función bloqueada por el plan). Nunca sube. |
| 2 | **Obras Civiles → Fotos de la obra** (panel dentro del detalle) | `src/components/obras/ObraFotosPanel.jsx` | `FotoProyecto` (`filter({proyecto_id: obra.id})`) | **SÍ** — `AlertDialog` + `FotoProyecto.delete(id)`, visible para cualquiera con acceso de lectura | SÍ — `<input accept="image/*" capture="environment">` (cámara nativa del SO) + botón "Galería" que quita el `capture` | ✅ Ya usa `subirImagen()` (CDN) — funciona |
| 3 | **Obras Solares → Fotos de la obra** | **NO EXISTE**. `src/pages/solar/SolarObras.jsx` solo gestiona datos + `attached_files` (PDFs/Excel/documentos) + OCR de proyecto técnico. No hay galería de fotos de la obra solar. | — | — | — | — |
| (ap) | Partes de Trabajo / detalle OT | `src/components/workorders/PhotoUploader.jsx` | `WorkPhoto` (entidad distinta, `delete` admin-only) | SÍ, admin | SÍ file input | ✅ ya migrado |
| (ap) | Partes Diarios | `src/components/partediario/ParteFotosInput.jsx` | array `fotos` dentro de `ParteDiarioObra` | SÍ (quita del array) | file input | ✅ ya migrado |

### Conclusiones de la auditoría

- **A — puntos reales:** sólo **dos** puntos de acceso a fotos de OBRA: la
  Galería (`GaleriaFotos.jsx`) y el panel dentro de Obras Civiles
  (`ObraFotosPanel.jsx`). El "tercer punto — Obras Solares" **no existe como
  galería de fotos** hoy; lo que el usuario ve en Obras Solares son documentos
  adjuntos (PDFs), no fotos.
- **B — entidad compartida:** ambos puntos leen/escriben la **misma entidad
  `FotoProyecto`** (mismo almacén). ⇒ el borrado y la unificación **se pueden
  centralizar** en un solo sitio. *Ojo:* la subida de la Galería hoy
  **hardcodea `proyecto_tipo:'obra'`** (línea 145), así que una foto subida
  "para una obra solar" desde la galería queda mal etiquetada — bug menor
  paralelo a resolver.
- **C — componente de cámara:** NINGÚN punto de fotos de obra usa
  `getUserMedia`+`<video>`+`<canvas>`. Ambos usan el **file input nativo con
  `capture="environment"`** del SO. Por tanto el bug "foto en blanco" **NO
  proviene** del componente `DocumentScanner` (que sí es getUserMedia, pero
  se usa en **Alta Materiales OCR**, no en obras). Tres componentes con canvas
  real que sí podrían producir blanco y que conviene revisar como entorno:
  `utils/imageCompressor.js` (WebP vía `canvas.toBlob`), `TicketCapture.jsx`
  (jpeg vía `canvas.toDataURL`, módulo Gastos) y `DocumentScanner.jsx`.

---

## D — Causa exacta del "foto en blanco"

### Caso de fotos de obra (lo que el usuario reporta)

Ruta: `<input accept="image/*" capture="environment">` → OS entrega un `File`
JPG/HEIC → `setPendingFile(file)` + `URL.createObjectURL(file)` → `subirImagen(file)`
sube el `File` crudo al CDN → `FotoProyecto.create`.

**Hipótesis principal (la que mejor encaja con el síntoma):** en WebView
(iOS PWA / Android WebView vieja) el `capture="environment"` puede entregar un
`File` **vacío (0 bytes)** o **con el frame en negro/blanco** si el SO cierra
la cámara antes de haber escrito el frame completo. El `URL.createObjectURL`
incluso renderiza una miniatura neutra en la previsualización. El resultado: la
galería muestra un recuadro blanco (no roto, no 404 — está en blanco).

Hipótesis secundaria (cuando la Galería funcione y reutilice el file input sin
compresión): no aplicable — la Galería hoy no usa `capture`.

**No** se observa carrerra `loadedmetadata`/`canplay` porque no hay `<video>`;

 el "video en blanco" del enunciado real­mente describe el frame del SO, no del
 stream.

### Caso de canvas (Gastos / DocumentScanner)

Si el blanco aparece en el módulo de **Mis Gastos** (`TicketCapture.jsx`) o
 en **Alta Materiales OCR** (`DocumentScanner.jsx`), la causa distinta:
- `canvas.drawImage(img,0,0,w,h)` ejecutado en `img.onload` **sin** comprobar
  `img.naturalWidth > 0`.
- En `DocumentScanner`, `drawImage(video,…)` sin esperar a
  `video.readyState >= 2 && video.videoWidth > 0` (carrera clásica).
- `toDataURL/toBlob` sobre un canvas recién creado sin pintar nada → JPEG/WEBP
  **completamente blanco** uniforme que cumple el mismo síntoma.

### Criterio de validación de "captura en blanco" (común para todos los paths)

Implementar en el punto de captura (antes de guardar/upload):

```js
async function imagenNoVacia(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
    });
    if (img.naturalWidth === 0 || img.naturalHeight === 0) return false;
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 32, 32);
    const { data } = ctx.getImageData(0, 0, 32, 32);
    // Varianza simple: si todos los píxeles son ≈ iguales → blanco/uniforme
    let min = 255, max = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] + data[i+1] + data[i+2]) / 3;
      if (lum < min) min = lum; if (lum > max) max = lum;
    }
    return (max - min) >= 8; // umbral: una foto real tiene contraste
  } finally { URL.revokeObjectURL(url); }
}
```

Si la varianza es <8 → avisar "La foto salió en blanco, reintenta" y no subir.
Si `file.size < 2_000` → idem (archivo 0 o dañado).

## E — ¿Siempre o sólo a veces?

Mientras no haya telemetría confirmada, lo razonable es asumir:

- **No siempre.** Crisis típica en: primera vez tras conceder permiso de
  cámara (iOS Safari a veces entrega primer frame en negro), cámara
  delantera (`user`) en vez de `environment`, y WebView antiguas.
- **Más frecuente en móvil** que en desktop (desktop no usa `capture` y
  siempre sube un archivo ya existente, sin frame recién capturado).
- Por eso el fix debe **validar siempre** la imagen recién capturada con
  `imagenNoVacia()` antes de subirla, con reintento, sea cual sea el
  dispositivo.

## F — Permisos actuales y qué falta

FotoProyecto.rls (entity):

| Op | Roles permitidos |
|---|---|
| create | `created_by` (cualquiera autenticado por sí mismo) |
| read | admin, director_comercial, gerencia, jefe_obra, control_horario, técnico, operario, `created_by` |
| update | admin, director_comercial, gerencia, jefe_obra, `created_by` |
| delete | **admin, gerencia, jefe_obra, `created_by`** ⇒ RLS ya permite borrado a gerencia y admin. |

⇒ **No falta cambiar RLS.** Falta:

1. Añadir el **botón de borrado** en la Galería (hoy inexistente).
2. **Acotar la visibilidad del botón** en los dos puntos a roles
   `gerencia`/`admin` (hoy en `ObraFotosPanel` el botón se muestra a todos
   con acceso de lectura; la API rechaza a un operario no propietario, pero
   mejor no ofrecerlo en UI).
3. Permitir **borrado del propietario** de su propia foto (RLS ya lo permite).
4. `WorkPhoto` (Partes de Trabajo) tiene `delete` **solo admin** → si se
   quiere consistencia total, ampliar a gerencia. **Recomendación: dejarlo
   aparte** (no entra en este desarrollo de fotos de obra).

## G — Borrado físico vs lógico

**Precedentes del proyecto** (ver `prior_compacted_window` y los
`known_issues`): ya ha habido "calendario de previsiones que borraba todo el
periodo", "fuga de datos en ControlHorario", fallos irreversibles que
causaron problemas. La política del proyecto es **preferir lógico+recuperable**
siempre que el coste sea asumible.

**Recomendación: borrado LÓGICO** — añadir a `FotoProyecto`:

```jsonc
"eliminada":      { "type": "boolean", "default": false },
"eliminada_por":  { "type": "string" },
"fecha_eliminacion": { "type": "string", "format": "date-time" }
```

Y:

- Los listados (Galería y `ObraFotosPanel`) filtran `eliminada != true` por
  defecto.
- Toggle "Mostrar eliminadas" sólo para `admin` (auditoría/recuperación), al
  igual que el "mostrar inactivas" ya existente en la Galería.
- Un admin puede **restaurar** (poner `eliminada=false`) y **vaciar papelera**
  (borrado físico, `FotoProyecto.delete`) — el único path irreversible, solo
  admin, explícito.

**Coste:** 2 campos en FotoProyecto + 2 tests de filtro en las queries. Muy
abajo. **Beneficio:** el gerente puede equivocarse al borrar una foto de
"obra equivocada" sin perder evidencia; trazabilidad (`eliminada_por`,
`fecha_eliminacion`).

## H — Reasignar/mover foto de obra

**Recomendación: incluirlo como acción gemela al borrado** en el mismo
desarrollo. Razón: el enunciado dice "subida por error a la obra equivocada"
como uno de los motivos típicos para borrar; si todo lo que se necesita es
moverla (la foto es buena), borrarla y resubirla es desperdicio + genera
foto nueva con metadatos distintos. Un diálogo "Mover a otra obra" es
trivial: `FotoProyecto.update(id, { proyecto_id, proyecto_name,
proyecto_tipo })` + `propagarRenameObra`-lite (sólo el posicionamiento interno
no cambia porque el nombre se reescribe en el campo denormalizado).

Esquema de trazabilidad idéntico al borrado (recomendado):

```jsonc
"reasignada_desde":  { "type": "string", "description": "proyecto_id anterior al último traslado" },
"reasignada_por":    { "type": "string" },
"fecha_reasignacion":{ "type": "string", "format": "date-time" }
```

Si Gerencia lo prefiere, se puede **dejar fuera de alcance** y se hace en
otra tarea. En este doc se deja **opt-in**.

---

## Propuesta técnica

### 1. Componente compartido de borrado/reasignación

Crear **un único** componente reutilizable: `src/components/fotos/FotoGestionDialog.jsx`

Props:
- `foto` — registro FotoProyecto
- `onClose`
- `mode?: 'borrar' | 'reasignar'`
- `obrasDisponibles` — lista de `[{id, name, tipo}]` para el "mover a"

Comportamiento:
- En `borrar: AlertDialog` confirable → `FotoProyecto.update(id, { eliminada:true, eliminada_por, fecha_eliminacion })` (lógico).
- En `reasignar: Select obra destino + confirma → `FotoProyecto.update(id, { proyecto_id, proyecto_name, proyecto_tipo, reasignada_desde: id_anterior, reasignada_por, fecha_reasignacion })`.
- Tras cualquiera de las dos, invalida `['fotos-proyecto']` y el
  `['fotos-obra', idAntiguo]` + `['fotos-obra', idNuevo]`.

Visible sólo cuando `isAdmin || isGerencia || foto.created_by_id === user.id` (util
para permitir al dueño borrar; perfecto el resto). El hook `useUserRole()` ya
existe.

### 2. Botones en los dos puntos reales de acceso

- `GaleriaFotos.jsx`: añadir al lightbox (entre Descargar y X) el botón
  `Trash2` + el `Move` (si se aprueba H) que abre `FotoGestionDialog`.
- `ObraFotosPanel.jsx`: reemplazar el `AlertDialog` actual por el mismo
  `FotoGestionDialog` (modo `borrar`); añadir el botón "Mover" si se aprueba.
  Gating de visibilidad a `gerencia/admin/owner`.
- (Obras solares): si se crea el panel solar de fotos más adelante, reusar
  `ObraFotosPanel` con `proyecto_tipo='solar'`. **No es tarea de este
  desarrollo** salvo que Gerencia pida crearlo.

### 3. Fix de la captura en blanco — en cada path identificado

| Path | Fix concreto |
|---|---|
| **ObraFotosPanel** (`capture=environment`) | Al recibir el `File`: validar con `imagenNoVacia(file)` ( Apartado D ). Si falla: toast "La foto salió en blanco, reintenta" + no subir. Añadir estado "Iniciando cámara…" hasta que `URL.createObjectURL` dé un preview con `naturalWidth>0`. |
| **GaleriaFotos** (cuando se reactive el upload) | Mismo `imagenNoVacia()` antes de `subirImagen()`. + migrar la subida a `subirImagen()` (sustituir el `subirArchivoConFallback` muerto). Etiquetar `proyecto_tipo` correcto (obra/solar) en vez de hardcodear `'obra'`. |
| `utils/imageCompressor.js` | En `img.onload` comprobar `img.naturalWidth>0`; rechazar y devolver el `file` original si el canvas sale uniforme (varianza <8). Previene blanco en cualquier componente que lo use (ParteFotosInput, …). |
| `TicketCapture.jsx` (gastos) | Mismas comprobaciones dentro de `comprimirImagen()` antes del `toDataURL`. **Fuera del alcance de fotos de obra, pero se cita porque comparte raíz.** |
| `DocumentScanner.jsx` (OCR materiales) | El `drawImage(video,…)` ya tiene its own issues; añadir `await waitUntil(v => v.videoWidth>0 && v.readyState>=2)` antes de capturar. **Fuera de alcance de fotos de obra.** |

### 4. Contadores agrupados tras borrado

`GaleriaFotos.jsx` ya invalida `['fotos-proyecto']` tras mutaciones; el contador
"n · foto(s)" viene de `groupedFotos[x].projects[y].items.length` y se
recalcula solo tras el `invalidateQueries`. **Verificar** que `FotoGestionDialog`
invalida las query keys que alimentan los contadores:

- `'fotos-proyecto'` (Galería)
- `'fotos-obra', <viejoId>` y `'fotos-obra', <nuevoId>` (ObraFotosPanel)
- (Opcional) `'obras-activas-map'` no varía; los contadores de cliente→obra se
  recalculan al recargar `obrasMap`.

### 5. Trazabilidad (cumple requisito explícito)

Cada acción (borrar/mover) deja en el registro `eliminada_por` /
`reasignada_por` + timestamps. Permite "quién y cuándo" sin crear entidades
extra. La auditoría navegacional profunda ya la cubre el módulo Vigilancia.

---

## Resumen ejecutivo para Gerencia

1. **Sólo hay dos** puntos de acceso reales a fotos de obra: la **Galería**
   y el panel **dentro de cada obra civil**. Obras solares **no tienen galería
   de fotos** (solo documentos adjuntos) — confirmar con Gerencia si quieren
   crearla, o queda fuera de alcance.
2. Los dos puntos comparten la **misma entidad `FotoProyecto`** →
   **un solo** componente de borrado/mover + **un solo** helper de
   validación de captura. Nada que triplicar.
3. **Borrado:** hoy la Galería **no** tiene botón y el panel de obra sí pero
   mal(acotado). RLS ya permite `gerencia`/`admin`/`jefe_obra`/propietario.
   Proponemos **borrado LÓGICO** (`eliminada`/`eliminada_por`/
   `fecha_eliminacion`) por precedentes de irreversibles en el proyecto,
   con papelera visible sólo para `admin`.
4. **Mover de obra** (alternativa al borrado cuando la foto es buena pero
   subida a obra equivocada): incluido como **opt-in**.
5. **Foto en blanco:** el bug real en fotos de obra está en el `capture=
   environment` del `ObraFotosPanel` que NO valida el frame resultante. Fix:
   helper `imagenNoVacia()` (varianza de píxeles + tamaño mínimo) en cada
   path de captura; el mismo helper se aplica al `imageCompressor` y al
   `TicketCapture` para no dejar duplicados sin corregir.
6. **Sin backend functions necesarias.** Todo cabe en cliente (entidad + UI
   + CDN). No requiere reactivar el plan actual.

### Entregables de implementación (en 3 ficheros nuevos + 2 editados)

- **Nuevos**
  - `src/lib/fotoValidacion.js` — `imagenNoVacia()` + helpers.
  - `src/components/fotos/FotoGestionDialog.jsx` — diálogo borrar/mover.
  - `src/components/fotos/FotoThumbnailActions.jsx` (opcional) — botones
    consistentes para el lightbox de la Galería y de ObraFotosPanel.
- **Editados**
  - `src/components/obras/ObraFotosPanel.jsx` — usar `FotoGestionDialog`
    + `imagenNoVacia()` + gating de botón.
  - `src/pages/GaleriaFotos.jsx` — añadir botón borrar/mover en lightbox +
    usar `subirImagen()` + `imagenNoVacia()` + etiquetar `proyecto_tipo`
    correctamente.
- **Entidad**
  - `base44/entities/FotoProyecto.jsonc` — añadir `eliminada`,
    `eliminada_por`, `fecha_eliminacion` (+ opcionalmente `reasignada_*`).

Pendiente aprobación de Gerencia sobre: **(a)** borrado lógico vs físico;
**(b)** incluir o no el "mover de obra"; **(c)** crear o no galería de
fotos para Obras Solares.