# Propuesta técnica: estructura de roles, módulos por plan y arquitectura de permisos

## 1. Objetivo

Diseñar una arquitectura de producto para que la app pueda ofrecer varias ediciones o planes según la necesidad del cliente, manteniendo una misma base funcional, pero diferenciando claramente:

- versión interna operativa de la empresa,
- versión de obra / cliente,
- versión administrativa / legal,
- versión completa.

La propuesta se basa en tres pilares:

- módulos funcionales,
- roles de usuario,
- permisos por entorno y plan.

La intención es que el mismo software pueda servir para:

- control horario,
- supervisión de obra,
- cumplimiento legal y administrativa,
- gestión completa del negocio,
- sin mezclar datos irrelevantes con la vista oficial de cumplimiento.

## 2. Principio general

La app no debe ser una sola versión con todos los módulos activos para todos los usuarios.

Debe existir una base común con:

- usuarios y roles,
- permisos,
- auditoría,
- módulos funcionales,
- exportaciones,
- views por entorno,
- feature flags por plan.

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
- seguridad y control de accesos.

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

Cada edición activa un subconjunto de estos módulos.

### 3.3. Capa de permisos por entorno

La app debe distinguir al menos estas vistas:

- `interna_empresa`
- `cliente_obra`
- `administracion_legal`
- `auditor_externo`
- `completa`

El acceso a cada vista se define por:

- rol del usuario,
- plan contratado,
- permisos concretos,
- módulo activado,
- entidad/tabla permitida,
- campo visible/oculto.

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

## 6. Arquitectura de permisos

## 6.1. Estructura de permisos recomendada

El sistema debe usar una estructura tipo RBAC + ABAC:

- RBAC: rol asignado al usuario
- ABAC: condiciones dinámicas (empresa, obra, trabajador, plan, entorno)

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

### C. Por campo

Se ocultan o se muestran campos concretos.

Ejemplo:

- en la vista legal, ocultar: `precio`, `coste`, `id_cliente`, `notas_comerciales`, `comentarios_internos`
- en la vista oficial, mostrar solo: `fecha`, `entrada`, `salida`, `pausa`, `trabajador`, `validación`, `estado legal`

### D. Por entorno

- `interna_empresa`
- `legal_oficial`
- `cliente_obra`
- `auditor_externo`

## 7. Vista oficial / compliance: ocultación de datos no relevantes

El entorno legal debe tener una capa de rendered views con minimización de datos.

### 7.1. Datos visibles para la vista oficial

- trabajador
- DNI/NIE si es requerido
- fecha
- entrada/salida
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

## 8. Arquitectura para distinguir entorno interno vs oficial

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
    shared/
      auth/
      roles/
      permissions/
      audit/
      exports/
```

La lógica podría ser:

- `internal` -> carga todos los módulos disponibles según el plan
- `official` -> carga solo la vista legal
- `client` -> carga solo la vista del cliente / obra

## 9. Propuesta de feature flags por plan

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

## 11. Propuesta de edición comercial

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

## 11.3. Plan 3: Administración / Legal

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

## 12. Recomendación de diseño para la app

### 12.1. No duplicar app por versión

La mejor solución es tener:

- base única,
- módulos diferentes,
- roles y permisos por entorno,
- vistas por plan,
- feature flags.

### 12.2. La vista oficial debe estar gobernada por redacción de datos

Esto significa que incluso si el plan completo está activado, la vista legal debe mostrar solo lo que es relevante para la administración. La app puede tener acceso completo a la base, pero la vista debería estar “redactada” según el contexto legal.

## 13. Ventaja comercial

Esta propuesta permite vender el producto en varias dimensiones:

- funcionalidad
- tamaño de empresa
- tipo de usuario
- necesidad legal y administrativa
- nivel de acceso

Es más sostenible que crear varias apps separadas, porque mantiene:

- reutilización de código,
- menor coste de mantenimiento,
- más seguridad,
- mejor capacidad de crecimiento,
- diferenciación clara por plan.

## 14. Conclusión

Sí, este criterio puede aplicarse a toda la app.

La recomendación técnica es construir una plataforma modular con:

- roles,
- módulos,
- permisos dinámicos,
- feature flags por plan,
- vista oficial / compliance minimizada,
- exportación legal separada,
- auditoría y control de acceso.

De esta forma, se pueden definir modelos como:

- solo control horario,
- solo cliente / obra,
- solo administrativa / legal,
- versión completa,

sin duplicar la aplicación ni mezclar funciones internas con la evidencia legal.

---

Proyecto: `cazacumariandorin-sudo/smart-gestion`
Fecha: 2026-10-29
