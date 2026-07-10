import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '@/i18n';
import { useEditorStore } from '@/app/store';
import type { Point2D } from '@/domain/geometry/types';
import { worldToScreen } from '@/domain/geometry/transform';
import { parseCoordinate, parseCoordinateResult, type CoordinateParseError } from './coordinateInput';

function errorHint(error: CoordinateParseError, locale: 'ja' | 'en'): string {
  if (locale === 'ja') {
    switch (error) {
      case 'invalid-polar':
        return '書式: @距離<角度 (例 @1000<45)';
      case 'no-direction':
        return '方向が未確定です。マウスを動かすか @x,y で入力';
      case 'invalid-pair':
      case 'unparseable':
      default:
        return '書式: x,y / @dx,dy / @距離<角度';
    }
  }
  switch (error) {
    case 'invalid-polar':
      return 'Format: @dist<angle (e.g. @1000<45)';
    case 'no-direction':
      return 'No direction yet. Move cursor or use @x,y';
    case 'invalid-pair':
    case 'unparseable':
    default:
      return 'Format: x,y / @dx,dy / @dist<angle';
  }
}

interface Props {
  lastPoint: Point2D | null;
  previewPoint: Point2D | null;
  onSubmit: (pos: Point2D) => void;
  /** Live ghost-point feedback for the current (unconfirmed) input (4-5). */
  onGhostChange?: (pos: Point2D | null) => void;
}

export function CoordinateInputBar({ lastPoint, previewPoint, onSubmit, onGhostChange }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { t, locale } = useI18n();

  // Parse current value for live validation + ghost preview.
  const trimmed = value.trim();
  const result = trimmed ? parseCoordinateResult(value, lastPoint, previewPoint) : null;
  const isInvalid = result != null && !result.ok && result.error !== 'empty';
  const ghostX = result?.ok ? result.point.x : null;
  const ghostY = result?.ok ? result.point.y : null;
  const onGhostChangeRef = useRef(onGhostChange);

  // Keep callback identity changes from retriggering ghost updates. Parent state
  // updates commonly create a fresh callback and could otherwise form a loop.
  useEffect(() => {
    onGhostChangeRef.current = onGhostChange;
  }, [onGhostChange]);

  useEffect(() => {
    onGhostChangeRef.current?.(
      ghostX != null && ghostY != null ? { x: ghostX, y: ghostY } : null,
    );
  }, [ghostX, ghostY]);

  // Clear ghost on unmount.
  useEffect(() => () => onGhostChangeRef.current?.(null), []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const pos = parseCoordinate(value, lastPoint, previewPoint);
      if (pos) {
        onSubmit(pos);
        setValue('');
        onGhostChange?.(null);
      }
    },
    [value, lastPoint, previewPoint, onSubmit, onGhostChange],
  );

  // Focus when a digit or @ is pressed and this bar is visible
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (/^[0-9@+\-.]$/.test(e.key)) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px',
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border-color)',
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t.coordInputLabel}:</span>
      <input
        ref={inputRef}
        className="prop-input"
        style={{
          flex: 1,
          maxWidth: 260,
          border: isInvalid ? '1px solid #dc2626' : undefined,
          outline: isInvalid ? '1px solid #dc2626' : undefined,
        }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t.coordInputPlaceholder}
      />
      {isInvalid && result && !result.ok && (
        <span style={{ color: '#dc2626', whiteSpace: 'nowrap' }}>{errorHint(result.error, locale)}</span>
      )}
    </form>
  );
}

type LockField = 'length' | 'angle' | null;

interface DynamicInputProps {
  /** Anchor for relative/polar input (last placed point). */
  lastPoint: Point2D | null;
  /** Current cursor world position (drives default length/angle). */
  cursorWorld: Point2D | null;
  onSubmit: (pos: Point2D) => void;
  onGhostChange?: (pos: Point2D | null) => void;
}

/**
 * Dynamic input (4-1): a cursor-following overlay with length + angle fields.
 * Tab switches/locks the active field. Confirm bridges to the existing
 * coordinate-parsing path via a polar `@length<angle` string.
 *
 * Mounted only while a segment-style draw is in progress (lastPoint != null).
 */
export function DynamicInput({ lastPoint, cursorWorld, onSubmit, onGhostChange }: DynamicInputProps) {
  const { locale } = useI18n();
  const pan = useEditorStore((s) => s.pan);
  const zoom = useEditorStore((s) => s.zoom);

  const [lengthStr, setLengthStr] = useState('');
  const [angleStr, setAngleStr] = useState('');
  const [lock, setLock] = useState<LockField>('length');
  const lengthRef = useRef<HTMLInputElement>(null);
  const angleRef = useRef<HTMLInputElement>(null);

  // Live values from cursor; locked fields keep their typed value.
  const liveLength = lastPoint && cursorWorld ? Math.hypot(cursorWorld.x - lastPoint.x, cursorWorld.y - lastPoint.y) : 0;
  let liveAngle =
    lastPoint && cursorWorld ? (Math.atan2(cursorWorld.y - lastPoint.y, cursorWorld.x - lastPoint.x) * 180) / Math.PI : 0;
  if (liveAngle < 0) liveAngle += 360;

  const effLength = lock === 'length' && lengthStr !== '' ? parseFloat(lengthStr) : liveLength;
  const effAngle = lock === 'angle' && angleStr !== '' ? parseFloat(angleStr) : liveAngle;

  // Auto-focus the length field when the overlay appears.
  useEffect(() => {
    lengthRef.current?.focus();
    lengthRef.current?.select();
  }, [lastPoint]);

  // Resolve the would-be point for ghost preview.
  const resolved =
    lastPoint && Number.isFinite(effLength) && Number.isFinite(effAngle)
      ? {
          x: lastPoint.x + effLength * Math.cos((effAngle * Math.PI) / 180),
          y: lastPoint.y + effLength * Math.sin((effAngle * Math.PI) / 180),
        }
      : null;

  useEffect(() => {
    onGhostChange?.(resolved);
    return () => onGhostChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved?.x, resolved?.y]);

  const confirm = useCallback(() => {
    if (!lastPoint) return;
    const len = lengthStr !== '' ? parseFloat(lengthStr) : liveLength;
    const ang = angleStr !== '' ? parseFloat(angleStr) : liveAngle;
    if (!Number.isFinite(len) || !Number.isFinite(ang) || len === 0) return;
    onSubmit({
      x: lastPoint.x + len * Math.cos((ang * Math.PI) / 180),
      y: lastPoint.y + len * Math.sin((ang * Math.PI) / 180),
    });
    setLengthStr('');
    setAngleStr('');
    setLock('length');
    onGhostChange?.(null);
  }, [lastPoint, lengthStr, angleStr, liveLength, liveAngle, onSubmit, onGhostChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (lock === 'length' || lock === null) {
          setLock('angle');
          angleRef.current?.focus();
          angleRef.current?.select();
        } else {
          setLock('length');
          lengthRef.current?.focus();
          lengthRef.current?.select();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        confirm();
      }
    },
    [lock, confirm],
  );

  if (!lastPoint || !cursorWorld) return null;

  const screen = worldToScreen(cursorWorld, pan, zoom);
  const lenLabel = locale === 'ja' ? '長さ' : 'Len';
  const angLabel = locale === 'ja' ? '角度' : 'Ang';

  const fieldStyle = (active: boolean): React.CSSProperties => ({
    width: 64,
    fontSize: 11,
    padding: '1px 4px',
    border: active ? '1px solid var(--color-selection, #3b82f6)' : '1px solid var(--border-color, #ccc)',
    background: 'var(--bg-panel, #fff)',
    color: 'var(--text-primary, #111)',
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: screen.x + 16,
        top: screen.y + 16,
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        padding: '3px 6px',
        background: 'var(--bg-panel, rgba(255,255,255,0.95))',
        border: '1px solid var(--border-color, #ccc)',
        borderRadius: 4,
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
        pointerEvents: 'auto',
        zIndex: 20,
        fontSize: 11,
      }}
    >
      <label style={{ display: 'flex', gap: 2, alignItems: 'center', color: 'var(--text-secondary)' }}>
        {lenLabel}
        <input
          ref={lengthRef}
          style={fieldStyle(lock === 'length')}
          value={lengthStr !== '' ? lengthStr : liveLength.toFixed(0)}
          onFocus={() => setLock('length')}
          onChange={(e) => setLengthStr(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </label>
      <label style={{ display: 'flex', gap: 2, alignItems: 'center', color: 'var(--text-secondary)' }}>
        {angLabel}
        <input
          ref={angleRef}
          style={fieldStyle(lock === 'angle')}
          value={angleStr !== '' ? angleStr : liveAngle.toFixed(1)}
          onFocus={() => setLock('angle')}
          onChange={(e) => setAngleStr(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        °
      </label>
    </div>
  );
}
