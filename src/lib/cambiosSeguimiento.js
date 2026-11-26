/**
 * Comprobación de cambios del seguimiento de un proyecto.
 *
 * Guarda en el navegador el momento de la última revisión de cada proyecto y
 * compara con él las altas y modificaciones de los registros que alimentan
 * Implementación proyectos (documentos, partes, materiales, fotos, fichajes,
 * presupuestos y discrepancias).
 */

const claveRevision = (obraId) => `sg_impl_ultima_revision_${obraId}`;

const ms = (valor) => {
  if (!valor) return 0;
  const t = new Date(valor).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const ultimaFecha = (registros) =>
  registros.reduce((max, r) => {
    const t = ms(r.updated_date) || ms(r.created_date);
    return t > max ? t : max;
  }, 0);

/** Fecha ISO de la última revisión guardada del proyecto (o null si no hay). */
export function leerUltimaRevision(obraId) {
  if (!obraId) return null;
  try {
    return localStorage.getItem(claveRevision(obraId)) || null;
  } catch {
    return null;
  }
}

/** Fija el momento actual como última revisión y lo devuelve en ISO. */
export function guardarUltimaRevision(obraId, fecha = new Date().toISOString()) {
  if (!obraId) return fecha;
  try {
    localStorage.setItem(claveRevision(obraId), fecha);
  } catch {
    /* almacenamiento no disponible: la revisión no se conserva */
  }
  return fecha;
}

/**
 * Cambios posteriores a `desdeIso`.
 *
 * Cada fuente: { tipo, etiqueta, registros, titulo(r), detalle(r | lista), pestana, agrupar }
 * - agrupar: true devuelve una sola entrada con el recuento de registros afectados.
 */
export function detectarCambios(fuentes, desdeIso) {
  const desde = ms(desdeIso);
  const cambios = [];

  (fuentes || []).forEach((fuente) => {
    const registros = fuente.registros || [];
    const afectados = registros.filter((r) => (ms(r.updated_date) || ms(r.created_date)) > desde);

    if (afectados.length === 0) return;

    if (fuente.agrupar) {
      cambios.push({
        clave: `${fuente.tipo}-grupo`,
        tipo: fuente.tipo,
        etiqueta: fuente.etiqueta,
        titulo: `${afectados.length} ${fuente.etiqueta.toLowerCase()}`,
        detalle: fuente.detalle ? fuente.detalle(afectados) : '',
        fecha: new Date(ultimaFecha(afectados)).toISOString(),
        nuevo: afectados.some((r) => ms(r.created_date) > desde),
        pestana: fuente.pestana,
      });
      return;
    }

    afectados.forEach((r) => {
      const creado = ms(r.created_date);
      cambios.push({
        clave: `${fuente.tipo}-${r.id}`,
        tipo: fuente.tipo,
        etiqueta: fuente.etiqueta,
        titulo: fuente.titulo(r),
        detalle: fuente.detalle ? fuente.detalle(r) : '',
        fecha: r.updated_date || r.created_date,
        nuevo: creado > desde,
        pestana: fuente.pestana,
      });
    });
  });

  return cambios.sort((a, b) => ms(b.fecha) - ms(a.fecha));
}

const limpiar = (texto) => String(texto || '').replace(/_/g, ' ');
const fechaCorta = (valor) => (valor ? String(valor).slice(0, 10).split('-').reverse().join('/') : '');
const horasDe = (fichajes) =>
  fichajes.reduce((total, f) => total + Number(f.horas_trabajadas || 0), 0);

/** Fuentes de seguimiento del proyecto a partir de los datos ya cargados. */
export function fuentesSeguimiento({
  documentos = [],
  manuales = [],
  partes = [],
  materiales = [],
  fotos = [],
  fichajes = [],
  presupuestos = [],
  discrepancias = [],
}) {
  return [
    {
      tipo: 'documento',
      etiqueta: 'Documento',
      registros: documentos,
      pestana: 'informes',
      titulo: (d) => `${limpiar(d.tipo) || 'Documento'}${d.numero_documento ? ` · ${d.numero_documento}` : ''}`,
      detalle: (d) => [d.revision && `Rev. ${d.revision}`, d.estado && limpiar(d.estado)].filter(Boolean).join(' · '),
    },
    {
      tipo: 'manual',
      etiqueta: 'Manual',
      registros: manuales,
      pestana: 'informes',
      titulo: (m) => m.title || 'Manual',
      detalle: (m) => [m.categoria, m.version && `v${m.version}`].filter(Boolean).join(' · '),
    },
    {
      tipo: 'parte',
      etiqueta: 'Parte diario',
      registros: partes,
      pestana: 'informes',
      titulo: (p) => `Parte del ${fechaCorta(p.fecha)}${p.tecnico_name ? ` · ${p.tecnico_name}` : ''}`,
      detalle: (p) => (p.estado === 'cerrado' ? 'Cerrado' : 'Borrador'),
    },
    {
      tipo: 'material',
      etiqueta: 'Material pendiente',
      registros: materiales,
      pestana: 'materiales',
      titulo: (m) => m.descripcion || 'Material',
      detalle: (m) => limpiar(m.estado),
    },
    {
      tipo: 'fotos',
      etiqueta: 'Fotos',
      registros: fotos,
      agrupar: true,
      pestana: 'fotos',
      detalle: (lista) => {
        const validadas = lista.filter((f) => f.validada).length;
        return validadas ? `${validadas} validada(s) por gerencia` : 'Pendientes de validar';
      },
    },
    {
      tipo: 'fichajes',
      etiqueta: 'Fichajes',
      registros: fichajes,
      agrupar: true,
      pestana: 'horas',
      detalle: (lista) => `${horasDe(lista).toLocaleString('es-ES', { maximumFractionDigits: 1 })} h registradas`,
    },
    {
      tipo: 'presupuesto',
      etiqueta: 'Presupuesto',
      registros: presupuestos,
      pestana: 'materiales',
      titulo: (p) => p.titulo || p.codigo_registro || 'Presupuesto',
      detalle: (p) => [limpiar(p.estado), !p.obra_id && 'sin obra asignada'].filter(Boolean).join(' · '),
    },
    {
      tipo: 'discrepancia',
      etiqueta: 'Discrepancia',
      registros: discrepancias,
      pestana: 'discrepancias',
      titulo: (d) => d.descripcion || limpiar(d.tipo) || 'Discrepancia',
      detalle: (d) => limpiar(d.estado),
    },
  ];
}