import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { useProjectStore, useEditorStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { MemberMesh } from './MemberMesh';
import { GridHelper3D } from './GridHelper3D';

export function Viewer3D() {
  const data = useProjectStore((s) => s.data);
  const { activeStory, selectedIds, wireframe, orthographic, setWireframe, setOrthographic, setSelectedIds } =
    useEditorStore();
  const { t, locale } = useI18n();

  // All hooks must be called before any conditional return (Rules of Hooks)
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipHeight, setClipHeight] = useState(0);

  const topStory = useMemo(
    () => data?.stories.reduce((max, s) => Math.max(max, s.elevation + s.height), 0) ?? 0,
    [data?.stories],
  );

  useEffect(() => {
    setClipHeight((prev) => (prev === 0 ? topStory : Math.min(prev, topStory || 0)));
  }, [topStory]);

  const scale = 0.001;

  const clippingPlanes = useMemo(() => {
    if (!clipEnabled) return undefined;
    return [new THREE.Plane(new THREE.Vector3(0, -1, 0), clipHeight * scale)];
  }, [clipEnabled, clipHeight, scale]);

  if (!data) return null;

  const filteredMembers = data.members.filter(
    (m) => !activeStory || m.story === activeStory,
  );

  // Compute scene center for camera
  let cx = 0, cy = 0, cz = 0;
  if (data.grids.length > 0) {
    const xs = data.grids.filter((g) => g.axis === 'X').map((g) => g.position);
    const ys = data.grids.filter((g) => g.axis === 'Y').map((g) => g.position);
    cx = xs.length > 0 ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
    cy = ys.length > 0 ? (Math.min(...ys) + Math.max(...ys)) / 2 : 0;
  }
  cz = topStory / 2;

  const clipLabel = locale === 'ja' ? '断面' : 'Clip';
  const clipOffLabel = locale === 'ja' ? 'OFF' : 'OFF';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Controls overlay */}
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
          width: 190,
          padding: 10,
          borderRadius: 8,
          background: 'rgba(16, 24, 40, 0.72)',
          color: '#fff',
          display: 'grid',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, letterSpacing: 0.3 }}>{clipLabel}</span>
          <button
            className={`toolbar-btn ${clipEnabled ? 'active' : ''}`}
            style={{ minHeight: 24, fontSize: 11 }}
            onClick={() => setClipEnabled((prev) => !prev)}
          >
            {clipEnabled ? `${Math.round(clipHeight)} mm` : clipOffLabel}
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(topStory, 1)}
          step={100}
          value={clipHeight}
          disabled={!clipEnabled}
          onChange={(event) => setClipHeight(Number(event.target.value))}
        />
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
            position={[cx * scale + 15, cz * scale + 15, cy * scale + 15]}
            zoom={50}
            near={0.1}
            far={1000}
          />
        ) : (
          <PerspectiveCamera
            makeDefault
            position={[cx * scale + 15, cz * scale + 15, -(cy * scale) - 15]}
            fov={50}
            near={0.1}
            far={1000}
          />
        )}

        <OrbitControls
          target={[cx * scale, cz * scale, -(cy * scale)]}
          enableDamping={false}
        />

        <ambientLight intensity={0.6} />
        <directionalLight position={[20, 30, 10]} intensity={0.8} />
        <directionalLight position={[-10, 20, -20]} intensity={0.3} />

        <group scale={[scale, scale, scale]}>
          {/* Coordinate mapping: CAD(x,y,z) -> Three.js(x,z,-y) */}
          <group rotation={[-Math.PI / 2, 0, 0]}>
            <GridHelper3D grids={data.grids} stories={data.stories} />
            {filteredMembers.map((member) => (
              <MemberMesh
                key={member.id}
                member={member}
                section={data.sections.find((s) => s.id === member.sectionId)}
                selected={selectedIds.includes(member.id)}
                wireframe={wireframe}
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
