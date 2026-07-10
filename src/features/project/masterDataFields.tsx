import { type ReactNode, useState } from 'react';

export function SectionHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <h4 style={{ margin: 0, fontSize: 14, color: 'var(--accent)' }}>{title}</h4>
      <div style={{ display: 'flex', gap: 6 }}>{actions}</div>
    </div>
  );
}

function FieldShell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </label>
  );
}

export function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <FieldShell label={label}>
      <div
        style={{
          minHeight: 28,
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          padding: '6px 8px',
          background: 'var(--bg-secondary)',
          fontFamily: 'Menlo, Consolas, monospace',
          fontSize: 12,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </FieldShell>
  );
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FieldShell label={label}>
      <input className="prop-input" style={{ maxWidth: '100%' }} value={value} onChange={(event) => onChange(event.target.value)} />
    </FieldShell>
  );
}

export function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return <NumberFieldInput key={String(value)} label={label} value={value} onChange={onChange} />;
}

export function OptionalNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <OptionalNumberFieldInput
      key={value === undefined ? 'undefined' : String(value)}
      label={label}
      value={value}
      onChange={onChange}
    />
  );
}

function OptionalNumberFieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const committedDraft = value === undefined || !Number.isFinite(value) ? '' : String(value);
  const [draft, setDraft] = useState(committedDraft);
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (value !== undefined) onChange(undefined);
      window.setTimeout(() => setDraft(committedDraft), 0);
      return;
    }
    const next = Number(trimmed);
    if (!Number.isFinite(next)) {
      setDraft(committedDraft);
      return;
    }
    if (next !== value) onChange(next);
    window.setTimeout(() => setDraft(committedDraft), 0);
  };

  return (
    <FieldShell label={label}>
      <input
        className="prop-input"
        style={{ maxWidth: '100%' }}
        type="number"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            setDraft(committedDraft);
            event.preventDefault();
          }
        }}
      />
    </FieldShell>
  );
}

function NumberFieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const normalizedValue = Number.isFinite(value) ? value : 0;
  const [draft, setDraft] = useState(String(normalizedValue));
  const commit = () => {
    if (draft.trim() === '') {
      setDraft(String(normalizedValue));
      return;
    }
    const next = Number(draft);
    if (!Number.isFinite(next)) {
      setDraft(String(normalizedValue));
      return;
    }
    if (next !== normalizedValue) onChange(next);
    // A store boundary may reject the value (for example a non-positive
    // section dimension). Restore the actual prop value unless a successful
    // update remounts this keyed input with the new value first.
    window.setTimeout(() => setDraft(String(normalizedValue)), 0);
  };

  return (
    <FieldShell label={label}>
      <input
        className="prop-input"
        style={{ maxWidth: '100%' }}
        type="number"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            setDraft(String(normalizedValue));
            event.preventDefault();
          }
        }}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <FieldShell label={label}>
      <select className="prop-select" style={{ maxWidth: '100%' }} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function DeleteButton({
  label,
  disabled,
  hint,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 80 }}>
      <div style={{ height: 15, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>{hint}</div>
      <button className="toolbar-btn" onClick={onClick} disabled={disabled}>
        {label}
      </button>
    </div>
  );
}
