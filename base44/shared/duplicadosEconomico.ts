/**
 * Motor de detección de duplicados del módulo económico.
 * Comparación multicriterio (CIF, nombre, fecha, hora, minuto, importe,
 * localidad, número de factura, código de validación fiscal) entre registros
 * de distintas entidades (RegistroGasto, FacturaAutonomo, Nomina, Presupuesto).
 *
 * Usado por las funciones detectarDuplicadosEconomico y consolidarDuplicado.
 * NO importa src/ ni @/ — es server-side.
 */

// ── Normalización ──────────────────────────────────────────────
export function normalizarTexto(t: any): string {
  return (t == null ? '' : String(t))
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizarCif(t: any): string {
  return (t == null ? '' : String(t))
    .toUpperCase()
    .replace(/[\s\-._/]/g, '')
    .trim();
}

export function normalizarNumero(t: any): string {
  return (t == null ? '' : String(t))
    .toUpperCase()
    .replace(/[\s\-._/]/g, '')
    .trim();
}

// Levenshtein normalizado → similitud 0..1
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export function similitudTexto(a: string, b: string): number {
  const na = normalizarTexto(a);
  const nb = normalizarTexto(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

// ── Forma unificada de documento ──────────────────────────────
export interface DocEconomico {
  id: string;
  entidad: 'registro_gasto' | 'factura_autonomo' | 'nomina' | 'presupuesto';
  entidad_label: string;
  fecha?: string;          // YYYY-MM-DD
  hora?: string;           // HH:MM
  importe?: number;
  cif?: string;            // normalizado
  nombre?: string;         // comercio / autónomo / cliente
  localidad?: string;
  numero_factura?: string; // normalizado
  codigo_fiscal?: string;  // código validación fiscal normalizado
  operario_name?: string;
  operario_email?: string;
  estado?: string;
  categoria?: string;
  obra_name?: string;
  archivos: any[];
  confianza_ocr?: number;
  tiene_hora: boolean;
  calidad: number;         // score para elegir "mejor"
  raw: any;                // registro original
}

function calidadDe(d: Partial<DocEconomico>): number {
  let s = 0;
  if (d.cif) s += 1;
  if (d.nombre) s += 0.5;
  if (d.importe != null) s += 1;
  if (d.fecha) s += 1;
  if (d.localidad) s += 0.5;
  if (d.numero_factura) s += 0.5;
  if (d.codigo_fiscal) s += 0.5;
  if (d.archivos && d.archivos.length) s += 1;
  if (d.confianza_ocr) s += d.confianza_ocr;
  // Estado más avanzado en ciclo suma calidad
  const estadoPeso: Record<string, number> = {
    pagada: 3, en_administracion: 2.5, aprobado_gerencia: 2, pendiente: 1, registrado: 2, borrador: 0.5,
    incluida_111: 3, procesado: 1.5, revision_manual: 0.5,
  };
  if (d.estado && estadoPeso[d.estado] != null) s += estadoPeso[d.estado];
  return s;
}

// ── Mapeadores por entidad ────────────────────────────────────
export function mapRegistroGasto(r: any): DocEconomico {
  const archivos = Array.isArray(r.archivos) ? r.archivos : [];
  const hora = r.hora_documento ? String(r.hora_documento) : '';
  const d: Partial<DocEconomico> = {
    id: r.id,
    entidad: 'registro_gasto',
    entidad_label: 'Gasto técnico',
    fecha: r.fecha_documento,
    hora,
    importe: r.importe,
    cif: normalizarCif(r.nif_comercio || r.proveedor_nif),
    nombre: r.nombre_comercio,
    localidad: r.localidad,
    numero_factura: normalizarNumero(r.numero_factura),
    codigo_fiscal: normalizarNumero(r.codigo_validacion_fiscal),
    operario_name: r.operario_name,
    operario_email: r.operario_email,
    estado: r.estado,
    categoria: r.categoria,
    obra_name: r.obra_name,
    archivos,
    confianza_ocr: r.confianza_ocr,
    tiene_hora: !!hora,
  };
  d.calidad = calidadDe(d);
  return d as DocEconomico;
}

export function mapFacturaAutonomo(r: any): DocEconomico {
  const archivos = Array.isArray(r.archivos) ? r.archivos : (r.file_url ? [{ url: r.file_url }] : []);
  const d: Partial<DocEconomico> = {
    id: r.id,
    entidad: 'factura_autonomo',
    entidad_label: 'Factura autónomo',
    fecha: r.fecha_factura,
    hora: '',
    importe: r.base_imponible,
    cif: normalizarCif(r.nif_autonomo),
    nombre: r.nombre_autonomo,
    localidad: '',
    numero_factura: normalizarNumero(r.numero_factura),
    codigo_fiscal: '',
    operario_name: r.subido_por_nombre,
    operario_email: r.subido_por,
    estado: r.estado,
    categoria: 'factura_autonomo',
    obra_name: r.obra_name,
    archivos,
    confianza_ocr: r.confianza_ocr,
    tiene_hora: false,
  };
  d.calidad = calidadDe(d);
  return d as DocEconomico;
}

export function mapNomina(r: any): DocEconomico {
  const archivos = r.file_url ? [{ url: r.file_url }] : [];
  const mes = String(r.mes || '').padStart(2, '0');
  const fecha = r.anio && r.mes ? `${r.anio}-${mes}-01` : undefined;
  const d: Partial<DocEconomico> = {
    id: r.id,
    entidad: 'nomina',
    entidad_label: 'Nómina',
    fecha,
    hora: '',
    importe: r.liquido_percibir,
    cif: normalizarCif(r.operario_dni),
    nombre: r.operario_name,
    localidad: '',
    numero_factura: '',
    codigo_fiscal: '',
    operario_name: r.operario_name,
    operario_email: r.operario_user_email,
    estado: r.tipo_documento === 'resumen_costes' ? 'resumen_costes' : 'nomina_individual',
    categoria: 'nomina',
    archivos,
    tiene_hora: false,
  };
  d.calidad = calidadDe(d);
  return d as DocEconomico;
}

export function mapPresupuesto(r: any): DocEconomico {
  const archivos = r.file_url ? [{ url: r.file_url }] : [];
  const d: Partial<DocEconomico> = {
    id: r.id,
    entidad: 'presupuesto',
    entidad_label: 'Presupuesto',
    fecha: r.fecha,
    hora: '',
    importe: r.importe,
    cif: normalizarCif(r.cliente_id),
    nombre: r.cliente_name,
    localidad: '',
    numero_factura: normalizarNumero(r.codigo_registro),
    codigo_fiscal: '',
    operario_name: '',
    estado: r.estado,
    categoria: 'presupuesto',
    archivos,
    tiene_hora: false,
  };
  d.calidad = calidadDe(d);
  return d as DocEconomico;
}

// ── Comparación de pares ──────────────────────────────────────
export interface ScorePar {
  score: number;            // 0..1
  severidad: 'critico' | 'alto' | 'medio' | 'bajo';
  motivos: string[];
  es_duplicado: boolean;
}

export function compararPar(a: DocEconomico, b: DocEconomico): ScorePar {
  const motivos: string[] = [];
  let score = 0;
  let maxPosible = 0;

  // CIF / NIF (peso alto)
  if (a.cif && b.cif) {
    maxPosible += 0.3;
    if (a.cif === b.cif) { score += 0.3; motivos.push('CIF/NIF idéntico'); }
  }

  // Importe
  if (a.importe != null && b.importe != null) {
    maxPosible += 0.25;
    const diff = Math.abs((a.importe || 0) - (b.importe || 0));
    if (diff < 0.01) { score += 0.25; motivos.push('importe idéntico'); }
    else if (diff < 0.5) { score += 0.15; motivos.push('importe muy similar'); }
  }

  // Fecha
  if (a.fecha && b.fecha) {
    maxPosible += 0.2;
    const [ya, ma, da] = a.fecha.split('-').map(Number);
    const [yb, mb, db] = b.fecha.split('-').map(Number);
    const diffDays = Math.abs(
      Date.UTC(ya, ma - 1, da) - Date.UTC(yb, mb - 1, db)
    ) / 86400000;
    if (diffDays === 0) { score += 0.2; motivos.push('fecha idéntica'); }
    else if (diffDays === 1) { score += 0.1; motivos.push('fecha ±1 día'); }
  }

  // Nombre / comercio
  if (a.nombre && b.nombre) {
    maxPosible += 0.15;
    const sim = similitudTexto(a.nombre, b.nombre);
    if (sim >= 0.95) { score += 0.15; motivos.push(`comercio idéntico (${Math.round(sim * 100)}%)`); }
    else if (sim >= 0.85) { score += 0.1; motivos.push(`comercio muy similar (${Math.round(sim * 100)}%)`); }
    else if (sim >= 0.75) { score += 0.05; motivos.push(`comercio parecido (${Math.round(sim * 100)}%)`); }
  }

  // Número de factura / código fiscal (match exacto → casi seguro)
  if (a.numero_factura && b.numero_factura) {
    if (a.numero_factura === b.numero_factura) {
      score += 0.4; // fuerza score alto
      maxPosible = Math.max(maxPosible, 1);
      motivos.push('nº factura idéntico');
    }
  }
  if (a.codigo_fiscal && b.codigo_fiscal) {
    if (a.codigo_fiscal === b.codigo_fiscal) {
      score += 0.4;
      maxPosible = Math.max(maxPosible, 1);
      motivos.push('código validación fiscal idéntico');
    }
  }

  // Localidad
  if (a.localidad && b.localidad) {
    maxPosible += 0.05;
    if (normalizarTexto(a.localidad) === normalizarTexto(b.localidad)) {
      score += 0.05; motivos.push('localidad idéntica');
    }
  }

  const normalized = maxPosible > 0 ? score / Math.max(maxPosible, 1) : 0;

  // REGLA CLAVE: si importe + fecha + comercio coinciden pero ambos tienen
  // HORA distinta → son tramos sucesivos (peajes), NO duplicado.
  if (
    a.tiene_hora && b.tiene_hora &&
    a.hora && b.hora && a.hora !== b.hora &&
    a.fecha && b.fecha && a.fecha === b.fecha &&
    a.importe != null && b.importe != null && Math.abs(a.importe - b.importe) < 0.01
  ) {
    return { score: 0, severidad: 'bajo', motivos: ['Hora distinta en mismo día/importe → tramos sucesivos, no duplicado'], es_duplicado: false };
  }

  // Misma entidad + mismo operario + misma fecha + mismo importe → muy probable
  let severidad: ScorePar['severidad'] = 'bajo';
  let esDuplicado = false;
  if (normalized >= 0.85 || (a.numero_factura && b.numero_factura && a.numero_factura === b.numero_factura)) {
    severidad = 'critico';
    esDuplicado = true;
  } else if (normalized >= 0.65) {
    severidad = 'alto';
    esDuplicado = true;
  } else if (normalized >= 0.45) {
    severidad = 'medio';
    esDuplicado = true;
  }

  return { score: normalized, severidad, motivos, es_duplicado: esDuplicado };
}

// ── Agrupación por union-find ──────────────────────────────────
export interface GrupoDuplicado {
  miembros: DocEconomico[];
  score_medio: number;
  severidad: 'critico' | 'alto' | 'medio' | 'bajo';
  conservar_id: string;   // propuesta del mejor
  par_scores: Record<string, number>; // clave "idA|idB" → score
}

export function agruparDuplicados(
  docs: DocEconomico[],
  umbral: 'critico' | 'alto' | 'medio' | 'bajo' = 'medio'
): GrupoDuplicado[] {
  const ordenSeveridad = { critico: 4, alto: 3, medio: 2, bajo: 1 };
  const minNivel = ordenSeveridad[umbral];

  // Union-find
  const parent: Record<string, string> = {};
  const find = (x: string): string => {
    if (parent[x] === undefined) parent[x] = x;
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  };
  const union = (a: string, b: string) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const parScores: Record<string, number> = {};

  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const a = docs[i], b = docs[j];
      // Solo comparar dentro de la misma entidad (cruce entre entidades genera
      // ruido salvo casos muy puntuales; el caso real de duplicados es intra-entidad).
      if (a.entidad !== b.entidad) continue;
      const sc = compararPar(a, b);
      if (sc.es_duplicado && ordenSeveridad[sc.severidad] >= minNivel) {
        union(a.id, b.id);
        parScores[`${a.id}|${b.id}`] = sc.score;
        parScores[`${b.id}|${a.id}`] = sc.score;
      }
    }
  }

  // Agrupar por raíz
  const gruposMap: Record<string, DocEconomico[]> = {};
  for (const d of docs) {
    const r = find(d.id);
    if (!gruposMap[r]) gruposMap[r] = [];
    gruposMap[r].push(d);
  }

  const grupos: GrupoDuplicado[] = [];
  for (const r of Object.keys(gruposMap)) {
    const miembros = gruposMap[r];
    if (miembros.length < 2) continue;
    // Mejor por calidad
    const mejor = [...miembros].sort((x, y) => y.calidad - x.calidad)[0];
    // Severidad del grupo = máxima entre sus pares
    let sevMax: GrupoDuplicado['severidad'] = 'bajo';
    let scoreSum = 0, scoreCount = 0;
    for (let i = 0; i < miembros.length; i++) {
      for (let j = i + 1; j < miembros.length; j++) {
        const sc = compararPar(miembros[i], miembros[j]);
        if (ordenSeveridad[sc.severidad] > ordenSeveridad[sevMax]) sevMax = sc.severidad;
        if (sc.es_duplicado) { scoreSum += sc.score; scoreCount++; }
      }
    }
    grupos.push({
      miembros,
      score_medio: scoreCount ? scoreSum / scoreCount : 0,
      severidad: sevMax,
      conservar_id: mejor.id,
      par_scores: parScores,
    });
  }

  // Ordenar: críticos primero, luego más miembros
  grupos.sort((a, b) => ordenSeveridad[b.severidad] - ordenSeveridad[a.severidad] || b.miembros.length - a.miembros.length);
  return grupos;
}