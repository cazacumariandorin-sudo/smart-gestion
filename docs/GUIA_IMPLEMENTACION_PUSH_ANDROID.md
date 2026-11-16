# Guía práctica · Push Android para técnicos (implementación)

**Fecha:** 2026-11-16 · **Fase:** Android únicamente · **Acompaña a:** `docs/PROPUESTA_NOTIFICACIONES_PUSH.md`

Documento de trabajo en dos partes:
- **Parte A — Configuración (lo hace la empresa)**: pasos 1 a 8. Sin esto no llega ningún aviso.
- **Parte B — Código y operación (lo hace desarrollo)**: pasos 9 a 14, con esquema de datos, función de envío, pruebas y diagnóstico.

> El código de la Parte B es **de referencia**: describe exactamente lo que se escribirá al aprobar la propuesta. En este repositorio todavía no existe.

---

# PARTE A — Configuración

## Paso 1 · Requisitos y quién hace qué

| Tarea | Empresa | Desarrollo |
|---|---|---|
| Activar plan Builder o superior | ✔ | |
| Crear proyecto Firebase | ✔ | |
| Obtener package name de Base44 | | ✔ |
| Subir credenciales en el flujo Google Play | ✔ | |
| Generar la app Android | ✔ | |
| Instalar la app en los móviles | ✔ | |
| Función de envío, entidad y disparadores | | ✔ |
| Prueba de humo y diagnóstico | | ✔ |

**Material necesario:** cuenta de Google corporativa, acceso al editor de la app con permisos de publicación, y los móviles Android de, al menos, dos técnicos para la prueba.

---

## Paso 2 · Confirmar el plan

Los archivos de la app Android solo se descargan con **plan Builder o superior**. Se comprueba en el workspace (Plan y billing). Si el plan no alcanza, este es el único bloqueo económico del proyecto: Firebase en plan Spark es gratuito y no requiere tarjeta.

---

## Paso 3 · Crear el proyecto Firebase

1. Entrar en la consola de Firebase con la cuenta de Google de la empresa.
2. **Crear proyecto** → nombre reconocible (`smart-gestion-produccion`). Google Analytics es opcional; no hace falta para push.
3. Plan **Spark (gratuito)**. Es suficiente para FCM.

**No** hay que tocar Cloud Messaging a mano ni generar claves VAPID: Base44 usa la mensajería nativa de Android.

---

## Paso 4 · Obtener el package name y registrar la app Android

1. En el editor: **Publish → Mobile app → Google Play**.
2. Base44 muestra el **package name** de la app (formato `com.algo.algo`). **Copiarlo tal cual**, con puntos y sin espacios.
3. En Firebase: **Añadir app → Android**, pegar ese package name, alias `SMART-GESTION`, y registrar.

Un package name equivocado es el error más común: la app se genera, pero FCM no reconoce el destino y el envío falla sin explicación.

---

## Paso 5 · Descargar las dos credenciales

**a) `google-services.json`**
- En Firebase, dentro de la app Android recién creada → descargar `google-services.json`.
- Es un archivo de configuración pública del proyecto, pero no se comparte fuera del equipo.

**b) Clave de servicio (cuenta de servicio)**
- Firebase → ⚙️ **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**.
- Se descarga un `.json`. **Es un secreto**: no se envía por email ni se sube a Drive compartido. Se guarda en el gestor de contraseñas de la empresa.
- Si se pierde, se revoca y se genera otra; no hay recuperación.

---

## Paso 6 · Generar la app Android en Base44

1. **Publish → Mobile app → Google Play**.
2. Subir `google-services.json` y la clave de servicio cuando los pida el flujo.
3. Generar los archivos (**Build Stores Files**). El resultado es un paquete instalable y el enlace de pruebas.

Errores típicos en este paso:

| Mensaje | Causa | Solución |
|---|---|---|
| Falta `google-services.json` | No subido o subido en el flujo de iOS | Subirlo en el flujo Google Play |
| Package name no coincide | Firebase registrado con otro nombre | Corregir el registro en Firebase y regenerar |
| La build no termina | Plan insuficiente o error de validación | Revisar plan y el detalle del error del flujo |

---

## Paso 7 · Instalar en los móviles

Dos opciones, no excluyentes:

**a) Enlace de pruebas (recomendado en esta fase).** Base44 lo muestra en la sección de la app móvil. Se envía a cada técnico, se instala y ya recibe push. No requiere cuenta de desarrollador ni revisión.

**b) Google Play.** Requiere cuenta de desarrollador de Google y, si la cuenta es nueva, un periodo de pruebas con testers antes de publicar. Tiene sentido cuando el canal esté validado y se quiera actualización automática.

En ambos casos:
- El técnico **debe iniciar sesión** con su usuario de la app: el push se dirige al usuario, no al dispositivo.
- Android 13 o superior pide permiso de notificaciones **aparte**: hay que aceptarlo (ver paso 10).
- Al instalar una versión nueva hay que **abrir la app una vez** para que registre la sesión.

---

## Paso 8 · Prueba de humo (antes de tocar código de negocio)

Se hace desde el editor, con la función de prueba (paso 12), enviando a **tu propio usuario**:

| Resultado | Significado |
|---|---|
| El móvil suena con la app cerrada | Configuración correcta: se puede pasar a la Parte B |
| Error indicando que no hay app nativa / 502 | Build o credenciales mal: revisar pasos 4 a 6 |
| El envío va bien pero no llega | Sesión no iniciada en ese móvil, permiso denegado o fabricante con ahorro de batería agresivo |
| Llega solo con la app abierta | Se está probando contra la web, no contra la app instalada |

---

# PARTE B — Código y operación

## Paso 9 · Destinatario correcto

El push se envía a **`User.id`**, no a `Operario.id`. La cadena es:

```
Operario (ficha laboral) → operario.user_email (o email) → User (por email) → User.id
```

Reglas:
- Si el operario no tiene usuario de la app, no hay push: se marca `sin_dispositivo` y sigue el aviso interno.
- Nunca se envía a un email suelto: `SendPushNotification` trabaja por usuario registrado.
- El destinatario debe estar activo; un usuario desactivado no debe recibir avisos.

---

## Paso 10 · Permiso de notificaciones en el móvil

- Android 13+ exige `POST_NOTIFICATIONS`. Se pide **cuando el técnico va a abrir su primer aviso**, no al instalar.
- Si el técnico lo deniega: el aviso interno sigue funcionando; se registra `omitido_permiso` para poder avisarle después.
- Los canales de Android permiten al usuario silenciar por tipo: por eso el aviso a la plantilla (paso 14) explica qué llega por cada canal.

---

## Paso 11 · Entidad `NotificacionPush` (esquema listo para pegar)

```jsonc
{
  "name": "NotificacionPush",
  "type": "object",
  "description": "Registro append-only de cada push enviado al móvil de un usuario. Guarda el resultado y la causa del fallo para diagnosticar sin acceso al dispositivo. Es también la base de los límites anti-spam.",
  "properties": {
    "user_id": { "type": "string", "description": "ID del User destinatario (no el Operario)." },
    "user_email": { "type": "string", "description": "Email del destinatario (desnormalizado)." },
    "operario_id": { "type": "string", "description": "Operario vinculado, si aplica." },
    "tipo": {
      "type": "string",
      "enum": ["chat_mensaje", "aviso_incidencia", "hueco_fichaje", "ausencia", "alarma", "parte", "prueba", "otro"],
      "enumColors": ["blue", "red", "yellow", "purple", "gray", "green", "gray", "gray"]
    },
    "prioridad": {
      "type": "string",
      "enum": ["alta", "normal", "baja"],
      "enumColors": ["red", "yellow", "gray"],
      "default": "normal"
    },
    "titulo": { "type": "string", "description": "Lo que se muestra como título." },
    "cuerpo": { "type": "string", "description": "Texto visible. Nunca datos sensibles." },
    "deep_link": { "type": "string", "description": "Ruta interna que se abre al tocar (p. ej. /chat?conv=<id>)." },
    "origen_id": { "type": "string", "description": "ID del mensaje/aviso que lo provoca. Sirve para agrupar y no duplicar." },
    "estado": {
      "type": "string",
      "enum": ["enviado", "fallido", "sin_dispositivo", "omitido_silencio", "omitido_permiso", "agrupado"],
      "enumColors": ["green", "red", "gray", "gray", "yellow", "blue"],
      "default": "enviado"
    },
    "error": { "type": "string", "description": "Causa del fallo devuelta por la integración." },
    "enviado_en": { "type": "string", "format": "date-time" },
    "leido_en": { "type": "string", "format": "date-time", "description": "Cuando el usuario abrió la pantalla destino." }
  },
  "required": ["user_id", "tipo", "titulo", "estado"],
  "rls": {
    "create": {
      "$or": [
        { "user_condition": { "role": "admin" } },
        { "user_condition": { "role": "propietario" } },
        { "user_condition": { "role": "gerencia" } },
        { "user_condition": { "role": "administracion" } }
      ]
    },
    "read": {
      "$or": [
        { "user_condition": { "role": "admin" } },
        { "user_condition": { "role": "propietario" } },
        { "user_condition": { "role": "gerencia" } },
        { "user_condition": { "role": "administracion" } },
        { "data.user_email": "{{user.email}}" }
      ]
    },
    "update": {
      "$or": [
        { "user_condition": { "role": "admin" } },
        { "user_condition": { "role": "propietario" } },
        { "data.user_email": "{{user.email}}" }
      ]
    },
    "delete": {
      "$or": [
        { "user_condition": { "role": "admin" } },
        { "user_condition": { "role": "propietario" } }
      ]
    }
  }
}
```

Cada usuario puede leer y marcar como leído lo suyo; gerencia y administración ven todo para auditar; solo admin y dirección borran.

---

## Paso 12 · Función `enviarPush` (puerta única)

Responsabilidades, en este orden: validar destinatario → horario silencioso → agrupación por hilo → límite por hora → enviar → registrar resultado.

```ts
// base44/functions/enviarPush/entry.ts  (referencia)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SILENCIO_DESDE = 22; // 22:00 Europe/Madrid
const SILENCIO_HASTA = 7;   // 07:00
const MAX_POR_HORA = 6;     // por usuario: corta ráfagas
const VENTANA_AGRUPACION_MIN = 3;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { user_id, tipo, titulo, cuerpo, deep_link, prioridad = 'normal', origen_id } = await req.json();

  if (!user_id || !titulo) {
    return Response.json({ error: 'Faltan user_id o titulo' }, { status: 400 });
  }

  const ahora = new Date();
  const horaMadrid = Number(
    new Intl.DateTimeFormat('es-ES', { hour: '2-digit', hour12: false, timeZone: 'Europe/Madrid' })
      .format(ahora)
  );
  const enSilencio = horaMadrid >= SILENCIO_DESDE || horaMadrid < SILENCIO_HASTA;

  const registrar = (estado: string, extra: Record<string, unknown> = {}) =>
    base44.asServiceRole.entities.NotificacionPush.create({
      user_id, tipo, titulo, cuerpo, deep_link, prioridad, origen_id,
      estado, enviado_en: ahora.toISOString(), ...extra,
    });

  // 1. Silencio nocturno: solo las urgencias lo rompen
  if (enSilencio && prioridad !== 'alta') {
    await registrar('omitido_silencio');
    return Response.json({ success: true, estado: 'omitido_silencio' });
  }

  // 2. Agrupación: si ya hay un aviso reciente del mismo hilo, no se duplica
  if (origen_id) {
    const desde = new Date(ahora.getTime() - VENTANA_AGRUPACION_MIN * 60000).toISOString();
    const recientes = await base44.asServiceRole.entities.NotificacionPush.filter(
      { origen_id, enviado_en: { $gte: desde } }, { limit: 1 }
    );
    if (recientes.items?.length) {
      await registrar('agrupado');
      return Response.json({ success: true, estado: 'agrupado' });
    }
  }

  // 3. Límite por usuario y hora
  const haceUnaHora = new Date(ahora.getTime() - 3600000).toISOString();
  const delUltimoTramo = await base44.asServiceRole.entities.NotificacionPush.filter(
    { user_id, estado: 'enviado', enviado_en: { $gte: haceUnaHora } }, { limit: MAX_POR_HORA + 1 }
  );
  if ((delUltimoTramo.items?.length ?? 0) >= MAX_POR_HORA) {
    await registrar('omitido_silencio');
    return Response.json({ success: true, estado: 'omitido_silencio' });
  }

  // 4. Envío
  try {
    await base44.asServiceRole.integrations.Core.SendPushNotification({
      user_id, title: titulo, content: cuerpo,
    });
    await registrar('enviado');
    return Response.json({ success: true, estado: 'enviado' });
  } catch (e) {
    await registrar('fallido', { error: String(e?.message || e) });
    return Response.json({ success: false, error: String(e?.message || e) }, { status: 200 });
  }
});
```

Notas de implementación:
- Si la integración admite `action_url`/`action_label` en la versión de SDK desplegada, se añaden para el salto directo a la pantalla; se confirma en la prueba del paso 8. Si no, el salto se resuelve dentro de la app al abrir.
- Un fallo **no** se devuelve como error HTTP para no romper el flujo de negocio que disparó el aviso: queda registrado en `NotificacionPush`.
- Nunca se llama a esta función desde el navegador (403). Se invoca desde otra función backend o desde un workflow, siempre como servicio.

---

## Paso 13 · Enganchar los disparadores

**a) Chat** — al final de `notificarNuevoMensaje`, tras actualizar la conversación:

```ts
await base44.asServiceRole.functions.invoke('enviarPush', {
  user_id: destinatarioUser.id,          // resuelto por email del participante
  tipo: 'chat_mensaje',
  titulo: `Nuevo mensaje · ${user.full_name || 'Chat'}`,
  cuerpo: 'Tienes un mensaje nuevo',      // sin contenido cifrado
  deep_link: `/chat?conv=${conversacion_id}`,
  origen_id: conversacion_id,
  prioridad: 'normal',
});
```

**b) Avisos e incidencias** — al crear `AsistenteTarea` para un técnico: prioridad `alta`, `origen_id` = id de la tarea, cuerpo con obra y acción.

**c) Hueco de fichaje** — al crear `NotificacionFichaje` de tipo aviso: `deep_link` al día concreto, prioridad `alta`, envío a las 24 h del hueco.

**d) Ausencias** — al pasar `FaltaAsistencia` o `SolicitudCancelacionVacacion` a resuelta: prioridad `normal`.

**e) Alarmas** — `AlarmaHorario` sigue siendo local (suena con la app abierta) y se añade push programado por workflow para la hora elegida.

---

## Paso 14 · Puesta en marcha y operación

**Antes de abrir el canal a toda la plantilla**
1. Un usuario piloto (tú) con la app instalada: prueba de `prueba` recibida con app cerrada.
2. Dos técnicos voluntarios: mensaje de chat real + aviso de incidencia.
3. Revisar `NotificacionPush`: todos los estados deben ser `enviado`. Cualquier `fallido` se investiga antes de seguir.

**Aviso a la plantilla (texto base, adaptar y enviar por escrito)**
> Se ha instalado en vuestro móvil la app de SMART-GESTION. A partir de ahora recibiréis avisos de trabajo (mensajes, incidencias, fichajes y ausencias) como notificación. No se envían avisos entre las 22:00 y las 07:00 salvo urgencias justificadas, y no incluyen datos personales ni importes. Si en algún momento no queréis recibir un tipo de aviso, comunicadlo a administración: se silencia sin que ello afecte vuestro trabajo. La app no os exige estar disponibles fuera de vuestra jornada.

**Revisión mensual (30 min)**
- Enviados vs abiertos vs fallidos por tipo.
- Tipos con más `agrupado`: están generando ruido, se ajusta la ventana o la prioridad.
- Consumo de créditos por envío en Plan y billing.
- Técnicos con permiso denegado: se les explica o se acepta el aviso interno.

**Diagnóstico rápido**

| Síntoma | Causa probable | Acción |
|---|---|---|
| Error de envío nativo (502) | Sin app Android o credenciales mal cargadas | Revisar pasos 4-6 y regenerar |
| Llega con la app abierta y no cerrada | Se está enviando a la web/PWA, no a la app | Instalar la app del enlace de pruebas |
| No llega a un técnico concreto | Sin sesión iniciada, permiso denegado o usuario sin vincular | Revisar `NotificacionPush` y vincular operario-usuario |
| Llega con horas de retraso | Ahorro de batería del fabricante bloquea procesos | Ajuste de batería sin restricciones para la app; FCM entrega igualmente al abrir |
| No suena | Canal silenciado por el usuario o modo no molestar | Revisar canal de la app en ajustes del móvil |
| Duplicados | `origen_id` ausente al invocar | Enviar siempre el id del origen |
| Nadie recibe nada desde ayer | Límite por hora mal configurado o silencio extendido | Revisar `omitido_silencio` en el registro |

---

## Anexo · Checklist de aceptación de la fase Android

- [ ] Proyecto Firebase creado con la app Android registrada con el package name correcto.
- [ ] `google-services.json` y clave de servicio subidos en el flujo Google Play.
- [ ] App Android generada y enlace de pruebas repartido a la plantilla Android.
- [ ] Push de prueba recibido en 3 móviles distintos, **con la app cerrada**.
- [ ] Entidad `NotificacionPush` creada con RLS.
- [ ] Función `enviarPush` con silencio, agrupación y límite por hora.
- [ ] Disparadores de chat y avisos activos y probados de extremo a extremo.
- [ ] Disparadores de hueco de fichaje, ausencias y alarmas planificados o activos.
- [ ] Aviso por escrito enviado a la plantilla.
- [ ] Revisión mensual de métricas asignada a una persona.
- [ ] iOS documentado como fase siguiente (sin credenciales en esta fase).
