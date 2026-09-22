/**
 * Configuración centralizada de OCR del módulo Ingeniería.
 * Fuente única de prompts + schemas + derivación de registros para:
 *   - los 6 funciones OCR individuales (procesarListadoPuntos, etc.)
 *   - la función de lote procesarLoteDocumentosPendientes
 *
 * Extraído a shared para NO duplicar lógica entre funciones (regla Base44).
 */

interface OCRConfig {
  label: string;
  prompt: string;
  schema: object;
  /** roles permitidos a invocar el OCR de este tipo (auth en cada función) */
  roles: string[];
  /** ¿Genera registros derivados (ItemLista/FichaTecnicaEquipo) tras la extracción? */
  deriva: boolean;
}

const ROLES_INGENIERIA = ['admin', 'propietario', 'gerencia', 'ingeniero'];
const ROLES_FACTURA = ['admin', 'propietario', 'gerencia'];

const listadoPuntosPrompt = `Eres un sistema OCR especializado en listados de puntos y pedidos de ingeniería de instalaciones técnicas (BMS, refrigeración industrial, climatización).
Analiza el documento (probablemente pre-procesado tipo CamScanner).
Extrae TODOS los puntos del listado.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "proveedor": "nombre del emisor si es un pedido a proveedor; cadena vacía si es listado interno",
  "numero_documento": "nº de pedido/listado impreso; cadena vacía si no aparece",
  "fecha_documento": "YYYY-MM-DD; cadena vacía si no aparece",
  "puntos": [
    {
      "punto_id": "ID del punto (PT-01, PT-02...); cadena vacía si no aparece",
      "descripcion": "descripción técnica del punto/equipo",
      "referencia": "referencia comercial del equipo; cadena vacía si no aparece",
      "fabricante": "fabricante si aparece; cadena vacía si no",
      "ubicacion": "zona/ubicación técnica del punto (Sala máquinas, Planta 2...); cadena vacía si no",
      "cantidad": 1,
      "unidad": "ud|m²|m³|kg|ml|...",
    }
  ],
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible"
}

Instrucciones estrictas:
- Extrae TODOS los puntos, aunque sean muchos.
- NO extraigas PVP, descuento ni IVA: esos van en la factura, no en el listado de puntos.
- La referencia es clave para cruzar con la base de datos de Materiales. Cadena vacía si no aparece.
- Si no puedes extraer un dato, usa cadena vacía (textos) o null (numéricos).
- No incluyas en "puntos" totales, subtotales ni cabeceras.`;

const listadoPuntosSchema = {
  type: 'object',
  properties: {
    proveedor: { type: 'string' },
    numero_documento: { type: 'string' },
    fecha_documento: { type: 'string' },
    puntos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          punto_id: { type: 'string' },
          descripcion: { type: 'string' },
          referencia: { type: 'string' },
          fabricante: { type: 'string' },
          ubicacion: { type: 'string' },
          cantidad: { type: 'number' },
          unidad: { type: 'string' },
        },
        required: ['descripcion'],
      },
    },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    ocr_raw: { type: 'string' },
  },
  required: ['puntos'],
};

const esquemaConexionPrompt = `Eres un sistema OCR especializado en esquemas eléctricos y diagramas de conexión de instalaciones técnicas (BMS, refrigeración, climatización).
Analiza el esquema (probablemente pre-procesado tipo CamScanner).
Extrae TODOS los componentes y sus conexiones.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "tipo_diagrama": "esquema_electrico|pid_proceso|unifilar|otro",
  "componentes": [
    {
      "etiqueta": "texto impreso junto al símbolo (Q1, KM1, F1...)",
      "tipo_componente": "motor|variador|contactor|protector|rele|sensor|valvula|otro",
      "referencia": "referencia comercial si aparece; cadena vacía si no",
      "fabricante": "si aparece; cadena vacía si no",
      "parametros": { "potencia_kw": null|número, "tension_v": null|número, "intensidad_a": null|número },
      "posicion_aprox": { "zona": "descripción de la zona del esquema (esquina superior, centro...)" }
    }
  ],
  "conexiones": [
    { "origen": "etiqueta componente origen", "destino": "etiqueta componente destino", "tipo_cable": "potencia|control|senal", "seccion_mm2": null|número }
  ],
  "anotaciones_manuscritas": [
    { "texto": "transcripción literal", "color_aprox": "rojo|azul|negro|otro", "zona": "descripción de la zona" }
  ],
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible"
}

Instrucciones estrictas:
- Las anotaciones manuscritas en color NO se interpretan como cambios incorporados: se transcriben literalmente en "anotaciones_manuscritas" con su color, sin asumir que modifican el esquema base.
- Si un parámetro no aparece, usa null (numéricos) o cadena vacía (textos).
- "posicion_aprox.zona" es descriptivo (esquina superior, centro), NO coordenadas en píxeles.`;

const esquemaConexionSchema = {
  type: 'object',
  properties: {
    tipo_diagrama: { type: 'string', enum: ['esquema_electrico', 'pid_proceso', 'unifilar', 'otro'] },
    componentes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          etiqueta: { type: 'string' },
          tipo_componente: { type: 'string', enum: ['motor', 'variador', 'contactor', 'protector', 'rele', 'sensor', 'valvula', 'otro'] },
          referencia: { type: 'string' },
          fabricante: { type: 'string' },
          parametros: {
            type: 'object',
            properties: {
              potencia_kw: { type: ['number', 'null'] },
              tension_v: { type: ['number', 'null'] },
              intensidad_a: { type: ['number', 'null'] },
            },
          },
          posicion_aprox: {
            type: 'object',
            properties: { zona: { type: 'string' } },
          },
        },
        required: ['etiqueta', 'tipo_componente'],
      },
    },
    conexiones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          origen: { type: 'string' },
          destino: { type: 'string' },
          tipo_cable: { type: 'string', enum: ['potencia', 'control', 'senal'] },
          seccion_mm2: { type: ['number', 'null'] },
        },
        required: ['origen', 'destino'],
      },
    },
    anotaciones_manuscritas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          texto: { type: 'string' },
          color_aprox: { type: 'string', enum: ['rojo', 'azul', 'negro', 'otro'] },
          zona: { type: 'string' },
        },
        required: ['texto'],
      },
    },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    ocr_raw: { type: 'string' },
  },
  required: ['componentes'],
};

const pidProcesoPrompt = `Eres un sistema OCR especializado en diagramas P&ID de proceso (Piping and Instrumentation Diagram).
Analiza el P&ID (probablemente pre-procesado tipo CamScanner).
Extrae TODOS los instrumentos con sus tags ISA y los bucles de control.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "tipo_diagrama": "pid_proceso|esquema_electrico|unifilar|otro",
  "instrumentos": [
    {
      "tag": "tag ISA (TT-101, FV-202, PDI-305...)",
      "tipo_instrumento": "transmisor|controlador|indicador|valvula_regulacion|valvula_onoff|sensor|otro",
      "funcion": "letra función ISA (T=temperatura, F=caudal, P=presión, L=nivel...)",
      "linea_proceso": "identificación de la línea/tubería a la que se conecta, si aparece; cadena vacía si no",
      "referencia": "referencia comercial si aparece; cadena vacía si no",
      "posicion_aprox": { "zona": "descripción de la zona del P&ID" }
    }
  ],
  "bucles_control": [
    {
      "tag": "tag del bucle (TIC-101...)",
      "instrumentos": ["lista de tags ISA que forman el bucle"]
    }
  ],
  "anotaciones_manuscritas": [
    { "texto": "transcripción literal", "color_aprox": "rojo|azul|negro|otro", "zona": "descripción de la zona" }
  ],
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible"
}

Instrucciones estrictas:
- Los tags ISA siguen el formato XX-NNN (letras función + número). Transcríbelos literalmente.
- Las anotaciones manuscritas en color NO se interpretan como cambios incorporados: se transcriben literalmente en "anotaciones_manuscritas", sin asumir que modifican el P&ID base.
- Si un dato no aparece, usa cadena vacía (textos) o null (numéricos).
- "posicion_aprox.zona" es descriptivo, NO coordenadas en píxeles.`;

const pidProcesoSchema = {
  type: 'object',
  properties: {
    tipo_diagrama: { type: 'string', enum: ['pid_proceso', 'esquema_electrico', 'unifilar', 'otro'] },
    instrumentos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tag: { type: 'string' },
          tipo_instrumento: { type: 'string', enum: ['transmisor', 'controlador', 'indicador', 'valvula_regulacion', 'valvula_onoff', 'sensor', 'otro'] },
          funcion: { type: 'string' },
          linea_proceso: { type: 'string' },
          referencia: { type: 'string' },
          posicion_aprox: {
            type: 'object',
            properties: { zona: { type: 'string' } },
          },
        },
        required: ['tag', 'tipo_instrumento'],
      },
    },
    bucles_control: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tag: { type: 'string' },
          instrumentos: { type: 'array', items: { type: 'string' } },
        },
        required: ['tag'],
      },
    },
    anotaciones_manuscritas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          texto: { type: 'string' },
          color_aprox: { type: 'string', enum: ['rojo', 'azul', 'negro', 'otro'] },
          zona: { type: 'string' },
        },
        required: ['texto'],
      },
    },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    ocr_raw: { type: 'string' },
  },
  required: ['instrumentos'],
};

const planoPlantaPrompt = `Eres un sistema OCR+visión especializado en planos de planta de instalaciones técnicas (BMS, refrigeración industrial, climatización, electricidad).
Analiza el plano (probablemente pre-procesado tipo CamScanner: recortado, enderezado).
Propón UbicacionEquipo CANDIDATAS por simbología reconocible y superficies rotuladas.
NUNCA extraigas ni asumas la escala: las coordenadas que devuelvas son APROXIMADAS en píxeles de la imagen para que el ingeniero las confirme/reposicione; la calibración se hace aparte (PlanoCalibracion).

Devuelve SOLO un JSON con esta estructura:
{
  "nombre_planta": "nombre de la planta/estancia si está rotulada ('Planta Baja', 'Sala de Máquinas'); cadena vacía si no",
  "superficies_rotuladas": [
    { "nombre": "Sala Estabulario", "superficie_m2": 26.60 },
    { "nombre": "Sala de Despiece", "superficie_m2": null }
  ],
  "equipos_candidatos": [
    {
      "tag_equipo": "TAG o etiqueta del equipo si está rotulada (M1, V01, C01, CD, BMS-NODO-3); cadena vacía si no rotulado",
      "tipo": "cuadro_control|caldera|bomba|enfriadora|sonda|valvula|climatizador|compresor|condensador|otro",
      "x_pct": número entre 0 y 1 (posición horizontal APROXIMADA sobre el ancho de la imagen),
      "y_pct": número entre 0 y 1 (posición vertical APROXIMADA sobre el alto de la imagen),
      "confianza_ubicacion": "alta|media|baja",
      "observacion": "por qué se reconoce (símbolo de bomba, cuadro rotulado, etc.)"
    }
  ],
  "anotaciones_manuscritas": [
    "texto literal de anotaciones manuscritas en color detectadas, si las hay"
  ],
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible (rótulos, cotas, leyendas)"
}

Instrucciones estrictas:
- Las posiciones (x_pct, y_pct) son FRACCIÓN de la imagen (0-1), NO píxeles ni metros: el frontend las convierte a píxeles del canvas. Es una sugerencia para que el ingeniero reubique.
- tipo se infiere por la simbología estándar (cuadro = rectángulo con barras, bomba = círculo con flecha, caldera = rectángulo con serpentín, sonda = círculo pequeño, válvula = dos triángulos).
- NO asumas escala ni distancias: si el plano NO tiene cota impresa, deja superficies_rotuladas con superficie_m2 null y obvia cualquier cálculo de metros.
- Solo propone equipos con confianza_ubicacion media o alta; los de baja se omiten (mejor no sugerir que sugerir mal).
- anotaciones_manuscritas: solo texto literal, sin interpretar (la clasificación patrón la hace el backend de conciliación, no esta función).`;

const planoPlantaSchema = {
  type: 'object',
  properties: {
    nombre_planta: { type: 'string' },
    superficies_rotuladas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          superficie_m2: { type: ['number', 'null'] },
        },
        required: ['nombre'],
      },
    },
    equipos_candidatos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tag_equipo: { type: 'string' },
          tipo: { type: 'string', enum: ['cuadro_control', 'caldera', 'bomba', 'enfriadora', 'sonda', 'valvula', 'climatizador', 'compresor', 'condensador', 'otro'] },
          x_pct: { type: 'number' },
          y_pct: { type: 'number' },
          confianza_ubicacion: { type: 'string', enum: ['alta', 'media', 'baja'] },
          observacion: { type: 'string' },
        },
        required: ['tipo', 'x_pct', 'y_pct'],
      },
    },
    anotaciones_manuscritas: { type: 'array', items: { type: 'string' } },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    ocr_raw: { type: 'string' },
  },
  required: ['equipos_candidatos'],
};

const facturaMaterialesPrompt = `Eres un sistema OCR especializado en facturas, albaranes, proformas y tickets de proveedores en España.
Analiza el documento (probablemente pre-procesado tipo CamScanner: recortado, enderezado y con contraste mejorado).
Extrae TODAS las líneas de producto/material del cuerpo del documento.

Devuelve SOLO un JSON con esta estructura exacta:
{
  "proveedor": "nombre del emisor del documento",
  "nif_proveedor": "CIF/NIF del emisor",
  "numero_documento": "nº de factura/albarán/proforma impreso; cadena vacía si no aparece",
  "fecha_documento": "YYYY-MM-DD (no la fecha de hoy)",
  "tipo_documento_inferido": "factura|albaran|ticket|proforma",
  "lineas": [
    {
      "fabricante": "marca/fabricante del producto; cadena vacía si no aparece",
      "referencia": "referencia/código de catálogo del producto; cadena vacía si no aparece",
      "descripcion": "descripción del producto",
      "cantidad": 1,
      "unidad": "ud|m²|m³|kg|ml|h|...",
      "pvp": null|número (precio público de venta si aparece por separado; null si NO figura),
      "descuento_empresa": null|número (% descuento aplicado al comprador, si aparece o se deduce; null si NO figura),
      "iva": null|número (% IVA de la línea),
      "precio_neto": número (precio por unidad realmente facturado, CON descuento incluido, SIN IVA)
    }
  ],
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible, línea por línea"
}

Instrucciones estrictas:
- Extrae TODAS las líneas de producto, aunque sean muchas.
- NUNCA inventes PVP ni descuento si el documento NO los muestra por separado: si solo aparece el precio neto, deja pvp=null y descuento_empresa=null.
- precio_neto es OBLIGATORIO. Si el documento solo da el importe total de la línea, divídelo entre cantidad.
- La referencia es clave para cruzar con la base de datos de Materiales. Cadena vacía si no aparece.
- No incluyas en "lineas" totales, subtotales, bases imponibles, IVA global ni portes.
- Si no puedes extraer un dato, usa null (numéricos) o cadena vacía (textos).`;

const facturaMaterialesSchema = {
  type: 'object',
  properties: {
    proveedor: { type: 'string' },
    nif_proveedor: { type: 'string' },
    numero_documento: { type: 'string' },
    fecha_documento: { type: 'string' },
    tipo_documento_inferido: { type: 'string', enum: ['factura', 'albaran', 'ticket', 'proforma'] },
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fabricante: { type: 'string' },
          referencia: { type: 'string' },
          descripcion: { type: 'string' },
          cantidad: { type: 'number' },
          unidad: { type: 'string' },
          pvp: { type: ['number', 'null'] },
          descuento_empresa: { type: ['number', 'null'] },
          iva: { type: ['number', 'null'] },
          precio_neto: { type: 'number' },
        },
        required: ['descripcion', 'precio_neto'],
      },
    },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    ocr_raw: { type: 'string' },
  },
  required: ['lineas'],
};

const fichaTecnicaPrompt = `Eres un sistema OCR especializado en fichas técnicas de equipos electromecánicos de instalaciones (motores, variadores de frecuencia, bombas, ventiladores, compresores, condensadores, intercambiadores).
PRIMERO detecta el tipo de equipo por la placa/simbología/texto. LUEGO extrae las especificaciones clave QUE APLIQUEN a ese tipo — no un esquema fijo.

Devuelve SOLO un JSON con esta estructura:
{
  "tag_equipo": "TAG o denominación del equipo ('Motor compresor', 'Condensador Adiabático CD', 'Bomba NSCE 32-160'); cadena vacía si no aparece",
  "equipo_tipo": "motor|variador|bomba|ventilador|compresor|condensador|intercambiador|otro",
  "fabricante": "",
  "modelo": "",
  "especificacion_clave": {
    // JSON LIBRE: solo las claves que apliquen al tipo detectado.
    // motor:      potencia_kw, potencia_cv, tension_v, corriente_a, velocidad_rpm, factor_potencia, rendimiento_pct, ip_proteccion, clase_aislamiento, servicio, masa_kg
    // variador:   potencia_kw, tension_entrada_v, tension_salida_v, corriente_a, modelo_control, potencias_asociadas_kw (array)
    // bomba:      potencia_kw, caudal_m3h, altura_m, fluido, temperatura_c, diametro_impulsor_mm
    // ventilador: potencia_kw, caudal_m3h, presion_pa, diametro_mm
    // compresor: potencia_kw, caudal_m3h, refrigerante, presion_bar
    // condensador/intercambiador: refrigerante, presion_bar, capacidad_kw, potencia_electrica_kw, num_ventiladores, superficie_m2
    // Incluye cualquier otra clave técnica del fabricante no listada. Omite las que no apliquen.
  },
  "equipo_asociado": "denominación del equipo asociado si la ficha lo menciona (ej. 'variador FC102 315kW'); cadena vacía si no",
  "confianza": "alta|media|baja",
  "ocr_raw": "transcripción COMPLETA del texto visible, línea por línea"
}

Instrucciones estrictas:
- especificacion_clave debe contener SOLO las claves relevantes al tipo detectado (no metas campos de motor en una bomba). Los valores numéricos van como número (sin unidad: 260, no "260 kW"); la unidad se sobreentiende por la clave.
- tension_v puede ser string compuesto ("400V 50Hz 3~") si la placa lo muestra así.
- refrigerante como texto ("R717", "R134a"). fluido como texto ("35% Propilenglicol").
- Si un dato no aparece, NO lo incluyas en especificacion_clave (mejor omitir que null).
- Los datos son los NOMINALES del fabricante; no interpretes condiciones de instalación.
- tag_equipo se usa para cruzar con UbicacionEquipo.tag_equipo e ItemLista.tag.`;

const fichaTecnicaSchema = {
  type: 'object',
  properties: {
    tag_equipo: { type: 'string' },
    equipo_tipo: { type: 'string', enum: ['motor', 'variador', 'bomba', 'ventilador', 'compresor', 'condensador', 'intercambiador', 'otro'] },
    fabricante: { type: 'string' },
    modelo: { type: 'string' },
    especificacion_clave: { type: 'object', additionalProperties: true },
    equipo_asociado: { type: 'string' },
    confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
    ocr_raw: { type: 'string' },
  },
  required: ['equipo_tipo', 'especificacion_clave'],
};

export const OCR_CONFIG: Record<string, OCRConfig> = {
  listado_puntos: { label: 'Listado de puntos', prompt: listadoPuntosPrompt, schema: listadoPuntosSchema, roles: ROLES_INGENIERIA, deriva: true },
  lista_material: { label: 'Lista de material (proceso)', prompt: listadoPuntosPrompt, schema: listadoPuntosSchema, roles: ROLES_INGENIERIA, deriva: true },
  esquema_conexion: { label: 'Esquema de conexión (eléctrico)', prompt: esquemaConexionPrompt, schema: esquemaConexionSchema, roles: ROLES_INGENIERIA, deriva: false },
  pid_proceso: { label: 'P&ID de proceso', prompt: pidProcesoPrompt, schema: pidProcesoSchema, roles: ROLES_INGENIERIA, deriva: false },
  ficha_tecnica_equipo: { label: 'Ficha técnica de equipo', prompt: fichaTecnicaPrompt, schema: fichaTecnicaSchema, roles: ROLES_INGENIERIA, deriva: true },
  plano_planta: { label: 'Plano de planta', prompt: planoPlantaPrompt, schema: planoPlantaSchema, roles: ROLES_INGENIERIA, deriva: false },
  factura: { label: 'Factura', prompt: facturaMaterialesPrompt, schema: facturaMaterialesSchema, roles: ROLES_FACTURA, deriva: false },
  albaran: { label: 'Albarán', prompt: facturaMaterialesPrompt, schema: facturaMaterialesSchema, roles: ROLES_FACTURA, deriva: false },
  proforma: { label: 'Proforma', prompt: facturaMaterialesPrompt, schema: facturaMaterialesSchema, roles: ROLES_FACTURA, deriva: false },
  pedido: { label: 'Pedido', prompt: facturaMaterialesPrompt, schema: facturaMaterialesSchema, roles: ROLES_FACTURA, deriva: false },
  presupuesto: { label: 'Presupuesto', prompt: facturaMaterialesPrompt, schema: facturaMaterialesSchema, roles: ROLES_FACTURA, deriva: false },
};

/**
 * Deriva registros (ItemLista / FichaTecnicaEquipo) de un documento ya extraído.
 * Borra los derivados previos del mismo documento antes de re-crearlos (idempotente).
 * @returns número de registros derivados creados.
 */
export async function derivarDeDocumento(base44, opts: {
  docId: string;
  tipo: string;
  datos: any;
  revFinal: string;
  obraId: string;
  disciplina?: string;
}): Promise<number> {
  const { docId, tipo, datos, revFinal, obraId, disciplina } = opts;
  let derivados = 0;

  if (tipo === 'listado_puntos' || tipo === 'lista_material') {
    const dominio = disciplina === 'bms' ? 'control_bms' : 'material_electrico_proceso';
    const existentes = await base44.entities.ItemLista.filter({ documento_origen_id: docId });
    if (existentes.length) await base44.entities.ItemLista.deleteMany({ documento_origen_id: docId });
    const items = (datos.puntos || []).filter((p: any) => p.descripcion).map((p: any) => ({
      obra_id: obraId,
      documento_origen_id: docId,
      revision: revFinal,
      tag: p.punto_id || '',
      dominio,
      descripcion: p.descripcion,
      zona: p.ubicacion || '',
      referencia_equipo: p.referencia || '',
      fabricante_name: p.fabricante || '',
      cantidad: p.cantidad || 1,
      unidad: p.unidad || 'ud',
      confianza: datos.confianza || 'media',
      estado: 'pendiente_revision',
    }));
    if (items.length) { await base44.entities.ItemLista.bulkCreate(items); derivados = items.length; }
  } else if (tipo === 'ficha_tecnica_equipo') {
    const existentes = await base44.entities.FichaTecnicaEquipo.filter({ documento_origen_id: docId });
    const payload = {
      tag_equipo: datos.tag_equipo || '',
      equipo_tipo: datos.equipo_tipo || 'otro',
      fabricante: datos.fabricante || '',
      modelo: datos.modelo || '',
      especificacion_clave: datos.especificacion_clave || {},
      equipo_asociado: datos.equipo_asociado || '',
      confianza: datos.confianza || 'media',
    };
    if (existentes.length) await base44.entities.FichaTecnicaEquipo.update(existentes[0].id, payload);
    else await base44.entities.FichaTecnicaEquipo.create({ ...payload, obra_id: obraId, documento_origen_id: docId, estado: 'pendiente_revision' });
    derivados = 1;
  }
  return derivados;
}