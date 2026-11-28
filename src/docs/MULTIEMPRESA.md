# Aislamiento multiempresa de SMART-GESTION

Modelo aprobado: **una sola app con los datos aislados por empresa**. No se trata de espacios Base44 separados: la frontera es la pertenencia del usuario a una empresa, aplicada en las reglas de acceso de los datos, no en la interfaz.

## 1. La frontera: `empresa_id`

- Cada usuario tiene **una** empresa (`User.empresa_id`).
- Cada registro que pertenece a una empresa lleva su `empresa_id`.
- Las reglas de acceso comparan ambos valores: `data.empresa_id` = `{{user.data.empresa_id}}`. Un usuario de otra empresa no puede leer ni escribir ese registro, aunque conozca su identificador.

El campo `User.empresa_id` está **bloqueado**: ningún usuario puede cambiárselo desde la app (`base44.auth.updateMe` incluido). Solo se asigna desde el panel de Base44 o desde la app por el propietario, mediante la función `asignarEmpresaUsuario`.

## 2. Roles

| Rol | Alcance |
|---|---|
| **Propietario global** (`es_propietario_global`) | Única cuenta con visión de todas las empresas. Asigna usuarios a empresas, autoriza privilegios y configura los espacios. |
| **Administrador local** (`admin`) | Gestiona su empresa: invita a su plantilla, asigna roles y edita su ficha. Sus lecturas quedan limitadas a su empresa por las mismas reglas. |
| **Gerencia, administración, jefe de obra, técnico, operario, control horario, contabilidad, cliente de obra, ingeniero** | Operan dentro de su empresa. |
| **Demo** (`usuario_demo`) | Rol de entrada para quien colabora con una empresa que no es la suya. Consulta y carga datos en su ámbito; no administra. |

El plan comercial sigue recortando módulos dentro de cada empresa; no amplía permisos ni sustituye al rol.

## 3. Accesos independientes

Una persona que trabaja para dos empresas **no comparte cuenta**: tiene un acceso por empresa. Cada acceso abre únicamente la empresa a la que pertenece y no hay selector de empresa, porque solo le corresponde una.

Al iniciar sesión, la app resuelve la empresa del acceso y trabaja dentro de ella: la franja superior muestra siempre la empresa activa. Si un acceso no tuviera empresa asignada, no se muestra ningún dato y se indica que debe asignarlo su administrador.

El propietario global es la excepción: ve todas las empresas y puede cambiar cuál supervisa.

## 4. Invitaciones

- Las crea el administrador de cada empresa y nacen **selladas con su empresa** (`crearInvitacionUsuario` toma la empresa de quien invita; solo el propietario puede invitar en nombre de otra).
- **Una invitación no concede acceso.** La persona invitada debe confirmarla desde su propia sesión (`gestionarInvitacionAcceso` → `confirmar`): el backend comprueba que el email de la sesión es el invitado, que la invitación sigue pendiente y que la empresa existe. Solo entonces se escribe `empresa_id` y el rol en su usuario.
- El proceso periódico (`aplicarInvitacionAceptada`) **no activa nada**: solo anota que ya existe una cuenta con ese email para que el propietario lo vea en su bandeja.
- Cada empresa ve únicamente sus invitaciones. Un invitado puede leer la suya por su email.

### Alta de una empresa nueva

1. **Solicitud**: la persona entra con Google y pide el alta (`SolicitudEmpresa`, estado `pendiente`). No recibe empresa, rol ni acceso a ningún dato.
2. **Aprobación**: el propietario decide en Empresas → Altas de empresa. Aprobar crea la empresa, su espacio y una invitación `administrador_local` para el email indicado; la solicitud pasa a `aprobada`.
3. **Confirmación**: el administrador entra con su cuenta, ve el nombre de la empresa y confirma. Solo ahí obtiene `empresa_id`, rol de administrador local y la solicitud pasa a `confirmada`.
4. Si su email ya tenía acceso a otra empresa, la confirmación se bloquea: el traslado lo decide el propietario. Si declina, la invitación queda `rechazada` y la solicitud `anulada`.

## 5. Entidades aisladas

| Entidad | Regla aplicada |
|---|---|
| `Empresa` | Lectura y edición solo de la propia ficha (`empresa_id` = id de la empresa). Crear: administración de la empresa; borrar: propietario. |
| `Operario` | Ficha laboral visible y editable solo dentro de su empresa, por su usuario vinculado o por el propietario. |
| `DatosSensiblesUsuario` | DNI, IBAN, salario y contrato: solo la empresa del trabajador, el propio trabajador y el propietario. |
| `InvitacionUsuario` | Invitaciones de la propia empresa; el invitado ve la suya. |
| `EspacioEmpresa` | Ficha del espacio de la propia empresa; el propietario ve todas. |
| `SolicitudPrivilegio` | Solicitudes de la propia empresa; el propietario ve y decide todas. |

Toda alta de estas entidades sella la empresa del usuario en el registro, de modo que un registro nuevo nunca queda sin ámbito.

## 6. Alta y traslado de personas

**Alta**: el administrador de la empresa invita por email; el acceso nace en su empresa con el rol indicado.

**Traslado** (Empresas → Espacios de empresa → Usuarios): el propietario asigna un usuario a otra empresa. La función `asignarEmpresaUsuario` cambia `User.empresa_id` y **mueve con él** su ficha de `Operario` y sus `DatosSensiblesUsuario`. Desde ese momento la empresa anterior deja de verlos.

**Nicuta**: su empresa ya existía como registro propio (`NICUTA CAZACU`). Queda aislada en su propio ámbito: deja de ser visible para los usuarios de SIMANTEC y solo la ve el propietario y, cuando se le asigne el acceso, ella misma. Para darle entrada se usa el traslado de usuarios descrito arriba.

## 7. Estado de la migración

- Datos existentes: todos los usuarios, fichas laborales, datos sensibles e invitaciones se asignan a **SIMANTEC S.L** (empresa principal), que es donde se han venido usando.
- La ficha de cada empresa se sella con su propio `empresa_id`.
- La cuenta `cazacu.mariandorin@gmail.com` queda como **propietario global**.

## 8. Pendiente (fase 2)

Los módulos operativos siguen compartidos entre empresas y deben recibir el mismo patrón (`empresa_id` en el registro + regla por empresa + sellado en el alta): obras y proyectos, fichajes y registro legal, gastos y nóminas, presupuestos y facturación, clientes, flota e inventario. Hasta entonces, el aislamiento cubre identidad, perfiles, datos personales, invitaciones y datos de empresa, que es donde se producía la fuga.
