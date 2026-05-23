# Implementación en Base44: Separación de Obras Civiles y Solares

## 📌 ¿Qué es Base44?

Base44 es una plataforma **low-code/no-code** que permite crear aplicaciones sin escribir backend. Usas su interfaz visual para:
- ✅ Crear entidades (modelos)
- ✅ Definir campos y relaciones
- ✅ Configurar permisos y módulos
- ✅ Generar APIs automáticamente

---

## 🔧 PASO 1: Crear Entidades en Base44

### Acceso a Base44 Builder
1. Ir a **[Base44.com](https://base44.com)**
2. Iniciar sesión con tu cuenta
3. Abrir tu aplicación "smart-gestion"
4. Ir a **Builder** o **Data Model**

---

## 📊 PASO 2: Crear Entidad "ObraCivil"

### 2.1 Crear la Entidad
1. Click en **+ Nueva Entidad**
2. Nombre: `ObraCivil`
3. Plural: `ObrasCiviles`
4. Descripción: "Proyectos de construcción civil"
5. Icono: 🏗️

### 2.2 Definir Campos

```
Nombre Campo          | Tipo         | Requerido | Único | Notas
==================================================================================
id                    | UUID         | ✅        | ✅    | (Auto)
name                  | Text         | ✅        | ❌    | Nombre de la obra
code                  | Text         | ❌        | ✅    | Código único (OBR-001)
client_id             | Relación     | ✅        | ❌    | → Cliente
client_name           | Text         | ❌        | ❌    | Nombre del cliente (denormalized)
address               | Text         | ❌        | ❌    | Dirección completa
start_date            | Fecha        | ❌        | ❌    | Fecha de inicio
end_date              | Fecha        | ❌        | ❌    | Fecha fin prevista
status                | Select       | ✅        | ❌    | activa/pausada/finalizada/presupuesto
budget                | Número       | ❌        | ❌    | Presupuesto en €
description           | Textarea     | ❌        | ❌    | Descripción del alcance
contact_person        | Text         | ❌        | ❌    | Responsable en obra
contact_phone         | Text         | ❌        | ❌    | Teléfono contacto
notes                 | Textarea     | ❌        | ❌    | Observaciones
type                  | Text (fixed) | ✅        | ❌    | Valor: "civil" (para queries)
created_at            | Fecha/Hora   | ✅        | ❌    | (Auto)
updated_at            | Fecha/Hora   | ✅        | ❌    | (Auto)
```

### 2.3 Relaciones

```javascript
// Relación con Cliente
client_id (Relación N:1)
  ← Entidad: Client
  ← Campo de Client: obras_civiles (inverso)
  ← Descripción: "La obra pertenece a un cliente"
```

### 2.4 Opciones del Select "status"

```
Valor          | Etiqueta      | Color
==========================================
activa         | Activa        | 🟢 Verde
pausada        | Pausada       | 🟠 Naranja
finalizada     | Finalizada    | ⚫ Gris
presupuesto    | Presupuesto   | 🔵 Azul
```

### 2.5 Guardar Entidad

✅ Click en **"Guardar Entidad"**

---

## 🌞 PASO 3: Crear Entidad "ObraSolar"

### 3.1 Crear la Entidad
1. Click en **+ Nueva Entidad**
2. Nombre: `ObraSolar`
3. Plural: `ObrasSolares`
4. Descripción: "Proyectos de energía solar fotovoltaica"
5. Icono: ☀️

### 3.2 Definir Campos

```
Nombre Campo          | Tipo         | Requerido | Único | Notas
==================================================================================
id                    | UUID         | ✅        | ✅    | (Auto)
name                  | Text         | ✅        | ❌    | Nombre del proyecto
code                  | Text         | ❌        | ✅    | Código único (SOL-001)
client_id             | Relación     | ✅        | ❌    | → Cliente
client_name           | Text         | ❌        | ❌    | Nombre del cliente (denormalized)
address               | Text         | ❌        | ❌    | Ubicación instalación
start_date            | Fecha        | ❌        | ❌    | Fecha de inicio
end_date              | Fecha        | ❌        | ❌    | Fecha fin prevista
status                | Select       | ✅        | ❌    | activa/pausada/finalizada/presupuesto
budget                | Número       | ❌        | ❌    | Presupuesto en €
description           | Textarea     | ❌        | ❌    | Descripción del proyecto
contact_person        | Text         | ❌        | ❌    | Responsable técnico
contact_phone         | Text         | ❌        | ❌    | Teléfono contacto
notes                 | Textarea     | ❌        | ❌    | Observaciones

--- CAMPOS ESPECÍFICOS SOLAR ---
potencia_kw           | Número       | ❌        | ❌    | Potencia en kW
modulos_cantidad      | Número       | ❌        | ❌    | Cantidad de módulos
inversor_marca        | Text         | ❌        | ❌    | Marca del inversor
bateria_kwh           | Número       | ❌        | ❌    | Capacidad batería (kWh)
licencia_tramite      | Text         | ❌        | ❌    | Número de trámite
licencia_estado       | Select       | ❌        | ❌    | pendiente/aprobada/rechazada
fecha_conexion        | Fecha        | ❌        | ❌    | Fecha conexión red
type                  | Text (fixed) | ✅        | ❌    | Valor: "solar" (para queries)
created_at            | Fecha/Hora   | ✅        | ❌    | (Auto)
updated_at            | Fecha/Hora   | ✅        | ❌    | (Auto)
```

### 3.3 Relaciones

```javascript
// Relación con Cliente
client_id (Relación N:1)
  ← Entidad: Client
  ← Campo de Client: obras_solares (inverso)
  ← Descripción: "La obra pertenece a un cliente"
```

### 3.4 Opciones del Select "status"

```
Valor          | Etiqueta      | Color
==========================================
activa         | Activa        | 🟢 Verde
pausada        | Pausada       | 🟠 Naranja
finalizada     | Finalizada    | ⚫ Gris
presupuesto    | Presupuesto   | 🔵 Azul
```

### 3.5 Guardar Entidad

✅ Click en **"Guardar Entidad"**

---

## 🔐 PASO 4: Crear Módulos de Permisos

### 4.1 Ir a Configuración de Módulos
1. En Base44 Builder → **Settings** o **Módulos**
2. Buscar **Access Control** o **Permisos**

### 4.2 Crear Módulo "obras-civiles"

```
Nombre Módulo:     obras-civiles
Descripción:       Gestión de obras civiles
Icono:             🏗️
Color:             Gris/Azul

Permisos Incluidos:
  ✅ Leer ObraCivil
  ✅ Crear ObraCivil
  ✅ Editar ObraCivil
  ✅ Eliminar ObraCivil
  ✅ Ver Clientes (relacionados)
```

### 4.3 Crear Módulo "solar"

```
Nombre Módulo:     solar
Descripción:       Proyectos de energía solar integrados
Icono:             ☀️
Color:             Naranja/Amarillo

Permisos Incluidos:
  ✅ Leer ObraSolar
  ✅ Crear ObraSolar
  ✅ Editar ObraSolar
  ✅ Eliminar ObraSolar
  ✅ Leer ClienteSolar (si existe)
  ✅ Crear ClienteSolar
  ✅ Editar ClienteSolar
  ✅ Eliminar ClienteSolar
  ✅ Leer MaterialSolar
  ✅ Leer LegalizacionSolar
  (... todos los sub-módulos)
```

---

## 👥 PASO 5: Configurar Roles de Usuario

### 5.1 Ir a Usuarios y Roles
1. En Base44 Builder → **Users & Roles** o **Seguridad**

### 5.2 Crear Rol "Gestor de Obras Civiles"

```
Nombre:              Gestor de Obras Civiles
Descripción:         Acceso completo a obras civiles

Módulos Permitidos:
  ✅ obras-civiles
  ✅ clientes
  ✅ dashboard
  ✅ users (ver solo)
```

### 5.3 Crear Rol "Gestor Solar"

```
Nombre:              Gestor Solar
Descripción:         Acceso completo a proyectos solares

Módulos Permitidos:
  ✅ solar
  ✅ clientes
  ✅ dashboard
  ✅ users (ver solo)
```

### 5.4 Crear Rol "Administrador" (existente, actualizar)

```
Módulos Permitidos:
  ✅ obras-civiles
  ✅ solar
  ✅ clientes
  ✅ dashboard
  ✅ users
  ✅ admin
  (... todos los módulos)
```

---

## 🔗 PASO 6: Actualizar Menú de Navegación

### 6.1 Ir a Navigation/Menu en Base44
1. En Base44 Builder → **Navigation** o **Menu**
2. Buscar el menú principal

### 6.2 Actualizar Estructura

```
📍 Dashboard
   └─ Dashboard

🏗️ OBRAS
   ├─ Obras Civiles          (ruta: /obras-civiles, módulo: obras-civiles)
   └─ Proyectos Solares      (ruta: /solar, módulo: solar)

👥 GENTE
   ├─ Operarios
   ├─ Control Horario
   └─ Calendario Vacaciones

📋 ÓRDENES
   ├─ Pedidos
   ├─ Materiales
   └─ Dibujos

⚙️ ADMINISTRACIÓN
   ├─ Usuarios
   ├─ Permisos
   ├─ Backup
   └─ Configuración
```

### 6.3 Guardar Cambios

✅ Click en **"Guardar Menú"**

---

## 📱 PASO 7: Generar APIs

Base44 genera automáticamente las siguientes APIs:

### ObraCivil
```javascript
// GET - Listar todas
GET /api/obras-civiles

// GET - Listar con filtros
GET /api/obras-civiles?status=activa&sort=-start_date&limit=50

// GET - Un registro
GET /api/obras-civiles/:id

// POST - Crear
POST /api/obras-civiles
Body: { name, code, client_id, status, ... }

// PUT - Actualizar
PUT /api/obras-civiles/:id
Body: { name, status, ... }

// DELETE - Eliminar
DELETE /api/obras-civiles/:id
```

### ObraSolar
```javascript
// Mismos endpoints pero con /api/obras-solares
GET /api/obras-solares
POST /api/obras-solares
PUT /api/obras-solares/:id
DELETE /api/obras-solares/:id
```

---

## 🎯 PASO 8: Actualizar Cliente React

### 8.1 Actualizar base44Client.js

```javascript
// src/api/base44Client.js

export const base44 = {
  entities: {
    // NUEVO
    ObraCivil: {
      list: (sort = '-created_at', limit = 300) => 
        fetch(`/api/obras-civiles?sort=${sort}&limit=${limit}`).then(r => r.json()),
      
      get: (id) => 
        fetch(`/api/obras-civiles/${id}`).then(r => r.json()),
      
      create: (data) => 
        fetch(`/api/obras-civiles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).then(r => r.json()),
      
      update: (id, data) => 
        fetch(`/api/obras-civiles/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).then(r => r.json()),
      
      delete: (id) => 
        fetch(`/api/obras-civiles/${id}`, { method: 'DELETE' }).then(r => r.json())
    },

    // NUEVO
    ObraSolar: {
      list: (sort = '-created_at', limit = 300) => 
        fetch(`/api/obras-solares?sort=${sort}&limit=${limit}`).then(r => r.json()),
      
      get: (id) => 
        fetch(`/api/obras-solares/${id}`).then(r => r.json()),
      
      create: (data) => 
        fetch(`/api/obras-solares`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).then(r => r.json()),
      
      update: (id, data) => 
        fetch(`/api/obras-solares/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).then(r => r.json()),
      
      delete: (id) => 
        fetch(`/api/obras-solares/${id}`, { method: 'DELETE' }).then(r => r.json())
    },

    // EXISTENTES
    Client: { ... },
    MaterialSolar: { ... },
    // etc...
  }
};
```

### 8.2 El código React ya está listo

```javascript
// src/pages/ObrasCiviles.jsx
const { data: obras = [] } = useQuery({
  queryKey: ['obras-civiles'],
  queryFn: () => base44.entities.ObraCivil.list('-start_date', 300),
});

// src/pages/Solar.jsx y sub-componentes
// Ya usan base44.entities.ObraSolar, etc.
```

---

## ✅ PASO 9: Testing

### 9.1 Verificar Entidades
1. En Base44 Builder → **Data** o **Database**
2. Verificar que aparezcan:
   - ✅ ObraCivil (creadas exitosamente)
   - ✅ ObraSolar (creadas exitosamente)

### 9.2 Verificar APIs

Desde terminal o Postman:
```bash
# Listar obras civiles
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.base44.app/api/obras-civiles

# Listar obras solares
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.base44.app/api/obras-solares
```

### 9.3 Verificar Permisos
1. Crear usuario con rol "Gestor de Obras Civiles"
2. Verificar que **solo vea** `/obras-civiles`
3. Crear usuario con rol "Gestor Solar"
4. Verificar que **solo vea** `/solar`

### 9.4 Probar en la App React
1. `npm run dev`
2. Navegar a `/obras-civiles` → debe cargar
3. Navegar a `/solar` → debe cargar
4. Crear obra civil → debe guardarse
5. Crear obra solar → debe guardarse

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

- [ ] ✅ Entidad ObraCivil creada en Base44
- [ ] ✅ Entidad ObraSolar creada en Base44
- [ ] ✅ Módulo "obras-civiles" creado
- [ ] ✅ Módulo "solar" creado
- [ ] ✅ Roles actualizados (Gestor Civil, Gestor Solar, Admin)
- [ ] ✅ Menú de navegación actualizado
- [ ] ✅ APIs generadas automáticamente
- [ ] ✅ base44Client.js actualizado
- [ ] ✅ App.jsx con rutas correctas
- [ ] ✅ ObrasCiviles.jsx implementado
- [ ] ✅ Solar.jsx y sub-módulos implementados
- [ ] ✅ Testing en Postman/Terminal
- [ ] ✅ Testing en React App
- [ ] ✅ Usuarios de prueba con roles específicos
- [ ] ✅ Documentación actualizada

---

## 🎬 RESULTADO FINAL

**Antes:**
```
/obras (confuso)
/solar-pedidos (incorrecto)
/solar-obras (apunta a SolarPedidos)
Permisos: "obras", "orders" (unclear)
```

**Después:**
```
/obras-civiles (claro - obras civiles)
/solar (claro - proyectos solares integrados)
  ├─ Tab: Obras
  ├─ Tab: Clientes
  ├─ Tab: Materiales
  └─ Tab: Legalización
Permisos: "obras-civiles", "solar" (muy claros)
```

---

## 🆘 Soporte

Si tienes dudas durante la implementación:
1. Revisar documentación oficial: https://docs.base44.com
2. Ver tutoriales: https://base44.com/support
3. Contactar soporte: https://app.base44.com/support

