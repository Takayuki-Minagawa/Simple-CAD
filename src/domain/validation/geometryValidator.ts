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
          checkExtremeLength(length3D(m.start, m.end), m.id, errors);
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
          checkExtremeLength(length3D(m.start, m.end), m.id, errors);
        }
        break;
      }
      case 'slab': {
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
            level: 'warning',
            message: `Member "${m.id}": polygon に重複頂点`,
            path: `/members/${m.id}`,
          });
        }
        // Self-intersection is checked first: a self-crossing ("bow-tie")
        // polygon can have zero *net* area and would otherwise be misreported
        // as merely collinear-degenerate.
        if (!isSimplePolygon(m.polygon)) {
          errors.push({
            level: 'warning',
            message: `Member "${m.id}": polygon が自己交差`,
            path: `/members/${m.id}`,
          });
        } else if (isDegenerate(m.polygon)) {
          // All vertices collinear / coincident → zero-area polygon.
          errors.push({
            level: 'warning',
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

  return { ok: errors.every((e) => e.level !== 'error'), errors };
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
