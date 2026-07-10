import { useState } from 'react';

export function CoordRow({
  label,
  value,
  placeholder,
  mixed = false,
  mixedLabel = 'Mixed',
  onChange,
}: {
  label: string;
  value: number;
  placeholder?: string;
  mixed?: boolean;
  mixedLabel?: string;
  onChange: (v: number) => void;
}) {
  const displayText = mixed ? '' : (placeholder ?? String(value));
  const [draft, setDraft] = useState<{ text: string; dirty: boolean }>({
    text: '',
    dirty: false,
  });
  const text = draft.dirty ? draft.text : displayText;
  const commit = () => {
    const num = parseFloat(text);
    // A value equal to the fallback still has meaning when the selection is
    // mixed: it resolves every selected object to that common value.
    if (!isNaN(num) && (mixed || num !== value)) onChange(num);
    setDraft({ text: '', dirty: false });
  };
  return (
    <label className="prop-row">
      <span className="prop-label">{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
        <input
          className="prop-input"
          aria-label={label}
          value={text}
          placeholder={placeholder}
          onChange={(e) => setDraft({ text: e.target.value, dirty: true })}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        {mixed && (
          <small style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {mixedLabel}
          </small>
        )}
      </span>
    </label>
  );
}

export function VertexCoordInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const displayText = String(Math.round(value));
  const [draft, setDraft] = useState<{ text: string; dirty: boolean }>({
    text: '',
    dirty: false,
  });
  const text = draft.dirty ? draft.text : displayText;
  const commit = () => {
    if (!draft.dirty) return;
    const num = parseFloat(text);
    if (!isNaN(num) && num !== value) onChange(num);
    setDraft({ text: '', dirty: false });
  };
  return (
    <input
      className="prop-input"
      style={{ width: 60, fontSize: 10, padding: '1px 3px' }}
      value={text}
      onChange={(e) => {
        setDraft({ text: e.target.value, dirty: true });
      }}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}
