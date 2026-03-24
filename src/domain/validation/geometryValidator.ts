import type { ProjectData } from '@/domain/structural/types';
import type { Point3D } from '@/domain/geometry/types';
import type { ValidationError, ValidationResult } from './types';

export function validateGeometry(data: ProjectData): ValidationResult {
  const errors: ValidationError[] = [];

  for (const m of data.members) {
    switch (m.type) {
      case 'column':
      case 'beam': {
        if (isSamePoint3D(m.start, m.end)) {
          errors.push({
            level: 'error',
            message: `Member "${m.id}": start と end が同一座標（長さ0の部材）`,
            path: `/members/${m.id}`,
          });
        }
        break;
      }
      case 'wall': {
        if (isSamePoint3D(m.start, m.end)) {
          errors.push({
            level: 'error',
            message: `Member "${m.id}": start と end が同一座標（長さ0の壁）`,
            path: `/members/${m.id}`,
          });
        }
        break;
      }
      case 'slab': {
        if (m.polygon.length < 3) {
          errors.push({
            level: 'error',
            message: `Member "${m.id}": polygon の頂点が3未満`,
            path: `/members/${m.id}`,
          });
        }
        break;
      }
    }
  }

  // Dimension: start ≠ end
  for (const d of data.dimensions) {
    if (d.start.x === d.end.x && d.start.y === d.end.y) {
      errors.push({
        level: 'error',
        message: `Dimension "${d.id}": start と end が同一座標`,
        path: `/dimensions/${d.id}`,
      });
    }
  }

  return { ok: errors.every((e) => e.level !== 'error'), errors };
}

function isSamePoint3D(a: Point3D, b: Point3D): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}
