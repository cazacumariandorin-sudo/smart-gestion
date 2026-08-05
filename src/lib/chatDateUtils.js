import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Utilidades defensivas para formatear fechas en el chat.
 * date-fns `format` lanza RangeError "Invalid time value" sobre fechas inválidas,
 * lo que rompe el render y produce pantalla blanca. Estas helpers nunca lanzan.
 */

export function toValidDate(value) {
  if (value === null || value === undefined || value === '') return null;
  // Si ya es Date, validar; si es string/número, parsear
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function safeTimeFormat(value, fmt = 'HH:mm') {
  const d = toValidDate(value);
  if (!d) return '';
  try {
    return format(d, fmt);
  } catch {
    return '';
  }
}

export function safeToISO(value) {
  const d = toValidDate(value);
  if (!d) return null;
  try {
    return d.toISOString();
  } catch {
    return null;
  }
}

export function safeSeparatorLabel(value) {
  const d = toValidDate(value);
  if (!d) return null; // el llamador debe omitir el separador
  try {
    if (isToday(d)) return 'Hoy';
    if (isYesterday(d)) return 'Ayer';
    return format(d, "EEEE d 'de' MMMM", { locale: es });
  } catch {
    return null;
  }
}