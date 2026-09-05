# Propuesta técnica (v2) — Módulo de Adelantos (gastos y dieta) integrado en el ciclo de Notas de Gastos

**Proyecto:** Smart Gestión (appId `69de8e23b1cd7ac050397c82`) — Simantec S.L.
**Fecha:** 2026-09-05 (v2)
**Estado:** Análisis + propuesta (pendiente de aprobación de gerencia/administración). **Sin implementación.**

---

## Cambios respecto a la v1

- **Sección A corregida:** no existe una entidad separada "AdelantoParcialCiclo" **en uso**. La entidad `AdelantoParcialCiclo` y el componente `AdelantoParcialDialog.jsx` **sí existen en el código** (esquema + componente), pero tienen **0 registros en producción** — son código muerto. El "adelanto por liquidez" real en la operativa de Simantec se hace **editando manualmente `NotaMensualGasto.importe_adelanto`**. Confirmado con dato en producción: `CIC-2026-07-TECNICOIT`, `importe_adelanto: 500 €`, `total_importe: 0`, `registros_ids: []`, estado `borrador`.
- **Sección D corregida:** la migración del patrón manual deja de ser "fase posterior opcional" y pasa a ser parte del alcance — `importe_adelanto` se convierte en campo **calculado**.
- **Nueva Sección I:** política de degradación por plan para todas las funciones del módulo.
- **Decisión #4 cerrada:** el registro histórico de 500€ (julio 2026) **se deja tal cual**, sin tocar.

---

## 0. Resumen ejecutivo

El sistema modela hoy solo reembolso a posteriori vía `RegistroGasto`. El "adelanto por liquidez" que ya se usa puntualmente en la operativa real de Simantec **no es una entidad de primera clase**: es el propio campo `NotaMensualGasto.importe_adelanto`, rellenado manualmente por gerencia cuando un operario acumula gasto que no puede sostener antes de que cierre el ciclo mensual normal (día 25). Confirmado con un caso real en producción: operario "TECNICO IT", ciclo 2026-07, `importe_adelanto: 500 €`, sin gastos enlazados.

> **Nota factual:** la entidad `AdelantoParcialCiclo` y el componente `AdelantoParcialDialog.jsx` **sí existen físicamente** en el códigobase (esquema con RLS, componente con flujo de informes parciales + "adelanto de liquidez"), pero **tienen 0 registros en producción** y **no están integrados en el flujo operativo real**. Son código muerto que se podría limpiar o reutilizar en una fase posterior. **No se confunden con el patrón manual de `importe_adelanto`**, que es lo que gerencia usa hoy de facto.

**Decisión de diseño confirmada:** crear una entidad **nueva `Adelanto`** (no reutilizar `AdelantoParcialCiclo` — su semántica mezcla informes parciales atados a `registros_ids` con liquidez, y está sin usar), con dos tipos (`gastos` / `dieta`), y **sustituir progresivamente** el uso manual de `NotaMensualGasto.importe_adelanto` por un campo **calculado** a partir de los `Adelanto` de tipo `gastos` vinculados a ese ciclo. El registro histórico de julio 2026 (500€) **se deja tal cual, como histórico**, para que gerencia lo revise y decida manualmente si lo reclasifica — no se migra automáticamente.

---

## A. Cómo funciona hoy realmente el "adelanto por liquidez"

No existe un flujo de adelanto de primera clase en uso. Lo que existe es un **patrón de uso manual** del ciclo mensual ya existente:

| Paso | Qué ocurre | Dónde |
|---|---|---|
| 1 | Un operario acumula gastos en un mes que no puede sostener de su bolsillo antes del cierre normal (día 25) | Operativa de campo |
| 2 | Gerencia/administración crea o actualiza el `NotaMensualGasto` de ese mes/operario **antes de que estén todos los `RegistroGasto` cargados**, rellenando `importe_adelanto` con el dinero entregado | Manual, directamente sobre la entidad |
| 3 | `registros_ids` puede quedar vacío o parcial en ese momento — se completa más adelante conforme se justifican gastos | Ciclo normal de `RegistroGasto` |
| 4 | Al cierre real del ciclo, `recalcYCerrar` (`CicloCard.jsx`) recalcula `total_importe` desde `RegistroGasto`, y reescribe `importe_adelanto` con la suma de `AdelantoParcialCiclo` pagadas (que hoy son 0) | Cliente |

### Dato confirmado en producción
- **Registro:** `CIC-2026-07-TECNICOIT`
- `importe_adelanto: 500 €`, `total_importe: 0 €`, `registros_ids: []`, `estado: borrador`
- **24 ciclos** en producción; **solo 1** tiene `importe_adelanto > 0` (este).
- **0 registros** en `AdelantoParcialCiclo` en producción.

**Consecuencia para el diseño:** cada `NotaMensualGasto` es único por (operario, mes). El "adelanto" hoy reutiliza el mismo ciclo del mes, anticipando el campo `importe_adelanto` antes de que estén todos los gastos. La nueva entidad `Adelanto` debe poder representar exactamente esto: un adelanto de tipo `gastos` con `nota_mensual_id` que puede apuntar a un ciclo ya abierto pero aún incompleto (`registros_ids` parcial o vacío), sin necesidad de crear ningún ciclo nuevo.

---

## B. Esquema de la entidad `Adelanto` (sin cambios respecto a v1)

```jsonc
{
  "name": "Adelanto",
  "type": "object",
  "properties": {
    "operario_id":            { "type": "string" },
    "operario_name":          { "type": "string" },
    "operario_email":         { "type": "string", "description": "Email del usuario vinculado (denormalizado para RLS y filtros)" },

    "tipo":                   { "type": "string", "enum": ["gastos", "dieta"], "description": "Adelanto de gastos (gasolina, material, peajes...) o adelanto de dieta (anticipo de viáticos)" },
    "importe":                { "type": "number" },
    "fecha_entrega":          { "type": "string", "format": "date" },
    "concepto":               { "type": "string" },

    "obra_id":                { "type": "string" },
    "obra_name":              { "type": "string" },
    "obra_tipo":              { "type": "string", "enum": ["obra_civil", "solar", "oficina", "almacen", "otro"] },

    "autorizado_por":         { "type": "string", "description": "Email de gerencia/admin que autoriza" },
    "fecha_autorizacion":     { "type": "string", "format": "date-time" },
    "entregado_por":          { "type": "string", "description": "Email de quien entrega/marca el dinero como entregado" },
    "fecha_entrega_real":     { "type": "string", "format": "date-time" },
    "metodo_pago":            { "type": "string", "enum": ["transferencia", "efectivo", "tarjeta_empresa", "sepa"] },

    "estado":                 { "type": "string", "enum": ["pendiente_entrega", "entregado", "justificado", "parcialmente_justificado", "pendiente_devolucion", "anulado"], "default": "pendiente_entrega" },

    "justificacion_importe":  { "type": "number", "default": 0 },
    "justificacion_ids":      { "type": "array", "items": { "type": "string" } },
    "saldo_adelanto":         { "type": "number", "description": "importe − justificacion_importe" },

    "ciclo_mes":              { "type": "string" },
    "nota_mensual_id":        { "type": "string", "description": "Puede apuntar a un ciclo ya abierto pero incompleto (adelanto anticipado por liquidez) o quedar vacío si el ciclo aún no existe" },

    "dieta_tipo":             { "type": "string", "description": "RESERVADO futuro módulo Dietas" },
    "dieta_detalle":          { "type": "object", "additionalProperties": true, "description": "RESERVADO futuro módulo Dietas: JSON abierto" },

    "notas":                  { "type": "string" }
  },
  "required": ["operario_id", "tipo", "importe", "fecha_entrega", "concepto"]
}
```

---

## C. RLS diferenciada por tipo (sin cambios respecto a v1)

| Operación | `tipo: gastos` | `tipo: dieta` |
|---|---|---|
| **create** | gerencia, admin, propietario, director_comercial | **gerencia, admin, propietario únicamente** |
| **read** | gerencia/admin/propietario/director_comercial + **el propio operario** | **gerencia, admin, propietario únicamente** — el técnico NO ve sus adelantos de dieta |
| **update** | gerencia, admin, propietario, director_comercial | **gerencia, admin, propietario únicamente** |
| **delete** | admin, propietario | **admin, propietario únicamente** |

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
    "$or": [ { "user_condition": { "role": "admin" } }, { "user_condition": { "role": "propietario" } } ]
  }
}
```

### Cambio de política respecto a v1: `importe_adelanto` deja de ser editable a mano
A partir de la implementación de `Adelanto`, **`NotaMensualGasto.importe_adelanto` pasa a ser un campo calculado** (paso 8 del algoritmo D), no editable manualmente. Cualquier adelanto por liquidez futuro se registra creando un `Adelanto` tipo `gastos` (con `nota_mensual_id` del ciclo en curso, aunque esté incompleto) — nunca escribiendo directamente sobre `NotaMensualGasto.importe_adelanto`.

### Tratamiento del registro histórico (500€, julio 2026)
**Se deja como está, sin tocar.** No se migra automáticamente a un `Adelanto`, no se recalcula, no se reclasifica en esta tarea. Queda marcado como caso histórico anterior a la existencia de `Adelanto`, pendiente de que gerencia lo revise manualmente. La lógica de conciliación (Sección D) debe ser **tolerante** a que ese ciclo concreto tenga `importe_adelanto` histórico sin `Adelanto` asociado: simplemente no se recalculará automáticamente hasta que gerencia actúe sobre él (se marcará con un flag `es_historico_adelanto` o se excluirá del recálculo automático).

---

## D. Algoritmo de conciliación al cierre de ciclo (actualizado)

```
Entrada: nota = NotaMensualGasto (ciclo_mes, operario_id)

1. total_gastos = Σ importe de RegistroGasto
     where nota_mensual_id == nota.id
       AND estado IN ('aprobado_gerencia', 'en_administracion', 'pagada')

2. adelantos_gastos = Adelanto
     where tipo == 'gastos'
       AND (nota_mensual_id == nota.id
            OR (ciclo_mes == nota.ciclo_mes AND operario_id == nota.operario_id))
       AND estado IN ('entregado', 'justificado', 'parcialmente_justificado')

3. total_adelantos_gastos = Σ importe(adelantos_gastos)

4. adelantos_dieta = Adelanto
     where tipo == 'dieta'
       AND (nota_mensual_id == nota.id
            OR (ciclo_mes == nota.ciclo_mes AND operario_id == nota.operario_id))
       AND estado IN ('entregado', 'justificado', 'parcialmente_justificado')

5. total_adelantos_dieta = Σ importe(adelantos_dieta)   // INFORMATIVO, no resta

6. importe_neto_liquidar = total_gastos − total_adelantos_gastos

7. Para cada adelanto_gastos:
     si total_gastos >= importe_adelanto  → estado = 'justificado', saldo_adelanto = 0
     si total_gastos <  importe_adelanto  → estado = 'pendiente_devolucion',
                                            saldo_adelanto = importe_adelanto − total_gastos
     (justificación granular por registro: fase posterior)

8. Actualizar NotaMensualGasto:
     total_importe            = total_gastos
     importe_adelanto          = total_adelantos_gastos   // AHORA CALCULADO, no manual
     total_adelantos_dieta     = total_adelantos_dieta    // nuevo campo
     importe_neto_liquidar     = importe_neto_liquidar    // nuevo campo
     saldo_pendiente           = importe_neto_liquidar
```

### Tolerancia al histórico
Si un ciclo tiene `importe_adelanto > 0` pero **no** tiene `Adelanto` asociados (caso histórico 2026-07 TECNICO IT), el algoritmo:
- NO sobrescribe `importe_adelanto` con 0 (respeto del histórico).
- Marca el ciclo como `es_historico_adelanto = true` (nuevo flag) para que gerencia lo identifique y decida manualmente.
- Solo recalcula automáticamente los ciclos posteriores a la activación de `Adelanto`.

### Tratamiento de adelantos de dieta en esta fase
- **No se restan** del cálculo de gastos.
- Se **listan informativamente** con aviso explícito: *"Liquidación detallada de dietas pendiente del módulo Dietas"*.

---

## E. Documento de cierre de ciclo (sin cambios de fondo respecto a v1)

Se añade entre "Datos del ciclo" y "Detalle de registros" del PDF `exportarCicloContabilidad`:

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
- `es_historico_adelanto` (boolean, default false) — marca ciclos con `importe_adelanto` anterior a `Adelanto`

`importe_adelanto` y `saldo_pendiente` se conservan como alias de retrocompatibilidad.

---

## F. Punto de entrada en navegación (sin cambios respecto a v1)

### En el Dashboard Económico (`EconomicoDashboard.jsx`)
Añadir pestaña **"Adelantos"** al `Tabs` existente (hoy: Resumen | Contabilidad analítica):

```
Tabs: [ Resumen ] [ Adelantos ] [ Contabilidad analítica ]
```

- **Visible para:** gerencia, admin, propietario, director_comercial.
- **Dentro de la pestaña Adelantos**, dos sub-secciones:
  1. **Adelantos de gastos** — visible para gerencia/admin/director_comercial. Listado + formulario de alta + acciones (autorizar, entregar, justificar, anular).
  2. **Adelantos de dieta** — visible **solo** si `isGerencia || isAdmin || isPropietario`. El componente **no se renderiza** y **no se lanza la query** si el rol no corresponde. La RLS `read` de dieta bloquea además a nivel de datos.

### Blindaje real (lección aprendida: "ocultar el menú no basta")
1. **RLS a nivel de datos** (sección C): la dieta solo la leen gerencia/admin. Barrera definitiva.
2. **Guard de componente:** el componente de adelantos de dieta comprueba `isGerencia || isAdmin` antes de renderizar y antes de llamar a `base44.entities.Adelanto.filter({ tipo: 'dieta' })`.
3. **Ruta:** si se crea página dedicada `/adelantos`, el `ProtectedRoute` la gatea con `module` y dentro se revalida el rol para la sub-vista de dieta.

### Acceso del técnico a sus adelantos de gastos
Pestaña **"Mis adelantos"** dentro de `NotasGastos.jsx` (vista del técnico), solo lectura, filtrada por `operario_email == user.email` y `tipo == 'gastos'`.

---

## G. Plan de implementación (actualizado)

1. Crear entidad `Adelanto` (secciones B y C).
2. Extender `NotaMensualGasto`: `total_adelantos_gastos`, `total_adelantos_dieta`, `importe_neto_liquidar`, `es_historico_adelanto`; **`importe_adelanto` pasa a calculado** (Sección D).
3. Componente `AdelantosPanel` (Dashboard Económico) + `AdelantoFormDialog`.
4. Componente `MisAdelantosTab` en la vista del técnico (solo lectura, tipo gastos).
5. Lógica de conciliación al cierre de ciclo (Sección D) — **ver Sección I sobre dónde vive según el plan disponible.**
6. Sección "Adelantos recibidos" + bloque de liquidación en el documento de cierre.
7. Registro histórico de julio 2026: **no se toca** — se marca con `es_historico_adelanto` para revisión manual de gerencia.
8. **(Limpieza opcional)** Evaluar eliminar o marcar como deprecada la entidad `AdelantoParcialCiclo` y el componente `AdelantoParcialDialog.jsx` (0 registros en producción, código muerto). Fuera del alcance de esta tarea; se valora en una fase de limpieza.

---

## H. Decisiones (actualizado)

| # | Decisión | Recomendación | Estado |
|---|---|---|---|
| 1 | ¿Entidad nueva `Adelanto` vs ampliar algo existente? | **Entidad nueva** — `AdelantoParcialCiclo` existe pero está sin usar (0 registros) y mezcla semánticas | **Confirmado** |
| 2 | ¿El técnico puede solicitar su propio adelanto de gastos? | No — solo gerencia/admin/director_comercial | A confirmar |
| 3 | ¿El técnico ve sus adelantos de dieta? | No en esta fase | A confirmar |
| 4 | ¿Qué hacer con el registro histórico de 500€ (julio 2026)? | **Se deja como histórico, sin tocar — decisión manual de gerencia, fuera del alcance de código** | **Cerrado** |
| 5 | ¿`importe_adelanto` de `NotaMensualGasto` pasa a ser calculado? | **Sí**, a partir de la implementación de `Adelanto` (excepto ciclos marcados `es_historico_adelanto`) | **Confirmado** |
| 6 | ¿Dónde vive la lógica de conciliación según el plan disponible? | Ver Sección I | **Confirmado** |
| 7 | ¿El adelanto de gastos se puede crear sobre un ciclo ya abierto pero incompleto? | Sí — es precisamente el caso de uso real de "adelanto por liquidez" | **Confirmado** |
| 8 | ¿Se limpia `AdelantoParcialCiclo` / `AdelantoParcialDialog.jsx` (código muerto)? | **No en esta tarea** — se valora en fase de limpieza posterior | A confirmar |

---

## I. Política de degradación por plan (nueva sección)

Aplica a **todas** las funciones de este módulo que requieran backend functions o IA, siguiendo el mismo patrón ya usado en `TicketCapture.jsx`/`OcrUploader.jsx` (fallo 402 → foto adjunta + datos a mano):

1. **Por defecto, el módulo de Adelantos no necesita IA** para su funcionamiento básico: alta de adelanto, cálculo de conciliación y RLS son lógica **determinista**, no generativa. No se introduce ninguna dependencia de IA externa nueva.
2. **Las funciones que sí requieran backend functions dedicadas** (p. ej., mover la conciliación de la Sección D a una función backend `cerrarCicloConAdelantos`, o añadir la sección de adelantos dentro de `exportarCicloContabilidad`) **se escriben e implementan completas**, aunque el plan actual no permita ejecutarlas.
3. **Detección de plan insuficiente:** cada llamada a una función backend debe comprobar el resultado y, si falla por restricción de plan (patrón 402/403 ya usado en el proyecto), mostrar en la UI un mensaje claro y no técnico: **"Esta función avanzada no está disponible en el plan actual. Se activará automáticamente al actualizar el plan."** — nunca un error genérico ni pantalla en blanco.
4. **Mientras el plan no lo permita**, la conciliación de adelantos (Sección D) se ejecuta en **cliente** (como ya ocurre hoy con `recalcYCerrar`), y el bloque de "Adelantos recibidos" en el documento de cierre se genera también en cliente si `exportarCicloContabilidad` no está disponible — degradando con elegancia, no bloqueando el uso básico del módulo.
5. Este mismo criterio (escribir la función avanzada completa + mensaje de "no disponible en el plan actual" en vez de omitirla) se aplica como estándar a **cualquier otra función pendiente de plan superior** ya identificada en el inventario general del proyecto, no solo a este módulo.

---

*Documento v2 generado para revisión de gerencia/administración. Sin cambios de código en esta fase.*