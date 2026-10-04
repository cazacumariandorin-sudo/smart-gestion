# 📋 ANÁLISIS EXHAUSTIVO: Módulo de Ingeniería - Smart Gestión

**Documento:** Propuesta de Arquitectura y Optimización del Módulo de Ingeniería  
**Fecha:** 2026-09-11  
**Estado:** Análisis Preliminar (Basado en Requerimiento del Usuario)  
**Objetivo:** Automatización de creación de proyectos, análisis de documentos y organización

---

## 🎯 CONTEXTO Y REQUISITO DEL USUARIO

### Propósito del Módulo de Ingeniería
El módulo está diseñado para **ayudar con los proyectos de la empresa (obras)** mediante:

1. **Carga de documentos** → Creación automática del proyecto correspondiente
2. **Análisis automático** de la documentación cargada
3. **Organización por proyecto (obra)** de los documentos analizados
4. **Uso automático de herramientas** disponibles en el módulo
5. **Revisión manual** opcional por Gerencia si lo considera oportuno

### Flujo Ideal Deseado

```
Técnico/Usuario carga documentos (Planos, PDFs, imágenes)
        ↓
[AUTOMÁTICO] Detectar proyecto/obra de referencia en documento
        ↓
[AUTOMÁTICO] Crear proyecto (Obra) si no existe
        ↓
[AUTOMÁTICO] Clasificar y organizar documentos por proyecto
        ↓
[AUTOMÁTICO] Ejecutar herramientas de análisis (OCR, IA, extracción de datos)
        ↓
Documentación procesada, indexada y disponible
        ↓
[OPCIONAL] Gerencia revisa resultados y puede re-analizar manualmente
```

---

## 1. DIAGNÓSTICO: Estado Actual del Módulo (Inferido)

Basándome en la estructura típica de un sistema de gestión de obras + documentos:

### Componentes Probables Existentes

#### A. Entidades Base44 Existentes
- **Obra** (Proyecto, con nombre, ubicación, presupuesto, estado)
- **Documento** (archivo adjunto, tipo, estado)
- **Usuario** (técnico, gerencia, admin)

#### B. Funcionalidades Actuales (Probable Estado)
- ✅ Crear obra manualmente
- ✅ Subir documentos a una obra existente
- ✅ Ver listado de documentos por obra
- ✅ Búsqueda básica de documentos
- ❌ **NO:** Crear obra automáticamente al detectar documento
- ❌ **NO:** Análisis automático de documento cargado (OCR, extracción de datos)
- ❌ **NO:** Auto-clasificación de documento a obra existente
- ❌ **NO:** Indexación inteligente de contenido

---

## 2. PROPUESTA TÉCNICA: Sistema de Auto-Detección y Creación de Proyectos

### 2.1 Flujo de Carga de Documento con Auto-Creación de Proyecto

```
┌─────────────────────────────────────────────────────────────────┐
│ FASE 1: DETECCIÓN DE PROYECTO (Análisis del documento)         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Usuario sube: "Plano_Proyecto_Los_Rosales_2026.pdf"            │
│                                                                   │
│ 1. EXTRACCIÓN DE METADATOS:                                     │
│    ├─ Nombre archivo: "Proyecto_Los_Rosales_2026"              │
│    ├─ OCR/IA: Detecta "Proyecto Los Rosales" en contenido      │
│    ├─ Fecha documento: 2026-09-01                              │
│    └─ Tipo de documento: Plano (PDF)                           │
│                                                                   │
│ 2. BÚSQUEDA DE PROYECTO EXISTENTE:                             │
│    ├─ Buscar en BD: Obra con nombre similar "Los Rosales"     │
│    └─ Similitud > 85%? → Usar proyecto existente              │
│       Similitud < 85%? → Crear nuevo proyecto                 │
│                                                                   │
│ 3. CREACIÓN AUTOMÁTICA (si es necesario):                      │
│    ├─ Generar ID_Obra: PRY-2026-0047                          │
│    ├─ Nombre: "Proyecto Los Rosales"                          │
│    ├─ Estado: "análisis_inicial" (documentos sin revisar)      │
│    ├─ Ubicación: Extraída del documento (si existe)            │
│    ├─ Descripción: "Proyecto auto-detectado"                  │
│    └─ Fecha creación: now()                                    │
│                                                                   │
│ 4. MARCAR DOCUMENTO PENDIENTE DE ANÁLISIS:                     │
│    ├─ documento.obra_id = PRY-2026-0047                       │
│    ├─ documento.estado = "pendiente_análisis"                 │
│    └─ documento.análisis_automático = { ... resultados IA ... }│
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FASE 2: ANÁLISIS AUTOMÁTICO (OCR + IA + Extracción)           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ [Función Backend Asincrónica]                                   │
│ analizarDocumentoIngenieria(documento_id)                       │
│                                                                   │
│ PASO 1: OCR (Extracción de texto)                              │
│    ├─ googleVisionAPI.documentAI() → Extrae texto/tablas      │
│    └─ Confianza: 92% → Texto OCR guardado                     │
│                                                                   │
│ PASO 2: IA - Extracción de Entidades                           │
│    ├─ Detecta: "Presupuesto: $500.000"                        │
│    ├─ Detecta: "Superficie: 2.500 m²"                         │
│    ├─ Detecta: "Plazo: 12 meses"                              │
│    ├─ Detecta: "Responsable: Ing. Juan García"                │
│    └─ Confianza por campo: { presupuesto: 0.95, plazo: 0.78 }│
│                                                                   │
│ PASO 3: Clasificación de Tipo                                  │
│    ├─ Tipo detectado: "Plano Arquitectónico"                  │
│    ├─ Categoría: "Proyecto / Diseño"                          │
│    └─ Confianza: 0.88                                         │
│                                                                   │
│ PASO 4: Índice de Búsqueda (Indexar para búsqueda rápida)     │
│    ├─ Palabras clave: [proyecto, rosales, plano, 2026, ...]  │
│    ├─ Texto completo indexado en ElasticSearch                │
│    └─ Metadata: { fecha, tipo, confianza, ... }               │
│                                                                   │
│ PASO 5: Guardar Resultados de Análisis                         │
│    ├─ documento.análisis_automático = {                       │
│    │    ocr_texto: "...",                                     │
│    │    entidades_detectadas: { ... },                        │
│    │    tipo_documento: "plano",                              │
│    │    confianza_general: 0.87,                              │
│    │    fecha_análisis: now(),                                │
│    │    modelo_ia: "gemini_vision_3.0"                        │
│    │  }                                                         │
│    └─ documento.estado = "analizado"                          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ FASE 3: ORGANIZACIÓN Y PRESENTACIÓN                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Gerencia ve en /ingenieria:                                     │
│                                                                   │
│ [Proyecto: Los Rosales]                                         │
│ Estado: ⚠️ Análisis Inicial (1 doc sin revisar)               │
│                                                                   │
│ Documentos:                                                      │
│ ├─ Plano_Los_Rosales_2026.pdf [ANALIZADO - 87% confianza]     │
│ │   └─ Entidades detectadas: Presupuesto: $500K, Área: 2.5K m²│
│ │                                                               │
│ │   Acciones:                                                  │
│ │   [👁️ Revisar Análisis] [🔄 Re-analizar] [✓ Confirmar] [✗ Rechazar]│
│ │                                                               │
│ └─ (sin más documentos)                                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. ENTIDADES Y ESTRUCTURA DE DATOS

### 3.1 Entidad `Obra` (Extendida)

```jsonc
{
  "name": "Obra",
  "type": "object",
  "properties": {
    // Campos existentes
    "id": "string",
    "nombre": "string",
    "ubicacion": "string",
    "descripcion": "string",
    "presupuesto": "number",
    "cliente_id": "string",
    
    // Nuevos campos para auto-creación
    "estado": {
      "type": "string",
      "enum": ["análisis_inicial", "documentación_completa", "en_ejecución", "finalizada"],
      "description": "Estado del proyecto (análisis_inicial = auto-creado, documentos sin revisar)"
    },
    "auto_creado": {
      "type": "boolean",
      "default": false,
      "description": "True si fue creado automáticamente al detectar documento"
    },
    "fecha_auto_creación": {
      "type": "date-time",
      "description": "Fecha/hora en que se auto-creó el proyecto"
    },
    "documento_disparador_id": {
      "type": "string",
      "description": "ID del documento que disparó la auto-creación"
    },
    "confianza_auto_detección": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Confianza de la IA al detectar el proyecto (0-1)"
    },
    "análisis_automático_pendiente": {
      "type": "boolean",
      "default": false,
      "description": "True si hay documentos sin analizar en este proyecto"
    },
    "fecha_última_revisión_gerencia": {
      "type": "date-time",
      "description": "Última vez que Gerencia revisó los análisis automáticos"
    }
  }
}
```

### 3.2 Entidad `DocumentoIngenieria` (Nueva)

```jsonc
{
  "name": "DocumentoIngenieria",
  "type": "object",
  "properties": {
    "id": "string",
    "obra_id": "string",
    "nombre": "string",
    "tipo": {
      "type": "string",
      "enum": ["plano", "especificación", "presupuesto", "cronograma", "informe", "contrato", "otro"],
      "description": "Tipo de documento (detectado automáticamente)"
    },
    "archivo_url": "string",
    "fecha_carga": "date-time",
    "cargado_por": "string",
    
    // Análisis automático
    "estado_análisis": {
      "type": "string",
      "enum": ["pendiente", "procesando", "completado", "error"],
      "default": "pendiente"
    },
    
    "análisis_automático": {
      "type": "object",
      "properties": {
        "ocr_texto_completo": "string",
        "ocr_confianza": "number",
        "ocr_modelo_usado": "string",
        
        "tipo_detectado": {
          "type": "string",
          "description": "Tipo de documento detectado por IA"
        },
        "tipo_confianza": "number",
        
        "entidades_detectadas": {
          "type": "object",
          "description": "Datos extraídos: presupuesto, área, plazo, responsable, etc.",
          "properties": {
            "presupuesto": { "value": "string", "confianza": "number" },
            "area_m2": { "value": "string", "confianza": "number" },
            "plazo_meses": { "value": "string", "confianza": "number" },
            "responsable": { "value": "string", "confianza": "number" },
            "fecha_inicio": { "value": "string", "confianza": "number" },
            "fecha_fin": { "value": "string", "confianza": "number" }
          }
        },
        
        "palabras_clave": ["array", "de", "palabras"],
        "resumen": "string",
        
        "fecha_análisis": "date-time",
        "modelo_ia_usado": "string",
        "versión_análisis": "string"
      }
    },
    
    // Estado de revisión manual
    "revisado_por_gerencia": "boolean",
    "fecha_revisión_gerencia": "date-time",
    "revisado_por": "string",
    "notas_revisión": "string",
    "análisis_confirmado": "boolean",
    "cambios_manuales": "object",
    
    // Búsqueda
    "indice_búsqueda": {
      "type": "array",
      "description": "Palabras clave para búsqueda full-text"
    }
  }
}
```

---

## 4. FUNCIONES BACKEND: Automatización de Flujo

### 4.1 Función: `detectarYCrearProyectoAutomatico`

**Propósito:** Detectar proyecto en documento cargado; crear si no existe

**Trigger:** Cuando un usuario sube archivo a módulo ingeniería

**Entrada:**
```json
{
  "archivo": {
    "nombre": "Plano_Los_Rosales.pdf",
    "tipo_mime": "application/pdf",
    "tamaño_bytes": 2500000
  },
  "usuario_id": "usr-123",
  "timestamp": "2026-09-11T14:30:00Z"
}
```

**Proceso:**

```typescript
async function detectarYCrearProyectoAutomatico(req) {
  const { archivo, usuario_id } = await req.json();
  const sr = base44.asServiceRole;
  
  // PASO 1: Extraer nombre y metadata del archivo
  const nombreBase = archivo.nombre.replace(/\.[^/.]+$/, "");
  const textoMentosEspacios = nombreBase.toLowerCase().replace(/[_-]/g, " ");
  
  // PASO 2: Invocar IA para detectar nombre del proyecto
  const promptDetección = `
    Dado el nombre de archivo: "${nombreBase}"
    Detecta el nombre del proyecto/obra mencionado.
    Responde SOLO el nombre del proyecto sin explicación adicional.
  `;
  
  const respuestaIA = await invocarLLM(promptDetección, { model: "gemini_3_flash" });
  const nombreProyectoDetectado = respuestaIA.texto.trim();
  const confianzaDetección = respuestaIA.confianza; // 0-1
  
  // PASO 3: Buscar proyecto existente por similitud
  const proyectosExistentes = await sr.entities.Obra.filter(
    { nombre: { $regex: nombreProyectoDetectado, $options: "i" } },
    undefined,
    100
  );
  
  let proyectoUsado = null;
  const similitudMínima = 0.85;
  
  for (const proyecto of proyectosExistentes) {
    const similitud = calcularSimilitudTexto(nombreProyectoDetectado, proyecto.nombre);
    if (similitud >= similitudMínima) {
      proyectoUsado = proyecto;
      break;
    }
  }
  
  // PASO 4: Si no existe proyecto similar, crear uno
  if (!proyectoUsado) {
    proyectoUsado = await sr.entities.Obra.create({
      nombre: nombreProyectoDetectado,
      estado: "análisis_inicial",
      auto_creado: true,
      fecha_auto_creación: new Date().toISOString(),
      confianza_auto_detección: confianzaDetección,
      descripción: `Proyecto auto-detectado de documento: ${archivo.nombre}`,
      ubicación: null, // Se extraerá del contenido después
    });
    
    console.log(`[AUTO-CREAR] Obra creada: ${proyectoUsado.id} "${proyectoUsado.nombre}"`);
  } else {
    console.log(`[EXISTENTE] Obra encontrada: ${proyectoUsado.id} "${proyectoUsado.nombre}"`);
  }
  
  // PASO 5: Crear registro de documento (estado: pendiente_análisis)
  const documento = await sr.entities.DocumentoIngenieria.create({
    obra_id: proyectoUsado.id,
    nombre: archivo.nombre,
    tipo: null, // Se detectará en análisis automático
    archivo_url: url, // URL del archivo almacenado
    fecha_carga: new Date().toISOString(),
    cargado_por: usuario_id,
    estado_análisis: "pendiente",
    análisis_automático: null,
    revisado_por_gerencia: false,
  });
  
  // PASO 6: Desencadenar análisis automático (asincrónico)
  // No esperar respuesta, solo iniciar
  triggerAnalysisBackground(documento.id);
  
  return {
    ok: true,
    obra: {
      id: proyectoUsado.id,
      nombre: proyectoUsado.nombre,
      auto_creada: proyectoUsado.auto_creado,
    },
    documento: {
      id: documento.id,
      estado: documento.estado_análisis,
      análisis_en_progreso: true,
    },
  };
}

function calcularSimilitudTexto(a, b) {
  // Algoritmo de similitud (ej. Levenshtein, cosine, etc.)
  const aTokens = a.toLowerCase().split(/\s+/);
  const bTokens = b.toLowerCase().split(/\s+/);
  
  const intersección = aTokens.filter(t => bTokens.includes(t)).length;
  const unión = new Set([...aTokens, ...bTokens]).size;
  
  return unión === 0 ? 0 : intersección / unión; // Similitud Jaccard
}
```

---

### 4.2 Función: `analizarDocumentoIngenieria`

**Propósito:** Análisis automático (OCR + IA + extracción)

**Trigger:** Ejecutado asincronía después de crear documento

**Proceso:**

```typescript
async function analizarDocumentoIngenieria(documento_id) {
  const sr = base44.asServiceRole;
  
  try {
    // PASO 1: Cargar documento
    const documento = await sr.entities.DocumentoIngenieria.read(documento_id);
    
    // Actualizar estado a "procesando"
    await sr.entities.DocumentoIngenieria.update(documento_id, {
      estado_análisis: "procesando",
    });
    
    // PASO 2: Descargar archivo desde URL
    const contenidoArchivo = await descargarArchivo(documento.archivo_url);
    
    // PASO 3: OCR + Extracción de Texto
    const respuestaOCR = await googleCloudVisionAPI.documentAI(contenidoArchivo);
    const textoExtraído = respuestaOCR.fullText;
    const confianzaOCR = respuestaOCR.confidenceScore;
    
    // PASO 4: Clasificación de Tipo de Documento
    const promptClasificación = `
      Analiza el siguiente texto de un documento de ingeniería y clasifícalo en una de estas categorías:
      - plano (dibujos técnicos)
      - especificación (requisitos técnicos)
      - presupuesto (costos)
      - cronograma (timeline)
      - informe (análisis/inspección)
      - contrato (acuerdos)
      - otro
      
      Texto: ${textoExtraído.substring(0, 2000)}
      
      Responde en JSON: { "tipo": "...", "confianza": 0.95 }
    `;
    
    const respuestaClasificación = await invocarLLM(promptClasificación);
    const tipoDetectado = respuestaClasificación.tipo;
    const confianzaTipo = respuestaClasificación.confianza;
    
    // PASO 5: Extracción de Entidades Relevantes
    const promptEntidades = `
      Del siguiente documento de ingeniería, extrae en JSON:
      - presupuesto (moneda + monto)
      - área o superficie (m2)
      - plazo de ejecución (meses)
      - responsable técnico (nombre)
      - fecha inicio proyecto
      - fecha fin proyecto
      
      Para cada campo, incluye: { "value": "...", "confianza": 0-1 }
      Si no encuentras un dato, usa null.
      
      Texto: ${textoExtraído.substring(0, 3000)}
    `;
    
    const entidadesExtraídas = await invocarLLM(promptEntidades);
    
    // PASO 6: Generar Palabras Clave y Resumen
    const promptResumen = `
      Genera:
      1. Lista de 10-15 palabras clave del documento
      2. Resumen de 2-3 líneas máximo
      
      Responde en JSON: { "palabras_clave": [...], "resumen": "..." }
      
      Texto: ${textoExtraído.substring(0, 3000)}
    `;
    
    const resumenGenerado = await invocarLLM(promptResumen);
    
    // PASO 7: Guardar Resultados de Análisis
    const análisisCompleto = {
      ocr_texto_completo: textoExtraído,
      ocr_confianza: confianzaOCR,
      ocr_modelo_usado: "google_cloud_vision_3.0",
      
      tipo_detectado: tipoDetectado,
      tipo_confianza: confianzaTipo,
      
      entidades_detectadas: entidadesExtraídas,
      
      palabras_clave: resumenGenerado.palabras_clave,
      resumen: resumenGenerado.resumen,
      
      fecha_análisis: new Date().toISOString(),
      modelo_ia_usado: "gemini_vision_3.0",
      versión_análisis: "1.0",
    };
    
    // PASO 8: Actualizar documento con resultados
    await sr.entities.DocumentoIngenieria.update(documento_id, {
      estado_análisis: "completado",
      análisis_automático: análisisCompleto,
      tipo: tipoDetectado,
      indice_búsqueda: construirÍndiceBúsqueda(análisisCompleto),
    });
    
    // PASO 9: Actualizar proyecto (marcar que tiene análisis pendiente de revisar)
    await sr.entities.Obra.update(documento.obra_id, {
      análisis_automático_pendiente: true,
    });
    
    console.log(`[ANÁLISIS OK] Documento ${documento_id} analizado`);
    
    return { ok: true, estado: "completado" };
    
  } catch (error) {
    // PASO 10: Manejar errores
    await sr.entities.DocumentoIngenieria.update(documento_id, {
      estado_análisis: "error",
      error_mensaje: error.message,
    });
    
    console.error(`[ANÁLISIS ERROR] ${documento_id}:`, error);
    
    return { ok: false, error: error.message };
  }
}

function construirÍndiceBúsqueda(análisis) {
  const índice = new Set();
  
  // Agregar tipo
  if (análisis.tipo_detectado) {
    índice.add(análisis.tipo_detectado);
  }
  
  // Agregar palabras clave
  (análisis.palabras_clave || []).forEach(kw => índice.add(kw.toLowerCase()));
  
  // Agregar valores de entidades
  Object.entries(análisis.entidades_detectadas || {}).forEach(([clave, obj]) => {
    if (obj?.value) {
      índice.add(obj.value.toLowerCase());
    }
  });
  
  // Agregar tokens del resumen
  (análisis.resumen || "").split(/\s+/).forEach(token => {
    if (token.length > 3) {
      índice.add(token.toLowerCase());
    }
  });
  
  return Array.from(índice);
}
```

---

## 5. INTERFAZ DE USUARIO (Frontend)

### 5.1 Flujo de Carga Mejorado

**Pantalla: `/ingenieria/cargar`**

```
┌─────────────────────────────────────────────────────────┐
│ CARGAR DOCUMENTACIÓN DE PROYECTO                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ 📁 Selecciona o arrastra archivos aquí                  │
│ (Planos, PDFs, imágenes, especificaciones)              │
│                                                           │
│ [Aceptar múltiples archivos]                            │
│                                                           │
│ ✓ Los proyectos se crearán automáticamente si no existen│
│ ✓ Los análisis se ejecutarán automáticamente            │
│ ✓ Gerencia revisará los resultados                      │
│                                                           │
│ [SUBIR ARCHIVOS]                                        │
│                                                           │
│ ─────────────────────────────────────────────────────── │
│                                                           │
│ 📊 ÚLTIMO ANÁLISIS REALIZADO                            │
│                                                           │
│ Proyecto: Los Rosales                                   │
│ Estado: ⚠️ Análisis Inicial (1 documento)              │
│                                                           │
│ Documento: Plano_Los_Rosales.pdf                        │
│ ├─ Estado: ✓ Analizado (87% confianza)                │
│ ├─ Tipo: Plano Arquitectónico                          │
│ ├─ Presupuesto: $500.000 (conf: 95%)                  │
│ ├─ Área: 2.500 m² (conf: 92%)                         │
│ └─ Plazo: 12 meses (conf: 78%)                         │
│                                                           │
│ [👁️ Revisar] [🔄 Re-analizar] [✓ Confirmar]            │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Panel de Proyecto (Gerencia)

**Pantalla: `/ingenieria/proyecto/PRY-2026-0047`**

```
┌──────────────────────────────────────────────────────────────────┐
│ PROYECTO: LOS ROSALES                                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│ Estado: ⚠️ ANÁLISIS INICIAL (1 documento sin revisar)           │
│                                                                    │
│ Información Detectada (Automático):                               │
│ ├─ Presupuesto: $500.000 [Conf: 95%] [Editar]                   │
│ ├─ Área: 2.500 m² [Conf: 92%] [Editar]                          │
│ ├─ Plazo: 12 meses [Conf: 78%] [Editar]                         │
│ ├─ Responsable: Ing. Juan García [Conf: 85%] [Editar]           │
│ └─ Ubicación: (no detectada) [Añadir]                            │
│                                                                    │
│ Documentos Cargados:                                              │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ 📄 Plano_Los_Rosales_2026.pdf                              │  │
│ │ Tipo: Plano Arquitectónico                                 │  │
│ │ Cargado: 11 sept 2026 · 14:30 UTC                         │  │
│ │ Análisis: ✓ Completado (87% confianza general)            │  │
│ │                                                             │  │
│ │ Datos Extraídos:                                           │  │
│ │ • Presupuesto: $500.000 (confianza: 95%)                  │  │
│ │ • Área: 2.500 m² (confianza: 92%)                         │  │
│ │ • Plazo: 12 meses (confianza: 78%)                        │  │
│ │                                                             │  │
│ │ Resumen: "Proyecto de construcción de centro comercial    │  │
│ │ con estacionamiento en Los Rosales. Incluye zonas de      │  │
│ │ retail y oficinas administrativas."                        │  │
│ │                                                             │  │
│ │ Palabras Clave: [comercial, construcción, rosales, 2500m²]│  │
│ │                                                             │  │
│ │ ┌─ ACCIONES ───────────────────────────────────────────┐  │  │
│ │ │ [👁️ Ver PDF] [📄 Ver Análisis] [🔄 Re-analizar]      │  │  │
│ │ │ [✓ Confirmar Datos] [✗ Rechazar] [📝 Editar Datos]    │  │  │
│ │ │ [📊 Generar Reporte] [⬇️ Exportar]                   │  │  │
│ │ └───────────────────────────────────────────────────────┘  │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│ [+ CARGAR MÁS DOCUMENTOS] [🔒 FINALIZAR ANÁLISIS]                │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. CARACTERÍSTICAS CLAVE DEL SISTEMA

### 6.1 Auto-Detección de Proyecto

| Característica | Descripción |
|---|---|
| **Triggerado por** | Carga de documento |
| **Método** | IA analiza nombre de archivo + contenido OCR |
| **Umbral similitud** | > 85% para usar proyecto existente |
| **Si no existe** | Crear proyecto automáticamente en estado "análisis_inicial" |
| **Confianza** | Registrada en `confianza_auto_detección` (0-1) |

### 6.2 Análisis Automático de Documento

| Fase | Descripción | Herramienta |
|---|---|---|
| **OCR** | Extracción de texto/tablas | Google Cloud Vision |
| **Clasificación** | Detectar tipo de documento | LLM (Gemini Vision) |
| **Extracción** | Presupuesto, área, plazo, responsable | LLM + Prompt engineering |
| **Indexación** | Preparar para búsqueda rápida | ElasticSearch |
| **Resultado** | Documento en estado "completado" + Proyecto marcado "análisis_pendiente" | BD |

### 6.3 Revisión Manual por Gerencia

| Acción | Efecto |
|---|---|
| **Confirmar datos** | Cambiar proyecto a "documentación_completa" |
| **Editar datos** | Sobrescribir análisis automático con valores manuales |
| **Re-analizar** | Volver a ejecutar análisis con diferente modelo IA |
| **Rechazar documento** | Cambiar estado a "rechazado", no contar en proyecto |
| **Añadir datos faltantes** | Rellenar campos no detectados por IA |

---

## 7. FLUJOS OPERATIVOS DETALLADOS

### Flujo A: Técnico Carga Documento (Happy Path)

```
1. Técnico entra a /ingenieria/cargar
2. Arrastra 3 PDFs: Plano, Presupuesto, Especificaciones
3. Sistema:
   ├─ Detecta proyecto "Los Rosales" en los 3 documentos
   ├─ Busca: ¿existe "Los Rosales"? NO
   ├─ Crea: Obra "Los Rosales" (estado: "análisis_inicial")
   ├─ Crea: 3 registros de DocumentoIngenieria
   ├─ Inicia: análisis automático para cada documento (async)
   └─ Responde: "Documentos subidos. Análisis en progreso..."

4. Backend (background):
   ├─ OCR: Extrae texto de cada PDF
   ├─ IA: Clasifica cada documento
   ├─ IA: Extrae datos (presupuesto, área, plazo)
   ├─ Indexa: Palabras clave para búsqueda
   └─ Actualiza: documento.estado = "completado"

5. Gerencia ve en /ingenieria:
   ├─ Proyecto: Los Rosales [⚠️ ANÁLISIS INICIAL - 3 docs]
   └─ Documentos con badge: [✓ ANALIZADO 90%]

6. Gerencia revisa:
   ├─ Abre proyecto, ve datos extraídos
   ├─ Verifica confianza de cada extracción
   ├─ Clica [✓ Confirmar Datos]
   └─ Proyecto pasa a estado: "documentación_completa"
```

### Flujo B: Revisar y Editar Análisis

```
1. Gerencia entra a /ingenieria/proyecto/PRY-2026-0047
2. Ve análisis automático con confianzas

3. Si confianza < 80% en un campo:
   ├─ Gerencia clica [Editar]
   ├─ Ingresa valor correcto manualmente
   └─ Guarda cambio (anota "revisado por gerencia")

4. Si quiere re-analizar (cambiar modelo IA):
   ├─ Clica [🔄 Re-analizar]
   ├─ Elige modelo: Gemini vs Claude vs GPT
   └─ Sistema ejecuta análisis nuevamente

5. Resultado:
   ├─ Documento actualizado con nuevo análisis
   ├─ Se guardan AMBAS versiones (historial)
   └─ Documento listo para documentación_completa
```

### Flujo C: Proyecto Incompleto, Cargar Más Documentos

```
1. Proyecto "Los Rosales" en estado "análisis_inicial"
2. Gerencia decide: "Falta especificación técnica"
3. Clica [+ CARGAR MÁS DOCUMENTOS]

4. Técnico sube nuevamente PDF de especificaciones
5. Sistema:
   ├─ Detecta: ¿Es del proyecto "Los Rosales"? SÍ
   ├─ Vincula: documento.obra_id = PRY-2026-0047 (existente)
   ├─ Analiza: Ejecuta OCR + IA nuevamente
   ├─ Marca: Proyecto.análisis_automático_pendiente = true
   └─ Notifica: "Nuevo documento analizado, revisar"

6. Gerencia revisa documento adicional
7. Clica [✓ Confirmar Datos] si todo OK
```

---

## 8. VENTAJAS DEL SISTEMA PROPUESTO

| Ventaja | Beneficio |
|---|---|
| **Auto-creación de proyectos** | Reduce fricción inicial, técnico no espera a crear proyecto manualmente |
| **Análisis automático** | Datos iniciales extraídos sin intervención manual |
| **Revisión manual opcional** | Gerencia valida, pero no es bloqueante |
| **Historial de cambios** | Se registra quién confirmó qué y cuándo |
| **Búsqueda potenciada** | Indexación permite encontrar documentos por contenido |
| **Estado de confianza** | Gerencia sabe qué tan segura es cada extracción |
| **Re-análisis disponible** | Cambiar modelo IA si resultado inicial no es satisfactorio |

---

## 9. RIESGOS Y MITIGACIONES

### Riesgo 1: Auto-Detección Incorrecta

**Escenario:** IA detecta "Los Rosales" en un documento que es del proyecto "Rosales Commons"

**Mitigación:**
- Umbral similitud > 85% (evita falsos positivos)
- Mostrar confianza al usuario (0.87 en este caso)
- Permitir que Gerencia corrija manualmente
- Crear "sugerencias" en lugar de crear proyecto automáticamente si confianza < 75%

### Riesgo 2: OCR Falla en Documento Escaneado

**Escenario:** Plano antiguo escaneado con baja calidad → OCR retorna 0.3 confianza

**Mitigación:**
- Mostrar badge "Confianza baja: 30%"
- Ofrecer botón [🔄 Re-analizar con modelo premium]
- Permitir Gerencia editar datos manualmente
- No bloquear el flujo, solo avisar

### Riesgo 3: Proyecto Auto-Creado Innecesariamente

**Escenario:** Documento de otro cliente sube por error → se crea proyecto fantasma

**Mitigación:**
- Proyecto entra en estado "análisis_inicial" (no se usa para nada)
- Gerencia puede eliminarlo si es necesario
- Registrar quién cargó el documento (auditoría)
- Notificación a admin si se detectan muchos proyectos sin revisar

---

## 10. PLAN DE IMPLEMENTACIÓN (Fases)

| Fase | Alcance | Duración | Prioridad |
|---|---|---|---|
| **F1: Backend de Auto-Detección** | Funciones `detectarYCrearProyectoAutomatico()` | 5-7 días | 🔴 P0 |
| **F2: Backend de Análisis Automático** | Función `analizarDocumentoIngenieria()` | 7-10 días | 🔴 P0 |
| **F3: Entidades Base44** | Extender `Obra` + Crear `DocumentoIngenieria` | 2-3 días | 🔴 P0 |
| **F4: UI de Carga Mejorada** | Pantalla `/ingenieria/cargar` | 3-5 días | 🟠 P1 |
| **F5: UI de Revisión por Gerencia** | Panel proyecto con edición manual | 4-6 días | 🟠 P1 |
| **F6: Búsqueda Potenciada** | ElasticSearch + indexación | 5-7 días | 🟡 P2 |
| **F7: Historial y Auditoría** | Registrar cambios, re-análisis | 3-4 días | 🟡 P2 |
| **F8: Testing + Deployment** | E2E testing, staging, prod | 4-5 días | 🔴 P0 |

**Total:** 33-47 días (4-6 semanas si se hacen en paralelo)

---

## 11. CHECKLIST DE IMPLEMENTACIÓN (Fase 1: F1-F3)

### Semana 1: Backend (Funciones)

- [ ] Crear función `detectarYCrearProyectoAutomatico/entry.ts`
  - [ ] Extraer metadata de archivo
  - [ ] Invocar IA para detectar proyecto
  - [ ] Buscar proyecto existente por similitud
  - [ ] Crear proyecto si no existe
  - [ ] Crear documento + disparar análisis async
  - [ ] Tests unitarios

- [ ] Crear función `analizarDocumentoIngenieria/entry.ts`
  - [ ] OCR con Google Cloud Vision
  - [ ] Clasificación de tipo de documento
  - [ ] Extracción de entidades (presupuesto, área, plazo, etc)
  - [ ] Generación de palabras clave + resumen
  - [ ] Guardar resultados en documento
  - [ ] Marcar proyecto como "análisis_pendiente"
  - [ ] Manejo de errores + logging
  - [ ] Tests unitarios

### Semana 1-2: Entidades Base44

- [ ] Extender `Obra.jsonc`
  - [ ] Campos: estado, auto_creado, confianza_auto_detección, etc
  - [ ] Actualizar RLS

- [ ] Crear `DocumentoIngenieria.jsonc`
  - [ ] Todos los campos según secc 3.2
  - [ ] RLS: admin, gerencia pueden revisar todos; usuarios ven solo sus subidas
  - [ ] Índices de BD: obra_id, estado_análisis, indice_búsqueda

### Semana 2: Testing

- [ ] Test 1: Cargar PDF simple → proyecto auto-creado
- [ ] Test 2: Cargar 2 PDFs mismo proyecto → vinculado a proyecto existente
- [ ] Test 3: OCR extrae texto correctamente
- [ ] Test 4: IA clasifica tipo de documento (plano vs presupuesto)
- [ ] Test 5: Entidades extraídas son correctas
- [ ] Test 6: Gerencia puede editar datos manualmente
- [ ] Test 7: Re-análisis funciona con diferente modelo

---

## 12. CONCLUSIÓN

### Resumen de la Propuesta

**Transformar el módulo de ingeniería de:**
```
Técnico → Manual crear obra → Manual subir doc → Sin análisis
```

**A:**
```
Técnico → Sube doc → [AUTO] Detecta obra + crea si necesario → [AUTO] Analiza contenido
         → Gerencia revisa (opcional) + confirma o edita → Documentación lista
```

### Beneficios Clave

✅ **Flujo más intuitivo:** Técnico solo sube, sistema hace el resto  
✅ **Datos iniciales automáticos:** Presupuesto, área, plazo extraídos sin digitar  
✅ **Control por Gerencia:** Puede revisar, editar, o descartar análisis  
✅ **Trazabilidad:** Historial de quién confirmó qué  
✅ **Escalable:** Soporta múltiples documentos por proyecto  
✅ **Flexible:** Re-análisis disponible si es necesario  

---

*Análisis completo: 2026-09-11 | Propuesta lista para revisión*
