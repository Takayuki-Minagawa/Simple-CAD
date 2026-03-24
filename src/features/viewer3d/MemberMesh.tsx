import { useMemo } from 'react';
import * as THREE from 'three';
import type { Member, Section } from '@/domain/structural/types';

interface Props {
  member: Member;
  section: Section | undefined;
  selected: boolean;
  wireframe: boolean;
  onClick: () => void;
}

const COLORS = {
  column: '#e74c3c',
  beam: '#f39c12',
  wall: '#00bcd4',
  slab: '#9b59b6',
  selected: '#3b82f6',
};

export function MemberMesh({ member, section, selected, wireframe, onClick }: Props) {
  const color = selected ? COLORS.selected : COLORS[member.type];

  switch (member.type) {
    case 'column':
      return (
        <ColumnMesh
          member={member}
          section={section}
          color={color}
          wireframe={wireframe}
          onClick={onClick}
        />
      );
    case 'beam':
      return (
        <BeamMesh
          member={member}
          section={section}
          color={color}
          wireframe={wireframe}
          onClick={onClick}
        />
      );
    case 'wall':
      return (
        <WallMesh
          member={member}
          color={color}
          wireframe={wireframe}
          onClick={onClick}
        />
      );
    case 'slab':
      return (
        <SlabMesh
          member={member}
          section={section}
          color={color}
          wireframe={wireframe}
          onClick={onClick}
        />
      );
  }
}

function ColumnMesh({
  member,
  section,
  color,
  wireframe,
  onClick,
}: {
  member: Member & { type: 'column' };
  section: Section | undefined;
  color: string;
  wireframe: boolean;
  onClick: () => void;
}) {
  const w = section && 'width' in section ? section.width : 600;
  const d = section && 'depth' in section ? section.depth : 600;
  const h = Math.abs(member.end.z - member.start.z) || 3000;

  const midZ = (member.start.z + member.end.z) / 2;

  return (
    <mesh
      position={[member.start.x, member.start.y, midZ]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <boxGeometry args={[w, d, h]} />
      <meshStandardMaterial color={color} wireframe={wireframe} transparent opacity={0.85} />
    </mesh>
  );
}

function BeamMesh({
  member,
  section,
  color,
  wireframe,
  onClick,
}: {
  member: Member & { type: 'beam' };
  section: Section | undefined;
  color: string;
  wireframe: boolean;
  onClick: () => void;
}) {
  const w = section && 'width' in section ? section.width : 300;
  const d = section && 'depth' in section ? section.depth : 600;

  const start = new THREE.Vector3(member.start.x, member.start.y, member.start.z);
  const end = new THREE.Vector3(member.end.x, member.end.y, member.end.z);
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = dir.length();
  if (length === 0) return null;

  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  // Rotation to align box along the direction
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 0, 1);
    q.setFromUnitVectors(up, dir.clone().normalize());
    return q;
  }, [dir]);

  return (
    <mesh
      position={[mid.x, mid.y, mid.z]}
      quaternion={quaternion}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <boxGeometry args={[w, d, length]} />
      <meshStandardMaterial color={color} wireframe={wireframe} transparent opacity={0.75} />
    </mesh>
  );
}

function WallMesh({
  member,
  color,
  wireframe,
  onClick,
}: {
  member: Member & { type: 'wall' };
  color: string;
  wireframe: boolean;
  onClick: () => void;
}) {
  const start = new THREE.Vector3(member.start.x, member.start.y, member.start.z);
  const end = new THREE.Vector3(member.end.x, member.end.y, member.end.z);
  const dir = new THREE.Vector3().subVectors(end, start);
  const length = dir.length();
  if (length === 0) return null;

  const midXY = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const midZ = member.start.z + member.height / 2;

  const angle = Math.atan2(dir.y, dir.x);

  return (
    <mesh
      position={[midXY.x, midXY.y, midZ]}
      rotation={[0, 0, angle]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <boxGeometry args={[length, member.thickness, member.height]} />
      <meshStandardMaterial
        color={color}
        wireframe={wireframe}
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function SlabMesh({
  member,
  section,
  color,
  wireframe,
  onClick,
}: {
  member: Member & { type: 'slab' };
  section: Section | undefined;
  color: string;
  wireframe: boolean;
  onClick: () => void;
}) {
  const thickness = section && 'thickness' in section ? section.thickness : 180;

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    if (member.polygon.length < 3) return null;
    shape.moveTo(member.polygon[0].x, member.polygon[0].y);
    for (let i = 1; i < member.polygon.length; i++) {
      shape.lineTo(member.polygon[i].x, member.polygon[i].y);
    }
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
    });
  }, [member.polygon, thickness]);

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      position={[0, 0, member.level - thickness]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <meshStandardMaterial
        color={color}
        wireframe={wireframe}
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
