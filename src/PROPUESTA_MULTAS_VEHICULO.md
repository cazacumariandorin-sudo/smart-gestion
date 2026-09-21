# Propuesta técnica — Gestión de multas de parking por vehículo

**Proyecto:** Smart Gestión (Simantec S.L.) · **AppId:** 69de8e23b1cd7ac050397c82
**Fecha:** 2026-09-21 · **Estado:** Propuesta (pendiente de aprobación) · **Alcance:** Análisis + diseño. Sin implementación.

---

## Contexto verificado

Hoy **no existe** ningún concepto de multa en la app:
- `AlertaVehiculo` (entidad más cercana, para ITV / mantenimiento / incidencias) **no** tiene `multa` en su enum `tipo`.
- Ninguna entidad de vehículos permite adjuntar documentos (ni volante, ni justificante).

Hay que construirlo desde cero. Puede apoyarse en el *patrón* de `AlertaVehiculo` (alerta por vehículo, con urgencia, resolución), pero como se argumenta en **A**, no en la misma entidad.

---

## A. Ampliar `AlertaVehiculo` vs. entidad nueva `MultaVehiculo`

### Comparación

| Aspecto | `AlertaVehiculo` ya lo resuelve | Lo que falta para multas |
|---|---|---|
| Vehículo asociado, urgencia, resolución, histórico | ✓ | — |
| Expediente / referencia / autoridad emisora / importe | ✗ | Campos específicos de sanción administrativa |
| **Dos documentos enfrentados** (volante oficial + descargo del técnico) | ✗ | Flujo de disputa con dos partes |
| Motivo alegado por la autoridad **vs.** motivo que el técnico considera que corresponde | ✗ | Comparativa de tipificación |
| Estado de recurso (pagada / recurrida / recurso aceptado / rechazada / anulada) | ✗ | Ciclo de vida propio de una sanción |
| Panel global "multas pendientes de revisar" | ✗ | Querys específicas que no ensucian las alertas de ITV/mantenimiento |
| Posible cruce futuro con `RegistroGasto` (pago como gasto de empresa) | ✗ | Reservar enlace sin acoplarlo a `AlertaVehiculo` |

### Recomendación: **entidad nueva `MultaVehiculo`**

Razones:
1. **Dominio distinto.** Una multa es una sanción administrativa de terceros con un flujo de disputa formal (volante vs. descargo) y un ciclo de recurso. No es una alerta interna de mantenimiento.
2. **No sobrecargar `AlertaVehiculo`** con ~15 campos casi siempre nulos para sus otros tipos (ITV, neumáticos, aceite…), un enum `tipo` mezclado y una máquina de estados que no encaja con "alerta resuelta".
3. **Queries limpias.** El panel global de multas pendientes y el histórico por vehículo son filtros propios; no se cuelan entre las alertas de flota.
4. **Futura evolución.** Si mañana se vincula con Económico (`RegistroGasto` con `origen_pago: medio_empresa`), el enlace vive en `MultaVehiculo` sin tocar `AlertaVehiculo`.

> No se descarta `AlertaVehiculo` para otros avisos; simplemente no se usa para multas.

---

## B. Campos mínimos de `MultaVehiculo`

### Datos de la multa (parte oficial)
| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `vehiculo_id` | string | sí | FK a `Vehiculo` |
| `vehiculo_matricula` | string | sí | Desnormalizado |
| `vehiculo_modelo` | string | no | Desnormalizado |
| `fecha_multa` | date | sí | Fecha de la infracción |
| `fecha_notificacion` | date | no | Fecha en que la empresa recibió el aviso |
| `importe` | number | sí | Cuantía (€) |
| `autoridad` | string | sí | Organismo/empresa que la emite (Ayuntamiento, SER, Euron… ) |
| `numero_expediente` | string | no | Referencia/expediente impreso en el volante |
| `motivo_autoridad` | enum | sí | `no_exhibir_tique`, `exceso_tiempo`, `zona_no_autorizada`, `Estacionamiento_prohibido`, `otro` |
| `motivo_autoridad_detalle` | string | no | Texto libre si `otro` o matiz |
| `volante_url` | string | sí* | URL del documento oficial subido a almacenamiento (*obligatorio al alta si lo tiene quien la crea; ver C) |
| `volante_subido_por` | string | no | Email de quien sube el volante |
| `volante_fecha_subida` | date-time | no | Timestamp |

### Descargo del técnico (parte del operario)
| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| `descargo_presenta` | boolean | no (default false) | True si el técnico ha presentado justificante |
| `descargo_tecnico_id` | string | no | ID del operario que presenta el descargo |
| `descargo_tecnico_name` | string | no | Nombre (desnormalizado) |
| `descargo_tecnico_email` | string | no | Email (para RLS por usuario) |
| `descargo_fecha_subida` | date-time | no | Timestamp |
| `descargo_justificante_url` | string | no | Foto del tique válido / parquímetro / evidencia |
| `descargo_explicacion` | string | no | Texto: por qué no corresponde o qué infracción correspondería |
| `descargo_motivo_correspondiente` | enum | no | Lo que el técnico cree que aplicaría: `no_exhibir_tique`, `exceso_tiempo`, `zona_no_autorizada`, `sin_infraccion`, `otro` |

### Gestión / resolución
| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `estado` | enum | `pendiente_revision` | `pendiente_revision` → `en_disputa` → `recurrida` → (`recurso_aceptado` \| `recurso_rechazado`) \| `pagada` \| `anulada` |
| `notas_resolucion` | string | — | Notas internas de gerencia/administración |
| `resuelto_por` | string | — | Email de quien resuelve |
| `fecha_resolucion` | date-time | — | Timestamp |
| `historial` | array | [] | `[{ fecha, usuario_email, accion, estado_anterior, estado_nuevo, nota }]` — auditoría de cambios |
| `registro_gasto_id` | string | — | **RESERVADO** (futuro cruce con Económico). Ver D. |
| `activo` | boolean | true | Archivado (sólo visible para gerencia/admin con toggle) |

### Máquina de estados
```
pendiente_revision ──(técnico añade descargo)──> en_disputa
pendiente_revision ──(sin descargo, se paga)──> pagada
en_disputa ──(se presenta recurso)──> recurrida
recurrida ──(fallo favorable)──> recurso_aceptado (→ suele implicar anulación)
recurrida ──(fallo desfavorable)──> recurso_rechazado (→ pagada)
cualquiera ──(gerencia anula)──> anulada
```

---

## C. ¿Quién sube cada parte?

| Documento | ¿Quién puede subirlo? | Justificación |
|---|---|---|
| **Volante oficial** | Gerencia / administración **y** el técnico/operario que recibe la multa | El volante a menudo lo encuentra el técnico en el parabrisas; a veces llega a la empresa por correo. Interesa registrar lo antes posible, así que se permite a ambos. Gerencia/admin puede corregirlo después. |
| **Descargo del técnico** | El técnico/operario correspondiente | Es su descargo; lo sube él desde la ficha de la multa. Gerencia/administración puede editar/clarificar, pero el origen es el técnico. |

**Regla operativa propuesta:** cualquier técnico/operario puede añadir el descargo a una multa mientras `estado ∈ {pendiente_revision, en_disputa}`. Una vez resuelta, el descargo queda bloqueado y sólo gerencia/administración puede tocarlo. Esto evita el bloqueo "chicken-and-egg" de tener que pre-asignar el técnico antes de crear la multa.

> No se verifica de forma estricta que el técnico que sube el descargo sea el que conducía ese día (no hay un parte de conducción por multa). Es una mejora futura posible si se quiere acotar más; por ahora basta con registrar quién lo sube (`descargo_tecnico_email`).

---

## D. ¿Vincular con `RegistroGasto` / Económico en esta fase?

**Recomendación: fuera de alcance ahora.** Razones:
- La multa pagada es un gasto de empresa (`origen_pago: medio_empresa`), pero crear automáticamente un `RegistroGasto` mezcla dos tareas y dos ciclos (el ciclo de gastos 26→25 / mes natural y la gestión de sanciones con recurso).
- El cruce puede generar duplicados si gerencia ya la imputa por otra vía.

**Decisión:** se **reserva** el campo `registro_gasto_id` en `MultaVehiculo` (vacío por defecto). Como **mejora futura** se propone un botón "Generar gasto de empresa" que cree un `RegistroGasto` con `origen_pago: medio_empresa`, `categoria: otros`, importe de la multa y enlace bidireccional — pero sólo cuando gerencia lo decida, no automático.

---

## E. RLS deseada

Mismo criterio que el resto de Flota: **lectura amplia, escritura/resolución restringida**.

```jsonc
"rls": {
  "create": {},   // cualquier usuario autenticado puede dar de alta una multa (el técnico la puede encontrar en el parabrisas)
  "read":   {},   // lectura amplia: cualquier técnico ve el historial de multas del vehículo que usa
  "update": {
    "$or": [
      { "user_condition": { "role": "admin" } },
      { "user_condition": { "role": "propietario" } },
      { "user_condition": { "role": "gerencia" } },
      { "user_condition": { "role": "administracion" } },
      { "$and": [
          { "$or": [
              { "user_condition": { "role": "técnico" } },
              { "user_condition": { "role": "operario" } }
          ]},
          { "data.estado": { "$in": ["pendiente_revision", "en_disputa"] } }
      ]}
    ]
  },
  "delete": {
    "$or": [
      { "user_condition": { "role": "admin" } },
      { "user_condition": { "role": "propietario" } },
      { "user_condition": { "role": "gerencia" } }
    ]
  }
}
```

**Nota de seguridad (compromiso aceptado):** RLS es por registro, no por campo. Con la regla anterior, un técnico podría *técnicamente* escribir campos de la parte oficial (importe, volante) mientras la multa esté en `pendiente_revision`/`en_disputa`. Se mitiga en la **UI**: el formulario del técnico sólo expone los campos de descargo; el guardado de campos oficiales se hace vía un formulario distinto reservado a gerencia/administración. Es el mismo patrón ya usado en `RegistroGasto` y `ParteDiarioObra`. Si se quisiera aislamiento total por campo, habría que separar el descargo en una sub-entidad (ver "Alternativa" abajo) — no se recomienda por el requisito explícito de "todo en la misma ficha sin registro aparte".

---

## Esquema final propuesto (`MultaVehiculo`)

Resumen del esquema (lo que se crearía en `base44/entities/MultaVehiculo.jsonc`):

- **Claves:** `vehiculo_id` (req), `fecha_multa` (req), `importe` (req), `autoridad` (req), `motivo_autoridad` (req), `estado` (default `pendiente_revision`).
- **Volante:** `volante_url`, `volante_subido_por`, `volante_fecha_subida`.
- **Descargo:** `descargo_presenta`, `descargo_tecnico_id/name/email`, `descargo_fecha_subida`, `descargo_justificante_url`, `descargo_explicacion`, `descargo_motivo_correspondiente`.
- **Resolución:** `notas_resolucion`, `resuelto_por`, `fecha_resolucion`, `historial[]`.
- **Futuro:** `registro_gasto_id` (reservado).
- **Archivo:** `activo` (default true).
- **RLS:** ver apartado E.

> Alternativa considerada y descartada: sub-entidad `MultaDescargo` (1:1 con `MultaVehiculo`) para aislar por RLS el descargo del técnico. Descartada porque el usuario pide explícitamente ambos documentos en la misma ficha "sin crear un registro aparte"; el aislamiento por campo se resuelve en UI.

---

## Diseño de la ficha de multa (UX)

### Estructura de la ficha (`MultaDetalleDialog` o página `/flota/multa/:id`)

```
┌─ Cabecera ─────────────────────────────────────────────┐
│ Matrícula · Modelo · Fecha · Importe · Estado (badge)  │
│ Expediente · Autoridad                                  │
└─────────────────────────────────────────────────────────┘

┌─ Documentos enfrentados (desktop: 2 columnas; móvil: pestañas) ─┐
│                                                                 │
│  ┌─ Volante oficial ──────────┐   ┌─ Descargo del técnico ────┐  │
│  │ [visor PDF/imagen]          │   │ [visor imagen]             │  │
│  │ Motivo autoridad: X         │   │ Técnico: Nombre            │  │
│  │ Detalle: …                  │   │ Fecha: …                   │  │
│  │ Subido por: email · fecha   │   │ Motivo que correspondería: │  │
│  │                             │   │ Explicación: …             │  │
│  │ [Subir/Reemplazar volante]* │   │ [Añadir/Editar descargo]†  │  │
│  └─────────────────────────────┘   └────────────────────────────┘  │
│                                                                 │
│  * sólo gerencia/administración                                  │
│  † técnico (mientras estado ∈ pendiente/en_disputa) o gerencia   │
└─────────────────────────────────────────────────────────────────┘

┌─ Resolución (sólo gerencia/administración) ──────────────────────┐
│ Estado: [pagada][recurrida][anulada][recurso_aceptado][rechazado]│
│ Notas de resolución: [textarea]                                  │
│ [Guardar resolución]                                             │
└──────────────────────────────────────────────────────────────────┘

┌─ Historial de cambios ──────────────────────────────────────────┐
│ 2026-09-21 10:30 — gerencia@… : pendiente_revision → en_disputa  │
│ 2026-09-21 10:35 — tecnico@… : añadió descargo                  │
│ 2026-09-25 09:00 — admin@… : en_disputa → recurrida               │
│ 2026-10-02 12:00 — admin@… : recurrida → recurso_rechazado → pagada│
└──────────────────────────────────────────────────────────────────┘
```

### Reglas de la ficha
- **Ambos motivos visibles a la vez**: en desktop, columnas paralelas; en móvil, pestañas `Volante | Descargo | Resolución | Historial` con un resumen del motivo de cada parte en la cabecera de cada pestaña para que no se pierda el contraste.
- **Subida de archivos**: reutilizar el patrón `subirArchivoConFallback` (CDN público accesible para el visor + integridad en Drive) ya usado en gastos y materiales.
- **Acciones por rol**: el botón "Guardar resolución" y los cambios de estado sólo se muestran a `admin/propietario/gerencia/administracion`. El botón "Añadir descargo" se muestra a técnicos/operarios y a gerencia; se bloquea cuando la multa está resuelta (excepto para gerencia).
- **Historial** se alimenta en cada cambio de estado o subida (append al array `historial` con `usuario_email`, `accion`, `estado_anterior`, `estado_nuevo`, `nota`).

---

## Listados / paneles

1. **Historial por vehículo** — en la ficha del vehículo (Flota), pestaña "Multas" con la lista cronológica de `MultaVehiculo` de ese `vehiculo_id`, badge de estado e importe; click abre la ficha.
2. **Panel global de multas pendientes** — vista nueva accesible para gerencia/administración (dentro de Flota o como sub-ruta) con:
   - Filtros: `estado` (pendiente_revision, en_disputa, recurrida), `vehiculo`, rango de fechas.
   - Columnas: matrícula, fecha, importe, autoridad, motivo autoridad, ¿descargo? (sí/no), estado.
   - Acceso directo a la ficha de cada multa.
   - Contador de pendientes de revisar en la cabecera para que no haya que entrar vehículo por vehículo.

---

## Pendiente de confirmación (gerencia/administración)

- **C**: confirmar que el técnico puede dar de alta la multa + volante (no sólo gerencia).
- **C**: confirmar que cualquier técnico/operario puede añadir el descargo (no sólo un técnico pre-asignado).
- **D**: confirmar que el cruce con Económico queda fuera de esta fase (sólo campo reservado).
- **E**: confirmar la regla de escritura (técnico edita sólo mientras no esté resuelta) y el compromiso de aislamiento por campo vía UI.

Una vez aprobado, el entregable de implementación sería:
1. `base44/entities/MultaVehiculo.jsonc` (esquema + RLS).
2. Componentes: `MultaFormDialog` (alta), `MultaDetalleDialog` (ficha con volante+descargo), `MultaResolucionPanel`, `MultasPorVehiculoPanel`, `MultasPendientesPanel`.
3. Integración en `Flota.jsx` (pestaña por vehículo) + acceso al panel global.
4. Subida de archivos con `subirArchivoConFallback`.