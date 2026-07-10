import { describe, expect, it } from 'vitest';
import { sanitizeSvgMarkup } from '../safeSvg';

describe('sanitizeSvgMarkup', () => {
  it('removes scripts, event handlers, links, and unsafe paint URLs', () => {
    const svg = sanitizeSvgMarkup(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)">
        <script>alert(1)</script>
        <foreignObject><div>unsafe</div></foreignObject>
        <rect id="safe" width="10" height="10" fill="url(javascript:alert(1))" onclick="alert(1)"/>
        <a href="javascript:alert(1)"><text x="1" y="1">bad link</text></a>
      </svg>
    `);

    expect(svg).not.toBeNull();
    expect(svg!.querySelector('script')).toBeNull();
    expect(svg!.querySelector('foreignObject')).toBeNull();
    expect(svg!.querySelector('a')).toBeNull();
    expect(svg!.getAttribute('onload')).toBeNull();
    const rect = svg!.querySelector('rect')!;
    expect(rect.getAttribute('onclick')).toBeNull();
    expect(rect.getAttribute('fill')).toBeNull();
  });

  it('keeps the geometry used by the print preview', () => {
    const svg = sanitizeSvgMarkup(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><clipPath id="vp"><rect x="0" y="0" width="5" height="5"/></clipPath></defs><g clip-path="url(#vp)"><path d="M 0 0 L 10 10" stroke="#000"/></g></svg>',
    );
    expect(svg?.querySelector('path')?.getAttribute('d')).toBe('M 0 0 L 10 10');
    expect(svg?.querySelector('g')?.getAttribute('clip-path')).toBe('url(#vp)');
  });
});
