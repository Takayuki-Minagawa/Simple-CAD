import { useState } from 'react';

export function CoordRow({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number;
  placeholder?: string;
  onChange: (v: number) => void;
}) {
  const displayText = placeholder ?? String(value);
  const [draft, setDraft] = useState<{ text: string; dirty: boolean }>({
    text: '',
    dirty: false,
  });
  const text = draft.dirty ? draft.text : displayText;
  const commit = () => {
    const num = parseFloat(text);
    if (!isNaN(num) && num !== value) onChange(num);
    setDraft({ text: '', dirty: false });
  };
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      <input
        className="prop-input"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setDraft({ text: e.target.value, dirty: true })}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </div>
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
