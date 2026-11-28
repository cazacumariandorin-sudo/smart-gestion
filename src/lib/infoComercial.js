import { base44 } from '@/api/base44Client';
import { PLANES } from '@/lib/planes';

/**
 * Ficha comercial de la app. Se guarda en InfoComercial (clave 'principal').
 * Si todavía no existe, la presentación y la demo usan estos valores por
 * defecto para que nunca se vean vacías.
 */
export const CLAVE_INFO = 'principal';

export const INFO_DEFECTO = {
  clave: CLAVE_INFO,
  marca: 'SMART-GESTION',
  titular: 'Toda la gestión de tu empresa de instalaciones, en un solo lugar',
  subtitulo: 'Obra civil, solar, personal, control horario y económico. Cada empresa trabaja en su propio espacio aislado, con sus módulos y sus permisos.',
  descripcion:
    'SMART-GESTION reúne en una sola aplicación lo que hoy está repartido entre hojas de cálculo, grupos de mensajes y carpetas: obras y proyectos, partes diarios, fichajes legales, vacaciones, presupuestos, materiales, gastos con justificante, flota y nóminas. Cada empresa ve solo lo suyo.',
  logo_url: 'https://media.base44.com/images/public/69de8e23b1cd7ac050397c82/93f897666_logoSimantecnew.png',
  hero_url: '',
  propuesta_valor: [
    'Un espacio independiente por empresa: sus datos, sus usuarios y sus permisos.',
    'Control horario con registro legal, cierre automático y exportación firmada.',
    'Del parte de trabajo al presupuesto y a la factura sin volver a teclear nada.',
    'Funciona en móvil y escritorio, también sin cobertura.',
  ],
  modulos: [
    { icono: 'obras', titulo: 'Obras y proyectos', descripcion: 'Informe de obras, previsiones, partes diarios, fotos y trabajos extras.' },
    { icono: 'solar', titulo: 'Solar', descripcion: 'Obras fotovoltaicas con materiales, legalizaciones y seguimiento.' },
    { icono: 'horario', titulo: 'Control horario', descripcion: 'Fichajes, apuntes, ausencias y registro legal listo para inspección.' },
    { icono: 'nominas', titulo: 'Nóminas y personal', descripcion: 'Simulador de nómina, costes por trabajador y expedientes.' },
    { icono: 'presupuestos', titulo: 'Presupuestos', descripcion: 'Partidas desde partes y documentos, versiones y PDF con tu marca.' },
    { icono: 'materiales', titulo: 'Materiales y compras', descripcion: 'Catálogo con histórico de precios, pedidos y material pendiente.' },
    { icono: 'flota', titulo: 'Flota y gastos', descripcion: 'Vehículos, multas, repostajes y gastos con justificante en un clic.' },
    { icono: 'chat', titulo: 'Chat interno', descripcion: 'Conversaciones por obra y avisos push al móvil del equipo.' },
  ],
  planes: PLANES.map((p) => ({
    clave: p.key,
    nombre: p.label,
    precio: 'A consultar',
    periodo: 'según empresa',
    resumen: p.descripcion,
    incluye: [],
    destacado: p.key === 'completo',
  })),
  cta_titulo: 'Pruébalo antes de decidir',
  cta_texto: 'Recorre la demo con datos de ejemplo, entra al espacio de prueba y, cuando lo tengas claro, pide tu versión comercial.',
  cta_boton: 'Solicitar versión comercial',
  contacto_email: '',
  contacto_telefono: '',
  web: '',
  nota_legal: 'Los datos que aparecen en la demo y en el espacio de prueba son ficticios y no pertenecen a ninguna empresa real.',
};

/** Lee la ficha comercial. Nunca lanza: devuelve los valores por defecto. */
export async function cargarInfoComercial() {
  try {
    const lista = await base44.entities.InfoComercial.filter({ clave: CLAVE_INFO });
    const registro = Array.isArray(lista) ? lista[0] : null;
    return { ...INFO_DEFECTO, ...(registro || {}), _registro: registro || null };
  } catch {
    return { ...INFO_DEFECTO, _registro: null };
  }
}

/** Guarda la ficha comercial del propietario (crea el registro la primera vez). */
export async function guardarInfoComercial(datos, email) {
  const { _registro, ...limpio } = datos;
  const payload = {
    ...limpio,
    clave: CLAVE_INFO,
    actualizado_por: email || '',
    actualizado_en: new Date().toISOString(),
  };
  if (_registro?.id) return base44.entities.InfoComercial.update(_registro.id, payload);
  return base44.entities.InfoComercial.create(payload);
}