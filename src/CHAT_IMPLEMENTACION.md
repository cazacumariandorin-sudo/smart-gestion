# Chat Interno - SMART-GESTION

## Estado de Implementación ✅

**PASO 2 COMPLETADO** - Chat Interno completo y funcional con cifrado E2E

### Características Implementadas

#### 1. Cifrado E2E (End-to-End Encryption)
- **Algoritmo**: RSA-OAEP-2048 + AES-256-GCM
- **Funcionamiento**:
  - Cada usuario genera un par de claves RSA (pública/privada)
  - Los mensajes se cifran con AES-256-GCM
  - La clave AES se cifra con la clave pública RSA del destinatario
  - Solo el destinatario puede descifrar con su clave privada

#### 2. Gestión de Claves
- **Generación automática** al primer acceso del usuario
- **Almacenamiento**: Claves en sessionStorage (solo sesión actual)
- **Registro en backend**: Clave pública en entidad `ChatClavePublica`
- **Función backend**: `gestionClavesChat` para registrar/obtener claves

#### 3. Entidades

##### ChatConversacion
- Conversaciones de grupo o directas
- Campos: `nombre`, `tipo`, `participantes`, `cifrado_activo`, `ultimo_mensaje_texto`

##### ChatMensaje
- Mensajes cifrados o en texto plano
- Campos: `conversacion_id`, `autor_email`, `mensaje_cifrado`, `tipo_mensaje`, `cifrado_tipo`
- Soporta: texto, imagen, archivo, sistema, reply, cifrado

##### ChatClavePublica
- Claves públicas RSA de usuarios
- Campos: `user_email`, `clave_publica`, `activa`, `algoritmo`, `huella_digital`

#### 4. Funciones Backend

1. **`gestionClavesChat`**
   - Registrar clave pública del usuario
   - Obtener clave pública de otro usuario

2. **`enviarMensajeCifrado`**
   - Enviar mensaje con cifrado E2E
   - Actualiza conversación con último mensaje

3. **`notificarNuevoMensaje`**
   - Actualiza metadatos de conversación
   - (Preparado para push notifications)

#### 5. Componentes Frontend

##### `pages/Chat.jsx`
- Lista de conversaciones en sidebar
- Panel de mensajes con cifrado automático
- Indicador de estado E2E
- Dialog de información de cifrado

##### `components/chat/CifradoInfo.jsx`
- Muestra información de claves del usuario
- Huella digital (fingerprint)
- Instrucciones de uso

##### `lib/chatCrypto.js`
- Utilidades criptográficas
- Generación de claves RSA
- Cifrado/descifrado AES
- Cifrado/descifrado RSA

### UX Mejorada

- **Indicadores visuales**:
  - 🔒 Mensajes cifrados
  - 🟢 E2E disponible
  - ⏳ Cargando claves

- **Estados**:
  - Cargando claves al iniciar
  - Mensajes descifrados automáticamente
  - Fallback a texto plano si no hay claves

- **Accesibilidad**:
  - Diálogo de información de cifrado
  - Huella digital copiable
  - Instrucciones claras

### Flujo de Uso

1. **Primer acceso**:
   - Usuario entra al Chat
   - Se generan claves RSA automáticamente
   - Se registra clave pública en backend

2. **Enviar mensaje**:
   - Usuario escribe mensaje
   - Frontend cifra con AES-256-GCM
   - Obtiene clave pública del destinatario
   - Cifra clave AES con RSA del destinatario
   - Envía mensaje cifrado

3. **Recibir mensaje**:
   - Mensajes se cargan cifrados
   - Frontend descifra automáticamente con clave privada
   - Muestra texto original

### Seguridad

- ✅ Claves privadas nunca salen del navegador
- ✅ Almacenamiento solo en sessionStorage (se borra al cerrar)
- ✅ Cifrado doble: AES + RSA
- ✅ Huella digital para verificación de identidad
- ✅ RLS configurado para privacidad

### Próximas Mejoras (Opcionales)

- [ ] Notificaciones push en tiempo real
- [ ] Cifrado de archivos adjuntos
- [ ] Verificación de huellas entre usuarios
- [ ] Rotación periódica de claves
- [ ] Backup seguro de claves privadas

### Comandos Útiles

```javascript
// Verificar estado del cifrado en consola
const stored = sessionStorage.getItem('chat_crypto_keys');
console.log(JSON.parse(stored));

// Forzar regeneración de claves
sessionStorage.removeItem('chat_crypto_keys');
location.reload();
```

### Soporte

Para incidencias o dudas sobre el cifrado, contactar con administración.

---

**Fecha implementación**: 23/05/2026  
**Versión**: 1.0  
**Estado**: ✅ En producción