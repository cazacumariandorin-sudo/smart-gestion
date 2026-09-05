# Propuesta técnica — Módulo de Adelantos (gastos y dieta) integrado en el ciclo de Notas de Gastos

**Proyecto:** Smart Gestión (appId `69de8e23b1cd7ac050397c82`) — Simantec S.L.
**Fecha:** 2026-09-05
**Estado:** Análisis + propuesta (pendiente de aprobación de gerencia/administración). **Sin implementación.**

---

## 0. Resumen ejecutivo

Hoy el sistema **solo modela reembolso a posteriori**: el técnico ya pagó de su bolsillo y lo reclama vía `RegistroGasto`. El concepto de **adelanto** (dinero entregado ANTES de gastar) existe de forma **implícita y parcial** dentro de `AdelantoParcialCiclo` (el "Adelanto de liquidez" de `AdelantoParcialDialog.jsx`), pero:

- No es una entidad de primera clase: vive dentro de un diálogo atado a un ciclo ya creado.
- Mezcla dos semánticas distintas: *informe parcial* (reembolso anticipado de gastos **ya justificados**, atado a `registros_ids`) y *adelanto de liquidez* (dinero entregado **antes**, sin registros atados).
- No tiene `tipo` (gastos/dieta), ni `obra`, ni campos reservados para dietas.
- No tiene vista de gestión propia ni entrada en el Dashboard Económico.
- La RLS no distingue por tipo.

**Decisión de diseño recomendada:** crear una entidad **nueva `Adelanto`** (no ampliar `AdelantoParcialCiclo`), porque los dos conceptos son ortogonales: el *informe parcial* reembolsa gastos ya existentes; el *adelanto* entrega dinero antes de que exista gasto alguno. Mezclarlos genera confusión semántica, campos vacíos y RLS por tipo más frágil. `AdelantoParcialCiclo` se deja como está (informes parciales); la migración de los "adelantos de liquidez" ya existentes a `Adelanto` se valora como paso posterior, fuera de esta tarea.

---

## A. Ciclo de vida actual de `NotaMensualGasto`

| Fase | Dónde | Qué hace |
|---|---|---|
| **Apertura** (día 26 del mes anterior) | backend `abrirCicloGasto` | Crea `NotaMensualGasto` en estado `borrador` con `fecha_apertura` |
| **Registro de gastos** | cliente `NotasGastos.jsx` | El técnico crea `RegistroGasto` con `ciclo_mes`/`nota_mensual_id` denormalizados |
| **Cierre consolidación** | backend `cerrarCicloGastosMensual` | Filtra registros `borrador`/`pendiente` del mes, los agrupa por operario, crea/actualiza `NotaMensualGasto` → estado `enviada`, calcula `total_importe` y `saldo_pendiente` |
| **Cierre a pagada** | cliente `CicloCard.recalcYCerrar` | Recalcula `total_importe` desde `RegistroGasto`, suma `AdelantoParcialCiclo` pagadas → `importe_adelanto`, `saldo_pendiente = total - adelanto`, estado `pagada` |
| **Export a contabilidad** | backend `exportarCicloContabilidad` | Genera PDF índice (resumen por categoría + datos del ciclo + tabla detalle), sube a Drive, estado `en_contabilidad` |

### Punto exacto donde restar los adelantos
Hay **dos** puntos que ya restan adelantos hoy, y que habría que actualizar:

1. **`CicloCard.recalcYCerrar` (cliente)** — ya resta `AdelantoParcialCiclo` pagadas. Habrá que sumar también los `Adelanto` de tipo `gastos` entregados del mismo ciclo/operario.
2. **`exportarCicloContabilidad` (backend, PDF)** — ya muestra `importe_adelanto` y `saldo_pendiente` en "Datos del ciclo", pero **no desglosa** los adelantos individuales. Habrá que añadir la sección "Adelantos recibidos en el periodo".

> **Nota:** el backend `cerrarCicloGastosMensual` **no** resta adelantos (solo consolida `total_importe`); la resta hoy ocurre solo en el cliente al cerrar a `pagada`. Recomendable mover esa lógica al backend en la implementación para que el cierre automático (programado) también descuente adelantos.

---

## B. Esquema propuesto de la entidad `Adelanto`

Entidad **nueva**. Campos mínimos + reservados para el futuro módulo Dietas:

```jsonc
{
  "name": "Adelanto",
  "type": "object",
  "properties": {
    "operario_id":            { "type": "string", "description": "ID del operario destinatario" },
    "operario_name":          { "type": "string", "description": "Nombre (desnormalizado)" },
    "operario_email":         { "type": "string", "description": "Email del usuario vinculado (denormalizado para RLS y filtros)" },

    "tipo":                   { "type": "string", "enum": ["gastos", "dieta"], "description": "Adelanto de gastos (gasolina, material, peajes...) o adelanto de dieta (anticipo de viáticos)" },
    "importe":                { "type": "number", "description": "Importe entregado al técnico" },
    "fecha_entrega":          { "type": "string", "format": "date", "description": "Fecha real de entrega del dinero al técnico" },
    "concepto":               { "type": "string", "description": "Motivo / concepto del adelanto" },

    "obra_id":                { "type": "string", "description": "Obra asociada (opcional)" },
    "obra_name":              { "type": "string" },
    "obra_tipo":              { "type": "string", "enum": ["obra_civil", "solar", "oficina", "almacen", "otro"] },

    "autorizado_por":         { "type": "string", "description": "Email de gerencia/admin que autoriza el adelanto" },
    "fecha_autorizacion":     { "type": "string", "format": "date-time" },
    "entregado_por":          { "type": "string", "description": "Email de quien entrega/marca el dinero como entregado" },
    "fecha_entrega_real":     { "type": "string", "format": "date-time", "description": "Timestamp ISO de la entrega efectiva" },
    "metodo_pago":            { "type": "string", "enum": ["transferencia", "efectivo", "tarjeta_empresa", "sepa"] },

    "estado":                 { "type": "string", "enum": ["pendiente_entrega", "entregado", "justificado", "parcialmente_justificado", "pendiente_devolucion", "anulado"], "default": "pendiente_entrega", "description": "pendiente_entrega → entregado → justificado/parcialmente_justificado/pendiente_devolucion" },

    "justificacion_importe":  { "type": "number", "default": 0, "description": "Suma de RegistroGasto del mismo ciclo ya cruzados contra este adelanto" },
    "justificacion_ids":       { "type": "array", "items": { "type": "string" }, "description": "IDs de RegistroGasto usados para justificar este adelanto" },
    "saldo_adelanto":          { "type": "number", "description": "importe − justificacion_importe (lo que queda por justificar o devolver)" },

    "ciclo_mes":               { "type": "string", "description": "Clave mes YYYY-MM del ciclo al que se imputa (denormalizada)" },
    "nota_mensual_id":         { "type": "string", "description": "ID de NotaMensualGasto. Puede estar vacío si el ciclo aún no existe (entrega antes del día 26)." },

    "dieta_tipo":              { "type": "string", "description": "RESERVADO futuro módulo Dietas: nacional/internacional/media_dieta/dieta_completa" },
    "dieta_detalle":           { "type": "object", "additionalProperties": true, "description": "RESERVADO futuro módulo Dietas: JSON abierto (días, tarifas, trayectos, km, justificación específica...)" },

    "notas":                   { "type": "string" }
  },
  "required": ["operario_id", "tipo", "importe", "fecha_entrega", "concepto"]
}
```

### Campos reservados para el futuro módulo Dietas
`dieta_tipo` y `dieta_detalle` (JSON abierto) se incluyen **ya** para que el módulo Dietas pueda construirse sobre `Adelanto` sin remodelar la entidad. En esta fase **no se implementan** tarifas, cálculo de días ni justificación específica de dieta: el adelanto de dieta se registra solo con `importe`, `fecha_entrega`, `concepto` y el hueco `dieta_detalle` vacío.

### Por qué no ampliar `AdelantoParcialCiclo`
- `AdelantoParcialCiclo` exige `nota_mensual_id` required (un adelanto puede crearse antes de que exista el ciclo).
- Su campo `registros_ids` no aplica a un adelanto puro (no hay gastos que reembolsar aún).
- No tiene `tipo`, ni `obra`, ni `autorizado_por`/`entregado_por` separados, ni campos de dieta.
- Mezclar generaría campos siempre vacíos y RLS por tipo más compleja.

---

## C. RLS diferenciada por tipo

**Base44 RLS sí permite condicionar por valor de campo** (`data.<field>`), no solo por rol. Ya se usa en `AlertaVehiculo` (filtra `data.tipo` repostaje) y `RegistroGasto` (filtra `data.estado`). Por tanto una sola entidad `Adelanto` puede tener RLS que distinga `data.tipo`.

### Política recomendada

| Operación | `tipo: gastos` | `tipo: dieta` |
|---|---|---|
| **create** | gerencia, admin, propietario, director_comercial | **gerencia, admin, propietario únicamente** |
| **read** | gerencia/admin/propietario/director_comercial + **el propio operario** (`data.operario_email == user.email`) | **gerencia, admin, propietario únicamente** — el técnico NO ve sus adelantos de dieta en esta fase |
| **update** | gerencia, admin, propietario, director_comercial | **gerencia, admin, propietario únicamente** |
| **delete** | admin, propietario | **admin, propietario únicamente** |

### Reglas RLS concretas

```jsonc
"rls": {
  "create": {
    "$or": [
      { "user_condition": { "role": "admin" } },
      { "user_condition": { "role": "propietario" } },
      { "user_condition": { "role": "gerencia" } },
      { "$and": [ { "user_condition": { "role": "director_comercial" } }, { "data.tipo": "gastos" } ] }
    ]
  },
  "read": {
    "$or": [
      { "user_condition": { "role": "admin" } },
      { "user_condition": { "role": "propietario" } },
      { "user_condition": { "role": "gerencia" } },
      { "$and": [ { "user_condition": { "role": "director_comercial" } }, { "data.tipo": "gastos" } ] },
      { "$and": [ { "data.operario_email": "{{user.email}}" }, { "data.tipo": "gastos" } ] }
    ]
  },
  "update": {
    "$or": [
      { "user_condition": { "role": "admin" } },
      { "user_condition": { "role": "propietario" } },
      { "user_condition": { "role": "gerencia" } },
      { "$and": [ { "user_condition": { "role": "director_comercial" } }, { "data.tipo": "gastos" } ] }
    ]
  },
  "delete": {
    "$or": [
      { "user_condition": { "role": "admin" } },
      { "user_condition": { "role": "propietario" } }
    ]
  }
}
```

### Decisión clave: ¿el técnico puede solicitar su propio adelanto de gastos?
**Recomendación: NO.** Solo gerencia/admin/director_comercial crean, autorizan y entregan el adelanto (evita que un técnico se auto-adjudique dinero). Esto difiere deliberadamente de `RegistroGasto` (donde el técnico crea sus propios gastos). **A confirmar por gerencia.**

### Pregunta abierta: ¿el técnico ve sus adelantos de dieta?
Recomendación: **NO en esta fase** (RLS read de dieta restringida a gerencia/admin). Razón: la gestión de dietas es sensible y su liquidación completa aún no existe; mostrar un adelanto de dieta sin su liquidación genera confusión al técnico. Se reabrirá cuando exista el módulo Dietas. **A confirmar por gerencia.**

---

## D. Algoritmo de conciliación al cierre de ciclo

Se ejecuta al cerrar el ciclo a `pagada` (hoy en `CicloCard.recalcYCerrar`; recomendable migrar a backend).

```
Entrada: nota = NotaMensualGasto (ciclo_mes, operario_id)

1. total_gastos = Σ importe de RegistroGasto
     where nota_mensual_id == nota.id
       AND estado IN ('aprobado_gerencia', 'en_administracion', 'pagada')

2. adelantos_gastos = Adelanto
     where tipo == 'gastos'
       AND ciclo_mes == nota.ciclo_mes
       AND operario_id == nota.operario_id
       AND estado IN ('entregado', 'justificado', 'parcialmente_justificado')

3. total_adelantos_gastos = Σ importe(adelantos_gastos)

4. adelantos_dieta = Adelanto
     where tipo == 'dieta'
       AND ciclo_mes == nota.ciclo_mes
       AND operario_id == nota.operario_id
       AND estado IN ('entregado', 'justificado', 'parcialmente_justificado')

5. total_adelantos_dieta = Σ importe(adelantos_dieta)   // INFORMATIVO, no resta

6. importe_neto_liquidar = total_gastos − total_adelantos_gastos

7. Para cada adelanto_gastos:
     si total_gastos >= importe_adelanto  → estado = 'justificado', saldo_adelanto = 0
     si total_gastos <  importe_adelanto  → estado = 'pendiente_devolucion',
                                            saldo_adelanto = importe_adelanto − total_gastos
     (justificación granular por registro queda para fase posterior)

8. Actualizar NotaMensualGasto:
     total_importe            = total_gastos
     total_adelantos_gastos    = total_adelantos_gastos
     total_adelantos_dieta     = total_adelantos_dieta   // nuevo campo
     importe_adelanto          = total_adelantos_gastos   // retrocompatibilidad
     importe_neto_liquidar     = importe_neto_liquidar    // nuevo campo
     saldo_pendiente          = importe_neto_liquidar     // retrocompatibilidad
```

### Tratamiento de adelantos de dieta en esta fase
- **No se restan** del cálculo de gastos.
- Se **listan informativamente** en el PDF y en la ficha del ciclo, con aviso explícito: *"Liquidación detallada de dietas pendiente del módulo Dietas"*.
- Esto evita bloquear la entrega de un adelanto de dieta hoy sin tener el cálculo completo.

### Estados derivados del cierre
- `importe_neto_liquidar > 0` → la empresa debe al técnico (saldo a pagar).
- `importe_neto_liquidar < 0` → el técnico debe devolver la diferencia (adelantos > gastos); los adelantos implicados pasan a `pendiente_devolucion`.
- `importe_neto_liquidar = 0` → cuadrado.

---

## E. Documento/resumen final de cierre (PDF `exportarCicloContabilidad`)

Se añade una sección nueva entre "Datos del ciclo" y "Detalle de registros":

### Sección: "Adelantos recibidos en el periodo"

| Fecha | Tipo | Motivo | Estado | Importe |
|---|---|---|---|---|
| 2026-08-03 | gastos | Anticipo gasolina | Justificado | 120,00 € |
| 2026-08-15 | gastos | Material obra solar | Parcial | 300,00 € |
| 2026-08-20 | dieta | Anticipo viáticos | Entregado | 150,00 € |

- **Subtotal adelantos de gastos:** 420,00 €
- **Subtotal adelantos de dieta (informativo):** 150,00 €

### Bloque final de liquidación

```
Total gastos justificados ............ X €
− Adelantos de gastos entregados ..... Y €
────────────────────────────────────────
= Importe neto a liquidar .......... (X−Y) €
    (> 0: la empresa abona al técnico)
    (< 0: el técnico devuelve la diferencia)

Adelantos de dieta (informativo) .... Z €
    Liquidación detallada: módulo Dietas (pendiente)
```

### Nuevos campos en `NotaMensualGasto` (extensión retrocompatible)
- `total_adelantos_gastos` (number, default 0)
- `total_adelantos_dieta` (number, default 0)
- `importe_neto_liquidar` (number, default 0)

Se conservan `importe_adelanto` y `saldo_pendiente` existentes como alias de retrocompatibilidad (`importe_adelanto = total_adelantos_gastos`, `saldo_pendiente = importe_neto_liquidar`).

---

## F. Punto de entrada en navegación

### En el Dashboard Económico (`EconomicoDashboard.jsx`)
Añadir una pestaña **"Adelantos"** al `Tabs` existente (hoy: Resumen | Contabilidad analítica):

```
Tabs: [ Resumen ] [ Adelantos ] [ Contabilidad analítica ]
```

- **Visible para:** gerencia, admin, propietario, director_comercial. (El técnico no llega a esta pestaña porque no accede al Dashboard Económico.)
- **Dentro de la pestaña Adelantos**, dos sub-secciones:
  1. **Adelantos de gastos** — visible para gerencia/admin/director_comercial. Listado + formulario de alta + acciones (autorizar, entregar, justificar, anular).
  2. **Adelantos de dieta** — visible **solo** si `isGerencia || isAdmin || isPropietario`. No solo se oculta el sub-tab: el componente **no se renderiza** y **no se lanza la query** de adelantos de dieta si el rol no corresponde. La RLS `read` de dieta bloquea además a nivel de datos, así que incluso un intento directo de consultar `Adelanto` con `tipo=dieta` por un rol no autorizado devuelve vacío.

### Blindaje real (lección aprendida: "ocultar el menú no basta")
1. **RLS a nivel de datos** (sección C): la dieta solo la leen gerencia/admin. Esta es la barrera definitiva.
2. **Guard de componente:** el componente de adelantos de dieta comprueba `isGerencia || isAdmin` antes de renderizar y antes de llamar a `base44.entities.Adelanto.filter({ tipo: 'dieta' })`. Si no, no monta nada.
3. **Ruta:** si se crea una página dedicada `/adelantos`, el `ProtectedRoute` la gatea con `module` y dentro se revalida el rol para la sub-vista de dieta.

### Acceso del técnico a sus adelantos de gastos
Recomendación: añadir una pestaña **"Mis adelantos"** dentro de `NotasGastos.jsx` (vista del técnico), solo lectura, filtrada por `operario_email == user.email` y `tipo == 'gastos'` (la RLS ya garantiza que no verá los de dieta). Así el técnico sabe qué le descontarán al cierre.

---

## G. Plan de implementación (orientativo, tras aprobación)

1. **Crear entidad `Adelanto`** con el esquema y RLS de las secciones B y C.
2. **Extender `NotaMensualGasto`** con `total_adelantos_gastos`, `total_adelantos_dieta`, `importe_neto_liquidar`.
3. **Componente `AdelantosPanel`** (pestaña del Dashboard Económico) + `AdelantoFormDialog` (alta/edición).
4. **Componente `MisAdelantosTab`** en `NotasGastos.jsx` (vista técnica, solo lectura, gastos).
5. **Actualizar `CicloCard.recalcYCerrar`** para sumar `Adelanto` tipo gastos en el cierre.
6. **Actualizar backend `exportarCicloContabilidad`** para añadir la sección "Adelantos recibidos" y el bloque de liquidación final.
7. **(Opcional) Mover la lógica de cierre a un backend** `cerrarCicloConAdelantos` para que el cierre programado automático también descuente adelantos.
8. **(Opcional, fase posterior) Migración** de los "adelantos de liquidez" existentes en `AdelantoParcialCiclo` a `Adelanto` tipo `gastos`.

> **Restricción de plan:** los pasos 5 (parcial) y 6 requieren backend functions (`exportarCicloContabilidad` y, si se hace, el nuevo cierre backend). El plan actual no incluye backend functions; la resta de adelantos en `recalcYCerrar` (cliente) y el listado en el PDF se pueden hacer **sin** modificar el backend existente solo si la generación del bloque de adelantos se hace en cliente (regenerar PDF local) — pero lo limpio es actualizar `exportarCicloContabilidad`, que requiere Builder+. Confirmar disponibilidad antes de la fase de implementación.

---

## H. Decisiones pendientes de aprobación por gerencia/administración

| # | Decisión | Recomendación | Estado |
|---|---|---|---|
| 1 | ¿Entidad nueva `Adelanto` vs ampliar `AdelantoParcialCiclo`? | **Entidad nueva** | Propuesta |
| 2 | ¿El técnico puede solicitar su propio adelanto de gastos? | **No** — solo gerencia/admin/director_comercial | A confirmar |
| 3 | ¿El técnico ve sus adelantos de dieta? | **No** en esta fase | A confirmar |
| 4 | ¿Director_comercial puede crear/autorizar adelantos de gastos? | **Sí** | Propuesta |
| 5 | ¿Mover la lógica de cierre (resta de adelantos) al backend? | **Sí**, para que el cierre automático también descuente | A confirmar (requiere Builder+) |
| 6 | ¿Migrar "adelantos de liquidez" existentes a `Adelanto`? | **No** en esta fase, valorar después | A confirmar |
| 7 | ¿El adelanto de gastos se puede crear antes de que exista el ciclo (día 26)? | **Sí** — `nota_mensual_id` opcional, se imputa al abrirse el ciclo | Propuesta |

---

*Documento generado para revisión de gerencia/administración. Sin cambios de código en esta fase.*