import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '@/i18n';
import type { Point2D } from '@/domain/geometry/types';

interface Props {
  lastPoint: Point2D | null;
  onSubmit: (pos: Point2D) => void;
}

/**
 * Parses coordinate input in three formats:
 * - "x,y"        -> absolute coordinate
 * - "@dx,dy"     -> relative to lastPoint
 * - "@dist<angle" -> polar relative to lastPoint (angle in degrees)
 */
function parseCoordinate(input: string, lastPoint: Point2D | null): Point2D | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('@')) {
    const rest = trimmed.slice(1);

    // Polar: @distance<angle
    const polarMatch = rest.match(/^([+-]?\d+\.?\d*)\s*<\s*([+-]?\d+\.?\d*)$/);
    if (polarMatch) {
      const dist = parseFloat(polarMatch[1]);
      const angleDeg = parseFloat(polarMatch[2]);
      if (!Number.isFinite(dist) || !Number.isFinite(angleDeg)) return null;
      const rad = (angleDeg * Math.PI) / 180;
      const base = lastPoint ?? { x: 0, y: 0 };
      return {
        x: base.x + dist * Math.cos(rad),
        y: base.y + dist * Math.sin(rad),
      };
    }

    // Relative: @dx,dy
    const parts = rest.split(',');
    if (parts.length === 2) {
      const dx = parseFloat(parts[0]);
      const dy = parseFloat(parts[1]);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
      const base = lastPoint ?? { x: 0, y: 0 };
      return { x: base.x + dx, y: base.y + dy };
    }
    return null;
  }

  // Absolute: x,y
  const parts = trimmed.split(',');
  if (parts.length === 2) {
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  return null;
}

export function CoordinateInputBar({ lastPoint, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const pos = parseCoordinate(value, lastPoint);
      if (pos) {
        onSubmit(pos);
        setValue('');
      }
    },
    [value, lastPoint, onSubmit],
  );

  // Focus when a digit or @ is pressed and this bar is visible
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
      if (/^[0-9@\-.]$/.test(e.key)) {
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
        style={{ flex: 1, maxWidth: 260 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t.coordInputPlaceholder}
      />
    </form>
  );
}
