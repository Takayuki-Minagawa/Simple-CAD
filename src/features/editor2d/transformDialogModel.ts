export type TransformMode = 'move' | 'copy' | 'scale' | 'stretch' | 'offset' | 'mirror' | 'array';

export function formatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function parseNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCount(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
