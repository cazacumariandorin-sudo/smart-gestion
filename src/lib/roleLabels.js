export const ROLE_LABELS = {
  admin:              { label: 'Administrador',    className: 'bg-red-100 text-red-700 border-red-200' },
  propietario:        { label: 'Propietario',       className: 'bg-red-100 text-red-700 border-red-200' }, // alias de admin
  gerencia:           { label: 'Gerencia',         className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  director_comercial: { label: 'Director Comercial', className: 'bg-violet-100 text-violet-700 border-violet-200' },
  jefe_obra:          { label: 'Jefe de Obra',     className: 'bg-blue-100 text-blue-700 border-blue-200' },
  técnico:            { label: 'Técnico',          className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }, // rol de campo principal
  operario:           { label: 'Técnico (legado)',  className: 'bg-emerald-100 text-emerald-700 border-emerald-200' }, // rol legado, mismo alcance que técnico
  control_horario:    { label: 'Control Horario',  className: 'bg-purple-100 text-purple-700 border-purple-200' },
  cliente_obra:       { label: 'Cliente Obra',     className: 'bg-orange-100 text-orange-700 border-orange-200' },
  usuario_demo:       { label: 'Demo',             className: 'bg-gray-100 text-gray-600 border-gray-200' },
  administracion:     { label: 'Administración',   className: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  contabilidad:       { label: 'Contabilidad',     className: 'bg-pink-100 text-pink-700 border-pink-200' },
};