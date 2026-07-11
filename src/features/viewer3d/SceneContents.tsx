import { useCallback, useMemo, useRef, useState } from 'react';
import { GizmoHelper, GizmoViewport, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { AnalysisResultsMetadata, Grid, Member, Opening, Section, Story } from '@/domain/structural/types';
import { GridHelper3D } from './GridHelper3D';
import { MemberMesh } from './MemberMesh';
import { MeasureLayer, type MeasurePoint } from './MeasureLayer';
import { HoverProbe, type HoverInfo } from './HoverProbe';
import { getMemberSnapPoints, getMemberLength, getSectionLabel } from './measureUtils';
import type { GeometryEngine } from './memberGeometry';
import { SCALE, type ModelExtents, type SectionBoxState, type SectionMode } from './sectionMath';
import type { ViewerLabels } from './viewerLabels';
import { AnalysisResultsLayer } from './AnalysisResultsLayer';
import { buildUtilizationMap, utilizationColor } from './analysisResults';

/** Snap a CAD-space hit point to the nearest member endpoint within this radius (mm). */
const SNAP_RADIUS = 400;

interface SceneContentsProps {
  orthographic: boolean;
  extents: ModelExtents;
  sectionMode: SectionMode;
  effectiveBox: SectionBoxState;
  grids: Grid[];
  stories: Story[];
  activeStory: string | null;
  filteredMembers: Member[];
  sectionMap: Map<string, Section>;
  openingsMap: Map<string, Opening[]>;
  selectedIds: string[];
  layerLocked: Record<string, boolean>;
  wireframe: boolean;
  geometryEngine: GeometryEngine;
  clippingPlanes: THREE.Plane[] | undefined;
  setSelectedIds: (ids: string[]) => void;
  // ── 3D measurement / hover probe ──
  measureMode: boolean;
  measurePoints: MeasurePoint[];
  addMeasurePoint: (point: MeasurePoint) => void;
  labels: ViewerLabels;
  analysisResults?: AnalysisResultsMetadata;
  showAnalysisResults: boolean;
  analysisScale: number;
  showAllStories: boolean;
}

export function SceneContents({
  orthographic,
  extents,
  sectionMode,
  effectiveBox,
  grids,
  stories,
  activeStory,
  filteredMembers,
  sectionMap,
  openingsMap,
  selectedIds,
  layerLocked,
  wireframe,
  geometryEngine,
  clippingPlanes,
  setSelectedIds,
  measureMode,
  measurePoints,
  addMeasurePoint,
  labels,
  analysisResults,
  showAnalysisResults,
  analysisScale,
  showAllStories,
}: SceneContentsProps) {
  // Inner group that holds members in CAD coordinates (mm). Used to convert
  // world-space raycast hit points back into CAD space for measuring/snapping.
  const cadGroupRef = useRef<THREE.Group>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const utilizationMap = useMemo(
    () => buildUtilizationMap(analysisResults?.memberResults),
    [analysisResults?.memberResults],
  );
  const memberResultMap = useMemo(
    () => new Map((analysisResults?.memberResults ?? []).map((result) => [result.memberId, result])),
    [analysisResults?.memberResults],
  );

  /** Convert a world-space point into the CAD-coordinate frame (mm). */
  const worldToCad = useCallback((worldPoint: THREE.Vector3): THREE.Vector3 => {
    const group = cadGroupRef.current;
    if (!group) return worldPoint.clone();
    return group.worldToLocal(worldPoint.clone());
  }, []);

  /** Snap a CAD-space point to the nearest member endpoint within SNAP_RADIUS. */
  const snapToEndpoint = useCallback(
    (cadPoint: THREE.Vector3): THREE.Vector3 => {
      let best: THREE.Vector3 | null = null;
      let bestDist = SNAP_RADIUS;
      for (const member of filteredMembers) {
        for (const candidate of getMemberSnapPoints(member, sectionMap.get(member.sectionId))) {
          const dist = candidate.distanceTo(cadPoint);
          if (dist < bestDist) {
            bestDist = dist;
            best = candidate;
          }
        }
      }
      return best ?? cadPoint;
    },
    [filteredMembers, sectionMap],
  );

  const handleMeasurePick = useCallback(
    (worldPoint: THREE.Vector3) => {
      const cad = snapToEndpoint(worldToCad(worldPoint));
      addMeasurePoint({ x: cad.x, y: cad.y, z: cad.z });
    },
    [snapToEndpoint, worldToCad, addMeasurePoint],
  );

  const handleHover = useCallback(
    (member: Member, section: Section | undefined, worldPoint: THREE.Vector3) => {
      const cad = worldToCad(worldPoint);
      const story = stories.find((s) => s.id === member.story);
      setHover({
        position: { x: cad.x, y: cad.y, z: cad.z },
        length: getMemberLength(member),
        sectionName: getSectionLabel(section),
        storyName: story?.name ?? member.story,
        memberType: member.type,
        ...(showAnalysisResults && memberResultMap.has(member.id)
          ? { result: memberResultMap.get(member.id) }
          : {}),
      });
    },
    [worldToCad, stories, showAnalysisResults, memberResultMap, setHover],
  );

  const handleHoverEnd = useCallback(() => setHover(null), [setHover]);

  const centerX = (extents.xMin + extents.xMax) / 2;
  const centerY = (extents.yMin + extents.yMax) / 2;
  const centerZ = (extents.zMin + extents.zMax) / 2;
  const boxCenter = {
    x: (effectiveBox.xMin + effectiveBox.xMax) / 2,
    y: (effectiveBox.yMin + effectiveBox.yMax) / 2,
    z: (effectiveBox.zMin + effectiveBox.zMax) / 2,
  };
  const boxSize = {
    x: Math.max(effectiveBox.xMax - effectiveBox.xMin, 1),
    y: Math.max(effectiveBox.yMax - effectiveBox.yMin, 1),
    z: Math.max(effectiveBox.zMax - effectiveBox.zMin, 1),
  };

  return (
    <>
      {orthographic ? (
        <OrthographicCamera
          makeDefault
          position={[centerX * SCALE + 15, centerZ * SCALE + 15, centerY * SCALE + 15]}
          zoom={50}
          near={0.1}
          far={1000}
        />
      ) : (
        <PerspectiveCamera
          makeDefault
          position={[centerX * SCALE + 15, centerZ * SCALE + 15, -(centerY * SCALE) - 15]}
          fov={50}
          near={0.1}
          far={1000}
        />
      )}

      <OrbitControls target={[centerX * SCALE, centerZ * SCALE, -(centerY * SCALE)]} enableDamping={false} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[20, 30, 10]} intensity={0.8} />
      <directionalLight position={[-10, 20, -20]} intensity={0.3} />

      <group scale={[SCALE, SCALE, SCALE]}>
        <group ref={cadGroupRef} rotation={[-Math.PI / 2, 0, 0]}>
          <GridHelper3D grids={grids} stories={stories} activeStoryId={activeStory} />

          {sectionMode === 'box' && (
            <mesh position={[boxCenter.x, boxCenter.y, boxCenter.z]}>
              <boxGeometry args={[boxSize.x, boxSize.y, boxSize.z]} />
              <meshBasicMaterial color="#93c5fd" wireframe transparent opacity={0.18} />
            </mesh>
          )}

          {filteredMembers.map((member) => {
            const locked = !!layerLocked[`member-${member.type}`];
            return (
              <MemberMesh
                key={member.id}
                member={member}
                section={sectionMap.get(member.sectionId)}
                openings={openingsMap.get(member.id) ?? []}
                selected={selectedSet.has(member.id)}
                wireframe={wireframe}
                engine={geometryEngine}
                clippingPlanes={clippingPlanes}
                colorOverride={showAnalysisResults ? utilizationColor(utilizationMap.get(member.id)) : undefined}
                onClick={() => { if (!locked) setSelectedIds([member.id]); }}
                measureMode={measureMode}
                onMeasurePick={handleMeasurePick}
                onHover={handleHover}
                onHoverEnd={handleHoverEnd}
              />
            );
          })}

          {showAnalysisResults && analysisResults && (
            <AnalysisResultsLayer
              members={filteredMembers}
              results={analysisResults}
              scale={analysisScale}
              showAllStories={showAllStories}
            />
          )}

          {measureMode && (
            <MeasureLayer
              points={measurePoints}
              preview={hover && measurePoints.length === 1 ? hover.position : null}
              labels={labels}
            />
          )}
          {!measureMode && <HoverProbe hover={hover} labels={labels} />}
        </group>
      </group>

      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport labelColor="white" axisHeadScale={1} />
      </GizmoHelper>
    </>
  );
}
