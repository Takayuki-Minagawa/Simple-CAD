import { Line } from '@react-three/drei';
import type { AnalysisResultsMetadata, Member } from '@/domain/structural/types';
import {
  buildDisplacementMap,
  buildUtilizationMap,
  displacePoint,
  utilizationColor,
} from './analysisResults';

interface AnalysisResultsLayerProps {
  members: Member[];
  results: AnalysisResultsMetadata;
  scale: number;
}

export function AnalysisResultsLayer({ members, results, scale }: AnalysisResultsLayerProps) {
  const displacementMap = buildDisplacementMap(results.nodeDisplacements);
  const utilizationMap = buildUtilizationMap(results.memberResults);

  return (
    <group>
      {members.map((member) => {
        const color = utilizationColor(utilizationMap.get(member.id)) ?? '#38bdf8';
        if (member.type === 'slab') {
          const points = member.polygon.map((point) =>
            displacePoint({ x: point.x, y: point.y, z: member.level }, displacementMap, scale),
          );
          if (!points.some((point) => point.hasResult)) return null;
          return (
            <Line
              key={member.id}
              points={[...points, points[0]].map(({ x, y, z }) => [x, y, z] as [number, number, number])}
              color={color}
              lineWidth={2.5}
            />
          );
        }

        const start = displacePoint(member.start, displacementMap, scale);
        const end = displacePoint(member.end, displacementMap, scale);
        if (!start.hasResult && !end.hasResult) return null;
        return (
          <Line
            key={member.id}
            points={[
              [start.x, start.y, start.z],
              [end.x, end.y, end.z],
            ]}
            color={color}
            lineWidth={3}
          />
        );
      })}

      {(results.nodeDisplacements ?? []).map((node, index) => {
        const point = {
          x: node.position.x + node.dx * scale,
          y: node.position.y + node.dy * scale,
          z: node.position.z + node.dz * scale,
        };
        return (
          <mesh key={node.id ?? `${point.x}:${point.y}:${point.z}:${index}`} position={[point.x, point.y, point.z]}>
            <sphereGeometry args={[70, 8, 8]} />
            <meshBasicMaterial color="#e0f2fe" depthTest={false} />
          </mesh>
        );
      })}
    </group>
  );
}
