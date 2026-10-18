export function money(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const text = Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return `${v < 0 ? '-' : ''}₹${text}`;
}

export function dateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function minutes(n) {
  if (n === null || n === undefined) return '—';
  return `${n} min`;
}