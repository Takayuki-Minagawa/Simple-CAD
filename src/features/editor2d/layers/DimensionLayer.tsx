import type { Dimension } from '@/domain/structural/types';
import { sub2D, normalize2D, perpendicular2D, distance2D } from '@/domain/geometry/point';

interface Props {
  dimensions: Dimension[];
  selectedIds: string[];
}

export function DimensionLayer({ dimensions, selectedIds }: Props) {
  return (
    <g className="layer-dimension">
      {dimensions.map((d) => (
        <DimensionShape key={d.id} dim={d} selected={selectedIds.includes(d.id)} />
      ))}
    </g>
  );
}

function DimensionShape({ dim, selected }: { dim: Dimension; selected: boolean }) {
  const dir = normalize2D(sub2D(dim.end, dim.start));
  const perp = perpendicular2D(dir);
  const offset = dim.offset;

  // Offset points
  const s = { x: dim.start.x + perp.x * offset, y: dim.start.y + perp.y * offset };
  const e = { x: dim.end.x + perp.x * offset, y: dim.end.y + perp.y * offset };

  // Extension lines
  const extDir = offset >= 0 ? 1 : -1;
  const s1 = { x: dim.start.x + perp.x * extDir * 100, y: dim.start.y + perp.y * extDir * 100 };
  const s2 = { x: dim.start.x + perp.x * (offset + extDir * 200), y: dim.start.y + perp.y * (offset + extDir * 200) };
  const e1 = { x: dim.end.x + perp.x * extDir * 100, y: dim.end.y + perp.y * extDir * 100 };
  const e2 = { x: dim.end.x + perp.x * (offset + extDir * 200), y: dim.end.y + perp.y * (offset + extDir * 200) };

  const length = distance2D(dim.start, dim.end);
  const text = dim.text ?? length.toFixed(0);

  const mid = { x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 };
  const color = selected ? 'var(--color-selection)' : 'var(--color-dimension)';
  const sw = selected ? 30 : 15;

  return (
    <g data-id={dim.id} style={{ cursor: 'pointer' }}>
      {/* Dimension line */}
      <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke={color} strokeWidth={sw} />
      {/* Extension lines */}
      <line x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} stroke={color} strokeWidth={sw * 0.7} />
      <line x1={e1.x} y1={e1.y} x2={e2.x} y2={e2.y} stroke={color} strokeWidth={sw * 0.7} />
      {/* Arrows */}
      <circle cx={s.x} cy={s.y} r={50} fill={color} />
      <circle cx={e.x} cy={e.y} r={50} fill={color} />
      {/* Text */}
      <text
        x={mid.x}
        y={mid.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={250}
        fill={color}
        transform={`translate(0,0) scale(1,-1) translate(0,${-2 * mid.y})`}
      >
        {text}
      </text>
    </g>
  );
}
