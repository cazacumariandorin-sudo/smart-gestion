# Propuesta técnica: modelo de exportación del módulo de control horario/fichaje

## 1. Alcance

Este documento define la propuesta técnica para evolucionar el módulo de control horario/fichaje del proyecto `smart-gestion` hacia un modelo de exportación robusto y legalmente defensable, compatible con la normativa española sobre registro horario y con las prácticas de auditoría y conservación de datos.

El objetivo no es sustituir el registro operativo actual, sino completar y reforzar la estructura de exportación y trazabilidad para que el sistema pueda servir como evidencia de jornada por:

- trabajador,
- día,
- mes,
- trimestre,
- año,
- y, si procede, por empresa o centro de trabajo.

## 2. Contexto del sistema actual

El repositorio ya contempla un módulo funcional de fichajes con las siguientes capacidades:

- registro de fichajes con entrada, salida, pausa y obra,
- filtro por operario y mes,
- cálculo de horas trabajadas,
- exportación a PDF y Excel,
- detección de duplicados,
- cierre forzado de fichajes abiertos,
- control de acceso por roles.

Esto ya es una base sólida para el control horario operando. Sin embargo, la exportación actual está pensada como un reportaje de visualización y no como un “expediente legal” para inspección o auditoría.

## 3. Diagnóstico funcional

### 3.1. Lo que está bien

El módulo actual ya aporta:

- `Fichaje` con campos clave: `operario_id`, `date`, `hora_entrada`, `hora_salida`, `pausa_inicio`, `pausa_fin`, `obra_id`, `obra_name`, `horas_trabajadas`, `notas`.
- filtros de mes y operario en `src/components/horario/FichajesTab.jsx`.
- generación de PDF y Excel en `src/components/horario/InformesTab.jsx`.
- gestión de duplicados y cierre de fichajes en `DuplicadosFichajesModal.jsx` y `CierreForzadoPanel.jsx`.

### 3.2. Lo que falta para un modelo legalmente sólido

El sistema actual no dispone todavía de:

- exportación formal por trabajador en estructura anual/mensual/trimestral,
- resumen mensual, trimestral y anual normalizado,
- archivo con trazabilidad completa de cambios,
- auditoría de creación/edición/borrado,
- clasificación de registros por “estado”: normal, sin salida, duplicado, cierre forzado,
- esquema de conservabilidad de 4 años,
- archivo de respaldo con nomenclatura administrativa y versionado.

## 4. Principio normativo aplicable

En España, el requisito central es el registro diario y individual de la jornada trabajo. No existe un formato único obligatorio, pero sí se exige que la información sea fiable, accesible e inalterable.

Por tanto, para cumplir adecuadamente la normativa y prepararse para inspección, la exportación debe permitir:

- demostrar la jornada real de cada trabajador,
- mostrar el desglose por día, mes, trimestre y año,
- separar y consolidar por trabajador,
- conservar la evidencia durante el plazo legal,
- facilitar la comparación entre registros operativos y registros del personal.

## 5. Modelo de exportación propuesto

### 5.1. Estructura de carpetas recomendada

empresa/
  2026/
    Q1/
      resumen-general-2026-Q1.xlsx
      trabajador/
        2026-Q1-TRAB-0001-Garcia-Luis.xlsx
        2026-Q1-TRAB-0002-Lopez-Maria.xlsx
    2026-01/
      2026-01-TRAB-0001-Garcia-Luis.xlsx
    2026-02/
    2026-03/
  2027/
    Q1/
    etc.

### 5.2. Nomenclatura sugerida

- `YYYY-MM-TRAB-<id>-<nombre>.xlsx` para exportación mensual por trabajador.
- `YYYY-Qn-TRAB-<id>-<nombre>.xlsx` para exportación trimestral por trabajador.
- `YYYY-Resumen-General.xlsx` para resumen anual global.
- `YYYY-Qn-Resumen-General.xlsx` para resumen trimestral general.
- `YYYY-MM-DD-Horario-Export-<version>.zip` o bien `*.xlsx` con metadatos internos para archivado.

## 6. Modelos de exportación recomendados

### 6.1. Exportación diaria detallada

Se usa como registro operativo y prueba de jornada.

Campos sugeridos:

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
- estado_fichaje
- creado_por
- creado_en
- actualizado_por
- actualizado_en
- fuente_registro
- validado
- motivo_cierre_forzado
- observaciones_interna

### 6.2. Exportación mensual por trabajador

Resumen de las jornadas del trabajador durante un mes.

Campos sugeridos:

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
- estado_resumen
- generado_por
- generado_en

### 6.3. Exportación trimestral por trabajador

Campos sugeridos:

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
- validado
- generado_por
- generado_en

### 6.4. Exportación anual por trabajador

Campos sugeridos:

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
- estado_anual
- generado_por
- generado_en

### 6.5. Exportación global general

Se usa para dirección, gerencia o administración.

Campos sugeridos:

- empresa_id
- empresa_nombre
- anio
- mes
- trimestre
- trabajador_id
- trabajador_nombre
- horas_totales
- horas_extra
- dias_trabajados
- incidencias
- estado

## 7. Hoja de auditoría recomendada

Además del archivo con el detalle, se recomienda incluir una hoja llamada `Auditoria` con el siguiente esquema:

- registro_id
- entidad
- tipo_evento
- usuario
- fecha_hora
- campo
- valor_anterior
- valor_nuevo
- motivo
- ip_o_sesion
- detalle

Esto permite responder preguntas como:

- ¿Quién cambió la salida de un fichaje?
- ¿Quién forzó un cierre?
- ¿Se borró un fichaje?
- ¿Cuándo se modificó la obra asociada?

## 8. Reglas de negocio para la exportación

1. Todo fichaje debe tener trabajador asociado.
2. Todo fichaje debe tener fecha válida.
3. Toda salida debe ser posterior a la entrada.
4. Cuando una hora de salida no está registrada, el registro debe quedar marcado como `sin_salida`.
5. Cuando se produce una modificación, se debe registrar la auditoría.
6. Cuando se borra un registro, no debe desaparecer de la historia; debe quedar en `Auditoria` con motivo.
7. El archivo de exportación debe generarse desde la fuente de verdad, no desde una vista filtrada de la interfaz.
8. La exportación debe incluir el periodo, el trabajador y el responsable de la generación.

## 9. Especificación técnica propuesta

### 9.1. Funciones sugeridas

- `exportarDetalleDiario({ fechaInicio, fechaFin, trabajadorId })`
- `exportarResumenMensual({ anio, mes, trabajadorId })`
- `exportarResumenTrimestral({ anio, trimestre, trabajadorId })`
- `exportarResumenAnual({ anio, trabajadorId })`
- `exportarGeneralMensual({ anio, mes })`
- `exportarGeneralTrimestral({ anio, trimestre })`
- `exportarGeneralAnual({ anio })`
- `generarAuditoriaFichajes({ id, tipoEvento, motivo })`

### 9.2. Recomendación de salida

- Utilizar Excel (`.xlsx`) como formato base para trabajo formal.
- Mantener PDF como salida visual resumida y fácilmente compartible.
- Exportar ambos formatos con una nomenclatura estándar y metadatos internos.

### 9.3. Recomendación de almacenamiento

- Guardar el archivo exportado en almacenamiento seguro con control de permisos.
- Mantener una copia de seguridad mínimo de 4 años.
- Registrar el usuario que genera el archivo en la cabecera del mismo y en la auditoría.

## 10. Caso de uso recomendado

- Administración: exporta resumen trimestral general.
- Gerencia: exporta resumen anual por trabajador.
- RR. HH.: exporta detalle del mes para revisión.
- Jefe de obra: exporta fichajes de su área.
- Inspector/auditor: revisa detalle por día y resumen por trabajador.

## 11. Resultado esperado

Con esta estructura, el sistema deja de ser únicamente un registro operativo y pasa a ser un sistema con:

- trazabilidad,
- exportación periódica,
- personalización por trabajador,
- consolidación por mes/trimestre/año,
- soporte documental para cumplimiento normativo,
- mejor defensa ante revisión o inspección.

## 12. Conclusión

El módulo de control horario/fichaje ya tiene una base sólida y funcional. La evolución técnica recomendada es orientarla hacia una exportación formal y auditable, con una estructura de archivo por período y trabajador, incluyendo auditoría y conservabilidad.

Esto permite cerrar la brecha entre la gestión operativa y la exigencia administrativa y legal del registro de la jornada laboral.

## 13. Recomendación final

Se recomienda implementar la exportación en este orden:

1. detalle diario,
2. resumen mensual por trabajador,
3. resumen trimestral por trabajador,
4. resumen anual por trabajador,
5. resumen general por empresa,
6. auditoría y conservación.

Con esta secuencia, el sistema queda preparado para trabajar como herramienta de control horario con valor legal y operativo.

## 14. Archivo de respaldo técnico

Se adjunta como respaldo técnico una versión de `InformesTab.jsx` con la propuesta de exportación por mes, trimestre, año y trabajador, siguiendo este modelo de diseño.

---

Proyecto: `cazacumariandorin-sudo/smart-gestion`
Fecha: 2026-10-29
