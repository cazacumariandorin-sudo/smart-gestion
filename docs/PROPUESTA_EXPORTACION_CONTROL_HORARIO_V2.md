# Propuesta de exportación · Control Horario y Registro de Jornada

**Fecha:** 2026-11-16 · **Ámbito:** módulo Control Horario (`/control-horario`) · **Estado:** propuesta, pendiente de aprobación

---

## 1. Resumen ejecutivo

El módulo ya distingue **registro operativo** (`Fichaje`) de **registro legal** (`RegistroHorarioLegal`) y ya genera un Excel legal con portada corporativa, seis hojas y auditoría. La base es buena: no hace falta rehacer nada.

Lo que falta es la **cadena de custodia de la evidencia** y la **exportación operativa fiable**:

1. El PDF/Excel de informes **no respeta el periodo seleccionado** (exporta todos los fichajes cargados, no el mes filtrado) y no lleva cabecera corporativa.
2. El Excel legal se genera y se descarga, pero **no se archiva ninguna copia**: no queda constancia del archivo entregado ni de su huella de integridad.
3. No existe **histórico de exportaciones** (`quién exportó qué periodo, qué archivo, cuántos registros`).
4. No hay **exportación por trabajador en lote (ZIP)** ni **PDF individual** de jornada firmado.
5. No hay **cierre de periodo** que impida que un mes ya exportado se revalide y cambie sin dejar rastro.
6. No hay **circuito de cobertura de huecos**: un día laborable en el que nadie fichó no genera aviso ni queda declarado, y ese hueco es exactamente lo que se sanciona (751 € a 7.500 € por no llevar registro). Ver Fase 5.

La propuesta se estructura en 5 fases, cada una entregable por separado y sin bloquear la operación diaria.

---

## 2. Estado actual verificado en código

### 2.1 Registro operativo — `Fichaje`

- Alta por trabajador, edición por gerencia/administración, cierre forzado y cierre automático (`completarFichajesAutomaticos`, `forzarCierreFichajes`).
- Exportación en Informes (`InformesTab.jsx`): botones **PDF** y **Excel** que usan `filtered`.
- ⚠️ `filtered` **no aplica el filtro de mes** en modo calendario (solo filtra por operario): el PDF y el Excel exportan **todos** los fichajes cargados, mientras el usuario cree que exporta el mes en pantalla.
- El PDF se dibuja con `jsPDF` tabla a tabla: sin logo, sin empresa, sin periodo explícito y sin desglose por trabajador.

### 2.2 Registro legal — `RegistroHorarioLegal`

- Generación de versión provisional desde fichajes (`gestionRegistroHorarioLegal`, acción `generar`).
- Validación / rechazo por administración con motivo obligatorio al rechazar; estado legal como única fuente de verdad.
- Exportación legal (`exportarRegistroLegal`): Excel server-side con `Portada`, `DetalleLegal`, `ResumenMesLegal`, `ResumenTrimestreLegal`, `ResumenAnualLegal`, `HistoricoLegal` y `AuditoriaLegal`. Solo incluye registros `oficial` / `validado_admin`.
- Auditoría: `AuditoriaHorario` registra `exportacion_legal_generada` y marca `exportado_en` en los registros incluidos.
- Periodo: **mes natural o año completo** (`rangoPeriodo`), más un trabajador opcional.

### 2.3 Huecos detectados

| # | Hueco | Riesgo |
|---|---|---|
| H1 | El Informe PDF/Excel ignora el mes filtrado | **Alto** — se entrega documentación incorrecta |
| H2 | El Excel legal no se archiva (solo se descarga en base64) | **Alto** — no hay evidencia conservada |
| H3 | `hash_o_firma` existe en la entidad pero nunca se rellena | **Alto** — no se puede demostrar integridad del archivo |
| H4 | No hay registro de exportaciones (entidad/tabla propia) | Medio |
| H5 | No hay exportación por trabajador ni ZIP de lote | Medio |
| H6 | No hay cierre de periodo: un mes validado puede volver a validarse | **Alto** (inmutabilidad) |
| H7 | No hay CSV de inspección (solo Excel/PDF) | Bajo |
| H8 | El Histórico legal no está paginado: con históricos grandes la función puede agotar tiempo | Medio |

---

## 3. Fase 1 — Exportación operativa correcta (prioridad máxima, esfuerzo bajo) · **implementada**

**Objetivo:** que lo que se descarga sea exactamente lo que se está viendo.

- Un único diálogo de exportación reutilizable: `src/components/horario/ExportarHorarioDialog.jsx`.
  - Periodo: mes (por defecto el visible), rango libre (`desde`–`hasta`), año.
  - Contenido: solo fichajes / solo ausencias / ambos.
  - Agrupación: por trabajador (por defecto) o cronológica.
  - Formato: PDF, Excel, CSV.
  - Filtro de operario respetado (los roles con acceso restringido solo exportan lo suyo).
- Lógica compartida en `src/lib/horarioExport.js` (una sola fuente para PDF, Excel y CSV; nada de duplicar cálculos).
- PDF con cabecera Simantec (logo + empresa + periodo + usuario + fecha), una sección por trabajador con subtotales y total general; pie con numeración de página.
- Excel: hoja `Detalle` + hoja `ResumenTrabajador` (días trabajados, horas efectivas, extra, ausencias).
- CSV con separador `;` y decimales con coma (formato que acepta Inspección de Trabajo y Excel ES).
- Subtítulo obligatorio en el archivo: **«Documento operativo — no acreditativo del registro legal»**.

**Aceptación:** exportar el mes de octubre descarga solo octubre; el número de registros del archivo coincide con el contador en pantalla.

---

## 4. Fase 2 — Cadena de custodia del documento legal · **implementada**

**Objetivo:** que el Excel legal quede guardado, identificado y verificable.

### 4.1 Nueva entidad `ExportacionHorario`

| Campo | Tipo | Uso |
|---|---|---|
| `tipo` | enum `legal` / `operativo` | Distingue evidencia de informe |
| `periodo_desde` / `periodo_hasta` | date | Periodo cubierto |
| `trabajador_id` / `trabajador_nombre` | string | Vacío = resumen general |
| `filename` | string | Nombre del archivo entregado |
| `registros` | number | Nº de registros oficiales incluidos |
| `hash_sha256` | string | Huella del archivo generado |
| `tamano_bytes` | number | Integridad y control |
| `file_uri` | string | Copia en almacenamiento privado |
| `drive_file_id` | string | Copia en Drive (`Empresa/ControlHorario/AAAA/`) |
| `generado_por` / `generado_por_nombre` | string | Responsable |
| `created_date` | — | Momento de la exportación |

RLS: lectura y creación solo `admin`, `propietario`, `gerencia`, `administracion`; actualización solo `admin`/`propietario`; borrado solo `admin`. Un registro de exportación **no se edita**: es un acto con fecha.

### 4.2 Ampliación de `exportarRegistroLegal`

Añadir al body `archivar: true` (por defecto `true` para el rol administración):

1. Generar el libro Excel.
2. Calcular `SHA-256` del buffer en el servidor (Web Crypto), antes de codificar a base64.
3. Subir la copia con `uploadFileToGdrive` (carpeta `ControlHorario/LEGAL/AAAA/`) y, si falla, guardar en almacenamiento privado (misma estrategia de respaldo ya usada por `subirArchivoConFallback`).
4. Rellenar `hash_o_firma` en los `RegistroHorarioLegal` incluidos (reservado para esto) y `exportado_en`.
5. Crear el registro en `ExportacionHorario` y una entrada en `AuditoriaHorario`.
6. Devolver `hash_sha256`, `file_uri` y `drive_file_id` junto al base64.

Si la subida falla, la descarga se mantiene: nunca se pierde el trabajo de generación, pero la respuesta indica `archivado: false` y la UI avisa.

### 4.3 UI

En `RegistroLegalTab`: botón «Exportar legal» que pasa a «Generar y archivar», con confirmación previa que muestra periodo, número de registros oficiales y trabajadores afectados. Al terminar, muestra el hash corto y el enlace al archivo archivado.

**Aceptación:** cada exportación legal crea una fila en `ExportacionHorario` con hash, copia accesible y evento de auditoría; el mismo hash se puede recalcular sobre el archivo descargado.

---

## 5. Fase 3 — Cierre de periodo e inmutabilidad

**Objetivo:** que un periodo exportado no pueda cambiar en silencio.

- Acción `cerrarPeriodo` en `gestionRegistroHorarioLegal`: exige que el 100 % de los registros del mes estén en `oficial` (los `anulado` no cuentan como pendientes), marca `periodo_cerrado: true` y `cerrado_en` en los registros, y bloquea nuevas validaciones de ese mes.
- Reapertura: solo `admin`/`propietario`, con motivo obligatorio, auditoría `periodo_reaperturado` y **nueva versión** (`version_legal + 1`) para los registros reabiertos.
- Los registros `oficial` con `periodo_cerrado` no admiten edición de horas: cualquier corrección crea una **versión nueva** que convive con la anterior (`activo: false` en la antigua).
- Vista de estado por mes en `RegistroLegalTab`: `abierto` → `validado` → `exportado` → `cerrado`, con fecha, usuario y hash de la exportación asociada.

**Aceptación:** intentar validar un registro de un mes cerrado devuelve error explícito salvo reapertura autorizada, y la reapertura deja rastro con versión incrementada.

---

## 6. Fase 4 — Lote por trabajador y entrega al trabajador

- Nueva acción `exportarLote`: genera un ZIP con un Excel por trabajador (`YYYY-MM-LEGAL-TRAB-<id>-<nombre>.xlsx`) y un `indice.pdf` con el resumen general; archiva el ZIP igual que en la Fase 2 (hash + copia + registro).
- PDF individual `YYYY-MM-JORNADA-<trabajador>.pdf` para entrega al trabajador (copia de su registro), con el mismo diseño de portada.
- Envío al trabajador por email usando la plantilla corporativa cuando esté disponible; hasta entonces, descarga manual por administración.

**Aceptación:** el ZIP contiene tantos archivos como trabajadores con registros oficiales en el periodo, y el índice cuadra con el resumen general del Excel legal.

---

## 7. Modelo de nombres y conservación

```
ControlHorario/
  LEGAL/
    2026/
      2026-01-LEGAL-Resumen-General.xlsx
      2026-T1-LEGAL-Resumen-General.zip
      TRAB/
        2026-01-LEGAL-TRAB-0007-Garcia-Luis.xlsx
  OPERATIVO/
    2026/2026-10-operativo-general.pdf
```

- La palabra `LEGAL` solo aparece en archivos con registros validados.
- Conservación: **4 años** (art. 34.9 ET y art. 20 LISOS), copia en Drive + almacenamiento privado de la app.
- Los archivos legales no se sobrescriben nunca: se crea versión nueva y la anterior queda marcada.

---

## 8. Permisos

| Acción | Operario / Técnico | Gerencia / Jefe de obra | Administración | Admin / Propietario |
|---|---|---|---|---|
| Ver su registro operativo | Sí | Sí | Sí | Sí |
| Exportar informe operativo | Solo lo suyo | Todo | Todo | Todo |
| Validar / rechazar registro legal | No | No | Sí | Sí |
| Exportar legal (archivado) | No | No | Sí | Sí |
| Cerrar / reabrir periodo | No | No | Cerrar | Cerrar y reabrir |
| Declarar jornada de un hueco (Fase 5) | No | Sí | No (valida) | Sí |
| Firmar / confirmar su propia jornada | Sí (la suya) | No | No | No |

---

## 9. Orden de ejecución propuesto

| Fase | Contenido | Impacto | Riesgo de no hacerlo |
|---|---|---|---|
| **1** | Exportación operativa correcta (periodo real, PDF/Excel/CSV corporativos) | Inmediato en el día a día | Documentos incorrectos entregados a clientes |
| **2** | Hash + archivo + entidad `ExportacionHorario` | Alto | Sin prueba del archivo entregado |
| **3** | Cierre de periodo e inmutabilidad por versiones | Alto | Un mes entregado puede cambiar sin rastro |
| **4** | ZIP por trabajador y PDF individual | Medio | Entrega manual trabajador a trabajador |
| **5** | Detección de huecos + confirmación del trabajador + declaración de gerencia | **Muy alto** (legal) | Días trabajados sin registro: sanción directa en inspección |

Sugerencia: **Fase 5 entra antes que la 3 y la 4**. Es la única de la lista que ataca una sanción que hoy se puede producir mañana; las demás protegen evidencia ya existente.

---

## 10. Fuera de alcance

- Firma electrónica cualificada del archivo (se valorará con proveedor externo).
- Sellado de tiempo (TSA) sobre el hash: la propuesta deja el campo preparado, sin contratar el servicio.
- Sustituir el Excel legal por un formato cerrado tipo PDF/A: no aporta valor hasta que exista la firma.
- **Replicar o precargar la firma del trabajador en registros creados por otra persona.** Hipótesis planteada y descartada por falta de consenso y por análisis de riesgo (ver 11.1): no aporta cumplimiento y añade falsedad documental.

---

## 11. Fase 5 — Cobertura de huecos: declaración de jornada (prioridad legal alta)

**Objetivo:** que no exista ningún día laborable sin registro, sin que el registro deje de ser veraz.

El art. 34.9 ET obliga a la empresa a registrar la jornada diaria y conservarla cuatro años. La sanción no llega por fichar mal: llega por **no tener el registro**. Un día trabajado sin registro es el hueco que se sanciona. La solución no es inventar el fichaje, es declarar la jornada y dejar constancia de quién la declara y cuándo.

### 11.1 Principio irrenunciable

El registro puede ser **declarado por la empresa**; lo que no puede es **presentarse como un fichaje del trabajador**. La ley no exige la firma del trabajador para llevar el registro, así que suplantarla no aporta nada y abre un frente que hoy no existe: falsedad documental con responsabilidad personal de quien firma, pérdida de credibilidad de todo el histórico ante una inspección o un juicio, y posible reclamación de horas por parte del trabajador.

Reglas que se fijan en código y no se negocian por caso:

- Ninguna firma precargada, clonada ni reutilizada de un tercero.
- Ningún registro con fecha u hora anterior a su creación presentada como fichaje real; la hora declarada se marca siempre como tal.
- El `origen` de un registro validado no se puede reescribir.
- Todo registro declarado nace `provisional` y solo administración lo eleva a `oficial`.

### 11.2 Detección del hueco

Cruce diario reutilizando lo ya existente (completado automático de fichajes + calendario laboral + ausencias):

- día laborable y no festivo según `CalendarioLaboral`,
- operario activo con usuario vinculado,
- sin `Fichaje` ni `ApunteHorario` de esa fecha,
- sin `FaltaAsistencia` ni `Vacacion` que cubra la fecha.

El sistema **detecta y avisa; nunca crea el registro por su cuenta**.

### 11.3 Plazos acordados

| Momento | Acción | Responsable |
|---|---|---|
| t+0 | El día queda marcado como hueco | automático |
| t+24 h | Aviso al trabajador: «no consta tu fichaje del día X, confirma tu jornada» | automático, en la app |
| t+48 h | Sin respuesta, se habilita la declaración | gerencia |
| Al declarar | Motivo obligatorio + hora real de la declaración | gerencia |
| Antes de exportar | Validación legal: `provisional` → `oficial` | administración |

El margen de 48 h es intencionado: el trabajador puede no haber fichado por un motivo real (olvido con el trabajo hecho, zona sin cobertura) o estar de baja médica, caso en el que no tiene por qué haber avisado el mismo día. El aviso a las 24 h le da la oportunidad de **confirmar su propia jornada** —el registro de mayor calidad probatoria— y las 48 h evitan declarar antes de saber si era una ausencia.

### 11.4 Circuito

1. **Confirmación del trabajador (vía preferente).** Un toque desde el móvil: «trabajé ese día», con la jornada habitual (L-J 08:00-18:00 con 1 h de comida, V 08:00-13:00) o ajustada por él. El registro se guarda con origen `trabajador`. Este debe ser el caso mayoritario.
2. **Declaración de gerencia.** Si no responde y no hay ausencia, gerencia declara: jornada, obra, motivo del hueco (olvido, avería, sin cobertura, otra) y nota. El registro queda:
   - origen `declaracion_empresa`,
   - `declarado_por` (email de gerencia) y `fecha_declaracion` (timestamp real),
   - `motivo_declaracion` obligatorio,
   - estado legal `provisional`,
   - evento `jornada_declarada_gerencia` en `AuditoriaHorario`,
   - vínculo a la notificación enviada y a la respuesta del trabajador (leída, confirmada o rechazada).
3. **Validación de administración.** Administración revisa y marca `oficial`; si detecta que la declaración no cuadra con la realidad (vacaciones, baja, festivo, cierre de obra), la rechaza con motivo y el día vuelve a hueco con la causa registrada.
4. **Exportación legal.** Nueva columna `Origen` por fila (`fichaje`, `declaración empresa`, `cierre automático`) y hoja de **cobertura del periodo**: días fichados, declarados y pendientes. Un registro completo y honesto es la defensa; uno completo y disfrazado es la condena.

### 11.5 Cambios necesarios

- `RegistroHorarioLegal`: valor nuevo `declaracion_empresa` en `origen`; campos `declarado_por`, `fecha_declaracion`, `motivo_declaracion`, `notificacion_id`, `respuesta_trabajador` (`sin_respuesta` / `confirmada` / `rechazada`) y `fecha_respuesta`.
- `NotificacionFichaje`: tipos `hueco_fichaje` y `confirmacion_pendiente`, más `registro_legal_id` y `respondido_en`.
- `completarFichajesAutomaticos` (o función nueva `detectarHuecosJornada`): detecta el hueco y notifica; **no** crea el registro.
- `gestionRegistroHorarioLegal`: acciones `declararJornada` y `confirmarJornadaTrabajador`, ambas con auditoría.
- UI: bloque «Días sin registro» en `RegistroLegalTab` con el estado por día (hueco → avisado → declarado → validado), acción de declarar visible solo para gerencia y validación en el panel de administración.

### 11.6 Permisos

| Acción | Operario / Técnico | Gerencia | Administración | Admin / Propietario |
|---|---|---|---|---|
| Confirmar su jornada | Sí (solo la suya) | No | No | No |
| Recibir aviso de hueco | Automático | Automático | Automático | Automático |
| Declarar jornada | No | **Sí** | No (solo valida) | Sí |
| Validar / rechazar declaración | No | No | **Sí** | Sí |

### 11.7 Aceptación

- Un día laborable sin fichaje y sin ausencia aparece en la lista y genera aviso a las 24 h.
- El trabajador confirma su jornada en un toque y el registro queda oficial con origen `trabajador`.
- Sin respuesta, gerencia declara con motivo y el registro queda provisional hasta administración.
- La exportación legal muestra el origen de cada fila y el cuadro de cobertura del mes.
- No existe ningún camino en la aplicación por el que una firma de un tercero quede asociada a un registro.

### 11.8 Estimación y fuera de alcance

4-5 días de desarrollo, empezando por la detección (1 día) para que el riesgo real empiece a cerrarse desde la primera entrega.

Fuera de alcance de esta fase: firma electrónica del trabajador sobre la declaración de empresa (se valora junto al PDF individual de la Fase 4) y declaración automática sin intervención humana.
