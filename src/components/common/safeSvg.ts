const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'rect',
  'line',
  'polygon',
  'polyline',
  'path',
  'text',
  'tspan',
  'defs',
  'clipPath',
]);

const ALLOWED_ATTRIBUTES = new Set([
  'xmlns',
  'width',
  'height',
  'viewBox',
  'class',
  'id',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'dx',
  'dy',
  'd',
  'points',
  'transform',
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-size',
  'font-family',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-anchor',
  'dominant-baseline',
  'clip-path',
]);

function hasUnsafeControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint < 32 && codePoint !== 9 && codePoint !== 10 && codePoint !== 13) return true;
  }
  return false;
}

function isSafeAttribute(name: string, value: string): boolean {
  if (!ALLOWED_ATTRIBUTES.has(name)) return false;
  if (hasUnsafeControlCharacter(value)) return false;
  if (/javascript\s*:|data\s*:|expression\s*\(/i.test(value)) return false;
  if (/^on/i.test(name) || name === 'href' || name === 'xlink:href' || name === 'style')
    return false;
  if (name === 'clip-path') return /^url\(#[A-Za-z][\w:.-]*\)$/.test(value);
  if ((name === 'fill' || name === 'stroke') && /url\s*\(/i.test(value)) return false;
  if (name === 'id') return /^[A-Za-z][\w:.-]*$/.test(value);
  return true;
}

/** Parse and rebuild an SVG using a strict CAD-preview allowlist. */
export function sanitizeSvgMarkup(markup: string): SVGSVGElement | null {
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) return null;
  const root = parsed.documentElement;
  if (root.localName !== 'svg') return null;

  const elements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of elements) {
    if (!ALLOWED_ELEMENTS.has(element.localName)) {
      element.remove();
      continue;
    }
    for (const attribute of Array.from(element.attributes)) {
      if (!isSafeAttribute(attribute.name, attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  return document.importNode(root, true) as unknown as SVGSVGElement;
}
