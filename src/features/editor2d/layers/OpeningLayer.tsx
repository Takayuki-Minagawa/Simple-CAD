import type { Member, Opening } from '@/domain/structural/types';

interface Props {
  openings: Opening[];
  members: Member[];
  selectedIds: string[];
  interactive?: boolean;
}

export function OpeningLayer({ openings, members, selectedIds, interactive = true }: Props) {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const selected = new Set(selectedIds);

  return (
    <g className="layer-opening" style={{ pointerEvents: interactive ? 'auto' : 'none' }}>
      {openings.map((opening) => {
        const member = memberById.get(opening.memberId);
        if (!member) return null;
        const stroke = selected.has(opening.id) ? 'var(--color-selection)' : '#2563eb';
        const strokeWidth = selected.has(opening.id) ? 45 : 25;

        if (member.type === 'wall') {
          const dx = member.end.x - member.start.x;
          const dy = member.end.y - member.start.y;
          const length = Math.hypot(dx, dy);
          if (length === 0) return null;
          const ux = dx / length;
          const uy = dy / length;
          const px = -uy;
          const py = ux;
          const halfWidth = opening.width / 2;
          const halfDepth = Math.max(member.thickness / 2, 60);
          const corners = [
            { x: opening.position.x - ux * halfWidth - px * halfDepth, y: opening.position.y - uy * halfWidth - py * halfDepth },
            { x: opening.position.x + ux * halfWidth - px * halfDepth, y: opening.position.y + uy * halfWidth - py * halfDepth },
            { x: opening.position.x + ux * halfWidth + px * halfDepth, y: opening.position.y + uy * halfWidth + py * halfDepth },
            { x: opening.position.x - ux * halfWidth + px * halfDepth, y: opening.position.y - uy * halfWidth + py * halfDepth },
          ];
          return (
            <polygon
              key={opening.id}
              data-id={opening.id}
              points={corners.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="var(--bg-canvas, #fff)"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeDasharray={opening.type === 'door' ? '100 60' : undefined}
              style={{ cursor: 'pointer' }}
            />
          );
        }

        const halfWidth = opening.width / 2;
        const halfHeight = opening.height / 2;
        return (
          <rect
            key={opening.id}
            data-id={opening.id}
            x={opening.position.x - halfWidth}
            y={opening.position.y - halfHeight}
            width={opening.width}
            height={opening.height}
            fill="var(--bg-canvas, #fff)"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray="100 60"
            style={{ cursor: 'pointer' }}
          />
        );
      })}
    </g>
  );
}
