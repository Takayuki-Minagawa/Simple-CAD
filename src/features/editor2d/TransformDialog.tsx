import { useState } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { getSelectionBounds, type TransformAnchor } from '@/domain/structural/editTransform';
import { CheckboxField, NumberField, SectionTitle, SelectField } from './TransformDialogFields';
import { formatValue, parseCount, parseNumber, type TransformMode } from './transformDialogModel';
import { showAlert } from '@/app/browserDialogs';

interface Props {
  onClose: () => void;
}

export function TransformDialog({ onClose }: Props) {
  const data = useProjectStore((state) => state.data);
  const translateEntities = useProjectStore((state) => state.translateEntities);
  const duplicateEntities = useProjectStore((state) => state.duplicateEntities);
  const scaleEntities = useProjectStore((state) => state.scaleEntities);
  const stretchEntities = useProjectStore((state) => state.stretchEntities);
  const offsetEntities = useProjectStore((state) => state.offsetEntities);
  const mirrorEntities = useProjectStore((state) => state.mirrorEntities);
  const arrayEntities = useProjectStore((state) => state.arrayEntities);
  const { selectedIds, setSelectedIds } = useEditorStore();
  const { t } = useI18n();
  const bounds = data && selectedIds.length > 0 ? getSelectionBounds(data, selectedIds) : null;
  const defaultOriginX = bounds ? formatValue(bounds.center.x) : '0';
  const defaultOriginY = bounds ? formatValue(bounds.center.y) : '0';
  const defaultTargetWidth = bounds ? formatValue(bounds.width) : '0';
  const defaultTargetHeight = bounds ? formatValue(bounds.height) : '0';
  const [mode, setMode] = useState<TransformMode>('move');
  const [dx, setDx] = useState('0');
  const [dy, setDy] = useState('0');
  const [copyCount, setCopyCount] = useState('1');
  const [originX, setOriginX] = useState(defaultOriginX);
  const [originY, setOriginY] = useState(defaultOriginY);
  const [scaleX, setScaleX] = useState('1');
  const [scaleY, setScaleY] = useState('1');
  const [targetWidth, setTargetWidth] = useState(defaultTargetWidth);
  const [targetHeight, setTargetHeight] = useState(defaultTargetHeight);
  const [anchorX, setAnchorX] = useState<TransformAnchor>('center');
  const [anchorY, setAnchorY] = useState<TransformAnchor>('center');
  // Offset
  const [offsetDistance, setOffsetDistance] = useState('1000');
  // Mirror
  const [mirrorAxis, setMirrorAxis] = useState<'horizontal' | 'vertical' | 'custom'>('horizontal');
  const [mirrorAngle, setMirrorAngle] = useState('0');
  const [mirrorCopy, setMirrorCopy] = useState(true);
  // Array
  const [arrayRows, setArrayRows] = useState('2');
  const [arrayCols, setArrayCols] = useState('2');
  const [arrayRowSpacing, setArrayRowSpacing] = useState('3000');
  const [arrayColSpacing, setArrayColSpacing] = useState('3000');

  if (!data || selectedIds.length === 0 || !bounds) return null;

  const labels = {
    title: t.transformTitle,
    subtitle: t.transformSelected.replace('{count}', String(selectedIds.length)),
    currentBounds: t.transformCurrentBounds
      .replace('{width}', formatValue(bounds.width))
      .replace('{height}', formatValue(bounds.height)),
    modeMove: t.transformMove,
    modeCopy: t.transformCopy,
    modeScale: t.transformScale,
    modeStretch: t.transformStretch,
    dx: t.transformDx,
    dy: t.transformDy,
    count: t.transformCopyCount,
    originX: t.transformOriginX,
    originY: t.transformOriginY,
    scaleX: t.transformScaleX,
    scaleY: t.transformScaleY,
    targetWidth: t.transformTargetWidth,
    targetHeight: t.transformTargetHeight,
    anchorX: t.transformAnchorX,
    anchorY: t.transformAnchorY,
    anchorMinX: t.transformAnchorMinX,
    anchorCenterX: t.transformAnchorCenterX,
    anchorMaxX: t.transformAnchorMaxX,
    anchorMinY: t.transformAnchorMinY,
    anchorCenterY: t.transformAnchorCenterY,
    anchorMaxY: t.transformAnchorMaxY,
    cancel: t.exportCancel,
    apply: t.transformApply,
    invalidNumber: t.transformInvalidNumber,
    invalidScale: t.transformInvalidScale,
    invalidCount: t.transformInvalidCount,
    invalidStretch: t.transformInvalidStretch,
    lockedWidth: t.transformLockedWidth,
    lockedHeight: t.transformLockedHeight,
  };

  const anchorXOptions = [
    { value: 'min', label: labels.anchorMinX },
    { value: 'center', label: labels.anchorCenterX },
    { value: 'max', label: labels.anchorMaxX },
  ];

  const anchorYOptions = [
    { value: 'min', label: labels.anchorMinY },
    { value: 'center', label: labels.anchorCenterY },
    { value: 'max', label: labels.anchorMaxY },
  ];

  const mirrorAxisOptions = [
    { value: 'horizontal', label: t.transformAxisHorizontal },
    { value: 'vertical', label: t.transformAxisVertical },
    { value: 'custom', label: t.transformAxisCustom },
  ];

  const handleApply = () => {
    if (mode === 'move') {
      const nextDx = parseNumber(dx);
      const nextDy = parseNumber(dy);
      if (nextDx === null || nextDy === null) {
        showAlert(labels.invalidNumber);
        return;
      }
      translateEntities(selectedIds, nextDx, nextDy);
      onClose();
      return;
    }

    if (mode === 'copy') {
      const nextDx = parseNumber(dx);
      const nextDy = parseNumber(dy);
      const nextCount = parseCount(copyCount);
      if (nextDx === null || nextDy === null) {
        showAlert(labels.invalidNumber);
        return;
      }
      if (nextCount === null) {
        showAlert(labels.invalidCount);
        return;
      }
      const createdIds = duplicateEntities(selectedIds, nextDx, nextDy, nextCount);
      if (createdIds.length > 0) {
        setSelectedIds(createdIds);
      }
      onClose();
      return;
    }

    if (mode === 'scale') {
      const nextOriginX = parseNumber(originX);
      const nextOriginY = parseNumber(originY);
      const nextScaleX = parseNumber(scaleX);
      const nextScaleY = parseNumber(scaleY);
      if (
        nextOriginX === null ||
        nextOriginY === null ||
        nextScaleX === null ||
        nextScaleY === null
      ) {
        showAlert(labels.invalidNumber);
        return;
      }
      if (nextScaleX === 0 || nextScaleY === 0) {
        showAlert(labels.invalidScale);
        return;
      }
      scaleEntities(selectedIds, { x: nextOriginX, y: nextOriginY }, nextScaleX, nextScaleY);
      onClose();
      return;
    }

    if (mode === 'stretch') {
      const nextTargetWidth = parseNumber(targetWidth);
      const nextTargetHeight = parseNumber(targetHeight);
      if (nextTargetWidth === null || nextTargetHeight === null) {
        showAlert(labels.invalidNumber);
        return;
      }
      if (nextTargetWidth < 0 || nextTargetHeight < 0) {
        showAlert(labels.invalidStretch);
        return;
      }
      if (bounds.width === 0 && nextTargetWidth !== 0) {
        showAlert(labels.lockedWidth);
        return;
      }
      if (bounds.height === 0 && nextTargetHeight !== 0) {
        showAlert(labels.lockedHeight);
        return;
      }
      stretchEntities(selectedIds, {
        targetWidth: nextTargetWidth,
        targetHeight: nextTargetHeight,
        anchorX,
        anchorY,
      });
      onClose();
      return;
    }

    if (mode === 'offset') {
      const dist = parseNumber(offsetDistance);
      if (dist === null) {
        showAlert(labels.invalidNumber);
        return;
      }
      const createdIds = offsetEntities(selectedIds, dist);
      if (createdIds.length > 0) {
        setSelectedIds(createdIds);
      }
      onClose();
      return;
    }

    if (mode === 'mirror') {
      let axisStart = bounds.center;
      let axisEnd = { x: bounds.center.x + 1, y: bounds.center.y };
      if (mirrorAxis === 'horizontal') {
        // Mirror across horizontal axis (Y stays same, X flips) -> axis is horizontal line
        axisStart = { x: bounds.center.x, y: bounds.center.y };
        axisEnd = { x: bounds.center.x + 1, y: bounds.center.y };
      } else if (mirrorAxis === 'vertical') {
        axisStart = { x: bounds.center.x, y: bounds.center.y };
        axisEnd = { x: bounds.center.x, y: bounds.center.y + 1 };
      } else {
        const angle = parseNumber(mirrorAngle);
        if (angle === null) {
          showAlert(labels.invalidNumber);
          return;
        }
        const rad = (angle * Math.PI) / 180;
        axisStart = bounds.center;
        axisEnd = {
          x: bounds.center.x + Math.cos(rad),
          y: bounds.center.y + Math.sin(rad),
        };
      }
      const createdIds = mirrorEntities(selectedIds, axisStart, axisEnd, mirrorCopy);
      if (createdIds.length > 0) {
        setSelectedIds(createdIds);
      }
      onClose();
      return;
    }

    if (mode === 'array') {
      const rows = parseCount(arrayRows);
      const cols = parseCount(arrayCols);
      const rowSpacing = parseNumber(arrayRowSpacing);
      const colSpacing = parseNumber(arrayColSpacing);
      if (rows === null || cols === null) {
        showAlert(labels.invalidCount);
        return;
      }
      if (rowSpacing === null || colSpacing === null) {
        showAlert(labels.invalidNumber);
        return;
      }
      const createdIds = arrayEntities(selectedIds, {
        rows,
        columns: cols,
        rowSpacing,
        colSpacing,
      });
      if (createdIds.length > 0) {
        setSelectedIds(createdIds);
      }
      onClose();
      return;
    }
  };

  const allModes: Array<[TransformMode, string]> = [
    ['move', labels.modeMove],
    ['copy', labels.modeCopy],
    ['scale', labels.modeScale],
    ['stretch', labels.modeStretch],
    ['offset', t.transformOffset],
    ['mirror', t.transformMirror],
    ['array', t.transformArray],
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-modal-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-modal)',
          borderRadius: 8,
          padding: 24,
          width: 520,
          maxWidth: 'min(520px, calc(100vw - 32px))',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          color: 'var(--text-primary)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>{labels.title}</h3>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{labels.subtitle}</div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
          {labels.currentBounds}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {allModes.map(([value, label]) => (
            <button
              key={value}
              className={`toolbar-btn ${mode === value ? 'active' : ''}`}
              style={{
                background: mode === value ? 'var(--accent)' : 'var(--border-color)',
                color: mode === value ? '#fff' : 'var(--text-primary)',
              }}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'move' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <SectionTitle>{labels.modeMove}</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <NumberField label={labels.dx} value={dx} onChange={setDx} />
              <NumberField label={labels.dy} value={dy} onChange={setDy} />
            </div>
          </div>
        )}

        {mode === 'copy' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <SectionTitle>{labels.modeCopy}</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <NumberField label={labels.dx} value={dx} onChange={setDx} />
              <NumberField label={labels.dy} value={dy} onChange={setDy} />
              <NumberField label={labels.count} value={copyCount} onChange={setCopyCount} />
            </div>
          </div>
        )}

        {mode === 'scale' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <SectionTitle>{labels.modeScale}</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <NumberField label={labels.originX} value={originX} onChange={setOriginX} />
              <NumberField label={labels.originY} value={originY} onChange={setOriginY} />
              <NumberField label={labels.scaleX} value={scaleX} onChange={setScaleX} />
              <NumberField label={labels.scaleY} value={scaleY} onChange={setScaleY} />
            </div>
          </div>
        )}

        {mode === 'stretch' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <SectionTitle>{labels.modeStretch}</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <NumberField
                label={labels.targetWidth}
                value={targetWidth}
                onChange={setTargetWidth}
              />
              <NumberField
                label={labels.targetHeight}
                value={targetHeight}
                onChange={setTargetHeight}
              />
              <SelectField
                label={labels.anchorX}
                value={anchorX}
                options={anchorXOptions}
                onChange={(value) => setAnchorX(value as TransformAnchor)}
              />
              <SelectField
                label={labels.anchorY}
                value={anchorY}
                options={anchorYOptions}
                onChange={(value) => setAnchorY(value as TransformAnchor)}
              />
            </div>
          </div>
        )}

        {mode === 'offset' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <SectionTitle>{t.transformOffset}</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <NumberField
                label={t.transformOffsetDistance}
                value={offsetDistance}
                onChange={setOffsetDistance}
              />
            </div>
          </div>
        )}

        {mode === 'mirror' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <SectionTitle>{t.transformMirror}</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <SelectField
                label={t.transformMirrorAxis}
                value={mirrorAxis}
                options={mirrorAxisOptions}
                onChange={(v) => setMirrorAxis(v as 'horizontal' | 'vertical' | 'custom')}
              />
              {mirrorAxis === 'custom' && (
                <NumberField
                  label={t.transformAxisAngle}
                  value={mirrorAngle}
                  onChange={setMirrorAngle}
                />
              )}
            </div>
            <CheckboxField
              label={t.transformMirrorCopy}
              checked={mirrorCopy}
              onChange={setMirrorCopy}
            />
          </div>
        )}

        {mode === 'array' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <SectionTitle>{t.transformArray}</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <NumberField
                label={t.transformArrayColumns}
                value={arrayCols}
                onChange={setArrayCols}
              />
              <NumberField label={t.transformArrayRows} value={arrayRows} onChange={setArrayRows} />
              <NumberField
                label={t.transformArrayColSpacing}
                value={arrayColSpacing}
                onChange={setArrayColSpacing}
              />
              <NumberField
                label={t.transformArrayRowSpacing}
                value={arrayRowSpacing}
                onChange={setArrayRowSpacing}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            className="toolbar-btn"
            style={{ background: 'var(--border-color)', color: 'var(--text-primary)' }}
            onClick={onClose}
          >
            {labels.cancel}
          </button>
          <button
            className="toolbar-btn"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={handleApply}
          >
            {labels.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
