// Utilidades del módulo Ingeniería (ObraCheck)

export const DISCREPANCIA_TIPO_LABEL = {
  punto_añadido: 'Punto añadido',
  punto_eliminado: 'Punto eliminado',
  cantidad_no_coincide: 'Cantidad no coincide',
  cantidad_puntos_pedido_vs_listado: 'Pedido vs listado (bulto)',
  precio_unitario_inconsistente_entre_proyectos: 'Precio inconsistente entre proyectos',
  precio_no_coincide: 'Precio no coincide',
  material_no_facturado: 'Material no facturado',
  material_no_especificado: 'Material no especificado',
  riesgo_precio_distancia: 'Riesgo por distancia',
  distancia_plano_vs_pedido: 'Distancia plano vs pedido',
  diseño_pendiente: 'Diseño pendiente',
  especificacion_tecnica_inconsistente: 'Espec. técnica inconsistente',
};

export const SEVERIDAD_STYLE = {
  alta: 'bg-red-100 text-red-700 border-red-300',
  media: 'bg-amber-100 text-amber-700 border-amber-300',
  baja: 'bg-emerald-100 text-emerald-700 border-emerald-300',
};

export const ESTADO_DISCREP_STYLE = {
  abierta: 'bg-red-50 text-red-700 border-red-200',
  revisada: 'bg-amber-50 text-amber-700 border-amber-200',
  resuelta: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  descartada: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const ESTADO_RIESGO_LABEL = {
  sin_datos: 'Sin datos',
  dentro_de_rango: 'Dentro de rango',
  fuera_de_rango_revisar: 'Fuera de rango (revisar)',
  sobrecoste_confirmado: 'Sobrecoste confirmado',
  infrafacturado_confirmado: 'Infrafacturado confirmado',
};

export const ESTADO_RIESGO_STYLE = {
  sin_datos: 'bg-slate-100 text-slate-600 border-slate-300',
  dentro_de_rango: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  fuera_de_rango_revisar: 'bg-amber-100 text-amber-700 border-amber-300',
  sobrecoste_confirmado: 'bg-red-100 text-red-700 border-red-300',
  infrafacturado_confirmado: 'bg-blue-100 text-blue-700 border-blue-300',
};

export const DOMINIO_LABEL = {
  control_bms: 'Control BMS',
  material_electrico_proceso: 'Material eléctrico/proceso',
  componente_mecanico: 'Componente mecánico',
};

export const TIPO_SEÑAL_LABEL = {
  EAP: 'EAP', EAA: 'EAA', ED: 'ED', EC: 'EC',
  SAP: 'SAP', SA3: 'SA3', SD: 'SD', INT: 'INT',
};

export const DISCIPLINA_LABEL = {
  bms: 'BMS',
  refrigeracion_industrial: 'Refrigeración industrial',
  climatizacion: 'Climatización',
  electricidad: 'Electricidad',
  otro: 'Otro',
};

export const moneda = (n) =>
  n == null ? '—' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);