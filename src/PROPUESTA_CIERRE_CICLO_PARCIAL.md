# Propuesta técnica — Cierre de ciclo por operario, aditivo y con cierres parciales

**Proyecto:** Smart Gestión (Simantec S.L.) · **AppId:** 69de8e23b1cd7ac050397c82
**Fecha:** 2026-09-20 · **Estado:** Pendiente de aprobación por gerencia/administración
**Alcance:** Documento de análisis + diseño. **No incluye implementación.**

---

## 0. Problemas verificados en el código real

| # | Problema | Evidencia en código |
|---|----------|---------------------|
| 1 | Sin acotar por operario | `ConsolidarCicloButton.jsx` sólo expone selector de mes. `cerrarCicloGastosMensual/entry.ts` no lee `operario_id` del body y siempre agrupa todos los operarios con gastos del mes (`porOperario` itera **todos** los registros del mes). |
| 2 | Sobrescritura en vez de acumulación | Líneas 94-101 y 103-114: en cada ejecución se reescriben `registros_ids`, `total_registros`, `total_importe` y `saldo_pendiente` **desde cero**, filtrando sólo `borrador`/`pendiente`. Un gasto que entre dos consolidaciones haya pasado a `aprobado_gerencia` deja de aparecer en el filtro y se pierde del total de la nota. |
| 3 | Sin distinguir mes en curso vs. mes cerrado | El selector permite consolidar el mes actual sin aviso. No existe la noción de "cierre anticipado/parcial" frente a "cierre de fin de mes". |
| 4 | Necesidad nueva: cierre parcial a mitad de mes | Por norma de Simantec es legítimo cerrar un corte a mitad de mes (p.ej. día 15) para pagar cuanto antes una acumulación que el operario no puede sostener. El cierre definitivo del 31 debe entonces conocer lo ya cerrado/pagado en el parcial. |

Los cuatro puntos están acoplados: arreglar sólo la sobrescritura (2) sin modelar el cierre parcial (4) dejaría al cierre de fin de mes sin saber qué hacer con un gasto ya pagado en el corte parcial.

---

## A. Modelo de datos: cierre parcial vs. cierre definitivo

### Opciones evaluadas

- **Opción 1 — `NotaMensualGasto` con `tipo_cierre` + histórico `cortes[]`:** una sola nota por ciclo/operario gana un array de cortes `[{ fecha, registros_ids, importe, adelantos_restados }]`. El cierre definitivo del 31 lee los cortes previos y sólo añade lo posterior.
- **Opción 2 — Cada corte es su propia `NotaMensualGasto` independiente** (con `es_parcial: true` y sufijo), enlazada al mismo `ciclo_mes`/operario; el cierre de fin de mes crea la nota "final" que referencia las parciales.

### Recomendación: **Opción 3 — Unificar el cierre parcial con la entidad existente `AdelantoParcialCiclo`**

`AdelantoParcialCiclo` ya modela exactamente el cierre parcial descrito:

- Pertenece a una `NotaMensualGasto` (`nota_mensual_id`, `ciclo_mes`, `operario_id`).
- Tiene `registros_ids` (subconjunto del ciclo), `importe`, `total_registros`.
- Tiene `fecha_creacion_real` (explícitamente "puede ser antes del cierre del ciclo").
- Tiene circuito de aprobación/pago propio: `borrador → enviada → pagada`, con `motivo`, `enviada_por`, `pagada_por`, `fecha_pago`, `metodo_pago`.
- Ya se descuenta del saldo del ciclo al pasar a `pagada` (descripción del campo `estado`).

**Por qué unificar y no crear un tercer concepto:**

1. **Conceptualmente es lo mismo**: un adelanto parcial por liquidez a mitad de ciclo *es* un pago anticipado de un subconjunto de gastos del ciclo. El "cierre parcial" del prompt es la misma operación con otro nombre.
2. **Evita duplicar** entidad, RLS, estado, circuito de pago y lógica de descuento del neto.
3. **El histórico es más legible para gerencia**: una `NotaMensualGasto` (nota del mes completo) + N `AdelantoParcialCiclo` (cortes/adelantos) enlazados a ella. No hay dos "notas del mismo mes" que puedan confundirse.
4. La `NotaMensualGasto` sigue siendo **única y definitiva** por `ciclo_mes`+`operario_id`, lo que encaja con el calendario natural 1→31 ya implantado y con el cron.

### Ajuste mínimo al modelo (sin romper lo existente)

- **`AdelantoParcialCiclo`**: añadir campo opcional `fecha_corte` (date) — la fecha hasta la que se incluyen gastos en ese corte parcial. `motivo` ya cubre la justificación. No se necesitan más campos.
- **`NotaMensualGasto`**: sin cambios estructurales. `registros_ids` pasa a representar **todos** los gastos reembolsables del ciclo (independientemente del estado actual del `RegistroGasto`), y `total_importe` se calcula sobre ese conjunto completo. El neto a liquidar ya existe: `importe_neto_liquidar = total_importe − total_adelantos_gastos`, donde `total_adelantos_gastos` ya suma los `AdelantoParcialCiclo` pagados del ciclo.

> Consecuencia: el cierre definitivo **nunca sobrescribe** (punto 2), porque `registros_ids`/`total_importe` se recalculan siempre sobre el filtro **completo del ciclo** (no sólo `borrador`/`pendiente`), de modo que los gastos ya aprobados/pagados en un corte parcial siguen contando.

---

## B. Criterio de qué gastos entran en un cierre parcial

- Gastos `RegistroGasto` del `ciclo_mes` y `operario_id` seleccionados, con `origen_pago` en `medios_propios` (reembolsables; se excluyen `medio_empresa` y `credito_proveedor`, igual que hoy).
- Con `fecha_documento` (o `fecha_creacion_real` como fallback) **≤ fecha de corte** elegida.
- En estado `borrador` o `pendiente` (no incluidos en un corte parcial anterior ya pagado/aprobado).
- **Anti-duplicación**: el backend comprueba que un `RegistroGasto` no esté ya en el `registros_ids` de un `AdelantoParcialCiclo` existente del mismo ciclo. Si lo está, se omite (pertenece a un corte anterior).

> Coincide con el filtro actual del cierre de fin de mes, acotado a una fecha de corte dentro del mes.

---

## C. Fórmula del cierre definitivo con corte parcial previo (con ejemplo)

```
total_importe (NotaMensualGasto)        = Σ importe de TODOS los gastos reembolsables del ciclo
total_adelantos_gastos                  = Σ AdelantoParcialCiclo.importe  donde estado = 'pagada'
importe_neto_liquidar                   = total_importe − total_adelantos_gastos
gastos_nuevos_desde_ultimo_corte        = gastos del ciclo con fecha > último corte y estado borrador/pendiente
```

El cierre definitivo del 31:
1. Recalcula `registros_ids` y `total_importe` sobre **todo** el ciclo (aditivo; los del corte parcial siguen dentro).
2. Mueve a `pendiente` sólo los gastos **nuevos** (los del corte parcial ya están `aprobado_gerencia`/`pagada` y no se tocan).
3. Recalcula `total_adelantos_gastos` sumando los `AdelantoParcialCiclo` pagados → `importe_neto_liquidar`.

### Ejemplo numérico (operario Cosmin, septiembre 2026)

| Evento | Gastos | Importe | Efecto |
|--------|--------|---------|--------|
| Día 1-15: 5 gastos registrados | 5 | 200,00 € | `borrador` |
| **Día 15 — Cierre parcial** (corte 15) | (5 incluidos) | 200,00 € | Crea `AdelantoParcialCiclo` importe=200, registros=esos 5. Los 5 pasan `borrador→pendiente`. |
| Gerencia aprueba el parcial | — | — | Los 5 pasan `pendiente→aprobado_gerencia`. |
| Administración paga el parcial | — | 200,00 € pagados | `AdelantoParcialCiclo.estado → pagada`. El operario recibe 200 € ya. |
| Día 16-30: 3 gastos nuevos | 3 | 150,00 € | `borrador` |
| **1 oct — Cierre definitivo** (cron) | (8 en total) | 350,00 € | `NotaMensualGasto.registros_ids` = los 8 (200+150). `total_importe`=350. Sólo los 3 nuevos pasan `borrador→pendiente`. `total_adelantos_gastos`=200 (el parcial pagado). `importe_neto_liquidar`=350−200=**150 €**. |
| Administración paga el definitivo | — | 150,00 € | Pago final. |

**Total cobrado por el operario: 200 € (parcial) + 150 € (definitivo) = 350 €** = suma de todos los gastos del mes. ✓

La fórmula del prompt se cumple:
```
Total definitivo = (gastos pagados en el corte parcial) + (gastos nuevos tras el corte) − (adelantos ya restados)
                 = 200 + 150 − 200 (ya descontado vía total_adelantos_gastos)
                 → neto a liquidar en el cierre definitivo = 150 €
```

---

## D. Circuitos de aprobación del cierre parcial

**Recomendación por defecto (mismo circuito que el cierre normal):** `AdelantoParcialCiclo` ya tiene `borrador → enviada (en contabilidad) → pagada`, con `enviada_por` y `pagada_por`. Es decir: gerencia aprueba/envía, administración paga.

**A confirmar con gerencia**: si por su naturaleza de urgencia de liquidez el cierre parcial debe tener un circuito **más corto** (p.ej. gerencia aprueba y paga directamente, saltando "en contabilidad"). No asumir; la propuesta deja el circuito estándar por defecto y se acorta sólo si gerencia lo confirma.

---

## E. Rango de fechas de corte y nº de cierres parciales

- **Fecha de corte**: cualquier día del mes en curso (selector de fecha libre). No se restringe al día 15.
- **Múltiples cierres parciales**: **sí** se permiten, cada uno como un `AdelantoParcialCiclo` independiente del mismo `nota_mensual_id`. El backend exige que sus `registros_ids` sean disjuntos (anti-duplicación del punto B).
- **Restricción**: la fecha de corte de un nuevo parcial debe ser **posterior** a la del último parcial del mismo ciclo, para mantener el orden cronológico y evitar solapamientos.

---

## Diseño corregido — `cerrarCicloGastosMensual` (backend)

Cambios sobre `entry.ts` (sin implementar ahora):

1. **Leer `operario_id` opcional** del body. Si viene, filtra sólo ese operario; si no, todos (sin regresión).
2. **Leer `tipo_cierre`** (`'definitivo'` | `'parcial'`) y, para parcial, **`fecha_corte`** (date) obligatoria.
3. **Filtro aditivo para definitivo**: `RegistroGasto` por `ciclo_mes`+`operario_id`+`origen_pago=medios_propios` (sin filtrar por estado). `registros_ids` = union de los existentes + encontrados; `total_importe` = suma de todos. Mover a `pendiente` sólo los que estén en `borrador`/`pendiente` (los ya aprobados/pagados no se tocan).
4. **Cierre parcial**: crear/actualizar un `AdelantoParcialCiclo` con `registros_ids` = gastos `borrador`/`pendiente` con `fecha ≤ fecha_corte` y no ya incluidos en otro parcial. Mover esos `RegistroGasto` a `pendiente`. No toca la `NotaMensualGasto` (ésta sigue representando el ciclo completo; el parcial se descuenta vía `total_adelantos_gastos`).
5. **Recalcular `total_adelantos_gastos`** e `importe_neto_liquidar` de la `NotaMensualGasto` tras cualquier operación (suma de `AdelantoParcialCiclo` pagadas del ciclo).
6. **Aviso de mes en curso**: la función devuelve `es_mes_en_curso: true` cuando `ciclo_mes` == mes actual, para que la UI lo muestre. No bloquea (es información).

---

## Diseño corregido — `ConsolidarCicloButton.jsx` (UI)

Cambios (sin implementar ahora):

1. **Selector de operario** ("Todos" / uno concreto) además del de mes.
2. **Selector de tipo de cierre**: "Cierre definitivo de mes completo" (por defecto) vs. "Cierre parcial (fecha de corte)".
3. Si parcial: **selector de fecha de corte** (date) y campo **motivo** (obligatorio, heredado de `AdelantoParcialCiclo.motivo`).
4. **Aviso de mes en curso**: si el mes elegido no ha terminado, mostrar banner amarillo "Cierre anticipado: el mes X todavía está abierto. Es un cierre parcial/anticipado, distinto del cierre normal de fin de mes." Si el tipo es "definitivo" sobre un mes abierto, advertir más fuerte y pedir confirmación extra.
5. **Resultado aditivo**: mostrar "registros añadidos" (no "total_registros") cuando la nota ya existía, para reflejar la acumulación.
6. Llamada: `base44.functions.invoke('cerrarCicloGastosMensual', { ciclo_mes, operario_id?, tipo_cierre, fecha_corte?, motivo? })`.

---

## Riesgos y mitigaciones

- **Riesgo**: doble pago si un mismo gasto entra en dos parciales. **Mitigación**: check de disjunción en el backend (punto B) + índice/validación de `registros_ids` ya presentes.
- **Riesgo**: cierre definitivo sobre mes abierto. **Mitigación**: aviso explícito + confirmación extra (punto 4).
- **Riesgo**: `registros_ids` muy largo si el ciclo tiene muchos gastos. **Mitigación**: ya es el modelo actual; sin cambio de magnitud.
- **Compatibilidad**: los `AdelantoParcialCiclo` existentes (adelantos fortuitos) siguen funcionando igual; el cierre parcial sólo añade uso del mismo modelo con `fecha_corte` + `motivo` específicos.

---

## Pendiente de confirmación (gerencia/administración)

- **D**: ¿circuito corto para el cierre parcial o el estándar?
- **E**: ¿fecha de corte libre o días predefinidos? (propuesta: libre)
- Aprobación general del modelo unificado con `AdelantoParcialCiclo` y de la fórmula del punto C.

Una vez aprobado, se implementa backend + UI en un único pase.