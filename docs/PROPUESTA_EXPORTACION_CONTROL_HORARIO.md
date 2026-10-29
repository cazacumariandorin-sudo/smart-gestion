# Propuesta técnica: modelo de exportación del módulo de control horario/fichaje

## 1. Objetivo

Este documento define la propuesta técnica para evolucionar el módulo de control horario/fichaje del proyecto `smart-gestion` hacia un modelo de exportación robusto y legalmente defensable, configurado para separar claramente:

- la gestión operativa diaria del control horario,
- del registro legal y oficial que debe administrar y conservar la empresa/administración.

La propuesta responde a un escenario real: los trabajadores fallan bastante en registrar su jornada, por lo que la empresa necesita un mecanismo operativo de corrección y cierre forzado, pero sin que ese mecanismo sustituya al registro legal oficial que debe ser validado, gestionado y conservado por Administración.

## 2. Principio de diseño

La regla base es la siguiente:

- El sistema actual de fichajes sigue siendo útil para la gestión operativa.
- Pero la “versión oficial de cumplimiento legal” debe ser una capa independiente, creada, validada y exportada por Administración.
- El cierre forzado por gerencia se mantiene como acción operativa, pero NO debe ser considerado el registro legal definitivo.
- La prueba legal debe ser la versión oficial, validada por Administración, y conservada como evidencia.

## 3. Contexto del sistema actual

El repositorio ya contempla un módulo funcional de fichajes con estas capacidades:

- registro de fichajes por día y por operario,
- entrada/salida + pausa + obra,
- cálculo de horas trabajadas,
- filtros por mes y por operario,
- detección de duplicados,
- cierre forzado de fichajes abiertos,
- exportación a PDF y Excel,
- control de acceso por roles.

Esto ya es una base sólida para la operación diaria. Sin embargo, la exportación actual está pensada como reportaje visual y no como un “expediente legal” con trazabilidad, validación y conservación.

## 4. Diagnóstico del problema legal

### 4.1. Lo que está bien

- El registro de fichajes es diario y individual.
- Se recoge la hora de entrada/salida, pausa y obra.
- Hay un flujo operativo para corregir faltas.
- Existen herramientas para cerrar fichajes abiertos y detectar duplicados.

### 4.2. Lo que no es suficientemente sólido para cumplimiento legal

El sistema actual no distingue claramente entre:

- registro operativo provisional,
- y registro legal oficial.

Esto genera un riesgo real:

- una corrección o cierre forzado por gerencia puede terminar confundido con el registro legal definitivo,
- sin dejar una trazabilidad clara de quién lo validó, cuándo y por qué,
- sin que Administración sea la última responsable de la versión oficial.

## 5. Principio normativo aplicable

En España, la obligación principal es el registro diario y individual de la jornada laboral. No existe un formato único obligatorio, pero sí debe existir una evidencia fiable, trazable y conservable.

La exigencia no es solo “guardar fichajes”, sino poder demostrar, por trabajador y por periodo, qué jornada real se realizó y que la empresa disponía de una versión válida y conservada para control y revisión.

Por ello, la exportación legal debe poder responder a estas preguntas:

- ¿Qué jornada corresponde a cada trabajador?
- ¿Cuándo fue validada por Administración?
- ¿Quién realizó el cierre forzado o la corrección?
- ¿Qué versión es la oficial?
- ¿Qué archivo se conserva como evidencia legal?

## 6. Modelo propuesto: separación clara entre operativo y legal

### 6.1. Registro operativo

Es la capa funcional actual del sistema:

- fichajes creados por trabajador o por gestión,
- correcciones por gerencia,
- cierres forzados,
- detección de duplicados,
- resúmenes operativos.

Este registro es útil para la gestión diaria y para detectar desviaciones, pero no es automáticamente el “registro legal oficial”.

### 6.2. Registro legal / oficial

Es una entidad nueva o un conjunto de registros derivados que representan la versión validada por Administración.

Ejemplo de entidad sugerida:

- `RegistroHorarioLegal`
  - id
  - fichaje_id
  - operario_id
  - fecha
  - hora_entrada
  - hora_salida
  - pausa_inicio
  - pausa_fin
  - horas_trabajadas
  - origen
  - estado_legal
  - version_legal
  - generado_por
  - validado_por
  - validado_en
  - motivo_validacion
  - observaciones
  - hash_o_firma
  - exportado_en
  - es_oficial

### 6.3. Estados sugeridos

- `provisional`
- `pendiente_validacion`
- `validado_admin`
- `oficial`
- `anulado`
- `corregido`

### 6.4. Origen sugerido

- `trabajador`
- `gerencia`
- `cierre_forzado_gerencia`
- `administracion`
- `importacion`

## 7. Regla de negocio principal

La versión oficial debe ser la creada o validada por Administración. El cierre forzado por gerencia nunca debe reemplazar automáticamente la versión oficial.

Esto debe quedar explícito en la lógica:

- gerencia puede crear/corregir registros operativos,
- pero estos quedan en estado `provisional` o `pendiente_validacion`,
- y solo administración puede cambiar el estado a `oficial`.

## 8. Flujo de trabajo recomendado

### 8.1. Caso clásico: trabajador no registra jornada

1. Trabajador no registra la jornada.
2. El sistema marca el registro como pendiente.
3. Gerencia detecta la incidencia.
4. Gerencia hace un cierre forzado o una corrección operativa.
5. El registro queda marcado como `provisional`.
6. Administración revisa y valida al final del día/semana/mes.
7. Administración marca el registro como `oficial`.
8. La exportación legal usa solo esos registros oficiales.

### 8.2. Caso de corrección por gerencia

1. Gerencia corrige un fichaje.
2. El sistema registra la corrección con auditoría.
3. El registro queda como `provisional` o `pendiente_validacion`.
4. Administración revisa el cambio.
5. Administración valida o modifica la versión.
6. Solo entonces se convierte en `oficial`.

### 8.3. Caso de exportación legal

1. Administración genera el archivo legal del periodo.
2. El archivo incluye únicamente registros `oficiales`.
3. Se conserva con marca temporal, responsable y versión.
4. La exportación legal no se genera desde una vista editable de gerencia.

## 9. Separación de responsabilidades funcionales

### 9.1. Gerencia

Gerencia puede:

- ver registros operativos,
- cerrar fichajes abiertos,
- corregir jornadas incompletas,
- generar resúmenes operativos,
- detectar incidencias,
- no debe hacer la versión oficial ni exportar como legal.

### 9.2. Administración

Administración puede:

- ver todo el histórico,
- validar registros provisionalmente,
- levantar conflictos,
- marcar registros como `oficial`,
- exportar la versión legal,
- conservar y auditar.

### 9.3. Trabajadores

Los trabajadores siguen registrando su jornada; si lo hacen mal, la empresa puede corregirlo operativamente, pero la validación legal sigue siendo función de administración.

## 10. Auditoría obligatoria

Es imprescindible para no perder trazabilidad ni legalidad.

Entidad sugerida:

- `AuditoriaHorario`
  - id
  - entidad
  - registro_id
  - accion
  - usuario
  - rol
  - fecha_hora
  - campo
  - valor_anterior
  - valor_nuevo
  - motivo
  - origen
  - version_legal

Ejemplos de eventos a guardar:

- `fichaje_creado`
- `fichaje_editado`
- `fichaje_cerrado_forzado`
- `fichaje_validado_admin`
- `fichaje_rechazado_admin`
- `exportacion_legal_generada`
- `fichaje_anulado`

Esto permite responder:

- quién creó el registro,
- quién lo modificó,
- quién lo cerró forzosamente,
- quién lo validó como oficial,
- qué versión legal corresponde a cada período.

## 11. Modelo de exportación legal recomendado

### 11.1. Estructura de carpetas

empresa/
  2026/
    Q1/
      resumen-legal-general-2026-Q1.xlsx
      trabajador/
        2026-Q1-LEGAL-TRAB-0001-Garcia-Luis.xlsx
        2026-Q1-LEGAL-TRAB-0002-Lopez-Maria.xlsx
    2026-01/
      2026-01-LEGAL-TRAB-0001-Garcia-Luis.xlsx
    2026-02/
    2026-03/

### 11.2. Nomenclatura legal

- `YYYY-MM-LEGAL-TRAB-<id>-<nombre>.xlsx`
- `YYYY-Qn-LEGAL-TRAB-<id>-<nombre>.xlsx`
- `YYYY-LEGAL-Resumen-General.xlsx`
- `YYYY-Qn-LEGAL-Resumen-General.xlsx`

La palabra `LEGAL` debe distinguir claramente el archivo exportado como evidencia formal de la versión operativa.

## 12. Esquema de columnas para exportación legal

### 12.1. Hoja 1: Detalle legal

Nombre sugerido: `DetalleLegal`

Columnas:

- empresa_id
- empresa_nombre
- centro_trabajo_id
- centro_trabajo_nombre
- trabajador_id
- trabajador_nombre
- trabajador_dni
- fecha
- dia_semana
- hora_entrada
- hora_salida
- pausa_inicio
- pausa_fin
- pausa_minutos
- jornada_real_minutos
- horas_trabajadas
- horas_extra_ordinarias
- horas_extra_festivas
- obra_id
- obra_nombre
- obra_tipo
- notas
- estado_legal
- origen
- version_legal
- generado_por
- validado_por
- validado_en
- motivo_validacion
- fuente_registro
- observaciones_interna

### 12.2. Hoja 2: Resumen mensual legal

Nombre sugerido: `ResumenMesLegal`

Columnas:

- empresa_id
- empresa_nombre
- trabajador_id
- trabajador_nombre
- trabajador_dni
- anio
- mes
- mes_label
- dias_laborables
- dias_trabajados
- dias_sin_fichaje
- horas_totales
- horas_extra
- horas_nocturnas
- horas_festivas
- horas_ausencia
- incidencias
- estado_legal
- validado_por
- validado_en

### 12.3. Hoja 3: Resumen trimestral legal

Nombre sugerido: `ResumenTrimestreLegal`

Columnas:

- empresa_id
- empresa_nombre
- trabajador_id
- trabajador_nombre
- trabajador_dni
- anio
- trimestre
- trimestre_label
- dias_laborables
- dias_trabajados
- horas_totales
- horas_extra
- horas_festivas
- incidencias
- estado_legal
- validado_por
- validado_en

### 12.4. Hoja 4: Resumen anual legal

Nombre sugerido: `ResumenAnualLegal`

Columnas:

- empresa_id
- empresa_nombre
- trabajador_id
- trabajador_nombre
- trabajador_dni
- anio
- horas_totales
- horas_extra
- horas_festivas
- dias_trabajados
- dias_sin_fichaje
- incidencias
- estado_legal
- validado_por
- validado_en

### 12.5. Hoja 5: Auditoría legal

Nombre sugerido: `AuditoriaLegal`

Columnas:

- registro_id
- entidad
- accion
- usuario
- rol
- fecha_hora
- campo
- valor_anterior
- valor_nuevo
- motivo
- origen
- version_legal

## 13. Reglas de exportación legal

1. El archivo legal solo debe incluir registros con `estado_legal = oficial` o `validado_admin`.
2. La exportación legal debe ser autorizada por Administración.
3. La exportación operativa y la legal deben estar separadas claramente.
4. Los archivos legales deben incluir la hoja de auditoría.
5. La exportación legal debe incluir responsable, periodo, versión y fecha.
6. No debe depender de la vista de gerencia ni de una instantánea filtrada por UI.
7. La versión legal no debe ser reescrita sin dejar trazabilidad de la versión anterior.

## 14. Mecanismo de validación de Administración

Se recomienda incluir una acción explícita:

- `validarRegistroHorario({ id, motivo, validadoPor })`
- `exportarLegal({ periodo, trabajadorId, tipo })`
- `marcarComoOficial({ id, validadoPor })`

Estas funciones deben:

- comprobar permisos del usuario,
- asignar `estado_legal = oficial`,
- registrar el evento en auditoría,
- dejar la versión anterior como historial.

## 15. Regla de conservación

Los archivos legales deben conservarse durante el plazo legal aplicable, con copia de seguridad y acceso restringido.

Se recomienda:

- almacenar únicamente la versión legal y validada,
- no dejar la exportación legal en ubicaciones editables por gerencia,
- mantener permisos de lectura/consulta para Administración,
- conservar la auditoría y los archivos generados durante el periodo mínimo legal.

## 16. Qué cambia en la UX actual

La interfaz actual de informes debe mostrar un doble enfoque:

- Operativo
  - útil para gerencia y gestión diaria,
  - fácil corrección y cierre forzado,
- Legal / oficial
  - visible solo para administración,
  - exportación validada y conservada,
  - archivo con estado y auditoría.

En la práctica, la UI debería mostrar algo como:

- `Estado operativo: provisional`
- `Estado legal: oficial / pendiente / rechazado`
- `Origen: cierre_forzado_gerencia`
- `Validado por: administración`

## 17. Recomendación final

La recomendación más sólida para este repositorio es no sustituir el sistema actual, sino complementarlo con una capa legal explícita:

- gerencia mantiene el control operativo del día a día,
- administración es la responsable del cumplimiento legal,
- la exportación legal es la evidencia oficial que se conserva y presenta.

Esto mantiene la operación funcional, evita el bloqueo del negocio y convierte la empresa en un sistema defendible legalmente.

## 18. Resultado esperado

Con esta propuesta, el sistema queda estructurado así:

- registro operativo para corrección y gestión diaria,
- registro legal para cumplimiento y auditoría,
- Administración como responsable de la versión oficial,
- Gerencia como responsable operativo,
- exportación legal separada y autenticada,
- trazabilidad completa de cambios,
- evidencia conservada y lista para inspección.

## 19. Conclusión

El mayor reto no es impedir que gerencia haga cierre forzado, sino impedir que ese cierre forzado sea confundido con la prueba legal final. La solución es clara:

- cerrar operativoamente es necesario,
- validar legalmente lo hace Administración,
- exportar oficialmente lo hace Administración,
- conservar y auditar lo hace Administración.

Solo así el sistema mantiene utilidad operativa sin perder integridad legal.

---

Proyecto: `cazacumariandorin-sudo/smart-gestion`
Fecha: 2026-10-29
