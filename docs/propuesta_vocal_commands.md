# Propuesta técnica: comandos por voz para acelerar la cumplimentación en móvil

## 1. Objetivo

Reducir el tiempo que tarda un técnico en registrar información en la app, especialmente desde móvil, usando comandos por voz para crear registros, completar fichajes, marcar incidencias y rellenar campos rápidos sin necesidad de escribir.

La idea no es sustituir el flujo completo de la app, sino minimizar la fricción del uso diario:

- fichajes rápidos,
- registro de incidencias,
- apuntes de obra,
- comprobación de estado,
- anotación de observaciones,
- creación de tareas o notas desde móvil con una sola frase.

La prioridad es que el técnico pueda decir lo que quiere hacer y que la app lo convierta en un registro validado, con comprobación visual final y posible edición manual.

## 2. Problema actual

El uso desde móvil penaliza la velocidad de entrada porque:

- escribir en un campo largo es lento,
- los técnicos suelen estar en obra, con las manos ocupadas,
- el contexto es dinámico y no siempre hay posibilidad de teclear bien,
- los formularios repetitivos pueden bloquear la operación.

La solución debe permitir:

- dictado natural,
- reconocimiento de comandos de tipo “crear registro”, “fichar entrada”, “incidencia”, “nota”, “obra”, “estado”, etc.,
- validación visual del texto antes de guardar,
- recuperación manual si la voz no entiende bien.

## 2.1. Verificación contra el código actual (revisión 16-11-2026)

Esta sección corrige la propuesta original con lo que realmente existe en la aplicación. Es la base del plan por fases del apartado 16.

### 2.1.1. Lo que ya existe y se reutiliza

- **Captura de voz**: `useSpeechInput` + `VoiceInputButton` (Web Speech API, `es-ES`, con permiso denegado gestionado y preferencia de usuario persistida: si se desactiva, el micrófono desaparece en toda la app). Ya se usa como dictado en partes diarios, notas de gastos, material, obras y fichajes. **No se construye captura nueva**: se añade un modo "comando" frente al modo "rellenar campo".
- **Cola offline**: la cola de acciones pendientes con procesado al recuperar conexión ya soporta `Fichaje`, `ApunteHorario`, `RegistroGasto`, `WorkOrder` y `ObraMaterial`.
- **Entidades destino reales**: `Fichaje`, `RegistroHorarioLegal`, `AuditoriaHorario`, `ApunteHorario`, `AsistenteTarea`, `ParteDiarioObra`, `Obra`, `SolarObra`, `FaltaAsistencia`.
- **Validaciones reutilizables**: `conflictoAusencias.js` (bloqueo de fichaje o apunte si hay ausencia ese día) y la lógica de alta de fichaje de `FichajesTab` (`calcularHoras`, origen, pausas).

### 2.1.2. Brechas detectadas y decisiones obligatorias

1. **No existen las entidades "Incidencia" ni "Tarea"** que la propuesta da por hechas. Mapeo cerrado: incidencia/aviso → `AsistenteTarea` (tipo `alerta`, con prioridad); tarea o checklist → `AsistenteTarea` (tipo `tarea_manual`); apunte de obra → `ApunteHorario` o `ParteDiarioObra`; estado de obra → notas/estado de `Obra`. Sin este mapeo no se puede programar el destino del guardado.
2. **Hora dictada ≠ hora real.** El diseño legal actual separa fichaje operativo y registro legal validado por administración con cadena de custodia. Decisión: el fichaje se registra con la **hora real del dictado**; si el técnico dicta otra hora, se guarda marcada como **hora declarada**, entra por la vía provisional (`RegistroHorarioLegal.estado_legal = provisional`) y nunca como prueba legal.
3. **No se dicta fichaje en nombre de otro.** El trabajador sale siempre del vínculo del usuario conectado; solo gerencia/administración puede dictar para terceros. Evita suplantación.
4. **"Voz offline" no es viable como reconocimiento.** El reconocimiento del navegador depende de red en la mayoría de Android e iOS. Offline garantiza que el registro no se pierde (cola existente), no que se pueda dictar.
5. **El parser debe ser local y determinista** (lexicón + expresiones regulares + normalización de tildes y sinónimos). La IA queda solo como respaldo con confianza baja, con confirmación explícita y aviso de coste: el asistente conversacional actual tarda y no cumple el objetivo de < 2 s.
6. **Reglas de negocio ya vigentes que el comando debe respetar**: ausencia registrada el día → bloqueo con aviso; jornada ya abierta → "entrada" avisa o cierra, no duplica; "salida" sin entrada abierta → rechazo con mensaje claro.

## 3. Principio de diseño

La aplicación debe soportar un flujo de voz asistida con estas reglas:

1. El usuario activa la grabación por voz desde un botón de micrófono.
2. La app escucha una frase natural en español.
3. El sistema interpreta la intención y extrae los parámetros clave.
4. La app presenta una previsualización del registro a guardar.
5. El usuario confirma o corrige.
6. La app crea el registro final en la base de datos.

Esto reduce el esfuerzo manual y mantiene control de calidad.

## 4. Casos de uso clave

### 4.1. Fichaje rápido

Ejemplos:

- “Fichaje entrada en obra Norte, operario Luis, 8:15.”
- “Salida de obra Sur, 18:40.”
- “He llegado tarde, 15 minutos, por tráfico.”

Resultado:

- crear o actualizar el fichaje del operario,
- asignar la obra si se detecta,
- guardar la hora y la nota si se proporciona.

### 4.2. Registro de incidencia

Ejemplos:

- “Incidencia en obra Sur: falta material de acero.”
- “Avería en máquina, necesita revisión.”
- “Retraso por lluvia, no se puede continuar.”

Resultado:

- crear un registro de incidencia,
- tipo de incidencia,
- ubicación,
- prioridad,
- operador responsable,
- descripción.

### 4.3. Apuntes rápidos de obra

Ejemplos:

- “Apunte de obra: se han instalado 12 paneles.”
- “Nota: se ha detenido la obra por lluvia.”
- “Avance: 80 por ciento del muro levantado.”

Resultado:

- crear un apunte o nota asociada a la obra,
- con fecha, obra, texto y autor.

### 4.4. Estado de trabajo

Ejemplos:

- “Estado de obra, en pausa por lluvia.”
- “Trabajo completado, revisión final.”
- “Falta personal para la cuadrilla.”

Resultado:

- guardar el estado del trabajo,
- asignarlo a la obra o al técnico.

### 4.5. Registro de tarea o checklist

Ejemplos:

- “Tarea completada: soldadura terminada.”
- “Checklist: revisado sistema eléctrico.”
- “Tarea pendiente: revisar compresor.”

Resultado:

- crear una tarea o marcar un checklist asociado a la obra.

## 5. Requisitos funcionales

### 5.1. Modo voz mínimo viable

El sistema debe permitir:

- activar micrófono desde el móvil,
- dictado de frases breves en español,
- interpretación de intentos y parámetros,
- confirmación final,
- guardado del registro.

### 5.2. Modo asistido

Cuando el reconocimiento no sea seguro, la app debe:

- mostrar el texto reconocido,
- permitir editarlo,
- marcar el campo antes de guardar.

### 5.3. Soporte offline mínimo

En móviles con poca cobertura, la app debe:

- almacenar la intención localmente,
- reconocer al menos frases cortas con feed de voz nativo,
- sincronizar la acción cuando haya conexión.

## 6. Requisitos no funcionales

- tiempo de respuesta bajo: idealmente < 2 segundos para mostrar el resultado reconocido
- compatibilidad con Android/iOS modernos
- soporte para auriculares y manos libres
- procesamiento local en casos simples
- reconocimiento por voz con fallback a teclado si falla
- accesibilidad para usuarios con discapacidad visual o movilidad reducida

## 7. Propuesta de comandos más útiles

### 7.1. Comandos por categoría

#### A. Fichaje

- “Fichaje entrada”
- “Fichaje salida”
- “Fichaje entrada obra X a las 8:15”
- “He llegado tarde 10 minutos por tráfico”
- “Salida a las 18:40 y cierre de jornada”

#### B. Incidencias

- “Incidencia en obra X: falta material”
- “Avería en máquina Z”
- “Retraso por lluvia”
- “Incidencia urgente, se necesita revisión”

#### C. Apuntes / observaciones

- “Apunte obra X: se ha terminado el muro”
- “Nota: falta personal para la siguiente tarea”
- “Avance: 70 por ciento del trabajo hecho”

#### D. Estado

- “Estado de obra en pausa”
- “Trabajo completado”
- “Mantenimiento pendiente”

#### E. Tareas

- “Tarea pendiente: revisar compresor”
- “Tarea completada: soldadura terminada”
- “Checklist: revisión del sistema eléctrico”

## 8. Modelo de interpretación

La app debe convertir una frase en una intención y parámetros.

### 8.1. Estructura de intención

Ejemplo:

```json
{
  "intent": "create_fichaje",
  "action": "entrada",
  "obra": "Norte",
  "operario": "Luis",
  "time": "08:15",
  "notes": "por tráfico",
  "confidence": 0.92
}
```

### 8.2. Tipos de intención

- `create_fichaje`
- `update_fichaje`
- `create_incidence`
- `create_note`
- `update_work_status`
- `create_task`
- `create_checklist_item`
- `search_record`
- `open_screen`

## 9. Diseño de UX para móvil

La UX debe ser rápida y poco intrusiva. Recomendación:

### 9.1. Botón flotante de voz

- micrófono visible siempre en la parte inferior o panel de acciones rápidas,
- color contrastado,
- icono de “dictado” con vibra o efecto visual,
- activación con un solo toque.

### 9.2. Flujo sugerido

1. pulsar micrófono,
2. hablar frase corta,
3. la app muestra texto reconocido,
4. muestra chips: “Guardar”, “Editar”, “Descartar”,
5. confirma,
6. crea el registro.

### 9.3. Validación incremental

- si la frase es clara: guardar directamente,
- si hay dudas: se abre una mini edición,
- si hay varios posibles operarios o obras: se muestran chips para confirmar.

### 9.4. Soporte de “micro-comandos”

Para mejorar precisión, el sistema puede combinar voz y UI:

- “fichaje entrada”
- “obra Norte”
- “operario Luis”
- “estado en pausa”
- “prioridad alta”

Esto hace que la voz funcione mejor con un conjunto cerrado de comandos.

## 10. Arquitectura técnica propuesta

### 10.1. Capas

- Capa de captura: micrófono del dispositivo y streaming de audio
- Capa de reconocimiento: Web Speech API / SpeechKit / Azure Speech / Google Speech / Flutter speech package
- Capa de intención: parser local + servicio de NLP
- Capa de validación: reglas de negocio por entidad
- Capa de persistencia: creación de fichajes, incidencias, notas o tareas
- Capa de auditoría: registro de quién habló y qué se creó

### 10.2. Reconocimiento recomendado

Para móvil, la mejor estrategia es combinar:

- reconocimiento nativo del dispositivo para frases cortas,
- y un motor de parsing local para comandos estructurados.

Esto reduce latencia y dependencia de red.

### 10.3. Parser de comandos

Debe aceptar:

- frases naturales,
- frases cortas estructuradas,
- sinónimos comunes,
- variaciones en orden de palabras,
- un conjunto definido de comandos por módulo.

Ejemplo:

- “Incidencia falta de material en obra Norte”
- “obra Norte, falta material”
- “falta material en Norte”

Todas deberían mapearse a la misma intención: `create_incidence`.

## 11. Reglas de negocio para comandos por voz

### 11.1. Validación antes de guardar

La app no debe guardar automáticamente una frase ambigua. Debe confirmar:

- la obra correcta,
- la persona correcta,
- el tipo de registro,
- la hora,
- la prioridad.

### 11.2. Reglas de seguridad

- no se debe crear registros sin usuario autenticado,
- no se debe ejecutar una acción de alta prioridad sin confirmación visual,
- no se debe guardar información irrelevante si la intención es ambigua,
- se debe registrar la fuente de creación: `voice_input`.

### 11.3. Auditoría de comandos por voz

Entidad nueva `AuditoriaVozComando` (append-only: sin edición ni borrado salvo admin), un registro por comando:

| Campo | Contenido |
| --- | --- |
| `usuario` / `usuario_rol` | Email y rol de quien dicta |
| `fecha_hora` | Timestamp del dictado |
| `texto_reconocido` | Lo que devolvió el reconocimiento del navegador |
| `texto_editado` | Texto final si el usuario corrigió antes de guardar |
| `intencion` | `create_fichaje`, `create_incidence`, `create_task`, `create_note`, `update_work_status` |
| `parametros` | JSON con obra, hora, prioridad, cantidades… |
| `confianza` | 0-1 del parser; 0 si se usó respaldo IA |
| `usado_ia` | True si hubo respaldo IA |
| `confirmado` / `editado` | Si el usuario aceptó tal cual o corrigió |
| `entidad_destino` / `registro_id` | Qué se creó y con qué id |
| `resultado` / `error` | Guardado correcto o motivo del rechazo (ausencia, jornada abierta…) |
| `origen` | `app` u `offline` (encolado) |

Esta entidad es también la fuente de los KPI del apartado 15: tiempo medio de alta, tasa de confirmación sin edición y adopción por perfil.

## 12. Recomendación de vocabulario controlado

Para que el sistema sea fiable, se recomienda combinar lenguaje natural con vocabulario controlado.

Ejemplos de dictionary:

- acciones: entrada, salida, incidencia, nota, tarea, revisión, pausa, finalizado
- tipos de obra: obra Norte, Sur, Centro, etc.
- tipos de incidencia: material, maquinaria, lluvia, retraso, seguridad
- estados: listo, en pausa, en proceso, finalizado, pendiente

Esto mejora la precisión sin limitar demasiado al usuario.

## 13. Propuesta de módulo de voz y su integración

### 13.1. Módulo `voice_assistant`

Funciones:

- `activateListening()`
- `stopListening()`
- `transcript()`
- `parseCommand(text)`
- `buildIntent(record)`
- `confirmAndSave()`
- `fallbackKeyboardEdit()`

### 13.2. Integración con módulos actuales (mapeo real, no hipotético)

| Intención | Entidad destino real | Campos que rellena |
| --- | --- | --- |
| `create_fichaje` (entrada) | `Fichaje` + `RegistroHorarioLegal` provisional | `operario_id` (del vínculo), `date`, `hora_entrada`, `obra_id`/`obra_name`, `notas`, `origen = 'voz'` |
| `create_fichaje` (salida / pausa) | `Fichaje` (actualiza el abierto) | `hora_salida`, `pausa_inicio`, `pausa_fin`, `horas_trabajadas` |
| `create_incidence` | `AsistenteTarea` | `titulo`, `descripcion`, `tipo = 'alerta'`, `prioridad`, `modulo`, `contexto_ia` con la obra |
| `create_task` / `create_checklist_item` | `AsistenteTarea` | `titulo`, `tipo = 'tarea_manual'`, `estado` (`pendiente`/`completada`), `entidad_relacionada_*` |
| `create_note` (apunte de jornada) | `ApunteHorario` | `concepto`, `cantidad`, `unidad`, `notas`, `obra_id`/`obra_name`, `date` |
| `create_note` (parte del día) | `ParteDiarioObra` | `trabajos_realizados`, `trabajos_pendientes`, `materiales_necesarios` |
| `update_work_status` | `Obra` / `SolarObra` | notas de estado y avance (nunca cambios de fechas ni de importes por voz) |

Sin entidad `Incidencia` ni `Tarea` propias: se descarta crearlas para no duplicar lógica con `AsistenteTarea`.

### 13.3. Módulo `voice_assistant` — piezas reales a crear

- `src/lib/vozCatalogo.js`: diccionario controlado (acciones, tipos de incidencia, estados, prioridades) y mapa intención → entidad destino.
- `src/lib/vozParser.js`: parser local determinista (texto → intención + parámetros + confianza).
- `src/hooks/useVozComando.js`: orquesta captura (reutiliza `useSpeechInput`), parsing, resolución de contexto (obras activas, jornada abierta, vínculo del trabajador) y confirmación.
- `src/components/voz/VozComandoButton.jsx` y `VozComandoSheet.jsx`: micrófono fijo y tarjeta de confirmación con texto editable y chips.
- `src/lib/vozGuardar.js`: guarda en la entidad destino reutilizando validaciones existentes y escribe la auditoría.
- Entidad `AuditoriaVozComando`: trazabilidad completa de cada comando (ver 11.3).

## 14. Beneficios esperados

- reducción drástica del tiempo de entrada desde móvil
- menos errores de escritura
- mejor flujo de trabajo en obra
- menos carga mental para el técnico
- más velocidad en registro de incidencias y fichajes
- mayor precisión cuando el vocabulario está controlado

## 15. KPI para valorar la implementación

- tiempo medio para crear un fichaje desde móvil
- tiempo medio para registrar una incidencia
- tasa de confirmación directa sin edición
- tasa de reconocimiento correcto
- tasa de corrección manual por usuario
- adopción del uso de voz por perfil
- reducción de errores en formularios

## 16. Fases de implementación revisadas

Estimación total: **7-10 días** de desarrollo más pruebas en obra. Cada fase deja algo usable; ninguna abre frentes a medias.

### Fase 0 — Cimientos: auditoría y mapa de intenciones (0,5 día)

- Entidad `AuditoriaVozComando` con la estructura del apartado 11.3 y RLS: lectura admin/propietario/gerencia/administración, creación para cualquier usuario autenticado, sin edición ni borrado salvo admin.
- `src/lib/vozCatalogo.js`: diccionario controlado (acciones, tipos de incidencia, estados, prioridades) y mapa intención → entidad destino del apartado 13.2.
- Cierre del mapeo incidencia/tarea/estado sobre `AsistenteTarea` y `Obra`.

**Salida**: nada visible para el técnico, pero toda la voz queda trazada desde el primer comando y los KPI son medibles.

### Fase 1 — MVP: fichaje y aviso por voz (2-3 días)

- `src/lib/vozParser.js` para un conjunto cerrado de comandos: entrada, salida, pausa, incidencia/aviso, prioridad y nota libre.
- `src/components/voz/VozComandoButton.jsx`: micrófono fijo en acciones rápidas del layout, visible en móvil y escritorio.
- `VozComandoSheet.jsx`: tarjeta con texto reconocido editable, chips de obra y de trabajador cuando haya ambigüedad, y botones Guardar / Editar / Descartar.
- `src/lib/vozGuardar.js`: alta de `Fichaje` reutilizando `calcularHoras`, `origen = 'voz'`, obra tomada de la jornada abierta o elegida por chips; `conflictoAusencias` antes de guardar; hora real con marca de **hora declarada** si se dictó otra; aviso si ya hay jornada abierta o si la salida no tiene entrada.
- Aviso por voz → `AsistenteTarea` tipo `alerta` con prioridad.
- Funciona en Android e iOS con el mismo código; si el dictado falla, el flujo cae al formulario manual con el texto ya escrito.

**Salida**: un técnico ficha y reporta una incidencia en dos toques y una frase.

### Fase 2 — Parser reforzado y contexto (2 días)

- Sinónimos y variaciones de orden ("falta material en Norte" / "obra Norte, falta material").
- Resolución de obra por nombre aproximado contra las obras activas del usuario (comparación tolerante a tildes y errores de reconocimiento).
- Sugerencias por contexto: última obra fichada, jornada abierta (el micrófono ofrece solo "salida"), obras de hoy.
- Extracción de cantidades y tiempos ("12 paneles", "80 por ciento", "a las 8:15").
- Respaldo por IA (`InvokeLLM`) **solo** con confianza baja, con confirmación explícita y aviso de coste.

**Salida**: frases naturales habituales se interpretan sin edición en la mayoría de casos.

### Fase 3 — Productividad real (2-3 días)

- Apuntes de obra por voz → `ApunteHorario` (concepto, cantidad, unidad) y notas de jornada.
- Partes diarios: trabajos realizados y pendientes → `ParteDiarioObra` en borrador, editables antes de cerrar.
- Estado de obra por voz → notas/estado de `Obra`, sin tocar fechas ni importes.
- Tareas y checklist → `AsistenteTarea` tipo `tarea_manual`, incluyendo marcar completada.
- Encadenado con la cola offline existente: si no hay cobertura al confirmar, el registro se encola y se sincroniza.

**Salida**: el 80% del registro diario de un técnico se puede dictar.

### Fase 4 — Optimización y medición (continuo)

- Atajos por contexto frecuente y estados del día (mañana entrada, mediodía pausa, tarde salida).
- Diccionario por obra/cliente con los nombres reales que usa la plantilla.
- Cuadro de KPIs alimentado por `AuditoriaVozComando`: tiempo medio de alta, tasa de confirmación sin edición, tasa de corrección, uso por perfil y errores más frecuentes.
- Ajuste del lexicón con los comandos que realmente fallan, no con supuestos.

### Riesgos asumidos y mitigación

| Riesgo | Mitigación |
| --- | --- |
| Ruido de obra y reconocimiento inexacto | Confirmación visual obligatoria siempre |
| Obras con nombres parecidos | Chips de selección y comparación tolerante |
| Micrófono denegado | Diálogo y preferencia que ya existen en la app |
| Frases ambiguas | Nunca se guarda sin confirmar; sin datos inventados |
| Uso indebido de fichajes por voz | Hora real + marca de declarada + auditoría con autor |

## 17. Recomendación final

La propuesta recomendada no es un asistente de voz “genérico”, sino un sistema de dictado de intención para la app de obra y control horario, especialmente pensado para móvil y para técnicos que están trabajando en campo.

La clave radica en esta fórmula:

- voz + intención + confirmación + edición mínima

Eso permite:

- reducir mucho la fricción,
- mantener alta calidad de datos,
- evitar registros erróneos,
- y crear una experiencia realmente útil para técnicos en movimiento.

## 18. Conclusión

El uso de comandos por voz puede transformar el flujo de trabajo del técnico en móvil, especialmente para:

- fichajes,
- incidencias,
- notas rápidas,
- estados de obra,
- tareas y checklist.

La mejor implementación es combinar voz con confirmación visual, una gramática controlada y reglas de negocio estrictas para que la app sea rápida pero fiable.

---

Proyecto: `cazacumariandorin-sudo/smart-gestion`
Fecha: 2026-10-29
Actualizado: 2026-11-16 — verificación contra el código real (apartado 2.1), mapeo a entidades existentes (13.2), auditoría concreta (11.3) y fases cerradas (16).
