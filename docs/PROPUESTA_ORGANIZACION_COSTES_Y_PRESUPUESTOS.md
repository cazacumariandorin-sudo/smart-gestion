# Propuesta de integración: organización, costes y presupuestos

**Repositorio:** `cazacumariandorin-sudo/smart-gestion`  
**Estado:** propuesta funcional para planificar la implementación por fases  
**Alcance:** ficha de empresa, costes de nómina y presupuestos  

## Fase 0 iniciada: validación base y toma de decisiones

La fase 0 no modifica negocio ni cálculos; prepara el marco de decisión y deja las reglas de implementación explícitas antes de empezar a codificar. En esta fase se deben cerrar los siguientes puntos y dejar constancia de ellos en la ruta de trabajo.

### Checklist de decisión

- [ ] Definir roles autorizados para la ficha de empresa, los gastos de empresa, la revisión de costes y el cálculo interno de presupuestos.
- [ ] Confirmar si `propietario` tiene acceso equivalente a `gerencia` o debe quedar fuera de la edición.
- [ ] Confirmar la definición precisa de "coste diario": laborable o productivo.
- [ ] Definir la base horaria/días laborables para el cálculo de coste diario y por hora.
- [ ] Confirmar si los 2.400 €/mes netos de gerencia y director comercial son solo referencia o deben convertirse en estimación de coste de empresa.
- [ ] Validar si el puesto de administración se vincula a la nómina real existente o requiere una estimación auxiliar.
- [ ] Confirmar si los gastos de empresa se registran en bruto o neto, con o sin IVA, y si se deben prorratear anualmente en el resumen mensual.
- [ ] Define la base de cálculo del porcentaje de gastos fijos en presupuestos: facturación prevista, facturación real, presupuestos aceptados, horas estimadas, etc.
- [ ] Confirmar si el porcentaje de gastos fijos es opcional por presupuesto o obligatorio si hay base válida.
- [ ] Acordar la regla de coste laboral del presupuesto: antes o después de IVA, por partida o global, y con qué base de horas/tarifa.
- [ ] Decidir qué nivel de detalle del coste laboral se muestra al cliente y qué parte queda interna.
- [ ] Confirmar cómo se guardará la instantánea del presupuesto para que no se altere por cambios futuros de coste.
- [ ] Acordar si la revisión semestral será solo informativa o si deberá generar una validación de la dirección o administración.

### Registro de decisiones pendientes

Todas estas decisiones deben dejarse en un documento de consenso dentro del repositorio o en una issue de proyecto antes de empezar la implementación funcional de la Fase 1.

### Salida esperada de la Fase 0

- Matriz de permisos por rol.
- Diccionario de cálculo y definiciones de los indicadores.
- Reglas de almacenamiento y vigencia de costes.
- Lista de costes y referencias de empresa iniciales validadas.
- Base para comenzar sin riesgo de crear inconsistencias en la lógica de precios.

## 1. Objetivo

Centralizar la estructura organizativa y los costes de empresa en la ficha de empresa; calcular un coste laboral diario basado en nóminas reales con revisión semestral; y ofrecer en presupuestos un cálculo interno, opcional y restringido de gastos fijos y coste laboral, sin revelar su desglose al cliente.

La propuesta amplía módulos existentes, en lugar de crear flujos paralelos:

- **Empresas:** actualmente contiene la ficha fiscal (`src/pages/Empresas.jsx`).
- **Económico → Nóminas → Costes:** ya analiza nóminas reales (`src/components/nominas/AnalisisCostes.jsx`).
- **Presupuestos:** el formulario gestiona conceptos y precios de venta (`src/pages/presupuestos/PresupuestoForm.jsx`).
- **Análisis económico:** ya consolida nóminas y gastos sin obra (`base44/functions/calcularAnalisisEconomico/entry.ts`).

## 2. Datos iniciales aportados

### Organización

| Puesto | Personas | Dato inicial | Tratamiento propuesto |
|---|---:|---:|---|
| Gerencia | 1 | 2.400 €/mes netos | Referencia neta; obtener coste empresarial de nómina real o estimación marcada como provisional. |
| Director comercial | 1 | 2.400 €/mes netos | Referencia neta; obtener coste empresarial de nómina real o estimación marcada como provisional. |
| Administración | 1 | Nómina mensual existente | Vincular con la nómina real, evitando duplicarla en los cálculos. |

**Importante:** el importe neto no es el coste de empresa. No debe convertirse directamente en coste empresarial sin estimar bruto, cotizaciones y otros conceptos. Las estimaciones y los datos reales deben identificarse por separado.

### Gastos de empresa

| Concepto | Importe indicado | Periodicidad | Equivalente mensual para planificación |
|---|---:|---|---:|
| Gestoría laboral y contable | 900 € | Mensual | 900 € |
| Luz y teléfono | 75 € | Mensual | 75 € |
| Local oficina | 600 € | Mensual | 600 € |
| PRL | 800 € | Anual | 66,67 € |
| Seguros obligatorios convenio metal | 2.500 € | Anual | 208,33 € |
| ITV coches | 360 € | Anual | 30 € |
| Mantenimiento coches | Pendiente | Periódico/variable | No estimado hasta registrar importes y frecuencia |

Los conceptos conocidos suman **1.575 €/mes** de gastos mensuales y **305 €/mes** prorrateados de gastos anuales: **1.880 €/mes (22.560 €/año)**. No incluye nóminas ni mantenimiento de coches. Es una base inicial orientativa; confirmar importes, IVA, vigencia y si son costes recurrentes antes de usarla en cálculos definitivos.

## 3. Principios funcionales

1. Distinguir siempre **dato real**, **estimación** y **dato pendiente**.
2. Guardar periodo de vigencia e historial de cambios de costes y cálculos semestrales.
3. No duplicar nóminas individuales y resúmenes de nómina.
4. Permitir excluir o incluir costes en el cálculo mediante criterios explícitos y auditables.
5. Mantener el documento de cliente con sus conceptos y precios, sin mostrar coste laboral, gastos fijos, márgenes ni porcentajes internos.
6. Restringir información y acciones económicas a roles autorizados tanto en pantalla como en backend.
7. Los cálculos de presupuesto deben guardarse como una instantánea del momento de elaboración, para que futuros cambios de costes no reescriban la historia.

## 4. Fases de implementación

### Fase 0 — Criterios, permisos y validación de datos

**Objetivo:** cerrar las decisiones funcionales y verificar fuentes de datos antes de modificar cálculos.

**Tareas**
- Confirmar roles con acceso: `admin`, `gerencia`, `director_comercial` y `administracion`. Acordar si `propietario` debe tener también acceso administrativo.
- Revisar los roles y permisos reales disponibles en frontend, entidades y funciones backend.
- Confirmar qué significa “coste diario”: coste por día laborable o coste por día productivo.
- Definir calendario laboral, jornada, vacaciones, festivos, bajas y horas no productivas, si se desea coste por día productivo.
- Confirmar si los gastos se registran con o sin IVA y cómo se tratan los impuestos deducibles.
- Establecer qué estados y tipos de nómina cuentan como nómina individual real y qué campos son fiables.
- Definir la base de facturación y el periodo para calcular el porcentaje de gastos fijos.
- Confirmar cómo vincular las personas de gerencia, dirección comercial y administración con usuarios/operarios y nóminas.

**Entregables**
- Diccionario de datos y reglas de cálculo acordadas.
- Matriz de permisos por rol y operación.
- Lista de validación de los importes iniciales y su vigencia.

**Criterio de aceptación**
- No se inicia el cálculo de porcentajes hasta que estén acordadas la base, periodo, inclusión de nóminas y tratamiento de valores estimados.

### Fase 1 — Ficha de empresa: organización y costes

**Objetivo:** incorporar información organizativa y gastos empresariales editables en la ficha de empresa existente.

**Tareas**
- Añadir secciones o pestañas **Datos fiscales**, **Organización** y **Gastos de empresa** en Empresas.
- Registrar puestos, número de personas, vínculo opcional con usuario/operario, importe neto de referencia, coste empresarial estimado/real y estado de validación.
- Permitir gastos fijos y periódicos con concepto, categoría, importe, periodicidad, fecha de inicio/fin, activo, IVA y regla de prorrateo.
- Crear los gastos iniciales indicados como datos de arranque, con el mantenimiento de coches pendiente de importes reales.
- Añadir resumen mensual y anual, separado por costes mensuales, prorrateos anuales, variables y nóminas.
- Restringir la edición a los roles acordados y registrar quién/cuándo modificó los importes.

**Criterio de aceptación**
- Se pueden editar y consultar los datos sin alterar la ficha fiscal existente.
- El resumen inicial muestra 1.880 €/mes y 22.560 €/año para los conceptos aportados, claramente identificado como subtotal sin nóminas ni mantenimiento de coches.
- Una frecuencia o importe pendiente no se interpreta como cero real ni se incorpora silenciosamente a una proyección.

### Fase 2 — Nóminas → Costes: coste diario con revisión semestral

**Objetivo:** ofrecer una métrica de coste laboral basada en las nóminas reales y permitir revisarla cada seis meses.

**Tareas**
- Ampliar el análisis de costes con un bloque de **Coste laboral diario** y, si hay datos horarios adecuados, **Coste laboral por hora**.
- Calcular el coste empresarial usando nóminas individuales del periodo de seis meses seleccionado.
- Excluir resúmenes u otros registros que puedan duplicar el coste de las nóminas individuales.
- Permitir calcular el total de empresa y, cuando la vinculación de datos lo permita, el detalle por persona/puesto.
- Guardar cada revisión como instantánea: fecha de análisis, periodo cubierto, número de nóminas/personas consideradas, total de coste, días/horas usados, resultado, supuestos, usuario y avisos de calidad de datos.
- Mostrar fecha de próxima revisión (cada seis meses) y advertir si el cálculo está vencido o si hay datos insuficientes.
- Mostrar de forma explícita si el indicador es por día laborable o productivo.

**Regla de cálculo propuesta**

- **Coste diario medio laborable** = coste empresarial real acumulado del periodo ÷ días laborables considerados.
- **Coste por hora** = coste empresarial real acumulado del periodo ÷ horas laborables consideradas.
- **Coste diario productivo**, solo cuando se disponga de datos fiables = coste empresarial real ÷ días u horas efectivamente productivos, con sus reglas documentadas.

La aplicación debe evitar llamar “productivo” al primer indicador si no descuenta vacaciones, festivos, bajas y tiempos no imputables.

**Criterio de aceptación**
- Una misma nómina no se cuenta más de una vez.
- Todo resultado permite ver periodo, fuente y denominador utilizado.
- Si faltan datos o la métrica está vencida, se muestra una advertencia y no se presenta la cifra como definitiva.
- Una nueva revisión conserva las anteriores y no altera los cálculos guardados en presupuestos históricos.

### Fase 3 — Presupuestos: cálculo interno de gastos fijos

**Objetivo:** informar a los roles autorizados de la carga estimada de gastos fijos y permitir aplicarla opcionalmente.

**Tareas**
- Añadir al formulario de presupuesto un panel interno de gastos fijos, visible solo para roles autorizados.
- Mostrar porcentaje recomendado, base y periodo del cálculo, importe que representaría sobre el presupuesto y fecha de actualización de los datos.
- Permitir aplicar o no el porcentaje. La opción debe ser voluntaria y no cambiar automáticamente precios existentes.
- Guardar en el presupuesto una instantánea de porcentaje, importe, método, fecha y versión de los costes de empresa usados.
- Si faltan datos de facturación, costes o revisión vigente, indicar **“sin base suficiente”** y no inventar un porcentaje.

**Regla propuesta, pendiente de validar**

**Porcentaje de recuperación de gastos fijos** = gastos fijos que se desea recuperar en el periodo ÷ facturación presupuestada/prevista del mismo periodo × 100.

El usuario debe poder consultar la base del cálculo. Por ejemplo, un importe mensual de gastos no debe compararse con una facturación anual sin normalizar ambos al mismo periodo.

**Criterio de aceptación**
- El cálculo y su base solo son visibles para roles autorizados.
- La selección es opcional; al no aplicarla, no se modifica el precio del presupuesto.
- El documento/PDF para cliente no muestra el porcentaje ni el importe interno.
- Las modificaciones futuras de gastos no cambian la instantánea ya guardada.

### Fase 4 — Presupuestos: coste laboral interno y peso sobre el precio

**Objetivo:** medir el coste laboral hipotético incluido en las partidas sin exponer el desglose al cliente.

**Tareas**
- Incorporar o reutilizar horas estimadas por partida/tarea y coste horario interno derivado de la fase 2.
- Calcular coste laboral interno por partida y total del presupuesto.
- Mostrar porcentaje de coste laboral sobre la base de venta seleccionada.
- Usar las cifras en el análisis interno de margen, no como partidas públicas separadas.
- Guardar en la instantánea del presupuesto horas, tarifa/coste horario, coste laboral, base usada y porcentaje.
- No cambiar automáticamente el precio de venta; la persona que prepara el presupuesto decide si ajusta precios.

**Reglas propuestas**

- **Coste laboral estimado** = suma de horas estimadas por tarea × coste horario interno correspondiente.
- **Peso laboral sobre presupuesto** = coste laboral estimado ÷ base del presupuesto × 100.

Se debe acordar si la base es el subtotal antes de IVA o el total con IVA; se recomienda utilizar la base antes de IVA para el análisis interno y etiquetarla claramente.

**Criterio de aceptación**
- El análisis interno distingue coste, precio de venta y margen; no confunde porcentaje de coste con recargo o margen.
- El cliente solo ve conceptos, precios e impuestos previstos en el documento habitual.
- Si una partida no tiene horas estimadas o tarifa fiable, se indica como incompleta en vez de asignarle un coste ficticio.

### Fase 5 — Validación, seguridad y despliegue

**Objetivo:** asegurar la coherencia de los cálculos y proteger información salarial y comercial.

**Tareas**
- Probar roles autorizados y no autorizados en pantallas, endpoints y operaciones de datos.
- Probar periodos sin nóminas, nóminas duplicadas, importes anuales, cambios de vigencia, datos incompletos y presupuestos ya creados.
- Revisar PDF/vista previa compartida y comprobar que no se filtran costes, salarios netos, porcentajes internos ni márgenes.
- Comparar cálculos con ejemplos validados por administración/gestoría.
- Probar que los presupuestos antiguos conservan sus datos y totales.
- Desplegar por fases y habilitar inicialmente el cálculo como informativo, antes de permitir que se use para modificar precios.

**Criterio de aceptación**
- Los permisos están comprobados en cliente y servidor.
- Los cálculos y redondeos se verifican con casos conocidos.
- No hay filtración de datos internos en exportaciones ni documentos del cliente.
- Administración/gerencia valida los resultados antes de considerar las métricas operativas.

## 5. Modelo de datos conceptual

Los nombres definitivos deben ajustarse a las entidades y convenciones existentes del proyecto.

### Configuración organizativa

- Empresa.
- Puesto/función.
- Número de personas.
- Vínculo a usuario/operario y nómina, si procede.
- Neto de referencia (opcional, informativo).
- Coste empresarial real o estimado, origen y fecha de vigencia.
- Estado del dato: `real`, `estimado`, `pendiente`.

### Gastos de empresa

- Empresa, concepto y categoría.
- Importe, moneda y periodicidad (`mensual`, `anual`, `periódica`, `variable`).
- Fecha de inicio/fin y frecuencia/mes de vencimiento, cuando aplique.
- Tratamiento de IVA, activo, prorrateo y notas.
- Auditoría de alta/modificación.

### Revisión semestral de costes

- Empresa, fecha y semestre analizado.
- Nóminas/empleados incluidos y regla de deduplicación.
- Coste real total y denominador de días/horas.
- Métrica obtenida y clase de día (`laborable`/`productivo`).
- Supuestos, avisos, autor y estado de validación.

### Instantánea de presupuesto

- Versión y fecha de cálculo.
- Gastos fijos: base, periodo, porcentaje, importe y opción aplicada.
- Mano de obra: horas, coste horario, importe y porcentaje.
- Base antes/después de IVA claramente identificada.
- Indicadores de información ausente o estimada.

## 6. Permisos propuestos

| Operación | Admin | Gerencia | Dirección comercial | Administración |
|---|---:|---:|---:|---:|
| Consultar datos internos de costes | Sí | Sí | Sí, para presupuestos | Sí |
| Editar organización y gastos | Sí | Sí | Pendiente de decisión | Sí |
| Consultar/cargar nóminas reales | Según permisos actuales | Según permisos actuales | No por defecto | Según permisos actuales |
| Ver cálculo interno del presupuesto | Sí | Sí | Sí | Sí |
| Ver desglose interno en PDF/documento cliente | No | No | No | No |

La tabla es una propuesta inicial: debe armonizarse con las reglas actuales del proyecto, especialmente en nóminas. Dirección comercial necesita el cálculo interno del presupuesto, pero no necesariamente acceso a documentos o detalle individual de nóminas.

## 7. Decisiones pendientes antes de implementar

1. ¿El coste diario debe ser por día laborable o por día productivo? ¿Qué fuente de calendario/jornada se usará?
2. ¿Los 2.400 € netos de gerencia y dirección comercial son datos de referencia o deben servir para crear una estimación de coste de empresa?
3. ¿Qué nómina/persona corresponde a cada puesto y cómo se reconocerá la nómina de administración existente?
4. ¿Qué conceptos de gastos se excluyen por recuperarse directamente en una obra o por estar ya registrados en contabilidad?
5. ¿El porcentaje fijo se calculará contra facturación prevista, presupuestos aceptados, horas productivas u otra base? ¿Qué ventana temporal?
6. ¿El porcentaje de coste laboral usa subtotal antes de IVA? Se recomienda que sí.
7. ¿Debe dirección comercial editar la configuración corporativa o solo consultar los valores aplicables a presupuestos?
8. ¿Quién aprueba y valida las revisiones semestrales y los cambios de costes?
9. ¿Cómo se introducen y reparten los gastos periódicos de mantenimiento de coches?

## 8. Orden recomendado de entrega

1. **Fase 0:** cerrar reglas, datos y permisos.
2. **Fase 1:** ficha de empresa y gastos configurables.
3. **Fase 2:** revisión semestral de coste diario con histórico y advertencias.
4. **Fase 3:** indicador opcional de recuperación de gastos fijos en presupuestos.
5. **Fase 4:** coste laboral interno por partida y porcentaje sobre presupuesto.
6. **Fase 5:** pruebas de acceso, cálculos, documentos y despliegue gradual.

Este orden evita mostrar porcentajes en presupuestos antes de tener una fuente de costes validada y un cálculo laboral explicable.

## 9. Referencias de implementación actuales

- Ficha de empresa: [`src/pages/Empresas.jsx`](../src/pages/Empresas.jsx).
- Página de nóminas y permisos de pestañas: [`src/pages/Nominas.jsx`](../src/pages/Nominas.jsx).
- Análisis actual de costes de nómina: [`src/components/nominas/AnalisisCostes.jsx`](../src/components/nominas/AnalisisCostes.jsx).
- Análisis económico de nóminas y gastos fijos: [`base44/functions/calcularAnalisisEconomico/entry.ts`](../base44/functions/calcularAnalisisEconomico/entry.ts).
- Formulario de presupuesto y cálculo de líneas: [`src/pages/presupuestos/PresupuestoForm.jsx`](../src/pages/presupuestos/PresupuestoForm.jsx).
- Lógica compartida de cálculos de nómina: [`base44/shared/nominaCalculo.ts`](../base44/shared/nominaCalculo.ts) y [`base44/shared/nominaEscenario.ts`](../base44/shared/nominaEscenario.ts).
