# Sistema de IDs Personalizados para Usuarios

## 📋 Descripción

El sistema genera automáticamente un **ID personalizado** para cada usuario registrado en formato `YYYY-NNNN`, donde:
- `YYYY` = Año de registro del usuario
- `NNNN` = Número secuencial de 4 dígitos que se reinicia cada año

## 🎯 Formato del ID

```
2026-0001  → Primer usuario registrado en 2026
2026-0002  → Segundo usuario registrado en 2026
...
2026-06-01 → Usuario registrado el 1 de junio de 2026 (interpretación alternativa)
2026-06-02 → Usuario registrado el 2 de junio de 2026
...
2027-0001  → Primer usuario registrado en 2027 (reinicia secuencial)
```

## ⚙️ Cómo Funciona

### 1. **Registro Automático**
Cuando se crea un nuevo usuario a través del modal "Añadir usuario":
- Se invita al usuario con `inviteUserFunction`
- La función backend espera 1 segundo a que el usuario se registre
- Calcula el siguiente número secuencial basado en el año
- Asigna el ID personalizado automáticamente

### 2. **Funciones Backend**

#### `inviteUserFunction`
- Invita al usuario y genera su ID personalizado automáticamente
- Calcula el secuencial contando usuarios existentes del mismo año
- Formato: `YYYY-NNNN` (ej: `2026-0001`)

#### `asignarIdsPersonalizadosExistentes`
- Asigna IDs personalizados a usuarios existentes que no tengan uno
- Se ejecuta manualmente desde la página de Usuarios
- Útil para migrar usuarios antiguos al nuevo sistema

### 3. **Reinicio Anual**
El **1 de enero de cada año**, el secuencial vuelve a `0001`:
- `2026-0156` → Último usuario de 2026
- `2027-0001` → Primer usuario de 2027
- `2027-0002` → Segundo usuario de 2027

## 📱 Uso en la Interfaz

### Página: Usuarios → Usuarios Reales

**Tabla de usuarios:**
- Nueva columna "ID Personalizado" muestra el ID en formato badge azul
- Usuarios sin ID muestran "—"

**Botón: "Asignar IDs pendientes"**
- Asigna IDs personalizados a usuarios que no tengan uno
- Útil después de actualizar el sistema o para usuarios antiguos

### Ejemplo de Visualización

| ID Personalizado | Nombre | Email | Rol |
|-----------------|--------|-------|-----|
| `2026-0001` | Juan Pérez | juan@empresa.com | ADMIN |
| `2026-0002` | María López | maria@empresa.com | JEFE OBRA |
| `2026-0003` | Carlos Ruiz | carlos@empresa.com | OPERARIO |
| — | Usuario Sin ID | sinid@empresa.com | OPERARIO |

## 🔧 Implementación Técnica

### Entidad User
Campo añadido: `user_id_personalizado` (string)
- Descripción: "ID personalizado generado automáticamente: YYYY-NNNN"
- Se genera automáticamente al crear el usuario
- No es requerido (para compatibilidad con usuarios existentes)

### Flujo de Creación de Usuario

```
1. Admin hace clic en "Añadir usuario"
2. Completa formulario (email, nombre, rol, cargo)
3. Sistema llama a `inviteUserFunction`
4. Función backend:
   a. Invita al usuario vía base44.users.inviteUser()
   b. Espera 1 segundo
   c. Busca al usuario recién creado
   d. Cuenta usuarios existentes del mismo año
   e. Calcula siguiente secuencial
   f. Asigna ID: YYYY-NNNN
5. Usuario recibe invitación con ID ya asignado
```

## 📊 Ejemplos de IDs

### Escenario: Año 2026

```
Fecha: 2026-01-15 → Usuario 1 → ID: 2026-0001
Fecha: 2026-03-22 → Usuario 2 → ID: 2026-0002
Fecha: 2026-06-01 → Usuario 3 → ID: 2026-0003
Fecha: 2026-06-02 → Usuario 4 → ID: 2026-0004
...
Fecha: 2026-12-31 → Usuario 156 → ID: 2026-0156
```

### Escenario: Cambio de Año

```
Fecha: 2026-12-31 23:59 → Usuario 156 → ID: 2026-0156
Fecha: 2027-01-01 00:01 → Usuario 157 → ID: 2027-0001 (¡reinicia!)
Fecha: 2027-01-02 10:30 → Usuario 158 → ID: 2027-0002
```

## 🛠️ Mantenimiento

### Asignar IDs a Usuarios Existentes

1. Ir a **Usuarios → Usuarios Reales**
2. Click en **"Asignar IDs pendientes"**
3. El sistema procesa todos los usuarios sin ID
4. Muestra resumen: "IDs asignados: X usuarios actualizados"

### Verificación

Para verificar que todos los usuarios tengan ID:
- Revisar columna "ID Personalizado" en la tabla
- Usuarios con "—" necesitan asignación

## 📝 Notas Importantes

1. **El ID es único por año**: No hay colisiones porque el secuencial se reinicia cada enero
2. **No editable**: El ID se genera automáticamente, no se puede modificar manualmente
3. **Persistente**: Una vez asignado, el ID no cambia aunque se modifique el rol o datos del usuario
4. **Visible para admins**: Solo usuarios con rol admin/gerencia pueden ver los IDs

## 🎯 Beneficios

- ✅ **Trazabilidad**: Cada usuario tiene un identificador único y legible
- ✅ **Organización temporal**: El ID indica cuándo se registró el usuario
- ✅ **Fácil de usar**: Formato simple y comprensible
- ✅ **Automático**: No requiere intervención manual
- ✅ **Reinicia anualmente**: Mantiene los números bajos y manejables