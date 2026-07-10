import { type CSSProperties, useEffect, useRef } from 'react';
import { sanitizeSvgMarkup } from './safeSvg';

interface Props {
  markup: string | null;
  label: string;
  style?: CSSProperties;
}

export function SafeSvgPreview({ markup, label, style }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    if (!markup) return;
    const svg = sanitizeSvgMarkup(markup);
    if (!svg) return;
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
    svg.style.width = '100%';
    svg.style.height = '100%';
    host.append(svg);
    return () => host.replaceChildren();
  }, [label, markup]);

  return <div ref={hostRef} style={style} />;
}
