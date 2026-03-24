import type { Annotation, TextAlign } from '@/domain/structural/types';
import type { Point2D } from '@/domain/geometry/types';

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

/** Convert Catmull-Rom control points to a smooth SVG cubic bezier path */
function catmullRomToPath(pts: Point2D[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) {
    return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
  }

  const d: string[] = [`M ${pts[0].x},${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    // Catmull-Rom to cubic bezier conversion
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  return d.join(' ');
}

export function AnnotationLayer({ annotations, selectedIds }: Props) {
  return (
    <g className="layer-annotation">
      {annotations.map((a) => {
        const selected = selectedIds.includes(a.id);
        const color = selected ? 'var(--color-selection)' : (a.color ?? 'var(--color-annotation)');

        // Spline rendering
        if (a.type === 'spline' && a.points && a.points.length >= 2) {
          const pathD = catmullRomToPath(a.points);
          return (
            <path
              key={a.id}
              data-id={a.id}
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth={selected ? 30 : 20}
              style={{ cursor: 'pointer' }}
            />
          );
        }

        const fontSize = a.fontSize ?? 300;
        const anchor = textAlignToAnchor(a.textAlign);
        const rotation = a.rotation ?? 0;
        const lines = a.text.split('\n');

        // Build transform: flip Y for text readability, then apply rotation
        const baseTransform = `translate(0,0) scale(1,-1) translate(0,${-2 * a.y})`;
        const rotateTransform = rotation !== 0 ? ` rotate(${-rotation}, ${a.x}, ${-a.y})` : '';
        const transform = baseTransform + rotateTransform;

        // Text formatting
        const fontWeight = selected ? 'bold' : (a.fontWeight ?? 'normal');
        const fontStyle = a.fontStyle ?? 'normal';
        const textDecoration = a.textDecoration ?? 'none';
        const fontFamily = a.fontFamily ?? undefined;

        return (
          <text
            key={a.id}
            data-id={a.id}
            x={a.x}
            y={a.y}
            fontSize={fontSize}
            fill={color}
            fontWeight={fontWeight}
            fontStyle={fontStyle}
            textDecoration={textDecoration}
            fontFamily={fontFamily}
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
