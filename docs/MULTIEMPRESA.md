# Modelo multiempresa de SMART-GESTION

Documento de referencia del modelo aprobado: **un espacio Base44 por empresa**, con SIMANTEC tratada como una empresa más. Complementa `MATRIZ_PLANES_ROLES.md` (planes, roles y acceso a datos) y `propuesta_comercial.md` (seguimiento de implementación).

## 1. Principio de aislamiento

Cada empresa trabaja en su propio espacio de Base44: su base de datos, sus usuarios, sus ficheros y sus automatizaciones. El aislamiento no depende de filtros de interfaz ni de reglas de fila: **el límite es el espacio**. Los usuarios de una empresa no pueden consultar ni modificar datos de otra porque no existen en su base de datos.

Consecuencias directas:

- No hay tablas compartidas entre empresas ni identificadores cruzados.
- Los informes, búsquedas y exportaciones de una empresa solo alcanzan su propio espacio.
- Las copias de seguridad y las integraciones (Drive, correo) se configuran por espacio.

## 2. Roles en el modelo

| Rol | Alcance |
|---|---|
| **Propietario** | Único rol transversal. Da de alta los espacios, autoriza privilegios y puede entrar en cualquier espacio. No se solicita ni se delega. |
| **Administrador local** | Un usuario por empresa, designado al crear el espacio. Invita a su plantilla, asigna roles y gestiona permisos dentro de su espacio. No ve otras empresas. |
| **Resto de roles** | Los de siempre (gerencia, administración, jefe de obra, técnico, operario, control horario, contabilidad, cliente de obra, ingeniero). Los asigna la propia empresa dentro de su espacio. |
| **Demo** | Rol de entrada para quien colabora con una empresa que no es la suya. Consulta y carga datos en el alcance demo; no tiene privilegios administrativos. |

El plan comercial recorta módulos dentro de cada espacio; no amplía permisos ni sustituye al rol.

## 3. Alta de una empresa (aprovisionamiento)

El propietario crea el espacio y registra su ficha en **Empresas → Espacios de empresa**. Pasos, que la ficha refleja:

1. Espacio Base44 creado para la empresa.
2. App publicada en ese espacio.
3. Administrador local invitado y confirmado.
4. Plan comercial asignado.
5. Acceso y aislamiento verificados (prueba con dos usuarios de empresas distintas).

Mientras un paso no esté hecho, el espacio figura como *pendiente de configurar*. Solo pasa a *activo* cuando el checklist está completo y hay uso real.

## 4. Usuarios, invitaciones e identidad múltiple

- **Alta de usuarios**: la hace el administrador local de cada empresa desde su espacio. El propietario no invita plantilla ajena salvo petición expresa.
- **Un usuario, dos empresas**: no se duplica la cuenta. En su empresa de origen es usuario con su rol habitual; en la empresa con la que colabora entra con rol **demo**. Cada espacio tiene su propio registro de usuario y su propio rol: cambiar el rol en un espacio no afecta al otro.
- **Quién decide el rol**: la empresa que gestiona al usuario, es decir, el administrador local del espacio donde trabaja. El rol demo es un punto de partida, no un estado permanente.
- **Baja**: se retira el acceso en el espacio correspondiente; no se borra el usuario de los demás.

## 5. Solicitudes de privilegios

Cuando una empresa necesita más permisos para un usuario, su administrador registra una **solicitud** (Empresas → Solicitudes de privilegios) con empresa, usuario, rol actual, rol solicitado y motivo.

Estados y significado:

- **Pendiente** → espera la decisión del propietario.
- **Aprobada** → autorizada; falta aplicarla.
- **Rechazada** → denegada, con el motivo registrado.
- **Aplicada** → el rol ya se cambió en el espacio de esa empresa.
- **Anulada** → retirada antes de decidir.

La aprobación **autoriza**, no ejecuta: el cambio de rol se realiza en el espacio de la empresa solicitante, donde vive ese usuario, y solo allí. Después se marca como aplicada. Cada paso queda en el historial de la solicitud (quién, cuándo, estado anterior y nuevo), de modo que hay trazabilidad completa de la decisión y de su aplicación.

## 6. Sincronización de versiones

Las copias de la app evolucionan por separado. Para evitar divergencias:

- La ficha del espacio guarda la versión o fecha de la copia replicada.
- Los cambios estructurales (entidades, reglas, funciones compartidas) se replican desde el espacio de referencia y se anotan en la ficha.
- Una empresa no recibe cambios de datos de otra: solo código y configuración.

## 7. Límites y reglas

- **Sin migración automática entre espacios.** Mover datos de una empresa a otra exige una regla de asignación explícita y revisión humana.
- **El rol demo no administra.** No invita usuarios, no cambia roles y no accede a módulos económicos, legales ni de personal.
- **El propietario es la única excepción transversal.** Cualquier otro acceso ampliado debe pasar por una solicitud aprobada.
- **Los datos personales y económicos no salen del espacio** al que pertenecen, salvo decisión expresa del propietario.

## 8. Qué hace la app y qué se hace en Base44

La app registra y coordina el modelo: ficha de cada espacio, administrador local, estado del aprovisionamiento, plan y solicitudes con su decisión.

La creación efectiva de un espacio, la publicación de la app en él, la invitación del administrador local y la asignación del plan se realizan desde el panel de Base44 del propietario. La app no crea espacios ni mueve usuarios entre ellos.

## 9. Estado

| Pieza | Estado |
|---|---|
| Entidad `EspacioEmpresa` y ficha por empresa | Implementado |
| Entidad `SolicitudPrivilegio` con historial | Implementado |
| Decisión del propietario (aprobar / rechazar / aplicada) | Implementado |
| Documentación del modelo | Implementado |
| Alta de espacios desde el panel de Base44 | Proceso manual del propietario |
| Verificación de aislamiento con dos empresas reales | Pendiente de ejecutar |
