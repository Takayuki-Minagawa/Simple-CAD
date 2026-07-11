import type { Member, Opening } from '@/domain/structural/types';

const MEMBER_PREFIX = 'SIMPLECAD_MEMBER:';
const OPENING_PREFIX = 'SIMPLECAD_OPENING:';

export interface IfcMemberMetadata {
  rotation?: number;
  axisOffset?: Member['axisOffset'];
  faceAlign?: Member['faceAlign'];
  localAxis?: Member['localAxis'];
  releases?: Member['releases'];
  rigidZones?: Member['rigidZones'];
}

export function encodeIfcMemberMetadata(member: Member): string {
  const metadata: IfcMemberMetadata = {
    rotation: member.rotation,
    axisOffset: member.axisOffset,
    faceAlign: member.faceAlign,
    localAxis: member.localAxis,
    releases: member.releases,
    rigidZones: member.rigidZones,
  };
  return `${MEMBER_PREFIX}${JSON.stringify(metadata)}`;
}

export function decodeIfcMemberMetadata(value: string | null): IfcMemberMetadata | undefined {
  const parsed = parsePrefixedJson(value, MEMBER_PREFIX);
  if (!parsed) return undefined;
  const metadata: IfcMemberMetadata = {};
  if (typeof parsed.rotation === 'number' && Number.isFinite(parsed.rotation)) {
    metadata.rotation = parsed.rotation;
  }
  if (isOffset(parsed.axisOffset)) metadata.axisOffset = parsed.axisOffset;
  if (parsed.faceAlign === 'center' || parsed.faceAlign === 'left' || parsed.faceAlign === 'right') {
    metadata.faceAlign = parsed.faceAlign;
  }
  if (isLocalAxis(parsed.localAxis)) metadata.localAxis = parsed.localAxis;
  if (isRecord(parsed.releases)) metadata.releases = parsed.releases as Member['releases'];
  if (isRecord(parsed.rigidZones)) metadata.rigidZones = parsed.rigidZones as Member['rigidZones'];
  return metadata;
}

export function encodeIfcOpeningMetadata(opening: Opening): string {
  return `${OPENING_PREFIX}${JSON.stringify(opening)}`;
}

export function decodeIfcOpeningMetadata(value: string | null): Opening | undefined {
  const parsed = parsePrefixedJson(value, OPENING_PREFIX);
  if (
    !parsed ||
    typeof parsed.id !== 'string' ||
    typeof parsed.memberId !== 'string' ||
    !['door', 'window', 'void'].includes(String(parsed.type)) ||
    !isPoint3D(parsed.position) ||
    typeof parsed.width !== 'number' ||
    !Number.isFinite(parsed.width) ||
    typeof parsed.height !== 'number' ||
    !Number.isFinite(parsed.height)
  ) {
    return undefined;
  }
  return parsed as unknown as Opening;
}

function parsePrefixedJson(value: string | null, prefix: string): Record<string, unknown> | undefined {
  if (!value?.startsWith(prefix)) return undefined;
  try {
    const parsed: unknown = JSON.parse(value.slice(prefix.length));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPoint3D(value: unknown): value is { x: number; y: number; z: number } {
  return (
    isRecord(value) &&
    ['x', 'y', 'z'].every(
      (axis) => typeof value[axis] === 'number' && Number.isFinite(value[axis]),
    )
  );
}

function isOffset(value: unknown): value is { dx: number; dy: number } {
  return (
    isRecord(value) &&
    typeof value.dx === 'number' &&
    Number.isFinite(value.dx) &&
    typeof value.dy === 'number' &&
    Number.isFinite(value.dy)
  );
}

function isLocalAxis(value: unknown): value is NonNullable<Member['localAxis']> {
  return (
    isRecord(value) &&
    typeof value.rotation === 'number' &&
    Number.isFinite(value.rotation) &&
    (value.referenceVector === undefined || isPoint3D(value.referenceVector))
  );
}
