/**
 * clientesImport — lectura y comparación del export de CLIENTES del programa de contabilidad
 * contra la tabla Client. Funciones puras (sin acceso a datos). FASE 1: solo análisis,
 * no escribe nada.
 *
 * Reglas:
 *  - Clave de identidad: NIF normalizado (mayúsculas, sin espacios/tabuladores/guiones).
 *  - Solo se lee la sección CLIENTES. PROVEEDORES se cuenta y se ignora (nunca van a Client).
 *  - Nunca se importan: cuentas bancarias, notas privadas, campos personalizados, fax,
 *    descuento ni coordenadas.
 *  - Nada se vincula ni se crea por parecido de nombre: un parecido fuerte exige revisión.
 */
import { decodificar, detectarSeparador, parseFilas } from './ivaImport.js';

export { decodificar };

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (s) => sinAcentos(s).trim().toUpperCase();
export const limpiaNif = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const LETRAS_NIF = 'TRWAGMYFPDXBNJZSQVHLCKE';

export function nifValido(raw) {
  const s = limpiaNif(raw);
  if (s.length !== 9) return false;
  if (/^\d{8}[A-Z]$/.test(s)) return LETRAS_NIF[parseInt(s.slice(0, 8), 10) % 23] === s[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(s)) return LETRAS_NIF[parseInt('XYZ'.indexOf(s[0]) + s.slice(1, 8), 10) % 23] === s[8];
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(s)) {
    let suma = 0;
    s.slice(1, 8).split('').map(Number).forEach((x, i) => {
      if (i % 2 === 0) { const y = x * 2; suma += Math.floor(y / 10) + (y % 10); } else suma += x;
    });
    const c = (10 - (suma % 10)) % 10;
    const letra = 'JABCDEFGHI'[c];
    if ('PQRSNW'.includes(s[0])) return s[8] === letra;
    if ('ABEH'.includes(s[0])) return s[8] === String(c);
    return s[8] === String(c) || s[8] === letra;
  }
  if (/^[KLM]\d{7}[A-Z]$/.test(s)) return true;
  return false;
}

export const esPersonaFisica = (nif) => /^\d{8}[A-Z]$/.test(limpiaNif(nif)) || /^[XYZ]\d{7}[A-Z]$/.test(limpiaNif(nif));
/** NIF de relleno: B00010000, B12345678, muchos ceros, etc. */
export const esNifRelleno = (nif) => { const s = limpiaNif(nif); return /0{5,}/.test(s.slice(1)) || /123456/.test(s) || /^(.)\1{7,}/.test(s.slice(1)); };

const FORMAS = /\b(S\s?L\s?U|S\s?L|S\s?A\s?U|S\s?A|C\s?B|S\s?COOP|SDAD|COOP|MAD)\b/g;
/** Nombre normalizado con palabras ORDENADAS: "García Saavedra Juan" == "Juan García Saavedra". */
export function claveNombre(s) {
  const t = sinAcentos(s).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(FORMAS, ' ').replace(/\s+/g, ' ').trim();
  return t.split(' ').filter(Boolean).sort().join(' ');
}
function distancia(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
export const similitud = (a, b) => { const x = claveNombre(a), y = claveNombre(b); const L = Math.max(x.length, y.length); return L ? 1 - distancia(x, y) / L : 0; };
const normTexto = (s) => sinAcentos(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

/* ───────── Lectura del archivo ───────── */
const COL = {
  nif: 'NIF', name: 'NOMBRE O RAZON SOCIAL', email: 'EMAIL', tel: 'TELF.', movil: 'MOVIL',
  address: 'DIRECCION', cp: 'COD. POSTAL', localidad: 'POBLACION', provincia: 'PROVINCIA', pais: 'PAIS', web: 'URL',
};

export function leerSecciones(texto) {
  const rows = parseFilas(texto, detectarSeparador(texto));
  const out = { clientes: [], proveedores: [], conSecciones: false };
  let sec = null;
  let cols = null;
  for (const r of rows) {
    const p = norm(r[0]);
    const resto = r.slice(1).every((c) => !c);
    if ((p === 'CLIENTES' || p === 'PROVEEDORES') && resto) { sec = p; out.conSecciones = true; cols = null; continue; }
    if (p === 'NIF' && norm(r[1]).startsWith('NOMBRE')) { cols = r.map(norm); if (!sec) sec = 'CLIENTES'; continue; }
    if (!cols || !sec || !r.some((c) => c)) continue;
    const g = (k) => { const i = cols.indexOf(COL[k]); return i >= 0 ? (r[i] || '').trim() : ''; };
    const reg = {
      nifOriginal: g('nif'), nif: limpiaNif(g('nif')), name: g('name'), email: g('email'),
      telefono: g('tel') || g('movil'), address: g('address'), postal_code: g('cp').replace(/\D/g, '') || g('cp'),
      localidad: g('localidad'), provincia: g('provincia'), pais: g('pais'), web: g('web'),
    };
    (sec === 'CLIENTES' ? out.clientes : out.proveedores).push({ ...reg, linea: (sec === 'CLIENTES' ? out.clientes : out.proveedores).length + 1 });
  }
  return out;
}

const CAMPOS = ['name', 'address', 'postal_code', 'localidad', 'provincia', 'pais', 'telefono', 'email', 'web'];

function compararCampos(ex, csv) {
  const cambios = [];
  if ((ex.nif || '') !== csv.nif && limpiaNif(ex.nif) === csv.nif) cambios.push({ campo: 'nif', de: ex.nif ?? '', a: csv.nif, tipo: 'limpieza' });
  for (const c of CAMPOS) {
    const nuevo = (csv[c] || '').trim();
    const actual = (ex[c] || '').trim();
    if (!nuevo) continue;
    if (!actual) { cambios.push({ campo: c, de: '', a: nuevo, tipo: 'rellenar' }); continue; }
    const igual = c === 'name' ? claveNombre(actual) === claveNombre(nuevo) : normTexto(actual) === normTexto(nuevo);
    if (!igual) cambios.push({ campo: c, de: actual, a: nuevo, tipo: 'diferencia' });
  }
  return cambios;
}

/** Problemas que YA hay en la tabla Client (independientes del archivo). */
export function duplicadosEnApp(clientesApp) {
  const res = [];
  const porNif = new Map();
  const porNombre = new Map();
  for (const c of clientesApp) {
    const n = limpiaNif(c.nif);
    if (n) porNif.set(n, [...(porNif.get(n) || []), c]);
    const k = claveNombre(c.name);
    if (k) porNombre.set(k, [...(porNombre.get(k) || []), c]);
  }
  for (const [n, a] of porNif) if (a.length > 1) res.push({ tipo: 'mismo NIF', clave: n, clientes: a.map((c) => ({ id: c.id, name: c.name })) });
  for (const [k, a] of porNombre) if (a.length > 1 && !res.some((r) => r.clientes.every((c) => a.some((x) => x.id === c.id)))) res.push({ tipo: 'mismo nombre', clave: k, clientes: a.map((c) => ({ id: c.id, name: c.name })) });
  return res;
}

/**
 * @param texto       contenido decodificado del CSV
 * @param clientesApp registros actuales de Client (id, name, nif, address, ...)
 * @param opciones    { nifsPropios?: string[] }  CIF de la propia empresa
 */
export function analizarClientes(texto, clientesApp = [], opciones = {}) {
  const { clientes, proveedores, conSecciones } = leerSecciones(texto);
  const propios = new Set((opciones.nifsPropios || []).map(limpiaNif).filter(Boolean));
  const porNif = new Map();
  const porClaveNombre = new Map();
  for (const c of clientesApp) {
    const n = limpiaNif(c.nif);
    if (n) porNif.set(n, [...(porNif.get(n) || []), c]);
    const k = claveNombre(c.name);
    if (k) porClaveNombre.set(k, [...(porClaveNombre.get(k) || []), c]);
  }
  const vecesEnCsv = new Map();
  clientes.forEach((c) => c.nif && vecesEnCsv.set(c.nif, (vecesEnCsv.get(c.nif) || 0) + 1));

  const filas = clientes.map((csv) => {
    const avisos = [];
    const f = { linea: csv.linea, csv, accion: 'crear', motivo: '', existente: null, candidatos: [], cambios: [], avisos, particular: esPersonaFisica(csv.nif) };
    const revisar = (m) => { f.accion = 'revisar'; f.motivo = f.motivo || m; };
    const conflicto = (m) => { f.accion = 'conflicto'; f.motivo = m; };
    if (!csv.name) avisos.push('Sin nombre en el CSV');

    if (!csv.nif) { revisar('Sin NIF: no se puede identificar al cliente'); }
    else if (propios.has(csv.nif)) { conflicto('NIF de la propia empresa'); return f; }
    else if (vecesEnCsv.get(csv.nif) > 1) { conflicto('NIF repetido en el CSV'); return f; }
    else {
      if (esNifRelleno(csv.nif)) revisar('NIF de relleno (no real)');
      else if (!nifValido(csv.nif)) avisos.push('El NIF no supera la validación');
      const ex = porNif.get(csv.nif) || [];
      if (ex.length > 1) { conflicto(`Hay ${ex.length} clientes en la app con este NIF: resolverlo antes`); f.candidatos = ex.map((c) => ({ id: c.id, name: c.name })); return f; }
      if (ex.length === 1) {
        f.existente = { id: ex[0].id, name: ex[0].name, nif: ex[0].nif };
        f.cambios = compararCampos(ex[0], csv);
        if (f.accion === 'crear') { f.accion = f.cambios.length ? 'actualizar' : 'sin_cambios'; }
        return f;
      }
    }
    // Sin coincidencia por NIF: nunca se crea si hay un cliente con nombre igual o muy parecido
    const mismos = (porClaveNombre.get(claveNombre(csv.name)) || []);
    if (mismos.length) { f.candidatos = mismos.map((c) => ({ id: c.id, name: c.name, nif: c.nif || '' })); revisar('Ya existe un cliente con el mismo nombre'); return f; }
    const parecidos = clientesApp.map((c) => ({ c, s: similitud(c.name, csv.name) })).filter((x) => x.s >= 0.85).sort((a, b) => b.s - a.s).slice(0, 3);
    if (parecidos.length) { f.candidatos = parecidos.map((x) => ({ id: x.c.id, name: x.c.name, nif: x.c.nif || '', similitud: Math.round(x.s * 100) })); revisar('Nombre muy parecido a un cliente existente'); }
    return f;
  });

  const cuenta = (a) => filas.filter((f) => f.accion === a).length;
  return {
    formato: conSecciones ? 'export_contabilidad_secciones' : 'tabla_clientes',
    filas,
    resumen: {
      clientes: clientes.length,
      actualizar: cuenta('actualizar'), sin_cambios: cuenta('sin_cambios'), crear: cuenta('crear'), revisar: cuenta('revisar'), conflicto: cuenta('conflicto'),
      proveedores_ignorados: proveedores.length,
      particulares: filas.filter((f) => f.particular).length,
      con_diferencias: filas.filter((f) => f.cambios.some((c) => c.tipo === 'diferencia')).length,
      nif_con_limpieza: filas.filter((f) => f.cambios.some((c) => c.tipo === 'limpieza')).length,
      nif_invalidos: filas.filter((f) => f.csv.nif && !nifValido(f.csv.nif)).length,
      ausentes_en_csv: clientesApp.filter((c) => { const n = limpiaNif(c.nif); return n ? !vecesEnCsv.has(n) : true; }).length,
    },
    duplicadosApp: duplicadosEnApp(clientesApp),
    ignorado: ['CUENTAS BANCARIAS', 'NOTAS PRIVADAS', 'Personalizado1/2', 'FAX', '% DESCUENTO', 'LATITUD/LONGITUD'],
  };
}
