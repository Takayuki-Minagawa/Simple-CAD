import type { Annotation } from '@/domain/structural/types';

interface Props {
  annotations: Annotation[];
  selectedIds: string[];
}

export function AnnotationLayer({ annotations, selectedIds }: Props) {
  return (
    <g className="layer-annotation">
      {annotations.map((a) => {
        const selected = selectedIds.includes(a.id);
        const color = selected ? 'var(--color-selection)' : 'var(--color-annotation)';
        const fontSize = a.fontSize ?? 300;

        return (
          <text
            key={a.id}
            data-id={a.id}
            x={a.x}
            y={a.y}
            fontSize={fontSize}
            fill={color}
            fontWeight={selected ? 'bold' : 'normal'}
            transform={`translate(0,0) scale(1,-1) translate(0,${-2 * a.y})`}
            style={{ cursor: 'pointer' }}
          >
            {a.text}
          </text>
        );
      })}
    </g>
  );
}
