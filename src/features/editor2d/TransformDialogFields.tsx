export function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{children}</div>
  );
}

export function NumberField({
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
      <input
        className="prop-input"
        style={{ maxWidth: '100%' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
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
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <select
        className="prop-select"
        style={{ maxWidth: '100%' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        fontSize: 12,
        color: 'var(--text-secondary)',
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
