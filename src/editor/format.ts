// Writes JSON the way people write it by hand: short things (and one placed object) on one line,
// long things one item per line.
// expand = how many levels are always opened up (kinds.json opens each kind, scenes only the top).
export function formatJson(value: unknown, expand = 0, indent = ''): string {
  const flat = oneLine(value);
  if (value === null || typeof value !== 'object') return flat;
  const leaf = Object.values(value).every((v) => v === null || typeof v !== 'object');
  if (expand <= 0 && (leaf || indent.length + flat.length <= 100)) return flat;
  const inner = indent + '  ';
  const items = Array.isArray(value)
    ? value.map((v) => inner + formatJson(v, expand - 1, inner))
    : Object.entries(value).map(([k, v]) => `${inner}${JSON.stringify(k)}: ${formatJson(v, expand - 1, inner)}`);
  if (!items.length) return flat;
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return `${open}\n${items.join(',\n')}\n${indent}${close}`;
}

function oneLine(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(oneLine).join(', ')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length ? `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${oneLine(v)}`).join(', ')} }` : '{}';
  }
  return JSON.stringify(value);
}
