import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import type { Member, Opening, ProjectData, Section } from '@/domain/structural/types';
import { GridHelper3D } from './GridHelper3D';
import { MemberMesh } from './MemberMesh';
import { isOpenCascadeRuntimeAvailable, type GeometryEngine } from './memberGeometry';

type SectionMode = 'off' | 'clip' | 'slice' | 'box';
type SectionAxis = 'x' | 'y' | 'z';

interface SectionBoxState {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

interface ModelExtents {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

const SCALE = 0.001;

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

  const filteredMembers = useMemo(
    () => data?.members.filter((member) => !activeStory || member.story === activeStory) ?? [],
    [data?.members, activeStory],
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

  const labels = locale === 'ja'
    ? {
        section: '断面',
        mode: 'モード',
        axis: '軸',
        position: '位置',
        thickness: '厚み',
        engine: '形状',
        off: 'OFF',
        clip: '片側',
        slice: 'スライス',
        box: 'ボックス',
        native: '標準',
        opencascade: 'OpenCascade',
        runtimeMissing: '外部ランタイム未検出',
      }
    : {
        section: 'Section',
        mode: 'Mode',
        axis: 'Axis',
        position: 'Position',
        thickness: 'Thickness',
        engine: 'Geometry',
        off: 'OFF',
        clip: 'Clip',
        slice: 'Slice',
        box: 'Box',
        native: 'Native',
        opencascade: 'OpenCascade',
        runtimeMissing: 'Runtime not detected',
      };
  const openCascadeAvailable = isOpenCascadeRuntimeAvailable();

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 10,
          display: 'flex',
          gap: 4,
        }}
      >
        <button
          className="toolbar-btn"
          style={{ background: orthographic ? 'var(--accent)' : '#555', color: '#fff', fontSize: 11 }}
          onClick={() => setOrthographic(!orthographic)}
        >
          {orthographic ? t.viewOrtho : t.viewPersp}
        </button>
        <button
          className="toolbar-btn"
          style={{ background: wireframe ? 'var(--accent)' : '#555', color: '#fff', fontSize: 11 }}
          onClick={() => setWireframe(!wireframe)}
        >
          {t.viewWire}
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 48,
          right: 8,
          zIndex: 10,
          width: 224,
          padding: 10,
          borderRadius: 8,
          background: 'rgba(16, 24, 40, 0.78)',
          color: '#fff',
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 11, letterSpacing: 0.3 }}>{labels.section}</span>
          <select
            className="prop-select"
            value={sectionMode}
            onChange={(event) => setSectionMode(event.target.value as SectionMode)}
          >
            <option value="off">{labels.off}</option>
            <option value="clip">{labels.clip}</option>
            <option value="slice">{labels.slice}</option>
            <option value="box">{labels.box}</option>
          </select>
        </div>

        {sectionMode !== 'off' && (
          <>
            {sectionMode !== 'box' && (
              <>
                <div style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 11 }}>{labels.axis}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['x', 'y', 'z'] as SectionAxis[]).map((axis) => (
                      <button
                        key={axis}
                        className={`toolbar-btn ${sectionAxis === axis ? 'active' : ''}`}
                        style={{ flex: 1, minHeight: 24, fontSize: 11 }}
                        onClick={() => setSectionAxis(axis)}
                      >
                        {axis.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <label style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 11 }}>{labels.position}: {Math.round(effectivePosition)} mm</span>
                  <input
                    type="range"
                    min={axisRange.min}
                    max={axisRange.max}
                    step={100}
                    value={effectivePosition}
                    onChange={(event) => setSectionPosition(Number(event.target.value))}
                  />
                </label>

                {sectionMode === 'slice' && (
                  <label style={{ display: 'grid', gap: 4 }}>
                    <span style={{ fontSize: 11 }}>{labels.thickness}: {Math.round(effectiveThickness)} mm</span>
                    <input
                      type="range"
                      min={100}
                      max={Math.max(axisRange.max - axisRange.min, 100)}
                      step={100}
                      value={effectiveThickness}
                      onChange={(event) => setSectionThickness(Number(event.target.value))}
                    />
                  </label>
                )}
              </>
            )}

            {sectionMode === 'box' && (
              <>
                {renderBoxSlider(labels.axis, 'X', effectiveBox.xMin, extents.xMin, effectiveBox.xMax, (value) =>
                  setSectionBox((current) => ({
                    ...(current ?? effectiveBox),
                    xMin: Math.min(value, (current ?? effectiveBox).xMax - 100),
                  })),
                )}
                {renderBoxSlider(labels.axis, 'X max', effectiveBox.xMax, effectiveBox.xMin + 100, extents.xMax, (value) =>
                  setSectionBox((current) => ({
                    ...(current ?? effectiveBox),
                    xMax: Math.max(value, (current ?? effectiveBox).xMin + 100),
                  })),
                )}
                {renderBoxSlider(labels.axis, 'Y', effectiveBox.yMin, extents.yMin, effectiveBox.yMax, (value) =>
                  setSectionBox((current) => ({
                    ...(current ?? effectiveBox),
                    yMin: Math.min(value, (current ?? effectiveBox).yMax - 100),
                  })),
                )}
                {renderBoxSlider(labels.axis, 'Y max', effectiveBox.yMax, effectiveBox.yMin + 100, extents.yMax, (value) =>
                  setSectionBox((current) => ({
                    ...(current ?? effectiveBox),
                    yMax: Math.max(value, (current ?? effectiveBox).yMin + 100),
                  })),
                )}
                {renderBoxSlider(labels.axis, 'Z', effectiveBox.zMin, extents.zMin, effectiveBox.zMax, (value) =>
                  setSectionBox((current) => ({
                    ...(current ?? effectiveBox),
                    zMin: Math.min(value, (current ?? effectiveBox).zMax - 100),
                  })),
                )}
                {renderBoxSlider(labels.axis, 'Z max', effectiveBox.zMax, effectiveBox.zMin + 100, extents.zMax, (value) =>
                  setSectionBox((current) => ({
                    ...(current ?? effectiveBox),
                    zMax: Math.max(value, (current ?? effectiveBox).zMin + 100),
                  })),
                )}
              </>
            )}
          </>
        )}

        <div style={{ display: 'grid', gap: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <span style={{ fontSize: 11 }}>{labels.engine}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`toolbar-btn ${geometryEngine === 'native' ? 'active' : ''}`}
              style={{ flex: 1, minHeight: 24, fontSize: 11 }}
              onClick={() => setGeometryEngine('native')}
            >
              {labels.native}
            </button>
            <button
              className={`toolbar-btn ${geometryEngine === 'opencascade' ? 'active' : ''}`}
              style={{ flex: 1, minHeight: 24, fontSize: 11, opacity: openCascadeAvailable ? 1 : 0.55 }}
              onClick={() => {
                if (openCascadeAvailable) setGeometryEngine('opencascade');
              }}
              disabled={!openCascadeAvailable}
            >
              {labels.opencascade}
            </button>
          </div>
          {!openCascadeAvailable && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)' }}>{labels.runtimeMissing}</span>
          )}
        </div>
      </div>

      <Canvas
        gl={{ antialias: true }}
        onPointerMissed={() => setSelectedIds([])}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
        }}
      >
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
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <GridHelper3D grids={data.grids} stories={data.stories} />

            {sectionMode === 'box' && (
              <mesh position={[boxCenter.x, boxCenter.y, boxCenter.z]}>
                <boxGeometry args={[boxSize.x, boxSize.y, boxSize.z]} />
                <meshBasicMaterial color="#93c5fd" wireframe transparent opacity={0.18} />
              </mesh>
            )}

            {filteredMembers.map((member) => (
              <MemberMesh
                key={member.id}
                member={member}
                section={sectionMap.get(member.sectionId)}
                openings={openingsMap.get(member.id) ?? []}
                selected={selectedIds.includes(member.id)}
                wireframe={wireframe}
                engine={geometryEngine}
                clippingPlanes={clippingPlanes}
                onClick={() => setSelectedIds([member.id])}
              />
            ))}
          </group>
        </group>

        <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
          <GizmoViewport labelColor="white" axisHeadScale={1} />
        </GizmoHelper>
      </Canvas>
    </div>
  );
}

function renderBoxSlider(
  prefix: string,
  axisLabel: string,
  value: number,
  min: number,
  max: number,
  onChange: (value: number) => void,
) {
  return (
    <label key={axisLabel} style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 11 }}>{prefix} {axisLabel}: {Math.round(value)} mm</span>
      <input
        type="range"
        min={min}
        max={max}
        step={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function computeModelExtents(
  data: ProjectData | null,
  members: Member[],
  sectionMap: Map<string, Section>,
): ModelExtents {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];

  for (const grid of data?.grids ?? []) {
    if (grid.axis === 'X') xs.push(grid.position);
    if (grid.axis === 'Y') ys.push(grid.position);
  }

  for (const story of data?.stories ?? []) {
    zs.push(story.elevation, story.elevation + story.height);
  }

  for (const member of members) {
    if (member.type === 'slab') {
      const section = sectionMap.get(member.sectionId);
      const thickness = section && 'thickness' in section ? section.thickness : 180;
      for (const point of member.polygon) {
        xs.push(point.x);
        ys.push(point.y);
      }
      zs.push(member.level - thickness, member.level);
      continue;
    }

    xs.push(member.start.x, member.end.x);
    ys.push(member.start.y, member.end.y);
    zs.push(member.start.z, member.end.z);
    if (member.type === 'wall') {
      zs.push(member.start.z + member.height, member.end.z + member.height);
    }
  }

  if (xs.length === 0) xs.push(0, 8000);
  if (ys.length === 0) ys.push(0, 6000);
  if (zs.length === 0) zs.push(0, 3000);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const zMin = Math.min(...zs);
  const zMax = Math.max(...zs);

  return {
    xMin: xMin - Math.max((xMax - xMin) * 0.05, 1000),
    xMax: xMax + Math.max((xMax - xMin) * 0.05, 1000),
    yMin: yMin - Math.max((yMax - yMin) * 0.05, 1000),
    yMax: yMax + Math.max((yMax - yMin) * 0.05, 1000),
    zMin: Math.max(zMin - 500, 0),
    zMax: zMax + 500,
  };
}

function getAxisRange(extents: ModelExtents, axis: SectionAxis) {
  switch (axis) {
    case 'x':
      return { min: extents.xMin, max: extents.xMax };
    case 'y':
      return { min: extents.yMin, max: extents.yMax };
    case 'z':
      return { min: extents.zMin, max: extents.zMax };
  }
}

function clampSectionBox(box: SectionBoxState, extents: ModelExtents): SectionBoxState {
  const xMin = clamp(box.xMin, extents.xMin, extents.xMax - 100);
  const xMax = clamp(box.xMax, xMin + 100, extents.xMax);
  const yMin = clamp(box.yMin, extents.yMin, extents.yMax - 100);
  const yMax = clamp(box.yMax, yMin + 100, extents.yMax);
  const zMin = clamp(box.zMin, extents.zMin, extents.zMax - 100);
  const zMax = clamp(box.zMax, zMin + 100, extents.zMax);
  return { xMin, xMax, yMin, yMax, zMin, zMax };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildMinPlane(axis: SectionAxis, position: number): THREE.Plane {
  const normal = cadAxisToWorldBasis(axis);
  return new THREE.Plane(normal, -position * SCALE);
}

function buildMaxPlane(axis: SectionAxis, position: number): THREE.Plane {
  const normal = cadAxisToWorldBasis(axis).clone().multiplyScalar(-1);
  return new THREE.Plane(normal, position * SCALE);
}

function cadAxisToWorldBasis(axis: SectionAxis): THREE.Vector3 {
  switch (axis) {
    case 'x':
      return new THREE.Vector3(1, 0, 0);
    case 'y':
      return new THREE.Vector3(0, 0, -1);
    case 'z':
      return new THREE.Vector3(0, 1, 0);
  }
}
