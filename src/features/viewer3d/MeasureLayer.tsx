import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { measureBetween, formatMm } from './measureUtils';
import type { ViewerLabels } from './viewerLabels';

export interface MeasurePoint {
  x: number;
  y: number;
  z: number;
}

interface Props {
  /** Points already picked (0, 1 or 2), in CAD coordinates (mm). */
  points: MeasurePoint[];
  /** Live hover/preview point while waiting for the second click (CAD mm). */
  preview: MeasurePoint | null;
  labels: ViewerLabels;
}

const MARKER_RADIUS = 90; // mm, visible at the CAD scale used by the scene

/**
 * Renders the 3D measurement overlay: picked-point markers, the connecting
 * line, and an Html label with the 3D distance and dx/dy/dz components.
 * Must be mounted inside the rotated/scaled CAD-coordinate group.
 */
export function MeasureLayer({ points, preview, labels }: Props) {
  const a = points[0] ? new THREE.Vector3(points[0].x, points[0].y, points[0].z) : null;
  const b = points[1]
    ? new THREE.Vector3(points[1].x, points[1].y, points[1].z)
    : preview
      ? new THREE.Vector3(preview.x, preview.y, preview.z)
      : null;

  const provisional = !points[1];

  return (
    <group>
      {a && <Marker position={a} color="#22d3ee" />}
      {points[1] && b && <Marker position={b} color="#22d3ee" />}

      {a && b && (
        <>
          <Line
            points={[
              [a.x, a.y, a.z],
              [b.x, b.y, b.z],
            ]}
            color={provisional ? '#94a3b8' : '#f59e0b'}
            lineWidth={2}
            dashed={provisional}
            dashSize={150}
            gapSize={120}
            transparent
            opacity={0.95}
          />
          <MeasureLabel a={a} b={b} provisional={provisional} labels={labels} />
        </>
      )}
    </group>
  );
}

function Marker({ position, color }: { position: THREE.Vector3; color: string }) {
  return (
    <mesh position={[position.x, position.y, position.z]}>
      <sphereGeometry args={[MARKER_RADIUS, 16, 16]} />
      <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.9} />
    </mesh>
  );
}

function MeasureLabel({
  a,
  b,
  provisional,
  labels,
}: {
  a: THREE.Vector3;
  b: THREE.Vector3;
  provisional: boolean;
  labels: ViewerLabels;
}) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const { distance, dx, dy, dz } = measureBetween(a, b);

  return (
    <Html position={[mid.x, mid.y, mid.z]} center distanceFactor={undefined} zIndexRange={[20, 0]}>
      <div
        style={{
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          padding: '4px 7px',
          borderRadius: 6,
          fontSize: 11,
          lineHeight: 1.35,
          fontFamily: 'monospace',
          color: '#fff',
          background: provisional ? 'rgba(71,85,105,0.85)' : 'rgba(180,83,9,0.92)',
          border: '1px solid rgba(255,255,255,0.25)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          transform: 'translateY(-50%)',
        }}
      >
        <div>
          <strong>{labels.measureDistance}</strong> {formatMm(distance)} mm
        </div>
        <div style={{ opacity: 0.9 }}>
          dx {formatMm(dx)} / dy {formatMm(dy)} / dz {formatMm(dz)}
        </div>
      </div>
    </Html>
  );
}
