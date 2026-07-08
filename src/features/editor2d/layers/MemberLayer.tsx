import type { CSSProperties } from 'react';
import type { Member, Section } from '@/domain/structural/types';
import { lineTypeToDashArray } from '@/domain/rendering/lineStyle';
import { formatPointList, getMemberPlanPolygon } from '@/domain/structural/memberShape';

interface Props {
  members: Member[];
  sections: Section[];
  selectedIds: string[];
  muted?: boolean;
}

export function MemberLayer({ members, sections, selectedIds, muted = false }: Props) {
  const layerProps = {
    opacity: muted ? 0.28 : 1,
    style: { pointerEvents: muted ? 'none' : 'auto' } as CSSProperties,
  };

  return (
    <>
      {/* Slabs first (back) */}
      <g className="layer-member-slab" {...layerProps}>
        {members
          .filter((m) => m.type === 'slab')
          .map((m) => (
            <SlabShape
              key={m.id}
              member={m}
              selected={selectedIds.includes(m.id)}
              section={sections.find((s) => s.id === m.sectionId)}
            />
          ))}
      </g>
      {/* Walls */}
      <g className="layer-member-wall" {...layerProps}>
        {members
          .filter((m) => m.type === 'wall')
          .map((m) => {
            const sec = sections.find((s) => s.id === m.sectionId);
            return (
              <WallShape
                key={m.id}
                member={m}
                section={sec}
                selected={selectedIds.includes(m.id)}
              />
            );
          })}
      </g>
      {/* Beams */}
      <g className="layer-member-beam" {...layerProps}>
        {members
          .filter((m) => m.type === 'beam')
          .map((m) => {
            const sec = sections.find((s) => s.id === m.sectionId);
            return (
              <BeamShape
                key={m.id}
                member={m}
                section={sec}
                selected={selectedIds.includes(m.id)}
              />
            );
          })}
      </g>
      {/* Columns (front) */}
      <g className="layer-member-column" {...layerProps}>
        {members
          .filter((m) => m.type === 'column')
          .map((m) => {
            const sec = sections.find((s) => s.id === m.sectionId);
            return (
              <ColumnShape
                key={m.id}
                member={m}
                section={sec}
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
  section,
  selected,
}: {
  member: Member & { type: 'column' };
  section: Section | undefined;
  selected: boolean;
}) {
  const points = getMemberPlanPolygon(member, section);
  if (!points) return null;
  const lw = member.lineWeight ?? 20;
  const sw = selected ? lw * 2 : lw;
  const strokeColor = selected ? 'var(--color-selection)' : (member.color ?? 'var(--color-column)');
  const dash = lineTypeToDashArray(member.lineType);

  return (
    <polygon
      data-id={member.id}
      points={formatPointList(points)}
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
  section,
  selected,
}: {
  member: Member & { type: 'beam' };
  section: Section | undefined;
  selected: boolean;
}) {
  const points = getMemberPlanPolygon(member, section);
  if (!points) return null;
  const lw = member.lineWeight ?? 20;
  const sw = selected ? lw * 2 : lw;
  const strokeColor = selected ? 'var(--color-selection)' : (member.color ?? 'var(--color-beam)');
  const dash = lineTypeToDashArray(member.lineType);

  return (
    <polygon
      data-id={member.id}
      points={formatPointList(points)}
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
  section,
  selected,
}: {
  member: Member & { type: 'wall' };
  section: Section | undefined;
  selected: boolean;
}) {
  const points = getMemberPlanPolygon(member, section);
  if (!points) return null;
  const lw = member.lineWeight ?? 20;
  const sw = selected ? lw * 2 : lw;
  const strokeColor = selected ? 'var(--color-selection)' : (member.color ?? 'var(--color-wall)');
  const dash = lineTypeToDashArray(member.lineType);

  return (
    <polygon
      data-id={member.id}
      points={formatPointList(points)}
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
  section,
  selected,
}: {
  member: Member & { type: 'slab' };
  section: Section | undefined;
  selected: boolean;
}) {
  const points = getMemberPlanPolygon(member, section);
  if (!points) return null;
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
      points={formatPointList(points)}
      fill={fillColor}
      fillOpacity={fillOpacity}
      stroke={strokeColor}
      strokeWidth={sw}
      strokeDasharray={dash}
      style={{ cursor: 'pointer' }}
    />
  );
}
