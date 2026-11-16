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

La propuesta se estructura en 4 fases, cada una entregable por separado y sin bloquear la operación diaria.

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

## 3. Fase 1 — Exportación operativa correcta (prioridad máxima, esfuerzo bajo)

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

## 4. Fase 2 — Cadena de custodia del documento legal

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

---

## 9. Orden de ejecución propuesto

| Fase | Contenido | Impacto | Riesgo de no hacerlo |
|---|---|---|---|
| **1** | Exportación operativa correcta (periodo real, PDF/Excel/CSV corporativos) | Inmediato en el día a día | Documentos incorrectos entregados a clientes |
| **2** | Hash + archivo + entidad `ExportacionHorario` | Alto | Sin prueba del archivo entregado |
| **3** | Cierre de periodo e inmutabilidad por versiones | Alto | Un mes entregado puede cambiar sin rastro |
| **4** | ZIP por trabajador y PDF individual | Medio | Entrega manual trabajador a trabajador |

Sugerencia: aprobar **Fase 1 + Fase 2** juntas (son las que cierran el riesgo legal real) y dejar la 3 y la 4 como siguiente entrega.

---

## 10. Fuera de alcance

- Firma electrónica cualificada del archivo (se valorará con proveedor externo).
- Sellado de tiempo (TSA) sobre el hash: la propuesta deja el campo preparado, sin contratar el servicio.
- Sustituir el Excel legal por un formato cerrado tipo PDF/A: no aporta valor hasta que exista la firma.
