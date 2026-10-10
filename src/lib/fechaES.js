const p2 = (n) => String(n).padStart(2, '0');

/** Fecha en español dd-mm-aaaa. Acepta 'YYYY-MM-DD', ISO con hora o Date. */
export function fechaES(valor) {
  if (!valor) return '';
  if (valor instanceof Date) return `${p2(valor.getDate())}-${p2(valor.getMonth() + 1)}-${valor.getFullYear()}`;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  if (m) return `${m[3]}-${m[2]}-${m[1]}`; // sin pasar por Date: evita desfases de zona horaria
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? String(valor) : fechaES(d);
}

/** Fecha y hora en español: dd-mm-aaaa HH:mm */
export function fechaHoraES(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  return `${fechaES(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
