# Propuesta — Análisis IA de respaldo al seguimiento de obra

**Módulo:** Ingeniería → Implementación proyectos
**Estado:** implementado (pestaña «Análisis IA»)
**Fecha:** 27/11/2026

## 1. Objetivo

Añadir una capa de análisis asistido por IA que **respalde** el seguimiento operativo de cada obra: qué se ha ejecutado, qué puede estar fallando y qué trabajos podrían no estar contemplados. El análisis no sustituye al seguimiento humano: lo contrasta y lo documenta.

Principio rector: **ninguna conclusión se da por buena sin evidencia y sin revisión de una persona.**

## 2. Alcance: seguimiento completo

El análisis reúne, para la obra seleccionada, todo lo que ya existe en la app:

| Fuente | Qué aporta |
|---|---|
| Fotos de obra (`FotoProyecto`) | Estado visual, evidencia del avance, posibles anomalías |
| Partes diarios (`ParteDiarioObra`) | Trabajos realizados, pendientes y materiales citados |
| Documentos de ingeniería (`MaterialDocumentoOrigen`) | Alcance documentado, revisiones, estado |
| Material pendiente (`MaterialPendiente`) | Necesidades abiertas y su antigüedad |
| Fichajes (`Fichaje`) | Horas reales dedicadas frente a lo previsto |
| Previsiones (`PrevisionObra`) | Horas previstas, avance y semáforo |
| Presupuestos (`Presupuesto`) | Qué está contratado y con qué importe |
| Discrepancias (`Discrepancia`) | Contradicciones abiertas entre lo previsto y lo real |

Solo se leen registros vinculados a esa obra (más los presupuestos del mismo cliente aún sin obra asignada).

## 3. Qué produce el análisis

1. **Resumen** del estado del seguimiento en pocas frases.
2. **Observaciones** en tres bloques:
   - *Avance observado* — lo ejecutado y su respaldo.
   - *Posibles incidencias* — retrasos, desviaciones de horas, materiales críticos, discrepancias abiertas, falta de partes o fotos.
   - *Posibles trabajos extra* — indicios de trabajos o materiales no contemplados en el presupuesto.
3. **Datos no disponibles** — lo que impide concluir (sin previsión de horas, sin fotos, fuente ilegible…).
4. **Recomendaciones** — siguientes comprobaciones antes de confirmar.

Cada observación lleva:

- **Clasificación**: `hecho registrado` · `inferencia` · `pendiente de verificar`.
- **Confianza** (0-1).
- **Evidencias**: entidad, identificador, fecha y enlace al archivo o imagen. Las URLs y fechas **no las inventa la IA**: se resuelven contra los registros reales de la app.
- **Estado de revisión**: pendiente · confirmada · corregida (con nota) · descartada, con usuario y fecha.

## 4. Salvaguardas

- **Sin evidencia no hay afirmación.** Si una observación no se puede vincular a un registro existente, se degrada automáticamente a *pendiente de verificar*.
- **Las fotos no diagnostican.** El modelo describe lo que se observa; nunca afirma que una imagen demuestra un defecto o un trabajo terminado.
- **No hay valoración económica.** El análisis no propone precios ni importes.
- **Sin datos no se rellena.** Lo que falta va a *datos no disponibles*, no se estima.
- **Validación humana obligatoria** antes de tratar un fallo o un extra como confirmado.

## 5. Flujo de uso

1. En *Implementación proyectos* se elige la obra y se abre la pestaña **Análisis IA**.
2. **Analizar seguimiento**: la función backend relee todas las fuentes (incluidos registros creados en otros módulos) y genera el análisis. Queda guardado con fecha y autor.
3. Se revisa observación por observación: **confirmar**, **descartar** o **añadir nota/corrección**.
4. Cuando no queda ninguna pendiente, el análisis pasa a estado **revisado**.
5. **Generar informe** compone el documento con todas las conclusiones, su clasificación, sus evidencias y las decisiones de revisión, y permite **descargarlo en PDF**.
6. Cada nuevo análisis se conserva como histórico de la obra, para comparar evoluciones.

## 6. Implementación técnica

- **Entidad** `AnalisisSeguimientoObra`: guarda resumen, observaciones, evidencias, fuentes leídas, confianza, autor, fecha y estado de revisión. Acceso restringido a dirección, gerencia, administración, ingeniería y jefe de obra.
- **Función backend** `analizarSeguimientoObra`: autentica al usuario, comprueba su rol, lee las fuentes con el cliente de servicio y llama a `InvokeLLM` con esquema JSON cerrado. Si adjuntar imágenes falla, repite el análisis solo con texto.
- **Interfaz**: pestaña *Análisis IA* dentro de Implementación, con tarjetas de observación, chips de evidencia navegables a su pestaña correspondiente y generación de informe PDF.

## 7. Límites conocidos

- La calidad del análisis depende de que existan partes, fotos y horas registradas. Sin ellos el informe será pobre por diseño (y así se indica).
- El análisis visual usa hasta 6 fotos recientes accesibles; un barrido fotográfico completo por estancias requeriría comparación por pares de fechas (siguiente fase).
- El coste por análisis corresponde a una llamada de IA; conviene lanzarlo por hitos, no en cada visita.

## 8. Siguientes pasos propuestos

1. Comparación visual por pares (misma ubicación, fechas distintas) para medir avance entre visitas.
2. Detección automática de material citado en partes que no aparece en ninguna partida del presupuesto.
3. Envío del informe revisado al cliente o a gerencia desde la propia obra.
