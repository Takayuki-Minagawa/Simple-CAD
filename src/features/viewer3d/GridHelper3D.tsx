import { useMemo } from 'react';
import { Billboard, Line, Text } from '@react-three/drei';
import type { Grid, Story } from '@/domain/structural/types';

interface Props {
  grids: Grid[];
  stories: Story[];
  activeStoryId: string | null;
}

export function GridHelper3D({ grids, stories, activeStoryId }: Props) {
  const xGrids = grids.filter((g) => g.axis === 'X');
  const yGrids = grids.filter((g) => g.axis === 'Y');

  const minX = xGrids.length > 0 ? Math.min(...xGrids.map((g) => g.position)) : 0;
  const maxX = xGrids.length > 0 ? Math.max(...xGrids.map((g) => g.position)) : 10000;
  const minY = yGrids.length > 0 ? Math.min(...yGrids.map((g) => g.position)) : 0;
  const maxY = yGrids.length > 0 ? Math.max(...yGrids.map((g) => g.position)) : 10000;

  const margin = 500;

  const storyLevels = useMemo<Story[]>(
    () => (stories.length > 0 ? stories : [{ id: 'base', name: 'Base', elevation: 0, height: 3000 }]),
    [stories],
  );

  const gridLines = useMemo(() => {
    const result: {
      key: string;
      points: [number, number, number][];
      active: boolean;
      axis: Grid['axis'];
    }[] = [];

    for (const story of storyLevels) {
      const active = story.id === activeStoryId;
      for (const grid of xGrids) {
        result.push({
          key: `${story.id}-x-${grid.id}`,
          active,
          axis: 'X',
          points: [
            [grid.position, minY - margin, story.elevation],
            [grid.position, maxY + margin, story.elevation],
          ],
        });
      }
      for (const grid of yGrids) {
        result.push({
          key: `${story.id}-y-${grid.id}`,
          active,
          axis: 'Y',
          points: [
            [minX - margin, grid.position, story.elevation],
            [maxX + margin, grid.position, story.elevation],
          ],
        });
      }
    }
    return result;
  }, [storyLevels, activeStoryId, xGrids, yGrids, minX, maxX, minY, maxY, margin]);

  const storyFrames = useMemo(
    () =>
      storyLevels.map((story) => ({
        story,
        active: story.id === activeStoryId,
        points: [
          [minX - margin, minY - margin, story.elevation],
          [maxX + margin, minY - margin, story.elevation],
          [maxX + margin, maxY + margin, story.elevation],
          [minX - margin, maxY + margin, story.elevation],
          [minX - margin, minY - margin, story.elevation],
        ] as [number, number, number][],
      })),
    [storyLevels, activeStoryId, minX, maxX, minY, maxY, margin],
  );

  const levelRailX = maxX + margin * 1.5;
  const levelRailY = maxY + margin * 1.5;
  const minElevation = Math.min(...storyLevels.map((story) => story.elevation));
  const maxElevation = Math.max(...storyLevels.map((story) => story.elevation + story.height));

  return (
    <group>
      {gridLines.map(({ key, points, active, axis }) => (
        <Line
          key={key}
          points={points}
          color={axis === 'X' ? '#16a34a' : '#2563eb'}
          lineWidth={active ? 1.8 : 0.9}
          opacity={active ? 0.58 : 0.2}
          transparent
        />
      ))}
      {storyFrames.map(({ story, active, points }) => (
        <group key={story.id}>
          <Line
            points={points}
            color={active ? '#60a5fa' : '#94a3b8'}
            lineWidth={active ? 2 : 1}
            opacity={active ? 0.75 : 0.34}
            transparent
          />
          <mesh position={[(minX + maxX) / 2, (minY + maxY) / 2, story.elevation]}>
            <planeGeometry args={[maxX - minX + 2 * margin, maxY - minY + 2 * margin]} />
            <meshBasicMaterial color={active ? '#60a5fa' : '#aaaaaa'} transparent opacity={active ? 0.14 : 0.055} side={2} />
          </mesh>
          <Billboard position={[maxX + margin * 1.2, minY - margin, story.elevation]}>
            <Text fontSize={280} color={active ? '#e0f2fe' : '#cbd5e1'} anchorX="left" anchorY="middle">
              {story.name} EL {Math.round(story.elevation)}
            </Text>
          </Billboard>
        </group>
      ))}

      {xGrids.map((grid) => (
        <Billboard key={`label-x-${grid.id}`} position={[grid.position, minY - margin * 1.6, minElevation]}>
          <Text fontSize={240} color="#86efac" anchorX="center" anchorY="middle">
            {grid.name}
          </Text>
        </Billboard>
      ))}
      {yGrids.map((grid) => (
        <Billboard key={`label-y-${grid.id}`} position={[minX - margin * 1.6, grid.position, minElevation]}>
          <Text fontSize={240} color="#93c5fd" anchorX="center" anchorY="middle">
            {grid.name}
          </Text>
        </Billboard>
      ))}

      <Line
        points={[
          [levelRailX, levelRailY, minElevation],
          [levelRailX, levelRailY, maxElevation],
        ]}
        color="#f8fafc"
        lineWidth={1.4}
        opacity={0.55}
        transparent
      />
      {storyLevels.map((story) => (
        <group key={`tick-${story.id}`}>
          <Line
            points={[
              [levelRailX - margin * 0.25, levelRailY, story.elevation],
              [levelRailX + margin * 0.25, levelRailY, story.elevation],
            ]}
            color={story.id === activeStoryId ? '#60a5fa' : '#f8fafc'}
            lineWidth={story.id === activeStoryId ? 2 : 1}
            opacity={0.78}
            transparent
          />
          <Billboard position={[levelRailX + margin * 0.4, levelRailY, story.elevation]}>
            <Text fontSize={220} color={story.id === activeStoryId ? '#e0f2fe' : '#f8fafc'} anchorX="left" anchorY="middle">
              {Math.round(story.elevation)}
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  );
}
