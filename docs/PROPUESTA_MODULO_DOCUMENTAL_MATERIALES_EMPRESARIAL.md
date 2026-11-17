# Propuesta completa: organización profesional del módulo Documental / Materiales

**Repositorio:** `cazacumariandorin-sudo/smart-gestion`  
**Fecha:** 17 de noviembre de 2026  
**Estado:** Propuesta técnica para aprobación  
**Objetivo:** convertir las piezas actuales de materiales, inventario documental y OCR en un flujo empresarial único, trazable y seguro.

---

## 1. Resumen ejecutivo

La aplicación Smart Gestión cuenta con una base funcional para materiales, pero las operaciones están repartidas entre varias entidades y pantallas:

- Catálogo general en `/materials`.
- Alta documental por OCR en `/materiales-ocr`.
- Materiales asociados a obras en `ObraMaterial`.
- Solicitudes pendientes en `MaterialPendiente`.
- Documentación técnica en `Manuales`, `Drawing` e Ingeniería.
- Herramientas y asignaciones en `/inventario`.
- Pedidos en `/orders`.
- Facturas y gastos existentes en las entidades económicas.

El reto no consiste en añadir otra pantalla, sino en establecer una jerarquía clara de dominio:

1. **Catálogo maestro**: qué materiales existen.
2. **Aprovisionamiento**: qué se necesita, solicita, compra y recibe.
3. **Inventario físico**: qué existe y dónde está.
4. **Consumo por obra**: qué se utilizó y cuánto costó.
5. **Documentación**: qué archivo acredita una compra, una ficha técnica o una revisión.
6. **Herramientas**: activos asignables, separados de consumibles.

La propuesta mantiene las entidades útiles ya existentes y propone evolucionarlas de forma incremental, evitando migraciones invasivas innecesarias.

---

## 2. Situación actual detectada

### 2.1 Catálogo de materiales

`src/pages/MaterialCatalog.jsx` ofrece búsqueda, filtros por categoría, alta, edición y eliminación. La entidad `base44/entities/MaterialCatalog.jsonc` ya incluye campos modernos como `referencia`, `fabricante_id`, `fabricante_name`, `precio_neto`, `fecha_ultimo_precio` e `active`.

Sin embargo, el formulario actual trabaja especialmente con campos legacy:

- `code` en lugar de `referencia`.
- `unit_price` en lugar de `precio_neto`.
- `supplier` como texto libre en lugar de una relación completa con `Fabricante`.

### 2.2 OCR documental

`src/pages/MaterialesOcr.jsx` permite cargar facturas, albaranes, tickets y documentos asociados a notas de gasto. `src/components/materiales/MaterialesOcrDialog.jsx` gestiona escaneado, OCR, revisión humana y guardado.

El backend `procesarFacturaMateriales/entry.ts` restringe el procesamiento a administradores, propietarios y gerencia. El cliente `src/lib/materialesOcrClient.js` registra `MaterialDocumentoOrigen`, resuelve fabricantes y crea o actualiza `MaterialCatalog`, `LineaFactura` y `MaterialPrecioHistorico`.

El flujo ya contiene protección básica, soporte multipágina y trazabilidad. La necesidad principal es completar el ciclo empresarial y eliminar ambigüedades entre OCR, nota de gasto, pedido y recepción.

### 2.3 Documental

La pantalla `src/pages/Manuales.jsx` organiza manuales por cliente y obra. Además, integra documentos técnicos desde `MaterialDocumentoOrigen` mediante `src/lib/documentosUnificados.js`.

Esto permite reutilizar una misma fuente para planos, manuales y documentos técnicos. Hay que impedir que facturas, presupuestos y pedidos aparezcan accidentalmente en el archivo técnico visible para operarios.

### 2.4 Inventario

`src/pages/Inventario.jsx` gestiona realmente herramientas y asignaciones mediante `Herramienta` y `AsignacionHerramienta`. Su denominación actual puede confundirse con inventario de consumibles.

Se recomienda renombrar conceptual y visualmente esta sección como **Herramientas y activos** hasta que se implemente la gestión real de existencias.

### 2.5 Solicitudes y compras

Existen `MaterialPendiente` y `Order`, con un nexo parcial hacia materiales y obras. Falta un estado común y relaciones explícitas entre solicitud, pedido, recepción, factura y consumo.

---

## 3. Objetivos

### 3.1 Objetivos funcionales

- Mantener un único catálogo maestro de materiales.
- Asociar materiales a obras, proveedores y fabricantes.
- Gestionar solicitudes, aprobaciones, pedidos y recepciones.
- Medir stock real por almacén y obra.
- Registrar entradas, salidas, devoluciones y ajustes.
- Vincular documentos, facturas y notas de gasto al movimiento correspondiente.
- Mantener histórico fiable de precios.
- Separar consumibles de herramientas y activos.
- Permitir OCR por varias páginas sin perder trazabilidad.
- Presentar dashboards accionables por obra y empresa.

### 3.2 Objetivos de control

- Nada debe eliminarse sin política de auditoría o baja lógica.
- Los documentos procesados por IA deben ser revisados antes de aprobarse.
- Los cambios de stock deben crear un movimiento registrado.
- Los precios netos no deben editarse directamente desde el catálogo.
- Cada documento debe indicar usuario, fecha, estado y origen.
- Las operaciones sensibles deben validarse en el backend y en las reglas RLS.

---

## 4. Principios de diseño

1. **Identidad única:** un material tiene una entidad maestra y un identificador estable.
2. **Referencia compuesta:** fabricante + referencia forman la clave preferente de deduplicación.
3. **Stock derivado, no manual:** el stock disponible se deriva de movimientos validados.
4. **Importe neto:** todos los históricos usan precio unitario neto sin IVA y documentan IVA por separado.
5. **Todo movimiento tiene trazabilidad:** origen, destino, responsable, obra, documento y fecha.
6. **Baja lógica:** materiales desactivados permanecen consultables por auditoría.
7. **Revisión humana:** IA propone datos, pero no confirma una compra por sí sola.
8. **Separación por dominio:** catálogo, pedido, documento, stock y herramienta son conceptos diferentes.

---

## 5. Modelo objetivo del área de materiales

### 5.1 Catálogo maestro

Entidad principal recomendada: `MaterialCatalog`.

Campos que deben considerarse obligatorios o normalizados:

- `codigo_interno` único.
- `name`.
- `referencia`.
- `fabricante_id` y `fabricante_name`.
- `category_id` y `category_name`.
- `unidad_base` normalizada.
- `unidad_compra` opcional.
- `factor_conversion` opcional.
- `precio_neto_actual` calculado desde el último histórico válido.
- `fecha_ultimo_precio`.
- `fabricante_preferente_id` opcional.
- `manual_url`.
- `ficha_tecnica_url`.
- `active`.
- `created_by`, `updated_by`, `created_date`, `updated_date`.

La entidad debe evitar duplicados mediante comprobación de:

- `fabricante_id + referencia`.
- coincidencia alta de nombre y fabricante.
- coincidencia con código interno.

La creación manual del catálogo puede autorizarse solo a compras/administración cuando se apruebe la política definitiva.

### 5.2 Solicitud de materiales

Se reutiliza `MaterialPendiente` como solicitud inicial, ampliándolo con:

- `lineas[]` o entidad hija `SolicitudMaterialLinea`.
- `codigo_solicitud`.
- `obra_id`, `obra_name`, `client_id`.
- `solicitado_por_id/email/nombre/rol`.
- `prioridad`.
- `fecha_necesaria`.
- `estado`: borrador, pendiente, aprobada, rechazada, solicitada, parcial, recibida, cancelada.
- `motivo_rechazo`.
- `aprobado_por`, `fecha_aprobacion`.
- `pedido_id`.
- `notas`.

Cada solicitud debe gestionar varias líneas para evitar crear una solicitud por cada material.

### 5.3 Pedido

La entidad `Order` debe evolucionar hacia un pedido formal con:

- `codigo_pedido` único.
- `proveedor_id/nombre/nif`.
- `obra_id/name`.
- `solicitud_id` opcional.
- `estado`: borrador, solicitado, confirmado, parcial, recibido, cancelado, discrepancia.
- `fecha_pedido`, `fecha_confirmada`, `fecha_entrega_prevista`.
- `subtotal`, `descuento`, `iva`, `importe_total`.
- `condiciones_pago`.
- `documento_presupuesto_id`.
- líneas con material, referencia, cantidad, unidad, precio bruto, descuento, IVA y precio neto.

### 5.4 Recepción

Nueva entidad: `RecepcionMaterial`.

Campos principales:

- `pedido_id`.
- `obra_id`.
- `fecha_recepcion`.
- `documento_origen_id`.
- `almacen_id/ubicacion`.
- `recibido_por`.
- `estado`: parcial o completa.
- `observaciones`.
- líneas con pedido, material, cantidad pedida, recibida, unidad y diferencia.

Cada recepción confirmada genera movimientos de entrada.

### 5.5 Movimiento de stock

Nueva entidad: `MovimientoMaterial`.

Tipos:

- `entrada_compra`.
- `entrada_devolucion`.
- `salida_obra`.
- `consumo_obra`.
- `transferencia_almacen`.
- `traslado_obra`.
- `devolucion_obra`.
- `ajuste_positivo`.
- `ajuste_negativo`.
- `baja`.

Campos:

- `material_id`.
- `tipo_movimiento`.
- `cantidad` positiva o normalizada por tipo.
- `unidad`.
- `almacen_origen_id`.
- `almacen_destino_id`.
- `obra_id`.
- `pedido_id`.
- `recepcion_id`.
- `documento_id`.
- `precio_neto_unitario`.
- `coste_total`.
- `motivo`.
- `referencia_externa`.
- `operario_id/responsable`.
- `fecha_movimiento`.
- `estado`: confirmado, anulado.

Anular un movimiento no debe eliminarlo: crea un movimiento compensatorio o cambia el estado con auditoría.

### 5.6 Stock

Nueva entidad derivada o vista agregada: `StockMaterial`.

- `material_id`.
- `almacen_id`.
- `obra_id` opcional.
- `cantidad_disponible`.
- `cantidad_reservada`.
- `cantidad_comprometida`.
- `stock_minimo`.
- `stock_maximo`.
- `ubicacion`.
- `fecha_actualizacion`.

La disponibilidad se calcula como:

```text
disponible = entradas confirmadas - salidas confirmadas - reservas
```

### 5.7 Consumo por obra

Se reutiliza `ObraMaterial`, pero se recomienda ampliarlo con:

- `material_id` obligatorio cuando existe en catálogo.
- `material_name` denormalizado.
- `referencia`.
- `cantidad`, `unidad`.
- `precio_neto_unitario`.
- `coste_total`.
- `movimiento_id`.
- `pedido_id`.
- `documento_id`.
- `fecha_consumo`.
- `estado`.

El consumo registrado puede generar automáticamente el movimiento de salida correspondiente.

### 5.8 Documento de origen

`MaterialDocumentoOrigen` debe convertirse en el documento documental y comercial único.

Campos recomendados o confirmados:

- `tipo`.
- `numero_documento`.
- `revision`.
- `fecha_documento`.
- `proveedor_nombre/nif`.
- `archivo_url_original`.
- `archivo_url_mejorado`.
- `obra_id/proyecto_ingenieria_id`.
- `pedido_id`.
- `recepcion_id`.
- `nota_gasto_id`.
- `nota_origen_tipo`.
- `estado`.
- `datos_extraidos`.
- `lineas_count`.
- datos de conciliación contable.

Estados recomendados:

- `capturado`.
- `pendiente_revision`.
- `procesado`.
- `conciliado`.
- `con_discrepancia`.
- `rechazado`.
- `superseded`.
- `error`.
- `descartado`.

Los estados deben mantener compatibilidad con los existentes hasta terminar la migración.

### 5.9 Líneas comerciales

Mantener `LineaFactura` para facturas, albaranes y pedidos. Cada línea debe incluir:

- `documento_origen_id`.
- `pedido_id`.
- `recepcion_id`.
- `material_id`.
- `fabricante_id`.
- `referencia`.
- `descripcion`.
- `cantidad_facturada`.
- `unidad`.
- `pvp`.
- `descuento_empresa`.
- `iva`.
- `precio_unitario_neto`.
- `importe_neto`.
- `estado_conciliacion`.

### 5.10 Histórico de precios

Mantener `MaterialPrecioHistorico`, ampliándolo con:

- `pedido_id`.
- `recepcion_id`.
- `documento_id`.
- `proveedor_id/nif/nombre`.
- `cantidad_documento`.
- `moneda`.
- `fecha_efectiva`.
- `vigente_hasta`.
- `validado_por`.
- `motivo_cambio`.
- `estado`: pendiente, vigente, sustituito, rechazado.

La pantalla de catálogo no debe crear ni modificar precios manualmente si existe un documento validado. Puede consultar el histórico y mostrar excepciones.

### 5.11 Herramientas y activos

Mantener como entidades independientes:

- `Herramienta`.
- `AsignacionHerramienta`.

Renombrar `/inventario` a “Herramientas y activos” hasta que se cree la entidad de stock consumible.

Campos adicionales recomendados:

- `codigo_activo`.
- `tipo`.
- `estado`.
- `condicion`.
- `fecha_ultimo_mantenimiento`.
- `proximo_mantenimiento`.
- `certificados_url`.
- `obra_actual_id`.
- `operario_actual_id`.

---

## 6. Arquitectura de pantalla propuesta

### 6.1 Acceso principal

Dentro de **Documental**, mantener los documentos técnicos separados y crear un hub **Materiales y Compras**:

```text
Materiales y Compras
├── Resumen
├── Solicitudes
├── Catálogo
├── Fabricantes y proveedores
├── Pedidos
├── Recepciones
├── Movimientos y stock
├── Alta documental OCR
├── Histórico de precios
├── Consumo por obra
└── Herramientas y activos
```

### 6.2 Dashboard

Un resumen inicial debe mostrar:

- Solicitudes pendientes.
- Solicitudes vencidas o sin cubrir.
- Pedidos parciales o retrasados.
- Recepciones pendientes de validar.
- Documentos pendientes de revisión OCR.
- Materiales por debajo de stock mínimo.
- Variaciones relevantes de precio.
- Compras pendientes de conciliación.
- Gastos o consumos por obra.

### 6.3 Catálogo

La pantalla debe permitir:

- Buscar por nombre, referencia, código interno y fabricante.
- Filtrar por categoría, proveedor, unidad y estado.
- Ver stock global y por obra/almacén.
- Ver el último precio neto y su evolución.
- Ver fabricantes alternativos.
- Ver manual/ficha técnica.
- Ver documentos asociados.
- Activar/desactivar sin borrar.

### 6.4 Solicitudes

Vista tipo tablero o lista:

- `Pendiente de aprobar`.
- `Aprobada`.
- `Solicitada al proveedor`.
- `Recibida parcialmente`.
- `Recibida`.
- `Cancelada`.

Cada solicitud debe mostrar obra, solicitante, prioridad, fecha necesaria y líneas.

### 6.5 Pedidos y recepciones

El pedido debe abrir una vista de detalle con:

- Cabecera.
- Líneas.
- Estado de recepción.
- Documentos asociados.
- Historial de cambios.
- Incidencias.
- Confirmación de recepción parcial.

### 6.6 OCR

Mantener el asistente actual, pero convertirlo en una etapa formal:

1. Captura o selección.
2. Preprocesado/escaneado.
3. OCR.
4. Revisión de cabecera.
5. Revisión de líneas.
6. Vinculación con obra, proveedor y pedido.
7. Detección de duplicados.
8. Confirmación.
9. Guardado.
10. Actualización de históricos y movimientos.

Cada pantalla debe permitir corregir proveedor, NIF, número, fecha, IVA, descuento y unidad antes de guardar.

---

## 7. Flujo empresarial completo

```text
Necesidad en obra
  -> solicitud de material
  -> aprobación
  -> selección de proveedor
  -> pedido
  -> documento presupuestario/pedido
  -> seguimiento de entrega
  -> recepción parcial o completa
  -> registro de documento factura/albarán
  -> OCR y revisión humana
  -> conciliación pedido/factura/recepción
  -> entrada en stock
  -> reserva o salida a obra
  -> consumo de obra
  -> coste real y histórico de precio
```

### 7.1 Estados de cada objeto

**Solicitud:**

```text
borrador -> pendiente -> aprobada -> solicitada
         -> parcial -> recibida
         -> rechazada/cancelada
```

**Pedido:**

```text
borrador -> solicitado -> confirmado -> parcial
         -> recibido -> cerrado
         -> cancelado/discrepancia
```

**Documento:**

```text
capturado -> pendiente_revision -> procesado
          -> conciliado
          -> con_discrepancia/rechazado/error
```

**Movimiento:**

```text
borrador -> confirmado -> anulado
```

Nunca un movimiento se elimina físicamente.

---

## 8. Permisos y roles

La propuesta conserva la lectura amplia del catálogo para procesos operativos, pero separa creación, aprobación, stock y datos económicos.

| Acción | Admin | Gerencia | Compras | Administración | Jefe de obra | Técnico | Operario | Contabilidad | Ingeniero |
|---|---|---|---|---|---|---|---|---|---|
| Ver catálogo | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí | Sí |
| Solicitar materiales | Sí | Sí | Sí | Sí | Sí | Sí | Sí | No | Sí |
| Aprobar solicitudes | Sí | Sí | Sí | Sí | No | No | No | No | No |
| Crear pedido | Sí | Sí | Sí | Sí | Sí condicionado | No | No | No | No |
| Registrar recepción | Sí | Sí | Sí | Sí | Sí | Condicionado | No | No | No |
| Ajustar stock | Sí | Sí | Sí | Sí | No | No | No | No | No |
| Crear/editar catálogo maestro | Sí | Sí | Sí | Condicionado | No | No | No | No | No |
| Procesar OCR | Sí | Sí | Sí | Sí condicionado | No | No | No | Sí solo consulta | Sí solo sus documentos técnicos |
| Ver históricos económicos | Sí | Sí | Sí | Sí | Restringido | No | No | Sí | Restringido |
| Conciliar documento | Sí | Sí | No | Sí | No | No | No | Sí | No |
| Gestionar herramientas | Sí | Sí | No | Sí | Sí | Condicionado | Condicionado | No | No |

Antes de implementar debe decidirse si el rol `compras` existe formalmente o se sustituye por gerencia y administración.

### 8.1 RLS obligatoria

Además de ocultar elementos en React, las entidades deben aplicar RLS en el backend:

- `MaterialCatalog.create/update/delete` por política aprobada.
- `MaterialPrecioHistorico.read` solo a roles económicos y administrativos.
- `MovimientoMaterial.create/update` solo backend o roles autorizados.
- `RecepcionMaterial.create` solo compras, administración, jefatura o admin.
- `MaterialDocumentoOrigen.read` separado entre documentos comerciales y técnicos.
- `StockMaterial` de solo lectura salvo funciones controladas.

Las funciones backend deben volver a validar el usuario por servicio, no depender únicamente de `canAccess` o de RLS visual.

---

## 9. Integraciones entre módulos

### 9.1 Obras

Toda solicitud, pedido, recepción, consumo y factura debería admitir obra opcional o obligatoria según el tipo.

Dashboard por obra:

- Material solicitado.
- Material recibido.
- Consumo confirmado.
- Coste estimado.
- Coste real.
- Desviación.
- Pendientes de recepción.

### 9.2 Nota de gasto

`MaterialDocumentoOrigen.nota_gasto_id` ya proporciona el enlace explícito recomendado. Debe persistirse tanto desde el cliente como desde una función backend autorizada.

No se deben marcar notas como cubiertas por heurísticas de fecha e importe. El vínculo explícito debe ser la fuente de verdad.

### 9.3 Contabilidad

La conciliación contable debe mantener:

- Documento procesado.
- Pedido relacionado.
- Recepción relacionada.
- Estado contable.
- Usuario y fecha.
- Diferencias.
- Tareas de resolución.

El rol contabilidad no debe poder crear movimientos de stock ni editar documentos directamente.

### 9.4 Ingeniería

Los documentos técnicos deben seguir visibles en Documental mediante adapters, como `ingDocToManualShape` y `manualToIngDocShape`, sin duplicar contenido.

Las facturas, albaranes, presupuestos y pedidos no deben aparecer en el archivo técnico normal.

### 9.5 Offline

Los movimientos críticos no deben encolarse sin validación.

Antes de sincronizar:

- Validar entidad y acción.
- Validar ID de material.
- Validar cantidad positiva.
- Validar unidad compatible.
- Validar obra o ubicación.
- Evitar duplicados por `clientMutationId`.
- Mostrar el estado pendiente de sincronización.

El sistema actual usa cola offline y caché local. Se debe ampliar específicamente para solicitudes y movimientos, evitando que una operación pueda confirmar dos veces el mismo consumo.

---

## 10. Migración y compatibilidad

No se recomienda una sustitución total. El despliegue debe preservar las entidades existentes.

### 10.1 Fase de catálogo

1. Mantener `code` como campo legacy temporal.
2. Comenzar a rellenar `referencia` en nuevas altas.
3. Vincular materiales existentes a `Fabricante`.
4. Separar `unit_price` legacy de `precio_neto`.
5. Ejecutar una revisión de duplicados.

### 10.2 Fase de stock

1. Crear entidades `MovimientoMaterial` y `StockMaterial`.
2. Inicializar stock desde inventarios existentes o indicar stock inicial controlado.
3. No operar con stock implícito hasta validar el saldo inicial.
4. Registrar todos los movimientos futuros en la entidad nueva.

### 10.3 Fase comercial

1. Mantener `Order` y añadir estados/documentos relacionados.
2. Añadir `SolicitudMaterialLinea` si se decide usar solicitudes de varias líneas.
3. Vincular pedidos y recepciones con `MaterialDocumentoOrigen`.
4. Mantener `LineaFactura` como detalle.

### 10.4 Fase documental

1. Mantener tipos comerciales y técnicos.
2. Ampliar estados sin romper los existentes.
3. Mantener enlaces con notas de gasto.
4. Añadir conciliación y revisiones.

### 10.5 Herramientas

No mezclar herramientas con consumibles:

- mantén `/inventario` como herramientas;
- crea un módulo nuevo para stock;
- redirige o renombra solo cuando exista el módulo real para evitar rutas rotas.

---

## 11. Plan de implementación

### Fase 1: Fundaciones y seguridad — 1–2 semanas

- Consolidar permisos por rol.
- Añadir pruebas de rutas y RLS.
- Definir categorías y unidades normalizadas.
- Separar conceptos visuales de herramientas y materiales.
- Añadir `codigo_interno`, `referencia` y enlaces modernos al catálogo.

Entregables:

- Matriz de permisos aprobada.
- Documento de migración de entidades.
- Catálogo con fabricante y referencia visibles.
- Herramientas renombradas como activos.

### Fase 2: Solicitudes y aprobaciones — 1–2 semanas

- Ampliar `MaterialPendiente` o crear líneas.
- Crear vista de solicitudes.
- Añadir aprobaciones y rechazo.
- Vincular solicitudes a obras y usuarios.
- Integrar solicitudes con pedidos.

Entregables:

- Solicitud completa.
- Flujo de aprobación.
- Bandeja por obra y responsable.

### Fase 3: Compras y recepción — 2 semanas

- Mejorar `Order`.
- Crear `RecepcionMaterial`.
- Añadir líneas y diferencias.
- Vincular documentos comerciales.
- Crear informes parciales y retrasos.

Entregables:

- Pedido formal.
- Recepción parcial/completa.
- Conciliación básica pedido–recepción.

### Fase 4: Inventario físico — 2–3 semanas

- Crear `MovimientoMaterial`.
- Crear `StockMaterial` o vista calculada.
- Inicializar saldo.
- Bloquear stock negativo si se aprueba.
- Registrar consumo por obra.

Entregables:

- Kardex por material.
- Stock por almacén/obra.
- Alertas de mínimo.
- Ajustes auditables.

### Fase 5: OCR, documentos y precios — 1–2 semanas

- Añadir revisión de duplicados.
- Vincular documento con pedido y recepción.
- Mejorar conciliación de líneas.
- Cerrar estados de documento.
- Añadir histórico económico validado.

Entregables:

- OCR aprobado por humanos.
- Histórico trazable.
- Alertas de variación.
- Conciliación contable.

### Fase 6: Informes y automatización — 1 semana

- Dashboard por obra.
- Consumo previsto frente a real.
- Compras por proveedor.
- Precio medio y variación.
- Alertas y automatizaciones periódicas.

---

## 12. UX y requisitos móviles

- Crear solicitudes con pocos campos y selección de material accesible.
- Permitir escaneo desde cámara sin procesos largos.
- Mostrar antes de guardar el resumen de líneas extraídas.
- Usar unidades claras y evitar abreviaturas ambiguas.
- En móvil, mostrar estados como badges y permitir acciones principales sin abrir múltiples diálogos.
- Mantener recepción parcial práctica.
- Mostrar errores de OCR sin exponer detalles técnicos al usuario.
- Permitir modo offline solo para operaciones de borrador o cola validada.
- Aplicar confirmaciones para anulaciones y ajustes negativos.

---

## 13. Calidad y pruebas

### 13.1 Pruebas unitarias

- Normalización de referencia y fabricante.
- Cálculo de stock.
- Cálculo de coste neto.
- Variación de precio.
- Validación de movimientos.
- Prevención de duplicados.
- Validación de recepciones parciales.
- Validación de estados.

### 13.2 Pruebas de integración

- Solicitud -> aprobación -> pedido.
- Pedido -> recepción parcial -> stock.
- Documento OCR -> revisión -> conciliación -> histórico.
- Consumo por obra -> movimiento -> coste.
- Falla offline -> cola -> sincronización sin duplicado.
- Nota de gasto -> documento -> cobertura.

### 13.3 Pruebas por rol

- Admin.
- Gerencia.
- Compras.
- Administración.
- Jefe de obra.
- Técnico.
- Operario.
- Contabilidad.
- Ingeniero.
- Usuario demo.

Cada prueba debe validar tanto navegación como operaciones backend y RLS.

---

## 14. Métricas de éxito

- Porcentaje de materiales con referencia y fabricante: objetivo >=95%.
- Porcentaje de documentos vinculados a obra/pedido: >=90%.
- Porcentaje de movimientos con responsable y ubicación: 100%.
- Documentos OCR corregidos manualmente: tendencia decreciente.
- Tiempo medio solicitud -> aprobación.
- Tiempo medio pedido -> recepción.
- Porcentaje de recepciones parciales.
- Diferencias pedido–factura–recepción.
- Variación media de precios por proveedor.
- Coste real frente a presupuesto por obra.
- Stock negativo no autorizado: 0.
- Materiales sin movimiento ni ubicación: mínimo posible.

---

## 15. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Duplicación de materiales | Alto | Referencia normalizada, validación difusa y aprobación humana |
| Stock inicial incorrecto | Alto | Carga controlada, conciliación inicial y bloqueo de operaciones hasta validar |
| Precio legacy mostrado como actual | Alto | Ocultar `unit_price` legacy en vistas operativas y usar histórico |
| OCR inventa datos | Alto | Campos obligatorios, revisión manual y confianza por campo |
| Doble registro de recepción | Alto | ID único de recepción y movimientos compensatorios |
| Mezcla documentos comerciales/técnicos | Medio | Tipos separados y vistas adaptadas |
| Permisos inconsistentes | Alto | RLS + validación backend + pruebas por rol |
| Operaciones offline corruptas | Medio | Validación antes de encolar y antes de sincronizar |
| Migración de datos histórica | Medio | Compatibilidad temporal y script por fases |
| Crecimiento excesivo del catálogo | Medio | Activación, búsqueda, paginación y auditoría |

---

## 16. Criterios de aceptación

El reto se considera completado cuando:

1. Existe un catálogo maestro único con material, referencia, fabricante, categoría y unidad normalizada.
2. El stock se calcula desde movimientos y no mediante edición libre.
3. La solicitud puede contener varias líneas y vincularse a una obra.
4. Se pueden aprobar solicitudes y convertirlas en pedidos.
5. Las recepciones pueden ser parciales y generan entradas de stock.
6. Los documentos OCR pueden vincularse a pedido, recepción y nota de gasto.
7. Se conserva el archivo original y el dato normalizado.
8. Los precios históricos muestran proveedor, fecha, documento y estado.
9. Los consumos se atribuyen a obras y generan coste real.
10. Herramientas y activos permanecen separados de materiales consumibles.
11. Todos los roles tienen permisos consistentes en UI, rutas y backend.
12. El historial de cambios permite saber quién hizo cada operación.
13. Las operaciones offline críticas no se duplican ni pierden datos.
14. Los informes permiten localizar rápidamente desviaciones, pendientes y movimientos.

---

## 17. Archivos y componentes actuales relevantes

- `src/App.jsx`: rutas `/materials`, `/orders`, `/inventario`, `/manuales`, `/materiales-ocr`, `/material-pendiente`.
- `src/lib/hubs.js`: navegación de Documental y Económico.
- `src/pages/MaterialCatalog.jsx`: catálogo actual.
- `src/pages/MaterialesOcr.jsx`: centro OCR/documentos.
- `src/components/materiales/MaterialesOcrDialog.jsx`: flujo OCR.
- `src/components/materiales/LineasMaterialesEditor.jsx`: revisión de líneas.
- `src/lib/materialesOcrClient.js`: persistencia de documento, catálogo e histórico.
- `src/pages/Inventario.jsx`: herramientas y asignaciones.
- `src/pages/Manuales.jsx`: manuales y integración documental.
- `src/lib/documentosUnificados.js`: puente de documentos entre Ingeniería y Documental.
- `base44/entities/MaterialCatalog.jsonc`.
- `base44/entities/MaterialDocumentoOrigen.jsonc`.
- `base44/entities/MaterialPrecioHistorico.jsonc`.
- `base44/entities/MaterialPendiente.jsonc`.
- `base44/entities/ObraMaterial.jsonc`.
- `base44/entities/Fabricante.jsonc`.
- `base44/entities/Order.jsonc`.
- `base44/functions/procesarFacturaMateriales/entry.ts`.
- `base44/functions/guardarMaterialesOcr/entry.ts`.

---

## 18. Decisiones pendientes

Antes de implementar se debe confirmar:

1. ¿Compras tendrá un rol propio o compartirá permisos con administración?
2. ¿Jefatura de obra puede crear materiales maestros o solo solicitarlos?
3. ¿El stock se controla por almacén, obra o ambos desde el inicio?
4. ¿Se permite reservar materiales antes de recepción?
5. ¿Qué almacenes y ubicaciones corporativas existen?
6. ¿Las herramientas usan el mismo maestro de activos que los consumibles?
7. ¿Qué documentos deben conservarse y durante cuánto tiempo?
8. ¿Qué umbrales activan aprobación o alerta de precio?
9. ¿Las recepciones parciales requieren aprobación contable?
10. ¿Se migrará el stock histórico o se inicia con inventario físico controlado?

---

## 19. Recomendación final

La implementación recomendada es un modelo de **núcleo modular**, no una sustitución completa:

- Mantener catálogo, documentos, pedidos y proveedores.
- Introducir solicitudes estructuradas.
- Introducir recepciones y movimientos.
- Usar stock derivado y consumo por obra.
- Mantener herramientas como módulo separado.
- Usar OCR como ayuda de entrada, nunca como autoridad final.
- Centralizar permisos y trazabilidad en backend.
- Evolucionar el diseño por fases y validar contra datos reales.

La prioridad inmediata es resolver permisos, normalización de materiales y trazabilidad del stock. Estas decisiones son la base sobre la que deben construirse el OCR avanzado, los dashboards y las automatizaciones.
