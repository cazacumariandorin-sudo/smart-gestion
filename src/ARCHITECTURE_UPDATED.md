# Arquitectura Actualizada: Separación de Obras Civiles y Solares

## 🎯 Visión General

Se ha reestructurado completamente la gestión de obras para separar **Obras Civiles** y **Obras Solares** como dos entidades independientes, cada una con:
- ✅ Su propia gestión de registros
- ✅ Permisos/módulos independientes
- ✅ Rutas dedicadas
- ✅ Componentes especializados

---

## 📁 Estructura de Carpetas

```
src/
├── pages/
│   ├── ObrasCiviles.jsx          ← Nueva: Gestión de obras civiles
│   ├── Solar.jsx                  ← Nueva: Hub principal de Solar
│   ├── solar/                     ← Sub-módulos integrados
│   │   ├── SolarObras.jsx        ← Obras solares específicas
│   │   ├── SolarClientes.jsx     ← Clientes para proyectos solares
│   │   ├── SolarMateriales.jsx   ← Materiales solares
│   │   └── SolarLegalizacion.jsx ← Legalización/documentación
│   └── SolarPedidos.jsx          ← [DEPRECATED] → ahora es Solar.jsx
│
├── components/
│   └── obras/
│       ├── ObraMaterialesPanel.jsx
│       └── ObraFotosPanel.jsx
│
└── App.jsx                         ← Rutas actualizadas
```

---

## 🛣️ Enrutamiento (Routing)

### ANTES (Problema)
```javascript
// ❌ Rutas confusas y duplicadas
/obras                    → Obras (sin especificar tipo)
/solar-pedidos           → Contenía SolarObras + SolarClientes + etc
/solar-obras             → INCORRECTO: apuntaba a SolarPedidos
```

### AHORA (Solución)
```javascript
// ✅ Rutas claras y separadas
/obras-civiles           → ObrasCiviles.jsx (module: "obras-civiles")
/solar                   → Solar.jsx (module: "solar")
                           ├── Tab: Obras Solar
                           ├── Tab: Clientes
                           ├── Tab: Materiales
                           └── Tab: Legalización

// Redirecciones legacy
/Obras                   → /obras-civiles (PascalCase redirect)
/SolarPedidos           → /solar
```

---

## 🔐 Sistema de Permisos

### Módulos (ProtectedRoute)

```javascript
// Obras Civiles
<Route path="/obras-civiles" element={
  <ProtectedRoute module="obras-civiles"> 
    <ObrasCiviles />
  </ProtectedRoute>
} />

// Solar (con todos sus sub-módulos)
<Route path="/solar" element={
  <ProtectedRoute module="solar">
    <Solar />
  </ProtectedRoute>
} />
```

**Configuración en Backend:**
- Usuario con permiso `obras-civiles` → puede acceder a `/obras-civiles`
- Usuario con permiso `solar` → puede acceder a `/solar` (y todos sus tabs)
- Ambos permisos son independientes

---

## 📊 Comparativa: Antes vs Después

| Aspecto | ANTES | AHORA |
|--------|-------|-------|
| **Obras Civiles** | `/obras` (genérico) | `/obras-civiles` (específico) |
| **Obras Solares** | Dentro de `/solar-pedidos` | `/solar/obras` (tab integrado) |
| **Clientes Solares** | Dentro de `/solar-pedidos` | `/solar/clientes` (tab integrado) |
| **Materiales Solares** | Dentro de `/solar-pedidos` | `/solar/materiales` (tab integrado) |
| **Legalización Solar** | Dentro de `/solar-pedidos` | `/solar/legalizacion` (tab integrado) |
| **Permisos** | `obras`, `orders` (confusos) | `obras-civiles`, `solar` (claros) |
| **Datos en DB** | Tipo = "civil" o "solar" | Entidades separadas: ObraCivil, ObraSolar |

---

## 🔄 Flujo de Datos

### Obras Civiles
```
App.jsx
  → /obras-civiles (ProtectedRoute module="obras-civiles")
    → ObrasCiviles.jsx
      → base44.entities.ObraCivil.list()
      → Mostrar grid de obras civiles
      → CRUD de obras civiles
```

### Solar (Integrado)
```
App.jsx
  → /solar (ProtectedRoute module="solar")
    → Solar.jsx (Hub principal)
      → useTabState('solar') para persistencia
      → Tab: Obras
        → SolarObras.jsx
          → base44.entities.ObraSolar.list()
      → Tab: Clientes
        → SolarClientes.jsx
          → base44.entities.ClienteSolar.list()
      → Tab: Materiales
        → SolarMateriales.jsx
          → base44.entities.MaterialSolar.list()
      → Tab: Legalización
        → SolarLegalizacion.jsx
          → base44.entities.LegalizacionSolar.list()
```

---

## 📝 Componentes Principales

### 1. ObrasCiviles.jsx
**Ubicación:** `src/pages/ObrasCiviles.jsx`

**Responsabilidades:**
- Listar obras civiles
- Crear/Editar/Eliminar obras civiles
- Panel de detalle con:
  - Info general
  - Materiales asociados
  - Fotos/Galería

**Query Keys:**
```javascript
queryKey: ['obras-civiles']
```

**API Calls:**
```javascript
base44.entities.ObraCivil.list('-start_date', 300)
base44.entities.ObraCivil.create(data)
base44.entities.ObraCivil.update(id, data)
base44.entities.ObraCivil.delete(id)
```

---

### 2. Solar.jsx
**Ubicación:** `src/pages/Solar.jsx`

**Responsabilidades:**
- Hub principal que orquesta los 4 sub-módulos
- Gestión de tabs con persistencia (`useTabState`)
- Header con branding Solar
- Enrutamiento interno via Tabs

**Features:**
- Tab State Persistence: El usuario vuelve al tab donde estaba
- Lazy loading de sub-componentes
- Protección con ProtectedRoute (module="solar")

---

### 3. Solar Sub-módulos

#### SolarObras.jsx
```javascript
// Obras solares específicas
queryKey: ['solar-obras']
API: base44.entities.ObraSolar.list()
```

#### SolarClientes.jsx
```javascript
// Clientes para proyectos solares
queryKey: ['solar-clientes']
API: base44.entities.ClienteSolar.list()
```

#### SolarMateriales.jsx
```javascript
// Inventario de materiales solares
queryKey: ['solar-materiales']
API: base44.entities.MaterialSolar.list()
```

#### SolarLegalizacion.jsx
```javascript
// Tramitación y legalización de instalaciones
queryKey: ['solar-legalizacion']
API: base44.entities.LegalizacionSolar.list()
```

---

## 🚀 Cómo Usar

### Navegar a Obras Civiles
```javascript
import { useNavigate } from 'react-router-dom';

const nav = useNavigate();
// Ir a obras civiles
nav('/obras-civiles');
```

### Navegar a Solar
```javascript
// Ir a solar (abre en tab "obras" por defecto)
nav('/solar');

// El usuario verá todos los tabs disponibles
// y se recordará cuál era el último que visitó
```

---

## 🔧 Configuración Backend Requerida

### Entidades
```javascript
// Antes: una sola entidad "Obra" con campo type
base44.entities.Obra
  ├── name, code, type: 'civil' | 'solar'

// Ahora: dos entidades separadas (RECOMENDADO)
base44.entities.ObraCivil
  ├── name, code, client_id, address, etc.

base44.entities.ObraSolar
  ├── name, code, client_id, potencia_kw, etc.
  ├── (pueda tener campos específicos de solar)
```

### Permisos
```javascript
// Usuario A: Solo obras civiles
user.permissions = ['obras-civiles']

// Usuario B: Solo solar
user.permissions = ['solar']

// Usuario Admin: Ambas
user.permissions = ['obras-civiles', 'solar']
```

---

## ✅ Checklist de Migración

- [x] Crear `ObrasCiviles.jsx`
- [x] Crear `Solar.jsx` (renombrado de `SolarPedidos.jsx`)
- [x] Actualizar rutas en `App.jsx`
  - [x] `/obras-civiles` → ObrasCiviles
  - [x] `/solar` → Solar (integrado con tabs)
  - [x] Legacy redirects: `/Obras` → `/obras-civiles`
  - [x] Legacy redirects: `/SolarPedidos` → `/solar`
- [x] Proteger rutas con ProtectedRoute
  - [x] module="obras-civiles"
  - [x] module="solar"
- [x] Agregar useTabState en Solar.jsx
- [ ] Crear entidades separadas en Backend (ObraCivil, ObraSolar)
- [ ] Configurar permisos en Backend
- [ ] Actualizar menú de navegación
- [ ] Actualizar documentación de usuario
- [ ] Testing end-to-end

---

## 📌 Consideraciones Futuras

1. **Dashboard separados**: Mostrar métricas de obras civiles vs solares
2. **Reportes específicos**: Cada tipo de obra con KPIs diferenciados
3. **Workflow específico**: Procesos diferentes para solar (legalización, paneles, etc.)
4. **Sub-usuarios**: Usuarios solo para solar, solo para civiles
5. **Integración terceros**: APIs específicas para energía solar

---

## 🎓 Referencias

- Arquitectura anterior: `src/ARCHITECTURE_IMPROVEMENTS.md`
- Componentes reutilizables: `src/components/`
- Sistema de permisos: `src/lib/AuthContext.js`
- Hooks custom: `src/hooks/useTabState.js`
