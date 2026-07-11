import { useEffect, useMemo } from 'react';
import { Edges } from '@react-three/drei';
import { type ThreeEvent } from '@react-three/fiber';
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
  colorOverride?: string;
  onClick: () => void;
  /** Measurement mode is active: clicks pick measure points instead of selecting. */
  measureMode?: boolean;
  /** Called with the world-space hit point when picking a measure point. */
  onMeasurePick?: (worldPoint: THREE.Vector3) => void;
  /** Hover enter/move with the world-space hit point. */
  onHover?: (member: Member, section: Section | undefined, worldPoint: THREE.Vector3) => void;
  /** Hover leave for this member. */
  onHoverEnd?: (memberId: string) => void;
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
  colorOverride,
  onClick,
  measureMode,
  onMeasurePick,
  onHover,
  onHoverEnd,
}: Props) {
  const geometry = useMemo(
    () => buildMemberGeometry({ member, section, openings }, engine),
    [member, section, openings, engine],
  );

  useEffect(() => () => {
    geometry?.dispose();
  }, [geometry]);

  if (!geometry) return null;

  const color = selected ? COLORS.selected : (colorOverride ?? member.color ?? COLORS[member.type]);
  const materialProps = getMaterialProps(member.type, color, wireframe, clippingPlanes);

  return (
    <mesh
      geometry={geometry}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        if (measureMode) {
          onMeasurePick?.(event.point.clone());
          return;
        }
        onClick();
      }}
      onPointerMove={
        onHover
          ? (event: ThreeEvent<PointerEvent>) => {
              event.stopPropagation();
              onHover(member, section, event.point.clone());
            }
          : undefined
      }
      onPointerOut={
        onHoverEnd
          ? (event: ThreeEvent<PointerEvent>) => {
              event.stopPropagation();
              onHoverEnd(member.id);
            }
          : undefined
      }
    >
      <meshStandardMaterial {...materialProps} />
      {selected && <Edges color="#f8fafc" linewidth={2} />}
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
