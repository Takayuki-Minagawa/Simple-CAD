import type { ConstructionLine } from '@/domain/structural/types';

interface Props {
  constructionLines: ConstructionLine[];
}

export function ConstructionLineLayer({ constructionLines }: Props) {
  if (constructionLines.length === 0) return null;
  return (
    <g className="layer-construction">
      {constructionLines.map((line) => (
        <ConstructionLineShape key={line.id} line={line} />
      ))}
    </g>
  );
}

function ConstructionLineShape({ line }: { line: ConstructionLine }) {
  const ext = 500000;
  if (line.type === 'xline') {
    return (
      <line
        data-id={line.id}
        x1={line.origin.x - line.direction.x * ext}
        y1={line.origin.y - line.direction.y * ext}
        x2={line.origin.x + line.direction.x * ext}
        y2={line.origin.y + line.direction.y * ext}
        stroke="var(--color-annotation)"
        strokeWidth={10}
        strokeDasharray="80 60"
        opacity={0.5}
      />
    );
  }

  return (
    <line
      data-id={line.id}
      x1={line.origin.x}
      y1={line.origin.y}
      x2={line.origin.x + line.direction.x * ext}
      y2={line.origin.y + line.direction.y * ext}
      stroke="var(--color-annotation)"
      strokeWidth={10}
      strokeDasharray="80 60"
      opacity={0.5}
    />
  );
}
