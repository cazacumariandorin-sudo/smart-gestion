# Análisis: Sistema de Vinculación Usuario → Operario

## 🔍 Estado Actual del Sistema

### Ubicación en la App
```
Panel General (Dashboard)
  └─ Widget: "Estado de vinculaciones" (solo Admin/Gerencia)
     └─ Botón: "Gestionar"
        └─ Ruta: /vinculacion
           └─ PanelVinculacion.jsx
```

---

## 📊 Componentes Involucrados

### 1. **Dashboard.jsx** (líneas 312-317)
```javascript
// Mostrar widget solo si es Admin o Gerencia
{(isAdmin || isGerencia) && (
  <div className="mb-6">
    <WidgetVinculaciones />
  </div>
)}
```
✅ **Estado:** Correcto - Se muestra solo a usuarios con permisos

---

### 2. **WidgetVinculaciones.jsx** (líneas 1-87)
```javascript
// Estadísticas de vinculación
const stats = {
  vinculados: users.filter(u => u.vinculo_estado === 'vinculado').length,
  auto_vinculados: users.filter(u => u.vinculo_estado === 'auto_vinculado').length,
  temporales: users.filter(u => u.vinculo_tipo === 'operario_temporal').length,
  pendientes: users.filter(u => u.vinculo_estado === 'pendiente').length,
  demo: users.filter(u => u.vinculo_estado === 'demo' || u.tipo_cuenta === 'demo').length,
};
```

**Campos esperados en User:**
- ✅ `vinculo_estado` (vinculado, auto_vinculado, pendiente, demo)
- ✅ `vinculo_tipo` (operario_temporal)
- ✅ `fecha_limite_vinculacion` (para alertas)
- ✅ `tipo_cuenta` (demo)

**Botón "Gestionar":**
```javascript
<Link to="/vinculacion">Gestionar</Link>
```
✅ **Ruta:** /vinculacion

---

### 3. **Vinculacion.jsx (Página)**
```javascript
// Acceso solo Admin/Gerencia
if (!isAdmin && !isGerencia) {
  return <div>No tienes permisos...</div>;
}

// Renderiza PanelVinculacion
<PanelVinculacion />
```
✅ **Protección:** Correcta
✅ **Componente:** PanelVinculacion

---

### 4. **PanelVinculacion.jsx** (Componente Principal)
**Este archivo contiene la lógica de gestión de vinculaciones**

---

## 🔧 Flujo Funcional Esperado

```
┌─────────────────────────────────────────────────────────────┐
│ DASHBOARD - Panel General                                   │
│                                                              │
│  [Widget: Estado de vinculaciones]                          │
│  ├─ Vinculados: 15                                          │
│  ├─ Auto-vinculados: 8                                      │
│  ├─ Temporales: 3                                           │
│  ├─ Pendientes: 5 (🔴 3 urgentes)                           │
│  ├─ Usuarios demo: 2                                        │
│  └─ [Botón: Gestionar] ───────────────────────────┐         │
└──────────────────────────────────────────────────┼──────────┘
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────┐
│ /vinculacion - Gestión de Vinculaciones                     │
│                                                              │
│ PanelVinculacion                                            │
│ ├─ Tabla de Usuarios                                        │
│ │  ├─ Nombre                                               │
│ │  ├─ Email                                                │
│ │  ├─ Estado Vinculación                                   │
│ │  ├─ Operario Vinculado (si existe)                       │
│ │  ├─ Fecha Límite                                         │
│ │  └─ Acciones (Editar, Vincular, Desvincular)           │
│ │                                                          │
│ ├─ Selector de Operario                                    │
│ │  └─ Dropdown con lista de Operarios                      │
│ │                                                          │
│ ├─ Diálogo de Vinculación                                  │
│ │  ├─ Campo: Usuario                                       │
│ │  ├─ Campo: Operario (Dropdown)                          │
│ │  ├─ Campo: Tipo de Vinculación                          │
│ │  │  (manual / auto_vinculacion)                         │
│ │  ├─ Campo: Fecha Límite (opcional)                      │
│ │  └─ Botones: Cancelar / Guardar                         │
│ │                                                          │
│ └─ Notificaciones de Éxito/Error                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Elementos del Sistema

### LECTURA (Queries)
```javascript
// WidgetVinculaciones.jsx
base44.entities.User.list('-fecha_registro', 500)
  ├─ Filtro: tipo_cuenta !== 'demo'
  ├─ Filtro: role !== 'usuario_demo'
  └─ Campos esperados:
     ├─ id
     ├─ name
     ├─ email
     ├─ vinculo_estado
     ├─ vinculo_tipo
     ├─ fecha_limite_vinculacion
     ├─ operario_id (relación)
     └─ tipo_cuenta

// PanelVinculacion.jsx
base44.entities.Operario.list('-name', 500)
  ├─ id
  ├─ name
  └─ (otros campos de operario)
```

### ESCRITURA (Mutations)
```javascript
// Vincular usuario a operario
base44.entities.User.update(userId, {
  operario_id: operarioId,
  vinculo_estado: 'vinculado',
  vinculo_tipo: 'manual',
  fecha_vinculacion: new Date().toISOString()
})

// Desvincular
base44.entities.User.update(userId, {
  operario_id: null,
  vinculo_estado: 'pendiente'
})
```

---

## 🐛 Posibles Problemas

### 1. **Campos Faltantes en Base44**
❌ Si la entidad `User` no tiene estos campos:
```
- vinculo_estado
- vinculo_tipo
- fecha_limite_vinculacion
- operario_id (relación)
- tipo_cuenta
```

**Solución:** Agregar campos en Base44 Builder

### 2. **Relación Usuario ↔ Operario No Configurada**
❌ Si no existe la relación en Base44:
```javascript
User.operario_id → Operario (N:1)
```

**Solución:** Crear relación en Base44 Data Model

### 3. **Ruta /vinculacion No Registrada**
❌ Si no está en App.jsx

**Solución:** Verificar App.jsx tiene la ruta

### 4. **Permisos Insuficientes**
❌ Si usuario no es Admin/Gerencia:
- No ve el Widget
- No puede acceder a /vinculacion

**Solución:** Asignar rol correcto al usuario

---

## 🔧 Verificación en Base44

### Paso 1: Verificar Campos en User
1. Base44 Builder → Data Model
2. Buscar entidad: `User`
3. Verificar campos:
   - [ ] `vinculo_estado` (Text/Select)
   - [ ] `vinculo_tipo` (Text/Select)
   - [ ] `fecha_limite_vinculacion` (Date)
   - [ ] `operario_id` (Relación a Operario)
   - [ ] `tipo_cuenta` (Text/Select)

### Paso 2: Verificar Relación
1. Campo `operario_id`
2. Tipo: Relación
3. Entidad destino: `Operario`
4. Tipo de relación: N:1 (Many Users → One Operario)
5. Inverso: `usuarios` (opcional, para queries de Operario)

### Paso 3: Verificar Opciones de Select
**vinculo_estado:**
```
- vinculado
- auto_vinculado
- pendiente
- demo
```

**vinculo_tipo:**
```
- manual
- operario_temporal
- auto_vinculacion
```

**tipo_cuenta:**
```
- real
- demo
```

---

## 📋 CHECKLIST

- [ ] Entidad `User` existe en Base44
- [ ] Campo `vinculo_estado` existe en User
- [ ] Campo `vinculo_tipo` existe en User
- [ ] Campo `fecha_limite_vinculacion` existe en User
- [ ] Campo `operario_id` (Relación) existe en User
- [ ] Campo `tipo_cuenta` existe en User
- [ ] Relación User → Operario está configurada
- [ ] Entidad `Operario` existe en Base44
- [ ] Ruta `/vinculacion` está en App.jsx
- [ ] WidgetVinculaciones.jsx lee datos correctamente
- [ ] PanelVinculacion.jsx actualiza datos correctamente
- [ ] Usuarios Admin/Gerencia ven el widget
- [ ] Usuarios normales NO ven el widget
- [ ] El botón "Gestionar" lleva a /vinculacion
- [ ] Las actualizaciones se guardan en Base44

---

## 🚀 Próximos Pasos

1. **Verificar estructura en Base44** según checklist arriba
2. **Si campos faltantes:** Crearlos en Base44 Builder
3. **Si relación falta:** Crear en Data Model
4. **Testing:** Crear usuario de prueba y vincular a operario
5. **Validación:** Verificar datos guardados correctamente en Base44
