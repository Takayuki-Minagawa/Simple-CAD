/**
 * Length-unit helpers for user input. The project data model is millimetre-fixed;
 * these helpers only interpret what a person (or an automation agent) typed.
 */

const LENGTH_TOKEN = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*(mm|m)?$/i;

/**
 * Parse one length token into millimetres. Bare numbers are millimetres; an
 * explicit `m` suffix multiplies by 1000 and `mm` is accepted as a no-op suffix.
 * Returns `null` for anything else (including unknown units such as `cm`).
 */
export function parseLengthMm(token: string): number | null {
  const match = token.trim().match(LENGTH_TOKEN);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  return match[2]?.toLowerCase() === 'm' ? value * 1000 : value;
}

/** Format a millimetre length for display in the requested unit. */
export function formatLength(mm: number, unit: 'mm' | 'm', decimals?: number): string {
  if (unit === 'm') return `${(mm / 1000).toFixed(decimals ?? 3)} m`;
  return `${mm.toFixed(decimals ?? 0)} mm`;
}
