import type { ExternalRef } from '@/domain/structural/types';

interface Props {
  refs: ExternalRef[];
}

export function ExternalRefLayer({ refs }: Props) {
  return (
    <>
      {refs.map((ref) => {
        if (!ref.visible) return null;
        return (
          <g
            key={ref.id}
            transform={`translate(${ref.offsetX}, ${ref.offsetY})`}
            opacity={0.35}
            style={{ pointerEvents: 'none' }}
          >
            {ref.data.members.map((member) => {
              if (member.type === 'slab') {
                const points = member.polygon.map((point) => `${point.x},${point.y}`).join(' ');
                return (
                  <polygon
                    key={member.id}
                    points={points}
                    fill="none"
                    stroke="#999"
                    strokeWidth={15}
                  />
                );
              }
              return (
                <line
                  key={member.id}
                  x1={member.start.x}
                  y1={member.start.y}
                  x2={member.end.x}
                  y2={member.end.y}
                  stroke="#999"
                  strokeWidth={15}
                />
              );
            })}
          </g>
        );
      })}
    </>
  );
}
