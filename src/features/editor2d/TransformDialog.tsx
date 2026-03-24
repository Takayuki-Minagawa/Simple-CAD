import { useState } from 'react';
import { useEditorStore, useProjectStore } from '@/app/store';
import { useI18n } from '@/i18n';
import { getSelectionBounds, type TransformAnchor } from '@/domain/structural/editTransform';

interface Props {
  onClose: () => void;
}

type TransformMode = 'move' | 'copy' | 'scale' | 'stretch';

function formatValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function parseNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCount(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function SectionTitle({ children }: { children: string }) {
  return <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{children}</div>;
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <input className="prop-input" style={{ maxWidth: '100%' }} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <select className="prop-select" style={{ maxWidth: '100%' }} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TransformDialog({ onClose }: Props) {
  const data = useProjectStore((state) => state.data);
  const translateEntities = useProjectStore((state) => state.translateEntities);
  const duplicateEntities = useProjectStore((state) => state.duplicateEntities);
  const scaleEntities = useProjectStore((state) => state.scaleEntities);
  const stretchEntities = useProjectStore((state) => state.stretchEntities);
  const { selectedIds, setSelectedIds } = useEditorStore();
  const { locale } = useI18n();
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

  if (!data || selectedIds.length === 0 || !bounds) return null;

  const labels =
    locale === 'ja'
      ? {
          title: '変形',
          subtitle: `${selectedIds.length} 件選択中`,
          currentBounds: `選択範囲: W ${formatValue(bounds.width)} mm / H ${formatValue(bounds.height)} mm`,
          modeMove: '移動',
          modeCopy: '複写',
          modeScale: '縮尺',
          modeStretch: 'パラメトリック',
          dx: 'X移動量',
          dy: 'Y移動量',
          count: '複写数',
          originX: '基点 X',
          originY: '基点 Y',
          scaleX: 'X倍率',
          scaleY: 'Y倍率',
          targetWidth: '目標幅',
          targetHeight: '目標高さ',
          anchorX: 'X固定位置',
          anchorY: 'Y固定位置',
          anchorMinX: '左',
          anchorCenterX: '中央',
          anchorMaxX: '右',
          anchorMinY: '下',
          anchorCenterY: '中央',
          anchorMaxY: '上',
          cancel: 'キャンセル',
          apply: '適用',
          invalidNumber: '数値入力が不正です。',
          invalidScale: '倍率に 0 は指定できません。',
          invalidCount: '複写数は 1 以上の整数を指定してください。',
          invalidStretch: '幅と高さは 0 以上の値を指定してください。',
          lockedWidth: '選択範囲の幅が 0 のため、幅方向のパラメトリック変形はできません。',
          lockedHeight: '選択範囲の高さが 0 のため、高さ方向のパラメトリック変形はできません。',
        }
      : {
          title: 'Transform',
          subtitle: `${selectedIds.length} selected`,
          currentBounds: `Selection bounds: W ${formatValue(bounds.width)} mm / H ${formatValue(bounds.height)} mm`,
          modeMove: 'Move',
          modeCopy: 'Copy',
          modeScale: 'Scale',
          modeStretch: 'Parametric',
          dx: 'Delta X',
          dy: 'Delta Y',
          count: 'Copies',
          originX: 'Origin X',
          originY: 'Origin Y',
          scaleX: 'Scale X',
          scaleY: 'Scale Y',
          targetWidth: 'Target Width',
          targetHeight: 'Target Height',
          anchorX: 'Anchor X',
          anchorY: 'Anchor Y',
          anchorMinX: 'Left',
          anchorCenterX: 'Center',
          anchorMaxX: 'Right',
          anchorMinY: 'Bottom',
          anchorCenterY: 'Middle',
          anchorMaxY: 'Top',
          cancel: 'Cancel',
          apply: 'Apply',
          invalidNumber: 'Invalid numeric input.',
          invalidScale: 'Scale factor must not be 0.',
          invalidCount: 'Copy count must be an integer greater than 0.',
          invalidStretch: 'Width and height must be 0 or greater.',
          lockedWidth: 'The current selection width is 0, so width stretching is not available.',
          lockedHeight: 'The current selection height is 0, so height stretching is not available.',
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

  const handleApply = () => {
    if (mode === 'move') {
      const nextDx = parseNumber(dx);
      const nextDy = parseNumber(dy);
      if (nextDx === null || nextDy === null) {
        alert(labels.invalidNumber);
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
        alert(labels.invalidNumber);
        return;
      }
      if (nextCount === null) {
        alert(labels.invalidCount);
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
        alert(labels.invalidNumber);
        return;
      }
      if (nextScaleX === 0 || nextScaleY === 0) {
        alert(labels.invalidScale);
        return;
      }
      scaleEntities(selectedIds, { x: nextOriginX, y: nextOriginY }, nextScaleX, nextScaleY);
      onClose();
      return;
    }

    const nextTargetWidth = parseNumber(targetWidth);
    const nextTargetHeight = parseNumber(targetHeight);
    if (nextTargetWidth === null || nextTargetHeight === null) {
      alert(labels.invalidNumber);
      return;
    }
    if (nextTargetWidth < 0 || nextTargetHeight < 0) {
      alert(labels.invalidStretch);
      return;
    }
    if (bounds.width === 0 && nextTargetWidth !== 0) {
      alert(labels.lockedWidth);
      return;
    }
    if (bounds.height === 0 && nextTargetHeight !== 0) {
      alert(labels.lockedHeight);
      return;
    }
    stretchEntities(selectedIds, {
      targetWidth: nextTargetWidth,
      targetHeight: nextTargetHeight,
      anchorX,
      anchorY,
    });
    onClose();
  };

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{labels.title}</h3>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{labels.subtitle}</div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
          {labels.currentBounds}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {([
            ['move', labels.modeMove],
            ['copy', labels.modeCopy],
            ['scale', labels.modeScale],
            ['stretch', labels.modeStretch],
          ] as Array<[TransformMode, string]>).map(([value, label]) => (
            <button
              key={value}
              className={`toolbar-btn ${mode === value ? 'active' : ''}`}
              style={{ background: mode === value ? 'var(--accent)' : 'var(--border-color)', color: mode === value ? '#fff' : 'var(--text-primary)' }}
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
              <NumberField label={labels.targetWidth} value={targetWidth} onChange={setTargetWidth} />
              <NumberField label={labels.targetHeight} value={targetHeight} onChange={setTargetHeight} />
              <SelectField label={labels.anchorX} value={anchorX} options={anchorXOptions} onChange={(value) => setAnchorX(value as TransformAnchor)} />
              <SelectField label={labels.anchorY} value={anchorY} options={anchorYOptions} onChange={(value) => setAnchorY(value as TransformAnchor)} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="toolbar-btn" style={{ background: 'var(--border-color)', color: 'var(--text-primary)' }} onClick={onClose}>
            {labels.cancel}
          </button>
          <button className="toolbar-btn" style={{ background: 'var(--accent)', color: '#fff' }} onClick={handleApply}>
            {labels.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
