import { useEffect, useState } from 'react';

export function CoordRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const commit = () => {
    const num = parseFloat(text);
    if (!isNaN(num) && num !== value) onChange(num);
    else setText(String(value));
  };
  return (
    <div className="prop-row">
      <span className="prop-label">{label}</span>
      <input
        className="prop-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
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
  const [text, setText] = useState(String(Math.round(value)));
  useEffect(() => {
    setText(String(Math.round(value)));
  }, [value]);
  const commit = () => {
    const num = parseFloat(text);
    if (!isNaN(num) && num !== value) onChange(num);
    else setText(String(Math.round(value)));
  };
  return (
    <input
      className="prop-input"
      style={{ width: 60, fontSize: 10, padding: '1px 3px' }}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}
