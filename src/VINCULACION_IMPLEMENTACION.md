# Sistema de Vinculación Usuario → Operario

## Estado de Implementación ✅

**SISTEMA COMPLETO IMPLEMENTADO** - Vinculación de usuarios con operarios/clientes con auditoría completa

### Características Implementadas

#### 1. Registro de Nuevos Usuarios
- **Automático al registrarse**:
  - `fecha_registro`: now()
  - `fecha_limite_vinculacion`: now() + 7 días
  - `vinculo_estado`: "pendiente" (real) / "demo" (demo)
  - `vinculo_tipo`: "sin_vincular" / "demo_user"
  - `role`: "operario" (por defecto)

- **Usuarios demo**:
  - No aparecen en lista de pendientes
  - No se crea log de vinculación
  - Expiración controlada por `demo_expires_at`

#### 2. Panel de Vinculación (Admin/Gerencia)
**Ruta**: `/vinculacion`

**Características**:
- Contador de usuarios pendientes
- Badge rojo urgente si ≤2 días restantes
- Botón "Comprobar vinculaciones automáticas"

**Lista de Pendientes**:
- Ordenados por fecha límite (más urgente primero)
- Columnas: Usuario, Días restantes, Operario sugerido, Acción
- Badges de color:
  - 🔴 Rojo: ≤2 días (urgente)
  - 🟠 Naranja: 3-4 días
  - 🟢 Verde: 5-7 días

**Sugerencias automáticas**:
- Coincidencia exacta de email → badge "Email exacto ✓"
- Sin coincidencia → "Selección manual"

**Modal de Vinculación**:
- Selector de operario (solo sin user_id)
- Tipo de vínculo: "operario" / "cliente_obra"
- Campo de notas opcional
- Preselecciona sugerencia por email

#### 3. Vinculación Automática (7 días)
**Se ejecuta**:
- Al cargar panel (admin/gerencia)
- Botón "Comprobar vinculaciones automáticas"

**Algoritmo**:
1. Usuarios con `fecha_limite_vinculacion < now()`
2. Buscar operario con email coincidente (sin user_id)
   - **SI ENCUENTRA**: Vincula automáticamente → `auto_vinculado`
   - **NO ENCUENTRA**: Crea "Operario Temporal - [email]" → `operario_temporal`

3. Recordatorios urgentes (≤2 días):
  - Banner rojo al admin
  - Actualiza `vinculo_recordatorio_enviado = true`

#### 4. Auditoría Completa (VinculacionLog)
**Campos**:
- `accion`: "usuario_registrado", "vinculo_manual", "vinculo_automatico", "recordatorio_enviado"
- `dias_transcurridos`: calculado automáticamente
- `realizado_por_email`: admin/gerencia que ejecutó
- `tipo_vinculo`: resultado de la vinculación
- `motivo`: notas opcionales

#### 5. Widget en Dashboard
**Para admin/gerencia**:
- Estadísticas en tiempo real:
  - ✅ Vinculados manual
  - ⏰ Auto-vinculados (7d)
  - ⚠ Temporales
  - 🔴 Pendientes
  - 👥 Usuarios demo
- Botón "Gestionar" → abre panel de vinculación

#### 6. Indicadores en Perfil de Usuario
**En tabla de usuarios**:
- Columna "Vinculación" con badges:
  - 🟡 Pendiente (amarillo)
  - 🟠 Auto 7d (naranja)
  - ⚠ Temporal (rojo)
  - ✓ Vinculado (verde)
- Nombre del operario/cliente vinculado

### Entidades Involucradas

#### User (campos de vinculación)
```json
{
  "vinculo_id": "string",
  "vinculo_tipo": "operario|operario_temporal|cliente_obra|demo_user|sin_vincular",
  "vinculo_nombre": "string",
  "vinculo_email": "string",
  "vinculo_estado": "pendiente|vinculado|auto_vinculado|demo",
  "vinculo_fecha": "date-time",
  "vinculo_asignado_por": "email_admin",
  "fecha_registro": "date-time",
  "fecha_limite_vinculacion": "date-time",
  "vinculo_recordatorio_enviado": "boolean",
  "vinculo_recordatorio_fecha": "date-time"
}
```

#### Operario (campos de usuario)
```json
{
  "user_id": "string",
  "user_email": "string",
  "user_vinculado_nombre": "string",
  "vinculacion_tipo": "manual|automatico_7dias|demo|sin_vincular",
  "vinculacion_fecha": "date-time",
  "es_temporal": "boolean"
}
```

#### VinculacionLog
```json
{
  "usuario_id": "string",
  "usuario_email": "string",
  "accion": "usuario_registrado|vinculo_manual|vinculo_automatico|recordatorio_enviado",
  "operario_id_nuevo": "string",
  "operario_nombre": "string",
  "tipo_vinculo": "string",
  "dias_transcurridos": "number",
  "realizado_por_email": "string",
  "realizado_por_rol": "string",
  "timestamp": "date-time",
  "motivo": "string"
}
```

### Funciones Backend

1. **`inicializarUsuarioVinculacion`**
   - Inicializa usuario al registrarse
   - Crea log si es usuario real
   - Calcula fecha límite (+7 días)

2. **`gestionClavesChat`** (existente)
   - No relacionada con vinculación

### Componentes Frontend

1. **`pages/Vinculacion.jsx`**
   - Página principal de gestión

2. **`components/vinculacion/PanelVinculacion.jsx`**
   - Lista de pendientes
   - Lista de vinculados
   - Estadísticas
   - Comprobación automática

3. **`components/vinculacion/VinculacionModal.jsx`**
   - Modal de vinculación manual
   - Sugerencias automáticas
   - Selector de operario/cliente

4. **`components/vinculacion/WidgetVinculaciones.jsx`**
   - Widget en Dashboard
   - Estadísticas rápidas

### Flujos de Uso

#### 1. Nuevo Usuario Real
```
Registro → User.fecha_registro = now()
         → User.fecha_limite = now() + 7d
         → User.vinculo_estado = "pendiente"
         → VinculacionLog: "usuario_registrado"
         → Aparece en lista de pendientes
```

#### 2. Vinculación Manual
```
Admin pulsa "Vincular" → Modal
                       → Selecciona operario
                       → Confirma
                       → User.vinculo_estado = "vinculado"
                       → Operario.user_id = user.id
                       → VinculacionLog: "vinculo_manual"
```

#### 3. Auto-vinculación (7 días)
```
Botón "Comprobar auto" → Busca email coincidente
                        → SI: Vincula con operario existente
                        → NO: Crea "Operario Temporal"
                        → User.vinculo_estado = "auto_vinculado"
                        → VinculacionLog: "vinculo_automatico"
```

#### 4. Recordatorio Urgente
```
≤2 días restantes → Banner rojo admin
                   → User.vinculo_recordatorio_enviado = true
                   → VinculacionLog: "recordatorio_enviado"
```

### Datos Actuales (usuarios existentes)

**Usuarios sin vincular**:
- 1 jefe_obra → pendiente
- 1 gerencia → pendiente

**Operarios sin user_id**:
- COSMIN MARCU
- ALVIS WENCESLAO INGA TREVEJO
- FRANCISCO JURADO SANTOS
- WILFREDO QUISPE PAICO
- Jhon Caz
- Simantec

Estos 6 operarios aparecen en el selector al vincular manualmente.

### Diseño Visual

- **Colores de estado**:
  - Pendiente: amarillo 🟡
  - Vinculado: verde 🟢
  - Auto-vinculado: naranja 🟠
  - Temporal: rojo 🔴
  - Demo: gris ⚪

- **Filas urgentes**: fondo rojizo claro
- **Badges**: colores semánticos Tailwind
- **Responsive**: tablas con scroll horizontal en móvil

### Próximas Mejoras (Opcionales)

- [ ] Notificaciones email automáticas a admin
- [ ] Vinculación masiva (lote)
- [ ] Historial completo de cambios en perfil de operario
- [ ] Exportar informe de vinculaciones

### Comandos Útiles

```javascript
// Ver usuarios pendientes en consola
const pendientes = await base44.entities.User.filter({vinculo_estado: 'pendiente'});
console.log(pendientes);

// Forzar comprobación automática
base44.functions.invoke('inicializarUsuarioVinculacion', {accion: 'comprobar_auto'});

// Ver logs de vinculación
const logs = await base44.entities.VinculacionLog.list('-timestamp', 50);
console.log(logs);
```

---

**Fecha implementación**: 23/05/2026  
**Versión**: 1.0  
**Estado**: ✅ En producción