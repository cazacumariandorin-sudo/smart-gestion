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

Debe registrarse:

- usuario,
- fecha/hora,
- texto original hablado,
- texto reconocido,
- intención interpretada,
- resultado final,
- si fue confirmado o editado por usuario.

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

### 13.2. Integración con módulos actuales

- `Fichaje` -> comando de hora entrada/salida
- `Incidencia` -> comando de creación de incidencia
- `ApunteHorario` -> comando de nota o apunte
- `Obra` -> comando de estado o avance
- `Tarea` -> comando de creación de tarea o checklist

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

## 16. Fases recomendadas de implementación

### Fase 1: mínimo viable

- voz para fichajes y incidencias
- frases cortas
- confirmación visual
- validación simple
- soporte para móvil Android/iOS

### Fase 2: reforzamiento del parser

- reconocimiento por intención
- extracción de obra, operativo y nota
- sistema de sugerencias por contexto
- mejoras de precisión y sinónimos

### Fase 3: productividad real

- tareas por voz
- notas de obra
- checklist por voz
- integración con historial y auto-completado

### Fase 4: auto-asistencia y optimización

- comandos por contextos frecuentes
- aprendizaje por usuario
- mejora de diccionario por sector/obra
- acciones con una sola frase para el 80% de casos repetitivos

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
