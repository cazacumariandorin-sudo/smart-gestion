# Propuesta · Notificaciones push reales para técnicos — **Fase Android**

**Fecha:** 2026-11-16 · **Ámbito:** avisos al móvil del técnico · **Alcance de esta fase:** solo Android · **Estado:** propuesta para estudio y aprobación

> Documento de decisión. La implementación paso a paso está en `docs/GUIA_IMPLEMENTACION_PUSH_ANDROID.md`.

---

## 1. Resumen ejecutivo

Hoy un técnico **no se entera de nada si no tiene la app abierta**. El chat actualiza la conversación en tiempo real, pero el envío de email se desactivó a propósito y no existe ningún canal push. Las alarmas de fichaje usan la API de notificaciones del navegador, que solo dispara con la app viva.

Para que el móvil suene con la app cerrada y el aviso aparezca **encima de WhatsApp, Maps o la cámara**, hace falta push nativo. **En esta fase se hace solo para Android**, con Firebase. iOS queda fuera, con coste y calendario propios (ver §3).

Dos ideas que condicionan todo el proyecto:

1. **El 70% del trabajo no es código**, son credenciales, generación de la app Android y distribución en los móviles de la plantilla.
2. **Una notificación que se ignora es peor que ninguna.** El diseño (agrupación, prioridades, silencio nocturno) no es estética: es lo que evita la fatiga de avisos y el gasto descontrolado.

---

## 2. Estado actual verificado en código

| Elemento | Situación real |
|---|---|
| `public/manifest.json` | Existe, `display: standalone`, iconos 192/512. La web se puede instalar como PWA. |
| Service worker | **No hay ninguno** en `public/`. Sin SW no hay push web en segundo plano. |
| `src/hooks/useAlarmas.js` | Usa `new Notification(...)` / `reg.showNotification(...)`: solo funciona con la app abierta. |
| `base44/functions/notificarNuevoMensaje` | Actualiza el último mensaje de la conversación. **El email está desactivado a propósito** (comentario en el propio código) para no spamear. |
| `SendPushNotification` | **Cero usos** en todo el backend. |
| `NotificacionFichaje` | Entidad interna (`operario_id`, `date`, `tipo`, `descripcion`, `visto`, `resuelto`): se ve **dentro** de la app, no avisa al móvil. |
| Build nativo | Lo que puedo leer no muestra el estado de la app móvil. Se gestiona en **Publish → Mobile app**. |

**Conclusión:** no falta diseño, falta el canal. Todo lo que hay hoy es "avisos que se ven cuando entras". El objetivo de la fase es "avisos que te hacen entrar".

---

## 3. Alcance: por qué solo Android ahora

| Criterio | Android (esta fase) | iOS (fase siguiente) |
|---|---|---|
| Coste de entrada | **0 €**: cuenta de Google + proyecto Firebase (plan Spark gratuito) | Apple Developer Program, membresía anual |
| Credenciales | `google-services.json` + clave de servicio de Firebase | Clave APNs `.p8` + Key ID de 10 caracteres |
| Instalación en campo | Enlace de pruebas: instalar sin pasar por tienda | En iOS el enlace de pruebas depende del programa de Apple |
| Generación de archivos | Flujo Google Play de Base44 | Flujo App Store de Base44 |
| Riesgo técnico | Bajo: FCM entrega aunque el sistema cierre la app | Medio: permisos, revisión de Apple |

**Decisión propuesta:** lanzar Android con los técnicos que ya usan móvil Android, medir adopción y reabrir iOS cuando el canal esté probado y con datos de uso.

**Consecuencia que hay que asumir en esta fase:** los técnicos con iPhone **no recibirán push**. Para ellos se mantiene el aviso interno en la app y, si se quiere, un email puntual de los avisos de prioridad alta. Conviene saber cuántos son antes de decidir (ver §5, inventario).

---

## 4. Cómo se diseña un aviso que se lee de verdad

**Contenido**
- Título corto y accionable: `Nuevo aviso · Obra Norte`, `Falta material · Solar Getafe`.
- Cuerpo de una línea y sin datos sensibles: `Jorge: revisa el cuadro antes de las 14:00`. Nunca importes, DNI ni contenido del chat cifrado en la pantalla de bloqueo.
- En chat: autor + "tienes un mensaje". El contenido se lee al abrir.

**Comportamiento**
- **Deep link** al abrir: pantalla exacta (conversación concreta, aviso, fichaje del día), nunca el dashboard.
- **Agrupación** por conversación/obra: cinco mensajes seguidos son un aviso que se actualiza, no cinco.
- **Canal de importancia alta** en Android, con sonido propio y vibración (el sistema permite silenciarlo por el usuario; se documenta en el aviso a la plantilla).
- **Horario silencioso** 22:00–07:00 para avisos normales; solo urgencias lo rompen. Alinea con el derecho a la desconexión digital (art. 20 bis ET) y evita que la plantilla silencie el canal entero.
- **Sin reenvíos en cadena**: un aviso no leído aparece en el resumen de la mañana.
- **Acción rápida** cuando aplique ("Confirmar jornada", "Ver aviso") desde la propia notificación.

---

## 5. Inventario previo (1 hora de trabajo, evita decisiones a ciegas)

Antes de invertir en credenciales conviene responder con datos:

1. ¿Cuántos técnicos en plantilla? ¿Cuántos con Android y cuántos con iPhone?
2. ¿Qué eventos generan hoy más ruido interno? (chat, incidencias, huecos de fichaje)
3. ¿Qué avisos se están resolviendo hoy por teléfono o WhatsApp? Ese es el ahorro real.
4. ¿Quién administra la cuenta de Google de la empresa? Es quien creará el proyecto Firebase.
5. ¿Se va a distribuir por enlace de pruebas o se quiere publicar en Google Play?

Sin estos datos la fase se puede ejecutar, pero no se podrá justificar el retorno.

---

## 6. Arquitectura propuesta sobre lo existente

### 6.1 Entidad `NotificacionPush` (registro de envíos)

Registra cada intento: destinatario, tipo, título, cuerpo, prioridad, enlace, resultado y causa del fallo. Es a la vez **auditoría**, **base de las reglas anti-spam** y la única forma de diagnosticar sin acceso al móvil.

Campos, RLS y esquema listos para pegar: ver `docs/GUIA_IMPLEMENTACION_PUSH_ANDROID.md` §6.

### 6.2 `enviarPush` — puerta única de salida

Función backend que, antes de enviar: valida destinatario activo, aplica horario silencioso y prioridad, agrupa por hilo, limita envíos por usuario y hora, llama a `Core.SendPushNotification` y guarda el resultado. Nunca se llama al push desde el navegador (devuelve 403) ni se construye una llamada paralela en cada módulo.

Detalle: **1 crédito por envío**.

### 6.3 Disparadores, por orden de valor

| Orden | Disparador | Entidad / función existente |
|---|---|---|
| 1 | Mensaje directo del chat | `notificarNuevoMensaje` / `ChatMensaje` |
| 2 | Aviso o incidencia asignada | `AsistenteTarea` |
| 3 | Hueco de fichaje: confirma tu jornada | `NotificacionFichaje` (Fase 5 de control horario) |
| 4 | Ausencia / cancelación de vacaciones resuelta | `FaltaAsistencia`, `SolicitudCancelacionVacacion` |
| 5 | Alarma de fichaje con la app cerrada | `AlarmaHorario` (hoy local) |

Ninguno exige tocar la lógica de negocio de su módulo: o se llama a `enviarPush` desde la función ya existente, o se crea un workflow con trigger de entidad.

---

## 7. Requisitos que dependen de la empresa

1. **Plan Builder o superior** activo (los archivos de la app Android solo se descargan desde ahí).
2. **Cuenta de Google** con acceso a la consola de Firebase.
3. **Proyecto Firebase** creado (plan Spark gratuito es suficiente) con la app Android registrada con el package name que indique Base44.
4. **`google-services.json`** descargado.
5. **Clave de servicio** de Firebase (`.json`) generada y guardada en un sitio seguro.
6. Generar los archivos Android en **Publish → Mobile app → Google Play**, subiendo ambos JSON.
7. Instalar la app en los móviles (enlace de pruebas o tienda) y **avisar a la plantilla de actualizar**.
8. Verificar con un envío de prueba al móvil del responsable antes de abrir el canal a todos.

Sin los puntos 1-3 no se puede probar nada: el envío falla y no hay forma de simularlo desde la web.

---

## 8. Coste y control del gasto

Cada envío cuesta **1 crédito**. Un push por mensaje de chat es la forma más rápida de multiplicar el consumo sin aportar valor:

- 20 técnicos × 15 avisos/día ≈ 300 envíos/día → unos 9.000 al mes.
- Con agrupación por hilo y resumen de no leídos, lo habitual es bajar a 30-60 al día: un orden de magnitud menos.

Por eso agrupación y límite por hora son **control de coste**, no decoración. El consumo real se consulta en Plan y billing; no se estima desde aquí.

---

## 9. Fases

| Fase | Contenido | Responsable | Estimación |
|---|---|---|---|
| **0** | Inventario de plantilla, proyecto Firebase, credenciales, generar app Android, instalar y prueba de humo | Empresa + desarrollo | 1-2 días |
| **1** | Entidad `NotificacionPush`, función `enviarPush` (silencio, agrupación, límites), enlaces a pantalla | Desarrollo | 1-2 días |
| **2** | Disparadores 1 y 2 (chat y avisos) | Desarrollo | 1 día |
| **3** | Disparadores 3-5 (hueco de fichaje, ausencias, alarmas) y acción rápida | Desarrollo | 1-2 días |
| **4** | Medición (enviados, abiertos, tiempo hasta leer) y ajuste de ruido | Desarrollo | 0,5 día |
| **iOS** | Credenciales Apple, build y prueba | Fuera de esta fase | — |

La Fase 0 no bloquea escribir el código de la Fase 1, pero **nada llega al técnico hasta que exista app Android instalada con credenciales**.

---

## 10. Cómo se mide si funciona

- % de push abiertos en menos de 5 minutos.
- Tiempo medio desde incidencia asignada hasta primera respuesta del técnico.
- Llamadas/WhatsApps de "¿qué pasa en esta obra?" que desaparecen.
- Días de hueco de fichaje cubiertos (enlaza con la Fase 5 de control horario).
- Técnicos que silencian el canal o deniegan permisos: si sube, el contenido es demasiado ruidoso.

---

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Técnico deniega el permiso (Android 13+ lo pide aparte) | Pedirlo tras una acción con valor (abrir un aviso) y explicar para qué |
| Móvil sin la app Android instalada | Aviso interno + email mientras convive la web; campaña de instalación con enlace de pruebas |
| Técnicos con iPhone | Asumido: sin push en esta fase; se les mantiene aviso interno |
| Fatiga de notificaciones | Agrupación, prioridades y silencio nocturno desde la Fase 1 |
| Datos sensibles en pantalla bloqueada | El cuerpo nunca lleva contenido del chat cifrado ni importes |
| Fallo silencioso del envío | `NotificacionPush` guarda error y causa: se diagnostica sin tocar el móvil |
| Coste inesperado | Límite por usuario/hora y agrupación por hilo |
| Desconexión digital / malestar de la plantilla | Silencio nocturno por defecto y aviso por escrito de qué se notifica y qué no |

---

## 12. Fuera de alcance de esta fase

- iOS (APNs, Apple Developer, flujo App Store).
- Push web con VAPID y service worker propio (no aporta sobre Android nativo y no resuelve iOS).
- Canales WhatsApp/Telegram: alternativa posterior para urgencias.
- Publicación obligatoria en Google Play: el enlace de pruebas cubre la fase de validación.
