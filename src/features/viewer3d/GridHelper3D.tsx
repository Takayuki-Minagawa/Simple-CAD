import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import type { Grid, Story } from '@/domain/structural/types';

interface Props {
  grids: Grid[];
  stories: Story[];
}

export function GridHelper3D({ grids, stories }: Props) {
  const xGrids = grids.filter((g) => g.axis === 'X');
  const yGrids = grids.filter((g) => g.axis === 'Y');

  const minX = xGrids.length > 0 ? Math.min(...xGrids.map((g) => g.position)) : 0;
  const maxX = xGrids.length > 0 ? Math.max(...xGrids.map((g) => g.position)) : 10000;
  const minY = yGrids.length > 0 ? Math.min(...yGrids.map((g) => g.position)) : 0;
  const maxY = yGrids.length > 0 ? Math.max(...yGrids.map((g) => g.position)) : 10000;

  const margin = 500;

  const lines = useMemo(() => {
    const result: { key: string; points: [number, number, number][] }[] = [];
    for (const g of xGrids) {
      result.push({
        key: `x-${g.id}`,
        points: [
          [g.position, minY - margin, 0],
          [g.position, maxY + margin, 0],
        ],
      });
    }
    for (const g of yGrids) {
      result.push({
        key: `y-${g.id}`,
        points: [
          [minX - margin, g.position, 0],
          [maxX + margin, g.position, 0],
        ],
      });
    }
    return result;
  }, [xGrids, yGrids, minX, maxX, minY, maxY, margin]);

  return (
    <group>
      {lines.map(({ key, points }) => (
        <Line key={key} points={points} color="#27ae60" lineWidth={1} opacity={0.4} transparent />
      ))}
      {stories.map((s) => (
        <mesh
          key={s.id}
          position={[(minX + maxX) / 2, (minY + maxY) / 2, s.elevation]}
        >
          <planeGeometry args={[maxX - minX + 2 * margin, maxY - minY + 2 * margin]} />
          <meshBasicMaterial color="#aaaaaa" transparent opacity={0.08} side={2} />
        </mesh>
      ))}
    </group>
  );
}
