# Estudio — Documentación en Flota: Tarjeta técnica y Permiso de conducir

**Módulo:** Flota & Movilidad / Vehículos · **Fecha:** 2026-09-08 · **Estado:** Estudio (pendiente de aprobación)

## 1. Aclaración previa (importante)

Los dos documentos que se piden **pertenecen a titulares distintos** y conviene separarlos desde el diseño:

| Documento | Titular | Naturaleza | Caducidad |
|---|---|---|---|
| **Tarjeta técnica / ITV** (ficha técnica del vehículo) | El **vehículo** | Documento del vehículo | Sí (ya existe `itv_fecha`) |
| **Permiso de circulación** | El **vehículo** | Documento del vehículo | Sí |
| **Permiso de conducir** | El **conductor** (persona) | Documento del operario asignado | Sí (caduca por categoría) |

Hoy el `Vehiculo` **no tiene campos de documento** (solo fechas de ITV/mantenimiento), y ya existe la entidad `OperarioDoc` (con `file_url`, `expiry_date`, `categoria`, `firma_url`) que es el lugar natural para el **permiso de conducir** del conductor.

> **Recomendación de diseño:** la tarjeta técnica y el permiso de circulación van en `Vehiculo` (son del vehículo); el permiso de conducir va en `OperarioDoc` vinculado al operario asignado (`asignado_id`), y se **visualiza** desde la ficha del vehículo por comodidad, pero **no se duplica** en el vehículo (si no, queda obsoleto al cambiar de conductor).

---

## 2. Propuesta de datos

### 2.1 Campos nuevos en `Vehiculo` (documentos del vehículo)

```jsonc
"doc_tarjeta_tecnica_url":   { "type": "string", "description": "URL de la tarjeta técnica/ITV (PDF o imagen)" },
"doc_tarjeta_tecnica_fecha": { "type": "string", "format": "date", "description": "Fecha de subida del documento" },
"doc_permiso_circulacion_url":   { "type": "string", "description": "URL del permiso de circulación" },
"doc_permiso_circulacion_fecha":{ "type": "string", "format": "date", "description": "Fecha de subida" },
"permiso_circulacion_caducidad":{ "type": "string", "format": "date", "description": "Caducidad del permiso de circulación (para alertas)" }
```
- `itv_fecha` ya existe y cubre la caducidad de la tarjeta técnica (no se duplica).
- Se añaden **2 pares URL+fecha de subida** y **1 caducidad** nueva (permiso de circulación) para reutilizar el motor de alertas ya existente (`alertasVehiculos`).

### 2.2 Permiso de conducir → `OperarioDoc` (ya existe)

Crear el documento con:
```jsonc
{ operario_id, operario_name, tipo: "doc_operario", categoria: "permiso_conducir",
  title: "Permiso de conducir — <conductor>", file_url, expiry_date, date: <subida> }
```
- **No hace falta crear entidad nueva** ni tocar el esquema de `OperarioDoc` (ya soporta `categoria`, `expiry_date`, `file_url`).
- Desde la ficha del vehículo se resuelve el permiso del conductor con `asignado_id` → `OperarioDoc.filter({ operario_id, categoria:'permiso_conducir' })`.

### 2.3 Alternativa simplificada (si se prefiere todo en el vehículo)

Si gerencia quiere máxima simplicidad y acepta que el permiso de conducir se “congela” en el vehículo hasta que se reasigne, se añadiría también a `Vehiculo`:
```jsonc
"doc_permiso_conducir_url":    { "type": "string" },
"doc_permiso_conducir_conductor": { "type": "string", "description": "Nombre del conductor al que pertenece (snapshot)" },
"permiso_conducir_caducidad":  { "type": "string", "format": "date" }
```
> **No recomendado** salvo que la rotación de conductores sea muy baja: el documento quedaría desactualizado al reasignar el vehículo. La opción 2.2 es más correcta.

---

## 3. Subida / bajada de documentos (UI)

- **Almacenamiento:** reutilizar `subirImagen()` (`src/lib/uploadPhoto.js`) → `Core.UploadFile` → devuelve `file_url` pública en CDN. Para PDF, `UploadFile` también los acepta. Si se requiere respaldo en Drive, existe `subirArchivoConFallback` (función backend) pero el plan actual prioriza CDN.
- **Componente de subida:** crear `src/components/flota/VehiculoDocInput.jsx` — input de archivo (imagen/PDF) + vista previa/enlace + botón “Descargar” (abre `file_url` en nueva pestaña) + botón “Reemplazar”. Reutilizable para los 2-3 documentos.
- **Dónde se gestiona:**
  - En el **dialog de editar vehículo** (`Flota.jsx`), nueva sección “📄 Documentación” con `VehiculoDocInput` para tarjeta técnica y permiso de circulación.
  - El **permiso de conducir** se sube desde la ficha del operario (`Tecnicos`/`Operarios` → documentos), pero en el **expandido del `VehiculoCard`** se muestra un enlace “Ver permiso de conducir del conductor” si existe (consulta lazy de `OperarioDoc`), y un aviso si falta o está caducado.
- **Descarga:** enlace `<a href={file_url} target="_blank">` — sin firma, ya que el CDN es público. Si en el futuro se requiere privado, migrar a `UploadPrivateFile` + `CreateFileSignedUrl`.
- **Permisos de edición:** los que ya tiene `Vehiculo.update` (admin, propietario, director_comercial, gerencia, jefe_obra). `operario`/`técnico` solo leen (ya así en RLS). Para el permiso de conducir, `OperarioDoc.create/update` ya permite a `operario` subir el suyo — mantiene la lógica actual.

---

## 4. Alertas de caducidad

- El motor `alertasVehiculos` ya genera avisos para ITV/aceite/filtros/A/C. Ampliarlo para **permiso de circulación** (`permiso_circulacion_caducidad`) con los mismos umbrales (15/5/1 días) — cambio pequeño en la función backend `alertasVehiculos`.
- La **caducidad del permiso de conducir** vive en `OperarioDoc.expiry_date`; si se quiere alerta global de flota, añadir una rama en `alertasVehiculos` que recorra operarios asignados a vehículos con `OperarioDoc.categoria='permiso_conducir'` caducado.

---

## 5. RLS y seguridad

- `Vehiculo` RLS ya restringe create/update a roles gestores y read a toda la flota. Los nuevos campos heredan esa protección: **sin cambios de RLS**.
- `OperarioDoc` RLS ya permite al propio operario leer (`created_by`) y actualizar. **Sin cambios**.
- **No** exponer `file_url` de documentos si se pasa a almacenamiento privado; hoy CDN es público y el acceso se controla por la app.

---

## 6. Plan de implementación (tras aprobación)

| Fase | Alcance | Archivos |
|---|---|---|
| F1 | Esquema: 5 campos nuevos en `Vehiculo` | `base44/entities/Vehiculo.jsonc` |
| F2 | Componente `VehiculoDocInput` (subir/ver/descargar) | `src/components/flota/VehiculoDocInput.jsx` (nuevo) |
| F3 | Sección “Documentación” en dialog de editar + ficha expandida | `src/pages/Flota.jsx` |
| F4 | Vista del permiso de conducir del conductor en `VehiculoCard` | `src/pages/Flota.jsx` (consulta lazy `OperarioDoc`) |
| F5 | Alerta de permiso de circulación en `alertasVehiculos` | `base44/functions/alertasVehiculos/entry.ts` |

---

## 7. Decisiones pendientes

1. **Permiso de conducir:** ¿en `OperarioDoc` (recomendado, normalizado) o denormalizado en `Vehiculo` (simple, pero se desactualiza al reasignar)?
2. **Almacenamiento:** ¿CDN público (`UploadFile`, simple) o privado con URL firmada (`UploadPrivateFile` + `CreateFileSignedUrl`, más seguro)?
3. **Tipos admitidos:** ¿solo imagen/PDF, o también fotos múltiples (anverso/reverso del permiso)?
4. **Alertas:** ¿incluir caducidad de permiso de circulación y de permiso de conducir en el motor de alertas de flota?

*Sin cambios de código aplicados — a la espera de aprobación de gerencia.*