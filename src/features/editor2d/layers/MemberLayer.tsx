import type { Member, Section } from '@/domain/structural/types';
import { lineTypeToDashArray } from '@/domain/rendering/lineStyle';

interface Props {
  members: Member[];
  sections: Section[];
  selectedIds: string[];
}

export function MemberLayer({ members, sections, selectedIds }: Props) {
  return (
    <>
      {/* Slabs first (back) */}
      <g className="layer-member-slab">
        {members
          .filter((m) => m.type === 'slab')
          .map((m) => (
            <SlabShape key={m.id} member={m} selected={selectedIds.includes(m.id)} />
          ))}
      </g>
      {/* Walls */}
      <g className="layer-member-wall">
        {members
          .filter((m) => m.type === 'wall')
          .map((m) => {
            const sec = sections.find((s) => s.id === m.sectionId);
            return (
              <WallShape
                key={m.id}
                member={m}
                thickness={sec && 'thickness' in sec ? sec.thickness : m.thickness}
                selected={selectedIds.includes(m.id)}
              />
            );
          })}
      </g>
      {/* Beams */}
      <g className="layer-member-beam">
        {members
          .filter((m) => m.type === 'beam')
          .map((m) => {
            const sec = sections.find((s) => s.id === m.sectionId);
            const width = sec && 'width' in sec ? sec.width : 300;
            return (
              <BeamShape
                key={m.id}
                member={m}
                width={width}
                selected={selectedIds.includes(m.id)}
              />
            );
          })}
      </g>
      {/* Columns (front) */}
      <g className="layer-member-column">
        {members
          .filter((m) => m.type === 'column')
          .map((m) => {
            const sec = sections.find((s) => s.id === m.sectionId);
            const w = sec && 'width' in sec ? sec.width : 600;
            const d = sec && 'depth' in sec ? sec.depth : 600;
            return (
              <ColumnShape
                key={m.id}
                member={m}
                width={w}
                depth={d}
                selected={selectedIds.includes(m.id)}
              />
            );
          })}
      </g>
    </>
  );
}

function ColumnShape({
  member,
  width,
  depth,
  selected,
}: {
  member: Member & { type: 'column' };
  width: number;
  depth: number;
  selected: boolean;
}) {
  const cx = member.start.x;
  const cy = member.start.y;
  const hw = width / 2;
  const hd = depth / 2;
  const lw = member.lineWeight ?? 20;
  const sw = selected ? lw * 2 : lw;
  const strokeColor = selected ? 'var(--color-selection)' : (member.color ?? 'var(--color-column)');
  const dash = lineTypeToDashArray(member.lineType);

  return (
    <rect
      data-id={member.id}
      x={cx - hw}
      y={cy - hd}
      width={width}
      height={depth}
      fill={selected ? 'rgba(59,130,246,0.3)' : 'rgba(231,76,60,0.3)'}
      stroke={strokeColor}
      strokeWidth={sw}
      strokeDasharray={dash}
      style={{ cursor: 'pointer' }}
    />
  );
}

function BeamShape({
  member,
  width,
  selected,
}: {
  member: Member & { type: 'beam' };
  width: number;
  selected: boolean;
}) {
  const { start, end } = member;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  const nx = (-dy / len) * (width / 2);
  const ny = (dx / len) * (width / 2);

  const points = [
    `${start.x + nx},${start.y + ny}`,
    `${end.x + nx},${end.y + ny}`,
    `${end.x - nx},${end.y - ny}`,
    `${start.x - nx},${start.y - ny}`,
  ].join(' ');

  const lw = member.lineWeight ?? 20;
  const sw = selected ? lw * 2 : lw;
  const strokeColor = selected ? 'var(--color-selection)' : (member.color ?? 'var(--color-beam)');
  const dash = lineTypeToDashArray(member.lineType);

  return (
    <polygon
      data-id={member.id}
      points={points}
      fill={selected ? 'rgba(59,130,246,0.2)' : 'rgba(243,156,18,0.2)'}
      stroke={strokeColor}
      strokeWidth={sw}
      strokeDasharray={dash}
      style={{ cursor: 'pointer' }}
    />
  );
}

function WallShape({
  member,
  thickness,
  selected,
}: {
  member: Member & { type: 'wall' };
  thickness: number;
  selected: boolean;
}) {
  const { start, end } = member;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  const nx = (-dy / len) * (thickness / 2);
  const ny = (dx / len) * (thickness / 2);

  const points = [
    `${start.x + nx},${start.y + ny}`,
    `${end.x + nx},${end.y + ny}`,
    `${end.x - nx},${end.y - ny}`,
    `${start.x - nx},${start.y - ny}`,
  ].join(' ');

  const lw = member.lineWeight ?? 20;
  const sw = selected ? lw * 2 : lw;
  const strokeColor = selected ? 'var(--color-selection)' : (member.color ?? 'var(--color-wall)');
  const dash = lineTypeToDashArray(member.lineType);

  return (
    <polygon
      data-id={member.id}
      points={points}
      fill={selected ? 'rgba(59,130,246,0.2)' : 'rgba(0,188,212,0.2)'}
      stroke={strokeColor}
      strokeWidth={sw}
      strokeDasharray={dash}
      style={{ cursor: 'pointer' }}
    />
  );
}

function SlabShape({
  member,
  selected,
}: {
  member: Member & { type: 'slab' };
  selected: boolean;
}) {
  const points = member.polygon.map((p) => `${p.x},${p.y}`).join(' ');
  const lw = member.lineWeight ?? 20;
  const sw = selected ? lw * 2 : lw;
  const strokeColor = selected ? 'var(--color-selection)' : (member.color ?? 'var(--color-slab)');
  const dash = lineTypeToDashArray(member.lineType) ?? '200 100';
  const fillColor = selected
    ? 'rgba(59,130,246,0.15)'
    : (member.fillColor ?? 'rgba(155,89,182,0.1)');
  const fillOpacity = member.fillOpacity ?? undefined;

  return (
    <polygon
      data-id={member.id}
      points={points}
      fill={fillColor}
      fillOpacity={fillOpacity}
      stroke={strokeColor}
      strokeWidth={sw}
      strokeDasharray={dash}
      style={{ cursor: 'pointer' }}
    />
  );
}
