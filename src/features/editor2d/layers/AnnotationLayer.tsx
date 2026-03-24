import type { Annotation, TextAlign } from '@/domain/structural/types';

interface Props {
  annotations: Annotation[];
  selectedIds: string[];
}

function textAlignToAnchor(align: TextAlign | undefined): 'start' | 'middle' | 'end' {
  switch (align) {
    case 'center': return 'middle';
    case 'right': return 'end';
    default: return 'start';
  }
}

export function AnnotationLayer({ annotations, selectedIds }: Props) {
  return (
    <g className="layer-annotation">
      {annotations.map((a) => {
        const selected = selectedIds.includes(a.id);
        const color = selected ? 'var(--color-selection)' : (a.color ?? 'var(--color-annotation)');
        const fontSize = a.fontSize ?? 300;
        const anchor = textAlignToAnchor(a.textAlign);
        const rotation = a.rotation ?? 0;
        const lines = a.text.split('\n');

        // Build transform: flip Y for text readability, then apply rotation
        const baseTransform = `translate(0,0) scale(1,-1) translate(0,${-2 * a.y})`;
        const rotateTransform = rotation !== 0 ? ` rotate(${-rotation}, ${a.x}, ${-a.y})` : '';
        const transform = baseTransform + rotateTransform;

        return (
          <text
            key={a.id}
            data-id={a.id}
            x={a.x}
            y={a.y}
            fontSize={fontSize}
            fill={color}
            fontWeight={selected ? 'bold' : 'normal'}
            textAnchor={anchor}
            transform={transform}
            style={{ cursor: 'pointer' }}
          >
            {lines.length <= 1 ? (
              a.text
            ) : (
              lines.map((line, i) => (
                <tspan key={i} x={a.x} dy={i === 0 ? 0 : fontSize * 1.2}>
                  {line}
                </tspan>
              ))
            )}
          </text>
        );
      })}
    </g>
  );
}
