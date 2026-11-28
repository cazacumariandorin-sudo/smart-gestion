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

## 6. Matriz exacta de permisos por rol

La siguiente matriz representa el conjunto mínimo recomendado para cada rol.

| Rol | Ver fichajes | Crear fichaje | Editar fichaje | Ver obra | Ver documentos obra | Ver auditoría | Exportar operativo | Exportar legal | Validar legal | Ver datos internos | Editar datos internos | Acceso demo |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| operario | Sí, propios | Sí | Sí, propios | No | No | No | No | No | No | No | No | Sí, si el plan incluye demo |
| control_horario | Sí, todos del ámbito | Sí | Sí, según ámbito | Sí, del ámbito | Sí, del ámbito | Sí, operativa | Sí | No | No | Parcial | Parcial | Sí, demo |
| jefe_obra | Sí, asignados | Sí, según obra | Sí, según obra | Sí, asignada | Sí, asignada | No | Sí, operativo | No | No | No | No | Sí, demo |
| gerencia | Sí, todos | Sí, en gestión | Sí, operativa | Sí | Sí, interna | Sí, operativa | Sí | No | No | Sí, interna | Sí, limitada | Sí, demo |
| administracion | Sí, todos | Sí | Sí, todos | Sí | Sí | Sí | Sí | Sí, si el plan incluye legal | Sí, validación interna | Sí, interna | Sí | Sí, demo |
| admin_legal | Sí, todos | No | No | Sí, mínima | Sí, mínima | Sí, legal | No | Sí, legal | Sí | Sí, minimizada | No | Sí, demo |
| direccion | Sí, resumen | No | No | Sí, resumen | Sí, resumen | Sí, resumen | Sí, resumen | Sí, si plan legal | No | Sí, elevada | No | Sí, demo |
| cliente_obra | Sí, si pertenece a su obra | No | No | Sí, propia | Sí, propia | No | No | No | No | No | No | Sí, demo |
| auditor_externo | Sí, legal | No | No | Sí, mínima | Sí, mínima | Sí, legal | No | Sí, legal | No | No | No | Sí, demo |
| admin_empresa | Sí, todos | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí, demo |
| demo_evaluador | Sí, demo | Sí, demo | Sí, demo | Sí, demo | Sí, demo | Sí, demo | Sí, demo | Sí, demo (solo marca demo) | Sí, demo | Sí, demo | Sí, demo | Sí |

Notas:
- `Ver datos internos` significa ver información del negocio no regulatoria, como costes, proveedores, KPI, finanzas y operaciones internas.
- `Exportar legal` se habilita solo en la vista legal y solo si el plan incluye compliance/legal.
- `Validar legal` queda limitado a `administracion` y `admin_legal`.
- `demo_evaluador` nunca debe poder exportar un archivo que parezca oficial ni real.

## 7. Matriz de módulos activos por plan

| Plan | Módulos activos | Roles clave | Campos visibles principales | Observación |
|---|---|---|---|---|
| Control horario | `control_horario`, `operarios`, `fichajes`, `apuntes_horario`, `incidencias`, `export_horario`, `audit_horario` | operario, control_horario, jefe_obra, gerencia, administracion | `fecha`, `operario`, `entrada`, `salida`, `pausa`, `horas`, `obra`, `notas` | Se ocultan finanzas, compras y datos comerciales |
| Cliente / obra | `obra`, `documentos`, `incidencias`, `cliente_obra`, `dashboard_obra`, `seguimiento_trabajos`, `estado_obra` | cliente_obra, jefe_obra, coordinador_obra, gerencia | `obra`, `estado`, `incidencias`, `documentos`, `avances`, `fecha` | Se ocultan datos internos del personal y legales |
| Administrativa / legal | `control_horario`, `operarios_minimos`, `compliance_legal`, `export_legal`, `auditoria_legal`, `retencion_documental`, `reporting_legal` | admin_legal, administracion, auditor_externo | `fecha`, `operario`, `entrada`, `salida`, `pausa`, `horas`, `estado legal`, `validado_por`, `auditoría` | La vista está minimizada y redactada |
| Completa / empresa | todos los módulos | admin_empresa, gerencia, administracion, direccion, operario, cliente_obra, jefe_obra, control_horario | todo el sistema | incluye negocio interno + legal + obra |
| Demo comercial | selectivo según plan elegido; siempre con `tenant_demo`, `seed_data`, `banner demo`, `expiracion` | demo_evaluador, admin_empresa, gerencia, administracion, operario | los del plan elegido, pero con datos ficticios y marca `demo` | no debe tocar producción ni dejar exportación oficial |

## 8. Matriz de campos visibles por perfil y plan

La siguiente tabla define, a nivel práctico, qué información debe verse en cada perfil para evitar mostrar datos no relevantes.

| Perfil | Plan | Campos visibles | Campos ocultos | Política de visibilidad |
|---|---|---|---|---|
| operario | Control horario | `id_operario`, `nombre`, `fecha`, `entrada`, `salida`, `pausa`, `horas_trabajadas`, `obra` | `costes`, `presupuestos`, `finanzas`, `proveedores`, `notas internas` | Solo sus datos y el propio horario |
| control_horario | Control horario | `operario`, `fecha`, `entrada`, `salida`, `pausa`, `horas`, `obra`, `incidencias`, `notas internas` | `costes`, `facturas`, `proveedores`, `precios` | Solo del ámbito asignado |
| jefe_obra | Control horario / Obra | `operario`, `obra`, `fecha`, `entrada`, `salida`, `incidencias`, `avance obra` | `costes internos`, `datos personales sensibles`, `export legal` | Restringido a la obra asignada |
| gerencia | Completa o horario | `resumen operación`, `obras`, `operarios`, `horas`, `incidencias`, `dashboard` | `datos legales sensibles no requeridos`, `comerciales no relevantes`, `finanzas detalle` | Vista ejecutiva, no legal oficial |
| administracion | Completa o legal | `todo el negocio`, `fichajes`, `auditoría`, `export legal`, `resúmenes` | ninguno, salvo medidas de seguridad | Tiene capacidad de gestión y validación |
| admin_legal | Legal | `fecha`, `operario`, `entrada`, `salida`, `pausa`, `horas`, `estado legal`, `validado_por`, `auditoría`, `export legal` | `costes`, `clientes`, `preferencias comerciales`, `notas internas no regulatorias` | Vista minimizada y oficial |
| direccion | Completa o legal | `resumen legal`, `resumen operativo`, `dashboard ejecutivo`, `informes` | `datos de detalle no requeridos`, `datos personales sensibles en bruto` | Resumen ejecutivo |
| cliente_obra | Obra | `obra`, `documentos`, `incidencias`, `estado obra`, `avances`, `fechas` | `personal`, `horas internas`, `auditoría legal`, `datos reales empresariales` | Solo acceso a su obra |
| auditor_externo | Legal | `detalle legal`, `resumen legal`, `auditoría legal`, `validación` | `datos comerciales`, `costes internos`, `documentación no regulatoria` | Lectura sin edición |
| admin_empresa | Completa | todo | ninguno (siempre que esté en plan completo) | acceso completo del negocio |
| demo_evaluador | Demo | todos los del plan demo | `producción`, `datos reales`, `entorno real` | Siempre marcado como demo |

## 9. Matriz de módulos activos por plan y perfil

| Plan | Perfil | Módulos visibles | Permisos clave |
|---|---|---|---|
| Control horario | operario | `control_horario`, `fichajes` | ver/crear/editar propio |
| Control horario | control_horario | `control_horario`, `fichajes`, `export_horario`, `audit_horario` | crear/corregir y exportar operativo |
| Control horario | jefe_obra | `control_horario`, `obra`, `incidencias` | ver obra asignada |
| Control horario | administracion | `control_horario`, `export_horario`, `audit_horario`, `compliance_legal` | validación, export legal, auditoría |
| Cliente / obra | cliente_obra | `obra`, `documentos`, `incidencias`, `seguimiento_trabajos` | solo lectura de obra |
| Legal | admin_legal | `control_horario`, `compliance_legal`, `export_legal`, `auditoria_legal` | export legal y validación |
| Legal | auditor_externo | `compliance_legal`, `export_legal`, `auditoria_legal` | lectura legal solamente |
| Completa | admin_empresa | todos | acceso total |
| Completa | gerencia | todos los módulos relevantes | dashboard + operación + legal |
| Demo | demo_evaluador | plan elegido + `demo_sandbox` | prueba libre pero aislada |

## 10. Reglas de seguridad por plan

- `demo` siempre debe estar en un tenant separado.
- `demo` nunca debe tener acceso a producción ni datos reales.
- `demo` debe mostrar banner visible: `Demo / Prueba / Datos ficticios`.
- `export_legal` no debe funcionar para demo con nombres de archivos oficiales.
- `admin_legal` debe tener acceso a la vista oficial únicamente.
- `cliente_obra` no puede ver la auditoría legal ni la exportación legal.
- `operario` no puede ver a otros trabajadores ni exportar información de gestión.
- `admin_empresa` puede ver todo dentro del plan completo, pero no debe poder modificar la política de demo.

## 11. Recomendación de implementación técnica

### 11.1. Modo de activación

Recomendado usar `feature flags` y `role permissions`:

```json
{
  "plan": "control_horario",
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
  ],
  "demo": false
}
```

### 11.2. Política de acceso por ruta

La app debe separar rutas por entorno:

- `/internal/*` -> módulos internos
- `/official/*` -> vista legal / compliance
- `/client/*` -> acceso de cliente / obra
- `/demo/*` -> entorno demo

### 11.3. Política de campos visibles

Se recomienda una capa `fieldMask` por rol y entorno:

```json
{
  "role": "admin_legal",
  "view": "official",
  "visibleFields": [
    "fecha",
    "trabajador",
    "entrada",
    "salida",
    "pausa",
    "horas_trabajadas",
    "estado_legal",
    "validado_por",
    "auditoria"
  ],
  "hiddenFields": [
    "coste",
    "precio",
    "proveedor",
    "id_cliente",
    "notas_internas",
    "dashboard_kpi"
  ]
}
```

## 12. Conclusión

La estructura recomendada es clara y puede aplicarse de forma completa a toda la app:

- una base común,
- módulos activados por plan,
- roles con permisos bien definidos,
- visibilidad de campos por perfil,
- separación entre entorno interno y entorno legal,
- entorno demo comercial aislado y con caducidad.

Esto hace posible vender al cliente:

- solo control horario,
- solo cliente / obra,
- administrativo / legal,
- completa,
- o demo comercial para evaluación sin riesgo.

La ventaja es doble:

- mejora la venta comercial por plan,
- y protege la integridad del sistema y del cumplimiento legal.

---

## 13. Estado de integración

**Integrado (2026-11-16): plan por empresa.**

- Entidad `PlanEmpresa`: un plan por empresa (`completo`, `control_horario`, `cliente_obra`, `legal`).
  El plan de la empresa principal es el que gobierna la app; sin plan asignado se usa `completo`.
- `src/lib/planes.js` (catálogo y recorte) + `src/lib/planActivo.js` (plan vigente, una sola carga).
- `useUserRole().canAccess()` exige ahora **rol permitido ∧ módulo del plan**, así que el recorte
  se aplica a la vez en menús, hubs, dashboard y rutas (`ProtectedRoute`), sin duplicar lógica.
- Panel de asignación en Empresas (solo administración puede cambiarlo; gerencia lo ve en lectura).
- Límites deliberados: el plan **no** toca los permisos por rol ni el acceso a los registros (RLS);
  los administradores no se ven afectados por el plan para no quedarse fuera de la app.

**Pendiente (fases siguientes):** vista legal minimizada por campos, roles legales nuevos
(`admin_legal`, `auditor_externo`), cuotas por plan y demo con datos aislados.

**Matriz cerrada (2026-11-28):** la versión aprobada de planes, roles, módulos y acciones,
con sus brechas priorizadas y criterios de aceptación, vive en
[`docs/MATRIZ_PLANES_ROLES.md`](MATRIZ_PLANES_ROLES.md). Este documento queda como
propuesta de origen; ante cualquier discrepancia, prevalece la matriz.

---

## 14. Seguimiento de implementación

Visión aprobada por dirección el 2026-11-28: propuesta completa de ediciones y roles, con los
clientes externos limitados a las obras que se les asignen explícitamente. Esta sección es el
cuadro de mando de la implementación: cada punto se marca aquí al cerrarse.

| # | Punto | Estado | Qué se hizo o qué falta |
|---|---|---|---|
| 1 | El cliente externo solo ve sus obras asignadas | **Cerrado 2026-11-28** | Entidad `AsignacionObraCliente` (histórico de asignación y revocación), campo `clientes_acceso` en `Obra` y `SolarObra`, regla de lectura que solo deja pasar al rol `cliente_obra` cuando su email está en la obra, y pantalla **Usuarios → Obras asignadas** para marcar y retirar obras. La revocación corta el acceso sin borrar registros. |
| 2 | Implementar y verificar la matriz en rutas, acciones y datos | Pendiente | Contraste de los 23 criterios de aceptación de la matriz con la app en producción. |
| 3 | Vista legal minimizada por campos y exportaciones identificadas | Pendiente | Capa de campos visibles por rol y entorno; marcar los archivos de demo como demo. |
| 4 | Roles `direccion`, `admin_legal` y `auditor_externo` | Pendiente | Requiere valor en `User`, permisos de módulo y reglas de datos en el mismo cambio. |
| 5 | Aislamiento de la demo | Pendiente y **bloqueante** | Hoy la demo comparte la base de datos de producción: no debe abrirse a terceros hasta resolverlo. |

Verificación pendiente del punto 1: entrar con un usuario `cliente_obra` real y confirmar que
solo aparecen sus obras asignadas. La regla falla cerrada: si la comprobación no se resuelve,
el cliente no ve ninguna obra en lugar de verlas todas.

---

Proyecto: `cazacumariandorin-sudo/smart-gestion`
Fecha: 2026-10-29
