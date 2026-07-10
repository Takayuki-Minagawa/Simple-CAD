import type { ProjectData } from '@/domain/structural/types';
import type { Point2D, Point3D } from '@/domain/geometry/types';
import {
  hasDuplicateVertices,
  isDegenerate,
  isSimplePolygon,
} from '@/domain/geometry/measurement';
import type { ValidationError, ValidationResult } from './types';

/** Lengths (mm) outside this band are flagged as suspicious (warning, not error). */
const TINY_MEMBER_LENGTH = 1; // < 1mm member is almost certainly a mistake
const HUGE_MEMBER_LENGTH = 1_000_000; // > 1km member is almost certainly a mistake

export function validateGeometry(data: ProjectData): ValidationResult {
  const errors: ValidationError[] = [];

  for (const m of data.members) {
    switch (m.type) {
      case 'column':
      case 'beam': {
        checkFinite3D(m.start, `Member "${m.id}".start`, `/members/${m.id}`, errors);
        checkFinite3D(m.end, `Member "${m.id}".end`, `/members/${m.id}`, errors);
        if (isSamePoint3D(m.start, m.end)) {
          errors.push({
            level: 'error',
            message: `Member "${m.id}": start と end が同一座標（長さ0の部材）`,
            path: `/members/${m.id}`,
          });
        } else {
          const length = length3D(m.start, m.end);
          checkExtremeLength(length, m.id, errors);
          checkRigidZones(m.id, m.rigidZones, length, errors);
          checkLocalAxis(m.id, m.start, m.end, m.localAxis, errors);
        }
        break;
      }
      case 'wall': {
        checkFinite3D(m.start, `Member "${m.id}".start`, `/members/${m.id}`, errors);
        checkFinite3D(m.end, `Member "${m.id}".end`, `/members/${m.id}`, errors);
        if (isSamePoint3D(m.start, m.end)) {
          errors.push({
            level: 'error',
            message: `Member "${m.id}": start と end が同一座標（長さ0の壁）`,
            path: `/members/${m.id}`,
          });
        } else {
          const length = length3D(m.start, m.end);
          checkExtremeLength(length, m.id, errors);
          checkRigidZones(m.id, m.rigidZones, length, errors);
          checkLocalAxis(m.id, m.start, m.end, m.localAxis, errors);
        }
        break;
      }
      case 'slab': {
        if (m.releases || m.rigidZones || m.localAxis) {
          errors.push({
            level: 'error',
            message: `Member "${m.id}": slab に線材用の releases/rigidZones/localAxis は設定できません`,
            path: `/members/${m.id}`,
          });
        }
        for (const p of m.polygon) {
          checkFinite2D(p, `Member "${m.id}".polygon`, `/members/${m.id}`, errors);
        }
        if (m.polygon.length < 3) {
          errors.push({
            level: 'error',
            message: `Member "${m.id}": polygon の頂点が3未満`,
            path: `/members/${m.id}`,
          });
          break;
        }
        if (hasDuplicateVertices(m.polygon)) {
          errors.push({
            level: 'error',
            message: `Member "${m.id}": polygon に重複頂点`,
            path: `/members/${m.id}`,
          });
        }
        // Self-intersection is checked first: a self-crossing ("bow-tie")
        // polygon can have zero *net* area and would otherwise be misreported
        // as merely collinear-degenerate.
        if (!isSimplePolygon(m.polygon)) {
          errors.push({
            level: 'error',
            message: `Member "${m.id}": polygon が自己交差`,
            path: `/members/${m.id}`,
          });
        } else if (isDegenerate(m.polygon)) {
          // All vertices collinear / coincident → zero-area polygon.
          errors.push({
            level: 'error',
            message: `Member "${m.id}": polygon が共線退化（面積0）`,
            path: `/members/${m.id}`,
          });
        }
        break;
      }
    }
  }

  // Dimension: start ≠ end + finiteness + offset sanity
  for (const d of data.dimensions) {
    checkFinite2D(d.start, `Dimension "${d.id}".start`, `/dimensions/${d.id}`, errors);
    checkFinite2D(d.end, `Dimension "${d.id}".end`, `/dimensions/${d.id}`, errors);
    if (d.start.x === d.end.x && d.start.y === d.end.y) {
      errors.push({
        level: 'error',
        message: `Dimension "${d.id}": start と end が同一座標`,
        path: `/dimensions/${d.id}`,
      });
    }
    if (!Number.isFinite(d.offset)) {
      errors.push({
        level: 'error',
        message: `Dimension "${d.id}": offset が有限値でない`,
        path: `/dimensions/${d.id}`,
      });
    } else if (Math.abs(d.offset) > HUGE_MEMBER_LENGTH) {
      errors.push({
        level: 'warning',
        message: `Dimension "${d.id}": offset が極端に大きい（${d.offset}mm）`,
        path: `/dimensions/${d.id}`,
      });
    }
  }

  for (const support of data.supports ?? []) {
    checkFinite3D(support.position, `Support "${support.id}".position`, `/supports/${support.id}`, errors);
  }

  for (const load of data.nodalLoads ?? []) {
    checkFinite3D(load.position, `NodalLoad "${load.id}".position`, `/nodalLoads/${load.id}`, errors);
    checkFiniteVector(load.force, `NodalLoad "${load.id}".force`, `/nodalLoads/${load.id}`, errors);
    if (load.moment) {
      checkFiniteVector(load.moment, `NodalLoad "${load.id}".moment`, `/nodalLoads/${load.id}`, errors);
    }
  }

  for (const load of data.memberLoads ?? []) {
    if (!Number.isFinite(load.magnitude)) {
      addNonFinite(`MemberLoad "${load.id}".magnitude`, `/memberLoads/${load.id}`, errors);
    }
    if (load.endMagnitude !== undefined && !Number.isFinite(load.endMagnitude)) {
      addNonFinite(`MemberLoad "${load.id}".endMagnitude`, `/memberLoads/${load.id}`, errors);
    }
    if (load.kind === 'point' && load.position === undefined) {
      errors.push({
        level: 'error',
        message: `MemberLoad "${load.id}": point荷重には position が必要`,
        path: `/memberLoads/${load.id}`,
      });
    }
    if (load.kind === 'trapezoidal' && load.endMagnitude === undefined) {
      errors.push({
        level: 'error',
        message: `MemberLoad "${load.id}": trapezoidal荷重には endMagnitude が必要`,
        path: `/memberLoads/${load.id}`,
      });
    }
  }

  for (const load of data.areaLoads ?? []) {
    if (!Number.isFinite(load.magnitude)) {
      addNonFinite(`AreaLoad "${load.id}".magnitude`, `/areaLoads/${load.id}`, errors);
    }
  }

  for (const mass of data.masses ?? []) {
    checkFinite3D(mass.position, `LumpedMass "${mass.id}".position`, `/masses/${mass.id}`, errors);
    checkNonNegativeVector(mass.mass, `LumpedMass "${mass.id}".mass`, `/masses/${mass.id}`, errors);
    if (mass.rotationalMass) {
      checkNonNegativeVector(
        mass.rotationalMass,
        `LumpedMass "${mass.id}".rotationalMass`,
        `/masses/${mass.id}`,
        errors,
      );
    }
  }

  for (const diaphragm of data.diaphragms ?? []) {
    if (diaphragm.masterPosition) {
      checkFinite3D(
        diaphragm.masterPosition,
        `Diaphragm "${diaphragm.id}".masterPosition`,
        `/diaphragms/${diaphragm.id}`,
        errors,
      );
    }
  }

  for (const result of data.analysisResults?.nodeDisplacements ?? []) {
    checkFinite3D(result.position, 'AnalysisNodeDisplacement.position', '/analysisResults/nodeDisplacements', errors);
  }

  return { ok: errors.every((e) => e.level !== 'error'), errors };
}

function checkRigidZones(
  memberId: string,
  rigidZones: { start?: number; end?: number } | undefined,
  memberLength: number,
  errors: ValidationError[],
) {
  if (!rigidZones) return;
  const total = (rigidZones.start ?? 0) + (rigidZones.end ?? 0);
  if (total >= memberLength) {
    errors.push({
      level: 'error',
      message: `Member "${memberId}": rigidZones 合計 ${total}mm が部材長 ${memberLength.toFixed(3)}mm 以上`,
      path: `/members/${memberId}/rigidZones`,
    });
  }
}

function checkLocalAxis(
  memberId: string,
  start: Point3D,
  end: Point3D,
  localAxis: { rotation: number; referenceVector?: Point3D } | undefined,
  errors: ValidationError[],
) {
  if (!localAxis) return;
  const path = `/members/${memberId}/localAxis`;
  if (!Number.isFinite(localAxis.rotation)) {
    addNonFinite(`Member "${memberId}".localAxis.rotation`, path, errors);
  }
  const reference = localAxis.referenceVector;
  if (!reference) return;
  if (![reference.x, reference.y, reference.z].every(Number.isFinite)) {
    addNonFinite(`Member "${memberId}".localAxis.referenceVector`, path, errors);
    return;
  }
  const axis = { x: end.x - start.x, y: end.y - start.y, z: end.z - start.z };
  const cross = {
    x: axis.y * reference.z - axis.z * reference.y,
    y: axis.z * reference.x - axis.x * reference.z,
    z: axis.x * reference.y - axis.y * reference.x,
  };
  const axisLength = Math.hypot(axis.x, axis.y, axis.z);
  const referenceLength = Math.hypot(reference.x, reference.y, reference.z);
  const normalizedCross = Math.hypot(cross.x, cross.y, cross.z) / (axisLength * referenceLength);
  if (referenceLength <= Number.EPSILON || !Number.isFinite(normalizedCross) || normalizedCross <= 1e-9) {
    errors.push({
      level: 'error',
      message: `Member "${memberId}": localAxis.referenceVector は非ゼロで部材軸と非平行である必要があります`,
      path,
    });
  }
}

function checkFiniteVector(
  vector: { x: number; y: number; z: number },
  label: string,
  path: string,
  errors: ValidationError[],
) {
  if (![vector.x, vector.y, vector.z].every(Number.isFinite)) addNonFinite(label, path, errors);
}

function checkNonNegativeVector(
  vector: { x: number; y: number; z: number },
  label: string,
  path: string,
  errors: ValidationError[],
) {
  checkFiniteVector(vector, label, path, errors);
  if (vector.x < 0 || vector.y < 0 || vector.z < 0) {
    errors.push({ level: 'error', message: `${label}: 成分は0以上である必要があります`, path });
  }
}

function addNonFinite(label: string, path: string, errors: ValidationError[]) {
  errors.push({ level: 'error', message: `${label}: 有限値でない（NaN/Infinity）`, path });
}

function isSamePoint3D(a: Point3D, b: Point3D): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function length3D(a: Point3D, b: Point3D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function checkExtremeLength(len: number, id: string, errors: ValidationError[]) {
  if (len < TINY_MEMBER_LENGTH) {
    errors.push({
      level: 'warning',
      message: `Member "${id}": 部材長が極端に短い（${len.toFixed(3)}mm）`,
      path: `/members/${id}`,
    });
  } else if (len > HUGE_MEMBER_LENGTH) {
    errors.push({
      level: 'warning',
      message: `Member "${id}": 部材長が極端に長い（${len.toFixed(0)}mm）`,
      path: `/members/${id}`,
    });
  }
}

function checkFinite3D(p: Point3D, label: string, path: string, errors: ValidationError[]) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
    errors.push({
      level: 'error',
      message: `${label}: 座標が有限値でない（NaN/Infinity）`,
      path,
    });
  }
}

function checkFinite2D(p: Point2D, label: string, path: string, errors: ValidationError[]) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    errors.push({
      level: 'error',
      message: `${label}: 座標が有限値でない（NaN/Infinity）`,
      path,
    });
  }
}
