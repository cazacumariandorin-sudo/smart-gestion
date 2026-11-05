/**
 * Catálogo de clasificación de la documentación interna (Protocolos internos).
 * Los cuatro criterios son los criterios empresariales de archivo documental.
 * Se usan tanto en el formulario como en las tarjetas y los filtros, para que
 * el valor guardado y la etiqueta mostrada nunca se desalineen.
 */

export const AREAS = [
  {
    value: 'rrhh',
    label: 'Recursos Humanos',
    short: 'RRHH',
    desc: 'Políticas de contratación, planes de igualdad, PRL, códigos de conducta, acogida y organigramas.',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    value: 'legal_compliance',
    label: 'Legal y Cumplimiento',
    short: 'Legal',
    desc: 'RGPD, normativa antifraude, canales de denuncia y actas de órganos de administración.',
    badge: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    value: 'finanzas_administracion',
    label: 'Finanzas y Administración',
    short: 'Finanzas',
    desc: 'Presupuestos internos, gastos de viaje, procedimientos de facturación y flujos de caja.',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    value: 'operaciones_ti',
    label: 'Operaciones y Tecnología (TI)',
    short: 'Operaciones',
    desc: 'Manuales de procesos operativos, seguridad informática, dispositivos corporativos y guías de sistemas.',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
];

export const CARACTERES = [
  {
    value: 'politica_obligatoria',
    label: 'Política obligatoria',
    desc: 'Rango superior aprobado por Dirección. Su incumplimiento puede derivar en sanción disciplinaria.',
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
  {
    value: 'procedimiento_sop',
    label: 'Procedimiento (SOP)',
    desc: 'Manual que explica cómo ejecutar un proceso paso a paso.',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    value: 'informativo',
    label: 'Informativo',
    desc: 'Circulares internas, comunicados corporativos, newsletters y tablón de anuncios.',
    badge: 'bg-gray-50 text-gray-700 border-gray-200',
  },
];

export const CONFIDENCIALIDADES = [
  {
    value: 'general',
    label: 'Público / general',
    desc: 'Accesible para toda la plantilla.',
    badge: 'bg-green-50 text-green-700 border-green-200',
  },
  {
    value: 'restringido',
    label: 'Restringido / interno',
    desc: 'Solo empleados de la empresa, sin datos altamente sensibles.',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    value: 'confidencial',
    label: 'Confidencial / alta dirección',
    desc: 'Solo dirección, gerencia y administración. No lo ve el resto de la plantilla.',
    badge: 'bg-red-50 text-red-700 border-red-200',
  },
];

export const VIGENCIAS = [
  {
    value: 'vivo',
    label: 'Vivo / dinámico',
    desc: 'Sujeto a revisiones y actualizaciones periódicas.',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    value: 'historico',
    label: 'Histórico / archivo',
    desc: 'Documentación de conservación obligada durante un periodo (p. ej. registros horarios, 4 años).',
    badge: 'bg-gray-50 text-gray-700 border-gray-200',
  },
];

export const opciones = (lista) => lista.map(o => ({ value: o.value, label: o.label }));

export const buscar = (lista, value) =>
  lista.find(o => o.value === value) || { value, label: value, badge: 'bg-muted text-muted-foreground' };

export const ETIQUETA_CRITERIO = {
  area: 'Área funcional',
  caracter: 'Carácter normativo',
  confidencialidad: 'Confidencialidad',
  vigencia: 'Vigencia',
};