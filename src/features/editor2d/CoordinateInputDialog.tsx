import { useState, useCallback, useRef, useEffect } from 'react';
import { useI18n } from '@/i18n';
import type { Point2D } from '@/domain/geometry/types';
import { parseCoordinate } from './coordinateInput';

interface Props {
  lastPoint: Point2D | null;
  onSubmit: (pos: Point2D) => void;
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
        style={{ flex: 1, maxWidth: 260 }}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t.coordInputPlaceholder}
      />
    </form>
  );
}
