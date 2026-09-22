# Análisis de brechas — Documento original ObraCheck vs. implementación A-F

**Fecha:** 2026-09-22
**Origen:** `PROMPTUNIFICADOOBRACHECKINTEGRADO.docx` (texto completo, 19.480 chars)
**Comparado con:** entidades `Obra`/`MaterialDocumentoOrigen`/`MaterialPrecioHistorico` extendidas (A-C) + 12 entidades nuevas (D, F) + 4 funciones OCR (E) + hub/permisos (G) ya creadas.

> Convención: 🔴 = brecha que rompe lógica central del documento (corregir antes de páginas/conciliación). 🟡 = campo/concepto ausente pero subsanable. 🟢 = cubierto o equivalente.

---

## 1. Proyecto → `Obra` (extensión A) 🟢 con 3 brechas 🟡

Cubierto: nombre→`name`, cliente→`client_id`, ubicacion→`address`, fecha_creacion→`created_date`, comprador→`cliente_contratante_id`, disciplina (mi añadido).

🟡 `numero_proyecto` — el original lo usa como identificador clave (`PR10978-25`, `PR11073-26`, `4210109/21217AA00`). `Obra.code` ("código/referencia interna") puede servir, pero no está declarado como equivalente. **Decidir:** reutilizar `code` o añadir `numero_proyecto` explícito.

🟡 `proveedor_instalador` — "SIMANTEC S.L." aparece en los 3 proyectos. La `Obra` no tiene este campo. **Añadir** `proveedor_instalador` (texto) — distinto del `client_id` (cliente final) y del `cliente_contratante_id` (comprador).

🟡 `estado` `en_revision` — los 3 proyectos semilla están `en_revision`. El enum de `Obra.status` es `activa|pausada|finalizada|presupuesto`; no incluye `en_revision`. El documento usa `en_curso|cerrado|en_revision`. **Añadir** un campo `estado_ingenieria` (`en_curso|en_revision|cerrado`) paralelo a `status` para no romper el flujo de Obras Civiles, o ampliar `status` con `en_revision`.

---

## 2. Documento → `MaterialDocumentoOrigen` (extensión C) 🟡 6 brechas

🟡 **Tipo `lista_material`** — el original enumera `listado_puntos, lista_material` como dos tipos distintos. Mi enum tiene `listado_puntos` pero **falta `lista_material`** (la "Lista de Material R717" del proyecto Carnes Félix es `lista_material`, no `listado_puntos`). **Añadir al enum.**

🟡 **Tipo `esquema_hidraulico`** — el original tiene `esquema_hidraulico` separado de `esquema_conexion` y `pid_proceso` (el esquema frigorífico R717 `21217AA00-DM01` con anotaciones manuscritas es hidráulico). **Falta en mi enum. Añadir.**

🟡 **`datos_extraidos` (JSON)** — el original guarda el JSON crudo de la extracción IA antes de partirlo en `ItemLista`/`PartidaPedido`. `MaterialDocumentoOrigen` no lo tiene. **Añadir** `datos_extraidos` (object) para no perder la extracción original y permitir re-procesamiento.

🟡 **Estado `error`** — `estado_procesado` original es `pendiente|procesado|error`. Mi `estado` es `pendiente_revision|procesado|descartado`. Falta `error` (extracción IA fallida). **Añadir `error` al enum** (distinto de `descartado`).

🟡 **Campos específicos de presupuesto** — el original declara en `Documento`: `numero_orden_compra_cliente`, `presupuestos_previos_referenciados` (texto), `valido_hasta`. El proyecto Carnes Félix los usa (`Y2061315`, `PRESUS 30+31`, `15/07/2026`). **Ninguno está en `MaterialDocumentoOrigen`. Añadir los 3** (opcionales, solo aplican a `tipo=presupuesto`).

🟡 **`revision` como concepto de primera clase** — el original diffa `ItemLista` **entre revisiones** (`R0`, `R3B`, `R2.0`, `R1`, `R717`). Mi `version_documento` guarda el código, pero la lógica de comparador de revisiones necesita poder agrupar ítems por revisión. **Confirmar** que `version_documento` se usa como clave de agrupación en la página "Listado de Ítems (comparador de revisiones)" o añadir un campo `revision` explícito + denormalizarlo en `ItemLista`.

---

## 3. ItemLista 🔴 5 brechas (la entidad más desalineada)

🟡→🔴 **`tag`** — el original usa `tag` como clave de diff entre revisiones (`AHU01_R3Dmp1Cmd`, `AHU01_R3Dmp2Cmd`). Mi `punto_id` es equivalente pero el nombre y el rol de "join key para diff" no está explicitado. **Renombrar/aclarar** que `punto_id` ES el tag de diff, o añadir `tag`.

🔴 **`dominio`** (`control_bms|material_electrico_proceso|componente_mecanico`) — **AUSENTE**. El documento dice explícitamente que `ItemLista` "unifica punto de control y componente de proceso" y el `dominio` los distingue. Es la clasificación que separa BMS (Cuenca/CIBA) de refrigeración industrial (Carnes Félix). Sin este campo, la app no puede filtrar/separar los dos universos. **Añadir `dominio` enum.**

🔴 **`tipo_señal`** (`EAP|EAA|ED|EC|SAP|SA3|SD|INT`) — **AUSENTE**. Es la columna central de los listados BMS (los datos semilla: `EA=31, ED=51, SA=16, SD=25, INT=83`). El "comparador de revisiones" se desglose "por tipo de señal". Sin este campo, la página 3 no funciona. **Añadir `tipo_señal`** (enum, solo aplica a `dominio=control_bms`).

🟡 **`superficie_zona_m2`** — **AUSENTE**. El caso CIBA gira en torno a "Sala Estabulario 26.60m²" con doble compuerta por superficie. **Añadir** (opcional).

🟡 **`periferico`, `cableado`, `modulo_fisico`** — **AUSENTES**. El original los lista como campos de `ItemLista` (extracción de listados tipo Consistrol/Schneider/Siemens). **Añadir los 3** (texto, opcionales).

🟡 **`revision`** (denormalizada) — para el diff entre revisiones sin tener que joins. **Añadir** `revision` (texto) denormalizada del documento origen.

> Mis añadidos (`referencia_equipo`, `material_id`, `fabricante_id/name`, `cantidad`, `unidad`) NO están en el original. `cantidad`/`unidad` son razonables (el recuento de items), pero `referencia_equipo`/`material_id` solapan con `tag` — revisar si duplican.

---

## 4. PartidaPedido 🟡 3 brechas

🟡 **`capitulo`** — **AUSENTE**. Los datos semilla usan `capitulo="01.04"`, `capitulo="01.05"`. **Añadir** `capitulo` (texto).

🟡 **`zona_obra`** — **AUSENTE**. Carnes Félix organiza 35 líneas en 3 `zona_obra` ("Sala de Máquinas", "Sala de Despiece - Baja/Alta"). Es el agrupador visual de la página. **Añadir** `zona_obra` (texto).

🟡 **`precio_unitario_implicito`** — **AUSENTE (calculado)**. El original lo define: `total / cantidad_real` cuando la partida es bulto (`cantidad=1`). La conciliación lo compara contra `TarifaReferencia` (3218.50€/41 puntos = 78.50€/punto en CIBA). Mi `es_tanto_alzado` flag está, pero falta el campo calculado. **Añadir** `precio_unitario_implicito` (number, calculado por backend).

> `posicion` del original (`L1`-`L35`) ≈ mi `partida_id`. Cubierto 🟢.

---

## 5. TarifaReferencia → `MaterialPrecioHistorico` (fusión B) 🔴 1 brecha crítica de modelo

🔴 **`unidad` (`por_punto|por_metro|por_unidad`)** — **AUSENTE**. Es **el** campo que distingue 78.50€/punto de 6.58€/m. `MaterialPrecioHistorico` no tiene ningún campo `unidad` de tarifa (su `precio_neto` es por unidad de material de catálogo, no por punto/metro de obra). **Añadir** `unidad_tarifa` (`por_punto|por_metro|por_unidad`) — distinto de la unidad de material.

🔴 **Semántica de `referencia`** — `TarifaReferencia.referencia` en el original es un código de **partida/concepto de obra** (`INSTAL_ELEC_01`), NO una referencia de catálogo de material. `MaterialPrecioHistorico.material_referencia` apunta a `MaterialCatalog.referencia` (producto). **La fusión B mezcla "tarifa de concepto de obra" con "precio de material de catálogo"**. Consecuencia: `INSTAL_ELEC_01` (instalación eléctrica por punto) no existe en `MaterialCatalog`. **Decidir:** (a) permitir `MaterialPrecioHistorico` sin `material_id` (referencia libre = concepto de obra) — relajar el `required`, o (b) crear `MaterialCatalog` entries para conceptos de obra, o (c) reconsiderar la fusión B y mantener `TarifaReferencia` como entidad propia. **Recomendación: (a)** + añadir `referencia_concepto` (texto, el `INSTAL_ELEC_01`) independiente de `material_id`.

---

## 6. LineaFactura 🟢

Todos los campos del original cubiertos + añadidos razonables (`partida_pedido_id`, `importe_neto`, `confianza`). 🟢

---

## 7. BaseDePrecio 🔴 4 brechas (la entidad más rota)

🔴 **`partida_pedido_id`** — **AUSENTE**. El original vincula `BaseDePrecio` a una `PartidaPedido` (precio base por partida). Mi modelo la vincula a `material_id` (precio base por material de catálogo). **Semántica distinta.** Cambiar la FK a `partida_pedido_id`.

🔴 **`tipo_medicion`** (`por_punto|por_metro_lineal|por_unidad`) — **AUSENTE**. Determina qué regla de conciliación aplica (recuento de puntos vs. distancia vs. unidades). **Añadir** (enum).

🔴 **`distancia_minima_asumida_m` + `distancia_maxima_asumida_m`** — **AUSENTES**. Son el núcleo de la regla "riesgo_precio_distancia": si la distancia real supera `distancia_maxima_asumida_m` → sobrecoste. Sin estos rangos, la regla 5 no existe. **Añadir los 2** (number).

🔴 **`clausula_revision`** (texto o "sin cláusula") — **AUSENTE**. CIBA tiene "sin cláusula de revisión de distancia"; si hay cláusula, el sobrecoste de distancia se reclama; si no, solo es alerta. **Añadir** `clausula_revision` (texto, default "sin cláusula").

🟡 `fuente` — el original indica la fuente del precio base. Mi `tipo_base` enum lo cubre parcialmente. 🟢 aceptable.

> Mi `precio_base_neto` ≈ `precio_unitario_pactado` 🟢. Mi `material_id`/`material_referencia` **deben quitarse** (no corresponde a este modelo).

---

## 8. PlanoPlanta → `PlanoCalibracion` 🔴 modelo de calibración divergente

🔴 **Modelo de calibración distinto** — el original calibra con: `punto_calibracion_1 {x,y}` + `punto_calibracion_2 {x,y}` en **px** + `distancia_real_calibracion_m` (una sola distancia real conocida entre los 2 puntos) → `escala_px_por_metro`. Mi modelo guarda `punto_ref_1_metros {x,y}` + `punto_ref_2_metros {x,y}` (coordenadas absolutas en metros). **El original no usa coords absolutas; usa una distancia conocida.** Más simple y足够. **Ajustar:** reemplazar `punto_ref_1_metros`/`punto_ref_2_metros` por `distancia_real_calibracion_m` (number).

🟡 **`nombre_planta`** — **AUSENTE**. **Añadir.**

🟡 **`metodo_calibracion`** (`cota_conocida|circuito_potencia_ya_medido`) — **AUSENTE**. El original prioriza "reutilizar circuitos ya medidos (potencia/tubería) como referencia de calibración cuando no hay cota explícita". **Añadir** (enum).

---

## 9. UbicacionEquipo 🟡 2 brechas

🟡 **`tipo` enum** (`cuadro_control|caldera|bomba|enfriadora|sonda|valvula|climatizador|compresor|condensador|otro`) — **AUSENTE**. La IA sugiere ubicaciones por tipo ("cuadro, calderas, bombas, compresores, condensadores"). Mi `equipo_referencia` es texto libre. **Añadir** `tipo` enum.

🟡 **`fuente`** (`extraccion_ia|marcado_manual`) — **AUSENTE**. Distinto de `marcado_por` (quién). Indica si la ubicación la propuso la IA o la marcó el ingeniero. **Añadir** `fuente` enum.

> Mis añadidos `x_metros/y_metros` (derivados), `rotacion_grados`, `ficha_tecnica_id` son razonables. 🟢

---

## 10. TrazadoEstimado 🔴 modelo divergente

🔴 **Paradigma origen→destino** — el original traza entre **dos `UbicacionEquipo`**: `ubicacion_origen_id` + `ubicacion_destino_id` + `distancia_linea_recta_m` × `factor_trazado` = `distancia_estimada_m`. Mi modelo usa una polilínea libre (`puntos_px` array). **Distinto.** La conciliación compara `distancia_estimada_m` contra `BaseDePrecio.distancia_maxima_asumida_m`; la polilínea no encaja en esa regla. **Ajustar** a origen→destino + `distancia_linea_recta_m` + `factor_trazado` + `distancia_estimada_m`.

🔴 **`factor_trazado`** (default 1.3, editable, **difiere cableado eléctrico vs. tubería**) — **AUSENTE**. Es una nota de diseño explícita del original. **Añadir** `factor_trazado` (number, default 1.3).

🟡 **`tag_circuito_asociado`** — **AUSENTE**. **Añadir.**

> Mi `tipo_trazado` (canal/tuberia/cable/...) puede usarse para setear el `factor_trazado` por defecto. Mantener.

---

## 11. MedicionReal 🟡 2 brechas

🟡 **`fuente`** (`plano_planta_estimado|medicion_campo|esquema_electrico_unifilar|estimacion_manual`) — **AUSENTE**. Mi `metodo` (`cinta|laser|plano_asbuilt|otro`) es distinto. El original enfatiza "toda cifra debe mostrar su fuente" — la fuente determina el nivel de confianza. **Reemplazar** `metodo` por `fuente` con el enum original (o mantener ambos: `fuente` para confianza, `metodo` para detalle).

🟡 **`tag_o_circuito`** — **AUSENTE**. La medición se asocia a un tag/circuito, no solo a un `trazado_estimado_id`. **Añadir** `tag_o_circuito` (texto).

🟡 `documento_origen_id` — **AUSENTE**. **Añadir.**

---

## 12. AnalisisCoste 🔴 modelo divergente (per-partida vs. per-proyecto)

🔴 **Granularidad** — el original es **per `PartidaPedido`** (`partida_pedido_id`, `cantidad_contratada`, `cantidad_real_ultima_revision`, `coste_contratado`, `coste_recalculado_con_cantidad_real`, `desviacion`, `estado_riesgo`, `puntos_sin_medicion`, `fuente_principal_dato`). Mi modelo es **per proyecto** (agregado: `coste_presupuestado/pedido/facturado/certificado`). **Distinto.** El "Análisis de Coste y Riesgo" del original es por partida (la página muestra cada partida con su coste contratado vs. recalculado). **Reestructurar** a per-partida, o **mantener ambos niveles**: un `AnalisisCoste` por proyecto (agregado, mi modelo) + un `AnalisisCostePartida` por partida (el original). **Recomendación: nivel partida** (el proyecto se agrega en UI).

🔴 **`estado_riesgo`** enum original: `sin_datos|dentro_de_rango|fuera_de_rango_revisar|sobrecoste_confirmado|infrafacturado_confirmado`. Mi `riesgo_nivel` (`verde|amarillo|rojo`) pierde `infrafacturado_confirmado` (sub-facturación, un caso real). **Alinear** el enum al original.

🟡 **`puntos_sin_medicion`**, **`fuente_principal_dato`** — **AUSENTES**. **Añadir.**

---

## 13. FichaTecnicaEquipo 🔴 extracción no type-aware

🔴 **OCR `procesarFichaTecnicaEquipo` es motor-céntrico** — mi prompt/schema devuelve un schema fijo (`potencia_kw`, `tension_v`, `intensidad_nominal_a`, `rpm`, `factor_potencia`, `rendimiento_pct`, `ip_proteccion`...). El original exige **specs según tipo**: motor (potencia/tensión/corriente), **bomba** (caudal_m3h, altura_m, potencia), **condensador/intercambiador** (refrigerante, presion_bar, capacidad). Los datos semilla de Carnes Félix tienen bombas (`caudal_m3h:8.1, altura_m:23.99`) y condensadores (`refrigerante:"R717", presion_bar:28, num_ventiladores:12`) que **mi OCR no extrae**. **Corregir el prompt + schema** a type-aware: detectar tipo y devolver `especificacion_clave` (JSON libre) con las claves variables según tipo. Mi `datos_placa` → renombrar a `especificacion_clave` + liberar el schema.

🟡 **`equipo_asociado` (texto)** — el original enlaza motor↔variador con texto libre ("variador FC102 315kW"). Mi `motor_ficha_id`/`variador_ficha_id` (FK) es más estricto. **Mantener las FK** + añadir `equipo_asociado` (texto) como denominación legible. Aceptable.

---

## 14. Certificacion 🟡 1 brecha

🟡 **`documento_id` (→ Documento tipo presupuesto)** — **AUSENTE**. La certificación se vincula al presupuesto del que certifica partidas. **Añadir** `documento_origen_id` (FK al presupuesto).

🟡 **% por línea** — el original admite `partidas_certificadas` como "JSON con % por línea". Mi array `{partida_pedido_id, cantidad_certificada, importe_certificado}` es más estructurado pero sin %. **Añadir** `porcentaje_certificado` (number) por partida. Aceptable.

---

## 15. Discrepancia 🔴 enum de tipos incompleto + 2 campos

🔴 **`tipo` enum** — el original tiene **12 valores**; mi enum tiene **8** distintos. Faltan:
- `punto_añadido` (diff revisiones)
- `punto_eliminado` (diff revisiones)
- `cantidad_puntos_pedido_vs_listado` (bulto vs recuento — los datos CIBA)
- `precio_no_coincide` (factura vs pedido, distinto de "entre proyectos")
- `material_no_facturado` (en pedido, no en factura)
- `material_no_especificado` (en factura, no en pedido/listado)
- `riesgo_precio_distancia` (sobrecoste por distancia)
- `distancia_plano_vs_pedido` (distancia plano vs pedido)
- `diseño_pendiente` (anotaciones manuscritas — **clave, regla 7**)
- `especificacion_tecnica_inconsistente` (motor↔variador)

Mi enum (`precio_fuera_tarifa`, `cantidad_distinta`, `spec_tecnica_incompatible`, `tanto_alzado_sin_desglose`, `ficha_motor_variador_incompatible`, `trazado_vs_medicion`, `certificacion_excede_pedido`, `documento_sin_origen`) **no coincide** con el original. **Reemplazar el enum por los 12 valores del original** para que las 8 reglas de conciliación produzcan los tipos correctos.

🟡 **`tag_afectado`** — **AUSENTE**. Los datos semilla lo usan (`tag_afectado="AHU01_R3Dmp1Cmd, AHU01_R3Dmp2Cmd"`, `tag_afectado="L1"`). **Añadir** (texto, multi-tag).

🟡 **`documentos_implicados`** — **AUSENTE**. **Añadir** (array de IDs o texto).

🟡 **`estado` `descartada`** — original `abierta|revisada|resuelta|descartada`. Mi enum `abierta|en_revision|resuelta|falsa_alarma`. `falsa_alarma` ≈ `descartada` pero `revisada` (en revisión humana) no es lo mismo que `en_revision`. **Alinear** al original.

🟡 **`importe_no_facturado`** — aparece en el dato semilla CIBA (157.00€) aunque no está en la lista de campos del modelo. **Añadir** `importe_no_facturado` (number, opcional) — útil para priorizar severidad.

---

## 16. Extracción IA (E) — 2 funciones ausentes

🔴 **`procesarPlanoPlanta`** — **AUSENTE**. El original exige: "proponer `UbicacionEquipo` candidatas por simbología reconocible y superficies rotuladas; **nunca extraer escala automáticamente sin calibración explícita**". Es la función que alimenta la página "Marcado de Equipos". **Crear** una 5ª función OCR `procesarPlanoPlanta` con prompt type-aware (detectar cuadros/calderas/bombas/compresores/condensadores por simbología + superficies rotuladas, sin escala).

🟡 **Presupuesto** — mi `procesarListadoPuntos` no extrae los campos de presupuesto (`numero_orden_compra_cliente`, `presupuestos_previos_referenciados`, `valido_hasta`, cláusulas de distancia estimada). **Ampliar** el prompt de `procesarListadoPuntos` (o función dedicada `procesarPresupuestoIngenieria`) para detectar esos campos cuando `tipo=presupuesto`.

---

## 17. Conciliación backend (regla 8: superseded) 🔴

🔴 **Estado `superseded`** — la regla 8 del original: "Cuando un presupuesto referencia presupuestos previos, marcar esos documentos anteriores como estado `superseded`". Ni `MaterialDocumentoOrigen.estado` (`pendiente_revision|procesado|descartado|error`) ni ninguna otra marca lo contempla. **Añadir `superseded` al enum de `MaterialDocumentoOrigen.estado`** (un presupuesto reemplazado por uno más reciente que lo referencia).

---

## 18. Datos semilla 🔴

🔴 **No hay seeding** — el original da datos semilla detallados de 3 proyectos (Parador de Cuenca, CIBA Zaragoza, Carnes Félix Valencia) con partidas, ítems, fichas técnicas y 6 discrepancias. Mi propuesta no incluyó creación de datos semilla. **Planificar** el seeding tras implementar las correcciones de modelo (los datos semilla ejercitan exactamente los campos que faltan: `tipo_señal`, `dominio`, `zona_obra`, `capitulo`, `equipo_asociado`, `tag_afectado`, `diseño_pendiente`).

---

## 19. Roles 🟢

El original dice "Ingeniero (rol único inicial)". El prompt de trabajo del usuario ya amplió a `gerencia` + `ingeniero` (dos roles). **Cubierto** por la implementación G. 🟢

---

## 20. Notas de diseño 🟢

Las 5 salvaguardas (fuente/confianza de cada cifra, tanto alzado no conciliado por total, factor_trazado heurístico, anotación manuscrita no auto-interpretada, semáforo verde/ámbar/rojo) están recogidas en mi propuesta F. 🟢 — **pero** la implementación de entidades aún no materializa algunas (p.ej. el campo `fuente` en `MedicionReal`, `factor_trazado` en `TrazadoEstimado`), así que la salvaguarda "fuente y confianza de cada cifra" no es persistible todavía.

---

## Resumen de severidad

| Severidad | Cuenta | Acción |
|---|---|---|
| 🔴 Crítico (rompe lógica central) | **11** | Corregir el modelo de datos antes de construir páginas/conciliación |
| 🟡 Moderado (campo ausente) | **~22** | Añadir en la misma corrección |
| 🟢 Cubierto | — | — |

### 🔴 Críticos a corregir (lista de acción)
1. `ItemLista.dominio` + `tipo_señal`
2. `MaterialDocumentoOrigen` enum `tipo`: añadir `lista_material` + `esquema_hidraulico`; `estado`: añadir `error` + `superseded`; `datos_extraidos`; campos presupuesto
3. `MaterialPrecioHistorico.unidad_tarifa` + semántica `referencia_concepto` (relajar `material_id` required)
4. `BaseDePrecio`: reFK a `partida_pedido_id` + `tipo_medicion` + `distancia_min/max_asumida_m` + `clausula_revision`
5. `PlanoCalibracion`: modelo a `distancia_real_calibracion_m` + `metodo_calibracion`
6. `TrazadoEstimado`: paradigma origen→destino + `factor_trazado` + `distancia_estimada_m`
7. `AnalisisCoste`: reestructurar a nivel partida + enum `estado_riesgo` original
8. `FichaTecnicaEquipo`: OCR type-aware (`especificacion_clave` libre)
9. `Discrepancia.tipo`: reemplazar enum por los 12 originales + `tag_afectado` + `documentos_implicados` + estado `descartada`
10. `procesarPlanoPlanta`: nueva función OCR
11. Seeding de los 3 proyectos

**Recomendación:** aplicar estas 11 correcciones al modelo de datos + prompts antes de iniciar la fase de páginas (H) y conciliación backend, para no construir UI sobre un modelo que luego hay que migrar.