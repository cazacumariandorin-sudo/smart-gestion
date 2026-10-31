const formatoEur = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

export const eur = (n) => formatoEur.format(Number(n) || 0);

export const sgn = (n) => `${Number(n) > 0 ? '+' : ''}${eur(n)}`;

export const pct = (n) => `${((Number(n) || 0) * 100).toFixed(2)} %`;