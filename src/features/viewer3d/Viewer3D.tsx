import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import type { Opening } from '@/domain/structural/types';
import { type GeometryEngine } from './memberGeometry';
import { SceneContents } from './SceneContents';
import { SectionControls } from './SectionControls';
import { ViewerInfoPanel } from './ViewerInfoPanel';
import { ViewerToolbar } from './ViewerToolbar';
import {
  buildMaxPlane,
  buildMinPlane,
  clamp,
  clampSectionBox,
  computeModelExtents,
  getAxisRange,
  type SectionAxis,
  type SectionBoxState,
  type SectionMode,
} from './sectionMath';
import { getViewerLabels } from './viewerLabels';

export function Viewer3D() {
  const data = useProjectStore((state) => state.data);
  const { activeStory, selectedIds, wireframe, orthographic, setWireframe, setOrthographic, setSelectedIds } =
    useEditorStore();
  const { t, locale } = useI18n();

  const [sectionMode, setSectionMode] = useState<SectionMode>('off');
  const [sectionAxis, setSectionAxis] = useState<SectionAxis>('z');
  const [sectionPosition, setSectionPosition] = useState<number | null>(null);
  const [sectionThickness, setSectionThickness] = useState<number | null>(null);
  const [sectionBox, setSectionBox] = useState<SectionBoxState | null>(null);
  const [geometryEngine, setGeometryEngine] = useState<GeometryEngine>('native');
  const [showAllStories, setShowAllStories] = useState(true);

  const filteredMembers = useMemo(
    () =>
      data?.members.filter((member) => showAllStories || !activeStory || member.story === activeStory) ?? [],
    [data?.members, activeStory, showAllStories],
  );

  const sectionMap = useMemo(
    () => new Map((data?.sections ?? []).map((section) => [section.id, section])),
    [data?.sections],
  );

  const openingsMap = useMemo(() => {
    const map = new Map<string, Opening[]>();
    for (const opening of data?.openings ?? []) {
      const list = map.get(opening.memberId);
      if (list) {
        list.push(opening);
      } else {
        map.set(opening.memberId, [opening]);
      }
    }
    return map;
  }, [data?.openings]);

  const extents = useMemo(() => computeModelExtents(data, filteredMembers, sectionMap), [data, filteredMembers, sectionMap]);
  const axisRange = useMemo(() => getAxisRange(extents, sectionAxis), [extents, sectionAxis]);
  const effectivePosition = clamp(
    sectionPosition ?? (axisRange.min + axisRange.max) / 2,
    axisRange.min,
    axisRange.max,
  );
  const effectiveThickness = clamp(
    sectionThickness ?? Math.max((axisRange.max - axisRange.min) * 0.2, 1000),
    100,
    Math.max(axisRange.max - axisRange.min, 100),
  );
  const effectiveBox = useMemo(
    () =>
      clampSectionBox(
        sectionBox ?? {
          xMin: extents.xMin,
          xMax: extents.xMax,
          yMin: extents.yMin,
          yMax: extents.yMax,
          zMin: extents.zMin,
          zMax: extents.zMax,
        },
        extents,
      ),
    [sectionBox, extents],
  );

  const clippingPlanes = useMemo(() => {
    switch (sectionMode) {
      case 'off':
        return undefined;
      case 'clip':
        return [buildMaxPlane(sectionAxis, effectivePosition)];
      case 'slice': {
        const half = effectiveThickness / 2;
        return [
          buildMinPlane(sectionAxis, effectivePosition - half),
          buildMaxPlane(sectionAxis, effectivePosition + half),
        ];
      }
      case 'box':
        return [
          buildMinPlane('x', effectiveBox.xMin),
          buildMaxPlane('x', effectiveBox.xMax),
          buildMinPlane('y', effectiveBox.yMin),
          buildMaxPlane('y', effectiveBox.yMax),
          buildMinPlane('z', effectiveBox.zMin),
          buildMaxPlane('z', effectiveBox.zMax),
        ];
    }
  }, [sectionMode, sectionAxis, effectivePosition, effectiveThickness, effectiveBox]);

  if (!data) return null;

  const labels = getViewerLabels(locale);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ViewerToolbar
        labels={labels}
        t={t}
        activeStory={activeStory}
        showAllStories={showAllStories}
        setShowAllStories={setShowAllStories}
        orthographic={orthographic}
        setOrthographic={setOrthographic}
        wireframe={wireframe}
        setWireframe={setWireframe}
      />

      <ViewerInfoPanel
        labels={labels}
        showAllStories={showAllStories}
        stories={data.stories}
        activeStory={activeStory}
        extents={extents}
        filteredMembers={filteredMembers}
      />

      <SectionControls
        labels={labels}
        sectionMode={sectionMode}
        setSectionMode={setSectionMode}
        sectionAxis={sectionAxis}
        setSectionAxis={setSectionAxis}
        axisRange={axisRange}
        effectivePosition={effectivePosition}
        setSectionPosition={setSectionPosition}
        effectiveThickness={effectiveThickness}
        setSectionThickness={setSectionThickness}
        effectiveBox={effectiveBox}
        setSectionBox={setSectionBox}
        extents={extents}
        geometryEngine={geometryEngine}
        setGeometryEngine={setGeometryEngine}
      />

      <Canvas
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
        onPointerMissed={() => setSelectedIds([])}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
      >
        <SceneContents
          orthographic={orthographic}
          extents={extents}
          sectionMode={sectionMode}
          effectiveBox={effectiveBox}
          grids={data.grids}
          stories={data.stories}
          activeStory={activeStory}
          filteredMembers={filteredMembers}
          sectionMap={sectionMap}
          openingsMap={openingsMap}
          selectedIds={selectedIds}
          wireframe={wireframe}
          geometryEngine={geometryEngine}
          clippingPlanes={clippingPlanes}
          setSelectedIds={setSelectedIds}
        />
      </Canvas>
    </div>
  );
}
