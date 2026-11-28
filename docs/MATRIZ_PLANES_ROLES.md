# Matriz comercial de planes y roles — v1 aprobada

**Fecha de aprobación:** 2026-11-28
**Alcance de esta entrega:** matriz definitiva (planes × roles × módulos × acciones) y criterios de aceptación. Las brechas detectadas se implementan en fases posteriores, cada una con su propia revisión.
**Decisiones cerradas por dirección:** propuesta completa de ediciones y roles; los clientes externos acceden **solo a las obras que se les asignen explícitamente**.

---

## 1. Principios que gobiernan la matriz

La app aplica tres capas independientes. Ninguna sustituye a las otras:

| Capa | Qué decide | Dónde vive |
|---|---|---|
| **Navegación** | Qué módulos, hubs, rutas y menús ve el usuario | `src/lib/permissions.js`, `src/lib/planes.js`, `src/lib/useUserRole.js`, `ProtectedRoute` |
| **Acción** | Qué operaciones puede ejecutar (crear, editar, validar, exportar) | Botones y pantallas según rol + comprobaciones en funciones backend |
| **Datos** | Qué registros y campos puede leer o modificar | Reglas de acceso por registro (`rls`) de cada entidad |

Reglas permanentes:

1. El **plan contratado recorta módulos**; nunca amplía permisos ni acceso a registros.
2. Un módulo oculto tampoco se abre por URL directa.
3. **Ocultar en interfaz no protege datos.** Toda restricción de registros se declara en la capa de datos.
4. Los roles `admin` y `propietario` mantienen acceso total para poder configurar el plan y recuperar la app.
5. El plan se resuelve por la **empresa principal** del workspace. No existe todavía arquitectura multiempresa independiente y esta matriz no la presupone.

---

## 2. Inventario real (verificado en código)

### 2.1. Roles existentes en la plataforma

Declarados en `base44/entities/User.jsonc`:

| Rol | Uso real hoy | Notas |
|---|---|---|
| `admin` | Administración técnica de la app | Acceso total |
| `propietario` | Alias explícito de `admin` | Acceso total |
| `gerencia` | Dirección operativa | Alcance amplio, incluido económico |
| `administracion` | Administración y validación legal | Alcance amplio, incluida validación |
| `director_comercial` | Comercial | Todo salvo datos sensibles, backup y expedientes |
| `ingeniero` | Operativo de Ingeniería / ObraCheck | Módulo Ingeniería y presupuestos |
| `jefe_obra` | Jefatura de obra | Obra, personal, partes y material |
| `técnico` | Rol de campo principal | No se modifica su alcance |
| `operario` | Rol legado | Sin usuarios reales; alcance idéntico a `técnico` |
| `control_horario` | Control de presencia | Horario, partes y chat |
| `cliente_obra` | Cliente externo | Solo lectura de obra e informe |
| `contabilidad` | Gestoría / contabilidad | Económico, gastos, pedidos y conciliación |
| `usuario_demo` | Cuenta de demostración | Lista reducida de módulos y caducidad |

### 2.2. Planes existentes

`completo`, `control_horario`, `cliente_obra`, `legal`. La demo **no es un plan**: es un escenario comercial que se ejecuta con el rol `usuario_demo` y marca de demo.

### 2.3. Módulos reales

Los 40 módulos de `ALL_MODULES` son la unidad de recorte. Las funciones descritas en la propuesta original como módulos separados (`incidencias`, `export_legal`, `auditoria_legal`, `retencion_documental`, `seguimiento_trabajos`, `dashboard_obra`) **no son claves de navegación**: son pestañas, informes o acciones dentro de un módulo existente. La matriz las trata como **acciones**, no como módulos nuevos.

---

## 3. Mapa de roles: propuesta original → decisión cerrada

No se crean roles nuevos salvo donde aportan un alcance de datos distinto y verificable.

| Rol propuesto | Decisión | Motivo |
|---|---|---|
| `admin_empresa` | **No se crea.** Se usa `admin` / `propietario` | Duplicaría el acceso total sin aportar nada |
| `direccion` | **Se crea** | Vista ejecutiva de resumen, sin operación ni validación |
| `admin_legal` | **Se crea** | Vista legal minimizada con validación y exportación oficial |
| `auditor_externo` | **Se crea** | Lectura legal estricta, sin edición ni exportación propia |
| `coordinador_obra` | **No se crea.** Se usa `jefe_obra` | Mismo alcance operativo de obra |
| `demo_evaluador` | **No se crea.** Se usa `usuario_demo` | Ya existe con caducidad y marca de demo |
| `finanzas`, `compras`, `rrhh` | **No se crean como roles** | Son funciones cubiertas por `administracion` y `gerencia`; crear roles obligaría a reescribir reglas de datos de todo el sistema |
| `cliente_obra` | **Ya existe** | Se limita a obras asignadas (ver apartado 6) |
| `control_horario`, `operario`, `gerencia`, `administracion` | **Ya existen** | Sin cambios de alcance |

**Consecuencia crítica y obligatoria:** un rol que exista en la lista de `User` pero no en `permissions.js` y en las reglas de acceso de las entidades **no ve nada**. Crear `direccion`, `admin_legal` o `auditor_externo` exige, en el mismo cambio: valor en el enum de `User`, entrada en `ROLE_MODULE_PERMISSIONS`, y reglas de lectura en las entidades que deba consultar. Nunca se añade el rol suelto.

---

## 4. Matriz de planes × módulos (definitiva)

Los planes se cierran **tal como están implementados hoy**. La propuesta original no exige claves nuevas: lo que describía como módulos adicionales son acciones dentro de estos módulos.

| Plan | Módulos activos | Módulos excluidos (destacados) |
|---|---|---|
| **Completo / Empresa** | Todos los que permita el rol | Ninguno |
| **Control horario** | `dashboard`, `control-horario`, `apuntes-horario`, `operarios`, `calendario-vacaciones`, `chat` | Económico, contabilidad, nóminas, presupuestos, materiales, pedidos, obras, ingeniería, expedientes, sistema |
| **Cliente / Obra** | `dashboard`, `informe-obras`, `galeria-fotos`, `chat` | Personal, horario, económico, presupuestos, materiales, expedientes, sistema |
| **Administrativa / Legal** | `dashboard`, `control-horario`, `expedientes`, `chat` | Obras, materiales, económico, presupuestos, ingeniería, sistema |
| **Demo (escenario)** | Lista de `usuario_demo`: `dashboard`, `work-orders`, `clients`, `obras`, `orders`, `drawings`, `manuales`, `notas-gastos`, `flota`, `galeria-fotos`, `control-horario`, `calendario-vacaciones`, `apuntes-horario`, `photos` | Nóminas, contabilidad, presupuestos, ingeniería, expedientes, sistema, datos sensibles |

Regla de intersección: **módulo visible = permitido por el rol ∧ incluido en el plan**. Los administradores quedan fuera del recorte para no bloquear la configuración.

Acciones que la matriz asigna a módulos existentes (no crean claves nuevas):

| Acción de la propuesta | Dónde vive realmente |
|---|---|
| Fichajes, validación operativa | `control-horario` (pestañas de fichajes y registro legal) |
| Exportación horaria y exportación legal | `control-horario`, acción de exportar (restringida por rol) |
| Auditoría legal y retención documental | `control-horario` y `expedientes` |
| Incidencias y seguimiento de trabajos | `informe-obras`, `parte-diario`, `trabajos-extras` |
| Documentos y archivo de obra | `galeria-fotos`, `drawings`, `manuales` |
| Dashboard ejecutivo y reporting | `dashboard`, `economico-dashboard`, `reports` |

---

## 5. Matriz de roles × acciones

Símbolos: **S** = sí · **N** = no · **P** = parcial o limitado a su ámbito · **—** = no aplica en su plan.

| Rol | Navegar según plan | Crear registros | Editar registros | Validar legal | Exportar operativo | Exportar legal | Ver datos internos | Gestionar usuarios | Acceso demo |
|---|---|---|---|---|---|---|---|---|---|
| `admin` / `propietario` | S (sin recorte) | S | S | S | S | S | S | S | S |
| `gerencia` | S | S | S | N | S | N | S | S | S |
| `administracion` | S | S | S | S | S | S | S | S | S |
| `direccion` (nuevo) | S | N | N | N | S (resumen) | N | S (resumen) | N | S |
| `admin_legal` (nuevo) | S | N | N | S | N | S | N | N | S |
| `auditor_externo` (nuevo) | S | N | N | N | N | S (lectura) | N | N | S |
| `director_comercial` | S | S | S | N | S | N | S | N | S |
| `ingeniero` | S | S | S | N | S | N | P | N | S |
| `jefe_obra` | S | S | S | N | S | N | N | N | S |
| `técnico` | S | S | P (propios) | N | P | N | N | N | S |
| `operario` | S | S | P (propios) | N | N | N | N | N | S |
| `control_horario` | S | S | P (su ámbito) | N | S | N | N | N | S |
| `contabilidad` | S | S | P (económico) | N | S | N | S (económico) | N | S |
| `cliente_obra` | S | N | N | N | N | N | N | N | S |
| `usuario_demo` | S (lista demo) | S (demo) | S (demo) | N | S (marcado demo) | N | S (demo) | N | S |

Notas de aplicación:

- **Exportar legal** solo existe para `administracion`, `admin_legal` y `auditor_externo` (este último en modo lectura), y solo si el plan incluye la parte legal.
- **Validar legal** queda limitado a `administracion` y `admin_legal`.
- **Ver datos internos** significa costes, proveedores, márgenes y finanzas internas; no incluye datos personales sensibles, que siguen su propia regla.
- `usuario_demo` no puede generar archivos que aparenten ser oficiales.

---

## 6. Acceso a datos por rol (estado real y objetivo)

Esta tabla es la que impide el acceso cruzado. Resume el comportamiento **actual** y la brecha frente al objetivo.

| Ámbito | Estado actual | Objetivo de la matriz |
|---|---|---|
| Obras civiles | El rol `cliente_obra` puede leer **todas** las obras | Solo las obras asignadas al cliente |
| Obras solares | `cliente_obra` **no** tiene lectura | Solo las obras asignadas, con el mismo criterio |
| Fichajes | Cada trabajador ve los suyos; gestión ve los de su ámbito | Sin cambios |
| Registro horario legal | El trabajador ve los suyos por email; validación y exportación solo administración | Sin cambios; añadir lectura para `admin_legal` y `auditor_externo` |
| Nóminas | Cada trabajador ve la suya; gestión y administración ven todas | Sin cambios |
| Presupuestos | Solo perfiles de gestión y comercial | Sin cambios |
| Expedientes | Gerencia, administración y admin | Añadir `admin_legal`; mantener fuera a `auditor_externo` |
| Gastos y justificantes | Según rol y autoría | Sin cambios |
| Protocolos internos | Filtro por confidencialidad además del rol | Sin cambios |
| Usuarios | Solo admin, propietario, gerencia y el propio usuario | Sin cambios |

### 6.1. Modelo de vinculación cliente–obra (decisión cerrada)

- Una **asignación** vincula un usuario con rol `cliente_obra` a una obra concreta, con estado activo o revocado y trazabilidad de quién la asigna y cuándo.
- El cliente puede tener varias obras asignadas, y una obra puede tener varios clientes.
- Al **revocar** la asignación, el cliente pierde el acceso de inmediato, sin borrar historial.
- La comprobación se hace en la **capa de datos**, no solo en la pantalla: un cliente sin asignación activa no puede leer la obra aunque conozca su identificador.
- La rama de administración se mantiene siempre en las reglas de lectura y escritura.
- Mecanismo concreto de la regla (campo de acceso en la propia obra frente a entidad de asignaciones consultada en servidor) se decide en la fase de implementación, porque exige verificar qué operadores admite el motor de reglas. La matriz fija el requisito, no la técnica.

---

## 7. Escenario demo

**Ya disponible:** rol `usuario_demo` con lista reducida de módulos, `tipo_cuenta = demo`, caducidad de la cuenta, invitaciones de demo, banner y marca de agua de demo.

**Objetivo de la matriz:** demo aislada, con datos sintéticos, vencimiento, restablecimiento y exportaciones marcadas como demo.

**Brecha reconocida:** hoy la demo se ejecuta sobre la **misma base de datos que producción**. Mientras no exista aislamiento, la demo no puede ofrecerse a terceros como entorno seguro: el aislamiento por marca y por rol reduce el riesgo, no lo elimina.

---

## 8. Brechas priorizadas

| Prioridad | Brecha | Qué exige |
|---|---|---|
| **P0** | El cliente externo ve todas las obras | Modelo de asignación cliente–obra y regla de lectura por asignación, en obras civiles y solares |
| **P0** | Demo sobre la base de datos de producción | Decidir aislamiento antes de abrir demo a terceros |
| **P1** | Roles `direccion`, `admin_legal`, `auditor_externo` no existen | Enum de `User`, permisos de módulo y reglas de datos, en un solo cambio |
| **P1** | Vista legal minimizada por campos | Capa de campos visibles por rol y entorno |
| **P2** | Exportaciones legales sin restricción explícita por rol | Restringir y marcar el archivo según rol y plan |
| **P2** | Cuotas y ciclo comercial por plan | Fuera del alcance técnico actual; requiere definición comercial |

---

## 9. Criterios de aceptación

Cada criterio se verifica con un usuario real del rol indicado.

**Planes y navegación**
- AC-01 Con plan `control_horario`, un `técnico` ve Inicio, Horario, Apuntes, Técnicos, Vacaciones y Chat, y no ve Económico, Obras ni Ingeniería.
- AC-02 Con plan `control_horario`, abrir por URL una ruta excluida devuelve al inicio.
- AC-03 Con plan `cliente_obra`, ningún rol interno ve Nóminas, Presupuestos ni Contabilidad.
- AC-04 Con plan `legal`, solo aparecen Inicio, Control horario, Expedientes y Chat.
- AC-05 Un administrador sigue viendo todos los módulos con cualquier plan y puede cambiarlo.
- AC-06 Cambiar de plan refresca menús y hubs sin recargar la app.

**Roles**
- AC-07 `cliente_obra` no puede crear ni editar obras, partes ni documentos.
- AC-08 `control_horario` no ve datos económicos ni nóminas.
- AC-09 `contabilidad` no ve expedientes, protocolos confidenciales ni datos sensibles.
- AC-10 Un rol sin entrada en permisos no accede a ningún módulo, y ese caso queda documentado, no silencioso.

**Datos**
- AC-11 Un cliente asignado a una obra la ve con sus documentos, avances e incidencias autorizados.
- AC-12 Ese mismo cliente no ve ninguna otra obra, ni por listado ni por identificador directo.
- AC-13 Revocar la asignación corta el acceso en la siguiente carga, sin borrar registros.
- AC-14 Reasignar la obra a otro cliente no expone el histórico del anterior.
- AC-15 Un trabajador solo lee sus propios fichajes y su propio registro legal.
- AC-16 Un usuario sin rol de gestión no puede leer nóminas ajenas.

**Legal**
- AC-17 Solo `administracion` y `admin_legal` validan registros legales.
- AC-18 La exportación legal solo se genera con esos perfiles y con plan que la incluya.
- AC-19 `auditor_externo` consulta sin editar y no puede validar.

**Demo**
- AC-20 Un `usuario_demo` ve el banner de demo en todo momento.
- AC-21 Al vencer la cuenta, el acceso se rechaza.
- AC-22 Ninguna acción de demo escribe sobre datos de producción.
- AC-23 Un archivo exportado desde demo queda marcado como demo y no puede confundirse con un documento oficial.

---

## 10. Registro de decisiones

1. Los cuatro planes actuales se mantienen; la demo es escenario, no plan.
2. Se crean tres roles nuevos como máximo (`direccion`, `admin_legal`, `auditor_externo`) y solo con permisos y reglas de datos en el mismo cambio.
3. `coordinador_obra`, `admin_empresa`, `demo_evaluador`, `finanzas`, `compras` y `rrhh` no se crean; se cubren con roles existentes.
4. El cliente externo solo accede a obras asignadas explícitamente.
5. El plan recorta módulos; no altera permisos de rol ni acceso a registros.
6. La demo no se ofrece a terceros hasta resolver el aislamiento de datos.
7. Cualquier cambio futuro de esta matriz se anota aquí con fecha y motivo.
