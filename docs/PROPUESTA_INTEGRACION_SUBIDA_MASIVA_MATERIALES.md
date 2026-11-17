# Propuesta técnica profesional: integración de facturas masivas con el catálogo de materiales

**Proyecto:** Smart Gestión  
**Repositorio:** `cazacumariandorin-sudo/smart-gestion`  
**Fecha:** 17 de noviembre de 2026  
**Estado:** Propuesta técnica para aprobación  
**Alcance:** Contabilidad → Subida masiva → RegistroGasto → OCR especializado → MaterialCatalog / histórico de precios

---

## 1. Resumen ejecutivo

La pestaña **Económico / Contabilidad / Subida masiva** ya permite subir varios archivos —imágenes y PDF— y registrar facturas, tickets y justificantes recibidos por la empresa. Cada archivo se entrega primero al almacenamiento mediante `UploadPublicFile` y la URL devuelta se guarda dentro de `RegistroGasto.archivos`.

Esta propuesta convierte esos justificantes en una **segunda fuente controlada de materiales y precios**, aprovechando tanto:

- documentos cargados como gastos propios pagados por operarios;
- facturas/tickets recibidos por la empresa;
- archivos registrados con origen `medio_empresa` o `credito_proveedor`;
- adjuntos ya archivados pero todavía no relacionados con el catálogo.

El objetivo no es crear materiales automáticamente sin supervisión. La propuesta establece un flujo en el que la IA extrae, el sistema compara y clasifica, y Gerencia/Administración aprueba los cambios reales.

---

## 2. Estado real de la aplicación

### 2.1 Subida masiva contable

La pestaña está implementada en `src/components/contabilidad/SubidaMasivaPanel.jsx`.

Permite dos destinos:

1. **Mis gastos a recuperar**
   - origen_pago: `medios_propios`;
   - estado inicial: `borrador`;
   - sigue el flujo clásico de reembolso.

2. **Facturas/tickets recibidos por la empresa**
   - origen_pago: `medio_empresa` o `credito_proveedor`;
   - estado inicial: `registrado`;
   - sin aprobación de reembolso;
   - preparado para trabajo contable posterior.

El acceso a facturas recibidas por la empresa está limitado por la función `puedeEmpresa()` a:

- `admin`;
- `propietario`;
- `gerencia`;
- `administracion`.

### 2.2 Archivo persistido

El flujo actual:

1. selecciona varios archivos;
2. los sube con `Core.UploadPublicFile`;
3. procesa cada uno con OCR básico mediante `extraerDatosGasto` o su variante multi-documento;
4. crea un `RegistroGasto`;
5. guarda el adjunto en el array:

```json
"archivos": [
  {
    "url": "file_url",
    "nombre": "factura.pdf",
    "tipo": "application/pdf",
    "fecha_subida": "ISO-8601"
  }
]
```

Por tanto, la URL persistida puede funcionar como fuente estable para OCR especializado de materiales.

### 2.3 OCR básico ya disponible

`src/lib/ocrGastos.js` extrae:

- proveedor/comercio;
- NIF;
- fecha;
- importe total;
- categoría;
- número de factura/albarán;
- forma de pago;
- hora;
- código fiscal;
- concepto;
- confianza.

También puede detectar varios tickets en una misma foto, pero no realiza de forma fiable la extracción detallada de líneas de catálogo.

El resultado básico sirve para registrar gastos y detectar duplicados, pero no debe considerarse suficiente para inventar productos o actualizar precios.

### 2.4 OCR especializado de materiales

Ya existe una ruta distinta en:

- `src/pages/MaterialesOcr.jsx`;
- `src/components/materiales/MaterialesOcrDialog.jsx`;
- `src/lib/materialesOcrClient.js`;
- `base44/functions/procesarFacturaMateriales/entry.ts`;
- `base44/functions/guardarMaterialesOcr/entry.ts`.

Este flujo extrae por cada línea:

- fabricante;
- referencia;
- descripción;
- cantidad;
- unidad;
- PVP;
- descuento;
- IVA;
- precio neto.

Además, puede resolver o crear fabricantes y relacionar líneas con `Fabricante`, `MaterialCatalog`, `MaterialDocumentoOrigen`, `LineaFactura` y `MaterialPrecioHistorico`.

### 2.5 Entidades existentes

Las fuentes principales son:

- `RegistroGasto`;
- `NotaGastos` legacy;
- `GastoOperario` legacy;
- `MaterialDocumentoOrigen`;
- `LineaFactura`;
- `Fabricante`;
- `MaterialCatalog`;
- `MaterialPrecioHistorico`.

`MaterialDocumentoOrigen.nota_gasto_id` permite enlazar un documento procesado con el `RegistroGasto` original. Esto puede usarse como criterio explícito de cobertura.

---

## 3. Diagnóstico de la integración

### 3.1 Fortalezas existentes

- el adjunto se conserva;
- hay OCR básico masivo;
- existen detecciones de duplicados;
- existen facturas para medios propios y empresa;
- existe OCR especializado de materiales;
- existen entidades de fabricante y histórico;
- existe una entidad de documento origen;
- la carga masiva permite varios archivos;
- el resultado puede indicar precisión, duplicado o error;
- hay soporte para varias facturas/tickets en una misma imagen.

### 3.2 Limitaciones actuales

1. La carga masiva registra el adjunto, pero no crea líneas de materiales.
2. El OCR básico no extrae todas las líneas de producto de forma estructurada.
3. El resultado puede tener baja precisión y no existe un vínculo obligatorio con Materiales.
4. Un archivo puede procesarse varias veces.
5. Los documentos cargados directamente y los registrados desde contabilidad viven en flujos separados.
6. Falta un estado explícito de cobertura: pendiente, procesando, procesado, rechazado o duplicado.
7. Falta una vista donde Gerencia/Administración pueda revisar resultados y aprobar cambios.
8. El flujo de carga masiva exige operario incluso para facturas recibidas por la empresa.
9. `RegistroGasto.categoria` ayuda a clasificar, pero no garantiza que el documento contenga materiales.
10. No existe actualmente un flujo transaccional único que vincule documento, líneas, material y precio.

---

## 4. Objetivo funcional

Crear una herramienta que permita a **Gerencia** y **Administración**:

- seleccionar facturas/tickets ya registrados;
- seleccionar un periodo/ciclo;
- revisar archivos pendientes;
- procesar documentos con OCR especializado;
- comparar sus líneas con el catálogo;
- identificar materiales nuevos;
- actualizar el precio de materiales existentes;
- evitar duplicados;
- conservar la trazabilidad documental;
- aprobar cambios antes de publicarlos;
- consultar historial y errores.

---

## 5. Principios de seguridad y operación

1. **La IA propone, una persona aprueba.**
2. **Cada documento debe tener un único estado de procesamiento.**
3. **La URL original es la fuente documental.**
4. **El documento vinculado es la fuente de verdad del histórico.**
5. **El catálogo no se crea automáticamente por simples coincidencias.**
6. **Una línea sin referencia puede exigir revisión adicional.**
7. **Un duplicado no se elimina ni se crea dos veces.**
8. **El proceso debe ser reanudable ante errores o desconexiones.**
9. **La operación backend vuelve a validar rol y propiedad.**
10. **Los cambios deben dejar auditoría.**

---

## 6. Modelo de estados

### 6.1 Estados del adjunto respecto a Materiales

Añadir una entidad o índices derivados: `CoberturaMaterialesDocumento`.

Estados:

- `pendiente`;
- `sin_adjunto`;
- `no_es_material`;
- `procesando`;
- `espera_revision`;
- `procesado`;
- `ya_vinculado`;
- `duplicado`;
- `error_ocr`;
- `rechazado`;
- `cancelado`.

### 6.2 Estados de una línea detectada

- `material_existente`;
- `material_posible`;
- `material_nuevo`;
- `referencia_requiere_revision`;
- `unidad_incompatible`;
- `precio_sospechoso`;
- `aprobada`;
- `rechazada`;
- `procesada`.

### 6.3 Estados del documento comercial

Mantener los estados de `MaterialDocumentoOrigen`, ampliando si hace falta:

- `capturado`;
- `pendiente_revision`;
- `procesado`;
- `aprobado`;
- `con_discrepancia`;
- `rechazado`;
- `error`;
- `superseded`;
- `descartado`.

---

## 7. Modelo de datos propuesto

### 7.1 Ampliación de `RegistroGasto`

Campos adicionales recomendados:

- `materiales_revision_estado`;
- `materiales_revision_fecha`;
- `materiales_revision_por`;
- `materiales_documento_origen_id`;
- `materiales_lineas_count`;
- `materiales_aprobadas_count`;
- `materiales_error`.

Aunque no sea necesario para el MVP, la entidad puede conservar un resumen de cobertura. La regla principal seguirá siendo el vínculo `nota_gasto_id` en `MaterialDocumentoOrigen`, no duplicar estados en varias entidades.

### 7.2 Ampliación de `MaterialDocumentoOrigen`

Campos existentes relevantes:

- `archivo_url_original`;
- `archivo_url_mejorado`;
- `nota_gasto_id`;
- `nota_origen_tipo`;
- `tipo`;
- `numero_documento`;
- `fecha_documento`;
- `proveedor_nombre`;
- `proveedor_nif`;
- `lineas_count`;
- `datos_extraidos`.

Campos recomendados:

- `registro_gasto_id` explícito si la carga viene de contabilidad;
- `origen_importacion`: `subida_masiva`, `materiales_ocr`, `importacion_manual`, `importacion_iva`;
- `procesado_por`;
- `procesado_fecha`;
- `aprobado_por`;
- `aprobado_fecha`;
- `confianza_ocr`;
- `tiene_multiples_documentos`;
- `documento_indice_lote`;
- `hash_documento`;
- `cantidad_paginas`;
- `ocr_raw`.

### 7.3 Nueva entidad `CoberturaMaterialesSesion`

Campos:

- `fecha_inicio`;
- `fecha_fin`;
- `modo`: `periodo` o `completo`;
- `ciclo_periodo_key`;
- `estado`: `pendiente`, `ejecutando`, `completada`, `error`, `cancelada`;
- `documentos_revisados`;
- `ya_vinculados`;
- `pendientes_revision`;
- `nuevos_materiales`;
- `materiales_existentes`;
- `sin_lineas`;
- `no_material`;
- `sin_adjunto`;
- `errores`;
- `documentos_ids` o snapshot paginado;
- `cursor`;
- `ejecutado_por`;
- `modelo_ia`;
- `ia_usada`;
- `fecha_ejecucion`.

### 7.4 Nueva entidad opcional `RevisionLineaMaterial`

Para una auditoría más potente, cada línea detectada puede tener su propia revisión:

- `documento_origen_id`;
- `registro_gasto_id`;
- `fabricante_extraido`;
- `fabricante_id` resuelto;
- `referencia_extraida`;
- `material_id` posible;
- `descripcion_extraida`;
- `cantidad`;
- `unidad_extraida`;
- `unidad_normalizada`;
- `pvp`;
- `descuento`;
- `iva`;
- `precio_neto`;
- `confianza`;
- `estado_revision`;
- `motivo_revision`;
- `revisado_por`;
- `revisado_fecha`;
- `precio_aprobado`.

---

## 8. Flujo técnico completo

```text
Contabilidad / Subida masiva
  -> subir archivos
  -> UploadPublicFile
  -> OCR básico
  -> crear RegistroGasto
  -> guardar URL en archivos[]

Herramienta Cobertura de Materiales
  -> seleccionar periodo / registros
  -> buscar adjuntos pendientes
  -> comprobar nota_gasto_id
  -> comprobar vínculo por URL solo como migración histórica
  -> excluir duplicados y no-materiales
  -> enviar adjunto al OCR especializado
  -> extraer líneas
  -> resolver fabricante
  -> comparar referencia/código/nombre
  -> marcar coincidencia o alta nueva
  -> guardar propuesta sin modificar catálogo
  -> presentar resumen para revisión

Gerencia / Administración
  -> revisar documento
  -> corregir proveedor, fecha y líneas
  -> aprobar/rechazar materiales
  -> confirmar precios

Persistencia aprobada
  -> crear/actualizar MaterialCatalog
  -> crear registro en MaterialPrecioHistorico
  -> crear/actualizar LineaFactura
  -> crear MaterialDocumentoOrigen
  -> guardar enlace a RegistroGasto
  -> marcar documento procesado
  -> actualizar métricas de cobertura
```

---

## 9. Criterios de cobertura

### 9.1 Ya vinculado

Una nota está cubierta si existe un `MaterialDocumentoOrigen` con:

```text
nota_gasto_id = RegistroGasto.id
nota_origen_tipo = registro_gasto
```

Este es el criterio principal. No se debe inferir cobertura por importe o fecha.

### 9.2 Pendiente

Está pendiente si:

- tiene archivo adjunto;
- no existe `nota_gasto_id` correspondiente;
- no está marcada como no-material;
- no está bloqueada por error permanente.

### 9.3 Match histórico por URL

Solo en una migración inicial, si una nota antigua no tiene vínculo pero una URL coincide exactamente con:

- `archivo_url_mejorado`;
- `archivo_url_original`.

En ese caso puede crearse el vínculo retroactivo y registrar una auditoría de migración.

No se recomienda match por fecha + importe + proveedor como criterio automático.

### 9.4 No material

Se excluye sin OCR especializado cuando:

- categoría es distinta de `material` y no hay indicios contradictorios;
- el documento no contiene líneas compatibles;
- es un reverso sin importe;
- es una imagen inválida;
- es una factura de combustible, alojamiento, peaje o servicio que no corresponde a materiales.

La categoría actual `otros` debe quedar en revisión, no excluirse automáticamente.

---

## 10. Deduplicación

### 10.1 Antes de procesar

Comprobaciones:

- `registro_gasto_id`;
- hash del archivo;
- URL original;
- número de factura;
- NIF proveedor;
- fecha;
- importe total;
- código fiscal;
- ya vinculado;
- duplicado confirmado por el usuario.

### 10.2 Durante el OCR

- evitar procesar el mismo documento dos veces;
- procesar una sola vez por sesión;
- bloquear concurrencia mediante estado `procesando`;
- persistir el cursor de lotes;
- registrar `documento_indice_lote` si varias facturas proceden de una misma imagen.

### 10.3 Antes de crear material

Material existente si coincide por:

1. `fabricante_id + referencia`;
2. código interno;
3. coincidencia alta de descripción y fabricante;
4. coincidencia manual aprobada.

El primer criterio es el preferente.

No se debe usar solo el nombre para crear o unir materiales.

---

## 11. Interfaz propuesta

### 11.1 Entrada desde Contabilidad

En la pestaña **Subida masiva** añadir una acción:

```text
Revisar para Materiales
```

Alternativamente, después de procesar el lote aparece:

```text
X documentos registrados
Y pendientes de revisar para materiales
Z ya vinculados
```

Cada resultado debe permitir:

- abrir archivo;
- ver datos OCR básicos;
- marcar como no material;
- ejecutar análisis especializado;
- crear una revisión de materiales;
- abrir el registro originario.

### 11.2 Nueva vista dentro de Materiales

Ruta recomendada: `/materiales-cobertura` o pestaña dentro de `/materiales-ocr`.

Secciones:

- selector de periodo/ciclo;
- estadísticas;
- pendientes;
- revisados;
- nuevos materiales;
- materiales existentes con cambio de precio;
- errores OCR;
- documentos ya vinculados;
- no-materiales;
- duplicados.

### 11.3 Revisión por documento

Cada documento debe mostrar:

- proveedor;
- NIF;
- fecha;
- número;
- archivo original;
- archivo procesado si existe;
- obra si está asignada;
- origen: Subida masiva, OCR directo o Importación IVA;
- confianza;
- líneas detectadas;
- coincidencias con catálogo;
- variación de precio;
- estado de aprobación.

### 11.4 Revisión por línea

Cada línea debe permitir:

- incluir o excluir;
- corregir fabricante;
- buscar fabricante existente;
- corregir referencia;
- unir con material existente;
- crear material nuevo;
- corregir cantidad y unidad;
- corregir PVP, descuento e IVA;
- confirmar precio neto;
- asignar obra o uso si corresponde.

### 11.5 Confirmación final

La pantalla de confirmación debe indicar:

- materiales nuevos;
- materiales que cambian de precio;
- líneas excluidas;
- proveedor/documento asociado;
- importe esperado;
- líneas con baja confianza;
- posibles duplicados.

No se habilita el guardado final mientras existan ambigüedades bloqueantes.

---

## 12. Backend técnico

### 12.1 Función de cobertura

Nueva función: `comprobarCoberturaMateriales`

Responsabilidades:

- autenticar usuario;
- permitir solo `admin`, `propietario`, `gerencia` y `administracion`;
- validar periodo;
- listar adjuntos por lotes;
- comprobar cobertura;
- devolver resumen y cursor;
- crear sesión de comprobación;
- evitar ejecución concurrente;
- respetar límite de IA por lote.

Entrada:

```json
{
  "modo": "periodo",
  "fecha_inicio": "2026-11-01",
  "fecha_fin": "2026-11-30",
  "completo": false,
  "cursor": null
}
```

Salida:

```json
{
  "sesion_id": "id",
  "revisados": 120,
  "ya_vinculados": 43,
  "pendientes": 62,
  "no_material": 9,
  "sin_adjunto": 6,
  "errores": 4,
  "has_more": true,
  "next_cursor": "cursor",
  "pendientes_ids": ["..."]
}
```

### 12.2 Función de extracción

Puede reutilizar `procesarFacturaMateriales` con ampliaciones:

- aceptar `registro_gasto_id`;
- aceptar varios archivos;
- aceptar varios documentos dentro de una misma foto/PDF;
- devolver líneas y metadatos;
- devolver confianza por documento y por línea;
- devolver datos raw sin guardar;
- impedir persistencia hasta aprobación.

### 12.3 Función de aprobación

Nueva función: `aprobarMaterialesDesdeDocumento`

Responsabilidades:

- validar roles;
- recibir documento y líneas aprobadas;
- comprobar nuevamente duplicados;
- resolver fabricantes;
- crear o actualizar materiales;
- crear históricos;
- crear `LineaFactura` si aplica;
- crear `MaterialDocumentoOrigen`;
- vincular `nota_gasto_id` y `nota_origen_tipo`;
- crear movimiento/auditoría;
- ser idempotente ante reintentos;
- devolver el resultado final.

La función no debe confiar en datos enviados desde el frontend sin volver a validar proveedor, importe, referencia y documento.

### 12.4 Función de cobertura periódica

Puede ejecutarse manualmente o mediante automatización semanal, pero solo después de la aprobación del backend.

La automatización podría:

- ejecutar el cálculo de cobertura;
- no hacer cambios en materiales;
- crear una sesión;
- marcar documentos pendientes;
- mostrar contador en la herramienta.

No se recomienda automatizar altas o cambios de precio sin revisión inicial.

---

## 13. Procesamiento por lotes

Para no bloquear ni exceder límites:

- procesar máximo 20–50 documentos por lote;
- procesar archivos grandes con timeout ampliado;
- respetar un límite máximo de páginas/PDF;
- permitir reanudación mediante cursor;
- guardar sesiones parciales;
- separar OCR básico de extracción especializada;
- reutilizar `ocr_raw` si ya existe;
- cachear fabricantes y materiales;
- ejecutar coincidencias exactas antes de llamadas IA;
- usar IA solo para documentos no cubiertos y posibles materiales.

### 13.1 Coste de IA

La extracción se usa solo para:

- registros con adjunto;
- categoría material u categoría desconocida;
- documentos sin cobertura;
- registros que no tienen `ocr_raw` reutilizable.

No se vuelve a procesar:

- documentos ya vinculados;
- archivos marcados como no-material;
- duplicados confirmados;
- documentos ya aprobados;
- documentos que fallaron de forma permanente si no cambia su contenido.

---

## 14. Relación con notas de gasto mensuales

La herramienta debe recorrer los registros individuales de `RegistroGasto`, no asumir que la entidad mensual contiene los adjuntos.

Para cada registro:

- verificar adjuntos;
- identificar su ciclo;
- comprobar cobertura;
- extraer solamente archivos con evidencia material;
- mostrar el registro en el panel pendiente;
- vincular el documento resultante al registro original.

Las entidades históricas `NotaGastos` y `GastoOperario` pueden añadirse como fuentes legacy, pero solo tras confirmar su estructura real de adjuntos y evitar seleccionar la entidad mensual sin archivo.

---

## 15. Relación con facturas recibidas

En Subida masiva hay dos formas de registrar facturas recibidas:

- como `RegistroGasto` con `origen_pago=medio_empresa`;
- como `RegistroGasto` con `origen_pago=credito_proveedor`.

Ambas pueden alimentar Materiales.

Además, `FacturaIVA` puede almacenar cabeceras e importes recibidos procedentes de CSV. Ese libro **no contiene líneas de materiales** y no debe considerarse fuente directa de productos. Puede utilizarse únicamente para:

- conciliación contable;
- localizar proveedor, NIF y factura;
- comprobar un duplicado fiscal;
- aportar fecha y tipo IVA;
- determinar si falta el justificante original.

Si se importa una factura recibida como CSV sin PDF/imagen, no puede alimentar precios por línea hasta disponer del justificante original.

---

## 16. Permisos

### 16.1 Roles autorizados

La comprobación y aprobación de materiales deben requerir al menos:

- `admin`;
- `propietario`;
- `gerencia`;
- `administracion`.

Puede ampliarse a un futuro rol `compras`, si se aprueba formalmente.

### 16.2 Operaciones restringidas

- ejecutar OCR masivo;
- aprobar materiales nuevos;
- aprobar cambios de precio;
- marcar documentos como no-material;
- vincular archivos históricos;
- rechazar o eliminar propuestas;
- cambiar proveedor/fabricante maestro;
- ejecutar conciliación contable.

### 16.3 Operaciones no restringidas a contabilidad

El flujo puede consultar el adjunto si el rol tiene acceso a:

- Documental;
- Notas de gasto;
- Contabilidad;
- el registro de obra correspondiente.

Pero la creación del catálogo debe ser un proceso distinto y autorizado.

---

## 17. Migración

### Fase A: preparación

- confirmar campo `nota_gasto_id` y `nota_origen_tipo` en `MaterialDocumentoOrigen`;
- normalizar nombres de proveedor;
- crear índices por URL, NIF y número de factura;
- añadir estados de cobertura;
- conservar compatibilidad con documentos existentes.

### Fase B: historial

- localizar archivos persistidos en `RegistroGasto.archivos`;
- comprobar enlaces actuales;
- intentar matching exacto por URL solo para la primera migración;
- marcar no-materiales conocidos;
- crear una sesión de cobertura inicial;
- no crear materiales aún.

### Fase C: extracción asistida

- procesar documentos pendientes;
- guardar propuestas;
- mostrar la vista de revisión;
- corregir fabricantes y referencias;
- aprobar material nuevo o existentes.

### Fase D: persistencia

- crear/actualizar catálogo;
- crear históricos;
- crear documento origen;
- vincular con `RegistroGasto`;
- invalidar cachés y consultas;
- registrar auditoría.

### Fase E: automatización

- comprobación semanal o manual por periodo;
- alertas de documentos pendientes;
- ejecución incremental;
- nunca crear materiales sin aprobación hasta que exista una política madura.

---

## 18. Tratamiento de documentos con varias facturas

Si una foto/PDF contiene varias facturas:

- separar solo como documentos consecutivos o claramente detectados;
- bloquear el guardado si la confianza global es baja;
- permitir revisar y reordenar páginas;
- guardar una propuesta por documento;
- asociar cada documento a su propio número, proveedor y líneas;
- no mezclar totales de varios documentos;
- conservar el archivo fuente completo.

El diseño de múltiples páginas ya está descrito en `src/MULTIPAGINA_MATERIALES_OCR.md` y puede reutilizarse.

---

## 19. Offline y concurrencia

- subir el archivo puede requerir conexión;
- la extracción puede quedar en cola si falla;
- no permitir aprobaciones duplicadas concurrentes;
- guardar una clave única por registro/documento;
- usar idempotencia en backend;
- reenviar una aprobación no debe crear materiales repetidos;
- mostrar estado de procesamiento y reintento;
- conservar el archivo original hasta completar o registrar una baja documentada.

---

## 20. Pruebas

### 20.1 Unitarias

- duplicados por URL;
- duplicados por NIF/número;
- matching fabricante/referencia;
- parsing de líneas;
- normalización de unidades;
- cálculo de precio neto;
- variación de precio;
- detección de no-material;
- idempotencia de aprobación;
- paginación y cursor.

### 20.2 Integración

- subir archivo -> crear RegistroGasto -> procesar cobertura;
- ya vinculado -> no reprocesar;
- archivo nuevo -> propuesta -> aprobación -> catálogo;
- material existente -> actualización de histórico;
- material nuevo -> fabricación de alta;
- OCR con varias páginas -> varias propuestas;
- baja confianza -> bloquea aprobación;
- dos usuarios aprobando -> una sola actualización;
- fallo backend -> reintento seguro.

### 20.3 Seguridad

- operario intentando acceder a cobertura;
- contabilidad intentando aprobar materiales;
- técnico intentando consultar documentos económicos;
- usuario demo intentando procesar proveedores;
- manipulación de `registro_gasto_id`;
- manipulación de precio aprobado;
- manipulación de material_id;
- repetición de llamada de aprobación.

---

## 21. Métricas

- documentos registrados;
- documentos con adjunto;
- documentos ya vinculados;
- pendientes;
- procesados;
- materiales nuevos detectados;
- materiales existentes detectados;
- cambios de precio registrados;
- tasa de revisión manual;
- tasa de rechazo;
- tasa de error OCR;
- tasa de duplicados;
- tiempo medio de procesamiento;
- tiempo medio de revisión;
- coste IA por documento;
- coste IA por línea;
- cobertura histórica por ciclo;
- número de documentos sin origen/nif/fecha.

---

## 22. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Alta automática incorrecta | Alto | revisión humana obligatoria |
| Doble extracción | Medio | estado, vínculo y hash |
| Doble precio histórico | Alto | transacción y idempotencia |
| OCR confunde IVA/PVP | Alto | mostrar PVP, base, IVA y neto por separado |
| Documento de varios tickets | Alto | bloqueo ante baja confianza y revisión |
| Varias líneas similares | Medio | comparación por fabricante/referencia |
| Enlace de nota equivocado | Alto | NIF/número/URL exacta y aprobación |
| Coste IA elevado | Medio | procesar solo pendientes y reutilizar OCR_raw |
| PDF con texto escaneado | Alto | preprocesado y calidad mínima |
| Factura sin adjunto | Medio | marcar pendiente de archivo |
| Operario usado como proveedor corporativo | Medio | separar registro empresa de operario |
| Migración histórica ambigua | Alto | solo URL exacta, resto a revisión |
| Permisos inconsistentes | Alto | RLS + backend + pruebas por rol |

---

## 23. Plan de implementación

### Fase 1: trazabilidad — 1 semana

- verificar `nota_gasto_id` y `nota_origen_tipo`;
- asegurar que `RegistroGasto.archivos` conserva URL original;
- añadir estado de cobertura a documentos o entidad sesión;
- añadir hash o referencia estable si se aprueba;
- añadir enlace desde el panel de Subida masiva.

### Fase 2: herramienta de revisión — 1–2 semanas

- listar registros con adjunto;
- filtrar por ciclo y categoría;
- comprobar cobertura;
- mostrar pendientes y ya vinculados;
- permitir marcar no material;
- vista de documento.

### Fase 3: OCR especializado — 1–2 semanas

- reutilizar `procesarFacturaMateriales`;
- aceptar `registro_gasto_id`;
- devolver propuestas sin persistir;
- comparar contra catálogo;
- distinguir alta nueva y material existente;
- mostrar líneas y precios.

### Fase 4: aprobación y persistencia — 2 semanas

- crear función backend de aprobación;
- crear materiales;
- crear históricos;
- enlazar documentos;
- aplicar idempotencia;
- registrar auditoría.

### Fase 5: cobertura histórica y automatización — 1 semana

- ejecutar matching exacto por URL;
- crear sesión inicial;
- generar contador de pendientes;
- opcional: comprobación semanal;
- informes por proveedor, obra y periodo.

---

## 24. Criterios de aceptación

La integración se considera terminada cuando:

1. una factura cargada en Subida masiva conserva su archivo original;
2. la herramienta puede localizar el archivo desde `RegistroGasto`;
3. puede determinar si ya está vinculada a Materiales;
4. puede identificar documentos pendientes;
5. puede procesar las líneas sin modificar el catálogo automáticamente;
6. puede diferenciar material existente de material nuevo;
7. puede registrar proveedores y referencias;
8. puede actualizar históricos solo tras aprobación;
9. puede evitar duplicados por URL, número y vínculo;
10. puede enlazar `RegistroGasto` con `MaterialDocumentoOrigen`;
11. Gerencia/Administración pueden revisar y aprobar;
12. los operarios no pueden aprobar o crear materiales;
13. las operaciones son idempotentes;
14. los documentos con baja confianza quedan bloqueados;
15. se puede ver el estado por periodo y proveedor;
16. las facturas recibidas no requieren operario en el flujo corporativo futuro;
17. CSV de IVA sin documento original no se considera fuente de líneas.

---

## 25. Decisiones que requiere Gerencia

Antes de construir:

1. ¿Gerencia y Administración aprueban conjuntamente o una sola puede aprobar?
2. ¿Se permite una alta nueva sin coincidencia exacta?
3. ¿Quién puede crear proveedores/fabricantes?
4. ¿Qué umbral de confianza bloquea una línea?
5. ¿Qué umbral de variación de precio requiere revisión obligatoria?
6. ¿Las facturas corporativas deben dejar de requerir operario?
7. ¿Se permitirá reprocesar documentos aprobados?
8. ¿La comprobación será manual, semanal o ambas?
9. ¿Se incluirán entidades legacy `NotaGastos` y `GastoOperario`?
10. ¿Qué documentos no materiales se excluyen automáticamente?
11. ¿Qué proveedor/fabricante prevalece si aparecen nombres distintos?
12. ¿Las facturas recibidas deben exigir obra antes de aprobar?

---

## 26. Recomendación final

La carga masiva contable constituye una fuente válida y ya parcialmente preparada para alimentar materiales. El adjunto original está persistido y puede reprocesarse sin depender de que el OCR básico haya obtenido datos completos.

La implementación profesional debe mantener tres fuentes claramente separadas:

- **RegistroGasto**: el justificante contable original.
- **MaterialDocumentoOrigen**: el documento normalizado y aprobado para materiales.
- **MaterialCatalog / MaterialPrecioHistorico**: el resultado maestro aprobado.

La primera versión debe ser **asistida por IA y aprobada por personas**, no totalmente automática. Una vez validado el sistema con datos reales, puede automatizarse la detección y cobertura periódica, manteniendo siempre una revisión para materiales nuevos, cambios relevantes y documentos dudosos.
