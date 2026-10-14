import type { ModelExtents } from './sectionMath';
import { SCALE } from './sectionMath';

/**
 * Named standard views for the 3D viewer (R10). The gizmo is mouse-only and
 * invisible to assistive technology, so these presets give every viewpoint a
 * name, and let a script return to a known camera without guessing drag deltas.
 */
export type ViewPreset = 'top' | 'front' | 'right' | 'iso';

export const VIEW_PRESETS: readonly ViewPreset[] = ['top', 'front', 'right', 'iso'];

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CameraPose {
  /** World-space camera position (scene units, CAD mm × SCALE). */
  position: [number, number, number];
  /** World-space orbit target. */
  target: [number, number, number];
  /** Camera up vector so the plan reads with +Y (north) at the top. */
  up: [number, number, number];
  /** Zoom for an orthographic camera (world units → pixels). */
  orthoZoom: number;
}

/**
 * CAD → world: the scene group is scaled by SCALE and rotated −90° about X, so
 * CAD (x, y, z) lands at world (x·S, z·S, −y·S).
 */
export function cadToWorld(x: number, y: number, z: number): [number, number, number] {
  return [x * SCALE, z * SCALE, -y * SCALE];
}

/** Unit view direction (from target toward camera) and matching up vector, in world space. */
function presetDirection(preset: ViewPreset): { dir: [number, number, number]; up: [number, number, number] } {
  switch (preset) {
    case 'top':
      // Looking straight down; CAD +Y must point up on screen, which is world −Z.
      return { dir: [0, 1, 0], up: [0, 0, -1] };
    case 'front':
      // Looking from CAD −Y (world +Z) toward +Y.
      return { dir: [0, 0, 1], up: [0, 1, 0] };
    case 'right':
      // Looking from CAD +X toward −X.
      return { dir: [1, 0, 0], up: [0, 1, 0] };
    case 'iso': {
      const k = 1 / Math.sqrt(3);
      return { dir: [k, k, k], up: [0, 1, 0] };
    }
  }
}

/**
 * Compute a camera pose that frames `extents` for the given preset.
 *
 * - Orthographic cameras get a zoom that fits the bounding sphere into the
 *   shorter viewport side with ~10% margin.
 * - Perspective cameras are moved back until the bounding sphere fits the
 *   narrower field of view.
 */
export function computeViewPose(
  preset: ViewPreset,
  extents: ModelExtents,
  viewport: ViewportSize,
  options: { orthographic: boolean; fovDeg?: number },
): CameraPose {
  const center = cadToWorld(
    (extents.xMin + extents.xMax) / 2,
    (extents.yMin + extents.yMax) / 2,
    (extents.zMin + extents.zMax) / 2,
  );
  const dx = Math.max(extents.xMax - extents.xMin, 1) * SCALE;
  const dy = Math.max(extents.yMax - extents.yMin, 1) * SCALE;
  const dz = Math.max(extents.zMax - extents.zMin, 1) * SCALE;
  const radius = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz) / 2, 0.5);
  const margin = 1.1;

  const { dir, up } = presetDirection(preset);
  const width = Math.max(viewport.width, 1);
  const height = Math.max(viewport.height, 1);
  const aspect = width / height;

  let distance: number;
  if (options.orthographic) {
    // Distance only needs to clear the model; framing is done by zoom.
    distance = radius * 4 + 1;
  } else {
    const fov = ((options.fovDeg ?? 50) * Math.PI) / 180;
    const halfAngle = Math.atan(Math.tan(fov / 2) * Math.min(1, aspect));
    distance = (radius * margin) / Math.sin(halfAngle) + radius * 0.1;
  }

  const orthoZoom = Math.min(width, height) / (2 * radius * margin);

  return {
    position: [center[0] + dir[0] * distance, center[1] + dir[1] * distance, center[2] + dir[2] * distance],
    target: center,
    up,
    orthoZoom,
  };
}
