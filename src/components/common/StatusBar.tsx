import { useState } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import { getSnapModeLabel } from '@/app/snapMetadata';
import { getToolStatusLabel } from '@/app/toolMetadata';
import { getSelectionBounds } from '@/domain/structural/editTransform';
import { useI18n } from '@/i18n';

/** Format a millimetre value with the configured precision/unit. */
function formatValue(mm: number, decimals: number, unit: 'mm' | 'm'): string {
  const v = unit === 'm' ? mm / 1000 : mm;
  return v.toFixed(decimals);
}

/**
 * Bottom status bar. Every item is plain text so that assistive technology and
 * automation can read the editor state (coordinates, display unit, toggles,
 * tool, story, selection count) without inspecting colours. It is deliberately
 * not a live region: cursor coordinates change constantly.
 *
 * Items marked `secondary` collapse behind a toggle on narrow viewports (R07).
 */
export function StatusBar() {
  const cursorWorld = useEditorStore((s) => s.cursorWorld);
  const zoom = useEditorStore((s) => s.zoom);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const activeSnapModes = useEditorStore((s) => s.activeSnapModes);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const activeStory = useEditorStore((s) => s.activeStory);
  const activeTool = useEditorStore((s) => s.activeTool);
  const gridSpacing = useEditorStore((s) => s.gridSpacing);
  const statusDecimals = useEditorStore((s) => s.statusDecimals);
  const statusUnit = useEditorStore((s) => s.statusUnit);
  const orthoMode = useEditorStore((s) => s.orthoMode);
  const polarTrackingEnabled = useEditorStore((s) => s.polarTrackingEnabled);
  const polarAngleStep = useEditorStore((s) => s.polarAngleStep);
  const drawInputAssist = useEditorStore((s) => s.drawInputAssist);
  const setStatusDecimals = useEditorStore((s) => s.setStatusDecimals);
  const setStatusUnit = useEditorStore((s) => s.setStatusUnit);
  const drawAnchor = useEditorStore((s) => s.drawAnchor);
  const activeSnapPoint = useEditorStore((s) => s.activeSnapPoint);
  const data = useProjectStore((s) => s.data);
  const { t, locale } = useI18n();
  const [compact, setCompact] = useState(false);
  const activeSnapModeLabels = activeSnapModes.map((mode) => getSnapModeLabel(mode, t));

  const fmt = (mm: number) => formatValue(mm, statusDecimals, statusUnit);
  const unit = statusUnit;

  // Local labels (i18n owned elsewhere).
  const L = {
    dx: 'dX',
    dy: 'dY',
    dist: locale === 'ja' ? '距離' : 'Dist',
    angle: locale === 'ja' ? '角度' : 'Angle',
    width: locale === 'ja' ? '幅' : 'W',
    height: locale === 'ja' ? '高' : 'H',
    snap: locale === 'ja' ? 'スナップ点' : 'Snap',
    grid: locale === 'ja' ? 'グリッド' : 'Grid',
    prec: locale === 'ja' ? '精度' : 'Prec',
  };
  const onOff = (value: boolean) => (value ? t.statusOn : t.statusOff);

  // Drawing delta (dx/dy/distance/angle) relative to the current anchor.
  let drawDelta: { dx: number; dy: number; dist: number; angle: number } | null = null;
  if (drawAnchor && cursorWorld) {
    const dx = cursorWorld.x - drawAnchor.x;
    const dy = cursorWorld.y - drawAnchor.y;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    drawDelta = { dx, dy, dist: Math.hypot(dx, dy), angle };
  }

  // Selection bounding box (width/height) in plan.
  let selBounds: { width: number; height: number } | null = null;
  if (activeTool === 'select' && selectedIds.length > 0 && data) {
    const b = getSelectionBounds(data, selectedIds);
    if (b) selBounds = { width: b.width, height: b.height };
  }

  return (
    <div className={`status-bar ${compact ? 'compact' : ''}`} aria-label="Status">
      <span className="status-item" data-status="cursor">
        {cursorWorld
          ? `X: ${fmt(cursorWorld.x)}  Y: ${fmt(cursorWorld.y)} ${unit}`
          : 'X: ---  Y: ---'}
      </span>

      {drawDelta && (
        <span className="status-item" data-status="draw-delta">
          {L.dx}: {fmt(drawDelta.dx)} {L.dy}: {fmt(drawDelta.dy)} {L.dist}: {fmt(drawDelta.dist)}{' '}
          {unit} {L.angle}: {drawDelta.angle.toFixed(1)}°
        </span>
      )}

      {selBounds && (
        <span className="status-item" data-status="selection-bounds" title={t.statusSelectionBounds}>
          {L.width}: {fmt(selBounds.width)} {L.height}: {fmt(selBounds.height)} {unit}
        </span>
      )}

      {activeSnapPoint && (
        <span className="status-item" data-status="snap-point">
          {L.snap}: {fmt(activeSnapPoint.x)}, {fmt(activeSnapPoint.y)} {unit}
        </span>
      )}

      <span className="status-item" data-status="tool">
        {t.statusTool}: {getToolStatusLabel(activeTool, t)}
      </span>
      <span className="status-item" data-status="story">
        {t.statusStory}: {activeStory ?? '---'}
      </span>
      <span className="status-item" data-status="selected">
        {t.statusSelected}: {selectedIds.length}
      </span>

      <span className="status-item secondary" data-status="zoom">
        {t.statusZoom}: {(zoom * 1000).toFixed(0)}%
      </span>
      <span className="status-item secondary" data-status="grid">
        {L.grid}: {fmt(gridSpacing)} {unit}
      </span>
      <span className="status-item secondary" data-status="snap">
        {t.statusSnap}: {onOff(snapEnabled)}
      </span>
      <span className="status-item secondary" data-status="snap-modes">
        {t.statusSnapModes}:{' '}
        {activeSnapModeLabels.length > 0 ? activeSnapModeLabels.join(', ') : '---'}
      </span>
      <span className="status-item secondary" data-status="ortho">
        {t.statusOrtho}: {onOff(orthoMode)}
      </span>
      <span className="status-item secondary" data-status="polar">
        {t.statusPolar}: {polarTrackingEnabled ? `${t.statusOn} (${polarAngleStep}°)` : t.statusOff}
      </span>
      <span className="status-item secondary" data-status="input-assist">
        {t.inputAssist}: {onOff(drawInputAssist)}
      </span>

      <span
        className="status-item secondary"
        data-status="units"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        title={t.coordInputUnitHint}
      >
        {t.statusDisplayUnit}:
        <select
          aria-label={t.statusDisplayUnit}
          value={statusUnit}
          onChange={(e) => setStatusUnit(e.target.value as 'mm' | 'm')}
          style={{ fontSize: 'inherit' }}
        >
          <option value="mm">mm</option>
          <option value="m">m</option>
        </select>
        <span data-status="input-unit">{t.inputUnitHint}</span>
        {L.prec}:
        <select
          aria-label={L.prec}
          value={statusDecimals}
          onChange={(e) => setStatusDecimals(Number(e.target.value))}
          style={{ fontSize: 'inherit' }}
        >
          {[0, 1, 2, 3, 4].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </span>

      <button
        type="button"
        className="status-toggle"
        aria-pressed={!compact}
        aria-label={t.statusToggleLabel}
        title={t.statusToggleLabel}
        onClick={() => setCompact((value) => !value)}
      >
        {compact ? t.statusDetailed : t.statusCompact}
      </button>
    </div>
  );
}
