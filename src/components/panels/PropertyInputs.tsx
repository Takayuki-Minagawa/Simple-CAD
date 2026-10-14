import { useId, useState } from 'react';
import { useI18n } from '@/i18n';
import { parseLengthMm } from '@/domain/geometry/units';

interface Draft {
  text: string;
  dirty: boolean;
  /** Validation or rejection message shown under the field. */
  error: string | null;
  /** Value handed to `onChange`; cleared once the parent reflects it. */
  submitted: number | null;
}

const CLEAN_DRAFT: Draft = { text: '', dirty: false, error: null, submitted: null };

function valuesMatch(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-6);
}

/**
 * Numeric property row. Validates before committing (R02): an invalid value is
 * never handed to the store, the typed text stays editable, and the reason is
 * announced next to the field through `aria-describedby`. When the store rejects
 * an otherwise valid value (for example a zero-length member) the row reports
 * that too instead of silently reverting.
 */
export function CoordRow({
  label,
  value,
  placeholder,
  mixed = false,
  mixedLabel = 'Mixed',
  onChange,
  min,
  max,
  exclusiveMin = false,
  unit,
  fieldKey,
}: {
  label: string;
  value: number;
  placeholder?: string;
  mixed?: boolean;
  mixedLabel?: string;
  onChange: (v: number) => void;
  /** Smallest accepted value (inclusive unless `exclusiveMin`). */
  min?: number;
  /** Largest accepted value (inclusive). */
  max?: number;
  exclusiveMin?: boolean;
  /** `mm` enables `2m` / `250mm` suffixes; the stored value is always mm. */
  unit?: 'mm';
  /** Stable key so other panels can focus this field (`data-prop-field`). */
  fieldKey?: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const displayText = mixed ? '' : (placeholder ?? String(value));
  const [draft, setDraft] = useState<Draft>(CLEAN_DRAFT);
  const text = draft.dirty ? draft.text : displayText;

  // Confirm that a submitted value actually landed in the model. The store commits
  // synchronously, so the render that carries `submitted` already sees the new
  // `value`; adjusting state during render avoids an extra effect pass.
  if (draft.submitted != null) {
    setDraft(
      valuesMatch(value, draft.submitted)
        ? CLEAN_DRAFT
        : { ...draft, error: t.propRejected, submitted: null },
    );
  }

  const validate = (num: number): string | null => {
    if (!Number.isFinite(num)) return t.propInvalidNumber;
    if (min != null && max != null && (num < min || num > max)) {
      return t.propOutOfRange.replace('{min}', String(min)).replace('{max}', String(max));
    }
    if (min != null && exclusiveMin && num <= min) {
      return min === 0 ? t.propMustBePositive : t.propOutOfRange.replace('{min}', `>${min}`).replace('{max}', '∞');
    }
    if (min != null && !exclusiveMin && num < min) {
      return min === 0 ? t.propMustBeNonNegative : t.propOutOfRange.replace('{min}', String(min)).replace('{max}', '∞');
    }
    if (max != null && num > max) {
      return t.propOutOfRange.replace('{min}', '-∞').replace('{max}', String(max));
    }
    return null;
  };

  const commit = () => {
    if (!draft.dirty) return;
    const parsed = unit === 'mm' ? parseLengthMm(text) : parseFloat(text);
    const num = parsed == null ? Number.NaN : parsed;
    const error = validate(num);
    if (error) {
      setDraft((current) => ({ ...current, error, submitted: null }));
      return;
    }
    // A value equal to the fallback still has meaning when the selection is
    // mixed: it resolves every selected object to that common value.
    if (mixed || num !== value) {
      onChange(num);
      setDraft((current) => ({ ...current, error: null, submitted: num }));
    } else {
      setDraft(CLEAN_DRAFT);
    }
  };

  const errorId = `${id}-error`;
  return (
    <div className="prop-row" style={{ flexWrap: 'wrap' }}>
      <label htmlFor={id} className="prop-label">
        {label}
      </label>
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
        <input
          id={id}
          className="prop-input"
          data-prop-field={fieldKey}
          value={text}
          placeholder={placeholder}
          aria-invalid={draft.error ? true : undefined}
          aria-describedby={draft.error ? errorId : undefined}
          style={draft.error ? { borderColor: 'var(--error)' } : undefined}
          onChange={(e) =>
            setDraft({ text: e.target.value, dirty: true, error: null, submitted: null })
          }
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setDraft(CLEAN_DRAFT);
          }}
        />
        {mixed && (
          <small style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {mixedLabel}
          </small>
        )}
      </span>
      {draft.error && (
        <small
          id={errorId}
          role="alert"
          style={{ flexBasis: '100%', color: 'var(--error)', fontSize: 11, textAlign: 'right' }}
        >
          {draft.error}
        </small>
      )}
    </div>
  );
}

export function VertexCoordInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
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
      aria-label={label}
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
