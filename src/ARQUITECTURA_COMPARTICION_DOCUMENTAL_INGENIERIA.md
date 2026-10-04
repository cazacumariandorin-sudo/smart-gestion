# 🔗 ANÁLISIS: Arquitectura de Compartición Multidireccional de Documentos

**Documento:** Propuesta de Integración Documental ↔ Ingeniería (Compartición Bidireccional)  
**Fecha:** 2026-10-04  
**Estado:** Análisis de Arquitectura de Datos  
**Objetivo:** Reutilizar documentos existentes entre módulos sin duplicación  

---

## 🎯 CONTEXTO DEL PROBLEMA

### Situación Actual

1. **Módulo Documental** (Existe desde antes)
   - Almacena documentos de la empresa
   - Técnicos acceden para descargar planos, manuales, especificaciones
   - Indexados por categoría/tipo, pero **sin organización por proyecto/obra**

2. **Módulo Ingeniería** (Nuevo, en desarrollo)
   - Necesita documentos para analizar proyectos
   - Debería tener auto-creación de proyectos
   - Requiere organización **por proyecto/obra**

### El Desafío

```
Escenario A: Documentación Antigua (Pre-Ingeniería)
┌─────────────────────────────────────────┐
│ Documental: Plano_Los_Rosales.pdf      │
│ (Cargado hace 6 meses, sin asoc. obra) │
└─────────────────────────────────────────┘
           ↓ (¿Cómo reutilizar?)
┌─────────────────────────────────────────┐
│ Ingeniería: Crear proyecto "Los Rosales"│
│ Necesita ese plano para analizar        │
│ Pero NO está vinculado                  │
└─────────────────────────────────────────┘

Escenario B: Documentación Nueva (Post-Ingeniería)
┌─────────────────────────────────────────┐
│ Ingeniería: Sube Especificaciones.pdf   │
│ (Análisis automático ejecutado)         │
│ Técnicos necesitan acceder desde here   │
└─────────────────────────────────────────┘
           ↓ (¿Cómo sincronizar?)
┌─────────────────────────────────────────┐
│ Documental: ¿Debe aparecer el mismo doc?│
│ Técnicos esperan encontrarlo allí       │
└─────────────────────────────────────────┘
```

### Requisitos del Usuario (Multidireccional)

✅ Documentación en **Documental** → Técnicos acceden para consultar  
✅ **Ingeniería** reutiliza esos documentos para análisis de proyectos  
✅ Documentación en **Ingeniería** → Usada para analizar obra  
✅ Técnicos pueden **acceder desde Documental** a documentos de Ingeniería  
✅ **Una sola copia física** (sin duplicación)  
✅ **Múltiples vistas lógicas** (contexto diferente según módulo)  

---

## 1. OPCIONES ARQUITECTÓNICAS

### Opción 1: Duplicación de Documentos (❌ NO RECOMENDADO)

```
Documental:
├─ Plano_Los_Rosales.pdf (v1)
└─ Especificaciones.pdf (v1)

Ingeniería:
├─ Plano_Los_Rosales.pdf (v2) ← copia diferente
└─ Especificaciones.pdf (v2) ← copia diferente

Problemas:
❌ Dos copias del mismo archivo (redundancia)
❌ Si se actualiza una, la otra quedaa desactualizada
❌ Consumo doble de almacenamiento
❌ Confusión sobre cuál es la versión correcta
❌ No hay sincronización de cambios
```

**Veredicto:** ❌ Rechazado

---

### Opción 2: Referencias (Links Simbólicos) - (✅ RECOMENDADO)

```
Base de Datos:

Tabla: Documento
┌─────────────────────────────────────┐
│ id: DOC-001                         │
│ nombre: "Plano_Los_Rosales.pdf"     │
│ archivo_url: "https://storage/..."  │
│ tipo: "plano"                       │
│ fecha_carga: 2026-03-15             │
│ cargado_por: "tecnico-juan"         │
│ módulo_origen: "documental"         │
│ estado: "activo"                    │
└─────────────────────────────────────┘
        ↓ (relación 1:N)
Tabla: DocumentoAsociado
┌─────────────────────────────────────┐
│ documento_id: DOC-001               │
│ obra_id: PRY-2026-0047              │
│ módulo_destino: "ingeniería"        │
│ tipo_asociación: "análisis"         │
│ análisis_automático: { ... }        │
│ confirmado_por_gerencia: false      │
└─────────────────────────────────────┘

Acceso desde Documental:
┌─────────────────────────────────────┐
│ Plano_Los_Rosales.pdf               │
│ (DOC-001)                           │
│ Usado en: Proyecto Los Rosales      │
│ [Acceso Descargar]                  │
└─────────────────────────────────────┘

Acceso desde Ingeniería:
┌─────────────────────────────────────┐
│ Proyecto Los Rosales                │
│ ├─ Plano_Los_Rosales.pdf (DOC-001)  │
│ │   Análisis: 89% confianza         │
│ │   Entidades: Presupuesto $500K    │
│ │   [Ver PDF] [Revisar Análisis]    │
└─────────────────────────────────────┘

Ventajas:
✅ Una sola copia del archivo
✅ Acceso desde múltiples módulos
✅ Sincronización automática
✅ Control de versiones posible
✅ Bajo impacto en BD
```

**Veredicto:** ✅ Opción Preferida

---

### Opción 3: Unificación de Módulos (⚠️ Posible a Largo Plazo)

```
Sistema Integrado: "Documentación de Proyectos"

Documental + Ingeniería = Centro de Documentación Único

Estructura:
├─ Mi Documentación (personal, sin asoc. obra)
├─ Documentación de Proyecto
│  ├─ Los Rosales
│  │  ├─ Planos
│  │  ├─ Presupuestos
│  │  ├─ Especificaciones
│  │  └─ Análisis IA
│  └─ Otros Proyectos
└─ Documentación Corporativa (manuales, normativas)

Ventajas:
✅ Interfaz única
✅ Sin confusión de navegación
✅ Contexto claro

Desventajas:
❌ Refactoring mayor (riesgoso)
❌ Largo plazo (3-4 meses)
❌ Requiere migración de datos
❌ Riesgo de romper existentes

Recomendación: FUTURO (Fase 3, después de estabilizar Opciones 1+2)
```

**Veredicto:** ⏳ Considerar para versión 2.0

---

## 2. ARQUITECTURA RECOMENDADA: Modelo de Referencia

### 2.1 Entidades del Sistema

#### Tabla 1: `Documento` (Central, Una Copia)

```jsonc
{
  "name": "Documento",
  "description": "Documento físico/archivo (ÚNICA COPIA)",
  "properties": {
    "id": {
      "type": "string",
      "pattern": "DOC-[0-9]{6}",
      "example": "DOC-000123"
    },
    
    "nombre": "string",
    "descripcion": "string",
    "archivo_url": {
      "type": "string",
      "description": "URL única del archivo almacenado (ej: CloudStorage)"
    },
    
    "metadatos": {
      "type": "object",
      "properties": {
        "tamaño_bytes": "number",
        "mimetype": "string",
        "hash_md5": "string",
        "fecha_creación_doc": "date",
        "autor_doc": "string"
      }
    },
    
    "tipo": {
      "type": "string",
      "enum": ["plano", "presupuesto", "especificación", "cronograma", 
               "informe", "contrato", "manual", "otro"]
    },
    
    "módulo_origen": {
      "type": "string",
      "enum": ["documental", "ingeniería"],
      "description": "¿Dónde se cargó originalmente?"
    },
    
    "fecha_carga": "date-time",
    "cargado_por": "string",
    
    "estado": {
      "type": "string",
      "enum": ["activo", "archivado", "eliminado"],
      "default": "activo"
    },
    
    "versión": {
      "type": "integer",
      "default": 1,
      "description": "Control de versiones (si se actualiza el archivo)"
    },
    
    "etiquetas": ["array", "de", "strings"],
    "índice_búsqueda": ["array", "palabras", "indexadas"]
  }
}
```

#### Tabla 2: `DocumentoAsociado` (Relación Multidireccional)

```jsonc
{
  "name": "DocumentoAsociado",
  "description": "Vínculo entre Documento y contexto (Obra, Proyecto, etc)",
  "properties": {
    "id": "string",
    
    "documento_id": {
      "type": "string",
      "description": "Referencia a Documento (FK)"
    },
    
    "obra_id": {
      "type": "string",
      "description": "Referencia a Obra/Proyecto (FK) - OPCIONAL"
    },
    
    "módulo_contexto": {
      "type": "string",
      "enum": ["documental", "ingeniería", "operaciones", "admin"],
      "description": "¿Desde qué módulo se accede/usa?"
    },
    
    "tipo_asociación": {
      "type": "string",
      "enum": ["análisis", "referencia", "especificación", "consulta", "recurso"],
      "description": "¿Cuál es la relación?"
    },
    
    "análisis_automático": {
      "type": "object",
      "description": "Resultados de análisis IA (si se ejecutó)",
      "properties": {
        "ejecutado": "boolean",
        "tipo_detectado": "string",
        "entidades_detectadas": "object",
        "confianza": "number",
        "fecha_análisis": "date-time",
        "resultado": "object"
      }
    },
    
    "revisado_por_gerencia": "boolean",
    "confirmado": "boolean",
    "cambios_manuales": "object",
    
    "fecha_asociación": "date-time",
    "asociado_por": "string",
    
    "estado": {
      "type": "string",
      "enum": ["activo", "archivado", "rechazado"],
      "default": "activo"
    },
    
    "notas": "string"
  }
}
```

#### Tabla 3: `Obra` (Extendida)

```jsonc
{
  "name": "Obra",
  "properties": {
    // Campos existentes
    "id": "string",
    "nombre": "string",
    
    // NUEVO: contador de documentos vinculados
    "documentos_asociados": {
      "type": "array",
      "ref": "DocumentoAsociado.id[]",
      "description": "Array de DocumentoAsociado.id"
    },
    
    "total_documentos": {
      "type": "integer",
      "description": "Count de documentos vinculados (desnormalizado para rendimiento)"
    },
    
    "documentos_sin_analizar": {
      "type": "integer",
      "description": "Count de docs con estado_análisis != 'completado'"
    },
    
    // Resto de campos...
  }
}
```

---

## 3. FLUJOS DE COMPARTICIÓN MULTIDIRECCIONAL

### 3.1 Flujo A: Documento Antiguo (Pre-Ingeniería) → Reutilizado en Ingeniería

```
PASO 1: Estado Inicial (Documental)
┌─────────────────────────────────────────────────────┐
│ Documento: DOC-000123 "Plano_Los_Rosales.pdf"      │
│ Módulo Origen: "documental"                        │
│ Fecha Carga: 2026-03-15                            │
│ Estado: "activo"                                   │
│ Asociaciones: (ninguna aún)                        │
└─────────────────────────────────────────────────────┘

PASO 2: Crear Proyecto en Ingeniería (Auto-detección)
┌─────────────────────────────────────────────────────┐
│ Gerencia sube documento: "Plano_Los_Rosales.pdf"   │
│ Sistema detecta proyecto "Los Rosales"              │
│ ¿Existe DOC-000123 con ese contenido? SÍ           │
│ Pregunta: ¿Reutilizar o crear copia nueva?        │
│ Decisión: REUTILIZAR (evitar duplicación)         │
└─────────────────────────────────────────────────────┘

PASO 3: Crear Asociación (DocumentoAsociado)
┌─────────────────────────────────────────────────────┐
│ Nueva entrada en DocumentoAsociado:                 │
│ ├─ documento_id: DOC-000123                        │
│ ├─ obra_id: PRY-2026-0047                          │
│ ├─ módulo_contexto: "ingeniería"                   │
│ ├─ tipo_asociación: "análisis"                     │
│ ├─ estado_análisis: "pendiente"                    │
│ └─ confirmado: false                               │
└─────────────────────────────────────────────────────┘

PASO 4: Análisis Automático (Ingeniería)
┌─────────────────────────────────────────────────────┐
│ Función: analizarDocumentoIngenieria()             │
│ ├─ Descarga archivo de DOC-000123                  │
│ ├─ Ejecuta OCR + IA + extracción                   │
│ ├─ Guarda resultados en análisis_automático        │
│ └─ Marca: estado_análisis = "completado"           │
└─────────────────────────────────────────────────────┘

PASO 5: Revisión y Confirmación (Gerencia)
┌─────────────────────────────────────────────────────┐
│ Gerencia entra a /ingenieria/proyecto/PRY-2026-0047│
│ Ve: Plano_Los_Rosales.pdf [ANALIZADO 89%]         │
│ Clica: [✓ Confirmar Datos]                        │
│ Sistema: confirmado = true                         │
│ Proyecto pasa a: estado = "documentación_completa" │
└─────────────────────────────────────────────────────┘

PASO 6: Acceso Multidireccional
┌─────────────────────────────────────────────────────┐
│ DOCUMENTAL:                                        │
│ Técnico abre: /documental                          │
│ Ve: DOC-000123 "Plano_Los_Rosales.pdf"            │
│ Metadata: "Usado en proyecto: Los Rosales"        │
│ Acciones: [Descargar] [Ver Info] [Proyectos]      │
│                                                    │
│ INGENIERÍA:                                        │
│ Gerencia abre: /ingenieria/proyecto/PRY-2026-0047 │
│ Ve: Plano_Los_Rosales.pdf                         │
│ Analysis: Presupuesto $500K, Área 2.5K m²        │
│ Acciones: [Ver PDF] [Revisar Análisis]           │
│                                                    │
│ MISMO ARCHIVO (DOC-000123), DOS CONTEXTOS        │
└─────────────────────────────────────────────────────┘
```

---

### 3.2 Flujo B: Documento Nuevo en Ingeniería → Compartir con Documental

```
PASO 1: Usuario Sube en Ingeniería
┌─────────────────────────────────────────────────────┐
│ Técnico/Gerencia carga: "Especificaciones.pdf"     │
│ Sistema: detecta proyecto "Los Rosales"            │
│ Crea: Documento DOC-000124 (nuevo)                 │
│ Módulo Origen: "ingeniería"                        │
│ Archivo guardado en CloudStorage                   │
└─────────────────────────────────────────────────────┘

PASO 2: Análisis Automático (Ingeniería)
┌─────────────────────────────────────────────────────┐
│ Sistema ejecuta: analizarDocumentoIngenieria()     │
│ OCR + IA + extracción de datos                     │
│ Guarda análisis en DocumentoAsociado               │
└─────────────────────────────────────────────────────┘

PASO 3: Visibilidad en Documental (Automático)
┌─────────────────────────────────────────────────────┐
│ Técnico abre: /documental                          │
│ Nuevo filtro: "Mostrar docs de Ingeniería"         │
│ Ve: DOC-000124 "Especificaciones.pdf"              │
│ Metadata:                                          │
│ ├─ Proyecto: Los Rosales                          │
│ ├─ Tipo: Especificación                           │
│ ├─ Cargado en: Ingeniería (11 sept 2026)          │
│ └─ Análisis: Completado (87% confianza)           │
│ Acciones: [Descargar] [Ver en Ingeniería]         │
└─────────────────────────────────────────────────────┘

PASO 4: Técnico Necesita Acceder
┌─────────────────────────────────────────────────────┐
│ Técnico en obra "Los Rosales"                      │
│ Abre: /documental → Filtro: Proyecto "Los Rosales"│
│ Ve TODOS los documentos del proyecto:             │
│ ├─ DOC-000123 Plano_Los_Rosales.pdf (Documental) │
│ ├─ DOC-000124 Especificaciones.pdf (Ingeniería)  │
│ ├─ DOC-000125 Presupuesto.pdf (Ingeniería)       │
│ └─ DOC-000126 Manual_Materiales.pdf (Documental)│
│                                                    │
│ [Descargar todo] [Ver en Ingeniería]              │
└─────────────────────────────────────────────────────┘
```

---

### 3.3 Flujo C: Reasociar Documento Antiguo a Otro Proyecto

```
ESCENARIO: 
"Plano_Rosales.pdf" se usó en proyecto "Los Rosales"
Ahora se descubre que TAMBIÉN se aplica a "Rosales Comercial" (otra obra)

SOLUCIÓN: 

DocumentoAsociado es N:1, no 1:1
Múltiples obras pueden referenciar el mismo DOC

┌─────────────────────────────────────────────────────┐
│ Documento: DOC-000123                              │
│                                                    │
│ Asociaciones:                                      │
│ ├─ DOC_ASOC-001: PRY-0047 (Los Rosales)            │
│ │   tipo: "análisis", confirmado: true            │
│ │   análisis_automático: { presupuesto: $500K }   │
│ │                                                  │
│ └─ DOC_ASOC-003: PRY-0052 (Rosales Comercial)      │
│     tipo: "referencia", confirmado: false         │
│     análisis_automático: { ... }                  │
│     (recientemente añadida, a revisar)            │
└─────────────────────────────────────────────────────┘

Desde Ingeniería:
• Proyecto Los Rosales: ver DOC_ASOC-001 (confirmado)
• Proyecto Rosales Comercial: ver DOC_ASOC-003 (pendiente revisión)

Desde Documental:
• DOC-000123: visto desde 2 proyectos diferentes
```

---

## 4. DETECCIÓN Y EVITACIÓN DE DUPLICADOS

### 4.1 Algoritmo de Deduplicación

```typescript
async function buscarDocumentoDuplicado(archivo) {
  const sr = base44.asServiceRole;
  
  // PASO 1: Calcular hash del archivo
  const hashNuevo = await calcularHashMD5(archivo);
  
  // PASO 2: Buscar por hash en Documento table
  const documentosExistentes = await sr.entities.Documento.filter({
    "metadatos.hash_md5": hashNuevo
  });
  
  if (documentosExistentes.length > 0) {
    // PASO 3: Duplicado encontrado
    const docExistente = documentosExistentes[0];
    
    return {
      acción: "REUTILIZAR",
      documento_id: docExistente.id,
      razón: "Hash idéntico (mismo archivo)",
      fecha_original: docExistente.fecha_carga,
      cargado_originalmente_por: docExistente.cargado_por,
      módulo_origen: docExistente.módulo_origen
    };
  }
  
  // PASO 4: No es duplicado exacto, pero verificar similitud de contenido
  const respuestaOCR = await googleVisionAPI.documentAI(archivo);
  const textoNuevo = respuestaOCR.fullText;
  
  const documentosOtros = await sr.entities.Documento.filter({
    estado: "activo"
  }, undefined, 100);
  
  for (const doc of documentosOtros) {
    const textoExistente = doc.análisis_automático?.ocr_texto_completo || "";
    const similitud = calcularSimilitudTexto(textoNuevo, textoExistente);
    
    if (similitud > 0.90) {
      // PASO 5: Muy similar, probablemente la misma versión
      return {
        acción: "REUTILIZAR_CON_PRECAUCIÓN",
        documento_id: doc.id,
        razón: "Contenido similar (90%+)",
        similitud: similitud,
        advertencia: "Verificar si es la misma versión o actualización"
      };
    }
  }
  
  // PASO 6: No encontrado, crear nuevo documento
  return {
    acción: "CREAR_NUEVO",
    razón: "No hay duplicados"
  };
}
```

### 4.2 Interfaz de Usuario para Deduplicación

```
Cuando se detecta un posible duplicado:

┌─────────────────────────────────────────────────────┐
│ ⚠️ ADVERTENCIA: DOCUMENTO POSIBLEMENTE DUPLICADO    │
├─────────────────────────────────────────────────────┤
│                                                    │
│ Archivo que intentas subir:                        │
│ "Plano_Los_Rosales_v2.pdf"                         │
│                                                    │
│ Documento similar detectado:                       │
│ "Plano_Los_Rosales.pdf"                            │
│ └─ Hash: 89d4e2c1f3a6... (IDÉNTICO)               │
│ └─ Cargado: 2026-03-15 por Técnico Juan           │
│ └─ Usado en: Proyecto Los Rosales, Otros          │
│ └─ Tamaño: 2.5 MB                                 │
│                                                    │
│ ¿Qué deseas hacer?                                │
│                                                    │
│ [✓ Reutilizar documento existente]                │
│   → Vincular a nuevo proyecto/contexto            │
│   → NO crear copia                                │
│   → Ambos módulos comparten el mismo archivo      │
│                                                    │
│ [+ Crear versión nueva]                           │
│   → Si es realmente una actualización             │
│   → Crear DOC-000125 (v2)                         │
│   → Control de versiones                          │
│                                                    │
│ [❌ Cancelar]                                      │
│                                                    │
└─────────────────────────────────────────────────────┘
```

---

## 5. FUNCIONES BACKEND DE INTEGRACIÓN

### 5.1 Función: `vincularDocumentoAObra`

**Propósito:** Asociar documento existente a una obra (multidireccional)

```typescript
async function vincularDocumentoAObra(req) {
  const { documento_id, obra_id, módulo_contexto, tipo_asociación } = await req.json();
  const sr = base44.asServiceRole;
  
  // VALIDACIONES
  const documento = await sr.entities.Documento.read(documento_id);
  if (!documento) return { error: "Documento no encontrado", status: 404 };
  
  const obra = await sr.entities.Obra.read(obra_id);
  if (!obra) return { error: "Obra no encontrada", status: 404 };
  
  // Verificar si ya existe la asociación
  const asociacionExistente = await sr.entities.DocumentoAsociado.filter({
    documento_id,
    obra_id,
    estado: "activo"
  });
  
  if (asociacionExistente.length > 0) {
    return { 
      error: "Documento ya vinculado a esta obra",
      asociación_existente: asociacionExistente[0].id,
      status: 409
    };
  }
  
  // Crear DocumentoAsociado
  const asociación = await sr.entities.DocumentoAsociado.create({
    documento_id,
    obra_id,
    módulo_contexto, // "ingeniería" o "documental"
    tipo_asociación,
    estado: "activo",
    fecha_asociación: new Date().toISOString(),
    asociado_por: getCurrentUserId(),
    análisis_automático: null,
    confirmado: false
  });
  
  // Actualizar contador en Obra (desnormalizado)
  const totalAsociaciones = await sr.entities.DocumentoAsociado.filter({
    obra_id,
    estado: "activo"
  });
  
  await sr.entities.Obra.update(obra_id, {
    documentos_asociados: totalAsociaciones.map(a => a.id),
    total_documentos: totalAsociaciones.length
  });
  
  return {
    ok: true,
    asociación_id: asociación.id,
    mensaje: `Documento "${documento.nombre}" vinculado a "${obra.nombre}"`
  };
}
```

### 5.2 Función: `sincronizarDocumentoADocumental`

**Propósito:** Hacer documento de Ingeniería visible en Documental

```typescript
async function sincronizarDocumentoADocumental(documento_id) {
  const sr = base44.asServiceRole;
  
  const documento = await sr.entities.Documento.read(documento_id);
  if (!documento) return { error: "Documento no encontrado" };
  
  // Si fue cargado en Ingeniería, hacerlo visible en Documental
  if (documento.módulo_origen === "ingeniería") {
    
    // Actualizar flags de visibilidad
    await sr.entities.Documento.update(documento_id, {
      visible_en_documental: true,
      fecha_sincronización_documental: new Date().toISOString(),
      etiquetas: [
        ...(documento.etiquetas || []),
        "sincronizado-ingeniería"
      ]
    });
    
    // Buscar todas las obras asociadas
    const asociaciones = await sr.entities.DocumentoAsociado.filter({
      documento_id,
      estado: "activo"
    });
    
    // Crear índice de búsqueda con información de obras
    const índiceObrasMencionadas = asociaciones
      .map(a => `proyecto-${a.obra_id}`)
      .join(" ");
    
    // Actualizar índice de búsqueda
    await sr.entities.Documento.update(documento_id, {
      indice_búsqueda: [
        ...(documento.indice_búsqueda || []),
        ...índiceObrasMencionadas.split(" ")
      ]
    });
    
    return { 
      ok: true,
      obras_asociadas: asociaciones.length,
      visible_en_documental: true
    };
  }
  
  return { 
    ok: false,
    razón: "Documento no fue originado en Ingeniería"
  };
}
```

---

## 6. INTERFAZ DE USUARIO: VISTAS MULTIDIRECCIONALES

### 6.1 Vista Documental (Tradicional)

**Pantalla: `/documental`**

```
┌───────────────────────────────────────────────────────────────┐
│ DOCUMENTACIÓN                                                 │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│ FILTROS:                                                      │
│ ├─ Tipo: [Todos] [Planos] [Manuales] [Presupuestos]         │
│ ├─ Proyecto: [Todos] [Los Rosales] [Comercial] ...          │
│ ├─ Origen: [Ambos] [Documental Orig] [Ingeniería Orig]      │
│ └─ Estado: [Activos] [Archivados]                           │
│                                                               │
│ RESULTADOS:                                                   │
│                                                               │
│ ✓ DOC-000123: Plano_Los_Rosales.pdf                          │
│   └─ Tipo: Plano | Proyecto: Los Rosales                    │
│   └─ Origen: Documental | Cargado: 2026-03-15              │
│   └─ Usado en: Los Rosales, Otros Proyectos                │
│   └─ Acciones: [Descargar] [Ver Info] [Proyectos]          │
│                                                               │
│ ✓ DOC-000124: Especificaciones.pdf 🆕                        │
│   └─ Tipo: Especificación | Proyecto: Los Rosales          │
│   └─ Origen: Ingeniería (11 sept 2026)                      │
│   └─ Análisis: Completado (87%)                             │
│   └─ Acciones: [Descargar] [Ver en Ingeniería] [Info]       │
│                                                               │
│ ✓ DOC-000125: Manual_Equipos.pdf                             │
│   └─ Tipo: Manual | Sin Proyecto Asociado                   │
│   └─ Origen: Documental | Cargado: 2026-01-20             │
│   └─ Acciones: [Descargar] [Asignar Proyecto]               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 6.2 Vista Ingeniería (Por Proyecto)

**Pantalla: `/ingenieria/proyecto/PRY-2026-0047`**

```
┌───────────────────────────────────────────────────────────────┐
│ PROYECTO: LOS ROSALES                                        │
├───────────────────────────────────────────────────────────────┤
│ Estado: ✓ DOCUMENTACIÓN COMPLETA                            │
│                                                               │
│ DOCUMENTOS VINCULADOS (3):                                    │
│                                                               │
│ 📄 DOC-000123: Plano_Los_Rosales.pdf                         │
│   └─ Origen: Documental (2026-03-15)                        │
│   └─ Análisis: ✓ Completado (89%)                           │
│   └─ Tipo detectado: Plano Arquitectónico                    │
│   └─ Entidades: Presupuesto $500K, Área 2.5K m²            │
│   └─ Acciones: [Ver PDF] [Revisar Análisis] [Re-analizar]  │
│                                                               │
│ 📄 DOC-000124: Especificaciones.pdf                          │
│   └─ Origen: Ingeniería (2026-09-11)                        │
│   └─ Análisis: ✓ Completado (87%)                           │
│   └─ Tipo detectado: Especificación Técnica                 │
│   └─ Entidades: Materiales, Normas, Alcance                 │
│   └─ Acciones: [Ver PDF] [Revisar Análisis] [Re-analizar]  │
│                                                               │
│ 📄 DOC-000126: Presupuesto.xlsx                              │
│   └─ Origen: Documental (2026-02-10)                        │
│   └─ Análisis: ⏳ Pendiente                                  │
│   └─ Acciones: [Ver] [Analizar Ahora] [Asignar Tipo]        │
│                                                               │
│ [+ AGREGAR MÁS DOCUMENTOS]                                   │
│ [📊 GENERAR REPORTE]                                         │
└───────────────────────────────────────────────────────────────┘
```

### 6.3 Vista Técnico (Acceso por Proyecto)

**Pantalla: `/documental?proyecto=PRY-2026-0047`**

```
┌───────────────────────────────────────────────────────────────┐
│ DOCUMENTACIÓN DEL PROYECTO: LOS ROSALES                      │
├───────────────────────────────────────────────────────────────┤
│ (Vista filtrada del Documental, solo docs de este proyecto)  │
│                                                               │
│ DESCARGABLES:                                                 │
│                                                               │
│ 📥 Plano_Los_Rosales.pdf                                     │
│    [⬇️ Descargar] [🔍 Vista Previa]                          │
│                                                               │
│ 📥 Especificaciones.pdf                                      │
│    [⬇️ Descargar] [🔍 Vista Previa] [ℹ️ Ver Análisis IA]   │
│                                                               │
│ 📥 Presupuesto.xlsx                                          │
│    [⬇️ Descargar] [🔍 Vista Previa]                          │
│                                                               │
│ [⬇️ DESCARGAR TODO (ZIP)]                                    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 7. CONTROL DE VERSIONES

### 7.1 Modelo de Versionado

```
Documento: DOC-000123 "Plano_Los_Rosales"

Versión 1 (Original):
├─ Archivo URL: storage/v1/DOC-000123-v1.pdf
├─ Hash MD5: a1b2c3d4e5f6...
├─ Fecha: 2026-03-15
└─ Cargado por: Técnico Juan

Versión 2 (Actualización):
├─ Archivo URL: storage/v2/DOC-000123-v2.pdf
├─ Hash MD5: f6e5d4c3b2a1... (DIFERENTE)
├─ Fecha: 2026-09-11
├─ Cargado por: Gerencia María
├─ Cambios: "Actualización de plano tras revisión estructural"
└─ Reemplaza a: v1
    
IMPORTANTE: 
• Solo una versión "activa" a la vez
• Técnicos ven automáticamente la v2
• Histórico v1 archivado (búsqueda manual)
• Análisis IA se re-ejecuta en v2
```

---

## 8. CASOS DE USO COMPLETOS

### Caso 1: Técnico Busca Plano de Proyecto

```
Técnico Juan:
┌─────────────────────────────────────────────────────┐
│ 1. Abre /documental                                │
│ 2. Filtro: Proyecto = "Los Rosales"               │
│ 3. Ve: Plano_Los_Rosales.pdf (DOC-000123)         │
│ 4. Click: [⬇️ Descargar]                           │
│                                                    │
│ Backend:                                          │
│ ├─ Buscar DOC-000123                              │
│ ├─ Verificar permiso (módulo_contexto = documental)│
│ ├─ Registrar descarga en audit log                │
│ └─ Servir archivo                                 │
│                                                    │
│ Resultado: Técnico descarga archivo               │
└─────────────────────────────────────────────────────┘
```

### Caso 2: Gerencia Analiza Documento de Proyecto

```
Gerencia María:
┌─────────────────────────────────────────────────────┐
│ 1. Abre /ingenieria/proyecto/PRY-2026-0047        │
│ 2. Ve: DOC-000124 "Especificaciones.pdf"          │
│ 3. Análisis: Completado (87%)                     │
│ 4. Click: [🔄 Re-analizar]                        │
│ 5. Elige modelo: "Claude Sonnet" (más preciso)    │
│                                                    │
│ Backend:                                          │
│ ├─ Buscar DOC-000124 → DOC_ASOC (asociación)      │
│ ├─ Descargar archivo desde storage                │
│ ├─ Invocar Claude Sonnet para análisis            │
│ ├─ Guardar nuevo análisis en DocumentoAsociado    │
│ ├─ Marcar: análisis_automático.modelo_usado = Claude│
│ └─ Sincronizar en Documental si aplica           │
│                                                    │
│ Resultado: Análisis mejorado, Gerencia ve v2      │
└─────────────────────────────────────────────────────┘
```

### Caso 3: Migración de Documental Antiguo → Ingeniería

```
Escenario Inicial:
┌────────────────────────────────────────────────────────┐
│ 50 documentos en Documental (sin organizar por obra)   │
│ 0 documentos en Ingeniería                            │
│                                                       │
│ Gerencia quiere:                                       │
│ "Organizar estos 50 docs en proyectos"                │
└────────────────────────────────────────────────────────┘

Solución Propuesta:

Herramienta: "/admin/migrar-documentos-ingeniería"

┌────────────────────────────────────────────────────────┐
│ MIGRACIÓN: Asignar Documentos a Proyectos              │
├────────────────────────────────────────────────────────┤
│                                                       │
│ [Selecciona X documentos sin proyecto]                │
│ ├─ Plano_A.pdf                                       │
│ ├─ Plano_B.pdf                                       │
│ ├─ Especificación_C.pdf                              │
│ └─ Manual_D.pdf                                      │
│                                                       │
│ [Elige proyecto de destino]                          │
│ ├─ Los Rosales                                       │
│ ├─ Comercial                                         │
│ └─ (crear nuevo)                                     │
│                                                       │
│ [Ejecutar Migración]                                 │
│                                                       │
│ Backend:                                             │
│ 1. Para cada documento:                              │
│    ├─ Crear DocumentoAsociado                        │
│    ├─ Ejecutar análisis automático (async)           │
│    ├─ Marcar: módulo_contexto = "ingeniería"        │
│    └─ Actualizar contador obra                       │
│ 2. Mostrar progreso                                  │
│ 3. Generar reporte de migración                      │
│                                                       │
│ Resultado: 4 documentos ahora organizados en proyecto│
│ Estado: Análisis en progreso (4/4)                   │
└────────────────────────────────────────────────────────┘
```

---

## 9. MATRIZ DE PERMISOS (RLS)

### Tabla: Documento

```json
{
  "read": {
    "$or": [
      { "role": "admin" },
      { "role": "gerencia" },
      { "role": "tecnico", "módulo_origen": "documental" },
      { "role": "tecnico", "visible_en_documental": true }
    ]
  },
  
  "create": {
    "$or": [
      { "role": "admin" },
      { "role": "gerencia" },
      { "role": "tecnico" }
    ]
  },
  
  "update": {
    "$or": [
      { "role": "admin" },
      { "role": "gerencia", "módulo_origen": { "$in": ["documental", "ingeniería"] } }
    ]
  }
}
```

### Tabla: DocumentoAsociado

```json
{
  "read": {
    "$or": [
      { "role": "admin" },
      { "role": "gerencia" },
      { "role": "tecnico", "módulo_contexto": "documental" }
    ]
  },
  
  "create": {
    "$or": [
      { "role": "admin" },
      { "role": "gerencia" }
    ]
  },
  
  "update": {
    "$or": [
      { "role": "admin" },
      { "role": "gerencia", "confirmado": false }
    ]
  }
}
```

---

## 10. VENTAJAS DE LA ARQUITECTURA PROPUESTA

| Ventaja | Beneficio |
|---|---|
| **Una única copia** | Sin duplicación, menos almacenamiento |
| **Acceso multidireccional** | Técnico desde Documental, Gerencia desde Ingeniería |
| **Sincronización automática** | Cambios en un módulo se ven en el otro |
| **Control de versiones** | Historial de cambios del documento |
| **Análisis reutilizable** | Análisis IA comparten entre módulos |
| **Flexibilidad de asociación** | Un documento puede estar en múltiples proyectos |
| **Migración suave** | Documentos antiguos se pueden reorganizar |
| **Auditoría completa** | Trazabilidad de quién vió/descargó qué |

---

## 11. PLAN DE IMPLEMENTACIÓN

### Fase 1: Arquitectura Base (2-3 semanas)

- [ ] Crear entidades `Documento` + `DocumentoAsociado`
- [ ] Implementar función `vincularDocumentoAObra`
- [ ] Implementar función `buscarDocumentoDuplicado`
- [ ] Agregar RLS a ambas tablas
- [ ] Testing

### Fase 2: Sincronización (1-2 semanas)

- [ ] Actualizar módulo Documental para mostrar documentos de Ingeniería
- [ ] Implementar función `sincronizarDocumentoADocumental`
- [ ] Filtros cruzados (Proyecto, Origen, Tipo)
- [ ] Testing

### Fase 3: Interfaz de Usuario (2-3 semanas)

- [ ] Vista Documental mejorada
- [ ] Vista Ingeniería con lista de documentos
- [ ] Vistas cruzadas (acceso desde ambos módulos)
- [ ] Interfaz de deduplicación

### Fase 4: Migración de Datos Históricos (1-2 semanas)

- [ ] Herramienta de migración
- [ ] Asignación batch de documentos a proyectos
- [ ] Análisis automático de históricos
- [ ] Validación

---

## 12. CONCLUSIÓN

### Arquitectura Recomendada: **Modelo de Referencia (Opción 2)**

**¿Por qué?**

✅ **Una única copia física** del documento  
✅ **Múltiples referencias lógicas** (DocumentoAsociado)  
✅ **Acceso bidireccional** sin duplicación  
✅ **Escalable** (un documento puede estar en N proyectos)  
✅ **Bajo impacto** en código existente  
✅ **Migración suave** de documentos históricos  
✅ **Control de versiones** integrado  
✅ **Auditoría completa** de uso  

**Cuándo implementar:**

**Urgencia:** 🟠 **MEDIA-ALTA**
- No bloquea Fase 1 de Ingeniería, pero es crítica para usar documentos existentes
- Recomendación: Implementar en paralelo con análisis automático
- Timeline: 6-8 semanas (fases 1-4 en paralelo)

---

*Análisis completo: 2026-10-04 | Propuesta de arquitectura lista para implementación*
