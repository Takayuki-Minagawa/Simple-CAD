import type { Dispatch, SetStateAction } from 'react';
import { isOpenCascadeRuntimeAvailable, type GeometryEngine } from './memberGeometry';
import type { ModelExtents, SectionAxis, SectionBoxState, SectionMode } from './sectionMath';
import type { ViewerLabels } from './viewerLabels';

interface SectionControlsProps {
  labels: ViewerLabels;
  sectionMode: SectionMode;
  setSectionMode: Dispatch<SetStateAction<SectionMode>>;
  sectionAxis: SectionAxis;
  setSectionAxis: Dispatch<SetStateAction<SectionAxis>>;
  axisRange: { min: number; max: number };
  effectivePosition: number;
  setSectionPosition: Dispatch<SetStateAction<number | null>>;
  effectiveThickness: number;
  setSectionThickness: Dispatch<SetStateAction<number | null>>;
  effectiveBox: SectionBoxState;
  setSectionBox: Dispatch<SetStateAction<SectionBoxState | null>>;
  extents: ModelExtents;
  geometryEngine: GeometryEngine;
  setGeometryEngine: Dispatch<SetStateAction<GeometryEngine>>;
}

export function SectionControls({
  labels,
  sectionMode,
  setSectionMode,
  sectionAxis,
  setSectionAxis,
  axisRange,
  effectivePosition,
  setSectionPosition,
  effectiveThickness,
  setSectionThickness,
  effectiveBox,
  setSectionBox,
  extents,
  geometryEngine,
  setGeometryEngine,
}: SectionControlsProps) {
  const openCascadeAvailable = isOpenCascadeRuntimeAvailable();

  return (
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
