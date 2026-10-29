# Propuesta técnica: estructura de roles, módulos por plan y arquitectura de permisos

## 1. Objetivo

Diseñar una arquitectura de producto para que la app pueda ofrecer varias ediciones o planes según la necesidad del cliente, manteniendo una misma base funcional, pero diferenciando claramente:

- versión interna operativa de la empresa,
- versión de obra / cliente,
- versión administrativa / legal,
- versión completa,
- versión demo comercial / prueba sin datos reales.

La propuesta se basa en tres pilares:

- módulos funcionales,
- roles de usuario,
- permisos por entorno y plan.

La intención es que el mismo software pueda servir para:

- control horario,
- supervisión de obra,
- cumplimiento legal y administrativa,
- gestión completa del negocio,
- y una prueba comercial guiada sin riesgo para los datos reales del cliente.

## 2. Principio general

La app no debe ser una sola versión con todos los módulos activos para todos los usuarios.

Debe existir una base común con:

- usuarios y roles,
- permisos,
- auditoría,
- módulos funcionales,
- exportaciones,
- views por entorno,
- feature flags por plan,
- modo demo con datos sintéticos.

A partir de ahí, cada edición activa solo los módulos necesarios y limita la información visible según el tipo de usuario.

## 3. Arquitectura recomendada

### 3.1. Capa base común

Esta capa es compartida por todas las ediciones:

- autenticación,
- gestión de usuarios,
- roles,
- permisos,
- auditoría,
- logs,
- notificaciones,
- configuración,
- exportaciones genéricas,
- almacenamiento,
- retención documental,
- seguridad y control de accesos,
- modo demo / sandbox.

### 3.2. Módulos funcionales

Los módulos principales deberían estar desacoplados y activarse por plan:

- `control_horario`
- `obra`
- `operarios`
- `apuntes_horario`
- `documentos`
- `incidencias`
- `compras`
- `materials`
- `clientes`
- `finanzas`
- `dashboard`
- `compliance_legal`
- `auditoria_legal`
- `export_legal`
- `reporting`
- `demo_sandbox`

Cada edición activa un subconjunto de estos módulos.

### 3.3. Capa de permisos por entorno

La app debe distinguir al menos estas vistas:

- `interna_empresa`
- `cliente_obra`
- `administracion_legal`
- `auditor_externo`
- `completa`
- `demo_trial`

El acceso a cada vista se define por:

- rol del usuario,
- plan contratado,
- permisos concretos,
- módulo activado,
- entidad/tabla permitida,
- campo visible/oculto,
- estado de la sesión demo.

## 4. Estructura de roles por edición

## 4.1. Roles base

- `operario`
- `jefe_obra`
- `control_horario`
- `gerencia`
- `administracion`
- `direccion`
- `cliente_obra`
- `auditor_externo`
- `admin_legal`
- `admin_empresa`
- `demo_evaluador`

## 4.2. Roles por edición

### Edición 1: Control horario

Roles activos:

- `operario`
- `control_horario`
- `jefe_obra`
- `gerencia`
- `administracion`
- `admin_legal`

Permisos mínimos:

- fichajes
- control horario
- validación operativa
- exportación horaria interna
- exportación legal (solo admin legal / administracion)

### Edición 2: Cliente / Obra

Roles activos:

- `cliente_obra`
- `jefe_obra`
- `coordinador_obra`
- `gerencia`
- `administracion`

Permisos mínimos:

- obras
- incidencias de obra
- documentos de obra
- seguimiento de trabajos
- visualización del progreso
- archivo documental de obra

### Edición 3: Administrativa / Legal

Roles activos:

- `admin_legal`
- `administracion`
- `direccion`
- `auditor_externo`

Permisos mínimos:

- control horario legal
- validación de registros
- exportación oficial
- auditoría legal
- retención documental
- acceso redacted / minimizado
- lectura de la versión oficial

### Edición 4: Completa / Empresa

Roles activos:

- todos los roles anteriores
- plus:
  - `admin_empresa`
  - `finanzas`
  - `compras`
  - `rrhh`
  - `dashboard_completo`

Permisos:

- todo el sistema operativo
- todo el sistema legal
- todas las vistas
- todos los módulos activados

### Edición 5: Demo comercial / prueba gratuita

Roles activos:

- `demo_evaluador`
- `admin_empresa`
- `gerencia`
- `administracion`
- `operario`
- `cliente_obra`
- `jefe_obra`

Permisos mínimos:

- acceso completo a la demo durante un plazo limitado,
- datos sintéticos en una empresa de prueba,
- sin acceso a datos reales de terceros,
- sin activación de producción ni de clientes reales,
- exportación demo y visualización completa,
- no se permite uso comercial real ni migración de datos durante la demo.

## 5. Módulos activos por plan

## 5.1. Plan Básico: Control horario

Módulos activos:

- `control_horario`
- `operarios`
- `fichajes`
- `apuntes_horario`
- `incidencias`
- `export_horario`
- `compliance_legal` (solo si se activa la validación legal)
- `auditoria_legal` (solo si corresponde)

Módulos desactivados:

- compras
- finanzas
- materiales
- clientes
- documentos de obra no relacionados con horario
- budget / estimación
- dashboard ejecutivo comercial

## 5.2. Plan Cliente / Obra

Módulos activos:

- `obra`
- `documentos`
- `incidencias`
- `cliente_obra`
- `dashboard_obra`
- `seguimiento_trabajos`
- `estado_obra`

Módulos desactivados:

- control horario (si no es necesario)
- legal compliance
- gestión interna de personal
- compras y finanzas internas

## 5.3. Plan Administrativa / Legal

Módulos activos:

- `control_horario`
- `operarios_minimos`
- `compliance_legal`
- `export_legal`
- `auditoria_legal`
- `retencion_documental`
- `reporting_legal`

Módulos desactivados:

- materiales
- compras
- dashboard comercial
- gestión interna de negocio no requerida
- vistas no regulatorias

## 5.4. Plan Completo / Empresa

Módulos activos:

- todos los módulos anteriores
- plus:
  - `finanzas`
  - `compras`
  - `materiales`
  - `documentos`
  - `clientes`
  - `reporting`
  - `operaciones_generales`

## 5.5. Plan Demo comercial / prueba sin datos reales

Módulos activos:

- todos los módulos del plan completo o del plan elegido en la demo,
- pero con datos seedados ficticios,
- sin acceso a producción,
- sin autenticación con clientes reales,
- con datos de ejemplo y roles demo.

Reglas especiales:

- la demo se ejecuta en un tenant aislado,
- los datos no son exportables reales,
- la expiración se controla por fecha,
- el menú puede mostrar un banner `Demo / Prueba / Sin datos reales`,
- la demo debe resetearse fácilmente o recrearse cada vez que el cliente la inicia.

## 6. Arquitectura de permisos

## 6.1. Estructura de permisos recomendada

El sistema debe usar una estructura tipo RBAC + ABAC:

- RBAC: rol asignado al usuario
- ABAC: condiciones dinámicas (empresa, obra, trabajador, plan, entorno, tenancy/demo)

Ejemplo:

- `can_view_fichajes`
- `can_create_fichaje`
- `can_edit_fichaje`
- `can_export_operativo`
- `can_export_legal`
- `can_validate_legal`
- `can_view_audit`
- `can_view_internal_dashboard`
- `can_view_client_data`
- `can_view_compliance_view`
- `can_view_obra_details`
- `can_access_demo_tenant`
- `can_export_demo_data`
- `can_use_trial_mode`

## 6.2. Modelo recomendado de permisos

```json
{
  "role": "admin_legal",
  "plan": "legal",
  "permissions": [
    "can_view_control_horario",
    "can_validate_legal_records",
    "can_export_legal",
    "can_view_audit_legal",
    "can_view_minimal_worker_data",
    "can_view_official_view"
  ],
  "moduleAccess": [
    "control_horario",
    "compliance_legal",
    "export_legal",
    "auditoria_legal"
  ]
}
```

## 6.3. Niveles de permisos

### A. Por módulo

Se habilita un módulo completo o no.

Ejemplo:

- `moduleAccess: ["control_horario","obra"]`

### B. Por entidad

Se permite ver o editar cierta entidad:

- `Fichaje`
- `Obra`
- `Operario`
- `RegistroHorarioLegal`
- `AuditoriaHorario`
- `DocumentoObra`
- `DemoTenantData`

### C. Por campo

Se ocultan o se muestran campos concretos.

Ejemplo:

- en la vista legal, ocultar: `precio`, `coste`, `id_cliente`, `notas_comerciales`, `comentarios_internos`
- en la vista oficial, mostrar solo: `fecha`, `entrada`, `salida`, `pausa`, `trabajador`, `validación`, `estado legal`
- en demo, ocultar el acceso a “Producción” o “Datos reales” y mostrar banner de demo sintética

### D. Por entorno

- `interna_empresa`
- `legal_oficial`
- `cliente_obra`
- `auditor_externo`
- `demo_trial`

## 7. Vista oficial / compliance: ocultación de datos no relevantes

El entorno legal debe tener una capa de rendered views con minimización de datos.

### 7.1. Datos visibles para la vista oficial

- trabajador
- identificación mínima
- fecha
- entrada
- salida
- pausa
- horas trabajadas
- incidencias relevantes
- estado legal
- validado por
- fecha de validación
- exportación oficial
- auditoría legal

### 7.2. Datos ocultos para la vista oficial

- costes de obra
- presupuestos
- compras internas
- proveedores
- clientes
- notas operativas internas
- dashboards no regulatorios
- KPI del negocio
- comentarios no vinculados a la jornada
- documentos internos no requeridos por control horario

## 8. Arquitectura para distinguir entorno interno vs oficial vs demo

Se recomienda una estructura como esta:

```text
src/
  app/
    internal/
      dashboard/
      horario/
      obra/
      finanzas/
      materiales/
    official/
      cumplimiento/
      legal/
      informes/
      auditoria/
    demo/
      sandbox/
      seed/
      trial/
    shared/
      auth/
      roles/
      permissions/
      audit/
      exports/
      demo-flags/
```

La lógica podría ser:

- `internal` -> carga todos los módulos disponibles según el plan
- `official` -> carga solo la vista legal
- `client` -> carga solo la vista del cliente / obra
- `demo` -> carga datos de prueba, banner de demo, expiración por fecha, tenant aislado

## 9. Propuesta de feature flags por plan y demo

```json
{
  "plans": {
    "control_horario": {
      "modules": [
        "control_horario",
        "operarios",
        "fichajes",
        "export_horario",
        "audit_horario"
      ],
      "roles": [
        "operario",
        "control_horario",
        "jefe_obra",
        "gerencia",
        "administracion"
      ]
    },
    "legal": {
      "modules": [
        "control_horario",
        "compliance_legal",
        "export_legal",
        "auditoria_legal"
      ],
      "roles": [
        "admin_legal",
        "administracion",
        "auditor_externo"
      ]
    },
    "completo": {
      "modules": [
        "control_horario",
        "obra",
        "operarios",
        "materiales",
        "compras",
        "finanzas",
        "dashboard",
        "compliance_legal",
        "export_legal"
      ],
      "roles": [
        "operario",
        "jefe_obra",
        "control_horario",
        "gerencia",
        "administracion",
        "admin_legal",
        "client_obra"
      ]
    },
    "demo_trial": {
      "modules": [
        "control_horario",
        "obra",
        "operarios",
        "documentos",
        "incidencias",
        "dashboard",
        "compliance_legal",
        "export_legal"
      ],
      "roles": [
        "demo_evaluador",
        "admin_empresa",
        "gerencia",
        "administracion",
        "operario",
        "cliente_obra",
        "jefe_obra"
      ],
      "demo": true,
      "durationDays": 14,
      "seedData": true,
      "realDataBlocked": true
    }
  }
}
```

## 10. Reglas de acceso por perfil

### 10.1. Operario

Permisos:

- ver y editar su propio fichaje
- ver su propio historial
- no ver otros trabajadores
- no acceder a exportación legal
- no ver datos comerciales internos

### 10.2. Control horario

Permisos:

- ver todos los fichajes del entorno asignado
- cerrar registros operativos
- validar faltas
- exportación operativa
- no validación oficial legal

### 10.3. Jefe de obra

Permisos:

- ver obra y personal asignado
- gestionar incidencias de obra
- no acceder a datos no ligados a la obra
- no exportación legal

### 10.4. Administración

Permisos:

- ver todo el negocio interno
- validar legalmente
- exportar legal
- acceder a auditoría
- vista oficial

### 10.5. Admin legal

Permisos:

- vista oficial y reducida
- exportación legal
- auditoría legal
- validación de registros oficiales
- acceso restringido a información no regulatoria

### 10.6. Cliente / obra

Permisos:

- ver su obra
- ver incidencias y documentos de obra
- no ver datos internos del personal
- no ver exportación legal

### 10.7. Auditor externo

Permisos:

- lectura de registros legales
- vista oficial / compliance
- exportación legal
- no edición
- no acceso a información comercial no relevante

### 10.8. Usuario demo / evaluador

Permisos:

- acceso a la demo comercial
- navegación por todos los módulos activos de la edición demo
- datos sintéticos
- tiempo limitado de prueba
- no acceso a producción ni migración real
- no exportación fuera del entorno demo

## 11. Propuesta de edición comercial con demo

## 11.1. Plan 1: Solo control horario

Orientado a:

- empresas que solo necesitan controlar jornada y exportar registros.

Incluye:

- fichajes
- control horario
- validación operativa
- exportación horaria
- roles restrictivos

No incluye:

- obra completa
- compras
- finanzas
- módulos de negocio no relacionados con horario

## 11.2. Plan 2: Cliente / Obra

Orientado a:

- clientes que necesitan controlar obra, estado y documentación

Incluye:

- obra
- seguimiento de trabajos
- incidencias
- documentos de obra
- acceso de cliente

No incluye:

- control horario legal
- exportación oficial
- gestión interna de personal

## 11.3. Plan 3: Administrativa / Legal

Orientado a:

- cumplimiento legal,
- auditorías,
- demostración ante administración estatal.

Incluye:

- vista oficial minimizada
- exportación legal
- validación por administración
- auditoría y trazabilidad
- retención legal

No incluye:

- módulos de negocio no regulatorios

## 11.4. Plan 4: Completa

Orientado a:

- gestión integral de empresa

Incluye:

- todo lo anterior
- todos los módulos
- todos los roles
- informes ejecutivos
- operaciones internas

## 11.5. Plan 5: Demo comercial / prueba de x días

Orientado a:

- posibles clientes que quieren probar la app sin riesgo y sin datos reales.

Requisitos:

- se activa con una fecha de fin de prueba,
- usa un tenant aislado,
- carga datos sintéticos generados automáticamente,
- no permite operaciones de producción real,
- todos los módulos principales activos para que el cliente vea el alcance completo,
- se marca con un banner `Demo / Prueba / Datos ficticios`,
- la expiración puede ser 7, 14, 21, 30 o 45 días según la estrategia comercial.

## 12. Recomendación para la demo comercial

La versión demo debe funcionar como una “sandbox” realista, no como una versión limitada sin valor.

Debe permitir:

- explorar la funcionalidad completa,
- probar módulos de gestión,
- validar la UX,
- evaluar permisos y roles,
- exportar informes demo,
- simular un caso de negocio con datos ficticios,
- comparar la app con necesidades reales,
- sin afectar a datos reales ni a clientes reales.

Se recomienda:

- `tenant_demo` aislado,
- `datos_seed` automáticos,
- `watermark` visual en la UI,
- `banner de expiración` visible siempre,
- `bloqueo de exportación real` con etiqueta `demo`,
- `reset` del entorno demo al iniciar una nueva prueba.

## 13. Reglas de la demo comercial

1. La demo no puede usarse con datos reales.
2. La demo debe tener un tiempo de caducidad configurable.
3. La demo debe indicarse claramente como `demo` en interfaz y exportaciones.
4. La demo debe usar un tenant separado y sin acceso a datos de producción.
5. La demo debe permitir una experiencia de transición al plan real.
6. La demo debe ser fácil de resetear y reutilizar.
7. La exportación demo debe estar claramente marcada como no oficial.

## 14. Recomendación de diseño para la app

### 14.1. No duplicar app por versión

La mejor solución es tener:

- base única,
- módulos diferentes,
- roles y permisos por entorno,
- vistas por plan,
- feature flags,
- tenant demo aislado.

### 14.2. La vista oficial debe estar gobernada por redacción de datos

Esto significa que incluso si el plan completo está activado, la vista legal debe mostrar solo lo que es relevante para la administración. La app puede tener acceso completo a la base, pero la vista debería estar “redactada” según el contexto legal.

### 14.3. La demo debe ser un entorno paralelo

La demo no debería mezclarse con la versión productiva. Debe tener:

- un tenant distinto,
- un estado `demo=true`,
- datos synthetic,
- expiración del período de prueba,
- acceso restringido a exportaciones reales.

## 15. Ventaja comercial

Esta propuesta permite vender el producto en varias dimensiones:

- funcionalidad
- tamaño de empresa
- tipo de usuario
- necesidad legal y administrativa
- nivel de acceso
- prueba sin riesgo

Es más sostenible que crear varias apps separadas, porque mantiene:

- reutilización de código,
- menor coste de mantenimiento,
- más seguridad,
- mejor capacidad de crecimiento,
- diferenciación clara por plan,
- demo comercial navegable y útil.

## 16. Conclusión

Sí, este criterio puede aplicarse a toda la app, y además se debe incorporar la dimensión de demo comercial.

La mejor arquitectura es:

- una sola base de producto,
- varios módulos,
- varios roles,
- varios planes,
- y una capa legal/compliance separada,
- plus un entorno demo con datos sintéticos,
- acceso limitado a producción,
- fecha de expiración y banner claro de prueba.

Esto permite:

- vender “solo control horario”,
- vender “solo obra / cliente”,
- vender “administrativa / legal”,
- vender “completa”,
- y ofrecer una demo total con período de prueba sin riesgo para datos reales.

La demo comercial no sustituye la versión final; es una capa de evaluación que reduce fricción comercial y permite valorar la solución antes de la compra real.

---

Proyecto: `cazacumariandorin-sudo/smart-gestion`
Fecha: 2026-10-29
