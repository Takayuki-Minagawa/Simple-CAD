import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Member, Opening, Section } from '@/domain/structural/types';
import { buildMemberGeometry, type GeometryEngine } from './memberGeometry';

interface Props {
  member: Member;
  section: Section | undefined;
  openings: Opening[];
  selected: boolean;
  wireframe: boolean;
  engine: GeometryEngine;
  clippingPlanes?: THREE.Plane[];
  onClick: () => void;
}

const COLORS = {
  column: '#e74c3c',
  beam: '#f39c12',
  wall: '#00bcd4',
  slab: '#9b59b6',
  selected: '#3b82f6',
} as const;

export function MemberMesh({
  member,
  section,
  openings,
  selected,
  wireframe,
  engine,
  clippingPlanes,
  onClick,
}: Props) {
  const geometry = useMemo(
    () => buildMemberGeometry({ member, section, openings }, engine),
    [member, section, openings, engine],
  );

  useEffect(() => () => {
    geometry?.dispose();
  }, [geometry]);

  if (!geometry) return null;

  const color = selected ? COLORS.selected : (member.color ?? COLORS[member.type]);
  const materialProps = getMaterialProps(member.type, color, wireframe, clippingPlanes);

  return (
    <mesh
      geometry={geometry}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <meshStandardMaterial {...materialProps} />
    </mesh>
  );
}

function getMaterialProps(
  memberType: Member['type'],
  color: string,
  wireframe: boolean,
  clippingPlanes?: THREE.Plane[],
) {
  if (memberType === 'slab') {
    return {
      color,
      wireframe,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      clippingPlanes,
    };
  }

  if (memberType === 'wall') {
    return {
      color,
      wireframe,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      clippingPlanes,
    };
  }

  return {
    color,
    wireframe,
    transparent: true,
    opacity: memberType === 'column' ? 0.85 : 0.75,
    clippingPlanes,
  };
}
