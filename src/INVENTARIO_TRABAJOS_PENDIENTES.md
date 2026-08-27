# 📋 Inventario consolidado de trabajos pendientes (SRC)

> Revisión de toda la carpeta `src/` (documentos de seguimiento + estado del
> código). Agrega en un único sitio lo ya planteado en los `*.md` dispersos y
> los `open_todos` / `known_issues` del proyecto.
>
> Fecha: 2026-08-27 · Plan actual: **sin backend functions** (bloquea varios).

---

## A. Bloqueados por el plan actual (requieren Builder+)

| # | Tarea | Origen/Nª prop. | Qué falta | ¿Qué se puede hacer ya? |
|---|---|---|---|---|
| A1 | Rol-check (`admin`+`gerencia`) en `procesarFacturaMateriales` y `guardarMaterialesOcr` | `CIERRE_BRECHA_PERMISOS_MATERIALES_OCR.md` §D | Añadir 3 líneas en cada función | Frontend (Sidebar, MobileNav, ProtectedRoute, hubs.js, App.jsx) + entidades (RLS) — **sí se puede** |
| A2 | Función backend `consolidadoFallosService` (cruzar 4 fuentes y "tachar" resueltos) | `CONSOLIDADO_FALLOS_POR_PERIODO.md` (Fase 2) | Crear función nueva | Fase 1 (entidad + generación al vuelo solo de `DiagnosticoSesion` desde cliente) — **sí se puede** |
| A3 | Función `comprobarCoberturaMateriales` (cron semanal + filtrar IA por categoría) | `AUTOMATIZACION_COBERTURA_MATERIALES.md` (Fase 1) | Función nueva paginada + `textUtils` (Levenshtein) | Panel UI (`CoberturaMaterialesPanel.jsx`) con datos persistidos o mocks — **sí se puede** |
| A4 | Soporte multi-página / multi-factura en `/materiales-ocr` | `MULTIPAGINA_MATERIALES_OCR.md` | `agruparPaginasDocumento`, modificar `procesarFacturaMateriales` y `guardarMatalesOcr` | UI de captura N-páginas + tira miniaturas + panel revisión con mocks — **sí se puede parcial** |
| A5 | Ampliar `guardarMaterialesOcr` para persistir `nota_gasto_id` (y crear el campo en `MaterialDocumentoOrigen`) | `CAMSCANNER_NOTAS_Y_MIGRACION.md` Parte 2 | 2 líneas backend + 1 campo entidad | Parte 1 (CamScanner en Notas de Gastos) — **sí se puede, 100% frontend** |
| A6 | `getDiagnosticoData` y `subirArchivoConFallback` | known_issues | Reaccesibles solo con plan | Sustituir llamadas por `Core.UploadFile` (como ya hice en fotos y TicketCapture) |
| A7 | Notificaciones push / cron real (usando `create_automation` en runtime) | `CHAT_IMPLEMENTACION.md` opt., `AUTOMATIZACION_COBERTURA` | Backend inalcanzable | UI preparada esperando reactivación |

**Acción recurrente mientras dure el plan:** cada vez que se invoque desde el
cliente una función backend (lista completa en el contexto del sistema), la
llamada debe **degradar con elegancia** (intentar/omitir) y dejar un aviso en
UI. Ya hecho en `TicketCapture.jsx` y `OcrUploader.jsx` (402 → foto adjunta + datos a mano).

---

## B. Bugs técnicos abiertos (no bloqueados por plan)

| # | Bug | Estado actual | Propuesta de fix |
|---|---|---|---|
| B1 | **Galería (`GaleriaFotos.jsx`) no sube fotos** — sigue llamando a `subirArchivoConFallback` (función bloqueada) | Roto | Migrar a `subirImagen()` (Core.UploadFile) igual que `ObraFotosPanel.jsx` |
| B2 | **Galería sin botón de borrado** (ObraFotosPanel sí tiene) | Falta UI | Propuesta lista en `FOTOS_BORRADO_Y_CAPTURA_BLANCO.md` (FotoGestionDialog compartido) |
| B3 | **Foto en blanco** al capturar (ObraFotosPanel usa `capture=environment` sin validar frame) | Sin aplicar | Helper `imagenNoVacia()` (varianza de píxeles) + sanear `file.size < 2KB` — propuesta lista |
| B4 | **Fugas de datos en ControlHorario** — técnicos ven registros de otros en calendario/informes | Roto (RLS) | Revisar RLS de `Fichaje/ApunteHorario` para filtrar por `created_by` cuando el rol no sea gerencia/admin |
| B5 | **Pantalla blanca en Chat** para perfiles técnicos | Intermitente | ErrorBoundary ya existe; revisar carga de claves RSA y `gestionClavesChat` (degradar si falta) |
| B6 | **Descifrado de mensajes antiguos** falla (mensajes previos no recuperables) | Roto | Documentado en `CHAT_IMPLEMENTACION.md`; requiere re-derivar claves AES (IndexedDB) — pendiente |
| B7 | **PresupuestoForm:** persistencia tras guardar + validación folio `PRE-2026-XXXXX` | Fallido | Revisar `guardarPresupuesto` (bloqueado por plan — fallback en cliente) |
| B8 | **`UsersPage.jsx` carga dinámica falla** | Roto | Reemplazar import dinámico por estático en App.jsx |
| B9 | **NotaGastoForm:** numeración anual por `list()` entera → lento | Ineficiente | Mover a `generarNumeroNota` backend (bloqueado) o contar en cliente con `lastItemId` caching |
| B10 | **Calendario de previsiones** borra todo el periodo al borrar 1 fecha | Roto | Falta en `PrevisionCalendario.jsx` / `recalcularPrevision` |
| B11 | **Manuales.jsx:** campos de relación se persisten como null/vacío | Vulnerabilidad | Validar antes de `create` (frontend) |
| B12 | **Duplicados de perfil `Operario`** por usuario | Datos | Script de deduplicación + mantener `user_email` único |
| B13 | **Apuntes horarios con `obra_id` vacío** | Datos滤镜 | Forzar selección de obra en `GestionDiaSheet` |
| B14 | **Dashboard sin panel económico unificando gastos/presupuestos/nóminas** | Falta | `EconomicoDashboard.jsx` existe; revisar integración real |
| B15 | **Fotos en galería aparecen en blanco** (URLs Google Drive no accesibles directamente) | Funciona mal | Objeto firmado vía conector o migrar preview a CDN |

---

## C. Trabajos aprobados / en cola — pendiente de Gerencia

| # | Trabajo | Doc | Qué decide Gerencia |
|---|---|---|---|
| C1 | **Borrado lógico de fotos + botón en Galería + "mover de obra"** | `FOTOS_BORRADO_Y_CAPTURA_BLANCO.md` | (a) lógico vs físico · (b) incluir "mover" · (c) crear galería de obras solares |
| C2 | **Cierre de brecha de permisos `/materiales-ocr`** | `CIERRE_BRECHA_PERMISOS_MATERIALES_OCR.md` (§L) | Política `admin+gerencia` + fix genérico Sidebar/MobileNav + RLS; mantener `read` de catálogo/fabricante |
| C3 | **Consolidado de fallos por periodo** | `CONSOLIDADO_FALLOS_POR_PERIODO.md` | Fuentes (4), firma SHA1, pestaña nueva en `/diagnostico-app` |
| C4 | **CamScanner en Notas de Gastos** | `CAMSCANNER_NOTAS_Y_MIGRACION.md` (§J) | Extracción del helper, no IA en la mejora, sin CamScanner en PDFs |
| C5 | **Migración manual de notas a Materiales** | ídem §J | Enlace explícito `nota_gasto_id`, pestaña "Pendientes" solo admin/gerencia, Alt 2 |
| C6 | **Cobertura de materiales (automatización)** | `AUTOMATIZACION_COBERTURA_MATERIALES.md` (§L) | 3 entidades con adjunto, Levenshtein 0.85, filtro categoría, semanal lunes 07:00 |
| C7 | **Multi-página / multi-factura OCR** | `MULTIPAGINA_MATERIALES_OCR.md` (§H) | Cambio de paradigma "lote de páginas", límite 15 páginas, IA no divide en silencio |
| C8 | **Unificación del módulo Notas de Gastos** (V1 vs V2) | `NOTAS_GASTOS_TRACKING.md` | Decidir arquitectura: una sola entidad `RegistroGasto`, eliminar legacy |

---

## D. Optimizaciones / Mejoras no críticas (corto plazo)

De `ANALISIS_EXHAUSTIVO_PROYECTO.md` "Próximas mejoras":

- Quick Vincular Button (1-2h)
- Dashboard expandible (45 min)
- Auto-vinculación inteligente (1h)
- Notificaciones proactivas (2h)
- Sistema de IDs personalizados (ya descrito en `USER_ID_PERSONALIZADO.md` · verificar uso real)
- Verificación de vinculación (`VINCULACION_ANALYSIS.md`) — checklist de campos en `User` y relación `operario_id`
- PWA instalable / push nativas / modo offline mejorado / sync en background / speech-to-text en partes (medio plazo)

---

## E. Lo que ya está resuelto (no reabrir)

- Fix del 402 en Mis Gastos (`TicketCapture.jsx` + `OcrUploader.jsx`) — 2026-08-27
- Subida de fotos vía `Core.UploadFile` en `ObraFotosPanel`, `PhotoUploader`, `ParteFoodsInput` (parcial)
- Cifrado E2E del Chat (`CHAT_IMPLEMENTACION.md`)
- Sincronización Google Drive (`GOOGLE_DRIVE_SYNC.md`)
- Sistema de invitaciones seguro + vinculación usuario→operario (`VINCULACION_*.md`)

---

## Prioridad recomendada

1. **B1 + B2 + B3** (fotos de obra: galería, borrado, foto en blanco) — propuesta técnica lista; aprobación = implementación inmediata, todo frontend.
2. **B4** (fuga de datos en ControlHorario) — prioridad de seguridad.
3. **A1 / C2** (cierre de brecha de permisos materiales-ocr) — security; la parte frontend se puede hacer ya.
4. **B8, B10, B11, B13** (bugs funcionales rápidos).
5. El resto (C3–C7, B5–B7, B14, B15) — coordinar con Gerencia / espera Builder+.

---

*Documento generado por revisión completa de `src/` (2026-08-27).*