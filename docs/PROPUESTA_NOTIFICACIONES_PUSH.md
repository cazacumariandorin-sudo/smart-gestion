# Propuesta · Notificaciones push reales para técnicos

**Fecha:** 2026-11-16 · **Ámbito:** avisos al móvil del técnico · **Estado:** propuesta, pendiente de aprobación y de credenciales

---

## 1. Resumen ejecutivo

Hoy un técnico **no se entera de nada si no tiene la app abierta**. El chat actualiza la conversación en tiempo real, pero las notificaciones por email se desactivaron a propósito y no existe ningún envío push. Las alarmas de fichaje usan la API de notificaciones del navegador, que solo dispara con la pestaña viva.

Para que el móvil suene con la app cerrada y el aviso aparezca **encima de WhatsApp, Maps o la cámara**, hace falta **push nativo**: la app instalada en iOS/Android, con credenciales de Apple (APNs) y de Firebase. Es el único camino que funciona en iPhone. En Android existe una alternativa web parcial, pero no cubre el objetivo.

Lo importante: la parte de código es la más pequeña. **El 70% del trabajo está en credenciales, build y distribución**, y sin ellas cualquier llamada de push falla.

---

## 2. Estado actual verificado en código

| Elemento | Situación real |
|---|---|
| `public/manifest.json` | Existe, `display: standalone`, iconos 192/512. La app se puede instalar como PWA. |
| Service worker | **No hay ninguno** en `public/`. Sin SW no hay push en segundo plano. |
| `src/hooks/useAlarmas.js` | Usa `new Notification(...)` / `reg.showNotification(...)`: solo funciona con la app abierta. Ya contempla el permiso en iOS 16.4+. |
| `base44/functions/notificarNuevoMensaje` | Actualiza el último mensaje de la conversación. **El envío de email está desactivado a propósito** (comentario en el propio código) para no spamear. |
| `SendPushNotification` | **Cero usos** en todo el backend. |
| `NotificacionFichaje` | Entidad interna (`operario_id`, `date`, `tipo`, `descripcion`, `visto`, `resuelto`): se ve **dentro** de la app, no avisa al móvil. |
| Build nativo | Lo que puedo leer no muestra el estado de la app móvil. Se gestiona en **Publish → Mobile app**. |

**Conclusión:** no falta diseño, falta el canal. Todo lo que hay hoy es "avisos que se ven cuando entras". El objetivo es "avisos que te hacen entrar".

---

## 3. Los dos caminos posibles

### A. Push nativo (recomendado — es el único que cumple el objetivo)

La app se genera como aplicación iOS/Android desde **Publish → Mobile app** y se envía mediante `Core.SendPushNotification` desde una función backend.

Lo que da: suena con la app cerrada, aparece sobre cualquier otra app, se ve en la pantalla de bloqueo, abre la pantalla exacta al tocar, funciona en iPhone y Android, y sobrevive a que el sistema mate la app.

Lo que exige:

- **iOS:** membresía activa de Apple Developer Program, clave APNs (`.p8`) y su Key ID de 10 caracteres. En el flujo de archivos de App Store se activa **Add push notifications**, se sube el `.p8` y se indica el Key ID. Es una clave distinta de la de App Store Connect.
- **Android:** cuenta de Google y proyecto propio de Firebase; registrar la app con el package name que indica Base44 y subir `google-services.json` y la clave de servicio (`.json`). El plan gratuito Spark de Firebase es suficiente.
- Los archivos de tienda requieren **plan Builder o superior** para descargarse.
- La versión con push hay que **publicarla en tienda o instalar por el enlace de pruebas**: quien ya tiene la app instalada recibe push tras actualizar a esa versión.
- El técnico debe tener **la sesión iniciada** en la app nativa. El push se dirige por usuario, no por token: no hay que gestionar tokens ni dispositivos.

### B. Web / PWA (refuerzo parcial, no sustituye a A)

- API de notificaciones del navegador: **solo con la app abierta** (lo que ya hace `useAlarmas`).
- Para push con la web cerrada en Android haría falta service worker + Web Push con claves VAPID propias. La plataforma **no ofrece ese servicio**: `SendPushNotification` es exclusivamente nativo. Habría que montar la infraestructura al margen.
- **iOS Safari no lo cubre** de forma fiable para uso diario en campo.

**Decisión propuesta:** A como vía real; B solo si más adelante se quiere reforzar Android sin depender de la tienda. No se propone invertir en B ahora.

---

## 4. Cómo se diseña un aviso que se lee de verdad

Una notificación que se ignora es peor que ninguna: el técnico aprende a descartarlas. Reglas de contenido y comportamiento:

**Contenido**
- Título corto y accionable: `Nuevo aviso · Obra Norte` o `Falta material · Solar Getafe`.
- Cuerpo de una línea, sin datos sensibles: `Jorge: revisa el cuadro de protecciones antes de las 14:00`. Nada de importes, DNI ni diagnósticos en la pantalla de bloqueo.
- Nunca el mensaje cifrado completo del chat: el cuerpo muestra autor y "tienes un mensaje", el contenido se lee al abrir.

**Comportamiento**
- **Deep link** obligatorio: tocar abre la pantalla exacta (conversación concreta, aviso, fichaje del día), no el dashboard.
- **Agrupación** por conversación/obra: 5 mensajes seguidos no generan 5 avisos, uno que se actualiza (`tag`/`collapse`).
- **Canal de importancia alta en Android** con sonido propio y vibración; en iOS alerta con sonido y badge con el pendiente.
- **Horario silencioso** 22:00–07:00 para avisos normales; solo las urgencias (incidencia crítica, hueco de fichaje del día) pueden romperlo.
- **Sin reenvíos en cadena**: un aviso no leído aparece en el resumen de la mañana, no cada 15 minutos.
- **Acción rápida** cuando aplique: "Confirmar jornada" o "Ver aviso" directamente desde la notificación.

---

## 5. Qué se notifica y con qué prioridad

| Evento | Prioridad | Rompe silencio nocturno |
|---|---|---|
| Mensaje directo del chat (1:1) | Alta | Solo si urgente |
| Mensaje en grupo (mismo grupo) | Normal, agrupado | No |
| Aviso/incidencia asignada | Alta | Sí si crítica |
| Hueco de fichaje: confirma tu jornada (Fase 5 de control horario) | Alta | No (se envía a las 24 h) |
| Aprobación o rechazo de ausencia/cancelación de vacaciones | Normal | No |
| Cambio en su parte diario o en su obra del día | Normal | No |
| Alarma de fichaje configurada por él | Alta | Sí (la elige él) |
| Recordatorio de revisiones de flota | Baja | No |

Lo que **no** debe generar push: cada nota de gasto, cada registro de material, el cierre de ciclo mensual, cambios administrativos sin impacto en su jornada.

---

## 6. Arquitectura propuesta sobre lo existente

Tres piezas, ninguna nueva de concepto:

### 6.1 Entidad `NotificacionPush` (registro de envíos)

| Campo | Uso |
|---|---|
| `user_id` / `user_email` | Destinatario |
| `tipo` | `chat_mensaje`, `aviso_incidencia`, `hueco_fichaje`, `ausencia`, `alarma`, `parte`, `otro` |
| `titulo` / `cuerpo` | Lo que ve el técnico |
| `deep_link` | Ruta que se abre al tocar |
| `prioridad` | `alta` / `normal` / `baja` |
| `estado` | `enviado` / `fallido` / `sin_dispositivo` / `omitido_silencio` / `agrupado` |
| `error` | Motivo del fallo (sin build, permisos, sesión) |
| `origen_id` | Id del mensaje/aviso que lo provocó (para no duplicar) |
| `leido_en` | Cuando el usuario abrió la pantalla destino |

RLS: lectura para el propio usuario y para admin/gerencia/administración; sin edición ni borrado salvo admin. Es la auditoría que hoy no existe y la base de los límites anti-spam.

### 6.2 `enviarPush` — puerta única de salida

Una función backend, llamada siempre del lado servidor (`asServiceRole`), que antes de enviar:

1. comprueba que el destinatario existe y está activo,
2. aplica horario silencioso y prioridad,
3. agrupa por `origen_id` si ya hay un envío reciente del mismo hilo,
4. limita envíos por usuario y hora (evita ráfagas al subir 30 fotos),
5. llama a `Core.SendPushNotification({ user_id, title, content })`,
6. guarda el resultado en `NotificacionPush`, incluido el fallo y su causa.

Nunca se llama al push desde el navegador (devuelve 403) ni se construye una llamada paralela en cada módulo.

### 6.3 Disparadores (enganchados a lo que ya existe)

- `notificarNuevoMensaje` → push al destinatario del mensaje (hoy solo actualiza la conversación).
- `AsistenteTarea` asignada → push al técnico.
- `NotificacionFichaje` creada → push (incluido el aviso de hueco de las 24 h).
- `FaltaAsistencia` / `SolicitudCancelacionVacacion` resueltas → push al interesado.
- `AlarmaHorario` → se mantiene local para el técnico que tiene la app abierta y se añade push para cuando está cerrada.

Todas estas entidades son entidades normales: el disparador puede ser una llamada directa desde la función existente o un workflow con trigger de entidad, sin tocar la lógica de negocio de cada módulo.

---

## 7. Checklist que depende de la empresa (antes de escribir código)

1. **Plan Builder o superior** activo en el workspace.
2. **Apple Developer Program** activo (membresía anual a tu cargo).
3. **Clave APNs `.p8` + Key ID** creadas en el portal de Apple.
4. **Proyecto Firebase** creado; app Android registrada con el package name que muestre Base44; descargados `google-services.json` y la clave de servicio.
5. Generar los archivos de tienda en **Publish → Mobile app**, activando push en ambos flujos.
6. Publicar la versión con push (tienda o enlace de pruebas) y avisar a la plantilla de actualizar.
7. Verificar con un envío de prueba a tu propio usuario antes de abrir el canal a los técnicos.

Sin los puntos 2-4 no se puede probar nada: el envío falla y no hay forma de simularlo desde la web.

---

## 8. Coste y control del gasto

Cada envío cuesta **1 crédito**. Un push por mensaje de chat es la forma más rápida de multiplicar el consumo sin aportar valor:

- 20 técnicos × 15 avisos/día ≈ 300 envíos/día → unos 9.000 al mes.
- Con agrupación por hilo y resumen de no leídos, lo habitual es bajar a 30-60 al día: un orden de magnitud menos.

Por eso la agrupación y el límite por hora no son "extras de diseño": son el control de coste. Tu consumo real se consulta en Plan y billing; no lo estimo desde aquí.

---

## 9. Fases

| Fase | Contenido | Estimación |
|---|---|---|
| **0** | Credenciales, build con push y prueba de envío a tu usuario (depende de la empresa) | 1-2 días, en paralelo |
| **1** | Entidad `NotificacionPush`, función `enviarPush` con silencio, agrupación y límites, deep links | 1-2 días |
| **2** | Disparadores: chat, avisos/incidencias, hueco de fichaje, ausencias | 1-2 días |
| **3** | Prioridades, canal Android, acción rápida "Confirmar jornada", resumen de no leídos | 1 día |
| **4** | Medición: enviados, abiertos, tiempo medio hasta leer | 0,5 día |

La Fase 0 no bloquea las demás: la función se puede escribir y probar contra un envío fallido, pero **nada llega al técnico hasta que exista build con credenciales**.

---

## 10. Cómo se mide si funciona

- % de push abiertos en menos de 5 minutos.
- Tiempo medio desde incidencia asignada hasta primera respuesta del técnico.
- Mensajes de chat leídos sin abrir la app manualmente.
- Días de hueco de fichaje cubiertos (enlaza con la Fase 5 de control horario).
- Bajas de notificaciones o técnicos con permisos denegados: si sube, el contenido es demasiado ruidoso.

---

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El técnico deniega el permiso en el primer arranque | Pedirlo tras una acción con valor (abrir un aviso), no al instalar; pantalla que explique para qué |
| Móvil sin la app nativa instalada | Aviso interno + email mientras convive la web; campaña de instalación con enlace de pruebas |
| Fatiga de notificaciones | Agrupación, prioridades y silencio nocturno desde la Fase 1 |
| Datos sensibles en pantalla bloqueada | El cuerpo nunca lleva contenido del chat cifrado ni importes |
| Ahorro de batería de Android mata procesos | FCM entrega aunque el sistema cierre la app; no depender de la app abierta |
| Fallo silencioso del envío | `NotificacionPush` guarda el error y el motivo: se puede diagnosticar sin acceso al móvil |
| Coste inesperado | Límite por usuario/hora y agrupación por hilo |

---

## 12. Fuera de alcance

- Push web con VAPID y service worker propio (no resuelve iOS; se valora solo si se quiere reforzar Android sin tienda).
- Canales WhatsApp/Telegram para avisos: alternativa razonable para casos urgentes, se decide después de tener push funcionando.
- Notificaciones programadas por el propio técnico más allá de las alarmas de fichaje que ya existen.
